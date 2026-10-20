import { html, useState } from '../lib.js';
import { listExercises, syncLibrary } from '../db/exercises.js';
import { APP_VERSION } from '../config.js';
import { formatBytes } from '../util.js';
import { AppHeader, Section, SettingsRow, Icon, useAsync, showToast } from '../ui/components.js';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

async function storageInfo() {
  const s = navigator.storage;
  const persisted = s?.persisted ? await s.persisted() : null;
  const estimate = s?.estimate ? await s.estimate() : null;
  return { persisted, estimate };
}

const soon = html`<span class="soon">Čoskoro</span>`;

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
    if (busy) return;
    if (!confirm('Doplniť chýbajúce cviky z predvolenej knižnice a obnoviť zmazané?\n\nTvoje úpravy cvikov ostanú zachované.')) return;
    setBusy(true);
    try {
      const { added, restored } = await syncLibrary({ restoreDeleted: true });
      showToast(added + restored === 0 ? 'Knižnica je kompletná' : `Doplnené: ${added}, obnovené: ${restored}`);
      deleted.reload();
    } finally {
      setBusy(false);
    }
  }

  const st = storage.data;
  const standalone = isStandalone();
  const canPersist = st && st.persisted === false;

  return html`
    <div class="screen">
      <${AppHeader} large title="Nastavenia" />

      <${Section} title="Dáta" footer="Záloha (export/import JSON) a export pre AI pribudnú v etape M5.">
        <${SettingsRow} icon=${Icon.cloud()} title="Záloha a obnova" value=${soon} disabled />
        <${SettingsRow} icon=${Icon.share()} title="Export pre AI analýzu" value=${soon} disabled />
      </${Section}>

      <${Section} title="Knižnica cvikov">
        <${SettingsRow} icon=${Icon.trash()} title="Zmazané cviky" value=${deleted.data ?? ''}
          href="#/more/deleted-exercises" chevron />
        <${SettingsRow} icon=${Icon.book()} title="Doplniť / obnoviť predvolenú knižnicu"
          onClick=${restoreLibrary} disabled=${busy} />
      </${Section}>

      <${Section} title="Úložisko"
        footer=${standalone
          ? 'Aplikácia beží z plochy. Dáta sú uložené iba v tomto zariadení — pravidelne si rob zálohu.'
          : 'Na iPhone otvor stránku v Safari → Zdieľať → Pridať na plochu. Aplikácia z plochy funguje offline a iOS jej dáta nemaže tak ľahko ako bežnému webu.'}>
        <${SettingsRow} icon=${Icon.smartphone()} title="Režim" value=${standalone ? 'Aplikácia na ploche' : 'Prehliadač'} />
        <${SettingsRow} icon=${Icon.shield()} title="Trvalé úložisko"
          value=${st?.persisted == null ? 'Nepodporované' : st.persisted ? 'Áno' : html`<span class="value-action">Požiadať</span>`}
          onClick=${canPersist ? requestPersist : undefined} />
        <${SettingsRow} icon=${Icon.database()} title="Využité miesto"
          value=${st?.estimate ? `${formatBytes(st.estimate.usage)} z ${formatBytes(st.estimate.quota)}` : '–'} />
      </${Section}>

      <${Section} title="O aplikácii">
        <${SettingsRow} icon=${Icon.info()} title="Verzia" value=${APP_VERSION} />
      </${Section}>
    </div>`;
}
