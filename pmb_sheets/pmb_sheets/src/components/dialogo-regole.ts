// Finestra per creare una regola di formattazione condizionale o di convalida dei dati in pmb_sheets.
// Regole precise: LAVORO/compiti/T326/compito.md. Elenco delle regole e soglie: AUDIT, Fase 43.
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import {
  CONDIZIONI, TIPI_CONVALIDA, OPERATORI_CONVALIDA, TIPI_SOGLIA, creaRegolaCondizionale, creaRegolaConvalida, datiDaConvalida, datiDaRegola, descriviConvalida, descriviRegola, eGrafica, scriviIntervallo,
  type Condizione, type ConvalidaElencata, type TipoConvalida,
} from '../sheet/regole-dialogo';
import type { ValidationOperator } from '../sheet/data-validation';
import type { ConditionalFormatRule, TipoSoglia } from '../sheet/conditional-format';
import { styleMap } from '../utils/style-map';
import { t } from '../i18n/lingua';

type Estremo = 'min' | 'mid' | 'max';
const ESTREMI: Estremo[] = ['min', 'mid', 'max'];
const NOMI_ESTREMI: Record<Estremo, string> = { min: 'Minimo', mid: 'Punto medio', max: 'Massimo' };
const SOGLIE_DI_PARTENZA: Record<Estremo, TipoSoglia> = { min: 'min', mid: 'percentile', max: 'max' };

/** Il piccolo campione di colore accanto a una regola dell'elenco. */
function campione(r: ConditionalFormatRule): Record<string, string | undefined> {
  if (r.type === 'color_scale' && r.colorScale) {
    const c = r.colorScale;
    return { backgroundImage: `linear-gradient(to right, ${[c.minColor, c.midColor, c.maxColor].filter(Boolean).join(', ')})` };
  }
  if (r.type === 'data_bar' && r.dataBar) return { backgroundImage: `linear-gradient(to right, ${r.dataBar.color} 60%, transparent 60%)` };
  if (r.type === 'icon_set') return {};
  return { backgroundColor: r.style?.backgroundColor, color: r.style?.textColor, fontWeight: r.style?.bold ? '700' : undefined };
}

@customElement('free-dialogo-regole')
export class FreeDialogoRegole extends LinguaElement {
  @property({ type: String }) modo: 'condizionale' | 'convalida' = 'condizionale';
  /** l'intervallo che si propone all'apertura, per esempio "A1:B10" */
  @property({ type: String }) intervallo = '';
  /** le regole di formattazione condizionale del foglio, in ordine di priorità (la prima che vale vince) */
  @property({ attribute: false }) regole: ConditionalFormatRule[] = [];
  /** le convalide del foglio, raggruppate per regola con le loro aree */
  @property({ attribute: false }) convalide: ConvalidaElencata[] = [];
  /** la firma della convalida che si sta modificando, oppure null per una nuova */
  @state() private convalidaInModifica: string | null = null;
  @state() private errore = '';
  @state() private condizione: Condizione = 'maggiore';
  @state() private tipo: TipoConvalida = 'elenco';
  @state() private operatore: ValidationOperator = 'between';
  @state() private tipiSoglia: Record<Estremo, TipoSoglia> = { ...SOGLIE_DI_PARTENZA };
  /** la posizione nell'elenco della regola che si sta modificando, oppure null per una regola nuova */
  @state() private inModifica: number | null = null;

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1000; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 460px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; }
    h2 { margin: 0 0 16px; font-size: 16px; font-weight: 500; }
    .riga { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .riga > label { width: 110px; flex: none; }
    .riga input[type='text'], .riga select { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .riga input[type='color'] { width: 32px; height: 24px; padding: 0; border: 1px solid var(--color-border, #dadce0); }
    .nascosto { display: none !important; }
    .errore { color: #d93025; min-height: 18px; margin: 4px 0 12px; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button:disabled { opacity: 0.4; cursor: default; }
    button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    .elenco { border: 1px solid var(--color-border, #dadce0); border-radius: 4px; margin-bottom: 16px; }
    .elenco-titolo { padding: 6px 8px; font-weight: 500; border-bottom: 1px solid var(--color-border, #dadce0); }
    .elenco ol { list-style: none; margin: 0; padding: 0; max-height: 168px; overflow: auto; }
    .elenco li { display: flex; align-items: center; gap: 6px; padding: 4px 8px; }
    .elenco li.in-modifica { background: rgba(26, 115, 232, 0.12); }
    .elenco .campione { flex: none; width: 28px; height: 16px; border: 1px solid var(--color-border, #dadce0); border-radius: 2px; font-size: 10px; line-height: 16px; text-align: center; }
    .elenco .descr { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .elenco .dove { flex: none; color: var(--color-text-secondary, #5f6368); }
    .elenco button { padding: 2px 6px; }
    .modifica-di { margin: -8px 0 12px; color: #1a73e8; }
  `;

  firstUpdated(): void { this.focalizza(); }
  /** Porta il cursore nel primo campo. */
  focalizza(): void { this.campo('intervallo')?.focus(); }

  private campo(nome: string): HTMLInputElement | HTMLSelectElement | null {
    return this.renderRoot.querySelector(`[data-campo="${nome}"]`);
  }
  private testo(nome: string): string { return (this.campo(nome) as HTMLInputElement | null)?.value ?? ''; }
  private spunta(nome: string): boolean { return (this.campo(nome) as HTMLInputElement | null)?.checked ?? false; }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true }));
  }

  private fine(): void {
    if (this.modo === 'condizionale') {
      const vecchia = this.inModifica !== null ? this.regole[this.inModifica] : undefined;
      const e = creaRegolaCondizionale({
        intervallo: this.testo('intervallo'),
        condizione: this.condizione,
        valore1: this.testo('valore1'),
        valore2: this.testo('valore2'),
        sfondo: this.spunta('usa-sfondo') ? this.testo('sfondo') : '',
        testo: this.spunta('usa-testo') ? this.testo('colore-testo') : '',
        grassetto: this.spunta('grassetto'),
        coloreMin: this.testo('colore-min'),
        coloreMid: this.testo('colore-mid'),
        coloreMax: this.testo('colore-max'),
        soglie: Object.fromEntries(ESTREMI.map((x) => [x, { tipo: this.tipiSoglia[x], valore: this.testo(`soglia-${x}-valore`) }])),
      }, vecchia?.id || `cf-${Date.now().toString(36)}`);
      if (!e.ok) { this.errore = e.errore; return; }
      this.errore = '';
      this.dispatchEvent(new CustomEvent('applica-regola', {
        detail: { modo: 'condizionale', regola: e.valore, ...(this.inModifica !== null ? { sostituisce: this.inModifica } : {}) }, bubbles: true, composed: true,
      }));
      return;
    }
    const e = creaRegolaConvalida({
      intervallo: this.testo('intervallo'),
      tipo: this.tipo,
      voci: this.testo('voci'),
      operatore: this.operatore,
      valore1: this.testo('valore1'),
      valore2: this.testo('valore2'),
      azione: this.testo('azione') === 'avvisa' ? 'avvisa' : 'rifiuta',
      messaggio: this.testo('messaggio'),
      ammettiVuote: this.spunta('vuote'),
    }, `val-${Date.now().toString(36)}`);
    if (!e.ok) { this.errore = e.errore; return; }
    this.errore = '';
    this.dispatchEvent(new CustomEvent('applica-regola', {
      detail: { modo: 'convalida', convalida: e.valore, ...(this.convalidaInModifica !== null ? { sostituisce: this.convalidaInModifica } : {}) }, bubbles: true, composed: true,
    }));
  }

  /** Carica nel modulo la convalida con quella firma: "Fine" la sostituisce su tutte le sue celle. */
  private async modificaConvalida(firma: string): Promise<void> {
    const voce = this.convalide.find((v) => v.firma === firma);
    const d = voce ? datiDaConvalida(voce.regola, voce.aree) : null;
    if (!d) return;
    this.convalidaInModifica = firma;
    this.tipo = d.tipo;
    this.operatore = d.operatore;
    this.errore = '';
    await this.updateComplete;
    const metti = (nome: string, v: string) => { const el = this.campo(nome) as HTMLInputElement | HTMLSelectElement | null; if (el) el.value = v; };
    metti('intervallo', d.intervallo); metti('voci', d.voci); metti('valore1', d.valore1); metti('valore2', d.valore2);
    metti('azione', d.azione); metti('messaggio', d.messaggio);
    const vuote = this.campo('vuote') as HTMLInputElement | null;
    if (vuote) vuote.checked = d.ammettiVuote;
  }

  private renderElencoConvalide() {
    if (this.convalide.length === 0) return nothing;
    return html`
      <div class="elenco" data-elenco>
        <div class="elenco-titolo">Convalide del foglio</div>
        <ol>
          ${this.convalide.map((v) => html`
            <li data-firma=${v.firma} class=${this.convalidaInModifica === v.firma ? 'in-modifica' : ''}>
              <span class="descr" title=${descriviConvalida(v.regola)}>${descriviConvalida(v.regola)}</span>
              <span class="dove" title=${v.aree.map(scriviIntervallo).join(', ')}>${scriviIntervallo(v.aree[0])}${v.aree.length > 1 ? ` +${v.aree.length - 1}` : ''}</span>
              <button data-azione="modifica" ?disabled=${!datiDaConvalida(v.regola, v.aree)} aria-label="Modifica la convalida ${descriviConvalida(v.regola)}" title="Modifica" @click=${() => { void this.modificaConvalida(v.firma); }}>✎</button>
              <button data-azione="elimina" aria-label="Elimina la convalida ${descriviConvalida(v.regola)}" title="Elimina" @click=${() => {
                this.convalidaInModifica = null;
                this.dispatchEvent(new CustomEvent('gestisci-convalida', { detail: { azione: 'elimina', firma: v.firma }, bubbles: true, composed: true }));
              }}>✕</button>
            </li>`)}
        </ol>
      </div>`;
  }

  /** Carica nel modulo la regola in quella posizione dell'elenco: "Fine" la sostituisce. */
  private async modifica(indice: number): Promise<void> {
    const d = this.regole[indice] ? datiDaRegola(this.regole[indice]) : null;
    if (!d) return;
    this.inModifica = indice;
    this.condizione = d.condizione;
    this.tipiSoglia = { min: d.soglie?.min?.tipo ?? 'min', mid: d.soglie?.mid?.tipo ?? 'percentile', max: d.soglie?.max?.tipo ?? 'max' };
    this.errore = '';
    await this.updateComplete;
    const metti = (nome: string, v: string | undefined) => { const el = this.campo(nome) as HTMLInputElement | null; if (el && v !== undefined) el.value = v; };
    const spunta = (nome: string, v: boolean) => { const el = this.campo(nome) as HTMLInputElement | null; if (el) el.checked = v; };
    metti('intervallo', d.intervallo); metti('valore1', d.valore1); metti('valore2', d.valore2);
    if (d.sfondo) metti('sfondo', d.sfondo);
    if (d.testo) metti('colore-testo', d.testo);
    spunta('usa-sfondo', d.sfondo !== ''); spunta('usa-testo', d.testo !== ''); spunta('grassetto', d.grassetto);
    metti('colore-min', d.coloreMin); metti('colore-mid', d.coloreMid); metti('colore-max', d.coloreMax);
    for (const x of ESTREMI) metti(`soglia-${x}-valore`, d.soglie?.[x]?.valore ?? (x === 'mid' ? '50' : ''));
  }

  private gestisci(azione: 'su' | 'giu' | 'elimina', indice: number): void {
    this.inModifica = null;   // le posizioni cambiano: la modifica in corso torna una regola nuova
    this.dispatchEvent(new CustomEvent('gestisci-regola', { detail: { azione, indice }, bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); this.chiudi(); }
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); this.fine(); }
  };

  private renderElenco() {
    if (this.regole.length === 0) return nothing;
    const n = this.regole.length;
    return html`
      <div class="elenco" data-elenco>
        <div class="elenco-titolo">Regole del foglio (vale la prima che corrisponde)</div>
        <ol>
          ${this.regole.map((r, i) => html`
            <li data-indice=${i} class=${this.inModifica === i ? 'in-modifica' : ''}>
              <span class="campione" style=${styleMap(campione(r))}>${r.type === 'icon_set' ? (r.iconSet?.type === 'arrows' ? '▲▼' : '●') : 'Aa'}</span>
              <span class="descr" title=${descriviRegola(r)}>${descriviRegola(r)}</span>
              <span class="dove">${scriviIntervallo(r.range)}</span>
              <button data-azione="modifica" data-indice=${i} ?disabled=${!datiDaRegola(r)} aria-label="Modifica la regola ${i + 1}" title="Modifica" @click=${() => { void this.modifica(i); }}>✎</button>
              <button data-azione="su" data-indice=${i} ?disabled=${i === 0} aria-label="Sposta su la regola ${i + 1}" title="Più importante" @click=${() => this.gestisci('su', i)}>↑</button>
              <button data-azione="giu" data-indice=${i} ?disabled=${i === n - 1} aria-label="Sposta giù la regola ${i + 1}" title="Meno importante" @click=${() => this.gestisci('giu', i)}>↓</button>
              <button data-azione="elimina" data-indice=${i} aria-label="Elimina la regola ${i + 1}" title="Elimina" @click=${() => this.gestisci('elimina', i)}>✕</button>
            </li>`)}
        </ol>
      </div>`;
  }

  private renderCondizionale() {
    const voluti = CONDIZIONI.find((c) => c.id === this.condizione)?.valori ?? 1;
    const grafica = eGrafica(this.condizione);
    const conColori = this.condizione === 'scala-2' || this.condizione === 'scala-3' || this.condizione === 'barre';
    return html`
      ${this.renderElenco()}
      ${this.inModifica !== null ? html`<div class="modifica-di" data-modifica>Modifica della regola ${this.inModifica + 1}
        <button data-azione="nuova" @click=${() => { this.inModifica = null; }}>Fanne una nuova</button></div>` : nothing}
      <div class="riga"><label>Intervallo</label><input type="text" data-campo="intervallo" .value=${this.intervallo}></div>
      <div class="riga"><label>Se la cella</label>
        <select data-campo="condizione" @change=${(e: Event) => { this.condizione = (e.target as HTMLSelectElement).value as Condizione; }}>
          ${CONDIZIONI.map((c) => html`<option value=${c.id} ?selected=${c.id === this.condizione}>${t(c.etichetta)}</option>`)}
        </select></div>
      <div class="riga ${voluti >= 1 ? '' : 'nascosto'}" data-riga="valore1"><label>${this.condizione === 'formula' ? t("Formula") : t("Valore")}</label><input type="text" data-campo="valore1" placeholder=${this.condizione === 'formula' ? '=A1>25' : ''}></div>
      <div class="riga ${voluti >= 2 ? '' : 'nascosto'}" data-riga="valore2"><label>e</label><input type="text" data-campo="valore2"></div>
      <div class="riga ${this.condizione === 'scala-2' || this.condizione === 'scala-3' ? '' : 'nascosto'}" data-riga="colore-min"><label>Colore minimo</label><input type="color" data-campo="colore-min" value="#f8cbad"></div>
      <div class="riga ${this.condizione === 'scala-3' ? '' : 'nascosto'}" data-riga="colore-mid"><label>Colore medio</label><input type="color" data-campo="colore-mid" value="#ffe699"></div>
      <div class="riga ${conColori ? '' : 'nascosto'}" data-riga="colore-max"><label>${this.condizione === 'barre' ? t("Colore barra") : t("Colore massimo")}</label><input type="color" data-campo="colore-max" value=${this.condizione === 'barre' ? '#9dc3e6' : '#a9d18e'}></div>
      ${ESTREMI.map((x) => html`
        <div class="riga ${conColori && (x !== 'mid' || this.condizione === 'scala-3') ? '' : 'nascosto'}" data-riga="soglia-${x}"><label>${t(NOMI_ESTREMI[x])}</label>
          <select data-campo="soglia-${x}-tipo" @change=${(e: Event) => { this.tipiSoglia = { ...this.tipiSoglia, [x]: (e.target as HTMLSelectElement).value as TipoSoglia }; }}>
            ${TIPI_SOGLIA[x].map((s) => html`<option value=${s.id} ?selected=${s.id === this.tipiSoglia[x]}>${t(s.etichetta)}</option>`)}
          </select>
          <input type="text" data-campo="soglia-${x}-valore" aria-label="Valore per ${NOMI_ESTREMI[x].toLowerCase()}" class=${this.tipiSoglia[x] === 'min' || this.tipiSoglia[x] === 'max' ? 'nascosto' : ''} value=${x === 'mid' ? '50' : ''}>
        </div>`)}
      <div class="riga ${grafica ? 'nascosto' : ''}"><label><input type="checkbox" data-campo="usa-sfondo" checked> Sfondo</label><input type="color" data-campo="sfondo" value="#b7e1cd"></div>
      <div class="riga ${grafica ? 'nascosto' : ''}"><label><input type="checkbox" data-campo="usa-testo"> Testo</label><input type="color" data-campo="colore-testo" value="#d93025"></div>
      <div class="riga ${grafica ? 'nascosto' : ''}"><label><input type="checkbox" data-campo="grassetto"> Grassetto</label></div>`;
  }

  private renderConvalida() {
    const op = OPERATORI_CONVALIDA.find((o) => o.id === this.operatore);
    const numerico = this.tipo === 'numero' || this.tipo === 'lunghezza';
    return html`
      ${this.renderElencoConvalide()}
      ${this.convalidaInModifica !== null ? html`<div class="modifica-di" data-modifica>Modifica della convalida
        <button data-azione="nuova" @click=${() => { this.convalidaInModifica = null; }}>Fanne una nuova</button></div>` : nothing}
      <div class="riga"><label>Intervallo</label><input type="text" data-campo="intervallo" .value=${this.intervallo}></div>
      <div class="riga"><label>Criterio</label>
        <select data-campo="tipo" @change=${(e: Event) => { this.tipo = (e.target as HTMLSelectElement).value as TipoConvalida; }}>
          ${TIPI_CONVALIDA.map((s) => html`<option value=${s.id} ?selected=${s.id === this.tipo}>${t(s.etichetta)}</option>`)}
        </select></div>
      <div class="riga ${this.tipo === 'elenco' ? '' : 'nascosto'}" data-riga="voci"><label>Voci</label><input type="text" data-campo="voci" placeholder="rosso, verde, blu o =A1:A10"></div>
      <div class="riga ${numerico ? '' : 'nascosto'}" data-riga="operatore"><label>Condizione</label>
        <select data-campo="operatore" @change=${(e: Event) => { this.operatore = (e.target as HTMLSelectElement).value as ValidationOperator; }}>
          ${OPERATORI_CONVALIDA.map((o) => html`<option value=${o.id} ?selected=${o.id === this.operatore}>${t(o.etichetta)}</option>`)}
        </select></div>
      <div class="riga ${numerico ? '' : 'nascosto'}" data-riga="valore1"><label>Valore</label><input type="text" data-campo="valore1"></div>
      <div class="riga ${numerico && op?.valori === 2 ? '' : 'nascosto'}" data-riga="valore2"><label>e</label><input type="text" data-campo="valore2"></div>
      <div class="riga"><label>Se non va bene</label>
        <select data-campo="azione"><option value="rifiuta">Rifiuta l'input</option><option value="avvisa">Mostra un avviso</option></select></div>
      <div class="riga"><label>Messaggio</label><input type="text" data-campo="messaggio"></div>
      <div class="riga"><label><input type="checkbox" data-campo="vuote" checked> Celle vuote ammesse</label></div>`;
  }

  render() {
    const titolo = this.modo === 'condizionale' ? t("Formattazione condizionale") : t("Convalida dei dati");
    return html`
      <div class="velo" data-velo @click=${() => this.chiudi()} @keydown=${this.suTasto}>
        <div class="finestra" role="dialog" aria-modal="true" aria-label=${titolo} @click=${(e: Event) => e.stopPropagation()}>
          <h2>${titolo}</h2>
          ${this.modo === 'condizionale' ? this.renderCondizionale() : this.renderConvalida()}
          <div class="errore" role="alert">${this.errore !== '' ? this.errore : nothing}</div>
          <div class="bottoni">
            <button data-azione="annulla" @click=${() => this.chiudi()}>Annulla</button>
            <button data-azione="fine" class="primario" @click=${() => this.fine()}>Fine</button>
          </div>
        </div>
      </div>`;
  }
}
