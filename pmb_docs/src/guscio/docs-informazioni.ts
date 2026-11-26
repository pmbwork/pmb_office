import { css, nothing } from 'lit';
import { LOGO_PMB_DOCS_ORIZZONTALE } from './logo-pmb';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { PAGINE_INFORMAZIONI, sezioniInformazioni, type PaginaInformazioni } from '@comune/informazioni/condizioni';
import { COMPONENTI_TERZI, TESTI_LICENZE } from './licenze-terze';
/** Frasi italiane scritte dal generatore delle licenze (comune/scripts/genera-licenze.mjs): si traducono quando si mostrano. */
const AUTORI_SENZA_AVVISO = 'Gli autori del progetto (nessun avviso indicato nel pacchetto)';
const PREMESSA_LICENZA = "Copyright (c) i rispettivi titolari indicati nell'elenco dei componenti";
import { t, linguaCorrente } from '../i18n/lingua';

export const VERSIONE_APP = '0.4.22';
const ORIGINI: Record<string, string> = { rust: 'Rust', npm: 'JavaScript', carattere: 'Carattere', icone: 'Icone' };

/** Finestra "Informazioni": che cos'è il programma, condizioni d'uso (software gratuito e open source con licenza GPL-3.0, nessuna garanzia) e tutte le licenze di terze parti. */
@customElement('docs-informazioni')
export class DocsInformazioni extends LinguaElement {
  @property() pagina: PaginaInformazioni = 'info';
  @state() private filtro = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) summary:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button[aria-selected="true"] { background: #000000; color: #ffffff; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { display: flex; flex-direction: column; width: 780px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); box-sizing: border-box; padding: 20px 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    .marchio { display: flex; justify-content: center; background: var(--pmb-superficie, #ffffff); border-radius: 8px; padding: 12px 0; margin-bottom: 10px; }
    .marchio img { height: 88px; width: auto; display: block; }
    .testata { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .testata .nome { font-size: 18px; font-weight: 500; }
    .schede { display: flex; gap: 4px; border-bottom: 1px solid var(--pmb-bordo, #e8eaed); margin-bottom: 12px; }
    .schede button { height: 36px; padding: 0 14px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; color: var(--pmb-testo-2, #444746); cursor: pointer; }
    .schede button[aria-selected="true"] { color: var(--pmb-accento, #0b57d0); border-bottom-color: #0b57d0; font-weight: 500; }
    .corpo { overflow-y: auto; flex: 1; min-height: 120px; padding-right: 6px; }
    h3 { margin: 16px 0 6px; font-size: 15px; font-weight: 500; }
    h3:first-child { margin-top: 0; }
    p { margin: 0 0 8px; line-height: 1.5; }
    input[type=search] { width: 100%; box-sizing: border-box; height: 34px; padding: 0 10px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; margin: 6px 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--pmb-bordo, #f1f3f4); vertical-align: top; overflow-wrap: anywhere; }
    th { position: sticky; top: 0; background: var(--pmb-superficie-2, #f8f9fa); font-weight: 500; }
    details { border: 1px solid var(--pmb-bordo, #e8eaed); border-radius: 6px; margin: 6px 0; }
    summary { padding: 8px 10px; cursor: pointer; font-weight: 500; }
    pre { margin: 0; padding: 8px 10px 10px; white-space: pre-wrap; overflow-wrap: anywhere; font: 11.5px Consolas, "Courier New", monospace; max-height: 260px; overflow-y: auto; background: var(--pmb-superficie-2, #f8f9fa); }
    .nota { color: var(--pmb-testo-2, #5f6368); font-size: 12px; }
    .pulsanti { display: flex; justify-content: flex-end; margin-top: 12px; }
    .pulsanti button { height: 36px; padding: 0 20px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLElement>('button[aria-selected="true"]')?.focus(); }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true })); }

  private elenco() {
    const f = this.filtro.trim().toLowerCase();
    const righe = COMPONENTI_TERZI.filter((c) => f === '' || c[0].toLowerCase().includes(f) || c[2].toLowerCase().includes(f) || c[3].toLowerCase().includes(f));
    return html`
      <h3>Elenco dei componenti (${COMPONENTI_TERZI.length})</h3>
      <input type="search" aria-label="Cerca tra i componenti" placeholder="Cerca per nome, licenza o titolare" .value=${this.filtro} @input=${(e: Event) => { this.filtro = (e.target as HTMLInputElement).value; }} />
      <table aria-label="Componenti di terze parti"><thead><tr><th>Componente</th><th>Versione</th><th>Licenza</th><th>Titolare del copyright</th><th>Tipo</th></tr></thead>
        <tbody>${righe.map((c) => html`<tr><td>${c[0]}</td><td>${c[1]}</td><td>${c[2]}</td><td>${c[3] === AUTORI_SENZA_AVVISO ? t(AUTORI_SENZA_AVVISO) : c[3]}</td><td>${t(ORIGINI[c[4]] ?? c[4])}</td></tr>`)}</tbody></table>
      ${righe.length === 0 ? html`<p class="nota">Nessun componente corrisponde alla ricerca.</p>` : nothing}
      <h3>Testi delle licenze</h3>
      ${Object.entries(TESTI_LICENZE).map(([sigla, testo]) => html`<details><summary>${sigla}</summary><pre>${testo.replace(PREMESSA_LICENZA, t(PREMESSA_LICENZA))}</pre></details>`)}`;
  }

  render() {
    const sezioni = sezioniInformazioni({ app: 'pmb_docs', versione: VERSIONE_APP, correttore: true, lingua: linguaCorrente() })[this.pagina];
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-info">
        <!-- il logo ufficiale, come nella finestra Informazioni di pmb_sheets (su fondo chiaro: i suoi testi sono scuri) -->
        <div class="marchio"><img src=${LOGO_PMB_DOCS_ORIZZONTALE} alt="PMB Docs, sistema professionale di videoscrittura" /></div>
        <div class="testata"><span class="nome" id="titolo-info">pmb_docs · pmb_office</span></div>
        <div class="schede" role="tablist" aria-label="Sezioni">
          ${PAGINE_INFORMAZIONI.map(([id, nome]) => html`<button role="tab" aria-selected=${this.pagina === id ? 'true' : 'false'} @click=${() => { this.pagina = id; }}>${t(nome)}</button>`)}
        </div>
        <div class="corpo" role="tabpanel">
          ${sezioni.map((s) => html`<h3>${s.titolo}</h3>${s.paragrafi.map((p) => html`<p>${p}</p>`)}`)}
          ${this.pagina === 'licenze' ? this.elenco() : nothing}
        </div>
        <div class="pulsanti"><button @click=${() => this.chiudi()}>Chiudi</button></div>
      </div>`;
  }
}
