import { html, useState, useEffect } from '../lib.js';
import { goBack, navigate, navigateRoot } from '../router.js';
import { Icon, EquipmentIcon } from './icons.js';
import { MUSCLE_GROUPS, EQUIPMENT } from '../data/taxonomy.js';

export { Icon, EquipmentIcon };

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

/** Aktuálny čas, obnovovaný v intervale (stopky tréningu). */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
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

// ── Tlačidlá ─────────────────────────────────────────────

export function PrimaryButton({ children, icon, onClick, disabled, type = 'button', block }) {
  return html`
    <button type=${type} class=${`btn btn-primary ${block ? 'btn-block' : ''}`} onClick=${onClick} disabled=${disabled}>
      ${icon}<span>${children}</span>
    </button>`;
}

export function SecondaryButton({ children, icon, onClick, disabled, type = 'button', block }) {
  return html`
    <button type=${type} class=${`btn btn-secondary ${block ? 'btn-block' : ''}`} onClick=${onClick} disabled=${disabled}>
      ${icon}<span>${children}</span>
    </button>`;
}

/** Okrúhle tlačidlo s ikonou (hlavička, filter). */
export function IconButton({ icon, label, onClick, disabled, badge, class: cls = '' }) {
  return html`
    <button type="button" class=${`icon-btn ${cls}`} aria-label=${label} title=${label} onClick=${onClick} disabled=${disabled}>
      ${icon}${badge && html`<span class="icon-btn-badge" />`}
    </button>`;
}

export function TextButton({ children, onClick, disabled, strong, danger }) {
  return html`
    <button type="button" class=${`text-btn ${strong ? 'strong' : ''} ${danger ? 'danger' : ''}`}
      onClick=${onClick} disabled=${disabled}>${children}</button>`;
}

// ── Hlavička a navigácia ─────────────────────────────────

/**
 * large: koreňová obrazovka s veľkým nadpisom (H1) a akciami vpravo.
 * inak: lišta podstránky so „späť" vľavo, voliteľným titulkom a akciami vpravo.
 */
export function AppHeader({ title, large, back, backLabel = 'Späť', left, right }) {
  if (large) {
    return html`
      <header class="app-header large">
        <h1>${title}</h1>
        ${right && html`<div class="app-header-actions">${right}</div>`}
      </header>`;
  }
  return html`
    <header class="app-header bar">
      <div class="bar-side">
        ${left || (back && html`
          <button type="button" class="bar-back" onClick=${() => goBack(back)}>
            ${Icon.chevronLeft()}<span>${backLabel}</span>
          </button>`)}
      </div>
      <div class="bar-title">${title}</div>
      <div class="bar-side bar-right">${right}</div>
    </header>`;
}

const TABS = [
  { path: '/plans', label: 'Plány', icon: Icon.home },
  { path: '/history', label: 'História', icon: Icon.clock },
  { path: '/exercises', label: 'Cviky', icon: Icon.dumbbell },
  { path: '/more', label: 'Viac', icon: Icon.more },
];

export function BottomTabBar({ path }) {
  return html`
    <nav class="tabbar" aria-label="Hlavná navigácia">
      ${TABS.map((t) => {
        const active = path === t.path || path.startsWith(`${t.path}/`);
        return html`
          <a class=${`tab ${active ? 'active' : ''}`} href=${`#${t.path}`} aria-current=${active ? 'page' : undefined}
             onClick=${(e) => { e.preventDefault(); if (path !== t.path) navigateRoot(t.path); }}>
            ${t.icon(24)}<span>${t.label}</span>
          </a>`;
      })}
    </nav>`;
}

// ── Vstupy a filtre ──────────────────────────────────────

export function SearchField({ value, onInput, placeholder = 'Hľadať…' }) {
  return html`
    <label class="search">
      ${Icon.search()}
      <input type="search" placeholder=${placeholder} value=${value} autocomplete="off"
        aria-label=${placeholder} onInput=${(e) => onInput(e.currentTarget.value)} />
      ${value && html`
        <button type="button" class="search-clear" aria-label="Vymazať" onClick=${() => onInput('')}>${Icon.x(12)}</button>`}
    </label>`;
}

export function FilterChip({ active, onClick, children }) {
  return html`<button type="button" class=${`chip ${active ? 'active' : ''}`} aria-pressed=${!!active} onClick=${onClick}>${children}</button>`;
}

export function Tag({ children, kind = '' }) {
  return html`<span class=${`tag ${kind}`}>${children}</span>`;
}

// ── Karty a zoznamy ──────────────────────────────────────

/** Skupina s popisom nad kartou (nastavenia, zoznamy). */
export function Section({ title, footer, children, class: cls = '' }) {
  return html`
    <section class=${`section ${cls}`}>
      ${title && html`<h2 class="section-caption">${title}</h2>`}
      <div class="card group">${children}</div>
      ${footer && html`<p class="section-footer">${footer}</p>`}
    </section>`;
}

/** Karta s nadpisom a ikonou vo vnútri; voliteľne zbaliteľná. */
export function SectionCard({ title, icon, headerRight, collapsed, onToggle, children, footer }) {
  const head = html`${icon && html`<span class="section-card-icon">${icon}</span>`}
    <h2 class="section-card-title">${title}</h2>`;
  return html`
    <section class="section">
      <div class="card section-card">
        <div class="section-card-head">
          ${onToggle
            ? html`<button type="button" class="section-card-toggle" aria-expanded=${!collapsed} onClick=${onToggle}>
                ${head}<span class=${`section-card-chevron ${collapsed ? '' : 'open'}`}>${Icon.chevronDown()}</span>
              </button>`
            : head}
          ${headerRight && html`<div class="section-card-right">${headerRight}</div>`}
        </div>
        ${!collapsed && html`<div class="section-card-body">${children}</div>`}
      </div>
      ${footer && html`<p class="section-footer">${footer}</p>`}
    </section>`;
}

/** Riadok nastavení: ikona, názov, hodnota, šípka. Klikateľný cez href alebo onClick. */
export function SettingsRow({ icon, title, subtitle, value, href, onClick, chevron, danger, disabled, children }) {
  const content = html`
    ${icon && html`<span class="settings-icon">${icon}</span>`}
    <div class="row-main">
      <div class=${`row-title ${danger ? 'danger' : ''}`}>${title}</div>
      ${subtitle && html`<div class="row-subtitle">${subtitle}</div>`}
      ${children}
    </div>
    ${value !== undefined && value !== null && html`<div class="row-value">${value}</div>`}
    ${chevron && html`<span class="row-chevron">${Icon.chevronRight()}</span>`}`;
  if (href && !disabled) {
    return html`<a class="row" href=${href} onClick=${(e) => { e.preventDefault(); navigate(href.replace(/^#/, '')); }}>${content}</a>`;
  }
  if (onClick && !disabled) {
    return html`<button type="button" class="row" onClick=${onClick}>${content}</button>`;
  }
  return html`<div class=${`row ${disabled ? 'disabled' : ''}`} aria-disabled=${disabled ? 'true' : undefined}>${content}</div>`;
}

/** Tlačidlo-odkaz v štýle riadku: ikona + text v akcentovej farbe. */
export function AddRow({ children, onClick }) {
  return html`<button type="button" class="row add-row" onClick=${onClick}>${Icon.plus()}<span>${children}</span></button>`;
}

export function StatCard({ value, label, text }) {
  return html`
    <div class="stat">
      <div class=${`stat-value ${text ? 'text' : ''}`}>${value}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

// ── Cviky ────────────────────────────────────────────────

/**
 * Obrázok cviku. Kým cviky nemajú vlastné obrázky, zobrazí jednotný placeholder
 * s ikonou vybavenia. Prop `src` je pripravený na budúce obrázky.
 */
export function ExerciseImage({ exercise, size = 'thumb', src }) {
  const iconFn = EquipmentIcon[exercise?.equipment] || EquipmentIcon.other;
  return html`
    <div class=${`ex-image ${size}`} aria-hidden="true">
      ${src ? html`<img src=${src} alt="" loading="lazy" />` : iconFn(size === 'hero' ? 56 : 28)}
    </div>`;
}

export function exerciseMeta(ex) {
  return [...ex.muscleGroups.map((m) => MUSCLE_GROUPS[m] || m), EQUIPMENT[ex.equipment] || ex.equipment].join(' · ');
}

/** href: odkaz na detail; onClick + selected: výber (napr. v ExercisePicker). */
export function ExerciseListItem({ exercise, href, right, onClick, selected }) {
  const body = html`
    <${ExerciseImage} exercise=${exercise} />
    <div class="ex-item-main">
      <div class="ex-item-name">${exercise.name}</div>
      <div class="ex-item-meta">${exerciseMeta(exercise)}</div>
    </div>
    ${right || (href && html`<span class="row-chevron">${Icon.chevronRight()}</span>`)}`;
  if (onClick) {
    return html`<button type="button" class=${`card ex-item ${selected ? 'selected' : ''}`}
      aria-pressed=${!!selected} onClick=${onClick}>${body}</button>`;
  }
  if (href) {
    return html`<a class="card ex-item" href=${href}
      onClick=${(e) => { e.preventDefault(); navigate(href.replace(/^#/, '')); }}>${body}</a>`;
  }
  return html`<div class="card ex-item">${body}</div>`;
}

// ── Panely ───────────────────────────────────────────────

/** Spodný panel (filter, menu). Zatvorí sa ťuknutím mimo alebo Escape. tall: takmer na celú výšku. */
export function BottomSheet({ open, title, onClose, children, footer, tall }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <div class=${`sheet ${tall ? 'tall' : ''}`} role="dialog" aria-modal="true" aria-label=${title} onClick=${(e) => e.stopPropagation()}>
        <div class="sheet-grabber" />
        ${title && html`<h2 class="sheet-title">${title}</h2>`}
        <div class="sheet-body">${children}</div>
        ${footer && html`<div class="sheet-footer">${footer}</div>`}
      </div>
    </div>`;
}

/** Menu akcií v štýle iOS action sheet. actions: [{label, icon, danger, onClick}] */
export function ActionSheet({ open, title, actions, onClose }) {
  return html`
    <${BottomSheet} open=${open} title=${title} onClose=${onClose}
      footer=${html`<${SecondaryButton} block onClick=${onClose}>Zrušiť</${SecondaryButton}>`}>
      <div class="card group">
        ${actions.map((a) => html`
          <button type="button" class=${`row action-row ${a.danger ? 'danger' : ''}`}
            onClick=${() => { onClose(); a.onClick(); }}>
            ${a.icon && html`<span class="settings-icon">${a.icon}</span>`}
            <span class="row-title">${a.label}</span>
          </button>`)}
      </div>
    </${BottomSheet}>`;
}

// ── Stavy ────────────────────────────────────────────────

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

