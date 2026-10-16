import { tx, promisify, get } from './db.js';
import { EXERCISE_LIBRARY } from '../data/exercise-library.js';
import { uuid, compareSk } from '../util.js';

/**
 * Exercise {
 *   id, name, aliases[], muscleGroups[], equipment, trackingType,
 *   technique: [{id, text}], notes, builtIn,
 *   createdAt, updatedAt, deletedAt
 * }
 */

export function libraryItemToRecord(item, now = Date.now()) {
  return {
    id: item.id,
    name: item.name,
    aliases: item.aliases,
    muscleGroups: item.muscleGroups,
    equipment: item.equipment,
    trackingType: item.trackingType,
    technique: item.technique.map((text) => ({ id: uuid(), text })),
    notes: '',
    builtIn: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export async function listExercises({ includeDeleted = false } = {}) {
  const all = await tx('exercises', 'readonly', (s) => promisify(s.exercises.getAll()));
  return all
    .filter((e) => includeDeleted || !e.deletedAt)
    .sort((a, b) => compareSk(a.name, b.name));
}

export const getExercise = (id) => get('exercises', id);

export async function saveExercise(input) {
  const now = Date.now();
  const existing = input.id ? await getExercise(input.id) : null;
  const record = {
    aliases: [],
    muscleGroups: [],
    technique: [],
    notes: '',
    builtIn: false,
    deletedAt: null,
    ...existing,
    ...input,
    id: input.id || uuid(),
    name: input.name.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await tx('exercises', 'readwrite', (s) => promisify(s.exercises.put(record)));
  return record;
}

/** Koľko sérií a ktoré plány cvik používajú. */
export async function exerciseUsage(id) {
  return tx(['sets', 'plans'], 'readonly', async (s) => {
    const setCount = await promisify(s.sets.index('exerciseId').count(id));
    const plans = await promisify(s.plans.getAll());
    const planNames = plans
      .filter((p) => !p.deletedAt && p.days?.some((d) => d.exercises?.some((pe) => pe.exerciseId === id)))
      .map((p) => p.name);
    return { setCount, planNames };
  });
}

/**
 * Cviky z knižnice a cviky s históriou sa mažú mäkko (deletedAt),
 * aby história ostala čitateľná a obnova knižnice ich nevracala sama.
 * Nepoužitý vlastný cvik sa zmaže natrvalo.
 * @returns {'soft'|'hard'}
 */
export async function deleteExercise(id) {
  const ex = await getExercise(id);
  if (!ex) return 'hard';
  const usage = await exerciseUsage(id);
  if (ex.builtIn || usage.setCount > 0 || usage.planNames.length > 0) {
    const now = Date.now();
    await tx('exercises', 'readwrite', (s) =>
      promisify(s.exercises.put({ ...ex, deletedAt: now, updatedAt: now })));
    return 'soft';
  }
  await tx('exercises', 'readwrite', (s) => promisify(s.exercises.delete(id)));
  return 'hard';
}

export async function undeleteExercise(id) {
  const ex = await getExercise(id);
  if (!ex) return;
  await tx('exercises', 'readwrite', (s) =>
    promisify(s.exercises.put({ ...ex, deletedAt: null, updatedAt: Date.now() })));
}

/**
 * Doplní chýbajúce cviky z knižnice. S restoreDeleted vráti aj zmazané.
 * Používateľove úpravy existujúcich cvikov neprepisuje.
 */
export async function syncLibrary({ restoreDeleted = false } = {}) {
  return tx('exercises', 'readwrite', async (s) => {
    let added = 0;
    let restored = 0;
    const now = Date.now();
    for (const item of EXERCISE_LIBRARY) {
      const existing = await promisify(s.exercises.get(item.id));
      if (!existing) {
        await promisify(s.exercises.put(libraryItemToRecord(item, now)));
        added++;
      } else if (restoreDeleted && existing.deletedAt) {
        await promisify(s.exercises.put({ ...existing, deletedAt: null, updatedAt: now }));
        restored++;
      }
    }
    return { added, restored };
  });
}
