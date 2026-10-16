# GymTracker

Offline PWA na sledovanie tréningu v posilňovni, určená pre iPhone. Dáta sa ukladajú do IndexedDB v zariadení.

Aplikácia nemá build krok: tvoria ju čisté ES moduly s Preactom a htm (vendorované vo `vendor/`). Na vývoj netreba Node.js.

## Spustenie lokálne

```sh
python3 -m http.server 8765
```

Potom otvor <http://127.0.0.1:8765/>. Na localhoste je service worker vypnutý, aby cache neskrývala zmeny. Offline režim sa dá otestovať cez <http://127.0.0.1:8765/?sw>.

## Testy

E2E testy ovládajú headless Google Chrome cez DevTools Protocol a potrebujú iba Python a Chrome:

```sh
python3 -m http.server 8765 &      # server musí bežať
python3 tests/e2e_exercises.py
```

## Nasadenie (GitHub Pages)

1. Vytvor na GitHube repozitár, napr. `gymtracker`, a pushni doň vetvu `main`.
2. V repozitári otvor **Settings → Pages → Build and deployment**, zvoľ **Deploy from a branch**, vetvu `main` a priečinok `/ (root)`.
3. Aplikácia bude na `https://<používateľ>.github.io/gymtracker/`.
4. Na iPhone ju otvor v **Safari**, potom **Zdieľať → Pridať na plochu**.

Pri vydaní novej verzie:
- Zvýš `VERSION` v `sw.js` a `APP_VERSION` v `src/config.js`.
- Každý nový súbor dopíš do `ASSETS` v `sw.js`, inak nebude dostupný offline.
- Aplikácia na telefóne si novú verziu stiahne na pozadí a použije ju pri ďalšom spustení.

## Štruktúra

```
index.html, manifest.webmanifest, sw.js   PWA vstup, manifest, service worker
vendor/                                    Preact + htm (bez build kroku)
src/
  config.js                                verzie aplikácie, DB a knižnice
  router.js                                hash router
  db/db.js                                 IndexedDB schéma + promise wrapper
  db/exercises.js                          CRUD cvikov, mäkké mazanie, sync knižnice
  db/seed.js                               naplnenie knižnice pri prvom spustení
  data/exercise-library.js                 predvolená knižnica (93 cvikov s technikou)
  data/taxonomy.js                         partie, vybavenie, typy sledovania
  ui/components.js                         spoločné UI komponenty
  screens/                                 obrazovky
tests/                                     E2E testy (Python + headless Chrome)
```

## Dátový model

| Store | Obsah |
|---|---|
| `exercises` | knižnica cvikov: partie, vybavenie, typ sledovania, checklist techniky, `builtIn`, `deletedAt` |
| `plans` | plány → dni → cviky (série, rozsah opakovaní, váha), pravidlá progresie *(M2)* |
| `workouts` | odcvičené tréningy viazané na plán a deň *(M2)* |
| `sets` | série; index `[exerciseId, performedAt]` pre „naposledy" a analytiku *(M2)* |
| `recommendations` | história odporúčaní z pravidiel *(M3)* |
| `settings` | key/value nastavenia |

Mazanie cvikov:
- Cvik z predvolenej knižnice a cvik, ktorý má históriu alebo je v nejakom pláne, sa zmaže **mäkko**: dostane `deletedAt` a dá sa obnoviť.
- Vlastný nepoužitý cvik sa zmaže natrvalo.

## Etapy

- [x] **M1**: kostra, PWA a offline režim, DB, knižnica cvikov s technikou
- [ ] **M2**: plány, dni a cviky, aktívny tréning, posledný výkon, časovač odpočinku, história
- [ ] **M3**: pravidlá progresie a odporúčania
- [ ] **M4**: analytika, grafy, stagnácia
- [ ] **M5**: záloha (export a import JSON), export pre AI
