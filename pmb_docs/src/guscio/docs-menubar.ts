import { css, unsafeCSS, nothing } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { MENU, type VoceMenu } from './menu-dati';
import { t, tVoce, scorciatoia } from '../i18n/lingua';
import { styleMap } from 'lit/directives/style-map.js';
import { MISURE, COLORI, STILI } from './misure';

/** Una voce di un sottomenu calcolato al momento (voci con `dinamico`): l'etichetta è già tradotta. */
export interface SottovoceDinamica {
  etichetta: string;
  /** la scelta attuale: si mostra con la spunta */
  attiva?: boolean;
  /** titolo di un gruppo: non si sceglie */
  intestazione?: boolean;
  /** grigia e non cliccabile (per esempio «Metti il cursore in una tabella») */
  disabilitata?: boolean;
  /** che cosa fare se la si sceglie: la riceve il guscio con l'evento «azione-menu» */
  azione?: unknown;
  /** se c'è, l'etichetta si scrive con questo carattere */
  carattere?: string;
}

@customElement('docs-menubar')
export class DocsMenubar extends LinguaElement {
  @state() private aperto: string | null = null;
  /** etichetta della voce il cui sottomenu è aperto */
  @state() private sotto: string | null = null;
  /** voci accese, da mostrare con il segno di spunta: «visualizza›Mostra righello», «formato›Colonne›2 colonne»... (le dà il guscio) */
  @property({ attribute: false }) spuntate: string[] = [];
  /** le voci dei sottomenu `dinamico`, calcolate al momento (le dà il guscio) */
  @property({ attribute: false }) sottovoci: (menu: string, voce: string) => SottovoceDinamica[] = () => [];

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) select:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button.attivo, :host-context([alto-contrasto]) button[aria-checked="true"], :host-context([alto-contrasto]) button[aria-pressed="true"] { background: #000000; color: #ffffff; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    /* i titoli in alto prendono il colore del tema (chiaro su sfondo scuro); i pannelli sono bianchi e tengono il loro testo scuro */
    :host { display: block; font-family: ${unsafeCSS(STILI.fontBase)}; color: inherit; cursor: default; user-select: none; -webkit-user-select: none; }
    .pannello, .sottopannello { color: ${unsafeCSS(COLORI.testo)}; cursor: default; user-select: none; -webkit-user-select: none; }
    :host-context(docs-guscio[tema="scuro"]) .titolo-menu[aria-expanded='true'], :host-context(docs-guscio[tema="scuro"]) .titolo-menu:hover { background: #3c4043; }
    .barra { display: flex; height: ${unsafeCSS(String(MISURE.barraMenu.altezza))}px; font-size: ${unsafeCSS(String(MISURE.barraMenu.corpo))}px; position: relative; }
    .titolo-menu { background: none; border: 0; padding: 0 8px; font: inherit; color: inherit; cursor: default; border-radius: 4px; }
    .titolo-menu[aria-expanded='true'], .titolo-menu:hover { background: var(--pmb-hover, #e8eaed); }
    /* il carattere usato qui è un po' più stretto di quello del riferimento grafico: i titoli successivi si spostano per stare alla stessa distanza */
    .titolo-menu[data-menu='visualizza'], .titolo-menu[data-menu='formato'] { margin-left: 1px; }
    .titolo-menu[data-menu='strumenti'] { margin-left: 2px; }
    /* «Segnalazione bug» si nota: sfondo azzurro chiaro e testo blu (variante scura nel tema scuro) */
    .titolo-menu[data-menu='segnalazione'] { background: var(--pmb-selezione, #e8f0fe); color: var(--pmb-accento, #0b57d0); margin-left: 4px; }
    .titolo-menu[data-menu='segnalazione']:hover { background: var(--pmb-selezione-forte, #d3e3fd); }
    :host-context(docs-guscio[tema="scuro"]) .titolo-menu[data-menu='segnalazione'] { background: #1f3760; color: #a8c7fa; }
    :host-context(docs-guscio[tema="scuro"]) .titolo-menu[data-menu='segnalazione']:hover { background: #28477a; }
    .pannello { position: absolute; top: 100%; background: ${unsafeCSS(COLORI.pannelloMenu)}; box-shadow: ${unsafeCSS(STILI.ombraPannelloMenu)}; border-radius: ${unsafeCSS(STILI.raggioPannelloMenu)}; min-width: 320px; padding: 6px 0; z-index: 10; }
    .voce { display: flex; align-items: center; height: ${unsafeCSS(String(MISURE.pannelloMenu.altezzaVoce))}px; padding: 0 16px; position: relative; }
    .voce:hover { background: var(--pmb-hover, #e8eaed); }
    .voce.disabilitata, .voce.disabilitata:hover { color: var(--pmb-testo-disabilitato, #9aa0a6); background: none; }
    .voce.disabilitata .scorciatoia, .voce.disabilitata .freccia { color: var(--pmb-testo-disabilitato, #bdc1c6); }
    .etichetta { flex: 1; }
    .scorciatoia { margin-left: 24px; color: var(--pmb-testo-2, #5f6368); }
    .freccia { margin-left: 24px; color: var(--pmb-testo-2, #5f6368); }
    .sottopannello { position: absolute; left: 100%; top: -6px; background: ${unsafeCSS(COLORI.pannelloMenu)}; box-shadow: ${unsafeCSS(STILI.ombraPannelloMenu)}; border-radius: ${unsafeCSS(STILI.raggioPannelloMenu)}; min-width: 240px; padding: 6px 0; z-index: 11; }
    .spunta { position: absolute; left: 0; width: 16px; text-align: center; color: var(--pmb-testo, #1f1f1f); font-size: 13px; }
    .figlio { position: relative; display: flex; align-items: center; height: ${unsafeCSS(String(MISURE.pannelloMenu.altezzaVoce))}px; padding: 0 16px; }
    .figlio:hover { background: var(--pmb-hover, #e8eaed); }
    .figlio.disabilitata, .figlio.disabilitata:hover { color: var(--pmb-testo-disabilitato, #9aa0a6); background: none; cursor: default; }
    .intestazione-sotto { padding: 6px 16px 2px; font-size: 12px; color: var(--pmb-testo-2, #5f6368); }
  `;

  /** true se il pannello aperto si è aperto passando il mouse sul titolo (e non con un clic): solo allora esce dal pannello lo richiude */
  private apertoConMouse = false;
  private timerChiusura = 0;

  private chiudiTutto(): void { this.aperto = null; this.sotto = null; this.apertoConMouse = false; }
  private tasto = (e: KeyboardEvent) => { if (e.key === 'Escape') this.chiudiTutto(); };
  /** Un clic fuori dalla barra e dal pannello chiude il menu. */
  private fuori = (e: Event): void => { if (this.aperto !== null && !e.composedPath().includes(this)) this.chiudiTutto(); };
  private entra = (): void => { window.clearTimeout(this.timerChiusura); };
  /** Uscendo dalla barra (e dal suo pannello) un menu aperto passando il mouse si richiude dopo un attimo: il tempo di non perderlo per un movimento storto. */
  private esce = (): void => {
    window.clearTimeout(this.timerChiusura);
    if (!this.apertoConMouse) return;
    this.timerChiusura = window.setTimeout(() => { if (this.apertoConMouse) this.chiudiTutto(); }, 250);
  };
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.tasto);
    window.addEventListener('pointerdown', this.fuori, true);
    this.addEventListener('mouseenter', this.entra);
    this.addEventListener('mouseleave', this.esce);
  }
  disconnectedCallback() {
    window.clearTimeout(this.timerChiusura);
    document.removeEventListener('keydown', this.tasto);
    window.removeEventListener('pointerdown', this.fuori, true);
    this.removeEventListener('mouseenter', this.entra);
    this.removeEventListener('mouseleave', this.esce);
    super.disconnectedCallback();
  }

  /** Passando il mouse sul titolo il menu si apre (o, se ne era aperto un altro, si passa a questo) senza bisogno del clic. */
  private suTitolo(id: string): void {
    window.clearTimeout(this.timerChiusura);
    if (MENU.find((x) => x.id === id)?.diretto) { if (this.aperto !== null) this.chiudiTutto(); return; } // un titolo «diretto» non ha pannello
    if (this.aperto === id) return;
    this.aperto = id; this.sotto = null; this.apertoConMouse = true;
  }
  /** Il clic sul titolo: se il menu si è appena aperto passandoci sopra lo lascia aperto (altrimenti il clic lo chiuderebbe subito), poi alterna. */
  private clicTitolo(id: string): void {
    const menu = MENU.find((x) => x.id === id);
    if (menu?.diretto) { this.scegli(id, menu.etichetta); return; }
    if (this.aperto === id && this.apertoConMouse) { this.apertoConMouse = false; return; }
    this.aperto = this.aperto === id ? null : id; this.sotto = null; this.apertoConMouse = false;
  }

  private scegli(menu: string, voce: string, padre?: string) {
    this.chiudiTutto();
    this.dispatchEvent(new CustomEvent('voce-menu', { detail: padre ? { menu, voce, padre } : { menu, voce }, bubbles: true, composed: true }));
  }

  /** Scelta in un sottomenu calcolato al momento: il guscio applica l'azione. */
  private scegliDinamica(menu: string, voce: string, d: SottovoceDinamica) {
    if (d.disabilitata || d.intestazione) return;
    this.chiudiTutto();
    this.dispatchEvent(new CustomEvent('azione-menu', { detail: { menu, voce, azione: d.azione }, bubbles: true, composed: true }));
  }

  /** Clic su una voce: se ha un sottomenu lo apre (o lo lascia aperto) senza scegliere niente, altrimenti sceglie la voce. */
  private suVoce(menu: string, v: VoceMenu) {
    if (v.disabilitata) return;
    if (v.figli || v.dinamico) { this.sotto = v.etichetta; return; }
    this.scegli(menu, v.etichetta);
  }

  render() {
    const m = MENU.find((x) => x.id === this.aperto);
    /* il pannello si apre sotto il proprio titolo (non sempre a sinistra), senza uscire dal bordo destro */
    const titolo = m ? this.renderRoot.querySelector<HTMLElement>(`button.titolo-menu[data-menu="${m.id}"]`) : null;
    const sinistra = titolo ? Math.max(0, Math.min(titolo.offsetLeft, window.innerWidth - this.getBoundingClientRect().left - 340)) : 0; // 340: larghezza minima del pannello più un margine
    return html`<div class="barra">
      ${MENU.map((x) => html`<button class="titolo-menu" data-menu=${x.id} aria-haspopup=${x.diretto ? 'false' : 'menu'} aria-expanded=${x.diretto ? nothing : this.aperto === x.id ? 'true' : 'false'}
        @mouseenter=${() => this.suTitolo(x.id)} @click=${() => this.clicTitolo(x.id)}>${tVoce(x.etichetta)}</button>`)}
      ${m ? html`<div class="pannello" role="menu" data-menu=${m.id} style=${styleMap({ left: `${sinistra}px` })}>
        ${m.voci.map((v) => { const haSotto = !!v.figli || !!v.dinamico; const dinamiche = v.dinamico && this.sotto === v.etichetta ? this.sottovoci(m.id, v.etichetta) : null; return html`<div class=${v.disabilitata ? 'voce disabilitata' : 'voce'} role="menuitem" aria-disabled=${v.disabilitata ? 'true' : 'false'} title=${v.disabilitata ? t(v.motivoDisabilitata ?? '') : ''} aria-haspopup=${haSotto ? 'menu' : 'false'} aria-expanded=${haSotto ? (this.sotto === v.etichetta ? 'true' : 'false') : 'false'}
          @mouseenter=${() => { this.sotto = haSotto ? v.etichetta : null; }}
          aria-checked=${this.spuntate.includes(`${m.id}›${v.etichetta}`) ? 'true' : nothing}
          @click=${() => this.suVoce(m.id, v)}>
          ${this.spuntate.includes(`${m.id}›${v.etichetta}`) ? html`<span class="spunta" aria-hidden="true">✓</span>` : ''}
          <span class="etichetta">${tVoce(v.etichetta)}</span>
          ${v.scorciatoia ? html`<span class="scorciatoia">${scorciatoia(v.scorciatoia)}</span>` : ''}
          ${haSotto ? html`<span class="freccia">►</span>` : ''}
          ${v.figli && this.sotto === v.etichetta ? html`<div class="sottopannello" role="menu" data-sotto=${v.etichetta}>
            ${v.figli.map((f) => html`<div class="figlio" role="menuitem" aria-checked=${this.spuntate.includes(`${m.id}›${v.etichetta}›${f.etichetta}`) ? 'true' : nothing} @click=${(e: Event) => { e.stopPropagation(); this.scegli(m.id, f.etichetta, v.etichetta); }}>
              ${this.spuntate.includes(`${m.id}›${v.etichetta}›${f.etichetta}`) ? html`<span class="spunta" aria-hidden="true">✓</span>` : ''}
              <span class="etichetta">${tVoce(f.etichetta)}</span>
              ${f.scorciatoia ? html`<span class="scorciatoia">${scorciatoia(f.scorciatoia)}</span>` : ''}
            </div>`)}
          </div>` : ''}
          ${dinamiche ? html`<div class="sottopannello" role="menu" data-sotto=${v.etichetta}>
            ${dinamiche.map((d) => d.intestazione
              ? html`<div class="intestazione-sotto" role="presentation">${d.etichetta}</div>`
              : html`<div class=${d.disabilitata ? 'figlio disabilitata' : 'figlio'} role="menuitem" aria-disabled=${d.disabilitata ? 'true' : 'false'} aria-checked=${d.attiva ? 'true' : nothing}
                  @click=${(e: Event) => { e.stopPropagation(); this.scegliDinamica(m.id, v.etichetta, d); }}>
                  ${d.attiva ? html`<span class="spunta" aria-hidden="true">✓</span>` : ''}
                  <span class="etichetta" style=${d.carattere ? styleMap({ fontFamily: d.carattere }) : nothing}>${d.etichetta}</span>
                </div>`)}
          </div>` : ''}
        </div>`; })}
      </div>` : ''}
    </div>`;
  }
}
