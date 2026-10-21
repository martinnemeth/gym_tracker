"""E2E test M2: plány, aktívny tréning, časovač odpočinku, história.

Spustenie (z koreňa projektu, v druhom termináli beží `python3 -m http.server 8765`):
    python3 tests/e2e_workouts.py
Screenshoty sa uložia do dočasného adresára, ktorý skript vypíše.
"""
import sys, time, json, tempfile
from cdp import Browser

T = tempfile.mkdtemp(prefix='gymtracker-e2e-m2-')
BASE = 'http://127.0.0.1:8765/'
b = Browser(f'{T}/profile', port=9334)
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
def title(): return b.eval("document.querySelector('.page-title')?.textContent")
def hash_(): return b.eval("location.hash")
def confirm(answer): b.eval(f"window.confirm = () => {J(answer)}")
def mod(path, expr): return b.eval(f"import('./src/{path}').then(m=>{expr})")

# Riadky sérií: karta cviku c, riadok r
ROW = "document.querySelectorAll('.we-card')[{c}].querySelectorAll('.set-row')[{r}]"
def row_input(c, r, field, prop='value'):
    return b.eval(f"{ROW.format(c=c, r=r)}.querySelector('[data-field={field}]').{prop}")
def row_type(c, r, field, value):
    b.eval(f"""(()=>{{const el={ROW.format(c=c, r=r)}.querySelector('[data-field={field}]'); el.focus(); el.value={J(value)};
      el.dispatchEvent(new Event('input',{{bubbles:true}}))}})()""")
def row_blur(c, r, field):
    b.eval(f"{ROW.format(c=c, r=r)}.querySelector('[data-field={field}]').dispatchEvent(new Event('blur'))")
def row_check(c, r): b.eval(f"{ROW.format(c=c, r=r)}.querySelector('.set-check').click()")
def row_done(c, r): return b.eval(f"{ROW.format(c=c, r=r)}.classList.contains('done')")
def card_rows(c): return b.eval(f"document.querySelectorAll('.we-card')[{c}].querySelectorAll('.set-row').length")
def pick(names):
    b.wait_for("document.querySelector('.sheet.tall .ex-item')")
    for n in names:
        type_into('.sheet .search input', n); settle(0.3)
        click_text('.sheet .ex-item-name', n); settle(0.1)
    click_text('.sheet .sheet-footer .btn', 'Pridať'); settle(0.4)


try:
    # ── Vytvorenie plánu ──
    b.goto(BASE + '#/plans', 1.5)
    b.wait_for("document.querySelector('.hero')")
    click_text('.hero .btn', 'Vytvoriť plán'); settle(0.6)
    check(hash_() == '#/plans/new' and exists('.day-edit'), 'CTA otvorí formulár nového plánu s prvým dňom')
    click_text('.text-btn', 'Uložiť'); settle(0.3)
    check(texts('.field-error') == ['Zadaj názov plánu.'], 'validácia názvu plánu')
    type_into('.field input', 'Test plán')
    type_into('.day-name-input', 'Push')
    click_text('.day-edit .add-row', 'Pridať cvik'); settle(0.4)
    check(exists('.sheet.tall .search'), 'otvorí sa výber cvikov')
    b.wait_for("document.querySelector('.sheet.tall .ex-item')")
    type_into('.sheet .search input', 'lavick'); settle(0.3)
    click_text('.sheet .ex-item-name', 'Tlak na rovnej lavičke'); settle(0.1)
    for n in ['Kliky', 'Plank']:
        type_into('.sheet .search input', n); settle(0.3)
        click_text('.sheet .ex-item-name', n); settle(0.1)
    check(texts('.sheet .sheet-footer .btn-primary') == ['Pridať (3)'], 'výber viacerých cvikov naraz')
    b.screenshot(f'{T}/01_picker.png')
    click_text('.sheet .sheet-footer .btn', 'Pridať'); settle(0.4)
    check(texts('.pe-edit-name') == ['Tlak na rovnej lavičke', 'Kliky', 'Plank'], 'cviky pridané do dňa v poradí výberu')

    # tlak: 2 série, 8–10, 62,5 kg, pauza 30 s
    for i, v in enumerate(['2', '8', '10', '62,5', '30']):
        type_into('.pe-edit input', v, i)
    check(b.eval("document.querySelectorAll('.pe-edit')[2].querySelectorAll('input').length") == 5, 'časový cvik má pole Čas namiesto opakovaní')
    click_text('.add-row', 'Pridať deň'); settle(0.3)
    check(count('.day-edit') == 2 and b.eval("document.querySelectorAll('.day-name-input')[1].placeholder") == 'Deň B', 'pridaný druhý deň (Deň B)')
    b.eval("document.querySelectorAll('.day-edit')[1].querySelector('.add-row').click()"); settle(0.4)
    pick(['Drep s činkou na chrbte'])
    b.screenshot(f'{T}/02_plan_edit.png')
    click_text('.text-btn', 'Uložiť'); settle(0.8)
    check(hash_().startswith('#/plans/') and title() == 'Test plán', 'plán uložený, zobrazený detail')
    plan_id = hash_().split('/')[2]
    plan = mod('db/plans.js', f"m.getPlan('{plan_id}')")
    bench = plan['days'][0]['exercises'][0]
    check(plan['status'] == 'active' and plan['days'][1]['name'] == 'Deň B'
          and (bench['sets'], bench['repMin'], bench['repMax'], bench['weight'], bench['restSec']) == (2, 8, 10, 62.5, 30)
          and plan['days'][0]['exercises'][2]['durationSec'] == 60, 'uložené hodnoty plánu v DB (prvý plán je aktívny)')
    check('Aktívny plán' in texts('.tag') and count('.day-card') == 2 and count('.day-card.next') == 1, 'detail: aktívny, 2 dni, jeden na rade')
    check(texts('.pe-line-target')[0] == '2 × 8–10 · 62,5 kg', f'cieľ v detaile: {texts(".pe-line-target")[0]}')
    b.screenshot(f'{T}/03_plan_detail.png')
    b.eval("document.querySelectorAll('.pe-line a')[0].click()"); settle(0.6)
    check(title() == 'Tlak na rovnej lavičke', 'cvik v pláne otvorí detail cviku')
    mod('db/exercises.js', "m.exerciseUsage('lib-bench-press')")
    check(texts('.stat-value')[1] == '1', 'detail cviku: počet plánov')
    click('.bar-back'); settle(0.6)

    # ── Plány: aktívny plán ──
    click('.bar-back'); settle(0.6)
    check(hash_() == '#/plans' and exists('.plan-hero'), 'obrazovka Plány s aktívnym plánom')
    check(b.eval("document.querySelector('.plan-hero-day').textContent") == 'Push', 'na rade je prvý deň')
    b.screenshot(f'{T}/04_plany.png')

    # ── Aktívny tréning ──
    click_text('.plan-hero .btn', 'Začať Push'); settle(0.8)
    check(hash_().startswith('#/workout/') and title() == 'Push', 'štart tréningu z aktívneho plánu')
    wid = hash_().split('/')[2]
    check(count('.we-card') == 3 and [card_rows(i) for i in range(3)] == [2, 3, 3], 'riadky sérií podľa plánu')
    check(row_input(0, 0, 'weight', 'placeholder') == '62,5' and row_input(0, 0, 'reps', 'placeholder') == '8–10',
          'placeholder: váha z plánu, rozsah opakovaní')
    check(exists('.workout-clock'), 'stopky tréningu')
    row_check(0, 0); settle(0.3)
    check(not row_done(0, 0) and b.eval(f"{ROW.format(c=0, r=0)}.querySelector('[data-field=reps]').classList.contains('invalid')"),
          'bez opakovaní sa séria nezapíše')
    row_type(0, 0, 'reps', '10'); row_check(0, 0); settle(0.4)
    check(row_done(0, 0) and exists('.rest-bar .rest-time'), 'séria zapísaná, spustil sa časovač')
    t = b.eval("document.querySelector('.rest-time').textContent")
    check(t in ('0:30', '0:29'), f'časovač podľa pauzy z plánu: {t}')
    click('.rest-btn', 1); settle(0.4)
    t = b.eval("document.querySelector('.rest-time').textContent")
    check(t in ('0:45', '0:44'), f'časovač +15 s: {t}')
    b.screenshot(f'{T}/05_workout.png')
    click('.rest-btn.skip'); settle(0.3)
    check(not exists('.rest-bar'), 'preskočenie pauzy')

    check(row_input(0, 1, 'weight', 'placeholder') == '62,5' and row_input(0, 1, 'reps', 'placeholder') == '10',
          'ďalší riadok predvyplnený z predchádzajúcej série')
    row_check(0, 1); settle(0.4)
    check(row_done(0, 1), 'odškrtnutie prázdneho riadku použije predvolené hodnoty')
    row_type(1, 0, 'reps', '15'); row_check(1, 0); settle(0.3)
    row_type(2, 0, 'durationSec', '45'); row_check(2, 0); settle(0.3)
    sets = mod('db/workouts.js', f"m.getWorkoutSets('{wid}')")
    by_ex = {s['exerciseId']: s for s in sets}
    check(len(sets) == 4 and by_ex['lib-push-up']['reps'] == 15 and by_ex['lib-push-up']['weight'] is None
          and by_ex['lib-plank']['durationSec'] == 45 and by_ex['lib-plank']['reps'] is None,
          'série v DB: kliky bez váhy, plank v sekundách')
    check([s['weight'] for s in sets if s['exerciseId'] == 'lib-bench-press'] == [62.5, 62.5], 'váha s desatinnou čiarkou')
    row_check(2, 0); settle(0.3)
    check(not row_done(2, 0) and row_input(2, 0, 'durationSec') == '45', 'zrušenie série ponechá hodnoty na úpravu')
    row_check(2, 0); settle(0.3)
    check(row_done(2, 0), 'opätovné zapísanie série')
    click('.rest-btn.skip'); settle(0.2)

    click_text('.we-card:nth-of-type(1) .we-add-set', 'Pridať sériu'); settle(0.3)
    check(card_rows(0) == 3, 'pridanie série')
    click('[aria-label="Možnosti cviku"]', 0); settle(0.3)
    check(click_text('.action-row', 'Odobrať poslednú sériu'), 'menu cviku: odobrať sériu'); settle(0.3)
    check(card_rows(0) == 2, 'odobranie prázdnej série')

    confirm(True)
    click('[aria-label="Možnosti cviku"]', 2); settle(0.3)
    click_text('.action-row', 'Odstrániť z tréningu'); settle(0.5)
    check(count('.we-card') == 2 and len(mod('db/workouts.js', f"m.getWorkoutSets('{wid}')")) == 3,
          'odstránenie cviku z tréningu zmaže jeho série')

    click_text('.add-row', 'Pridať cvik'); settle(0.4)
    pick(['Goblet drep'])
    check(count('.we-card') == 3 and texts('.we-name')[2] == 'Goblet drep', 'pridanie cviku počas tréningu')

    # ── Obnova po zatvorení aplikácie ──
    mod('ui/RestTimer.js', "m.startRest(120)"); settle(0.3)
    b.eval("window.__alive = 1")
    b.call('Page.reload'); settle(1.5)
    b.wait_for("document.querySelector('.we-card')")
    check(b.eval("window.__alive") is None and hash_() == f'#/workout/{wid}', 'stránka sa naozaj znovu načítala')
    check(count('.we-card') == 3 and count('.set-row.done') == 3, 'tréning prežije reštart aplikácie')
    check(exists('.rest-bar'), 'časovač prežije reštart aplikácie')
    click('.rest-btn.skip'); settle(0.2)
    mod('ui/RestTimer.js', "m.startRest(1)"); settle(1.6)
    check(exists('.rest-inner.done'), 'koniec pauzy: lišta „Pauza skončila“')
    settle(4)
    check(not exists('.rest-bar'), 'lišta po skončení pauzy sama zmizne')

    # ── Konflikt: druhý tréning ──
    click('.bar-back'); settle(0.6)
    b.wait_for("document.querySelector('.resume')")
    check(exists('.resume') and 'Push' in texts('.resume-title'), 'Plány: karta prebiehajúceho tréningu')
    b.screenshot(f'{T}/06_resume.png')
    b.goto(BASE + f'#/plans/{plan_id}', 1); b.wait_for("document.querySelector('.day-card')")
    confirm(False)
    click_text('.day-card .btn', 'Začať'); settle(0.6)
    check(hash_() == f'#/plans/{plan_id}' and len(mod('db/workouts.js', "m.listFinishedWorkouts()")) == 0,
          'druhý tréning sa nezačne, kým prebieha prvý')

    # ── Dokončenie ──
    b.goto(BASE + f'#/workout/{wid}', 1); b.wait_for("document.querySelector('.we-card')")
    confirm(True)
    click('.btn-sm'); settle(0.8)
    check(hash_() == f'#/history/{wid}' and title() == 'Push', 'dokončenie → súhrn tréningu')
    w = mod('db/workouts.js', f"m.getWorkout('{wid}')")
    check(w['status'] == 'done' and w['finishedAt'] >= w['startedAt'], 'tréning v DB dokončený')
    check(count('.summary-ex') == 2, 'súhrn skryje cviky bez sérií')
    stats = texts('.stat-value')
    check(stats[1] == '3' and stats[2].replace(' ', ' ') == '1 250 kg', f'súhrn: série a objem {stats}')
    b.screenshot(f'{T}/07_summary.png')

    b.goto(BASE + '#/history', 1); b.wait_for("document.querySelector('.wk-item, .empty')")
    check(count('.wk-item') == 1 and texts('.wk-item .ex-item-name') == ['Push'], 'história: 1 tréning')
    check(exists('.tab.active') and texts('.tab.active') == ['História'], 'záložka História')
    b.screenshot(f'{T}/08_history.png')

    b.goto(BASE + '#/plans', 1); b.wait_for("document.querySelector('.plan-hero')")
    check(b.eval("document.querySelector('.plan-hero-day').textContent") == 'Deň B' and not exists('.resume'),
          'po dokončení je na rade ďalší deň')

    # Zahodenie tréningu
    click_text('.plan-hero .btn', 'Začať Deň B'); settle(0.8)
    w2 = hash_().split('/')[2]
    click('[aria-label="Možnosti tréningu"]'); settle(0.3)
    click_text('.action-row', 'Zahodiť tréning'); settle(0.6)
    check(hash_() == '#/plans' and mod('db/workouts.js', f"m.getWorkout('{w2}')") is None, 'zahodenie tréningu')

    # Posledný výkon v ďalšom tréningu
    b.goto(BASE + f'#/plans/{plan_id}', 1); b.wait_for("document.querySelector('.day-card')")
    click('.day-card .btn', 0); settle(0.8)
    check(texts('.we-card:nth-of-type(1) .set-prev') == ['62,5 × 10', '62,5 × 10']
          and row_input(0, 0, 'weight', 'placeholder') == '62,5' and row_input(0, 0, 'reps', 'placeholder') == '10',
          'stĺpec Minule a predvyplnenie z posledného tréningu')
    check(texts('.we-card:nth-of-type(2) .set-prev')[0] == '15', 'Minule pre cvik s vlastnou váhou')
    b.screenshot(f'{T}/09_minule.png')
    click('.btn-sm'); settle(0.6)  # bez sérií → ponuka zahodiť (confirm True)
    check(hash_() == '#/plans' and len(mod('db/workouts.js', "m.listFinishedWorkouts()")) == 1, 'dokončenie bez sérií tréning zahodí')

    # ── Úprava tréningu z histórie ──
    b.goto(BASE + f'#/history/{wid}', 1); b.wait_for("document.querySelector('.summary-ex')")
    click('[aria-label="Možnosti tréningu"]'); settle(0.3)
    click_text('.action-row', 'Upraviť série'); settle(0.8)
    check(hash_() == f'#/workout/{wid}' and not exists('.btn-sm') and not exists('.workout-clock'), 'režim úpravy dokončeného tréningu')
    row_type(0, 0, 'reps', '12'); row_blur(0, 0, 'reps'); settle(0.4)
    check(not exists('.rest-bar'), 'pri úprave histórie sa časovač nespúšťa')
    click_text('.text-btn', 'Hotovo'); settle(0.8)
    check(hash_() == f'#/history/{wid}' and texts('.summary-sets li span:last-child')[0] == '62,5 kg × 12',
          f'upravená séria v súhrne: {texts(".summary-sets li span:last-child")[:1]}')

    # ── Detail cviku: posledné tréningy ──
    b.goto(BASE + '#/exercises/lib-bench-press', 1); b.wait_for("document.querySelector('.stat-value')")
    check(texts('.stat-value')[0] == '2' and count('.recent-row') == 1, 'detail cviku: počet sérií a posledné tréningy')
    check(texts('.recent-sets') == ['62,5 × 12 · 62,5 × 10'], f'posledné tréningy: {texts(".recent-sets")}')
    b.screenshot(f'{T}/10_cvik_historia.png')

    # ── Úprava a zmazanie plánu ──
    b.goto(BASE + f'#/plans/{plan_id}/edit', 1); b.wait_for("document.querySelector('.day-edit')")
    b.eval("document.querySelectorAll('.day-edit')[1].querySelector('[aria-label=\"Posunúť deň hore\"]').click()"); settle(0.2)
    click_text('.text-btn', 'Uložiť'); settle(0.8)
    check(texts('.day-card-name') == ['Deň B', 'Push'], 'presun dňa v pláne')
    plan2 = mod('db/plans.js', f"m.getPlan('{plan_id}')")
    check(plan2['days'][1]['exercises'][0]['id'] == bench['id'], 'ID cvikov v pláne ostávajú po úprave stabilné')

    db_ = "import('./src/db/plans.js').then(m=>m.savePlan({name:'Druhý', days:[]}))"
    second = b.eval(db_)
    check(second['status'] == 'inactive', 'ďalší plán nie je automaticky aktívny')
    mod('db/plans.js', f"m.setActivePlan('{second['id']}')")
    plans = mod('db/plans.js', "m.listPlans()")
    check([p['status'] for p in plans] == ['active', 'inactive'] and plans[0]['name'] == 'Druhý', 'prepnutie aktívneho plánu')

    b.goto(BASE + f'#/plans/{plan_id}', 1); b.wait_for("document.querySelector('.day-card')")
    confirm(True)
    click('[aria-label="Možnosti plánu"]'); settle(0.3)
    click_text('.action-row', 'Zmazať plán'); settle(0.8)
    p = mod('db/plans.js', f"m.getPlan('{plan_id}')")
    check(p and p['deletedAt'], 'plán s tréningami zmazaný mäkko')
    check(mod('db/plans.js', f"m.deletePlan('{second['id']}')") == 'hard', 'nepoužitý plán zmazaný natrvalo')
    b.goto(BASE + '#/history', 1); b.wait_for("document.querySelector('.wk-item')")
    check('Test plán' in texts('.wk-item .ex-item-meta')[0], 'história si pamätá názov zmazaného plánu')

    # ── Voľný tréning ──
    b.goto(BASE + '#/plans', 1); b.wait_for("document.querySelector('.hero')")
    click_text('.free-workout', 'Voľný tréning'); settle(0.8)
    check(title() == 'Voľný tréning' and exists('.empty'), 'voľný tréning začína prázdny')
    click_text('.empty .btn', 'Pridať cvik'); settle(0.4)
    pick(['Kliky'])
    check(count('.we-card') == 1 and card_rows(0) == 3, 'voľný tréning: pridaný cvik s 3 sériami')
    check(row_input(0, 0, 'reps', 'placeholder') == '15', 'voľný tréning tiež ponúka posledný výkon')
    confirm(True)
    click('[aria-label="Možnosti tréningu"]'); settle(0.3)
    click_text('.action-row', 'Zahodiť tréning'); settle(0.6)

    # ── Pauza v okne, riadok na rade, stopky časovej série, poradie v histórii ──
    wid2 = b.eval("""(async()=>{const P=await import('./src/db/plans.js'); const W=await import('./src/db/workouts.js'); const E=await import('./src/db/exercises.js');
      const all=await E.listExercises(); const by=(id)=>all.find(e=>e.id===id);
      const d=P.newDay('Poradie'); const pb=P.newPlanExercise(by('lib-bench-press')); pb.sets=2; pb.weight=50;
      const pp=P.newPlanExercise(by('lib-plank')); pp.sets=1; pp.durationSec=2; d.exercises=[pb,pp];
      const p=await P.savePlan({name:'Poradie',days:[d]}); return (await W.startWorkout(p,d.id)).id})()""")
    b.goto(BASE + f'#/workout/{wid2}', 1); b.wait_for("document.querySelector('.we-card')")
    check(b.eval("!!document.querySelector('.set-row.current')") and b.eval(f"{ROW.format(c=0, r=0)}.classList.contains('current')"),
          'na začiatku je na rade prvá séria')
    check(b.eval(f"!!{ROW.format(c=1, r=0)}.querySelector('.set-check.play')"), 'časový cvik: tlačidlo stopiek')
    # plank ako prvý: stopky (5 s príprava + 2 s), séria sa zapíše sama
    b.eval(f"{ROW.format(c=1, r=0)}.querySelector('.set-check.play').click()"); settle(0.4)
    check(exists('.timer-modal') and 'Priprav sa' in b.eval("document.querySelector('.timer-modal').textContent"), 'stopky: prípravný odpočet')
    b.wait_for(f"{ROW.format(c=1, r=0)}.classList.contains('done')", timeout=12)
    check(not exists('.timer-modal') and exists('.rest-bar.modal'), 'stopky zapísali sériu a spustili pauzu v okne')
    plank = [s for s in mod('db/workouts.js', f"m.getWorkoutSets('{wid2}')") if s['exerciseId'] == 'lib-plank']
    check(len(plank) == 1 and plank[0]['durationSec'] == 2, f'stopky: zapísaný cieľový čas ({plank})')
    b.eval("document.querySelector('.rest-bar.modal').dispatchEvent(new MouseEvent('click', {bubbles: true}))"); settle(0.3)
    check(not exists('.rest-bar.modal') and exists('.rest-bar .rest-expand'), 'ťuknutie mimo okna zmenší pauzu do panela')
    click('.rest-btn.skip'); settle(0.3)
    check(b.eval("document.activeElement?.dataset.field") == 'weight'
          and b.eval(f"{ROW.format(c=0, r=0)}.contains(document.activeElement)"), 'po zavretí pauzy je kurzor v riadku na rade')
    row_type(0, 0, 'reps', '8'); row_check(0, 0); settle(0.4)
    check(b.eval(f"{ROW.format(c=0, r=1)}.classList.contains('current')"), 'po zápise je na rade ďalšia séria')
    click('.rest-btn.skip'); settle(0.2)
    row_check(0, 1); settle(0.4); click('.rest-btn.skip'); settle(0.2)
    confirm(True)
    click_text('.workout-actions .btn', 'Dokončiť tréning'); settle(1)
    check(texts('.summary-ex-name') == ['Plank', 'Tlak na rovnej lavičke'], f'história: cviky v poradí cvičenia ({texts(".summary-ex-name")})')

    errs =[c for c in b.console if c.startswith('EXC')]
    check(not errs, f'žiadne JS výnimky {errs}')
    print(f'\n{ok} kontrol OK, screenshoty: {T}')
finally:
    b.close()
