// Finestra "Formato numerico personalizzato" di pmb_sheets: si scrive il codice come in Excel e si vede subito l'anteprima su alcuni numeri.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { formatoRiconosciuto } from '../engine/format-testo';
import { coloreFormato, formatCellValue } from '../sheet/number-format';
import { ESEMPI_FORMATO, FORMATI_PREIMPOSTATI_ELENCO } from '../sheet/formati-preimpostati';
import type { CellValue } from '../engine/values';
import { t } from '../i18n/lingua';

export const LUNGHEZZA_MASSIMA_FORMATO = 120;

/** Vero se il codice si può applicare: vuoto (= Automatico), "@" (testo), General/Standard o un formato che l'interprete sa scrivere. */
export function formatoAccettabile(codice: string): boolean {
  const c = codice.trim();
  return c === '' || c === '@' || c.toLowerCase() === 'general' || c.toLowerCase() === 'standard' || formatoRiconosciuto(c);
}

@customElement('free-dialogo-formato')
export class FreeDialogoFormato extends LinguaElement {
  /** il formato già presente nella cella attiva (vuoto = Automatico) */
  @property({ type: String }) codice = '';
  /** il valore della cella attiva, per l'anteprima */
  @property({ attribute: false }) valore: CellValue = { kind: 'empty' };

  @state() private scritto = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 520px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; }
    h2 { margin: 0 0 14px; font-size: 16px; font-weight: 500; }
    h3 { margin: 14px 0 6px; font-size: 12px; font-weight: 500; color: var(--color-text-muted, #5f6368); }
    label { display: block; margin-bottom: 4px; color: var(--color-text-muted, #5f6368); font-size: 12px; }
    input { width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: 13px ui-monospace, Consolas, monospace; background: var(--color-bg, #fff); color: inherit; }
    .errore { color: #d93025; font-size: 12px; min-height: 16px; margin: 6px 0 0; }
    .anteprima { border: 1px solid var(--color-border, #dadce0); border-radius: 4px; }
    .riga { display: flex; justify-content: space-between; gap: 12px; padding: 5px 10px; border-bottom: 1px solid var(--color-border, #eee); }
    .riga:last-child { border-bottom: none; }
    .riga .etichetta { color: var(--color-text-muted, #5f6368); }
    .riga .risultato { font-variant-numeric: tabular-nums; white-space: pre; }
    .scelte { display: flex; flex-wrap: wrap; gap: 6px; }
    .scelte button { padding: 4px 10px; font-size: 12px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    button[disabled] { opacity: 0.5; cursor: default; }
    .spazio { flex: 1; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.scritto = this.codice;
  }

  firstUpdated(): void {
    const campo = this.renderRoot.querySelector('input[data-campo="codice"]') as HTMLInputElement | null;
    if (campo) { campo.focus(); campo.select(); }
  }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true }));
  }

  private applica(): void {
    if (!formatoAccettabile(this.scritto)) return;
    this.dispatchEvent(new CustomEvent('salva-formato', { detail: { codice: this.scritto.trim() }, bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.applica(); }
  };

  private scegli(codice: string): void {
    this.scritto = codice;
    const campo = this.renderRoot.querySelector('input[data-campo="codice"]') as HTMLInputElement | null;
    if (campo) { campo.value = codice; campo.focus(); }
  }

  private righeAnteprima(): Array<{ etichetta: string; valore: CellValue }> {
    const nostro: CellValue[] = this.valore.kind === 'number' ? [this.valore] : [];
    return [
      ...nostro.map((v) => ({ etichetta: 'Cella attiva', valore: v })),
      { etichetta: 'Positivo', valore: { kind: 'number', value: 1234.5 } as CellValue },
      { etichetta: 'Negativo', valore: { kind: 'number', value: -1234.5 } as CellValue },
      { etichetta: 'Zero', valore: { kind: 'number', value: 0 } as CellValue },
      { etichetta: 'Piccolo', valore: { kind: 'number', value: 0.0625 } as CellValue },
    ];
  }

  render() {
    const valido = formatoAccettabile(this.scritto);
    const codice = this.scritto.trim();
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-formato">
          <h2 id="titolo-formato">Formato numerico personalizzato</h2>
          <label for="campo-codice">Codice del formato (come in Excel; vuoto = Automatico)</label>
          <input id="campo-codice" data-campo="codice" type="text" maxlength=${LUNGHEZZA_MASSIMA_FORMATO} .value=${this.codice}
            @input=${(e: Event) => { this.scritto = (e.target as HTMLInputElement).value; }} />
          <div class="errore" data-campo="errore" role="alert">${valido ? '' : t("Formato non valido: controlla virgolette, parentesi quadre e simboli.")}</div>

          <h3>Anteprima</h3>
          <div class="anteprima" data-campo="anteprima">
            ${this.righeAnteprima().map((r) => {
              const testo = valido && codice !== '' ? formatCellValue(r.valore, codice) : formatCellValue(r.valore, '');
              const colore = valido && codice !== '' ? coloreFormato(r.valore, codice) : undefined;
              return html`<div class="riga"><span class="etichetta">${t(r.etichetta)}</span><span class="risultato" style=${styleMap({ color: colore ?? '' })}>${testo}</span></div>`;
            })}
          </div>

          <h3>Formati pronti</h3>
          <div class="scelte">
            ${FORMATI_PREIMPOSTATI_ELENCO.map((f) => html`<button type="button" data-formato=${f.id} title=${t(f.descrizione)} @click=${() => this.scegli(f.codice)}>${t(f.nome)}</button>`)}
          </div>

          <h3>Esempi</h3>
          <div class="scelte">
            ${ESEMPI_FORMATO.map((e) => html`<button type="button" data-esempio title=${t(e.descrizione)} @click=${() => this.scegli(e.codice)}>${e.codice}</button>`)}
          </div>

          <div class="bottoni">
            <span class="spazio"></span>
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="applica" ?disabled=${!valido} @click=${() => this.applica()}>Applica</button>
          </div>
          ${nothing}
        </div>
      </div>`;
  }
}
