"""E2E test M4: analytika, grafy, stagnácia, rekordy.

Spustenie (z koreňa projektu, v druhom termináli beží `python3 -m http.server 8765`):
    python3 tests/e2e_analytics.py
"""
import sys, time, json, tempfile
from cdp import Browser

T = tempfile.mkdtemp(prefix='gymtracker-e2e-m4-')
BASE = 'http://127.0.0.1:8765/'
b = Browser(f'{T}/profile', port=9336)
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
def count(sel): return b.eval(f"document.querySelectorAll({J(sel)}).length")
def settle(t=0.4): time.sleep(t)
def go(path, cond):
    b.goto(BASE + '#' + path, 0.6); b.wait_for(cond)
def mod(path, expr): return b.eval(f"import('./src/{path}').then(m=>{expr})")
def shot(name):
    if not SHOTS: return
    import base64
    h = b.eval("document.documentElement.scrollHeight")
    r = b.call('Page.captureScreenshot', format='png', captureBeyondViewport=True,
               clip={'x': 0, 'y': 0, 'width': 390, 'height': h, 'scale': 1})
    open(f'{T}/{name}.png', 'wb').write(base64.b64decode(r['data'])); print('     screenshot', f'{T}/{name}.png')


try:
    b.goto(BASE + '#/plans', 1.5)
    b.wait_for("document.querySelector('.hero')")

    # ── Výpočty (čisté funkcie) ──
    A = lambda expr: mod('analytics.js', expr)
    check(A("[m.e1rm(100,5), m.e1rm(100,1), m.e1rm(0,5), m.e1rm(60,0)]") == [116.7, 100, None, None], 'e1RM (Epley), 1 opak. = váha, neplatné → null')
    pts = lambda *v: J([{'t': i, 'value': x} for i, x in enumerate(v)])
    check(A(f"m.pctChange({pts(100, 100, 110, 110)})") == 10, 'nárast: priemer prvých 2 vs. posledných 2')
    check(A(f"m.pctChange({pts(100, 105, 110)})") == 10, 'nárast pri < 4 bodoch: prvý vs. posledný')
    check(A(f"m.pctChange({pts(100)})") is None, 'nárast z 1 bodu nie je')
    tr = lambda v, o='{}': A(f"m.trendOf({pts(*v)}, {o}).status")
    check(tr([80, 85, 90, 95]) == 'progress', 'trend: rastie → progres')
    check(tr([80, 90, 95, 95, 95.5, 95]) == 'stagnation', 'trend: posledné 4 bez nárastu 1 % → stagnácia')
    check(tr([100, 98, 94, 90]) == 'regression', 'trend: pokles ≥ 5 % → pokles')
    check(tr([100, 101]) == 'insufficient', 'trend: málo tréningov')
    check(tr([100, 101, 101.5, 102], '{"sessions":4,"minGainPct":3}') == 'stagnation', 'trend: vlastná hranica nárastu')
    check(A("[m.formatPct(12.345), m.formatPct(-3.21), m.formatPct(0.01), m.formatPct(null)]") == ['+12 %', '−3,2 %', '0 %', '–'], 'formát percent')
    wk = A("""(()=>{const mon=new Date(2026,9,5,10).getTime(), d=86400000;
      const ws=[{startedAt:mon,sets:[{exerciseId:'a',weight:50,reps:10}]},{startedAt:mon+2*d,sets:[{exerciseId:'a',weight:50,reps:10},{exerciseId:'b',weight:20,reps:10}]},
        {startedAt:mon+14*d,sets:[{exerciseId:'a',weight:60,reps:5}]}];
      return m.weeklyVolume(ws, id=>id==='a'?'weight_reps':'bodyweight_reps', -Infinity, mon+15*d).map(w=>[w.volume,w.workouts])})()""")
    check(wk == [[1000, 2], [0, 0], [300, 1]], f'týždenný objem vrátane prázdnych týždňov ({wk})')
    m = A("[m.metricFor('bodyweight_reps',[{sets:[{reps:10}]}]).key, m.metricFor('bodyweight_reps',[{sets:[{weight:10,reps:8}]}]).key, m.metricFor('time').key]")
    check(m == ['reps', 'e1rm', 'time'], 'metrika: vlastná váha podľa posledného tréningu, čas')

    # ── Dáta: plán s tlakom, klikmi a plankom, 8 tréningov po týždni ──
    plan = b.eval("""Promise.all([import('./src/db/plans.js'), import('./src/db/exercises.js'), import('./src/db/db.js'), import('./src/util.js')])
      .then(async ([p, e, db, u]) => {
        const pe = async (id, f) => ({ ...p.newPlanExercise(await e.getExercise(id)), sets: 2, ...f });
        const day = { ...p.newDay('Full'), exercises: [
          await pe('lib-bench-press', { repMin: 8, repMax: 10, weight: 67.5 }),
          await pe('lib-push-up', { repMin: 10, repMax: 20 }),
          await pe('lib-plank', { durationSec: 60 }),
        ] };
        const plan = await p.savePlan({ name: 'Analytika', days: [day] });
        const [bench, push, plank] = day.exercises;
        const W = 7 * 86400000, now = Date.now();
        const bw = [60, 62.5, 65, 67.5, 67.5, 67.5, 67.5, 67.5];
        const reps = [10, 11, 12, 13, 14, 15, 16, 18];
        const secs = [50, 55, 60, 60, 60, 58, 52, 50];
        for (let i = 0; i < 8; i++) {
          const t = now - (8 - i) * W + 3600000;
          const w = { id: 'w' + i, planId: plan.id, dayId: day.id, planName: plan.name, dayName: 'Full', status: 'done',
            startedAt: t, finishedAt: t + 3600000,
            exercises: day.exercises.map((x) => ({ id: 'we' + i + x.id, planExerciseId: x.id, exerciseId: x.exerciseId, setCount: 2,
              target: { sets: 2, repMin: x.repMin, repMax: x.repMax, durationSec: x.durationSec, weight: x.weight, restSec: 90 } })) };
          await db.put('workouts', w);
          const add = (x, k, f) => db.put('sets', { id: u.uuid(), workoutId: w.id, workoutExerciseId: 'we' + i + x.id, exerciseId: x.exerciseId,
            planExerciseId: x.id, setIndex: k, weight: null, reps: null, durationSec: null, performedAt: t + k * 60000 + 1, ...f });
          for (let k = 0; k < 2; k++) {
            await add(bench, k, { weight: bw[i], reps: 8 });
            await add(push, k, { reps: reps[i] - k });
            await add(plank, k, { durationSec: secs[i] - k * 5 });
          }
        }
        return plan;
      })""")
    pid = plan['id']
    pe_ids = [x['id'] for x in plan['days'][0]['exercises']]

    # ── Analytika plánu ──
    go(f'/plans/{pid}/analytics', "document.querySelector('.an-row')")
    shot('plan-analytics')
    check(texts('.analytics-periods .chip') == ['Celé obdobie', '12 týždňov', '4 týždne'], 'výber obdobia')
    stats = texts('.summary-stats .stat-value')
    check(stats[0] == '8' and stats[1] == '1', f'tréningy a priemer za týždeň ({stats})')
    check(stats[2].startswith('+'), f'priemerný nárast sily ({stats[2]})')
    check(count('.an-row') == 3 and count('.an-row .spark') == 3, 'riadok so sparkline pre každý cvik')
    rows = texts('.an-row .row-title')
    check(rows == ['Tlak na lavičke (veľká činka)', 'Kliky', 'Plank'] or len(rows) == 3, f'poradie cvikov podľa plánu ({rows})')
    pcts = texts('.an-row-pct')
    check(pcts[0] == '+10 %', f'tlak: (76 + 79,2) / 2 → 85,5 kg = +10 % ({pcts[0]})')
    alerts = texts('.alert .alert-text')
    check(len(alerts) == 2 and alerts[0].startswith('Stagnácia') and alerts[1].startswith('Pokles'),
          f'upozornenia: tlak stagnuje, plank klesá ({alerts})')
    check(count('.alert .rec-btn') == 1, 'deload sa ponúkne iba pri cviku s váhou')
    check(count('.chart-bar') >= 8, f'týždenný objem: stĺpec za každý týždeň ({count(".chart-bar")})')

    b.eval("""(()=>{const s=document.querySelector('.chart-svg'), r=s.getBoundingClientRect();
      s.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.right-20,clientY:r.top+50,pointerType:'touch'}))})()""")
    settle(0.2)
    shot('plan-analytics-tip')
    check(exists('.chart-tip') and text('.chart-tip-label').startswith('od '), 'ťuknutie do grafu ukáže hodnotu týždňa')

    click_text('.chip', '4 týždne'); settle(0.3)
    check(texts('.summary-stats .stat-value')[0] == '4', 'obdobie 4 týždne → 4 tréningy')
    click_text('.chip', 'Celé obdobie'); settle(0.3)

    # deload zo stagnácie → čakajúce odporúčanie v pláne
    click('.alert .rec-btn'); settle(0.6)
    recs = mod('db/recommendations.js', f"m.listPending('{pid}')")
    check(len(recs) == 1 and recs[0]['kind'] == 'deload' and recs[0]['to']['weight'] == 60 and recs[0]['workoutId'] is None,
          f'deload: 67,5 → 60 kg ({recs and recs[0]["to"]})')
    check('čaká' in text('.alert-note'), 'pri cviku sa ukáže, že odporúčanie čaká v pláne')

    # ── Detail plánu a obrazovka Plány ──
    go(f'/plans/{pid}', "document.querySelector('.day-card')")
    check(click_text('.row', 'Analytika'), 'detail plánu: riadok Analytika')
    b.wait_for("location.hash.endsWith('/analytics')")
    go(f'/plans/{pid}', "document.querySelector('.day-card')")
    check('Stagnácia' in (text('.row .row-subtitle') or ''), 'detail plánu: zhrnutie stagnujúcich cvikov')
    check(exists('.rec') and 'Uľahči' in text('.rec .rec-reason'), 'deload sa zobrazí medzi odporúčaniami plánu')
    go('/plans', "document.querySelector('.plan-hero')")
    check(click_text('.row', 'Stagnácia'), 'Plány: upozornenie na stagnáciu aktívneho plánu')
    b.wait_for("location.hash.endsWith('/analytics')")

    # ── Analytika cviku v pláne ──
    go(f'/plans/{pid}/analytics/lib-bench-press', "document.querySelector('.chart-line')")
    shot('exercise-analytics')
    check(count('.chart-dot') == 8, 'graf: bod za každý tréning')
    check(text('.chart-end') == '85,5 kg', f'graf: hodnota na konci čiary ({text(".chart-end")})')
    check(exists('.trend-badge.stagnation'), 'odznak stagnácie')
    prs = texts('.pr-value')
    check(prs[:2] == ['85,5 kg', '67,5 kg'], f'rekordy: 1RM a najvyššia váha ({prs})')
    check(count('.recent-row') == 8, 'zoznam tréningov (tabuľka hodnôt)')
    check(count('.rec-history .rec') == 1, 'história odporúčaní cviku')
    b.eval("""(()=>{const s=document.querySelector('.chart-svg'), r=s.getBoundingClientRect();
      s.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+46,clientY:r.top+50,pointerType:'touch'}))})()""")
    settle(0.2)
    check(text('.chart-tip-value') == '76 kg' and '60 kg × 8' in text('.chart-tip-label'), f'bublina: 1RM a séria ({text(".chart-tip-label")})')

    go(f'/plans/{pid}/analytics/lib-push-up', "document.querySelector('.chart-line')")
    check('Max. opakovaní' in text('.tags'), 'kliky: metrika max. opakovaní')
    check(exists('.trend-badge.progress'), 'kliky: progres')

    # ── Detail cviku (všetky plány) ──
    go('/exercises/lib-bench-press', "document.querySelector('.an-link')")
    shot('exercise-detail')
    check('85,5 kg' in text('.an-link'), 'detail cviku: odkaz na progres s aktuálnou hodnotou')
    click('.an-link'); b.wait_for("document.querySelector('.chart-line')")
    check(b.eval("location.hash") == '#/exercises/lib-bench-press/analytics' and 'Všetky plány' in text('.tags'), 'analytika cviku naprieč plánmi')

    # ── Súhrn tréningu: nový rekord ──
    go('/history/w7', "document.querySelector('.summary-stats')")
    shot('summary')
    badges = texts('.pr-badge')
    check(len(badges) == 1 and 'Max. opakovaní 18 opak.' in badges[0], f'súhrn: nový rekord pri klikoch ({badges})')
    check('Nové rekordy: 1' in text('.pr-summary'), 'súhrn: počet rekordov')
    go('/history/w0', "document.querySelector('.summary-stats')")
    check(count('.pr-badge') == 0, 'prvý tréning nemá s čím porovnať → bez rekordov')

    # ── Nastavenie stagnácie v pláne ──
    go(f'/plans/{pid}/edit', "document.querySelector('.stagnation-edit')")
    shot('plan-edit')
    b.eval("""(()=>{const el=document.querySelectorAll('.stagnation-edit input')[0]; el.value='8';
      el.dispatchEvent(new Event('input',{bubbles:true}))})()""")
    click_text('.text-btn', 'Uložiť'); settle(0.8)
    st = mod('db/plans.js', f"m.getPlan('{pid}')")['stagnation']
    check(st == {'sessions': 8, 'minGainPct': 1}, f'stagnácia uložená v pláne ({st})')
    go(f'/plans/{pid}/analytics', "document.querySelector('.an-row')")
    alerts = texts('.alert .alert-text')
    check(len(alerts) == 1 and texts('.alert-title') == ['Plank'], f'po 8 tréningoch tlak už nestagnuje ({alerts})')
    check(alerts[0] == 'Stagnácia · posledných 8 tréningov −3,1 %', f'plank za 8 tréningov: mierny pokles = stagnácia ({alerts[0]})')

    # ── Prázdne stavy ──
    empty = b.eval("import('./src/db/plans.js').then(p=>p.savePlan({name:'Prázdny', days:[p.newDay('A')]}))")
    go(f"/plans/{empty['id']}/analytics", "document.querySelector('.empty')")
    check('Zatiaľ žiadne tréningy' in text('.empty-title'), 'plán bez tréningov: prázdny stav')
    go('/exercises/lib-incline-bench-press', "document.querySelector('.stats')")
    check(not exists('.an-link'), 'cvik bez histórie nemá odkaz na progres')

    errs = [c for c in b.console if c.startswith('EXC')]
    check(not errs, f'žiadne chyby v konzole {errs}')
    print(f'\n{ok} kontrol OK')
finally:
    b.close()
