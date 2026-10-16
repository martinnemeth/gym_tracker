import { html, useState, useEffect } from '../lib.js';
import { goBack, navigate, navigateRoot } from '../router.js';

// ── Dáta ─────────────────────────────────────────────────

/** Načíta async dáta; reload() ich načíta znova. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: undefined, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => alive && setState({ loading: false, data, error: null }),
      (error) => alive && setState({ loading: false, data: undefined, error }),
    );
    return () => { alive = false; };
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

// ── Toast ────────────────────────────────────────────────

const toastListeners = new Set();
export function showToast(message) {
  toastListeners.forEach((l) => l(message));
}

export function Toast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let timer;
    const l = (m) => { setMsg(m); clearTimeout(timer); timer = setTimeout(() => setMsg(null), 2600); };
    toastListeners.add(l);
    return () => { toastListeners.delete(l); clearTimeout(timer); };
  }, []);
  return msg ? html`<div class="toast" role="status">${msg}</div>` : null;
}

// ── Ikony ────────────────────────────────────────────────

const svg = (body, size = 24) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const Icon = {
  plans: () => svg(html`<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M9 10h6M9 14h6M9 18h3"/>`),
  dumbbell: () => svg(html`<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>`),
  more: () => svg(html`<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>`),
  chevronLeft: () => svg(html`<path d="M15 18l-6-6 6-6"/>`, 22),
  chevronRight: () => svg(html`<path d="M9 18l6-6-6-6"/>`, 18),
  plus: () => svg(html`<path d="M12 5v14M5 12h14"/>`, 22),
  search: () => svg(html`<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>`, 18),
  check: () => svg(html`<path d="M5 12l5 5 9-10"/>`, 16),
  up: () => svg(html`<path d="M6 15l6-6 6 6"/>`, 18),
  down: () => svg(html`<path d="M6 9l6 6 6-6"/>`, 18),
  trash: () => svg(html`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>`, 18),
  x: () => svg(html`<path d="M6 6l12 12M18 6L6 18"/>`, 16),
};

// ── Navigácia ────────────────────────────────────────────

/** Horná lišta podstránky. */
export function NavBar({ title, back, backLabel = 'Späť', left, right }) {
  return html`
    <header class="nav">
      <div class="nav-side">
        ${left || (back && html`
          <button class="nav-btn nav-back" onClick=${() => goBack(back)}>
            <${Icon.chevronLeft} /><span>${backLabel}</span>
          </button>`)}
      </div>
      <div class="nav-title">${title}</div>
      <div class="nav-side nav-right">${right}</div>
    </header>`;
}

/** Hlavička koreňovej obrazovky (veľký nadpis). */
export function LargeHeader({ title, right }) {
  return html`
    <header class="large-header">
      <h1>${title}</h1>
      ${right && html`<div class="large-header-actions">${right}</div>`}
    </header>`;
}

const TABS = [
  { path: '/plans', label: 'Plány', icon: Icon.plans },
  { path: '/exercises', label: 'Cviky', icon: Icon.dumbbell },
  { path: '/more', label: 'Viac', icon: Icon.more },
];

export function TabBar({ path }) {
  return html`
    <nav class="tabbar">
      ${TABS.map((t) => {
        const active = path === t.path || path.startsWith(`${t.path}/`);
        return html`
          <a class=${`tab ${active ? 'active' : ''}`} href=${`#${t.path}`}
             onClick=${(e) => { e.preventDefault(); if (path !== t.path) navigateRoot(t.path); }}>
            <${t.icon} /><span>${t.label}</span>
          </a>`;
      })}
    </nav>`;
}

// ── Zoznamy ──────────────────────────────────────────────

export function Section({ title, footer, children, class: cls = '' }) {
  return html`
    <section class=${`section ${cls}`}>
      ${title && html`<h2 class="section-title">${title}</h2>`}
      <div class="group">${children}</div>
      ${footer && html`<p class="section-footer">${footer}</p>`}
    </section>`;
}

export function Row({ title, subtitle, value, onClick, href, chevron, danger, disabled, children }) {
  const content = html`
    <div class="row-main">
      <div class=${`row-title ${danger ? 'danger' : ''}`}>${title}</div>
      ${subtitle && html`<div class="row-subtitle">${subtitle}</div>`}
      ${children}
    </div>
    ${value !== undefined && html`<div class="row-value">${value}</div>`}
    ${chevron && html`<span class="row-chevron"><${Icon.chevronRight} /></span>`}`;
  if (href) {
    return html`<a class="row" href=${href} onClick=${(e) => { e.preventDefault(); navigate(href.replace(/^#/, '')); }}>${content}</a>`;
  }
  if (onClick) {
    return html`<button class="row" onClick=${onClick} disabled=${disabled}>${content}</button>`;
  }
  return html`<div class=${`row ${disabled ? 'disabled' : ''}`}>${content}</div>`;
}

export function Chip({ active, onClick, children }) {
  return html`<button type="button" class=${`chip ${active ? 'active' : ''}`} aria-pressed=${!!active} onClick=${onClick}>${children}</button>`;
}

export function Tag({ children, kind = '' }) {
  return html`<span class=${`tag ${kind}`}>${children}</span>`;
}

export function EmptyState({ title, text, action }) {
  return html`
    <div class="empty">
      <div class="empty-title">${title}</div>
      ${text && html`<p>${text}</p>`}
      ${action}
    </div>`;
}

export function Loading() {
  return html`<div class="loading">Načítavam…</div>`;
}

export function ErrorBox({ error }) {
  return html`<div class="error-box">Chyba: ${String(error?.message || error)}</div>`;
}
