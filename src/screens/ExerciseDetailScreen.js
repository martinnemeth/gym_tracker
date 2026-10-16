import { html, useState } from '../lib.js';
import { getExercise, exerciseUsage, deleteExercise, undeleteExercise } from '../db/exercises.js';
import { MUSCLE_GROUPS, EQUIPMENT, TRACKING_TYPES } from '../data/taxonomy.js';
import { navigate, goBack } from '../router.js';
import {
  NavBar, Section, Row, Tag, Loading, ErrorBox, EmptyState, Icon, useAsync, showToast,
} from '../ui/components.js';

export function ExerciseDetailScreen({ params }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const ex = await getExercise(params.id);
    return ex ? { ex, usage: await exerciseUsage(ex.id) } : null;
  }, [params.id]);
  const [checked, setChecked] = useState(() => new Set());

  if (loading && !data) return html`<div class="screen"><${NavBar} back="/exercises" backLabel="Cviky" /><${Loading} /></div>`;
  if (error) return html`<div class="screen"><${NavBar} back="/exercises" backLabel="Cviky" /><${ErrorBox} error=${error} /></div>`;
  if (!data) {
    return html`<div class="screen"><${NavBar} back="/exercises" backLabel="Cviky" />
      <${EmptyState} title="Cvik neexistuje" text="Mohol byť natrvalo zmazaný." /></div>`;
  }

  const { ex, usage } = data;
  const toggle = (id) => setChecked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  async function onDelete() {
    const soft = ex.builtIn || usage.setCount > 0 || usage.planNames.length > 0;
    const msg = soft
      ? `Zmazať „${ex.name}“?\n\nCvik sa skryje z knižnice. ${usage.setCount ? 'História sérií ostane zachovaná. ' : ''}Obnoviť ho môžeš vo Viac → Zmazané cviky.`
      : `Natrvalo zmazať „${ex.name}“?`;
    if (!confirm(msg)) return;
    await deleteExercise(ex.id);
    showToast('Cvik zmazaný');
    goBack('/exercises');
  }

  async function onRestore() {
    await undeleteExercise(ex.id);
    showToast('Cvik obnovený');
    reload();
  }

  const editBtn = !ex.deletedAt && html`
    <button class="nav-btn" onClick=${() => navigate(`/exercises/${ex.id}/edit`)}>Upraviť</button>`;

  return html`
    <div class="screen">
      <${NavBar} back="/exercises" backLabel="Cviky" right=${editBtn} />
      <div class="detail-head">
        <h1>${ex.name}</h1>
        <div class="tags">
          ${ex.muscleGroups.map((m, i) => html`<${Tag} kind=${i === 0 ? 'primary' : ''}>${MUSCLE_GROUPS[m] || m}</${Tag}>`)}
          <${Tag} kind="muted">${EQUIPMENT[ex.equipment] || ex.equipment}</${Tag}>
          <${Tag} kind="muted">${TRACKING_TYPES[ex.trackingType]?.short}</${Tag}>
        </div>
      </div>

      ${ex.deletedAt && html`
        <div class="banner">
          <span>Tento cvik je zmazaný.</span>
          <button class="btn-link" onClick=${onRestore}>Obnoviť</button>
        </div>`}

      <section class="section">
        <div class="section-title-row">
          <h2 class="section-title">Technika</h2>
          ${checked.size > 0 && html`<button class="btn-link small" onClick=${() => setChecked(new Set())}>Resetovať</button>`}
        </div>
        ${ex.technique.length === 0
          ? html`<div class="group"><${Row} title="Zatiaľ žiadne body" subtitle="Pridaj ich cez Upraviť." /></div>`
          : html`
            <div class="group checklist">
              ${ex.technique.map((t) => html`
                <button key=${t.id} class=${`check-row ${checked.has(t.id) ? 'done' : ''}`} onClick=${() => toggle(t.id)}>
                  <span class="check-box">${checked.has(t.id) && html`<${Icon.check} />`}</span>
                  <span>${t.text}</span>
                </button>`)}
            </div>`}
      </section>

      ${ex.notes && html`
        <${Section} title="Poznámky"><div class="row notes">${ex.notes}</div></${Section}>`}

      <${Section} title="Použitie"
        footer="Grafy progresu, rekordy a odhad 1RM pribudnú s analytikou.">
        <${Row} title="Odcvičené série" value=${usage.setCount} />
        <${Row} title="V plánoch" value=${usage.planNames.length ? usage.planNames.join(', ') : '–'} />
        ${ex.aliases?.length > 0 && html`<${Row} title="Iné názvy" value=${ex.aliases.join(', ')} />`}
      </${Section}>

      ${!ex.deletedAt && html`
        <${Section}>
          <${Row} title="Zmazať cvik" danger onClick=${onDelete} />
        </${Section}>`}
    </div>`;
}
