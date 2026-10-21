import { tx, promisify, getAll } from './db.js';
import { getWorkout, getWorkoutSets, recentPerformances } from './workouts.js';
import { getPlan, findPlanExercise } from './plans.js';
import { listExercises } from './exercises.js';
import { evaluate, incrementOf, deloadWeight } from '../progression.js';
import { uuid } from '../util.js';

/**
 * Recommendation {
 *   id, planId, planExerciseId, exerciseId, workoutId,   // workoutId = null pri deloade zo stagnácie
 *   kind: 'increase_weight'|'increase_reps'|'increase_time'|'deload',
 *   from, to: { weight, repMin, repMax, durationSec },   // cieľ pred a po
 *   reason,
 *   status: 'pending'|'accepted'|'dismissed'|'superseded',
 *   createdAt, resolvedAt
 * }
 * Na jeden cvik v pláne čaká najviac jedno odporúčanie — novší tréning staršie čakajúce nahradí.
 */

/** Uložené ciele cviku v pláne, ktoré odporúčanie mení. */
export const TARGET_FIELDS = ['weight', 'repMin', 'repMax', 'durationSec'];

/**
 * Vyhodnotí dokončený tréning plánu a uloží odporúčania. Volá sa po dokončení
 * aj po úprave sérií v histórii — pre tréning nahradí svoje ešte nevybavené odporúčania.
 * Cvik preskočí, ak bol odvtedy odcvičený znova alebo sa jeho cieľ v pláne medzičasom zmenil.
 * @returns {Promise<Array<Recommendation>>} nové odporúčania
 */
export async function generateForWorkout(workoutId) {
  const workout = await getWorkout(workoutId);
  if (!workout || workout.status !== 'done' || !workout.planId) return [];
  const plan = await getPlan(workout.planId);
  if (!plan || plan.deletedAt) return [];
  const [sets, exercises] = await Promise.all([
    getWorkoutSets(workout.id),
    listExercises({ includeDeleted: true }).then((all) => new Map(all.map((e) => [e.id, e]))),
  ]);

  const results = []; // { pe, rec | null }
  for (const we of workout.exercises) {
    const pe = we.planExerciseId && findPlanExercise(plan, we.planExerciseId);
    if (!pe || (pe.targetUpdatedAt || 0) > workout.startedAt) continue;
    const newer = await recentPerformances(we.exerciseId, { before: Infinity, exclude: workout.id, limit: 1 });
    if (newer[0] && newer[0].performedAt > workout.startedAt) continue;
    const prev = (await recentPerformances(we.exerciseId, { before: workout.startedAt, exclude: workout.id, limit: 1 }))[0];
    const exercise = exercises.get(we.exerciseId);
    const rec = evaluate({
      target: we.target,
      type: exercise?.trackingType || 'weight_reps',
      step: incrementOf(pe, exercise),
      sets: sets.filter((s) => s.workoutExerciseId === we.id),
      prevSets: (prev?.sets || []).filter((s) => !s.planExerciseId || s.planExerciseId === pe.id),
    });
    results.push({ pe, we, rec });
  }

  const now = Date.now();
  return tx('recommendations', 'readwrite', async (s) => {
    const created = [];
    for (const { pe, we, rec } of results) {
      const existing = await promisify(s.recommendations.index('planExerciseId').getAll(pe.id));
      if (existing.some((r) => r.workoutId === workout.id && r.status !== 'pending' && r.status !== 'superseded')) continue;
      for (const r of existing) {
        if (r.workoutId === workout.id) await promisify(s.recommendations.delete(r.id));
        else if (r.status === 'pending') await promisify(s.recommendations.put({ ...r, status: 'superseded', resolvedAt: now }));
      }
      if (!rec) continue;
      const record = {
        id: uuid(),
        planId: plan.id,
        planExerciseId: pe.id,
        exerciseId: we.exerciseId,
        workoutId: workout.id,
        ...rec,
        status: 'pending',
        createdAt: now,
        resolvedAt: null,
      };
      await promisify(s.recommendations.put(record));
      created.push(record);
    }
    return created;
  });
}

export async function listPending(planId) {
  const list = await tx('recommendations', 'readonly', (s) => promisify(s.recommendations.index('planId').getAll(planId)));
  return list.filter((r) => r.status === 'pending');
}

export async function listForWorkout(workoutId) {
  return (await getAll('recommendations')).filter((r) => r.workoutId === workoutId && r.status !== 'superseded');
}

/**
 * Prijme odporúčanie: zapíše nový cieľ do cviku v pláne.
 * Ak cvik v pláne už neexistuje, odporúčanie sa zahodí. @returns {Promise<PlanExercise|null>}
 */
export async function acceptRecommendation(id) {
  return tx(['plans', 'recommendations'], 'readwrite', async (s) => {
    const rec = await promisify(s.recommendations.get(id));
    if (!rec || rec.status !== 'pending') return null;
    const now = Date.now();
    const plan = await promisify(s.plans.get(rec.planId));
    const pe = plan && !plan.deletedAt ? findPlanExercise(plan, rec.planExerciseId) : null;
    if (!pe) {
      await promisify(s.recommendations.put({ ...rec, status: 'superseded', resolvedAt: now }));
      return null;
    }
    const next = { ...pe, targetUpdatedAt: now };
    for (const k of TARGET_FIELDS) if (rec.to[k] !== undefined) next[k] = rec.to[k];
    const days = plan.days.map((d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === pe.id ? next : x)) }));
    await promisify(s.plans.put({ ...plan, days, updatedAt: now }));
    await promisify(s.recommendations.put({ ...rec, status: 'accepted', resolvedAt: now }));
    return next;
  });
}

export async function dismissRecommendation(id) {
  await tx('recommendations', 'readwrite', async (s) => {
    const rec = await promisify(s.recommendations.get(id));
    if (rec?.status === 'pending') await promisify(s.recommendations.put({ ...rec, status: 'dismissed', resolvedAt: Date.now() }));
  });
}

/** Ručná zmena cieľa v pláne preváži čakajúce odporúčania týchto cvikov. */
export async function supersedePending(planExerciseIds) {
  if (!planExerciseIds.length) return;
  await tx('recommendations', 'readwrite', async (s) => {
    for (const peId of planExerciseIds) {
      const list = await promisify(s.recommendations.index('planExerciseId').getAll(peId));
      for (const r of list) {
        if (r.status === 'pending') await promisify(s.recommendations.put({ ...r, status: 'superseded', resolvedAt: Date.now() }));
      }
    }
  });
}

/**
 * Deload pri stagnácii (z analytiky plánu): čakajúce odporúčanie znížiť cieľovú váhu o ~10 %.
 * Nahradí iné čakajúce odporúčanie cviku. @returns {Promise<Recommendation|null>} null, ak cvik nemá váhu
 */
export async function createDeloadRecommendation(planId, planExerciseId, reason) {
  const plan = await getPlan(planId);
  const pe = plan && !plan.deletedAt ? findPlanExercise(plan, planExerciseId) : null;
  if (!pe || !(pe.weight > 0)) return null;
  const exercise = (await listExercises({ includeDeleted: true })).find((e) => e.id === pe.exerciseId);
  if (exercise?.trackingType === 'time') return null;
  const step = incrementOf(pe, exercise) || 2.5;
  const to = deloadWeight(pe.weight, step);
  if (to === null) return null;
  const base = { weight: pe.weight, repMin: pe.repMin, repMax: pe.repMax, durationSec: pe.durationSec };
  const now = Date.now();
  const record = {
    id: uuid(),
    planId,
    planExerciseId: pe.id,
    exerciseId: pe.exerciseId,
    workoutId: null,
    kind: 'deload',
    from: base,
    to: { ...base, weight: to },
    reason,
    status: 'pending',
    createdAt: now,
    resolvedAt: null,
  };
  await tx('recommendations', 'readwrite', async (s) => {
    const existing = await promisify(s.recommendations.index('planExerciseId').getAll(pe.id));
    for (const r of existing) {
      if (r.status === 'pending') await promisify(s.recommendations.put({ ...r, status: 'superseded', resolvedAt: now }));
    }
    await promisify(s.recommendations.put(record));
  });
  return record;
}
