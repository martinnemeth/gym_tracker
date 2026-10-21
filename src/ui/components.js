import { html, useState, useEffect, useRef } from '../lib.js';
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

/** iconEnd: ikona za textom (napr. šípka pri hlavnom CTA). */
export function PrimaryButton({ children, icon, iconEnd, onClick, disabled, type = 'button', block }) {
  return html`
    <button type=${type} class=${`btn btn-primary ${block ? 'btn-block' : ''}`} onClick=${onClick} disabled=${disabled}>
      ${icon}<span>${children}</span>${iconEnd}
    </button>`;
}

export function SecondaryButton({ children, icon, iconEnd, onClick, disabled, type = 'button', block }) {
  return html`
    <button type=${type} class=${`btn btn-secondary ${block ? 'btn-block' : ''}`} onClick=${onClick} disabled=${disabled}>
      ${icon}<span>${children}</span>${iconEnd}
    </button>`;
}

/** Okrúhle tlačidlo s ikonou (hlavička, filter). */
export function IconButton({ icon, label, onClick, disabled, badge, class: cls = '' }) {
  return html`
    <button type="button" class=${`icon-btn ${cls}`} aria-label=${label} title=${label} onClick=${onClick} disabled=${disabled}>
      ${icon}${badge && html`<span class="icon-btn-badge" />`}
    </button>`;
}

/** pill: limetková pilulka (hlavná akcia v lište, napr. Uložiť). */
export function TextButton({ children, onClick, disabled, strong, danger, pill }) {
  return html`
    <button type="button" class=${`text-btn ${strong ? 'strong' : ''} ${danger ? 'danger' : ''} ${pill ? 'pill' : ''}`}
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

/** Tlačidlo-odkaz v štýle riadku: ikona + text v akcentovej farbe. circle: plus v limetkovom krúžku. */
export function AddRow({ children, onClick, circle, class: cls = '' }) {
  return html`
    <button type="button" class=${`row add-row ${cls}`} onClick=${onClick}>
      ${circle ? html`<span class="add-plus">${Icon.plus()}</span>` : Icon.plus()}<span>${children}</span>
    </button>`;
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
      ${src ? html`<img src=${src} alt="" loading="lazy" />` : iconFn(size === 'hero' ? 56 : 26)}
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

/**
 * Zatvorenie panela potiahnutím nadol (ako v iOS). Ťahať sa dá za hornú časť (úchyt, nadpis,
 * vyhľadávanie), alebo kdekoľvek, keď je obsah panela odscrollovaný úplne hore.
 */
const SWIPE_CLOSE_PX = 110;
const SWIPE_CLOSE_VELOCITY = 0.6; // px/ms
function useSwipeToClose(ref, enabled, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const sheet = ref.current;
    if (!enabled || !sheet) return undefined;
    const backdrop = sheet.parentElement;
    let start = null; // { x, y, t, scroller, dragging }
    let dy = 0;

    const scrollerOf = (el) => {
      for (let n = el; n && n !== backdrop; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n;
      }
      return null;
    };
    const setOffset = (px, animate) => {
      sheet.style.transition = animate ? 'transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1)' : 'none';
      sheet.style.transform = px ? `translateY(${px}px)` : '';
      backdrop.style.transition = animate ? 'background-color 0.22s' : 'none';
      backdrop.style.backgroundColor = px ? `rgba(5, 6, 8, ${Math.max(0, 0.62 * (1 - px / sheet.offsetHeight))})` : '';
    };

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const handle = e.target.closest('.sheet-grabber, .sheet-title, .picker-head');
      start = { x: t.clientX, y: t.clientY, t: Date.now(), scroller: handle ? null : scrollerOf(e.target), dragging: false };
      dy = 0;
    };
    const onMove = (e) => {
      if (!start) return;
      const t = e.touches[0];
      const ddx = t.clientX - start.x;
      const ddy = t.clientY - start.y;
      if (!start.dragging) {
        if (Math.abs(ddx) > Math.abs(ddy) && Math.abs(ddx) > 6) { start = null; return; } // vodorovné posúvanie (chipy)
        if (ddy < 8) return;
        if (start.scroller && start.scroller.scrollTop > 0) { start = null; return; }
        start.dragging = true;
        document.activeElement?.blur?.(); // schová klávesnicu
      }
      e.preventDefault();
      dy = Math.max(0, ddy - 8);
      setOffset(dy, false);
    };
    const onEnd = () => {
      if (!start) return;
      const { dragging, t } = start;
      start = null;
      if (!dragging) return;
      const velocity = dy / Math.max(1, Date.now() - t);
      if (dy > SWIPE_CLOSE_PX || velocity > SWIPE_CLOSE_VELOCITY) {
        setOffset(sheet.offsetHeight, true);
        setTimeout(() => closeRef.current(), 200);
      } else {
        setOffset(0, true);
      }
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);
}

/** Viditeľná časť okna (zmenšuje sa pri otvorenej klávesnici na iOS). */
function useVisualViewport(enabled) {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const read = () => (vv ? { top: vv.offsetTop, height: vv.height } : null);
  const [box, setBox] = useState(read);
  useEffect(() => {
    if (!enabled || !vv) return undefined;
    const update = () => setBox(read());
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, [enabled]);
  return enabled ? box : null;
}

/** Spodný panel (filter, menu). Zatvorí sa ťuknutím mimo alebo Escape. tall: takmer na celú výšku. */
export function BottomSheet({ open, title, onClose, children, footer, tall }) {
  const viewport = useVisualViewport(open);
  const sheetRef = useRef(null);
  useSwipeToClose(sheetRef, open, onClose);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  // Pri otvorenej klávesnici (iOS) sa panel zmestí nad ňu: backdrop kopíruje viditeľnú časť okna.
  const style = viewport ? `top:${viewport.top}px;height:${viewport.height}px;bottom:auto;--vvh:${viewport.height}px` : undefined;
  return html`
    <div class="sheet-backdrop" style=${style} onClick=${onClose}>
      <div ref=${sheetRef} class=${`sheet ${tall ? 'tall' : ''}`} role="dialog" aria-modal="true" aria-label=${title} onClick=${(e) => e.stopPropagation()}>
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

export function EmptyState({ title, text, action, icon }) {
  return html`
    <div class="empty">
      ${icon && html`<span class="icon-tile lg">${icon}</span>`}
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

