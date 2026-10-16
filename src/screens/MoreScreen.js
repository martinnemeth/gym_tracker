import { html, useState } from '../lib.js';
import { listExercises, syncLibrary } from '../db/exercises.js';
import { APP_VERSION } from '../config.js';
import { formatBytes } from '../util.js';
import { LargeHeader, Section, Row, useAsync, showToast } from '../ui/components.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

async function storageInfo() {
  const s = navigator.storage;
  const persisted = s?.persisted ? await s.persisted() : null;
  const estimate = s?.estimate ? await s.estimate() : null;
  return { persisted, estimate };
}

export function MoreScreen() {
  const storage = useAsync(storageInfo);
  const deleted = useAsync(async () =>
    (await listExercises({ includeDeleted: true })).filter((e) => e.deletedAt).length);
  const [busy, setBusy] = useState(false);

  async function requestPersist() {
    const ok = await navigator.storage?.persist?.();
    showToast(ok ? 'Trvalé úložisko povolené' : 'Prehliadač trvalé úložisko nepovolil');
    storage.reload();
  }

  async function restoreLibrary() {
    if (!confirm('Doplniť chýbajúce cviky z predvolenej knižnice a obnoviť zmazané?\n\nTvoje úpravy cvikov ostanú zachované.')) return;
    setBusy(true);
    const { added, restored } = await syncLibrary({ restoreDeleted: true });
    setBusy(false);
    showToast(added + restored === 0 ? 'Knižnica je kompletná' : `Doplnené: ${added}, obnovené: ${restored}`);
    deleted.reload();
  }

  const st = storage.data;
  const standalone = isStandalone();

  return html`
    <div class="screen">
      <${LargeHeader} title="Viac" />

      <${Section} title="Dáta"
        footer="Záloha (export/import JSON) a export pre AI pribudnú v etape M5.">
        <${Row} title="Záloha a obnova" value="čoskoro" disabled />
        <${Row} title="Export pre AI analýzu" value="čoskoro" disabled />
      </${Section}>

      <${Section} title="Knižnica cvikov">
        <${Row} title="Zmazané cviky" value=${deleted.data ?? ''} href="#/more/deleted-exercises" chevron />
        <${Row} title="Doplniť / obnoviť predvolenú knižnicu" onClick=${restoreLibrary} disabled=${busy} />
      </${Section}>

      <${Section} title="Úložisko"
        footer=${standalone
          ? 'Aplikácia beží z plochy. Dáta sú uložené iba v tomto zariadení — pravidelne si rob zálohu.'
          : 'Na iPhone otvor stránku v Safari → Zdieľať → Pridať na plochu. Aplikácia z plochy funguje offline a iOS jej dáta nemaže tak ľahko ako bežnému webu.'}>
        <${Row} title="Režim" value=${standalone ? 'Aplikácia na ploche' : 'Prehliadač'} />
        <${Row} title="Trvalé úložisko"
          value=${st?.persisted == null ? 'nepodporované' : st.persisted ? 'áno' : html`<button class="btn-link" onClick=${requestPersist}>Požiadať</button>`} />
        <${Row} title="Využité miesto"
          value=${st?.estimate ? `${formatBytes(st.estimate.usage)} z ${formatBytes(st.estimate.quota)}` : '–'} />
      </${Section}>

      <${Section} title="O aplikácii">
        <${Row} title="Verzia" value=${APP_VERSION} />
      </${Section}>
    </div>`;
}
