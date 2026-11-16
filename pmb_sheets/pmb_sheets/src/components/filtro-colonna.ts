/**
 * La finestrella del filtro di una colonna (la freccia ▼ nell'intestazione): una condizione (per esempio "Il testo contiene") e/o
 * l'elenco dei valori con una casella ciascuno, con ricerca e "Seleziona tutto / Nessuno". "Applica" manda la scelta alla griglia,
 * che nasconde le righe che non passano. In cima ci sono "Ordina A→Z / Z→A"; se la colonna ha più colori di sfondo o di testo compaiono le liste dei colori,
 * se ha date compare l'elenco dei mesi raggruppati per anno. Posizione e misure passano da variabili CSS impostate dal codice (regola CSP della shell).
 */
import { css, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { CONDIZIONI_FILTRO, condizioneCompleta, raggruppaMesi, valoriDellaCondizione, type FilterCondition, type FilterConditionOperator } from '../sheet/filter';
import { styleMap } from '../utils/style-map';
import { t } from '../i18n/lingua';

const MASSIMO_VISIBILI = 500;

@customElement('free-filtro-colonna')
export class FreeFiltroColonna extends LinguaElement {
  /** la lettera della colonna, per il titolo */
  @property({ type: String }) colonna = '';
  /** tutti i valori distinti della colonna, già in ordine ("" è la cella vuota) */
  @property({ type: Array }) valori: string[] = [];
  /** i valori oggi spuntati; `null` = tutti */
  @property({ attribute: false }) spuntatiIniziali: string[] | null = null;
  @property({ attribute: false }) condizioneIniziale: FilterCondition | null = null;
  /** la colonna ha già un filtro: compare "Rimuovi filtro" */
  @property({ type: Boolean }) attivo = false;
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
  /** i colori di sfondo distinti della colonna ("" = senza colore) e quelli oggi ammessi (`null` = tutti) */
  @property({ attribute: false }) coloriSfondo: string[] = [];
  @property({ attribute: false }) spuntatiSfondoIniziali: string[] | null = null;
  @property({ attribute: false }) coloriTesto: string[] = [];
  @property({ attribute: false }) spuntatiTestoIniziali: string[] | null = null;
  /** i mesi presenti come 'AAAA-MM' ("" = celle senza data) e quelli oggi ammessi (`null` = tutti) */
  @property({ attribute: false }) mesi: string[] = [];
  @property({ attribute: false }) spuntatiMesiIniziali: string[] | null = null;

  @state() private spuntatiSfondo = new Set<string>();
  @state() private spuntatiTesto = new Set<string>();
  @state() private spuntatiMesi = new Set<string>();

  @state() private spuntati = new Set<string>();
  @state() private ricerca = '';
  @state() private operatore: FilterConditionOperator = 'none';
  @state() private valore1 = '';
  @state() private valore2 = '';
  @state() private errore = '';

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1100; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; }
    .pannello { position: absolute; left: var(--filtro-x, 0px); top: var(--filtro-y, 0px); width: 280px; max-height: 80vh; display: flex; flex-direction: column; box-sizing: border-box;
      background: var(--color-bg, #fff); border: 1px solid var(--color-border, #dadce0); border-radius: 8px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28); padding: 12px; gap: 8px; }
    h2 { margin: 0; font-size: 14px; font-weight: 500; }
    label.titolo, .sezione { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--color-text-muted, #5f6368); }
    select, input[type="text"], input[type="search"] { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; font: inherit; background: var(--color-bg, #fff); color: inherit; }
    .riga-azioni { display: flex; gap: 12px; }
    .riga-azioni button.testo { border: none; background: none; padding: 0; color: #1a73e8; cursor: pointer; font: inherit; }
    .elenco { overflow: auto; min-height: 60px; max-height: 220px; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; padding: 4px 0; }
    .elenco label { display: flex; align-items: center; gap: 8px; padding: 3px 8px; cursor: pointer; }
    .elenco label:hover { background: var(--color-hover, rgba(60, 64, 67, 0.08)); }
    .elenco .vuoto { color: var(--color-text-muted, #5f6368); font-style: italic; padding-left: 0.3em; }
    .nota { font-size: 12px; color: var(--color-text-muted, #5f6368); }
    .errore { color: #d93025; font-size: 12px; min-height: 0; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; }
    .bottoni button { padding: 6px 14px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    .bottoni button.primario { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    .spazio { flex: 1; }
    .ordina { display: flex; gap: 8px; }
    .ordina button { flex: 1; padding: 5px 8px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    .ordina button:hover { background: var(--color-hover, rgba(60, 64, 67, 0.08)); }
    .colori-ordina { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
    .colori-ordina button { padding: 3px 5px; line-height: 0; }
    .colori-ordina .campione { line-height: 14px; font-size: 11px; text-align: center; }
    .campione { display: inline-block; width: 14px; height: 14px; border: 1px solid var(--color-border, #dadce0); border-radius: 3px; flex: none; }
    .lista-corta { max-height: 110px; overflow: auto; border: 1px solid var(--color-border, #dadce0); border-radius: 4px; padding: 4px 0; }
    .lista-corta label { display: flex; align-items: center; gap: 8px; padding: 3px 8px; cursor: pointer; }
    .lista-corta label.mese { padding-left: 28px; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.spuntati = new Set(this.spuntatiIniziali ?? this.valori);
    this.operatore = this.condizioneIniziale?.operator ?? 'none';
    this.valore1 = this.condizioneIniziale?.value1 === undefined ? '' : String(this.condizioneIniziale.value1);
    this.valore2 = this.condizioneIniziale?.value2 === undefined ? '' : String(this.condizioneIniziale.value2);
    this.spuntatiSfondo = new Set(this.spuntatiSfondoIniziali ?? this.coloriSfondo);
    this.spuntatiTesto = new Set(this.spuntatiTestoIniziali ?? this.coloriTesto);
    this.spuntatiMesi = new Set(this.spuntatiMesiIniziali ?? this.mesi);
  }

  private alterna(insieme: Set<string>, chiavi: readonly string[], spuntato: boolean): Set<string> {
    const prossimo = new Set(insieme);
    for (const k of chiavi) { if (spuntato) prossimo.add(k); else prossimo.delete(k); }
    return prossimo;
  }

  private ordina(ascendente: boolean): void {
    this.dispatchEvent(new CustomEvent('ordina-colonna', { detail: { ascendente }, bubbles: true, composed: true }));
  }

  /** Le righe con quel colore vanno in cima (Excel: Ordina per colore). Si offre solo se la colonna ha almeno un colore e più di un aspetto. */
  private ordinaPerColore() {
    const voci = [
      ...(this.coloriSfondo.length >= 2 ? this.coloriSfondo.filter((c) => c !== '').map((c) => ({ tipo: 'sfondo' as const, colore: c })) : []),
      ...(this.coloriTesto.length >= 2 ? this.coloriTesto.filter((c) => c !== '').map((c) => ({ tipo: 'testo' as const, colore: c })) : []),
    ];
    if (voci.length === 0) return nothing;
    return html`
      <span class="sezione">Ordina per colore (prima le righe con questo colore)</span>
      <div class="colori-ordina" role="group" aria-label="Ordina per colore" data-campo="ordina-colore">
        ${voci.map((v) => html`
          <button data-azione="ordina-colore" data-tipo=${v.tipo} data-colore=${v.colore}
            aria-label=${t("Prima le righe con {} {}", v.tipo === 'sfondo' ? t('sfondo') : t('testo'), v.colore)} title=${`${v.tipo === 'sfondo' ? t("Sfondo") : t("Testo")} ${v.colore}`}
            @click=${() => this.dispatchEvent(new CustomEvent('ordina-colore', { detail: { colore: v.colore, tipo: v.tipo }, bubbles: true, composed: true }))}>
            <span class="campione" style=${styleMap(v.tipo === 'sfondo' ? { backgroundColor: v.colore } : {})}>${v.tipo === 'testo' ? html`<span style=${styleMap({ color: v.colore, fontWeight: '700' })}>A</span>` : nothing}</span>
          </button>`)}
      </div>`;
  }

  private elencoColori(titolo: string, campo: 'sfondo' | 'testo', colori: readonly string[], spuntati: Set<string>) {
    if (colori.length < 2) return nothing;
    const imposta = (nuovo: Set<string>) => { if (campo === 'sfondo') this.spuntatiSfondo = nuovo; else this.spuntatiTesto = nuovo; };
    return html`
      <span class="sezione">${titolo}</span>
      <div class="lista-corta" role="group" aria-label=${titolo} data-campo=${`colori-${campo}`}>
        ${colori.map((c) => html`
          <label><input type="checkbox" data-colore=${c} .checked=${spuntati.has(c)} @change=${(e: Event) => imposta(this.alterna(spuntati, [c], (e.target as HTMLInputElement).checked))} />
            <span class="campione" style=${styleMap(c === '' ? {} : { backgroundColor: c })}></span><span>${c === '' ? (campo === 'sfondo' ? t("Nessun colore") : t("Automatico")) : c}</span></label>`)}
      </div>`;
  }

  private elencoMesi() {
    const gruppi = raggruppaMesi(this.mesi);
    if (gruppi.length === 0) return nothing;
    const senzaData = this.mesi.includes('');
    return html`
      <span class="sezione">Filtra per data</span>
      <div class="lista-corta" role="group" aria-label="Mesi della colonna" data-campo="mesi">
        ${gruppi.map((g) => {
          const chiavi = g.mesi.map((m) => m.chiave);
          const quanti = chiavi.filter((k) => this.spuntatiMesi.has(k)).length;
          return html`
            <label><input type="checkbox" data-anno=${g.anno} .checked=${quanti === chiavi.length} .indeterminate=${quanti > 0 && quanti < chiavi.length}
              @change=${(e: Event) => { this.spuntatiMesi = this.alterna(this.spuntatiMesi, chiavi, (e.target as HTMLInputElement).checked); }} /><span>${g.anno}</span></label>
            ${g.mesi.map((m) => html`<label class="mese"><input type="checkbox" data-mese=${m.chiave} .checked=${this.spuntatiMesi.has(m.chiave)}
              @change=${(e: Event) => { this.spuntatiMesi = this.alterna(this.spuntatiMesi, [m.chiave], (e.target as HTMLInputElement).checked); }} /><span>${t(m.etichetta)}</span></label>`)}`;
        })}
        ${senzaData ? html`<label><input type="checkbox" data-mese="" .checked=${this.spuntatiMesi.has('')} @change=${(e: Event) => { this.spuntatiMesi = this.alterna(this.spuntatiMesi, [''], (e.target as HTMLInputElement).checked); }} /><span class="vuoto">(senza data)</span></label>` : nothing}
      </div>`;
  }

  updated(): void {
    // dentro la finestra del programma: se non c'è posto sotto la freccia si sposta
    const pannello = this.renderRoot.querySelector('.pannello') as HTMLElement | null;
    const larghezza = pannello?.offsetWidth ?? 280;
    const altezza = pannello?.offsetHeight ?? 360;
    const x = Math.max(4, Math.min(this.x, window.innerWidth - larghezza - 4));
    const y = Math.max(4, Math.min(this.y, window.innerHeight - altezza - 4));
    this.style.setProperty('--filtro-x', `${x}px`);
    this.style.setProperty('--filtro-y', `${y}px`);
  }

  firstUpdated(): void {
    (this.renderRoot.querySelector('select') as HTMLSelectElement | null)?.focus();
  }

  private corrispondenti(): string[] {
    const q = this.ricerca.trim().toLowerCase();
    return q === '' ? this.valori : this.valori.filter((v) => (v === '' ? t("(vuote)") : v).toLowerCase().includes(q));
  }

  private tutti(sel: boolean): void {
    const prossimo = new Set(this.spuntati);
    for (const v of this.corrispondenti()) { if (sel) prossimo.add(v); else prossimo.delete(v); }
    this.spuntati = prossimo;
  }

  private cambia(v: string, spuntato: boolean): void {
    const prossimo = new Set(this.spuntati);
    if (spuntato) prossimo.add(v); else prossimo.delete(v);
    this.spuntati = prossimo;
  }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi-dialogo', { bubbles: true, composed: true }));
  }

  private condizione(): FilterCondition | undefined {
    if (this.operatore === 'none') return undefined;
    const n = valoriDellaCondizione(this.operatore);
    const v = (t: string): string | number => (t.trim() !== '' && !Number.isNaN(Number(t)) ? Number(t) : t);
    return { operator: this.operatore, ...(n >= 1 ? { value1: v(this.valore1) } : {}), ...(n === 2 ? { value2: v(this.valore2) } : {}) };
  }

  private applica(): void {
    const c = this.condizione();
    if (c && !condizioneCompleta(c)) {
      this.errore = valoriDellaCondizione((c as FilterCondition).operator) === 0 ? '' : t("Completa la condizione: servono valori validi (numeri per i confronti numerici).");
      if (this.errore) return;
    }
    this.errore = '';
    this.dispatchEvent(new CustomEvent('applica-filtro', { detail: { spuntati: [...this.spuntati], condizione: c, sfondo: [...this.spuntatiSfondo], testo: [...this.spuntatiTesto], mesi: [...this.spuntatiMesi] }, bubbles: true, composed: true }));
  }

  private rimuovi(): void {
    this.dispatchEvent(new CustomEvent('rimuovi-filtro', { bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { e.stopPropagation(); this.chiudi(); }
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'checkbox') { e.preventDefault(); this.applica(); }
  };

  render() {
    const visibili = this.corrispondenti();
    const mostrati = visibili.slice(0, MASSIMO_VISIBILI);
    const n = valoriDellaCondizione(this.operatore);
    return html`
      <div class="velo" @mousedown=${() => this.chiudi()}></div>
      <div class="pannello" role="dialog" aria-label=${t("Filtro della colonna {}", this.colonna)} @keydown=${this.suTasto} @mousedown=${(e: MouseEvent) => e.stopPropagation()}>
        <h2>Filtro della colonna ${this.colonna}</h2>
        <div class="ordina" role="group" aria-label="Ordina la colonna">
          <button data-azione="ordina-az" @click=${() => this.ordina(true)}>Ordina A → Z</button>
          <button data-azione="ordina-za" @click=${() => this.ordina(false)}>Ordina Z → A</button>
        </div>
        ${this.ordinaPerColore()}
        <label class="titolo" for="condizione">Filtra per condizione</label>
        <select id="condizione" data-campo="condizione" .value=${this.operatore} @change=${(e: Event) => { this.operatore = (e.target as HTMLSelectElement).value as FilterConditionOperator; this.errore = ''; }}>
          ${CONDIZIONI_FILTRO.map((c) => html`<option value=${c.operator} ?selected=${c.operator === this.operatore}>${t(c.etichetta)}</option>`)}
        </select>
        ${n >= 1 ? html`<input type="text" data-campo="valore1" aria-label="Valore della condizione" .value=${this.valore1} @input=${(e: Event) => { this.valore1 = (e.target as HTMLInputElement).value; }} />` : nothing}
        ${n === 2 ? html`<input type="text" data-campo="valore2" aria-label="Secondo valore della condizione" .value=${this.valore2} @input=${(e: Event) => { this.valore2 = (e.target as HTMLInputElement).value; }} />` : nothing}
        ${this.elencoColori(t("Filtra per colore di sfondo"), 'sfondo', this.coloriSfondo, this.spuntatiSfondo)}
        ${this.elencoColori(t("Filtra per colore del testo"), 'testo', this.coloriTesto, this.spuntatiTesto)}
        ${this.elencoMesi()}
        <span class="sezione">Filtra per valori</span>
        <input type="search" data-campo="ricerca" placeholder="Cerca nei valori" aria-label="Cerca nei valori" .value=${this.ricerca} @input=${(e: Event) => { this.ricerca = (e.target as HTMLInputElement).value; }} />
        <div class="riga-azioni">
          <button class="testo" data-azione="tutti" @click=${() => this.tutti(true)}>Seleziona tutto</button>
          <button class="testo" data-azione="nessuno" @click=${() => this.tutti(false)}>Nessuno</button>
        </div>
        <div class="elenco" role="group" aria-label="Valori della colonna" data-campo="elenco">
          ${mostrati.length === 0 ? html`<div class="vuoto"> Nessun valore corrisponde</div>` : mostrati.map((v) => html`
            <label><input type="checkbox" data-valore=${v} .checked=${this.spuntati.has(v)} @change=${(e: Event) => this.cambia(v, (e.target as HTMLInputElement).checked)} /><span class=${v === '' ? 'vuoto' : ''}>${v === '' ? t("(vuote)") : v}</span></label>`)}
        </div>
        <div class="nota" data-campo="conteggio">${this.spuntati.size} di ${this.valori.length} valori selezionati${visibili.length > MASSIMO_VISIBILI ? t("· si vedono i primi {} di {}: usa la ricerca", MASSIMO_VISIBILI, visibili.length) : ''}</div>
        <div class="errore" data-campo="errore" role="alert">${this.errore}</div>
        <div class="bottoni">
          ${this.attivo ? html`<button data-azione="rimuovi" @click=${() => this.rimuovi()}>Rimuovi filtro</button>` : nothing}
          <span class="spazio"></span>
          <button data-azione="chiudi" @click=${() => this.chiudi()}>Annulla</button>
          <button class="primario" data-azione="applica" @click=${() => this.applica()}>Applica</button>
        </div>
      </div>`;
  }
}
