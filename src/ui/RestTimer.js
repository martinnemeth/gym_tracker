import { html, useState, useEffect } from '../lib.js';
import { getSetting, setSetting } from '../db/db.js';
import { formatClock } from '../format.js';
import { Icon } from './icons.js';

// Časovač odpočinku. Stav je čas konca (endsAt), takže odpočet sedí aj po uspaní
// telefónu; ukladá sa do settings, aby prežil reštart aplikácie.

let timer = null; // { endsAt, total } — total v sekundách
const listeners = new Set();

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
  timer = { endsAt: Date.now() + sec * 1000, total: sec };
  emit();
}

export function adjustRest(deltaSec) {
  if (!timer) return;
  const endsAt = timer.endsAt + deltaSec * 1000;
  if (endsAt <= Date.now()) return stopRest();
  timer = { endsAt, total: Math.max(1, timer.total + deltaSec) };
  emit();
}

export function stopRest() {
  if (!timer) return;
  timer = null;
  emit();
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

function beep() {
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

// ── Lišta ───────────────────────────────────────────

const DONE_SHOW_MS = 4000;

export function RestTimer() {
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

  if (done) {
    return html`
      <div class="rest-bar" role="status">
        <button type="button" class="rest-inner done" onClick=${stopRest}>
          ${Icon.check(22)}<span class="rest-done-text">Pauza skončila</span>
        </button>
      </div>`;
  }
  return html`
    <div class="rest-bar" role="timer" aria-label="Odpočinok">
      <div class="rest-inner">
        <div class="rest-main">
          <div class="rest-label">Pauza</div>
          <div class="rest-time">${formatClock(Math.ceil(remainingMs / 1000))}</div>
        </div>
        <button type="button" class="rest-btn" onClick=${() => adjustRest(-15)} aria-label="Ubrať 15 sekúnd">−15</button>
        <button type="button" class="rest-btn" onClick=${() => adjustRest(15)} aria-label="Pridať 15 sekúnd">+15</button>
        <button type="button" class="rest-btn skip" onClick=${stopRest} aria-label="Preskočiť pauzu">${Icon.x(18)}</button>
        <div class="rest-progress" style=${`transform: scaleX(${progress})`} />
      </div>
    </div>`;
}
