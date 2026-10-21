import { html, useState, useRef } from '../lib.js';
import { getAll, getSetting, setSetting } from '../db/db.js';
import { createBackup, backupFileName, markBackedUp, lastBackupAt, validateBackup, restoreBackup } from '../db/backup.js';
import { listPlans } from '../db/plans.js';
import { listFinishedWorkouts } from '../db/workouts.js';
import { listExercises } from '../db/exercises.js';
import { buildAiExport, buildCsv, isoDate, DEFAULT_PROMPT } from '../aiExport.js';
import { PERIODS } from '../analytics.js';
import { formatDate, formatAgo, plural } from '../format.js';
import { formatBytes } from '../util.js';
import {
  AppHeader, Section, SettingsRow, PrimaryButton, SecondaryButton, FilterChip, TextButton, Icon,
  Loading, ErrorBox, useAsync, showToast,
} from '../ui/components.js';
import { shareFile, copyText, readFile } from '../ui/share.js';

// ── Záloha a obnova ─────────────────────────────────────

export function BackupScreen() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [backup, last] = await Promise.all([createBackup(), lastBackupAt()]);
    const text = JSON.stringify(backup);
    return { backup, text, last };
  });
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const header = html`<${AppHeader} back="/more" backLabel="Nastavenia" />`;
  if (loading && !data) return html`<div class="screen">${header}<${Loading} /></div>`;
  if (error) return html`<div class="screen">${header}<${ErrorBox} error=${error} /></div>`;

  const { backup, text, last } = data;
  const c = Object.fromEntries(Object.entries(backup.stores).map(([k, v]) => [k, v.length]));
  const workouts = backup.stores.workouts.filter((w) => w.status === 'done').length;

  // Bez await pred shareFile — iOS inak zdieľanie zablokuje.
  function save() {
    shareFile({ name: backupFileName(), text }).then(async (result) => {
      if (result === 'cancelled') return;
      await markBackedUp();
      showToast(result === 'shared' ? 'Záloha pripravená' : 'Záloha stiahnutá');
      reload();
    });
  }

  async function onFile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file || busy) return;
    setBusy(true);
    try {
      let parsed;
      try { parsed = JSON.parse(await readFile(file)); } catch { throw new Error('Súbor nie je platný JSON.'); }
      const info = validateBackup(parsed);
      const done = (parsed.stores.workouts || []).filter((w) => w.status === 'done').length;
      const when = info.exportedAt ? formatDate(Date.parse(info.exportedAt)) : 'neznámy dátum';
      const msg = `Obnoviť zálohu z ${when}?\n\n`
        + `${plural(done, 'tréning', 'tréningy', 'tréningov')}, ${plural(info.counts.plans, 'plán', 'plány', 'plánov')}, `
        + `${plural(info.counts.exercises, 'cvik', 'cviky', 'cvikov')}.\n\n`
        + 'Všetky súčasné dáta v tomto zariadení sa nahradia obsahom zálohy.';
      if (!confirm(msg)) return;
      await restoreBackup(parsed);
      showToast('Záloha obnovená');
      // Čistý štart: stav v pamäti (časovač, obrazovky) sa načíta znova z obnovenej DB.
      setTimeout(() => { location.hash = '#/plans'; location.reload(); }, 600);
    } catch (err) {
      alert(`Obnova zlyhala: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return html`
    <div class="screen">
      ${header}
      <div class="detail-head">
        <h1 class="page-title">Záloha a obnova</h1>
      </div>

      <${Section} title="Záloha"
        footer="Záloha je JSON súbor so všetkými dátami: cviky, plány, tréningy, série a odporúčania. Ulož ho do Súborov (iCloud Drive) alebo si ho pošli e-mailom.">
        <${SettingsRow} icon=${Icon.clock(20)} title="Posledná záloha"
          value=${last ? formatAgo(last) : 'Nikdy'} />
        <${SettingsRow} icon=${Icon.database()} title="Obsah"
          subtitle=${`${plural(workouts, 'tréning', 'tréningy', 'tréningov')} · ${plural(c.sets, 'séria', 'série', 'sérií')} · ${plural(c.plans, 'plán', 'plány', 'plánov')} · ${plural(c.exercises, 'cvik', 'cviky', 'cvikov')}`}
          value=${formatBytes(new Blob([text]).size)} />
      </${Section}>
      <section class="section">
        <${PrimaryButton} block icon=${Icon.download()} onClick=${save}>Uložiť zálohu</${PrimaryButton}>
      </section>

      <${Section} title="Obnova"
        footer="Obnova nahradí všetky dáta v tomto zariadení obsahom zálohy. Ak tu máš niečo nové, najprv si ulož aktuálnu zálohu.">
        <${SettingsRow} icon=${Icon.upload()} title="Obnoviť zo zálohy…" disabled=${busy}
          onClick=${() => fileRef.current?.click()} chevron />
      </${Section}>
      <input ref=${fileRef} type="file" accept="application/json,.json" class="visually-hidden" aria-hidden="true"
        tabindex="-1" onChange=${onFile} />
    </div>`;
}

// ── Export pre AI ───────────────────────────────────────

const FORMATS = [
  { id: 'json', label: 'JSON' },
  { id: 'csv', label: 'CSV' },
];

let lastOptions = { planId: null, period: 'all', format: 'json', withPrompt: true };

export function AiExportScreen() {
  const { data, loading, error } = useAsync(async () => {
    const [plans, workouts, all, recommendations, prompt] = await Promise.all([
      listPlans(), listFinishedWorkouts(), listExercises({ includeDeleted: true }), getAll('recommendations'),
      getSetting('aiPrompt', null),
    ]);
    if (lastOptions.planId && !plans.some((p) => p.id === lastOptions.planId)) lastOptions = { ...lastOptions, planId: null };
    return { plans, workouts, exercises: new Map(all.map((e) => [e.id, e])), recommendations, savedPrompt: prompt };
  });
  const [opts, setOptsState] = useState(lastOptions);
  const [prompt, setPrompt] = useState(null);
  const setOpts = (patch) => setOptsState((o) => { lastOptions = { ...o, ...patch }; return lastOptions; });

  const header = html`<${AppHeader} back="/more" backLabel="Nastavenia" />`;
  if (loading && !data) return html`<div class="screen">${header}<${Loading} /></div>`;
  if (error) return html`<div class="screen">${header}<${ErrorBox} error=${error} /></div>`;

  const { plans, workouts, exercises, recommendations, savedPrompt } = data;
  const promptText = prompt ?? savedPrompt ?? DEFAULT_PROMPT;
  const args = { plans, workouts, exercises, recommendations, planId: opts.planId, period: opts.period };
  const json = opts.format === 'json'
    ? buildAiExport({ ...args, prompt: opts.withPrompt ? promptText : null })
    : null;
  const body = json ? JSON.stringify(json, null, 2) : buildCsv(args);
  const count = json ? json.scope.workouts : body.split('\n').length - 2;
  const empty = json ? json.workouts.length === 0 : count === 0;
  const plan = plans.find((p) => p.id === opts.planId);
  const slug = (plan?.name || 'vsetko').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const fileName = `gymtracker-ai-${slug}-${isoDate(Date.now())}.${opts.format}`;
  // CSV prompt neobsahuje — pri kopírovaní ide pred dáta.
  const clipboard = opts.withPrompt && opts.format === 'csv' ? `${promptText}\n\n${body}` : body;

  function share() {
    shareFile({ name: fileName, text: body, type: opts.format === 'json' ? 'application/json' : 'text/csv' })
      .then((r) => r !== 'cancelled' && showToast(r === 'shared' ? 'Export pripravený' : 'Export stiahnutý'));
  }
  function copy() {
    copyText(clipboard).then((ok) => showToast(ok ? 'Skopírované do schránky' : 'Kopírovanie zlyhalo'));
  }
  function savePrompt(value) {
    setPrompt(value);
    setSetting('aiPrompt', value.trim() && value !== DEFAULT_PROMPT ? value : null).catch(() => {});
  }

  return html`
    <div class="screen">
      ${header}
      <div class="detail-head">
        <h1 class="page-title">Export pre AI</h1>
        <p class="page-lead">Čitateľné dáta s menami cvikov, cieľmi a vypočítaným progresom — na analýzu v Claude alebo inej AI.</p>
      </div>

      <section class="section">
        <h2 class="section-caption">Rozsah</h2>
        <div class="chips-wrap">
          <${FilterChip} active=${!opts.planId} onClick=${() => setOpts({ planId: null })}>Všetky tréningy</${FilterChip}>
          ${plans.map((p) => html`
            <${FilterChip} key=${p.id} active=${opts.planId === p.id} onClick=${() => setOpts({ planId: p.id })}>${p.name}</${FilterChip}>`)}
        </div>
      </section>

      <section class="section">
        <h2 class="section-caption">Obdobie</h2>
        <div class="chips-wrap">
          ${PERIODS.map((p) => html`
            <${FilterChip} key=${p.id} active=${opts.period === p.id} onClick=${() => setOpts({ period: p.id })}>${p.label}</${FilterChip}>`)}
        </div>
      </section>

      <section class="section">
        <h2 class="section-caption">Formát</h2>
        <div class="chips-wrap">
          ${FORMATS.map((f) => html`
            <${FilterChip} key=${f.id} active=${opts.format === f.id} onClick=${() => setOpts({ format: f.id })}>${f.label}</${FilterChip}>`)}
        </div>
        <p class="section-footer">
          ${opts.format === 'json'
            ? 'JSON: tréningy so sériami, plány a pravidlá slovami, progres cvikov (odhad 1RM, % zmena, stagnácia), rekordy a odporúčania.'
            : 'CSV: jeden riadok = jedna séria. Vhodné do tabuľky alebo na vlastné grafy.'}
        </p>
      </section>

      <${Section}>
        <label class="row toggle-row">
          <span class="settings-icon">${Icon.notes()}</span>
          <div class="row-main">
            <div class="row-title">Pridať prompt pre AI</div>
            <div class="row-subtitle">${opts.format === 'json' ? 'Vloží sa do súboru ako pole „prompt“' : 'Pridá sa pred dáta pri kopírovaní'}</div>
          </div>
          <input type="checkbox" class="switch" checked=${opts.withPrompt}
            onChange=${(e) => setOpts({ withPrompt: e.currentTarget.checked })} />
        </label>
      </${Section}>

      ${opts.withPrompt && html`
        <section class="section">
          <div class="section-caption-row">
            <h2 class="section-caption">Prompt</h2>
            ${promptText !== DEFAULT_PROMPT && html`<${TextButton} strong onClick=${() => savePrompt(DEFAULT_PROMPT)}>Predvolený</${TextButton}>`}
          </div>
          <textarea class="prompt-input" rows="8" aria-label="Prompt pre AI" value=${promptText}
            onInput=${(e) => setPrompt(e.currentTarget.value)} onBlur=${(e) => savePrompt(e.currentTarget.value)} />
        </section>`}

      <section class="section">
        <div class="card export-summary">
          <div class="export-file">${fileName}</div>
          <div class="row-subtitle">
            ${empty ? 'V zvolenom rozsahu nie sú žiadne tréningy.' : `${plural(count, opts.format === 'csv' ? 'séria' : 'tréning', opts.format === 'csv' ? 'série' : 'tréningy', opts.format === 'csv' ? 'sérií' : 'tréningov')} · ${formatBytes(new Blob([body]).size)}`}
          </div>
        </div>
        <div class="export-actions">
          <${PrimaryButton} block icon=${Icon.share()} onClick=${share} disabled=${empty}>Zdieľať súbor</${PrimaryButton}>
          <${SecondaryButton} block icon=${Icon.copy()} onClick=${copy} disabled=${empty}>Kopírovať do schránky</${SecondaryButton}>
        </div>
        <p class="section-footer">
          Súbor pošli cez zdieľanie do aplikácie Claude alebo ho ulož do Súborov. Dáta neopúšťajú zariadenie, kým ich sám nepošleš.
        </p>
      </section>
    </div>`;
}
