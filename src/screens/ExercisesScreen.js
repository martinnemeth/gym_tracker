import { html, useState, useMemo } from '../lib.js';
import { listExercises, undeleteExercise } from '../db/exercises.js';
import { MUSCLE_GROUPS, EQUIPMENT } from '../data/taxonomy.js';
import { normalize } from '../util.js';
import { navigate } from '../router.js';
import {
  LargeHeader, NavBar, Section, Row, Chip, EmptyState, Loading, ErrorBox, Icon, useAsync, showToast,
} from '../ui/components.js';

// Filtre prežijú návrat z detailu cviku (platia do zatvorenia aplikácie).
const filterState = { query: '', muscle: null, equipment: null };

function subtitleOf(ex) {
  const muscles = ex.muscleGroups.map((m) => MUSCLE_GROUPS[m] || m).join(', ');
  return `${muscles} · ${EQUIPMENT[ex.equipment] || ex.equipment}`;
}

function matchesQuery(ex, q) {
  if (!q) return true;
  return [ex.name, ...(ex.aliases || [])].some((s) => normalize(s).includes(q));
}

export function ExercisesScreen() {
  const { data, loading, error } = useAsync(() => listExercises());
  const [query, setQuery] = useState(filterState.query);
  const [muscle, setMuscle] = useState(filterState.muscle);
  const [equipment, setEquipment] = useState(filterState.equipment);
  Object.assign(filterState, { query, muscle, equipment });

  const filtered = useMemo(() => {
    const q = normalize(query);
    return (data || []).filter((ex) =>
      matchesQuery(ex, q)
      && (!muscle || ex.muscleGroups.includes(muscle))
      && (!equipment || ex.equipment === equipment));
  }, [data, query, muscle, equipment]);

  // Bez hľadania zoskupíme podľa hlavnej partie (prvá v zozname).
  const groups = useMemo(() => {
    if (query || muscle) return [[null, filtered]];
    const byMuscle = new Map(Object.keys(MUSCLE_GROUPS).map((k) => [k, []]));
    for (const ex of filtered) {
      const key = byMuscle.has(ex.muscleGroups[0]) ? ex.muscleGroups[0] : 'core';
      byMuscle.get(key).push(ex);
    }
    return [...byMuscle].filter(([, list]) => list.length);
  }, [filtered, query, muscle]);

  const addButton = html`
    <button class="icon-btn" aria-label="Nový cvik" onClick=${() => navigate('/exercises/new')}><${Icon.plus} /></button>`;

  return html`
    <div class="screen">
      <${LargeHeader} title="Cviky" right=${addButton} />
      <div class="search">
        <${Icon.search} />
        <input type="search" placeholder="Hľadať cvik" value=${query}
          onInput=${(e) => setQuery(e.currentTarget.value)} autocomplete="off" />
        ${query && html`<button class="search-clear" aria-label="Vymazať" onClick=${() => setQuery('')}><${Icon.x} /></button>`}
      </div>
      <div class="chips-scroll">
        <${Chip} active=${!muscle} onClick=${() => setMuscle(null)}>Všetky partie</${Chip}>
        ${Object.entries(MUSCLE_GROUPS).map(([k, label]) => html`
          <${Chip} active=${muscle === k} onClick=${() => setMuscle(muscle === k ? null : k)}>${label}</${Chip}>`)}
      </div>
      <div class="chips-scroll">
        <${Chip} active=${!equipment} onClick=${() => setEquipment(null)}>Všetko vybavenie</${Chip}>
        ${Object.entries(EQUIPMENT).map(([k, label]) => html`
          <${Chip} active=${equipment === k} onClick=${() => setEquipment(equipment === k ? null : k)}>${label}</${Chip}>`)}
      </div>

      ${loading && !data && html`<${Loading} />`}
      ${error && html`<${ErrorBox} error=${error} />`}
      ${data && filtered.length === 0 && html`
        <${EmptyState} title="Nič sa nenašlo"
          text=${query ? `Cvik „${query}“ nie je v knižnici.` : 'Pre zvolený filter nie sú žiadne cviky.'}
          action=${html`<button class="btn" onClick=${() => navigate('/exercises/new')}>Vytvoriť nový cvik</button>`} />`}

      ${groups.map(([key, list]) => html`
        <${Section} key=${key || 'all'} title=${key ? MUSCLE_GROUPS[key] : `${list.length} cvikov`}>
          ${list.map((ex) => html`
            <${Row} key=${ex.id} href=${`#/exercises/${ex.id}`} title=${ex.name} subtitle=${subtitleOf(ex)} chevron />`)}
        </${Section}>`)}
    </div>`;
}

export function DeletedExercisesScreen() {
  const { data, loading, error, reload } = useAsync(async () =>
    (await listExercises({ includeDeleted: true })).filter((e) => e.deletedAt));

  async function restore(ex) {
    await undeleteExercise(ex.id);
    showToast(`„${ex.name}“ obnovený`);
    reload();
  }

  return html`
    <div class="screen">
      <${NavBar} title="Zmazané cviky" back="/more" backLabel="Viac" />
      ${loading && !data && html`<${Loading} />`}
      ${error && html`<${ErrorBox} error=${error} />`}
      ${data && data.length === 0 && html`<${EmptyState} title="Žiadne zmazané cviky" />`}
      ${data && data.length > 0 && html`
        <${Section} footer="Zmazané cviky sa nezobrazujú v knižnici, ale ich história ostáva zachovaná.">
          ${data.map((ex) => html`
            <${Row} key=${ex.id} title=${ex.name} subtitle=${subtitleOf(ex)}
              value=${html`<button class="btn-link" onClick=${() => restore(ex)}>Obnoviť</button>`} />`)}
        </${Section}>`}
    </div>`;
}
