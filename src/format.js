// Formátovanie čísel, časov a sérií (slovenské zvyklosti: desatinná čiarka).

/** "62,5" alebo "62.5" → 62.5; prázdne / neplatné → null */
export function parseNum(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function formatNum(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('sk-SK', { maximumFractionDigits: 2 });
}

/** 90 → "1:30" */
export function formatClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Trvanie tréningu: "48 min", "1 h 05 min" */
export function formatDuration(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** Pauza v pláne: 90 → "1:30", 45 → "45 s" */
export function formatRest(sec) {
  if (!sec) return '–';
  return sec < 60 ? `${sec} s` : formatClock(sec);
}

export const formatDate = (ts) =>
  new Date(ts).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' });
export const formatDateShort = (ts) =>
  new Date(ts).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' });
export const formatDateLong = (ts) =>
  new Date(ts).toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' });
export const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString('sk-SK', { hour: 'numeric', minute: '2-digit' });
export const formatWeekday = (ts) =>
  new Date(ts).toLocaleDateString('sk-SK', { weekday: 'short' });
export function formatMonth(ts) {
  const s = new Date(ts).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** plural(3, 'séria', 'série', 'sérií') → "3 série" */
export function plural(n, one, few, many) {
  const word = n === 1 ? one : n >= 2 && n <= 4 ? few : many;
  return `${n} ${word}`;
}

/**
 * Séria podľa typu sledovania. compact vynechá jednotku pri váhe×opakovaniach.
 * weight_reps: "60 kg × 10", bodyweight_reps: "10" / "+10 kg × 10", time: "45 s" / "20 kg · 45 s"
 */
export function setLabel(set, trackingType, { compact = false } = {}) {
  const w = set.weight;
  if (trackingType === 'time') {
    const t = `${set.durationSec ?? '–'} s`;
    return w ? `${formatNum(w)} kg · ${t}` : t;
  }
  if (trackingType === 'bodyweight_reps') {
    if (w) return `+${formatNum(w)}${compact ? '' : ' kg'} × ${set.reps}`;
    return `${set.reps ?? '–'}${compact ? '' : ' opak.'}`;
  }
  return `${w === null || w === undefined ? '–' : formatNum(w)}${compact ? '' : ' kg'} × ${set.reps ?? '–'}`;
}

/** Cieľ z plánu: "3 × 8–12 · 60 kg", "3 × 60 s" */
export function targetLabel(t, trackingType) {
  if (!t) return '';
  let reps = '';
  if (trackingType === 'time') reps = t.durationSec ? `${t.durationSec} s` : '';
  else if (t.repMin && t.repMax && t.repMin !== t.repMax) reps = `${t.repMin}–${t.repMax}`;
  else reps = String(t.repMin || t.repMax || '');
  const parts = [t.sets ? `${t.sets} × ${reps || '?'}` : reps];
  if (t.weight) parts.push(`${trackingType === 'bodyweight_reps' ? '+' : ''}${formatNum(t.weight)} kg`);
  return parts.filter(Boolean).join(' · ');
}

/** Objem (kg × opakovania) zo sérií cvikov s typom váha × opakovania. typeOf: exerciseId → trackingType */
export function setsVolume(sets, typeOf) {
  return sets.reduce((sum, s) =>
    sum + (typeOf(s.exerciseId) === 'weight_reps' && s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0), 0);
}
