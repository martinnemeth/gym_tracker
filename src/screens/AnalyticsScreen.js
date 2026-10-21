import { html, useState } from '../lib.js';
import { getPlan } from '../db/plans.js';
import { getExercise, listExercises } from '../db/exercises.js';
import { planWorkouts, exerciseSessions, exerciseRecommendations } from '../db/analytics.js';
import { listPending, createDeloadRecommendation } from '../db/recommendations.js';
import {
  PERIODS, DEFAULT_STAGNATION, TREND_LABEL, planAnalytics, exerciseAnalytics, personalRecords, periodStart,
  formatPct, formatMetric, lastSessions,
} from '../analytics.js';
import { formatNum, formatDate, formatDateShort, setLabel, plural } from '../format.js';
import { navigate } from '../router.js';
import {
  AppHeader, FilterChip, SectionCard, StatCard, Tag, Icon, Loading, ErrorBox, EmptyState, useAsync, showToast,
} from '../ui/components.js';
import { LineChart, BarChart, Sparkline } from '../ui/charts.js';
import { RecommendationItem, useRecommendationActions } from '../ui/Recommendations.js';

// Zvolené obdobie platí pre všetky obrazovky analytiky počas behu aplikácie.
let lastPeriod = 'all';

function usePeriod() {
  const [period, setPeriod] = useState(lastPeriod);
  return [period, (p) => { lastPeriod = p; setPeriod(p); }];
}

function PeriodChips({ period, onChange }) {
  return html`
    <div class="chips-scroll analytics-periods" role="group" aria-label="Obdobie">
      ${PERIODS.map((p) => html`
        <${FilterChip} key=${p.id} active=${period === p.id} onClick=${() => onChange(p.id)}>${p.label}</${FilterChip}>`)}
    </div>`;
}

const TREND_ICON = {
  progress: () => Icon.trendUp(16),
  stagnation: () => Icon.flat(16),
  regression: () => Icon.trendDown(16),
};

/** Stav trendu: ikona + text (nikdy iba farba). */
export function TrendBadge({ status }) {
  return html`
    <span class=${`trend-badge ${status}`}>
      ${TREND_ICON[status]?.()}<span>${TREND_LABEL[status]}</span>
    </span>`;
}

/** Zmena v % so znamienkom; farbu dostane iba pri jednoznačnom smere. */
export function Pct({ value }) {
  const cls = value === null ? '' : value > 0.05 ? 'up' : value < -0.05 ? 'down' : '';
  return html`<span class=${`pct ${cls}`}>${formatPct(value)}</span>`;
}

const volumeAxis = (v) => (v >= 1000 ? `${formatNum(Math.round(v / 100) / 10)} t` : `${formatNum(v)}`);
const volumeLabel = (v) => (v >= 10000 ? `${formatNum(Math.round(v / 100) / 10)} t` : `${formatNum(Math.round(v))} kg`);

const go = (path) => (e) => { e.preventDefault(); navigate(path); };

// ── Analytika plánu ─────────────────────────────────────

export function PlanAnalyticsScreen({ params }) {
  const { data, loading, error, reload } = useAsync(async () => {
    const plan = await getPlan(params.id);
    if (!plan || plan.deletedAt) return null;
    const [workouts, all, pending] = await Promise.all([
      planWorkouts(plan.id), listExercises({ includeDeleted: true }), listPending(plan.id),
    ]);
    return { plan, workouts, exercises: new Map(all.map((e) => [e.id, e])), pending };
  }, [params.id]);
  const [period, setPeriod] = usePeriod();
  const [busy, setBusy] = useState(false);

  const header = html`<${AppHeader} back=${`/plans/${params.id}`} backLabel="Plán" />`;
  if (loading && !data) return html`<div class="screen">${header}<${Loading} /></div>`;
  if (error) return html`<div class="screen">${header}<${ErrorBox} error=${error} /></div>`;
  if (!data) return html`<div class="screen">${header}<${EmptyState} title="Plán neexistuje" /></div>`;

  const { plan, workouts, exercises, pending } = data;
  const stagnation = { ...DEFAULT_STAGNATION, ...plan.stagnation };
  const planExercises = plan.days.flatMap((d) => d.exercises);
  const order = [...new Set(planExercises.map((pe) => pe.exerciseId))];
  const a = planAnalytics({ workouts, exercises, order, period, stagnation });
  const pendingPe = new Set(pending.map((r) => r.planExerciseId));
  const hasVolume = a.weeks.some((w) => w.volume > 0);

  async function deload(row) {
    if (busy) return;
    setBusy(true);
    try {
      const pes = planExercises.filter((pe) => pe.exerciseId === row.exerciseId && pe.weight > 0);
      const reason = `${TREND_LABEL[row.trend.status]}: za ${lastSessions(row.trend.sessions)} ${formatPct(row.trend.changePct)}. `
        + 'S nižšou váhou sa progres rozbehne znova.';
      let n = 0;
      for (const pe of pes) if (await createDeloadRecommendation(plan.id, pe.id, reason)) n++;
      showToast(n ? 'Odporúčanie pridané do plánu' : 'Cvik nemá v pláne váhu');
      reload();
    } finally {
      setBusy(false);
    }
  }

  const head = html`
    <div class="detail-head">
      <h1 class="page-title">Analytika</h1>
      <div class="workout-meta"><span>${plan.name}</span></div>
    </div>`;

  if (workouts.length === 0) {
    return html`<div class="screen">${header}${head}
      <${EmptyState} title="Zatiaľ žiadne tréningy"
        text="Grafy progresu sa zobrazia po prvom dokončenom tréningu tohto plánu." /></div>`;
  }

  return html`
    <div class="screen">
      ${header}
      ${head}
      <${PeriodChips} period=${period} onChange=${setPeriod} />

      <section class="section">
        <div class="card summary-stats">
          <div class="stats">
            <${StatCard} value=${a.workoutCount} label="Tréningy" />
            <${StatCard} value=${a.workoutCount ? formatNum(Math.round(a.perWeek * 10) / 10) : '–'} label="Za týždeň" />
            <${StatCard} value=${html`<${Pct} value=${a.avgChange} />`} label="Nárast sily" />
          </div>
        </div>
        <p class="section-footer">Nárast sily: priemer zmeny cvikov za obdobie (odhad 1RM, opakovania alebo čas).</p>
      </section>

      ${a.alerts.length > 0 && html`
        <section class="section">
          <h2 class="section-caption">Upozornenia</h2>
          <div class="card group alerts">
            ${a.alerts.map((row) => {
              const ex = exercises.get(row.exerciseId);
              const pes = planExercises.filter((pe) => pe.exerciseId === row.exerciseId);
              const canDeload = ex?.trackingType !== 'time' && pes.some((pe) => pe.weight > 0);
              const waiting = pes.some((pe) => pendingPe.has(pe.id));
              return html`
                <div class=${`alert ${row.trend.status}`} key=${row.exerciseId}>
                  <span class="alert-icon">${TREND_ICON[row.trend.status]()}</span>
                  <div class="alert-main">
                    <a class="alert-title" href=${`#/plans/${plan.id}/analytics/${row.exerciseId}`}
                      onClick=${go(`/plans/${plan.id}/analytics/${row.exerciseId}`)}>${ex?.name || 'Neznámy cvik'}</a>
                    <div class="alert-text">
                      ${TREND_LABEL[row.trend.status]} · ${lastSessions(row.trend.sessions)} ${formatPct(row.trend.changePct)}
                    </div>
                  </div>
                  ${waiting
                    ? html`<span class="alert-note">Odporúčanie čaká v pláne</span>`
                    : canDeload && html`
                      <button type="button" class="rec-btn accept" disabled=${busy} onClick=${() => deload(row)}>Deload</button>`}
                </div>`;
            })}
          </div>
          <p class="section-footer">
            Stagnácia: za ${lastSessions(stagnation.sessions)} nárast menej ako ${formatNum(stagnation.minGainPct)} %.
            Deload navrhne zníženie váhy o ~10 %. Hranice nastavíš v úprave plánu.
          </p>
        </section>`}

      <${SectionCard} title="Týždenný objem" icon=${Icon.barChart()}>
        ${hasVolume
          ? html`<${BarChart} bars=${a.weeks.map((w) => ({ t: w.t, value: w.volume, workouts: w.workouts }))}
              format=${volumeLabel} axisFormat=${volumeAxis} label="Týždenný objem plánu"
              title=${(b) => `od ${formatDateShort(b.t)} · ${plural(b.workouts, 'tréning', 'tréningy', 'tréningov')}`} />`
          : html`<p class="row-subtitle">Objem sa počíta zo sérií s váhou (kg × opakovania). V tomto období žiadne nie sú.</p>`}
      </${SectionCard}>

      <section class="section">
        <h2 class="section-caption">Cviky</h2>
        <div class="card group">
          ${a.rows.map((row) => {
            const ex = exercises.get(row.exerciseId);
            return html`
              <a class="row an-row" key=${row.exerciseId} href=${`#/plans/${plan.id}/analytics/${row.exerciseId}`}
                onClick=${go(`/plans/${plan.id}/analytics/${row.exerciseId}`)}>
                <div class="row-main">
                  <div class="row-title">${ex?.name || 'Neznámy cvik'}</div>
                  <div class="an-row-meta">
                    <span>${row.metric.label}: ${formatMetric(row.current, row.metric)}</span>
                    ${row.trend.status !== 'insufficient' && row.trend.status !== 'progress'
                      && html`<${TrendBadge} status=${row.trend.status} />`}
                    ${!row.inPlan && html`<span class="an-row-note">mimo plánu</span>`}
                  </div>
                </div>
                <${Sparkline} points=${row.points} />
                <div class="an-row-pct"><${Pct} value=${row.change} /></div>
                <span class="row-chevron">${Icon.chevronRight()}</span>
              </a>`;
          })}
        </div>
        <p class="section-footer">Zmena: prvé 2 tréningy obdobia oproti posledným 2.</p>
      </section>
    </div>`;
}

// ── Analytika cviku ─────────────────────────────────────

/** /exercises/:id/analytics (všetky plány) alebo /plans/:id/analytics/:exerciseId (jeden plán). */
export function ExerciseAnalyticsScreen({ params }) {
  const planId = params.exerciseId ? params.id : null;
  const exerciseId = params.exerciseId || params.id;
  const { data, loading, error, reload } = useAsync(async () => {
    const ex = await getExercise(exerciseId);
    if (!ex) return null;
    const [sessions, plan, recs] = await Promise.all([
      exerciseSessions(exerciseId), planId ? getPlan(planId) : null, exerciseRecommendations(exerciseId, planId),
    ]);
    return { ex, plan, recs, sessions: planId ? sessions.filter((s) => s.planId === planId) : sessions };
  }, [exerciseId, planId]);
  const [period, setPeriod] = usePeriod();
  const { busy, accept, dismiss } = useRecommendationActions(() => reload());

  const header = planId
    ? html`<${AppHeader} back=${`/plans/${planId}/analytics`} backLabel="Analytika" />`
    : html`<${AppHeader} back=${`/exercises/${exerciseId}`} backLabel="Cvik" />`;
  if (loading && !data) return html`<div class="screen">${header}<${Loading} /></div>`;
  if (error) return html`<div class="screen">${header}<${ErrorBox} error=${error} /></div>`;
  if (!data) return html`<div class="screen">${header}<${EmptyState} title="Cvik neexistuje" /></div>`;

  const { ex, plan, recs, sessions } = data;
  const type = ex.trackingType;
  const stagnation = { ...DEFAULT_STAGNATION, ...plan?.stagnation };
  const a = exerciseAnalytics(sessions, type, { from: periodStart(period), stagnation });
  const { metric } = a;
  const fmt = (v) => formatMetric(v, metric);
  const records = personalRecords(sessions, type);
  const list = sessions.filter((s) => s.t >= periodStart(period)).reverse();
  const bestOf = new Map(a.all.map((p) => [p.workoutId, p]));

  const head = html`
    <div class="detail-head">
      <h1 class="page-title">${ex.name}</h1>
      <div class="tags">
        <${Tag} kind="primary">${planId ? plan?.name || 'Plán' : 'Všetky plány'}</${Tag}>
        <${Tag} kind="muted">${metric.label}</${Tag}>
      </div>
    </div>`;

  if (!sessions.length) {
    return html`<div class="screen">${header}${head}
      <${EmptyState} title="Zatiaľ žiadne odcvičené série"
        text=${planId ? 'Cvik zatiaľ nebol odcvičený v tomto pláne.' : 'Graf sa zobrazí po prvom tréningu s týmto cvikom.'} /></div>`;
  }

  const trendText = a.trend.status === 'insufficient'
    ? `Trend sa vyhodnotí po ${a.trend.sessions} tréningoch.`
    : `${lastSessions(a.trend.sessions).replace(/^p/, 'P')}: ${formatPct(a.trend.changePct)}.`;

  return html`
    <div class="screen">
      ${header}
      ${head}
      <${PeriodChips} period=${period} onChange=${setPeriod} />

      <section class="section">
        <div class="card summary-stats">
          <div class="stats">
            <${StatCard} value=${fmt(a.current)} label="Posledný tréning" />
            <${StatCard} value=${html`<${Pct} value=${a.change} />`} label="Zmena v období" />
            <${StatCard} value=${a.points.length} label="Tréningy" />
          </div>
          <div class="trend-line">
            ${a.trend.status !== 'insufficient' && html`<${TrendBadge} status=${a.trend.status} />`}
            <span>${trendText}</span>
          </div>
        </div>
      </section>

      <${SectionCard} title=${metric.label} icon=${Icon.trendUp(20)}>
        ${a.points.length
          ? html`<${LineChart} points=${a.points} format=${fmt} axisFormat=${(v) => formatNum(v)}
              label=${`${metric.label} v čase`} detail=${(p) => setLabel(p.set, type)} />`
          : html`<p class="row-subtitle">V tomto období žiadne tréningy.</p>`}
        ${metric.key === 'e1rm' && html`<p class="chart-note">Odhad 1RM (Epley): váha × (1 + opakovania / 30) z najlepšej série tréningu.</p>`}
        ${type === 'bodyweight_reps' && html`<p class="chart-note">
          ${metric.key === 'reps' ? 'Rátajú sa série bez záťaže.' : 'Rátajú sa série so záťažou (podľa posledného tréningu).'}</p>`}
      </${SectionCard}>

      ${records.length > 0 && html`
        <section class="section">
          <h2 class="section-caption">Osobné rekordy</h2>
          <div class="card group">
            ${records.map((r) => html`
              <a class="row" key=${r.key} href=${`#/history/${r.workoutId}`} onClick=${go(`/history/${r.workoutId}`)}>
                <span class="settings-icon">${Icon.trophy(20)}</span>
                <div class="row-main">
                  <div class="row-title">${r.label}</div>
                  <div class="row-subtitle">${[r.detail, formatDate(r.t)].filter(Boolean).join(' · ')}</div>
                </div>
                <div class="pr-value">${formatNum(r.value)} ${r.unit}</div>
              </a>`)}
          </div>
        </section>`}

      ${list.length > 0 && html`
        <${SectionCard} title="Tréningy" icon=${Icon.clock(20)}>
          <div class="recent">
            ${list.map((s) => html`
              <a class="recent-row" key=${s.workoutId} href=${`#/history/${s.workoutId}`} onClick=${go(`/history/${s.workoutId}`)}>
                <span class="recent-date">${formatDate(s.t)}</span>
                <span class="recent-sets">
                  ${s.sets.map((x) => setLabel(x, type, { compact: true })).join(' · ')}
                  ${bestOf.has(s.workoutId) && html`<span class="recent-best">${fmt(bestOf.get(s.workoutId).value)}</span>`}
                </span>
              </a>`)}
          </div>
        </${SectionCard}>`}

      ${recs.length > 0 && html`
        <section class="section">
          <h2 class="section-caption">História odporúčaní</h2>
          <div class="card group rec-history">
            ${recs.map((rec) => html`
              <div key=${rec.id}>
                <${RecommendationItem} rec=${rec} exercise=${ex} busy=${busy} compact
                  onAccept=${() => accept(rec)} onDismiss=${() => dismiss(rec)} />
                <div class="rec-date">${formatDate(rec.createdAt)}</div>
              </div>`)}
          </div>
        </section>`}
    </div>`;
}
