import { sheet, dismiss } from './sheet.js';
import { esc, wait } from './util.js';
import { T } from './copy.js';
import { art } from './art.js';

// Mini-scenes are static SVG; C animates them with CSS keyed on .tut-scene > .s1..s4 inside the active .tut-card.
const SCENES = [
  () => `<div class="tut-tile">${art('Wings')}</div><svg viewBox="0 0 120 60" aria-hidden="true"><circle class="tut-tap" cx="60" cy="30" r="10"/></svg>`,
  () => '<svg viewBox="0 0 120 60" aria-hidden="true"><rect class="tut-row" x="8" y="18" width="104" height="24" rx="8"/><rect class="tut-del" x="84" y="18" width="28" height="24" rx="8"/></svg>',
  () => '<svg viewBox="0 0 120 60" aria-hidden="true"><rect class="tut-cash" x="14" y="16" width="40" height="28" rx="6"/><rect class="tut-receipt" x="70" y="8" width="36" height="44" rx="4"/></svg>',
  () => '<svg viewBox="0 0 120 60" aria-hidden="true"><rect class="tut-drawer" x="16" y="26" width="88" height="24" rx="6"/><path class="tut-check" d="M48 20l8 8 16-16"/></svg>',
];

export function maybeShowTutorial(S, save) {
  if (S.settings.onboarded === '1' || document.querySelector('.scrim')) return;
  showTutorial({ onClose: () => save({ onboarded: '1' }) });
}

export function showTutorial({ onClose } = {}) {
  const n = T.tutorial.length;
  let i = 0, busy = false;
  const html = `<button class="tut-skip" data-close>${esc(T.skip)}</button>
    ${T.tutorial.map((c, k) => `<section class="tut-card" ${k ? 'hidden' : ''} aria-label="${k + 1} / ${n}">
      <div class="tut-scene s${k + 1}">${SCENES[k]()}</div><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p></section>`).join('')}
    <div class="tut-dots" aria-hidden="true">${T.tutorial.map(() => '<i></i>').join('')}</div>
    <button class="tut-next btn primary"></button>`;
  const s = sheet(html, onClose, 'tutorial');
  const cards = [...s.querySelectorAll('.tut-card')], dots = [...s.querySelectorAll('.tut-dots i')], next = s.querySelector('.tut-next');
  const paint = () => {
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    next.textContent = i === n - 1 ? T.start : T.next;
  };
  const go = async (to) => {
    if (busy || to < 0 || to >= n) return;
    busy = true;
    const from = cards[i];
    from.classList.add('tut-out');
    await wait(120);
    from.hidden = true; from.classList.remove('tut-out');
    i = to; cards[i].hidden = false; cards[i].classList.add('tut-in');
    paint(); busy = false;
  };
  next.addEventListener('click', () => (i === n - 1 ? dismiss(s, onClose) : go(i + 1)));
  document.addEventListener('keydown', s._arrows = (e) => {
    if (!s.isConnected) return document.removeEventListener('keydown', s._arrows);
    if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1);
  });
  let x0 = null;
  s.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  s.addEventListener('pointerup', (e) => {
    if (x0 !== null && Math.abs(e.clientX - x0) > 40) go(i + (e.clientX < x0 ? 1 : -1));
    x0 = null;
  });
  paint();
  next.focus();
  return s;
}
