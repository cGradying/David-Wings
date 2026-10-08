import assert from 'node:assert/strict';
import { cardState, closeOrder, createOrder, ledger, localDay, migrate, saveClose, stats } from './core/core.js';
import { handleApi } from './core/routes.js';
import { seed } from './core/seed.js';
import { nodeAdapter } from './adapters/node.js';

const db = nodeAdapter(':memory:');
await migrate(db);
await seed(db);
const today = localDay(Date.now(), 'Asia/Manila');
const base = { items: [{ item_id: 1, qty: 2, flavor: 'Buffalo' }, { item_id: 7, qty: 1 }], type: 'dine-in', method: 'cash', tendered: 300 };
const fails = (p, re, msg) => assert.rejects(p, re, msg);

const count = async () => (await db.get('SELECT COUNT(*) AS n FROM orders')).n;
const before = await count();
const o = await createOrder(db, { ...base, card: (await cardState(db)).suggested });
assert.equal(await count(), before + 1);
assert.equal(o.total, 2 * 119 + 20, 'server computes price');
assert.equal(o.change, 300 - o.total, 'change stored');
assert.ok((await cardState(db)).used.includes(o.card), 'card in use');
await fails(createOrder(db, { ...base, card: o.card }), /already in use/, 'no double-assign');
await fails(createOrder(db, { ...base, card: 29, tendered: 10 }), /less than the total/, 'short cash blocked');
await fails(createOrder(db, { ...base, card: 99 }), /Card number/, 'pool bound');
await fails(createOrder(db, { ...base, card: 29, items: [{ item_id: 1, qty: 1 }] }), /flavor/, 'flavor required');
assert.equal(await count(), before + 1, 'failed orders leave nothing behind');
assert.equal((await db.get('SELECT COUNT(*) AS n FROM order_items WHERE order_id IS NULL')).n, 0);

await closeOrder(db, o.id, 'void', 'wrong order');
assert.ok(!(await cardState(db)).used.includes(o.card), 'void frees card');
await fails(closeOrder(db, o.id, 'void', 'x'), /already void/);
const o2 = await createOrder(db, { ...base, card: o.card });
assert.equal(o2.ref, o.ref + 1, 'ref keeps counting');
await closeOrder(db, o2.id, 'done');
assert.ok(!(await cardState(db)).used.includes(o.card), 'done frees card');

const s = await stats(db, 7);
assert.equal(s.series.length, 7);
assert.equal(s.series.reduce((a, d) => a + d.sales, 0), s.cur.sales, 'series sums to total');
assert.ok(s.items.length && s.flavors.length && s.hourly.length, 'insights populated');
const l = await ledger(db, today);
assert.equal(l.summary.cash + l.summary.gcash, l.summary.sales);

// Day close: expected = float + cash Sales; late void flags it amended, recounting clears it.
await saveClose(db, today, { float: 500 });
let c = await saveClose(db, today, { counted: 500 + l.summary.cash });
assert.equal(c.over_short, 0, 'drawer balances');
assert.ok(c.closed && !c.amended);
const late = (await ledger(db, today)).orders.find((x) => x.status === 'done' && x.method === 'cash');
await closeOrder(db, late.id, 'void', 'late mistake');
c = (await ledger(db, today)).close;
assert.ok(c.amended, 'late void amends the close');
assert.equal(c.over_short, late.total, 'counted now exceeds expected by the voided cash');
c = await saveClose(db, today, { counted: c.expected });
assert.ok(!c.amended && c.over_short === 0, 'recount clears amended');
await fails(saveClose(db, today, { counted: -5 }), /whole pesos/);

// Backup round-trips into a fresh database and rejects junk without touching data.
const dump = JSON.parse(JSON.stringify(await (await import('./core/core.js')).exportData(db)));
const db2 = nodeAdapter(':memory:'); await migrate(db2);
const { importData } = await import('./core/core.js');
await importData(db2, dump);
assert.deepEqual((await ledger(db2, today)).summary, (await ledger(db, today)).summary, 'restore reproduces the ledger');
await fails(importData(db2, { app: 'x' }), /Not a David Wings/);
await fails(importData(db2, { ...dump, tables: { ...dump.tables, orders: [{ id: 1, bogus: 1 }] } }), /damaged/);
assert.equal((await ledger(db2, today)).summary.count, (await ledger(db, today)).summary.count, 'bad restore left data alone');

// Same rules over HTTP routes (what the Worker serves).
const r = await handleApi(db, 'GET', '/api/ledger', new URLSearchParams(), {});
assert.equal(r.status, 200);
assert.equal((await handleApi(db, 'POST', '/api/orders', new URLSearchParams(), { ...base, card: 99 })).status, 400);
console.log('ok');
