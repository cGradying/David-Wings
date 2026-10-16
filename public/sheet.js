// Bottom sheets and toasts. Accessible: labelled dialog, focus moved in and restored, Escape closes.
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),[href],select,textarea,[tabindex]:not([tabindex="-1"])';
let sheetN = 0;

export function dismiss(s, onClose) {
  if (s.classList.contains('is-closing')) return;
  s.classList.add('is-closing');
  if (calm.matches) s.remove(); else { s.addEventListener('animationend', () => s.remove(), { once: true }); setTimeout(() => s.remove(), 200); }
  s._esc && document.removeEventListener('keydown', s._esc);
  s._prev?.isConnected && s._prev.focus?.();
  onClose?.();
}
export function sheet(html, onClose, cls = '') {
  document.querySelector('.scrim')?.remove();
  const s = Object.assign(document.createElement('div'), { className: 'scrim', innerHTML: `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>` });
  const box = s.firstElementChild, h = box.querySelector('h2');
  if (h) { h.id = `sheet-h${++sheetN}`; box.setAttribute('aria-labelledby', h.id); }
  s._prev = document.activeElement;
  s._esc = (e) => { if (e.key === 'Escape') dismiss(s, onClose); };
  document.addEventListener('keydown', s._esc);
  s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-close]')) dismiss(s, onClose); });
  document.body.append(s);
  const first = box.querySelector(FOCUSABLE);
  if (!first) box.tabIndex = -1;
  (first ?? box).focus?.();
  return s;
}

let toastT;
export function toast(msg, err) {
  document.querySelector('.toast')?.remove();
  const t = Object.assign(document.createElement('div'), { className: 'toast' + (err ? ' err' : ''), textContent: msg, role: err ? 'alert' : 'status' });
  document.body.append(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2800);
}
