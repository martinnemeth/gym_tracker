import { html } from '../lib.js';
import { navigateRoot } from '../router.js';
import { AppHeader, PrimaryButton, Icon } from '../ui/components.js';

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

// M2: zoznam plánov, aktívny plán navrchu s rýchlym štartom ďalšieho dňa.
export function PlansScreen() {
  return html`
    <div class="screen">
      <${AppHeader} large title="Plány" />

      <section class="hero">
        <${PlateGraphic} />
        <h2 class="hero-title">Tvoj tréning<br />začína tu.</h2>
        <p class="hero-text">Vytvor si prvý tréningový plán a začni sledovať progres.</p>
        <${PrimaryButton} block disabled icon=${Icon.plus()}>Vytvoriť plán</${PrimaryButton}>
        <p class="hero-note">Tvorba plánov pribudne v ďalšej verzii.</p>
      </section>

      <section class="section">
        <div class="card features">
          <div class="feature">${Icon.calendar()}<span>Plány<br />tréningov</span></div>
          <div class="feature">${Icon.barChart(24)}<span>Sledovanie<br />progresu</span></div>
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
      </section>
    </div>`;
}
