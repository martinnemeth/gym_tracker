import { html, useState, useEffect } from '../lib.js';
import { getPlan, savePlan, newDay, newPlanExercise, defaultDayName, DEFAULT_REST_SEC } from '../db/plans.js';
import { listExercises } from '../db/exercises.js';
import { supersedePending, TARGET_FIELDS } from '../db/recommendations.js';
import { incrementOf } from '../progression.js';
import { DEFAULT_STAGNATION, lastSessions } from '../analytics.js';
import { navigate, goBack } from '../router.js';
import { parseNum, formatNum } from '../format.js';
import { AppHeader, IconButton, TextButton, AddRow, Tag, Icon, Loading, ErrorBox, EmptyState, showToast } from '../ui/components.js';
import { ExercisePicker } from '../ui/ExercisePicker.js';

// Číselné polia cviku v pláne sa počas úprav držia ako text (kvôli "62,"), na čísla sa menia pri uložení.
const NUM_FIELDS = ['sets', 'repMin', 'repMax', 'durationSec', 'weight', 'restSec', 'increment'];

const peToForm = (pe) => ({ ...pe, ...Object.fromEntries(NUM_FIELDS.map((k) => [k, formatNum(pe[k])])) });

function peFromForm(pe) {
  const int = (v) => { const n = parseNum(v); return n !== null && n > 0 ? Math.round(n) : null; };
  let repMin = int(pe.repMin);
  let repMax = int(pe.repMax);
  if (repMin && !repMax) repMax = repMin;
  if (repMax && !repMin) repMin = repMax;
  if (repMin > repMax) [repMin, repMax] = [repMax, repMin];
  const weight = parseNum(pe.weight);
  const rest = parseNum(pe.restSec);
  const increment = parseNum(pe.increment);
  return {
    ...pe,
    sets: int(pe.sets) || 1,
    repMin,
    repMax,
    durationSec: int(pe.durationSec),
    weight: weight !== null && weight > 0 ? weight : null,
    restSec: rest !== null && rest >= 0 ? Math.round(rest) : DEFAULT_REST_SEC,
    increment: increment !== null && increment >= 0 ? increment : null,
  };
}

const targetChanged = (a, b) => !a || TARGET_FIELDS.some((k) => (a[k] ?? null) !== (b[k] ?? null));

const stagnationToForm = (st = {}) => {
  const { sessions, minGainPct } = { ...DEFAULT_STAGNATION, ...st };
  return { sessions: formatNum(sessions), minGainPct: formatNum(minGainPct) };
};

function stagnationFromForm(f) {
  const n = parseNum(f.sessions);
  const pct = parseNum(f.minGainPct);
  return {
    sessions: n !== null ? Math.min(20, Math.max(2, Math.round(n))) : DEFAULT_STAGNATION.sessions,
    minGainPct: pct !== null && pct >= 0 ? pct : DEFAULT_STAGNATION.minGainPct,
  };
}

const toForm = (plan) => ({
  name: plan.name,
  days: plan.days.map((d) => ({ ...d, exercises: d.exercises.map(peToForm) })),
  stagnation: stagnationToForm(plan.stagnation),
});

function move(list, index, delta) {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
}

function NumField({ label, value, onInput, decimal, placeholder }) {
  return html`
    <label class="pe-field">
      <span>${label}</span>
      <input type="text" inputmode=${decimal ? 'decimal' : 'numeric'} value=${value} placeholder=${placeholder}
        onInput=${(e) => onInput(e.currentTarget.value)} />
    </label>`;
}

function PlanExerciseEditor({ pe, exercise, index, count, onChange, onMove, onRemove }) {
  const type = exercise?.trackingType || 'weight_reps';
  const set = (k) => (v) => onChange({ ...pe, [k]: v });
  return html`
    <div class="pe-edit">
      <div class="pe-edit-head">
        <div class="pe-edit-name">
          ${exercise?.name || 'Neznámy cvik'}
          ${exercise?.deletedAt && html` <${Tag} kind="muted">zmazaný</${Tag}>`}
        </div>
        <div class="tile-actions">
          <${IconButton} class="tile sm" icon=${Icon.up()} label="Posunúť hore" disabled=${index === 0} onClick=${() => onMove(-1)} />
          <${IconButton} class="tile sm" icon=${Icon.down()} label="Posunúť dole" disabled=${index === count - 1} onClick=${() => onMove(1)} />
          <${IconButton} class="tile sm danger" icon=${Icon.trash(18)} label="Odstrániť cvik" onClick=${onRemove} />
        </div>
      </div>
      <div class="pe-fields">
        <${NumField} label="Série" value=${pe.sets} onInput=${set('sets')} />
        ${type === 'time'
          ? html`<${NumField} label="Čas (s)" value=${pe.durationSec} onInput=${set('durationSec')} />`
          : html`
            <div class="pe-field">
              <span>Opakovania</span>
              <div class="pe-range">
                <input type="text" inputmode="numeric" aria-label="Opakovania od" value=${pe.repMin}
                  onInput=${(e) => set('repMin')(e.currentTarget.value)} />
                <span>–</span>
                <input type="text" inputmode="numeric" aria-label="Opakovania do" value=${pe.repMax}
                  onInput=${(e) => set('repMax')(e.currentTarget.value)} />
              </div>
            </div>`}
        <${NumField} label=${type === 'bodyweight_reps' ? '+kg' : 'kg'} decimal value=${pe.weight} placeholder="–"
          onInput=${set('weight')} />
        <${NumField} label="Pauza" value=${pe.restSec} onInput=${set('restSec')} />
        <${NumField} label=${type === 'time' ? 'Krok (s)' : 'Krok'} decimal value=${pe.increment}
          placeholder=${formatNum(incrementOf({ ...pe, durationSec: parseNum(pe.durationSec), increment: null }, exercise))}
          onInput=${set('increment')} />
      </div>
    </div>`;
}

export function PlanEditScreen({ params }) {
  const isNew = !params.id;
  const [state, setState] = useState({ loading: true, error: null, initial: null, exercises: new Map() });
  const [form, setForm] = useState(null);
  const [pickerDay, setPickerDay] = useState(null); // id dňa, do ktorého pridávame cviky
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await listExercises({ includeDeleted: true });
      const exercises = new Map(all.map((e) => [e.id, e]));
      if (isNew) return { initial: { name: '', days: [newDay(defaultDayName(0))], stagnation: stagnationToForm() }, exercises };
      const plan = await getPlan(params.id);
      return { initial: plan && !plan.deletedAt ? toForm(plan) : null, exercises };
    })().then(
      ({ initial, exercises }) => { setState({ loading: false, error: null, initial, exercises }); setForm(initial); },
      (error) => setState({ loading: false, error, initial: null, exercises: new Map() }),
    );
  }, [params.id]);

  const backPath = isNew ? '/plans' : `/plans/${params.id}`;
  const title = isNew ? 'Nový plán' : 'Upraviť plán';
  const shell = (body) => html`<div class="screen"><${AppHeader} title=${title} back=${backPath} />${body}</div>`;
  if (state.loading) return shell(html`<${Loading} />`);
  if (state.error) return shell(html`<${ErrorBox} error=${state.error} />`);
  if (!state.initial) return shell(html`<${EmptyState} title="Plán neexistuje" />`);

  const dirty = JSON.stringify(form) !== JSON.stringify(state.initial);
  const errors = {
    name: !form.name.trim() ? 'Zadaj názov plánu.' : null,
    days: form.days.length === 0 ? 'Pridaj aspoň jeden deň.' : null,
  };
  const valid = !errors.name && !errors.days;

  const setDays = (fn) => setForm((f) => ({ ...f, days: fn(f.days) }));
  const updateDay = (id, fn) => setDays((days) => days.map((d) => (d.id === id ? fn(d) : d)));

  function addExercises(dayId, picked) {
    updateDay(dayId, (d) => ({ ...d, exercises: [...d.exercises, ...picked.map((ex) => peToForm(newPlanExercise(ex)))] }));
  }

  function removeDay(day) {
    if (day.exercises.length && !confirm(`Odstrániť „${day.name || 'deň'}“ aj s cvikmi?`)) return;
    setDays((days) => days.filter((d) => d.id !== day.id));
  }

  function cancel() {
    if (dirty && !confirm('Zahodiť neuložené zmeny?')) return;
    goBack(backPath);
  }

  async function save() {
    setSubmitted(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      // Ručná zmena cieľa: zapamätá sa čas (placeholdery v tréningu) a čakajúce odporúčania stratia platnosť.
      const before = new Map(state.initial.days.flatMap((d) => d.exercises).map((pe) => [pe.id, peFromForm(pe)]));
      const now = Date.now();
      const changed = [];
      const days = form.days.map((d, i) => ({
        ...d,
        name: d.name.trim() || defaultDayName(i),
        exercises: d.exercises.map((pe) => {
          const next = peFromForm(pe);
          if (!targetChanged(before.get(pe.id), next)) return next;
          changed.push(pe.id);
          return { ...next, targetUpdatedAt: now };
        }),
      }));
      const saved = await savePlan({ id: params.id, name: form.name, days, stagnation: stagnationFromForm(form.stagnation) });
      await supersedePending(changed);
      showToast(isNew ? 'Plán vytvorený' : 'Uložené');
      if (isNew) navigate(`/plans/${saved.id}`, { replace: true });
      else goBack(backPath);
    } catch (err) {
      setSaving(false);
      alert(`Uloženie zlyhalo: ${err.message}`);
    }
  }

  return html`
    <div class="screen">
      <${AppHeader} title=${title}
        left=${html`<${TextButton} onClick=${cancel}>Zrušiť</${TextButton}>`}
        right=${html`<${TextButton} pill onClick=${save} disabled=${saving}>Uložiť</${TextButton}>`} />

      <form class="form" onSubmit=${(e) => { e.preventDefault(); save(); }}>
        <label class="field">
          <span class="field-label">Názov plánu</span>
          <span class="input-icon">
            ${Icon.edit(18)}
            <input type="text" value=${form.name} placeholder="napr. Horná / dolná polovica" autocomplete="off"
              onInput=${(e) => { const name = e.currentTarget.value; setForm((f) => ({ ...f, name })); }} />
          </span>
          ${submitted && errors.name && html`<span class="field-error">${errors.name}</span>`}
        </label>

        <div class="field">
          <span class="field-label">Tréningové dni</span>
          ${submitted && errors.days && html`<span class="field-error">${errors.days}</span>`}
          ${form.days.map((day, di) => html`
            <div class="card day-edit" key=${day.id}>
              <div class="day-edit-head">
                <span class="day-badge">${di + 1}</span>
                <input type="text" class="day-name-input" value=${day.name} placeholder=${defaultDayName(di)}
                  aria-label="Názov dňa" autocomplete="off"
                  onInput=${(e) => { const name = e.currentTarget.value; updateDay(day.id, (d) => ({ ...d, name })); }} />
                <div class="tile-actions">
                  <${IconButton} class="tile" icon=${Icon.up()} label="Posunúť deň hore" disabled=${di === 0}
                    onClick=${() => setDays((days) => move(days, di, -1))} />
                  <${IconButton} class="tile" icon=${Icon.down()} label="Posunúť deň dole" disabled=${di === form.days.length - 1}
                    onClick=${() => setDays((days) => move(days, di, 1))} />
                  <${IconButton} class="tile danger" icon=${Icon.trash(18)} label="Odstrániť deň" onClick=${() => removeDay(day)} />
                </div>
              </div>
              ${day.exercises.map((pe, pi) => html`
                <${PlanExerciseEditor} key=${pe.id} pe=${pe} exercise=${state.exercises.get(pe.exerciseId)}
                  index=${pi} count=${day.exercises.length}
                  onChange=${(next) => updateDay(day.id, (d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === pe.id ? next : x)) }))}
                  onMove=${(delta) => updateDay(day.id, (d) => ({ ...d, exercises: move(d.exercises, pi, delta) }))}
                  onRemove=${() => updateDay(day.id, (d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== pe.id) }))} />`)}
              <${AddRow} circle onClick=${() => setPickerDay(day.id)}>Pridať cvik</${AddRow}>
            </div>`)}
          <div class="card group add-day">
            <${AddRow} circle onClick=${() => setDays((days) => [...days, newDay(defaultDayName(days.length))])}>Pridať deň</${AddRow}>
          </div>
          <p class="section-footer">
            Krok: o koľko odporúčanie progresie zvýši váhu (pri časových cvikoch čas).
            Prázdne = podľa vybavenia, 0 = bez odporúčaní.
          </p>
        </div>

        <div class="field">
          <span class="field-label">Upozornenie na stagnáciu</span>
          <div class="card stagnation-edit">
            <div class="pe-fields split">
              <${NumField} label="Tréningov" value=${form.stagnation.sessions}
                onInput=${(v) => setForm((f) => ({ ...f, stagnation: { ...f.stagnation, sessions: v } }))} />
              <${NumField} label="Min. nárast %" decimal value=${form.stagnation.minGainPct}
                onInput=${(v) => setForm((f) => ({ ...f, stagnation: { ...f.stagnation, minGainPct: v } }))} />
            </div>
          </div>
          <p class="section-footer">
            Cvik stagnuje, ak za ${lastSessions(stagnationFromForm(form.stagnation).sessions)}${' '}
            nevzrástol aspoň o ${form.stagnation.minGainPct || DEFAULT_STAGNATION.minGainPct} % (odhad 1RM, opakovania alebo čas).
          </p>
        </div>
      </form>

      <${ExercisePicker} open=${!!pickerDay} onClose=${() => setPickerDay(null)}
        onPick=${(picked) => {
          picked.forEach((ex) => state.exercises.set(ex.id, ex));
          addExercises(pickerDay, picked);
        }} />
    </div>`;
}
