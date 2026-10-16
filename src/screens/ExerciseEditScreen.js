import { html, useState, useEffect } from '../lib.js';
import { getExercise, saveExercise, listExercises } from '../db/exercises.js';
import { MUSCLE_GROUPS, EQUIPMENT, TRACKING_TYPES } from '../data/taxonomy.js';
import { navigate, goBack } from '../router.js';
import { NavBar, Chip, Icon, Loading, ErrorBox, EmptyState, showToast } from '../ui/components.js';
import { uuid, normalize } from '../util.js';

const EMPTY = {
  name: '',
  aliasesText: '',
  muscleGroups: [],
  equipment: 'barbell',
  trackingType: 'weight_reps',
  technique: [],
  notes: '',
};

function toForm(ex) {
  return {
    name: ex.name,
    aliasesText: (ex.aliases || []).join(', '),
    muscleGroups: [...ex.muscleGroups],
    equipment: ex.equipment,
    trackingType: ex.trackingType,
    technique: ex.technique.map((t) => ({ ...t })),
    notes: ex.notes || '',
  };
}

function autosize(el) {
  el.style.height = 'auto';
  if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
}

export function ExerciseEditScreen({ params }) {
  const isNew = !params.id;
  const [state, setState] = useState({ loading: true, error: null, initial: null, others: [] });
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await listExercises();
      const others = all.filter((e) => e.id !== params.id);
      if (isNew) return { initial: EMPTY, others };
      const ex = await getExercise(params.id);
      return { initial: ex ? toForm(ex) : null, others };
    })().then(
      ({ initial, others }) => { setState({ loading: false, error: null, initial, others }); if (initial) setForm(initial); },
      (error) => setState({ loading: false, error, initial: null, others: [] }),
    );
  }, [params.id]);

  const backPath = isNew ? '/exercises' : `/exercises/${params.id}`;
  const title = isNew ? 'Nový cvik' : 'Upraviť cvik';

  if (state.loading) return html`<div class="screen"><${NavBar} title=${title} back=${backPath} /><${Loading} /></div>`;
  if (state.error) return html`<div class="screen"><${NavBar} title=${title} back=${backPath} /><${ErrorBox} error=${state.error} /></div>`;
  if (!state.initial) return html`<div class="screen"><${NavBar} title=${title} back=${backPath} /><${EmptyState} title="Cvik neexistuje" /></div>`;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dirty = JSON.stringify(form) !== JSON.stringify(state.initial);
  const errors = {
    name: !form.name.trim() ? 'Zadaj názov cviku.' : null,
    muscleGroups: form.muscleGroups.length === 0 ? 'Vyber aspoň jednu partiu.' : null,
  };
  const valid = !errors.name && !errors.muscleGroups;
  const duplicate = form.name.trim()
    && state.others.find((e) => normalize(e.name) === normalize(form.name));

  function toggleMuscle(key) {
    set({
      muscleGroups: form.muscleGroups.includes(key)
        ? form.muscleGroups.filter((m) => m !== key)
        : [...form.muscleGroups, key],
    });
  }

  function chooseEquipment(key) {
    // Prirodzený typ sledovania pre cviky s vlastnou váhou.
    let { trackingType } = form;
    if (key === 'bodyweight' && trackingType === 'weight_reps') trackingType = 'bodyweight_reps';
    if (key !== 'bodyweight' && trackingType === 'bodyweight_reps') trackingType = 'weight_reps';
    set({ equipment: key, trackingType });
  }

  const updateStep = (id, text) =>
    set({ technique: form.technique.map((t) => (t.id === id ? { ...t, text } : t)) });
  const removeStep = (id) => set({ technique: form.technique.filter((t) => t.id !== id) });
  const addStep = () => set({ technique: [...form.technique, { id: uuid(), text: '' }] });
  function moveStep(index, delta) {
    const list = [...form.technique];
    const [item] = list.splice(index, 1);
    list.splice(index + delta, 0, item);
    set({ technique: list });
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
      const saved = await saveExercise({
        id: params.id,
        name: form.name,
        aliases: form.aliasesText.split(',').map((s) => s.trim()).filter(Boolean),
        muscleGroups: form.muscleGroups,
        equipment: form.equipment,
        trackingType: form.trackingType,
        technique: form.technique.map((t) => ({ ...t, text: t.text.trim() })).filter((t) => t.text),
        notes: form.notes.trim(),
      });
      showToast(isNew ? 'Cvik vytvorený' : 'Uložené');
      if (isNew) navigate(`/exercises/${saved.id}`, { replace: true });
      else goBack(backPath);
    } catch (err) {
      setSaving(false);
      alert(`Uloženie zlyhalo: ${err.message}`);
    }
  }

  return html`
    <div class="screen">
      <${NavBar} title=${title}
        left=${html`<button class="nav-btn" onClick=${cancel}>Zrušiť</button>`}
        right=${html`<button class="nav-btn strong" onClick=${save} disabled=${saving}>Uložiť</button>`} />

      <form class="form" onSubmit=${(e) => { e.preventDefault(); save(); }}>
        <label class="field">
          <span class="field-label">Názov</span>
          <input type="text" value=${form.name} placeholder="napr. Tlak na lavičke"
            onInput=${(e) => set({ name: e.currentTarget.value })} autocomplete="off" />
          ${submitted && errors.name && html`<span class="field-error">${errors.name}</span>`}
          ${duplicate && html`<span class="field-warn">Cvik s rovnakým názvom už existuje.</span>`}
        </label>

        <label class="field">
          <span class="field-label">Iné názvy (pre hľadanie)</span>
          <input type="text" value=${form.aliasesText} placeholder="oddeľ čiarkou, napr. bench press, benč"
            onInput=${(e) => set({ aliasesText: e.currentTarget.value })} autocomplete="off" />
        </label>

        <div class="field">
          <span class="field-label">Partie <span class="field-hint">— prvá zvolená je hlavná</span></span>
          <div class="chips-wrap">
            ${Object.entries(MUSCLE_GROUPS).map(([k, label]) => {
              const idx = form.muscleGroups.indexOf(k);
              return html`<${Chip} active=${idx >= 0} onClick=${() => toggleMuscle(k)}>
                ${idx === 0 ? '★ ' : ''}${label}</${Chip}>`;
            })}
          </div>
          ${submitted && errors.muscleGroups && html`<span class="field-error">${errors.muscleGroups}</span>`}
        </div>

        <div class="field">
          <span class="field-label">Vybavenie</span>
          <div class="chips-wrap">
            ${Object.entries(EQUIPMENT).map(([k, label]) => html`
              <${Chip} active=${form.equipment === k} onClick=${() => chooseEquipment(k)}>${label}</${Chip}>`)}
          </div>
        </div>

        <div class="field">
          <span class="field-label">Čo sa zapisuje</span>
          <div class="group">
            ${Object.entries(TRACKING_TYPES).map(([k, t]) => html`
              <label class="radio-row">
                <input type="radio" name="tracking" checked=${form.trackingType === k}
                  onChange=${() => set({ trackingType: k })} />
                <span>${t.label}</span>
              </label>`)}
          </div>
        </div>

        <div class="field">
          <span class="field-label">Technika (checklist)</span>
          <div class="group">
            ${form.technique.map((t, i) => html`
              <div class="step-row" key=${t.id}>
                <span class="step-num">${i + 1}.</span>
                <textarea rows="1" value=${t.text} placeholder="Bod techniky"
                  ref=${(el) => el && requestAnimationFrame(() => autosize(el))}
                  onInput=${(e) => { autosize(e.currentTarget); updateStep(t.id, e.currentTarget.value); }} />
                <div class="step-actions">
                  <button type="button" class="icon-btn small" aria-label="Posunúť hore" disabled=${i === 0}
                    onClick=${() => moveStep(i, -1)}><${Icon.up} /></button>
                  <button type="button" class="icon-btn small" aria-label="Posunúť dole" disabled=${i === form.technique.length - 1}
                    onClick=${() => moveStep(i, 1)}><${Icon.down} /></button>
                  <button type="button" class="icon-btn small danger" aria-label="Zmazať bod"
                    onClick=${() => removeStep(t.id)}><${Icon.trash} /></button>
                </div>
              </div>`)}
            <button type="button" class="row add-row" onClick=${addStep}>
              <${Icon.plus} /><span>Pridať bod</span>
            </button>
          </div>
        </div>

        <label class="field">
          <span class="field-label">Poznámky</span>
          <textarea rows="3" value=${form.notes} placeholder="napr. nastavenie sedadla 4, kladka na 2. dierke"
            onInput=${(e) => set({ notes: e.currentTarget.value })} />
        </label>
      </form>
    </div>`;
}
