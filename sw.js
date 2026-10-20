// Service worker: precache všetkých súborov aplikácie, offline-first.
// Pri pridaní nového súboru ho dopíš do ASSETS a zvýš VERSION (a APP_VERSION v src/config.js).
const VERSION = '0.2.0';
const CACHE = `gymtracker-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/preact-htm-3.1.1.js',
  'src/styles.css',
  'src/main.js',
  'src/lib.js',
  'src/config.js',
  'src/router.js',
  'src/util.js',
  'src/db/db.js',
  'src/db/exercises.js',
  'src/db/seed.js',
  'src/data/exercise-library.js',
  'src/data/taxonomy.js',
  'src/ui/components.js',
  'src/ui/icons.js',
  'src/screens/App.js',
  'src/screens/PlansScreen.js',
  'src/screens/ExercisesScreen.js',
  'src/screens/ExerciseDetailScreen.js',
  'src/screens/ExerciseEditScreen.js',
  'src/screens/MoreScreen.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: okamžite z cache (offline), na pozadí stiahne novú verziu,
// ktorá sa prejaví pri ďalšom spustení. Navigácie dostanú index.html (hash router).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? 'index.html' : req;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(req.mode === 'navigate' ? 'index.html' : req)
      .then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      });
    if (cached) {
      event.waitUntil(network.catch(() => {}));
      return cached;
    }
    return network;
  })());
});
