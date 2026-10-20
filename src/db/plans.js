import { tx, promisify, get } from './db.js';
import { uuid } from '../util.js';

/**
 * Plan {
 *   id, name, status: 'active'|'inactive', notes,
 *   days: [{ id, name, exercises: [PlanExercise] }],
 *   createdAt, updatedAt, deletedAt
 * }
 * PlanExercise {
 *   id, exerciseId, sets, repMin, repMax, durationSec, weight, restSec,
 *   increment,         // krok progresie (kg / s); null = podľa vybavenia, 0 = bez odporúčaní
 *   targetUpdatedAt,   // kedy sa naposledy zmenil cieľ (váha, opakovania, čas) — ručne alebo odporúčaním
 * }
 *
 * ID dní a cvikov v pláne sú stabilné — viažu sa na ne tréningy a (M3) odporúčania.
 * Aktívny je najviac jeden plán.
 */

export const DEFAULT_REST_SEC = 90;

export function newDay(name) {
  return { id: uuid(), name, exercises: [] };
}

export function newPlanExercise(exercise) {
  const time = exercise.trackingType === 'time';
  return {
    id: uuid(),
    exerciseId: exercise.id,
    sets: 3,
    repMin: time ? null : 8,
    repMax: time ? null : 12,
    durationSec: time ? 60 : null,
    weight: null,
    restSec: DEFAULT_REST_SEC,
    increment: null,
    targetUpdatedAt: null,
  };
}

export function findPlanExercise(plan, planExerciseId) {
  for (const d of plan.days) {
    const pe = d.exercises.find((x) => x.id === planExerciseId);
    if (pe) return pe;
  }
  return null;
}

/** Názov ďalšieho dňa: Deň A, Deň B, … */
export function defaultDayName(index) {
  return `Deň ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`;
}

export async function listPlans() {
  const all = await tx('plans', 'readonly', (s) => promisify(s.plans.getAll()));
  return all
    .filter((p) => !p.deletedAt)
    .sort((a, b) => (b.status === 'active') - (a.status === 'active') || b.updatedAt - a.updatedAt);
}

export const getPlan = (id) => get('plans', id);

/** Nový plán sa stane aktívnym, ak žiadny aktívny nie je. */
export async function savePlan(input) {
  const now = Date.now();
  return tx('plans', 'readwrite', async (s) => {
    const existing = input.id ? await promisify(s.plans.get(input.id)) : null;
    let status = existing?.status;
    if (!status) {
      const all = await promisify(s.plans.getAll());
      status = all.some((p) => !p.deletedAt && p.status === 'active') ? 'inactive' : 'active';
    }
    const record = {
      notes: '',
      days: [],
      deletedAt: null,
      ...existing,
      ...input,
      id: input.id || uuid(),
      name: input.name.trim(),
      status,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await promisify(s.plans.put(record));
    return record;
  });
}

export async function setActivePlan(id) {
  await tx('plans', 'readwrite', async (s) => {
    const all = await promisify(s.plans.getAll());
    for (const p of all) {
      const status = p.id === id ? 'active' : 'inactive';
      if (p.status !== status) await promisify(s.plans.put({ ...p, status }));
    }
  });
}

/**
 * Plán s odcvičenými tréningami sa zmaže mäkko (tréningy naň odkazujú),
 * nepoužitý natrvalo. @returns {'soft'|'hard'}
 */
export async function deletePlan(id) {
  return tx(['plans', 'workouts'], 'readwrite', async (s) => {
    const plan = await promisify(s.plans.get(id));
    if (!plan) return 'hard';
    const used = await promisify(s.workouts.index('planId').count(id));
    if (used > 0) {
      const now = Date.now();
      await promisify(s.plans.put({ ...plan, status: 'inactive', deletedAt: now, updatedAt: now }));
      return 'soft';
    }
    await promisify(s.plans.delete(id));
    return 'hard';
  });
}
