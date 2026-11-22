import { css, unsafeCSS } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { vociVisibili } from './barra-dati';
import { SEPARATORE, funzione, divisione, alternaNellaBarra, barraPredefinita, catalogo, type Funzione } from './barra-personalizzata';
import { nomeFunzione } from './docs-personalizza-barra';
import { MISURE, COLORI, STILI } from './misure';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { styleMap } from 'lit/directives/style-map.js';
import { ICONE_DOCS, iconaDi } from './icone';
import { ICONE } from '@comune/icone';
import { contenutoComando } from './contenuto-barra';
import { t, tVoce } from '../i18n/lingua';

// freccia e puntina dall'insieme comune di icone (comune/src/icone.ts), come le altre della barra
const ICONA_SU = ICONE.expandLess;
const ICONA_GIU = ICONE.expandMore;
const ICONA_PUNTINA = ICONE.pinOutline;
const ICONA_PUNTINA_PIENA = ICONE.pin;

@customElement('docs-toolbar')
export class DocsToolbar extends LinguaElement {
  @property({ type: Number }) larghezza = 1600;
  @state() private altriAperto = false;
  /** testi correnti delle caselle (carattere, corpo, stile) e pulsanti da mostrare accesi: li dà il guscio */
  @property({ attribute: false }) valori: Record<string, string> = {};
  @property({ attribute: false }) attivi: string[] = [];
  /** la barra scelta dall'utente (identificativi e separatori); null = barra predefinita */
  @property({ attribute: false }) barra: string[] | null = null;
  /** true se i menu in alto sono nascosti (la freccia a destra punta in giù) */
  @property({ type: Boolean }) menuNascosti = false;
  @state() private funzioniAperto = false;
  @state() private filtroFunzioni = '';
  @state() private contesto: { x: number; y: number; id: string | null } | null = null;

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) select:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button.attivo, :host-context([alto-contrasto]) button[aria-checked="true"], :host-context([alto-contrasto]) button[aria-pressed="true"] { background: #000000; color: #ffffff; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { display: block; }
    .barra-strumenti { display: flex; align-items: center; height: ${unsafeCSS(String(MISURE.barraStrumenti.altezza))}px; background: ${unsafeCSS(COLORI.barraStrumenti)}; border-radius: 20px; font: ${unsafeCSS(String(MISURE.barraStrumenti.corpo))}px ${unsafeCSS(STILI.fontBase)}; padding: 0 8px; position: relative; }
    button { width: 32px; height: 32px; border: 0; background: none; border-radius: 4px; cursor: default; }
    .fisso { margin-left: auto; }
    .icona { display: inline-flex; width: 20px; height: 20px; } /* T027 */
    .icona svg { width: 18px; height: 18px; } /* come in pmb_sheets: icone comuni a 18 px */
    /* T028: caselle di testo, separatori e margine sinistro */
    .barra-strumenti { padding-left: 11px; }
    button.comando { position: relative; }
    button.comando[data-id='zoom'] { width: 74px; font-size: 14px; }
    button.comando[data-id='stile-paragrafo'] { width: 112px; margin-left: 10px; font-size: 14px; }
    button.comando[data-id='carattere'] { width: 90px; margin-left: 12px; font-size: 14px; }
    button.comando[data-id='corpo'] { width: 34px; font-size: 14px; border: 1px solid var(--pmb-bordo-forte, #747775); border-radius: 4px; height: 24px; }
    button.comando[data-id='riduci-corpo'] { margin-left: 8px; }
    button.comando[data-id='stile-paragrafo']::before, button.comando[data-id='carattere']::before, button.comando[data-id='riduci-corpo']::before, button.comando[data-id='grassetto']::before, button.comando[data-id='link']::before, button.comando[data-id='allineamento']::before { content: ''; position: absolute; left: -6px; top: 6px; width: 1px; height: 20px; background: #c4c7c5; }
    button.comando[data-id='grassetto'], button.comando[data-id='link'], button.comando[data-id='allineamento'] { margin-left: 12px; }
    button.comando[data-id='zoom'], button.comando[data-id='stile-paragrafo'], button.comando[data-id='carattere'], button.comando[data-id='corpo'] { display: inline-flex; align-items: center; justify-content: flex-start; padding: 0 8px; white-space: nowrap; }
    button.comando[data-id='corpo'] { justify-content: center; padding: 0; }
    .pannello-altri { position: absolute; top: 100%; right: 48px; background: var(--pmb-superficie, #fff); box-shadow: ${unsafeCSS(STILI.ombraPannelloMenu)}; display: flex; flex-direction: column; z-index: 30; }
    .voce-altri { width: auto; padding: 0 16px; text-align: left; }
    button.comando.attivo { background: var(--pmb-selezione-forte, #d3e3fd); }
    /* Colori, triangolini e posizioni della barra degli strumenti (misurati a 1600 px) */
    .barra-strumenti, button { color: var(--pmb-testo, #0f172a); } /* stesso colore delle icone di pmb_sheets (--color-text) */
    /* il segno ▾ del testo si fa invisibile (carattere ridotto all'1%): il triangolino vero è disegnato sul bordo destro della casella */
    button.comando[data-id='zoom'], button.comando[data-id='stile-paragrafo'], button.comando[data-id='carattere'] { font-family: 'FrecciaDocs', Roboto, Inter, Arial, sans-serif; }
    button.comando[data-id='annulla'] { margin-left: 2px; }
    button.comando[data-id='grassetto'] { margin-left: 3px; }
    button.comando[data-id='evidenzia'] { margin-left: 2px; }
    button.comando[data-id='link'] { margin-left: 9px; }
    button.comando[data-id='allineamento'] { margin-left: 7px; }
    button.comando[data-id='zoom'] { margin-left: 1px; }
    button.comando[data-id='zoom']::after { content: ''; position: absolute; left: 50px; top: 6px; width: 20px; height: 20px; background: currentColor;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; }
    button.comando[data-id='stile-paragrafo'] { margin-left: 14px; }
    button.comando[data-id='stile-paragrafo']::after { content: ''; position: absolute; left: 92px; top: 6px; width: 20px; height: 20px; background: currentColor;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; }
    button.comando[data-id='carattere'] { margin-left: 18px; }
    button.comando[data-id='carattere']::after { content: ''; position: absolute; left: 67px; top: 6px; width: 20px; height: 20px; background: currentColor;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; }
    /* menu a tendina accanto all'icona: il triangolino sta nello stesso pulsante */
    button.comando[data-id='allineamento'], button.comando[data-id='elenco-attivita'], button.comando[data-id='elenco-puntato'], button.comando[data-id='elenco-numerato'] { width: 44px; display: inline-flex; align-items: center; justify-content: flex-start; padding: 0 0 0 6px; }
    button.comando[data-id='allineamento']::after { content: ''; position: absolute; left: 24px; top: 6px; width: 20px; height: 20px; background: currentColor;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; }
    button.comando[data-id='elenco-attivita']::after { content: ''; position: absolute; left: 27px; top: 6px; width: 20px; height: 20px; background: currentColor;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; }
    button.comando[data-id='elenco-puntato']::after { content: ''; position: absolute; left: 27px; top: 6px; width: 20px; height: 20px; background: currentColor;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; }
    button.comando[data-id='elenco-numerato']::after { content: ''; position: absolute; left: 27px; top: 6px; width: 20px; height: 20px; background: currentColor;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-360%20280-560h400L480-360Z'/%3E%3C/svg%3E") center / contain no-repeat; }
    .icona svg { overflow: visible; }
    /* barra personalizzata: i separatori sono elementi veri, non disegni legati a certi comandi */
    .barra-strumenti.personalizzata button.comando::before { content: none; }
    .barra-strumenti.personalizzata button.comando { margin-left: 1px; }
    .barra-strumenti.personalizzata button.comando[data-id='zoom'], .barra-strumenti.personalizzata button.comando[data-id='stile-paragrafo'], .barra-strumenti.personalizzata button.comando[data-id='carattere'] { margin-left: 2px; }
    .separatore { flex: none; width: 1px; height: 20px; margin: 0 6px; background: #c4c7c5; }
    button.comando.testo { width: auto; max-width: 220px; padding: 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: 500 13px Roboto, Arial, sans-serif; border-radius: 16px; }
    button.comando:hover, button.altri:hover, button.fisso:hover, button.nascondi-menu:hover { background: var(--pmb-hover, #e1e5ea); }
    /* a destra: il pulsante Funzioni (come il pezzo di puzzle di Firefox) e la freccia che nasconde i menu */
    button.comando.fisso { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; }
    button.nascondi-menu { flex: none; margin-left: 13px; position: relative; display: inline-flex; align-items: center; justify-content: center; }
    button.nascondi-menu::before { content: ''; position: absolute; left: -7px; top: 6px; width: 1px; height: 20px; background: #c4c7c5; }
    button.nascondi-menu svg, button.fisso svg { width: 22px; height: 22px; }
    .pannello-funzioni { position: absolute; top: calc(100% + 4px); right: 40px; width: 360px; max-height: min(560px, calc(100vh - 140px)); display: flex; flex-direction: column; gap: 6px;
      padding: 12px; background: var(--pmb-superficie, #ffffff); color: var(--pmb-testo, #1f1f1f); border-radius: 12px; box-shadow: ${unsafeCSS(STILI.ombraPannelloMenu)}; z-index: 40; font: 14px Roboto, Arial, sans-serif; cursor: default; }
    .pannello-funzioni h2 { margin: 0 0 4px; font-size: 15px; font-weight: 500; }
    .pannello-funzioni input { height: 30px; padding: 0 12px; border: 1px solid var(--pmb-bordo-forte, #747775); border-radius: 15px; font: inherit; }
    .pannello-funzioni .elenco { overflow-y: auto; flex: 1 1 auto; }
    .pannello-funzioni .gruppo { margin: 8px 4px 2px; font-size: 12px; font-weight: 500; color: var(--pmb-testo-2, #5f6368); text-transform: uppercase; letter-spacing: .3px; }
    .riga-funzione { display: flex; align-items: center; border-radius: 6px; }
    .riga-funzione:hover { background: var(--pmb-hover, #e8eaed); }
    .riga-funzione button.esegui { flex: 1; width: auto; height: 32px; display: flex; align-items: center; gap: 8px; padding: 0 8px; text-align: left; font: inherit; color: var(--pmb-testo, #1f1f1f); }
    .riga-funzione .icona { flex: none; width: 18px; height: 18px; }
    .riga-funzione .icona svg { width: 18px; height: 18px; }
    .riga-funzione button.puntina { color: var(--pmb-testo-2, #5f6368); }
    .riga-funzione button.puntina[aria-pressed='true'] { color: var(--pmb-accento, #0b57d0); }
    .riga-funzione button.puntina svg { width: 18px; height: 18px; }
    .pannello-funzioni button.personalizza { width: auto; height: 36px; border-radius: 18px; padding: 0 16px; font: 500 14px Roboto, Arial, sans-serif; color: var(--pmb-accento, #0b57d0); border: 1px solid var(--pmb-bordo-forte, #747775); }
    .menu-contesto { position: fixed; z-index: 50; min-width: 240px; padding: 6px 0; background: var(--pmb-superficie, #ffffff); color: var(--pmb-testo, #1f1f1f); border-radius: 8px; box-shadow: ${unsafeCSS(STILI.ombraPannelloMenu)}; display: flex; flex-direction: column; }
    .menu-contesto button { width: auto; height: 32px; padding: 0 16px; text-align: left; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); border-radius: 0; }
    .menu-contesto button:hover { background: var(--pmb-hover, #e8eaed); }
  `;

  private emetti(id: string, ev?: Event) {
    const el = ev?.currentTarget as HTMLElement | null | undefined;
    const rect = el ? el.getBoundingClientRect() : null;
    this.dispatchEvent(new CustomEvent('comando', { detail: { id, rect }, bubbles: true, composed: true }));
  }

  /** Un comando scelto dal pannello "Altri comandi": i popup si aprono sotto il pulsante ⋮, non sotto la voce del pannello che sta per sparire. */
  private emettiDaAltri(id: string) {
    const ancora = this.renderRoot.querySelector('button.altri');
    const rect = ancora ? ancora.getBoundingClientRect() : null;
    this.dispatchEvent(new CustomEvent('comando', { detail: { id, rect }, bubbles: true, composed: true }));
  }
  // ---- funzioni (pannello del pezzo di puzzle), menu col tasto destro, barra personalizzata ----
  private fuori = (e: Event): void => {
    if (!this.funzioniAperto && !this.contesto && !this.altriAperto) return;
    if (!e.composedPath().includes(this)) { this.funzioniAperto = false; this.contesto = null; this.altriAperto = false; }
  };
  private tasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && (this.funzioniAperto || this.contesto)) { this.funzioniAperto = false; this.contesto = null; }
  };
  connectedCallback(): void { super.connectedCallback(); window.addEventListener('pointerdown', this.fuori, true); document.addEventListener('keydown', this.tasto); }
  disconnectedCallback(): void { window.removeEventListener('pointerdown', this.fuori, true); document.removeEventListener('keydown', this.tasto); super.disconnectedCallback(); }

  /** La barra effettiva: quella scelta dall'utente o quella predefinita. */
  get barraEffettiva(): string[] { return this.barra ?? barraPredefinita(); }
  private cambiaBarra(nuova: string[]): void {
    this.dispatchEvent(new CustomEvent('barra-cambiata', { detail: { barra: nuova }, bubbles: true, composed: true }));
  }
  private personalizza(): void {
    this.funzioniAperto = false; this.contesto = null;
    this.dispatchEvent(new CustomEvent('personalizza-barra', { bubbles: true, composed: true }));
  }
  /** Esegue una funzione del catalogo: i comandi della barra come un clic sul loro pulsante, le voci di menu come se fossero scelte dal menu. */
  private esegui(f: Funzione, ancora?: Element | null): void {
    this.funzioniAperto = false; this.altriAperto = false;
    if (f.menu) {
      this.dispatchEvent(new CustomEvent('voce-menu', { detail: f.menu.padre ? { menu: f.menu.menu, voce: f.menu.voce, padre: f.menu.padre } : { menu: f.menu.menu, voce: f.menu.voce }, bubbles: true, composed: true }));
      return;
    }
    const rect = ancora ? ancora.getBoundingClientRect() : null;
    this.dispatchEvent(new CustomEvent('comando', { detail: { id: f.id, rect }, bubbles: true, composed: true }));
  }
  private suContesto = (e: MouseEvent): void => {
    e.preventDefault();
    const b = (e.composedPath().find((n) => n instanceof HTMLElement && (n as HTMLElement).dataset?.id) as HTMLElement | undefined);
    const id = b?.dataset.id ?? null;
    this.funzioniAperto = false;
    this.contesto = { x: e.clientX, y: e.clientY, id: id && id !== 'funzioni' && id !== 'nascondi-menu' && this.barraEffettiva.includes(id) ? id : null };
  };

  private pannelloFunzioni() {
    const filtro = this.filtroFunzioni.trim().toLowerCase();
    const barra = this.barraEffettiva;
    const gruppi = new Map<string, Funzione[]>();
    for (const f of catalogo()) {
      if (filtro && !nomeFunzione(f).toLowerCase().includes(filtro)) continue;
      (gruppi.get(f.gruppo) ?? gruppi.set(f.gruppo, []).get(f.gruppo)!).push(f);
    }
    return html`<div class="pannello-funzioni" role="dialog" aria-label="Funzioni">
      <h2>Funzioni</h2>
      <input class="cerca-funzioni" type="search" placeholder="Cerca una funzione" aria-label="Cerca una funzione" .value=${this.filtroFunzioni} @input=${(e: Event) => { this.filtroFunzioni = (e.target as HTMLInputElement).value; }} />
      <div class="elenco">
        ${[...gruppi.entries()].map(([g, voci]) => html`<div class="gruppo">${tVoce(g)}</div>
          ${voci.map((f) => {
            const dentro = barra.includes(f.id);
            const nome = nomeFunzione(f);
            return html`<div class="riga-funzione" data-funzione=${f.id}>
              <button class="esegui" title=${nome} @click=${(e: Event) => this.esegui(f, e.currentTarget as Element)}><span class="icona">${unsafeHTML(iconaDi(f))}</span><span>${nome}</span></button>
              <button class="puntina" aria-pressed=${dentro ? 'true' : 'false'} aria-label=${dentro ? t('Togli {} dalla barra', nome) : t('Metti {} nella barra', nome)} title=${dentro ? t('Togli dalla barra') : t('Metti nella barra')}
                @click=${() => this.cambiaBarra(alternaNellaBarra(barra, f.id))}>${unsafeHTML(dentro ? ICONA_PUNTINA_PIENA : ICONA_PUNTINA)}</button>
            </div>`;
          })}`)}
      </div>
      <button class="personalizza" @click=${() => this.personalizza()}>Personalizza barra degli strumenti…</button>
    </div>`;
  }

  private pulsanteComando(id: string) {
    return html`<button class=${this.attivi.includes(id) ? 'comando attivo' : 'comando'} data-id=${id} aria-label=${tVoce(funzione(id)?.etichetta ?? id)} title=${tVoce(funzione(id)?.etichetta ?? id)} aria-pressed=${this.attivi.includes(id) ? 'true' : 'false'} @click=${(ev: Event) => this.emetti(id, ev)}><span class="icona" data-icona=${id}>${contenutoComando(id, this.valori)}</span></button>`;
  }

  private parteDestra() {
    return html`
      <button class="comando fisso" data-id="funzioni" aria-label="Funzioni" title="Funzioni: aggiungi o togli pulsanti dalla barra" aria-haspopup="dialog" aria-expanded=${this.funzioniAperto ? 'true' : 'false'}
        @click=${() => { this.funzioniAperto = !this.funzioniAperto; this.contesto = null; }}><span class="icona" data-icona="funzioni">${unsafeHTML(ICONE_DOCS['funzioni'] ?? '')}</span></button>
      <button class="nascondi-menu" data-id="nascondi-menu" aria-label=${this.menuNascosti ? t('Mostra i menu') : t('Nascondi i menu')} title=${this.menuNascosti ? t('Mostra i menu (Ctrl+Maiusc+F)') : t('Nascondi i menu (Ctrl+Maiusc+F)')}
        @click=${() => this.emetti('nascondi-menu')}>${unsafeHTML(this.menuNascosti ? ICONA_GIU : ICONA_SU)}</button>
      ${this.funzioniAperto ? this.pannelloFunzioni() : ''}
      ${this.contesto ? html`<div class="menu-contesto" role="menu" style=${styleMap({ left: `${this.contesto.x}px`, top: `${this.contesto.y}px` })}>
        ${this.contesto.id ? html`<button role="menuitem" class="togli" @click=${() => { const id = this.contesto!.id!; this.contesto = null; this.cambiaBarra(this.barraEffettiva.filter((x) => x !== id)); }}>Togli dalla barra</button>` : ''}
        <button role="menuitem" class="personalizza" @click=${() => this.personalizza()}>Personalizza barra degli strumenti…</button>
      </div>` : ''}`;
  }

  render() {
    if (this.barra !== null) return this.renderPersonalizzata(this.barra);
    const { visibili, nascoste } = vociVisibili(this.larghezza);
    return html`<div class="barra-strumenti" @contextmenu=${this.suContesto}>
      ${visibili.map((v) => html`<button class=${this.attivi.includes(v.id) ? 'comando attivo' : 'comando'} data-id=${v.id} aria-label=${tVoce(v.etichetta)} title=${tVoce(v.etichetta)} aria-pressed=${this.attivi.includes(v.id) ? 'true' : 'false'} @click=${(ev: Event) => this.emetti(v.id, ev)}><span class="icona" data-icona=${v.id}>${contenutoComando(v.id, this.valori)}</span></button>`)}
      ${nascoste.length ? html`<button class="altri" aria-label="Altri comandi" @click=${() => { this.altriAperto = !this.altriAperto; }}>⋮</button>` : ''}
      ${this.parteDestra()}
      ${this.altriAperto && nascoste.length ? html`<div class="pannello-altri" role="menu">${nascoste.map((v) => html`<button class="voce-altri" data-id=${v.id} role="menuitem" @click=${() => { this.altriAperto = false; this.emettiDaAltri(v.id); }}>${tVoce(v.etichetta)}</button>`)}</div>` : ''}
    </div>`;
  }

  private renderPersonalizzata(barra: string[]) {
    const etichetta = (id: string): string => { const f = funzione(id); return f ? (f.menu ? tVoce(f.menu.voce) : tVoce(f.etichetta)) : ''; };
    const { visibili, nascoste } = divisione(barra, this.larghezza - 230, etichetta);
    return html`<div class="barra-strumenti personalizzata" @contextmenu=${this.suContesto}>
      ${visibili.map((id) => {
        if (id === SEPARATORE) return html`<span class="separatore" role="separator"></span>`;
        const f = funzione(id);
        if (!f) return '';
        if (!f.menu) return this.pulsanteComando(id);
        return html`<button class="comando" data-id=${id} title=${nomeFunzione(f)} aria-label=${nomeFunzione(f)} @click=${(e: Event) => this.esegui(f, e.currentTarget as Element)}><span class="icona" data-icona=${id}>${unsafeHTML(iconaDi(f))}</span></button>`;
      })}
      ${nascoste.length ? html`<button class="altri" aria-label="Altri comandi" @click=${() => { this.altriAperto = !this.altriAperto; }}>⋮</button>` : ''}
      ${this.parteDestra()}
      ${this.altriAperto && nascoste.length ? html`<div class="pannello-altri" role="menu">${nascoste.map((id) => { const f = funzione(id)!; return html`<button class="voce-altri" data-id=${id} role="menuitem" @click=${() => { this.altriAperto = false; if (f.menu) this.esegui(f); else this.emettiDaAltri(id); }}>${nomeFunzione(f)}</button>`; })}</div>` : ''}
    </div>`;
  }
}
