import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

/** Chiudendo pmb_docs con modifiche non salvate: Salva, Non salvare o Annulla (come Word e Writer). Avvisa con "scelta" (salva | esci | annulla). */
@customElement('docs-uscita')
export class DocsUscita extends LinguaElement {
  /** il nome del documento, per la domanda */
  @property() nome = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }
    :host { display: block; font: 13px Roboto, Arial, sans-serif; color: var(--pmb-testo, #202124); }
    .dialogo { width: 420px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 20px 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); }
    h2 { margin: 0 0 10px; font-size: 16px; font-weight: 500; }
    p { margin: 0 0 18px; color: var(--pmb-testo-2, #5f6368); }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: inherit; font: inherit; cursor: pointer; }
    button:hover { background: var(--pmb-superficie-2, #f8f9fa); }
    button.primario { background: #0b57d0; border-color: #0b57d0; color: #ffffff; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLButtonElement>('button.salva')?.focus(); }
  private scegli(scelta: 'salva' | 'esci' | 'annulla'): void {
    this.dispatchEvent(new CustomEvent('scelta', { detail: { scelta }, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="titolo-uscita" aria-describedby="testo-uscita"
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.scegli('annulla'); } }}>
        <h2 id="titolo-uscita">${t('Salvare le modifiche a «{}»?', this.nome)}</h2>
        <p id="testo-uscita">Se esci senza salvare, le modifiche andranno perse.</p>
        <div class="pulsanti">
          <button class="esci" @click=${() => this.scegli('esci')}>Non salvare</button>
          <button class="annulla" @click=${() => this.scegli('annulla')}>Annulla</button>
          <button class="salva primario" @click=${() => this.scegli('salva')}>Salva</button>
        </div>
      </div>`;
  }
}
