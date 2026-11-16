import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { LINGUE, type Preferenze } from './preferenze';
import { t, NOMI_LINGUA } from '../i18n/lingua';

const TEMI: Array<[Preferenze['tema'], string]> = [['chiaro', 'Chiaro'], ['scuro', 'Scuro'], ['sistema', 'Come il sistema']];
const LINGUE_PROGRAMMA: Array<[Preferenze['interfaccia'], string]> = [['auto', 'Automatica (come Windows)'], ['it', NOMI_LINGUA.it], ['en', NOMI_LINGUA.en]];

/** Finestra delle Preferenze (tema, lingua e correttore) o dell'Accessibilità (alto contrasto, cursore grande, meno animazioni): ogni scelta vale subito. */
@customElement('docs-preferenze')
export class DocsPreferenze extends LinguaElement {
  @property({ attribute: false }) preferenze!: Preferenze;
  @property() modo: 'preferenze' | 'accessibilita' = 'preferenze';
  /** lingue per cui Windows ha il dizionario (se vuoto non si sa: si mostrano tutte) */
  @property({ attribute: false }) lingueDisponibili: string[] = [];

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) select:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button.attivo, :host-context([alto-contrasto]) button[aria-checked="true"], :host-context([alto-contrasto]) button[aria-pressed="true"] { background: #000000; color: #ffffff; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    /* stesso aspetto della finestra Preferenze di pmb_sheets: un riquadro per argomento, con il titolo in grassetto */
    :host { display: block; font: 13px Roboto, Arial, sans-serif; color: #202124; }
    .dialogo { width: 380px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 20px 24px; background: #ffffff; border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); }
    h2 { margin: 0 0 16px; font-size: 16px; font-weight: 500; }
    fieldset { border: 0; padding: 0; margin: 0 0 16px; }
    legend { font-weight: 500; margin-bottom: 8px; padding: 0; }
    label.voce { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; }
    select { height: 30px; border: 1px solid #dadce0; border-radius: 4px; font: inherit; padding: 0 8px; background: #ffffff; min-width: 200px; }
    p.nota, .aiuto { color: #5f6368; font-size: 12px; margin: 4px 0 0; }
    .aiuto { margin: 0; }
    .chiudi { display: flex; justify-content: flex-end; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid #dadce0; background: #ffffff; color: inherit; font: inherit; cursor: pointer; }
    button:hover { background: #f8f9fa; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLElement>('input, select')?.focus(); }
  private cambia(parziale: Partial<Preferenze>): void {
    this.dispatchEvent(new CustomEvent('cambia', { detail: { preferenze: parziale }, bubbles: true, composed: true }));
  }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true })); }

  private casella(etichetta: string, valore: boolean, chiave: keyof Preferenze, aiuto = '') {
    return html`<label class="voce"><input type="checkbox" .checked=${valore} @change=${(e: Event) => this.cambia({ [chiave]: (e.target as HTMLInputElement).checked } as Partial<Preferenze>)} /> <span>${t(etichetta)}${aiuto === '' ? '' : html`<br /><span class="aiuto">${t(aiuto)}</span>`}</span></label>`;
  }

  render() {
    const p = this.preferenze;
    if (this.modo === 'accessibilita') {
      return html`
        <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-pref">
          <h2 id="titolo-pref">Accessibilità</h2>
          <fieldset>
            <legend>Vista</legend>
            ${this.casella('Alto contrasto', p.altoContrasto, 'altoContrasto', 'Testo nero e bordi ben marcati nei menu e nella barra degli strumenti, con il tema chiaro.')}
            ${this.casella('Cursore grande', p.cursoreGrande, 'cursoreGrande', 'Il cursore di testo è più spesso e si vede meglio.')}
          </fieldset>
          <fieldset>
            <legend>Movimento</legend>
            ${this.casella('Riduci le animazioni', p.riduciAnimazioni, 'riduciAnimazioni', 'Niente effetti di scorrimento e dissolvenza.')}
          </fieldset>
          <div class="chiudi"><button @click=${() => this.chiudi()}>Chiudi</button></div>
        </div>`;
    }
    const lingue = LINGUE.filter(([c]) => this.lingueDisponibili.length === 0 || this.lingueDisponibili.includes(c) || c === p.lingua);
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-pref">
        <h2 id="titolo-pref">Preferenze</h2>
        <fieldset>
          <legend>Tema</legend>
          ${TEMI.map(([valore, nome]) => html`
            <label class="voce"><input type="radio" name="tema" data-tema=${valore} .checked=${p.tema === valore} @change=${() => this.cambia({ tema: valore })} /> ${t(nome)}</label>`)}
        </fieldset>
        <fieldset>
          <legend>Lingua del programma</legend>
          ${LINGUE_PROGRAMMA.map(([valore, nome]) => html`
            <label class="voce"><input type="radio" name="interfaccia" data-lingua=${valore} .checked=${p.interfaccia === valore} @change=${() => this.cambia({ interfaccia: valore })} /> ${valore === 'auto' ? t(nome) : nome}</label>`)}
        </fieldset>
        <fieldset>
          <legend>Correttore ortografico</legend>
          <label class="voce"><span>Lingua:</span>
            <select aria-label="Lingua del correttore" @change=${(e: Event) => this.cambia({ lingua: (e.target as HTMLSelectElement).value })}>
              ${lingue.map(([codice, nome]) => html`<option value=${codice} ?selected=${codice === p.lingua}>${t(nome)}</option>`)}
            </select></label>
          ${this.casella('Sottolinea gli errori mentre scrivo', p.ortografia, 'ortografia')}
          <p class="nota">Il controllo usa i dizionari di Windows: per altre lingue aggiungile nelle impostazioni di lingua di Windows.</p>
        </fieldset>
        <div class="chiudi"><button @click=${() => this.chiudi()}>Chiudi</button></div>
      </div>`;
  }
}
