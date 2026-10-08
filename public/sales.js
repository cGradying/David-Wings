// Ledger > Sales tab. Pure HTML builders; app.js owns state and events.
const peso = (n) => '₱' + Number(n).toLocaleString('en-PH');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ref = (o) => '#' + String(o.ref).padStart(3, '0');
const time = (t) => new Date(t).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

export const CHIPS = [['cash', 'Cash'], ['gcash', 'GCash'], ['dine-in', 'Dine-in'], ['take-out', 'Take-out'], ['void', 'Void']];
export const VOID_REASONS = ['Wrong order', 'Customer left', 'Duplicate', 'Out of stock'];

/** Apply chips + search, then number each Sale with the day's running total (oldest first). */
export function prep(orders, chips, q) {
  let run = 0;
  const running = new Map();
  for (const o of [...orders].reverse()) { if (o.status !== 'void') run += o.total; running.set(o.id, run); }
  const pay = ['cash', 'gcash'].filter((c) => chips.has(c)), kind = ['dine-in', 'take-out'].filter((c) => chips.has(c));
  const needle = q.trim().toLowerCase().replace(/^#/, '');
  const list = orders.filter((o) =>
    (!pay.length || pay.includes(o.method)) && (!kind.length || kind.includes(o.type)) && (!chips.has('void') || o.status === 'void') &&
    (!needle || String(o.card) === needle || String(o.ref) === needle || String(o.ref).padStart(3, '0') === needle ||
      o.items.some((i) => i.name.toLowerCase().includes(needle) || (i.flavor ?? '').toLowerCase().includes(needle))));
  return { list, running };
}

const groupByHour = (list, running) => {
  const g = new Map();
  for (const o of list) { const h = new Date(o.created_at).getHours(); (g.get(h) ?? g.set(h, []).get(h)).push(o); }
  return [...g].map(([hour, rows]) => ({ hour, rows, sales: rows.filter((o) => o.status !== 'void').reduce((s, o) => s + o.total, 0), end: running.get(rows[0].id) }));
};

const closeChip = (c) => (c.closed ? (c.amended ? '<span class="pill warn">Amended</span>' : '<span class="pill ok">Closed</span>') : '<span class="pill">Open</span>');

function summary(l) {
  const s = l.summary, tot = s.cash + s.gcash || 1;
  const bar = `<div class="split" role="img" aria-label="Cash ${peso(s.cash)}, GCash ${peso(s.gcash)}">${s.cash ? `<i style="width:${(s.cash / tot) * 100}%;background:var(--c1)"></i>` : ''}${s.gcash ? `<i style="width:${(s.gcash / tot) * 100}%;background:var(--c2)"></i>` : ''}</div>`;
  return `<div class="sum"><div><div class="lbl">Sales</div><div class="v num">${peso(s.sales)}</div><div class="sub">${s.count} order${s.count === 1 ? '' : 's'}${s.voided ? ` · ${s.voided} void` : ''}</div></div>
    <div class="paysplit">${bar}<div class="legend"><span style="--k:var(--c1)">Cash<span class="t num">${peso(s.cash)}</span></span><span style="--k:var(--c2)">GCash<span class="t num">${peso(s.gcash)}</span></span></div></div></div>`;
}

const controls = (S) => `<div class="finder"><input type="date" id="date" value="${S.date}" max="${S.today}" aria-label="Date">
  <input class="field" id="q" type="search" inputmode="search" placeholder="Search card, ref or item" value="${esc(S.salesQ)}" aria-label="Search orders">
  ${S.date !== S.today ? '<button class="tab" data-today>Today</button>' : ''}</div>
  <div class="chips" role="group" aria-label="Filters">${CHIPS.map(([k, l]) => `<button class="tab" data-chip="${k}" aria-pressed="${S.chips.has(k)}">${l}</button>`).join('')}</div>`;

function closeStrip(l) {
  const c = l.close;
  const res = !c.closed ? '' : c.over_short === 0 ? '<b class="ok">Balanced</b>' : c.over_short > 0 ? `<b class="ok">Over ${peso(c.over_short)}</b>` : `<b class="bad">Short ${peso(-c.over_short)}</b>`;
  return `<button class="cstrip" data-close-day aria-label="Day close"><span class="cs-t">Day close ${closeChip(c)}</span>
    <span class="cs-v"><span class="lbl">Expected</span> <b class="num">${peso(c.expected)}</b>${c.closed ? `<span class="lbl">Counted</span> <b class="num">${peso(c.counted)}</b>${res}` : ''}</span>
    <span class="cs-go">${c.closed ? 'Recount' : c.float == null ? 'Set float' : 'Count cash'} ›</span></button>
  ${c.amended ? '<div class="note warn">A void changed this day after closing. Recount to clear.</div>' : ''}`;
}

function detail(o, S) {
  const arm = S.voidFor === o.id;
  return `<div class="det">${o.items.map((i) => `<div><span>${i.qty}× ${esc(i.name)}${i.flavor ? ` · ${esc(i.flavor)}` : ''}</span><b class="num">${peso(i.qty * i.price)}</b></div>`).join('')}
    <div class="tot"><span>${o.method === 'gcash' ? 'GCash' + (o.gcash_ref ? ' · ref ' + esc(o.gcash_ref) : '') : `Cash ${peso(o.tendered)} · change ${peso(o.change)}`}</span><b class="num">${peso(o.total)}</b></div>
    ${o.void_reason ? `<div class="vr">Void: ${esc(o.void_reason)}</div>` : ''}
    ${o.status === 'void' ? '' : arm
    ? `<div class="reasons"><span class="lbl">Why void ${ref(o)}?</span>${VOID_REASONS.map((r) => `<button class="tab" data-void="${o.id}" data-why="${esc(r)}">${r}</button>`).join('')}<button class="tab" data-void-cancel>Keep</button></div>`
    : `<button class="btn danger sm" data-void-ask="${o.id}">Void this order</button>`}</div>`;
}

const status = (o) => (o.status === 'void' ? '<span class="pill bad">Void</span>' : o.status === 'preparing' ? '<span class="pill">Preparing</span>' : '');
const methodTag = (o) => `<span class="mtag ${o.method}">${o.method === 'gcash' ? 'GCash' : 'Cash'}</span>`;

/* Timeline: grouped by hour, running total, inline detail. */
export function salesHtml(l, S) {
  const p = prep(l.orders, S.chips, S.salesQ);
  const groups = groupByHour(p.list, p.running);
  return `<div class="sales">${summary(l)}${closeStrip(l)}${controls(S)}
  ${groups.map((g) => `<section class="hgroup"><header><h3>${hourLabel(g.hour)}</h3><span class="muted">${g.rows.length} · ${peso(g.sales)}</span><span class="run num" title="Running total">${peso(g.end)}</span></header>
    ${g.rows.map((o) => `<div class="srow ${o.status === 'void' ? 'void' : ''} ${S.openSale === o.id ? 'open' : ''}"><button class="srow-h" data-sale="${o.id}" aria-expanded="${S.openSale === o.id}">
      <span class="cardno sm num"><span>${o.card}</span></span><span class="main"><b>${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(', ')}</b><small>${time(o.created_at)} · ${ref(o)} · ${o.type} ${methodTag(o)} ${status(o)}</small></span><span class="amt num">${peso(o.total)}</span></button>
      ${S.openSale === o.id ? detail(o, S) : ''}</div>`).join('')}</section>`).join('') || '<div class="empty"><b>No orders match</b>Clear a filter or pick another date.</div>'}</div>`;
}
