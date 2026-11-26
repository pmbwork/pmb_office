import { COLORI_INIZIALI, conStriscia } from '@comune/icone';
import { css } from "lit";
import { html } from "../i18n/html";
import { LinguaElement } from "../i18n/lingua-element";
import { customElement, property, state } from "lit/decorators.js";
import { getToolbarFogli, ToolbarGroup, ToolbarItem } from "../registry/toolbars";
import { CellStyle } from "../sheet/styles";
import { formatoPreimpostatoDelCodice } from "../sheet/formati-preimpostati";
import { icons } from "../assets/icons/index";
import "./color-picker";
import { styleMap } from "../utils/style-map";
import {
  SEPARATORE,
  funzione,
  barraPredefinita,
  ripulisciBarra,
  alternaNellaBarra,
  catalogo,
} from "../sheet/barra-personalizzata";
import { t, tEtichetta, tGruppo } from '../i18n/lingua';

@customElement("free-toolbar")
export class FreeToolbar extends LinguaElement {
  @property({ type: Object }) activeFormat: CellStyle = {};
  @property({ type: Number }) containerWidth?: number;
  /** Configurazione personalizzata della barra (elenco di id o null per predefinita) */
  @property({ attribute: false }) barra: string[] | null = null;

  @state() private pickerOpenMode: 'text' | 'fill' | 'border' | null = null;
  @state() private overflowMenuOpen = false;
  @state() private visibleGroupCount = 999;
  @state() private contesto: { x: number; y: number; id: string | null } | null = null;
  /** true se i menu in alto sono nascosti (la freccia a destra punta in giù), come in pmb_docs */
  @property({ type: Boolean }) menuNascosti = false;
  /** il pannello Funzioni (pezzo di puzzle) è aperto */
  @state() private funzioniAperto = false;
  @state() private filtroFunzioni = '';

  private resizeObserver: ResizeObserver | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          this.containerWidth = entry.contentRect.width;
        }
      }
      this.recalculateOverflow();
    });
    this.resizeObserver.observe(this);

    window.addEventListener('resize', this.handleWindowResize);
    window.addEventListener('click', this.handleWindowClick);
    window.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('click', this.handleWindowClick);
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
  }

  private handleWindowResize = () => {
    this.recalculateOverflow();
  };

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.funzioniAperto) { this.funzioniAperto = false; }
    if (e.key === 'Escape' && this.contesto) {
      this.contesto = null;
    }
  };

  private handleWindowClick = (e: MouseEvent) => {
    const path = e.composedPath();
    if (!path.includes(this)) {
      if (this.overflowMenuOpen) this.overflowMenuOpen = false;
      if (this.pickerOpenMode) this.pickerOpenMode = null;
      if (this.contesto) this.contesto = null;
      if (this.funzioniAperto && !e.composedPath().includes(this)) this.funzioniAperto = false;
    } else {
      if (this.contesto) this.contesto = null;
    }
  };

  protected firstUpdated() {
    this.recalculateOverflow();
  }

  /** Dove si apre il menu «Altri strumenti» (coordinate della finestra): sotto il suo bottone, allineato a destra, senza uscire dalla finestra. */
  @state() private posizioneAltri: { top: number; right: number } | null = null;

  protected updated() {
    if (!this.overflowMenuOpen) { if (this.posizioneAltri) this.posizioneAltri = null; return; }
    const bottone = this.renderRoot?.querySelector('#btn-toolbar-more') as HTMLElement | null;
    if (!bottone) return;
    const q = bottone.getBoundingClientRect();
    const top = q.bottom + 4;
    const right = Math.max(4, window.innerWidth - q.right);
    if (!this.posizioneAltri || this.posizioneAltri.top !== top || this.posizioneAltri.right !== right) this.posizioneAltri = { top, right };
  }

  protected willUpdate(changedProperties: Map<string, any>) {
    if (
      changedProperties.has('activeFormat') ||
      changedProperties.has('containerWidth') ||
      changedProperties.has('barra')
    ) {
      this.recalculateOverflow();
    }
  }

  /** Ricava i gruppi effettivi da mostrare: o quelli predefiniti o quelli derivati dalla barra personalizzata */
  public get gruppiEffettivi(): ToolbarGroup[] {
    if (this.barra === null) {
      return getToolbarFogli();
    }
    const pulita = ripulisciBarra(this.barra) ?? barraPredefinita();
    const gruppi: ToolbarGroup[] = [];
    let gruppoCorrente: ToolbarItem[] = [];
    let idx = 0;
    // ogni gruppo si divide in pezzi da un elemento («continua»: senza linea in mezzo). Il calcolo dello spazio (recalculateOverflow)
    // lavora a gruppi interi: una barra fatta con «Aggiungi», senza separatori, era un solo gruppo enorme che con la finestra stretta non
    // passava sotto «Altri strumenti» e usciva dalla barra coprendo il pulsante Funzioni (prova fisica del 2026-11-19).
    const chiudiGruppo = (): void => {
      gruppoCorrente.forEach((item, i) => gruppi.push({ id: `custom-group-${idx++}`, items: [item], continua: i < gruppoCorrente.length - 1 }));
      gruppoCorrente = [];
    };

    for (const id of pulita) {
      if (id === SEPARATORE) {
        chiudiGruppo();
        continue;
      }
      const item = this.trovaToolbarItem(id);
      if (item) {
        gruppoCorrente.push(item);
      }
    }
    chiudiGruppo();
    return gruppi;
  }

  private trovaToolbarItem(id: string): ToolbarItem | undefined {
    for (const g of getToolbarFogli()) {
      for (const it of g.items) {
        if (it.id === id) return it;
      }
    }
    const f = funzione(id);
    if (f && f.azione) {
      return {
        id: f.id,
        type: 'button',
        label: f.etichetta,
        tooltip: f.etichetta,
        action: f.azione,
        icon: f.icona,
      };
    }
    return undefined;
  }

  /**
   * Ricalcola in modo dinamico e strumentale quanti gruppi possono essere accolti
   * nella barra degli strumenti prima di provocare overflow orizzontale.
   */
  public recalculateOverflow() {
    const measureContainer = this.renderRoot?.querySelector('.measure-container') as HTMLElement;
    const wrapper = this.renderRoot?.querySelector('.toolbar-wrapper') as HTMLElement;
    if (!measureContainer || !wrapper) return;

    const allGroups = this.gruppiEffettivi;
    const measureGroups = Array.from(measureContainer.querySelectorAll('.measure-group')) as HTMLElement[];
    const moreBtnEl = measureContainer.querySelector('.measure-more-btn') as HTMLElement;

    if (measureGroups.length === 0) return;

    let clientWidth = this.containerWidth && this.containerWidth > 0
      ? this.containerWidth
      : (wrapper.clientWidth > 0 ? wrapper.clientWidth : (this.clientWidth > 0 ? this.clientWidth : 1200));

    const style = window.getComputedStyle ? window.getComputedStyle(wrapper) : null;
    const padLeft = style ? (parseFloat(style.paddingLeft) || 12) : 12;
    const padRight = style ? (parseFloat(style.paddingRight) || 12) : 12;
    // a destra restano sempre il pulsante Funzioni e la freccia dei menu (come in pmb_docs)
    const PARTE_DESTRA = 84;
    const innerAvailableWidth = Math.max(100, clientWidth - padLeft - padRight - PARTE_DESTRA);

    const gap = 8;
    const moreRectW = moreBtnEl ? Math.ceil(moreBtnEl.getBoundingClientRect().width) : 0;
    const moreWidth = moreRectW > 0 ? moreRectW : 36;

    const groupWidths = measureGroups.map((el) => {
      const rectW = Math.ceil(el.getBoundingClientRect().width);
      if (rectW > 0) return rectW;
      let est = 8;
      est += el.querySelectorAll('.tool-btn').length * 30;
      est += el.querySelectorAll('.tool-select').length * 80;
      return est;
    });

    const totalGroupsWidth = groupWidths.reduce((sum, w, idx) => sum + w + (idx > 0 ? gap : 0), 0);
    let newCount = allGroups.length;

    if (totalGroupsWidth <= innerAvailableWidth) {
      newCount = allGroups.length;
    } else {
      const targetWidth = innerAvailableWidth - moreWidth - gap;
      let accumulated = 0;
      let count = 0;

      for (let i = 0; i < groupWidths.length; i++) {
        const needed = groupWidths[i] + (i > 0 ? gap : 0);
        if (accumulated + needed <= targetWidth) {
          accumulated += needed;
          count++;
        } else {
          break;
        }
      }
      newCount = Math.max(1, count);
    }

    if (this.visibleGroupCount !== newCount) {
      this.visibleGroupCount = newCount;
      this.requestUpdate();
    }
  }

  public recalculate() {
    this.recalculateOverflow();
  }

  private suContesto = (e: MouseEvent): void => {
    e.preventDefault();
    const btn = (e.composedPath().find(
      (n) => n instanceof HTMLElement && ((n as HTMLElement).dataset?.itemId || (n as HTMLElement).id?.startsWith('btn-') || (n as HTMLElement).id?.startsWith('tool-select-'))
    ) as HTMLElement | undefined);

    let id: string | null = null;
    if (btn) {
      if (btn.dataset?.itemId) {
        id = btn.dataset.itemId;
      } else if (btn.id) {
        id = btn.id.replace(/^btn-/, '').replace(/^tool-select-/, '').replace(/-overflow$/, '');
      }
    }

    this.contesto = {
      x: e.clientX,
      y: e.clientY,
      id: id && id !== 'toolbar-more' ? id : null,
    };
  };

  /** Il nome di una funzione nella lingua del programma («Modifica › Incolla speciale › Solo valori»). */
  private nomeFunzione(f: { etichetta: string }): string { return tEtichetta(f.etichetta); }

  /** Esegue una funzione dal pannello Funzioni: un pulsante della barra come il suo clic, una voce di menu come se fosse scelta dal menu. */
  private eseguiFunzione(f: { id: string; azione?: string; etichetta: string }): void {
    this.funzioniAperto = false;
    const nellaBarra = this.renderRoot?.querySelector(`[data-item-id="${CSS.escape(f.id)}"]`) as HTMLElement | null;
    if (nellaBarra && !f.id.startsWith('menu:')) { nellaBarra.click(); return; }
    if (!f.azione) return;
    this.dispatchEvent(new CustomEvent(f.id.startsWith('menu:') ? 'menu-action' : 'toolbar-action', { detail: { action: f.azione, label: this.nomeFunzione(f) }, bubbles: true, composed: true }));
  }

  /** Il pannello Funzioni: tutte le funzioni, per gruppo, con la puntina per metterle o toglierle dalla barra (come in pmb_docs). */
  private pannelloFunzioni() {
    const filtro = this.filtroFunzioni.trim().toLowerCase();
    const barra = this.barra ?? barraPredefinita();
    const gruppi = new Map<string, ReturnType<typeof catalogo>>();
    for (const f of catalogo()) {
      if (filtro && !this.nomeFunzione(f).toLowerCase().includes(filtro)) continue;
      (gruppi.get(f.gruppo) ?? gruppi.set(f.gruppo, []).get(f.gruppo)!).push(f);
    }
    return html`<div class="pannello-funzioni" role="dialog" aria-label="Funzioni" @click=${(e: Event) => e.stopPropagation()}>
      <h2>Funzioni</h2>
      <input class="cerca-funzioni" type="search" placeholder="Cerca una funzione" aria-label="Cerca una funzione" .value=${this.filtroFunzioni} @input=${(e: Event) => { this.filtroFunzioni = (e.target as HTMLInputElement).value; }} />
      <div class="elenco">
        ${[...gruppi.entries()].map(([g, voci]) => html`<div class="gruppo">${tGruppo(g)}</div>
          ${voci.map((f) => {
            const dentro = barra.includes(f.id);
            const nome = this.nomeFunzione(f);
            return html`<div class="riga-funzione" data-funzione=${f.id}>
              <button class="esegui" title=${nome} @click=${() => this.eseguiFunzione(f)}><span class="icona" .innerHTML=${f.icona ?? ''}></span><span>${nome}</span></button>
              <button class="puntina" aria-pressed=${dentro ? 'true' : 'false'} aria-label=${dentro ? t('Togli {} dalla barra', nome) : t('Metti {} nella barra', nome)} title=${dentro ? t('Togli dalla barra') : t('Metti nella barra')}
                @click=${() => this.dispatchEvent(new CustomEvent('barra-cambiata', { detail: { barra: alternaNellaBarra(barra, f.id) }, bubbles: true, composed: true }))}
                .innerHTML=${dentro ? icons.pin : icons.pinOutline}></button>
            </div>`;
          })}`)}
      </div>
      <button class="personalizza" @click=${() => { this.funzioniAperto = false; this.apriPersonalizza(); }}>Personalizza barra degli strumenti…</button>
    </div>`;
  }

  private apriPersonalizza(): void {
    this.contesto = null;
    this.dispatchEvent(new CustomEvent('personalizza-barra', { bubbles: true, composed: true }));
  }

  private rimuoviDallaBarra(id: string): void {
    this.contesto = null;
    const corrente = this.barra ?? barraPredefinita();
    const nuova = corrente.filter((x) => x !== id);
    this.dispatchEvent(new CustomEvent('barra-cambiata', { detail: { barra: nuova }, bubbles: true, composed: true }));
  }

  static styles = css`
    :host {
      display: block;
      position: relative;
      background-color: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      user-select: none;
      position: relative;
    }

    .toolbar-wrapper {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: 0 var(--space-3, 12px);
      height: 42px;
      overflow: hidden;
      white-space: nowrap;
      position: relative;
    }

    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 2px;
      padding-right: var(--space-2, 8px);
      border-right: 1px solid var(--color-border-subtle, #e2e8f0);
      flex-shrink: 0;
    }

    .toolbar-group:last-child {
      border-right: none;
    }

    /* pezzo di un gruppo lungo della barra personalizzata: stessi 2 px fra i pulsanti che dentro un gruppo, niente linea */
    .toolbar-group.continua {
      border-right: none;
      padding-right: 0;
      margin-right: calc(2px - var(--space-2, 8px));
    }

    .tool-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background-color: transparent;
      color: var(--color-text);
      cursor: pointer;
      padding: 0;
      transition: background-color var(--transition-fast), border-color var(--transition-fast);
      flex-shrink: 0;
    }

    .tool-btn:hover {
      background-color: var(--color-surface-hover);
    }

    .tool-btn.active {
      background-color: var(--color-surface-selected);
      color: var(--color-accent);
    }

    .tool-btn:focus-visible {
      outline: 2px solid var(--color-focus-ring);
    }

    .tool-btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    .tool-btn.testo-menu {
      width: auto;
      max-width: 180px;
      padding: 0 8px;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      height: 26px;
    }

    select.tool-select {
      height: 28px;
      font-size: var(--font-size-sm);
      font-family: inherit;
      color: var(--color-text);
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 2px 6px;
      cursor: pointer;
      outline: none;
      transition: border-color var(--transition-fast);
      flex-shrink: 0;
    }

    select.tool-select:hover {
      border-color: var(--color-accent);
    }

    select.tool-select:focus-visible {
      border-color: var(--color-accent);
      outline: 2px solid var(--color-focus-ring);
    }

    .color-picker-container {
      position: relative;
      display: inline-block;
    }
    /* pulsanti divisi dei colori: l'icona applica il colore della striscia, la freccia apre la tavolozza */
    .color-picker-container.diviso { display: inline-flex; align-items: center; }
    .color-picker-container.diviso .tool-btn.colore { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .color-picker-container.diviso .tool-btn.freccia-colore { width: 14px; min-width: 14px; padding: 0; font-size: 10px; border-top-left-radius: 0; border-bottom-left-radius: 0; }

    .overflow-container {
      position: relative;
      margin-left: auto;
      flex-shrink: 0;
    }

    .overflow-popup {
      position: fixed;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      padding: var(--space-2);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      z-index: 1000;
      min-width: 220px;
      max-height: 360px;
      overflow-y: auto;
    }

    .overflow-group-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border-radius: var(--radius-sm);
      background-color: var(--color-surface-hover);
      flex-wrap: wrap;
    }

    .overflow-group-label {
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      font-weight: 500;
      width: 100%;
      margin-bottom: 2px;
    }

    /* Menu contestuale tasto destro */
    /* a destra: Funzioni e la freccia dei menu, separati dal resto come in pmb_docs */
    .parte-destra { margin-left: auto; display: flex; align-items: center; gap: 13px; flex-shrink: 0; }
    .parte-destra .nascondi-menu { position: relative; }
    .parte-destra .nascondi-menu::before { content: ''; position: absolute; left: -7px; top: 4px; width: 1px; height: 20px; background: var(--color-border-subtle, #c4c7c5); }
    .pannello-funzioni { position: absolute; top: calc(100% + 4px); right: 40px; width: 360px; max-height: min(560px, calc(100vh - 140px)); display: flex; flex-direction: column; gap: 6px;
      padding: 12px; background: var(--color-surface, #ffffff); color: var(--color-text); border-radius: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2); z-index: 40; font-size: 14px; cursor: default; white-space: normal; }
    .pannello-funzioni h2 { margin: 0 0 4px; font-size: 15px; font-weight: 500; }
    .pannello-funzioni input { height: 30px; padding: 0 12px; border: 1px solid #747775; border-radius: 15px; font: inherit; background: transparent; color: inherit; }
    .pannello-funzioni .elenco { overflow-y: auto; flex: 1 1 auto; }
    .pannello-funzioni .gruppo { margin: 8px 4px 2px; font-size: 12px; font-weight: 500; color: #5f6368; text-transform: uppercase; letter-spacing: .3px; }
    .riga-funzione { display: flex; align-items: center; border-radius: 6px; }
    .riga-funzione:hover { background: var(--color-surface-hover, #e8eaed); }
    .riga-funzione button { border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
    .riga-funzione button.esegui { flex: 1; height: 32px; display: flex; align-items: center; gap: 8px; padding: 0 8px; text-align: left; }
    .riga-funzione .icona { flex: none; width: 18px; height: 18px; display: inline-flex; }
    .riga-funzione button.puntina { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; color: #5f6368; }
    .riga-funzione button.puntina[aria-pressed='true'] { color: #0b57d0; }
    .pannello-funzioni button.personalizza { height: 36px; border-radius: 18px; padding: 0 16px; font-weight: 500; color: #0b57d0; border: 1px solid #747775; background: transparent; cursor: pointer; }
    .toolbar-wrapper { position: relative; }

    .menu-contesto {
      position: fixed;
      z-index: 1100;
      min-width: 220px;
      padding: 4px 0;
      background: var(--color-surface, #ffffff);
      color: var(--color-text, #202124);
      border: 1px solid var(--color-border, #dadce0);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
    }
    .menu-contesto button {
      border: 0;
      background: transparent;
      width: 100%;
      height: 30px;
      padding: 0 16px;
      text-align: left;
      font: inherit;
      font-size: 13px;
      color: inherit;
      cursor: pointer;
    }
    .menu-contesto button:hover {
      background: var(--color-hover, #f1f3f4);
    }

    /* Contenitore di misura invisibile */
    .measure-container {
      position: absolute;
      top: -9999px;
      left: -9999px;
      visibility: hidden;
      pointer-events: none;
      height: 42px;
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: 0 var(--space-3, 12px);
      box-sizing: border-box;
      white-space: nowrap;
    }

    .measure-group {
      display: flex;
      align-items: center;
      gap: 2px;
      padding-right: var(--space-2, 8px);
      border-right: 1px solid var(--color-border-subtle, #e2e8f0);
      flex-shrink: 0;
    }

    .measure-more-btn {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
  ` as any;

  private handleAction(item: ToolbarItem) {
    if (item.action === 'format-text-color') {
      this.pickerOpenMode = this.pickerOpenMode === 'text' ? null : 'text';
      return;
    }
    if (item.action === 'format-fill-color') {
      this.pickerOpenMode = this.pickerOpenMode === 'fill' ? null : 'fill';
      return;
    }
    if (item.action === 'format-border-color') {
      this.pickerOpenMode = this.pickerOpenMode === 'border' ? null : 'border';
      return;
    }

    this.pickerOpenMode = null;
    if (this.overflowMenuOpen) {
      this.overflowMenuOpen = false;
    }

    this.dispatchEvent(
      new CustomEvent("toolbar-action", {
        detail: { action: item.action, label: item.label },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleSelectChange(item: ToolbarItem, e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    if (this.overflowMenuOpen) {
      this.overflowMenuOpen = false;
    }
    this.dispatchEvent(
      new CustomEvent("toolbar-action", {
        detail: { action: item.action, value: val, label: `${t(item.label)}: ${val}` },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Il colore che applica l'icona dei pulsanti divisi (testo, riempimento, bordo): l'ultimo scelto dalla tavolozza, all'inizio quelli di Excel. */
  @state() private ultimiColori: Record<'text' | 'fill' | 'border', string> = { text: COLORI_INIZIALI.testo, fill: COLORI_INIZIALI.riempimento, border: COLORI_INIZIALI.bordo };

  /** L'icona di un pulsante diviso applica il colore della sua striscia, come in Excel e LibreOffice. */
  private applicaUltimoColore(mode: 'text' | 'fill' | 'border') {
    this.pickerOpenMode = null;
    if (this.overflowMenuOpen) this.overflowMenuOpen = false;
    const color = this.ultimiColori[mode];
    const action = mode === 'text' ? 'change-text-color' : (mode === 'fill' ? 'change-fill-color' : 'change-border-color');
    this.dispatchEvent(new CustomEvent("toolbar-action", {
      detail: { action, value: color, label: t("Colore {}: {}", t(mode === 'text' ? 'testo' : mode === 'fill' ? 'riempimento' : 'bordo'), color) },
      bubbles: true, composed: true,
    }));
  }

  private handleColorSelect(e: CustomEvent<{ color: string; mode: 'text' | 'fill' | 'border' }>) {
    const { color, mode } = e.detail;
    // un colore scelto diventa quello dell'icona (Automatico e Nessuno si applicano senza cambiarla)
    if (/^#[0-9a-fA-F]{6}$/.test(color)) this.ultimiColori = { ...this.ultimiColori, [mode]: color.toLowerCase() };
    this.pickerOpenMode = null;
    if (this.overflowMenuOpen) {
      this.overflowMenuOpen = false;
    }
    const action = mode === 'text'
      ? 'change-text-color'
      : (mode === 'fill' ? 'change-fill-color' : 'change-border-color');
    this.dispatchEvent(
      new CustomEvent("toolbar-action", {
        detail: { action, value: color, label: t("Colore {}: {}", t(mode === 'text' ? 'testo' : mode === 'fill' ? 'riempimento' : 'bordo'), color) },
        bubbles: true,
        composed: true,
      })
    );
  }

  private isItemActive(item: ToolbarItem): boolean {
    const fmt = this.activeFormat || {};
    switch (item.action) {
      case 'format-bold':
        return Boolean(fmt.bold);
      case 'format-italic':
        return Boolean(fmt.italic);
      case 'format-underline':
        return Boolean(fmt.underline);
      case 'format-strike':
        return Boolean(fmt.strike);
      case 'align-left':
        return fmt.hAlign === 'left' || (!fmt.hAlign && true);
      case 'align-center':
        return fmt.hAlign === 'center';
      case 'align-right':
        return fmt.hAlign === 'right';
      case 'align-top':
        return fmt.vAlign === 'top';
      case 'align-middle':
        return fmt.vAlign === 'middle';
      case 'align-bottom':
        return fmt.vAlign === 'bottom';
      case 'format-wrap':
        return Boolean(fmt.wrap);
      case 'format-currency':
        return fmt.numFmt === '€#,##0.00' || fmt.numFmt === '€#,##0';
      case 'format-percent':
        return Boolean(fmt.numFmt && fmt.numFmt.includes('%'));
      default:
        return Boolean(item.active);
    }
  }

  private getSelectedOptionValue(item: ToolbarItem): string {
    const fmt = this.activeFormat || {};
    if (item.action === 'change-font') {
      return fmt.fontFamily || item.defaultValue || 'Inter';
    }
    if (item.action === 'change-size') {
      return fmt.fontSize ? String(fmt.fontSize) : item.defaultValue || '10';
    }
    if (item.action === 'change-number-format') {
      if (!fmt.numFmt) return 'auto';
      if (fmt.numFmt === '@') return 'text';
      const pronto = formatoPreimpostatoDelCodice(fmt.numFmt);
      if (pronto) return pronto.id;
      if (fmt.numFmt === '0.00' || fmt.numFmt === '#,##0.00' || fmt.numFmt === '0') return 'number';
      if (fmt.numFmt === '€#,##0.00') return 'currency';
      if (fmt.numFmt === '0.00%' || fmt.numFmt === '0%' || fmt.numFmt === '0.0%') return 'percent';
      if (fmt.numFmt === '0.00E+00') return 'scientific';
      if (fmt.numFmt === 'dd/mm/yyyy hh:mm:ss') return 'datetime';
      if (fmt.numFmt === 'dd/mm/yyyy') return 'date';
      if (fmt.numFmt === 'hh:mm:ss') return 'time';
      return 'custom';
    }
    return item.defaultValue || '';
  }

  private toggleOverflowMenu() {
    this.overflowMenuOpen = !this.overflowMenuOpen;
    if (this.overflowMenuOpen) {
      this.pickerOpenMode = null;
    }
  }

  private handleOverflowKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.overflowMenuOpen = false;
    }
  };

  private renderItem(item: ToolbarItem, isInOverflow = false) {
    if (item.type === "select") {
      const curVal = this.getSelectedOptionValue(item);
      return html`
        <select
          class="tool-select"
          id="tool-select-${item.id}${isInOverflow ? '-overflow' : ''}"
          data-item-id=${item.id}
          title="${tEtichetta(item.tooltip || item.label)}"
          aria-label="${tEtichetta(item.label)}"
          @change=${(e: Event) => this.handleSelectChange(item, e)}
        >
          ${item.options?.map(
            (opt) => html`
              <option value="${opt.value}" ?selected=${opt.value === curVal}>${t(opt.label)}</option>
            `
          )}
        </select>
      `;
    }

    if (item.id === 'text-color' || item.id === 'fill-color' || item.id === 'border-color') {
      const mode = item.id === 'text-color' ? 'text' : (item.id === 'fill-color' ? 'fill' : 'border');
      const isOpen = this.pickerOpenMode === mode;
      return html`
        <div class="color-picker-container diviso">
          <button
            class="tool-btn colore"
            id="btn-${item.id}${isInOverflow ? '-overflow' : ''}"
            data-item-id=${item.id}
            title="${tEtichetta(item.tooltip || item.label)} (${this.ultimiColori[mode]})"
            aria-label="${tEtichetta(item.label)}: ${this.ultimiColori[mode]}"
            @click=${() => this.applicaUltimoColore(mode)}
            .innerHTML=${item.icon ? conStriscia(item.icon, this.ultimiColori[mode]) : tEtichetta(item.label)}
          ></button><button
            class="tool-btn freccia-colore ${isOpen ? 'active' : ''}"
            id="btn-${item.id}-scegli${isInOverflow ? '-overflow' : ''}"
            data-item-id="${item.id}-scegli"
            title="${t('Scegli: {}', tEtichetta(item.label))}"
            aria-label="${t('Scegli: {}', tEtichetta(item.label))}"
            aria-haspopup="true"
            aria-expanded="${isOpen ? 'true' : 'false'}"
            @click=${() => this.handleAction(item)}
          >▾</button>
          ${isOpen
            ? html`
                <free-color-picker
                  mode=${mode}
                  open
                  @color-select=${this.handleColorSelect}
                ></free-color-picker>
              `
            : ''}
        </div>
      `;
    }

    const isActive = this.isItemActive(item);
    const isTestoMenu = !item.icon;

    return html`
      <button
        class="tool-btn ${isActive ? 'active' : ''} ${isTestoMenu ? 'testo-menu' : ''}"
        id="btn-${item.id}${isInOverflow ? '-overflow' : ''}"
        data-item-id=${item.id}
        title="${tEtichetta(item.tooltip || item.label)}"
        aria-label="${tEtichetta(item.label)}"
        @click=${() => this.handleAction(item)}
        .innerHTML=${item.icon || tEtichetta(item.label)}
      ></button>
    `;
  }

  private renderGroup(group: ToolbarGroup, isInOverflow = false) {
    if (isInOverflow) {
      return html`
        <div class="overflow-group-row" role="group" aria-label="${group.label ? t(group.label) : group.id}">
          ${group.label ? html`<div class="overflow-group-label">${t(group.label)}</div>` : ''}
          ${group.items.map((it) => this.renderItem(it, true))}
        </div>
      `;
    }

    return html`
      <div class="toolbar-group ${group.continua ? 'continua' : ''}" role="group" aria-label="${group.label ? t(group.label) : group.id}">
        ${group.items.map((it) => this.renderItem(it, false))}
      </div>
    `;
  }

  render() {
    const allGroups: ToolbarGroup[] = this.gruppiEffettivi;
    const count = Math.min(allGroups.length, this.visibleGroupCount);
    const visibleGroups = allGroups.slice(0, count);
    const overflowGroups = allGroups.slice(count);

    return html`
      <!-- Contenitore visibile reale -->
      <div class="toolbar-wrapper" @contextmenu=${this.suContesto}>
        ${visibleGroups.map((g) => this.renderGroup(g, false))}

        ${overflowGroups.length > 0
          ? html`
              <div class="overflow-container">
                <button
                  class="tool-btn ${this.overflowMenuOpen ? 'active' : ''}"
                  id="btn-toolbar-more"
                  title="Altri strumenti"
                  aria-label="Altri strumenti"
                  aria-haspopup="true"
                  aria-expanded=${this.overflowMenuOpen ? 'true' : 'false'}
                  @click=${() => this.toggleOverflowMenu()}
                  .innerHTML=${icons.more}
                ></button>
                ${this.overflowMenuOpen
                  ? html`
                      <div
                        class="overflow-popup"
                        style=${styleMap(this.posizioneAltri ? { top: `${this.posizioneAltri.top}px`, right: `${this.posizioneAltri.right}px` } : { visibility: 'hidden' })}
                        role="menu"
                        aria-label="Altri strumenti"
                        @keydown=${this.handleOverflowKeyDown}
                      >
                        ${overflowGroups.map((g) => this.renderGroup(g, true))}
                      </div>
                    `
                  : ''}
              </div>
            `
          : ''}
        <!-- a destra: il pulsante Funzioni (pezzo di puzzle) e la freccia che nasconde i menu, come in pmb_docs -->
        <div class="parte-destra">
          <button class="tool-btn fisso" id="btn-funzioni" data-fisso="funzioni" aria-label="Funzioni" title="Funzioni: aggiungi o togli pulsanti dalla barra"
            aria-haspopup="dialog" aria-expanded=${this.funzioniAperto ? 'true' : 'false'}
            @click=${(e: Event) => { e.stopPropagation(); this.funzioniAperto = !this.funzioniAperto; this.contesto = null; }}
            .innerHTML=${icons.extension}></button>
          <button class="tool-btn nascondi-menu" id="btn-nascondi-menu" data-fisso="nascondi-menu"
            aria-label=${this.menuNascosti ? t('Mostra i menu') : t('Nascondi i menu')}
            title=${this.menuNascosti ? t('Mostra i menu (Ctrl+Maiusc+F)') : t('Nascondi i menu (Ctrl+Maiusc+F)')}
            @click=${() => this.dispatchEvent(new CustomEvent('nascondi-menu', { bubbles: true, composed: true }))}
            .innerHTML=${this.menuNascosti ? icons.expandMore : icons.expandLess}></button>
        </div>
      </div>

      ${this.funzioniAperto ? this.pannelloFunzioni() : ''}

      <!-- Menu contestuale con click destro -->
      ${this.contesto
        ? html`
            <div
              class="menu-contesto"
              role="menu"
              style=${styleMap({ left: `${this.contesto.x}px`, top: `${this.contesto.y}px` })}
            >
              ${this.contesto.id
                ? html`
                    <button
                      role="menuitem"
                      @click=${() => this.rimuoviDallaBarra(this.contesto!.id!)}
                    >
                      Togli dalla barra degli strumenti
                    </button>
                  `
                : ''}
              <button role="menuitem" @click=${() => this.apriPersonalizza()}>
                Personalizza barra degli strumenti…
              </button>
            </div>
          `
        : ''}

      <!-- Contenitore invisibile di misura per calcolo dinamico overflow -->
      <div class="measure-container" aria-hidden="true">
        ${allGroups.map((g) => html`
          <div class="measure-group" data-group-id="${g.id}">
            ${g.items.map((it) => this.renderItem(it, false))}
          </div>
        `)}
        <div class="measure-more-btn">
          <button class="tool-btn" .innerHTML=${icons.more}></button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "free-toolbar": FreeToolbar;
  }
}
