import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import { SPIEGAZIONI, type ProblemaAccessibilita } from '../modello/accessibilita';

/** Finestra di Strumenti › Controlla accessibilità: l'elenco dei problemi trovati, con «Vai» per andare al punto del testo e la spiegazione
 *  di come correggerli; «Ricontrolla» rifà il controllo dopo le correzioni. */
@customElement('docs-accessibilita')
export class DocsAccessibilita extends LinguaElement {
  @property({ attribute: false }) problemi: ProblemaAccessibilita[] = [];

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 560px; max-width: calc(100vw - 32px); max-height: calc(100vh - 120px); display: flex; flex-direction: column; box-sizing: border-box; padding: 24px;
      background: var(--pmb-superficie, #ffffff); border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 500; }
    .riassunto { margin: 0 0 12px; color: var(--pmb-testo-2, #5f6368); }
    ul { list-style: none; margin: 0 0 16px; padding: 0; overflow: auto; flex: 1; }
    li { border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; }
    .titolo { font-weight: 500; }
    .estratto { color: var(--pmb-testo-2, #5f6368); font-style: italic; overflow-wrap: anywhere; }
    .correzione { grid-column: 1 / -1; color: var(--pmb-testo-2, #5f6368); font-size: 13px; line-height: 1.4; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    button { height: 32px; padding: 0 14px; border-radius: 16px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    .bene { margin: 0 0 16px; padding: 12px; border-radius: 6px; background: #e6f4ea; color: #137333; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLButtonElement>('button')?.focus(); }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  render() {
    const n = this.problemi.length;
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-accessibilita">
        <h2 id="titolo-accessibilita">${t('Controllo accessibilità')}</h2>
        ${n === 0 ? html`<p class="bene" role="status">${t('Nessun problema trovato: il documento si legge bene anche con un lettore di schermo.')}</p>`
          : html`<p class="riassunto" role="status">${n === 1 ? t('Un problema da correggere') : t('{} problemi da correggere', n)}</p>
          <ul>${this.problemi.map((x) => html`<li data-tipo=${x.tipo}>
            <span class="titolo">${t(SPIEGAZIONI[x.tipo].titolo)}</span>
            <button class="vai" @click=${() => this.invia('vai', { p: x.p, o: x.o, immagine: x.tipo === 'immagine-senza-alt' })}>${t('Vai')}</button>
            ${x.estratto ? html`<span class="estratto">«${x.estratto}»</span>` : nothing}
            <span class="correzione">${t(SPIEGAZIONI[x.tipo].correzione)}</span>
          </li>`)}</ul>`}
        <div class="pulsanti">
          <button class="ricontrolla" @click=${() => this.invia('ricontrolla')}>${t('Ricontrolla')}</button>
          <button class="primario chiudi" @click=${() => this.invia('chiudi')}>${t('Chiudi')}</button>
        </div>
      </div>`;
  }
}
