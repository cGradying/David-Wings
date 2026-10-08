import { salesHtml } from './sales.js';

const $ = (s) => document.querySelector(s);
const peso = (n) => '₱' + Number(n).toLocaleString('en-PH');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const landscape = () => matchMedia('(orientation: landscape) and (min-width: 900px)').matches;

const I = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5M11 5l-7 7 7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
};

const S = {
  view: 'home', menu: null, flavors: [], top: [], orders: [], filter: 'all', cat: 'Wings', cart: new Map(),
  pay: null, cards: null, settings: {}, ledgerTab: 'insights', range: 7, date: today(), armed: null, locked: false,
  chips: new Set(), salesQ: '', openSale: null, voidFor: null, ledger: null, today: today(),
};

// The Android build installs window.__transport to call the in-app core instead of a server.
const remote = async (method, url, body) => {
  const r = await fetch(url.pathname + url.search, { method, body: body && JSON.stringify(body), headers: body ? { 'Content-Type': 'application/json' } : {} });
  const text = (r.headers.get('content-type') ?? '').startsWith('text/');
  return { status: r.status, body: text ? await r.text() : await r.json().catch(() => ({})) };
};
async function api(path, opts = {}) {
  const r = await (window.__transport ?? remote)(opts.method ?? 'GET', new URL('/api' + path, location.origin), opts.body);
  if (r.status >= 400) throw new Error(r.body?.error || 'Something went wrong');
  return r.body;
}

// Browser: download a file. Android build: window.__native.saveFile opens the share sheet.
async function saveFile(name, text, type) {
  if (window.__native) return window.__native.saveFile(name, text);
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const BACKUP_DAYS = 7;
const backupDue = () => !S.settings.last_backup || Date.now() - Number(S.settings.last_backup) > BACKUP_DAYS * 864e5;

let toastT;
function toast(msg, err) {
  document.querySelector('.toast')?.remove();
  const t = Object.assign(document.createElement('div'), { className: 'toast' + (err ? ' err' : ''), textContent: msg, role: 'status' });
  document.body.append(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2800);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#d9480f';
}

/* ---------- cart ---------- */
const key = (id, fl) => `${id}|${fl ?? ''}`;
const item = (id) => S.menu.find((m) => m.id === id);
const cartLines = () => [...S.cart].map(([k, qty]) => { const [id, fl] = k.split('|'); return { item_id: Number(id), flavor: fl || undefined, qty, m: item(Number(id)) }; });
const total = () => cartLines().reduce((s, l) => s + l.m.price * l.qty, 0);
const count = () => [...S.cart.values()].reduce((a, b) => a + b, 0);
const qtyOf = (id) => cartLines().filter((l) => l.item_id === id).reduce((s, l) => s + l.qty, 0);
function bump(id, fl, d) {
  const k = key(id, fl), v = (S.cart.get(k) ?? 0) + d;
  v > 0 ? S.cart.set(k, Math.min(v, 99)) : S.cart.delete(k);
}

/* ---------- navigation / bar ---------- */
function go(view) { S.view = view; S.armed = null; render(); }
function renderBar() {
  const brand = '<div class="brand">Ledger Information<b>David Wings</b></div>';
  const cur = (v) => (S.view === v ? ' aria-current="page"' : '');
  if (S.view === 'order' || S.view === 'pay') {
    const ok = S.view === 'order' ? count() > 0 : payValid();
    $('#bar').innerHTML = `${brand}<button class="nbtn x" data-a="cancel" aria-label="Cancel order">${I.x}</button>
      <button class="nbtn" data-a="back" aria-label="Back">${I.back}</button>
      <button class="nbtn go" data-a="next" aria-label="${S.view === 'order' ? 'Go to payment' : 'Confirm payment'}" ${ok ? '' : 'disabled'}>${I.check}</button>`;
  } else {
    $('#bar').innerHTML = `${brand}<button class="nbtn"${cur('settings')} data-a="settings" aria-label="Settings${backupDue() ? ' (backup due)' : ''}">${I.gear}${backupDue() ? '<i class="dot"></i>' : ''}</button>
      <button class="nbtn"${cur('ledger')} data-a="ledger" aria-label="Ledger">${I.list}</button>
      <button class="nbtn plus" data-a="new" aria-label="New order">${I.plus}</button>`;
  }
}
$('#bar').addEventListener('click', guard(async (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a) return;
  if (a === 'settings' || a === 'ledger') go(S.view === a ? 'home' : a);
  else if (a === 'new') { S.cart.clear(); S.pay = null; go('order'); }
  else if (a === 'cancel') { S.cart.clear(); S.pay = null; go('home'); }
  else if (a === 'back') go(S.view === 'pay' ? 'order' : 'home');
  else if (a === 'next') await next();
}));
async function next() {
  if (S.view === 'order') {
    S.cards = await api('/cards');
    S.pay ??= { type: 'dine-in', method: 'cash', card: null, tendered: '', ref: '' };
    if (!S.pay.card || S.cards.used.includes(S.pay.card)) S.pay.card = S.cards.suggested;
    return go('pay');
  }
  if (S.locked || !payValid()) return;
  S.locked = true;
  try {
    const p = S.pay, due = total();
    const o = await api('/orders', { method: 'POST', body: {
      items: cartLines().map(({ item_id, flavor, qty }) => ({ item_id, flavor, qty })),
      type: p.type, card: p.card, method: p.method, tendered: p.method === 'cash' ? Number(p.tendered) : due, gcash_ref: p.ref } });
    S.cart.clear(); S.pay = null; S.view = 'home';
    await load(); render();
    sheet(`<h2>Card ${o.card} · Order #${String(o.ref).padStart(3, '0')}</h2><p class="sub">${peso(o.total)} paid by ${o.method === 'cash' ? 'cash' : 'GCash'}</p>
      ${o.change > 0 ? `<div class="change"><span class="lbl">Give change</span><span class="amt num">${peso(o.change)}</span></div>` : '<div class="change"><span class="lbl">No change due</span></div>'}
      <button class="btn" data-close>Next order</button>`);
  } finally { S.locked = false; }
}

/* ---------- data ---------- */
async function load() {
  const [m, o, s] = await Promise.all([api('/menu'), api('/orders'), api('/settings')]);
  S.menu = m.items; S.flavors = m.flavors; S.top = m.top; S.orders = o; S.settings = s;
  applyTheme();
}

/* ---------- queue ---------- */
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; };
function renderQueue() {
  const n = (t) => S.orders.filter((o) => t === 'all' || o.type === t).length;
  const list = S.orders.filter((o) => S.filter === 'all' || o.type === S.filter);
  const tab = (t, l) => `<button class="tab" data-f="${t}" aria-pressed="${S.filter === t}">${l} · ${n(t)}</button>`;
  $('#queue').innerHTML = `<div class="panel-head"><div class="badge-count num">${S.orders.length}</div><h1>Now preparing</h1></div>
    <div class="tabs">${tab('all', 'All')}${tab('dine-in', 'Dine-in')}${tab('take-out', 'Take-out')}</div>
    <div class="orders">${list.map((o) => `
      <article class="order">
        <div class="cardno num"><small>Card</small><span>${o.card}</span></div>
        <div class="lines">${o.items.map((i) => `${i.qty}× ${esc(i.name)}${i.flavor ? ` <span class="muted">${esc(i.flavor)}</span>` : ''}`).join('<br>')}</div>
        <button class="donebtn" data-done="${o.id}" aria-label="Mark card ${o.card} done" ${S.armed === o.id ? 'style="background:var(--ok);color:#fff"' : ''}>${I.check}</button>
        <div class="meta"><span class="chip ${o.type === 'take-out' ? 'take' : ''}">${o.type}</span><span>#${String(o.ref).padStart(3, '0')} · ${ago(o.created_at)}</span><span class="num">${peso(o.total)}</span></div>
      </article>`).join('') || `<div class="empty"><b>Nothing cooking</b>Tap + to take an order.</div>`}</div>`;
}
$('#queue').addEventListener('click', guard(async (e) => {
  const f = e.target.closest('[data-f]')?.dataset.f;
  if (f) { S.filter = f; return renderQueue(); }
  const d = e.target.closest('[data-done]')?.dataset.done;
  if (!d) return;
  const id = Number(d);
  if (S.armed !== id) { S.armed = id; renderQueue(); toast('Tap ✓ again to finish'); setTimeout(() => { if (S.armed === id) { S.armed = null; renderQueue(); } }, 3500); return; }
  S.armed = null;
  await api(`/orders/${id}/done`, { method: 'POST', body: {} });
  await load(); renderQueue(); refreshMain();
}));

/* ---------- order builder ---------- */
const CATS = ['Wings', 'Combos', 'Sides', 'Drinks'];
function tile(m, star) {
  const q = qtyOf(m.id);
  const stepper = q > 0 && !m.flavored ? `<div class="step"><button data-dec="${m.id}" aria-label="Remove one ${esc(m.name)}">−</button><span class="v num">${q}</span><button class="p" data-inc="${m.id}" aria-label="Add one ${esc(m.name)}">+</button></div>` : '';
  return `<div class="tile ${q ? 'sel' : ''} ${m.available ? '' : 'off'}" role="button" tabindex="0" data-tile="${m.id}" aria-label="${esc(m.name)} ${peso(m.price)}">
    ${q ? `<span class="q num">${q}</span>` : ''}${star && !q ? '<span class="star" aria-hidden="true">★</span>' : ''}
    <span class="nm">${esc(m.name)}</span><span class="pr num">${peso(m.price)}${m.flavored ? ' · pick flavor' : ''}</span>${stepper}</div>`;
}
function renderOrder() {
  const top = S.top.map((t) => item(t.item_id)).filter((m) => m?.available).slice(0, 4);
  const grid = S.menu.filter((m) => m.category === S.cat);
  const t = total(), c = count();
  $('#main').innerHTML = `<div class="live" aria-live="polite"><div><div class="lbl">Total</div><div class="amt num">${peso(t)}</div></div>
      <div class="cnt">${c} item${c === 1 ? '' : 's'}${S.view === 'home' ? `<button class="charge" data-charge ${c ? '' : 'disabled'}>Charge ${I.check}</button>` : ''}</div></div>
    <div class="section-title">Top sellers</div><div class="grid">${top.map((m) => tile(m, true)).join('')}</div>
    <div class="tabs" role="tablist">${CATS.map((k) => `<button class="tab" role="tab" data-cat="${k}" aria-selected="${S.cat === k}">${k}</button>`).join('')}</div>
    <div class="grid">${grid.map((m) => tile(m)).join('')}</div>`;
}
function refreshMain() {
  const st = $('#main').scrollTop;
  if (S.view === 'order' || (S.view === 'home' && landscape())) renderOrder();
  $('#main').scrollTop = st;
  renderBar();
}
$('#main').addEventListener('click', guard(async (e) => {
  const t = e.target;
  if (t.closest('[data-charge]')) { if (count()) { S.view = 'order'; await next(); } return; }
  const cat = t.closest('[data-cat]')?.dataset.cat;
  if (cat) { S.cat = cat; return renderOrder(); }
  const inc = t.closest('[data-inc]')?.dataset.inc, dec = t.closest('[data-dec]')?.dataset.dec;
  if (inc || dec) { bump(Number(inc ?? dec), undefined, inc ? 1 : -1); return refreshMain(); }
  const tl = t.closest('[data-tile]')?.dataset.tile;
  if (tl) {
    const m = item(Number(tl));
    if (m.flavored) return flavorSheet(m);
    bump(m.id, undefined, 1); return refreshMain();
  }
  await mainClick(e);
}));
$('#main').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-tile]')) { e.preventDefault(); e.target.click(); } });

/* ---------- sheets ---------- */
function sheet(html, onClose) {
  document.querySelector('.scrim')?.remove();
  const s = Object.assign(document.createElement('div'), { className: 'scrim', innerHTML: `<div class="sheet" role="dialog" aria-modal="true">${html}</div>` });
  s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-close]')) { s.remove(); onClose?.(); } });
  document.body.append(s);
  return s;
}
function flavorSheet(m) {
  const body = () => `<h2>${esc(m.name)}</h2><p class="sub num">${peso(m.price)} each · pick flavors</p>
    ${S.flavors.map((f) => { const q = S.cart.get(key(m.id, f)) ?? 0; return `<div class="frow"><span class="nm">${esc(f)}</span>
      <div class="step"><button data-fd="${esc(f)}" aria-label="Remove ${esc(f)}">−</button><span class="v num">${q}</span><button class="p" data-fi="${esc(f)}" aria-label="Add ${esc(f)}">+</button></div></div>`; }).join('')}
    <button class="btn" data-close>Done · ${qtyOf(m.id)} added</button>`;
  const s = sheet(body(), refreshMain);
  s.addEventListener('click', (e) => {
    const fi = e.target.closest('[data-fi]')?.dataset.fi, fd = e.target.closest('[data-fd]')?.dataset.fd;
    if (fi || fd) { bump(m.id, fi ?? fd, fi ? 1 : -1); s.querySelector('.sheet').innerHTML = body(); }
  });
}

/* ---------- pay ---------- */
function tendered() { return Number(S.pay.tendered || 0); }
function payValid() {
  const p = S.pay; if (!p || !p.card) return false;
  return p.method === 'gcash' || tendered() >= total();
}
function renderPay() {
  const p = S.pay, due = total(), t = tendered(), diff = t - due;
  const cardBtns = Array.from({ length: S.cards.pool }, (_, i) => i + 1).map((n) =>
    `<button class="card num" data-card="${n}" aria-pressed="${p.card === n}" ${S.cards.used.includes(n) ? 'disabled aria-label="Card ' + n + ' in use"' : ''}>${n}</button>`).join('');
  const quick = [...new Set([due, ...[50, 100, 200, 500, 1000].filter((v) => v >= due)])].slice(0, 4);
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-set="${k}:${v}" aria-pressed="${p[k] === v}">${l}</button>`).join('')}</div>`;
  const cash = `<div class="row"><div class="tender num" aria-live="polite">${p.tendered ? peso(t) : '<span class="muted">Amount paid</span>'}</div></div>
      <div class="change ${p.tendered && diff < 0 ? 'short' : ''}" aria-live="polite">${!p.tendered ? '<span class="lbl">Change</span><span class="amt num">—</span>'
        : diff < 0 ? `<span class="lbl">Still short</span><span class="amt num">${peso(-diff)}</span>` : `<span class="lbl">Change</span><span class="amt num">${peso(diff)}</span>`}</div>
      <div class="quick">${quick.map((v) => `<button data-q="${v}" class="num">${v === due ? 'Exact' : peso(v)}</button>`).join('')}</div>
      <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((k) => `<button class="key num" data-k="${k}" aria-label="${k === '⌫' ? 'Backspace' : k}">${k}</button>`).join('')}</div>`;
  const qr = S.settings.gcash_qr ? `<img src="${S.settings.gcash_qr}" alt="GCash QR">` : '<div class="ph">No QR yet.<br>Add yours in Settings.</div>';
  const gcash = `<div class="qr">${qr}<div><b>${esc(S.settings.gcash_name)}</b><div class="muted">Customer scans, pays <span class="num">${peso(due)}</span></div></div></div>
      <input class="field" id="ref" inputmode="numeric" placeholder="GCash reference no." value="${esc(p.ref)}" style="margin-top:12px">`;
  $('#main').innerHTML = `<div class="pay-total"><span class="lbl">Total cost</span><span class="amt num">${peso(due)}</span></div>
    <div class="pay-cols"><div>
      <div class="box"><div class="section-title">Order</div>${seg('type', [['dine-in', 'Dine-in'], ['take-out', 'Take-out']])}</div>
      <div class="box"><div class="section-title">Customer card number</div><div class="cards">${cardBtns}</div></div>
      <div class="box review">${cartLines().map((l) => `<div><span>${l.qty}× ${esc(l.m.name)}${l.flavor ? ` · ${esc(l.flavor)}` : ''}</span><b class="num">${peso(l.qty * l.m.price)}</b></div>`).join('')}</div>
    </div><div><div class="box"><div class="section-title">Payment</div>${seg('method', [['cash', 'Cash'], ['gcash', 'GCash']])}<div style="height:12px"></div>${p.method === 'cash' ? cash : gcash}</div></div></div>`;
}
async function mainClick(e) {
  const t = e.target;
  if (S.view === 'pay') {
    const p = S.pay;
    const card = t.closest('[data-card]')?.dataset.card, set = t.closest('[data-set]')?.dataset.set, q = t.closest('[data-q]')?.dataset.q, k = t.closest('[data-k]')?.dataset.k;
    if (card) p.card = Number(card);
    else if (set) { const [a, b] = set.split(':'); p[a] = b; }
    else if (q) p.tendered = q;
    else if (k) p.tendered = k === '⌫' ? p.tendered.slice(0, -1) : (p.tendered + k).replace(/^0+(?=\d)/, '').slice(0, 7);
    else return;
    const st = $('#main').scrollTop; renderPay(); $('#main').scrollTop = st; renderBar();
    return;
  }
  if (S.view === 'ledger') return ledgerClick(t);
  if (S.view === 'settings') return settingsClick(t);
}
$('#main').addEventListener('input', (e) => { if (e.target.id === 'ref') S.pay.ref = e.target.value; });

/* ---------- ledger ---------- */
const dShort = (d) => new Date(d + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric' });
async function renderLedger() {
  const tabs = `<div class="tabs"><button class="tab" data-lt="insights" aria-pressed="${S.ledgerTab === 'insights'}">Insights</button><button class="tab" data-lt="sales" aria-pressed="${S.ledgerTab === 'sales'}">Sales</button></div>`;
  $('#main').innerHTML = `<div class="panel-head"><h1>Ledger</h1></div>${tabs}<div id="lbody"></div>`;
  S.ledgerTab === 'insights' ? await renderInsights() : await renderSales();
}
function delta(cur, prev) {
  if (!prev) return '';
  const p = Math.round(((cur - prev) / prev) * 100);
  return `<span class="delta ${p >= 0 ? 'up' : 'dn'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% vs prior ${S.range} days</span>`;
}
async function renderInsights() {
  const st = await api('/stats?range=' + S.range);
  const last = st.series.at(-1), avg = st.cur.orders ? Math.round(st.cur.sales / st.cur.orders) : 0;
  const max = (a) => Math.max(1, ...a);
  const hbars = (rows, unit, val = (r) => r.qty) => { const m = max(rows.map(val)); return rows.map((r) => `<div class="hbar" data-tip="${esc(r.name)}: ${val(r)} ${unit}"><span class="nm">${esc(r.name)}</span><span class="tr" style="width:${(val(r) / m) * 100}%"></span><span class="v num">${val(r)}</span></div>`).join(''); };
  const splitBar = (rows, names, colors) => { const tot = rows.reduce((s, r) => s + r.sales, 0) || 1;
    const get = (n) => rows.find((r) => r.name === n)?.sales ?? 0;
    return `<div class="split" role="img" aria-label="${names.map((n) => `${n} ${peso(get(n))}`).join(', ')}">${names.map((n, i) => get(n) ? `<i style="width:${(get(n) / tot) * 100}%;background:${colors[i]}" data-tip="${n}: ${peso(get(n))}"></i>` : '').join('')}</div>
    <div class="legend">${names.map((n, i) => `<span style="--k:${colors[i]}">${n}<span class="t num">${peso(get(n))} · ${Math.round((get(n) / tot) * 100)}%</span></span>`).join('')}</div>`; };
  $('#lbody').innerHTML = `
    <div class="seg" style="max-width:340px;margin-bottom:14px">${[7, 14, 30].map((n) => `<button data-range="${n}" aria-pressed="${S.range === n}">${n} days</button>`).join('')}</div>
    <div class="kpis">
      <div class="kpi hero"><div class="lbl">Sales · last ${S.range} days</div><div class="v num">${peso(st.cur.sales)}</div>${delta(st.cur.sales, st.prev.sales)}</div>
      <div class="kpi"><div class="lbl">Today</div><div class="v num">${peso(last.sales)}</div><span class="muted">${last.orders} orders</span></div>
      <div class="kpi"><div class="lbl">Avg order</div><div class="v num">${peso(avg)}</div><span class="muted">${st.cur.orders} orders</span></div>
    </div>
    <div class="charts">
      <div class="chart wide"><h3>Daily sales</h3><div class="cap">Peso sales per day · today highlighted</div>${barChart(st.series)}
        <details><summary>View as table</summary><table><tr><th>Day</th><th>Orders</th><th>Sales</th></tr>${st.series.map((d) => `<tr><td>${dShort(d.day)}</td><td class="num">${d.orders}</td><td class="num">${peso(d.sales)}</td></tr>`).join('')}</table></details></div>
      <div class="chart"><h3>Busiest hours</h3><div class="cap">Orders by hour of day</div>${hourChart(st.hourly)}</div>
      <div class="chart"><h3>Top sellers</h3><div class="cap">Units sold</div>${hbars(st.items, 'sold')}</div>
      <div class="chart"><h3>Flavor popularity</h3><div class="cap">Wings and combos by flavor</div>${hbars(st.flavors, 'sold')}</div>
      <div class="chart"><h3>How customers pay</h3><div class="cap">Share of sales</div>${splitBar(st.methods, ['cash', 'gcash'], ['var(--c1)', 'var(--c2)']).replace('>cash<', '>Cash<').replace('>gcash<', '>GCash<')}
        <div class="cap" style="margin-top:18px">Dine-in vs take-out</div>${splitBar(st.types, ['dine-in', 'take-out'], ['var(--c1)', 'var(--c2)']).replace('>dine-in<', '>Dine-in<').replace('>take-out<', '>Take-out<')}</div>
    </div>`;
}
function barChart(series) {
  const W = 640, H = 210, L = 40, B = 28, T = 22, n = series.length, bw = (W - L) / n;
  const top = Math.max(1000, Math.ceil(Math.max(...series.map((d) => d.sales)) / 1000) * 1000);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const maxI = series.findIndex((d) => d.sales === Math.max(...series.map((x) => x.sales)));
  const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W}" y1="${y(top * f)}" y2="${y(top * f)}" stroke="var(--grid)" stroke-width="1"/><text x="${L - 8}" y="${y(top * f) + 4}" text-anchor="end">${top * f >= 1000 ? (top * f) / 1000 + 'k' : top * f}</text>`).join('');
  const bars = series.map((d, i) => {
    const x = L + i * bw + bw * 0.14, w = bw * 0.72, h = (H - T - B) * (d.sales / top), isToday = i === n - 1, r = Math.min(5, w / 2, h);
    const path = h ? `M${x},${y(0)} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z` : '';
    return `<path d="${path}" fill="var(--c1)" opacity="${isToday ? 1 : 0.55}"/>
      <rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-tip="${dShort(d.day)}: ${peso(d.sales)} · ${d.orders} orders"/>
      ${n <= 14 || i % 5 === n % 5 || isToday ? `<text x="${x + w / 2}" y="${H - 9}" text-anchor="middle">${n <= 14 ? dShort(d.day).replace(/^(\w)\w+ /, '$1 ') : new Date(d.day + 'T00:00').getDate()}</text>` : ''}
      ${i === maxI || isToday ? `<text class="val" x="${x + w / 2}" y="${y(d.sales) - 6}" text-anchor="middle">${peso(d.sales)}</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily sales bar chart">${grid}${bars}</svg>`;
}
function hourChart(rows) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 9), by = new Map(rows.map((r) => [r.hour, r.orders]));
  const W = 420, H = 170, B = 24, T = 20, bw = W / hours.length, mx = Math.max(1, ...hours.map((h) => by.get(h) ?? 0));
  const peak = hours.reduce((a, h) => ((by.get(h) ?? 0) > (by.get(a) ?? 0) ? h : a), hours[0]);
  const f = (h) => (h % 12 || 12) + (h < 12 ? 'a' : 'p');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Orders by hour">${hours.map((h, i) => {
    const v = by.get(h) ?? 0, bh = (H - T - B) * (v / mx), x = i * bw + bw * 0.15, w = bw * 0.7;
    return `<rect x="${x}" y="${H - B - bh}" width="${w}" height="${Math.max(bh, 0)}" rx="4" fill="var(--c2)" opacity="${h === peak ? 1 : 0.6}"/>
      <rect x="${i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-tip="${f(h)}: ${v} orders"/>
      <text x="${x + w / 2}" y="${H - 7}" text-anchor="middle">${f(h)}</text>${h === peak ? `<text class="val" x="${x + w / 2}" y="${H - B - bh - 6}" text-anchor="middle">${v}</text>` : ''}`;
  }).join('')}</svg>`;
}
async function renderSales() {
  S.ledger = await api('/ledger?date=' + S.date); S.today = today();
  drawSales();
}
function drawSales() {
  const focus = document.activeElement?.id === 'q', pos = document.activeElement?.selectionStart;
  const keep = $('#main').scrollTop;
  $('#lbody').innerHTML = salesHtml(S.ledger, S);
  $('#main').scrollTop = keep;
  if (focus) { const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }
}
const dayLabel = (d) => new Date(d + 'T00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' });
let pendingVoid = null;
async function commitVoid() {
  if (!pendingVoid) return;
  const { id, why, timer, el } = pendingVoid; pendingVoid = null; clearTimeout(timer); el.remove();
  await api(`/orders/${id}/void`, { method: 'POST', body: { reason: why } });
  S.voidFor = null; await load(); renderQueue(); await renderSales();
}
function askVoid(id, why) {
  commitVoid().catch((e) => toast(e.message, true));
  const el = Object.assign(document.createElement('div'), { className: 'toast undo', role: 'status' });
  el.innerHTML = `<span>Voiding order · ${esc(why)}</span><button data-undo>Undo</button>`;
  document.body.append(el);
  pendingVoid = { id, why, el, timer: setTimeout(() => commitVoid().catch((e) => toast(e.message, true)), 5000) };
  el.querySelector('[data-undo]').onclick = () => { clearTimeout(pendingVoid.timer); pendingVoid = null; el.remove(); toast('Kept the order'); };
  S.openSale = null; S.voidFor = null; drawSales();
}
function closeSheet() {
  const l = S.ledger, c = l.close;
  const s = sheet(`<h2>Day close</h2><p class="sub">${dayLabel(l.day)}</p>
    <label class="lbl" for="cf">Opening float</label><input class="field" id="cf" inputmode="numeric" value="${c.float ?? ''}" placeholder="Cash in drawer at open">
    <div class="review" style="margin:12px 0"><div><span>Cash sales</span><b class="num">${peso(l.summary.cash)}</b></div><div><span>Expected in drawer</span><b class="num" id="cexp">${peso(c.expected)}</b></div></div>
    <label class="lbl" for="cc">Cash counted</label><input class="field" id="cc" inputmode="numeric" value="${c.counted ?? ''}" placeholder="Count the drawer, then enter">
    <div class="change" id="cdiff" hidden></div><button class="btn" id="csave">Save</button><button class="btn alt" data-close>Cancel</button>`);
  const num = (id) => { const v = s.querySelector(id).value.trim(); return v === '' ? null : Number(v); };
  const calc = () => {
    const f = num('#cf') ?? 0, cc = num('#cc'), exp = f + l.summary.cash, box = s.querySelector('#cdiff');
    s.querySelector('#cexp').textContent = peso(exp);
    box.hidden = cc == null; if (cc == null) return;
    const d = cc - exp; box.className = 'change' + (d < 0 ? ' short' : '');
    box.innerHTML = `<span class="lbl">${d === 0 ? 'Balanced' : d > 0 ? 'Over' : 'Short'}</span><span class="amt num">${peso(Math.abs(d))}</span>`;
  };
  s.addEventListener('input', calc); calc();
  s.querySelector('#csave').addEventListener('click', guard(async () => {
    const body = {}; const f = num('#cf'), cc = num('#cc');
    if (f != null) body.float = f; if (cc != null) body.counted = cc;
    if (!Object.keys(body).length) throw new Error('Enter the float or the counted cash');
    await api('/close/' + l.day, { method: 'POST', body });
    s.remove(); toast(cc != null ? 'Day closed' : 'Float saved'); await renderSales();
  }));
}
async function ledgerClick(t) {
  const lt = t.closest('[data-lt]')?.dataset.lt, r = t.closest('[data-range]')?.dataset.range, sale = t.closest('[data-sale]')?.dataset.sale;
  if (lt) { S.ledgerTab = lt; return renderLedger(); }
  if (r) { S.range = Number(r); return renderLedger(); }
  if (t.closest('[data-today]')) { S.date = today(); return renderLedger(); }
  if (S.ledgerTab !== 'sales') return;
  const chip = t.closest('[data-chip]')?.dataset.chip;
  if (chip) { S.chips.has(chip) ? S.chips.delete(chip) : S.chips.add(chip); return drawSales(); }
  if (sale) { const id = Number(sale); S.openSale = S.openSale !== id ? id : null; S.voidFor = null; return drawSales(); }
  const ask = t.closest('[data-void-ask]')?.dataset.voidAsk;
  if (ask) { S.voidFor = Number(ask); return drawSales(); }
  if (t.closest('[data-void-cancel]')) { S.voidFor = null; return drawSales(); }
  const v = t.closest('[data-void]');
  if (v) return askVoid(Number(v.dataset.void), v.dataset.why);
  if (t.closest('[data-close-day]')) return closeSheet();
}
document.addEventListener('input', (e) => { if (e.target.id === 'q') { S.salesQ = e.target.value; drawSales(); } });
document.addEventListener('change', (e) => { if (e.target.id === 'date' && e.target.value) { S.date = e.target.value; renderLedger(); } });

/* ---------- settings ---------- */
function renderSettings() {
  const dark = S.settings.theme === 'dark' || (S.settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#main').innerHTML = `<div class="panel-head"><h1>Settings</h1></div><div class="set">
    <div class="box setrow"><div><h3>Dark mode</h3><p>Easier on the eyes in a dim stall.</p></div><button class="switch" role="switch" aria-checked="${dark}" aria-label="Dark mode" data-theme></button></div>
    <div class="box setrow"><div><h3>Customer cards</h3><p>How many numbered cards you hand out.</p></div>
      <div class="step"><button data-pool="-1" aria-label="Fewer cards">−</button><span class="v num">${S.settings.pool_size}</span><button class="p" data-pool="1" aria-label="More cards">+</button></div></div>
    <div class="box"><h3>GCash QR</h3><p class="muted" style="margin-bottom:10px">Shown on the payment screen. Stays on this device.</p>
      <input class="field" id="gname" value="${esc(S.settings.gcash_name)}" aria-label="Account name"><div class="qr" style="margin-top:12px">${S.settings.gcash_qr ? `<img src="${S.settings.gcash_qr}" alt="GCash QR">` : '<div class="ph">No QR uploaded</div>'}</div>
      <input type="file" id="qrfile" accept="image/*" hidden><button class="btn alt" data-qr>Upload QR image</button></div>
    <div class="box"><h3>Menu &amp; prices</h3><p class="muted" style="margin-bottom:8px">Edit a name or price, then tap away to save. Switch off to hide from orders.</p>
      ${S.menu.map((m) => `<div class="medit" data-mid="${m.id}"><input value="${esc(m.name)}" data-f="name" aria-label="Name"><input value="${m.price}" data-f="price" inputmode="numeric" aria-label="Price"><button class="switch" role="switch" aria-checked="${!!m.available}" data-avail aria-label="Available"></button></div>`).join('')}</div>
    <div class="box"><div class="setrow"><div><h3>Back up &amp; restore</h3><p>${S.settings.last_backup ? 'Last backup ' + new Date(Number(S.settings.last_backup)).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Never backed up'}. Keep a copy off this device.</p></div>${backupDue() ? '<span class="pill warn">Due</span>' : '<span class="pill ok">OK</span>'}</div>
      <div class="seg" style="margin-top:12px"><button data-backup>Back up now</button><button data-restore>Restore…</button></div>
      <input type="file" id="restorefile" accept=".json,application/json" hidden>
      <button class="btn alt" data-csv style="margin-top:10px">Export sales as CSV</button></div>
    <details class="box howto"><summary>How to operate &amp; diagnose</summary><ol style="margin-top:8px">
      <li>Tap <b>+</b>, tap items. Wings ask for a flavor. The total runs at the top.</li><li>Tap ✓, pick dine-in or take-out, pick the card you hand over.</li>
      <li>Cash: tap the amount paid. Change shows instantly. GCash: customer scans the QR.</li><li>Tap ✓ to take the order. It appears under <b>Now preparing</b>.</li>
      <li>When food is handed over, tap ✓ on the order twice. The card number frees up.</li><li>Wrong sale? Ledger → Sales → tap it → Void.</li>
      <li>Nothing loads? Check the ledger server is running, then reload. Data is in <code>data/ledger.db</code>.</li></ol></details>
    <div class="box"><h3>Contact</h3><p class="muted">${esc(S.settings.contact)}</p></div></div>`;
}
async function save(patch) { S.settings = await api('/settings', { method: 'PUT', body: patch }); applyTheme(); }
function downscale(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const k = Math.min(1, 520 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); };
    img.onerror = () => rej(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}
async function settingsClick(t) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (t.closest('[data-backup]')) { await saveFile(`david-wings-backup-${stamp}.json`, JSON.stringify(await api('/backup')), 'application/json'); await load(); renderBar(); toast('Backup ready'); return renderSettings(); }
  if (t.closest('[data-csv]')) { await saveFile(`david-wings-sales-${stamp}.csv`, await api('/export.csv'), 'text/csv'); return; }
  if (t.closest('[data-restore]')) return $('#restorefile').click();
  if (t.closest('[data-theme]')) { const dark = t.closest('[data-theme]').getAttribute('aria-checked') === 'true'; await save({ theme: dark ? 'light' : 'dark' }); return renderSettings(); }
  const pool = t.closest('[data-pool]')?.dataset.pool;
  if (pool) { const n = Math.min(99, Math.max(5, Number(S.settings.pool_size) + Number(pool))); await save({ pool_size: n }); return renderSettings(); }
  if (t.closest('[data-qr]')) return $('#qrfile').click();
  const av = t.closest('[data-avail]');
  if (av) { const row = av.closest('[data-mid]'), m = item(Number(row.dataset.mid)); await putMenu(m, { available: !m.available }); return renderSettings(); }
}
async function putMenu(m, patch) {
  const next = { name: m.name, price: m.price, available: m.available, ...patch };
  await api('/menu/' + m.id, { method: 'PUT', body: { ...next, available: !!next.available } });
  await load();
}
document.addEventListener('change', guard(async (e) => {
  if (S.view !== 'settings') return;
  if (e.target.id === 'gname') return save({ gcash_name: e.target.value });
  if (e.target.id === 'restorefile' && e.target.files[0]) {
    const text = await e.target.files[0].text(); e.target.value = '';
    let dump; try { dump = JSON.parse(text); } catch { throw new Error('That is not a backup file'); }
    const n = dump?.tables?.orders?.length ?? 0;
    const sh = sheet(`<h2>Restore this backup?</h2><p class="sub">It replaces <b>all</b> current orders, menu and settings with the file's ${n} orders. This cannot be undone.</p><button class="btn danger" id="dorestore">Replace everything</button><button class="btn alt" data-close>Cancel</button>`);
    sh.querySelector('#dorestore').addEventListener('click', guard(async () => { await api('/restore', { method: 'POST', body: dump }); sh.remove(); await load(); toast('Backup restored'); render(); }));
    return;
  }
  if (e.target.id === 'qrfile' && e.target.files[0]) { await save({ gcash_qr: await downscale(e.target.files[0]) }); return renderSettings(); }
  const row = e.target.closest('[data-mid]');
  if (row && e.target.dataset.f) {
    const m = item(Number(row.dataset.mid));
    try { await putMenu(m, e.target.dataset.f === 'price' ? { price: Number(e.target.value) } : { name: e.target.value }); toast('Saved'); }
    catch (err) { renderSettings(); throw err; }
  }
}));

/* ---------- tooltip ---------- */
const tip = $('#tip');
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el) { tip.style.display = 'none'; return; }
  const r = el.getBoundingClientRect();
  tip.textContent = el.dataset.tip; tip.style.display = 'block';
  tip.style.left = Math.min(innerWidth - 80, Math.max(80, r.left + r.width / 2)) + 'px'; tip.style.top = r.top + 'px';
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-tip]')) tip.style.display = 'none'; });

/* ---------- render ---------- */
async function render() {
  document.body.dataset.view = S.view;
  renderBar(); renderQueue();
  const v = S.view === 'home' && landscape() ? 'order' : S.view;
  if (v === 'order') renderOrder();
  else if (v === 'pay') renderPay();
  else if (v === 'ledger') await renderLedger().catch((e) => toast(e.message, true));
  else if (v === 'settings') renderSettings();
  else $('#main').innerHTML = '';
  $('#main').scrollTop = 0;
}
matchMedia('(orientation: landscape) and (min-width: 900px)').addEventListener('change', render);
setInterval(() => { if (!document.hidden && (S.view === 'home' || landscape())) renderQueue(); }, 30000);

(async () => {
  try { await load(); } catch (e) { document.body.insertAdjacentHTML('beforeend', `<div class="empty"><b>Can't reach the ledger server</b>Start it with <code>node server.js</code>, then reload.</div>`); return; }
  render();
  if ('serviceWorker' in navigator && !window.__native) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
