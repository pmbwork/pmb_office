import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import type { VoceStruttura } from '../modello/sommario';

/**
 * Pannello «Struttura del documento», a sinistra: i titoli (Titolo 1-3) rientrati per livello; quello della sezione del cursore è evidenziato;
 * un clic porta al titolo. Non tocca il documento: manda gli eventi al guscio.
 */
@customElement('docs-struttura')
export class DocsStruttura extends LinguaElement {
  @property({ attribute: false }) voci: VoceStruttura[] = [];
  @property({ attribute: false }) corrente: number | null = null;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }
    :host { display: flex; flex-direction: column; font: 13px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); background: var(--pmb-superficie, #ffffff);
      border-right: 1px solid var(--pmb-bordo, #dadce0); box-sizing: border-box; }
    .testa { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--pmb-bordo, #e8eaed); }
    h2 { margin: 0; font-size: 15px; font-weight: 500; }
    .chiudi { border: 0; background: none; font-size: 18px; width: 28px; height: 28px; border-radius: 14px; cursor: pointer; color: inherit; }
    .chiudi:hover { background: var(--pmb-hover, #e8eaed); }
    ul { list-style: none; margin: 0; padding: 8px 4px; overflow-y: auto; flex: 1; }
    li button { display: block; width: 100%; text-align: left; border: 0; background: none; font: inherit; color: inherit; padding: 5px 8px; border-radius: 6px;
      cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    li button:hover { background: var(--pmb-hover, #e8eaed); }
    li.l1 button { font-weight: 500; }
    li.l2 button { padding-left: 22px; }
    li.l3 button { padding-left: 36px; color: var(--pmb-testo-2, #5f6368); }
    li.corrente button { background: var(--pmb-selezione, #e8f0fe); color: var(--pmb-accento, #0b57d0); }
    .vuoto { color: var(--pmb-testo-2, #5f6368); padding: 12px; margin: 0; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLElement>('li button, .chiudi')?.focus(); }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  render() {
    return html`
      <div class="testa"><h2 id="titolo-struttura">Struttura del documento</h2><button class="chiudi" aria-label=${t('Chiudi')} title=${t('Chiudi')} @click=${() => this.invia('chiudi')}>✕</button></div>
      ${this.voci.length === 0
        ? html`<p class="vuoto">I titoli che aggiungi al documento compariranno qui (stili Titolo 1, 2 e 3).</p>`
        : html`<ul role="navigation" aria-labelledby="titolo-struttura">${this.voci.map((v) => html`
            <li class="l${v.livello}${v.p === this.corrente ? ' corrente' : ''}"><button data-p=${v.p} title=${v.testo} @click=${() => this.invia('vai', { p: v.p })}>${v.testo}</button></li>`)}</ul>`}
    `;
  }
}
