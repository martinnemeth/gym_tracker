import { html, useState, useMemo } from '../lib.js';
import { listExercises, undeleteExercise } from '../db/exercises.js';
import { MUSCLE_GROUPS, EQUIPMENT } from '../data/taxonomy.js';
import { normalize } from '../util.js';
import { navigate } from '../router.js';
import {
  AppHeader, SearchField, FilterChip, IconButton, ExerciseListItem, BottomSheet,
  PrimaryButton, SecondaryButton, TextButton, EmptyState, Loading, ErrorBox, Icon, useAsync, showToast,
} from '../ui/components.js';

// Filtre prežijú návrat z detailu cviku (platia do zatvorenia aplikácie).
const filterState = { query: '', muscle: null, equipment: null };

function matchesQuery(ex, q) {
  if (!q) return true;
  return [ex.name, ...(ex.aliases || [])].some((s) => normalize(s).includes(q));
}

export function ExercisesScreen() {
  const { data, loading, error } = useAsync(() => listExercises());
  const [query, setQuery] = useState(filterState.query);
  const [muscle, setMuscle] = useState(filterState.muscle);
  const [equipment, setEquipment] = useState(filterState.equipment);
  const [sheetOpen, setSheetOpen] = useState(false);
  Object.assign(filterState, { query, muscle, equipment });

  const filtered = useMemo(() => {
    const q = normalize(query);
    return (data || []).filter((ex) =>
      matchesQuery(ex, q)
      && (!muscle || ex.muscleGroups.includes(muscle))
      && (!equipment || ex.equipment === equipment));
  }, [data, query, muscle, equipment]);

  // Bez hľadania a filtra partie zoskupíme podľa hlavnej partie (prvá v zozname).
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
    <${IconButton} icon=${Icon.plus()} label="Nový cvik" onClick=${() => navigate('/exercises/new')} />`;

  return html`
    <div class="screen">
      <${AppHeader} large title="Cviky" right=${addButton} />

      <div class="search-row">
        <${SearchField} value=${query} onInput=${setQuery} placeholder="Hľadať cvik…" />
        <${IconButton} class="square" icon=${Icon.sliders()} label="Filter vybavenia"
          badge=${!!equipment} onClick=${() => setSheetOpen(true)} />
      </div>

      <div class="chips-scroll" role="group" aria-label="Partie">
        <${FilterChip} active=${!muscle} onClick=${() => setMuscle(null)}>Všetky</${FilterChip}>
        ${Object.entries(MUSCLE_GROUPS).map(([k, label]) => html`
          <${FilterChip} active=${muscle === k} onClick=${() => setMuscle(muscle === k ? null : k)}>${label}</${FilterChip}>`)}
      </div>

      ${equipment && html`
        <div class="active-filters">
          <${FilterChip} active onClick=${() => setEquipment(null)}>
            ${EQUIPMENT[equipment]}<span class="chip-x">${Icon.x(14)}</span>
          </${FilterChip}>
        </div>`}

      ${loading && !data && html`<${Loading} />`}
      ${error && html`<${ErrorBox} error=${error} />`}
      ${data && filtered.length === 0 && html`
        <${EmptyState} title="Nič sa nenašlo"
          text=${query ? `Cvik „${query}“ nie je v knižnici.` : 'Pre zvolený filter nie sú žiadne cviky.'}
          action=${html`<${PrimaryButton} icon=${Icon.plus()} onClick=${() => navigate('/exercises/new')}>Vytvoriť nový cvik</${PrimaryButton}>`} />`}

      ${data && filtered.length > 0 && groups.map(([key, list]) => html`
        <section class="ex-group" key=${key || 'all'}>
          <h2 class="section-caption">${key ? MUSCLE_GROUPS[key] : `${list.length} ${list.length === 1 ? 'cvik' : list.length < 5 ? 'cviky' : 'cvikov'}`}</h2>
          <div class="ex-list">
            ${list.map((ex) => html`<${ExerciseListItem} key=${ex.id} exercise=${ex} href=${`#/exercises/${ex.id}`} />`)}
          </div>
        </section>`)}

      <${BottomSheet} open=${sheetOpen} title="Vybavenie" onClose=${() => setSheetOpen(false)}
        footer=${html`
          <${SecondaryButton} onClick=${() => { setEquipment(null); setSheetOpen(false); }}>Zrušiť filter</${SecondaryButton}>
          <${PrimaryButton} onClick=${() => setSheetOpen(false)}>Hotovo</${PrimaryButton}>`}>
        <div class="chips-wrap">
          ${Object.entries(EQUIPMENT).map(([k, label]) => html`
            <${FilterChip} active=${equipment === k} onClick=${() => setEquipment(equipment === k ? null : k)}>${label}</${FilterChip}>`)}
        </div>
      </${BottomSheet}>
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
      <${AppHeader} back="/more" backLabel="Nastavenia" />
      <div class="page-head"><h1 class="page-title">Zmazané cviky</h1></div>
      ${loading && !data && html`<${Loading} />`}
      ${error && html`<${ErrorBox} error=${error} />`}
      ${data && data.length === 0 && html`<${EmptyState} title="Žiadne zmazané cviky" />`}
      ${data && data.length > 0 && html`
        <section class="section">
          <div class="ex-list">
            ${data.map((ex) => html`
              <${ExerciseListItem} key=${ex.id} exercise=${ex}
                right=${html`<${TextButton} strong onClick=${() => restore(ex)}>Obnoviť</${TextButton}>`} />`)}
          </div>
          <p class="section-footer">Zmazané cviky sa nezobrazujú v knižnici, ale ich história ostáva zachovaná.</p>
        </section>`}
    </div>`;
}
