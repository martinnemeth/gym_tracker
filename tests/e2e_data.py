"""E2E test M5: záloha a obnova, export pre AI, service worker.

Spustenie (z koreňa projektu, v druhom termináli beží `python3 -m http.server 8765`):
    python3 tests/e2e_data.py
"""
import re, sys, time, json, tempfile
from cdp import Browser

T = tempfile.mkdtemp(prefix='gymtracker-e2e-m5-')
BASE = 'http://127.0.0.1:8765/'
b = Browser(f'{T}/profile', port=9337)
ok = 0
SHOTS = '--shots' in sys.argv


def check(cond, label):
    global ok
    if not cond:
        print('FAIL:', label); print('\n'.join(b.console)); b.close(); sys.exit(1)
    ok += 1; print('ok  ', label)


J = json.dumps
def texts(sel): return b.eval(f"[...document.querySelectorAll({J(sel)})].map(e=>e.textContent.trim())")
def text(sel): return b.eval(f"document.querySelector({J(sel)})?.textContent.trim() ?? null")
def click_text(sel, t):
    return b.eval(f"""(()=>{{const el=[...document.querySelectorAll({J(sel)})].find(e=>e.textContent.trim().includes({J(t)}));
      if(!el) return false; el.click(); return true}})()""")
def click(sel, idx=0): return b.eval(f"(()=>{{const el=document.querySelectorAll({J(sel)})[{idx}]; if(!el) return false; el.click(); return true}})()")
def exists(sel): return b.eval(f"!!document.querySelector({J(sel)})")
def settle(t=0.4): time.sleep(t)
def go(path, cond):
    if b.eval("location.hash") == '#' + path: b.call('Page.reload'); settle(0.8)
    else: b.goto(BASE + '#' + path, 0.6)
    b.wait_for(cond)
def mod(path, expr): return b.eval(f"import('./src/{path}').then(m=>{expr})")
def db(expr): return b.eval(f"import('./src/db/db.js').then(d=>{expr})")
def shot(name):
    if not SHOTS: return
    import base64
    h = b.eval("document.documentElement.scrollHeight")
    r = b.call('Page.captureScreenshot', format='png', captureBeyondViewport=True,
               clip={'x': 0, 'y': 0, 'width': 390, 'height': h, 'scale': 1})
    open(f'{T}/{name}.png', 'wb').write(base64.b64decode(r['data'])); print('     screenshot', f'{T}/{name}.png')

# Zdieľanie, schránka a dialógy: zachytíme obsah namiesto systémového menu.
STUBS = """
  window.__shared = null; window.__copied = null; window.__alert = null;
  navigator.canShare = () => true;
  navigator.share = async ({ files }) => { window.__shared = { name: files[0].name, type: files[0].type, text: await files[0].text() }; };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } });
  window.confirm = () => true;
  window.alert = (m) => { window.__alert = m; };
"""
def stubs(): b.eval(f"(()=>{{{STUBS}}})()")
def shared():
    b.wait_for("window.__shared")
    s = b.eval("window.__shared"); b.eval("window.__shared = null"); return s
def pick_file(content, name='zaloha.json'):
    b.eval(f"""(()=>{{const input=document.querySelector('input[type=file]'); const dt=new DataTransfer();
      dt.items.add(new File([{J(content)}], {J(name)}, {{type:'application/json'}})); input.files=dt.files;
      input.dispatchEvent(new Event('change',{{bubbles:true}}))}})()""")


try:
    b.goto(BASE + '#/plans', 1.5)
    b.wait_for("document.querySelector('.home-list')")

    # ── Čisté funkcie ──
    check(mod('aiExport.js', "m.isoDate(new Date(2026,0,5,23,30).getTime())") == '2026-01-05', 'ISO dátum v miestnom čase')
    check(mod('format.js', "[m.formatAgo(Date.now()), m.formatAgo(Date.now()-86400000), m.formatAgo(Date.now()-5*86400000)]")
          == ['dnes', 'včera', 'pred 5 dňami'], 'relatívny dátum')

    # ── Dáta: plán (tlak, kliky), 6 tréningov po týždni + 1 voľný tréning ──
    plan = b.eval("""Promise.all([import('./src/db/plans.js'), import('./src/db/exercises.js'), import('./src/db/db.js'), import('./src/util.js')])
      .then(async ([p, e, db, u]) => {
        const pe = async (id, f) => ({ ...p.newPlanExercise(await e.getExercise(id)), sets: 2, ...f });
        const day = { ...p.newDay('Tlak "A", hrudník'), exercises: [
          await pe('lib-bench-press', { repMin: 8, repMax: 10, weight: 70 }),
          await pe('lib-push-up', { repMin: 10, repMax: 20 }),
        ] };
        const plan = await p.savePlan({ name: 'Jeseň 2026', days: [day] });
        const W = 7 * 86400000, now = Date.now();
        const add = async (w, we, x, k, f) => db.put('sets', { id: u.uuid(), workoutId: w.id, workoutExerciseId: we, exerciseId: x,
          planExerciseId: null, setIndex: k, weight: null, reps: null, durationSec: null, performedAt: w.startedAt + k * 60000 + 1, ...f });
        for (let i = 0; i < 6; i++) {
          const t = now - (6 - i) * W + 3600000;
          const w = { id: 'w' + i, planId: plan.id, dayId: day.id, planName: plan.name, dayName: day.name, status: 'done',
            startedAt: t, finishedAt: t + 3000000,
            exercises: day.exercises.map((x) => ({ id: 'we' + i + x.id, planExerciseId: x.id, exerciseId: x.exerciseId, setCount: 2,
              target: { sets: 2, repMin: x.repMin, repMax: x.repMax, weight: x.weight, restSec: 90 } })) };
          await db.put('workouts', w);
          for (let k = 0; k < 2; k++) {
            await add(w, 'we' + i + day.exercises[0].id, 'lib-bench-press', k, { weight: 60 + i * 2.5, reps: 8, planExerciseId: day.exercises[0].id });
            await add(w, 'we' + i + day.exercises[1].id, 'lib-push-up', k, { reps: 12 + i, planExerciseId: day.exercises[1].id });
          }
        }
        const free = { id: 'free', planId: null, dayId: null, planName: null, dayName: 'Voľný tréning', status: 'done',
          startedAt: now - 2 * 86400000, finishedAt: now - 2 * 86400000 + 1800000,
          exercises: [{ id: 'wef', planExerciseId: null, exerciseId: 'lib-plank', setCount: 1, target: {} }] };
        await db.put('workouts', free);
        await add(free, 'wef', 'lib-plank', 0, { durationSec: 75 });
        await db.setSetting('restTimer', { endsAt: 1 });
        return plan;
      })""")
    pid = plan['id']

    # ── Nastavenia a pripomienka zálohy ──
    go('/plans', "document.querySelector('.plan-card')")
    check(not click_text('.row', 'Zálohuj'), 'Domov: bez karty pripomienky zálohy')
    go('/more/backup', "document.querySelector('.btn-primary')")
    go('/more', "document.querySelector('.row')")
    rows = texts('.row .row-title')
    check('Záloha a obnova' in rows and 'Export pre AI analýzu' in rows and not exists('.soon'), 'Nastavenia: záloha a export sú aktívne')
    check(click_text('a.row', 'Záloha a obnova'), 'Nastavenia → Záloha a obnova')

    # ── Záloha ──
    b.wait_for("document.querySelector('.btn-primary')")
    stubs()
    shot('backup')
    check(text('.row .row-value') == 'Nikdy', 'posledná záloha: nikdy')
    check('7 tréningov' in text('.row .row-subtitle') and '25 sérií' in text('.row .row-subtitle'), f'obsah zálohy ({text(".row .row-subtitle")})')
    click('.btn-primary')
    s = shared()
    check(s['name'].startswith('gymtracker-zaloha-') and s['name'].endswith('.json') and s['type'] == 'application/json', f'súbor zálohy ({s["name"]})')
    backup = json.loads(s['text'])
    check(backup['app'] == 'gymtracker' and backup['format'] == 1 and backup['appVersion'] == '0.9.0', 'hlavička zálohy')
    st = backup['stores']
    check(len(st['workouts']) == 7 and len(st['sets']) == 25 and len(st['plans']) == 1 and len(st['exercises']) > 90, 'záloha obsahuje všetky store-y')
    check(not any(r['key'] in ('restTimer', 'lastBackupAt') for r in st['settings']), 'lokálne nastavenia (časovač) nie sú v zálohe')
    b.wait_for("document.querySelector('.row .row-value')?.textContent === 'dnes'")
    check(True, 'po uložení: posledná záloha dnes')

    # ── Obnova ──
    b.eval("""Promise.all([import('./src/db/workouts.js'), import('./src/db/plans.js')]).then(async ([w, p]) => {
      await w.deleteWorkout('w0'); await w.deleteWorkout('free');
      await p.savePlan({ name: 'Nový plán po zálohe', days: [p.newDay('A')] }); })""")
    check(len(db("d.getAll('workouts')")) == 5, 'po zálohe zmažeme 2 tréningy a pridáme plán')

    go('/more/backup', "document.querySelector('input[type=file]')")
    stubs()
    pick_file('{"nie": "záloha"}')
    b.wait_for("window.__alert")
    check('nie je záloha GymTrackera' in b.eval("window.__alert"), 'cudzí JSON → chyba')
    b.eval("window.__alert = null")
    pick_file('{nie je json')
    b.wait_for("window.__alert")
    check('platný JSON' in b.eval("window.__alert"), 'neplatný JSON → chyba')
    b.eval("window.__alert = null")
    newer = dict(backup, dbVersion=99)
    pick_file(json.dumps(newer))
    b.wait_for("window.__alert")
    check('novšej verzie' in b.eval("window.__alert"), 'záloha z novšej verzie → chyba')
    b.eval("window.__alert = null")
    broken = json.loads(s['text']); broken['stores']['sets'].append({'reps': 5})
    pick_file(json.dumps(broken))
    b.wait_for("window.__alert")
    check('nemá id' in b.eval("window.__alert"), 'poškodený záznam → chyba, nič sa nezmenilo')
    check(len(db("d.getAll('workouts')")) == 5, 'po neúspešnej obnove dáta ostali')

    b.eval("window.__confirmMsg = null; window.confirm = (m) => { window.__confirmMsg = m; return true; }")
    pick_file(s['text'])
    b.wait_for("window.__confirmMsg")
    msg = b.eval("window.__confirmMsg")
    check('7 tréningov' in msg and '1 plán' in msg and 'nahradia' in msg, f'potvrdenie obnovy so zhrnutím')
    settle(1.6)
    b.wait_for("location.hash === '#/plans' && document.querySelector('.plan-card')")
    ws = db("d.getAll('workouts')")
    plans = db("d.getAll('plans')")
    check(len(ws) == 7 and len(plans) == 1 and plans[0]['name'] == 'Jeseň 2026', 'obnova vrátila stav zálohy')
    check(len(db("d.getAll('sets')")) == 25, 'obnovené série')
    check(db("d.getSetting('lastBackupAt')") is not None, 'čas poslednej zálohy v zariadení ostal')
    check(db("d.getSetting('restTimer', null)") is None, 'časovač sa pri obnove zahodí')

    # ── Export pre AI ──
    go('/more/ai-export', "document.querySelector('.export-summary')")
    stubs()
    shot('ai-export')
    chips = texts('.chips-wrap')
    check('Všetky tréningy' in chips[0] and 'Jeseň 2026' in chips[0], 'rozsah: všetky tréningy alebo plán')
    check('7 tréningov' in text('.export-summary'), f'zhrnutie exportu ({text(".export-summary")})')
    click('.export-actions .btn-primary')
    s = shared()
    check(s['name'].startswith('gymtracker-ai-vsetko-') and s['name'].endswith('.json'), f'názov súboru ({s["name"]})')
    ai = json.loads(s['text'])
    check(ai['prompt'].startswith('Si skúsený tréner'), 'prompt v súbore')
    check(ai['scope']['plan'] == 'Všetky tréningy' and ai['scope']['workouts'] == 7, 'rozsah: všetky tréningy vrátane voľného')
    w = ai['workouts'][0]
    check(w['plan'] == 'Jeseň 2026' and len(w['date']) == 10 and re.search(r'[+-]\d\d:\d\d$', w['started_at']), 'tréning: plán, ISO dátum a čas s posunom')
    ex0 = w['exercises'][0]
    check(ex0['exercise'] == 'Tlak na rovnej lavičke' and ex0['target'] == '2 × 8–10 · 70 kg', f'cvik menom a cieľ slovami ({ex0["target"]})')
    check(ex0['sets'][0] == {'weight_kg': 60, 'reps': 8, 'e1rm_kg': 76}, f'séria s odhadom 1RM ({ex0["sets"][0]})')
    check(ai['workouts'][-1]['plan'] == 'Voľný tréning' and ai['workouts'][-1]['exercises'][0]['target'] == 'mimo plánu', 'voľný tréning')
    stats = {x['exercise']: x for x in ai['exercise_stats']}
    bench = stats['Tlak na rovnej lavičke']
    check(bench['change_in_period_pct'] > 15 and bench['trend'] == 'Progres' and bench['latest'] == 91.8, f'progres cviku ({bench})')
    check(any('Odhad 1RM' in r for r in bench['personal_records']), 'rekordy cviku')
    check('Hrudník' in bench['muscle_groups'], 'partie menom')
    p0 = ai['plans'][0]
    check(p0['name'] == 'Jeseň 2026' and 'Dvojitá progresia' in p0['progression_rules'] and p0['days'][0]['exercises'][0]['progression_step'] == 2.5,
          'plán s pravidlami slovami a krokom progresie')

    click('.switch'); settle(0.2)
    click('.export-actions .btn-primary')
    check('prompt' not in json.loads(shared()['text']), 'bez promptu')
    click('.switch'); settle(0.2)

    click_text('.chip', 'Jeseň 2026'); click_text('.chip', '4 týždne'); settle(0.3)
    click('.export-actions .btn-primary')
    s = shared(); ai = json.loads(s['text'])
    check('jesen-2026' in s['name'] and ai['scope']['plan'] == 'Jeseň 2026' and ai['scope']['workouts'] == 4, f'plán + 4 týždne ({ai["scope"]})')
    check(len(ai['plans']) == 1 and all(x['plan'] == 'Jeseň 2026' for x in ai['workouts']), 'iba zvolený plán')

    # prompt sa dá upraviť a zapamätá sa
    b.eval("""(()=>{const t=document.querySelector('.prompt-input'); t.value='Môj prompt'; t.dispatchEvent(new Event('input',{bubbles:true}));
      t.dispatchEvent(new Event('blur'))})()""")
    settle(0.3)
    check(db("d.getSetting('aiPrompt')") == 'Môj prompt', 'upravený prompt sa uloží')

    click_text('.chip', 'CSV'); settle(0.3)
    click('.export-actions .btn-primary')
    s = shared()
    lines = s['text'].strip().split('\n')
    check(s['type'] == 'text/csv' and lines[0].startswith('date,plan,day,exercise'), 'CSV: hlavička')
    check(len(lines) == 1 + 4 * 4, f'CSV: riadok za každú sériu ({len(lines) - 1})')
    check('"Tlak ""A"", hrudník"' in lines[1] and ',8,' in lines[1], f'CSV: úvodzovky a čiarky v názve ({lines[1]})')
    click('.export-actions .btn-secondary'); b.wait_for("window.__copied")
    check(b.eval("window.__copied").startswith('Môj prompt\n\ndate,plan'), 'kopírovanie: prompt + CSV')

    click_text('.chip', 'Všetky tréningy'); click_text('.chip', 'Celé obdobie'); click_text('.chip', 'JSON'); settle(0.3)
    go('/more/ai-export', "document.querySelector('.export-summary')")
    check(b.eval("document.querySelector('.prompt-input').value") == 'Môj prompt', 'prompt sa načíta po návrate')
    click_text('.text-btn', 'Predvolený'); settle(0.3)
    check(db("d.getSetting('aiPrompt', null)") is None, 'návrat k predvolenému promptu')

    # ── Service worker: všetky súbory z ASSETS sa dajú stiahnuť a aplikácia beží offline ──
    b.goto(BASE + '?sw#/more', 1.5)
    b.wait_for("navigator.serviceWorker.controller || false", timeout=15)
    n = b.eval("caches.keys().then(k=>Promise.all(k.map(n=>caches.open(n).then(c=>c.keys().then(r=>[n,r.length])))))")
    check(len(n) == 1 and n[0][0] == 'gymtracker-0.9.0' and n[0][1] > 40, f'precache novej verzie ({n})')
    b.call('Network.enable')
    b.call('Network.emulateNetworkConditions', offline=True, latency=0, downloadThroughput=-1, uploadThroughput=-1)
    b.goto(BASE + '?sw#/more/ai-export', 1.5)
    b.wait_for("document.querySelector('.export-summary')")
    check(True, 'offline: aplikácia sa načíta z cache')
    b.call('Network.emulateNetworkConditions', offline=False, latency=0, downloadThroughput=-1, uploadThroughput=-1)

    errs = [c for c in b.console if c.startswith('EXC')]
    check(not errs, f'žiadne chyby v konzole {errs}')
    print(f'\n{ok} kontrol OK')
finally:
    b.close()
