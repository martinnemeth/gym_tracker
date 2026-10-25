// Service worker: precache všetkých súborov aplikácie, offline-first.
// Pri pridaní nového súboru ho dopíš do ASSETS a zvýš VERSION (a APP_VERSION v src/config.js).
const VERSION = '0.9.1';
const CACHE = `gymtracker-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'assets/hero-weights.webp',
  'vendor/preact-htm-3.1.1.js',
  'src/styles.css',
  'src/main.js',
  'src/lib.js',
  'src/config.js',
  'src/router.js',
  'src/util.js',
  'src/format.js',
  'src/progression.js',
  'src/analytics.js',
  'src/aiExport.js',
  'src/db/db.js',
  'src/db/exercises.js',
  'src/db/seed.js',
  'src/db/plans.js',
  'src/db/workouts.js',
  'src/db/recommendations.js',
  'src/db/analytics.js',
  'src/db/backup.js',
  'src/data/exercise-library.js',
  'src/data/taxonomy.js',
  'src/ui/components.js',
  'src/ui/icons.js',
  'src/ui/ExercisePicker.js',
  'src/ui/RestTimer.js',
  'src/ui/SetTimer.js',
  'src/ui/Recommendations.js',
  'src/ui/charts.js',
  'src/ui/share.js',
  'src/screens/App.js',
  'src/screens/PlansScreen.js',
  'src/screens/PlanDetailScreen.js',
  'src/screens/PlanEditScreen.js',
  'src/screens/WorkoutScreen.js',
  'src/screens/HistoryScreen.js',
  'src/screens/AnalyticsScreen.js',
  'src/screens/ExercisesScreen.js',
  'src/screens/ExerciseDetailScreen.js',
  'src/screens/ExerciseEditScreen.js',
  'src/screens/MoreScreen.js',
  'src/screens/DataScreens.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload' — súbory vždy zo servera, nie z HTTP cache prehliadača (inak by nová verzia
    // mohla dostať staré súbory, GitHub Pages ich cachuje 10 min).
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: všetko z cache aktuálnej verzie (offline, konzistentná sada súborov).
// Novú verziu prinesie iba nový sw.js (iné VERSION): prehliadač ho overí pri spustení, nainštaluje
// celú sadu súborov do novej cache a pri ďalšom spustení beží nová verzia. Navigácie dostanú index.html.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? 'index.html' : req;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    return cached || fetch(req.mode === 'navigate' ? 'index.html' : req);
  })());
});
