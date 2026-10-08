import { closeOrder, createOrder, getSettings } from './core.js';

const MENU = [
  // name, category, price, flavored, weight (popularity)
  ['Boneless 6pcs', 'Wings', 119, 1, 10],
  ['Boneless 12pcs', 'Wings', 219, 1, 6],
  ['Boneless 18pcs', 'Wings', 319, 1, 2],
  ['Wings Solo', 'Combos', 159, 1, 9],
  ['Wings Duo', 'Combos', 289, 1, 4],
  ['Barkada Box', 'Combos', 429, 1, 1.2],
  ['Plain Rice', 'Sides', 20, 0, 8],
  ['Fries', 'Sides', 59, 0, 4],
  ['Cheesy Fries', 'Sides', 79, 0, 3],
  ['Coleslaw', 'Sides', 39, 0, 1],
  ['Iced Tea', 'Drinks', 35, 0, 7],
  ['Soda', 'Drinks', 40, 0, 4],
  ['Bottled Water', 'Drinks', 20, 0, 2],
  ['Iced Americano', 'Drinks', 70, 0, 3],
  ['Café Latte', 'Drinks', 85, 0, 2.5],
];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seed(db, days = 14) {
  let n_orders = 0;
  if ((await db.get('SELECT COUNT(*) AS n FROM menu_items')).n) return;
  await db.batch(MENU.map(([n, c, p, f], i) => ['INSERT INTO menu_items (name, category, price, flavored, sort) VALUES (?, ?, ?, ?, ?)', [n, c, p, f, i]]));
  const items = (await db.all('SELECT * FROM menu_items ORDER BY id')).map((m, i) => ({ ...m, w: MENU[i][4] }));
  const flavors = JSON.parse((await getSettings(db)).flavors);
  const flavorW = [10, 6, 7, 5, 4];
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
        items: lines, type: rand() < 0.55 ? 'dine-in' : 'take-out', card: 1 + (n_orders++ * 7) % 30, method,
        tendered: method === 'cash' ? Math.ceil(total / 50) * 50 + (rand() < 0.3 ? 50 : 0) : total,
        gcash_ref: method === 'gcash' ? String(Math.floor(1e12 + rand() * 9e12)) : undefined,
      }, at);
      await closeOrder(db, o.id, rand() < 0.03 ? 'void' : 'done', 'Customer changed mind', at + 6 * 60e3);
    }
  }
  // A few live orders so the queue isn't empty on first launch.
  const live = [
    { items: [{ item_id: 4, qty: 1, flavor: 'Garlic Parmesan' }, { item_id: 11, qty: 1 }], type: 'dine-in', method: 'cash', tendered: 200 },
    { items: [{ item_id: 2, qty: 1, flavor: 'Buffalo' }, { item_id: 7, qty: 2 }, { item_id: 12, qty: 1 }], type: 'take-out', method: 'gcash', gcash_ref: '4829104481923' },
    { items: [{ item_id: 5, qty: 1, flavor: 'Salted Egg' }, { item_id: 9, qty: 1 }], type: 'dine-in', method: 'cash', tendered: 500 },
  ];
  for (const [i, o] of live.entries()) await createOrder(db, { ...o, card: [7, 12, 3][i] }, now - (14 - i * 5) * 60e3);
}
