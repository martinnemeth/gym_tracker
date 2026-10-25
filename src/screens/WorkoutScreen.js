import { html, useState, useEffect, useRef } from '../lib.js';
import {
  getWorkout, getWorkoutSets, saveWorkout, saveSet, deleteSet, deleteWorkoutExerciseSets,
  finishWorkout, deleteWorkout, getActiveWorkout, startWorkout, lastPerformance, newWorkoutExercise,
} from '../db/workouts.js';
import { DEFAULT_REST_SEC } from '../db/plans.js';
import { listExercises } from '../db/exercises.js';
import { generateForWorkout, listPending, TARGET_FIELDS } from '../db/recommendations.js';
import { navigate, navigateRoot, goBack } from '../router.js';
import { parseNum, formatNum, formatClock, formatRest, formatDateLong, setLabel, targetLabel, plural } from '../format.js';
import {
  AppHeader, IconButton, ActionSheet, PrimaryButton, TextButton, AddRow, EmptyState,
  Loading, ErrorBox, Icon, useNow, showToast,
} from '../ui/components.js';
import { ExercisePicker } from '../ui/ExercisePicker.js';
import { startRest, stopRest, unlockAudio, useRestDismissed } from '../ui/RestTimer.js';
import { SetTimer } from '../ui/SetTimer.js';
import { RecommendationItem, useRecommendationActions } from '../ui/Recommendations.js';

/** Začne tréning (dňa plánu alebo voľný). Ak už iný prebieha, ponúkne návrat doň. */
export async function beginWorkout(plan, dayId) {
  const active = await getActiveWorkout();
  if (active) {
    if (confirm(`Prebieha tréning „${active.dayName}“. Pokračovať v ňom?`)) navigate(`/workout/${active.id}`);
    return;
  }
  const workout = await startWorkout(plan, dayId);
  navigate(`/workout/${workout.id}`);
}

const FIELDS = { weight_reps: ['weight', 'reps'], bodyweight_reps: ['weight', 'reps'], time: ['weight', 'durationSec'] };

/** Obrazovka nezhasne počas tréningu (ak to prehliadač podporuje). */
function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || !navigator.wakeLock) return undefined;
    let lock = null;
    const acquire = async () => {
      try { if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch { /* nepodporované */ }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}

/**
 * Predvolené hodnoty riadku (zobrazené ako placeholder, použijú sa pri odškrtnutí prázdneho riadku):
 * rovnaká séria minule → predchádzajúca odcvičená séria teraz → posledná séria minule → cieľ z plánu.
 * Ak sa cieľ v pláne zmenil po poslednom výkone (napr. prijaté odporúčanie), má prednosť pred „minule".
 */
function rowDefaults(we, i, last, byIndex) {
  let prevNow = null;
  for (let j = i - 1; j >= 0 && !prevNow; j--) prevNow = byIndex.get(j) || null;
  const t = we.target;
  const lastSrc = last?.sets[i] || last?.sets[last.sets.length - 1] || null;
  if (t.updatedAt && (!last || t.updatedAt > last.performedAt)) {
    return {
      weight: prevNow ? prevNow.weight : t.weight ?? lastSrc?.weight ?? null,
      reps: prevNow?.reps ?? (t.repMin && t.repMin === t.repMax ? t.repMin : null),
      durationSec: prevNow?.durationSec ?? t.durationSec ?? null,
    };
  }
  const src = last?.sets[i] || prevNow || lastSrc;
  return {
    weight: src ? src.weight : t.weight ?? null,
    reps: src?.reps ?? (t.repMin && t.repMin === t.repMax ? t.repMin : null),
    durationSec: src?.durationSec ?? t.durationSec ?? null,
  };
}

function repsPlaceholder(t) {
  if (t.repMin && t.repMax && t.repMin !== t.repMax) return `${t.repMin}–${t.repMax}`;
  return '–';
}

export function WorkoutScreen({ params }) {
  const [state, setState] = useState({ loading: true, error: null });
  const [workout, setWorkout] = useState(null);
  const [sets, setSets] = useState([]);
  const [exercises, setExercises] = useState(new Map());
  const [last, setLast] = useState(new Map()); // exerciseId → posledný výkon pred týmto tréningom
  const [drafts, setDrafts] = useState({}); // `${weId}:${index}` → { weight, reps, durationSec } ako text
  const [invalid, setInvalid] = useState(null); // { key, field }
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menu, setMenu] = useState(null); // 'workout' | id cviku v tréningu
  const [recs, setRecs] = useState(new Map()); // planExerciseId → čakajúce odporúčanie (iba počas tréningu)
  const [current, setCurrent] = useState(null); // kľúč riadku, ktorý je na rade (zvýraznený)
  const [stopwatch, setStopwatch] = useState(null); // { we, i, defaults, target } — bežia stopky časovej série

  // Keď používateľ zavrie pauzu ťuknutím, kurzor skočí do riadku, ktorý je na rade.
  // Handler sa mení s každým renderom; poslucháč je stabilný a volá aktuálny cez ref.
  const onRestDismissedRef = useRef(() => {});
  const [onRestDismissed] = useState(() => () => onRestDismissedRef.current());
  useRestDismissed(onRestDismissed);

  const active = workout?.status === 'active';
  const editing = workout?.status === 'done';
  const now = useNow(1000, active);
  useWakeLock(active);

  async function loadLast(w, exerciseIds) {
    const entries = await Promise.all([...new Set(exerciseIds)].map(async (id) =>
      [id, await lastPerformance(id, { before: w.startedAt, exclude: w.id })]));
    setLast((m) => new Map([...m, ...entries]));
  }

  useEffect(() => {
    (async () => {
      const w = await getWorkout(params.id);
      if (!w) return null;
      const [s, all] = await Promise.all([getWorkoutSets(w.id), listExercises({ includeDeleted: true })]);
      await loadLast(w, w.exercises.map((we) => we.exerciseId));
      const pending = w.status === 'active' && w.planId ? await listPending(w.planId) : [];
      return { w, s, all, pending };
    })().then(
      (r) => {
        if (r) {
          setWorkout(r.w); setSets(r.s); setExercises(new Map(r.all.map((e) => [e.id, e])));
          setRecs(new Map(r.pending.map((rec) => [rec.planExerciseId, rec])));
        }
        setState({ loading: false, error: null });
      },
      (error) => setState({ loading: false, error }),
    );
  }, [params.id]);

  // Prijaté odporúčanie zmení cieľ v pláne aj v tomto tréningu (placeholdery sa prepočítajú).
  const recActions = useRecommendationActions(async (rec, pe) => {
    setRecs((m) => { const n = new Map(m); n.delete(rec.planExerciseId); return n; });
    if (!pe) return;
    const patch = { ...Object.fromEntries(TARGET_FIELDS.map((k) => [k, pe[k]])), updatedAt: pe.targetUpdatedAt };
    const next = {
      ...workout,
      exercises: workout.exercises.map((x) => (x.planExerciseId === pe.id ? { ...x, target: { ...x.target, ...patch } } : x)),
    };
    setWorkout(next);
    await saveWorkout(next);
  });

  const back = editing ? `/history/${params.id}` : '/plans';
  const shell = (body) => html`<div class="screen"><${AppHeader} back=${back} />${body}</div>`;
  if (state.loading) return shell(html`<${Loading} />`);
  if (state.error) return shell(html`<${ErrorBox} error=${state.error} />`);
  if (!workout) return shell(html`<${EmptyState} title="Tréning neexistuje" text="Mohol byť zahodený alebo zmazaný." />`);

  const typeOf = (exerciseId) => exercises.get(exerciseId)?.trackingType || 'weight_reps';

  async function updateWorkout(fn) {
    const next = fn(workout);
    setWorkout(next);
    await saveWorkout(next);
  }

  function rowsOf(we, list = sets) {
    const weSets = list.filter((s) => s.workoutExerciseId === we.id);
    const byIndex = new Map(weSets.map((s) => [s.setIndex, s]));
    const count = Math.max(we.setCount, ...weSets.map((s) => s.setIndex + 1));
    return { byIndex, count };
  }

  const totals = workout.exercises.reduce((acc, we) => {
    const { byIndex, count } = rowsOf(we);
    return { done: acc.done + byIndex.size, planned: acc.planned + count };
  }, { done: 0, planned: 0 });

  const setDraft = (key, field, value) => {
    setDrafts((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
    if (invalid?.key === key) setInvalid(null);
  };
  const clearDraft = (key) => setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });

  /** Hodnota poľa riadku: rozpísaný text, inak predvolená hodnota. */
  function readField(key, field, fallback) {
    const raw = drafts[key]?.[field];
    if (raw !== undefined && raw.trim() !== '') return parseNum(raw);
    return fallback;
  }

  function validate(type, v) {
    if (type === 'time') return v.durationSec > 0 ? null : 'durationSec';
    if (!(v.reps > 0)) return 'reps';
    if (type === 'weight_reps' && !(v.weight >= 0 && v.weight !== null)) return 'weight';
    return null;
  }

  function focusField(key, field) {
    document.querySelector(`[data-key="${key}"][data-field="${field}"]`)?.focus();
  }

  /** Prvý nezapísaný riadok po riadku (weId, i) — v tom istom cviku, potom v ďalších. */
  function nextOpenRow(weId, i, list) {
    const start = workout.exercises.findIndex((x) => x.id === weId);
    for (let w = Math.max(0, start); w < workout.exercises.length; w++) {
      const x = workout.exercises[w];
      const { byIndex, count } = rowsOf(x, list);
      for (let r = w === start ? i + 1 : 0; r < count; r++) if (!byIndex.has(r)) return `${x.id}:${r}`;
    }
    return null;
  }

  /** Pole, do ktorého sa píše ako prvé (pri vlastnej váhe je prídavná váha nepovinná). */
  const firstField = (type) => (type === 'weight_reps' ? 'weight' : type === 'bodyweight_reps' ? 'reps' : null);

  async function toggleRow(we, i, defaults, logged, override = {}) {
    const key = `${we.id}:${i}`;
    const type = typeOf(we.exerciseId);
    if (logged) {
      await deleteSet(logged.id);
      setSets((ss) => ss.filter((s) => s.id !== logged.id));
      setDrafts((d) => ({ ...d, [key]: { weight: formatNum(logged.weight), reps: formatNum(logged.reps), durationSec: formatNum(logged.durationSec) } }));
      return;
    }
    const v = {
      weight: readField(key, 'weight', defaults.weight),
      reps: readField(key, 'reps', defaults.reps),
      durationSec: readField(key, 'durationSec', defaults.durationSec),
      ...override,
    };
    const bad = validate(type, v);
    if (bad) {
      setInvalid({ key, field: bad });
      focusField(key, bad);
      return;
    }
    document.activeElement?.blur?.();
    const set = await saveSet({
      workoutId: workout.id,
      workoutExerciseId: we.id,
      exerciseId: we.exerciseId,
      planExerciseId: we.planExerciseId,
      setIndex: i,
      weight: v.weight !== null && v.weight > 0 ? v.weight : (type === 'weight_reps' ? 0 : null),
      reps: type === 'time' ? null : Math.round(v.reps),
      durationSec: type === 'time' ? Math.round(v.durationSec) : null,
      performedAt: editing ? workout.finishedAt : Date.now(),
    });
    const nextSets = [...sets, set];
    setSets(nextSets);
    clearDraft(key);
    setInvalid(null);
    if (active) {
      const next = nextOpenRow(we.id, i, nextSets);
      setCurrent(next);
      if (next) {
        setTimeout(() => document.querySelector(`[data-row="${next}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      }
      // Po poslednej sérii cviku sa pauza nespúšťa — prechod k ďalšiemu cviku trvá rôzne dlho.
      const { byIndex, count } = rowsOf(we, nextSets);
      if (byIndex.size < count) startRest(we.target.restSec ?? DEFAULT_REST_SEC);
    }
  }

  /** Stopky časovej série: cieľ z poľa (alebo predvolený), inak chyba ako pri zápise. */
  function startStopwatch(we, i, defaults) {
    const key = `${we.id}:${i}`;
    const target = readField(key, 'durationSec', defaults.durationSec);
    if (!(target > 0)) {
      setInvalid({ key, field: 'durationSec' });
      focusField(key, 'durationSec');
      return;
    }
    unlockAudio();
    stopRest();
    document.activeElement?.blur?.();
    setCurrent(key);
    setStopwatch({ we, i, defaults, target: Math.round(target) });
  }

  /** Úprava už odcvičenej série — uloží sa pri opustení poľa. */
  async function commitLogged(we, i, logged) {
    const key = `${we.id}:${i}`;
    const d = drafts[key];
    if (!d) return;
    const type = typeOf(we.exerciseId);
    const v = {
      weight: d.weight !== undefined ? parseNum(d.weight) : logged.weight,
      reps: d.reps !== undefined ? parseNum(d.reps) : logged.reps,
      durationSec: d.durationSec !== undefined ? parseNum(d.durationSec) : logged.durationSec,
    };
    clearDraft(key);
    if (validate(type, v)) return; // neplatné → ostane pôvodná hodnota
    const next = {
      ...logged,
      weight: v.weight !== null && v.weight > 0 ? v.weight : (type === 'weight_reps' ? 0 : null),
      reps: type === 'time' ? null : Math.round(v.reps),
      durationSec: type === 'time' ? Math.round(v.durationSec) : null,
    };
    await saveSet(next);
    setSets((ss) => ss.map((s) => (s.id === next.id ? next : s)));
  }

  const addSet = (we) => updateWorkout((w) => ({
    ...w, exercises: w.exercises.map((x) => (x.id === we.id ? { ...x, setCount: rowsOf(x).count + 1 } : x)),
  }));

  function removeLastSet(we) {
    const { byIndex, count } = rowsOf(we);
    if (count <= 1 || byIndex.has(count - 1)) return;
    clearDraft(`${we.id}:${count - 1}`);
    updateWorkout((w) => ({ ...w, exercises: w.exercises.map((x) => (x.id === we.id ? { ...x, setCount: count - 1 } : x)) }));
  }

  function moveExercise(we, delta) {
    updateWorkout((w) => {
      const list = [...w.exercises];
      const i = list.findIndex((x) => x.id === we.id);
      const [item] = list.splice(i, 1);
      list.splice(i + delta, 0, item);
      return { ...w, exercises: list };
    });
  }

  async function removeExercise(we) {
    const { byIndex } = rowsOf(we);
    const name = exercises.get(we.exerciseId)?.name || 'cvik';
    if (byIndex.size && !confirm(`Odstrániť „${name}“ z tréningu?\n\nZapísané série (${byIndex.size}) sa zmažú.`)) return;
    await deleteWorkoutExerciseSets(workout.id, we.id);
    setSets((ss) => ss.filter((s) => s.workoutExerciseId !== we.id));
    await updateWorkout((w) => ({ ...w, exercises: w.exercises.filter((x) => x.id !== we.id) }));
  }

  async function addExercises(picked) {
    setExercises((m) => new Map([...m, ...picked.map((e) => [e.id, e])]));
    await updateWorkout((w) => ({ ...w, exercises: [...w.exercises, ...picked.map(newWorkoutExercise)] }));
    await loadLast(workout, picked.map((e) => e.id));
  }

  async function finish() {
    if (totals.done === 0) {
      if (confirm('Žiadna séria nie je zapísaná. Zahodiť tréning?')) await discard(true);
      return;
    }
    const missing = totals.planned - totals.done;
    const msg = missing > 0
      ? `Dokončiť tréning?\n\n${plural(missing, 'séria', 'série', 'sérií')} bez zápisu sa neuloží.`
      : 'Dokončiť tréning?';
    if (!confirm(msg)) return;
    await finishWorkout(workout.id);
    await generateForWorkout(workout.id);
    stopRest();
    showToast('Tréning uložený');
    navigate(`/history/${workout.id}`, { replace: true });
  }

  async function discard(confirmed = false) {
    const msg = active
      ? `Zahodiť tréning?${totals.done ? `\n\nZapísané série (${totals.done}) sa zmažú.` : ''}`
      : 'Natrvalo zmazať tréning z histórie?';
    if (!confirmed && !confirm(msg)) return;
    await deleteWorkout(workout.id);
    if (active) stopRest();
    showToast(active ? 'Tréning zahodený' : 'Tréning zmazaný');
    navigateRoot(active ? '/plans' : '/history');
  }

  /** Po úprave sérií v histórii sa odporúčania z tohto tréningu prepočítajú. */
  async function doneEditing() {
    document.activeElement?.blur?.();
    await generateForWorkout(workout.id);
    goBack(back);
  }

  // Riadok na rade: posledný nastavený, ak je ešte nezapísaný; inak prvý nezapísaný v tréningu.
  const currentKey = !active ? null : (() => {
    if (current) {
      const [weId, idx] = current.split(':');
      const we = workout.exercises.find((x) => x.id === weId);
      if (we) { const { byIndex, count } = rowsOf(we); if (+idx < count && !byIndex.has(+idx)) return current; }
    }
    return workout.exercises.length ? nextOpenRow(workout.exercises[0].id, -1, sets) : null;
  })();
  onRestDismissedRef.current = () => {
    if (!currentKey) return;
    const we = workout.exercises.find((x) => x.id === currentKey.split(':')[0]);
    const field = we && firstField(typeOf(we.exerciseId));
    if (field) focusField(currentKey, field);
    else document.querySelector(`[data-row="${currentKey}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const menuWe = menu && menu !== 'workout' ? workout.exercises.find((x) => x.id === menu) : null;
  const menuWeIndex = menuWe ? workout.exercises.indexOf(menuWe) : -1;
  const menuWeRows = menuWe ? rowsOf(menuWe) : null;

  const headerRight = active
    ? html`
      <button type="button" class="btn btn-primary btn-sm btn-finish" onClick=${finish}>${Icon.check(18)}<span>Dokončiť</span></button>
      <${IconButton} icon=${Icon.more()} label="Možnosti tréningu" onClick=${() => setMenu('workout')} />`
    : html`<${TextButton} pill onClick=${doneEditing}>Hotovo</${TextButton}>`;

  return html`
    <div class="screen">
      <${AppHeader} back=${back} backLabel=${editing ? 'Súhrn' : 'Domov'} right=${headerRight} />

      <div class="detail-head">
        <h1 class="page-title">${workout.dayName}</h1>
        <div class="workout-meta">
          ${active
            ? html`<span class="workout-clock">${Icon.timer(20)}${formatClock((now - workout.startedAt) / 1000)}</span>`
            : html`<span>${formatDateLong(workout.startedAt)}</span>`}
          ${workout.planName && html`<span class="workout-plan">${workout.planName}</span>`}
          <span class="workout-count"><b>${totals.done}/${totals.planned}</b> sérií</span>
        </div>
      </div>

      ${workout.exercises.length === 0 && html`
        <${EmptyState} title="Zatiaľ žiadne cviky" text="Pridaj cviky, ktoré ideš cvičiť."
          action=${html`<${PrimaryButton} icon=${Icon.plus()} onClick=${() => setPickerOpen(true)}>Pridať cvik</${PrimaryButton}>`} />`}

      ${workout.exercises.map((we) => {
        const ex = exercises.get(we.exerciseId);
        const type = typeOf(we.exerciseId);
        const [wField, rField] = FIELDS[type];
        const lastPerf = last.get(we.exerciseId);
        const { byIndex, count } = rowsOf(we);
        const target = targetLabel(we.target, type);
        const rec = active && we.planExerciseId ? recs.get(we.planExerciseId) : null;
        return html`
          <section class="card we-card" key=${we.id}>
            <div class="we-head">
              <button type="button" class="we-title" onClick=${() => navigate(`/exercises/${we.exerciseId}`)}>
                <div class="we-name">${ex?.name || 'Neznámy cvik'}</div>
                <div class="we-target">${target || 'Bez cieľa'} · pauza ${formatRest(we.target.restSec)}</div>
              </button>
              <${IconButton} class="plain" icon=${Icon.more()} label="Možnosti cviku" onClick=${() => setMenu(we.id)} />
            </div>
            ${rec && html`
              <${RecommendationItem} compact rec=${rec} exercise=${ex} busy=${recActions.busy}
                onAccept=${() => recActions.accept(rec)} onDismiss=${() => recActions.dismiss(rec)} />`}
            <div class="set-grid set-grid-head" aria-hidden="true">
              <span>#</span><span>Minule</span>
              <span>${type === 'weight_reps' ? 'kg' : '+kg'}</span>
              <span>${type === 'time' ? 'Sek.' : 'Opak.'}</span><span />
            </div>
            ${Array.from({ length: count }, (_, i) => {
              const key = `${we.id}:${i}`;
              const logged = byIndex.get(i);
              const defaults = rowDefaults(we, i, lastPerf, byIndex);
              const d = drafts[key] || {};
              const val = (field) => (d[field] !== undefined ? d[field] : logged ? formatNum(logged[field]) : '');
              const ph = (field) => (defaults[field] !== null && defaults[field] !== undefined
                ? formatNum(defaults[field]) : field === 'reps' ? repsPlaceholder(we.target) : '–');
              const input = (field, decimal) => html`
                <input type="text" class=${`set-input ${invalid?.key === key && invalid.field === field ? 'invalid' : ''}`}
                  inputmode=${decimal ? 'decimal' : 'numeric'} enterkeyhint="done" autocomplete="off"
                  data-key=${key} data-field=${field} value=${val(field)} placeholder=${ph(field)}
                  aria-label=${`Séria ${i + 1}: ${field === 'weight' ? 'váha' : field === 'reps' ? 'opakovania' : 'sekundy'}`}
                  onInput=${(e) => setDraft(key, field, e.currentTarget.value)}
                  onBlur=${() => logged && commitLogged(we, i, logged)} />`;
              return html`
                <div class=${`set-grid set-row ${logged ? 'done' : ''} ${key === currentKey ? 'current' : ''}`} key=${key} data-row=${key}>
                  <span class="set-idx">${i + 1}</span>
                  <span class="set-prev">${lastPerf?.sets[i] ? setLabel(lastPerf.sets[i], type, { compact: true }) : '–'}</span>
                  ${input(wField, true)}
                  ${input(rField, false)}
                  ${type === 'time' && active && !logged && !(d.durationSec || '').trim()
                    ? html`
                      <button type="button" class="set-check play" aria-label=${`Spustiť stopky pre sériu ${i + 1}`}
                        onClick=${() => startStopwatch(we, i, defaults)}>${Icon.play(18)}</button>`
                    : html`
                      <button type="button" class="set-check" aria-pressed=${!!logged}
                        aria-label=${logged ? `Zrušiť sériu ${i + 1}` : `Zapísať sériu ${i + 1}`}
                        onClick=${() => toggleRow(we, i, defaults, logged)}>${Icon.check(18)}</button>`}
                </div>`;
            })}
            <button type="button" class="we-add-set" onClick=${() => addSet(we)}>${Icon.plus(18)}<span>Pridať sériu</span></button>
          </section>`;
      })}

      ${workout.exercises.length > 0 && html`
        <section class="section">
          <div class="card group"><${AddRow} class="center" onClick=${() => setPickerOpen(true)}>Pridať cvik</${AddRow}></div>
        </section>`}

      ${active && html`
        <section class="section workout-actions">
          <${PrimaryButton} block icon=${Icon.check()} onClick=${finish}>Dokončiť tréning</${PrimaryButton}>
          <${TextButton} danger onClick=${() => discard()}>Zahodiť tréning</${TextButton}>
        </section>`}

      ${stopwatch && html`
        <${SetTimer} key=${`${stopwatch.we.id}:${stopwatch.i}`}
          name=${exercises.get(stopwatch.we.exerciseId)?.name || 'Séria'} targetSec=${stopwatch.target}
          onCancel=${() => setStopwatch(null)}
          onFinish=${(sec) => {
            const { we, i, defaults } = stopwatch;
            setStopwatch(null);
            toggleRow(we, i, defaults, null, { durationSec: sec });
          }} />`}

      <${ExercisePicker} open=${pickerOpen} onClose=${() => setPickerOpen(false)} onPick=${addExercises} />

      <${ActionSheet} open=${menu === 'workout'} title=${workout.dayName} onClose=${() => setMenu(null)}
        actions=${[
          { label: 'Pridať cvik', icon: Icon.plus(), onClick: () => setPickerOpen(true) },
          { label: active ? 'Zahodiť tréning' : 'Zmazať tréning', icon: Icon.trash(), danger: true, onClick: () => discard() },
        ]} />

      <${ActionSheet} open=${!!menuWe} title=${menuWe && (exercises.get(menuWe.exerciseId)?.name || 'Cvik')}
        onClose=${() => setMenu(null)}
        actions=${menuWe ? [
          { label: 'Technika a detail cviku', icon: Icon.clipboardCheck(), onClick: () => navigate(`/exercises/${menuWe.exerciseId}`) },
          { label: 'Pridať sériu', icon: Icon.plus(), onClick: () => addSet(menuWe) },
          ...(menuWeRows.count > 1 && !menuWeRows.byIndex.has(menuWeRows.count - 1)
            ? [{ label: 'Odobrať poslednú sériu', icon: Icon.x(20), onClick: () => removeLastSet(menuWe) }] : []),
          ...(menuWeIndex > 0 ? [{ label: 'Posunúť vyššie', icon: Icon.up(20), onClick: () => moveExercise(menuWe, -1) }] : []),
          ...(menuWeIndex < workout.exercises.length - 1
            ? [{ label: 'Posunúť nižšie', icon: Icon.down(20), onClick: () => moveExercise(menuWe, 1) }] : []),
          { label: 'Odstrániť z tréningu', icon: Icon.trash(), danger: true, onClick: () => removeExercise(menuWe) },
        ] : []} />
    </div>`;
}
