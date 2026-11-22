import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { LUNGHEZZA_MASSIMA_SEGNALIBRO, type VoceSegnalibro } from '../modello/documento';
import { t } from '../i18n/lingua';

/** Finestra dei segnalibri: aggiunge un segnalibro al paragrafo del cursore e elenca quelli del documento (vai a / togli). */
@customElement('docs-segnalibri')
export class DocsSegnalibri extends LinguaElement {
  @property({ attribute: false }) voci: VoceSegnalibro[] = [];
  @state() private nome = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) select:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button.attivo, :host-context([alto-contrasto]) button[aria-checked="true"], :host-context([alto-contrasto]) button[aria-pressed="true"] { background: #000000; color: #ffffff; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 440px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 16px; font-size: 18px; font-weight: 500; }
    .riga-nuovo { display: flex; gap: 8px; margin-bottom: 16px; }
    input { flex: 1; min-width: 0; height: 36px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; outline: none; }
    input:focus { border-color: #0b57d0; }
    ul { list-style: none; margin: 0 0 16px; padding: 0; max-height: 220px; overflow-y: auto; border-top: 1px solid var(--pmb-bordo, #e8eaed); }
    li { display: flex; align-items: center; gap: 8px; padding: 8px 4px; border-bottom: 1px solid var(--pmb-bordo, #e8eaed); }
    li .testo { flex: 1; min-width: 0; }
    li .nome { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    li .anteprima { font-size: 12px; color: var(--pmb-testo-2, #5f6368); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vuoto { color: var(--pmb-testo-2, #5f6368); margin: 0 0 16px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button:hover { background: var(--pmb-superficie-2, #f8f9fa); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button.primario:hover { background: #0842a0; }
    button.piccolo { height: 28px; padding: 0 12px; }
    .pulsanti { display: flex; justify-content: flex-end; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLInputElement>('input')?.focus(); }

  private invia(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }

  private aggiungi(): void {
    const n = this.nome.trim();
    if (n === '') return;
    this.invia('aggiungi', { nome: n });
    this.nome = '';
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') { e.preventDefault(); this.aggiungi(); }
  };

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-segnalibri">
        <h2 id="titolo-segnalibri">Segnalibri</h2>
        <div class="riga-nuovo">
          <input type="text" aria-label="Nome del nuovo segnalibro" placeholder="Nome del segnalibro (sul paragrafo del cursore)" maxlength=${LUNGHEZZA_MASSIMA_SEGNALIBRO}
            .value=${this.nome} @input=${(e: Event) => { this.nome = (e.target as HTMLInputElement).value; }} @keydown=${this.suTasto} />
          <button class="primario" @click=${() => this.aggiungi()}>Aggiungi</button>
        </div>
        ${this.voci.length === 0
          ? html`<p class="vuoto">Nessun segnalibro nel documento.</p>`
          : html`<ul>${this.voci.map((v) => html`
              <li>
                <div class="testo"><div class="nome">${v.nome}</div><div class="anteprima">${v.anteprima === '' ? t('(paragrafo vuoto)') : v.anteprima}</div></div>
                <button class="piccolo" @click=${() => this.invia('vai', { nome: v.nome, p: v.p })}>Vai</button>
                <button class="piccolo" @click=${() => this.invia('togli', { nome: v.nome })}>Togli</button>
              </li>`)}</ul>`}
        <div class="pulsanti"><button @click=${() => this.invia('chiudi')}>Chiudi</button></div>
      </div>
    `;
  }
}
