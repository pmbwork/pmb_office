// Finestra di Modifica › Riempi serie... (come la finestra «Serie» di Excel): serie in righe o colonne, tipo (lineare, crescita, data),
// unità per le date (giorno, giorno feriale, mese, anno), passo e valore limite facoltativo.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import type { TipoSerie, UnitaData } from '../sheet/serie';

@customElement('free-dialogo-serie')
export class FreeDialogoSerie extends LinguaElement {
  @property({ type: String }) direzione: 'colonne' | 'righe' = 'colonne';
  /** la cella di partenza è una data: si propone il tipo «data» */
  @property({ type: Boolean }) data = false;
  @property({ type: String }) errore = '';
  @state() private tipo: TipoSerie = 'lineare';
  @state() private unita: UnitaData = 'giorno';
  @state() private erroreLocale = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 440px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
    fieldset { border: 1px solid var(--color-border, #dadce0); border-radius: 6px; margin: 0 0 10px; padding: 6px 10px; }
    legend { color: var(--color-text-muted, #5f6368); font-size: 12px; padding: 0 4px; }
    fieldset label { display: inline-flex; align-items: center; gap: 4px; margin-right: 14px; }
    .riga { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
    .riga label { width: 110px; color: var(--color-text-muted, #5f6368); }
    input[type=text] { flex: 1; padding: 6px 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .errore { color: #d93025; font-size: 12px; min-height: 16px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
  `;

  connectedCallback(): void { super.connectedCallback(); if (this.data) this.tipo = 'data'; }
  firstUpdated(): void { (this.renderRoot.querySelector('input[data-campo="passo"]') as HTMLInputElement | null)?.select(); }

  private valore(nome: string): string { return (this.renderRoot.querySelector(`input[data-campo="${nome}"]`) as HTMLInputElement | null)?.value ?? ''; }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }
  private conferma(): void {
    const passo = this.valore('passo').trim(), limite = this.valore('limite').trim();
    if (passo === '') { this.erroreLocale = t("Scrivi il passo"); return; }
    this.erroreLocale = '';
    const direzione = (this.renderRoot.querySelector('input[name="direzione"]:checked') as HTMLInputElement | null)?.value ?? this.direzione;
    this.dispatchEvent(new CustomEvent('applica-serie', { detail: { direzione, tipo: this.tipo, unita: this.unita, passo, limite }, bubbles: true, composed: true }));
  }
  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.conferma(); }
  };

  render() {
    const errore = this.erroreLocale || this.errore;
    const radio = (nome: string, valore: string, etichetta: string, scelto: boolean, cambia?: () => void) =>
      html`<label><input type="radio" name=${nome} value=${valore} ?checked=${scelto} @change=${() => cambia?.()} />${t(etichetta)}</label>`;
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-serie">
          <h2 id="titolo-serie">${t("Riempi serie")}</h2>
          <fieldset><legend>${t("Serie in")}</legend>
            ${radio('direzione', 'colonne', 'Colonne', this.direzione === 'colonne')}${radio('direzione', 'righe', 'Righe', this.direzione === 'righe')}
          </fieldset>
          <fieldset><legend>${t("Tipo")}</legend>
            ${radio('tipo', 'lineare', 'Lineare', this.tipo === 'lineare', () => { this.tipo = 'lineare'; })}
            ${radio('tipo', 'crescita', 'Crescita', this.tipo === 'crescita', () => { this.tipo = 'crescita'; })}
            ${radio('tipo', 'data', 'Data', this.tipo === 'data', () => { this.tipo = 'data'; })}
          </fieldset>
          ${this.tipo === 'data' ? html`<fieldset><legend>${t("Unità di data")}</legend>
            ${radio('unita', 'giorno', 'Giorno', this.unita === 'giorno', () => { this.unita = 'giorno'; })}
            ${radio('unita', 'feriale', 'Giorno feriale', this.unita === 'feriale', () => { this.unita = 'feriale'; })}
            ${radio('unita', 'mese', 'Mese', this.unita === 'mese', () => { this.unita = 'mese'; })}
            ${radio('unita', 'anno', 'Anno', this.unita === 'anno', () => { this.unita = 'anno'; })}
          </fieldset>` : nothing}
          <div class="riga"><label for="campo-passo">${t("Passo")}</label><input id="campo-passo" type="text" data-campo="passo" value="1" /></div>
          <div class="riga"><label for="campo-limite">${t("Valore limite")}</label><input id="campo-limite" type="text" data-campo="limite" placeholder=${t("facoltativo")} /></div>
          <div class="errore" role="alert">${errore}</div>
          <div class="bottoni">
            <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
            <button class="primario" data-azione="applica" @click=${() => this.conferma()}>${t("Riempi")}</button>
          </div>
        </div>
      </div>`;
  }
}
