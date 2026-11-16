// Finestra "Intervalli denominati" di pmb_sheets: elenco dei nomi, aggiunta e cancellazione.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import type { NamedRange } from '../sheet/named-ranges';
import { creaNomeIntervallo } from '../sheet/nomi-dialogo';
import { t } from '../i18n/lingua';

@customElement('free-dialogo-nomi')
export class FreeDialogoNomi extends LinguaElement {
  /** i nomi già definiti */
  @property({ attribute: false }) nomi: NamedRange[] = [];
  /** l'intervallo che si propone all'apertura, per esempio "A1:B10" */
  @property({ type: String }) intervallo = '';
  /** il foglio attivo */
  @property({ type: String }) foglio = '';
  @state() private errore = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 480px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; }
    h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid var(--color-border, #dadce0); }
    .vuoto { color: var(--color-text-muted, #5f6368); margin-bottom: 16px; }
    .riga { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .riga > label { width: 90px; flex: none; }
    .riga input { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .errore { color: #d93025; min-height: 18px; margin: 4px 0 12px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    td button { padding: 3px 10px; }
  `;

  firstUpdated(): void { this.campo('nome')?.focus(); }

  private campo(nome: string): HTMLInputElement | null {
    return this.renderRoot.querySelector(`[data-campo="${nome}"]`);
  }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true }));
  }

  private aggiungi(): void {
    const e = creaNomeIntervallo({
      nome: this.campo('nome')?.value ?? '',
      intervallo: this.campo('intervallo')?.value ?? '',
      foglio: this.foglio,
      esistenti: this.nomi.map((n) => n.name),
    });
    if (!e.ok) { this.errore = e.errore; return; }
    this.errore = '';
    this.dispatchEvent(new CustomEvent('aggiungi-nome', { detail: { nome: e.valore }, bubbles: true, composed: true }));
    const nome = this.campo('nome');
    if (nome) { nome.value = ''; nome.focus(); }
  }

  private elimina(nome: string): void {
    this.dispatchEvent(new CustomEvent('elimina-nome', { detail: { nome }, bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); this.aggiungi(); }
  };

  render() {
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-nomi">
          <h2 id="titolo-nomi">Intervalli denominati</h2>
          ${this.nomi.length === 0
            ? html`<div class="vuoto" data-elenco="vuoto">Nessun intervallo denominato.</div>`
            : html`<table data-elenco="nomi">
                <thead><tr><th>Nome</th><th>Intervallo</th><th></th></tr></thead>
                <tbody>
                  ${this.nomi.map((n) => html`<tr data-nome=${n.name}>
                    <td>${n.name}</td>
                    <td>${n.sheetName}!${n.rangeString}</td>
                    <td><button data-azione="elimina" aria-label=${t("Elimina {}", n.name)} @click=${() => this.elimina(n.name)}>Elimina</button></td>
                  </tr>`)}
                </tbody>
              </table>`}
          <div class="riga"><label for="nome-campo">Nome</label><input id="nome-campo" type="text" data-campo="nome" autocomplete="off" /></div>
          <div class="riga"><label for="intervallo-campo">Intervallo</label><input id="intervallo-campo" type="text" data-campo="intervallo" autocomplete="off" .value=${this.intervallo} /></div>
          <div class="errore" role="alert" data-campo="errore">${this.errore !== '' ? this.errore : nothing}</div>
          <div class="bottoni">
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Chiudi</button>
            <button class="primario" data-azione="aggiungi" @click=${() => this.aggiungi()}>Aggiungi</button>
          </div>
        </div>
      </div>`;
  }
}
