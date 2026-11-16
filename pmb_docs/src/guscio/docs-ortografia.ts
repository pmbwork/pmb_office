import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

/** Finestra del controllo ortografico: la parola sbagliata, i suggerimenti di Windows e i pulsanti per cambiarla, ignorarla o aggiungerla al dizionario. */
@customElement('docs-ortografia')
export class DocsOrtografia extends LinguaElement {
  @property() parola = '';
  @property() contesto = '';
  /** per esempio "2 di 7" */
  @property() posizione = '';
  /** 0 parola errata, 1 parola ripetuta, 2 sostituzione automatica */
  @property({ type: Number }) azione = 0;
  @property({ attribute: false }) suggerimenti: string[] = [];
  @state() private scelto = '';
  @state() private versione = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) select:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button.attivo, :host-context([alto-contrasto]) button[aria-checked="true"], :host-context([alto-contrasto]) button[aria-pressed="true"] { background: #000000; color: #ffffff; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .dialogo { width: 460px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: #ffffff; border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 4px; font-size: 18px; font-weight: 500; }
    .posizione { color: #5f6368; font-size: 12px; margin-bottom: 14px; }
    .parola { font-size: 20px; font-weight: 500; color: #d93025; margin: 0 0 4px; overflow-wrap: anywhere; }
    .contesto { color: #5f6368; font-size: 12px; margin: 0 0 14px; overflow-wrap: anywhere; }
    label { display: block; font-size: 13px; color: #444746; margin-bottom: 6px; }
    input { width: 100%; box-sizing: border-box; height: 36px; padding: 0 10px; border: 1px solid #dadce0; border-radius: 4px; font: inherit; outline: none; margin-bottom: 8px; }
    input:focus { border-color: #0b57d0; }
    ul { list-style: none; margin: 0 0 14px; padding: 0; max-height: 150px; overflow-y: auto; border: 1px solid #e8eaed; border-radius: 4px; }
    li button.sugg { display: block; width: 100%; text-align: left; padding: 7px 10px; border: 0; background: none; font: inherit; cursor: pointer; }
    li button.sugg:hover, li button.sugg.attiva { background: #e8f0fe; }
    .nessun { color: #5f6368; padding: 8px 10px; }
    .file { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    button.az { height: 32px; padding: 0 14px; border-radius: 16px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid #dadce0; background: #ffffff; color: #0b57d0; }
    button.az:hover { background: #f8f9fa; }
    button.az:disabled { color: #9aa0a6; cursor: default; background: #ffffff; }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button.primario:hover { background: #0842a0; }
    button.primario:disabled { background: #dadce0; color: #ffffff; }
    .chiudi { display: flex; justify-content: flex-end; margin-top: 8px; }
  `;

  protected willUpdate(): void {
    const chiave = `${this.parola}|${this.posizione}|${this.suggerimenti.join(',')}`;
    if (chiave !== this.versione) {
      this.versione = chiave;
      this.scelto = this.azione === 1 ? '' : (this.suggerimenti[0] ?? '');
    }
  }

  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input')?.focus(); }

  private invia(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }

  render() {
    const ripetuta = this.azione === 1;
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-ort">
        <h2 id="titolo-ort">Controllo ortografico</h2>
        <div class="posizione">${this.posizione}</div>
        <p class="parola">${ripetuta ? t('{} (parola ripetuta)', this.parola) : this.parola}</p>
        ${this.contesto === '' ? '' : html`<p class="contesto">…${this.contesto}…</p>`}
        <label for="nuovo">${ripetuta ? t('Cambia con (vuoto = togli la parola ripetuta):') : t('Cambia con:')}</label>
        <input id="nuovo" type="text" .value=${this.scelto} @input=${(e: Event) => { this.scelto = (e.target as HTMLInputElement).value; }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.invia('cambia', { testo: this.scelto }); } }} />
        <ul aria-label="Suggerimenti">
          ${this.suggerimenti.length === 0 ? html`<li class="nessun">Nessun suggerimento</li>`
            : this.suggerimenti.map((s) => html`<li><button class=${s === this.scelto ? 'sugg attiva' : 'sugg'} @click=${() => { this.scelto = s; }} @dblclick=${() => this.invia('cambia', { testo: s })}>${s}</button></li>`)}
        </ul>
        <div class="file">
          <button class="az primario" ?disabled=${this.scelto === '' && !ripetuta} @click=${() => this.invia('cambia', { testo: this.scelto })}>Cambia</button>
          <button class="az" ?disabled=${this.scelto === '' && !ripetuta} @click=${() => this.invia('cambia-tutto', { testo: this.scelto })}>Cambia tutto</button>
          <button class="az" @click=${() => this.invia('ignora')}>Ignora</button>
          <button class="az" @click=${() => this.invia('ignora-tutto')}>Ignora tutto</button>
          <button class="az" ?disabled=${ripetuta} @click=${() => this.invia('aggiungi')}>Aggiungi al dizionario</button>
        </div>
        <div class="chiudi"><button class="az" @click=${() => this.invia('chiudi')}>Chiudi</button></div>
      </div>
    `;
  }
}
