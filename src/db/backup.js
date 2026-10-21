import { tx, promisify, getSetting, setSetting } from './db.js';
import { APP_VERSION, DB_VERSION } from '../config.js';

/**
 * Záloha = presná kópia databázy (všetky store-y s ID), na obnovu v tomto alebo inom zariadení.
 * Backup {
 *   app: 'gymtracker', format: 1, appVersion, dbVersion, exportedAt (ISO),
 *   stores: { exercises: [], plans: [], workouts: [], sets: [], recommendations: [], settings: [] }
 * }
 */

export const BACKUP_FORMAT = 1;
export const STORES = ['exercises', 'plans', 'workouts', 'sets', 'recommendations', 'settings'];
// Nastavenia, ktoré patria iba tomuto zariadeniu a do zálohy nejdú.
const LOCAL_SETTINGS = ['restTimer', 'lastBackupAt'];

const KEY = { settings: 'key' };
const keyOf = (store) => KEY[store] || 'id';

export async function createBackup() {
  const stores = await tx(STORES, 'readonly', async (s) => {
    const out = {};
    for (const name of STORES) out[name] = await promisify(s[name].getAll());
    return out;
  });
  stores.settings = stores.settings.filter((r) => !LOCAL_SETTINGS.includes(r.key));
  return {
    app: 'gymtracker',
    format: BACKUP_FORMAT,
    appVersion: APP_VERSION,
    dbVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
}

export const backupFileName = (date = new Date()) => `gymtracker-zaloha-${date.toISOString().slice(0, 10)}.json`;

export const markBackedUp = () => setSetting('lastBackupAt', Date.now());
export const lastBackupAt = () => getSetting('lastBackupAt', null);

/**
 * Skontroluje súbor zálohy. @returns {{ counts, exportedAt, appVersion }}
 * @throws Error so slovenským popisom, ak súbor nie je platná záloha
 */
export function validateBackup(data) {
  if (!data || typeof data !== 'object' || data.app !== 'gymtracker' || !data.stores) {
    throw new Error('Súbor nie je záloha GymTrackera.');
  }
  if (!(data.format <= BACKUP_FORMAT) || !(data.dbVersion <= DB_VERSION)) {
    throw new Error('Záloha je z novšej verzie aplikácie. Najprv aktualizuj aplikáciu.');
  }
  const counts = {};
  for (const name of STORES) {
    const list = data.stores[name] ?? [];
    if (!Array.isArray(list)) throw new Error(`Poškodená záloha: „${name}“ nie je zoznam.`);
    const key = keyOf(name);
    if (list.some((r) => !r || typeof r !== 'object' || (typeof r[key] !== 'string' && typeof r[key] !== 'number'))) {
      throw new Error(`Poškodená záloha: záznam v „${name}“ nemá ${key}.`);
    }
    counts[name] = list.length;
  }
  if (!counts.exercises) throw new Error('Záloha neobsahuje žiadne cviky.');
  return { counts, exportedAt: data.exportedAt, appVersion: data.appVersion };
}

/**
 * Obnova zo zálohy: nahradí všetky dáta v zariadení (v jednej transakcii — pri chybe sa nezmení nič).
 * Lokálne nastavenia zariadenia (čas poslednej zálohy) ostanú.
 */
export async function restoreBackup(data) {
  validateBackup(data);
  await tx(STORES, 'readwrite', async (s) => {
    const keep = [];
    for (const k of LOCAL_SETTINGS) {
      const row = await promisify(s.settings.get(k));
      if (row && k !== 'restTimer') keep.push(row);
    }
    for (const name of STORES) {
      await promisify(s[name].clear());
      const rows = name === 'settings'
        ? [...(data.stores.settings || []).filter((r) => !LOCAL_SETTINGS.includes(r.key)), ...keep]
        : data.stores[name] || [];
      for (const row of rows) await promisify(s[name].put(row));
    }
  });
}
