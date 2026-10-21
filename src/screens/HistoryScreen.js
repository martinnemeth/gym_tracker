import { html, useState } from '../lib.js';
import { listFinishedWorkouts, getWorkout, getWorkoutSets, deleteWorkout } from '../db/workouts.js';
import { listExercises } from '../db/exercises.js';
import { listForWorkout } from '../db/recommendations.js';
import { exerciseSessions } from '../db/analytics.js';
import { sessionRecord, formatMetric } from '../analytics.js';
import { navigate, goBack } from '../router.js';
import {
  formatDuration, formatMonth, formatWeekday, formatDateLong, formatTime, formatNum, setLabel, setsVolume, plural,
} from '../format.js';
import {
  AppHeader, IconButton, ActionSheet, PrimaryButton, StatCard, Icon,
  Loading, ErrorBox, EmptyState, useAsync, showToast,
} from '../ui/components.js';
import { RecommendationsCard, sortByOrder } from '../ui/Recommendations.js';

async function exerciseMap() {
  return new Map((await listExercises({ includeDeleted: true })).map((e) => [e.id, e]));
}

const volumeLabel = (v) => (v >= 10000 ? `${formatNum(Math.round(v / 100) / 10)} t` : `${formatNum(Math.round(v))} kg`);

export function HistoryScreen() {
  const { data, loading, error } = useAsync(async () => {
    const [workouts, exercises] = await Promise.all([listFinishedWorkouts(), exerciseMap()]);
    return { workouts, exercises };
  });

  if (loading && !data) return html`<div class="screen"><${AppHeader} large title="História" /><${Loading} /></div>`;
  if (error) return html`<div class="screen"><${AppHeader} large title="História" /><${ErrorBox} error=${error} /></div>`;

  const { workouts, exercises } = data;
  const typeOf = (id) => exercises.get(id)?.trackingType;
  const months = [];
  for (const w of workouts) {
    const label = formatMonth(w.startedAt);
    if (months[months.length - 1]?.label !== label) months.push({ label, items: [] });
    months[months.length - 1].items.push(w);
  }

  return html`
    <div class="screen">
      <${AppHeader} large title="História" />
      ${workouts.length === 0 && html`
        <${EmptyState} icon=${Icon.clock()} title="Zatiaľ žiadne tréningy"
          text="Dokončené tréningy sa zobrazia tu."
          action=${html`<${PrimaryButton} icon=${Icon.play(18)} onClick=${() => navigate('/plans')}>Začať tréning</${PrimaryButton}>`} />`}
      ${months.map((m) => html`
        <section class="ex-group" key=${m.label}>
          <h2 class="section-caption">${m.label}</h2>
          <div class="ex-list">
            ${m.items.map((w) => {
              const volume = setsVolume(w.sets, typeOf);
              const meta = [
                w.finishedAt && formatDuration(w.finishedAt - w.startedAt),
                plural(w.sets.length, 'séria', 'série', 'sérií'),
                volume > 0 && volumeLabel(volume),
              ].filter(Boolean).join(' · ');
              return html`
                <a class="card wk-item" key=${w.id} href=${`#/history/${w.id}`}
                  onClick=${(e) => { e.preventDefault(); navigate(`/history/${w.id}`); }}>
                  <div class="wk-date">
                    <span class="wk-day">${new Date(w.startedAt).getDate()}</span>
                    <span class="wk-weekday">${formatWeekday(w.startedAt)}</span>
                  </div>
                  <div class="ex-item-main">
                    <div class="ex-item-name">${w.dayName}</div>
                    <div class="ex-item-meta">${w.planName ? `${w.planName} · ` : ''}${meta}</div>
                  </div>
                  <span class="row-chevron">${Icon.chevronRight()}</span>
                </a>`;
            })}
          </div>
        </section>`)}
    </div>`;
}

export function WorkoutSummaryScreen({ params }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const workout = await getWorkout(params.id);
    if (!workout) return null;
    const [sets, exercises, recs] = await Promise.all([getWorkoutSets(workout.id), exerciseMap(), listForWorkout(workout.id)]);
    // Nové osobné rekordy: metrika cviku v tomto tréningu prekonala všetky predchádzajúce.
    const records = new Map();
    if (workout.status === 'done') {
      for (const exId of new Set(sets.map((s) => s.exerciseId))) {
        const rec = sessionRecord(await exerciseSessions(exId), workout.id, exercises.get(exId)?.trackingType || 'weight_reps');
        if (rec) records.set(exId, rec);
      }
    }
    return { workout, sets, exercises, records, recs: sortByOrder(recs, workout.exercises.map((we) => we.planExerciseId)) };
  }, [params.id]);
  const [menuOpen, setMenuOpen] = useState(false);

  const header = (right) => html`<${AppHeader} back="/history" backLabel="História" right=${right} />`;
  if (loading && !data) return html`<div class="screen">${header()}<${Loading} /></div>`;
  if (error) return html`<div class="screen">${header()}<${ErrorBox} error=${error} /></div>`;
  if (!data) return html`<div class="screen">${header()}<${EmptyState} title="Tréning neexistuje" /></div>`;

  const { workout, sets, exercises, recs, records } = data;
  if (workout.status === 'active') {
    return html`<div class="screen">${header()}
      <${EmptyState} title="Tréning ešte prebieha"
        action=${html`<${PrimaryButton} onClick=${() => navigate(`/workout/${workout.id}`, { replace: true })}>Pokračovať</${PrimaryButton}>`} /></div>`;
  }
  const typeOf = (id) => exercises.get(id)?.trackingType;
  const volume = setsVolume(sets, typeOf);
  const blocks = workout.exercises
    .map((we) => ({ we, sets: sets.filter((s) => s.workoutExerciseId === we.id) }))
    .filter((b) => b.sets.length);

  async function onDelete() {
    if (!confirm('Natrvalo zmazať tréning z histórie?')) return;
    await deleteWorkout(workout.id);
    showToast('Tréning zmazaný');
    goBack('/history');
  }

  const menu = html`<${IconButton} icon=${Icon.more()} label="Možnosti tréningu" onClick=${() => setMenuOpen(true)} />`;

  return html`
    <div class="screen">
      ${header(menu)}
      <div class="detail-head">
        <h1 class="page-title">${workout.dayName}</h1>
        <div class="workout-meta">
          <span>${formatDateLong(workout.startedAt)}, ${formatTime(workout.startedAt)}</span>
          ${workout.planName && html`<span>${workout.planName}</span>`}
        </div>
      </div>

      <section class="section">
        <div class="card summary-stats">
          <div class="stats">
            <${StatCard} value=${workout.finishedAt ? formatDuration(workout.finishedAt - workout.startedAt) : '–'} label="Trvanie" />
            <${StatCard} value=${sets.length} label="Série" />
            <${StatCard} value=${volume > 0 ? volumeLabel(volume) : '–'} label="Objem" />
          </div>
        </div>
        ${records.size > 0 && html`
          <p class="section-footer pr-summary">${Icon.trophy(16)}<span>Nové rekordy: ${records.size}</span></p>`}
      </section>

      ${recs.length > 0 && html`
        <${RecommendationsCard} title="Progresia na ďalší tréning" recs=${recs} exercises=${exercises} onChanged=${reload}
          footer="Prijaté odporúčanie upraví cieľ cviku v pláne." />`}

      ${blocks.length === 0 && html`<${EmptyState} title="Žiadne zapísané série" />`}
      ${blocks.map(({ we, sets: list }) => {
        const ex = exercises.get(we.exerciseId);
        const pr = records.get(we.exerciseId);
        return html`
          <section class="section" key=${we.id}>
            <div class="card summary-ex">
              <a class="summary-ex-name" href=${`#/exercises/${we.exerciseId}`}
                onClick=${(e) => { e.preventDefault(); navigate(`/exercises/${we.exerciseId}`); }}>
                ${ex?.name || 'Neznámy cvik'}
              </a>
              ${pr && html`
                <div class="pr-badge">${Icon.trophy(14)}<span>Nový rekord · ${pr.metric.label} ${formatMetric(pr.value, pr.metric)}</span></div>`}
              <ol class="summary-sets">
                ${list.map((s) => html`
                  <li key=${s.id}><span class="set-idx">${s.setIndex + 1}</span><span>${setLabel(s, ex?.trackingType)}</span></li>`)}
              </ol>
            </div>
          </section>`;
      })}

      <${ActionSheet} open=${menuOpen} title=${workout.dayName} onClose=${() => setMenuOpen(false)}
        actions=${[
          { label: 'Upraviť série', icon: Icon.edit(), onClick: () => navigate(`/workout/${workout.id}`) },
          { label: 'Zmazať tréning', icon: Icon.trash(), danger: true, onClick: onDelete },
        ]} />
    </div>`;
}
