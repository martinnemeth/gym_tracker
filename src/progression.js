// Pravidlá progresie (dvojitá progresia). Čisté funkcie bez DB — vstupom sú série jedného cviku v pláne.
//
// Váha × opakovania (aj vlastná váha so záťažou):
//   • všetky plánované série na hornej hranici rozsahu → pridaj váhu o krok, opakovania začnú znova zdola
//   • dva tréningy po sebe väčšina sérií pod spodnou hranicou → zníž váhu o ~10 % (deload)
//   • inak drž váhu a pridávaj opakovania (bez odporúčania)
// Vlastná váha bez záťaže: horná hranica vo všetkých sériách → rozsah opakovaní +2.
// Čas: všetky série aspoň na cieľovom čase → predĺž o krok (predvolene +5 s, od 60 s +10 s).

import { formatNum } from './format.js';

/** Predvolený krok váhy podľa vybavenia (kg). */
export const DEFAULT_INCREMENT = {
  barbell: 2.5,
  smith: 2.5,
  machine: 5,
  cable: 2.5,
  dumbbell: 2,
  kettlebell: 4,
  bodyweight: 2.5,
  band: 0,
  other: 2.5,
};

const DELOAD = 0.9;
const BODYWEIGHT_REP_STEP = 2;

export const timeStep = (sec) => (sec < 60 ? 5 : 10);

/** Krok progresie cviku v pláne: vlastný (pe.increment), inak podľa vybavenia. 0 = progresia vypnutá. */
export function incrementOf(pe, exercise) {
  if (pe.increment !== null && pe.increment !== undefined) return pe.increment;
  if (exercise?.trackingType === 'time') return timeStep(pe.durationSec || 0);
  return DEFAULT_INCREMENT[exercise?.equipment] ?? 2.5;
}

const round2 = (n) => Math.round(n * 100) / 100;
const minWeight = (sets) => Math.min(...sets.map((s) => s.weight || 0));

/** Sedenie, v ktorom väčšina sérií nedosiahla spodnú hranicu opakovaní. */
function failed(sets, repMin) {
  if (!sets.length) return false;
  return sets.filter((s) => s.reps < repMin).length * 2 > sets.length;
}

/**
 * @param target  cieľ z plánu { sets, repMin, repMax, durationSec, weight }
 * @param type    trackingType cviku
 * @param step    krok progresie (kg alebo s); 0 = bez odporúčaní
 * @param sets    série tohto tréningu
 * @param prevSets série predchádzajúceho tréningu toho istého cviku (pre deload)
 * @returns {null | { kind, from, to, reason }}  from/to: { weight, repMin, repMax, durationSec }
 */
export function evaluate({ target, type, step, sets, prevSets = [] }) {
  if (!target || !sets.length || !(step > 0)) return null;
  const planned = Math.max(1, target.sets || 1);
  const complete = sets.length >= planned;
  const base = { weight: target.weight ?? null, repMin: target.repMin, repMax: target.repMax, durationSec: target.durationSec };

  if (type === 'time') {
    const goal = target.durationSec;
    if (!goal || !complete || !sets.every((s) => s.durationSec >= goal)) return null;
    const next = goal + step;
    return {
      kind: 'increase_time',
      from: base,
      to: { ...base, durationSec: next },
      reason: `Všetky série aspoň ${goal} s.`,
    };
  }

  const { repMin, repMax } = target;
  if (!repMin || !repMax) return null;
  const w = minWeight(sets);
  const range = repMin === repMax ? `${repMax}` : `${repMin}–${repMax}`;

  if (complete && sets.every((s) => s.reps >= repMax)) {
    if (type === 'bodyweight_reps' && !(w > 0)) {
      return {
        kind: 'increase_reps',
        from: base,
        to: { ...base, repMin: repMin + BODYWEIGHT_REP_STEP, repMax: repMax + BODYWEIGHT_REP_STEP },
        reason: `Všetky série na hornej hranici (${repMax} opak.).`,
      };
    }
    return {
      kind: 'increase_weight',
      from: { ...base, weight: w },
      to: { ...base, weight: round2(w + step) },
      reason: `Všetky série na hornej hranici (${range} opak.).`,
    };
  }

  // Deload: dva tréningy po sebe pod spodnou hranicou pri rovnakej alebo vyššej váhe.
  if (w > 0 && failed(sets, repMin) && failed(prevSets, repMin) && minWeight(prevSets) >= w) {
    let next = round2(Math.round((w * DELOAD) / step) * step);
    if (next > w - step) next = round2(w - step);
    if (next <= 0) return null;
    return {
      kind: 'deload',
      from: { ...base, weight: w },
      to: { ...base, weight: next },
      reason: `Dva tréningy po sebe pod ${repMin} opak. S nižšou váhou sa progres rozbehne znova.`,
    };
  }
  return null;
}

/** Zmena cieľa ako text: "62,5 → 65 kg", "8–10 → 10–12 opak.", "45 → 50 s" */
export function changeLabel(rec, type) {
  const { from, to } = rec;
  if (rec.kind === 'increase_time') return `${from.durationSec} → ${to.durationSec} s`;
  if (rec.kind === 'increase_reps') {
    const r = (t) => (t.repMin === t.repMax ? `${t.repMax}` : `${t.repMin}–${t.repMax}`);
    return `${r(from)} → ${r(to)} opak.`;
  }
  const plus = type === 'bodyweight_reps' ? '+' : '';
  return `${plus}${formatNum(from.weight)} → ${plus}${formatNum(to.weight)} kg`;
}

export const KIND_LABEL = {
  increase_weight: 'Pridaj váhu',
  increase_reps: 'Pridaj opakovania',
  increase_time: 'Predĺž čas',
  deload: 'Uľahči',
};
