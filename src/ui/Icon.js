import { html } from './html.js';

/*
 * One stroke icon set (24×24, 2px strokes, round caps) in place of emoji,
 * which render differently on every OS, can't take theme colors, and are
 * read out as words by screen readers. Icons are decorative (aria-hidden):
 * the control that holds one carries the accessible label.
 */
const PATHS = {
  'arrow-left': html`<path d="M19 12H5M12 19l-7-7 7-7" />`,
  'arrow-right': html`<path d="M5 12h14M12 5l7 7-7 7" />`,
  'chevron-right': html`<path d="M9 18l6-6-6-6" />`,
  send: html`<path d="M5 12h14M13 6l6 6-6 6" />`,
  plus: html`<path d="M12 5v14M5 12h14" />`,
  minus: html`<path d="M5 12h14" />`,
  x: html`<path d="M18 6L6 18M6 6l12 12" />`,
  check: html`<path d="M20 6L9 17l-5-5" />`,
  more: html`<circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" />`,
  users: html`<circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14c1.9.8 3 2.8 3 6" />`,
  user: html`<circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />`,
  timer: html`<circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" />`,
  link: html`<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />`,
  copy: html`<rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />`,
  trash: html`<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />`,
  pencil: html`<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />`,
  move: html`<path d="M5 9l-3 3 3 3M19 9l3 3-3 3M2 12h20" />`,
  download: html`<path d="M12 3v12M7 10l5 5 5-5M5 21h14" />`,
  flag: html`<path d="M5 21V4M5 4h11l-2 4 2 4H5" />`,
  eye: html`<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />`,
  'eye-off': html`<path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6M3 3l18 18" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />`,
  sun: html`<circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />`,
  moon: html`<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />`,
  'log-out': html`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />`,
  list: html`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />`,
  columns: html`<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" />`,
  shield: html`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />`,
  sliders: html`<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />`,
  reopen: html`<path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />`,
  lock: html`<rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />`,
  thumb: html`<path d="M7 22H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3M7 11l4-9a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 9a2 2 0 0 1-2 1.7H7z" />`,
  play: html`<path d="M7 4l13 8-13 8z" />`,
  stop: html`<rect x="6" y="6" width="12" height="12" rx="2" />`,
  sparkle: html`<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />`,
  wifi: html`<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0" /><circle cx="12" cy="19.5" r="0.8" />`
};

export function Icon({ name, size = 20, className = '' }) {
  return html`
    <svg class=${`icon ${className}`} width=${size} height=${size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true" focusable="false">${PATHS[name]}</svg>
  `;
}

/** The three-lane logo mark (fixed colors — the one constant across themes). */
export function BrandMark({ size = 24 }) {
  const lanes = [{ x: 0, fill: '#8b7cf0' }, { x: 19, fill: '#93cc6b' }, { x: 38, fill: '#ec9cc0' }];
  return html`
    <svg class="brand-mark" width=${size * 54 / 44} height=${size} viewBox="0 0 54 44" aria-hidden="true" focusable="false">
      ${lanes.map(({ x, fill }) => html`
        <rect x=${x} y="0" width="16" height="44" rx="6" fill=${fill} />
        <rect x=${x + 6} y="7" width="4" height="7" rx="1.5" fill="rgba(255,255,255,0.85)" />
        <rect x=${x + 6} y="18.5" width="4" height="7" rx="1.5" fill="rgba(255,255,255,0.85)" />
        <rect x=${x + 6} y="30" width="4" height="7" rx="1.5" fill="rgba(255,255,255,0.85)" />
      `)}
    </svg>
  `;
}
