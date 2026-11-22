import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

/** Finestra di Strumenti › Stampa unione: l'elenco scelto (un foglio .xlsx/.ods o un .csv, con i nomi delle colonne nella prima riga),
 *  i campi da mettere nel testo al cursore e il pulsante che crea il documento unito (una copia per riga) in una scheda nuova. */
@customElement('docs-stampa-unione')
export class DocsStampaUnione extends LinguaElement {
  @property({ type: String }) nomeElenco = '';
  @property({ attribute: false }) colonne: string[] = [];
  @property({ type: Number }) copie = 0;
  @property({ attribute: false }) mancanti: string[] = [];
  @property({ type: Number }) campiNelTesto = 0;
  @property({ type: String }) errore = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 520px; max-width: calc(100vw - 32px); max-height: calc(100vh - 120px); overflow: auto; box-sizing: border-box; padding: 24px;
      background: var(--pmb-superficie, #ffffff); border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 500; }
    p { margin: 0 0 12px; color: var(--pmb-testo-2, #5f6368); line-height: 1.4; }
    .elenco { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .nome { font-weight: 500; overflow-wrap: anywhere; }
    .campi { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .campi button { height: 28px; padding: 0 10px; border-radius: 14px; }
    .avviso { color: #b06000; font-size: 13px; }
    .errore { color: #b3261e; font-size: 13px; min-height: 18px; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button:disabled { opacity: 0.55; cursor: default; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLButtonElement>('button')?.focus(); }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  render() {
    const pronto = this.colonne.length > 0;
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-unione" @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); this.invia('chiudi'); } }}>
        <h2 id="titolo-unione">${t('Stampa unione')}</h2>
        <p>${t('Scegli l\'elenco (un foglio .xlsx o .ods, anche di pmb_sheets, o un file .csv) con i nomi delle colonne nella prima riga, metti i campi nel testo e crea il documento unito: una copia per ogni riga dell\'elenco.')}</p>
        <div class="elenco">
          <button class="scegli" @click=${() => this.invia('scegli-elenco')}>${pronto ? t('Cambia elenco…') : t('Scegli l\'elenco…')}</button>
          ${pronto ? html`<span class="nome">${this.nomeElenco}</span><span>${this.copie === 1 ? t('1 riga') : t('{} righe', this.copie)}</span>` : nothing}
        </div>
        ${pronto ? html`
          <p>${t('Clic su un campo per metterlo nel testo, al cursore:')}</p>
          <div class="campi" role="group" aria-label=${t('Campi dell\'elenco')}>${this.colonne.map((c) => html`<button class="campo" data-campo=${c} @click=${() => this.invia('inserisci-campo', { nome: c })}>«${c}»</button>`)}</div>
          ${this.mancanti.length > 0 ? html`<p class="avviso" role="status">${t('Nel testo ci sono campi che l\'elenco non ha (resteranno vuoti): {}', this.mancanti.map((m) => `«${m}»`).join(', '))}</p>` : nothing}
          ${this.campiNelTesto === 0 ? html`<p class="avviso" role="status">${t('Il testo non ha ancora campi: ogni copia sarà uguale.')}</p>` : nothing}` : nothing}
        <div class="errore" role="alert">${this.errore}</div>
        <div class="pulsanti">
          <button class="chiudi" @click=${() => this.invia('chiudi')}>${t('Chiudi')}</button>
          <button class="primario unisci" ?disabled=${!pronto || this.copie === 0} @click=${() => this.invia('unisci')}>${t('Crea il documento unito')}</button>
        </div>
      </div>`;
  }
}
