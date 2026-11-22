// Barra "Trova e sostituisci" di pmb_docs: casella di ricerca, conteggio, avanti e indietro, opzioni e sostituzione.
// Non cerca niente da sola: avvisa con eventi e il guscio parla con l'editor.
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import type { OpzioniRicerca } from '../editor/ricerca';
import { t } from '../i18n/lingua';

@customElement('docs-trova')
export class DocsTrova extends LinguaElement {
  /** mostra anche la riga "Sostituisci con" */
  @property({ type: Boolean }) sostituzione = false;
  @property({ type: Number }) totale = 0;
  /** risultato in evidenza, da 1; 0 se non ce n'è */
  @property({ type: Number }) corrente = 0;
  @property({ attribute: false }) errore: string | null = null;
  @property({ type: Boolean }) troncato = false;
  @state() private query = '';
  @state() private sostituto = '';
  @state() private maiuscole = false;
  @state() private parolaIntera = false;
  @state() private regex = false;

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .trova { width: 360px; box-sizing: border-box; padding: 8px 12px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    .riga { display: flex; align-items: center; gap: 4px; margin: 4px 0; }
    input { flex: 1; min-width: 0; height: 32px; box-sizing: border-box; padding: 0 8px; border: 0; border-bottom: 1px solid var(--pmb-bordo, #c4c7c5); border-radius: 0; font: inherit; color: inherit; background: transparent; outline: none; }
    input:focus { border-bottom: 2px solid #0b57d0; }
    .conteggio { min-width: 80px; text-align: right; color: var(--pmb-testo-2, #5f6368); white-space: nowrap; }
    .conteggio.errore { color: #b3261e; }
    button { height: 28px; min-width: 28px; padding: 0 6px; border: 0; border-radius: 4px; background: none; color: inherit; font: inherit; cursor: default; }
    button:hover { background: var(--pmb-superficie-2, #f1f3f4); }
    button[aria-pressed='true'] { background: var(--pmb-selezione-forte, #d3e3fd); }
    .testo-pulsante { padding: 0 12px; border: 1px solid var(--pmb-bordo, #c4c7c5); border-radius: 16px; height: 30px; }
    .opzioni { gap: 8px; }
  `;

  private opzioni(): OpzioniRicerca { return { maiuscole: this.maiuscole, parolaIntera: this.parolaIntera, regex: this.regex }; }
  private emetti(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }
  private cercaDaCapo(): void { this.emetti('ricerca', { query: this.query, opzioni: this.opzioni() }); }

  /** Mette il cursore nella casella di ricerca (e seleziona quello che c'è). */
  focalizza(): void {
    const c = this.renderRoot.querySelector<HTMLInputElement>('input.q');
    c?.focus();
    c?.select();
  }
  /** Cambia il testo cercato (per esempio con la selezione del documento) e avvia la ricerca. */
  impostaQuery(q: string): void {
    this.query = q;
    this.cercaDaCapo();
  }

  private suTastoCerca = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') { e.preventDefault(); this.emetti(e.shiftKey ? 'precedente' : 'successivo'); }
    else if (e.key === 'Escape') { e.preventDefault(); this.emetti('chiudi'); }
  };
  private suTastoSostituisci = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') { e.preventDefault(); this.emetti('sostituisci', { sostituto: this.sostituto }); }
    else if (e.key === 'Escape') { e.preventDefault(); this.emetti('chiudi'); }
  };
  private alterna(chiave: 'maiuscole' | 'parolaIntera' | 'regex'): void {
    this[chiave] = !this[chiave];
    this.cercaDaCapo();
  }

  private testoConteggio(): string {
    if (this.query === '') return '';
    if (this.errore) return this.errore;
    if (this.totale === 0) return t('Nessun risultato');
    return t('{} di {}', this.corrente, `${this.totale}${this.troncato ? '+' : ''}`);
  }

  render() {
    const conteggio = this.testoConteggio();
    return html`
      <div class="trova" role="dialog" aria-label="Trova e sostituisci">
        <div class="riga">
          <input class="q" type="text" placeholder="Trova nel documento" aria-label="Trova" .value=${this.query}
            @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; this.cercaDaCapo(); }} @keydown=${this.suTastoCerca} />
          <span class="conteggio ${this.errore ? 'errore' : ''}" aria-live="polite">${conteggio}</span>
          <button class="precedente" aria-label="Risultato precedente" title="Risultato precedente (Maiusc+Invio)" @click=${() => this.emetti('precedente')}>▲</button>
          <button class="successivo" aria-label="Risultato successivo" title="Risultato successivo (Invio)" @click=${() => this.emetti('successivo')}>▼</button>
          <button class="chiudi" aria-label="Chiudi" title="Chiudi (Esc)" @click=${() => this.emetti('chiudi')}>✕</button>
        </div>
        <div class="riga opzioni">
          <button class="opzione maiuscole" aria-pressed=${this.maiuscole ? 'true' : 'false'} title="Maiuscole e minuscole" @click=${() => this.alterna('maiuscole')}>Aa</button>
          <button class="opzione parola" aria-pressed=${this.parolaIntera ? 'true' : 'false'} title="Solo parole intere" @click=${() => this.alterna('parolaIntera')}>Ab|</button>
          <button class="opzione regex" aria-pressed=${this.regex ? 'true' : 'false'} title="Espressione regolare" @click=${() => this.alterna('regex')}>.*</button>
        </div>
        ${this.sostituzione ? html`
          <div class="riga">
            <input class="s" type="text" placeholder="Sostituisci con" aria-label="Sostituisci con" .value=${this.sostituto}
              @input=${(e: Event) => { this.sostituto = (e.target as HTMLInputElement).value; }} @keydown=${this.suTastoSostituisci} />
          </div>
          <div class="riga">
            <button class="testo-pulsante sostituisci" @click=${() => this.emetti('sostituisci', { sostituto: this.sostituto })}>Sostituisci</button>
            <button class="testo-pulsante sostituisci-tutto" @click=${() => this.emetti('sostituisci-tutto', { sostituto: this.sostituto })}>Sostituisci tutto</button>
          </div>` : ''}
      </div>
    `;
  }
}
