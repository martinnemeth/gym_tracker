"""E2E test M3: pravidlá progresie a odporúčania.

Spustenie (z koreňa projektu, v druhom termináli beží `python3 -m http.server 8765`):
    python3 tests/e2e_progression.py
"""
import sys, time, json, tempfile
from cdp import Browser

T = tempfile.mkdtemp(prefix='gymtracker-e2e-m3-')
BASE = 'http://127.0.0.1:8765/'
b = Browser(f'{T}/profile', port=9335)
ok = 0


def check(cond, label):
    global ok
    if not cond:
        print('FAIL:', label); print('\n'.join(b.console)); b.close(); sys.exit(1)
    ok += 1; print('ok  ', label)


J = json.dumps
def texts(sel): return b.eval(f"[...document.querySelectorAll({J(sel)})].map(e=>e.textContent.trim())")
def click_text(sel, text):
    return b.eval(f"""(()=>{{const el=[...document.querySelectorAll({J(sel)})].find(e=>e.textContent.trim().includes({J(text)}));
      if(!el) return false; el.click(); return true}})()""")
def click(sel, idx=0): return b.eval(f"(()=>{{const el=document.querySelectorAll({J(sel)})[{idx}]; if(!el) return false; el.click(); return true}})()")
def exists(sel): return b.eval(f"!!document.querySelector({J(sel)})")
def count(sel): return b.eval(f"document.querySelectorAll({J(sel)}).length")
def type_into(sel, value, idx=0):
    b.eval(f"""(()=>{{const el=document.querySelectorAll({J(sel)})[{idx}]; el.value={J(value)};
      el.dispatchEvent(new Event('input',{{bubbles:true}}))}})()""")
def settle(t=0.4): time.sleep(t)
def hash_(): return b.eval("location.hash")
def confirm(answer): b.eval(f"window.confirm = () => {J(answer)}")
def mod(path, expr): return b.eval(f"import('./src/{path}').then(m=>{expr})")
def rec_text(sel='.rec'): return [' | '.join(x) for x in b.eval(
    f"[...document.querySelectorAll({J(sel)})].map(r=>[...r.querySelectorAll('.rec-ex,.rec-kind,.rec-change,.rec-status')].map(e=>e.textContent.trim()))")]

ROW = "document.querySelectorAll('.we-card')[{c}].querySelectorAll('.set-row')[{r}]"
def row_ph(c, r, field): return b.eval(f"{ROW.format(c=c, r=r)}.querySelector('[data-field={field}]').placeholder")
def row_type(c, r, field, value):
    b.eval(f"""(()=>{{const el={ROW.format(c=c, r=r)}.querySelector('[data-field={field}]'); el.focus(); el.value={J(value)};
      el.dispatchEvent(new Event('input',{{bubbles:true}}))}})()""")
def row_blur(c, r, field):
    b.eval(f"{ROW.format(c=c, r=r)}.querySelector('[data-field={field}]').dispatchEvent(new Event('blur'))")
def row_check(c, r): b.eval(f"{ROW.format(c=c, r=r)}.querySelector('.set-check').click()"); settle(0.25)
def log(c, values, field='reps'):
    for r, v in enumerate(values):
        if v is not None: row_type(c, r, field, v)
        row_check(c, r)

def recs_db(): return mod('db/recommendations.js', "import('./src/db/db.js').then(d=>d.getAll('recommendations'))")
def plan_pe(plan_id, i): return mod('db/plans.js', f"m.getPlan('{plan_id}')")['days'][0]['exercises'][i]

def finish():
    confirm(True)
    click('.btn-sm'); settle(0.9)
    b.wait_for("document.querySelector('.summary-stats')")

def start_next():
    b.goto(BASE + '#/plans', 1); b.wait_for("document.querySelector('.plan-card')")
    click('.plan-card .btn-primary'); settle(0.8)
    b.wait_for("document.querySelector('.we-card')")
    return hash_().split('/')[2]


try:
    b.goto(BASE + '#/plans', 1.5)
    b.wait_for("document.querySelector('.home-list')")

    # ── Pravidlá (čisté funkcie) ──
    E = "import('./src/progression.js').then(m=>m.evaluate({e}))"
    def ev(target, sets, type='weight_reps', step=2.5, prev=None):
        arg = J({'target': target, 'type': type, 'step': step, 'sets': sets, 'prevSets': prev or []})
        return b.eval(E.format(e=arg))
    t = {'sets': 3, 'repMin': 8, 'repMax': 10, 'weight': 60}
    s = lambda w, *reps: [{'weight': w, 'reps': r} for r in reps]
    r = ev(t, s(60, 10, 10, 10))
    check(r['kind'] == 'increase_weight' and r['to']['weight'] == 62.5 and r['to']['repMin'] == 8, 'horná hranica vo všetkých sériách → +krok')
    check(ev(t, s(60, 10, 10, 9)) is None, 'jedna séria pod hornou hranicou → drž váhu')
    check(ev(t, s(60, 10, 10)) is None, 'menej sérií ako v pláne → bez odporúčania')
    check(ev(t, s(60, 10, 10, 10), step=0) is None, 'krok 0 → progresia vypnutá')
    check(ev(t, s(60, 10, 12, 11))['from']['weight'] == 60, 'zvyšuje sa od skutočne použitej váhy')
    check(ev({**t, 'weight': None}, s(40, 10, 10, 10))['to']['weight'] == 42.5, 'funguje aj bez váhy v pláne')
    r = ev(t, s(60, 7, 6, 8), prev=s(60, 7, 7, 7))
    check(r['kind'] == 'deload' and r['to']['weight'] == 55, f'2× pod spodnou hranicou → deload ~10 % ({r and r["to"]["weight"]})')
    check(ev(t, s(60, 7, 6, 8), prev=s(60, 9, 8, 8)) is None, 'jeden slabší tréning → bez deloadu')
    check(ev(t, s(60, 7, 6, 8), prev=s(57.5, 7, 7, 7)) is None, 'deload iba pri rovnakej alebo vyššej váhe minule')
    check(ev(t, s(10, 7, 6, 6), step=5, prev=s(10, 6, 6, 6))['to']['weight'] == 5, 'deload aspoň o jeden krok')
    bw = {'sets': 2, 'repMin': 10, 'repMax': 12, 'weight': None}
    r = ev(bw, s(None, 12, 13), type='bodyweight_reps')
    check(r['kind'] == 'increase_reps' and (r['to']['repMin'], r['to']['repMax']) == (12, 14), 'vlastná váha → rozsah opakovaní +2')
    check(ev(bw, s(10, 12, 12), type='bodyweight_reps')['to']['weight'] == 12.5, 'vlastná váha so záťažou → +kg')
    r = ev({'sets': 2, 'durationSec': 45}, [{'durationSec': 45}, {'durationSec': 50}], type='time', step=5)
    check(r['kind'] == 'increase_time' and r['to']['durationSec'] == 50, 'čas → +krok sekúnd')
    inc = "import('./src/progression.js').then(m=>[m.incrementOf({{}},{{equipment:'dumbbell'}}),m.incrementOf({{increment:1}},{{equipment:'machine'}}),m.incrementOf({{durationSec:60}},{{trackingType:'time'}})])"
    check(b.eval(inc.format()) == [2, 1, 10], 'krok: podľa vybavenia, vlastný, čas od 60 s')
    lbl = "import('./src/progression.js').then(m=>m.changeLabel({kind:'increase_weight',from:{weight:62.5},to:{weight:65}},'weight_reps'))"
    check(b.eval(lbl) == '62,5 → 65 kg', 'text zmeny s desatinnou čiarkou')

    # ── Plán: tlak 2×8–10 @ 60 kg, kliky 2×10–12, plank 2×30 s ──
    plan = b.eval("""Promise.all([import('./src/db/plans.js'), import('./src/db/exercises.js')]).then(async ([p, e]) => {
      const pe = async (id, f) => ({ ...p.newPlanExercise(await e.getExercise(id)), sets: 2, ...f });
      const day = { ...p.newDay('Full'), exercises: [
        await pe('lib-bench-press', { repMin: 8, repMax: 10, weight: 60 }),
        await pe('lib-push-up', { repMin: 10, repMax: 12 }),
        await pe('lib-plank', { durationSec: 30 }),
      ] };
      return p.savePlan({ name: 'Progres', days: [day] });
    })""")
    plan_id = plan['id']
    pe_ids = [x['id'] for x in plan['days'][0]['exercises']]
    b.call('Page.reload'); settle(1.2)

    # 1. tréning: všetko na hornej hranici
    w1 = start_next()
    log(0, ['10', '10']); log(1, ['12', '12']); log(2, ['30', '30'], 'durationSec')
    click('.rest-btn.skip')
    finish()
    check(hash_() == f'#/history/{w1}', 'dokončenie → súhrn')
    check(rec_text() == ['Tlak na rovnej lavičke | 60 → 62,5 kg', 'Kliky | 10–12 → 12–14 opak.',
                         'Plank | 30 → 35 s'], f'súhrn: 3 odporúčania {rec_text()}')
    check(exists('.section-caption-row .text-btn'), 'súhrn: Prijať všetky')
    b.screenshot(f'{T}/01_summary_recs.png')

    b.eval("document.querySelectorAll('.rec')[0].querySelector('.rec-btn.accept').click()"); settle(0.6)
    b.eval("document.querySelectorAll('.rec')[1].querySelector('.rec-btn.dismiss').click()"); settle(0.6)
    check(rec_text()[:2] == ['Tlak na rovnej lavičke | 60 → 62,5 kg | Prijaté',
                             'Kliky | 10–12 → 12–14 opak. | Zamietnuté'], f'stav po prijatí / zamietnutí {rec_text()}')
    bench = plan_pe(plan_id, 0)
    check(bench['weight'] == 62.5 and bench['repMin'] == 8 and bench['targetUpdatedAt'], 'prijaté → nová váha v pláne')
    check(plan_pe(plan_id, 1)['repMin'] == 10, 'zamietnuté → plán bez zmeny')
    b.screenshot(f'{T}/02_summary_resolved.png')

    # Plány a detail plánu
    b.goto(BASE + '#/plans', 1); b.wait_for("document.querySelector('.plan-card')")
    check(click_text('.badge', '1 odporúčanie'), 'Domov: štítok s čakajúcimi odporúčaniami'); settle(0.8)
    check(hash_() == f'#/plans/{plan_id}' and rec_text() == ['Plank | 30 → 35 s'], 'detail plánu: čakajúce odporúčanie')
    check(texts('.pe-line-target')[0] == '2 × 8–10 · 62,5 kg', 'detail plánu: nový cieľ')
    b.screenshot(f'{T}/03_plan_recs.png')

    # 2. tréning: placeholder z nového cieľa, odporúčanie v karte cviku
    w2 = start_next()
    check(row_ph(0, 0, 'weight') == '62,5' and row_ph(0, 0, 'reps') == '8–10', 'nový cieľ má prednosť pred „Minule“')
    check(texts('.we-card:nth-of-type(1) .set-prev')[0] == '60 × 10', 'stĺpec Minule ostáva')
    check(row_ph(1, 0, 'reps') == '12', 'cvik bez zmeny cieľa: predvyplnenie z minula')
    check(count('.we-card .rec.compact') == 1 and b.eval("!!document.querySelectorAll('.we-card')[2].querySelector('.rec')"),
          'odporúčanie v karte cviku počas tréningu')
    b.screenshot(f'{T}/04_workout_rec.png')
    b.eval("document.querySelectorAll('.we-card')[2].querySelector('.rec-btn.accept').click()"); settle(0.7)
    check(not exists('.rec') and texts('.we-target')[2].startswith('2 × 35 s') and row_ph(2, 0, 'durationSec') == '35',
          f'Použiť → cieľ tréningu aj placeholder sa zmenia ({texts(".we-target")[2]})')
    check(plan_pe(plan_id, 2)['durationSec'] == 35, 'Použiť → plán upravený')
    w2doc = mod('db/workouts.js', f"m.getWorkout('{w2}')")
    check(w2doc['exercises'][2]['target']['durationSec'] == 35, 'zmena cieľa uložená v tréningu')

    log(0, ['7', '7'])
    log(1, ['12', '11'])
    click('.rest-btn.skip')
    finish()
    bench_sets = [(x['weight'], x['reps']) for x in mod('db/workouts.js', f"m.getWorkoutSets('{w2}')") if x['exerciseId'] == 'lib-bench-press']
    check(bench_sets == [(62.5, 7), (62.5, 7)], f'2. tréning: tlak 62,5 × 7, 7 {bench_sets}')
    check(not exists('.rec'), 'pod hornou hranicou a plank nezapísaný → žiadne odporúčanie')
    pending_pushups = [r for r in recs_db() if r['planExerciseId'] == pe_ids[1]]
    check([r['status'] for r in pending_pushups] == ['dismissed'], 'zamietnuté odporúčanie ostáva v histórii')

    # 3. tréning: znova pod spodnou hranicou → deload
    w3 = start_next()
    log(0, ['6', '7'])
    click('.rest-btn.skip')
    finish()
    check(rec_text() == ['Tlak na rovnej lavičke | 62,5 → 57,5 kg'], f'deload po dvoch slabých tréningoch {rec_text()}')
    check(exists('.rec.down'), 'deload má odlišný vzhľad')
    b.screenshot(f'{T}/05_deload.png')

    # Úprava sérií v histórii → odporúčanie sa prepočíta
    b.goto(BASE + f'#/workout/{w3}', 1); b.wait_for("document.querySelector('.we-card')")
    for r in (0, 1):
        row_type(0, r, 'reps', '10'); row_blur(0, r, 'reps'); settle(0.3)
    click_text('.text-btn', 'Hotovo'); settle(0.9)
    b.wait_for("document.querySelector('.summary-stats')")
    check(rec_text() == ['Tlak na rovnej lavičke | 62,5 → 65 kg'], f'po úprave histórie sa odporúčanie prepočíta {rec_text()}')
    bench_recs = [r for r in recs_db() if r['planExerciseId'] == pe_ids[0]]
    check(sorted(r['status'] for r in bench_recs) == ['accepted', 'pending'], 'staré odporúčanie tréningu nahradené, nie zdvojené')

    # Staršie tréningy odporúčania neprepisujú
    mod('db/recommendations.js', f"m.generateForWorkout('{w1}')")
    check(len([r for r in recs_db() if r['status'] == 'pending']) == 1, 'prepočet staršieho tréningu nič nezmení')

    # Ručná zmena cieľa v pláne zruší čakajúce odporúčanie
    b.goto(BASE + f'#/plans/{plan_id}/edit', 1); b.wait_for("document.querySelector('.pe-edit')")
    check(b.eval("document.querySelectorAll('.pe-edit')[0].querySelectorAll('input')[5].placeholder") == '2,5'
          and b.eval("document.querySelectorAll('.pe-edit')[2].querySelectorAll('input')[4].placeholder") == '5',
          'editor: predvolený krok v placeholderi (kg / s)')
    type_into('.pe-edit input', '61', 3)
    b.eval("""(()=>{const el=document.querySelectorAll('.pe-edit')[1].querySelectorAll('input')[5]; el.value='0';
      el.dispatchEvent(new Event('input',{bubbles:true}))})()""")
    b.screenshot(f'{T}/06_plan_edit.png')
    click_text('.text-btn', 'Uložiť'); settle(0.8)
    bench_recs = [r for r in recs_db() if r['planExerciseId'] == pe_ids[0]]
    check('pending' not in [r['status'] for r in bench_recs] and 'superseded' in [r['status'] for r in bench_recs],
          'ručná zmena cieľa → čakajúce odporúčanie neplatí')
    check(plan_pe(plan_id, 1)['increment'] == 0 and plan_pe(plan_id, 1)['targetUpdatedAt'] is None,
          'krok 0 uložený; zmena kroku nemení čas cieľa')
    b.goto(BASE + f'#/plans/{plan_id}', 1); b.wait_for("document.querySelector('.day-card')")
    check(not exists('.rec'), 'detail plánu bez čakajúcich odporúčaní')

    # 4. tréning: kliky s krokom 0 → bez odporúčania; zahodenie odstráni odporúčania
    w4 = start_next()
    check(row_ph(0, 0, 'weight') == '61', 'ručne zmenená váha v pláne sa ponúkne v tréningu')
    log(0, ['10', '10'])
    log(1, ['14', '14'])
    click('.rest-btn.skip')
    finish()
    check(rec_text() == ['Tlak na rovnej lavičke | 61 → 63,5 kg'], f'krok 0 vypne odporúčania cviku {rec_text()}')
    confirm(True)
    click('[aria-label="Možnosti tréningu"]'); settle(0.3)
    click_text('.action-row', 'Zmazať tréning'); settle(0.8)
    check(not [r for r in recs_db() if r['workoutId'] == w4], 'zmazanie tréningu zmaže jeho čakajúce odporúčania')

    # Voľný tréning odporúčania nevytvára
    b.goto(BASE + '#/plans', 1); b.wait_for("document.querySelector('.plan-card')")
    n = len(recs_db())
    click_text('.free-workout', 'Voľný tréning'); settle(0.8)
    click_text('.empty .btn', 'Pridať cvik'); settle(0.4)
    b.wait_for("document.querySelector('.sheet.tall .ex-item')")
    type_into('.sheet .search input', 'Kliky'); settle(0.3)
    click_text('.sheet .ex-item-name', 'Kliky'); settle(0.1)
    click_text('.sheet .sheet-footer .btn', 'Pridať'); settle(0.4)
    log(0, ['20', '20', '20'])
    click('.rest-btn.skip')
    finish()
    check(len(recs_db()) == n and not exists('.rec'), 'voľný tréning bez odporúčaní')

    errs = [c for c in b.console if c.startswith('EXC')]
    check(not errs, f'žiadne JS výnimky {errs}')
    print(f'\n{ok} kontrol OK, screenshoty: {T}')
finally:
    b.close()
