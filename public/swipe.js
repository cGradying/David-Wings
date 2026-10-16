// Swipe-left-to-reveal-trash on cart rows. Rubber-bands past -72px up to -88px; opens at <= -72.
export function initSwipe(main) {
  let sw = null, swiped = 0;
  const closeOthers = (keep) => main.querySelectorAll('.crow.is-open').forEach((r) => r !== keep && r.classList.remove('is-open'));
  main.addEventListener('pointerdown', (e) => {
    const fg = e.target.closest('.crow-fg');
    if (!fg || e.target.closest('button')) return;
    const row = fg.closest('.crow');
    sw = { fg, row, x0: e.clientX, y0: e.clientY, open: row.classList.contains('is-open'), dx: 0, on: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x0;
    if (!sw.on) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(e.clientY - sw.y0) > Math.abs(dx)) { sw = null; return; }
      sw.on = true; sw.fg.classList.add('is-swiping'); sw.fg.setPointerCapture?.(e.pointerId);
      closeOthers(sw.row);
    }
    const raw = Math.min(0, dx + (sw.open ? -72 : 0));
    sw.dx = raw < -72 ? Math.max(-88, -72 + (raw + 72) * 0.2) : raw;
    sw.fg.style.transform = `translateX(${sw.dx}px)`;
  });
  const end = () => {
    if (!sw) return;
    if (sw.on) { sw.row.classList.toggle('is-open', sw.dx <= -72); sw.fg.classList.remove('is-swiping'); sw.fg.style.transform = ''; swiped = Date.now(); }
    sw = null;
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  return { justSwiped: () => Date.now() - swiped < 60, closeAll: () => closeOthers() };
}
