import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

/** Finestra di Inserisci › Didascalia… (come «Inserisci didascalia» di Word): la serie (Figura, Tabella, Equazione), il testo e se la
 *  didascalia va sotto o sopra il paragrafo (o la tabella) dov'è il cursore. Il numero si conta da solo. */
@customElement('docs-didascalia')
export class DocsDidascalia extends LinguaElement {
  @state() private serie = 'Figura';
  @state() private testo = '';
  @state() private sopra = false;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 440px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
    label { display: block; margin: 0 0 4px; font-size: 12px; color: var(--pmb-testo-2, #5f6368); }
    select, input[type=text] { width: 100%; height: 36px; box-sizing: border-box; padding: 0 10px; margin-bottom: 12px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; background: var(--pmb-superficie, #ffffff); color: inherit; }
    .posizione { display: flex; gap: 16px; margin-bottom: 16px; }
    .posizione label { display: inline-flex; gap: 6px; align-items: center; font-size: 14px; color: inherit; margin: 0; }
    .anteprima { margin: 0 0 16px; font-style: italic; color: var(--pmb-testo-2, #5f6368); }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input[type=text]')?.focus(); }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }
  private conferma(): void { this.invia('applica', { serie: t(this.serie), testo: this.testo, sopra: this.sopra }); }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-didascalia" @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.conferma(); } }}>
        <h2 id="titolo-didascalia">${t('Didascalia')}</h2>
        <label for="serie">${t('Etichetta')}</label>
        <select id="serie" @change=${(e: Event) => { this.serie = (e.target as HTMLSelectElement).value; }}>
          ${['Figura', 'Tabella', 'Equazione'].map((s) => html`<option value=${s} ?selected=${s === this.serie}>${t(s)}</option>`)}
        </select>
        <label for="testo-didascalia">${t('Testo')}</label>
        <input id="testo-didascalia" type="text" maxlength="500" .value=${this.testo} @input=${(e: Event) => { this.testo = (e.target as HTMLInputElement).value; }} />
        <div class="posizione" role="radiogroup" aria-label=${t('Posizione')}>
          <label><input type="radio" name="pos" ?checked=${!this.sopra} @change=${() => { this.sopra = false; }} />${t('Sotto')}</label>
          <label><input type="radio" name="pos" ?checked=${this.sopra} @change=${() => { this.sopra = true; }} />${t('Sopra')}</label>
        </div>
        <p class="anteprima">${t(this.serie)} N${this.testo.trim() ? `: ${this.testo.trim()}` : ''}</p>
        <div class="pulsanti">
          <button class="annulla" @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario applica" @click=${() => this.conferma()}>${t('Inserisci')}</button>
        </div>
      </div>`;
  }
}
