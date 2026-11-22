import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

/** Finestra della protezione del documento (sola lettura, come «Limita modifica» di Word): proteggere con una password facoltativa,
 *  scritta due volte, o togliere la protezione con la password. La password non si salva: solo la sua impronta. */
@customElement('docs-protezione')
export class DocsProtezione extends LinguaElement {
  /** true = togliere la protezione (si chiede la password); false = proteggere */
  @property({ type: Boolean }) togli = false;
  /** errore dato da fuori (password sbagliata) */
  @property({ attribute: false }) errore = '';
  @state() private erroreLocale = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 440px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
    p { margin: 0 0 16px; color: var(--pmb-testo-2, #5f6368); line-height: 1.4; }
    label { display: block; margin: 0 0 4px; font-size: 12px; color: var(--pmb-testo-2, #5f6368); }
    input { width: 100%; height: 36px; box-sizing: border-box; padding: 0 10px; margin-bottom: 12px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; outline: none; background: var(--pmb-superficie, #ffffff); color: inherit; }
    input:focus { border-color: #0b57d0; }
    .errore { color: #b3261e; min-height: 18px; margin: -4px 0 8px; font-size: 13px; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button.primario:hover { background: #0842a0; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input')?.focus(); }

  private valore(nome: string): string { return this.renderRoot.querySelector<HTMLInputElement>(`input.${nome}`)?.value ?? ''; }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }

  private conferma(): void {
    const password = this.valore('password');
    if (!this.togli && password !== this.valore('ripeti')) { this.erroreLocale = t('Le due password non sono uguali'); return; }
    this.erroreLocale = '';
    this.invia('conferma', { password });
  }

  private suTasto = (e: KeyboardEvent): void => { if (e.key === 'Enter') { e.preventDefault(); this.conferma(); } };

  render() {
    const errore = this.erroreLocale || this.errore;
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-protezione" @keydown=${this.suTasto}>
        <h2 id="titolo-protezione">${this.togli ? t('Togli la protezione del documento') : t('Proteggi il documento')}</h2>
        <p>${this.togli ? t('Scrivi la password con cui è stato protetto.') : t('Il documento resta in sola lettura: si legge, si copia e si stampa, ma non si cambia finché non si toglie la protezione. Word fa lo stesso aprendolo.')}</p>
        <label>${this.togli ? t('Password') : t('Password (facoltativa)')}</label>
        <input class="password" type="password" autocomplete="new-password" maxlength="255" @input=${() => { this.erroreLocale = ''; }} />
        ${this.togli ? nothing : html`<label>Scrivi di nuovo la password</label><input class="ripeti" type="password" autocomplete="new-password" maxlength="255" />`}
        <div class="errore" role="alert">${errore}</div>
        <div class="pulsanti">
          <button class="annulla" @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario conferma" @click=${() => this.conferma()}>${this.togli ? t('Togli la protezione') : t('Proteggi')}</button>
        </div>
      </div>`;
  }
}
