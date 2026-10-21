import { html } from '../lib.js';
import { navigate, navigateRoot } from '../router.js';
import { listPlans } from '../db/plans.js';
import { getActiveWorkout, nextDayOf } from '../db/workouts.js';
import { listExercises } from '../db/exercises.js';
import { listPending } from '../db/recommendations.js';
import { planWorkouts } from '../db/analytics.js';
import { lastBackupAt } from '../db/backup.js';
import { countByIndex } from '../db/db.js';
import { planAnalytics, DEFAULT_STAGNATION } from '../analytics.js';
import { formatClock, formatAgo, plural } from '../format.js';
import {
  AppHeader, PrimaryButton, SecondaryButton, IconButton, Section, SettingsRow, Icon,
  Loading, ErrorBox, useAsync, useNow,
} from '../ui/components.js';
import { beginWorkout } from './WorkoutScreen.js';
import { sortByOrder } from '../ui/Recommendations.js';

// Dekoratívny kotúč — čisto grafický hero bez fotky (funguje offline, žiadne externé obrázky).
const PlateGraphic = () => html`
  <svg class="hero-graphic" viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <circle cx="100" cy="100" r="96" stroke="currentColor" stroke-width="8" />
    <circle cx="100" cy="100" r="76" stroke="currentColor" stroke-width="3" />
    <circle cx="100" cy="100" r="58" stroke="currentColor" stroke-width="3" />
    <circle cx="100" cy="100" r="18" fill="currentColor" />
    <text x="100" y="66" text-anchor="middle" fill="currentColor" font-size="20" font-weight="800"
      font-family="-apple-system, system-ui, sans-serif">20</text>
    <text x="100" y="148" text-anchor="middle" fill="currentColor" font-size="14" font-weight="700"
      font-family="-apple-system, system-ui, sans-serif">KG</text>
  </svg>`;

// Pripomienka zálohy, ak posledná je staršia ako 14 dní (alebo žiadna a už existujú tréningy).
const BACKUP_REMIND_MS = 14 * 86400000;

/** Karta prebiehajúceho tréningu — návrat do neho. */
function ResumeCard({ workout }) {
  const now = useNow(1000);
  return html`
    <section class="section">
      <button type="button" class="card resume" onClick=${() => navigate(`/workout/${workout.id}`)}>
        <span class="resume-pulse" aria-hidden="true" />
        <div class="resume-main">
          <div class="resume-label">Prebieha tréning</div>
          <div class="resume-title">${workout.dayName}</div>
        </div>
        <span class="resume-time">${formatClock((now - workout.startedAt) / 1000)}</span>
        <span class="row-chevron">${Icon.chevronRight()}</span>
      </button>
    </section>`;
}

function EmptyPlans() {
  return html`
    <section class="hero">
      <${PlateGraphic} />
      <h2 class="hero-title">Tvoj tréning<br />začína tu.</h2>
      <p class="hero-text">Vytvor si prvý tréningový plán a začni sledovať progres.</p>
      <${PrimaryButton} block icon=${Icon.plus()} onClick=${() => navigate('/plans/new')}>Vytvoriť plán</${PrimaryButton}>
    </section>

    <section class="section">
      <div class="card features">
        <div class="feature">${Icon.calendar()}<span>Plány<br />tréningov</span></div>
        <a class="feature" href="#/history"
          onClick=${(e) => { e.preventDefault(); navigateRoot('/history'); }}>
          ${Icon.barChart(24)}<span>História<br />tréningov</span>
        </a>
        <a class="feature" href="#/exercises"
          onClick=${(e) => { e.preventDefault(); navigateRoot('/exercises'); }}>
          ${Icon.book(24)}<span>Knižnica<br />cvikov</span>
        </a>
      </div>
    </section>

    <section class="section">
      <div class="card tip">
        ${Icon.bulb()}
        <div>
          <div class="tip-label">TIP</div>
          <p class="tip-text">Plány ti pomôžu mať tréningy konzistentné a sledovať progres v čase.</p>
        </div>
      </div>
    </section>`;
}

/** Aktívny plán s dňom, ktorý je na rade. */
function ActivePlanCard({ plan, nextDay, exercises }) {
  const names = nextDay?.exercises.map((pe) => exercises.get(pe.exerciseId)?.name).filter(Boolean) || [];
  return html`
    <section class="hero plan-hero">
      <${PlateGraphic} />
      <div class="hero-caption">Aktívny plán</div>
      <a class="plan-hero-name" href=${`#/plans/${plan.id}`}
        onClick=${(e) => { e.preventDefault(); navigate(`/plans/${plan.id}`); }}>
        ${plan.name}${Icon.chevronRight()}
      </a>
      ${nextDay
        ? html`
          <div class="plan-hero-next">
            <div class="plan-hero-next-label">Na rade</div>
            <div class="plan-hero-day">${nextDay.name}</div>
            <p class="plan-hero-exercises">
              ${names.length ? names.join(' · ') : 'Deň zatiaľ nemá cviky.'}
            </p>
          </div>
          <${PrimaryButton} block icon=${Icon.play(18)} onClick=${() => beginWorkout(plan, nextDay.id)}>
            Začať ${nextDay.name}
          </${PrimaryButton}>`
        : html`
          <p class="hero-text">Plán zatiaľ nemá žiadne dni.</p>
          <${PrimaryButton} block icon=${Icon.edit()} onClick=${() => navigate(`/plans/${plan.id}/edit`)}>Upraviť plán</${PrimaryButton}>`}
    </section>`;
}

export function PlansScreen() {
  const { data, loading, error } = useAsync(async () => {
    const [plans, activeWorkout] = await Promise.all([listPlans(), getActiveWorkout()]);
    const activePlan = plans.find((p) => p.status === 'active') || null;
    const [nextDay, pending] = activePlan
      ? await Promise.all([nextDayOf(activePlan), listPending(activePlan.id)]) : [null, []];
    const exercises = new Map((await listExercises({ includeDeleted: true })).map((e) => [e.id, e]));
    const order = activePlan ? activePlan.days.flatMap((d) => d.exercises.map((pe) => pe.id)) : [];
    const alerts = activePlan
      ? planAnalytics({
        workouts: await planWorkouts(activePlan.id),
        exercises,
        order: activePlan.days.flatMap((d) => d.exercises.map((pe) => pe.exerciseId)),
        stagnation: { ...DEFAULT_STAGNATION, ...activePlan.stagnation },
      }).alerts
      : [];
    const [done, lastBackup] = await Promise.all([countByIndex('workouts', 'status', 'done'), lastBackupAt()]);
    const backupDue = done > 0 && (!lastBackup || Date.now() - lastBackup > BACKUP_REMIND_MS);
    return {
      plans, activeWorkout, activePlan, nextDay, exercises, pending: sortByOrder(pending, order), alerts, backupDue, lastBackup,
    };
  });

  const addButton = html`<${IconButton} icon=${Icon.plus()} label="Nový plán" onClick=${() => navigate('/plans/new')} />`;

  if (loading && !data) return html`<div class="screen"><${AppHeader} large title="Plány" /><${Loading} /></div>`;
  if (error) return html`<div class="screen"><${AppHeader} large title="Plány" /><${ErrorBox} error=${error} /></div>`;

  const { plans, activeWorkout, activePlan, nextDay, exercises, pending, alerts, backupDue, lastBackup } = data;

  return html`
    <div class="screen">
      <${AppHeader} large title="Plány" right=${plans.length > 0 && addButton} />

      ${activeWorkout && html`<${ResumeCard} workout=${activeWorkout} />`}

      ${plans.length === 0 && html`<${EmptyPlans} />`}

      ${activePlan && html`<${ActivePlanCard} plan=${activePlan} nextDay=${nextDay} exercises=${exercises} />`}

      ${(pending.length > 0 || alerts.length > 0) && html`
        <${Section}>
          ${pending.length > 0 && html`
            <${SettingsRow} icon=${Icon.trendUp(20)} title="Odporúčania progresie"
              subtitle=${pending.map((r) => exercises.get(r.exerciseId)?.name).filter(Boolean).join(' · ')}
              value=${pending.length} href=${`#/plans/${activePlan.id}`} chevron />`}
          ${alerts.length > 0 && html`
            <${SettingsRow} icon=${html`<span class="warn-icon">${Icon.flat(20)}</span>`} title="Stagnácia"
              subtitle=${alerts.map((r) => exercises.get(r.exerciseId)?.name).filter(Boolean).join(' · ')}
              value=${alerts.length} href=${`#/plans/${activePlan.id}/analytics`} chevron />`}
        </${Section}>`}

      ${backupDue && !activeWorkout && html`
        <${Section}>
          <${SettingsRow} icon=${html`<span class="warn-icon">${Icon.cloud()}</span>`} title="Zálohuj svoje dáta"
            subtitle=${lastBackup ? `Posledná záloha ${formatAgo(lastBackup)}` : 'Zatiaľ nemáš žiadnu zálohu'}
            href="#/more/backup" chevron />
        </${Section}>`}

      ${plans.length > 0 && html`
        <${Section} title="Moje plány">
          ${plans.map((p) => html`
            <${SettingsRow} key=${p.id} icon=${Icon.calendar(20)} title=${p.name}
              subtitle=${`${plural(p.days.length, 'deň', 'dni', 'dní')}${p.status === 'active' ? ' · aktívny' : ''}`}
              href=${`#/plans/${p.id}`} chevron />`)}
        </${Section}>`}

      ${!activeWorkout && html`
        <section class="section">
          <${SecondaryButton} block icon=${Icon.timer()} onClick=${() => beginWorkout(null, null)}>Voľný tréning</${SecondaryButton}>
          <p class="section-footer center">Tréning bez plánu — cviky pridáš počas cvičenia.</p>
        </section>`}
    </div>`;
}
