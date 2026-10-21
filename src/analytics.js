// Analytika progresu. Čisté funkcie bez DB — vstupom sú sedenia cviku (série jedného tréningu).
//
// Metrika sedenia podľa typu sledovania:
//   • váha × opakovania: odhad 1RM (Epley, w × (1 + r/30)) z najlepšej série
//   • vlastná váha: max. opakovaní v sérii; ak posledný tréning bol so záťažou, odhad 1RM záťaže
//   • čas: najdlhšia séria
// Nárast v %: priemer prvých 2 sedení obdobia oproti posledným 2 (pri menej ako 4 sedeniach prvé vs. posledné).
// Trend (stagnácia): lineárna regresia posledných N sedení — zmena < X % = stagnácia, pokles o 5 % a viac = pokles.

import { formatNum, setLabel, setsVolume } from './format.js';

export const DEFAULT_STAGNATION = { sessions: 4, minGainPct: 1 };
export const REGRESSION_PCT = -5;
const DAY = 86400000;
const WEEK = 7 * DAY;

export const PERIODS = [
  { id: 'all', label: 'Celé obdobie', weeks: null },
  { id: '12w', label: '12 týždňov', weeks: 12 },
  { id: '4w', label: '4 týždne', weeks: 4 },
];

const round1 = (n) => Math.round(n * 10) / 10;

/** Odhad 1RM (Epley). Pri 1 opakovaní je to samotná váha. */
export function e1rm(weight, reps) {
  if (!(weight > 0) || !(reps > 0)) return null;
  return round1(reps === 1 ? weight : weight * (1 + reps / 30));
}

/**
 * Metrika cviku: { key, label, unit }. Pri vlastnej váhe rozhoduje posledné sedenie
 * (so záťažou → 1RM záťaže, inak max. opakovaní); sedenia v inom režime sa do grafu nerátajú.
 */
export function metricFor(type, sessions = []) {
  if (type === 'time') return { key: 'time', label: 'Najdlhšia séria', unit: 's' };
  if (type === 'bodyweight_reps') {
    const last = sessions[sessions.length - 1];
    if (last?.sets.some((s) => s.weight > 0 && s.reps > 0)) return { key: 'e1rm', label: 'Odhad 1RM záťaže', unit: 'kg' };
    return { key: 'reps', label: 'Max. opakovaní', unit: 'opak.' };
  }
  return { key: 'e1rm', label: 'Odhad 1RM', unit: 'kg' };
}

/** Hodnota metriky v jednom sedení a séria, z ktorej pochádza. null, ak sedenie nemá vhodnú sériu. */
export function sessionValue(sets, metric) {
  let best = null;
  for (const s of sets) {
    let v = null;
    if (metric.key === 'e1rm') v = e1rm(s.weight, s.reps);
    else if (metric.key === 'reps') v = !(s.weight > 0) && s.reps > 0 ? s.reps : null;
    else if (metric.key === 'time') v = s.durationSec > 0 ? s.durationSec : null;
    if (v !== null && (!best || v > best.value)) best = { value: v, set: s };
  }
  return best;
}

/**
 * Body grafu zo sedení (zoradených od najstaršieho): [{ t, value, set, workoutId }].
 * sessions: [{ workoutId, t, sets }]
 */
export function seriesOf(sessions, metric) {
  const out = [];
  for (const s of sessions) {
    const best = sessionValue(s.sets, metric);
    if (best) out.push({ t: s.t, workoutId: s.workoutId, value: best.value, set: best.set });
  }
  return out;
}

/** Percentuálna zmena v období: priemer prvých 2 bodov vs. posledných 2 (pri < 4 bodoch prvý vs. posledný). */
export function pctChange(points) {
  if (points.length < 2) return null;
  const k = points.length >= 4 ? 2 : 1;
  const avg = (list) => list.reduce((a, p) => a + p.value, 0) / list.length;
  const first = avg(points.slice(0, k));
  const last = avg(points.slice(-k));
  if (!(first > 0)) return null;
  return ((last - first) / first) * 100;
}

/**
 * Trend posledných N sedení (lineárna regresia cez poradie sedení).
 * @returns {{ status: 'insufficient'|'progress'|'stagnation'|'regression', changePct, sessions }}
 */
export function trendOf(points, { sessions = DEFAULT_STAGNATION.sessions, minGainPct = DEFAULT_STAGNATION.minGainPct } = {}) {
  const n = Math.max(2, sessions);
  if (points.length < n) return { status: 'insufficient', changePct: null, sessions: n };
  const ys = points.slice(-n).map((p) => p.value);
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, y) => a + y, 0) / n;
  let num = 0;
  let den = 0;
  ys.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
  const slope = num / den;
  const start = my - slope * mx;
  const end = my + slope * mx;
  const changePct = start > 0 ? ((end - start) / start) * 100 : 0;
  let status = 'progress';
  if (changePct <= REGRESSION_PCT) status = 'regression';
  else if (changePct < minGainPct) status = 'stagnation';
  return { status, changePct, sessions: n };
}

/** "posledné 4 tréningy", "posledných 8 tréningov" */
export const lastSessions = (n) => (n <= 4 ? `posledné ${n} tréningy` : `posledných ${n} tréningov`);

export const TREND_LABEL = {
  progress: 'Progres',
  stagnation: 'Stagnácia',
  regression: 'Pokles',
  insufficient: 'Málo dát',
};

/** Začiatok obdobia (ms) alebo -Infinity pre celé obdobie. */
export function periodStart(periodId, now = Date.now()) {
  const p = PERIODS.find((x) => x.id === periodId);
  return p?.weeks ? now - p.weeks * WEEK : -Infinity;
}

/** Pondelok 0:00 (miestny čas) týždňa, do ktorého patrí ts. */
export function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * Týždenný objem (kg × opak. pri cvikoch váha × opakovania) od týždňa `from` po týždeň `to`, vrátane prázdnych.
 * workouts: [{ startedAt, sets }]
 */
export function weeklyVolume(workouts, typeOf, from, to = Date.now()) {
  if (!workouts.length) return [];
  const first = weekStart(Number.isFinite(from) ? from : Math.min(...workouts.map((w) => w.startedAt)));
  const last = weekStart(to);
  const weeks = [];
  // Krok po dňoch cez Date, aby týždne sedeli aj cez zmenu letného času.
  for (let t = first; t <= last; t = weekStart(t + WEEK + 2 * 3600000)) weeks.push({ t, volume: 0, workouts: 0 });
  const idx = new Map(weeks.map((w, i) => [w.t, i]));
  for (const w of workouts) {
    const i = idx.get(weekStart(w.startedAt));
    if (i === undefined) continue;
    weeks[i].volume += setsVolume(w.sets, typeOf);
    weeks[i].workouts++;
  }
  return weeks;
}

/** Sedenia cviku z tréningov: [{ workoutId, t, sets }] od najstaršieho. */
export function sessionsFromWorkouts(workouts, exerciseId) {
  return workouts
    .map((w) => ({ workoutId: w.id, t: w.startedAt, sets: w.sets.filter((s) => s.exerciseId === exerciseId) }))
    .filter((s) => s.sets.length)
    .sort((a, b) => a.t - b.t);
}

/**
 * Analytika jedného cviku: metrika, body grafu v období, % zmena v období, trend (vždy z posledných sedení).
 */
export function exerciseAnalytics(sessions, type, { from = -Infinity, stagnation = DEFAULT_STAGNATION } = {}) {
  const metric = metricFor(type, sessions);
  const all = seriesOf(sessions, metric);
  const points = all.filter((p) => p.t >= from);
  return {
    metric,
    all,
    points,
    change: pctChange(points),
    trend: trendOf(all, stagnation),
    current: all.length ? all[all.length - 1].value : null,
  };
}

/**
 * Analytika plánu.
 * workouts: dokončené tréningy plánu so sériami; exercises: Map id → cvik;
 * order: exerciseId v poradí plánu (cviky mimo plánu nasledujú za nimi).
 */
export function planAnalytics({ workouts, exercises, order = [], period = 'all', stagnation = DEFAULT_STAGNATION, now = Date.now() }) {
  const from = periodStart(period, now);
  const inPeriod = workouts.filter((w) => w.startedAt >= from);
  const typeOf = (id) => exercises.get(id)?.trackingType;

  const ids = new Set();
  for (const w of workouts) for (const s of w.sets) ids.add(s.exerciseId);
  const pos = (id) => { const i = order.indexOf(id); return i < 0 ? Infinity : i; };
  const rows = [...ids]
    .sort((a, b) => pos(a) - pos(b))
    .map((exerciseId) => {
      const type = typeOf(exerciseId) || 'weight_reps';
      const sessions = sessionsFromWorkouts(workouts, exerciseId);
      return { exerciseId, inPlan: order.includes(exerciseId), ...exerciseAnalytics(sessions, type, { from, stagnation }) };
    })
    .filter((r) => r.all.length);

  const changes = rows.map((r) => r.change).filter((c) => c !== null);
  const firstT = inPeriod.length ? Math.min(...inPeriod.map((w) => w.startedAt)) : null;
  const spanWeeks = firstT === null ? 0 : Math.max(1, Math.ceil((now - (Number.isFinite(from) ? from : firstT)) / WEEK));
  return {
    workoutCount: inPeriod.length,
    perWeek: inPeriod.length ? inPeriod.length / spanWeeks : 0,
    avgChange: changes.length ? changes.reduce((a, c) => a + c, 0) / changes.length : null,
    weeks: weeklyVolume(inPeriod, typeOf, from, now),
    rows,
    alerts: rows.filter((r) => r.inPlan && (r.trend.status === 'stagnation' || r.trend.status === 'regression')),
  };
}

/**
 * Osobné rekordy cviku zo všetkých sedení: [{ key, label, value, unit, t, workoutId, detail }].
 */
export function personalRecords(sessions, type) {
  const best = {};
  const consider = (key, value, s, set, extra = {}) => {
    if (value === null || value === undefined || !(value > 0)) return;
    if (!best[key] || value > best[key].value) best[key] = { value, t: s.t, workoutId: s.workoutId, set, ...extra };
  };
  for (const s of sessions) {
    for (const set of s.sets) {
      if (type === 'time') consider('time', set.durationSec, s, set);
      else {
        consider('e1rm', e1rm(set.weight, set.reps), s, set);
        consider('weight', set.weight, s, set);
        if (!(set.weight > 0)) consider('reps', set.reps, s, set);
      }
    }
    if (type === 'weight_reps') consider('volume', setsVolume(s.sets, () => 'weight_reps'), s, null);
  }
  const lbl = (set) => (set ? setLabel(set, type) : '');
  const out = [];
  const add = (key, label, unit, detail) => best[key] && out.push({ key, label, unit, ...best[key], detail: detail(best[key]) });
  if (type === 'time') {
    add('time', 'Najdlhšia séria', 's', (b) => lbl(b.set));
  } else if (type === 'bodyweight_reps') {
    add('reps', 'Max. opakovaní', 'opak.', () => 'bez záťaže');
    add('weight', 'Najväčšia záťaž', 'kg', (b) => lbl(b.set));
    add('e1rm', 'Odhad 1RM záťaže', 'kg', (b) => lbl(b.set));
  } else {
    add('e1rm', 'Odhad 1RM', 'kg', (b) => lbl(b.set));
    add('weight', 'Najvyššia váha', 'kg', (b) => lbl(b.set));
    add('volume', 'Objem v tréningu', 'kg', () => 'kg × opakovania');
  }
  return out;
}

/**
 * Nový rekord v tréningu: metrika sedenia je vyššia ako všetky predchádzajúce (aspoň jedno musí existovať).
 * @returns {null | { metric, value, previous }}
 */
export function sessionRecord(sessions, workoutId, type) {
  const i = sessions.findIndex((s) => s.workoutId === workoutId);
  if (i < 1) return null;
  const metric = metricFor(type, sessions.slice(0, i + 1));
  const cur = sessionValue(sessions[i].sets, metric);
  if (!cur) return null;
  const prev = seriesOf(sessions.slice(0, i), metric);
  if (!prev.length) return null;
  const previous = Math.max(...prev.map((p) => p.value));
  return cur.value > previous ? { metric, value: cur.value, previous } : null;
}

/** "+12,5 %", "−3 %", "0 %" */
export function formatPct(p) {
  if (p === null || p === undefined || !Number.isFinite(p)) return '–';
  const r = Math.abs(p) >= 10 ? Math.round(p) : Math.round(p * 10) / 10;
  if (r === 0) return '0 %';
  return `${r > 0 ? '+' : '−'}${formatNum(Math.abs(r))} %`;
}

/** Hodnota metriky s jednotkou: "92,5 kg", "14 opak.", "75 s" */
export const formatMetric = (value, metric) => (value === null || value === undefined ? '–' : `${formatNum(value)} ${metric.unit}`);
