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
python3 tests/e2e_exercises.py     # knižnica cvikov, nastavenia
python3 tests/e2e_workouts.py      # plány, tréning, časovač, história
python3 tests/e2e_progression.py   # pravidlá progresie, odporúčania
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
  format.js                                čísla (desatinná čiarka), časy, popisy sérií a cieľov
  progression.js                           pravidlá progresie (čisté funkcie, bez DB)
  db/db.js                                 IndexedDB schéma + promise wrapper
  db/exercises.js                          CRUD cvikov, mäkké mazanie, sync knižnice
  db/seed.js                               naplnenie knižnice pri prvom spustení
  db/plans.js                              plány, dni, cviky v pláne, aktívny plán
  db/workouts.js                           tréningy, série, posledný výkon, deň na rade
  db/recommendations.js                    odporúčania: vyhodnotenie tréningu, prijatie / zamietnutie
  data/exercise-library.js                 predvolená knižnica (93 cvikov s technikou)
  data/taxonomy.js                         partie, vybavenie, typy sledovania
  ui/components.js                         spoločné UI komponenty (AppHeader, SettingsRow, ExerciseListItem…)
  ui/icons.js                              sada SVG ikon (UI + vybavenie)
  ui/ExercisePicker.js                     výber cvikov z knižnice (spodný panel)
  ui/RestTimer.js                          časovač odpočinku (lišta, zvuk, uložený stav)
  ui/Recommendations.js                    karta a položka odporúčania
  styles.css                               dizajnové tokeny (:root) a štýly — iba tmavý režim
  screens/                                 obrazovky
tests/                                     E2E testy (Python + headless Chrome)
design/                                    mockup a opis redizajnu (Performance Minimalism)
```

## Dátový model

| Store | Obsah |
|---|---|
| `exercises` | knižnica cvikov: partie, vybavenie, typ sledovania, checklist techniky, `builtIn`, `deletedAt` |
| `plans` | plány → dni → cviky (série, rozsah opakovaní / čas, váha, pauza, krok progresie); `status` = `active` má najviac jeden plán |
| `workouts` | tréningy (`active` / `done`) viazané na plán a deň; názov plánu a dňa aj cieľ cvikov sú uložené ako snímka |
| `sets` | odcvičené série; index `[exerciseId, performedAt]` pre „naposledy" a analytiku |
| `recommendations` | odporúčania progresie: cieľ pred a po, dôvod, stav `pending` / `accepted` / `dismissed` / `superseded` |
| `settings` | key/value nastavenia |

Mazanie cvikov:
- Cvik z predvolenej knižnice a cvik, ktorý má históriu alebo je v nejakom pláne, sa zmaže **mäkko**: dostane `deletedAt` a dá sa obnoviť.
- Vlastný nepoužitý cvik sa zmaže natrvalo.

Mazanie plánov: plán s odcvičenými tréningami sa zmaže mäkko (`deletedAt`), nepoužitý natrvalo. História tréningov ostáva vždy zachovaná.

Tréning:
- Prebiehať môže najviac jeden tréning; je uložený v DB, takže prežije zatvorenie aplikácie.
- Ukladajú sa iba odškrtnuté série. Prázdny riadok sa pri odškrtnutí vyplní z placeholdera (rovnaká séria minule → predchádzajúca séria teraz → cieľ z plánu).
- Deň „na rade" je ten, ktorý v pláne nasleduje po naposledy dokončenom.
- Ak sa cieľ cviku v pláne zmenil po poslednom výkone (ručne alebo prijatým odporúčaním), placeholder ponúkne nový cieľ namiesto „minule".
- Časovač odpočinku si pamätá čas konca (`settings.restTimer`), odpočet teda sedí aj po uspaní telefónu. Zvuk na konci zaznie, iba ak je aplikácia otvorená (iOS PWA nemá lokálne notifikácie).

Progresia (dvojitá progresia, `src/progression.js`):
- Po dokončení tréningu z plánu sa každý cvik vyhodnotí podľa sérií oproti cieľu z plánu:
  - **váha × opakovania**: všetky plánované série na hornej hranici rozsahu → váha + krok (opakovania začnú znova zdola);
  - **deload**: dva tréningy po sebe väčšina sérií pod spodnou hranicou pri rovnakej alebo vyššej váhe → váha −10 % (aspoň o krok);
  - **vlastná váha** bez záťaže: horná hranica vo všetkých sériách → rozsah opakovaní +2 (so záťažou ako váha × opakovania);
  - **čas**: všetky série aspoň na cieľovom čase → čas + krok;
  - inak drž cieľ a pridávaj opakovania (bez odporúčania).
- Krok sa nastavuje pri cviku v pláne. Prázdny = podľa vybavenia (veľká činka, multipress, kladka 2,5 kg; jednoručky 2 kg; stroj 5 kg; kettlebell 4 kg; čas 5 s, od 60 s 10 s), 0 = bez odporúčaní.
- Odporúčanie sa zobrazí v súhrne tréningu, v detaile plánu, na obrazovke Plány a v karte cviku počas ďalšieho tréningu. Prijatie zapíše nový cieľ do plánu.
- Na jeden cvik v pláne čaká najviac jedno odporúčanie; novší tréning, ručná zmena cieľa v pláne alebo zmazanie tréningu ho zruší. Úprava sérií v histórii odporúčanie prepočíta (iba pri najnovšom tréningu cviku).
- Voľný tréning a cviky pridané mimo plánu sa nevyhodnocujú.

## Etapy

- [x] **M1**: kostra, PWA a offline režim, DB, knižnica cvikov s technikou
- [x] **Redizajn** (Performance Minimalism): tokeny, tmavý vzhľad, nové komponenty
- [x] **M2**: plány, dni a cviky, aktívny tréning, posledný výkon, časovač odpočinku, história
- [x] **M3**: pravidlá progresie a odporúčania
- [ ] **M4**: analytika, grafy, stagnácia
- [ ] **M5**: záloha (export a import JSON), export pre AI
