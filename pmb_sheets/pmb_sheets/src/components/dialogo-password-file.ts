// Finestra della «password per aprire» di pmb_sheets: all'apertura di un file cifrato chiede la password (modo «apri»); da File › Password
// per aprire... la imposta, la cambia o la toglie (modo «imposta»). La password resta solo in memoria e si usa quando si salva in .xlsx o .ods.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

@customElement('free-dialogo-password-file')
export class FreeDialogoPasswordFile extends LinguaElement {
  @property({ type: String }) modo: 'apri' | 'imposta' = 'apri';
  /** il nome del file (per il titolo) */
  @property({ type: String }) nome = '';
  /** il documento ha già una password (modo «imposta»): si può togliere */
  @property({ type: Boolean }) haPassword = false;
  /** messaggio di errore dato da fuori (password sbagliata) */
  @property({ type: String }) errore = '';
  @state() private erroreLocale = '';
  @state() private occupato = false;

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 440px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 10px; font-size: 16px; font-weight: 500; overflow-wrap: anywhere; }
    p { margin: 0 0 14px; color: var(--color-text-muted, #5f6368); line-height: 1.4; }
    label { display: block; margin-bottom: 4px; color: var(--color-text-muted, #5f6368); font-size: 12px; }
    input { width: 100%; box-sizing: border-box; padding: 8px; margin-bottom: 12px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .errore { color: #d93025; font-size: 12px; min-height: 16px; margin: -6px 0 6px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .bottoni .sinistra { margin-right: auto; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    button:disabled { opacity: 0.6; cursor: default; }
  `;

  firstUpdated(): void { (this.renderRoot.querySelector('input') as HTMLInputElement | null)?.focus(); }

  /** Il guscio lo chiama dopo una password sbagliata: si può riprovare. */
  libera(): void {
    this.occupato = false;
    const i = this.renderRoot.querySelector('input') as HTMLInputElement | null;
    if (i) { i.select(); i.focus(); }
  }

  private valore(nome: string): string {
    return (this.renderRoot.querySelector(`input[data-campo="${nome}"]`) as HTMLInputElement | null)?.value ?? '';
  }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private invia(password: string): void {
    this.occupato = true;
    this.dispatchEvent(new CustomEvent('conferma-password-file', { detail: { password }, bubbles: true, composed: true }));
  }
  private conferma(): void {
    if (this.occupato) return;
    const password = this.valore('password');
    if (password === '') { this.erroreLocale = t("Scrivi la password"); return; }
    if (this.modo === 'imposta' && password !== this.valore('ripeti')) { this.erroreLocale = t("Le due password non sono uguali"); return; }
    this.erroreLocale = '';
    this.invia(password);
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.conferma(); }
  };

  render() {
    const apri = this.modo === 'apri';
    const errore = this.erroreLocale || this.errore;
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-password-file">
          <h2 id="titolo-password-file">${apri ? t("«{}» è protetto da password", this.nome) : t("Password per aprire")}</h2>
          <p>${apri ? t("Scrivi la password per aprire il file.")
            : t("Chi apre il file dovrà scrivere questa password. Vale per i file .xlsx e .ods ed entra al prossimo salvataggio. Se la dimentichi il file non si può più aprire.")}</p>
          <label for="campo-password">${t("Password")}</label>
          <input id="campo-password" data-campo="password" type="password" autocomplete=${apri ? 'current-password' : 'new-password'} maxlength="255" @input=${() => { this.erroreLocale = ''; }} />
          ${apri ? nothing : html`<label for="campo-ripeti">Scrivi di nuovo la password</label>
            <input id="campo-ripeti" data-campo="ripeti" type="password" autocomplete="new-password" maxlength="255" @input=${() => { this.erroreLocale = ''; }} />`}
          <div class="errore" data-campo="errore" role="alert">${errore}</div>
          <div class="bottoni">
            ${!apri && this.haPassword ? html`<button class="sinistra" data-azione="togli" @click=${() => this.invia('')}>${t("Togli la password")}</button>` : nothing}
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="conferma" ?disabled=${this.occupato} @click=${() => this.conferma()}>${apri ? t("Apri") : t("Imposta la password")}</button>
          </div>
        </div>
      </div>`;
  }
}
