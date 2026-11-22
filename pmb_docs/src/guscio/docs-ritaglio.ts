import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Immagine } from '../modello/documento';
import { RITAGLIO_MASSIMO, ritaglioValido, type Ritaglio } from './immagine-trasforma';

/** Finestra «Ritaglia immagine»: quanto togliere da ogni lato (in percento), con l'anteprima della parte che resta. */
@customElement('docs-ritaglio')
export class DocsRitaglio extends LinguaElement {
  @property({ attribute: false }) immagine: Immagine | null = null;
  @state() private r: Ritaglio = { sx: 0, dx: 0, su: 0, giu: 0 };

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 460px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 16px; font-size: 18px; font-weight: 500; }
    .anteprima { position: relative; margin: 0 auto 16px; width: fit-content; max-width: 100%; line-height: 0; }
    .anteprima img { display: block; max-width: 400px; max-height: 240px; }
    .velo { position: absolute; background: rgba(0, 0, 0, 0.55); pointer-events: none; }
    .bordo { position: absolute; border: 2px dashed #ffffff; box-sizing: border-box; pointer-events: none; }
    .lati { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--pmb-testo-2, #5f6368); }
    input { height: 32px; box-sizing: border-box; padding: 0 8px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; color: var(--pmb-testo, #1f1f1f); background: var(--pmb-superficie, #ffffff); }
    input:focus { border-color: #0b57d0; outline: none; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button.primario:hover { background: #0842a0; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input')?.focus(); }

  private invia(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }

  private campo(chiave: keyof Ritaglio, etichetta: string) {
    return html`<label>${etichetta}
      <input type="number" min="0" max=${RITAGLIO_MASSIMO} step="1" class=${`lato-${chiave}`} .value=${String(this.r[chiave])}
        @input=${(e: Event) => { this.r = ritaglioValido({ ...this.r, [chiave]: Number((e.target as HTMLInputElement).value) }); }}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.invia('ritaglia', { ...this.r }); } }} /></label>`;
  }

  render() {
    const { sx, dx, su, giu } = this.r;
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-ritaglio">
        <h2 id="titolo-ritaglio">Ritaglia immagine</h2>
        ${this.immagine ? html`<div class="anteprima">
          <img src=${this.immagine.s} alt="" draggable="false" />
          <div class="velo" style=${styleMap({ left: '0', top: '0', width: `${sx}%`, height: '100%' })}></div>
          <div class="velo" style=${styleMap({ right: '0', top: '0', width: `${dx}%`, height: '100%' })}></div>
          <div class="velo" style=${styleMap({ left: `${sx}%`, right: `${dx}%`, top: '0', height: `${su}%` })}></div>
          <div class="velo" style=${styleMap({ left: `${sx}%`, right: `${dx}%`, bottom: '0', height: `${giu}%` })}></div>
          <div class="bordo" style=${styleMap({ left: `${sx}%`, right: `${dx}%`, top: `${su}%`, bottom: `${giu}%` })}></div>
        </div>` : ''}
        <div class="lati">
          ${this.campo('sx', 'Da sinistra (%)')}${this.campo('dx', 'Da destra (%)')}${this.campo('su', 'Dall\'alto (%)')}${this.campo('giu', 'Dal basso (%)')}
        </div>
        <div class="pulsanti">
          <button class="annulla" @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario ritaglia" @click=${() => this.invia('ritaglia', { ...this.r })}>Ritaglia</button>
        </div>
      </div>
    `;
  }
}
