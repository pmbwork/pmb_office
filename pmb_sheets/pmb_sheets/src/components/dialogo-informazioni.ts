import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { t, linguaCorrente } from '../i18n/lingua';
import { customElement, property, state } from 'lit/decorators.js';
import { PAGINE_INFORMAZIONI, sezioniInformazioni, type PaginaInformazioni } from '@comune/informazioni/condizioni';
import { COMPONENTI_TERZI, TESTI_LICENZE } from './licenze-terze';
/** Frasi italiane scritte dal generatore delle licenze (comune/scripts/genera-licenze.mjs): si traducono quando si mostrano. */
const AUTORI_SENZA_AVVISO = 'Gli autori del progetto (nessun avviso indicato nel pacchetto)';
const PREMESSA_LICENZA = "Copyright (c) i rispettivi titolari indicati nell'elenco dei componenti";
import { LOGO_PMB_SHEETS_ORIZZONTALE } from './logo-pmb';

export const VERSIONE_APP = '0.2.17';
const ORIGINI: Record<string, string> = { rust: 'Rust', npm: 'JavaScript', carattere: 'Carattere', icone: 'Icone' };

/** Finestra "Informazioni": che cos'è il programma, condizioni d'uso (software gratuito e open source con licenza GPL-3.0, nessuna garanzia) e tutte le licenze di terze parti. */
@customElement('free-dialogo-informazioni')
export class FreeDialogoInformazioni extends LinguaElement {
  @property() pagina: PaginaInformazioni = 'info';
  @state() private filtro = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13.5px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { display: flex; flex-direction: column; background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 18px 22px; width: 780px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px); box-sizing: border-box; }
    .marchio { display: flex; justify-content: center; background: #fff; border-radius: 8px; padding: 12px 0; margin-bottom: 10px; }
    .marchio img { height: 88px; width: auto; display: block; }
    .nome { font-size: 16px; font-weight: 500; margin-bottom: 10px; }
    .schede { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border, #dadce0); margin-bottom: 10px; }
    .schede button { height: 34px; padding: 0 14px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; color: inherit; cursor: pointer; }
    .schede button[aria-selected="true"] { color: #188a4a; border-bottom-color: #188a4a; font-weight: 500; }
    .corpo { overflow-y: auto; flex: 1; min-height: 120px; padding-right: 6px; }
    h3 { margin: 14px 0 6px; font-size: 14.5px; font-weight: 500; }
    h3:first-child { margin-top: 0; }
    p { margin: 0 0 8px; line-height: 1.5; }
    input[type=search] { width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; margin: 6px 0 10px; background: transparent; color: inherit; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--color-border, #e8eaed); vertical-align: top; overflow-wrap: anywhere; }
    th { position: sticky; top: 0; background: var(--color-bg, #fff); font-weight: 500; }
    details { border: 1px solid var(--color-border, #e8eaed); border-radius: 6px; margin: 6px 0; }
    summary { padding: 8px 10px; cursor: pointer; font-weight: 500; }
    pre { margin: 0; padding: 8px 10px 10px; white-space: pre-wrap; overflow-wrap: anywhere; font: 11.5px Consolas, "Courier New", monospace; max-height: 260px; overflow-y: auto; }
    .nota { opacity: 0.7; font-size: 12px; }
    .bottoni { display: flex; justify-content: flex-end; margin-top: 12px; }
    .bottoni button { padding: 7px 18px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; cursor: pointer; font: inherit; }
  `;

  firstUpdated(): void { this.focalizza(); }
  focalizza(): void { this.renderRoot.querySelector<HTMLElement>('button[aria-selected="true"]')?.focus(); }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private suTasto = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); } };

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
    const sezioni = sezioniInformazioni({ app: 'pmb_sheets', versione: VERSIONE_APP, lingua: linguaCorrente() })[this.pagina];
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-info">
          <!-- il logo è su fondo chiaro anche nel tema scuro: i suoi testi sono scuri -->
          <div class="marchio"><img src=${LOGO_PMB_SHEETS_ORIZZONTALE} alt="PMB Sheets, sistema professionale di foglio di calcolo" /></div>
          <div class="nome" id="titolo-info">pmb_sheets · pmb_office</div>
          <div class="schede" role="tablist" aria-label="Sezioni">
            ${PAGINE_INFORMAZIONI.map(([id, nome]) => html`<button role="tab" aria-selected=${this.pagina === id ? 'true' : 'false'} @click=${() => { this.pagina = id; }}>${t(nome)}</button>`)}
          </div>
          <div class="corpo" role="tabpanel">
            ${sezioni.map((s) => html`<h3>${s.titolo}</h3>${s.paragrafi.map((p) => html`<p>${p}</p>`)}`)}
            ${this.pagina === 'licenze' ? this.elenco() : nothing}
          </div>
          <div class="bottoni"><button @click=${() => this.chiudi()}>Chiudi</button></div>
        </div>
      </div>`;
  }
}
