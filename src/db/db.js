import { DB_NAME, DB_VERSION } from '../config.js';

// Tenká promise vrstva nad IndexedDB.
// Schéma obsahuje už aj store-y pre ďalšie etapy (plány, tréningy, série, odporúčania).

let dbPromise = null;

function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    const exercises = db.createObjectStore('exercises', { keyPath: 'id' });
    exercises.createIndex('muscleGroups', 'muscleGroups', { multiEntry: true });

    const plans = db.createObjectStore('plans', { keyPath: 'id' });
    plans.createIndex('status', 'status');

    const workouts = db.createObjectStore('workouts', { keyPath: 'id' });
    workouts.createIndex('planId', 'planId');
    workouts.createIndex('status', 'status');
    workouts.createIndex('planId_startedAt', ['planId', 'startedAt']);

    const sets = db.createObjectStore('sets', { keyPath: 'id' });
    sets.createIndex('workoutId', 'workoutId');
    sets.createIndex('exerciseId', 'exerciseId');
    sets.createIndex('exerciseId_performedAt', ['exerciseId', 'performedAt']);

    const recs = db.createObjectStore('recommendations', { keyPath: 'id' });
    recs.createIndex('planId', 'planId');
    recs.createIndex('planExerciseId', 'planExerciseId');

    db.createObjectStore('settings', { keyPath: 'key' });
  }
}

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = (e) => upgrade(r.result, e.oldVersion);
      r.onsuccess = () => {
        const db = r.result;
        // Iná karta otvorila novšiu verziu DB — uvoľníme spojenie.
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('Databáza je blokovaná inou kartou aplikácie.'));
    });
  }
  return dbPromise;
}

export function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Spustí fn v jednej transakcii. fn dostane objekt {storeName: IDBObjectStore}.
 * Vo vnútri fn čakaj iba na IDB požiadavky (promisify), inak sa transakcia uzavrie.
 */
export async function tx(storeNames, mode, fn) {
  const db = await openDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const t = db.transaction(names, mode);
  const stores = Object.fromEntries(names.map((n) => [n, t.objectStore(n)]));
  const done = new Promise((resolve, reject) => {
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transakcia zrušená'));
  });
  let result;
  try {
    result = await fn(stores);
  } catch (err) {
    try { t.abort(); } catch { /* už ukončená */ }
    throw err;
  }
  await done;
  return result;
}

export const getAll = (store) => tx(store, 'readonly', (s) => promisify(s[store].getAll()));
export const get = (store, key) => tx(store, 'readonly', (s) => promisify(s[store].get(key)));
export const put = (store, value) => tx(store, 'readwrite', (s) => promisify(s[store].put(value)));
export const del = (store, key) => tx(store, 'readwrite', (s) => promisify(s[store].delete(key)));
export const countByIndex = (store, index, key) =>
  tx(store, 'readonly', (s) => promisify(s[store].index(index).count(key)));

export async function getSetting(key, fallback = undefined) {
  const row = await get('settings', key);
  return row ? row.value : fallback;
}

export const setSetting = (key, value) => put('settings', { key, value });
