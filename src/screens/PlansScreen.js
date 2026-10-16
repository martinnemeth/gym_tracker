import { html } from '../lib.js';
import { LargeHeader, EmptyState } from '../ui/components.js';

// M2: zoznam plánov, aktívny plán navrchu s rýchlym štartom ďalšieho dňa.
export function PlansScreen() {
  return html`
    <div class="screen">
      <${LargeHeader} title="Plány" />
      <${EmptyState}
        title="Zatiaľ žiadne plány"
        text="Tvorba plánov (dni, cviky, série, pravidlá) pribudne v ďalšej etape. Medzitým si môžeš pripraviť knižnicu cvikov a ich techniku." />
    </div>`;
}
