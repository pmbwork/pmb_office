import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { LUNGHEZZA_TITOLO_SCHEDA } from '../modello/schede';
import { t } from '../i18n/lingua';

/** I nomi che il programma dà da solo alle schede («Scheda 1»…) si scrivono nella lingua corrente; i nomi scelti dall'utente restano come sono. */
export function nomeScheda(titolo: string): string {
  const m = /^Scheda (\d+)$/.exec(titolo);
  return m ? t('Scheda {}', Number(m[1])) : titolo;
}

/** Elenco delle schede del documento (a sinistra): si passa da una all'altra, si aggiunge, si rinomina e si elimina. Compare quando le schede sono più di una. */
@customElement('docs-schede')
export class DocsSchede extends LinguaElement {
  @property({ attribute: false }) titoli: string[] = [];
  @property({ type: Number }) attiva = 0;
  @state() private inModifica: number | null = null;
  @state() private daEliminare: number | null = null;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) .scheda.attiva { background: #000000; }
    :host-context([alto-contrasto]) .scheda.attiva button.nome { color: #ffffff; }
    :host { display: block; font: 13px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .pannello { box-sizing: border-box; width: 100%; max-height: 100%; overflow-y: auto; background: var(--pmb-superficie, #ffffff); border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 8px; padding: 8px; box-shadow: 0 1px 3px rgba(60, 64, 67, 0.2); }
    .intestazione { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 8px; font-weight: 500; color: var(--pmb-testo-2, #444746); }
    .scheda { display: flex; align-items: center; gap: 2px; border-radius: 16px; padding: 0 4px 0 0; }
    .scheda:hover { background: var(--pmb-superficie-2, #f1f3f4); }
    .scheda.attiva { background: var(--pmb-selezione, #e8f0fe); }
    button { font: inherit; cursor: pointer; border: 0; background: none; color: var(--pmb-testo-2, #444746); }
    button.nome { flex: 1; min-width: 0; height: 32px; padding: 0 10px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 16px; color: var(--pmb-testo, #1f1f1f); }
    .scheda.attiva button.nome { font-weight: 500; color: var(--pmb-accento, #0b57d0); }
    button.icona { width: 26px; height: 26px; border-radius: 13px; padding: 0; visibility: hidden; }
    .scheda:hover button.icona, .scheda:focus-within button.icona { visibility: visible; }
    button.icona:hover { background: var(--pmb-hover, #dadce0); }
    button.icona:disabled { color: var(--pmb-testo-disabilitato, #bdc1c6); cursor: default; }
    button.nuova { width: 28px; height: 28px; border-radius: 14px; font-size: 18px; line-height: 1; color: var(--pmb-accento, #0b57d0); }
    button.nuova:hover { background: var(--pmb-selezione, #e8f0fe); }
    input { flex: 1; min-width: 0; height: 30px; box-sizing: border-box; margin: 1px 0; padding: 0 8px; border: 1px solid #0b57d0; border-radius: 6px; font: inherit; outline: none; }
    .conferma { display: flex; align-items: center; gap: 4px; padding: 2px 6px 2px 10px; font-size: 12px; }
    .conferma button { height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
  `;

  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  protected updated(): void {
    if (this.inModifica !== null) { const i = this.renderRoot.querySelector<HTMLInputElement>('input'); if (i && (this.renderRoot as ShadowRoot).activeElement !== i) { i.focus(); i.select(); } }
  }

  private conferma(i: number, valore: string): void { this.inModifica = null; this.invia('rinomina', { i, titolo: valore }); }

  render() {
    return html`
      <div class="pannello" role="navigation" aria-label="Schede del documento">
        <div class="intestazione"><span>Schede</span><button class="nuova" title="Nuova scheda (Maiusc+F11)" aria-label="Nuova scheda" @click=${() => this.invia('nuova')}>+</button></div>
        ${this.titoli.map((nome, i) => this.inModifica === i
          ? html`<div class="scheda"><input type="text" aria-label="Nome della scheda" maxlength=${LUNGHEZZA_TITOLO_SCHEDA} .value=${nomeScheda(nome)}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.conferma(i, (e.target as HTMLInputElement).value); } else if (e.key === 'Escape') { e.stopPropagation(); this.inModifica = null; } }}
              @blur=${(e: Event) => { if (this.inModifica === i) this.conferma(i, (e.target as HTMLInputElement).value); }} /></div>`
          : this.daEliminare === i
            ? html`<div class="scheda conferma"><span>Eliminare «${nomeScheda(nome)}»?</span><button @click=${() => { this.daEliminare = null; this.invia('elimina', { i }); }}>Sì</button><button @click=${() => { this.daEliminare = null; }}>No</button></div>`
            : html`<div class=${i === this.attiva ? 'scheda attiva' : 'scheda'}>
                <button class="nome" aria-current=${i === this.attiva ? 'page' : 'false'} @click=${() => this.invia('seleziona', { i })} @dblclick=${() => { this.inModifica = i; }}>${nomeScheda(nome)}</button>
                <button class="icona" title="Rinomina" aria-label=${t('Rinomina {}', nomeScheda(nome))} @click=${() => { this.inModifica = i; }}>✎</button>
                <button class="icona" title="Elimina" aria-label=${t('Elimina {}', nomeScheda(nome))} ?disabled=${this.titoli.length < 2} @click=${() => { this.daEliminare = i; }}>✕</button>
              </div>`)}
      </div>`;
  }
}
