import { tx, promisify } from './db.js';

/** Dokončené tréningy plánu so sériami (od najstaršieho). */
export async function planWorkouts(planId) {
  return tx(['workouts', 'sets'], 'readonly', async (s) => {
    const workouts = (await promisify(s.workouts.index('planId').getAll(planId))).filter((w) => w.status === 'done');
    const out = [];
    for (const w of workouts) {
      out.push({ ...w, sets: await promisify(s.sets.index('workoutId').getAll(w.id)) });
    }
    return out.sort((a, b) => a.startedAt - b.startedAt);
  });
}

/**
 * Sedenia cviku naprieč všetkými plánmi (iba dokončené tréningy), od najstaršieho:
 * [{ workoutId, t, planId, planName, dayName, sets }]
 */
export async function exerciseSessions(exerciseId) {
  return tx(['workouts', 'sets'], 'readonly', async (s) => {
    const sets = await promisify(s.sets.index('exerciseId').getAll(exerciseId));
    const byWorkout = new Map();
    for (const set of sets) {
      if (!byWorkout.has(set.workoutId)) byWorkout.set(set.workoutId, []);
      byWorkout.get(set.workoutId).push(set);
    }
    const out = [];
    for (const [workoutId, list] of byWorkout) {
      const w = await promisify(s.workouts.get(workoutId));
      if (!w || w.status !== 'done') continue;
      out.push({
        workoutId,
        t: w.startedAt,
        planId: w.planId,
        planName: w.planName,
        dayName: w.dayName,
        sets: list.sort((a, b) => a.setIndex - b.setIndex),
      });
    }
    return out.sort((a, b) => a.t - b.t);
  });
}

/** Odporúčania cviku (bez nahradených), najnovšie prvé. */
export async function exerciseRecommendations(exerciseId, planId = null) {
  const all = await tx('recommendations', 'readonly', (s) => promisify(s.recommendations.getAll()));
  return all
    .filter((r) => r.exerciseId === exerciseId && r.status !== 'superseded' && (!planId || r.planId === planId))
    .sort((a, b) => b.createdAt - a.createdAt);
}
