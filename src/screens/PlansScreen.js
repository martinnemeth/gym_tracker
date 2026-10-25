import { html } from '../lib.js';
import { navigate } from '../router.js';
import { listPlans } from '../db/plans.js';
import { getActiveWorkout, nextDayOf, listFinishedWorkouts } from '../db/workouts.js';
import { listExercises } from '../db/exercises.js';
import { listPending } from '../db/recommendations.js';
import { planWorkouts } from '../db/analytics.js';
import { planAnalytics, DEFAULT_STAGNATION } from '../analytics.js';
import { MUSCLE_GROUPS } from '../data/taxonomy.js';
import { formatClock, formatDuration, formatDateMid, formatVolume, setsVolume, plural } from '../format.js';
import { AppHeader, PrimaryButton, SecondaryButton, Icon, Loading, ErrorBox, useAsync, useNow } from '../ui/components.js';
import { beginWorkout } from './WorkoutScreen.js';

const go = (path) => (e) => { e.preventDefault(); navigate(path); };

/** Hlavné partie dňa: prvá (hlavná) partia každého cviku, bez opakovania, najviac 3. */
function dayMuscles(day, exercises) {
  const groups = [...new Set(day.exercises.map((pe) => exercises.get(pe.exerciseId)?.muscleGroups[0]).filter(Boolean))];
  return groups.slice(0, 3).map((g) => MUSCLE_GROUPS[g] || g).join(', ');
}

function RunningClock({ since }) {
  const now = useNow(1000);
  return html`<span class="tabular">${formatClock((now - since) / 1000)}</span>`;
}

/** Kompaktná karta plánu: deň na rade a začatie tréningu. */
function PlanCard({ plan, nextDay, exercises, running, recCount, alertCount }) {
  const day = running ? null : nextDay;
  const meta = running
    ? html`Prebieha · <${RunningClock} since=${running.startedAt} />`
    : day
      ? [plural(day.exercises.length, 'cvik', 'cviky', 'cvikov'), dayMuscles(day, exercises)].filter(Boolean).join(' · ')
      : 'Pridaj dni a cviky v úprave plánu';
  return html`
    <section class=${`card plan-card ${running ? 'running' : ''}`}>
      <a class="plan-card-head" href=${`#/plans/${plan.id}`} onClick=${go(`/plans/${plan.id}`)}>
        <span class="icon-tile lg">${Icon.dumbbell(26)}</span>
        <span class="plan-card-text">
          <span class="plan-card-name">${plan.name}</span>
          <span class="plan-card-day">${running ? running.dayName : day?.name || 'Bez tréningových dní'}</span>
          <span class="plan-card-meta">${meta}</span>
        </span>
        <span class="row-chevron">${Icon.chevronRight(20)}</span>
      </a>
      ${(recCount > 0 || alertCount > 0) && html`
        <div class="plan-card-badges">
          ${recCount > 0 && html`
            <a class="badge accent" href=${`#/plans/${plan.id}`} onClick=${go(`/plans/${plan.id}`)}>
              ${Icon.trendUp(14)}${plural(recCount, 'odporúčanie', 'odporúčania', 'odporúčaní')}
            </a>`}
          ${alertCount > 0 && html`
            <a class="badge warn" href=${`#/plans/${plan.id}/analytics`} onClick=${go(`/plans/${plan.id}/analytics`)}>
              ${Icon.flat(14)}Stagnácia${alertCount > 1 ? ` · ${alertCount}` : ''}
            </a>`}
        </div>`}
      ${running
        ? html`<${PrimaryButton} block icon=${Icon.play(18)} onClick=${() => navigate(`/workout/${running.id}`)}>Pokračovať v tréningu</${PrimaryButton}>`
        : day
          ? html`<${PrimaryButton} block icon=${Icon.play(18)} onClick=${() => beginWorkout(plan, day.id)}>Začať tréning</${PrimaryButton}>`
          : html`<${SecondaryButton} block icon=${Icon.edit()} onClick=${() => navigate(`/plans/${plan.id}/edit`)}>Upraviť plán</${SecondaryButton}>`}
    </section>`;
}

function EmptyPlans() {
  return html`
    <section class="card empty-plans">
      <div class="plan-card-head">
        <span class="icon-tile lg">${Icon.calendar()}</span>
        <div class="plan-card-text">
          <div class="empty-plans-title">Zatiaľ nemáš žiadny plán</div>
          <p>Vytvor si plán a aplikácia ti bude ponúkať deň, ktorý je na rade.</p>
        </div>
      </div>
      <${PrimaryButton} block icon=${Icon.plus()} onClick=${() => navigate('/plans/new')}>Vytvoriť plán</${PrimaryButton}>
    </section>`;
}

/** Posledný dokončený tréning so základnou štatistikou. */
function LastWorkoutCard({ workout, exercises }) {
  const typeOf = (id) => exercises.get(id)?.trackingType;
  const volume = setsVolume(workout.sets, typeOf);
  const doneEx = new Set(workout.sets.map((s) => s.workoutExerciseId)).size;
  const total = Math.max(doneEx, workout.exercises.length);
  const duration = workout.finishedAt ? formatDuration(workout.finishedAt - workout.startedAt) : null;
  const meta = [duration, plural(doneEx, 'cvik', 'cviky', 'cvikov'), workout.planName || 'Voľný tréning'].filter(Boolean);
  return html`
    <a class="card last-workout" href=${`#/history/${workout.id}`} onClick=${go(`/history/${workout.id}`)}>
      <div class="last-workout-top">
        <span class="section-caption">Posledný tréning</span>
        <span class="last-workout-date">${formatDateMid(workout.startedAt)}</span>
      </div>
      <div class="last-workout-head">
        <span class="icon-tile lg">${workout.planId ? Icon.dumbbell(26) : Icon.plus(24)}</span>
        <span class="plan-card-text">
          <span class="plan-card-day">${workout.dayName}</span>
          <span class="plan-card-meta">${meta.join(' · ')}</span>
        </span>
        <span class="row-chevron">${Icon.chevronRight(20)}</span>
      </div>
      <div class="last-workout-stats">
        ${volume > 0
          ? html`<div class="lw-stat">${Icon.trophy(22)}<span><b>${formatVolume(volume)}</b>Celkový objem</span></div>`
          : html`<div class="lw-stat">${Icon.clipboardCheck(22)}<span><b>${workout.sets.length}</b>Série</span></div>`}
        <div class="lw-stat">${Icon.clock(22)}<span><b>${duration || '–'}</b>Trvanie</span></div>
        <div class="lw-stat">${Icon.barChart(22)}<span><b>${doneEx}/${total}</b>Cvikov</span></div>
      </div>
    </a>`;
}

function FreeWorkoutCard({ running }) {
  return html`
    <button type="button" class="card free-workout"
      onClick=${() => (running ? navigate(`/workout/${running.id}`) : beginWorkout(null, null))}>
      <span class="free-workout-icon">${running ? html`<span class="resume-pulse" />` : Icon.plus(24)}</span>
      <span class="plan-card-text">
        <span class="free-workout-title">
          ${!running ? 'Voľný tréning' : running.planId ? 'Pokračovať v tréningu' : 'Pokračovať vo voľnom tréningu'}
        </span>
        <span class="plan-card-meta">
          ${running ? html`Prebieha · <${RunningClock} since=${running.startedAt} />` : 'Zaznamenaj neplánovaný tréning podľa potreby.'}
        </span>
      </span>
      <span class="row-chevron">${Icon.chevronRight(20)}</span>
    </button>`;
}

export function PlansScreen() {
  const { data, loading, error } = useAsync(async () => {
    const [plans, activeWorkout, exList, finished] = await Promise.all([
      listPlans(), getActiveWorkout(), listExercises({ includeDeleted: true }), listFinishedWorkouts(),
    ]);
    const exercises = new Map(exList.map((e) => [e.id, e]));
    const cards = await Promise.all(plans.map(async (plan) => {
      const [nextDay, pending, workouts] = await Promise.all([nextDayOf(plan), listPending(plan.id), planWorkouts(plan.id)]);
      const { alerts } = planAnalytics({
        workouts, exercises,
        order: plan.days.flatMap((d) => d.exercises.map((pe) => pe.exerciseId)),
        stagnation: { ...DEFAULT_STAGNATION, ...plan.stagnation },
      });
      return { plan, nextDay, recCount: pending.length, alertCount: alerts.length };
    }));
    return { cards, activeWorkout, exercises, last: finished[0] || null };
  });

  const createButton = html`
    <button type="button" class="btn btn-primary header-cta" onClick=${() => navigate('/plans/new')}>
      ${Icon.plus()}<span>Vytvoriť plán</span>
    </button>`;
  const shell = (body) => html`
    <div class="screen home">
      <div class="home-bg" aria-hidden="true" />
      <${AppHeader} large title="Domov" right=${createButton} />
      ${body}
    </div>`;

  if (loading && !data) return shell(html`<${Loading} />`);
  if (error) return shell(html`<${ErrorBox} error=${error} />`);

  const { cards, activeWorkout, exercises, last } = data;
  const runningFree = activeWorkout && !activeWorkout.planId ? activeWorkout : null;
  // Prebiehajúci tréning plánu, ktorý už medzitým zmazali, sa ukáže ako voľný (dá sa doň vrátiť).
  const orphan = activeWorkout?.planId && !cards.some((c) => c.plan.id === activeWorkout.planId) ? activeWorkout : null;

  return shell(html`
    <div class="home-list">
      ${cards.length === 0 && html`<${EmptyPlans} />`}
      ${cards.map((c) => html`
        <${PlanCard} key=${c.plan.id} ...${c} exercises=${exercises}
          running=${activeWorkout?.planId === c.plan.id ? activeWorkout : null} />`)}
      ${last && html`<${LastWorkoutCard} workout=${last} exercises=${exercises} />`}
      <${FreeWorkoutCard} running=${runningFree || orphan} />
    </div>`);
}
