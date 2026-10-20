import { html, useState, useEffect, useMemo } from '../lib.js';
import { listExercises } from '../db/exercises.js';
import { MUSCLE_GROUPS } from '../data/taxonomy.js';
import { normalize } from '../util.js';
import {
  BottomSheet, SearchField, FilterChip, ExerciseListItem, PrimaryButton, SecondaryButton,
  Loading, ErrorBox, EmptyState, Icon, useAsync,
} from './components.js';

/**
 * Výber cvikov z knižnice (viac naraz) v spodnom paneli.
 * onPick dostane vybrané cviky v poradí, v akom boli označené.
 */
export function ExercisePicker({ open, onClose, onPick, title = 'Pridať cviky' }) {
  const { data, loading, error } = useAsync(() => (open ? listExercises() : Promise.resolve(null)), [open]);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) { setQuery(''); setMuscle(null); setSelected([]); }
  }, [open]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return (data || []).filter((ex) =>
      (!q || [ex.name, ...(ex.aliases || [])].some((s) => normalize(s).includes(q)))
      && (!muscle || ex.muscleGroups.includes(muscle)));
  }, [data, query, muscle]);

  const toggle = (id) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  function confirm() {
    const byId = new Map(data.map((e) => [e.id, e]));
    onPick(selected.map((id) => byId.get(id)));
    onClose();
  }

  return html`
    <${BottomSheet} open=${open} title=${title} onClose=${onClose} tall
      footer=${html`
        <${SecondaryButton} onClick=${onClose}>Zrušiť</${SecondaryButton}>
        <${PrimaryButton} disabled=${!selected.length} onClick=${confirm}>
          ${selected.length ? `Pridať (${selected.length})` : 'Pridať'}
        </${PrimaryButton}>`}>
      <div class="picker-head">
        <${SearchField} value=${query} onInput=${setQuery} placeholder="Hľadať cvik…" />
        <div class="chips-scroll picker-chips" role="group" aria-label="Partie">
          <${FilterChip} active=${!muscle} onClick=${() => setMuscle(null)}>Všetky</${FilterChip}>
          ${Object.entries(MUSCLE_GROUPS).map(([k, label]) => html`
            <${FilterChip} active=${muscle === k} onClick=${() => setMuscle(muscle === k ? null : k)}>${label}</${FilterChip}>`)}
        </div>
      </div>
      ${loading && !data && html`<${Loading} />`}
      ${error && html`<${ErrorBox} error=${error} />`}
      ${data && filtered.length === 0 && html`<${EmptyState} title="Nič sa nenašlo" />`}
      <div class="ex-list">
        ${filtered.map((ex) => {
          const on = selected.includes(ex.id);
          return html`<${ExerciseListItem} key=${ex.id} exercise=${ex} selected=${on} onClick=${() => toggle(ex.id)}
            right=${html`<span class=${`pick-check ${on ? 'on' : ''}`}>${on ? Icon.check(16) : null}</span>`} />`;
        })}
      </div>
    </${BottomSheet}>`;
}
