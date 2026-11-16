// Finestra del link di una cella di pmb_sheets (Ctrl+K): indirizzo e testo da mostrare.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { LUNGHEZZA_MASSIMA_LINK, normalizzaLink } from '../sheet/link';
import { t } from '../i18n/lingua';

@customElement('free-dialogo-link')
export class FreeDialogoLink extends LinguaElement {
  /** l'indirizzo della cella, per esempio "B2" */
  @property({ type: String }) cella = '';
  /** il link già presente, vuoto se non c'è */
  @property({ type: String }) url = '';
  /** il testo già scritto nella cella */
  @property({ type: String }) testo = '';

  @state() private errore = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 440px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 14px; font-size: 16px; font-weight: 500; }
    label { display: block; margin-bottom: 4px; color: var(--color-text-muted, #5f6368); font-size: 12px; }
    input { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 12px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .errore { color: #d93025; font-size: 12px; min-height: 16px; margin: -6px 0 6px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    .spazio { flex: 1; }
  `;

  firstUpdated(): void {
    const campo = this.renderRoot.querySelector('input[data-campo="url"]') as HTMLInputElement | null;
    if (campo) { campo.focus(); campo.select(); }
  }

  private valore(nome: string): string {
    return (this.renderRoot.querySelector(`input[data-campo="${nome}"]`) as HTMLInputElement | null)?.value ?? '';
  }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true }));
  }

  private salva(): void {
    const url = normalizzaLink(this.valore('url'));
    if (url === null) {
      this.errore = t("Scrivi un indirizzo valido: https://…, http://… oppure un indirizzo di posta (nome@sito.it).");
      return;
    }
    this.dispatchEvent(new CustomEvent('salva-link', { detail: { url, testo: this.valore('testo') }, bubbles: true, composed: true }));
  }

  private rimuovi(): void {
    this.dispatchEvent(new CustomEvent('rimuovi-link', { bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.salva(); }
  };

  render() {
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-link">
          <h2 id="titolo-link">Link nella cella ${this.cella}</h2>
          <label for="campo-url">Indirizzo</label>
          <input id="campo-url" data-campo="url" type="text" maxlength=${LUNGHEZZA_MASSIMA_LINK} placeholder="https://esempio.it" .value=${this.url} @input=${() => { this.errore = ''; }} />
          <label for="campo-testo">Testo da mostrare (facoltativo)</label>
          <input id="campo-testo" data-campo="testo" type="text" placeholder="Se vuoto resta il testo della cella" .value=${this.testo} />
          <div class="errore" data-campo="errore" role="alert">${this.errore}</div>
          <div class="bottoni">
            ${this.url !== '' ? html`<button data-azione="rimuovi" @click=${() => this.rimuovi()}>Rimuovi link</button>` : nothing}
            <span class="spazio"></span>
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="salva" @click=${() => this.salva()}>Salva</button>
          </div>
        </div>
      </div>`;
  }
}
