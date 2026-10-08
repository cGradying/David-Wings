// Drives the installed app on a running emulator/device through the WebView debugger.
// Usage: adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>; node scripts/android-smoke.mjs [step]
//   step "order"  : takes an Iced Tea order and prints the queue size
//   step "queue"  : prints the queue size and last-order summary (use after a restart to prove persistence)
import { writeFileSync } from 'node:fs';

const targets = await (await fetch('http://localhost:9222/json')).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails));
  return r.result.result.value;
};
const shot = async (file) => writeFileSync(file, Buffer.from((await send('Page.captureScreenshot')).result.data, 'base64'));
const w = 'const w=(ms)=>new Promise(r=>setTimeout(r,ms));const c=(s)=>document.querySelector(s).click();';

const step = process.argv[2] ?? 'queue';
if (step === 'order') {
  console.log(await js(`${w} c('[data-tile="11"]'); await w(150); c('[data-charge]'); await w(500); c('[data-q="50"]'); await w(150);
    const change = document.querySelector('.change').textContent.replace(/\\s+/g,' '); c('[data-a=next]'); await w(1200);
    const sheet = document.querySelector('.sheet')?.textContent.replace(/\\s+/g,' ') ?? 'NO SHEET'; c('[data-close]'); await w(500);
    return {change, sheet, queue: document.querySelectorAll('.order').length};`));
} else if (step === 'queue') {
  console.log(await js(`return {queue: document.querySelectorAll('.order').length, refs:[...document.querySelectorAll('.order .meta span:nth-child(2)')].map(e=>e.textContent)};`));
} else if (step === 'ledger') {
  console.log(await js(`${w} c('[data-a=ledger]'); await w(600); c('[data-lt=sales]'); await w(1500); return document.querySelector('.sum')?.textContent.replace(/\\s+/g,' ');`));
  await shot(process.argv[3] ?? 'android-ledger.png');
} else if (step === 'share') {
  console.log(await js(`try { await window.__native.saveFile('smoke.json', '{"ok":1}'); return 'share sheet opened'; } catch (e) { return 'ERR ' + (e.message ?? JSON.stringify(e)); }`));
} else if (step === 'backup') {
  console.log(await js(`${w} c('[data-a=settings]'); await w(500); const r = await window.__transport('GET', new URL('/api/backup', location.origin)); return {orders: r.body.tables.orders.length, items: r.body.tables.order_items.length};`));
}
ws.close();
