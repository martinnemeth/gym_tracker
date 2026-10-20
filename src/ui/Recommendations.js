import { html, useState } from '../lib.js';
import { acceptRecommendation, dismissRecommendation } from '../db/recommendations.js';
import { changeLabel, KIND_LABEL } from '../progression.js';
import { Icon, showToast } from './components.js';

/** Zoradí odporúčania podľa poradia cvikov (planExerciseId) v tréningu alebo pláne. */
export function sortByOrder(recs, planExerciseIds) {
  const pos = (r) => { const i = planExerciseIds.indexOf(r.planExerciseId); return i < 0 ? Infinity : i; };
  return [...recs].sort((a, b) => pos(a) - pos(b));
}

const STATUS_LABEL = { accepted: 'Prijaté', dismissed: 'Zamietnuté' };

/** Jedno odporúčanie: druh, cvik, zmena cieľa, dôvod; pri čakajúcom tlačidlá Prijať / Nie. */
export function RecommendationItem({ rec, exercise, busy, onAccept, onDismiss, compact }) {
  const type = exercise?.trackingType || 'weight_reps';
  const down = rec.kind === 'deload';
  return html`
    <div class=${`rec ${down ? 'down' : ''} ${compact ? 'compact' : ''} ${rec.status}`}>
      <span class="rec-icon">${down ? Icon.trendDown(18) : Icon.trendUp(18)}</span>
      <div class="rec-main">
        ${compact
          ? html`<div class="rec-kind">${KIND_LABEL[rec.kind]}</div>`
          : html`<div class="rec-ex">${exercise?.name || 'Neznámy cvik'}</div>`}
        <div class="rec-change">${changeLabel(rec, type)}</div>
        ${!compact && html`<div class="rec-reason">${KIND_LABEL[rec.kind]}. ${rec.reason}</div>`}
      </div>
      ${rec.status === 'pending'
        ? html`
          <div class="rec-actions">
            <button type="button" class="rec-btn dismiss" aria-label="Zamietnuť odporúčanie" disabled=${busy}
              onClick=${onDismiss}>${Icon.x(16)}</button>
            <button type="button" class="rec-btn accept" disabled=${busy} onClick=${onAccept}>
              ${compact ? 'Použiť' : 'Prijať'}
            </button>
          </div>`
        : html`<span class="rec-status">${STATUS_LABEL[rec.status] || ''}</span>`}
    </div>`;
}

/**
 * Prijatie / zamietnutie odporúčaní so zámkom proti dvojkliku.
 * onResolved(rec, planExercise|null) sa zavolá po každej zmene.
 */
export function useRecommendationActions(onResolved) {
  const [busy, setBusy] = useState(false);
  async function run(fn) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  }
  const accept = (rec) => run(async () => {
    const pe = await acceptRecommendation(rec.id);
    showToast(pe ? 'Cieľ v pláne upravený' : 'Cvik už v pláne nie je');
    await onResolved(rec, pe);
  });
  const dismiss = (rec) => run(async () => {
    await dismissRecommendation(rec.id);
    await onResolved(rec, null);
  });
  const acceptAll = (recs) => run(async () => {
    let n = 0;
    for (const rec of recs) if (await acceptRecommendation(rec.id)) n++;
    showToast(`Upravené ciele: ${n}`);
    await onResolved(null, null);
  });
  return { busy, accept, dismiss, acceptAll };
}

/** Karta so zoznamom odporúčaní (súhrn tréningu, detail plánu). */
export function RecommendationsCard({ title = 'Progresia', recs, exercises, footer, onChanged }) {
  const { busy, accept, dismiss, acceptAll } = useRecommendationActions(() => onChanged());
  const pending = recs.filter((r) => r.status === 'pending');
  return html`
    <section class="section">
      <div class="section-caption-row">
        <h2 class="section-caption">${title}</h2>
        ${pending.length > 1 && html`
          <button type="button" class="text-btn strong" disabled=${busy} onClick=${() => acceptAll(pending)}>Prijať všetky</button>`}
      </div>
      <div class="card group recs">
        ${recs.map((rec) => html`
          <${RecommendationItem} key=${rec.id} rec=${rec} exercise=${exercises.get(rec.exerciseId)} busy=${busy}
            onAccept=${() => accept(rec)} onDismiss=${() => dismiss(rec)} />`)}
      </div>
      ${footer && html`<p class="section-footer">${footer}</p>`}
    </section>`;
}
