import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { LUNGHEZZA_MASSIMA_TESTO_ALTERNATIVO } from '../modello/documento';
import { t } from '../i18n/lingua';

/** Finestra del testo alternativo dell'immagine selezionata (Formato › Immagine › Testo alternativo…): la descrizione che leggono i
 *  lettori di schermo, come «Testo alternativo» di Word. Si salva nei .docx (descr) e negli .odt (svg:desc). */
@customElement('docs-testo-alternativo')
export class DocsTestoAlternativo extends LinguaElement {
  @property({ type: String }) attuale = '';
  @state() private valore = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 460px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
    p { margin: 0 0 12px; color: var(--pmb-testo-2, #5f6368); line-height: 1.4; }
    textarea { width: 100%; min-height: 80px; box-sizing: border-box; padding: 8px 10px; margin-bottom: 16px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; background: var(--pmb-superficie, #ffffff); color: inherit; resize: vertical; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
  `;

  connectedCallback(): void { super.connectedCallback(); this.valore = this.attuale; }
  focalizza(): void { const a = this.renderRoot.querySelector<HTMLTextAreaElement>('textarea'); a?.focus(); a?.select(); }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-alt" @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.invia('applica', { testo: this.valore }); } }}>
        <h2 id="titolo-alt">${t('Testo alternativo')}</h2>
        <p>${t('Descrivi l\'immagine in una o due frasi: è quello che sente chi usa un lettore di schermo.')}</p>
        <textarea aria-label=${t('Testo alternativo')} maxlength=${LUNGHEZZA_MASSIMA_TESTO_ALTERNATIVO} .value=${this.valore} @input=${(e: Event) => { this.valore = (e.target as HTMLTextAreaElement).value; }}></textarea>
        <div class="pulsanti">
          <button class="annulla" @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario applica" @click=${() => this.invia('applica', { testo: this.valore })}>Applica</button>
        </div>
      </div>`;
  }
}
