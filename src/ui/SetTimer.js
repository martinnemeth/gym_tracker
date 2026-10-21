import { html, useState, useEffect } from '../lib.js';
import { formatClock } from '../format.js';
import { Icon } from './icons.js';
import { TimerRing, beep } from './RestTimer.js';

// Stopky série časového cviku (plank, vis): prípravný odpočet, potom odpočet zadaného času.
// Stav je len v pamäti — pri reštarte aplikácie sa stopky zrušia (séria sa nezapíše).

export const PREP_SEC = 5;

/** Krátke pípnutie / vibrácia pri prechode z prípravy do cvičenia. */
function tick() {
  try { navigator.vibrate?.(80); } catch { /* bez vibrácie */ }
}

/**
 * name: názov cviku, targetSec: cieľový čas.
 * onFinish(sec): séria dokončená (celý čas, alebo skutočný čas pri skoršom zastavení).
 * onCancel(): zrušené bez zápisu.
 */
export function SetTimer({ name, targetSec, onFinish, onCancel }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const elapsed = (now - startedAt) / 1000;
  const prep = elapsed < PREP_SEC;
  const work = Math.max(0, elapsed - PREP_SEC);
  const finished = work >= targetSec;

  useEffect(() => { if (!prep) tick(); }, [prep]);
  useEffect(() => {
    if (!finished) return undefined;
    beep();
    const id = setTimeout(() => onFinish(targetSec), 900);
    return () => clearTimeout(id);
  }, [finished]);

  const stop = () => (work >= 1 ? onFinish(Math.round(work)) : onCancel());

  const progress = prep ? 1 - elapsed / PREP_SEC : 1 - work / targetSec;
  return html`
    <div class="timer-modal" role="timer" aria-label=${`Stopky: ${name}`}>
      <div class=${`timer-card ${prep ? 'prep' : ''} ${finished ? 'done' : ''}`}>
        <div class="timer-name">${name}</div>
        <${TimerRing} progress=${finished ? 0 : progress} size=${232} stroke=${8}>
          <div class="timer-ring-center">
            ${finished
              ? html`<span class="rest-done-icon">${Icon.check(44)}</span><span class="rest-done-text">Hotovo</span>`
              : prep
                ? html`<div class="rest-label">Priprav sa</div><div class="rest-time prep-count">${Math.ceil(PREP_SEC - elapsed)}</div>`
                : html`<div class="rest-label">Zostáva</div><div class="rest-time">${formatClock(Math.ceil(targetSec - work))}</div>`}
          </div>
        </${TimerRing}>
        ${!finished && html`
          <div class="rest-actions">
            <button type="button" class="rest-btn" onClick=${onCancel} aria-label="Zrušiť bez zápisu">${Icon.x(22)}</button>
            ${!prep && html`
              <button type="button" class="timer-stop" onClick=${stop}>
                <span class="timer-stop-icon" />Ukončiť sériu
              </button>`}
          </div>
          <p class="timer-hint">${prep ? `Cieľ ${formatClock(targetSec)}` : 'Pri skoršom ukončení sa zapíše odcvičený čas.'}</p>`}
      </div>
    </div>`;
}
