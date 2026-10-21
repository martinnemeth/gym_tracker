// Export pre AI analýzu: čitateľné, denormalizované dáta (mená namiesto ID, ISO dátumy, série vnorené v tréningoch,
// ciele a pravidlá slovami, vypočítané metriky). Čisté funkcie bez DB.

import { MUSCLE_GROUPS, EQUIPMENT, TRACKING_TYPES } from './data/taxonomy.js';
import { targetLabel } from './format.js';
import { incrementOf, KIND_LABEL, changeLabel } from './progression.js';
import {
  DEFAULT_STAGNATION, TREND_LABEL, periodStart, lastSessions, sessionsFromWorkouts, exerciseAnalytics, personalRecords, e1rm,
} from './analytics.js';

export const DEFAULT_PROMPT = `Si skúsený tréner silového tréningu. Prikladám svoje tréningové dáta z aplikácie GymTracker (váhy v kg).
Analyzuj môj progres:
1. Ktoré cviky napredujú, ktoré stagnujú alebo klesajú a čo môže byť príčinou.
2. Objem a frekvenciu tréningu po svalových partiách — sú vyvážené?
3. Slabé miesta a riziká (preťaženie, nerovnováhy, príliš rýchle zvyšovanie váhy).
4. Konkrétne úpravy plánu na ďalšie 4 týždne (cviky, série, opakovania, váhy).
Odpovedaj po slovensky, stručne a v bodoch.`;

export const RULES_TEXT = 'Dvojitá progresia: keď všetky plánované série dosiahnu hornú hranicu rozsahu opakovaní, '
  + 'váha sa zvýši o krok a opakovania začnú znova zdola. Dva tréningy po sebe s väčšinou sérií pod spodnou hranicou '
  + '→ deload o ~10 %. Vlastná váha bez záťaže: rozsah opakovaní +2. Časové cviky: čas + krok.';

const pad = (n) => String(n).padStart(2, '0');
/** Miestny dátum "2026-10-14". */
export const isoDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** Miestny dátum a čas s posunom "2026-10-14T18:05:00+02:00". */
export function isoLocal(ts) {
  const d = new Date(ts);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${isoDate(ts)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    + `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

const r1 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

function setRow(s) {
  return clean({ weight_kg: s.weight ?? null, reps: s.reps ?? null, duration_s: s.durationSec ?? null, e1rm_kg: e1rm(s.weight, s.reps) });
}

/**
 * Vyberie tréningy podľa plánu (null = všetky vrátane voľných) a obdobia.
 * workouts: dokončené tréningy so sériami.
 */
export function scopeWorkouts(workouts, { planId = null, period = 'all', now = Date.now() } = {}) {
  const from = periodStart(period, now);
  const byPlan = workouts.filter((w) => !planId || w.planId === planId);
  return { byPlan, inPeriod: byPlan.filter((w) => w.startedAt >= from), from };
}

/**
 * @param plans        plány (bez zmazaných)
 * @param workouts     dokončené tréningy so sériami
 * @param exercises    Map id → cvik
 * @param recommendations všetky odporúčania
 */
export function buildAiExport({ plans, workouts, exercises, recommendations, planId = null, period = 'all', now = Date.now(), prompt = null }) {
  const { byPlan, inPeriod, from } = scopeWorkouts(workouts, { planId, period, now });
  const plan = planId ? plans.find((p) => p.id === planId) : null;
  const exName = (id) => exercises.get(id)?.name || 'Neznámy cvik';
  const typeOf = (id) => exercises.get(id)?.trackingType || 'weight_reps';
  const stagnation = { ...DEFAULT_STAGNATION, ...plan?.stagnation };
  const sorted = [...inPeriod].sort((a, b) => a.startedAt - b.startedAt);

  const planOut = (p) => {
    const st = { ...DEFAULT_STAGNATION, ...p.stagnation };
    return {
      name: p.name,
      active: p.status === 'active',
      progression_rules: RULES_TEXT,
      stagnation_alert: `Stagnácia: za ${lastSessions(st.sessions)} nárast menej ako ${st.minGainPct} %.`,
      days: p.days.map((d) => ({
        name: d.name,
        exercises: d.exercises.map((pe) => {
          const ex = exercises.get(pe.exerciseId);
          return clean({
            exercise: exName(pe.exerciseId),
            target: targetLabel(pe, ex?.trackingType),
            rest_s: pe.restSec ?? null,
            progression_step: incrementOf(pe, ex) || 'vypnutá',
          });
        }),
      })),
    };
  };

  const exerciseIds = [...new Set(byPlan.flatMap((w) => w.sets.map((s) => s.exerciseId)))];
  const exerciseStats = exerciseIds
    .map((id) => {
      const ex = exercises.get(id);
      const type = typeOf(id);
      const sessions = sessionsFromWorkouts(byPlan, id);
      const a = exerciseAnalytics(sessions, type, { from, stagnation });
      if (!a.points.length) return null;
      return clean({
        exercise: exName(id),
        muscle_groups: (ex?.muscleGroups || []).map((m) => MUSCLE_GROUPS[m] || m),
        equipment: EQUIPMENT[ex?.equipment] || ex?.equipment,
        tracking: TRACKING_TYPES[type]?.label,
        metric: `${a.metric.label} (${a.metric.unit})`,
        sessions_in_period: a.points.length,
        first_in_period: r1(a.points[0].value),
        latest: r1(a.current),
        change_in_period_pct: r1(a.change),
        trend: TREND_LABEL[a.trend.status],
        trend_last_sessions_pct: r1(a.trend.changePct),
        personal_records: personalRecords(sessions, type).map((pr) => `${pr.label}: ${r1(pr.value)} ${pr.unit} (${isoDate(pr.t)})`),
      });
    })
    .filter(Boolean)
    .sort((a, b) => a.exercise.localeCompare(b.exercise, 'sk'));

  const workoutsOut = sorted.map((w) => clean({
    date: isoDate(w.startedAt),
    started_at: isoLocal(w.startedAt),
    duration_min: w.finishedAt ? Math.round((w.finishedAt - w.startedAt) / 60000) : null,
    plan: w.planName || 'Voľný tréning',
    day: w.dayName,
    exercises: w.exercises
      .map((we) => {
        const sets = w.sets.filter((s) => s.workoutExerciseId === we.id).sort((a, b) => a.setIndex - b.setIndex);
        if (!sets.length) return null;
        return clean({
          exercise: exName(we.exerciseId),
          target: we.planExerciseId ? targetLabel(we.target, typeOf(we.exerciseId)) : 'mimo plánu',
          sets: sets.map(setRow),
        });
      })
      .filter(Boolean),
  }));

  const recsOut = recommendations
    .filter((r) => r.status !== 'superseded' && (!planId || r.planId === planId) && r.createdAt >= from)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({
      date: isoDate(r.createdAt),
      exercise: exName(r.exerciseId),
      type: KIND_LABEL[r.kind],
      change: changeLabel(r, typeOf(r.exerciseId)),
      reason: r.reason,
      status: { pending: 'čaká', accepted: 'prijaté', dismissed: 'zamietnuté' }[r.status] || r.status,
    }));

  return clean({
    prompt: prompt || null,
    source: 'GymTracker',
    generated_at: isoLocal(now),
    units: { weight: 'kg', duration: 's', e1rm: 'odhad 1RM podľa Epleyho: váha × (1 + opakovania / 30)' },
    scope: clean({
      plan: plan ? plan.name : 'Všetky tréningy',
      from: sorted.length ? isoDate(Number.isFinite(from) ? from : sorted[0].startedAt) : null,
      to: isoDate(now),
      workouts: sorted.length,
    }),
    plans: (plan ? [plan] : plans).map(planOut),
    exercise_stats: exerciseStats,
    workouts: workoutsOut,
    recommendations: recsOut,
  });
}

const CSV_COLUMNS = ['date', 'plan', 'day', 'exercise', 'muscle_group', 'equipment', 'set', 'weight_kg', 'reps', 'duration_s', 'e1rm_kg', 'target'];

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV: jeden riadok = jedna séria (desatinná bodka, oddeľovač čiarka). */
export function buildCsv({ workouts, exercises, planId = null, period = 'all', now = Date.now() }) {
  const { inPeriod } = scopeWorkouts(workouts, { planId, period, now });
  const rows = [CSV_COLUMNS.join(',')];
  for (const w of [...inPeriod].sort((a, b) => a.startedAt - b.startedAt)) {
    // Poradie ako v tréningu: cviky podľa karty, v rámci cviku podľa čísla série.
    const weById = new Map(w.exercises.map((we) => [we.id, we]));
    const pos = new Map(w.exercises.map((we, i) => [we.id, i]));
    const order = (s) => pos.get(s.workoutExerciseId) ?? Infinity;
    for (const s of [...w.sets].sort((a, b) => order(a) - order(b) || a.setIndex - b.setIndex)) {
      const ex = exercises.get(s.exerciseId);
      const we = weById.get(s.workoutExerciseId);
      rows.push([
        isoDate(w.startedAt), w.planName || 'Voľný tréning', w.dayName, ex?.name || 'Neznámy cvik',
        MUSCLE_GROUPS[ex?.muscleGroups?.[0]] || '', EQUIPMENT[ex?.equipment] || '',
        s.setIndex + 1, s.weight ?? '', s.reps ?? '', s.durationSec ?? '', e1rm(s.weight, s.reps) ?? '',
        we?.planExerciseId ? targetLabel(we.target, ex?.trackingType) : '',
      ].map(csvCell).join(','));
    }
  }
  return `${rows.join('\n')}\n`;
}
