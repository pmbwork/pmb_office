// Finestre «Valuta formula» e «Finestra controllo» di pmb_sheets (Strumenti), come in Excel.
// Valuta formula: la formula della cella attiva e i suoi pezzi dal più interno al più esterno, ognuno con il suo valore.
// Finestra controllo: un pannello che resta aperto con le celle da tenere d'occhio (foglio, cella, valore, formula), aggiornato da solo.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

export interface PassoValutazione { testo: string; valore: string }
export interface CellaOsservata { foglio: string; cella: string; valore: string; formula: string }

const STILE_BASE = css`
  :host { font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
  h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--color-border, #e8eaed); vertical-align: top; }
  th { font-weight: 500; color: var(--color-text-muted, #5f6368); font-size: 12px; }
  td.formula, code { font-family: Consolas, 'Courier New', monospace; font-size: 12px; overflow-wrap: anywhere; }
  .vuoto { color: var(--color-text-muted, #5f6368); }
  .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  button { padding: 6px 14px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
  button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
`;

@customElement('free-dialogo-valuta')
export class FreeDialogoValuta extends LinguaElement {
  @property({ type: String }) cella = '';
  @property({ type: String }) formula = '';
  @property({ attribute: false }) passi: PassoValutazione[] = [];

  static styles = [STILE_BASE, css`
    :host { position: fixed; inset: 0; z-index: 1000; }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 620px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); overflow: auto; box-sizing: border-box; }
    .formula-intera { margin: 0 0 12px; padding: 8px; background: var(--color-bg-subtle, #f8f9fa); border-radius: 4px; }
  `];

  firstUpdated(): void { (this.renderRoot.querySelector('button') as HTMLButtonElement | null)?.focus(); }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }

  render() {
    return html`
      <div class="velo" @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); this.chiudi(); } }}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-valuta">
          <h2 id="titolo-valuta">${t('Valuta formula: {}', this.cella)}</h2>
          <p class="formula-intera"><code>${this.formula}</code></p>
          ${this.passi.length === 0 ? html`<p class="vuoto">La cella non contiene una formula.</p>` : html`
            <table>
              <thead><tr><th>Passo</th><th>Pezzo della formula</th><th>Valore</th></tr></thead>
              <tbody>${this.passi.map((p, i) => html`<tr><td>${i + 1}</td><td class="formula">${p.testo}</td><td>${p.valore}</td></tr>`)}</tbody>
            </table>`}
          <div class="bottoni"><button class="primario" data-azione="chiudi" @click=${() => this.chiudi()}>Chiudi</button></div>
        </div>
      </div>`;
  }
}

@customElement('free-pannello-controllo')
export class FreePannelloControllo extends LinguaElement {
  @property({ attribute: false }) celle: CellaOsservata[] = [];

  static styles = [STILE_BASE, css`
    :host { position: fixed; right: 16px; bottom: 40px; z-index: 900; }
    .pannello { background: var(--color-bg, #fff); border: 1px solid var(--color-border, #dadce0); border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2); padding: 12px 14px; width: 520px; max-width: calc(100vw - 32px); max-height: 50vh; overflow: auto; box-sizing: border-box; }
    button.piccolo { padding: 2px 8px; }
  `];

  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  render() {
    return html`
      <div class="pannello" role="region" aria-labelledby="titolo-controllo">
        <h2 id="titolo-controllo">Finestra controllo</h2>
        ${this.celle.length === 0 ? html`<p class="vuoto">Nessuna cella: seleziona una cella e premi «Aggiungi la cella attiva».</p>` : html`
          <table>
            <thead><tr><th>Foglio</th><th>Cella</th><th>Valore</th><th>Formula</th><th></th></tr></thead>
            <tbody>${this.celle.map((c, i) => html`<tr data-cella=${c.cella}><td>${c.foglio}</td><td>${c.cella}</td><td class="valore">${c.valore}</td><td class="formula">${c.formula || nothing}</td>
              <td><button class="piccolo togli" aria-label=${t('Togli {}', c.cella)} @click=${() => this.invia('togli-osservata', { indice: i })}>×</button></td></tr>`)}</tbody>
          </table>`}
        <div class="bottoni">
          <button class="aggiungi" @click=${() => this.invia('aggiungi-osservata')}>Aggiungi la cella attiva</button>
          <button class="chiudi" @click=${() => this.invia('chiudi-controllo')}>Chiudi</button>
        </div>
      </div>`;
  }
}
