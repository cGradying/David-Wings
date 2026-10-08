// Shared rules for every runtime. Talks to SQLite only through an adapter:
//   get(sql, args) -> row | undefined      all(sql, args) -> rows
//   run(sql, args) -> { changes }          batch([[sql, args], ...]) -> atomic, all-or-nothing
//   exec(script)   -> run several statements (migrations only)
// Unique-constraint failures must surface as errors whose message contains "UNIQUE".

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0), flavored INTEGER NOT NULL DEFAULT 0,
    available INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE, day TEXT NOT NULL, ref INTEGER NOT NULL, card INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('dine-in','take-out')),
    status TEXT NOT NULL CHECK (status IN ('preparing','done','void')),
    total INTEGER NOT NULL, method TEXT NOT NULL CHECK (method IN ('cash','gcash')),
    tendered INTEGER NOT NULL, change INTEGER NOT NULL, gcash_ref TEXT,
    void_reason TEXT, created_at INTEGER NOT NULL, done_at INTEGER,
    UNIQUE (day, ref)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_open_order_per_card ON orders(card) WHERE status = 'preparing';
  CREATE INDEX IF NOT EXISTS orders_day ON orders(day);
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
    item_id INTEGER NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL,
    flavor TEXT, qty INTEGER NOT NULL CHECK (qty > 0), price INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS day_close (
    day TEXT PRIMARY KEY, float INTEGER NOT NULL DEFAULT 0, counted INTEGER,
    closed_at INTEGER, amended INTEGER NOT NULL DEFAULT 0
  );
`;

const DEFAULT_SETTINGS = {
  pool_size: '30',
  theme: 'system',
  tz: 'Asia/Manila',
  gcash_name: 'David Wings and Cafe',
  gcash_qr: '',
  contact: 'PUP Sta. Mesa, Manila · facebook.com/PUPDavidsWingsandCafe',
  flavors: JSON.stringify(['Buffalo', 'Garlic Parmesan', 'Soy Garlic', 'Honey Butter', 'Salted Egg']),
  last_backup: '',
};

export const SETTING_KEYS = ['pool_size', 'theme', 'gcash_name', 'gcash_qr', 'contact', 'last_backup'];

const DAY_MS = 864e5;
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

export function localDay(ts = Date.now(), tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);
}
export function localHour(ts, tz) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(ts));
}

export async function migrate(db) {
  await db.exec(SCHEMA);
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
}

export async function getSettings(db) {
  return Object.fromEntries((await db.all('SELECT key, value FROM settings')).map((r) => [r.key, r.value]));
}

export async function saveSettings(db, patch) {
  const up = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  const stmts = SETTING_KEYS.filter((k) => k in patch).map((k) => [up, [k, String(patch[k])]]);
  if ('flavors' in patch) stmts.push([up, ['flavors', JSON.stringify(patch.flavors)]]);
  if (stmts.length) await db.batch(stmts);
  return getSettings(db);
}

export const getMenu = (db) => db.all('SELECT * FROM menu_items ORDER BY sort, id');

export async function updateMenuItem(db, id, { name, price, available }) {
  if (!String(name ?? '').trim() || !Number.isInteger(price) || price < 0) throw bad('Name and a whole-peso price needed');
  await db.run('UPDATE menu_items SET name = ?, price = ?, available = ? WHERE id = ?', [name.trim(), price, available ? 1 : 0, id]);
}

export async function cardState(db) {
  const pool = Number((await getSettings(db)).pool_size);
  const used = (await db.all("SELECT card FROM orders WHERE status = 'preparing'")).map((r) => r.card);
  let suggested = null;
  for (let n = 1; n <= pool; n++) if (!used.includes(n)) { suggested = n; break; }
  return { pool, used, suggested };
}

// Trust boundary: prices come from the DB, never from the client.
export async function createOrder(db, body, at = Date.now()) {
  const { items, type, card, method, tendered, gcash_ref } = body ?? {};
  if (!Array.isArray(items) || !items.length) throw bad('Order has no items');
  if (!['dine-in', 'take-out'].includes(type)) throw bad('Pick dine-in or take-out');
  if (!['cash', 'gcash'].includes(method)) throw bad('Pick cash or GCash');
  const settings = await getSettings(db);
  const flavors = JSON.parse(settings.flavors);
  let total = 0;
  const lines = [];
  for (const it of items) {
    const m = await db.get('SELECT * FROM menu_items WHERE id = ?', [it.item_id]);
    const qty = Number(it.qty);
    if (!m || !m.available) throw bad('Item unavailable');
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw bad('Bad quantity');
    if (m.flavored && !flavors.includes(it.flavor)) throw bad(`Pick a flavor for ${m.name}`);
    total += m.price * qty;
    lines.push({ m, qty, flavor: m.flavored ? it.flavor : null });
  }
  const pool = Number(settings.pool_size);
  if (!Number.isInteger(card) || card < 1 || card > pool) throw bad(`Card number must be 1–${pool}`);
  const paid = method === 'cash' ? Number(tendered) : total;
  if (!Number.isFinite(paid) || paid < total) throw bad('Cash tendered is less than the total');
  const day = localDay(at, settings.tz);
  const uid = crypto.randomUUID();
  // Ref is allocated inside the INSERT so concurrent writers cannot take the same one.
  const stmts = [[
    `INSERT INTO orders (uid, day, ref, card, type, status, total, method, tendered, change, gcash_ref, created_at)
     SELECT ?, ?, COALESCE(MAX(ref), 0) + 1, ?, ?, 'preparing', ?, ?, ?, ?, ?, ? FROM orders WHERE day = ?`,
    [uid, day, card, type, total, method, paid, paid - total, method === 'gcash' ? String(gcash_ref ?? '').slice(0, 40) : null, at, day],
  ], ...lines.map((l) => [
    'INSERT INTO order_items (order_id, item_id, name, category, flavor, qty, price) VALUES ((SELECT id FROM orders WHERE uid = ?), ?, ?, ?, ?, ?, ?)',
    [uid, l.m.id, l.m.name, l.m.category, l.flavor, l.qty, l.m.price],
  ])];
  try {
    await db.batch(stmts);
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw bad(`Card ${card} is already in use`);
    throw e;
  }
  return getOrder(db, (await db.get('SELECT id FROM orders WHERE uid = ?', [uid])).id);
}

const withItems = async (db, o) => ({ ...o, items: await db.all('SELECT name, flavor, qty, price FROM order_items WHERE order_id = ?', [o.id]) });

export async function getOrder(db, id) {
  const o = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  return o ? withItems(db, o) : null;
}

export async function closeOrder(db, id, status, reason = null, at = Date.now()) {
  const o = await db.get('SELECT status, day FROM orders WHERE id = ?', [id]);
  if (!o) throw bad('Order not found', 404);
  if (status === 'done' && o.status !== 'preparing') throw bad('Order is not being prepared');
  if (status === 'void' && o.status === 'void') throw bad('Order already void');
  if (status === 'void' && !String(reason ?? '').trim()) throw bad('Give a reason for the void');
  const stmts = [['UPDATE orders SET status = ?, void_reason = ?, done_at = ? WHERE id = ?',
    [status, status === 'void' ? String(reason).trim().slice(0, 120) : null, at, id]]];
  // A void after the day was counted changes its books: flag the close instead of blocking the cashier.
  if (status === 'void') stmts.push(['UPDATE day_close SET amended = 1 WHERE day = ? AND counted IS NOT NULL', [o.day]]);
  await db.batch(stmts);
  return getOrder(db, id);
}

export const preparingOrders = async (db) => Promise.all((await db.all("SELECT * FROM orders WHERE status = 'preparing' ORDER BY created_at")).map((o) => withItems(db, o)));
const ordersWhere = async (db, where, args = []) =>
  Promise.all((await db.all(`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC`, args)).map((o) => withItems(db, o)));

export async function topSellers(db, limit = 6) {
  return db.all(`SELECT oi.item_id, SUM(oi.qty) AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'void' AND o.created_at >= ? GROUP BY oi.item_id ORDER BY qty DESC LIMIT ?`, [Date.now() - 30 * DAY_MS, limit]);
}

export async function stats(db, days = 7) {
  const { tz } = await getSettings(db);
  const to = localDay(Date.now(), tz), from = localDay(Date.now() - (days - 1) * DAY_MS, tz);
  const prevFrom = localDay(Date.now() - (2 * days - 1) * DAY_MS, tz), prevTo = localDay(Date.now() - days * DAY_MS, tz);
  const ok = "o.status != 'void'", span = 'day BETWEEN ? AND ?';
  const sum = (a, b) => db.get(`SELECT COALESCE(SUM(total),0) AS sales, COUNT(*) AS orders FROM orders o WHERE ${ok} AND ${span}`, [a, b]);
  const split = (col) => db.all(`SELECT ${col} AS name, COUNT(*) AS orders, SUM(total) AS sales FROM orders o WHERE ${ok} AND ${span} GROUP BY ${col}`, [from, to]);
  const daily = new Map((await db.all(`SELECT day, SUM(total) AS sales, COUNT(*) AS orders FROM orders o WHERE ${ok} AND ${span} GROUP BY day`, [from, to])).map((d) => [d.day, d]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = localDay(Date.now() - i * DAY_MS, tz);
    series.push({ day, sales: daily.get(day)?.sales ?? 0, orders: daily.get(day)?.orders ?? 0 });
  }
  const byHour = new Map();
  for (const r of await db.all(`SELECT created_at FROM orders o WHERE ${ok} AND ${span}`, [from, to])) {
    const h = localHour(r.created_at, tz);
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  return {
    days, from, to, cur: await sum(from, to), prev: await sum(prevFrom, prevTo), series,
    hourly: [...byHour].map(([hour, orders]) => ({ hour, orders })),
    items: await db.all(`SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.price) AS sales FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE ${ok} AND ${span} GROUP BY oi.item_id ORDER BY qty DESC LIMIT 6`, [from, to]),
    flavors: await db.all(`SELECT oi.flavor AS name, SUM(oi.qty) AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE ${ok} AND ${span} AND oi.flavor IS NOT NULL GROUP BY oi.flavor ORDER BY qty DESC`, [from, to]),
    methods: await split('method'), types: await split('type'),
    voided: (await db.get("SELECT COUNT(*) AS n FROM orders WHERE status = 'void' AND day BETWEEN ? AND ?", [from, to])).n,
  };
}

export async function ledger(db, day) {
  const orders = await ordersWhere(db, 'day = ?', [day]);
  const live = orders.filter((o) => o.status !== 'void');
  const sum = (f) => live.filter(f).reduce((s, o) => s + o.total, 0);
  const cash = sum((o) => o.method === 'cash');
  const row = await db.get('SELECT * FROM day_close WHERE day = ?', [day]);
  const close = {
    float: row?.float ?? null, counted: row?.counted ?? null, closed: row?.counted != null, amended: !!row?.amended,
    expected: (row?.float ?? 0) + cash,
  };
  close.over_short = close.closed ? close.counted - close.expected : null;
  return { day, orders, close, summary: { sales: sum(() => true), count: live.length, voided: orders.length - live.length, cash, gcash: sum((o) => o.method === 'gcash') } };
}

// float is set when the shift opens, counted when it closes. Counting again clears "amended".
export async function saveClose(db, day, { float, counted }, at = Date.now()) {
  for (const v of [float, counted]) if (v != null && (!Number.isInteger(v) || v < 0)) throw bad('Enter whole pesos');
  if (float != null) await db.run('INSERT INTO day_close (day, float) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET float = excluded.float', [day, float]);
  if (counted != null) {
    await db.run(`INSERT INTO day_close (day, counted, closed_at) VALUES (?, ?, ?)
      ON CONFLICT(day) DO UPDATE SET counted = excluded.counted, closed_at = excluded.closed_at, amended = 0`, [day, counted, at]);
  }
  return (await ledger(db, day)).close;
}

export async function csv(db) {
  const rows = [['date', 'ref', 'card', 'type', 'status', 'method', 'total', 'tendered', 'change', 'gcash_ref', 'void_reason', 'items']];
  for (const o of (await ordersWhere(db, '1 = 1')).reverse()) {
    rows.push([o.day, o.ref, o.card, o.type, o.status, o.method, o.total, o.tendered, o.change, o.gcash_ref ?? '', o.void_reason ?? '',
      o.items.map((i) => `${i.qty}x ${i.name}${i.flavor ? ` (${i.flavor})` : ''}`).join('; ')]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
}

const TABLE_COLS = {
  menu_items: ['id', 'name', 'category', 'price', 'flavored', 'available', 'sort'],
  orders: ['id', 'uid', 'day', 'ref', 'card', 'type', 'status', 'total', 'method', 'tendered', 'change', 'gcash_ref', 'void_reason', 'created_at', 'done_at'],
  order_items: ['id', 'order_id', 'item_id', 'name', 'category', 'flavor', 'qty', 'price'],
  day_close: ['day', 'float', 'counted', 'closed_at', 'amended'],
  settings: ['key', 'value'],
};

/** Whole database as one JSON document: the tablet's backup file, and the way to move data between deployments. */
export async function exportData(db) {
  await db.run("INSERT INTO settings (key, value) VALUES ('last_backup', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [String(Date.now())]);
  const tables = {};
  for (const t of Object.keys(TABLE_COLS)) tables[t] = await db.all(`SELECT * FROM ${t}`);
  return { app: 'david-wings-ledger', version: 1, exported_at: Date.now(), tables };
}

/** Replaces everything. Validated up front so a bad file cannot half-wipe the ledger. */
export async function importData(db, dump) {
  if (dump?.app !== 'david-wings-ledger' || dump.version !== 1 || typeof dump.tables !== 'object') throw bad('Not a David Wings backup file');
  const stmts = [];
  for (const t of ['order_items', 'orders', 'day_close', 'menu_items', 'settings']) stmts.push([`DELETE FROM ${t}`, []]);
  for (const t of ['settings', 'menu_items', 'orders', 'order_items', 'day_close']) {
    const rows = dump.tables[t];
    if (!Array.isArray(rows)) throw bad(`Backup is missing ${t}`);
    for (const r of rows) {
      const cols = TABLE_COLS[t].filter((c) => c in r);
      stmts.push([`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => r[c])]);
    }
  }
  try { await db.batch(stmts); } catch (e) { throw bad('That backup file is damaged and was not restored'); }
  await migrate(db);
  return { ok: true, orders: dump.tables.orders.length };
}

/** Everything the UI calls, as one object, so the tablet and the web build share the same surface. */
export function makeApi(db) {
  return {
    menu: async () => ({ items: await getMenu(db), flavors: JSON.parse((await getSettings(db)).flavors), top: await topSellers(db) }),
    cards: () => cardState(db),
    queue: () => preparingOrders(db),
    createOrder: (body) => createOrder(db, body),
    finishOrder: (id) => closeOrder(db, id, 'done'),
    voidOrder: (id, reason) => closeOrder(db, id, 'void', reason),
    stats: (range) => stats(db, Math.min(90, Math.max(1, Number(range) || 7))),
    ledger: (day) => ledger(db, day),
    saveClose: (day, body) => saveClose(db, day, body),
    settings: () => getSettings(db),
    saveSettings: (patch) => saveSettings(db, patch),
    updateMenuItem: (id, body) => updateMenuItem(db, id, body),
    csv: () => csv(db),
    backup: () => exportData(db),
    restore: (dump) => importData(db, dump),
  };
}
