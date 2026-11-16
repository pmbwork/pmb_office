import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';

/** Dizionario personale: le parole che il correttore non deve segnalare. Si aggiungono e si tolgono qui. */
@customElement('docs-dizionario')
export class DocsDizionario extends LinguaElement {
  @property({ attribute: false }) parole: string[] = [];
  @state() private nuova = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) select:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button.attivo, :host-context([alto-contrasto]) button[aria-checked="true"], :host-context([alto-contrasto]) button[aria-pressed="true"] { background: #000000; color: #ffffff; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: #1f1f1f; }
    .dialogo { width: 420px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: #ffffff; border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 6px; font-size: 18px; font-weight: 500; }
    p.nota { color: #5f6368; font-size: 12px; margin: 0 0 14px; }
    .riga-nuova { display: flex; gap: 8px; margin-bottom: 14px; }
    input { flex: 1; min-width: 0; height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid #dadce0; border-radius: 4px; font: inherit; outline: none; }
    input:focus { border-color: #0b57d0; }
    ul { list-style: none; margin: 0 0 14px; padding: 0; max-height: 240px; overflow-y: auto; border-top: 1px solid #e8eaed; }
    li { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-bottom: 1px solid #e8eaed; }
    li span { flex: 1; overflow-wrap: anywhere; }
    .vuoto { color: #5f6368; margin: 0 0 14px; }
    button { height: 32px; padding: 0 14px; border-radius: 16px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid #dadce0; background: #ffffff; color: #0b57d0; }
    button:hover { background: #f8f9fa; }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    .chiudi { display: flex; justify-content: flex-end; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input')?.focus(); }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }
  private aggiungi(): void {
    const p = this.nuova.trim();
    if (p === '') return;
    this.invia('aggiungi', { parola: p });
    this.nuova = '';
  }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-diz">
        <h2 id="titolo-diz">Dizionario personale</h2>
        <p class="nota">Le parole qui elencate non vengono segnalate come errori. Valgono per tutti i documenti su questo computer.</p>
        <div class="riga-nuova">
          <input type="text" aria-label="Parola da aggiungere" placeholder="Nuova parola" maxlength="60" .value=${this.nuova}
            @input=${(e: Event) => { this.nuova = (e.target as HTMLInputElement).value; }}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.aggiungi(); } }} />
          <button class="primario" @click=${() => this.aggiungi()}>Aggiungi</button>
        </div>
        ${this.parole.length === 0 ? html`<p class="vuoto">Il dizionario personale è vuoto.</p>`
          : html`<ul>${this.parole.map((p) => html`<li><span>${p}</span><button @click=${() => this.invia('togli', { parola: p })}>Togli</button></li>`)}</ul>`}
        <div class="chiudi"><button @click=${() => this.invia('chiudi')}>Chiudi</button></div>
      </div>
    `;
  }
}
