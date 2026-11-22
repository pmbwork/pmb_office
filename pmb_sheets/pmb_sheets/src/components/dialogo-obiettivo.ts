// Finestra «Ricerca obiettivo» di pmb_sheets (Dati › Ricerca obiettivo...): la cella con la formula, il valore da raggiungere e la cella
// da cambiare, come in Excel. Il calcolo lo fa la griglia (sheet/ricerca-obiettivo.ts).
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

@customElement('free-dialogo-obiettivo')
export class FreeDialogoObiettivo extends LinguaElement {
  /** la cella attiva, proposta come cella con la formula */
  @property({ type: String }) cella = '';
  /** messaggio dato da fuori (indirizzo sbagliato, nessuna soluzione) */
  @property({ type: String }) errore = '';
  @state() private occupato = false;

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 400px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 14px; font-size: 16px; font-weight: 500; }
    label { display: block; margin-bottom: 4px; color: var(--color-text-muted, #5f6368); font-size: 12px; }
    input { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 12px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .errore { color: #d93025; font-size: 12px; min-height: 16px; margin: -6px 0 6px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    button:disabled { opacity: 0.6; cursor: default; }
  `;

  firstUpdated(): void { (this.renderRoot.querySelector('input[data-campo="valore"]') as HTMLInputElement | null)?.focus(); }
  libera(): void { this.occupato = false; }

  private valore(nome: string): string { return ((this.renderRoot.querySelector(`input[data-campo="${nome}"]`) as HTMLInputElement | null)?.value ?? '').trim(); }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private conferma(): void {
    if (this.occupato) return;
    this.occupato = true;
    this.dispatchEvent(new CustomEvent('cerca-obiettivo', { detail: { obiettivo: this.valore('obiettivo'), valore: this.valore('valore'), variabile: this.valore('variabile') }, bubbles: true, composed: true }));
  }
  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.conferma(); }
  };

  render() {
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-obiettivo">
          <h2 id="titolo-obiettivo">Ricerca obiettivo</h2>
          <label for="campo-obiettivo">Cella con la formula</label>
          <input id="campo-obiettivo" data-campo="obiettivo" type="text" .value=${this.cella} />
          <label for="campo-valore">Valore da raggiungere</label>
          <input id="campo-valore" data-campo="valore" type="text" inputmode="decimal" />
          <label for="campo-variabile">Cella da cambiare</label>
          <input id="campo-variabile" data-campo="variabile" type="text" placeholder="A1" />
          <div class="errore" role="alert">${this.errore}</div>
          <div class="bottoni">
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="cerca" ?disabled=${this.occupato} @click=${() => this.conferma()}>${t('Cerca')}</button>
          </div>
        </div>
      </div>`;
  }
}
