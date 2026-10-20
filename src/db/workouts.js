import { tx, promisify, get, put } from './db.js';
import { DEFAULT_REST_SEC } from './plans.js';
import { uuid } from '../util.js';

/**
 * Workout {
 *   id, planId, dayId, planName, dayName,   // názvy sú snímka — história prežije úpravu aj zmazanie plánu
 *   status: 'active'|'done', startedAt, finishedAt,
 *   exercises: [WorkoutExercise]
 * }
 * WorkoutExercise {
 *   id, planExerciseId (null pri cviku pridanom počas tréningu), exerciseId,
 *   setCount,                                   // počet riadkov sérií na obrazovke
 *   target: { sets, repMin, repMax, durationSec, weight, restSec, updatedAt }   // snímka cieľa z plánu
 * }
 * Set {
 *   id, workoutId, workoutExerciseId, exerciseId, planExerciseId,
 *   setIndex, weight, reps, durationSec, performedAt
 * }
 * Ukladajú sa iba odcvičené (odškrtnuté) série. Prebiehať môže najviac jeden tréning.
 */

function workoutExerciseFromPlan(pe) {
  return {
    id: uuid(),
    planExerciseId: pe.id,
    exerciseId: pe.exerciseId,
    setCount: Math.max(1, pe.sets || 1),
    target: {
      sets: pe.sets,
      repMin: pe.repMin,
      repMax: pe.repMax,
      durationSec: pe.durationSec,
      weight: pe.weight,
      restSec: pe.restSec ?? DEFAULT_REST_SEC,
      updatedAt: pe.targetUpdatedAt ?? null,
    },
  };
}

/** Cvik pridaný počas tréningu (mimo plánu). */
export function newWorkoutExercise(exercise) {
  return {
    id: uuid(),
    planExerciseId: null,
    exerciseId: exercise.id,
    setCount: 3,
    target: { sets: null, repMin: null, repMax: null, durationSec: null, weight: null, restSec: DEFAULT_REST_SEC },
  };
}

export async function getActiveWorkout() {
  const list = await tx('workouts', 'readonly', (s) => promisify(s.workouts.index('status').getAll('active')));
  return list[0] || null;
}

/** Začne tréning podľa dňa plánu, alebo voľný tréning (bez plánu). */
export async function startWorkout(plan = null, dayId = null) {
  const day = plan?.days.find((d) => d.id === dayId) || null;
  const workout = {
    id: uuid(),
    planId: plan?.id ?? null,
    dayId: day?.id ?? null,
    planName: plan?.name ?? null,
    dayName: day?.name ?? 'Voľný tréning',
    status: 'active',
    startedAt: Date.now(),
    finishedAt: null,
    exercises: (day?.exercises || []).map(workoutExerciseFromPlan),
  };
  await tx('workouts', 'readwrite', async (s) => {
    const active = await promisify(s.workouts.index('status').count('active'));
    if (active > 0) throw new Error('Už prebieha iný tréning.');
    await promisify(s.workouts.put(workout));
  });
  return workout;
}

export const getWorkout = (id) => get('workouts', id);
export const saveWorkout = (workout) => put('workouts', workout);

export async function getWorkoutSets(workoutId) {
  const sets = await tx('sets', 'readonly', (s) => promisify(s.sets.index('workoutId').getAll(workoutId)));
  return sets.sort((a, b) => a.setIndex - b.setIndex);
}

export async function saveSet(set) {
  const record = { id: uuid(), ...set };
  await put('sets', record);
  return record;
}

export const deleteSet = (id) => tx('sets', 'readwrite', (s) => promisify(s.sets.delete(id)));

/** Zmaže série jedného cviku v tréningu (pri odstránení cviku z tréningu). */
export async function deleteWorkoutExerciseSets(workoutId, workoutExerciseId) {
  await tx('sets', 'readwrite', async (s) => {
    const sets = await promisify(s.sets.index('workoutId').getAll(workoutId));
    for (const set of sets) {
      if (set.workoutExerciseId === workoutExerciseId) await promisify(s.sets.delete(set.id));
    }
  });
}

export async function finishWorkout(id) {
  await tx('workouts', 'readwrite', async (s) => {
    const w = await promisify(s.workouts.get(id));
    if (w && w.status !== 'done') await promisify(s.workouts.put({ ...w, status: 'done', finishedAt: Date.now() }));
  });
}

/**
 * Zmaže tréning aj s jeho sériami (zahodenie prebiehajúceho alebo zmazanie z histórie)
 * a nevybavenými odporúčaniami, ktoré z neho vznikli.
 */
export async function deleteWorkout(id) {
  await tx(['workouts', 'sets', 'recommendations'], 'readwrite', async (s) => {
    const keys = await promisify(s.sets.index('workoutId').getAllKeys(id));
    for (const k of keys) await promisify(s.sets.delete(k));
    const recs = await promisify(s.recommendations.getAll());
    for (const r of recs) {
      if (r.workoutId === id && r.status === 'pending') await promisify(s.recommendations.delete(r.id));
    }
    await promisify(s.workouts.delete(id));
  });
}

/** Posledný dokončený tréning plánu (pre určenie dňa, ktorý je na rade). */
export async function lastFinishedWorkout(planId) {
  return tx('workouts', 'readonly', (s) => new Promise((resolve, reject) => {
    const range = IDBKeyRange.bound([planId, -Infinity], [planId, Infinity]);
    const req = s.workouts.index('planId_startedAt').openCursor(range, 'prev');
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(null);
      if (c.value.status === 'done') return resolve(c.value);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}

/** Deň plánu, ktorý je na rade: nasleduje po naposledy odcvičenom. */
export async function nextDayOf(plan) {
  if (!plan.days.length) return null;
  const last = await lastFinishedWorkout(plan.id);
  const idx = last ? plan.days.findIndex((d) => d.id === last.dayId) : -1;
  return plan.days[(idx + 1) % plan.days.length];
}

/**
 * Posledné výkony cviku zoskupené po tréningoch (najnovší prvý).
 * before: iba série pred týmto časom; exclude: ignorovaný tréning (práve prebiehajúci).
 * @returns {Promise<Array<{workoutId, performedAt, sets}>>}
 */
export async function recentPerformances(exerciseId, { before = Infinity, exclude = null, limit = 1 } = {}) {
  return tx('sets', 'readonly', (s) => new Promise((resolve, reject) => {
    const range = IDBKeyRange.bound([exerciseId, -Infinity], [exerciseId, before], false, true);
    const req = s.sets.index('exerciseId_performedAt').openCursor(range, 'prev');
    const groups = [];
    const finish = () => resolve(groups.map((g) => ({ ...g, sets: g.sets.sort((a, b) => a.setIndex - b.setIndex) })));
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return finish();
      const set = c.value;
      if (set.workoutId !== exclude) {
        let g = groups[groups.length - 1];
        if (!g || g.workoutId !== set.workoutId) {
          if (groups.length === limit) return finish();
          g = { workoutId: set.workoutId, performedAt: set.performedAt, sets: [] };
          groups.push(g);
        }
        g.sets.push(set);
      }
      c.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}

export async function lastPerformance(exerciseId, opts) {
  return (await recentPerformances(exerciseId, { ...opts, limit: 1 }))[0] || null;
}

/** Dokončené tréningy (najnovší prvý) so sériami. */
export async function listFinishedWorkouts() {
  return tx(['workouts', 'sets'], 'readonly', async (s) => {
    const workouts = await promisify(s.workouts.index('status').getAll('done'));
    const sets = await promisify(s.sets.getAll());
    const byWorkout = new Map();
    for (const set of sets) {
      if (!byWorkout.has(set.workoutId)) byWorkout.set(set.workoutId, []);
      byWorkout.get(set.workoutId).push(set);
    }
    return workouts
      .map((w) => ({ ...w, sets: byWorkout.get(w.id) || [] }))
      .sort((a, b) => b.startedAt - a.startedAt);
  });
}
