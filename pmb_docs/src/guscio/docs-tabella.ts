// Dialogo "Inserisci tabella" di pmb_docs: quante righe e quante colonne. Controlla i numeri e avvisa con eventi.
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, state } from 'lit/decorators.js';
import { COLONNE_MASSIME, RIGHE_MASSIME } from '../editor/tabelle';
import { t } from '../i18n/lingua';

@customElement('docs-tabella')
export class DocsTabella extends LinguaElement {
  @state() private righe = '3';
  @state() private colonne = '3';
  @state() private errore: string | null = null;

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .dialogo { width: 280px; box-sizing: border-box; padding: 16px; background: #ffffff; border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    .campi { display: flex; gap: 12px; }
    .campi div { flex: 1; }
    label { display: block; margin: 8px 0 2px; color: #5f6368; font-size: 12px; }
    input { width: 100%; height: 32px; box-sizing: border-box; padding: 0 8px; border: 1px solid #c4c7c5; border-radius: 4px; font: inherit; color: inherit; background: transparent; outline: none; }
    input:focus { border-color: #0b57d0; }
    .errore { min-height: 18px; margin-top: 4px; color: #b3261e; font-size: 12px; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { height: 32px; padding: 0 16px; border: 0; border-radius: 16px; background: none; color: #0b57d0; font: inherit; font-weight: 500; cursor: default; }
    button:hover { background: #f1f3f4; }
    button.applica { background: #0b57d0; color: #ffffff; }
  `;

  private emetti(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }

  /** Mette il cursore nella casella delle righe. */
  focalizza(): void {
    const c = this.renderRoot.querySelector<HTMLInputElement>('input.righe');
    c?.focus();
    c?.select();
  }

  private applica(): void {
    const r = Number(this.righe.trim());
    const c = Number(this.colonne.trim());
    const ok = Number.isInteger(r) && Number.isInteger(c) && r >= 1 && c >= 1 && r <= RIGHE_MASSIME && c <= COLONNE_MASSIME;
    if (!ok) { this.errore = t('Righe da 1 a {}, colonne da 1 a {}', RIGHE_MASSIME, COLONNE_MASSIME); return; }
    this.errore = null;
    this.emetti('applica', { righe: r, colonne: c });
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') { e.preventDefault(); this.applica(); }
    else if (e.key === 'Escape') { e.preventDefault(); this.emetti('chiudi'); }
  };

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-label="Inserisci tabella">
        <div class="campi">
          <div><label for="r">Righe</label><input id="r" class="righe" type="text" inputmode="numeric" .value=${this.righe}
            @input=${(e: Event) => { this.righe = (e.target as HTMLInputElement).value; this.errore = null; }} @keydown=${this.suTasto} /></div>
          <div><label for="c">Colonne</label><input id="c" class="colonne" type="text" inputmode="numeric" .value=${this.colonne}
            @input=${(e: Event) => { this.colonne = (e.target as HTMLInputElement).value; this.errore = null; }} @keydown=${this.suTasto} /></div>
        </div>
        <div class="errore" role="alert">${this.errore ?? ''}</div>
        <div class="pulsanti">
          <button class="annulla" @click=${() => this.emetti('chiudi')}>Annulla</button>
          <button class="applica" @click=${() => this.applica()}>Inserisci</button>
        </div>
      </div>
    `;
  }
}
