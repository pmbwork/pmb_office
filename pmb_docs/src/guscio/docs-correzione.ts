import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import { chiaveSostituzione, LUNGHEZZA_SOSTITUZIONE_MASSIMA, SOSTITUZIONI_PREDEFINITE } from '../editor/correzione';
import type { Preferenze } from './preferenze';

type ChiaveCasella = 'maiuscolaAutomatica' | 'sostituzioniAutomatiche' | 'virgoletteTipografiche' | 'trattiniTipografici' | 'correggiDueMaiuscole' | 'correggiBlocMaiusc' | 'elenchiAutomatici';
const CASELLE: Array<[ChiaveCasella, string, string]> = [
  ['maiuscolaAutomatica', 'Maiuscola automatica a inizio frase', 'Dopo il punto e a inizio paragrafo.'],
  ['sostituzioniAutomatiche', 'Sostituisci mentre scrivo', "Le parole dell'elenco qui sotto, e «...» con «…»."],
  ['virgoletteTipografiche', 'Virgolette e apostrofi tipografici', '"testo" diventa “testo” e l\'apostrofo diventa ’.'],
  ['trattiniTipografici', 'Trattini tipografici', '« - » tra due parole diventa « – », «--» diventa «—».'],
  ['correggiDueMaiuscole', 'Correggi DUe MAiuscole iniziali', '«CIao» diventa «Ciao».'],
  ['correggiBlocMaiusc', 'Correggi il Bloc Maiusc premuto per errore', '«cIAO» diventa «Ciao» quando il Bloc Maiusc è acceso.'],
  ['elenchiAutomatici', 'Elenchi automatici', '«1. », «- », «* » o «[] » a inizio paragrafo fanno partire un elenco.'],
];

/** Finestra Correzione automatica: che cosa si corregge mentre si scrive e l'elenco delle sostituzioni. Ogni scelta vale subito. */
@customElement('docs-correzione')
export class DocsCorrezione extends LinguaElement {
  @property({ attribute: false }) preferenze!: Preferenze;
  @state() private da = '';
  @state() private a = '';
  @state() private filtro = '';
  @state() private errore = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { display: block; font: 13px Roboto, Arial, sans-serif; color: var(--pmb-testo, #202124); }
    .dialogo { width: 520px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box; padding: 20px 24px;
      background: var(--pmb-superficie, #ffffff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); }
    h2 { margin: 0 0 16px; font-size: 16px; font-weight: 500; }
    fieldset { border: 0; padding: 0; margin: 0 0 16px; }
    legend { font-weight: 500; margin-bottom: 8px; padding: 0; }
    label.voce { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; cursor: pointer; }
    label.voce input { margin-top: 2px; }
    .aiuto { color: var(--pmb-testo-2, #5f6368); font-size: 12px; }
    .riga-nuova { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
    input[type="text"], input[type="search"] { flex: 1; min-width: 0; height: 30px; box-sizing: border-box; padding: 0 8px; border: 1px solid var(--pmb-bordo, #dadce0);
      border-radius: 4px; font: inherit; background: var(--pmb-superficie, #ffffff); color: inherit; }
    input[type="search"] { width: 100%; margin-bottom: 8px; }
    .freccia { color: var(--pmb-testo-2, #5f6368); }
    .errore { color: #c5221f; font-size: 12px; margin: 0 0 8px; }
    ul { list-style: none; margin: 0 0 10px; padding: 0; max-height: 220px; overflow-y: auto; border-top: 1px solid var(--pmb-bordo, #e8eaed); }
    li { display: flex; align-items: center; gap: 8px; padding: 4px; border-bottom: 1px solid var(--pmb-bordo, #e8eaed); }
    li .da, li .a { flex: 1; overflow-wrap: anywhere; }
    .vuoto { color: var(--pmb-testo-2, #5f6368); margin: 0 0 10px; }
    .pulsanti { display: flex; justify-content: space-between; gap: 8px; }
    button { padding: 6px 14px; border-radius: 4px; border: 1px solid var(--pmb-bordo, #dadce0); background: var(--pmb-superficie, #ffffff); color: inherit; font: inherit; cursor: pointer; }
    button:hover { background: var(--pmb-superficie-2, #f8f9fa); }
    button.piccolo { padding: 2px 10px; }
  `;

  focalizza(): void { this.renderRoot.querySelector<HTMLElement>('input')?.focus(); }
  private cambia(parziale: Partial<Preferenze>): void {
    this.dispatchEvent(new CustomEvent('cambia', { detail: { preferenze: parziale }, bubbles: true, composed: true }));
  }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true })); }

  /** L'elenco in uso: quello dell'utente, oppure quello di partenza. */
  get elenco(): Array<[string, string]> {
    return (this.preferenze.sostituzioni ?? SOSTITUZIONI_PREDEFINITE).map(([d, a]) => [d, a]);
  }

  private aggiungi(): void {
    const da = this.da.trim();
    const a = this.a;
    if (da === '' || a === '') { this.errore = t('Scrivi il testo da sostituire e quello nuovo.'); return; }
    if (!/^\S+( \S+)?$/u.test(da)) { this.errore = t('Il testo da sostituire è una parola, o due parole separate da uno spazio.'); return; }
    if (da.length > LUNGHEZZA_SOSTITUZIONE_MASSIMA || a.length > LUNGHEZZA_SOSTITUZIONE_MASSIMA) { this.errore = t('Testo troppo lungo.'); return; }
    // la stessa parola già presente si sostituisce
    const elenco = this.elenco.filter(([d]) => chiaveSostituzione(d) !== chiaveSostituzione(da));
    elenco.push([da, a]);
    this.cambia({ sostituzioni: elenco });
    this.da = ''; this.a = ''; this.errore = '';
    this.renderRoot.querySelector<HTMLInputElement>('input.da')?.focus();
  }
  private togli(da: string): void { this.cambia({ sostituzioni: this.elenco.filter(([d]) => d !== da) }); }

  render() {
    const p = this.preferenze;
    const f = chiaveSostituzione(this.filtro.trim());
    const voci = this.elenco.filter(([d, a]) => f === '' || chiaveSostituzione(d).includes(f) || chiaveSostituzione(a).includes(f));
    const invio = (e: KeyboardEvent): void => { if (e.key === 'Enter') { e.preventDefault(); this.aggiungi(); } };
    return html`
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="titolo-corr">
        <h2 id="titolo-corr">Correzione automatica</h2>
        <fieldset>
          <legend>Mentre scrivo</legend>
          ${CASELLE.map(([chiave, etichetta, aiuto]) => html`
            <label class="voce"><input type="checkbox" data-chiave=${chiave} .checked=${p[chiave]} @change=${(e: Event) => this.cambia({ [chiave]: (e.target as HTMLInputElement).checked } as Partial<Preferenze>)} />
              <span>${t(etichetta)}<br /><span class="aiuto">${t(aiuto)}</span></span></label>`)}
          <p class="aiuto">${t('Ctrl+Z subito dopo una correzione la annulla.')}</p>
        </fieldset>
        <fieldset>
          <legend>Elenco delle sostituzioni</legend>
          <div class="riga-nuova">
            <input type="text" class="da" aria-label="Sostituisci" placeholder=${t('Sostituisci')} maxlength="200" .value=${this.da}
              @input=${(e: Event) => { this.da = (e.target as HTMLInputElement).value; }} @keydown=${invio} />
            <span class="freccia" aria-hidden="true">→</span>
            <input type="text" class="a" aria-label="Con" placeholder=${t('Con')} maxlength="200" .value=${this.a}
              @input=${(e: Event) => { this.a = (e.target as HTMLInputElement).value; }} @keydown=${invio} />
            <button class="aggiungi" @click=${() => this.aggiungi()}>Aggiungi</button>
          </div>
          ${this.errore ? html`<p class="errore" role="alert">${this.errore}</p>` : ''}
          <input type="search" aria-label="Cerca nell'elenco" placeholder=${t("Cerca nell'elenco")} .value=${this.filtro}
            @input=${(e: Event) => { this.filtro = (e.target as HTMLInputElement).value; }} />
          ${voci.length === 0 ? html`<p class="vuoto">Nessuna sostituzione.</p>` : html`<ul aria-label="Sostituzioni">${voci.map(([d, a]) => html`
            <li><span class="da">${d}</span><span class="freccia" aria-hidden="true">→</span><span class="a">${a}</span>
              <button class="piccolo togli" aria-label=${t('Togli {}', d)} @click=${() => this.togli(d)}>Togli</button></li>`)}</ul>`}
        </fieldset>
        <div class="pulsanti">
          <button class="ripristina" ?disabled=${p.sostituzioni === null} @click=${() => this.cambia({ sostituzioni: null })}>Ripristina l'elenco di partenza</button>
          <button class="chiudi" @click=${() => this.chiudi()}>Chiudi</button>
        </div>
      </div>`;
  }
}
