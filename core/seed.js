import { cardState, closeOrder, createOrder, getSettings, migrate } from './core.js';

const MENU = [
  // name, category, price, flavored, weight (popularity). Prices from the owner's menu; edit in-app.
  ['Rice Bowl (boneless)', 'Rice Bowl', 65, 1, 12],
  ['D1 · 2pcs + Rice', 'Wings', 75, 1, 8],
  ['D1 · 2pcs + Rice + Drink', 'Wings', 95, 1, 6],
  ['D2 · 4pcs + Rice', 'Wings', 139, 1, 6],
  ['D2 · 4pcs + Rice + Drink', 'Wings', 159, 1, 5],
  ['Ala-carte 6pcs', 'Wings', 205, 1, 3],
  ['Ala-carte 8pcs', 'Wings', 270, 1, 2],
  ['Ala-carte 12pcs', 'Wings', 408, 1, 1.5],
  ['Party 20pcs', 'Party', 680, 1, 0.6],
  ['Party 30pcs', 'Party', 1025, 1, 0.3],
  ['Party 50pcs', 'Party', 1710, 1, 0.1],
  ['Barbecue sauce', 'Dips', 10, 0, 4],
  ['Gravy', 'Dips', 10, 0, 4],
  ['Garlic mayo', 'Dips', 10, 0, 3],
  ['Drink 16oz', 'Drinks', 25, 0, 6],
  ['Drink 22oz', 'Drinks', 30, 0, 4],
];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// days = 0 seeds the menu only (production). days > 0 adds fake orders for demos and tests.
export async function seed(db, days = 0) {
  // Installs from the mock-data build carry the old menu, fake sales and old flavors: reset them once.
  if (await db.get("SELECT 1 AS x FROM menu_items WHERE name = 'Wings Solo'")) {
    await db.batch([...['order_items', 'orders', 'day_close', 'menu_items'].map((t) => [`DELETE FROM ${t}`, []]),
      ['DELETE FROM settings WHERE key IN (\'flavors\', \'best_flavors\')', []]]);
    await migrate(db);
  }
  if ((await db.get('SELECT COUNT(*) AS n FROM menu_items')).n) return;
  await db.batch(MENU.map(([n, c, p, f], i) => ['INSERT INTO menu_items (name, category, price, flavored, sort) VALUES (?, ?, ?, ?, ?)', [n, c, p, f, i]]));
  if (days) await sampleOrders(db, days);
}

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

/** Fake sales for demos/tests. Orders are indistinguishable until loadSample tags them. */
export async function sampleOrders(db, days) {
  let n_orders = 0;
  const { pool, used } = await cardState(db);
  const free = [...Array(pool)].map((_, i) => i + 1).filter((c) => !used.includes(c));
  const items = (await db.all('SELECT * FROM menu_items ORDER BY id')).map((m, i) => ({ ...m, w: MENU[i][4] }));
  const flavors = JSON.parse((await getSettings(db)).flavors);
  const flavorW = [6, 4, 3, 10, 9];
  const rand = rng(2026);
  const pick = (arr, w) => {
    let r = rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < arr.length; i++) if ((r -= w[i]) < 0) return arr[i];
    return arr.at(-1);
  };
  const hours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const hourW = [2, 6, 10, 9, 5, 4, 6, 9, 8, 5, 2];
  const now = Date.now();
  for (let d = days; d >= 0; d--) {
    const base = new Date(now - d * 864e5);
    const dow = base.getDay();
    const n = Math.round((dow === 0 ? 14 : dow === 6 ? 22 : 28) * (0.8 + rand() * 0.5));
    for (let k = 0; k < n; k++) {
      const h = pick(hours, hourW);
      const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, Math.floor(rand() * 60)).getTime();
      if (at > now - 20 * 60e3) continue;
      const lines = [];
      for (let j = 0, c = 1 + Math.floor(rand() * 3); j < c; j++) {
        const it = pick(items, items.map((i) => i.w));
        lines.push({ item_id: it.id, qty: 1 + (rand() < 0.2 ? 1 : 0), flavor: it.flavored ? pick(flavors, flavorW) : undefined });
      }
      const total = lines.reduce((s, l) => s + items.find((i) => i.id === l.item_id).price * l.qty, 0);
      const method = rand() < 0.35 ? 'gcash' : 'cash';
      const o = await createOrder(db, {
        items: lines, type: rand() < 0.55 ? 'dine-in' : 'take-out', card: free[(n_orders++ * 7) % free.length], method,
        tendered: method === 'cash' ? Math.ceil(total / 50) * 50 + (rand() < 0.3 ? 50 : 0) : total,
        gcash_ref: method === 'gcash' ? String(Math.floor(1e12 + rand() * 9e12)) : undefined,
      }, at);
      await closeOrder(db, o.id, rand() < 0.03 ? 'void' : 'done', 'Customer changed mind', at + 6 * 60e3);
    }
  }
  // A few live orders so the queue isn't empty on first launch.
  const id = (name) => items.find((i) => i.name === name).id;
  const liveCards = [7, 12, 3].map((c) => (free.includes(c) ? c : null));
  const live = [
    { items: [{ item_id: id('D2 · 4pcs + Rice'), qty: 1, flavor: 'Garlic Parmesan' }, { item_id: id('Drink 16oz'), qty: 1 }], type: 'dine-in', method: 'cash', tendered: 200 },
    { items: [{ item_id: id('D1 · 2pcs + Rice'), qty: 1, flavor: 'Salted Egg' }, { item_id: id('Gravy'), qty: 2 }, { item_id: id('Drink 22oz'), qty: 1 }], type: 'take-out', method: 'gcash', gcash_ref: '4829104481923' },
    { items: [{ item_id: id('Party 20pcs'), qty: 1, flavor: 'Honey Barbeque' }, { item_id: id('Garlic mayo'), qty: 1 }], type: 'dine-in', method: 'cash', tendered: 700 },
  ];
  for (const [i, o] of live.entries()) if (liveCards[i]) await createOrder(db, { ...o, card: liveCards[i] }, now - (14 - i * 5) * 60e3);
}

export const sampleCount = async (db) => (await db.get("SELECT COUNT(*) AS n FROM orders WHERE uid LIKE 'demo-%'")).n;

let loadingSample = false; // blocks a second tap while the first load is still inserting
export async function loadSample(db, days = 7) {
  if (loadingSample) throw bad('Sample data is already loading', 409);
  loadingSample = true;
  try { return await loadSampleOnce(db, days); } finally { loadingSample = false; }
}

async function loadSampleOnce(db, days) {
  if (await sampleCount(db)) throw bad('Sample data is already loaded', 409);
  const { m } = await db.get('SELECT COALESCE(MAX(id), 0) AS m FROM orders');
  await sampleOrders(db, days);
  await db.run("UPDATE orders SET uid = 'demo-' || uid WHERE id > ?", [m]);
  return { count: await sampleCount(db) };
}

export async function clearSample(db) {
  const demo = "SELECT id FROM orders WHERE uid LIKE 'demo-%'";
  const removed = await sampleCount(db);
  await db.batch([
    ["DELETE FROM day_close WHERE day IN (SELECT day FROM orders WHERE uid LIKE 'demo-%') AND day NOT IN (SELECT day FROM orders WHERE uid NOT LIKE 'demo-%')", []],
    [`DELETE FROM order_items WHERE order_id IN (${demo})`, []],
    ["DELETE FROM orders WHERE uid LIKE 'demo-%'", []],
  ]);
  return { removed };
}
