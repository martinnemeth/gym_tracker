import { getSetting, setSetting } from './db.js';
import { syncLibrary } from './exercises.js';
import { LIBRARY_VERSION } from '../config.js';

/** Pri prvom spustení (alebo novej verzii knižnice) doplní predvolené cviky. */
export async function ensureSeeded() {
  const current = await getSetting('libraryVersion', 0);
  if (current >= LIBRARY_VERSION) return;
  await syncLibrary();
  await setSetting('libraryVersion', LIBRARY_VERSION);
}
