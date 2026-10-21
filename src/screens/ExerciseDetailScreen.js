import { html, useState } from '../lib.js';
import { getExercise, exerciseUsage, deleteExercise, undeleteExercise } from '../db/exercises.js';
import { recentPerformances } from '../db/workouts.js';
import { exerciseSessions } from '../db/analytics.js';
import { exerciseAnalytics, formatMetric } from '../analytics.js';
import { Sparkline } from '../ui/charts.js';
import { formatDate, setLabel } from '../format.js';
import { MUSCLE_GROUPS, EQUIPMENT, TRACKING_TYPES } from '../data/taxonomy.js';
import { navigate, goBack } from '../router.js';
import {
  AppHeader, IconButton, ActionSheet, SectionCard, StatCard, ExerciseImage, Tag, TextButton,
  Loading, ErrorBox, EmptyState, Icon, useAsync, showToast,
} from '../ui/components.js';

// Technika je predvolene rozbalená; stav zbalenia platí počas behu aplikácie.
let techniqueCollapsed = false;

export function ExerciseDetailScreen({ params }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const ex = await getExercise(params.id);
    if (!ex) return null;
    const [usage, recent, sessions] = await Promise.all([
      exerciseUsage(ex.id), recentPerformances(ex.id, { limit: 5 }), exerciseSessions(ex.id),
    ]);
    return { ex, usage, recent, analytics: sessions.length ? exerciseAnalytics(sessions, ex.trackingType) : null };
  }, [params.id]);
  const [checked, setChecked] = useState(() => new Set());
  const [collapsed, setCollapsed] = useState(techniqueCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);

  const header = (right) => html`<${AppHeader} back="/exercises" backLabel="Cviky" right=${right} />`;
  if (loading && !data) return html`<div class="screen">${header()}<${Loading} /></div>`;
  if (error) return html`<div class="screen">${header()}<${ErrorBox} error=${error} /></div>`;
  if (!data) {
    return html`<div class="screen">${header()}
      <${EmptyState} title="Cvik neexistuje" text="Mohol byť natrvalo zmazaný." /></div>`;
  }

  const { ex, usage, recent, analytics } = data;
  const toggleStep = (id) => setChecked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleCollapsed = () => { techniqueCollapsed = !collapsed; setCollapsed(!collapsed); };

  async function onDelete() {
    const soft = ex.builtIn || usage.setCount > 0 || usage.planNames.length > 0;
    const msg = soft
      ? `Zmazať „${ex.name}“?\n\nCvik sa skryje z knižnice. ${usage.setCount ? 'História sérií ostane zachovaná. ' : ''}Obnoviť ho môžeš v Nastaveniach → Zmazané cviky.`
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

  const menuButton = !ex.deletedAt && html`
    <${IconButton} icon=${Icon.more()} label="Možnosti cviku" onClick=${() => setMenuOpen(true)} />`;

  return html`
    <div class="screen">
      ${header(menuButton)}
      <div class="detail-head">
        <h1 class="page-title">${ex.name}</h1>
        <div class="tags">
          ${ex.muscleGroups.map((m, i) => html`<${Tag} kind=${i === 0 ? 'primary' : ''}>${MUSCLE_GROUPS[m] || m}</${Tag}>`)}
          <${Tag}>${EQUIPMENT[ex.equipment] || ex.equipment}</${Tag}>
          <${Tag} kind="muted">${TRACKING_TYPES[ex.trackingType]?.short}</${Tag}>
        </div>
      </div>

      ${ex.deletedAt && html`
        <div class="banner">
          <span>Tento cvik je zmazaný.</span>
          <${TextButton} strong onClick=${onRestore}>Obnoviť</${TextButton}>
        </div>`}

      <${ExerciseImage} exercise=${ex} size="hero" />

      <${SectionCard} title="Technika" icon=${Icon.clipboardCheck()} collapsed=${collapsed} onToggle=${toggleCollapsed}
        headerRight=${!collapsed && checked.size > 0 && html`
          <button type="button" class="text-btn small" onClick=${() => setChecked(new Set())}>Resetovať</button>`}>
        ${ex.technique.length === 0
          ? html`<p class="row-subtitle">Zatiaľ žiadne body. Pridaj ich cez ⋯ → Upraviť cvik.</p>`
          : html`
            <ol class="steps">
              ${ex.technique.map((t, i) => html`
                <li key=${t.id}>
                  <button type="button" class=${`step ${checked.has(t.id) ? 'done' : ''}`}
                    aria-pressed=${checked.has(t.id)} onClick=${() => toggleStep(t.id)}>
                    <span class="step-badge">${checked.has(t.id) ? Icon.check(14) : i + 1}</span>
                    <span class="step-text">${t.text}</span>
                  </button>
                </li>`)}
            </ol>`}
      </${SectionCard}>

      ${ex.notes && html`
        <${SectionCard} title="Poznámky" icon=${Icon.notes()}>
          <p class="notes-text">${ex.notes}</p>
        </${SectionCard}>`}

      <${SectionCard} title="Použitie a štatistiky" icon=${Icon.barChart()}>
        <div class="stats">
          <${StatCard} value=${usage.setCount} label="Odcvičené série" />
          <${StatCard} value=${usage.planNames.length || '–'} label="V plánoch" />
          <${StatCard} text value=${ex.aliases?.length ? ex.aliases.join(', ') : '–'} label="Iné názvy" />
        </div>
        ${analytics && html`
          <a class="an-link" href=${`#/exercises/${ex.id}/analytics`}
            onClick=${(e) => { e.preventDefault(); navigate(`/exercises/${ex.id}/analytics`); }}>
            <div class="row-main">
              <div class="row-title">Progres a rekordy</div>
              <div class="row-subtitle">${analytics.metric.label}: ${formatMetric(analytics.current, analytics.metric)}</div>
            </div>
            <${Sparkline} points=${analytics.all.slice(-12)} />
            <span class="row-chevron">${Icon.chevronRight()}</span>
          </a>`}
      </${SectionCard}>

      ${recent.length > 0 && html`
        <${SectionCard} title="Posledné tréningy" icon=${Icon.clock(20)}>
          <div class="recent">
            ${recent.map((r) => html`
              <a class="recent-row" key=${r.workoutId} href=${`#/history/${r.workoutId}`}
                onClick=${(e) => { e.preventDefault(); navigate(`/history/${r.workoutId}`); }}>
                <span class="recent-date">${formatDate(r.performedAt)}</span>
                <span class="recent-sets">${r.sets.map((s) => setLabel(s, ex.trackingType, { compact: true })).join(' · ')}</span>
              </a>`)}
          </div>
        </${SectionCard}>`}

      <${ActionSheet} open=${menuOpen} title=${ex.name} onClose=${() => setMenuOpen(false)}
        actions=${[
          { label: 'Upraviť cvik', icon: Icon.edit(), onClick: () => navigate(`/exercises/${ex.id}/edit`) },
          { label: 'Zmazať cvik', icon: Icon.trash(), danger: true, onClick: onDelete },
        ]} />
    </div>`;
}
