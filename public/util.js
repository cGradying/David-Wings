export const $ = (s) => document.querySelector(s);
export const peso = (n) => '₱' + Number(n).toLocaleString('en-PH');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
