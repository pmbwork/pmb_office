import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import type { Bersaglio } from '../modello/riferimenti';
import type { ModoRiferimento } from '../modello/documento';

type Tipo = Bersaglio['tipo'];
const TIPI: Array<[Tipo, string]> = [['titolo', 'Titoli'], ['segnalibro', 'Segnalibri'], ['didascalia', 'Didascalie']];

/** Finestra di Inserisci › Riferimento incrociato… (come «Riferimento incrociato» di Word): il tipo di bersaglio (titoli, segnalibri,
 *  didascalie), il bersaglio e che cosa mostrare (tutto il testo, oppure solo etichetta e numero di una didascalia). */
@customElement('docs-riferimento')
export class DocsRiferimento extends LinguaElement {
  @property({ attribute: false }) bersagli: Bersaglio[] = [];
  @state() private tipo: Tipo | null = null;
  @state() private scelto = 0;
  @state() private modo: ModoRiferimento = 'e';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 480px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 24px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
    label { display: block; margin: 0 0 4px; font-size: 12px; color: var(--pmb-testo-2, #5f6368); }
    select { width: 100%; box-sizing: border-box; padding: 0 10px; margin-bottom: 12px; border: 1px solid var(--pmb-bordo, #dadce0); border-radius: 4px; font: inherit; background: var(--pmb-superficie, #ffffff); color: inherit; }
    select.tipo, select.modo { height: 36px; }
    select.elenco { height: 180px; padding: 4px; }
    .vuoto { margin: 0 0 16px; color: var(--pmb-testo-2, #5f6368); }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; }
    button { height: 36px; padding: 0 16px; border-radius: 18px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: var(--pmb-accento, #0b57d0); }
    button.primario { border: 0; background: #0b57d0; color: #ffffff; }
    button:disabled { opacity: 0.5; cursor: default; }
  `;

  /** Il tipo mostrato: quello scelto, oppure il primo che ha dei bersagli. */
  private get tipoCorrente(): Tipo { return this.tipo ?? TIPI.find(([x]) => this.bersagli.some((b) => b.tipo === x))?.[0] ?? 'titolo'; }
  private get elenco(): Bersaglio[] { return this.bersagli.filter((b) => b.tipo === this.tipoCorrente); }

  focalizza(): void { (this.renderRoot.querySelector<HTMLSelectElement>('select.elenco') ?? this.renderRoot.querySelector<HTMLSelectElement>('select.tipo'))?.focus(); }
  private invia(nome: string, dettaglio: object = {}): void { this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true })); }
  private conferma(): void {
    const b = this.elenco[this.scelto];
    if (!b) return;
    this.invia('applica', { p: b.p, modo: b.tipo === 'didascalia' ? this.modo : 't' });
  }

  render() {
    const elenco = this.elenco;
    const didascalie = this.tipoCorrente === 'didascalia';
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-riferimento" @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); this.conferma(); } }}>
        <h2 id="titolo-riferimento">${t('Riferimento incrociato')}</h2>
        <label for="tipo-rif">${t('Rimanda a')}</label>
        <select id="tipo-rif" class="tipo" @change=${(e: Event) => { this.tipo = (e.target as HTMLSelectElement).value as Tipo; this.scelto = 0; }}>
          ${TIPI.map(([x, nome]) => html`<option value=${x} ?selected=${x === this.tipoCorrente}>${t(nome)}</option>`)}
        </select>
        ${elenco.length === 0 ? html`<p class="vuoto">${t('Nel documento non ci sono elementi di questo tipo')}</p>` : html`
          <label for="elenco-rif">${t('Elemento')}</label>
          <select id="elenco-rif" class="elenco" size="8" @change=${(e: Event) => { this.scelto = (e.target as HTMLSelectElement).selectedIndex; }} @dblclick=${() => this.conferma()}>
            ${elenco.map((b, k) => html`<option ?selected=${k === this.scelto}>${(b.testo || b.etichetta || '').slice(0, 100)}</option>`)}
          </select>`}
        ${didascalie ? html`
          <label for="modo-rif">${t('Mostra')}</label>
          <select id="modo-rif" class="modo" @change=${(e: Event) => { this.modo = (e.target as HTMLSelectElement).value as ModoRiferimento; }}>
            <option value="e" ?selected=${this.modo === 'e'}>${t('Solo etichetta e numero')}</option>
            <option value="t" ?selected=${this.modo === 't'}>${t('Tutta la didascalia')}</option>
          </select>` : ''}
        <div class="pulsanti">
          <button class="annulla" @click=${() => this.invia('chiudi')}>Annulla</button>
          <button class="primario applica" ?disabled=${elenco.length === 0} @click=${() => this.conferma()}>${t('Inserisci')}</button>
        </div>
      </div>`;
  }
}
