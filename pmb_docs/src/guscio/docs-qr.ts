// Finestra «Codice QR» di pmb_docs (Inserisci › Codice QR): il testo o l'indirizzo, con l'anteprima; il codice si fa con comune/src/qr.ts.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { qrComeDataUrl } from '@comune/qr';
import { t } from '../i18n/lingua';

@customElement('docs-qr')
export class DocsQr extends LinguaElement {
  /** testo proposto (per esempio il contenuto della cella attiva) */
  @property({ type: String }) testo = '';
  @state() private valore = '';
  @state() private errore = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 420px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 14px; font-size: 16px; font-weight: 500; }
    textarea { width: 100%; box-sizing: border-box; min-height: 64px; padding: 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; resize: vertical; }
    .anteprima { display: flex; justify-content: center; margin: 12px 0; min-height: 40px; }
    .anteprima img { width: 160px; height: 160px; image-rendering: pixelated; }
    .errore { color: #d93025; font-size: 12px; min-height: 16px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
  `;

  connectedCallback(): void { super.connectedCallback(); this.valore = this.testo; }
  firstUpdated(): void { (this.renderRoot.querySelector('textarea') as HTMLTextAreaElement | null)?.focus(); }

  private immagine(): { s: string; w: number; h: number } | null {
    if (this.valore.trim() === '') return null;
    try { return qrComeDataUrl(this.valore, 6); } catch { return null; }
  }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private conferma(): void {
    const im = this.immagine();
    if (!im) { this.errore = this.valore.trim() === '' ? t('Scrivi il testo o l\'indirizzo del codice QR') : t('Testo troppo lungo per un codice QR'); return; }
    this.dispatchEvent(new CustomEvent('inserisci-qr', { detail: { ...im, testo: this.valore }, bubbles: true, composed: true }));
  }
  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.conferma(); }
  };

  render() {
    const im = this.immagine();
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-qr">
          <h2 id="titolo-qr">Codice QR</h2>
          <textarea aria-label="Testo o indirizzo del codice QR" placeholder="https://esempio.it" maxlength="2000" .value=${this.valore} @input=${(e: Event) => { this.valore = (e.target as HTMLTextAreaElement).value; this.errore = ''; }}></textarea>
          <div class="anteprima">${im ? html`<img src=${im.s} alt="" />` : nothing}</div>
          <div class="errore" role="alert">${this.errore}</div>
          <div class="bottoni">
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="inserisci" @click=${() => this.conferma()}>${t('Inserisci')}</button>
          </div>
        </div>
      </div>`;
  }
}
