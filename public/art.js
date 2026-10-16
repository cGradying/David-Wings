// Flat category illustrations, 64x64, themed by CSS vars with fallbacks.
const W = (body, bg = 'var(--primary-soft,#fde3d4)') =>
  `<svg viewBox="0 0 64 64" width="64" height="64" role="none" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="${bg}"/>${body}</svg>`;
const INK = 'var(--ink,#1e130c)', P = 'var(--primary,#c8380a)', H = 'var(--honey,#e9a21f)', OK = 'var(--ok,#1f6b43)';

const ART = {
  'Rice Bowl': W(`<path d="M12 30h40a20 20 0 0 1-40 0z" fill="${P}"/><path d="M16 30a16 12 0 0 1 32 0z" fill="#fff"/><circle cx="26" cy="23" r="2.5" fill="${H}"/><circle cx="36" cy="20" r="2.5" fill="${OK}"/><circle cx="41" cy="26" r="2" fill="${H}"/><rect x="24" y="50" width="16" height="4" rx="2" fill="${INK}"/>`),
  Wings: W(`<path d="M14 40c0-14 12-22 26-20 8 1 12 8 9 15-3 8-13 13-24 11-6-1-11-3-11-6z" fill="${P}"/><circle cx="46" cy="22" r="5" fill="#fff"/><rect x="43" y="12" width="6" height="12" rx="3" fill="#fff" transform="rotate(35 46 22)"/><path d="M22 36c4-6 10-8 16-7" stroke="${H}" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  Party: W(`<rect x="10" y="30" width="44" height="22" rx="4" fill="${H}"/><rect x="10" y="30" width="44" height="8" fill="${P}"/><rect x="29" y="30" width="6" height="22" fill="#fff"/><path d="M32 30c-8-12-18-2-8 0zM32 30c8-12 18-2 8 0z" fill="${INK}"/>`),
  Dips: W(`<path d="M14 28h36l-4 22H18z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 32h32l-2 8H18z" fill="${P}"/><path d="M26 28c0-8 4-12 10-16" stroke="${OK}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="40" cy="14" r="3" fill="${H}"/>`),
  Drinks: W(`<path d="M18 20h28l-4 32H22z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 30h24l-2 20H22z" fill="${P}"/><path d="M36 20l6-10h6" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="30" cy="38" r="2.5" fill="#fff"/>`),
};

export const art = (category) => ART[category] || W('', '#e5e5e5');
