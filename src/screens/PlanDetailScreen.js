import { html, useState } from '../lib.js';
import { getPlan, setActivePlan, deletePlan } from '../db/plans.js';
import { nextDayOf } from '../db/workouts.js';
import { listExercises } from '../db/exercises.js';
import { listPending } from '../db/recommendations.js';
import { navigate, goBack } from '../router.js';
import { targetLabel, plural } from '../format.js';
import {
  AppHeader, IconButton, ActionSheet, PrimaryButton, SecondaryButton, Tag,
  Loading, ErrorBox, EmptyState, Icon, useAsync, showToast,
} from '../ui/components.js';
import { RecommendationsCard, sortByOrder } from '../ui/Recommendations.js';
import { beginWorkout } from './WorkoutScreen.js';

export function PlanDetailScreen({ params }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const plan = await getPlan(params.id);
    if (!plan || plan.deletedAt) return null;
    const exercises = new Map((await listExercises({ includeDeleted: true })).map((e) => [e.id, e]));
    const [nextDay, recs] = await Promise.all([nextDayOf(plan), listPending(plan.id)]);
    const order = plan.days.flatMap((d) => d.exercises.map((pe) => pe.id));
    return { plan, exercises, nextDay, recs: sortByOrder(recs, order) };
  }, [params.id]);
  const [menuOpen, setMenuOpen] = useState(false);

  const header = (right) => html`<${AppHeader} back="/plans" backLabel="Plány" right=${right} />`;
  if (loading && !data) return html`<div class="screen">${header()}<${Loading} /></div>`;
  if (error) return html`<div class="screen">${header()}<${ErrorBox} error=${error} /></div>`;
  if (!data) return html`<div class="screen">${header()}<${EmptyState} title="Plán neexistuje" /></div>`;

  const { plan, exercises, nextDay, recs } = data;
  const active = plan.status === 'active';
  const exCount = plan.days.reduce((n, d) => n + d.exercises.length, 0);

  async function makeActive() {
    await setActivePlan(plan.id);
    showToast('Plán je aktívny');
    reload();
  }

  async function onDelete() {
    if (!confirm(`Zmazať plán „${plan.name}“?\n\nOdcvičené tréningy ostanú v histórii.`)) return;
    await deletePlan(plan.id);
    showToast('Plán zmazaný');
    goBack('/plans');
  }

  const menu = html`<${IconButton} icon=${Icon.more()} label="Možnosti plánu" onClick=${() => setMenuOpen(true)} />`;

  return html`
    <div class="screen">
      ${header(menu)}
      <div class="detail-head">
        <h1 class="page-title">${plan.name}</h1>
        <div class="tags">
          ${active && html`<${Tag} kind="primary">Aktívny plán</${Tag}>`}
          <${Tag} kind="muted">${plural(plan.days.length, 'deň', 'dni', 'dní')} · ${plural(exCount, 'cvik', 'cviky', 'cvikov')}</${Tag}>
        </div>
      </div>

      ${!active && html`
        <div class="section">
          <${SecondaryButton} block icon=${Icon.check()} onClick=${makeActive}>Nastaviť ako aktívny</${SecondaryButton}>
        </div>`}

      ${recs.length > 0 && html`
        <${RecommendationsCard} title="Odporúčania progresie" recs=${recs} exercises=${exercises} onChanged=${reload} />`}

      ${plan.days.length === 0 && html`
        <${EmptyState} title="Plán nemá žiadne dni"
          action=${html`<${PrimaryButton} icon=${Icon.edit()} onClick=${() => navigate(`/plans/${plan.id}/edit`)}>Upraviť plán</${PrimaryButton}>`} />`}

      ${plan.days.map((day) => {
        const isNext = nextDay?.id === day.id;
        return html`
          <section class="section" key=${day.id}>
            <div class=${`card day-card ${isNext ? 'next' : ''}`}>
              <div class="day-card-head">
                <div class="day-card-titles">
                  <h2 class="day-card-title">${day.name}</h2>
                  <div class="day-card-meta">
                    ${isNext && html`<span class="next-badge">Na rade</span>`}
                    ${plural(day.exercises.length, 'cvik', 'cviky', 'cvikov')}
                  </div>
                </div>
                <${isNext ? PrimaryButton : SecondaryButton} icon=${Icon.play(16)}
                  onClick=${() => beginWorkout(plan, day.id)}>Začať</${isNext ? PrimaryButton : SecondaryButton}>
              </div>
              ${day.exercises.length > 0 && html`
                <ol class="pe-lines">
                  ${day.exercises.map((pe) => {
                    const ex = exercises.get(pe.exerciseId);
                    return html`
                      <li class="pe-line" key=${pe.id}>
                        <a href=${`#/exercises/${pe.exerciseId}`}
                          onClick=${(e) => { e.preventDefault(); navigate(`/exercises/${pe.exerciseId}`); }}>
                          ${ex?.name || 'Neznámy cvik'}
                        </a>
                        <span class="pe-line-target">${targetLabel(pe, ex?.trackingType)}</span>
                      </li>`;
                  })}
                </ol>`}
            </div>
          </section>`;
      })}

      <${ActionSheet} open=${menuOpen} title=${plan.name} onClose=${() => setMenuOpen(false)}
        actions=${[
          { label: 'Upraviť plán', icon: Icon.edit(), onClick: () => navigate(`/plans/${plan.id}/edit`) },
          ...(active ? [] : [{ label: 'Nastaviť ako aktívny', icon: Icon.check(20), onClick: makeActive }]),
          { label: 'Zmazať plán', icon: Icon.trash(), danger: true, onClick: onDelete },
        ]} />
    </div>`;
}
