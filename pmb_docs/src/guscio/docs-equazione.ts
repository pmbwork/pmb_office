import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { ErroreEquazione, MODELLI_EQUAZIONE, equazioneSuTela, leggiEquazione, LUNGHEZZA_MASSIMA } from './equazione';
import { t } from '../i18n/lingua';

/** Finestra Equazione: si scrive la formula (notazione tipo LaTeX), con una barra di modelli e simboli, si vede l'anteprima e si inserisce come immagine. */
@customElement('docs-equazione')
export class DocsEquazione extends LinguaElement {
  /** mostra la barra con i modelli e i simboli (Visualizza › Mostra barra delle equazioni) */
  @property({ type: Boolean }) mostraBarra = true;
  @state() private testo = '';
  @state() private errore = '';

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 560px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
    .barra { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
    .barra button { min-width: 34px; height: 30px; padding: 0 8px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; background: var(--pmb-superficie, #ffffff); font: 15px "Cambria Math", "Times New Roman", serif; cursor: pointer; }
    .barra button:hover { background: var(--pmb-selezione, #e8f0fe); }
    label { display: block; font-size: 13px; color: var(--pmb-testo-2, #444746); margin-bottom: 6px; }
    textarea { width: 100%; box-sizing: border-box; height: 64px; padding: 8px 10px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: 14px Consolas, "Courier New", monospace; resize: vertical; outline: none; }
    textarea:focus { border-color: #0b57d0; }
    .anteprima { min-height: 90px; margin: 12px 0; border: 1px dashed var(--pmb-bordo, #dadce0); border-radius: 4px; display: flex; align-items: center; justify-content: center; background: var(--pmb-superficie, #ffffff); overflow: auto; padding: 8px; }
    .anteprima canvas { max-width: 100%; }
    .errore { color: #d93025; font-size: 13px; }
    .vuoto { color: var(--pmb-testo-2, #5f6368); font-size: 13px; }
    .nota { color: var(--pmb-testo-2, #5f6368); font-size: 12px; margin: 0 0 12px; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 12px; }
    .pulsanti button { height: 36px; padding: 0 20px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    .pulsanti button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    .pulsanti button:disabled { background: var(--pmb-hover, #dadce0); color: #ffffff; cursor: default; border: 0; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLTextAreaElement>('textarea')?.focus(); }

  protected updated(): void {
    const area = this.renderRoot.querySelector('.anteprima');
    if (!area) return;
    area.querySelector('canvas')?.remove();
    this.errore = this.errore === '' ? '' : this.errore;
    if (this.testo.trim() === '') return;
    try {
      const tela = equazioneSuTela(this.testo, 22, 1);
      if (tela) area.appendChild(tela);
      if (this.errore !== '') this.errore = '';
    } catch (e) {
      const m = e instanceof ErroreEquazione ? e.message : 'Equazione non valida';
      if (this.errore !== m) this.errore = m;
    }
  }

  private inserisciModello(modello: string): void {
    const t = this.renderRoot.querySelector<HTMLTextAreaElement>('textarea');
    if (!t) { this.testo += modello; return; }
    t.focus();
    t.setRangeText(modello, t.selectionStart, t.selectionEnd, 'end');
    this.testo = t.value;
  }

  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }
  private conferma(): void {
    if (this.testo.trim() === '') return;
    try { leggiEquazione(this.testo); } catch (e) { this.errore = e instanceof ErroreEquazione ? e.message : 'Equazione non valida'; return; }
    const tela = equazioneSuTela(this.testo, 20, 2);
    if (!tela) { this.errore = t('Non riesco a disegnare l\'equazione in questo ambiente'); return; }
    this.invia('inserisci', { tela });
  }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-eq">
        <h2 id="titolo-eq">Equazione</h2>
        ${this.mostraBarra ? html`<div class="barra" role="toolbar" aria-label="Modelli e simboli">${MODELLI_EQUAZIONE.map((m) => html`<button title=${`${t(m.nome)}: ${m.testo}`} aria-label=${t(m.nome)} @click=${() => this.inserisciModello(m.testo)}>${m.etichetta}</button>`)}</div>` : ''}
        <label for="formula">Formula (per esempio  \\frac{a}{b}  ·  x^{2}  ·  \\sqrt{x}  ·  \\sum_{i=1}^{n} x_{i}):</label>
        <textarea id="formula" maxlength=${LUNGHEZZA_MASSIMA} spellcheck="false" .value=${this.testo}
          @input=${(e: Event) => { this.testo = (e.target as HTMLTextAreaElement).value; }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.conferma(); } }}></textarea>
        <div class="anteprima" aria-label="Anteprima">${this.errore !== '' ? html`<span class="errore" role="alert">${this.errore}</span>` : this.testo.trim() === '' ? html`<span class="vuoto">L'anteprima compare qui</span>` : ''}</div>
        <p class="nota">L'equazione entra nel documento come immagine: per cambiarla se ne inserisce una nuova.</p>
        <div class="pulsanti">
          <button @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario" ?disabled=${this.testo.trim() === '' || this.errore !== ''} @click=${() => this.conferma()}>Inserisci</button>
        </div>
      </div>`;
  }
}
