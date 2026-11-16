// Finestra delle preferenze di pmb_sheets: il tema (chiaro, scuro, come il sistema) e la lingua del programma (come Windows, italiano, inglese).
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { t, NOMI_LINGUA, type ScelteLingua } from '../i18n/lingua';

export type TemaPreferenza = 'light' | 'dark' | 'system';

const TEMI: Array<[TemaPreferenza, string]> = [
  ['light', 'Chiaro'],
  ['dark', 'Scuro'],
  ['system', 'Come il sistema'],
];

const LINGUE: Array<[ScelteLingua, string]> = [
  ['auto', 'Automatica (come Windows)'],
  ['it', NOMI_LINGUA.it],
  ['en', NOMI_LINGUA.en],
];

@customElement('free-dialogo-preferenze')
export class FreeDialogoPreferenze extends LinguaElement {
  /** il tema in uso, per segnare la scelta attuale */
  @property({ type: String }) tema: TemaPreferenza = 'system';
  /** la lingua scelta (auto = come Windows) */
  @property({ type: String }) lingua: ScelteLingua = 'auto';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 360px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 16px; font-size: 16px; font-weight: 500; }
    fieldset { border: 0; margin: 0 0 16px; padding: 0; }
    legend { font-weight: 500; margin-bottom: 8px; padding: 0; }
    label { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; }
    .bottoni { display: flex; justify-content: flex-end; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
  `;

  firstUpdated(): void {
    (this.renderRoot.querySelector('input:checked') as HTMLInputElement | null)?.focus();
  }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true }));
  }

  private scegli(tema: TemaPreferenza): void {
    this.tema = tema;
    this.dispatchEvent(new CustomEvent('scegli-tema', { detail: { tema }, bubbles: true, composed: true }));
  }

  private scegliLingua(lingua: ScelteLingua): void {
    this.lingua = lingua;
    this.dispatchEvent(new CustomEvent('scegli-lingua', { detail: { lingua }, bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
  };

  render() {
    return html`
      <div class="velo" @keydown=${this.suTasto} @click=${(e: Event) => { if (e.target === e.currentTarget) this.chiudi(); }}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-preferenze">
          <h2 id="titolo-preferenze">Preferenze</h2>
          <fieldset>
            <legend>Tema</legend>
            ${TEMI.map(([valore, nome]) => html`
              <label><input type="radio" name="tema" data-tema=${valore} .checked=${this.tema === valore} @change=${() => this.scegli(valore)} /> ${t(nome)}</label>`)}
          </fieldset>
          <fieldset>
            <legend>Lingua del programma</legend>
            ${LINGUE.map(([valore, nome]) => html`
              <label><input type="radio" name="lingua" data-lingua=${valore} .checked=${this.lingua === valore} @change=${() => this.scegliLingua(valore)} /> ${valore === 'auto' ? t(nome) : nome}</label>`)}
          </fieldset>
          <div class="bottoni"><button data-azione="chiudi" @click=${() => this.chiudi()}>Chiudi</button></div>
        </div>
      </div>`;
  }
}
