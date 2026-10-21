import { html, useState, useEffect } from '../lib.js';
import { getSetting, setSetting } from '../db/db.js';
import { formatClock } from '../format.js';
import { Icon } from './icons.js';

// Časovač odpočinku. Stav je čas konca (endsAt), takže odpočet sedí aj po uspaní
// telefónu; ukladá sa do settings, aby prežil reštart aplikácie.

let timer = null; // { endsAt, total, minimized } — total v sekundách; minimized: zmenšený do spodného panela
const listeners = new Set();
const dismissListeners = new Set(); // volané synchrónne, keď pauzu zavrie používateľ (ťuknutím)

function emit({ persist = true } = {}) {
  listeners.forEach((l) => l(timer));
  if (persist) setSetting('restTimer', timer).catch(() => {});
}

export async function loadRestTimer() {
  const saved = await getSetting('restTimer', null);
  timer = saved && saved.endsAt > Date.now() ? saved : null;
  emit({ persist: false });
}

export function startRest(sec) {
  unlockAudio();
  if (!sec || sec <= 0) return;
  timer = { endsAt: Date.now() + sec * 1000, total: sec, minimized: false };
  emit();
}

export function adjustRest(deltaSec) {
  if (!timer) return;
  const endsAt = timer.endsAt + deltaSec * 1000;
  if (endsAt <= Date.now()) return stopRest();
  timer = { ...timer, endsAt, total: Math.max(1, timer.total + deltaSec) };
  emit();
}

export function stopRest() {
  if (!timer) return;
  timer = null;
  emit();
}

/** Zmenší veľké okno pauzy do spodného panela (alebo ho znova zväčší). */
export function setRestMinimized(minimized) {
  if (!timer || !!timer.minimized === minimized) return;
  timer = { ...timer, minimized };
  emit();
}

/**
 * Pauzu zavrel používateľ ťuknutím. Poslucháči sa volajú synchrónne v rámci ťuknutia —
 * len vtedy iOS dovolí presunúť kurzor do poľa a otvoriť klávesnicu.
 */
function dismissRest() {
  stopRest();
  dismissListeners.forEach((l) => l());
}

export function useRestDismissed(fn) {
  useEffect(() => {
    dismissListeners.add(fn);
    return () => dismissListeners.delete(fn);
  }, [fn]);
}

export function useRestTimer() {
  const [t, setT] = useState(timer);
  useEffect(() => {
    listeners.add(setT);
    setT(timer);
    return () => listeners.delete(setT);
  }, []);
  return t;
}

// ── Zvuk ────────────────────────────────────────────
// iOS povolí zvuk iba po dotyku používateľa — AudioContext sa odomkne pri odškrtnutí série.

let audio = null;

export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) {
      audio = new AC();
      const src = audio.createBufferSource();
      src.buffer = audio.createBuffer(1, 1, 22050);
      src.connect(audio.destination);
      src.start(0);
    }
    if (audio.state === 'suspended') audio.resume();
  } catch { /* bez zvuku */ }
}

export function beep() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    if (!audio) return;
    const t0 = audio.currentTime + 0.02;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.28;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = i === 2 ? 1320 : 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  } catch { /* bez zvuku */ }
}

// ── Zobrazenie ──────────────────────────────────

const DONE_SHOW_MS = 1500;

/** Kruhový ukazovateľ zostávajúceho času. progress 1 → plný kruh, 0 → prázdny. */
export function TimerRing({ progress, size = 52, stroke = 3, children }) {
  const r = (size - stroke) / 2 - 1;
  const C = 2 * Math.PI * r;
  return html`
    <div class="timer-ring" style=${`width:${size}px;height:${size}px`}>
      <svg class="timer-ring-svg" viewBox=${`0 0 ${size} ${size}`} width=${size} height=${size} aria-hidden="true">
        <circle class="timer-ring-track" cx=${size / 2} cy=${size / 2} r=${r} style=${`stroke-width:${stroke}`} />
        <circle class="timer-ring-value" cx=${size / 2} cy=${size / 2} r=${r}
          style=${`stroke-width:${stroke};stroke-dasharray:${C};stroke-dashoffset:${C * (1 - Math.max(0, Math.min(1, progress)))}`} />
      </svg>
      ${children}
    </div>`;
}

/**
 * Časovač pauzy. modal: veľké okno uprostred obrazovky so stmaveným pozadím (počas tréningu);
 * ťuknutím mimo okna sa zmenší do spodného panela. Inde (iné obrazovky) je vždy panel.
 */
export function RestTimer({ modal = false }) {
  const t = useRestTimer();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!t) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [t]);

  const remainingMs = t ? t.endsAt - now : 0;
  const done = t && remainingMs <= 0;

  useEffect(() => {
    if (!t || !done) return undefined;
    // Dlho po konci (aplikácia bola na pozadí) už nepípame, len zavrieme.
    if (-remainingMs < 3000) beep();
    const id = setTimeout(stopRest, Math.max(0, DONE_SHOW_MS + remainingMs));
    return () => clearTimeout(id);
  }, [t, done]);

  if (!t) return null;
  const progress = done ? 0 : Math.min(1, remainingMs / (t.total * 1000));
  const time = formatClock(Math.ceil(Math.max(0, remainingMs) / 1000));
  const big = modal && !t.minimized;

  const buttons = html`
    <button type="button" class="rest-btn" onClick=${() => adjustRest(-15)} aria-label="Ubrať 15 sekúnd">−15</button>
    <button type="button" class="rest-btn" onClick=${() => adjustRest(15)} aria-label="Pridať 15 sekúnd">+15</button>
    <button type="button" class="rest-btn skip" onClick=${dismissRest} aria-label="Preskočiť pauzu">${Icon.x(big ? 22 : 18)}</button>`;

  if (big) {
    return html`
      <div class="rest-bar modal" role=${done ? 'status' : 'timer'} aria-label="Odpočinok"
        onClick=${(e) => { if (e.target === e.currentTarget) setRestMinimized(true); }}>
        <div class=${`rest-inner ${done ? 'done' : ''}`}>
          <${TimerRing} progress=${progress} size=${232} stroke=${8}>
            <div class="timer-ring-center">
              ${done
                ? html`<span class="rest-done-icon">${Icon.check(44)}</span><span class="rest-done-text">Pauza skončila</span>`
                : html`<div class="rest-label">Pauza</div><div class="rest-time">${time}</div>`}
            </div>
          </${TimerRing}>
          ${!done && html`<div class="rest-actions">${buttons}</div>`}
          ${!done && html`
            <button type="button" class="rest-minimize" onClick=${() => setRestMinimized(true)}>
              ${Icon.chevronDown(18)}<span>Zmenšiť</span>
            </button>`}
        </div>
      </div>`;
  }

  if (done) {
    return html`
      <div class="rest-bar" role="status">
        <button type="button" class="rest-inner done" onClick=${dismissRest}>
          ${Icon.check(22)}<span class="rest-done-text">Pauza skončila</span>
        </button>
      </div>`;
  }
  return html`
    <div class="rest-bar" role="timer" aria-label="Odpočinok">
      <div class="rest-inner">
        <button type="button" class="rest-expand" aria-label=${modal ? 'Zväčšiť časovač' : 'Odpočinok'}
          onClick=${() => modal && setRestMinimized(false)}>
          <${TimerRing} progress=${progress}>${Icon.timer(22)}</${TimerRing}>
          <div class="rest-main">
            <div class="rest-label">Pauza</div>
            <div class="rest-time">${time}</div>
          </div>
        </button>
        <div class="rest-actions">${buttons}</div>
      </div>
    </div>`;
}
