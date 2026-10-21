import { html } from '../lib.js';

// Jednotná sada ikon: 24×24, obrys, zaoblené konce. Farbu preberajú z currentColor.
// size môže byť aj objekt props (keď sa ikona použije ako <${Icon.x} />) — vtedy 24.
const svg = (body, s) => { const size = typeof s === 'number' ? s : 24; return html`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`; };

const dot = (cx) => html`<circle cx=${cx} cy="12" r="1.4" fill="currentColor" stroke="none" />`;

export const Icon = {
  // navigácia
  home: (s) => svg(html`<path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" />`, s),
  dumbbell: (s) => svg(html`<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />`, s),
  more: (s) => svg(html`${dot(5)}${dot(12)}${dot(19)}`, s),
  chevronLeft: (s = 22) => svg(html`<path d="M15 18l-6-6 6-6" />`, s),
  chevronRight: (s = 18) => svg(html`<path d="M9 18l6-6-6-6" />`, s),
  chevronDown: (s = 18) => svg(html`<path d="M6 9l6 6 6-6" />`, s),

  // akcie
  plus: (s = 20) => svg(html`<path d="M12 5v14M5 12h14" />`, s),
  search: (s = 18) => svg(html`<circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />`, s),
  x: (s = 16) => svg(html`<path d="M6 6l12 12M18 6L6 18" />`, s),
  check: (s = 16) => svg(html`<path d="M5 12l5 5 9-10" />`, s),
  up: (s = 18) => svg(html`<path d="M6 15l6-6 6 6" />`, s),
  down: (s = 18) => svg(html`<path d="M6 9l6 6 6-6" />`, s),
  trendUp: (s) => svg(html`<path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />`, s),
  trendDown: (s) => svg(html`<path d="M3 7l6 6 4-4 8 8" /><path d="M15 17h6v-6" />`, s),
  flat: (s) => svg(html`<path d="M4 12h16" /><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />`, s),
  trophy: (s = 20) => svg(html`<path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4" />`, s),
  download: (s = 20) => svg(html`<path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 19h14" />`, s),
  upload: (s = 20) => svg(html`<path d="M12 15V4M7 9l5-5 5 5" /><path d="M5 19h14" />`, s),
  copy: (s = 20) => svg(html`<rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />`, s),
  trash: (s = 20) => svg(html`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />`, s),
  edit: (s = 20) => svg(html`<path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" />`, s),
  sliders: (s = 20) => svg(html`<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />`, s),
  restore: (s = 20) => svg(html`<path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4" />`, s),

  // obsah
  clipboardCheck: (s = 20) => svg(html`<rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 13l2 2 4-4" />`, s),
  barChart: (s = 20) => svg(html`<path d="M5 20v-6M10 20V10M15 20v-8M20 20V5" />`, s),
  notes: (s = 20) => svg(html`<path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" />`, s),
  cloud: (s = 20) => svg(html`<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.5 4.25 4.25 0 0 0 7 18z" />`, s),
  share: (s = 20) => svg(html`<path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />`, s),
  book: (s = 20) => svg(html`<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z" /><path d="M12 6v14" />`, s),
  smartphone: (s = 20) => svg(html`<rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18h2" />`, s),
  shield: (s = 20) => svg(html`<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" />`, s),
  database: (s = 20) => svg(html`<ellipse cx="12" cy="5.5" rx="7" ry="2.5" /><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13" /><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />`, s),
  info: (s = 20) => svg(html`<circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" />`, s),
  calendar: (s = 24) => svg(html`<rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" />`, s),
  clock: (s = 24) => svg(html`<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />`, s),
  play: (s = 20) => svg(html`<path d="M7 4.5v15l12-7.5z" fill="currentColor" />`, s),
  timer: (s = 20) => svg(html`<circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M10 2h4M19 6l1.5-1.5" />`, s),
  bulb: (s = 24) => svg(html`<path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />`, s),
};

// Ikony vybavenia — použité v placeholderoch obrázkov cvikov.
export const EquipmentIcon = {
  barbell: (s) => svg(html`<path d="M2 12h20M5 7v10M8 8.5v7M19 7v10M16 8.5v7" />`, s),
  dumbbell: (s) => Icon.dumbbell(s),
  machine: (s) => svg(html`<rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h6M9 10h6M9 13h6M12 16v3" />`, s),
  cable: (s) => svg(html`<circle cx="12" cy="5" r="2" /><path d="M12 7v9" /><path d="M8 16h8l-1 4H9z" />`, s),
  smith: (s) => svg(html`<path d="M4 3v18M20 3v18M4 10h16" /><path d="M7 8v4M17 8v4" />`, s),
  kettlebell: (s) => svg(html`<path d="M9 8a3 3 0 1 1 6 0" /><path d="M8.5 9h7a5 5 0 0 1 1.5 7.5L16 20H8l-1-3.5A5 5 0 0 1 8.5 9z" />`, s),
  bodyweight: (s) => svg(html`<circle cx="12" cy="4.5" r="2" /><path d="M12 7v7M7 10l5-2 5 2M9 21l3-7 3 7" />`, s),
  band: (s) => svg(html`<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />`, s),
  other: (s) => svg(html`<circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" />`, s),
};
