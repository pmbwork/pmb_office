// Dialogo "Intestazioni e piè di pagina" di pmb_docs: il testo dell'intestazione e del piè di pagina (fino a 3 righe ciascuno),
// l'allineamento e i due campi, numero di pagina {pagina} e numero di pagine {pagine}. Controlla il testo e avvisa con eventi.
import { css, type PropertyValues } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { RIGHE_MARGINE_MASSIME, controllaMargine, paragrafiDaTesto, type Allineamento, type Paragrafo } from '../modello/documento';
import { t } from '../i18n/lingua';

type Zona = 'intestazione' | 'piede';
const ALLINEAMENTI: Array<[Allineamento, string]> = [['sx', 'Sinistra'], ['ce', 'Centro'], ['dx', 'Destra']];

@customElement('docs-margini')
export class DocsMargini extends LinguaElement {
  @property({ attribute: false }) intestazioneIniziale = '';
  @property({ attribute: false }) piedeIniziale = '';
  @property({ attribute: false }) allineamentoIntestazione: Allineamento = 'sx';
  @property({ attribute: false }) allineamentoPiede: Allineamento = 'sx';
  /** la casella dove sta il cursore all'apertura */
  @property({ attribute: false }) zona: Zona = 'intestazione';
  @state() private testoI = '';
  @state() private testoP = '';
  @state() private alI: Allineamento = 'sx';
  @state() private alP: Allineamento = 'sx';
  @state() private errore: string | null = null;
  private ultima: Zona = 'intestazione';

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo { width: 360px; box-sizing: border-box; padding: 16px; background: var(--pmb-superficie, #ffffff); border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
    label { display: block; margin: 8px 0 2px; color: var(--pmb-testo-2, #5f6368); font-size: 12px; }
    textarea { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--pmb-bordo, #c4c7c5); border-radius: 4px; font: inherit; color: inherit; background: transparent; outline: none; resize: none; }
    textarea:focus { border-color: #0b57d0; }
    .allineamento { display: flex; gap: 4px; margin-top: 4px; }
    .campi { display: flex; gap: 8px; margin-top: 12px; }
    .errore { min-height: 18px; margin-top: 4px; color: #b3261e; font-size: 12px; }
    .pulsanti { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    button { height: 28px; padding: 0 12px; border: 1px solid var(--pmb-bordo, #c4c7c5); border-radius: 14px; background: none; color: var(--pmb-accento, #0b57d0); font: inherit; cursor: default; }
    button:hover { background: var(--pmb-superficie-2, #f1f3f4); }
    button[aria-pressed='true'] { background: var(--pmb-selezione-forte, #d3e3fd); border-color: #d3e3fd; }
    .pulsanti button { height: 32px; padding: 0 16px; border: 0; border-radius: 16px; font-weight: 500; }
    .pulsanti button.applica { background: #0b57d0; color: #ffffff; }
  `;

  protected willUpdate(modificate: PropertyValues): void {
    if (modificate.has('intestazioneIniziale')) this.testoI = this.intestazioneIniziale;
    if (modificate.has('piedeIniziale')) this.testoP = this.piedeIniziale;
    if (modificate.has('allineamentoIntestazione')) this.alI = this.allineamentoIntestazione;
    if (modificate.has('allineamentoPiede')) this.alP = this.allineamentoPiede;
    if (modificate.has('zona')) this.ultima = this.zona;
  }

  private emetti(nome: string, dettaglio: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail: dettaglio, bubbles: true, composed: true }));
  }

  private casella(z: Zona): HTMLTextAreaElement | null { return this.renderRoot.querySelector<HTMLTextAreaElement>(`textarea.${z}`); }

  /** Mette il cursore nella casella della zona scelta, in fondo al testo. */
  focalizza(): void {
    const c = this.casella(this.zona);
    if (!c) return;
    c.focus();
    c.setSelectionRange(c.value.length, c.value.length);
  }

  private async inserisci(campo: string): Promise<void> {
    const area = this.casella(this.ultima);
    if (!area) return;
    const da = area.selectionStart ?? area.value.length;
    const a = area.selectionEnd ?? da;
    const nuovo = area.value.slice(0, da) + campo + area.value.slice(a);
    if (this.ultima === 'intestazione') this.testoI = nuovo; else this.testoP = nuovo;
    this.errore = null;
    await this.updateComplete;
    area.focus();
    area.setSelectionRange(da + campo.length, da + campo.length);
  }

  private applica(): void {
    const intestazione = paragrafiDaTesto(this.testoI, this.alI);
    const piede = paragrafiDaTesto(this.testoP, this.alP);
    for (const [nome, paragrafi] of [[t("L'intestazione"), intestazione], [t('Il piè di pagina'), piede]] as Array<[string, Paragrafo[]]>) {
      const motivo = paragrafi.length === 0 ? null : controllaMargine(paragrafi);
      if (motivo === null) continue;
      this.errore = motivo.startsWith('da 1') ? t('{}: al massimo {} righe', nome, RIGHE_MARGINE_MASSIME)
        : motivo === 'riga troppo lunga' ? t('{}: una riga supera i 300 caratteri', nome) : t('{} non è valido', nome);
      return;
    }
    this.emetti('applica', { intestazione: intestazione.length > 0 ? intestazione : undefined, piede: piede.length > 0 ? piede : undefined });
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.applica(); }
    else if (e.key === 'Escape') { e.preventDefault(); this.emetti('chiudi'); }
  };

  private zonaHtml(z: Zona, etichetta: string, testo: string, al: Allineamento) {
    const imposta = (v: string): void => { if (z === 'intestazione') this.testoI = v; else this.testoP = v; this.errore = null; };
    return html`
      <label for=${z}>${t(etichetta)}</label>
      <textarea id=${z} class=${z} rows="3" .value=${testo} @focus=${() => { this.ultima = z; }} @keydown=${this.suTasto}
        @input=${(e: Event) => imposta((e.target as HTMLTextAreaElement).value)}></textarea>
      <div class="allineamento" role="group" aria-label=${t('Allineamento: {}', t(etichetta).toLowerCase())}>
        ${ALLINEAMENTI.map(([valore, nome]) => html`<button class=${`allinea-${valore}`} aria-pressed=${al === valore ? 'true' : 'false'}
          @click=${() => { if (z === 'intestazione') this.alI = valore; else this.alP = valore; }}>${t(nome)}</button>`)}
      </div>`;
  }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-label="Intestazioni e piè di pagina">
        ${this.zonaHtml('intestazione', 'Intestazione', this.testoI, this.alI)}
        ${this.zonaHtml('piede', 'Piè di pagina', this.testoP, this.alP)}
        <div class="campi">
          <button class="campo-pagina" @click=${() => { void this.inserisci('{pagina}'); }}>Numero di pagina</button>
          <button class="campo-pagine" @click=${() => { void this.inserisci('{pagine}'); }}>Numero di pagine</button>
        </div>
        <div class="errore" role="alert">${this.errore ?? ''}</div>
        <div class="pulsanti">
          <button class="annulla" @click=${() => this.emetti('chiudi')}>Annulla</button>
          <button class="applica" @click=${() => this.applica()}>Applica</button>
        </div>
      </div>
    `;
  }
}
