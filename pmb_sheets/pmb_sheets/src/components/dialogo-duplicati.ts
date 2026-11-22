// Finestra "Rimuovi duplicati" di pmb_sheets: le colonne da confrontare e se la prima riga è l'intestazione.
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import { columnIndexToLetters } from '../engine/address';

@customElement('free-dialogo-duplicati')
export class FreeDialogoDuplicati extends LinguaElement {
  /** prima colonna dell'area (1 = A) */
  @property({ type: Number }) primaColonna = 1;
  /** testo della prima riga, una voce per colonna */
  @property({ attribute: false }) intestazioni: string[] = [];
  /** l'area scritta per l'utente, per esempio "A1:C20" */
  @property({ type: String }) area = '';
  @state() private conIntestazione = true;
  @state() private scelte: boolean[] = [];

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 420px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; }
    h2 { margin: 0 0 6px; font-size: 16px; font-weight: 500; }
    p.nota { margin: 0 0 12px; color: var(--color-text-muted, #5f6368); }
    label { display: flex; align-items: center; gap: 8px; padding: 3px 0; cursor: pointer; }
    .colonne { border: 1px solid var(--color-border, #dadce0); border-radius: 4px; padding: 6px 10px; max-height: 220px; overflow-y: auto; margin: 8px 0 12px; }
    .tutte { display: flex; gap: 8px; margin-top: 8px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    button:disabled { opacity: 0.5; cursor: default; }
    .piccolo { padding: 3px 10px; }
  `;

  willUpdate(cambiate: Map<string, unknown>): void {
    if (cambiate.has('intestazioni') && this.scelte.length !== this.intestazioni.length) this.scelte = this.intestazioni.map(() => true);
  }
  firstUpdated(): void { this.renderRoot.querySelector<HTMLInputElement>('input')?.focus(); }

  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private rimuovi(): void {
    const colonne = this.scelte.map((s, i) => (s ? this.primaColonna + i : -1)).filter((c) => c > 0);
    if (colonne.length === 0) return;
    this.dispatchEvent(new CustomEvent('rimuovi-duplicati', { detail: { colonne, conIntestazione: this.conIntestazione }, bubbles: true, composed: true }));
  }
  private tutte(v: boolean): void { this.scelte = this.scelte.map(() => v); }
  private nomeColonna(i: number): string {
    const lettera = columnIndexToLetters(this.primaColonna + i);
    const testo = (this.intestazioni[i] ?? '').trim();
    return this.conIntestazione && testo !== '' ? `${testo} (${t('colonna {}', lettera)})` : t('Colonna {}', lettera);
  }
  private suTasto = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); } };

  render() {
    const nessuna = !this.scelte.some((s) => s);
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-dup">
          <h2 id="titolo-dup">Rimuovi duplicati</h2>
          <p class="nota">${t('Area: {}. Una riga è un duplicato se nelle colonne scelte ripete una riga precedente: resta la prima.', this.area)}</p>
          <label><input type="checkbox" data-campo="intestazione" .checked=${this.conIntestazione} @change=${(e: Event) => { this.conIntestazione = (e.target as HTMLInputElement).checked; }} /> I dati hanno una riga di intestazione</label>
          <div class="colonne" role="group" aria-label="Colonne da confrontare">
            ${this.intestazioni.map((_, i) => html`<label><input type="checkbox" data-colonna=${this.primaColonna + i} .checked=${this.scelte[i] ?? true}
              @change=${(e: Event) => { const s = [...this.scelte]; s[i] = (e.target as HTMLInputElement).checked; this.scelte = s; }} /> ${this.nomeColonna(i)}</label>`)}
          </div>
          <div class="tutte"><button class="piccolo" data-azione="tutte" @click=${() => this.tutte(true)}>Seleziona tutte</button><button class="piccolo" data-azione="nessuna" @click=${() => this.tutte(false)}>Deseleziona tutte</button></div>
          <div class="bottoni">
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="rimuovi" ?disabled=${nessuna} @click=${() => this.rimuovi()}>Rimuovi duplicati</button>
          </div>
        </div>
      </div>`;
  }
}
