// Finestra della protezione di pmb_sheets: proteggere il foglio o la struttura della cartella (password facoltativa, da scrivere due
// volte) e toglierla (con la password, se c'è). La password non si salva: si salva solo la sua impronta (vedi sheet/protezione.ts).
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

export type ModoProtezione = 'proteggi-foglio' | 'togli-foglio' | 'proteggi-cartella' | 'togli-cartella';

@customElement('free-dialogo-protezione')
export class FreeDialogoProtezione extends LinguaElement {
  @property({ type: String }) modo: ModoProtezione = 'proteggi-foglio';
  /** il nome del foglio (per il titolo) */
  @property({ type: String }) foglio = '';
  /** messaggio di errore dato da fuori (password sbagliata) */
  @property({ type: String }) errore = '';
  @state() private erroreLocale = '';
  @state() private occupato = false;

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 440px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 10px; font-size: 16px; font-weight: 500; }
    p { margin: 0 0 14px; color: var(--color-text-muted, #5f6368); line-height: 1.4; }
    label { display: block; margin-bottom: 4px; color: var(--color-text-muted, #5f6368); font-size: 12px; }
    input { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 12px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .errore { color: #d93025; font-size: 12px; min-height: 16px; margin: -6px 0 6px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    button:disabled { opacity: 0.6; cursor: default; }
  `;

  firstUpdated(): void { (this.renderRoot.querySelector('input') as HTMLInputElement | null)?.focus(); }

  /** Il guscio lo chiama dopo una password sbagliata: si può riprovare. */
  libera(): void { this.occupato = false; }

  private valore(nome: string): string {
    return (this.renderRoot.querySelector(`input[data-campo="${nome}"]`) as HTMLInputElement | null)?.value ?? '';
  }

  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }

  private conferma(): void {
    if (this.occupato) return;
    const password = this.valore('password');
    if (this.modo.startsWith('proteggi') && password !== this.valore('ripeti')) { this.erroreLocale = t("Le due password non sono uguali"); return; }
    this.erroreLocale = '';
    this.occupato = true;
    this.dispatchEvent(new CustomEvent('conferma-protezione', { detail: { password }, bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.conferma(); }
  };

  render() {
    const proteggi = this.modo.startsWith('proteggi');
    const cartella = this.modo.endsWith('cartella');
    const titolo = proteggi
      ? (cartella ? t("Proteggi la struttura della cartella") : t("Proteggi il foglio «{}»", this.foglio))
      : (cartella ? t("Togli la protezione della struttura") : t("Togli la protezione del foglio «{}»", this.foglio));
    const spiega = proteggi
      ? (cartella ? t("Con la struttura protetta i fogli non si possono aggiungere, togliere, rinominare, spostare o colorare.")
        : t("Con il foglio protetto si possono scrivere solo le celle sbloccate (Formato › Protezione celle); formato, righe, colonne e unioni non si cambiano."))
      : t("Scrivi la password con cui è stata messa la protezione.");
    const errore = this.erroreLocale || this.errore;
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-protezione">
          <h2 id="titolo-protezione">${titolo}</h2>
          <p>${spiega}</p>
          <label for="campo-password">${proteggi ? t("Password (facoltativa)") : t("Password")}</label>
          <input id="campo-password" data-campo="password" type="password" autocomplete="new-password" maxlength="255" @input=${() => { this.erroreLocale = ''; }} />
          ${proteggi ? html`<label for="campo-ripeti">Scrivi di nuovo la password</label>
            <input id="campo-ripeti" data-campo="ripeti" type="password" autocomplete="new-password" maxlength="255" @input=${() => { this.erroreLocale = ''; }} />` : nothing}
          <div class="errore" data-campo="errore" role="alert">${errore}</div>
          <div class="bottoni">
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="conferma" ?disabled=${this.occupato} @click=${() => this.conferma()}>${proteggi ? t("Proteggi") : t("Togli la protezione")}</button>
          </div>
        </div>
      </div>`;
  }
}
