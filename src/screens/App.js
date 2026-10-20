import { html, useState, useEffect } from '../lib.js';
import { useRoute, match } from '../router.js';
import { openDb } from '../db/db.js';
import { ensureSeeded } from '../db/seed.js';
import { BottomTabBar, Toast, Loading, ErrorBox } from '../ui/components.js';
import { PlansScreen } from './PlansScreen.js';
import { ExercisesScreen, DeletedExercisesScreen } from './ExercisesScreen.js';
import { ExerciseDetailScreen } from './ExerciseDetailScreen.js';
import { ExerciseEditScreen } from './ExerciseEditScreen.js';
import { MoreScreen } from './MoreScreen.js';

// Poradie je dôležité: špecifickejšie cesty skôr.
const ROUTES = [
  ['/plans', PlansScreen, true],
  ['/exercises', ExercisesScreen, true],
  ['/exercises/new', ExerciseEditScreen],
  ['/exercises/:id/edit', ExerciseEditScreen],
  ['/exercises/:id', ExerciseDetailScreen],
  ['/more', MoreScreen, true],
  ['/more/deleted-exercises', DeletedExercisesScreen],
];

function resolve(path) {
  for (const [pattern, Component, isRoot] of ROUTES) {
    const params = match(pattern, path);
    if (params) return { Component, params, isRoot: !!isRoot };
  }
  return { Component: PlansScreen, params: {}, isRoot: true };
}

export function App() {
  const path = useRoute();
  const [boot, setBoot] = useState({ ready: false, error: null });

  useEffect(() => {
    (async () => {
      await openDb();
      await ensureSeeded();
      // Požiadavka na trvalé úložisko (Safari/Chrome môžu inak dáta časom zmazať).
      if (navigator.storage?.persist) {
        navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {});
      }
    })().then(() => setBoot({ ready: true, error: null }), (error) => setBoot({ ready: false, error }));
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  if (boot.error) return html`<div class="screen"><${ErrorBox} error=${boot.error} /></div>`;
  if (!boot.ready) return html`<div class="screen"><${Loading} /></div>`;

  const { Component, params, isRoot } = resolve(path);
  return html`
    <div class=${`app ${isRoot ? 'with-tabbar' : ''}`}>
      <${Component} key=${path} params=${params} path=${path} />
      ${isRoot && html`<${BottomTabBar} path=${path} />`}
      <${Toast} />
    </div>`;
}
