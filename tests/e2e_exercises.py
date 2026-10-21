"""E2E test knižnice cvikov, nastavení a plánov.

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


def texts(sel): return b.eval(f"[...document.querySelectorAll({json.dumps(sel)})].map(e=>e.textContent.trim())")
def names(): return texts('.ex-item-name')
def click_text(sel, text):
    return b.eval(f"""(()=>{{const el=[...document.querySelectorAll({json.dumps(sel)})].find(e=>e.textContent.trim().includes({json.dumps(text)}));
      if(!el) return false; el.click(); return true}})()""")
def click(sel): return b.eval(f"(()=>{{const el=document.querySelector({json.dumps(sel)}); if(!el) return false; el.click(); return true}})()")
def exists(sel): return b.eval(f"!!document.querySelector({json.dumps(sel)})")
def count(sel): return b.eval(f"document.querySelectorAll({json.dumps(sel)}).length")
def type_into(sel, value, idx=0):
    b.eval(f"""(()=>{{const el=document.querySelectorAll({json.dumps(sel)})[{idx}]; el.value={json.dumps(value)};
      el.dispatchEvent(new Event('input',{{bubbles:true}}))}})()""")
def db(expr): return b.eval(f"import('./src/db/exercises.js').then(m=>{expr})")
def settle(t=0.4): time.sleep(t)
def title(): return b.eval("document.querySelector('.page-title')?.textContent")


try:
    # ── Zoznam cvikov ──
    b.goto(BASE + '#/exercises', 1.5)
    b.wait_for("document.querySelectorAll('a.ex-item').length > 0")
    lib = b.eval("import('./src/data/exercise-library.js').then(m=>m.EXERCISE_LIBRARY.length)")
    check(count('a.ex-item') == lib, f'knižnica zobrazuje všetkých {lib} cvikov')
    ids = b.eval("import('./src/data/exercise-library.js').then(m=>m.EXERCISE_LIBRARY.map(e=>e.id))")
    check(len(set(ids)) == len(ids), 'ID v knižnici sú unikátne')
    check(count('.ex-image.thumb') == lib, 'každý cvik má náhľad (placeholder)')
    b.screenshot(f'{T}/01_cviky.png')

    type_into('.search input', 'lavick'); settle()
    check('Tlak na rovnej lavičke' in names(), f'hľadanie bez diakritiky: {len(names())} výsledkov')
    type_into('.search input', 'bench press'); settle()
    check('Tlak na rovnej lavičke' in names(), 'hľadanie podľa aliasu')
    click('.search-clear'); settle()
    check(b.eval("document.querySelector('.search input').value") == '' and count('a.ex-item') == lib, 'vymazanie hľadania')

    click_text('.chip', 'Lýtka'); settle()
    check(set(names()) == {'Výpony v stoji', 'Výpony v sede'}, 'filter partie Lýtka')
    click_text('.chip', 'Všetky'); settle()

    # Filter vybavenia v spodnom paneli
    click('[aria-label="Filter vybavenia"]'); settle()
    check(exists('.sheet'), 'otvorí sa panel filtra vybavenia')
    b.screenshot(f'{T}/02_filter.png')
    click_text('.sheet .chip', 'Kladka'); settle(0.2)
    click_text('.sheet .btn', 'Hotovo'); settle()
    cable = b.eval("import('./src/db/exercises.js').then(m=>m.listExercises()).then(l=>l.filter(e=>e.equipment==='cable').length)")
    check(not exists('.sheet') and count('a.ex-item') == cable and exists('.icon-btn-badge'), f'filter Kladka: {cable} cvikov, odznak na tlačidle')
    click('.active-filters .chip'); settle()
    check(count('a.ex-item') == lib and not exists('.icon-btn-badge'), 'zrušenie filtra cez čip')
    click('[aria-label="Filter vybavenia"]'); settle(0.2)
    click('.sheet-backdrop'); settle(0.2)
    check(not exists('.sheet'), 'panel sa zavrie ťuknutím mimo')

    # Potiahnutie panela nadol: krátky ťah ho vráti, dlhší zavrie
    def drag(y0, y1, steps=8):
        b.call("Input.dispatchTouchEvent", type='touchStart', touchPoints=[{"x": 195, "y": y0}])
        for i in range(1, steps + 1):
            b.call("Input.dispatchTouchEvent", type='touchMove', touchPoints=[{"x": 195, "y": y0 + (y1 - y0) * i / steps}])
            time.sleep(0.03)
        b.call("Input.dispatchTouchEvent", type='touchEnd', touchPoints=[]); settle(0.5)
    click('[aria-label="Filter vybavenia"]'); settle(0.4)
    grab = b.eval("document.querySelector('.sheet-grabber').getBoundingClientRect().top") + 2
    drag(grab, grab + 40)
    check(exists('.sheet'), 'krátke potiahnutie panel nezavrie')
    drag(grab, grab + 260)
    check(not exists('.sheet'), 'panel sa zavrie potiahnutím nadol')

    # ── Detail ──
    click_text('.ex-item-name', 'Tlak na rovnej lavičke'); settle(0.8)
    check(title() == 'Tlak na rovnej lavičke', 'otvorenie detailu zo zoznamu')
    check(count('.step') == 5 and exists('.ex-image.hero'), 'detail: 5 krokov techniky, hero placeholder')
    b.screenshot(f'{T}/03_detail.png')
    click('.step'); settle(0.2)
    check(count('.step.done') == 1, 'krok techniky sa odškrtne')
    click_text('.text-btn', 'Resetovať'); settle(0.2)
    check(count('.step.done') == 0, 'reset techniky')
    click('.section-card-toggle'); settle(0.2)
    check(count('.step') == 0, 'technika sa zbalí')
    click('.section-card-toggle'); settle(0.2)
    check(count('.step') == 5, 'technika sa rozbalí')
    check(texts('.stat-label') == ['Odcvičené série', 'V plánoch', 'Iné názvy'], 'štatistiky: 3 karty')
    click('[aria-label="Možnosti cviku"]'); settle(0.3)
    check(texts('.action-row') == ['Upraviť cvik', 'Zmazať cvik'], 'menu ⋯ obsahuje Upraviť a Zmazať')
    b.screenshot(f'{T}/04_menu.png')
    click_text('.sheet .btn', 'Zrušiť'); settle(0.2)
    check(not exists('.sheet'), 'menu sa zavrie')
    click('.bar-back'); settle(0.6)
    check(b.eval("location.hash") == '#/exercises' and count('a.ex-item') == lib, 'späť na zoznam')

    # ── Nový cvik ──
    b.goto(BASE + '#/exercises/new', 1)
    b.wait_for("document.querySelector('.form')")
    click_text('.text-btn', 'Uložiť'); settle()
    check(count('.field-error') == 2, 'validácia: názov a partia povinné')
    type_into('.field input[type=text]', 'Tlak na rovnej lavičke'); settle(0.2)
    check(exists('.field-warn'), 'varovanie pri duplicitnom názve')
    type_into('.field input[type=text]', 'Testovací cvik')
    type_into('.field input[type=text]', 'test alias, druhý', 1)
    click_text('.chip', 'Biceps'); click_text('.chip', 'Predlaktia'); click_text('.chip', 'Kladka'); settle(0.2)
    for i, txt in enumerate(['Prvý bod', 'Druhý bod', 'Tretí bod']):
        click_text('.add-row', 'Pridať bod'); settle(0.2)
        type_into('.step-row textarea', txt, i); settle(0.1)
    b.eval("document.querySelectorAll('.step-row')[2].querySelector('[aria-label=\"Posunúť hore\"]').click()"); settle(0.2)
    b.eval("document.querySelector('.step-row').scrollIntoView()"); settle(0.2)
    b.screenshot(f'{T}/05_form.png')
    click_text('.text-btn', 'Uložiť'); settle(0.8)
    check(b.eval("location.hash").startswith('#/exercises/') and title() == 'Testovací cvik', 'nový cvik uložený, zobrazený detail')
    steps = texts('.step-text')
    check(steps == ['Prvý bod', 'Tretí bod', 'Druhý bod'], f'poradie techniky po presune: {steps}')
    new_id = b.eval("location.hash.split('/')[2]")
    rec = db(f"m.getExercise('{new_id}')")
    check(rec['muscleGroups'] == ['biceps', 'forearms'] and rec['equipment'] == 'cable'
          and rec['aliases'] == ['test alias', 'druhý'] and not rec['builtIn'], 'uložené polia v DB')

    # ── Úprava cez menu ⋯ ──
    click('[aria-label="Možnosti cviku"]'); settle(0.3)
    click_text('.action-row', 'Upraviť cvik'); settle(0.8)
    check(exists('.form'), 'menu ⋯ → Upraviť otvorí formulár')
    type_into('.field input[type=text]', 'Testovací cvik 2')
    b.eval("document.querySelectorAll('.step-row')[0].querySelector('[aria-label=\"Zmazať bod\"]').click()"); settle(0.2)
    click_text('.text-btn', 'Uložiť'); settle(0.8)
    check(title() == 'Testovací cvik 2' and count('.step') == 2, 'úprava uložená (názov, zmazaný bod)')

    # ── Mazanie ──
    b.eval("window.confirm = () => true")
    click('[aria-label="Možnosti cviku"]'); settle(0.3)
    click_text('.action-row', 'Zmazať cvik'); settle(0.8)
    check(db(f"m.getExercise('{new_id}')") is None, 'vlastný nepoužitý cvik zmazaný natrvalo')

    b.goto(BASE + '#/exercises/lib-plank', 1); b.wait_for("document.querySelector('.page-title')")
    b.eval("window.confirm = () => true")
    click('[aria-label="Možnosti cviku"]'); settle(0.3)
    click_text('.action-row', 'Zmazať cvik'); settle(0.8)
    rec = db("m.getExercise('lib-plank')")
    check(rec and rec['deletedAt'], 'cvik z knižnice zmazaný mäkko')
    b.goto(BASE + '#/exercises', 1); b.wait_for("document.querySelectorAll('a.ex-item').length > 0")
    check('Plank' not in names(), 'zmazaný cvik nie je v knižnici')

    b.eval("import('./src/db/db.js').then(m=>m.put('sets',{id:'s1',workoutId:'w1',exerciseId:'lib-crunch',performedAt:Date.now(),setIndex:0,reps:10}))")
    db("m.saveExercise({id:'custom-used',name:'Použitý',muscleGroups:['core'],equipment:'other',trackingType:'weight_reps',technique:[]})")
    b.eval("import('./src/db/db.js').then(m=>m.put('sets',{id:'s2',workoutId:'w1',exerciseId:'custom-used',performedAt:Date.now(),setIndex:0,reps:10}))")
    check(db("m.deleteExercise('custom-used')") == 'soft', 'vlastný cvik s históriou zmazaný mäkko')

    b.goto(BASE + '#/exercises/lib-crunch', 1); b.wait_for("document.querySelector('.stat-value')")
    check(texts('.stat-value')[0] == '1', 'štatistika: počet odcvičených sérií')

    # ── Nastavenia ──
    b.goto(BASE + '#/more', 1); b.wait_for("document.querySelector('.app-header.large')")
    check(b.eval("document.querySelector('.app-header h1').textContent") == 'Nastavenia', 'obrazovka Nastavenia')
    check(count('.soon') == 0 and count('a.row[href="#/more/backup"]') == 1 and count('a.row[href="#/more/ai-export"]') == 1,
          'záloha a export pre AI sú dostupné')
    b.screenshot(f'{T}/06_nastavenia.png')
    click_text('a.row', 'Zmazané cviky'); settle(0.8)
    t = names()
    check('Plank' in t and 'Použitý' in t, 'zoznam zmazaných cvikov')
    b.screenshot(f'{T}/07_zmazane.png')
    click_text('.text-btn', 'Obnoviť'); settle(0.6)
    check(len(names()) == 1, 'obnovenie jedného cviku')
    db("m.deleteExercise('lib-plank')")
    r = db("m.syncLibrary({restoreDeleted:true})")
    check(r == {'added': 0, 'restored': 1}, f'obnova knižnice vráti zmazané z knižnice: {r}')
    db("m.getExercise('lib-back-squat').then(e=>m.saveExercise({...e, name:'Drep môj'}))")
    db("m.syncLibrary({restoreDeleted:true})")
    check(db("m.getExercise('lib-back-squat').then(e=>e.name)") == 'Drep môj', 'sync knižnice neprepisuje úpravy')

    # ── Plány a navigácia ──
    b.goto(BASE + '#/plans', 1); b.wait_for("document.querySelector('.hero')")
    check(not b.eval("document.querySelector('.hero .btn-primary').disabled"), 'CTA Vytvoriť plán je aktívne')
    b.screenshot(f'{T}/08_plany.png')
    click_text('a.feature', 'Knižnica'); settle(0.6)
    check(b.eval("location.hash") == '#/exercises', 'dlaždica Knižnica cvikov otvorí Cviky')
    click_text('.tab', 'Viac'); settle(0.6)
    check(b.eval("location.hash") == '#/more' and exists('.tab.active[aria-current=page]'), 'tab bar prepína obrazovky')

    errs = [c for c in b.console if c.startswith('EXC')]
    check(not errs, f'žiadne JS výnimky {errs}')
    print(f'\n{ok} kontrol OK, screenshoty: {T}')
finally:
    b.close()
