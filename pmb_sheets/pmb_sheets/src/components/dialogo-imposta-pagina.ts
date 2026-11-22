// Finestra "Imposta pagina" di pmb_sheets (File › Imposta pagina…): carta, orientamento, scala o adatta a pagine, margini,
// intestazione e piè di pagina, area di stampa, righe e colonne da ripetere, griglia, intestazioni di riga e colonna, ordine delle pagine.
// Scritta per pmb_office (lotto 3, 2026-11-18). Le scelte valgono quando si preme OK.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import {
  CAMPI, CARTA, NOMI_CARTA, copiaPagina, leggiAreaStampa, leggiColonne, leggiRighe, paginaPredefinita, scriviAreaStampa, scriviColonne, scriviRighe,
  type FormatoCarta, type ImpostaPagina, type TestiMargine,
} from '../sheet/pagina';

type Scheda = 'pagina' | 'margini' | 'intestazione' | 'foglio';
const SCHEDE: Array<[Scheda, string]> = [['pagina', 'Pagina'], ['margini', 'Margini'], ['intestazione', 'Intestazione e piè di pagina'], ['foglio', 'Foglio']];

@customElement('free-dialogo-imposta-pagina')
export class FreeDialogoImpostaPagina extends LinguaElement {
  /** l'impostazione attuale del foglio */
  @property({ attribute: false }) pagina: ImpostaPagina = paginaPredefinita();
  /** il nome del foglio, per il titolo */
  @property({ type: String }) foglio = '';
  /** la selezione attuale, per «Usa la selezione» */
  @property({ type: String }) selezione = '';
  @state() private p: ImpostaPagina = paginaPredefinita();
  @state() private scheda: Scheda = 'pagina';
  @state() private area = '';
  @state() private righe = '';
  @state() private colonne = '';
  @state() private errore = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 560px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; }
    h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
    .schede { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border, #dadce0); margin-bottom: 14px; flex-wrap: wrap; }
    .schede button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; padding: 6px 10px; }
    .schede button[aria-selected="true"] { border-bottom-color: #1a73e8; color: #1a73e8; font-weight: 500; }
    fieldset { border: 0; padding: 0; margin: 0 0 12px; }
    legend { font-weight: 500; padding: 0; margin-bottom: 6px; }
    .riga { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .riga > label:first-child { min-width: 150px; }
    label.scelta { display: inline-flex; align-items: center; gap: 6px; margin-right: 14px; cursor: pointer; }
    select, input[type="text"], input[type="number"] { padding: 5px 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    input[type="number"] { width: 70px; }
    input[type="text"] { width: 150px; }
    .margini { display: grid; grid-template-columns: repeat(2, auto 1fr); gap: 8px 10px; align-items: center; max-width: 380px; }
    .tre { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
    .tre input { width: 100%; box-sizing: border-box; }
    .aiuto { color: var(--color-text-muted, #5f6368); font-size: 12px; margin: 4px 0 10px; }
    .errore { color: #d93025; min-height: 18px; margin: 6px 0; }
    .bottoni { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .bottoni div { display: flex; gap: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    button.piccolo { padding: 3px 10px; }
  `;

  willUpdate(cambiate: Map<string, unknown>): void {
    if (cambiate.has('pagina')) {
      this.p = copiaPagina(this.pagina);
      this.area = scriviAreaStampa(this.p.area);
      this.righe = scriviRighe(this.p.righeRipetute);
      this.colonne = scriviColonne(this.p.colonneRipetute);
    }
  }
  firstUpdated(): void { this.renderRoot.querySelector<HTMLButtonElement>('.schede button')?.focus(); }

  private cambia(parziale: Partial<ImpostaPagina>): void { this.p = { ...this.p, ...parziale }; this.errore = ''; }
  private chiudi(): void { this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true })); }

  /** L'impostazione completa, o null con il motivo in `errore`. */
  private completa(): ImpostaPagina | null {
    const area = leggiAreaStampa(this.area);
    if (area === null) { this.errore = t("L'area di stampa non è valida: scrivila come A1:F40."); this.scheda = 'foglio'; return null; }
    const righe = leggiRighe(this.righe);
    if (righe === null) { this.errore = t('Le righe da ripetere non sono valide: scrivile come 1:2.'); this.scheda = 'foglio'; return null; }
    const colonne = leggiColonne(this.colonne);
    if (colonne === null) { this.errore = t('Le colonne da ripetere non sono valide: scrivile come A:B.'); this.scheda = 'foglio'; return null; }
    const { area: _a, righeRipetute: _r, colonneRipetute: _c, ...resto } = this.p;
    void _a; void _r; void _c;
    return copiaPagina({ ...resto, ...(area ? { area } : {}), ...(righe ? { righeRipetute: righe } : {}), ...(colonne ? { colonneRipetute: colonne } : {}) });
  }
  private conferma(evento: 'applica-pagina' | 'anteprima-pagina'): void {
    const p = this.completa();
    if (!p) return;
    this.dispatchEvent(new CustomEvent(evento, { detail: { pagina: p }, bubbles: true, composed: true }));
  }
  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); this.conferma('applica-pagina'); }
  };

  private numero(valore: number, min: number, max: number, cambia: (n: number) => void, etichetta: string, passo = 1) {
    return html`<input type="number" aria-label=${t(etichetta)} min=${min} max=${max} step=${passo} .value=${String(valore)}
      @change=${(e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (Number.isFinite(n)) cambia(Math.min(max, Math.max(min, n))); this.requestUpdate(); }} />`;
  }

  private testi(chi: 'intestazione' | 'pie', titolo: string) {
    const v = this.p[chi];
    const cambia = (k: keyof TestiMargine, x: string): void => this.cambia({ [chi]: { ...v, [k]: x } } as Partial<ImpostaPagina>);
    return html`<fieldset><legend>${t(titolo)}</legend><div class="tre">
      ${(['sinistra', 'centro', 'destra'] as const).map((k) => html`<input type="text" data-campo=${`${chi}-${k}`} aria-label=${`${t(titolo)}: ${t(k === 'sinistra' ? 'a sinistra' : k === 'centro' ? 'al centro' : 'a destra')}`} placeholder=${t(k === 'sinistra' ? 'A sinistra' : k === 'centro' ? 'Al centro' : 'A destra')} maxlength="255" .value=${v[k]} @input=${(e: Event) => cambia(k, (e.target as HTMLInputElement).value)} />`)}
    </div></fieldset>`;
  }

  private corpo() {
    const p = this.p;
    if (this.scheda === 'pagina') return html`
      <div class="riga"><label for="carta">Carta</label>
        <select id="carta" data-campo="carta" @change=${(e: Event) => this.cambia({ formato: (e.target as HTMLSelectElement).value as FormatoCarta })}>
          ${(Object.keys(CARTA) as FormatoCarta[]).map((f) => html`<option value=${f} ?selected=${p.formato === f}>${t(NOMI_CARTA[f])}</option>`)}
        </select></div>
      <div class="riga"><span>Orientamento</span>
        <label class="scelta"><input type="radio" name="or" data-campo="verticale" .checked=${p.orientamento === 'verticale'} @change=${() => this.cambia({ orientamento: 'verticale' })} /> Verticale</label>
        <label class="scelta"><input type="radio" name="or" data-campo="orizzontale" .checked=${p.orientamento === 'orizzontale'} @change=${() => this.cambia({ orientamento: 'orizzontale' })} /> Orizzontale</label></div>
      <fieldset><legend>Scala</legend>
        <div class="riga"><label class="scelta"><input type="radio" name="scala" data-campo="scala-fissa" .checked=${p.adatta === null} @change=${() => this.cambia({ adatta: null })} /> Riduci o ingrandisci al</label>
          ${this.numero(p.scala, 10, 400, (n) => this.cambia({ scala: Math.round(n), adatta: null }), 'Scala in percento')} %</div>
        <div class="riga"><label class="scelta"><input type="radio" name="scala" data-campo="adatta" .checked=${p.adatta !== null} @change=${() => this.cambia({ adatta: p.adatta ?? { larghezza: 1, altezza: 0 } })} /> Adatta a</label>
          ${this.numero(p.adatta?.larghezza ?? 1, 0, 100, (n) => this.cambia({ adatta: { larghezza: Math.round(n), altezza: p.adatta?.altezza ?? 0 } }), 'Pagine in larghezza')} ${t('pagine in larghezza per')}
          ${this.numero(p.adatta?.altezza ?? 0, 0, 100, (n) => this.cambia({ adatta: { larghezza: p.adatta?.larghezza ?? 1, altezza: Math.round(n) } }), 'Pagine in altezza')} ${t('in altezza')}</div>
        <p class="aiuto">${t('0 pagine vuol dire «quante ne servono». Adatta riduce soltanto, non ingrandisce.')}</p>
      </fieldset>
      <div class="riga"><span>Ordine delle pagine</span>
        <label class="scelta"><input type="radio" name="ordine" data-campo="giu" .checked=${p.ordine === 'giu'} @change=${() => this.cambia({ ordine: 'giu' })} /> Prima in giù, poi a destra</label>
        <label class="scelta"><input type="radio" name="ordine" data-campo="destra" .checked=${p.ordine === 'destra'} @change=${() => this.cambia({ ordine: 'destra' })} /> Prima a destra, poi in giù</label></div>`;
    if (this.scheda === 'margini') {
      const m = p.margini;
      const cm = (k: keyof ImpostaPagina['margini']) => (n: number): void => this.cambia({ margini: { ...m, [k]: Math.round(n * 10) / 10 } });
      return html`
        <div class="margini">
          <label>Alto (mm)</label>${this.numero(m.alto, 0, 100, cm('alto'), 'Margine alto in millimetri', 0.5)}
          <label>Basso (mm)</label>${this.numero(m.basso, 0, 100, cm('basso'), 'Margine basso in millimetri', 0.5)}
          <label>Sinistro (mm)</label>${this.numero(m.sinistro, 0, 100, cm('sinistro'), 'Margine sinistro in millimetri', 0.5)}
          <label>Destro (mm)</label>${this.numero(m.destro, 0, 100, cm('destro'), 'Margine destro in millimetri', 0.5)}
        </div>
        <p class="aiuto">${t("L'intestazione e il piè di pagina si stampano a metà del margine alto e di quello basso.")}</p>
        <fieldset><legend>Centra nella pagina</legend>
          <label class="scelta"><input type="checkbox" data-campo="centra-o" .checked=${p.centraOrizzontale} @change=${(e: Event) => this.cambia({ centraOrizzontale: (e.target as HTMLInputElement).checked })} /> In orizzontale</label>
          <label class="scelta"><input type="checkbox" data-campo="centra-v" .checked=${p.centraVerticale} @change=${(e: Event) => this.cambia({ centraVerticale: (e.target as HTMLInputElement).checked })} /> In verticale</label>
        </fieldset>`;
    }
    if (this.scheda === 'intestazione') return html`
      ${this.testi('intestazione', 'Intestazione')}
      ${this.testi('pie', 'Piè di pagina')}
      <p class="aiuto">${t('Campi: {}. Per esempio «Pagina &[Pagina] di &[Pagine]».', CAMPI.join('  '))}</p>`;
    return html`
      <div class="riga"><label for="area">Area di stampa</label>
        <input id="area" type="text" data-campo="area" placeholder=${t('tutto il foglio')} .value=${this.area} @input=${(e: Event) => { this.area = (e.target as HTMLInputElement).value; this.errore = ''; }} />
        ${this.selezione ? html`<button class="piccolo" data-azione="usa-selezione" @click=${() => { this.area = this.selezione; this.errore = ''; }}>Usa la selezione</button>` : nothing}</div>
      <div class="riga"><label for="righe">Righe da ripetere in cima</label>
        <input id="righe" type="text" data-campo="righe" placeholder="1:1" .value=${this.righe} @input=${(e: Event) => { this.righe = (e.target as HTMLInputElement).value; this.errore = ''; }} /></div>
      <div class="riga"><label for="colonne">Colonne da ripetere a sinistra</label>
        <input id="colonne" type="text" data-campo="colonne" placeholder="A:A" .value=${this.colonne} @input=${(e: Event) => { this.colonne = (e.target as HTMLInputElement).value; this.errore = ''; }} /></div>
      <fieldset><legend>Stampa anche</legend>
        <label class="scelta"><input type="checkbox" data-campo="griglia" .checked=${p.griglia} @change=${(e: Event) => this.cambia({ griglia: (e.target as HTMLInputElement).checked })} /> La griglia delle celle</label>
        <label class="scelta"><input type="checkbox" data-campo="intestazioni" .checked=${p.intestazioniRigheColonne} @change=${(e: Event) => this.cambia({ intestazioniRigheColonne: (e.target as HTMLInputElement).checked })} /> Le intestazioni di riga e di colonna</label>
      </fieldset>
      ${p.interruzioniRighe.length + p.interruzioniColonne.length > 0 ? html`<div class="riga"><span>${t('Interruzioni di pagina a mano: {}', p.interruzioniRighe.length + p.interruzioniColonne.length)}</span>
        <button class="piccolo" data-azione="togli-interruzioni" @click=${() => this.cambia({ interruzioniRighe: [], interruzioniColonne: [] })}>Togli tutte</button></div>` : nothing}`;
  }

  render() {
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-labelledby="titolo-ip">
          <h2 id="titolo-ip">${this.foglio ? t('Imposta pagina: {}', this.foglio) : t('Imposta pagina')}</h2>
          <div class="schede" role="tablist">
            ${SCHEDE.map(([id, nome]) => html`<button role="tab" data-scheda=${id} aria-selected=${this.scheda === id ? 'true' : 'false'} @click=${() => { this.scheda = id; }}>${t(nome)}</button>`)}
          </div>
          <div role="tabpanel">${this.corpo()}</div>
          <div class="errore" role="alert">${this.errore || nothing}</div>
          <div class="bottoni">
            <button data-azione="predefinite" @click=${() => { this.p = paginaPredefinita(); this.area = ''; this.righe = ''; this.colonne = ''; this.errore = ''; }}>Ripristina predefinite</button>
            <div>
              <button data-azione="anteprima" @click=${() => this.conferma('anteprima-pagina')}>Anteprima</button>
              <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
              <button class="primario" data-azione="ok" @click=${() => this.conferma('applica-pagina')}>OK</button>
            </div>
          </div>
        </div>
      </div>`;
  }
}
