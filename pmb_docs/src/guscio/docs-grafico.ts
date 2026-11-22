import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { ErroreGrafico, TIPI_GRAFICO, graficoSuTela, leggiDati, type TipoGrafico } from './grafico';
import { t } from '../i18n/lingua';

const DATI_ESEMPIO = '; Vendite; Costi\nGennaio; 120; 80\nFebbraio; 150; 95\nMarzo; 135; 90\nAprile; 180; 110';

/** Finestra Grafico: tipo, titolo e dati (una riga per etichetta, valori separati da punto e virgola), anteprima e inserimento come immagine. */
@customElement('docs-grafico')
export class DocsGrafico extends LinguaElement {
  @property() tipoIniziale: TipoGrafico = 'colonne';
  @state() private tipo: TipoGrafico | null = null;
  @state() private titolo = '';
  @state() private dati = DATI_ESEMPIO;
  @state() private errore = '';

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 620px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
    .riga { display: flex; gap: 12px; margin-bottom: 10px; }
    .riga > div { flex: 1; min-width: 0; }
    label { display: block; font-size: 13px; color: var(--pmb-testo-2, #444746); margin-bottom: 4px; }
    select, input[type=text] { width: 100%; height: 34px; box-sizing: border-box; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; padding: 0 8px; background: var(--pmb-superficie, #ffffff); }
    textarea { width: 100%; box-sizing: border-box; height: 110px; padding: 8px 10px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: 13px Consolas, "Courier New", monospace; resize: vertical; outline: none; }
    textarea:focus, select:focus, input:focus { border-color: #0b57d0; outline: none; }
    .anteprima { min-height: 200px; margin: 10px 0; border: 1px dashed var(--pmb-bordo, #dadce0); border-radius: 4px; display: flex; align-items: center; justify-content: center; background: var(--pmb-superficie, #ffffff); overflow: auto; }
    .anteprima canvas { max-width: 100%; height: auto; }
    .errore { color: #d93025; font-size: 13px; padding: 8px; }
    .nota { color: var(--pmb-testo-2, #5f6368); font-size: 12px; margin: 0 0 10px; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 12px; }
    .pulsanti button { height: 36px; padding: 0 20px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    .pulsanti button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    .pulsanti button:disabled { background: var(--pmb-hover, #dadce0); color: #ffffff; cursor: default; border: 0; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLTextAreaElement>('textarea')?.focus(); }
  private get tipoAttuale(): TipoGrafico { return this.tipo ?? this.tipoIniziale; }

  protected updated(): void {
    const area = this.renderRoot.querySelector('.anteprima');
    if (!area) return;
    area.querySelector('canvas')?.remove();
    try {
      const tela = graficoSuTela(this.tipoAttuale, this.titolo, leggiDati(this.dati), 560, 340, 1);
      if (tela) area.appendChild(tela);
      if (this.errore !== '') this.errore = '';
    } catch (e) {
      const m = e instanceof ErroreGrafico ? e.message : 'Dati non validi';
      if (this.errore !== m) this.errore = m;
    }
  }

  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }
  private conferma(): void {
    try {
      const tela = graficoSuTela(this.tipoAttuale, this.titolo, leggiDati(this.dati), 560, 340, 2);
      if (!tela) { this.errore = t('Non riesco a disegnare il grafico in questo ambiente'); return; }
      this.invia('inserisci', { tela });
    } catch (e) { this.errore = e instanceof ErroreGrafico ? e.message : 'Dati non validi'; }
  }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-gr">
        <h2 id="titolo-gr">Grafico</h2>
        <div class="riga">
          <div><label for="tipo">Tipo di grafico</label>
            <select id="tipo" @change=${(e: Event) => { this.tipo = (e.target as HTMLSelectElement).value as TipoGrafico; }}>
              ${TIPI_GRAFICO.map(([c, n]) => html`<option value=${c} ?selected=${c === this.tipoAttuale}>${t(n)}</option>`)}
            </select></div>
          <div><label for="titolo">Titolo</label><input id="titolo" type="text" maxlength="80" .value=${this.titolo} @input=${(e: Event) => { this.titolo = (e.target as HTMLInputElement).value; }} /></div>
        </div>
        <label for="dati">Dati: una riga per etichetta, valori separati da punto e virgola. La prima riga può dare i nomi delle serie. Decimali con la virgola (12,5) o con il punto (12.5).</label>
        <textarea id="dati" spellcheck="false" .value=${this.dati} @input=${(e: Event) => { this.dati = (e.target as HTMLTextAreaElement).value; }}></textarea>
        <div class="anteprima" aria-label="Anteprima">${this.errore !== '' ? html`<span class="errore" role="alert">${this.errore}</span>` : ''}</div>
        <p class="nota">Il grafico entra nel documento come immagine: per cambiarlo se ne inserisce uno nuovo. Torta: si usa la prima colonna di valori.</p>
        <div class="pulsanti">
          <button @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario" ?disabled=${this.errore !== ''} @click=${() => this.conferma()}>Inserisci</button>
        </div>
      </div>`;
  }
}
