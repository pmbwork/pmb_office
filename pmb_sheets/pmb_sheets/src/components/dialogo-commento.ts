// Finestra del commento di una cella di pmb_sheets: scrivere, cambiare o togliere il commento.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { LUNGHEZZA_MASSIMA_COMMENTO } from '../sheet/commenti';
import { t } from '../i18n/lingua';

@customElement('free-dialogo-commento')
export class FreeDialogoCommento extends LinguaElement {
  /** l'indirizzo della cella, per esempio "B2" */
  @property({ type: String }) cella = '';
  /** il commento già scritto, vuoto se non c'è */
  @property({ type: String }) testo = '';
  /** quando è stato scritto, in formato ISO, vuoto se non c'è */
  @property({ type: String }) data = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 420px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 4px; font-size: 16px; font-weight: 500; }
    .data { color: var(--color-text-muted, #5f6368); font-size: 12px; min-height: 16px; margin-bottom: 12px; }
    textarea { width: 100%; min-height: 110px; resize: vertical; box-sizing: border-box; padding: 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    .spazio { flex: 1; }
  `;

  firstUpdated(): void {
    const area = this.campo();
    if (area) { area.focus(); area.setSelectionRange(area.value.length, area.value.length); }
  }

  private campo(): HTMLTextAreaElement | null {
    return this.renderRoot.querySelector('textarea[data-campo="testo"]');
  }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true }));
  }

  private salva(): void {
    this.dispatchEvent(new CustomEvent('salva-commento', { detail: { testo: this.campo()?.value ?? '' }, bubbles: true, composed: true }));
  }

  private elimina(): void {
    this.dispatchEvent(new CustomEvent('salva-commento', { detail: { testo: '' }, bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.salva(); }
  };

  private dataLeggibile(): string {
    if (this.data === '') return '';
    const d = new Date(this.data);
    return Number.isNaN(d.getTime()) ? '' : t("Scritto il {}", d.toLocaleString('it-IT'));
  }

  render() {
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-commento">
          <h2 id="titolo-commento">Commento sulla cella ${this.cella}</h2>
          <div class="data" data-campo="data">${this.dataLeggibile()}</div>
          <textarea data-campo="testo" aria-label="Testo del commento" maxlength=${LUNGHEZZA_MASSIMA_COMMENTO} .value=${this.testo}></textarea>
          <div class="bottoni">
            ${this.testo !== '' ? html`<button data-azione="elimina" @click=${() => this.elimina()}>Elimina</button>` : nothing}
            <span class="spazio"></span>
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Chiudi</button>
            <button class="primario" data-azione="salva" @click=${() => this.salva()}>Salva</button>
          </div>
        </div>
      </div>`;
  }
}
