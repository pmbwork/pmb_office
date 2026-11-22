import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { LUNGHEZZA_MASSIMA_FILIGRANA } from '../modello/documento';
import { t } from '../i18n/lingua';

/** Finestra della filigrana (Formato › Filigrana): un testo grande, chiaro e in diagonale su ogni pagina, come la filigrana di Word. */
@customElement('docs-filigrana')
export class DocsFiligrana extends LinguaElement {
  @property({ type: String }) attuale = '';
  @state() private valore = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 420px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
    .proposte { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    input { width: 100%; height: 36px; box-sizing: border-box; padding: 0 10px; margin-bottom: 16px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; background: var(--pmb-superficie, #ffffff); color: inherit; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.piccolo { height: 28px; padding: 0 12px; }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
  `;

  connectedCallback(): void { super.connectedCallback(); this.valore = this.attuale; }
  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input')?.focus(); }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-filigrana" @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.invia('applica', { testo: this.valore }); } }}>
        <h2 id="titolo-filigrana">Filigrana</h2>
        <div class="proposte">${['BOZZA', 'RISERVATO', 'COPIA', 'URGENTE', 'NON COPIARE'].map((p) => html`<button class="piccolo proposta" @click=${() => { this.valore = t(p); }}>${t(p)}</button>`)}</div>
        <input type="text" aria-label="Testo della filigrana" maxlength=${LUNGHEZZA_MASSIMA_FILIGRANA} .value=${this.valore} @input=${(e: Event) => { this.valore = (e.target as HTMLInputElement).value; }} />
        <div class="pulsanti">
          <button class="togli" @click=${() => this.invia('applica', { testo: '' })}>Togli la filigrana</button>
          <button class="annulla" @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario applica" @click=${() => this.invia('applica', { testo: this.valore })}>Applica</button>
        </div>
      </div>`;
  }
}
