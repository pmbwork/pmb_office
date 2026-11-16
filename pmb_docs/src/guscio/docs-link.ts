// Dialogo "Inserisci link" di pmb_docs: testo (se serve), indirizzo, Applica e Rimuovi link.
// Non modifica niente da solo: controlla l'indirizzo e avvisa con eventi, il guscio parla con l'editor.
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { normalizzaUrl } from '../editor/link';
import { t } from '../i18n/lingua';

@customElement('docs-link')
export class DocsLink extends LinguaElement {
  /** testo del link all'apertura (vuoto se non c'è) */
  @property({ attribute: false }) testoIniziale = '';
  /** indirizzo all'apertura (vuoto se il testo non è ancora un link) */
  @property({ attribute: false }) urlIniziale = '';
  /** mostra la casella del testo: serve quando non c'è una selezione da trasformare in link */
  @property({ type: Boolean }) conTesto = true;
  /** il testo è già un link: compare "Rimuovi link" */
  @property({ type: Boolean }) esiste = false;
  @state() private testo = '';
  @state() private url = '';
  @state() private errore: string | null = null;

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .dialogo { width: 360px; box-sizing: border-box; padding: 16px; background: #ffffff; border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    label { display: block; margin: 8px 0 2px; color: #5f6368; font-size: 12px; }
    input { width: 100%; height: 32px; box-sizing: border-box; padding: 0 8px; border: 1px solid #c4c7c5; border-radius: 4px; font: inherit; color: inherit; background: transparent; outline: none; }
    input:focus { border-color: #0b57d0; }
    .errore { min-height: 18px; margin-top: 4px; color: #b3261e; font-size: 12px; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { height: 32px; padding: 0 16px; border: 0; border-radius: 16px; background: none; color: #0b57d0; font: inherit; font-weight: 500; cursor: default; }
    button:hover { background: #f1f3f4; }
    button.applica { background: #0b57d0; color: #ffffff; }
    button.applica:hover { background: #0a4fc0; }
  `;

  protected willUpdate(cambiate: Map<string, unknown>): void {
    if (cambiate.has('testoIniziale')) this.testo = this.testoIniziale;
    if (cambiate.has('urlIniziale')) { this.url = this.urlIniziale; this.errore = null; }
  }

  private emetti(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }

  /** Mette il cursore nella casella dell'indirizzo (o in quella del testo, se è vuota e serve). */
  focalizza(): void {
    const q = this.conTesto && this.testo === '' ? 'input.t' : 'input.u';
    const c = this.renderRoot.querySelector<HTMLInputElement>(q);
    c?.focus();
    c?.select();
  }

  private applica(): void {
    const u = normalizzaUrl(this.url);
    if (u === null) { this.errore = t('Indirizzo non valido: usa http, https o mailto'); return; }
    this.errore = null;
    this.emetti('applica', this.conTesto ? { url: u, testo: this.testo } : { url: u });
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') { e.preventDefault(); this.applica(); }
    else if (e.key === 'Escape') { e.preventDefault(); this.emetti('chiudi'); }
  };

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-label="Inserisci link">
        ${this.conTesto ? html`
          <label for="t">Testo</label>
          <input id="t" class="t" type="text" .value=${this.testo} @input=${(e: Event) => { this.testo = (e.target as HTMLInputElement).value; }} @keydown=${this.suTasto} />` : ''}
        <label for="u">Link</label>
        <input id="u" class="u" type="text" placeholder="Incolla o scrivi un link" .value=${this.url}
          @input=${(e: Event) => { this.url = (e.target as HTMLInputElement).value; this.errore = null; }} @keydown=${this.suTasto} />
        <div class="errore" role="alert">${this.errore ?? ''}</div>
        <div class="pulsanti">
          ${this.esiste ? html`<button class="rimuovi" @click=${() => this.emetti('rimuovi')}>Rimuovi link</button>` : ''}
          <button class="annulla" @click=${() => this.emetti('chiudi')}>Annulla</button>
          <button class="applica" @click=${() => this.applica()}>Applica</button>
        </div>
      </div>
    `;
  }
}
