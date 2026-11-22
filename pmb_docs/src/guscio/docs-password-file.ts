import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

/** Finestra della «password per aprire» (come in pmb_sheets): all'apertura di un file cifrato chiede la password (modo «apri»); da
 *  File › Password per aprire la imposta, la cambia o la toglie (modo «imposta»). La password resta in memoria e si usa salvando in .docx o .odt. */
@customElement('docs-password-file')
export class DocsPasswordFile extends LinguaElement {
  @property({ type: String }) modo: 'apri' | 'imposta' = 'apri';
  /** il nome del file (per il titolo) */
  @property({ type: String }) nome = '';
  /** il documento ha già una password (modo «imposta»): si può togliere */
  @property({ type: Boolean }) haPassword = false;
  /** errore dato da fuori (password sbagliata) */
  @property({ attribute: false }) errore = '';
  @state() private erroreLocale = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 440px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; overflow-wrap: anywhere; }
    p { margin: 0 0 16px; color: var(--pmb-testo-2, #5f6368); line-height: 1.4; }
    label { display: block; margin: 0 0 4px; font-size: 12px; color: var(--pmb-testo-2, #5f6368); }
    input { width: 100%; height: 36px; box-sizing: border-box; padding: 0 10px; margin-bottom: 12px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; outline: none; background: var(--pmb-superficie, #ffffff); color: inherit; }
    input:focus { border-color: #0b57d0; }
    .errore { color: #b3261e; min-height: 18px; margin: -4px 0 8px; font-size: 13px; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .pulsanti .sinistra { margin-right: auto; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button.primario:hover { background: #0842a0; }
  `;

  focalizza(): void { const i = this.renderRoot.querySelector<HTMLInputElement>('input'); i?.select(); i?.focus(); }

  private valore(nome: string): string { return this.renderRoot.querySelector<HTMLInputElement>(`input.${nome}`)?.value ?? ''; }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  private conferma(): void {
    const password = this.valore('password');
    if (password === '') { this.erroreLocale = t('Scrivi la password'); return; }
    if (this.modo === 'imposta' && password !== this.valore('ripeti')) { this.erroreLocale = t('Le due password non sono uguali'); return; }
    this.erroreLocale = '';
    this.invia('conferma', { password });
  }

  private suTasto = (e: KeyboardEvent): void => { if (e.key === 'Enter') { e.preventDefault(); this.conferma(); } };

  render() {
    const apri = this.modo === 'apri';
    const errore = this.erroreLocale || this.errore;
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-password-file" @keydown=${this.suTasto}>
        <h2 id="titolo-password-file">${apri ? t('«{}» è protetto da password', this.nome) : t('Password per aprire')}</h2>
        <p>${apri ? t('Scrivi la password per aprire il file.')
          : t('Chi apre il file dovrà scrivere questa password. Vale per i file .docx e .odt ed entra al prossimo salvataggio. Se la dimentichi il file non si può più aprire.')}</p>
        <label>${t('Password')}</label>
        <input class="password" type="password" autocomplete=${apri ? 'current-password' : 'new-password'} maxlength="255" @input=${() => { this.erroreLocale = ''; }} />
        ${apri ? nothing : html`<label>Scrivi di nuovo la password</label><input class="ripeti" type="password" autocomplete="new-password" maxlength="255" />`}
        <div class="errore" role="alert">${errore}</div>
        <div class="pulsanti">
          ${!apri && this.haPassword ? html`<button class="sinistra togli" @click=${() => this.invia('conferma', { password: '' })}>${t('Togli la password')}</button>` : nothing}
          <button class="annulla" @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario conferma" @click=${() => this.conferma()}>${apri ? t('Apri') : t('Imposta la password')}</button>
        </div>
      </div>`;
  }
}
