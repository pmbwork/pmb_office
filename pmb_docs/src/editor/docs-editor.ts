// Editor di pmb_docs: mostra il documento, disegna cursore e selezione, riceve tastiera, mouse e appunti.
// Il testo digitato arriva da una casella nascosta (così funzionano anche i tasti morti e gli IME); i tasti di
// comando passano da azioneDaTasto. Tutto il resto vive in azioni.ts, render.ts e nel modello.
import { css, unsafeCSS, type PropertyValues } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { disegna, domDaPosizione, paragrafiDom, posizioneDaDom } from './render';
import { disegnaMargini } from './margini';
import {
  GEOMETRIA_A4, GEOMETRIA_STAMPA, altezzaFogli, calcolaGeometria, impagina, inizioPagina,
  misuraRiga, raggruppaFrammenti, IMPOSTAZIONI_PREDEFINITE,
  type Frammento, type GeometriaPagine, type ImpostazioniPagina, type Riga,
} from './pagine';
import { nuovoEditor, statoCorrente, type StatoEditor } from './azioni';
import {
  aggiungiCommento as aggiungiCommentoA, alternaRegistrazione as alternaRegistrazioneA, commentoNelPunto, elencoCommenti, elencoRevisioni,
  eliminaCommento as eliminaCommentoA, eliminaTuttiICommenti as eliminaTuttiICommentiA, intervalloCommento, modificaTestoCommento, prossimaRevisione,
  rispondiCommento as rispondiCommentoA, risolviCommento as risolviCommentoA, risolviRevisioni as risolviRevisioniA,
  type VoceCommento, type VoceRevisione,
} from '../modello/revisioni';
import { aggiornaSommario as aggiornaSommarioA, blocchiSommario, destinazioneVoce, inserisciSommario as inserisciSommarioA, strutturaDocumento, titoloCorrente, type VoceStruttura } from '../modello/sommario';
import { azioneDaComandoFormato, azioneDaTastoFormato, eseguiAzioneFormato, type AzioneFormato } from './azioni-formato';
import { impostaTestoAlternativo as impostaTestoAlternativoA, inserisciCampoUnione as inserisciCampoUnioneA, inserisciDidascalia as inserisciDidascaliaA, inserisciRiferimento as inserisciRiferimentoA, type ModoRiferimento } from '../modello/documento';
import { alternaFatto, collassata, elencoSegnalibri, impostaSegnalibro, togliSegnalibro, type VoceSegnalibro, formatoDaCopiare, filigranaValida, immagineSelezionata as immagineSelezionataDi, incollaFormato, sostituisciImmagine, type Immagine, ordina, type FormatoCopiato, testoParagrafo, urlValido, type Posizione, type Stato, type Run, type Paragrafo } from '../modello/documento';
import { statoLink as statoLinkDi, type StatoLink } from './link';
import { controllaNativo, type ErroreNativo } from './ortografia-nativa';
import { inserisciBlocco, prossimoIdTabella } from './blocchi';
import { inIntestazione, inTabella as inTabellaStato, motivoTabella, type OperazioneTabella } from './tabelle';
import { nuovaStoria, registra } from '../modello/storia';
import { impronteNuoveWord, verificaPassword } from '@comune/protezione/impronte';

/** Le azioni che non cambiano il documento (con la sola lettura non si avvisa). */
const SOLO_LETTURA = new Set(['vai', 'muovi', 'verticale', 'selezionaTutto', 'copia', 'annulla', 'ripeti']);
import { aggiornaStile as aggiornaStileA, creaStile as creaStileA, cssStili, elencoStili, eliminaStile as eliminaStileA, rinominaStile as rinominaStileA, type VoceStile } from '../modello/stili';
import { famigliaCss } from '../guscio/caratteri';
import { maiuscolaAutomatica } from './maiuscola';
import { correggiDopoCarattere, correggiPrimaDiInvio, OPZIONI_PREDEFINITE as CORREZIONE_PREDEFINITA, type OpzioniCorrezione } from './correzione';
import {
  cerca as cercaTesto, indiceDopo, sostituisciTutte, sostituisciUna, vicina, OPZIONI_PREDEFINITE,
  type Corrispondenza, type OpzioniRicerca,
} from './ricerca';
import {
  trovaErroriOrtografici, normalizzaParola, suggerimentiOrtografici,
  type ErroreOrtografico,
} from './ortografia';

export type { ErroreOrtografico };

/** Un errore trovato dal correttore di Windows: dove è, che parola è e che cosa propone Windows (azione 0 = errata, 1 = ripetuta, 2 = sostituzione automatica). */
export interface ErroreOrtografia { p: number; da: number; a: number; parola: string; azione: 0 | 1 | 2; sostituto: string }

/** Statistiche di testo per il dialogo di conteggio parole. */
export interface StatisticheTesto {
  pagine: number;
  parole: number;
  caratteri: number;
  caratteriNoSpazi: number;
  paroleSel?: number;
  caratteriSel?: number;
  caratteriNoSpaziSel?: number;
  haSelezione: boolean;
}

/** Regole del rientro: 48 px per livello; nelle voci di elenco il punto sta 48 px prima del testo. */
function regoleRientro(): string {
  const r: string[] = [];
  for (let n = 1; n <= 8; n++) {
    r.push(`.testo p.ri-${n} { padding-left: ${n * 48}px; }`);
    r.push(`.testo p.el.ri-${n} { padding-left: ${(n + 1) * 48}px; }`);
    r.push(`.testo p.el.ri-${n}::before { left: ${n * 48}px; }`);
  }
  return r.join(' ');
}

/** Com'è la ricerca in corso: quanti risultati, quale è in evidenza (da 1, 0 se nessuno), eventuale errore. */
export interface StatoRicerca { totale: number; corrente: number; errore: string | null; troncato: boolean }

/** origine: da dove si riparte quando cambia il testo cercato (il cursore all'apertura, poi l'ultimo risultato scelto) */
interface RicercaAttiva { origine: Posizione; query: string; opz: OpzioniRicerca; corr: Corrispondenza[]; indice: number; errore: string | null; troncato: boolean }

interface Rettangolo { left: number; top: number; width: number; height: number }

/** Una riga di testo misurata nella pagina, con il punto del DOM dove comincia. */
interface RigaMisurata {
  riga: Riga;
  paragrafo: HTMLElement;
  /** prima riga del paragrafo: lo spazio si mette sopra il paragrafo */
  primaDelParagrafo: boolean;
  nodo: Text | null;
  /** se la riga misurata è una riga di tabella (si sposta tutta intera): la riga stessa */
  tr?: HTMLTableRowElement;
  /** posizione verticale (dello schermo) del primo frammento della riga dentro il nodo */
  topSchermo: number;
  /** la riga comincia all'inizio del nodo di testo */
  inizioNodo: boolean;
}

@customElement('docs-editor')
export class DocsEditor extends LinguaElement {
  static styles = css`
    :host([cursore-grande]) .cursore { width: 3px; }
    :host([riduci-animazioni]) .cursore, :host-context([riduci-animazioni]) .cursore { animation: none; }
    :host([alto-contrasto]) .foglio { border: 2px solid #000000; }
    :host([alto-contrasto]) .errore-ort { height: 3px; background: repeating-linear-gradient(135deg, #b00020 0 3px, transparent 3px 6px); }

    :host { display: block; position: relative; box-sizing: border-box; padding: var(--margine-alto, 96px) var(--margine-destro, 96px) var(--margine-basso, 96px) var(--margine-sinistro, 96px); cursor: text; color: #000000;
      font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.15; }
    .fogli { position: absolute; left: 0; top: 0; width: 100%; z-index: 0; pointer-events: none; }
    .foglio { position: absolute; left: 0; width: 100%; box-sizing: border-box; background: #ffffff; border: 1px solid #dadce0; overflow: hidden; }
    .foglio .filigrana { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-45deg); white-space: nowrap; font: 700 96px Arial, sans-serif;
      color: rgba(0, 0, 0, 0.1); pointer-events: none; user-select: none; }
    .testo { position: relative; z-index: 1; }
    .testo .salto { display: block; }
    .testo p { position: relative; margin: 0; min-height: 1.15em; white-space: pre-wrap; overflow-wrap: anywhere; }
    .testo p.bordo { padding-left: 4px; padding-right: 4px; }
    .testo p.al-ce { text-align: center; }
    .testo p.al-dx { text-align: right; }
    .testo p.al-gi { text-align: justify; }
    .testo p.ls-100 { line-height: 1; }
    .testo p.ls-150 { line-height: 1.5; }
    .testo p.ls-200 { line-height: 2; }
    .testo p.st-t { font-size: 26pt; margin-bottom: 3pt; }
    .testo p.st-s { font-size: 15pt; color: #666666; margin-bottom: 16pt; }
    .testo p.st-1 { font-size: 20pt; margin-top: 20pt; margin-bottom: 6pt; }
    .testo p.st-2 { font-size: 16pt; margin-top: 18pt; margin-bottom: 6pt; }
    .testo p.st-3 { font-size: 14pt; color: #434343; margin-top: 16pt; margin-bottom: 4pt; }
    .testo p.salto-pagina { page-break-before: always; }
    .testo p.salto-colonna { break-before: column; }
    .testo .campo-unione::before { content: "«" attr(data-campo) "»"; background: #e8f0fe; color: #174ea6; border-radius: 3px; padding: 0 2px; }
    .testo .campo-unione .cu-car { font-size: 0; }
    .testo .sequenza::before { content: attr(data-n); }
    .testo .sequenza .cu-car { font-size: 0; }
    .testo .riferimento::before { content: attr(data-x); }
    .testo .riferimento .cu-car { font-size: 0; }
    .testo .riferimento.rif-errore::before { color: #b3261e; font-weight: 700; }
    .testo p.linea-orizzontale { border-bottom: 1px solid #c7c7c7; margin-top: 6px; margin-bottom: 12px; }
    :host([mostra-non-stampabili]) .testo p::after {
      content: " ¶";
      color: #9aa0a6;
      font-size: 0.9em;
      user-select: none;
      pointer-events: none;
    }
    :host([colonne="2"]) .testo {
      column-count: 2;
      column-gap: 32px;
      column-rule: 1px solid #dadce0;
    }
    :host([colonne="3"]) .testo {
      column-count: 3;
      column-gap: 24px;
      column-rule: 1px solid #dadce0;
    }
    :host([colonne="2"]) .tabella-contenitore,
    :host([colonne="3"]) .tabella-contenitore,
    :host([colonne="2"]) .immagine-contenitore,
    :host([colonne="3"]) .immagine-contenitore {
      break-inside: avoid;
    }
    :host([senza-pagine]) { padding: 32px 48px; }
    :host([senza-pagine]) .foglio { border: none; box-shadow: none; }
    :host([senza-pagine]) .salto { display: none !important; }
    :host([senza-pagine]) .margini { display: none !important; }
    .testo p.el { padding-left: 48px; }
    .testo p.el::before { content: attr(data-m); position: absolute; left: 0; width: 36px; box-sizing: border-box; padding-right: 8px; text-align: right; }
    .testo p.el.att::before { cursor: pointer; font-size: 1.1em; line-height: 1; padding-right: 6px; }
    .testo p.el.fatto { text-decoration: line-through; color: #80868b; }
    ${unsafeCSS(regoleRientro())}
    .testo table.tabella { border-collapse: collapse; width: 100%; table-layout: fixed; }
    .testo table.tabella td { border: 1px solid #000000; padding: 5px 7px; vertical-align: top; overflow-wrap: anywhere; }
    .testo table.tabella td.coperta { display: none; }
    .testo tr.salto-riga td { border: 0; padding: 0; }
    .testo tr.salto-riga.intestazione-ripetuta td { border: 1px solid #000000; padding: 5px 7px; pointer-events: none; user-select: none; }
    .testo tr.salto-riga.intestazione-ripetuta td.coperta { display: none; }
    .testo .g { font-weight: 700; }
    .testo .c { font-style: italic; }
    .testo .s { text-decoration: underline; }
    .testo .link { color: #1155cc; text-decoration: underline; }
    .testo .x { text-decoration: line-through; }
    .testo .s.x, .testo .link.x { text-decoration: underline line-through; }
    .testo .sd { text-decoration-line: underline; text-decoration-style: double; }
    .testo .sd.x { text-decoration-line: underline line-through; }
    .testo .mc { font-variant: small-caps; }
    .testo .ap { vertical-align: super; font-size: 0.58em; }
    .testo .pe { vertical-align: sub; font-size: 0.58em; }
    /* commenti: il testo commentato è evidenziato in giallo chiaro; quello del commento scelto nel pannello un po' di più */
    .testo .cm { background-color: rgba(251, 188, 4, 0.28); border-bottom: 2px solid rgba(251, 188, 4, 0.9); }
    .testo .cm.cm-attivo { background-color: rgba(251, 188, 4, 0.55); }
    /* modifiche registrate: inserito sottolineato, cancellato barrato, nel colore dell'autore */
    .testo .rv-i { text-decoration: underline; text-decoration-thickness: 1.5px; }
    .testo .rv-d { text-decoration: line-through; text-decoration-thickness: 1.5px; }
    .testo .au-0 { color: #b3261e; } .testo .au-1 { color: #0b57d0; } .testo .au-2 { color: #146c2e; }
    .testo .au-3 { color: #8e24aa; } .testo .au-4 { color: #b06000; } .testo .au-5 { color: #00796b; }
    :host-context(docs-guscio[tema="scuro"]) .testo .au-0 { color: #f2b8b5; } :host-context(docs-guscio[tema="scuro"]) .testo .au-1 { color: #a8c7fa; }
    :host-context(docs-guscio[tema="scuro"]) .testo .au-2 { color: #6dd58c; } :host-context(docs-guscio[tema="scuro"]) .testo .au-3 { color: #e1a6f0; }
    :host-context(docs-guscio[tema="scuro"]) .testo .au-4 { color: #ffb951; } :host-context(docs-guscio[tema="scuro"]) .testo .au-5 { color: #6ff7e0; }
    @media print { .testo .cm { background-color: transparent; border-bottom: 0; } }
    .testo .immagine { display: inline-block; font-size: 0; line-height: 0; vertical-align: bottom; text-decoration: none; }
    .testo .immagine img { display: block; max-width: 100%; height: auto; }
    /* testo intorno: l'immagine galleggia a sinistra o a destra del paragrafo e il testo le scorre accanto */
    .testo .immagine.intorno-sx { float: left; margin: 2px 12px 6px 0; }
    .testo .immagine.intorno-dx { float: right; margin: 2px 0 6px 12px; }
    .margini { position: absolute; left: 0; top: 0; width: 100%; z-index: 1; pointer-events: none; }
    .errore-ort { position: absolute; height: 2px; background: repeating-linear-gradient(135deg, #d93025 0 2px, transparent 2px 4px); pointer-events: none; }
    .numeri-riga { position: absolute; left: 0; top: 0; width: 100%; z-index: 1; pointer-events: none; }
    .numeri-riga .nr { position: absolute; left: 0; width: calc(var(--margine-sinistro, 96px) - 14px); display: flex; align-items: center; justify-content: flex-end; font: 10px Roboto, Arial, sans-serif; color: #80868b; user-select: none; }
    :host([senza-pagine]) .numeri-riga .nr { width: 40px; }
    .testo p.segnalibro { box-shadow: inset 3px 0 0 #8ab4f8; }
    /* sommario: voci rientrate per livello, numero di pagina a destra (lo calcola l'impaginazione); Ctrl+clic porta al titolo */
    .testo p.sommario { position: relative; padding-right: 3em; color: var(--pmb-accento, #0b57d0); }
    .testo p.sommario.sm-l2 { padding-left: 1.5em; } .testo p.sommario.sm-l3 { padding-left: 3em; }
    .testo p.sommario[data-pg]::after { content: attr(data-pg); position: absolute; right: 0; color: var(--pmb-testo, #1f1f1f); }
    @media print { .testo p.sommario { color: inherit; } }
    .margine-pagina { position: absolute; left: var(--margine-sinistro, 96px); right: var(--margine-destro, 96px); }
    .margine-pagina .intestazione, .margine-pagina .piede { position: absolute; left: 0; right: 0; height: 48px; overflow: hidden; }
    .margine-pagina .intestazione { top: 48px; }
    .margine-pagina .piede { bottom: 48px; display: flex; flex-direction: column; justify-content: flex-end; }
    .margine-pagina p { position: relative; margin: 0; min-height: 1.15em; white-space: pre-wrap; overflow-wrap: anywhere; color: #000000; }
    .margine-pagina p.al-ce { text-align: center; }
    .margine-pagina p.al-dx { text-align: right; }
    .margine-pagina p.al-gi { text-align: justify; }
    .margine-pagina .g { font-weight: 700; }
    .margine-pagina .c { font-style: italic; }
    .margine-pagina .s { text-decoration: underline; }
    .margine-pagina .x { text-decoration: line-through; }
    .margine-pagina .s.x { text-decoration: underline line-through; }
    .margine-pagina .ap { vertical-align: super; font-size: 0.58em; }
    .margine-pagina .pe { vertical-align: sub; font-size: 0.58em; }
    @media print {
      :host { cursor: auto; }
      .fogli, .sovrapposizione, .ingresso { display: none; }
      .margini, .margini * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .testo, .testo * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .testo p.segnalibro { box-shadow: none; }
      .numeri-riga { display: none; }
    }
    .trovato { position: absolute; background: rgba(249, 171, 0, 0.35); }
    .trovato.corrente { background: rgba(255, 128, 0, 0.55); }
    .sovrapposizione { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 2; }
    .cornice-immagine { position: absolute; border: 1.5px solid #1a73e8; pointer-events: none; box-sizing: border-box; z-index: 2; }
    .maniglia-resize { position: absolute; width: 8px; height: 8px; background: #ffffff; border: 1.5px solid #1a73e8; pointer-events: auto; box-sizing: border-box; z-index: 3; }
    .maniglia-resize.nw { top: -4px; left: -4px; cursor: nwse-resize; }
    .maniglia-resize.ne { top: -4px; right: -4px; cursor: nesw-resize; }
    .maniglia-resize.se { bottom: -4px; right: -4px; cursor: nwse-resize; }
    .maniglia-resize.sw { bottom: -4px; left: -4px; cursor: nesw-resize; }
    .selezione { position: absolute; background: rgba(66, 133, 244, 0.3); }
    .cursore { position: absolute; width: 1px; background: #000000; animation: lampeggia 1s steps(1) infinite; }
    .cursore.nascosto { display: none; }
    @keyframes lampeggia { 50% { opacity: 0; } }
    .ingresso { position: absolute; left: 0; top: 0; width: 1px; height: 1px; padding: 0; border: 0; margin: 0;
      opacity: 0; resize: none; overflow: hidden; background: transparent; color: transparent; }
  `;

  @property({ attribute: false })
  impostazioniPagina: ImpostazioniPagina = { ...IMPOSTAZIONI_PREDEFINITE };

  @property({ type: Boolean, reflect: true, attribute: 'senza-pagine' })
  senzaPagine = false;

  @property({ type: Boolean, reflect: true, attribute: 'mostra-non-stampabili' })
  mostraNonStampabili = false;

  /** Numeri di riga nel margine sinistro (solo a schermo). */
  @property({ type: Boolean, reflect: true, attribute: 'numeri-riga' })
  numeriRiga = false;

  @property({ type: Number, reflect: true, attribute: 'colonne' })
  colonne = 1;

  /** Il testo su 1, 2 o 3 colonne: si salva con il documento ed è un passo di annulla. */
  impostaColonne(n: number): boolean {
    const c = Math.max(1, Math.min(3, Math.round(n)));
    return this.cambiaDocumento((d) => {
      if ((d.colonne ?? 1) === c) return d;
      const nuovo = { ...d };
      if (c === 1) delete nuovo.colonne; else nuovo.colonne = c as 2 | 3;
      return nuovo;
    }, 'colonne');
  }

  impostaMostraNonStampabili(v: boolean): void {
    this.mostraNonStampabili = v;
  }

  private ed: StatoEditor = nuovoEditor();
  private nomeAutore = '';
  /** Il nome con cui si firmano commenti e modifiche registrate (dalle preferenze). */
  set autore(v: string) { this.nomeAutore = v; this.ed = { ...this.ed, autore: v }; }
  get autore(): string { return this.nomeAutore; }
  private numeroPagine = 1;
  private geometria: GeometriaPagine = GEOMETRIA_A4;
  private stampando = false;
  private ric: RicercaAttiva | null = null;
  private trascina = false;
  private componendo = false;
  private dizionarioUtente = new Set<string>();
  // correttore ortografico di Windows: errori per paragrafo (la cache è per oggetto paragrafo, quindi un paragrafo modificato si ricontrolla da solo)
  private ortAttiva = false;
  private ortLingua = 'it-IT';
  private ortCache = new WeakMap<Paragrafo, ErroreNativo[]>();
  private ortIgnorate = new Set<string>();
  private ortErrori: ErroreOrtografia[] = [];
  private ortTimer = 0;
  private ortInCorso: Promise<void> | null = null;
  private ortRichiesto = false;
  private ortMessaggio: string | null = null;

  impostaSenzaPagine(attivo: boolean): void {
    this.senzaPagine = attivo;
    this.ridisegna();
  }

  impostaImpostazioniPagina(imp: ImpostazioniPagina): void {
    this.impostazioniPagina = { ...imp };
    this.geometria = calcolaGeometria(this.impostazioniPagina);
    this.aggiornaStileMargini();
    this.ridisegna();
  }

  private aggiornaStileMargini(): void {
    const p = this.impostazioniPagina;
    if (p.margineAlto === 96 && p.margineBasso === 96 && p.margineSinistro === 96 && p.margineDestro === 96) {
      this.removeAttribute('style');
      return;
    }
    this.style.setProperty('--margine-alto', `${p.margineAlto}px`);
    this.style.setProperty('--margine-basso', `${p.margineBasso}px`);
    this.style.setProperty('--margine-sinistro', `${p.margineSinistro}px`);
    this.style.setProperty('--margine-destro', `${p.margineDestro}px`);
  }

  willUpdate(changed: PropertyValues): void {
    if (changed.has('impostazioniPagina')) {
      this.geometria = calcolaGeometria(this.impostazioniPagina);
      this.aggiornaStileMargini();
    }
    if (changed.has('senzaPagine')) {
      this.ridisegna();
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('numeriRiga')) { const zona = this.zonaTesto(); if (zona) this.disegnaNumeriRiga(zona); }
  }

  /** Un numero per ogni riga del testo (le tabelle non si contano), nel margine sinistro; niente se la funzione è spenta. */
  private disegnaNumeriRiga(zona: HTMLElement): void {
    const strato = this.renderRoot.querySelector('.numeri-riga') as HTMLElement | null;
    if (!strato) return;
    const area = this.getBoundingClientRect();
    if (!this.numeriRiga || (area.width === 0 && area.height === 0)) { if (strato.firstChild) strato.textContent = ''; return; }
    const frammento = document.createDocumentFragment();
    this.misuraRighe(zona).filter((m) => !m.tr).forEach((m, i) => {
      const d = document.createElement('div');
      d.className = 'nr';
      d.style.top = `${m.riga.alto}px`;
      d.style.height = `${Math.max(1, m.riga.basso - m.riga.alto)}px`;
      d.textContent = String(i + 1);
      frammento.appendChild(d);
    });
    strato.textContent = '';
    strato.appendChild(frammento);
  }

  impostaNumeriRiga(v: boolean): void { this.numeriRiga = v; }

  /** Inserisce un blocco di paragrafi pronto (un componente di base) dopo il paragrafo del cursore; è un solo passo di annulla. False se il cursore è in una tabella. */
  inserisciComponente(costruisci: (idTabella: number) => Paragrafo[]): boolean {
    const st = this.stato;
    const nuovo = inserisciBlocco(st, costruisci(prossimoIdTabella(st)));
    if (nuovo === st) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'componente' };
    this.ridisegna();
    this.avvisa();
    return true;
  }

  // ---- stili personali ----
  /** Gli stili personali del documento, con quanti paragrafi li usano. */
  stili(): VoceStile[] { return elencoStili(this.stato.doc); }
  /** Lo stile personale del paragrafo del cursore, se c'è. */
  stileAlCursore(): string | undefined { const st = this.stato; return st.doc.paragrafi[ordina(st.doc, st.sel)[0].p]?.su; }
  /** Crea uno stile dal paragrafo del cursore e lo applica alla selezione: null se fatto, altrimenti il motivo (da tradurre). */
  creaStile(nome: string): string | null {
    const r = creaStileA(this.stato, nome);
    if (typeof r === 'string') return r;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, r), ultima: 'stile' };
    this.ridisegna();
    this.avvisa();
    return null;
  }
  /** Ridefinisce lo stile dal paragrafo del cursore e lo riapplica ovunque. */
  aggiornaStile(id: string): boolean {
    const st = this.stato;
    const r = aggiornaStileA(st, id);
    if (r === st) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, r), ultima: 'stile' };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** Rinomina uno stile: null se fatto, altrimenti il motivo (da tradurre). */
  rinominaStile(id: string, nome: string): string | null {
    const r = rinominaStileA(this.stato.doc, id, nome);
    if (typeof r === 'string') return r;
    this.cambiaDocumento(() => r, 'stile');
    return null;
  }
  eliminaStile(id: string): boolean { return this.cambiaDocumento((d) => eliminaStileA(d, id), 'stile'); }
  /** Il foglio con le regole degli stili personali, rifatto solo quando cambiano. */
  private foglioStili: CSSStyleSheet | null = null;
  private stiliDisegnati: Stato['doc']['stili'] | null = null;
  private aggiornaFoglioStili(): void {
    const stili = this.stato.doc.stili;
    if (stili === this.stiliDisegnati) return;
    this.stiliDisegnati = stili;
    const radice = this.renderRoot as ShadowRoot;
    if (typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in radice)) return;
    try {
      if (!this.foglioStili) {
        this.foglioStili = new CSSStyleSheet();
        radice.adoptedStyleSheets = [...radice.adoptedStyleSheets, this.foglioStili];
      }
      this.foglioStili.replaceSync(cssStili(stili, famigliaCss));
    } catch { /* senza fogli costruibili (prove automatiche) gli stili non si disegnano */ }
  }

  // ---- commenti e modifiche registrate ----
  /** Applica al documento una modifica che non tocca la selezione (un passo di annulla). False se non cambia niente. */
  private cambiaDocumento(f: (doc: Stato['doc']) => Stato['doc'], ultima: string, sel?: Stato['sel']): boolean {
    const st = this.stato;
    const doc = f(st.doc);
    if (doc === st.doc) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, { ...st, doc, ...(sel ? { sel } : {}) }), ultima };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** I commenti del documento nell'ordine del testo. */
  commenti(): VoceCommento[] { return elencoCommenti(this.stato.doc); }
  /** Il commento del testo dove sta il cursore, se c'è. */
  commentoAlCursore(): string | undefined { const st = this.stato; return commentoNelPunto(st.doc, ordina(st.doc, st.sel)[0]); }
  /** Commenta la selezione (o la parola del cursore): l'identificativo del commento, o null se non si può. */
  aggiungiCommento(testo: string): string | null {
    const r = aggiungiCommentoA(this.stato, testo, this.nomeAutore);
    if (!r) return null;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, r.stato), ultima: 'commento' };
    this.ridisegna();
    this.avvisa();
    return r.id;
  }
  rispondiCommento(id: string, testo: string): boolean { return this.cambiaDocumento((d) => rispondiCommentoA(d, id, testo, this.nomeAutore), 'commento'); }
  modificaCommento(id: string, testo: string): boolean { return this.cambiaDocumento((d) => modificaTestoCommento(d, id, testo), 'commento'); }
  risolviCommento(id: string, risolto: boolean): boolean { return this.cambiaDocumento((d) => risolviCommentoA(d, id, risolto), 'commento'); }
  eliminaCommento(id: string): boolean { return this.cambiaDocumento((d) => eliminaCommentoA(d, id), 'commento'); }
  eliminaTuttiICommenti(): boolean { return this.cambiaDocumento((d) => eliminaTuttiICommentiA(d), 'commento'); }
  /** Seleziona il testo del commento e lo porta in vista. */
  vaiACommento(id: string): void {
    const sel = intervalloCommento(this.stato.doc, id);
    if (!sel) return;
    this.ed = eseguiAzioneFormato(eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: sel.ancora, estendi: false }).ed, { tipo: 'vai', pos: sel.fuoco, estendi: true }).ed;
    this.aggiornaSovrapposizione();
    this.portaInVista({ p: sel.ancora.p, da: sel.ancora.o, a: sel.ancora.p === sel.fuoco.p ? sel.fuoco.o : sel.ancora.o + 1 });
    this.dispatchEvent(new CustomEvent('cambio', { detail: { stato: this.stato }, bubbles: true, composed: true }));
  }
  /** La registrazione delle modifiche è accesa? */
  get registraModifiche(): boolean { return this.stato.doc.revisioni === true; }
  /** Accende o spegne la registrazione delle modifiche (un passo di annulla). */
  alternaRegistrazione(): void { this.cambiaDocumento((d) => alternaRegistrazioneA(d), 'revisioni'); }
  /** Le modifiche registrate, blocco per blocco. */
  revisioni(): VoceRevisione[] { return elencoRevisioni(this.stato.doc); }
  /** Accetta o rifiuta la modifica del cursore (o quelle nella selezione); tutte = tutte quelle del documento. False se non ce n'erano. */
  risolviRevisioni(accetta: boolean, tutte: boolean): boolean {
    const st = this.stato;
    return this.cambiaDocumento((d) => risolviRevisioniA(d, accetta, tutte ? undefined : st.sel), 'revisioni');
  }
  /** Seleziona la modifica registrata dopo (o prima) del cursore. False se non ce ne sono. */
  vaiARevisione(verso: 1 | -1): boolean {
    const st = this.stato;
    const [i, f] = ordina(st.doc, st.sel);
    const sel = prossimaRevisione(st.doc, verso === 1 ? f : i, verso);
    if (!sel) return false;
    this.ed = eseguiAzioneFormato(eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: sel.ancora, estendi: false }).ed, { tipo: 'vai', pos: sel.fuoco, estendi: true }).ed;
    this.aggiornaSovrapposizione();
    this.portaInVista({ p: sel.ancora.p, da: sel.ancora.o, a: sel.fuoco.o });
    this.dispatchEvent(new CustomEvent('cambio', { detail: { stato: this.stato }, bubbles: true, composed: true }));
    return true;
  }

  /** Mette in evidenza il testo di un commento (quello scelto nel pannello o dove sta il cursore); undefined toglie l'evidenza. */
  evidenziaCommento(id: string | undefined): void {
    const zona = this.zonaTesto();
    if (!zona) return;
    zona.querySelectorAll('.cm.cm-attivo').forEach((s) => s.classList.remove('cm-attivo'));
    if (id !== undefined) zona.querySelectorAll(`.cm[data-cm="${CSS.escape(id)}"]`).forEach((s) => s.classList.add('cm-attivo'));
  }
  /** Il cursore è dentro o accanto a una parola (Inserisci › Commento senza selezione commenta quella parola)? */
  parolaAlCursore(): boolean {
    const st = this.stato;
    const c = ordina(st.doc, st.sel)[0];
    const t = testoParagrafo(st.doc.paragrafi[c.p]);
    const parola = /[\p{L}\p{N}_]/u;
    return (c.o > 0 && parola.test(t[c.o - 1])) || (c.o < t.length && parola.test(t[c.o]));
  }
  /** Seleziona il testo da a a b (per esempio una modifica scelta nel pannello) e lo porta in vista. */
  selezionaIntervallo(a: Posizione, b: Posizione): void {
    this.ed = eseguiAzioneFormato(eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: a, estendi: false }).ed, { tipo: 'vai', pos: b, estendi: true }).ed;
    this.aggiornaSovrapposizione();
    this.portaInVista({ p: a.p, da: a.o, a: a.p === b.p ? b.o : a.o + 1 });
  }

  // ---- sommario e struttura ----
  /** Inserisce il sommario dove sta il cursore. False se non ci sono titoli (Titolo 1-3) o il cursore è in una tabella o nel sommario. */
  inserisciSommario(): boolean {
    const nuovo = inserisciSommarioA(this.stato);
    if (!nuovo) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'sommario' };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** Rifà i sommari del documento con i titoli di adesso. False se non ce ne sono. */
  aggiornaSommario(): boolean {
    const st = this.stato;
    const doc = aggiornaSommarioA(st.doc);
    if (doc === st.doc) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, { ...st, doc }), ultima: 'sommario' };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** Il documento ha un sommario? */
  get haSommario(): boolean { return blocchiSommario(this.stato.doc).length > 0; }
  /** I titoli del documento (struttura). */
  struttura(): VoceStruttura[] { return strutturaDocumento(this.stato.doc); }
  /** Il titolo della sezione in cui sta il cursore. */
  titoloAlCursore(): number | null { const st = this.stato; return titoloCorrente(st.doc, ordina(st.doc, st.sel)[0].p); }
  /** Porta il cursore all'inizio del titolo e lo mostra in alto. */
  vaiATitolo(p: number): void {
    if (p < 0 || p >= this.stato.doc.paragrafi.length) return;
    this.ed = eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: { p, o: 0 }, estendi: false }).ed;
    this.aggiornaSovrapposizione();
    this.portaInVista({ p, da: 0, a: Math.min(1, testoParagrafo(this.stato.doc.paragrafi[p]).length) });
    this.focalizza();
    this.dispatchEvent(new CustomEvent('cambio', { detail: { stato: this.stato }, bubbles: true, composed: true }));
  }

  // ---- segnalibri ----
  /** I segnalibri del documento, nell'ordine in cui compaiono. */
  segnalibri(): VoceSegnalibro[] { return elencoSegnalibri(this.stato.doc); }
  /** Mette il segnalibro sul paragrafo del cursore (un passo di annulla). False se il nome non è ammesso. */
  aggiungiSegnalibro(nome: string): boolean {
    const st = this.stato;
    const doc = impostaSegnalibro(st.doc, ordina(st.doc, st.sel)[0].p, nome);
    if (doc === st.doc) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, { ...st, doc }), ultima: 'segnalibro' };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** Toglie il segnalibro con quel nome (un passo di annulla). */
  rimuoviSegnalibro(nome: string): void {
    const st = this.stato;
    const doc = togliSegnalibro(st.doc, nome);
    if (doc === st.doc) return;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, { ...st, doc }), ultima: 'segnalibro' };
    this.ridisegna();
    this.avvisa();
  }
  /** Porta il cursore all'inizio del paragrafo col segnalibro e lo mostra. */
  vaiASegnalibro(p: number): void {
    if (p < 0 || p >= this.stato.doc.paragrafi.length) return;
    this.ed = eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: { p, o: 0 }, estendi: false }).ed;
    this.aggiornaSovrapposizione();
    this.portaInVista({ p, da: 0, a: Math.min(1, testoParagrafo(this.stato.doc.paragrafi[p]).length) });
    this.avvisa();
  }

  render() {
    return html`
      <div class="fogli"></div>
      <div class="margini"></div>
      <div class="numeri-riga"></div>
      <div class="testo"></div>
      <div class="sovrapposizione"><div class="cursore"></div></div>
      <textarea class="ingresso" aria-label="Testo del documento" spellcheck="false" autocomplete="off" autocapitalize="off"
        @keydown=${this.suTasto} @input=${this.suInput}
        @compositionstart=${() => { this.componendo = true; }} @compositionend=${this.suFineComposizione}
        @copy=${this.suCopia} @cut=${this.suTaglia} @paste=${this.suIncolla}
        @focus=${() => this.mostraCursore(true)} @blur=${() => this.mostraCursore(false)}></textarea>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('mousedown', this.suMouseGiu);
    this.addEventListener('mousemove', this.suMouseMuoviHover);
    window.addEventListener('resize', this.suRidimensiona);
    window.addEventListener('scroll', this.suScorrimento, true);
  }
  disconnectedCallback() {
    window.removeEventListener('scroll', this.suScorrimento, true);
    window.cancelAnimationFrame(this.ortRaf);
    window.clearTimeout(this.ortTimer);
    this.removeEventListener('mousedown', this.suMouseGiu);
    this.removeEventListener('mousemove', this.suMouseMuoviHover);
    window.removeEventListener('resize', this.suRidimensiona);
    window.removeEventListener('mousemove', this.suMouseMuovi);
    window.removeEventListener('mouseup', this.suMouseSu);
    super.disconnectedCallback();
  }

  /** Scorrendo il documento le sottolineature degli errori si ridisegnano per la parte che compare (se sono tanti). */
  private ortRaf = 0;
  private suScorrimento = (): void => {
    if (!this.ortAttiva || this.ortErrori.length <= 40 || this.ortRaf) return;
    this.ortRaf = window.requestAnimationFrame(() => { this.ortRaf = 0; this.aggiornaSovrapposizione(); });
  };

  private suMouseMuoviHover = (e: MouseEvent): void => {
    const td = e.composedPath().find((n) => n instanceof HTMLTableCellElement) as HTMLTableCellElement | undefined;
    if (td) {
      const rect = td.getBoundingClientRect();
      if (rect.width > 0 && Math.abs(e.clientX - rect.right) <= 6) {
        td.style.cursor = 'col-resize';
        return;
      } else {
        td.style.cursor = '';
      }
    }
  };
  protected firstUpdated() { this.ridisegna(); void document.fonts?.ready?.then(() => this.ridisegna()).catch(() => {}); }

  get stato(): Stato { return statoCorrente(this.ed); }
  /** quanti fogli A4 occupa il documento */
  get pagine(): number { return this.numeroPagine; }
  /** true tra preparaStampa e finisciStampa */
  get inStampa(): boolean { return this.stampando; }
  /** Per la stampa: i fogli si dispongono uno dopo l'altro come sulla carta (senza lo spazio tra un foglio e l'altro) e il testo si impagina di nuovo. */
  preparaStampa(): void {
    if (this.stampando) return;
    this.stampando = true;
    this.geometria = GEOMETRIA_STAMPA;
    this.ridisegna();
  }
  /** Dopo la stampa: si torna ai fogli dello schermo. */
  finisciStampa(): void {
    if (!this.stampando) return;
    this.stampando = false;
    this.geometria = calcolaGeometria(this.impostazioniPagina);
    this.ridisegna();
  }
  /** Sostituisce il documento (per esempio quando se ne apre uno) e azzera annulla e ripeti. */
  impostaStato(stato: Stato): void { this.ed = { ...nuovoEditor(stato), autore: this.nomeAutore }; this.ridisegna(); this.ricostruisciErroriOrtografia(); this.avvisa(); }
  /** Lo stato completo dell'editor (documento, cursore e storia di annulla): serve per passare da una scheda all'altra. */
  get statoEditor(): StatoEditor { return this.ed; }
  impostaStatoEditor(s: StatoEditor): void { this.ed = s; this.ridisegna(); this.ricostruisciErroriOrtografia(); this.avvisa(); }
  focalizza(): void { this.casella()?.focus({ preventScroll: true }); }
  /** Esegue il comando di un pulsante della barra strumenti. Restituisce false se il pulsante non è ancora collegato. */
  eseguiComando(id: string): boolean {
    const a = azioneDaComandoFormato(id);
    if (!a) return false;
    this.applica(a);
    this.focalizza();
    return true;
  }

  /** true se la selezione è esattamente un'immagine. */
  immagineSelezionata(): boolean { return immagineSelezionataDi(this.stato.doc, this.stato.sel) !== null; }
  /** true se il cursore è dentro una tabella. */
  inTabella(): boolean { return inTabellaStato(this.stato); }
  /** true se il cursore è in una riga di intestazione di una tabella. */
  inRigaIntestazione(): boolean { return inIntestazione(this.stato); }
  /** Perché l'operazione sulla tabella non si può fare qui (testo da tradurre), o null se si può. */
  motivoTabella(op: OperazioneTabella): string | null { return motivoTabella(this.stato, op); }
  /** Cosa c'è sotto il cursore o la selezione, per il dialogo del link. */
  linkAttuale(): StatoLink { return statoLinkDi(this.stato); }

  /** L'immagine selezionata, o null. */
  immagineCorrente(): Immagine | null { return immagineSelezionataDi(this.stato.doc, this.stato.sel)?.im ?? null; }
  /** Mette al cursore un riferimento incrociato al paragrafo `p` (Inserisci › Riferimento incrociato): un passo di annulla. */
  inserisciRiferimento(p: number, modo: ModoRiferimento): boolean {
    const st = this.stato;
    const nuovo = inserisciRiferimentoA(st, p, modo);
    if (nuovo === st) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'riferimento' };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** Inserisce una didascalia numerata sotto (o sopra) il paragrafo del cursore: un passo di annulla. */
  inserisciDidascalia(serie: string, testo: string, sopra: boolean): boolean {
    const st = this.stato;
    const nuovo = inserisciDidascaliaA(st, serie, testo, sopra);
    if (nuovo === st) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'didascalia' };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** Mette al cursore un campo di unione «nome» (Strumenti › Stampa unione): un passo di annulla. */
  inserisciCampoUnione(nome: string): boolean {
    const st = this.stato;
    const nuovo = inserisciCampoUnioneA(st, nome);
    if (nuovo === st) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'campo' };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** Il documento così com'è (per i controlli che non lo cambiano, come quello dell'accessibilità). */
  documentoCorrente(): Stato['doc'] { return this.stato.doc; }
  /** Porta il cursore in un punto del testo (con estendi seleziona fino a lì + 1, per un'immagine). */
  vaiA(p: number, o: number, seleziona = false): void {
    this.applicaAzione({ tipo: 'vai', pos: { p, o }, estendi: false });
    if (seleziona) this.applicaAzione({ tipo: 'vai', pos: { p, o: o + 1 }, estendi: true });
    this.focalizza();
  }
  /** Il testo alternativo dell'immagine selezionata: un passo di annulla. */
  impostaTestoAlternativo(testo: string): boolean {
    const st = this.stato;
    const nuovo = impostaTestoAlternativoA(st, testo);
    if (nuovo === st) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'immagine' };
    this.ridisegna();
    this.avvisa();
    return true;
  }
  /** Mette al posto dell'immagine selezionata quella data (ruotata, capovolta, ritagliata): un passo di annulla. */
  sostituisciImmagineSelezionata(im: Immagine): boolean {
    const st = this.stato;
    const nuovo = sostituisciImmagine(st, im);
    if (nuovo === st) return false;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'immagine' };
    this.ridisegna();
    this.avvisa();
    return true;
  }

  /** Ridimensiona l'immagine selezionata alla nuova larghezza (pixel, da 20 a 2000). */
  ridimensionaImmagineSelezionata(larghezza: number): boolean {
    if (!this.immagineSelezionata()) return false;
    this.applicaAzione({ tipo: 'larghezzaImmagine', larghezza });
    return true;
  }

  /** Ridimensiona una colonna di una tabella memorizzando la larghezza in pixel. */
  ridimensionaColonna(tabellaIndice: number, colonnaIndice: number, nuovaLarghezza: number): boolean {
    const largh = Math.max(20, Math.min(2000, Math.round(nuovaLarghezza)));
    let modificato = false;
    const nuoviParagrafi = this.stato.doc.paragrafi.map((p) => {
      if (p.tb && p.tb.i === tabellaIndice && p.tb.c === colonnaIndice) {
        modificato = true;
        return { ...p, tb: { ...p.tb, w: largh } };
      }
      return p;
    });
    if (!modificato) return false;
    this.impostaStato({
      doc: { ...this.stato.doc, paragrafi: nuoviParagrafi },
      sel: this.stato.sel,
      pendenti: null,
    });
    this.ridisegna();
    this.avvisa();
    return true;
  }

  // ---- maiuscola automatica a inizio frase ----
  private maiuscolaAuto = true;
  get maiuscolaAutomaticaAttiva(): boolean { return this.maiuscolaAuto; }
  /** Accende o spegne la maiuscola automatica a inizio frase (Preferenze › Correzione automatica). */
  impostaMaiuscolaAutomatica(attiva: boolean): void { this.maiuscolaAuto = attiva; }
  // ---- correzione automatica (sostituzioni, virgolette, trattini, DUe MAiuscole, bLOC MAIUSC, elenchi) ----
  private correzione: OpzioniCorrezione = CORREZIONE_PREDEFINITA;
  /** Bloc Maiusc acceso all'ultimo tasto premuto */
  private blocAcceso = false;
  get opzioniCorrezione(): OpzioniCorrezione { return this.correzione; }
  impostaCorrezione(opz: OpzioniCorrezione): void { this.correzione = opz; }
  /** Registra una correzione automatica come passo a sé della storia (Ctrl+Z subito dopo la annulla e basta). */
  private registraCorrezione(ed: StatoEditor, corretto: Stato | null): StatoEditor {
    return corretto ? { ...ed, storia: registra(ed.storia, corretto), ultima: 'correzione' } : ed;
  }

  // ---- correttore ortografico (Windows) ----
  get ortografiaAttiva(): boolean { return this.ortAttiva; }
  get ortografiaLingua(): string { return this.ortLingua; }
  /** Perché il correttore non funziona (lingua mancante, browser...), o null se va. */
  get ortografiaMessaggio(): string | null { return this.ortMessaggio; }
  /** Gli errori trovati nell'ultimo controllo, senza le parole ignorate o del dizionario personale. */
  get erroriOrtografici(): ErroreOrtografia[] { return this.ortErrori; }

  /** Accende o spegne la sottolineatura degli errori; con `lingua` cambia la lingua del controllo (per esempio it-IT). */
  impostaOrtografia(attiva: boolean, lingua?: string): void {
    if (lingua !== undefined && lingua !== this.ortLingua) { this.ortLingua = lingua; this.ortCache = new WeakMap(); this.ortErrori = []; this.ortMessaggio = null; }
    this.ortAttiva = attiva;
    if (attiva) this.programmaOrtografia(0);
    else { window.clearTimeout(this.ortTimer); this.ortErrori = []; this.aggiornaSovrapposizione(); }
  }

  /** Il rettangolo (sullo schermo) dell'area in cui scorre il documento, per sapere che cosa si vede. */
  private areaScorrimento(): { top: number; bottom: number } {
    let n: Node | null = this;
    while (n) {
      if (n instanceof HTMLElement) {
        const stile = getComputedStyle(n);
        if (/(auto|scroll)/.test(stile.overflowY) && n.scrollHeight > n.clientHeight) { const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }
      }
      n = n.parentNode ?? (n as ShadowRoot).host ?? null;
    }
    return { top: 0, bottom: window.innerHeight || 1000 };
  }

  /** Gli errori che stanno nei paragrafi visibili (più un po' sopra e sotto): sottolineare migliaia di errori a ogni tasto renderebbe lenta la scrittura. */
  private erroriVisibili(): ErroreOrtografia[] {
    if (this.ortErrori.length === 0) return [];
    if (this.ortErrori.length <= 40) return this.ortErrori;
    const par = paragrafiDom(this.zonaTesto());
    if (par.length === 0) return [];
    const { top, bottom } = this.areaScorrimento();
    const margine = 400;
    // ricerca binaria: primo paragrafo che finisce sotto il bordo alto e primo che comincia sotto il bordo basso
    const primo = (cond: (r: DOMRect) => boolean): number => { let a = 0; let b = par.length; while (a < b) { const m = (a + b) >> 1; if (cond(par[m].getBoundingClientRect())) b = m; else a = m + 1; } return a; };
    const da = primo((r) => r.bottom >= top - margine);
    const a = primo((r) => r.top > bottom + margine);
    const dap = Number(par[Math.min(da, par.length - 1)].getAttribute('data-p'));
    const ap = Number(par[Math.max(0, Math.min(a, par.length) - 1)].getAttribute('data-p'));
    return this.ortErrori.filter((e) => e.p >= dap && e.p <= ap);
  }

  private programmaOrtografia(ritardo = 700): void {
    if (!this.ortAttiva) return;
    window.clearTimeout(this.ortTimer);
    this.ortTimer = window.setTimeout(() => { void this.controllaOrtografiaOra(); }, ritardo);
  }

  /** Controlla i paragrafi nuovi o cambiati (gli altri sono in cache) e aggiorna l'elenco degli errori. Aspetta un controllo già in corso. */
  controllaOrtografiaOra(): Promise<void> {
    // se mentre si controlla arriva un'altra richiesta (si è scritto ancora), finito il giro se ne fa un altro: mai risultati su un testo vecchio
    this.ortRichiesto = true;
    if (!this.ortInCorso) {
      this.ortInCorso = (async () => {
        try { while (this.ortRichiesto) { this.ortRichiesto = false; await this.eseguiControlloOrtografia(); } } finally { this.ortInCorso = null; }
      })();
    }
    return this.ortInCorso;
  }

  private async eseguiControlloOrtografia(): Promise<void> {
    const daFare: Paragrafo[] = [];
    const visti = new Set<Paragrafo>();
    for (const par of this.stato.doc.paragrafi) {
      if (!this.ortCache.has(par) && !visti.has(par)) { visti.add(par); daFare.push(par); }
    }
    const cache = this.ortCache; const lingua = this.ortLingua;
    for (let i = 0; i < daFare.length; i += 200) {
      const lotto = daFare.slice(i, i + 200);
      const r = await controllaNativo(lotto.map((p) => testoParagrafo(p)), lingua);
      // la lingua è cambiata mentre si controllava: questi risultati sono nella lingua vecchia, si rifà il giro
      if (cache !== this.ortCache) { this.ortRichiesto = true; return; }
      if (r.errori === null) { this.ortMessaggio = r.messaggio; this.ortErrori = []; this.aggiornaSovrapposizione(); this.avvisaOrtografia(); return; }
      lotto.forEach((p, k) => cache.set(p, r.errori![k]));
    }
    this.ortMessaggio = null;
    this.ricostruisciErroriOrtografia();
    this.aggiornaSovrapposizione();
    this.avvisaOrtografia();
  }

  private ricostruisciErroriOrtografia(): void {
    const out: ErroreOrtografia[] = [];
    this.stato.doc.paragrafi.forEach((par, p) => {
      const errori = this.ortCache.get(par);
      if (!errori || errori.length === 0) return;
      const testo = testoParagrafo(par);
      for (const e of errori) {
        const parola = testo.slice(e.da, e.a);
        const chiave = normalizzaParola(parola);
        if (e.azione === 0 && (this.dizionarioUtente.has(chiave) || this.ortIgnorate.has(chiave))) continue;
        out.push({ p, da: e.da, a: e.a, parola, azione: e.azione, sostituto: e.sostituto });
      }
    });
    this.ortErrori = out;
  }

  private avvisaOrtografia(): void {
    this.dispatchEvent(new CustomEvent('ortografia', { detail: { errori: this.ortErrori.length, messaggio: this.ortMessaggio }, bubbles: true, composed: true }));
  }

  /** Seleziona nel testo la parola dell'errore e la porta in vista. */
  selezionaErroreOrtografia(e: ErroreOrtografia): void {
    this.ed = eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: { p: e.p, o: e.da }, estendi: false }).ed;
    this.ed = eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: { p: e.p, o: e.a }, estendi: true }).ed;
    this.aggiornaSovrapposizione();
    this.portaInVista({ p: e.p, da: e.da, a: Math.max(e.a, e.da + 1) });
    this.avvisa();
  }

  private corrispondenzaErrore(e: ErroreOrtografia): Corrispondenza { return { p: e.p, da: e.da, a: e.a, trovato: e.parola, gruppi: [] }; }

  /** Cambia la parola sbagliata con `testo` (un passo di annulla). */
  sostituisciErroreOrtografia(e: ErroreOrtografia, testo: string): boolean {
    // il testo deve essere ancora quello trovato dal controllo: se nel frattempo è cambiato (doppio clic, scheda diversa) non si tocca niente
    const par = this.stato.doc.paragrafi[e.p];
    if (!par || testoParagrafo(par).slice(e.da, e.a) !== e.parola) return false;
    const nuovo = sostituisciUna(this.stato, this.corrispondenzaErrore(e), testo, OPZIONI_PREDEFINITE);
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'sostituisci' };
    this.ridisegna();
    this.avvisa();
    return true;
  }

  /** Cambia tutte le occorrenze di quella parola sbagliata (un solo passo di annulla); restituisce quante sono. */
  sostituisciTutteOrtografia(parola: string, testo: string): number {
    const chiave = normalizzaParola(parola);
    const tutte = this.ortErrori
      .filter((x) => normalizzaParola(x.parola) === chiave && testoParagrafo(this.stato.doc.paragrafi[x.p] ?? { runs: [] }).slice(x.da, x.a) === x.parola)
      .map((x) => this.corrispondenzaErrore(x));
    if (tutte.length === 0) return 0;
    const r = sostituisciTutte(this.stato, tutte, testo, OPZIONI_PREDEFINITE);
    this.ed = { ...this.ed, storia: registra(this.ed.storia, r.stato), ultima: 'sostituisci' };
    this.ridisegna();
    this.avvisa();
    return r.conteggio;
  }

  /** Smette di segnalare quella parola per questa sessione. */
  ignoraParolaOrtografia(parola: string): void {
    this.ortIgnorate.add(normalizzaParola(parola));
    this.ricostruisciErroriOrtografia();
    this.aggiornaSovrapposizione();
    this.avvisaOrtografia();
  }

  /** Mette il contenuto del dizionario personale (caricato dalle preferenze). */
  impostaDizionario(parole: string[]): void {
    this.dizionarioUtente = new Set(parole.map((p) => normalizzaParola(p)).filter((p) => p !== ''));
    this.ricostruisciErroriOrtografia();
    this.aggiornaSovrapposizione();
  }
  rimuoviDalDizionario(parola: string): void {
    this.dizionarioUtente.delete(normalizzaParola(parola));
    this.ricostruisciErroriOrtografia();
    this.aggiornaSovrapposizione();
    this.avvisaOrtografia();
    this.avvisaDizionario();
  }
  private avvisaDizionario(): void {
    this.dispatchEvent(new CustomEvent('dizionario', { detail: { parole: this.dizionarioUtenteElenco() }, bubbles: true, composed: true }));
  }

  /** Esegue il controllo ortografico dell'intero documento e restituisce gli errori con suggerimenti. */
  controllaOrtografia(): ErroreOrtografico[] {
    return trovaErroriOrtografici(this.stato.doc, this.dizionarioUtente);
  }

  /** Aggiunge una parola al dizionario personale dell'utente. */
  aggiungiAlDizionario(parola: string): void {
    const p = normalizzaParola(parola);
    if (p) this.dizionarioUtente.add(p);
    this.ricostruisciErroriOrtografia();
    this.aggiornaSovrapposizione();
    this.avvisaOrtografia();
    this.avvisaDizionario();
  }

  /** Restituisce l'elenco delle parole nel dizionario personale dell'utente. */
  dizionarioUtenteElenco(): string[] {
    return Array.from(this.dizionarioUtente).sort();
  }

  /** Restituisce i suggerimenti ortografici per una parola errata. */
  suggerimentiPer(parola: string, limite = 4): string[] {
    return suggerimentiOrtografici(parola, limite, this.dizionarioUtente);
  }

  private casella(): HTMLTextAreaElement | null { return this.renderRoot.querySelector('textarea.ingresso'); }
  private zonaTesto(): HTMLElement { return this.renderRoot.querySelector('.testo') as HTMLElement; }

  private avvisa(): void {
    this.dispatchEvent(new CustomEvent('cambio', { detail: { stato: this.stato }, bubbles: true, composed: true }));
  }

  /** Esegue un'azione scelta da un menu della barra (carattere, corpo, colori, allineamento, ...). */
  applicaAzione(azione: AzioneFormato): void {
    this.applica(azione);
    this.focalizza();
  }

  /** Annulla l'ultima modifica. */
  annulla(): void { this.applicaAzione({ tipo: 'annulla' }); }

  /** Ripete l'ultima modifica annullata. */
  ripeti(): void { this.applicaAzione({ tipo: 'ripeti' }); }

  /** Seleziona tutto il documento. */
  selezionaTutto(): void { this.applicaAzione({ tipo: 'selezionaTutto' }); }

  /** Cancella la selezione oppure il carattere successivo/precedente. */
  elimina(): void {
    if (this.stato.sel.ancora.p !== this.stato.sel.fuoco.p || this.stato.sel.ancora.o !== this.stato.sel.fuoco.o) {
      this.applicaAzione({ tipo: 'cancella', direzione: 'avanti', parola: false });
    } else {
      this.applicaAzione({ tipo: 'cancella', direzione: 'avanti', parola: false });
    }
  }

  /** Cancella la formattazione al cursore o sulla selezione. */
  cancellaFormattazione(): void { this.applicaAzione({ tipo: 'pulisci' }); }

  /** Inserisce un salto di pagina al cursore. */
  inserisciSaltoPagina(): void { this.applicaAzione({ tipo: 'saltoPagina' }); }
  /** Inserisce un'interruzione di colonna al cursore. */
  inserisciSaltoColonna(): void { this.applicaAzione({ tipo: 'saltoColonna' }); }
  /** Inserisce un carattere al cursore (spazio e trattino non divisibili, trattino facoltativo). */
  inserisciCarattere(c: string): void { this.applicaAzione({ tipo: 'incolla', testo: c }); }

  /** Inserisce una linea orizzontale al cursore. */
  inserisciLineaOrizzontale(): void { this.applicaAzione({ tipo: 'lineaOrizzontale' }); }

  /** Inserisce una nota a piè di pagina: marcatore apice al cursore e paragrafo della nota in fondo. */
  inserisciNota(testo: string): number {
    const doc = this.stato.doc;
    let maxNumero = 0;
    for (const p of doc.paragrafi) {
      for (const r of p.runs) {
        if (r.v === 'p' && /^\d+$/.test(r.t)) {
          const num = parseInt(r.t, 10);
          if (num > maxNumero) maxNumero = num;
        }
      }
    }
    const prossimo = maxNumero + 1;
    this.applicaAzione({ tipo: 'alterna', chiave: 'v', valore: 'p' });
    this.applicaAzione({ tipo: 'testo', testo: `${prossimo}` });
    this.applicaAzione({ tipo: 'alterna', chiave: 'v', valore: 'p' });
    const testoNota = testo.trim() !== '' ? testo.trim() : 'Testo della nota';
    const runsNota: Run[] = [
      { t: `${prossimo}. `, g: true, c: false, s: false, z: 9 },
      { t: testoNota, g: false, c: false, s: false, z: 9 },
    ];
    const nuovoParagrafo: Paragrafo = {
      runs: runsNota,
      hr: prossimo === 1,
    };
    const nuoviParagrafi = [...this.stato.doc.paragrafi, nuovoParagrafo];
    this.impostaStato({
      doc: { ...this.stato.doc, paragrafi: nuoviParagrafi },
      sel: this.stato.sel,
      pendenti: null,
    });
    return prossimo;
  }

  /** Ultimo testo copiato o tagliato qui dentro: serve a Incolla quando il sistema non lascia leggere gli appunti. */
  private appunti = '';

  private async scriviAppunti(testo: string): Promise<void> {
    this.appunti = testo;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) await navigator.clipboard.writeText(testo);
    } catch {
      // senza permesso resta la copia interna
    }
  }

  /** Copia negli appunti la selezione (anche su più paragrafi). */
  async copia(): Promise<void> {
    const r = eseguiAzioneFormato(this.ed, { tipo: 'copia' });
    if (r.copiato === null || r.copiato === '') return;
    await this.scriviAppunti(r.copiato);
  }

  /** Taglia la selezione copiandola negli appunti e rimuovendola dal documento. */
  async taglia(): Promise<void> {
    const r = eseguiAzioneFormato(this.ed, { tipo: 'taglia' });
    if (r.copiato === null || r.copiato === '') return;
    this.ed = r.ed;
    this.ridisegna();
    this.avvisa();
    await this.scriviAppunti(r.copiato);
  }

  /** Incolla del testo dagli appunti di sistema (o, se non si possono leggere, da quelli interni) o il testo fornito. */
  async incolla(testoOpzionale?: string): Promise<void> {
    let testo = testoOpzionale;
    if (testo === undefined && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        // WebView2 può lasciare la richiesta in attesa del permesso senza mai rispondere: dopo mezzo secondo si usa la copia interna
        testo = await Promise.race([
          navigator.clipboard.readText(),
          new Promise<undefined>((risolvi) => setTimeout(() => risolvi(undefined), 500)),
        ]);
      } catch {
        testo = undefined;
      }
    }
    if (testo === undefined || testo === '') testo = this.appunti;
    if (testo) {
      this.applicaAzione({ tipo: 'incolla', testo });
    }
  }

  private applica(azione: AzioneFormato): void {
    let a = azione;
    if (a.tipo === 'verticale') {
      const pos = this.posizioneVerticale(a.direzione);
      if (!pos) return;
      a = { tipo: 'vai', pos, estendi: a.estendi };
    }
    const prima = this.ed;
    this.ed = eseguiAzioneFormato(this.ed, a).ed;
    // documento in sola lettura: la modifica non è entrata (modello/storia.ts); lo si dice
    if (this.stato.doc.protezione && this.ed.storia === prima.storia && !SOLO_LETTURA.has(a.tipo)) {
      this.dispatchEvent(new CustomEvent('documento-protetto', { bubbles: true, composed: true }));
    }
    this.ridisegna();
    this.avvisa();
  }

  /** Il testo da leggere ad alta voce: la selezione, o dal paragrafo del cursore alla fine; un pezzo per paragrafo. */
  testoDaLeggere(): string[] {
    const st = this.stato;
    const [i, f] = ordina(st.doc, st.sel);
    const fine = collassata(st.sel) ? st.doc.paragrafi.length - 1 : f.p;
    const out: string[] = [];
    for (let p = i.p; p <= fine; p++) {
      const t = testoParagrafo(st.doc.paragrafi[p]).replace(/\uFFFC/g, ' ');
      const da = p === i.p ? (collassata(st.sel) ? 0 : i.o) : 0;
      const a = !collassata(st.sel) && p === f.p ? f.o : t.length;
      out.push(t.slice(da, a));
    }
    return out;
  }

  /** Il testo della filigrana del documento ('' = nessuna). */
  filigrana(): string { return this.stato.doc.filigrana ?? ''; }
  /** Mette, cambia o toglie ('') la filigrana: un passo di annulla. */
  impostaFiligrana(testo: string): boolean {
    const f = filigranaValida(testo);
    if (f === undefined) return false;
    return this.cambiaDocumento((d) => {
      if ((d.filigrana ?? '') === f) return d;
      const n = { ...d };
      if (f === '') delete n.filigrana; else n.filigrana = f;
      return n;
    }, 'filigrana');
  }

  // ---- protezione del documento (sola lettura, come «Limita modifica» di Word) ----
  /** true se il documento è in sola lettura. */
  protetto(): boolean { return !!this.stato.doc.protezione; }
  /** true se la protezione ha una password. */
  protettoConPassword(): boolean { return !!this.stato.doc.protezione?.impronte; }
  /** Mette il documento in sola lettura (password vuota: senza password). Non è un passo di annulla: la cronologia ricomincia. */
  proteggi(password: string): void {
    const st = this.stato;
    const doc = { ...st.doc, protezione: password === '' ? {} : { impronte: impronteNuoveWord(password) } };
    this.ed = { ...this.ed, storia: nuovaStoria({ ...st, doc, pendenti: null }), ultima: 'protezione' };
    this.ridisegna();
    this.avvisa();
  }
  /** Toglie la sola lettura: false se la password non è quella giusta. */
  async togliProtezione(password: string): Promise<boolean> {
    const st = this.stato;
    if (!st.doc.protezione) return true;
    if (!(await verificaPassword(password, st.doc.protezione.impronte))) return false;
    const { protezione, ...doc } = st.doc; void protezione;
    this.ed = { ...this.ed, storia: nuovaStoria({ ...st, doc, pendenti: null }), ultima: 'protezione' };
    this.ridisegna();
    this.avvisa();
    return true;
  }

  private ridisegna(): void {
    // le colonne vengono dal documento (anche dopo Apri, Annulla e Ripeti)
    this.colonne = this.stato.doc.colonne ?? 1;
    const zona = this.zonaTesto();
    if (!zona) return;
    this.aggiornaFoglioStili();
    disegna(zona, this.stato.doc);
    this.impaginaTesto(zona);
    this.disegnaNumeriRiga(zona);
    this.aggiornaRicerca();
    this.aggiornaSovrapposizione();
    this.programmaOrtografia();
  }

  // ---- trova e sostituci ----
  /** Testo selezionato se sta tutto in un paragrafo e non è lunghissimo, altrimenti "" (serve a precompilare la ricerca). */
  testoSelezionato(): string {
    const st = this.stato;
    const [i, f] = ordina(st.doc, st.sel);
    if (i.p !== f.p || f.o - i.o > 200) return '';
    return testoParagrafo(st.doc.paragrafi[i.p]).slice(i.o, f.o);
  }

  /** Calcola le statistiche di testo e pagine per il dialogo di conteggio parole. */
  statisticheTesto(): StatisticheTesto {
    const testi = this.stato.doc.paragrafi.map((p) => p.runs.map((r) => r.t).join('')).join('\n');
    const conta = (s: string) => {
      const trimmed = s.trim();
      const parole = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
      const caratteri = s.length;
      const caratteriNoSpazi = s.replace(/\s/g, '').length;
      return { parole, caratteri, caratteriNoSpazi };
    };
    const tot = conta(testi);
    const sel = this.testoSelezionato();
    const haSelezione = sel.length > 0;
    if (haSelezione) {
      const s = conta(sel);
      return {
        pagine: this.numeroPagine,
        parole: tot.parole,
        caratteri: tot.caratteri,
        caratteriNoSpazi: tot.caratteriNoSpazi,
        paroleSel: s.parole,
        caratteriSel: s.caratteri,
        caratteriNoSpaziSel: s.caratteriNoSpazi,
        haSelezione: true,
      };
    }
    return {
      pagine: this.numeroPagine,
      parole: tot.parole,
      caratteri: tot.caratteri,
      caratteriNoSpazi: tot.caratteriNoSpazi,
      haSelezione: false,
    };
  }

  statoRicerca(): StatoRicerca {
    const r = this.ric;
    return { totale: r ? r.corr.length : 0, corrente: r && r.corr.length > 0 ? r.indice + 1 : 0, errore: r ? r.errore : null, troncato: r ? r.troncato : false };
  }

  /** Cerca nel documento, evidenzia tutti i risultati e seleziona il primo da dove si trova il cursore in poi. */
  cerca(query: string, opz: OpzioniRicerca = OPZIONI_PREDEFINITE): StatoRicerca {
    if (query === '') { this.ric = null; this.aggiornaSovrapposizione(); return this.statoRicerca(); }
    const r = cercaTesto(this.stato.doc, query, opz);
    const inizio = this.ric ? this.ric.origine : ordina(this.stato.doc, this.stato.sel)[0];
    this.ric = { origine: inizio, query, opz, corr: r.corrispondenze, indice: Math.max(0, indiceDopo(r.corrispondenze, inizio)), errore: r.errore, troncato: r.troncato };
    this.selezionaRisultato();
    return this.statoRicerca();
  }

  /** Passa al risultato successivo (1) o precedente (-1), tornando dall'altra parte alla fine. */
  vaiAlRisultato(passo: 1 | -1): StatoRicerca {
    const r = this.ric;
    if (!r || r.corr.length === 0) return this.statoRicerca();
    r.indice = vicina(r.corr.length, r.indice, passo);
    r.origine = { p: r.corr[r.indice].p, o: r.corr[r.indice].da };
    this.selezionaRisultato();
    return this.statoRicerca();
  }

  /** Sostituisce il risultato in evidenza e passa al prossimo. È un solo passo di annulla. */
  sostituisciCorrente(testo: string): StatoRicerca {
    const r = this.ric;
    if (!r || r.corr.length === 0) return this.statoRicerca();
    const nuovo = sostituisciUna(this.stato, r.corr[r.indice], testo, r.opz);
    this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'sostituisci' };
    this.ridisegna();
    this.avvisa();
    r.origine = ordina(this.stato.doc, this.stato.sel)[0];
    return this.cerca(r.query, r.opz);
  }

  /** Sostituisce tutti i risultati in un solo passo di annulla; restituisce anche quanti sono stati. */
  sostituisciTutto(testo: string): StatoRicerca & { conteggio: number } {
    const r = this.ric;
    if (!r || r.corr.length === 0) return { ...this.statoRicerca(), conteggio: 0 };
    const { stato, conteggio } = sostituisciTutte(this.stato, r.corr, testo, r.opz);
    this.ed = { ...this.ed, storia: registra(this.ed.storia, stato), ultima: 'sostituisci' };
    this.ridisegna();
    this.avvisa();
    r.origine = ordina(this.stato.doc, this.stato.sel)[0];
    return { ...this.cerca(r.query, r.opz), conteggio };
  }

  /** Chiude la ricerca: spariscono le evidenziazioni (la selezione resta dov'è). */
  azzeraRicerca(): void {
    this.ric = null;
    this.aggiornaSovrapposizione();
  }

  private selezionaRisultato(): void {
    const r = this.ric;
    const c = r && r.corr[r.indice];
    if (c) {
      const a = eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: { p: c.p, o: c.da }, estendi: false }).ed;
      this.ed = eseguiAzioneFormato(a, { tipo: 'vai', pos: { p: c.p, o: c.a }, estendi: true }).ed;
    }
    this.aggiornaSovrapposizione();
    if (c) this.portaInVista(c);
    this.avvisa();
  }

  /** Dopo una modifica del testo si ricalcolano i risultati, restando sul più vicino al cursore. */
  private aggiornaRicerca(): void {
    const r = this.ric;
    if (!r) return;
    const nuova = cercaTesto(this.stato.doc, r.query, r.opz);
    const [i, f] = ordina(this.stato.doc, this.stato.sel);
    const uguale = nuova.corrispondenze.findIndex((c) => c.p === i.p && c.p === f.p && c.da === i.o && c.a === f.o);
    r.corr = nuova.corrispondenze;
    r.errore = nuova.errore;
    r.troncato = nuova.troncato;
    r.origine = i;
    r.indice = uguale >= 0 ? uguale : Math.max(0, indiceDopo(r.corr, i));
  }

  /** Fa scorrere la pagina in modo che il risultato sia visibile. */
  private portaInVista(c: { p: number; da: number; a: number }): void {
    try {
      const rett = this.rettangoliIntervallo({ p: c.p, o: c.da }, { p: c.p, o: c.a })[0];
      if (!rett) return;
      let n: Node | null = this;
      while (n) {
        if (n instanceof HTMLElement) {
          const stile = getComputedStyle(n);
          if (/(auto|scroll)/.test(stile.overflowY) && n.scrollHeight > n.clientHeight) {
            const area = n.getBoundingClientRect();
            if (rett.top < area.top + 40 || rett.bottom > area.bottom - 40) n.scrollTop += rett.top - (area.top + area.height / 2);
            return;
          }
        }
        n = n.parentNode ?? (n as ShadowRoot).host ?? null;
      }
    } catch {
      // senza layout non si scorre
    }
  }

  /** Rettangoli del testo tra due posizioni (sono solo quelli del testo, mai quelli degli spazi dei salti di pagina). */
  private rettangoliIntervallo(i: Posizione, f: Posizione): DOMRect[] {
    const zona = this.zonaTesto();
    const da = domDaPosizione(zona, i);
    const a = domDaPosizione(zona, f);
    if (!da || !a) return [];
    const range = document.createRange();
    range.setStart(da.nodo, da.offset);
    range.setEnd(a.nodo, a.offset);
    const pezzi: DOMRect[] = [];
    const visita = (n: Node): void => {
      if (n.nodeType === 3) {
        const t = n as Text;
        if (!range.intersectsNode(t)) return;
        const x0 = t === da.nodo ? da.offset : 0;
        const x1 = t === a.nodo ? a.offset : (t.nodeValue ?? '').length;
        if (x1 <= x0) return;
        const sub = document.createRange();
        sub.setStart(t, x0);
        sub.setEnd(t, x1);
        pezzi.push(...this.rettangoliNodo(t, sub));
        return;
      }
      n.childNodes.forEach(visita);
    };
    // un risultato sta in un solo paragrafo: basta guardare quello
    visita(i.p === f.p ? (paragrafiDom(zona)[i.p] ?? zona) : zona);
    return pezzi.filter((r) => r.width > 0 && r.height > 0);
  }

  // ---- pagine ----
  /** Inserisce nel testo lo spazio che porta le righe a cavallo di due fogli in cima al foglio dopo, poi disegna i fogli. */
  private impaginaTesto(zona: HTMLElement): void {
    let pagine = 1;
    try { pagine = this.applicaSalti(zona); } catch { pagine = 1; }
    this.disegnaFogli(pagine);
    this.numeriSommario(zona);
  }

  /** Il numero di pagina di ogni voce del sommario: la pagina in cui cade il suo titolo (senza pagine: nessun numero). */
  private numeriSommario(zona: HTMLElement): void {
    const voci = Array.from(zona.querySelectorAll<HTMLElement>('p.sommario[data-sm]'));
    if (voci.length === 0) return;
    const origine = this.getBoundingClientRect().top;
    const passo = (this.geometria.altezzaPagina + this.geometria.spazio);
    for (const v of voci) {
      const nome = v.getAttribute('data-sm') ?? '';
      const titolo = Array.from(zona.querySelectorAll<HTMLElement>('p[data-sg]')).find((x) => !x.classList.contains('sommario') && (x.getAttribute('data-sg') ?? '').toLowerCase() === nome.toLowerCase());
      if (this.senzaPagine || !titolo || passo <= 0) { v.removeAttribute('data-pg'); continue; }
      // la riga del testo, non l'inizio del paragrafo: un salto di pagina prima del titolo è uno spazio in alto nel paragrafo (padding)
      const riga = titolo.getBoundingClientRect().top + (parseFloat(getComputedStyle(titolo).paddingTop) || 0) + 1;
      const pagina = Math.floor((riga - origine) / passo) + 1;
      v.setAttribute('data-pg', String(Math.max(1, pagina)));
    }
  }

  private applicaSalti(zona: HTMLElement): number {
    if (this.senzaPagine) return 1;
    const area = this.getBoundingClientRect();
    if (area.width === 0 && area.height === 0) return 1; // nessun layout (per esempio nei test): una sola pagina
    let pagine = 1;
    for (let giro = 0; giro < 4; giro++) {
      const misurate = this.misuraRighe(zona);
      if (misurate.length === 0) return 1;
      const imp = impagina(misurate.map((m) => m.riga), this.geometria);
      pagine = imp.pagine;
      if (imp.salti.length === 0) break;
      const perRiga = new Map<number, number>();
      for (const s of imp.salti) perRiga.set(s.riga, (perRiga.get(s.riga) ?? 0) + s.altezza);
      const perNodo = new Map<Text, Array<{ h: number; offset: number }>>();
      for (const [i, h] of perRiga) {
        const m = misurate[i];
        if (m.tr) {
          // una riga di tabella non si spezza: si mette uno spazio vuoto prima della riga, che passa tutta al foglio dopo
          const spazio = document.createElement('tr');
          spazio.className = 'salto-riga';
          const cella = document.createElement('td');
          cella.colSpan = Math.max(1, m.tr.cells.length);
          cella.style.height = `${h}px`;
          spazio.appendChild(cella);
          m.tr.parentNode?.insertBefore(spazio, m.tr);
          // le righe di intestazione si ripetono in cima al foglio nuovo: copie senza numeri di paragrafo (non si scrivono, non si contano)
          if (!m.tr.classList.contains('intestazione')) {
            for (const h of Array.from(m.tr.parentNode?.querySelectorAll<HTMLTableRowElement>(':scope > tr.intestazione') ?? [])) {
              const copia = h.cloneNode(true) as HTMLTableRowElement;
              copia.className = 'salto-riga intestazione-ripetuta';
              copia.setAttribute('aria-hidden', 'true');
              copia.querySelectorAll('[data-p]').forEach((p) => p.removeAttribute('data-p'));
              m.tr.parentNode?.insertBefore(copia, m.tr);
            }
          }
          continue;
        }
        if (m.primaDelParagrafo || !m.nodo) {
          const attuale = parseFloat(m.paragrafo.style.paddingTop) || 0;
          m.paragrafo.style.paddingTop = `${attuale + h}px`;
          continue;
        }
        const lista = perNodo.get(m.nodo) ?? [];
        lista.push({ h, offset: m.inizioNodo ? 0 : this.trovaInizioRiga(m.nodo, m.topSchermo) });
        perNodo.set(m.nodo, lista);
      }
      for (const [nodo, lista] of perNodo) {
        // dal fondo verso l'alto, così le divisioni del nodo non spostano quelle ancora da fare
        lista.sort((x, y) => y.offset - x.offset);
        for (const { h, offset } of lista) {
          const salto = document.createElement('span');
          salto.className = 'salto';
          salto.style.height = `${h}px`;
          const dopo: Node = offset > 0 ? nodo.splitText(offset) : nodo;
          nodo.parentNode?.insertBefore(salto, dopo);
        }
      }
    }
    return pagine;
  }

  /** Misura tutte le righe del testo: posizione dall'alto del documento, e dove comincia ciascuna. */
  private misuraRighe(zona: HTMLElement): RigaMisurata[] {
    const origine = this.getBoundingClientRect().top;
    const out: RigaMisurata[] = [];
    for (const blocco of Array.from(zona.children) as HTMLElement[]) {
      if (blocco.tagName === 'TABLE') {
        for (const tr of Array.from(blocco.querySelectorAll<HTMLTableRowElement>('tr:not(.salto-riga)'))) {
          const r = tr.getBoundingClientRect();
          out.push({ riga: { alto: r.top - origine, basso: r.bottom - origine }, paragrafo: tr, primaDelParagrafo: false, nodo: null, topSchermo: r.top, inizioNodo: true, tr });
        }
        continue;
      }
      const p = blocco;
      const saltoForzato = p.classList.contains('salto-pagina');
      const nodi: Text[] = [];
      const raccogli = (n: Node): void => { if (n.nodeType === 3) nodi.push(n as Text); else n.childNodes.forEach(raccogli); };
      raccogli(p);
      const frammenti: Frammento[] = [];
      const provenienza: Array<{ nodo: Text; indice: number; top: number }> = [];
      for (const nodo of nodi) {
        if ((nodo.nodeValue ?? '') === '') continue;
        const r = document.createRange();
        r.selectNodeContents(nodo);
        this.rettangoliNodo(nodo, r).forEach((f, indice) => {
          if (f.height <= 0) return;
          frammenti.push({ alto: f.top - origine, basso: f.bottom - origine });
          provenienza.push({ nodo, indice, top: f.top });
        });
      }
      if (frammenti.length === 0) {
        const r = p.getBoundingClientRect();
        const riempimento = parseFloat(p.style.paddingTop) || 0;
        out.push({ riga: { alto: r.top - origine + riempimento, basso: r.bottom - origine, ...(saltoForzato ? { saltoForzato: true, ...(riempimento > 0 ? { spinta: true } : {}) } : {}) }, paragrafo: p, primaDelParagrafo: true, nodo: null, topSchermo: r.top, inizioNodo: true });
        continue;
      }
      raggruppaFrammenti(frammenti).forEach((gruppo, k) => {
        const prima = provenienza[gruppo[0]];
        out.push({ riga: { ...misuraRiga(frammenti, gruppo), ...(k === 0 && saltoForzato ? { saltoForzato: true, ...((parseFloat(p.style.paddingTop) || 0) > 0 ? { spinta: true } : {}) } : {}) }, paragrafo: p, primaDelParagrafo: k === 0, nodo: prima.nodo, topSchermo: prima.top, inizioNodo: prima.indice === 0 });
      });
    }
    return out;
  }

  /** Posizione, dentro un nodo di testo, del primo carattere che sta sulla riga che comincia a quell'altezza (ricerca a metà). */
  private trovaInizioRiga(nodo: Text, topSchermo: number): number {
    const lunghezza = (nodo.nodeValue ?? '').length;
    const topDi = (o: number): number => {
      const r = document.createRange();
      r.setStart(nodo, o);
      r.setEnd(nodo, o + 1);
      const f = r.getClientRects()[0];
      return f ? f.top : -Infinity;
    };
    let da = 0;
    let a = lunghezza - 1;
    while (da < a) {
      const m = (da + a) >> 1;
      if (topDi(m) >= topSchermo - 1) a = m; else da = m + 1;
    }
    return da;
  }

  private disegnaFogli(pagine: number): void {
    const fogli = this.renderRoot.querySelector('.fogli') as HTMLElement | null;
    if (!fogli) return;
    if (this.senzaPagine) {
      while (fogli.children.length > 1) fogli.lastElementChild?.remove();
      if (fogli.children.length === 0) {
        const f = document.createElement('div');
        f.className = 'foglio';
        fogli.appendChild(f);
      }
      const f = fogli.children[0] as HTMLElement;
      f.style.top = '0px';
      f.style.height = '100%';
      f.style.backgroundColor = this.impostazioniPagina.coloreSfondo || '#ffffff';
      this.zonaTesto().style.minHeight = '100%';
      const strato = this.renderRoot.querySelector('.margini') as HTMLElement | null;
      if (strato) strato.innerHTML = '';
      if (this.numeroPagine !== 1) {
        this.numeroPagine = 1;
        this.dispatchEvent(new CustomEvent('pagine', { detail: { pagine: 1 }, bubbles: true, composed: true }));
      }
      return;
    }
    while (fogli.children.length > pagine) fogli.lastElementChild?.remove();
    while (fogli.children.length < pagine) {
      const f = document.createElement('div');
      f.className = 'foglio';
      fogli.appendChild(f);
    }
    const filigrana = this.stato.doc.filigrana ?? '';
    (Array.from(fogli.children) as HTMLElement[]).forEach((f, i) => {
      f.style.top = `${inizioPagina(i, this.geometria)}px`;
      f.style.height = `${this.geometria.altezzaPagina}px`;
      f.style.backgroundColor = this.impostazioniPagina.coloreSfondo || '#ffffff';
      // la filigrana: in diagonale al centro del foglio, sotto il testo
      let segno = f.querySelector<HTMLElement>('.filigrana');
      if (filigrana === '') { segno?.remove(); return; }
      if (!segno) { segno = document.createElement('span'); segno.className = 'filigrana'; segno.setAttribute('aria-hidden', 'true'); f.appendChild(segno); }
      if (segno.textContent !== filigrana) segno.textContent = filigrana;
      segno.style.fontSize = `${Math.round(Math.min(110, 900 / Math.max(4, filigrana.length) * 1.6))}px`;
    });
    // l'altezza dei fogli si dà all'area del testo (la cornice di margine sopra e sotto è già nel riempimento dell'editor)
    // in stampa niente altezza minima: sono le righe a decidere quanti fogli escono (una frazione in più darebbe un foglio bianco)
    this.zonaTesto().style.minHeight = this.stampando ? '0px' : `${altezzaFogli(pagine, this.geometria) - (this.geometria.margineAlto + this.geometria.margineBasso)}px`;
    this.disegnaMargini(pagine);
    if (pagine !== this.numeroPagine) {
      this.numeroPagine = pagine;
      this.dispatchEvent(new CustomEvent('pagine', { detail: { pagine }, bubbles: true, composed: true }));
    }
  }

  /** Intestazione e piè di pagina nel margine di ogni foglio, coi numeri della pagina e delle pagine. */
  private disegnaMargini(pagine: number): void {
    const strato = this.renderRoot.querySelector('.margini') as HTMLElement | null;
    if (!strato) return;
    disegnaMargini(strato, this.stato.doc, pagine, (i) => inizioPagina(i, this.geometria), this.geometria.altezzaPagina);
  }
  // ---- tastiera e appunti ----
  private suTasto = (e: KeyboardEvent): void => {
    if (this.componendo || e.isComposing) return;
    this.blocAcceso = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock');
    const a = azioneDaTastoFormato(e);
    if (!a || a.tipo === 'testo') return;
    e.preventDefault();
    // prima di andare a capo si corregge la parola appena finita
    if (a.tipo === 'invio') this.ed = this.registraCorrezione(this.ed, correggiPrimaDiInvio(this.ed.storia.presente, this.correzione, this.blocAcceso));
    this.applica(a);
  };
  private suInput = (): void => {
    if (this.componendo) return;
    this.consumaCasella();
  };
  private suFineComposizione = (): void => {
    this.componendo = false;
    this.consumaCasella();
  };
  private consumaCasella(): void {
    const c = this.casella();
    if (!c || c.value === '') return;
    const testo = c.value;
    c.value = '';
    let ed = eseguiAzioneFormato(this.ed, { tipo: 'testo', testo }).ed;
    // correzioni solo per un carattere scritto da tastiera, mai sul testo incollato o composto tutto insieme;
    // ognuna è un passo a sé nella storia: Ctrl+Z subito dopo la toglie e lascia ciò che si è scritto
    if (Array.from(testo).length === 1) {
      const st = ed.storia.presente;
      const corretto = (this.maiuscolaAuto ? maiuscolaAutomatica(st) : null) ?? correggiDopoCarattere(st, testo, this.correzione, this.blocAcceso);
      ed = this.registraCorrezione(ed, corretto);
    }
    this.ed = ed;
    this.ridisegna();
    this.avvisa();
  }
  private suCopia = (e: ClipboardEvent): void => {
    const r = eseguiAzioneFormato(this.ed, { tipo: 'copia' });
    if (r.copiato === null) return;
    e.clipboardData?.setData('text/plain', r.copiato);
    this.appunti = r.copiato;
    e.preventDefault();
  };
  private suTaglia = (e: ClipboardEvent): void => {
    const r = eseguiAzioneFormato(this.ed, { tipo: 'taglia' });
    if (r.copiato === null) return;
    e.clipboardData?.setData('text/plain', r.copiato);
    this.appunti = r.copiato;
    e.preventDefault();
    this.ed = r.ed;
    this.ridisegna();
    this.avvisa();
  };
  private suIncolla = (e: ClipboardEvent): void => {
    const testo = e.clipboardData?.getData('text/plain') ?? '';
    e.preventDefault();
    if (testo !== '') { this.applica({ tipo: 'incolla', testo }); return; }
    const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (file) this.dispatchEvent(new CustomEvent('immagine-incollata', { detail: { file }, bubbles: true, composed: true }));
  };

  // ---- mouse ----
  private suMouseGiu = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && this.apriLinkSotto(e)) return;
    this.focalizza();
    // ridimensionamento colonna tabella col mouse
    const td = e.composedPath().find((n) => n instanceof HTMLTableCellElement) as HTMLTableCellElement | undefined;
    if (td) {
      const rect = td.getBoundingClientRect();
      const vicinoBordoDestro = rect.width > 0 && Math.abs(e.clientX - rect.right) <= 6;
      if (vicinoBordoDestro) {
        const cAttr = td.getAttribute('data-c');
        const pEl = td.querySelector('p[data-p]');
        const pIdx = pEl ? Number(pEl.getAttribute('data-p')) : -1;
        const tb = pIdx >= 0 ? this.stato.doc.paragrafi[pIdx]?.tb : null;
        if (tb && cAttr !== null) {
          const colIdx = Number(cAttr);
          const startX = e.clientX;
          const startW = rect.width;
          let wAttuale = startW;
          const suMuovi = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            wAttuale = Math.max(20, Math.round(startW + dx));
          };
          const suSu = () => {
            window.removeEventListener('mousemove', suMuovi);
            window.removeEventListener('mouseup', suSu);
            this.ridimensionaColonna(tb.i, colIdx, wAttuale);
          };
          window.addEventListener('mousemove', suMuovi);
          window.addEventListener('mouseup', suSu);
          return;
        }
      }
    }

    // un clic sulla casella di una voce di elenco di attività la spunta (o toglie la spunta) senza spostare il cursore
    const voce = e.composedPath().find((n) => n instanceof HTMLElement && n.tagName === 'P' && n.classList.contains('att')) as HTMLElement | undefined;
    if (voce && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey && voce.offsetWidth > 0) {
      const r = voce.getBoundingClientRect();
      const scala = r.width / voce.offsetWidth || 1;
      const x = (e.clientX - r.left) / scala;
      const livello = this.stato.doc.paragrafi[Number(voce.getAttribute('data-p'))]?.ri ?? 0;
      if (x >= livello * 48 && x < (livello + 1) * 48 - 8) {
        e.preventDefault();
        this.spuntaVoce(Number(voce.getAttribute('data-p')));
        return;
      }
    }
    // un clic su un'immagine la seleziona tutta
    const img = e.composedPath().find((n) => n instanceof HTMLElement && n.tagName === 'IMG' && n.parentElement?.classList.contains('immagine')) as HTMLElement | undefined;
    const carattere = img?.parentElement?.lastChild;
    const posImmagine = carattere ? posizioneDaDom(this.zonaTesto(), carattere, 0) : null;
    if (posImmagine) {
      const dopo = { p: posImmagine.p, o: posImmagine.o + 1 };
      this.ed = eseguiAzioneFormato(eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: posImmagine, estendi: false }).ed, { tipo: 'vai', pos: dopo, estendi: true }).ed;
      this.ridisegna();
      this.avvisa();
      return;
    }
    const pos = this.posizioneDaPunto(e.clientX, e.clientY);
    if (!pos) return;
    if (e.detail >= 3) {
      const lung = testoParagrafo(this.stato.doc.paragrafi[pos.p]).length;
      this.ed = eseguiAzioneFormato(eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: { p: pos.p, o: 0 }, estendi: false }).ed, { tipo: 'vai', pos: { p: pos.p, o: lung }, estendi: true }).ed;
    } else if (e.detail === 2) {
      const [da, a] = this.parolaIntorno(pos);
      this.ed = eseguiAzioneFormato(eseguiAzioneFormato(this.ed, { tipo: 'vai', pos: da, estendi: false }).ed, { tipo: 'vai', pos: a, estendi: true }).ed;
    } else {
      this.ed = eseguiAzioneFormato(this.ed, { tipo: 'vai', pos, estendi: e.shiftKey }).ed;
      this.trascina = true;
      window.addEventListener('mousemove', this.suMouseMuovi);
      window.addEventListener('mouseup', this.suMouseSu);
    }
    this.ridisegna();
    this.avvisa();
  };
  // ---- copia formato ----
  private formatoCopiato: FormatoCopiato | null = null;
  /** Memorizza il formato del punto in cui si trova il cursore (o della selezione), pronto da applicare a un'altra selezione. */
  copiaFormato(): void { this.formatoCopiato = formatoDaCopiare(this.stato); }
  /** True se un formato è stato copiato e aspetta di essere applicato. */
  get formatoInAttesa(): boolean { return this.formatoCopiato !== null; }
  annullaCopiaFormato(): void { this.formatoCopiato = null; }
  /** Applica il formato copiato alla selezione attuale (un solo passo di annulla). False se non c'è selezione su cui applicarlo. */
  applicaFormatoCopiato(): boolean {
    const copia = this.formatoCopiato;
    const st = this.stato;
    if (!copia || collassata(st.sel)) return false;
    this.formatoCopiato = null;
    const nuovo = incollaFormato(st, copia);
    if (nuovo.doc !== st.doc) {
      this.ed = { ...this.ed, storia: registra(this.ed.storia, nuovo), ultima: 'copia-formato' };
      this.ridisegna();
      this.avvisa();
    }
    return true;
  }
  /** Spunta o toglie la spunta alla voce di elenco di attività del paragrafo p (un passo di annulla). */
  spuntaVoce(p: number): void {
    const st = this.stato;
    const doc = alternaFatto(st.doc, p);
    if (doc === st.doc) return;
    this.ed = { ...this.ed, storia: registra(this.ed.storia, { ...st, doc }), ultima: 'spunta' };
    this.ridisegna();
    this.avvisa();
    this.focalizza();
  }
  /** Ctrl+clic su un link: chiede al guscio di aprirlo. Restituisce false se sotto il clic non c'è un link. */
  private apriLinkSotto(e: MouseEvent): boolean {
    for (const n of e.composedPath()) {
      // una voce del sommario: si va al titolo
      if (n instanceof HTMLElement && n.tagName === 'P' && n.classList.contains('sommario')) {
        const p = destinazioneVoce(this.stato.doc, n.getAttribute('data-sm') ?? '');
        if (p === null) return false;
        this.vaiATitolo(p);
        return true;
      }
      if (n instanceof HTMLElement && n.classList.contains('link')) {
        const url = n.getAttribute('data-u') ?? '';
        if (!urlValido(url)) return false;
        this.apriLink(url);
        return true;
      }
    }
    return false;
  }
  private apriLink(url: string): void {
    this.dispatchEvent(new CustomEvent('apri-link', { detail: { url }, bubbles: true, composed: true }));
  }
  private suMouseMuovi = (e: MouseEvent): void => {
    if (!this.trascina) return;
    const pos = this.posizioneDaPunto(e.clientX, e.clientY);
    if (pos) this.applica({ tipo: 'vai', pos, estendi: true });
  };
  private suMouseSu = (): void => {
    this.trascina = false;
    window.removeEventListener('mousemove', this.suMouseMuovi);
    window.removeEventListener('mouseup', this.suMouseSu);
  };
  private suRidimensiona = (): void => { this.aggiornaSovrapposizione(); };

  private parolaIntorno(pos: Posizione): [Posizione, Posizione] {
    const t = testoParagrafo(this.stato.doc.paragrafi[pos.p]);
    if (t.length === 0) return [pos, pos];
    const spazio = (ch: string): boolean => /\s/.test(ch);
    const i = Math.min(pos.o, t.length - 1);
    const tipo = spazio(t[i]);
    let da = i;
    let a = i + 1;
    while (da > 0 && spazio(t[da - 1]) === tipo) da--;
    while (a < t.length && spazio(t[a]) === tipo) a++;
    return [{ p: pos.p, o: da }, { p: pos.p, o: a }];
  }

  // ---- geometria (serve il layout del browser: fuori dal browser restituisce null) ----
  /** L'<img> a cui appartiene il carattere dell'immagine, se il nodo di testo è quello di un'immagine. */
  private immagineDi(nodo: Node): HTMLImageElement | null {
    const contenitore = nodo.parentElement;
    return contenitore?.classList.contains('immagine') ? contenitore.querySelector('img') : null;
  }
  /** Rettangoli di un pezzo di testo; per l'immagine è il suo rettangolo (il carattere ha corpo zero). */
  private rettangoliNodo(nodo: Text, intervallo: Range): DOMRect[] {
    const img = this.immagineDi(nodo);
    return img ? [img.getBoundingClientRect()] : Array.from(intervallo.getClientRects());
  }

  private rettangoliCarattere(nodo: Text, k: number): DOMRect[] {
    const img = this.immagineDi(nodo);
    if (img) return [img.getBoundingClientRect()];
    const r = document.createRange();
    r.setStart(nodo, k);
    r.setEnd(nodo, k + 1);
    return Array.from(r.getClientRects());
  }

  /**
   * Tasto destro nel punto (x, y): se il punto non cade nel testo selezionato il cursore va lì (come in Word e Writer),
   * altrimenti la selezione resta. Dice se c'è del testo selezionato, per le voci Taglia, Copia ed Elimina del menu.
   */
  preparaMenuContestuale(x: number, y: number): { selezione: boolean } {
    const st = this.stato;
    const pos = this.posizioneDaPunto(x, y);
    const [i, f] = ordina(st.doc, st.sel);
    const prima = (a: Posizione, b: Posizione): boolean => a.p < b.p || (a.p === b.p && a.o <= b.o);
    const dentro = pos !== null && !collassata(st.sel) && prima(i, pos) && prima(pos, f);
    if (pos && !dentro) this.applica({ tipo: 'vai', pos, estendi: false });
    this.focalizza();
    return { selezione: !collassata(this.stato.sel) };
  }
  /** Nessun testo selezionato (solo il cursore). */
  get selezioneVuota(): boolean { return collassata(this.stato.sel); }
  /** Dove sta il cursore sullo schermo (per aprire il menu dal tasto Menu o da Maiusc+F10). */
  puntoCursore(): { x: number; y: number } {
    const c = this.renderRoot.querySelector<HTMLElement>('.cursore');
    const r = c?.getBoundingClientRect();
    if (r && (r.width > 0 || r.height > 0)) return { x: r.left, y: r.bottom };
    const a = this.getBoundingClientRect();
    return { x: a.left + 40, y: a.top + 40 };
  }
  private posizioneDaPunto(x: number, y: number): Posizione | null {
    const zona = this.zonaTesto();
    let paragrafi = paragrafiDom(zona);
    if (paragrafi.length === 0) return null;
    // se il punto è dentro una cella si scelgono solo i paragrafi di quella cella (altrimenti vincerebbe sempre la prima cella della riga)
    const sotto = (this.renderRoot as ShadowRoot).elementsFromPoint?.(x, y) ?? [];
    const cella = sotto.find((el) => el.tagName === 'TD' && zona.contains(el));
    if (cella) {
      const dentro = paragrafi.filter((p) => cella.contains(p));
      if (dentro.length > 0) paragrafi = dentro;
    }
    let indice = paragrafi.findIndex((p) => y <= p.getBoundingClientRect().bottom);
    if (indice < 0) indice = paragrafi.length - 1;
    const par = paragrafi[indice];
    const numero = Number(par.getAttribute('data-p'));
    const lunghezza = (par.textContent ?? '').length;
    if (lunghezza === 0) return { p: numero, o: 0 };
    let migliore: { dy: number; dx: number; o: number } | null = null;
    let base = 0;
    const visita = (n: Node): void => {
      if (n.nodeType === 3) {
        const testo = n as Text;
        const l = (testo.nodeValue ?? '').length;
        for (let k = 0; k < l; k++) {
          for (const r of this.rettangoliCarattere(testo, k)) {
            const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
            for (const [o, bx] of [[base + k, r.left], [base + k + 1, r.right]] as Array<[number, number]>) {
              const dx = Math.abs(x - bx);
              if (!migliore || dy < migliore.dy - 2 || (Math.abs(dy - migliore.dy) <= 2 && dx < migliore.dx)) migliore = { dy, dx, o };
            }
          }
        }
        base += l;
        return;
      }
      n.childNodes.forEach(visita);
    };
    visita(par);
    const m = migliore as { o: number } | null;
    return { p: numero, o: m ? m.o : 0 };
  }

  private rettangoloCursore(pos: Posizione): Rettangolo | null {
    const dom = domDaPosizione(this.zonaTesto(), pos);
    if (!dom) return null;
    if (dom.nodo.nodeType !== 3) {
      const r = (dom.nodo as Element).getBoundingClientRect();
      return { left: r.left, top: r.top, width: 0, height: r.height };
    }
    const imgCursore = this.immagineDi(dom.nodo);
    if (imgCursore) {
      const r = imgCursore.getBoundingClientRect();
      return { left: dom.offset === 0 ? r.left : r.right, top: r.top, width: 0, height: r.height };
    }
    let nodoCursore = dom.nodo as Text;
    let offsetCursore = dom.offset;
    const seguente = nodoCursore.nextSibling as HTMLElement | null;
    if (offsetCursore === (nodoCursore.nodeValue ?? '').length && seguente?.classList?.contains('salto')) {
      const dopo = seguente.nextSibling;
      if (dopo && dopo.nodeType === 3) { nodoCursore = dopo as Text; offsetCursore = 0; }
    }
    const r = document.createRange();
    r.setStart(nodoCursore, offsetCursore);
    r.collapse(true);
    const rr = r.getClientRects();
    if (rr.length > 0 && rr[0].height > 0) return { left: rr[0].left, top: rr[0].top, width: 0, height: rr[0].height };
    if (dom.offset > 0) {
      const prima = this.rettangoliCarattere(dom.nodo as Text, dom.offset - 1);
      const u = prima[prima.length - 1];
      if (u) return { left: u.right, top: u.top, width: 0, height: u.height };
    }
    return null;
  }

  private posizioneVerticale(direzione: 'su' | 'giu'): Posizione | null {
    const r = this.rettangoloCursore(this.stato.sel.fuoco);
    if (!r) return null;
    const attuale = this.stato.sel.fuoco;
    for (let k = 0; k < 40; k++) {
      const passo = r.height * (0.5 + k);
      const y = direzione === 'su' ? r.top - passo : r.top + r.height + passo - r.height * 0.5;
      const pos = this.posizioneDaPunto(r.left, y);
      if (pos && (pos.p !== attuale.p || pos.o !== attuale.o)) return pos;
    }
    return null;
  }

  private mostraCursore(visibile: boolean): void {
    this.renderRoot.querySelector('.cursore')?.classList.toggle('nascosto', !visibile);
  }

  private iniziaResizeManiglia(e: MouseEvent, pos: 'nw' | 'ne' | 'se' | 'sw', wIniziale: number): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    let wAttuale = wIniziale;
    const suMuovi = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const delta = (pos === 'se' || pos === 'ne') ? dx : -dx;
      wAttuale = Math.max(20, Math.min(2000, Math.round(wIniziale + delta)));
    };
    const suSu = () => {
      window.removeEventListener('mousemove', suMuovi);
      window.removeEventListener('mouseup', suSu);
      if (wAttuale !== wIniziale) {
        this.ridimensionaImmagineSelezionata(wAttuale);
      }
    };
    window.addEventListener('mousemove', suMuovi);
    window.addEventListener('mouseup', suSu);
  }

  private aggiornaSovrapposizione(): void {
    const sov = this.renderRoot.querySelector('.sovrapposizione') as HTMLElement | null;
    const cur = this.renderRoot.querySelector('.cursore') as HTMLElement | null;
    if (!sov || !cur) return;
    const vecchi = sov.querySelectorAll('.selezione, .trovato, .cornice-immagine, .errore-ort');
    if (vecchi.length > 50) {
      // dopo "Seleziona tutto" in un documento lungo i rettangoli sono migliaia: uno alla volta si impiega quasi un secondo, in blocco millisecondi
      sov.replaceChildren(...Array.from(sov.children).filter((c) => !c.matches('.selezione, .trovato, .cornice-immagine, .errore-ort')));
    } else {
      vecchi.forEach((n) => n.remove());
    }
    try {
      const origine = this.getBoundingClientRect();
      const disegnaRettangolo = (r: DOMRect, classe: string): void => {
        const div = document.createElement('div');
        div.className = classe;
        div.style.left = `${r.left - origine.left}px`;
        div.style.top = `${r.top - origine.top}px`;
        div.style.width = `${r.width}px`;
        div.style.height = `${r.height}px`;
        sov.appendChild(div);
      };
      const ric = this.ric;
      if (ric) {
        ric.corr.slice(0, 1500).forEach((c, k) => {
          for (const r of this.rettangoliIntervallo({ p: c.p, o: c.da }, { p: c.p, o: c.a })) disegnaRettangolo(r, k === ric.indice ? 'trovato corrente' : 'trovato');
        });
      }
      if (this.ortAttiva) {
        for (const e of this.erroriVisibili().slice(0, 400)) {
          for (const r of this.rettangoliIntervallo({ p: e.p, o: e.da }, { p: e.p, o: e.a })) {
            const div = document.createElement('div');
            div.className = 'errore-ort';
            div.style.left = `${r.left - origine.left}px`;
            div.style.top = `${r.bottom - origine.top - 2}px`;
            div.style.width = `${r.width}px`;
            sov.appendChild(div);
          }
        }
      }
      const st = this.stato;
      const [i, f] = ordina(st.doc, st.sel);
      if (collassata(st.sel)) {
        const r = this.rettangoloCursore(f);
        cur.hidden = !r;
        if (r) {
          cur.style.left = `${r.left - origine.left}px`;
          cur.style.top = `${r.top - origine.top}px`;
          cur.style.height = `${r.height}px`;
          const c = this.casella();
          if (c) { c.style.left = cur.style.left; c.style.top = cur.style.top; }
        }
        return;
      }
      cur.hidden = true;
      for (const r of this.rettangoliIntervallo(i, f)) disegnaRettangolo(r, 'selezione');

      const imgSel = immagineSelezionataDi(st.doc, st.sel);
      if (imgSel) {
        const pEl = this.zonaTesto().querySelector(`p[data-p="${imgSel.p}"]`);
        const imgEl = pEl?.querySelector('.immagine img') as HTMLImageElement | null;
        const r = imgEl?.getBoundingClientRect();
        const width = (r && r.width > 0) ? r.width : imgSel.im.w;
        const height = (r && r.height > 0) ? r.height : imgSel.im.h;
        const left = (r && r.width > 0) ? r.left - origine.left : 0;
        const top = (r && r.height > 0) ? r.top - origine.top : 0;

        const cornice = document.createElement('div');
        cornice.className = 'cornice-immagine';
        cornice.style.left = `${left}px`;
        cornice.style.top = `${top}px`;
        cornice.style.width = `${width}px`;
        cornice.style.height = `${height}px`;

        const maniglie: Array<'nw' | 'ne' | 'se' | 'sw'> = ['nw', 'ne', 'se', 'sw'];
        for (const pos of maniglie) {
          const m = document.createElement('div');
          m.className = `maniglia-resize ${pos}`;
          m.setAttribute('data-pos', pos);
          m.addEventListener('mousedown', (e: MouseEvent) => this.iniziaResizeManiglia(e, pos, imgSel.im.w));
          cornice.appendChild(m);
        }
        sov.appendChild(cornice);
      }
    } catch {
      // senza layout (per esempio nei test) cursore, selezione e risultati non si disegnano
    }
  }
}
