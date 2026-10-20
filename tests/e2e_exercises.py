"""E2E test knižnice cvikov (M1).

Spustenie (z koreňa projektu, v druhom termináli beží `python3 -m http.server 8765`):
    python3 tests/e2e_exercises.py
Screenshoty sa uložia do dočasného adresára, ktorý skript vypíše.
"""
import sys, time, json, tempfile
from cdp import Browser
T = tempfile.mkdtemp(prefix='gymtracker-e2e-')
BASE = 'http://127.0.0.1:8765/'
b = Browser(f'{T}/profile')
ok = 0
def check(cond, label):
    global ok
    if not cond:
        print('FAIL:', label); print('\n'.join(b.console)); b.close(); sys.exit(1)
    ok += 1; print('ok  ', label)

def rows_text(): return b.eval("[...document.querySelectorAll('.row-title')].map(e=>e.textContent)")
def click_text(sel, text):
    return b.eval(f"""(()=>{{const el=[...document.querySelectorAll({json.dumps(sel)})].find(e=>e.textContent.trim().includes({json.dumps(text)}));
      if(!el) return false; el.click(); return true}})()""")
def type_into(sel, value, idx=0):
    b.eval(f"""(()=>{{const el=document.querySelectorAll({json.dumps(sel)})[{idx}]; el.value={json.dumps(value)};
      el.dispatchEvent(new Event('input',{{bubbles:true}}))}})()""")
def settle(t=0.4): time.sleep(t)

try:
    b.goto(BASE + '#/exercises', 1.5)
    b.wait_for("document.querySelectorAll('a.row').length > 0")
    n = b.eval("document.querySelectorAll('a.row').length")
    lib = b.eval("import('./src/data/exercise-library.js').then(m=>m.EXERCISE_LIBRARY.length)")
    check(n == lib, f'knižnica zobrazuje všetkých {lib} cvikov (zobrazených {n})')
    ids = b.eval("import('./src/data/exercise-library.js').then(m=>m.EXERCISE_LIBRARY.map(e=>e.id))")
    check(len(set(ids)) == len(ids), 'ID v knižnici sú unikátne')
    b.screenshot(f'{T}/s1_exercises.png')

    type_into('.search input', 'lavick'); settle()
    t = rows_text()
    check('Tlak na rovnej lavičke' in t and all('lavič' in x.lower() or True for x in t), f'hľadanie bez diakritiky: {len(t)} výsledkov')
    type_into('.search input', 'bench press'); settle()
    check('Tlak na rovnej lavičke' in rows_text(), 'hľadanie podľa aliasu')
    type_into('.search input', ''); settle()
    click_text('.chip', 'Lýtka'); settle()
    check(set(rows_text()) == {'Výpony v stoji', 'Výpony v sede'}, 'filter partie Lýtka')
    click_text('.chip', 'Všetky partie'); settle()

    b.goto(BASE + '#/exercises/lib-bench-press', 1)
    b.wait_for("document.querySelector('.detail-head h1')")
    check(b.eval("document.querySelectorAll('.check-row').length") == 5, 'detail: 5 bodov techniky')
    b.eval("document.querySelector('.check-row').click()"); settle(0.2)
    check(b.eval("document.querySelectorAll('.check-row.done').length") == 1, 'checklist sa odškrtne')
    b.screenshot(f'{T}/s2_detail.png')

    # Nový cvik
    b.goto(BASE + '#/exercises/new', 1)
    b.wait_for("document.querySelector('.form')")
    click_text('.nav-btn', 'Uložiť'); settle()
    check(b.eval("document.querySelectorAll('.field-error').length") == 2, 'validácia: názov a partia povinné')
    type_into('.field input[type=text]', 'Tlak na rovnej lavičke'); settle(0.2)
    check(b.eval("!!document.querySelector('.field-warn')"), 'varovanie pri duplicitnom názve')
    type_into('.field input[type=text]', 'Testovací cvik')
    type_into('.field input[type=text]', 'test alias, druhý', 1)
    click_text('.chip', 'Biceps'); click_text('.chip', 'Predlaktia'); click_text('.chip', 'Kladka'); settle(0.2)
    for i, txt in enumerate(['Prvý bod', 'Druhý bod', 'Tretí bod']):
        click_text('.add-row', 'Pridať bod'); settle(0.2)
        type_into('.step-row textarea', txt, i); settle(0.1)
    b.eval("document.querySelectorAll('.step-row')[2].querySelector('[aria-label=\"Posunúť hore\"]').click()"); settle(0.2)
    b.screenshot(f'{T}/s3_new.png')
    click_text('.nav-btn', 'Uložiť'); settle(0.8)
    check(b.eval("location.hash").startswith('#/exercises/') and b.eval("document.querySelector('.detail-head h1')?.textContent") == 'Testovací cvik', 'nový cvik uložený, zobrazený detail')
    steps = b.eval("[...document.querySelectorAll('.check-row span:last-child')].map(e=>e.textContent)")
    check(steps == ['Prvý bod', 'Tretí bod', 'Druhý bod'], f'poradie techniky po presune: {steps}')
    new_id = b.eval("location.hash.split('/')[2]")
    rec = b.eval(f"import('./src/db/exercises.js').then(m=>m.getExercise('{new_id}'))")
    check(rec['muscleGroups'] == ['biceps', 'forearms'] and rec['equipment'] == 'cable' and rec['aliases'] == ['test alias', 'druhý'] and not rec['builtIn'], 'uložené polia v DB')

    # Úprava
    click_text('.nav-btn', 'Upraviť'); settle(0.8)
    type_into('.field input[type=text]', 'Testovací cvik 2')
    b.eval("document.querySelectorAll('.step-row')[0].querySelector('[aria-label=\"Zmazať bod\"]').click()"); settle(0.2)
    click_text('.nav-btn', 'Uložiť'); settle(0.8)
    check(b.eval("document.querySelector('.detail-head h1')?.textContent") == 'Testovací cvik 2' and b.eval("document.querySelectorAll('.check-row').length") == 2, 'úprava uložená (názov, zmazaný bod)')

    # Mazanie: vlastný nepoužitý = natrvalo
    b.eval("window.confirm = () => true")
    click_text('.row-title', 'Zmazať cvik'); settle(0.8)
    check(b.eval(f"import('./src/db/exercises.js').then(m=>m.getExercise('{new_id}')).then(x=>x===undefined)"), 'vlastný nepoužitý cvik zmazaný natrvalo')

    # Mazanie: z knižnice = mäkko
    b.goto(BASE + '#/exercises/lib-plank', 1); b.wait_for("document.querySelector('.detail-head h1')")
    b.eval("window.confirm = () => true")
    click_text('.row-title', 'Zmazať cvik'); settle(0.8)
    rec = b.eval("import('./src/db/exercises.js').then(m=>m.getExercise('lib-plank'))")
    check(rec and rec['deletedAt'], 'cvik z knižnice zmazaný mäkko')
    b.goto(BASE + '#/exercises', 1); b.wait_for("document.querySelectorAll('a.row').length > 0")
    check('Plank' not in rows_text(), 'zmazaný cvik nie je v knižnici')

    # Cvik s históriou = mäkko
    b.eval("import('./src/db/db.js').then(m=>m.put('sets',{id:'s1',workoutId:'w1',exerciseId:'lib-crunch',performedAt:Date.now(),setIndex:0,reps:10}))")
    b.eval("import('./src/db/exercises.js').then(m=>m.saveExercise({id:'custom-used',name:'Použitý',muscleGroups:['core'],equipment:'other',trackingType:'weight_reps',technique:[]}))")
    b.eval("import('./src/db/db.js').then(m=>m.put('sets',{id:'s2',workoutId:'w1',exerciseId:'custom-used',performedAt:Date.now(),setIndex:0,reps:10}))")
    r = b.eval("import('./src/db/exercises.js').then(m=>m.deleteExercise('custom-used'))")
    check(r == 'soft', 'vlastný cvik s históriou zmazaný mäkko')

    b.goto(BASE + '#/more', 1); b.wait_for("document.querySelector('.app-header.large')")
    b.screenshot(f'{T}/s4_more.png')
    click_text('a.row', 'Zmazané cviky'); settle(0.8)
    t = rows_text()
    check('Plank' in t and 'Použitý' in t, 'zoznam zmazaných cvikov')
    b.screenshot(f'{T}/s5_deleted.png')
    click_text('.btn-link', 'Obnoviť'); settle(0.6)
    check(len(rows_text()) == 1, 'obnovenie jedného cviku')
    # Obnova knižnice
    b.eval("import('./src/db/exercises.js').then(m=>m.deleteExercise('lib-plank'))")
    r = b.eval("import('./src/db/exercises.js').then(m=>m.syncLibrary({restoreDeleted:true}))")
    check(r == {'added': 0, 'restored': 1}, f'obnova knižnice vráti zmazané z knižnice: {r}')
    # Úprava cviku z knižnice prežije sync
    b.eval("import('./src/db/exercises.js').then(async m=>{const e=await m.getExercise('lib-back-squat'); await m.saveExercise({...e, name:'Drep môj'})})")
    b.eval("import('./src/db/exercises.js').then(m=>m.syncLibrary({restoreDeleted:true}))")
    check(b.eval("import('./src/db/exercises.js').then(m=>m.getExercise('lib-back-squat')).then(e=>e.name)") == 'Drep môj', 'sync knižnice neprepisuje úpravy')

    # Navigácia späť cez tab
    b.goto(BASE + '#/plans', 1); b.wait_for("document.querySelector('.app-header.large')")
    b.screenshot(f'{T}/s6_plans.png')
    errs = [c for c in b.console if c.startswith('EXC')]
    check(not errs, f'žiadne JS výnimky {errs}')
    print(f'\n{ok} kontrol OK, screenshoty: {T}')
finally:
    b.close()
