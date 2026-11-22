// Finestra «Subtotali» di pmb_sheets (Dati › Subtotali...): a ogni cambio di quale colonna, con quale funzione, su quali colonne.
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { FUNZIONI_SUBTOTALE } from '../sheet/subtotali';
import { t } from '../i18n/lingua';

@customElement('free-dialogo-subtotali')
export class FreeDialogoSubtotali extends LinguaElement {
  /** le colonne della tabella: numero e nome (dall'intestazione) */
  @property({ attribute: false }) colonne: Array<{ col: number; nome: string }> = [];
  @property({ type: String }) errore = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 400px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 14px; font-size: 16px; font-weight: 500; }
    label.titolo { display: block; margin-bottom: 4px; color: var(--color-text-muted, #5f6368); font-size: 12px; }
    select { width: 100%; box-sizing: border-box; padding: 7px; margin-bottom: 12px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .titolo-elenco { display: block; margin-bottom: 4px; color: var(--color-text-muted, #5f6368); font-size: 12px; }
    .elenco { max-height: 160px; overflow-y: auto; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; padding: 6px 8px; margin-bottom: 12px; }
    .elenco label { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
    .errore { color: #d93025; font-size: 12px; min-height: 16px; margin: -6px 0 6px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
  `;

  firstUpdated(): void { (this.renderRoot.querySelector('select') as HTMLSelectElement | null)?.focus(); }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private conferma(): void {
    const sel = (n: string): string => (this.renderRoot.querySelector(`select[data-campo="${n}"]`) as HTMLSelectElement | null)?.value ?? '';
    const colonne = Array.from(this.renderRoot.querySelectorAll<HTMLInputElement>('input[data-col]:checked')).map((i) => Number(i.dataset.col));
    this.dispatchEvent(new CustomEvent('applica-subtotali', { detail: { gruppo: Number(sel('gruppo')), funzione: Number(sel('funzione')), colonne }, bubbles: true, composed: true }));
  }
  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.conferma(); }
  };

  render() {
    const ultima = this.colonne[this.colonne.length - 1]?.col;
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-subtotali">
          <h2 id="titolo-subtotali">Subtotali</h2>
          <label class="titolo" for="campo-gruppo">A ogni cambio di</label>
          <select id="campo-gruppo" data-campo="gruppo">${this.colonne.map((c) => html`<option value=${c.col}>${c.nome}</option>`)}</select>
          <label class="titolo" for="campo-funzione">Usa la funzione</label>
          <select id="campo-funzione" data-campo="funzione">${FUNZIONI_SUBTOTALE.map(([n, nome]) => html`<option value=${n}>${t(nome)}</option>`)}</select>
          <span class="titolo-elenco">${t('Aggiungi il subtotale a')}</span>
          <div class="elenco">${this.colonne.map((c) => html`<label><input type="checkbox" data-col=${c.col} ?checked=${c.col === ultima} />${c.nome}</label>`)}</div>
          <div class="errore" role="alert">${this.errore}</div>
          <div class="bottoni">
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="applica" @click=${() => this.conferma()}>OK</button>
          </div>
        </div>
      </div>`;
  }
}
