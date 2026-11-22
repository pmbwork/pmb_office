import { css, PropertyValues } from "lit";
import { html } from "../i18n/html";
import { LinguaElement } from "../i18n/lingua-element";
import { suMac, tastoPrimario } from "@comune/piattaforma";
import { customElement, property, state } from "lit/decorators.js";
import { styleMap } from "../utils/style-map";
import { live } from "lit/directives/live.js";
import "./immagine-overlay";
import "./filtro-colonna";
import { graficiDelFoglioDuplicato, graficiDopoEliminazioneFoglio, graficiDopoRinomina, graficiDopoSpostamento, graficiDopoStruttura, graficoAggiornato, leggiIntervalloTesto, pivotDopoEliminazioneFoglio, pivotDopoRinomina, pivotDopoSpostamento, pivotDopoStruttura } from "../sheet/grafici-e-pivot";
import { fotografaSopraLeCelle, incollaRegoleTrasposte, incollaSopraLeCelle, nomiUguali, regolaDopoSpostamento, sopraVuoto, spostaCommenti, spostaDatiSopraLeCelle, spostaNomi, type Spostamento } from "../sheet/sposta-con-celle";
import { chiaveMese, extractUniqueColumnValues, filtriDaJson, filtroDaScelta, filtroInJson, fineAreaFiltro, formatoMostraData, LUNGHEZZA_MASSIMA_NOME_VISTA, ordinePerColore, regioneCorrente, valoriDistinti, type AreaFiltro, type FilterCondition, type FiltroExtra, type VistaFiltro } from "../sheet/filter";
import { LIMITE_IMMAGINI, immaginiDaDati, misureIniziali, nuovoIdImmagine, type ImmagineConfig } from "../sheet/immagini";
import { LIMITE_PULSANTI, nuovoIdPulsante } from "../sheet/pulsanti";
import { COLORE_LINK } from "../sheet/link";
import { localeNumeri } from "../sheet/locale-numeri";
import { regioneDati, ritocchiTabella } from "../sheet/tabella";
import { chiaveRiga, compatta, trovaDuplicati } from "../sheet/duplicati";
import { colonneNecessarie, dividiRighe, type OpzioniDivisione } from "../sheet/testo-in-colonne";
import {
  SheetDocument,
  defaultDocumentStore,
  computeVisibleRange,
  VisibleRange,
  createCellSelection,
  createRangeSelection,
  createRowSelection,
  createColSelection,
  createAllSelection,
  isCellSelected,
  intervalliSelezione,
  aggiungiCellaASelezione,
  formatSelectionAddress,
  parseNameBoxAddress,
  handleNavigationKey,
  generateTSV,
  normalizzaTsv,
  parseTSV,
  computePasteOperations,
  setInternalClipboard,
  getInternalClipboard,
  formatDisplayValue,
  getColWidth,
  DEFAULT_ROW_HEIGHT,
  CellChange,
  CellValue,
  columnIndexToLetters,
  columnLettersToIndex,
  resolveCellStyle,
  applyFormatToRange,
  applyFormatToColumn,
  applyFormatToRow,
  cellKey,
  CellStyle,
  BorderDef,
  StyleChangeRecord,
  formatCellValue,
  coloreFormato,
  increaseDecimals,
  decreaseDecimals,
  computeFillValue,
  computeFillDown,
  computeFillRight,
  computePasteSpecial,
  PasteSpecialType,
  ClipboardCellPayload,
  computeRowSort,
  rewriteFormulaOnSort,
  computeHiddenRowsFromFilters,
  FilterRange,
  validateCellValue,
  DataValidationRule,
  isCheckboxCell,
  isCheckboxChecked,
  toggleCheckboxValue,
  getCellMergeInfo,
  mergeAll,
  mergeHorizontal,
  mergeVertical,
  unmergeCells,
  evaluateConditionalFormats,
  type ConditionalFormatRule,
  statisticheNumeri,
  ICONE,
  type StatisticheIntervallo,
  buildSearchRegex,
  findAllMatches,
  findNextMatch,
  executeReplaceAll,
  resolveEffectiveTextColor,
  ChartConfig,
  ChartType,
  ChartSeries,
  PivotConfig,
  computePivotTable,
} from "../sheet/index";
import { FORMATI_PREIMPOSTATI, FORMATI_PREIMPOSTATI_PER_ID } from "../sheet/formati-preimpostati";
import "./chart-overlay";
import { InlineEngineClient } from "../sheet/engine-client";
import { GeometriaRighe } from "../sheet/geometria";
import { coloreSchedaDi, impostaColoreScheda, impostaNascosto, impostaPaginaFoglio, impostaProtezioneFoglio, nascostoDi } from "../sheet/stato-fogli";
import { cellaProtetta, formulaNascosta, intervalloProtetto, motivoPasso, MOTIVO_CARTELLA, MOTIVO_CELLA, MOTIVO_FOGLIO } from "../sheet/protezione";
import { impronteNuove, verificaPassword } from "@comune/protezione/impronte";
import { alternaInterruzione, copiaPagina, paginaPredefinita, scriviAreaStampa, type ImpostaPagina } from "../sheet/pagina";
import { elencaConvalide, firmaConvalida, type ConvalidaElencata } from "../sheet/regole-dialogo";
import { cambiaRiferimento } from "../sheet/riferimenti-assoluti";
import { contestoNavigazione } from "../sheet/contesto-navigazione";
import { daInputUtente, perInputUtente, interpretaInput } from "../sheet/input-locale";
import { ricercaObiettivo as ricercaObiettivoPura } from "../sheet/ricerca-obiettivo";
import { dipendenti, formuleDellaCartella, riferimentiFormula } from "../sheet/precedenti";
import { pianoSubtotali } from "../sheet/subtotali";
import { trasforma as trasformaMaiuscole, type ModoMaiuscole } from "@comune/maiuscole";
import { nomiPerMotore } from '../sheet/nomi-dialogo';
import { MAX_COLS, MAX_ROWS, parseCellAddress, parseRangeAddress } from '../engine/address';
import { dividiPerRiempimento } from '../engine/format-testo';
import { aggiornaPerSpostamento, type BloccoSpostato } from '../engine/sposta-riferimenti';
import { applicaStato, clonaStato, statoDelFoglio, duplicaStatoFoglio, eliminaStatoFoglio, passaAlFoglio, rinominaStatoFoglio, scartaStatoCorrente, statoADati, statoCorrente } from '../sheet/stato-fogli';
import { spostaDatiAccessori, type OperazioneStruttura } from '../sheet/sposta-struttura';
import { disegnaMinigrafico, leggiMinigrafico } from './minigrafico';
import { CELLE_MASSIME_SERIE, valoriSerie, type ParametriSerie, type TipoSerie, type UnitaData } from '../sheet/serie';
import { testoADataSeriale } from '../engine/functions/date';
import { LIVELLO_MASSIMO as LIVELLO_MASSIMO_GRUPPI, copiaGruppi, gruppoDi, raggruppa as raggruppaGruppi, separa as separaGruppi } from '../sheet/gruppi';
import { NamedRangeRegistry, type NamedRange } from '../sheet/named-ranges';
import { commentoDi, chiaveCommento, impostaCommento, rinominaFoglioCommenti, togliCommentiFoglio, copiaCommentiFoglio, type Commento } from '../sheet/commenti';
import { t } from '../i18n/lingua';

/** Attende una promessa per al massimo `ms` millisecondi: gli appunti di sistema possono restare in attesa di un permesso e l'app non deve bloccarsi. */
function entroTempo<T>(promessa: Promise<T>, ms: number, predefinito: T): Promise<T> {
  return Promise.race([promessa.catch(() => predefinito), new Promise<T>((risolvi) => setTimeout(() => risolvi(predefinito), ms))]);
}

const COLORI_SCHEDA: Array<{ nome: string; valore: string }> = [
  { nome: 'rosso', valore: '#ef4444' }, { nome: 'arancione', valore: '#f97316' }, { nome: 'giallo', valore: '#eab308' }, { nome: 'verde', valore: '#22c55e' },
  { nome: 'azzurro', valore: '#06b6d4' }, { nome: 'blu', valore: '#3b82f6' }, { nome: 'viola', valore: '#8b5cf6' }, { nome: 'grigio', valore: '#6b7280' },
];

@customElement("free-sheet-grid")
export class FreeSheetGrid extends LinguaElement {
  @property({ type: String }) tabId = "tab-1";
  @property({ type: Number }) zoom = 100;
  @property({ type: Object }) document?: SheetDocument;

  @state() private visibleRange: VisibleRange = computeVisibleRange({
    scrollTop: 0,
    scrollLeft: 0,
    viewportWidth: 1000,
    viewportHeight: 600,
  });

  @state() private activeCellAddress = "A1";
  @state() private nameBoxValue = "A1";
  @state() private formulaBarValue = "";
  /** Visualizza › Mostra formule: nelle celle le formule invece dei risultati */
  @state() private mostraFormule = false;
  /** con Mostra formule: le formule delle celle visibili (la copia per disegnare ha solo i valori) */
  private formuleMostrate = new Map<string, string>();
  @state() private isEditing = false;
  /** Controllo ortografico mentre si scrive nelle celle e nella barra della formula (lo fa il correttore del sistema); si ricorda tra una sessione e l'altra. */
  @state() private ortografia = (() => { try { return window.localStorage.getItem('pmb_sheets.ortografia') === '1'; } catch { return false; } })();
  @state() private editValue = "";
  @state() private cellsCache = new Map<string, { raw: string; value: CellValue }>();
  @state() private formulaRefHighlights: { r1: number; c1: number; r2: number; c2: number; color: string }[] = [];
  @state() private currentBorderStyle: 'thin' | 'medium' | 'dashed' = 'thin';
  @state() private currentBorderColor = 'auto';
  @state() private currentBordersMode = 'all';

  // Stato Struttura M1 (schede, riempimento, menu contestuale, pennello formato)
  @state() private sheetList: string[] = ['Foglio1'];
  @state() private contextMenu: {
    x: number;
    y: number;
    type: 'col' | 'row' | 'sheet' | 'cell';
    index: number;
    sheetName?: string;
  } | null = null;
  /** La tendina di una cella con convalida a elenco: dove si apre e quali voci mostra. */
  /** la finestrella del filtro di una colonna (freccia ▼ nell'intestazione) */
  @state() private filtroAperto: { col: number; x: number; y: number; valori: string[]; spuntati: string[] | null; condizione: FilterCondition | null; attivo: boolean; coloriSfondo: string[]; spuntatiSfondo: string[] | null; coloriTesto: string[]; spuntatiTesto: string[] | null; mesi: string[]; spuntatiMesi: string[] | null } | null = null;
  @state() private elencoAperto: { row: number; col: number; x: number; y: number; voci: string[] } | null = null;
  @state() private isFillDragging = false;
  @state() private fillDragTarget: { row: number; col: number } | null = null;
  @state() private isFormatPainterActive = false;
  @state() private formatPainterStyle: CellStyle | null = null;

  // Stato Dati M2 (trova/sostituisci, filtri popover)
  @state() private showFindReplace = false;
  @state() private isReplaceMode = false;
  @state() private findQuery = '';
  @state() private replaceQuery = '';
  @state() private findMatchesCount = 0;

  // Stato Grafici e Pivot M3
  @state() private selectedChartId: string | null = null;
  @state() private selectedImageId: string | null = null;

  private isDragging = false;
  /** trascinamento sulle intestazioni: quale tipo e da quale colonna/riga è partito */
  private trascinaIntestazione: { tipo: 'col' | 'riga'; da: number } | null = null;
  private isResizingCol = false;
  private resizeColIndex = -1;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  private isResizingRow = false;
  private resizeRowIndex = -1;
  private resizeStartY = 0;
  private resizeStartHeight = 0;

  private unregisterChange?: () => void;

  static styles = css`
    /* pulsanti dei file di Excel: aspetto dei pulsanti di Windows, sopra le celle come le immagini */
    .pulsante-modulo { position: absolute; z-index: 6; box-sizing: border-box; margin: 0; padding: 2px 4px; overflow: hidden; display: flex; align-items: center; justify-content: center;
      text-align: center; white-space: pre-line; line-height: 1.15; font: 15px Calibri, Carlito, Arial, sans-serif; color: #000; background: #f0f0f0; border: 1px solid #adadad; border-radius: 2px; cursor: pointer; }
    .pulsante-modulo:hover { background: #e5f1fb; border-color: #0078d7; }
    .pulsante-modulo:focus-visible { outline: 2px solid #0b57d0; outline-offset: 1px; }
    .pulsante-modulo.fermo { cursor: not-allowed; opacity: 0.75; }
    .pulsante-modulo.verticale { writing-mode: vertical-rl; transform: rotate(180deg); }
    :host([hidden]) {
      display: none !important;
    }

    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background-color: var(--color-surface);
      overflow: hidden;
      box-sizing: border-box;
      font-family: 'Inter', var(--font-family-base);
      font-size: var(--font-size-sm);
      outline: none;
    }

    /* Formula bar */
    .formula-bar {
      display: flex;
      align-items: center;
      height: 32px;
      min-height: 32px;
      background-color: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      padding: 0 var(--space-2);
      gap: var(--space-2);
      box-sizing: border-box;
      z-index: 10;
    }

    .cell-name-box {
      width: 70px;
      height: 24px;
      padding: 0 var(--space-2);
      font-weight: 500;
      color: var(--color-text);
      background-color: var(--color-sheet-header-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xs);
      outline: none;
      font-family: inherit;
      font-size: var(--font-size-xs);
      box-sizing: border-box;
    }

    .cell-name-box:focus {
      border-color: var(--color-accent);
      background-color: var(--color-surface);
    }

    .fx-label {
      font-style: italic;
      font-weight: 700;
      color: var(--color-text-secondary);
      user-select: none;
      width: 16px;
      text-align: center;
    }

    .formula-input {
      flex: 1;
      height: 24px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xs);
      padding: 0 var(--space-2);
      font-family: inherit;
      font-size: var(--font-size-sm);
      outline: none;
      background-color: var(--color-surface);
      color: var(--color-text);
      box-sizing: border-box;
    }

    .formula-input:focus {
      border-color: var(--color-accent);
    }

    /* Grid container with scrolling */
    .grid-container {
      flex: 1;
      overflow: auto;
      position: relative;
      background-color: var(--color-surface);
      outline: none;
      scrollbar-color: var(--color-border) var(--color-sheet-header-bg);
      scrollbar-width: thin;
    }

    .grid-container::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    .grid-container::-webkit-scrollbar-track {
      background: var(--color-sheet-header-bg);
    }

    .grid-container::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: var(--radius-xs);
    }

    .grid-container::-webkit-scrollbar-thumb:hover {
      background: var(--color-text-muted);
    }

    .grid-container::-webkit-scrollbar-corner {
      background: var(--color-sheet-header-bg);
    }

    .virtual-spacer {
      position: relative;
      /* clip e non hidden: hidden ne farebbe un contenitore che scorre, e le intestazioni e le righe bloccate ("sticky") si aggancerebbero a lui
         invece che al riquadro che scorre davvero, uscendo dalla vista appena si scorre il foglio */
      overflow: clip;
    }

    .virtual-content {
      position: absolute;
      top: 0;
      left: 0;
      will-change: transform;
    }

    table.sheet-table {
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
      background-color: var(--color-surface);
    }

    /* Headers */
    th.corner-header {
      width: 44px;
      min-width: 44px;
      height: 24px;
      background-color: var(--color-sheet-header-bg);
      border-right: 1px solid var(--color-sheet-grid-line);
      border-bottom: 1px solid var(--color-sheet-grid-line);
      position: sticky;
      top: 0;
      left: 0;
      z-index: 5;
      cursor: pointer;
      user-select: none;
    }

    th.corner-header:hover {
      background-color: var(--color-surface-hover);
    }

    th.col-header {
      height: 24px;
      background-color: var(--color-sheet-header-bg);
      border-right: 1px solid var(--color-sheet-grid-line);
      border-bottom: 1px solid var(--color-sheet-grid-line);
      font-weight: 500;
      color: var(--color-text-secondary);
      text-align: center;
      user-select: none;
      position: sticky;
      top: 0;
      z-index: 4;
      padding: 0;
      box-sizing: border-box;
      cursor: pointer;
    }

    th.col-header.selected-header {
      background-color: var(--color-accent-subtle);
      color: var(--color-accent);
      font-weight: 700;
    }

    .col-resizer {
      position: absolute;
      top: 0;
      right: -3px;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      z-index: 6;
    }

    .col-resizer:hover {
      background-color: var(--color-accent);
    }

    table.sheet-table tr {
      height: 22px;
      max-height: 22px;
      box-sizing: border-box;
    }

    th.row-header {
      width: 44px;
      min-width: 44px;
      height: 22px;
      max-height: 22px;
      line-height: 22px;
      overflow: hidden;
      background-color: var(--color-sheet-header-bg);
      border-right: 1px solid var(--color-sheet-grid-line);
      border-bottom: 1px solid var(--color-sheet-grid-line);
      font-weight: 500;
      color: var(--color-text-secondary);
      text-align: center;
      user-select: none;
      position: sticky;
      left: 0;
      z-index: 3;
      padding: 0;
      box-sizing: border-box;
      cursor: pointer;
    }

    /* Raggruppa e struttura: una barra per livello sul bordo dell'intestazione e il pulsante +/− dopo il gruppo */
    .segno-gruppo { position: absolute; background: var(--color-accent); opacity: 0.55; pointer-events: none; }
    .segno-gruppo.riga { left: 0; top: 0; bottom: 0; }
    .segno-gruppo.colonna { left: 0; right: 0; top: 0; }
    .pulsante-gruppo {
      position: absolute; left: 1px; top: 50%; transform: translateY(-50%);
      width: 12px; height: 12px; line-height: 10px; font-size: 11px; font-weight: 700; text-align: center;
      border: 1px solid var(--color-text-secondary); border-radius: 2px; background: var(--color-sheet-header-bg); color: var(--color-text-primary, inherit);
      cursor: pointer; box-sizing: border-box; z-index: 1;
    }
    th.col-header .pulsante-gruppo { left: 2px; top: 2px; transform: none; }

    th.row-header.selected-header {
      background-color: var(--color-accent-subtle);
      color: var(--color-accent);
      font-weight: 700;
    }

    td.sheet-cell {
      border-right: 1px solid var(--color-sheet-grid-line);
      border-bottom: 1px solid var(--color-sheet-grid-line);
      padding: 0 4px;
      height: 22px;
      max-height: 22px;
      line-height: 20px;
      background-color: var(--color-sheet-cell-bg);
      color: var(--color-text);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      outline: none;
      cursor: cell;
      user-select: none;
      box-sizing: border-box;
      vertical-align: middle;
    }

    /* interruzioni di pagina a mano (Inserisci › Interruzione di pagina): linea blu tratteggiata, come in Calc */
    td.sheet-cell.interruzione-r { border-top: 2px dashed #1a73e8 !important; }
    td.sheet-cell.interruzione-c { border-left: 2px dashed #1a73e8 !important; }

    /* piccolo triangolo ambra nell'angolo in alto a destra delle celle con un commento */
    td.sheet-cell.has-comment {
      background-image: linear-gradient(225deg, #f9ab00 0, #f9ab00 6px, transparent 6px);
    }

    /* il testo lungo di una cella esce sulle celle vuote a destra, come in Excel e Fogli */
    td.sheet-cell.trabocca {
      overflow: visible;
      text-overflow: clip;
      position: relative;
      z-index: 1;
    }
    td.sheet-cell .testo-trabocca {
      pointer-events: none; /* il testo che esce sulle celle vicine non deve rubare i clic alla cella sotto */
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .icona-condizionale { margin-right: 4px; font-size: 0.85em; }

    /* contabilità: il simbolo a sinistra e il numero a destra nella stessa cella */
    .riempimento { display: flex; justify-content: space-between; width: 100%; white-space: pre; }

    .freccia-elenco {
      position: absolute;
      right: 2px;
      top: 2px;
      width: 16px;
      height: 16px;
      line-height: 16px;
      text-align: center;
      font-size: 11px;
      background: var(--color-surface);
      border: 1px solid var(--color-sheet-grid-line);
      border-radius: 3px;
      cursor: pointer;
      color: var(--color-text-secondary);
    }
    .cell-filter-btn {
      position: absolute;
      right: 2px;
      bottom: 2px;
      width: 16px;
      height: 16px;
      line-height: 16px;
      text-align: center;
      font-size: 9px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 3px;
      cursor: pointer;
      color: var(--color-text-secondary);
      user-select: none;
      z-index: 2;
    }
    .cell-filter-btn:hover {
      background-color: var(--color-surface-hover);
      color: var(--color-accent);
    }
    .cell-filter-btn.active {
      color: var(--color-accent);
      font-weight: 700;
      border-color: var(--color-accent);
    }
    td.sheet-cell:not(.congelata):has(.freccia-elenco),
    td.sheet-cell:not(.congelata):has(.cell-filter-btn) { position: relative; }
    /* il bordo che separa le righe e le colonne bloccate dal resto */
    td.sheet-cell.congela-fondo { border-bottom: 2px solid var(--color-border-strong, #94a3b8) !important; }
    td.sheet-cell.congela-lato { border-right: 2px solid var(--color-border-strong, #94a3b8) !important; }

    .colori-scheda { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 10px 6px; max-width: 190px; }
    .campione-colore { width: 18px; height: 18px; border-radius: 3px; border: 1px solid var(--color-border); cursor: pointer; box-sizing: border-box; text-align: center; line-height: 16px; font-size: 13px; color: var(--color-text-secondary); }
    .campione-colore:hover { outline: 2px solid var(--color-accent); }

    td.sheet-cell.selected {
      background-color: var(--color-accent-subtle);
    }

    td.sheet-cell.active {
      background-color: var(--color-sheet-cell-bg);
      box-shadow: inset 0 0 0 2px var(--color-accent);
    }

    td.sheet-cell.cell-error {
      color: var(--color-error);
    }

    /* Editor sovrapposto alla cella */
    .cell-editor-overlay {
      position: absolute;
      border: 2px solid var(--color-accent);
      background-color: var(--color-surface);
      color: var(--color-text);
      font-family: inherit;
      font-size: inherit;
      padding: 0 4px;
      box-sizing: border-box;
      outline: none;
      z-index: 7;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    /* Evidenziazione dei riferimenti nella formula */
    .ref-highlight-box {
      position: absolute;
      pointer-events: none;
      box-sizing: border-box;
      z-index: 6;
      border-style: solid;
      border-width: 2px;
      border-radius: 2px;
    }

    /* M1: Row Resizer */
    .row-resizer {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 6px;
      cursor: row-resize;
      z-index: 6;
    }

    .row-resizer:hover {
      background-color: var(--color-accent);
    }

    /* M1: Fill Handle & Drag */
    .fill-handle {
      position: absolute;
      bottom: -4px;
      right: -4px;
      width: 7px;
      height: 7px;
      background-color: var(--color-accent);
      border: 1px solid var(--color-surface);
      cursor: crosshair;
      z-index: 8;
    }

    .fill-drag-rect {
      position: absolute;
      pointer-events: none;
      box-sizing: border-box;
      z-index: 7;
      border: 2px dashed var(--color-accent);
      background-color: var(--color-accent-subtle);
      opacity: 0.5;
    }

    /* M1: Context Menu Fluttuante */
    .sheet-context-menu {
      position: fixed;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      min-width: 200px;
      padding: 4px 0;
      z-index: 2000;
      display: flex;
      flex-direction: column;
    }

    .sheet-context-menu-item {
      display: flex;
      align-items: center;
      height: 28px;
      padding: 0 12px;
      font-size: var(--font-size-xs);
      color: var(--color-text);
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
    }

    .sheet-context-menu-item:hover {
      background-color: var(--color-surface-hover);
      color: var(--color-accent);
    }

    .sheet-context-menu-separator {
      height: 1px;
      background-color: var(--color-border);
      margin: 4px 0;
    }

    /* M2: Filtri colonna */
    .col-filter-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      margin-left: 4px;
      font-size: 9px;
      border-radius: 2px;
      color: var(--color-text-secondary);
      cursor: pointer;
      user-select: none;
    }

    .col-filter-btn:hover {
      background-color: var(--color-surface-hover);
      color: var(--color-accent);
    }

    .col-filter-btn.active {
      color: var(--color-accent);
      font-weight: 700;
    }

    /* M2: Caselle di controllo (Checkboxes) */
    .checkbox-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      cursor: pointer;
      user-select: none;
    }

    .checkbox-container svg {
      vertical-align: middle;
    }

    .checkbox-container svg.checked {
      color: var(--color-accent, #1d4ed8);
    }

    .checkbox-container svg.unchecked {
      color: var(--color-text-muted, #94a3b8);
    }

    /* M2: Trova e Sostituisci (Find & Replace) */
    .find-replace-bar {
      display: flex;
      align-items: center;
      position: absolute;
      top: 40px;
      right: 24px;
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 6px 10px;
      gap: 6px;
      z-index: 30;
      font-size: var(--font-size-xs);
    }

    .find-replace-input {
      height: 24px;
      padding: 0 6px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xs);
      background-color: var(--color-surface);
      color: var(--color-text);
      outline: none;
      font-size: inherit;
      width: 120px;
    }

    .find-replace-input:focus {
      border-color: var(--color-accent);
    }

    .find-replace-btn {
      height: 24px;
      padding: 0 8px;
      background-color: var(--color-sheet-header-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xs);
      color: var(--color-text);
      cursor: pointer;
      font-size: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .find-replace-btn:hover {
      background-color: var(--color-surface-hover);
    }

    .find-replace-count {
      font-size: 11px;
      color: var(--color-text-secondary);
      padding: 0 4px;
      user-select: none;
    }
  ` as any;

  private resizeObserver?: ResizeObserver;
  private timerTempo?: number;

  /** NOW e TODAY avanzano da sole come in Google Fogli: ogni minuto, e quando la finestra torna in primo piano (il computer può essere stato fermo). */
  public static readonly INTERVALLO_TEMPO_MS = 60_000;

  /** Ricalcola NOW e TODAY (e ciò che ne dipende) e ridisegna le celle se è cambiato qualcosa. Restituisce quante celle sono cambiate. */
  public async passaIlTempo(): Promise<number> {
    try {
      const n = await this.getDoc().client.ricalcolaTempo();
      if (n > 0) this.updateViewport();
      return n;
    } catch {
      return 0;
    }
  }

  private sullaVisibilita = () => { if (document.visibilityState === "visible") void this.passaIlTempo(); };

  connectedCallback() {
    super.connectedCallback();
    this.initDocument();
    this.timerTempo = window.setInterval(() => { void this.passaIlTempo(); }, FreeSheetGrid.INTERVALLO_TEMPO_MS);
    document.addEventListener("visibilitychange", this.sullaVisibilita);
    window.addEventListener("focus", this.sullaVisibilita);
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("mousemove", this.handleWindowMouseMove);
    window.addEventListener("mouseup", this.handleWindowMouseUp);
  }

  firstUpdated() {
    const container = this.renderRoot.querySelector(".grid-container") as HTMLElement;
    if (container && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          this.updateViewport();
        }
      });
      this.resizeObserver.observe(container);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    if (this.unregisterChange) {
      this.unregisterChange();
      this.unregisterChange = undefined;
    }
    if (this.timerTempo !== undefined) { window.clearInterval(this.timerTempo); this.timerTempo = undefined; }
    document.removeEventListener("visibilitychange", this.sullaVisibilita);
    window.removeEventListener("focus", this.sullaVisibilita);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("mousemove", this.handleWindowMouseMove);
    window.removeEventListener("mouseup", this.handleWindowMouseUp);
    window.removeEventListener("pointerdown", this.fuoriDalMenuContestuale, true);
    window.removeEventListener("keydown", this.escMenuContestuale, true);
  }

  /** Il menu del tasto destro si chiude con un clic fuori da lui (anche sulla barra dei menu: prima restava aperto sopra le tendine) o con Esc. */
  private fuoriDalMenuContestuale = (e: PointerEvent): void => {
    if (!this.contextMenu) return;
    if (e.composedPath().some((n) => n instanceof HTMLElement && n.classList.contains('sheet-context-menu'))) return;
    this.closeContextMenu();
  };
  private escMenuContestuale = (e: KeyboardEvent): void => { if (e.key === 'Escape' && this.contextMenu) this.closeContextMenu(); };

  protected updated(changedProperties: PropertyValues) {
    if (changedProperties.has("contextMenu" as keyof this)) {
      if (this.contextMenu) {
        window.addEventListener("pointerdown", this.fuoriDalMenuContestuale, true);
        window.addEventListener("keydown", this.escMenuContestuale, true);
      } else {
        window.removeEventListener("pointerdown", this.fuoriDalMenuContestuale, true);
        window.removeEventListener("keydown", this.escMenuContestuale, true);
      }
    }
    this._geomCache = undefined;
    this._largCache = undefined;
    // dopo ogni disegno: se le righe nascoste del foglio sono cambiate (a mano, da un filtro, con Annulla...) il motore ricalcola SUBTOTAL e AGGREGATE
    // e si rileggono le celle per mostrarne i nuovi valori (la seconda volta la firma è uguale e non succede più niente)
    if (this.document || this.tabId) void this.sincronizzaRigheNascoste().then((cambiato) => { if (cambiato) this.updateViewport(); }).catch(() => undefined);
    const intestazione = this.renderRoot.querySelector('th.col-header') as HTMLElement | null;
    const misura = intestazione ? intestazione.getBoundingClientRect().height : 0;
    if (misura >= 10 && Math.abs(misura - this.altezzaIntestazione) > 0.5) {
      this.altezzaIntestazione = misura;
      this.requestUpdate();
    }
    if (changedProperties.has("tabId") || changedProperties.has("document")) {
      this.initDocument();
    }
    if (changedProperties.has("zoom")) {
      this.updateViewport();
    }
  }

  private getDoc(): SheetDocument {
    const doc = this.document ?? defaultDocumentStore.getOrCreateDocument(this.tabId);
    // la protezione dei fogli controlla ogni passo della cronologia (la cronologia si rifà aprendo un file: si ricollega qui)
    if (!doc.history.guardiano) {
      doc.history.guardiano = (passo) => motivoPasso(doc, passo);
      doc.history.rifiutato = (motivo) => { void this.respingi(motivo); };
    }
    return doc;
  }

  // ---- strumenti: mostra formule, ricerca obiettivo ----
  public alternaMostraFormule(): boolean {
    this.mostraFormule = !this.mostraFormule;
    this.formuleMostrate = new Map();
    void this.fetchVisibleCells(this.visibleRange).then(() => this.requestUpdate());
    this.avvisaStato(this.mostraFormule ? t('Formule visibili nelle celle (Ctrl+` per i risultati)') : t('Risultati visibili nelle celle'));
    this.requestUpdate();
    return this.mostraFormule;
  }
  public formuleVisibili(): boolean { return this.mostraFormule; }

  /** Dati › Ricerca obiettivo: cambia la cella «variabile» perché la formula di «obiettivo» dia «valore». Il risultato si tiene (un passo
   *  di annulla); se non si trova, la cella torna com'era. Restituisce il messaggio per l'utente (già tradotto) e se ha trovato. */
  public async ricercaObiettivo(obiettivo: string, valoreTesto: string, variabile: string): Promise<{ ok: boolean; messaggio: string }> {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    const o = parseCellAddress(obiettivo.trim().toUpperCase());
    const v = parseCellAddress(variabile.trim().toUpperCase());
    // il numero come lo si scrive in una cella (virgola decimale, punti delle migliaia, percentuale...)
    const valore = Number(interpretaInput(valoreTesto.trim()).raw);
    if (!o) return { ok: false, messaggio: t('La cella con la formula non è un indirizzo valido (per esempio B5)') };
    if (!v) return { ok: false, messaggio: t('La cella da cambiare non è un indirizzo valido (per esempio A1)') };
    if (!Number.isFinite(valore)) return { ok: false, messaggio: t('Il valore da raggiungere deve essere un numero') };
    const cellaO = await doc.client.getCell(foglio, o.row, o.col);
    if (!cellaO.raw.startsWith('=')) return { ok: false, messaggio: t('La cella con la formula deve contenere una formula') };
    const cellaV = await doc.client.getCell(foglio, v.row, v.col);
    if (cellaV.raw.startsWith('=')) return { ok: false, messaggio: t('La cella da cambiare deve contenere un valore, non una formula') };
    if (cellaProtetta(doc, foglio, v.row, v.col)) return { ok: false, messaggio: t(MOTIVO_CELLA) };
    const prima = cellaV.raw;
    const x0 = cellaV.value.kind === 'number' ? cellaV.value.value : 0;
    const esito = await ricercaObiettivoPura(async (x) => {
      await doc.client.setCell(foglio, v.row, v.col, String(x));
      const r = await doc.client.getCell(foglio, o.row, o.col);
      return r.value.kind === 'number' ? r.value.value : null;
    }, valore, x0);
    if (!esito.trovato) {
      if (prima === '') await doc.client.clearCell(foglio, v.row, v.col); else await doc.client.setCell(foglio, v.row, v.col, prima);
      return { ok: false, messaggio: t('Nessuna soluzione trovata: la formula non arriva a {}', valoreTesto) };
    }
    const nuovo = String(Number(esito.x.toPrecision(15)));
    await doc.client.setCell(foglio, v.row, v.col, nuovo);
    doc.history.pushStep({ description: t('Ricerca obiettivo'), changes: [{ sheet: foglio, row: v.row, col: v.col, oldRaw: prima, newRaw: nuovo }] });
    this.updateFormulaBarValue();
    this.requestUpdate();
    return { ok: true, messaggio: t('Ricerca obiettivo: {} = {} dà {} = {}', variabile.toUpperCase(), nuovo.replace('.', ','), obiettivo.toUpperCase(), String(Number((esito.valore ?? 0).toPrecision(12))).replace('.', ',')) };
  }
  /** Strumenti › Mostra precedenti / dipendenti: evidenzia (con i bordi colorati delle formule) le celle che la formula della cella attiva
   *  usa, o le formule che usano la cella attiva; il messaggio elenca gli indirizzi (anche di altri fogli). */
  public async mostraTracce(tipo: 'precedenti' | 'dipendenti'): Promise<string> {
    const doc = this.getDoc();
    const a = doc.selection.anchor;
    const foglio = doc.activeSheetName;
    const nome = (f: string, r: number, c: number, r2 = r, c2 = c): string => `${f !== foglio ? `${f}!` : ''}${columnIndexToLetters(c)}${r}${r2 !== r || c2 !== c ? `:${columnIndexToLetters(c2)}${r2}` : ''}`;
    let trovati: Array<{ foglio: string; r1: number; c1: number; r2: number; c2: number }>;
    if (tipo === 'precedenti') {
      const raw = (await doc.client.getCell(foglio, a.row, a.col)).raw;
      if (!raw.startsWith('=')) { this.formulaRefHighlights = []; return t('La cella attiva non contiene una formula'); }
      trovati = riferimentiFormula(raw, foglio);
    } else {
      const formule = formuleDellaCartella(String(await doc.client.serialize()));
      trovati = dipendenti(formule, foglio, a.row, a.col).map((d) => ({ foglio: d.foglio, r1: d.riga, c1: d.colonna, r2: d.riga, c2: d.colonna }));
    }
    const colore = tipo === 'precedenti' ? '#2563eb' : '#dc2626';
    // si disegnano quelli del foglio attivo (righe e colonne intere tagliate, per non disegnare un milione di righe)
    this.formulaRefHighlights = trovati.filter((x) => x.foglio.toLowerCase() === foglio.toLowerCase())
      .map((x) => ({ r1: x.r1, c1: x.c1, r2: Math.min(x.r2, x.r1 + 2000), c2: Math.min(x.c2, x.c1 + 200), color: colore }));
    this.requestUpdate();
    if (trovati.length === 0) return tipo === 'precedenti' ? t('La formula non usa altre celle') : t('Nessuna formula usa {}', nome(foglio, a.row, a.col));
    const elenco = trovati.slice(0, 12).map((x) => nome(x.foglio, x.r1, x.c1, x.r2, x.c2)).join(', ') + (trovati.length > 12 ? ', …' : '');
    return tipo === 'precedenti' ? t('Precedenti di {}: {}', nome(foglio, a.row, a.col), elenco) : t('Dipendenti di {}: {}', nome(foglio, a.row, a.col), elenco);
  }
  public togliTracce(): void { this.formulaRefHighlights = []; this.requestUpdate(); }

  /** Le colonne della tabella selezionata con il nome dell'intestazione (prima riga della selezione), per la finestra dei subtotali;
   *  null se la selezione non è una tabella (almeno l'intestazione e una riga di dati). */
  public async colonneTabellaSelezionata(): Promise<Array<{ col: number; nome: string }> | null> {
    const doc = this.getDoc();
    const r = doc.selection.range;
    if (r.endRow - r.startRow < 1 || r.endCol - r.startCol > 200) return null;
    const out: Array<{ col: number; nome: string }> = [];
    for (let c = r.startCol; c <= r.endCol; c++) {
      const v = (await doc.client.getCell(doc.activeSheetName, r.startRow, c)).value;
      const testo = formatDisplayValue(v).text;
      out.push({ col: c, nome: testo !== '' ? testo : t('Colonna {}', columnIndexToLetters(c)) });
    }
    return out;
  }

  /** Dati › Subtotali: le righe dei totali a ogni cambio della colonna del gruppo e il totale complessivo, come Excel (sheet/subtotali.ts).
   *  Un solo passo di annulla. Restituisce il messaggio per l'utente. */
  public async subtotali(colonnaGruppo: number, colonne: number[], funzione: number): Promise<string> {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    const r = doc.selection.range;
    if (colonne.length === 0) return t('Scegli almeno una colonna a cui aggiungere il subtotale');
    if (this.selezioneProtetta() || this.strutturaFoglioProtetta()) return t(MOTIVO_FOGLIO);
    const valori: string[] = [];
    for (let riga = r.startRow + 1; riga <= r.endRow; riga++) valori.push(formatDisplayValue((await doc.client.getCell(foglio, riga, colonnaGruppo)).value).text);
    const piano = pianoSubtotali(valori, r.startRow + 1, colonnaGruppo, colonne, funzione, (v) => t('{} Totale', v), t('Totale complessivo'));
    const prima = await this.istantaneaStruttura();
    for (const riga of piano.inserisci) await this.applicaStruttura({ tipo: 'insert_rows', indice: riga, conta: 1 });
    await doc.client.applyBatch(piano.celle.map((x) => ({ type: 'set' as const, sheet: foglio, row: x.riga, col: x.colonna, raw: x.raw })));
    const dopo = await this.istantaneaStruttura();
    doc.history.pushStep({ description: t('Subtotali'), undoAction: () => this.ripristinaIstantanea(prima), redoAction: () => this.ripristinaIstantanea(dopo) });
    this.cellsCache.clear();
    this.updateViewport();
    this.requestUpdate();
    return t('Subtotali aggiunti: {} gruppi', String(piano.inserisci.length - 1));
  }
  private strutturaFoglioProtetta(): boolean { return !!this.getDoc().protezione; }

  /** Formato › Maiuscole e minuscole: cambia il testo delle celle di testo della selezione (le formule e i numeri restano), un passo di annulla. */
  public async cambiaMaiuscole(modo: Exclude<ModoMaiuscole, 'giro'>): Promise<string> {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    const r = doc.selection.range;
    if ((r.endRow - r.startRow + 1) * (r.endCol - r.startCol + 1) > 100000) return t('Selezione troppo grande: al massimo 100.000 celle');
    if (this.selezioneProtetta()) return t(MOTIVO_CELLA);
    const changes: Array<{ sheet: string; row: number; col: number; oldRaw: string; newRaw: string }> = [];
    for (let riga = r.startRow; riga <= r.endRow; riga++) {
      for (let col = r.startCol; col <= r.endCol; col++) {
        const c = await doc.client.getCell(foglio, riga, col);
        if (c.raw === '' || c.raw.startsWith('=') || c.value.kind !== 'text') continue;
        const nuovo = trasformaMaiuscole(c.raw, modo);
        if (nuovo !== c.raw) changes.push({ sheet: foglio, row: riga, col, oldRaw: c.raw, newRaw: nuovo });
      }
    }
    if (changes.length === 0) return t('Nessuna cella di testo da cambiare');
    await doc.client.applyBatch(changes.map((x) => ({ type: 'set' as const, sheet: foglio, row: x.row, col: x.col, raw: x.newRaw })));
    doc.history.pushStep({ description: t('Maiuscole e minuscole'), changes });
    this.updateFormulaBarValue();
    this.requestUpdate();
    return changes.length === 1 ? t('1 cella cambiata') : t('{} celle cambiate', String(changes.length));
  }

  /** I testi delle celle della selezione come si vedono (con il formato), riga per riga, per leggerli ad alta voce (al massimo 2000). */
  public async testiDaLeggere(): Promise<string[]> {
    const doc = this.getDoc();
    const r = doc.selection.range;
    const out: string[] = [];
    for (let riga = r.startRow; riga <= r.endRow && out.length < 2000; riga++) {
      for (let col = r.startCol; col <= r.endCol && out.length < 2000; col++) {
        const c = await doc.client.getCell(doc.activeSheetName, riga, col);
        if (c.value.kind === 'empty') continue;
        const st = resolveCellStyle(riga, col, doc.styles);
        out.push(st.numFmt ? formatCellValue(c.value, st.numFmt) : formatDisplayValue(c.value).text);
      }
    }
    return out;
  }

  /** Valuta formula: la formula della cella attiva (come la si scrive) e i suoi pezzi con il valore, dal più interno. */
  public async passiValutazione(): Promise<{ cella: string; formula: string; passi: Array<{ testo: string; valore: string }> }> {
    const doc = this.getDoc();
    const a = doc.selection.anchor;
    const cella = `${columnIndexToLetters(a.col)}${a.row}`;
    const raw = (await doc.client.getCell(doc.activeSheetName, a.row, a.col)).raw;
    if (!raw.startsWith('=') || formulaNascosta(doc, a.row, a.col)) return { cella, formula: formulaNascosta(doc, a.row, a.col) ? '' : raw, passi: [] };
    const passi = await doc.client.valutaPassi(doc.activeSheetName, a.row, a.col, raw);
    const testo = (v: CellValue | null): string => {
      if (v === null) return '…';
      if (v.kind === 'array') return `{${v.values.slice(0, 3).map((r) => r.slice(0, 6).map((x) => formatDisplayValue(x).text).join('; ')).join(' | ')}${v.values.length > 3 || (v.values[0]?.length ?? 0) > 6 ? ' …' : ''}}`;
      return formatDisplayValue(v).text;
    };
    return { cella, formula: perInputUtente(raw), passi: passi.map((p) => ({ testo: perInputUtente(`=${p.testo}`).slice(1), valore: testo(p.valore) })) };
  }

  /** Finestra controllo: valore e formula delle celle date (anche di altri fogli). */
  public async valoriOsservati(celle: Array<{ foglio: string; riga: number; colonna: number }>): Promise<Array<{ foglio: string; cella: string; valore: string; formula: string }>> {
    const doc = this.getDoc();
    const fogli = await doc.client.listSheets();
    const out: Array<{ foglio: string; cella: string; valore: string; formula: string }> = [];
    for (const c of celle) {
      const cella = `${columnIndexToLetters(c.colonna)}${c.riga}`;
      if (!fogli.includes(c.foglio)) { out.push({ foglio: c.foglio, cella, valore: '#RIF!', formula: '' }); continue; }
      const d = await doc.client.getCell(c.foglio, c.riga, c.colonna);
      out.push({ foglio: c.foglio, cella, valore: formatDisplayValue(d.value).text, formula: d.raw.startsWith('=') ? perInputUtente(d.raw) : '' });
    }
    return out;
  }
  /** La cella attiva con il suo foglio (per aggiungerla alla finestra controllo). */
  public cellaAttivaConFoglio(): { foglio: string; riga: number; colonna: number } {
    const doc = this.getDoc();
    return { foglio: doc.activeSheetName, riga: doc.selection.anchor.row, colonna: doc.selection.anchor.col };
  }

  /** La cella attiva, per proporla nella finestra della ricerca obiettivo. */
  public cellaAttiva(): string { return this.activeCellAddress.split(':')[0]; }

  // ---- protezione del foglio e della cartella (vedi sheet/protezione.ts) ----
  /** Un'operazione che la protezione non permette è appena stata fatta: la si annulla subito, senza poterla ripetere, e si avvisa. */
  private respingendo = false;
  private async respingi(motivo: string): Promise<void> {
    if (this.respingendo) return;
    this.respingendo = true;
    try {
      const doc = this.getDoc();
      await this.undo();
      doc.history.scartaUltimoRipeti();
      this.avvisaStato(t(motivo));
    } finally { this.respingendo = false; }
  }
  /** true (e avvisa) se la cella attiva, o una cella della selezione, non si può cambiare. */
  private selezioneProtetta(): boolean {
    const doc = this.getDoc();
    if (!doc.protezione) return false;
    const r = doc.selection.range;
    if (intervalloProtetto(doc, doc.activeSheetName, r.startRow, r.startCol, r.endRow, r.endCol)) {
      this.avvisaStato(t(MOTIVO_CELLA));
      return true;
    }
    return false;
  }
  /** true (e avvisa) se la struttura della cartella è protetta. */
  private strutturaProtetta(): boolean {
    if (!this.getDoc().protezioneCartella) return false;
    this.avvisaStato(t(MOTIVO_CARTELLA));
    return true;
  }
  /** Lo stato della protezione del foglio attivo e della cartella (per i menu e le finestre). */
  public statoProtezione(): { foglio: boolean; foglioConPassword: boolean; cartella: boolean; cartellaConPassword: boolean; nome: string } {
    const doc = this.getDoc();
    return { foglio: !!doc.protezione, foglioConPassword: !!doc.protezione?.impronte, cartella: !!doc.protezioneCartella, cartellaConPassword: !!doc.protezioneCartella?.impronte, nome: doc.activeSheetName };
  }
  /** Protegge il foglio attivo (password vuota: senza password). Non è un passo di annulla, come in Excel. */
  public async proteggiFoglio(password: string): Promise<void> {
    const doc = this.getDoc();
    impostaProtezioneFoglio(doc, doc.activeSheetName, password === '' ? {} : { impronte: await impronteNuove(password) });
    this.updateFormulaBarValue();
    this.requestUpdate();
  }
  /** Toglie la protezione del foglio attivo: false se la password non è quella giusta. */
  public async togliProtezioneFoglio(password: string): Promise<boolean> {
    const doc = this.getDoc();
    if (!doc.protezione) return true;
    if (!(await verificaPassword(password, doc.protezione.impronte))) return false;
    impostaProtezioneFoglio(doc, doc.activeSheetName, undefined);
    this.updateFormulaBarValue();
    this.requestUpdate();
    return true;
  }
  public async proteggiCartella(password: string): Promise<void> {
    const doc = this.getDoc();
    doc.protezioneCartella = password === '' ? {} : { impronte: await impronteNuove(password) };
    this.emitSheets();
    this.requestUpdate();
  }
  public async togliProtezioneCartella(password: string): Promise<boolean> {
    const doc = this.getDoc();
    if (!doc.protezioneCartella) return true;
    if (!(await verificaPassword(password, doc.protezioneCartella.impronte))) return false;
    doc.protezioneCartella = undefined;
    this.emitSheets();
    this.requestUpdate();
    return true;
  }

  private initDocument() {
    const doc = this.getDoc();
    if (this.unregisterChange) {
      this.unregisterChange();
    }

    this.unregisterChange = doc.client.onChange((changes: CellChange[]) => {
      this.handleEngineChanges(changes);
    });

    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.updateFormulaBarValue();
    this.refreshSheetList();
    this.updateViewport();
  }

  private async updateFormulaBarValue() {
    const doc = this.getDoc();
    const active = doc.selection.anchor;
    const cellData = await doc.client.getCell(doc.activeSheetName, active.row, active.col);
    // con il foglio protetto una formula nascosta non si mostra (come in Excel: la barra resta vuota)
    this.formulaBarValue = formulaNascosta(doc, active.row, active.col) ? '' : perInputUtente(cellData.raw);
  }

  private handleEngineChanges(changes: CellChange[]) {
    const doc = this.getDoc();
    let affectsVisible = false;
    const v = this.visibleRange;

    for (const c of changes) {
      if (c.sheet === doc.activeSheetName) {
        affectsVisible = true;
      }
    }

    if (affectsVisible) {
      this.fetchVisibleCells(v);
      this.updateFormulaBarValue();
      this.updateSelectionStats();
    }
  }

  /** L'altezza reale dell'intestazione delle colonne in pixel (non cambia con lo zoom): serve per posizionare editor, maniglia e righe bloccate. */
  private altezzaIntestazione = 24;

  // Geometria del foglio per questo disegno: righe nascoste o di altezza diversa e colonne nascoste (larghezza 0). Si ricalcola a ogni disegno.
  private _geomCache?: GeometriaRighe;
  private _largCache?: Map<number, number>;

  private geomRighe(): GeometriaRighe {
    if (this._geomCache) return this._geomCache;
    const doc = this.getDoc();
    return new GeometriaRighe(DEFAULT_ROW_HEIGHT, 1048576, doc.rowHeights, doc.hiddenRows);
  }

  /** Le larghezze delle colonne con quelle nascoste a 0. */
  private larghezzeEffettive(): Map<number, number> {
    if (this._largCache) return this._largCache;
    const doc = this.getDoc();
    if (!doc.hiddenCols || doc.hiddenCols.size === 0) return doc.colWidths;
    const m = new Map(doc.colWidths);
    for (const c of doc.hiddenCols) m.set(c, 0);
    return m;
  }

  private updateViewport() {
    const container = this.renderRoot.querySelector(".grid-container") as HTMLElement;
    const w = container ? container.clientWidth : 1000;
    const h = container ? container.clientHeight : 600;
    const doc = this.getDoc();

    this.visibleRange = computeVisibleRange({
      scrollTop: doc.scroll.top,
      scrollLeft: doc.scroll.left,
      viewportWidth: w,
      viewportHeight: h,
      zoom: this.zoom,
      colWidths: this.larghezzeEffettive(),
      righe: this.geomRighe(),
    });

    this.fetchVisibleCells(this.visibleRange);
  }

  private async fetchVisibleCells(v: VisibleRange) {
    const doc = this.getDoc();
    const cols = v.endCol - v.startCol + 1;
    if (v.endRow < v.startRow || cols <= 0) return;

    // le righe nascoste non si leggono: si leggono a blocchi le righe che si vedono, più quelle bloccate in alto e le colonne bloccate a sinistra
    const geom = this.geomRighe();
    const blocchi: Array<[number, number]> = [];
    const aggiungi = (da: number, a: number) => { if (a >= da) blocchi.push([da, a]); };
    const fr = Math.min(doc.freezeRows || 0, 200);
    for (let r = 1; r <= fr && r < v.startRow; r++) if (!geom.nascosta(r)) aggiungi(r, r);
    for (let r = geom.prossimaVisibile(v.startRow); r <= v.endRow;) {
      let fine = r;
      while (fine + 1 <= v.endRow && !geom.nascosta(fine + 1)) fine++;
      aggiungi(r, fine);
      r = geom.prossimaVisibile(fine + 1);
    }
    const fc = Math.min(doc.freezeCols || 0, 200);
    const colonneBloccate = fc > 0 && v.startCol > 1 ? Math.min(fc, v.startCol - 1) : 0;

    try {
      const newMap = new Map<string, { raw: string; value: CellValue }>(this.cellsCache);
      const scrivi = (rigaIniz: number, colIniz: number, matrix: CellValue[][]) => {
        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < (matrix[r]?.length ?? 0); c++) {
            const key = `${rigaIniz + r}:${colIniz + c}`;
            const val = matrix[r][c] ?? { kind: "empty" as const };
            const existing = this.cellsCache.get(key);
            let rawVal = existing ? existing.raw : "";
            if (!rawVal) {
              if (val.kind === 'boolean') rawVal = val.value ? 'TRUE' : 'FALSE';
              else if (val.kind === 'number') rawVal = String(val.value);
              else if (val.kind === 'text') rawVal = val.value;
            }
            newMap.set(key, { raw: rawVal, value: val });
          }
        }
      };
      for (const [da, a] of blocchi) {
        scrivi(da, v.startCol, await doc.client.getRange(doc.activeSheetName, da, v.startCol, a, v.endCol));
        if (colonneBloccate > 0) scrivi(da, 1, await doc.client.getRange(doc.activeSheetName, da, 1, a, colonneBloccate));
      }
      this.cellsCache = newMap;
      if (this.mostraFormule) {
        const formule = new Map<string, string>();
        for (const [k, x] of newMap) {
          if (x.value.kind === 'empty') continue;
          const [rr, cc] = k.split(':').map(Number);
          if (rr < v.startRow || rr > v.endRow) continue;
          const raw = (await doc.client.getCell(doc.activeSheetName, rr, cc)).raw;
          if (raw.startsWith('=')) formule.set(k, raw);
        }
        this.formuleMostrate = formule;
      }
    } catch {
      // Ignora errori temporanei durante batch
    }
    void this.aggiornaGrafici();
    void this.aggiornaPivot();
  }

  /** La "firma" delle righe nascoste di ogni foglio comunicate l'ultima volta al motore. */
  private firmeNascoste = new Map<string, string>();

  /** Comunica al motore le righe nascoste del foglio attivo, distinguendo quelle nascoste a mano da quelle nascoste da un filtro
   *  (SUBTOTAL 1-11 salta solo le seconde, 101-111 e AGGREGATE anche le prime). Restituisce vero se qualcosa è cambiato. */
  private async sincronizzaRigheNascoste(): Promise<boolean> {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    const nascoste = doc.hiddenRows ?? new Set<number>();
    let somma = 0;
    let xor = 0;
    for (const r of nascoste) { somma += r; xor ^= r; }
    const filtroAttivo = doc.isFilterActive && doc.activeFilters.size > 0;
    const firma = `${nascoste.size}|${somma}|${xor}|${filtroAttivo ? doc.activeFilters.size : 0}`;
    if (this.firmeNascoste.get(foglio) === firma) return false;
    this.firmeNascoste.set(foglio, firma);
    let filtrate = new Set<number>();
    if (filtroAttivo) {
      try {
        const { filterRange, getVal, extra } = this.contestoFiltro();
        filtrate = computeHiddenRowsFromFilters(filterRange, doc.activeFilters, getVal, extra);
      } catch { filtrate = new Set<number>(); }
    }
    const daFiltro = [...filtrate].filter((r) => nascoste.has(r));
    const aMano = [...nascoste].filter((r) => !filtrate.has(r));
    try {
      await doc.client.setHiddenRows(foglio, aMano, daFiltro);
    } catch { return false; }
    return true;
  }

  private aggiornandoGrafici = false;
  private graficiDaRifare = false;

  /** I grafici sono viste vive dei dati: categorie e serie si rileggono dall'intervallo ogni volta che i dati possono essere cambiati. */
  private async aggiornaGrafici(): Promise<void> {
    const doc = this.getDoc();
    if (!doc.charts || doc.charts.length === 0) return;
    if (this.aggiornandoGrafici) { this.graficiDaRifare = true; return; }
    this.aggiornandoGrafici = true;
    try {
      do {
        this.graficiDaRifare = false;
        const cambiati = new Map<string, { categories: string[]; series: ChartConfig['series'] }>();
        for (const g of [...doc.charts]) {
          const a = leggiIntervalloTesto(g.dataRange);
          if (!a || (a.endRow - a.startRow + 1) * (a.endCol - a.startCol + 1) > 20000) continue;
          const valori = await doc.client.getRange(g.sheetName || doc.activeSheetName, a.startRow, a.startCol, a.endRow, a.endCol);
          const nuovo = graficoAggiornato(g, valori);
          if (nuovo !== g) cambiati.set(g.id, { categories: nuovo.categories, series: nuovo.series });
        }
        if (cambiati.size > 0) {
          doc.charts = doc.charts.map((c) => (cambiati.has(c.id) ? { ...c, ...cambiati.get(c.id)! } : c));
          this.requestUpdate();
        }
      } while (this.graficiDaRifare);
    } catch {
      // un errore temporaneo del motore non deve rompere il disegno
    } finally {
      this.aggiornandoGrafici = false;
    }
  }

  /** Quanto spazio libero (in pixel, già con lo zoom) c'è a destra della cella di testo (r, c): le celle vuote vicine, fino alla prima che ha qualcosa o è unita. */
  private spazioLiberoADestra(r: number, c: number, ultimaColonna: number, zoomFactor: number): number {
    const doc = this.getDoc();
    let extra = 0;
    for (let k = c + 1; k <= ultimaColonna; k++) {
      const vicina = this.getCellData(r, k);
      if (vicina.raw !== '' || vicina.value.kind !== 'empty') break;
      if (getCellMergeInfo(r, k, doc.merges)) break;
      extra += getColWidth(k, this.larghezzeEffettive()) * zoomFactor;
    }
    return extra;
  }

  private getCellData(row: number, col: number): { raw: string; value: CellValue } {
    const key = `${row}:${col}`;
    return this.cellsCache.get(key) || { raw: "", value: { kind: "empty" } };
  }

  private handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    const doc = this.getDoc();
    defaultDocumentStore.updateScroll(doc.tabId, target.scrollLeft, target.scrollTop);
    this.updateViewport();
  };

  private handleResize = () => {
    this.updateViewport();
  };

  public emitActiveFormat() {
    const doc = this.getDoc();
    const act = doc.selection.anchor;
    const format = resolveCellStyle(act.row, act.col, doc.styles);
    this.dispatchEvent(
      new CustomEvent("active-format-changed", {
        detail: { format },
        bubbles: true,
        composed: true,
      })
    );
  }

  // --- SELEZIONE E NAVIGAZIONE ---

  private selectSingle(row: number, col: number) {
    const doc = this.getDoc();
    doc.selection = createCellSelection(row, col);
    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.updateFormulaBarValue();
    this.updateSelectionStats();
    this.ensureCellVisible(row, col);
    this.emitActiveFormat();
    this.requestUpdate();
  }

  private extendSelectionTo(row: number, col: number) {
    const doc = this.getDoc();
    const extra = doc.selection.extra;
    doc.selection = createRangeSelection(
      doc.selection.anchor.row,
      doc.selection.anchor.col,
      row,
      col
    );
    if (extra && extra.length > 0) doc.selection.extra = extra;
    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.updateSelectionStats();
    this.ensureCellVisible(row, col);
    this.emitActiveFormat();
    this.requestUpdate();
  }

  private handleCellMouseDown(row: number, col: number, e: MouseEvent) {
    this.selectedImageId = null;
    // Alt+clic su una cella con un link: lo apre (il Ctrl+clic serve alla selezione multipla)
    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
      const indirizzo = resolveCellStyle(row, col, this.getDoc().styles).link;
      if (indirizzo) { e.preventDefault(); this.apriLink(indirizzo); }
    }
    // Se stavamo modificando una formula e clicchiamo su una cella dopo un operatore o '('
    if (this.isEditing && this.editValue.startsWith("=")) {
      const trimmed = this.editValue.trimEnd();
      const lastChar = trimmed[trimmed.length - 1];
      if (/[\+\-\*\/\&\=\<\>\,\;\(]/.test(lastChar)) {
        const addr = `${columnIndexToLetters(col)}${row}`;
        this.editValue += addr;
        this.formulaBarValue = this.editValue;
        this.parseFormulaHighlights(this.editValue);
        return;
      }
    }

    if (this.contextMenu) {
      this.closeContextMenu();
    }
    if (this.elencoAperto) this.elencoAperto = null;

    if (this.isEditing) {
      this.commitEdit();
    }

    if (e.shiftKey) {
      this.extendSelectionTo(row, col);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+clic: la nuova cella si aggiunge a quelle già selezionate (trascinando si allarga solo l'ultimo intervallo)
      const doc2 = this.getDoc();
      this.isDragging = true;
      doc2.selection = aggiungiCellaASelezione(doc2.selection, row, col);
      this.activeCellAddress = formatSelectionAddress(doc2.selection);
      this.nameBoxValue = this.activeCellAddress;
      this.updateFormulaBarValue();
      this.updateSelectionStats();
      this.emitActiveFormat();
      this.requestUpdate();
    } else {
      this.isDragging = true;
      this.selectSingle(row, col);
    }

    if (this.isFormatPainterActive && this.formatPainterStyle) {
      this.applyFormat(this.formatPainterStyle, t("Pennello formato"));
      this.isFormatPainterActive = false;
      this.formatPainterStyle = null;
      this.dispatchEvent(new CustomEvent("status-message", {
        detail: { message: "Pronto" },
        bubbles: true,
        composed: true,
      }));
    }
  }

  private handleCellMouseEnter(row: number, col: number, _e: MouseEvent) {
    if (this.isDragging) {
      this.extendSelectionTo(row, col);
    }
  }

  private iniziaTrascinaIntestazione(tipo: 'col' | 'riga', n: number, e: MouseEvent) {
    if (e.button !== 0 || e.shiftKey) return;
    const origine = e.composedPath()[0] as HTMLElement | undefined;
    if (origine?.classList?.contains('col-resizer') || origine?.classList?.contains('row-resizer') || origine?.classList?.contains('col-filter-btn')) return;
    this.trascinaIntestazione = { tipo, da: n };
  }

  private trascinaSuIntestazione(tipo: 'col' | 'riga', n: number) {
    const t = this.trascinaIntestazione;
    if (!t || t.tipo !== tipo || t.da === n) return;
    const doc = this.getDoc();
    doc.selection = tipo === 'col' ? createColSelection(t.da, n) : createRowSelection(t.da, n);
    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.updateSelectionStats();
    this.requestUpdate();
  }

  private handleColHeaderClick(col: number, e: MouseEvent) {
    if (this.isEditing) this.commitEdit();
    const doc = this.getDoc();
    if (e.shiftKey) {
      doc.selection = createColSelection(doc.selection.anchor.col, col);
    } else {
      doc.selection = createColSelection(col);
    }
    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.updateSelectionStats();
    this.emitActiveFormat();
    this.requestUpdate();
  }

  private handleRowHeaderClick(row: number, e: MouseEvent) {
    if (this.isEditing) this.commitEdit();
    const doc = this.getDoc();
    if (e.shiftKey) {
      doc.selection = createRowSelection(doc.selection.anchor.row, row);
    } else {
      doc.selection = createRowSelection(row);
    }
    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.updateSelectionStats();
    this.emitActiveFormat();
    this.requestUpdate();
  }

  private handleSelectAll() {
    if (this.isEditing) this.commitEdit();
    const doc = this.getDoc();
    doc.selection = createAllSelection();
    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.updateSelectionStats();
    this.emitActiveFormat();
    this.requestUpdate();
  }

  /** Quando la griglia ha appena dato un avviso (convalida, incolla impossibile) le statistiche della selezione non lo coprono con "Pronto". */
  private ultimoAvviso = 0;
  private avvisaStato(message: string): void {
    this.ultimoAvviso = Date.now();
    this.dispatchEvent(new CustomEvent('status-message', { detail: { message }, bubbles: true, composed: true }));
  }
  private messaggioPronto(): string | undefined {
    return Date.now() - this.ultimoAvviso < 2000 ? undefined : 'Pronto';
  }

  private async updateSelectionStats() {
    const doc = this.getDoc();
    const sel = doc.selection;
    const rCount = sel.range.endRow - sel.range.startRow + 1;
    const cCount = sel.range.endCol - sel.range.startCol + 1;
    const totalCells = sel.extra && sel.extra.length > 0 ? intervalliSelezione(sel).reduce((n, r) => n + (r.endRow - r.startRow + 1) * (r.endCol - r.startCol + 1), 0) : rCount * cCount;

    if (totalCells <= 1) {
      this.dispatchEvent(new CustomEvent("status-message", { detail: { message: this.messaggioPronto(), statsMessage: "" }, bubbles: true, composed: true }));
      return;
    }

    // Limita la lettura delle celle per la barra di stato a massimo 2.000 celle
    const matrix: CellValue[][] = [];
    for (const rg of intervalliSelezione(sel).slice(-20)) {
      const rc = rg.endRow - rg.startRow + 1;
      const cc = rg.endCol - rg.startCol + 1;
      const fetchRows = Math.min(rc, 2000);
      const fetchCols = Math.min(cc, Math.floor(2000 / fetchRows));
      matrix.push(...await doc.client.getRange(doc.activeSheetName, rg.startRow, rg.startCol, rg.startRow + fetchRows - 1, rg.startCol + fetchCols - 1));
    }

    let sum = 0;
    let numCount = 0;

    for (const row of matrix) {
      for (const cell of row) {
        if (cell.kind === "number") {
          sum += cell.value;
          numCount++;
        }
      }
    }

    if (numCount > 1) {
      const avg = sum / numCount;
      const statsStr = t("Somma: {} · Media: {} · Conteggio: {}", parseFloat(sum.toFixed(4)), parseFloat(avg.toFixed(4)), numCount);
      this.dispatchEvent(new CustomEvent("status-message", { detail: { message: this.messaggioPronto(), statsMessage: statsStr }, bubbles: true, composed: true }));
    } else {
      this.dispatchEvent(new CustomEvent("status-message", { detail: { message: this.messaggioPronto(), statsMessage: "" }, bubbles: true, composed: true }));
    }
  }

  private ensureCellVisible(row: number, col: number) {
    const container = this.renderRoot.querySelector(".grid-container") as HTMLElement;
    if (!container) return;

    const zoomFactor = this.zoom / 100;
    const geom = this.geomRighe();

    // Calcolo Y
    const cellTop = geom.top(row) * zoomFactor;
    const cellBottom = geom.top(row + 1) * zoomFactor;
    const vTop = container.scrollTop;
    const vBottom = vTop + container.clientHeight - 32;

    if (cellTop < vTop) {
      container.scrollTop = cellTop;
    } else if (cellBottom > vBottom) {
      container.scrollTop = cellBottom - container.clientHeight + 32;
    }

    // Calcolo X
    let cellLeft = 0;
    for (let c = 1; c < col; c++) {
      cellLeft += getColWidth(c, this.larghezzeEffettive()) * zoomFactor;
    }
    const cellWidth = getColWidth(col, this.larghezzeEffettive()) * zoomFactor;
    const cellRight = cellLeft + cellWidth;
    const vLeft = container.scrollLeft;
    const vRight = vLeft + container.clientWidth - 44;

    if (cellLeft < vLeft) {
      container.scrollLeft = cellLeft;
    } else if (cellRight > vRight) {
      container.scrollLeft = cellRight - container.clientWidth + 44;
    }
  }

  // --- RIDIMENSIONAMENTO COLONNE E RIGHE (M1) ---

  private handleResizerMouseDown(col: number, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    this.isResizingCol = true;
    this.resizeColIndex = col;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = getColWidth(col, this.larghezzeEffettive());
  }

  private handleResizerDblClick(col: number, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    // Auto-fit calcolato sui contenuti visibili della colonna
    const doc = this.getDoc();
    let maxLen = 3;
    for (let r = this.visibleRange.startRow; r <= this.visibleRange.endRow; r++) {
      const data = this.getCellData(r, col);
      const disp = formatDisplayValue(data.value);
      if (disp.text.length > maxLen) {
        maxLen = disp.text.length;
      }
    }
    const autoWidth = Math.min(500, Math.max(50, maxLen * 9 + 20));
    defaultDocumentStore.setColWidth(doc.tabId, col, autoWidth);
    this.updateViewport();
    this.requestUpdate();
  }

  private handleRowResizerMouseDown(row: number, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    this.isResizingRow = true;
    this.resizeRowIndex = row;
    this.resizeStartY = e.clientY;
    const doc = this.getDoc();
    const curH = doc.rowHeights && doc.rowHeights.has(row) ? doc.rowHeights.get(row)! : DEFAULT_ROW_HEIGHT;
    this.resizeStartHeight = curH;
  }

  private handleRowResizerDblClick(row: number, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const doc = this.getDoc();
    if (!doc.rowHeights) doc.rowHeights = new Map<number, number>();
    doc.rowHeights.set(row, DEFAULT_ROW_HEIGHT);
    this.updateViewport();
    this.requestUpdate();
  }

  // --- FILL HANDLE DRAG (M1) ---

  private handleFillHandleMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    this.isFillDragging = true;
    const doc = this.getDoc();
    this.fillDragTarget = { ...doc.selection.active };
  };

  private handleWindowMouseMove = (e: MouseEvent) => {
    if (this.isResizingCol) {
      const deltaX = (e.clientX - this.resizeStartX) / (this.zoom / 100);
      const newWidth = Math.max(30, Math.min(1000, this.resizeStartWidth + deltaX));
      const doc = this.getDoc();
      defaultDocumentStore.setColWidth(doc.tabId, this.resizeColIndex, newWidth);
      this.updateViewport();
      this.requestUpdate();
      return;
    }

    if (this.isResizingRow) {
      const deltaY = (e.clientY - this.resizeStartY) / (this.zoom / 100);
      const newHeight = Math.max(16, Math.min(300, this.resizeStartHeight + deltaY));
      const doc = this.getDoc();
      if (!doc.rowHeights) doc.rowHeights = new Map<number, number>();
      doc.rowHeights.set(this.resizeRowIndex, Math.round(newHeight));
      this.updateViewport();
      this.requestUpdate();
      return;
    }

    if (this.isFillDragging) {
      // Determina la cella sotto il cursore
      // dentro lo shadow DOM il documento restituirebbe l'elemento esterno: si chiede alla radice della griglia
      const targetElem = (this.renderRoot as ShadowRoot).elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (targetElem && targetElem.classList.contains('sheet-cell')) {
        const r = parseInt(targetElem.dataset.row || '1', 10);
        const c = parseInt(targetElem.dataset.col || '1', 10);
        this.fillDragTarget = { row: r, col: c };
        this.requestUpdate();
      }
    }
  };

  private handleWindowMouseUp = async () => {
    if (this.trascinaIntestazione) { this.trascinaIntestazione = null; this.emitActiveFormat(); }
    if (this.isDragging) {
      this.isDragging = false;
    }
    if (this.isResizingCol) {
      this.isResizingCol = false;
    }
    if (this.isResizingRow) {
      this.isResizingRow = false;
    }
    if (this.isFillDragging) {
      this.isFillDragging = false;
      await this.applyFillDrag();
      this.fillDragTarget = null;
      this.requestUpdate();
    }
  };

  private async applyFillDrag() {
    if (!this.fillDragTarget) return;
    const doc = this.getDoc();
    const sel = doc.selection.range;
    const target = this.fillDragTarget;

    // Se il target coincide con la selezione sorgente, niente da fare
    if (
      target.row >= sel.startRow &&
      target.row <= sel.endRow &&
      target.col >= sel.startCol &&
      target.col <= sel.endCol
    ) {
      return;
    }

    // Determina la direzione primaria (verticale o orizzontale)
    const isVertical = Math.abs(target.row - sel.endRow) >= Math.abs(target.col - sel.endCol);

    const batchOps = [];
    const changeRecords = [];

    if (isVertical && target.row > sel.endRow) {
      // Trascina verso il basso
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        const sourceCells = [];
        for (let r = sel.startRow; r <= sel.endRow; r++) {
          const old = await doc.client.getCell(doc.activeSheetName, r, c);
          sourceCells.push({ row: r, col: c, raw: old.raw, value: old.value });
        }
        for (let r = sel.endRow + 1; r <= target.row; r++) {
          const newVal = computeFillValue(sourceCells, r, c, 'down');
          const old = await doc.client.getCell(doc.activeSheetName, r, c);
          changeRecords.push({
            sheet: doc.activeSheetName,
            row: r,
            col: c,
            oldRaw: old.raw,
            newRaw: newVal,
          });
          batchOps.push({
            type: 'set' as const,
            sheet: doc.activeSheetName,
            row: r,
            col: c,
            raw: newVal,
          });
        }
      }
    } else if (!isVertical && target.col > sel.endCol) {
      // Trascina verso destra
      for (let r = sel.startRow; r <= sel.endRow; r++) {
        const sourceCells = [];
        for (let c = sel.startCol; c <= sel.endCol; c++) {
          const old = await doc.client.getCell(doc.activeSheetName, r, c);
          sourceCells.push({ row: r, col: c, raw: old.raw, value: old.value });
        }
        for (let c = sel.endCol + 1; c <= target.col; c++) {
          const newVal = computeFillValue(sourceCells, r, c, 'right');
          const old = await doc.client.getCell(doc.activeSheetName, r, c);
          changeRecords.push({
            sheet: doc.activeSheetName,
            row: r,
            col: c,
            oldRaw: old.raw,
            newRaw: newVal,
          });
          batchOps.push({
            type: 'set' as const,
            sheet: doc.activeSheetName,
            row: r,
            col: c,
            raw: newVal,
          });
        }
      }
    }

    this.applicaConvalidaInBlocco('Riempimento', changeRecords, batchOps);
    if (batchOps.length > 0) {
      doc.history.pushStep({
        description: 'Riempimento automatico',
        changes: changeRecords,
      });
      await doc.client.applyBatch(batchOps);
      // Estende la selezione all'area riempita
      doc.selection = createRangeSelection(
        sel.startRow,
        sel.startCol,
        Math.max(sel.endRow, target.row),
        Math.max(sel.endCol, target.col)
      );
      this.updateFormulaBarValue();
      this.updateSelectionStats();
      this.requestUpdate();
    }
  }

  // --- MODIFICA DELLE CELLE (EDITOR) ---

  public async startEditing(replace = false, initialChar = "") {
    if (this.isEditing) return;
    const doc = this.getDoc();
    const active = doc.selection.anchor;
    if (cellaProtetta(doc, doc.activeSheetName, active.row, active.col)) { this.avvisaStato(t(MOTIVO_CELLA)); return; }
    let raw = this.getCellData(active.row, active.col).raw;

    if (!replace) { // si legge sempre quello che è scritto davvero: la copia per la vista ha il valore calcolato, non la formula
      const c = await doc.client.getCell(doc.activeSheetName, active.row, active.col);
      raw = c.raw;
    }

    this.isEditing = true;
    this.editValue = replace ? initialChar : perInputUtente(raw);
    this.formulaBarValue = this.editValue;
    this.parseFormulaHighlights(this.editValue);

    await this.updateComplete;
    const editor = this.renderRoot.querySelector(".cell-editor-overlay") as HTMLInputElement;
    if (editor) {
      const zF = this.zoom / 100;
      const geomE = this.geomRighe();
      const headerHeight = this.altezzaIntestazione;
      const top = headerHeight + geomE.top(active.row) * zF;
      let left = 44 * zF;
      for (let c = 1; c < active.col; c++) {
        left += getColWidth(c, this.larghezzeEffettive()) * zF;
      }
      const width = getColWidth(active.col, this.larghezzeEffettive()) * zF;
      const height = geomE.altezza(active.row) * zF;
      editor.style.top = `${top}px`;
      editor.style.left = `${left}px`;
      editor.style.width = `${width}px`;
      editor.style.height = `${height}px`;
      editor.focus();
      if (!replace) {
        editor.setSelectionRange(editor.value.length, editor.value.length);
      }
    }
  }

  /** Quello che si è scritto nella cella (r, c), nella forma interna del foglio. Date, ore, percentuali e valute diventano numeri con il loro formato,
   *  ma solo se la cella non ha già un formato: in una cella a formato Testo resta quello che si è scritto. */
  private interpretaPerCella(testo: string, r: number, c: number): { raw: string; formato?: string } {
    const doc = this.getDoc();
    const attuale = resolveCellStyle(r, c, doc.styles).numFmt || '';
    if (attuale === '@') return { raw: daInputUtente(testo) };
    const interp = interpretaInput(testo);
    return attuale === '' ? interp : { raw: interp.raw };
  }

  /** Ctrl+; e Ctrl+Maiusc+;: scrive nella cella attiva la data di oggi o l'ora di adesso (valori fissi, non formule), col formato giusto. */
  public async inserisciDataOra(tipo: 'data' | 'ora', adesso: Date = new Date()): Promise<void> {
    const doc = this.getDoc();
    const a = doc.selection.anchor;
    const giorni = Math.round((Date.UTC(adesso.getFullYear(), adesso.getMonth(), adesso.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000);
    const frazione = (adesso.getHours() * 3600 + adesso.getMinutes() * 60 + adesso.getSeconds()) / 86400;
    const raw = tipo === 'data' ? String(giorni) : String(Number(frazione.toPrecision(15)));
    const vecchio = await doc.client.getCell(doc.activeSheetName, a.row, a.col);
    const stile = this.formatoDaInput(a.row, a.col, tipo === 'data' ? 'dd/mm/yyyy' : 'hh:mm:ss');
    doc.history.pushStep({
      description: tipo === 'data' ? t("Inserisci data di oggi") : t("Inserisci ora attuale"),
      changes: [{ sheet: doc.activeSheetName, row: a.row, col: a.col, oldRaw: vecchio.raw, newRaw: raw }],
      styleChanges: [stile],
    });
    await doc.client.setCell(doc.activeSheetName, a.row, a.col, raw);
    this.updateFormulaBarValue();
    this.requestUpdate();
  }

  /** Dà alla cella il formato suggerito da quello che si è scritto e restituisce la modifica di stile da mettere nella cronologia. */
  private formatoDaInput(r: number, c: number, formato: string): StyleChangeRecord {
    const doc = this.getDoc();
    const k = cellKey(r, c);
    const oldId = doc.styles.cellStyles.get(k);
    applyFormatToRange(doc.styles, { startRow: r, endRow: r, startCol: c, endCol: c }, { numFmt: formato });
    return { type: 'cell', target: k, oldStyleId: oldId, newStyleId: doc.styles.cellStyles.get(k) };
  }

  public async commitEdit() {
    this.elencoCompletamento = null; // la colonna cambia: il completamento automatico rilegge i testi alla prossima modifica
    if (!this.isEditing) { this.editValue = daInputUtente(this.editValue); return; }
    this.isEditing = false;
    this.formulaRefHighlights = [];

    const doc = this.getDoc();
    const active = doc.selection.anchor;
    const interp = this.interpretaPerCella(this.editValue, active.row, active.col);
    this.editValue = interp.raw;
    const oldCell = await doc.client.getCell(doc.activeSheetName, active.row, active.col);
    const newRaw = this.editValue;

    // Controllo Convalida Dati (M2)
    const valKey = `${active.row}:${active.col}`;
    const rule = doc.dataValidations.get(valKey);
    if (rule) {
      const vociRisolte = rule.type === 'list' && (rule.listRange || (rule.value1 && String(rule.value1).startsWith('=')))
        ? await this.risolviVociElenco(rule)
        : undefined;
      const valRes = validateCellValue(newRaw, rule, undefined, vociRisolte);
      if (!valRes.valid) {
        if (valRes.action === 'reject') {
          this.dispatchEvent(
            new CustomEvent("status-message", {
              detail: { message: t("Valore rifiutato: {}", valRes.message || 'violazione regola di convalida') },
              bubbles: true,
              composed: true,
            })
          );
          this.updateFormulaBarValue();
          this.requestUpdate();
          return;
        } else {
          this.dispatchEvent(
            new CustomEvent("status-message", {
              detail: { message: t("Avviso: {}", valRes.message || 'valore non conforme') },
              bubbles: true,
              composed: true,
            })
          );
        }
      }
    }

    const stile = interp.formato && oldCell.raw !== newRaw ? [this.formatoDaInput(active.row, active.col, interp.formato)] : undefined;
    if (oldCell.raw !== newRaw) {
      // Registra nella cronologia
      doc.history.pushStep({
        description: t("Modifica cella {}", this.activeCellAddress),
        changes: [
          {
            sheet: doc.activeSheetName,
            row: active.row,
            col: active.col,
            oldRaw: oldCell.raw,
            newRaw,
          },
        ],
        styleChanges: stile,
      });

      await doc.client.setCell(doc.activeSheetName, active.row, active.col, newRaw);
    }

    this.updateFormulaBarValue();
    this.requestUpdate();
    await this.updateComplete;
    const container = this.renderRoot.querySelector(".grid-container") as HTMLElement;
    if (container) container.focus();
  }

  public async cancelEdit() {
    if (!this.isEditing) return;
    this.isEditing = false;
    this.formulaRefHighlights = [];
    this.updateFormulaBarValue();
    this.requestUpdate();
    await this.updateComplete;
    const container = this.renderRoot.querySelector(".grid-container") as HTMLElement;
    if (container) container.focus();
  }

  private handleEditorInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    this.editValue = val;
    this.formulaBarValue = val;
    this.parseFormulaHighlights(val);
    // completamento automatico (come Excel): scrivendo un testo si propone il resto di un testo già presente nella colonna
    const ie = e as InputEvent;
    if (typeof ie.inputType === 'string' && ie.inputType.startsWith('insert') && !ie.isComposing) void this.completaDallaColonna(e.target as HTMLInputElement, val);
  };

  /** I testi della colonna attorno alla cella in modifica (le celle piene attaccate sopra e sotto), presi una volta per ogni modifica. */
  private elencoCompletamento: { chiave: string; voci: string[] } | null = null;
  private async testiDellaColonna(): Promise<string[]> {
    const doc = this.getDoc();
    const a = doc.selection.anchor;
    const chiave = `${doc.activeSheetName}:${a.row}:${a.col}`;
    if (this.elencoCompletamento?.chiave === chiave) return this.elencoCompletamento.voci;
    const da = Math.max(1, a.row - 2000), a2 = Math.min(MAX_ROWS, a.row + 2000);
    const valori = await doc.client.getRange(doc.activeSheetName, da, a.col, a2, a.col);
    const testo = (i: number): string | null => { const v = valori[i]?.[0]; return v && v.kind === 'text' && v.value !== '' ? v.value : null; };
    const pieno = (i: number): boolean => { const v = valori[i]?.[0]; return !!v && v.kind !== 'empty' && !(v.kind === 'text' && v.value === ''); };
    const voci: string[] = [];
    const qui = a.row - da;
    for (let i = qui - 1; i >= 0 && pieno(i); i--) { const t = testo(i); if (t !== null) voci.push(t); }
    for (let i = qui + 1; i < valori.length && pieno(i); i++) { const t = testo(i); if (t !== null) voci.push(t); }
    this.elencoCompletamento = { chiave, voci };
    return voci;
  }
  private async completaDallaColonna(campo: HTMLInputElement, scritto: string): Promise<void> {
    if (scritto === '' || scritto.startsWith('=') || /^[\d\s.,:+\-/%€$]*$/.test(scritto)) return;
    if (campo.selectionStart !== scritto.length || campo.selectionEnd !== scritto.length) return;
    const voci = await this.testiDellaColonna();
    if (!this.isEditing || campo.value !== scritto) return; // nel frattempo si è scritto altro
    const minuscolo = scritto.toLocaleLowerCase();
    const adatte = [...new Set(voci.filter((v) => v.length > scritto.length && v.toLocaleLowerCase().startsWith(minuscolo)).map((v) => v.toLocaleLowerCase()))];
    // come Excel: si propone solo se c'è un testo solo che comincia così
    if (adatte.length !== 1) return;
    const voce = voci.find((v) => v.toLocaleLowerCase() === adatte[0])!;
    const completo = scritto + voce.slice(scritto.length);
    campo.value = completo;
    campo.setSelectionRange(scritto.length, completo.length);
    this.editValue = completo;
    this.formulaBarValue = completo;
  }

  private handleFormulaBarInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    this.isEditing = true;
    this.formulaBarValue = val;
    this.editValue = val;
    this.parseFormulaHighlights(val);
  };

  private parseFormulaHighlights(formula: string) {
    if (!formula.startsWith("=")) {
      this.formulaRefHighlights = [];
      return;
    }

    const regex = /([A-Za-z]{1,3})([1-9][0-9]{0,6})(?::([A-Za-z]{1,3})([1-9][0-9]{0,6}))?/g;
    const colors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];
    const highlights = [];
    let match: RegExpExecArray | null;
    let colorIdx = 0;

    while ((match = regex.exec(formula)) !== null) {
      const c1 = columnLettersToIndex(match[1]);
      const r1 = parseInt(match[2], 10);
      let c2 = c1;
      let r2 = r1;
      if (match[3] && match[4]) {
        c2 = columnLettersToIndex(match[3]);
        r2 = parseInt(match[4], 10);
      }
      highlights.push({
        r1: Math.min(r1, r2),
        c1: Math.min(c1, c2),
        r2: Math.max(r1, r2),
        c2: Math.max(c1, c2),
        color: colors[colorIdx % colors.length],
      });
      colorIdx++;
    }

    this.formulaRefHighlights = highlights;
  }

  // --- GESTIONE TASTIERA GLOBALE (GRID & EDITOR) ---

  private timerIncolla = 0;

  /** Rimette il focus della tastiera sulla griglia (dopo un comando da menu o dalla barra), così Ctrl+Z, Ctrl+C... funzionano subito. Non interviene se si sta scrivendo. */
  public focusGriglia(): void {
    if (this.isEditing || this.showFindReplace) return;
    (this.renderRoot.querySelector('.grid-container') as HTMLElement | null)?.focus();
  }

  /** L'evento viene da un campo di testo (l'editor della cella, la barra della formula...): quei tasti e quegli appunti sono del campo. */
  private eDiUnCampoDiTesto(e: Event): boolean {
    const origine = e.composedPath()[0];
    return origine instanceof HTMLInputElement || origine instanceof HTMLTextAreaElement;
  }

  private handleGridKeyDown = async (e: KeyboardEvent) => {
    // L'editor della cella sta dentro il riquadro della griglia: i tasti premuti nell'editor (o in un altro campo di testo) risalgono fin qui,
    // ma sono del campo. Senza questo la griglia li bloccava e dopo il primo carattere le lettere andavano perse.
    const origine = e.composedPath()[0];
    if (origine instanceof HTMLInputElement || origine instanceof HTMLTextAreaElement) return;
    // con un'immagine selezionata Canc elimina l'immagine (non il contenuto delle celle)
    if (this.selectedImageId && !this.isEditing && !e.ctrlKey && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      this.deleteImage(this.selectedImageId);
      return;
    }
    const doc = this.getDoc();

    // AltGr (Windows lo manda come Ctrl+Alt): @ [ ] { } # ecc. sono caratteri da scrivere, non scorciatoie
    if (!this.isEditing && e.key.length === 1 && !e.metaKey && (e.getModifierState?.('AltGraph') || (e.ctrlKey && e.altKey))) {
      e.preventDefault();
      await this.startEditing(true, e.key);
      return;
    }

    // Undo: Ctrl+Z
    if (e.ctrlKey && !e.shiftKey && (e.key.toLowerCase() === "z" || e.code === "KeyZ")) {
      e.preventDefault();
      await this.undo();
      return;
    }

    // Redo: Ctrl+Y oppure Ctrl+Shift+Z
    if (
      (tastoPrimario(e) && (e.key.toLowerCase() === "y" || e.code === "KeyY")) ||
      (tastoPrimario(e) && e.shiftKey && (e.key.toLowerCase() === "z" || e.code === "KeyZ"))
    ) {
      e.preventDefault();
      await this.redo();
      return;
    }

    // Copy: Ctrl+C
    if (tastoPrimario(e) && (e.key.toLowerCase() === "c" || e.code === "KeyC")) {
      e.preventDefault();
      await this.copy();
      return;
    }

    // Cut: Ctrl+X
    if (tastoPrimario(e) && !e.shiftKey && (e.key.toLowerCase() === "x" || e.code === "KeyX")) {
      e.preventDefault();
      await this.cut();
      return;
    }

    // Incolla solo valori: Ctrl+Maiusc+V
    if (tastoPrimario(e) && e.shiftKey && (e.key.toLowerCase() === "v" || e.code === "KeyV")) {
      e.preventDefault();
      await this.pasteSpecial('values_only');
      return;
    }

    // Paste: Ctrl+V. Il browser manda l'evento "paste" con il testo degli appunti, senza permessi e senza attese: lo gestisce `suIncolla`.
    // Se l'evento non arrivasse, dopo un attimo si incolla leggendo gli appunti.
    if (tastoPrimario(e) && (e.key.toLowerCase() === "v" || e.code === "KeyV")) {
      window.clearTimeout(this.timerIncolla);
      this.timerIncolla = window.setTimeout(() => { void this.paste(); }, 200);
      return;
    }

    // Seleziona tutto: Ctrl+A
    if (tastoPrimario(e) && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
      e.preventDefault();
      this.handleSelectAll();
      return;
    }

    // Seleziona la colonna (Ctrl+Spazio) o la riga (Maiusc+Spazio) della cella attiva
    if (e.key === " " && ((tastoPrimario(e) && !e.shiftKey) || (e.shiftKey && !tastoPrimario(e)))) {
      e.preventDefault();
      const a = doc.selection.anchor;
      doc.selection = tastoPrimario(e) ? createColSelection(a.col) : createRowSelection(a.row);
      this.activeCellAddress = formatSelectionAddress(doc.selection);
      this.nameBoxValue = this.activeCellAddress;
      this.updateSelectionStats();
      this.emitActiveFormat();
      this.requestUpdate();
      return;
    }

    // Data di oggi (Ctrl+;) e ora attuale (Ctrl+Maiusc+;) nella cella attiva
    if (tastoPrimario(e) && !e.altKey && (e.key === ";" || e.key === ":" || e.code === "Semicolon")) {
      e.preventDefault();
      await this.inserisciDataOra(e.shiftKey ? 'ora' : 'data');
      return;
    }

    // Scorciatoie formattazione celle (attive quando la griglia ha il focus e non si sta editando)
    if (!this.isEditing) {
      if (tastoPrimario(e) && !e.shiftKey && (e.key.toLowerCase() === "b" || e.code === "KeyB")) {
        e.preventDefault();
        this.handleFormatAction("format-bold");
        return;
      }
      if (tastoPrimario(e) && !e.shiftKey && (e.key.toLowerCase() === "i" || e.code === "KeyI")) {
        e.preventDefault();
        this.handleFormatAction("format-italic");
        return;
      }
      if (tastoPrimario(e) && !e.shiftKey && (e.key.toLowerCase() === "u" || e.code === "KeyU")) {
        e.preventDefault();
        this.handleFormatAction("format-underline");
        return;
      }
      if (tastoPrimario(e) && e.shiftKey && (e.key.toLowerCase() === "x" || e.code === "KeyX")) {
        e.preventDefault();
        this.handleFormatAction("format-strike");
        return;
      }
      if (tastoPrimario(e) && e.shiftKey && (e.key === "!" || e.key === "1" || e.code === "Digit1")) {
        e.preventDefault();
        this.handleFormatAction("change-number-format", "number");
        return;
      }
      if (tastoPrimario(e) && e.shiftKey && (e.key === "%" || e.key === "5" || e.code === "Digit5")) {
        e.preventDefault();
        this.handleFormatAction("format-percent");
        return;
      }
      if (tastoPrimario(e) && e.shiftKey && (e.key === "$" || e.key === "4" || e.code === "Digit4")) {
        e.preventDefault();
        this.handleFormatAction("format-currency");
        return;
      }
      if (tastoPrimario(e) && (e.key === "\\" || e.code === "Backslash")) {
        e.preventDefault();
        this.handleFormatAction("clear-formatting");
        return;
      }
      // Trova (Ctrl+F) e Trova/Sostituisci (Ctrl+H)
      if (tastoPrimario(e) && !e.shiftKey && (e.key.toLowerCase() === "f" || e.code === "KeyF")) {
        e.preventDefault();
        this.openFind(false);
        return;
      }
      if (tastoPrimario(e) && !e.shiftKey && (e.key.toLowerCase() === "h" || e.code === "KeyH")) {
        e.preventDefault();
        this.openFind(true);
        return;
      }
      // Toggle casella di controllo con Spazio
      if (e.key === " ") {
        const act = doc.selection.anchor;
        const cell = this.getCellData(act.row, act.col);
        const rule = doc.dataValidations.get(`${act.row}:${act.col}`);
        if (isCheckboxCell(rule, cell.raw)) {
          e.preventDefault();
          await this.toggleCheckboxAt(act.row, act.col);
          return;
        }
      }
    }

    // Ctrl+` (il tasto sotto Esc): Mostra formule, come in Excel
    if (e.ctrlKey && !e.altKey && (e.code === 'Backquote' || e.key === '`')) {
      e.preventDefault();
      this.alternaMostraFormule();
      return;
    }

    // Delete / Backspace: cancellazione contenuto intervallo selezionato
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (this.selezioneProtetta()) return;
      await this.clearSelection();
      return;
    }

    // F2: avvia modifica senza sostituire
    if (e.key === "F2") {
      e.preventDefault();
      await this.startEditing(false);
      return;
    }

    // Tab e Shift+Tab spostano la cella attiva
    if (e.key === "Tab") {
      e.preventDefault();
      const nextCol = e.shiftKey
        ? Math.max(1, doc.selection.active.col - 1)
        : Math.min(16384, doc.selection.active.col + 1);
      this.selectSingle(doc.selection.active.row, nextCol);
      return;
    }

    // Enter e Shift+Enter spostano la cella attiva
    if (e.key === "Enter") {
      e.preventDefault();
      const nextRow = e.shiftKey
        ? Math.max(1, doc.selection.active.row - 1)
        : Math.min(1048576, doc.selection.active.row + 1);
      this.selectSingle(nextRow, doc.selection.active.col);
      return;
    }

    // Fill Down: Ctrl+D
    if (tastoPrimario(e) && !e.shiftKey && (e.key.toLowerCase() === "d" || e.code === "KeyD")) {
      e.preventDefault();
      await this.fillDown();
      return;
    }

    // Fill Right: Ctrl+R
    if (tastoPrimario(e) && !e.shiftKey && (e.key.toLowerCase() === "r" || e.code === "KeyR")) {
      e.preventDefault();
      await this.fillRight();
      return;
    }

    // Tasto Menu o Maiusc+F10: menu delle celle
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      this.apriMenuCellaDaTastiera();
      return;
    }

    // Navigazione frecce e salti
    const libro = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
    const contesto = tastoPrimario(e) && libro && (e.key.startsWith('Arrow') || e.key === 'End') ? contestoNavigazione(libro, doc.activeSheetName) : {};
    let navResult = handleNavigationKey(doc.selection, e.key, {
      shiftKey: e.shiftKey,
      ctrlKey: tastoPrimario(e),
      altKey: e.altKey,
    }, contesto);

    if (navResult) {
      e.preventDefault();
      // le frecce saltano le righe e le colonne nascoste
      const passo = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key as 'ArrowUp'];
      if (passo && !tastoPrimario(e)) {
        const geomN = this.geomRighe();
        let rr = navResult.active.row;
        let cc = navResult.active.col;
        while (rr >= 1 && rr <= 1048576 && geomN.nascosta(rr) && passo[0] !== 0) rr += passo[0];
        while (cc >= 1 && cc <= 16384 && doc.hiddenCols?.has(cc) && passo[1] !== 0) cc += passo[1];
        if (rr < 1 || rr > 1048576 || cc < 1 || cc > 16384) { rr = doc.selection.active.row; cc = doc.selection.active.col; }
        if (rr !== navResult.active.row || cc !== navResult.active.col) {
          navResult = e.shiftKey ? createRangeSelection(doc.selection.anchor.row, doc.selection.anchor.col, rr, cc) : createCellSelection(rr, cc);
        }
      }
      doc.selection = navResult;
      this.activeCellAddress = formatSelectionAddress(doc.selection);
      this.nameBoxValue = this.activeCellAddress;
      this.updateFormulaBarValue();
      this.updateSelectionStats();
      this.ensureCellVisible(navResult.active.row, navResult.active.col);
      this.requestUpdate();
      return;
    }

    // Inizia a scrivere digitando un carattere stampabile (sostituisce)
    if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
      e.preventDefault();
      await this.startEditing(true, e.key);
      return;
    }
  };

  private handleEditorKeydown = async (e: KeyboardEvent) => {
    // F4: il riferimento sotto il cursore passa da relativo ad assoluto (A1 → $A$1 → A$1 → $A1 → A1)
    if (e.key === "F4" && !tastoPrimario(e) && !e.altKey) {
      const campo = e.target as HTMLInputElement;
      const r = cambiaRiferimento(campo.value, campo.selectionStart ?? campo.value.length);
      e.preventDefault();
      if (r) {
        this.editValue = r.formula;
        this.formulaBarValue = r.formula;
        campo.value = r.formula;
        campo.setSelectionRange(r.cursore, r.cursore);
        this.parseFormulaHighlights(r.formula);
        this.requestUpdate();
      }
      return;
    }
    // Ctrl+Invio: riempie tutte le celle della selezione
    if (e.key === "Enter" && tastoPrimario(e)) {
      e.preventDefault();
      e.stopPropagation();
      const doc = this.getDoc();
      const sel = doc.selection.range;
      const scritto = this.editValue;
      const stileRiempimento: StyleChangeRecord[] = [];
      this.isEditing = false;
      this.formulaRefHighlights = [];
      const batchOps = [];
      const changeRecords = [];
      for (let r = sel.startRow; r <= sel.endRow; r++) {
        for (let c = sel.startCol; c <= sel.endCol; c++) {
          const old = await doc.client.getCell(doc.activeSheetName, r, c);
          const interp = this.interpretaPerCella(scritto, r, c); // riempimento della selezione: stessa conversione di commitEdit
          const newRaw = interp.raw;
          if (interp.formato) stileRiempimento.push(this.formatoDaInput(r, c, interp.formato));
          changeRecords.push({ sheet: doc.activeSheetName, row: r, col: c, oldRaw: old.raw, newRaw });
          batchOps.push({ type: 'set' as const, sheet: doc.activeSheetName, row: r, col: c, raw: newRaw });
        }
      }
      this.applicaConvalidaInBlocco('Ctrl+Invio', changeRecords, batchOps);
      if (batchOps.length > 0) {
        doc.history.pushStep({ description: 'Riempimento selezione (Ctrl+Invio)', changes: changeRecords, styleChanges: stileRiempimento.length > 0 ? stileRiempimento : undefined });
        await doc.client.applyBatch(batchOps);
      }
      this.updateFormulaBarValue();
      this.requestUpdate();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      await this.commitEdit();
      const doc = this.getDoc();
      const nextRow = e.shiftKey ? Math.max(1, doc.selection.active.row - 1) : Math.min(1048576, doc.selection.active.row + 1);
      this.selectSingle(nextRow, doc.selection.active.col);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      await this.commitEdit();
      const doc = this.getDoc();
      const nextCol = e.shiftKey ? Math.max(1, doc.selection.active.col - 1) : Math.min(16384, doc.selection.active.col + 1);
      this.selectSingle(doc.selection.active.row, nextCol);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.cancelEdit();
      return;
    }
  };

  private handleNameBoxKeyDown = async (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = (e.target as HTMLInputElement).value;
      // un nome definito (anche di un altro foglio) porta all'intervallo che indica
      const nome = this.getDoc().namedRanges.get(val.trim());
      let res = parseNameBoxAddress(val);
      if (nome) {
        if (nome.sheetName !== this.getDoc().activeSheetName) await this.switchSheet(nome.sheetName);
        res = { selection: createRangeSelection(nome.startRow, nome.startCol, nome.endRow, nome.endCol) } as typeof res;
      }
      if (res.selection) {
        const doc = this.getDoc();
        doc.selection = res.selection;
        this.activeCellAddress = formatSelectionAddress(doc.selection);
        this.nameBoxValue = this.activeCellAddress;
        this.updateFormulaBarValue();
        this.updateSelectionStats();
        this.ensureCellVisible(res.selection.active.row, res.selection.active.col);
        this.requestUpdate();
      } else {
        this.dispatchEvent(
          new CustomEvent("status-message", {
            detail: { message: t("Riferimento non valido: \"{}\"", val) },
            bubbles: true,
            composed: true,
          })
        );
      }
    }
  };

  // --- AZIONI APPUNTI ED EDITING PUBBLICHE ---

  public async copy(taglia = false) {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    const rCount = sel.endRow - sel.startRow + 1;
    const cCount = sel.endCol - sel.startCol + 1;

    const rawGrid: string[][] = [];
    const displayGrid: string[][] = [];
    const styleGrid: (number | undefined)[][] = [];

    for (let r = 0; r < rCount; r++) {
      const rawRow: string[] = [];
      const dispRow: string[] = [];
      const styleRow: (number | undefined)[] = [];

      for (let c = 0; c < cCount; c++) {
        const rowNum = sel.startRow + r;
        const colNum = sel.startCol + c;
        const cellData = await doc.client.getCell(doc.activeSheetName, rowNum, colNum);
        rawRow.push(cellData.raw);
        const resolved = resolveCellStyle(rowNum, colNum, doc.styles);
        const text = resolved.numFmt
          ? formatCellValue(cellData.value, resolved.numFmt)
          : formatDisplayValue(cellData.value).text;
        dispRow.push(text);
        const k = cellKey(rowNum, colNum);
        styleRow.push(doc.styles.cellStyles.get(k));
      }
      rawGrid.push(rawRow);
      displayGrid.push(dispRow);
      styleGrid.push(styleRow);
    }

    const tsv = generateTSV(displayGrid);
    setInternalClipboard({
      rawGrid,
      displayGrid,
      styleGrid,
      styleSnapshot: [...doc.styles.registry.getAllStyles()],
      sourceRange: sel,
      sourceSheet: doc.activeSheetName,
      tsv,
      isCut: taglia,
      sopra: fotografaSopraLeCelle(sel, doc.activeSheetName, doc.comments, doc),
    });

    // Scrive TSV su clipboard di sistema se supportata
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await entroTempo(navigator.clipboard.writeText(tsv).then(() => undefined), 1500, undefined);
      }
    } catch {
      // WebView2 fallback su appunti interni
    }
    if (doc.selection.extra && doc.selection.extra.length > 0) {
      this.dispatchEvent(new CustomEvent("status-message", { detail: { message: t("{} solo l'ultimo intervallo selezionato", taglia ? t('Tagliato') : t('Copiato')) }, bubbles: true, composed: true }));
    }
  }

  public async cut() {
    await this.copy(true);
  }

  /** Incolla. Con `testoSistema` (il testo che il browser consegna con l'evento di incolla) non si aspetta niente; senza (voce di menu) si leggono gli appunti di sistema, con poca attesa. */
  public async paste(testoSistema?: string) {
    const doc = this.getDoc();
    let clip = getInternalClipboard();

    // Gli appunti di sistema li può aver cambiati un altro programma: se il loro testo non è più quello della nostra copia vincono loro.
    let systemTSV = testoSistema ?? "";
    if (testoSistema === undefined) {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) systemTSV = await entroTempo(navigator.clipboard.readText(), 400, '');
      } catch {
        // permesso negato o appunti non leggibili: si usa la copia interna, se c'è
      }
    }
    if (clip && systemTSV !== "" && normalizzaTsv(systemTSV) !== normalizzaTsv(clip.tsv ?? generateTSV(clip.displayGrid))) {
      setInternalClipboard(null);
      clip = null;
    }

    let sourceRaw: string[][];
    let sourceOriginRow: number | undefined;
    let sourceOriginCol: number | undefined;
    let styleGrid = clip?.styleGrid;
    let formatiIncollati: (string | undefined)[][] | undefined; // formato suggerito da date, ore, percentuali e valute incollate come testo

    if (clip) {
      if (clip.isCut) { await this.incollaTagliato(clip); return; }
      // Incolla interno: usa formule grezze e coordinate sorgente per shiftFormula
      sourceRaw = clip.rawGrid;
      sourceOriginRow = clip.sourceRange.startRow;
      sourceOriginCol = clip.sourceRange.startCol;
      // gli stili si riferiscono al registro di quando si è copiato: si traducono in quelli del file di adesso
      if (styleGrid && clip.styleSnapshot) {
        const snapshot = clip.styleSnapshot;
        styleGrid = styleGrid.map((riga) => riga.map((id) => (id === undefined || id === 0 || !snapshot[id] ? undefined : doc.styles.registry.register(snapshot[id]))));
      }
    } else if (systemTSV) {
      const interpretati = parseTSV(systemTSV).map((riga) => riga.map((t) => interpretaInput(t)));
      sourceRaw = interpretati.map((riga) => riga.map((x) => x.raw));
      formatiIncollati = interpretati.map((riga) => riga.map((x) => x.formato));
    } else {
      return;
    }

    const targets = computePasteOperations(
      sourceRaw,
      doc.selection.range,
      sourceOriginRow,
      sourceOriginCol,
      styleGrid
    );

    if (targets.length === 0) return;

    // Registra l'incolla come UNICO passo atomico nella cronologia
    const changeRecords = [];
    const styleChanges: StyleChangeRecord[] = [];
    const batchOps = [];

    for (const t of targets) {
      const oldCell = await doc.client.getCell(doc.activeSheetName, t.row, t.col);
      changeRecords.push({
        sheet: doc.activeSheetName,
        row: t.row,
        col: t.col,
        oldRaw: oldCell.raw,
        newRaw: t.raw,
      });
      batchOps.push({
        type: "set" as const,
        sheet: doc.activeSheetName,
        row: t.row,
        col: t.col,
        raw: t.raw,
      });

      if (t.styleId !== undefined) {
        const k = cellKey(t.row, t.col);
        const oldId = doc.styles.cellStyles.get(k);
        doc.styles.cellStyles.set(k, t.styleId);
        styleChanges.push({ type: 'cell', target: k, oldStyleId: oldId, newStyleId: t.styleId });
      } else if (formatiIncollati && formatiIncollati.length > 0 && formatiIncollati[0].length > 0) {
        // l'incolla ripete il blocco a piastrelle: la posizione nella sorgente è la distanza dall'angolo, a modulo
        const area = doc.selection.range;
        const formato = formatiIncollati[(t.row - area.startRow) % formatiIncollati.length]?.[(t.col - area.startCol) % formatiIncollati[0].length];
        if (formato && !resolveCellStyle(t.row, t.col, doc.styles).numFmt) styleChanges.push(this.formatoDaInput(t.row, t.col, formato));
      }
    }

    // le convalide di prima: una cella che riceve la convalida insieme al valore (copia fedele dell'origine) non si controlla
    const convalidePrima = new Map(doc.dataValidations);
    // la copia porta con sé commenti, convalide e celle unite (a ogni piastrella, se l'incolla ripete il blocco); non cancella ciò che la destinazione aveva se la sorgente non ha niente
    let sopraAnnulla: (() => void) | undefined;
    let sopraRipeti: (() => void) | undefined;
    // (e, come in Excel, toglie le regole che la destinazione aveva sotto l'area incollata, anche se la sorgente non ne ha)
    const sottoRegole = !!clip && !clip.isCut && !!clip.sopra && targets.length > 0 && doc.conditionalFormats.some((r) =>
      r.range.startRow <= Math.max(...targets.map((t) => t.row)) && r.range.endRow >= Math.min(...targets.map((t) => t.row)) &&
      r.range.startCol <= Math.max(...targets.map((t) => t.col)) && r.range.endCol >= Math.min(...targets.map((t) => t.col)));
    if (clip && !clip.isCut && (!sopraVuoto(clip.sopra) || sottoRegole)) {
      const righeBlocco = clip.sourceRange.endRow - clip.sourceRange.startRow + 1;
      const colonneBlocco = clip.sourceRange.endCol - clip.sourceRange.startCol + 1;
      const area = doc.selection.range;
      const origini = targets
        .filter((t) => (t.row - area.startRow) % righeBlocco === 0 && (t.col - area.startCol) % colonneBlocco === 0)
        .map((t) => ({ riga: t.row, colonna: t.col }));
      const foto = () => ({
        commenti: new Map([...doc.comments].map(([k, v]) => [k, { ...v }] as const)),
        convalide: new Map([...doc.dataValidations].map(([k, v]) => [k, JSON.parse(JSON.stringify(v)) as DataValidationRule] as const)),
        unioni: JSON.parse(JSON.stringify(doc.merges)) as typeof doc.merges,
        regole: JSON.parse(JSON.stringify(doc.conditionalFormats)) as typeof doc.conditionalFormats,
      });
      const rimetti = (f: ReturnType<typeof foto>) => () => {
        doc.comments = new Map([...f.commenti].map(([k, v]) => [k, { ...v }] as const));
        doc.dataValidations = new Map([...f.convalide].map(([k, v]) => [k, JSON.parse(JSON.stringify(v)) as DataValidationRule] as const));
        doc.merges = JSON.parse(JSON.stringify(f.unioni)) as typeof doc.merges;
        doc.conditionalFormats = JSON.parse(JSON.stringify(f.regole)) as typeof doc.conditionalFormats;
        this.requestUpdate();
        this.dispatchEvent(new CustomEvent('comments-changed', { bubbles: true, composed: true }));
      };
      const prima = foto();
      incollaSopraLeCelle(clip.sopra ?? { commenti: [], convalide: [], unioni: [], regole: [] }, clip.sourceRange, origini, doc.activeSheetName, doc.comments, doc);
      const dopo = foto();
      sopraAnnulla = rimetti(prima);
      sopraRipeti = rimetti(dopo);
      this.dispatchEvent(new CustomEvent('comments-changed', { bubbles: true, composed: true }));
    }

    this.applicaConvalidaInBlocco('Incolla', changeRecords, batchOps, (k) => doc.dataValidations.get(k) !== convalidePrima.get(k));
    doc.history.pushStep({
      description: "Incolla",
      changes: changeRecords,
      styleChanges: styleChanges.length > 0 ? styleChanges : undefined,
      ...(sopraAnnulla && sopraRipeti ? { undoAction: async () => { sopraAnnulla!(); }, redoAction: async () => { sopraRipeti!(); } } : {}),
    });

    await doc.client.applyBatch(batchOps);
    this.emitActiveFormat();
    this.updateFormulaBarValue();
    this.requestUpdate();
  }

  /** Incolla dopo un Taglia: le celle si SPOSTANO. Le formule spostate restano com'erano, quelle che le citavano (in qualunque foglio) le seguono,
   *  stili compresi; si svuota prima la sorgente e poi si scrive la destinazione, così anche uno spostamento sovrapposto riesce. */
  private async incollaTagliato(clip: NonNullable<ReturnType<typeof getInternalClipboard>>): Promise<void> {
    const doc = this.getDoc();
    const src = clip.sourceRange;
    const foglioSrc = clip.sourceSheet ?? doc.activeSheetName;
    const foglioDest = doc.activeSheetName;
    const dest = doc.selection.range;
    const deltaRows = dest.startRow - src.startRow;
    const deltaCols = dest.startCol - src.startCol;
    if (deltaRows === 0 && deltaCols === 0 && foglioSrc === foglioDest) { setInternalClipboard(null); return; }
    if (src.endRow + deltaRows > 1048576 || src.endCol + deltaCols > 16384) {
      this.avvisaStato(t("Impossibile incollare: le celle uscirebbero dal foglio"));
      return;
    }
    const blocco: BloccoSpostato = { foglio: foglioSrc, startRow: src.startRow, endRow: src.endRow, startCol: src.startCol, endCol: src.endCol, deltaRows, deltaCols, foglioDestinazione: foglioDest };
    const dentro = (f: string, r: number, c: number) => f === foglioSrc && r >= src.startRow && r <= src.endRow && c >= src.startCol && c <= src.endCol;

    // stato attuale di tutte le celle
    const libro = JSON.parse((await doc.client.serialize()) as string) as { sheets: Array<{ name: string; cells: Record<string, string> }> };
    const attuali = new Map<string, string>();
    const tocchi = new Map<string, { sheet: string; row: number; col: number; oldRaw: string; newRaw: string }>();
    const chiave = (f: string, r: number, c: number) => `${f}\u0000${r}:${c}`;
    for (const f of libro.sheets) for (const [indirizzo, raw] of Object.entries(f.cells)) {
      const p = parseCellAddress(indirizzo);
      if (p) attuali.set(chiave(f.name, p.row, p.col), raw);
    }
    const entra = (sheet: string, row: number, col: number) => {
      const k = chiave(sheet, row, col);
      let e = tocchi.get(k);
      if (!e) { const old = attuali.get(k) ?? ''; e = { sheet, row, col, oldRaw: old, newRaw: old }; tocchi.set(k, e); }
      return e;
    };
    // 1) le formule che citano le celle spostate le seguono
    for (const f of libro.sheets) for (const [indirizzo, raw] of Object.entries(f.cells)) {
      const p = parseCellAddress(indirizzo);
      if (!p || !raw.startsWith('=') || dentro(f.name, p.row, p.col)) continue;
      const nuovo = aggiornaPerSpostamento(raw, f.name, blocco, false);
      if (nuovo !== raw) entra(f.name, p.row, p.col).newRaw = nuovo;
    }
    // 2) la sorgente si svuota, 3) la destinazione riceve le celle (formule aggiornate, non traslate)
    const spostate: Array<{ r: number; c: number; raw: string }> = [];
    for (let r = src.startRow; r <= src.endRow; r++) for (let c = src.startCol; c <= src.endCol; c++) {
      const raw = attuali.get(chiave(foglioSrc, r, c)) ?? '';
      spostate.push({ r, c, raw: raw.startsWith('=') ? aggiornaPerSpostamento(raw, foglioSrc, blocco, true) : raw });
      entra(foglioSrc, r, c).newRaw = '';
    }
    for (const m of spostate) entra(foglioDest, m.r + deltaRows, m.c + deltaCols).newRaw = m.raw;

    // stili: prima si leggono, poi si tolgono dalla sorgente, poi si mettono nella destinazione (anche "nessuno stile")
    // anche i fogli con regole a formula, che possono citare le celle spostate
    const fogliConFormule = [doc.activeSheetName, ...doc.sheetStates.keys()].filter((n) => statoDelFoglio(doc, n).conditionalFormats.some((r) => r.type === 'formula'));
    const foglioUnico = [...new Set([foglioSrc, foglioDest, ...fogliConFormule])];
    const fotoStili = () => foglioUnico.map((n) => [n, clonaStato(statoDelFoglio(doc, n))] as const);
    const ripristinaStili = (foto: ReadonlyArray<readonly [string, ReturnType<typeof clonaStato>]>) => {
      for (const [n, s] of foto) {
        if (n === doc.activeSheetName) applicaStato(doc, clonaStato(s));
        else doc.sheetStates.set(n, clonaStato(s));
      }
    };
    // ciò che sta sopra le celle (commenti, nomi) si salva prima, per poterlo rimettere con Annulla
    const copiaCommenti = () => new Map([...doc.comments].map(([k, v]) => [k, { ...v }] as const));
    const copiaNomi = () => doc.namedRanges.getAll().map((n) => ({ ...n }));
    const commentiPrima = copiaCommenti();
    const nomiPrima = copiaNomi();
    const stiliPrima = fotoStili();
    const stiliSrc = statoDelFoglio(doc, foglioSrc).cellStyles;
    const stiliDest = statoDelFoglio(doc, foglioDest).cellStyles;
    const ids = spostate.map((m) => stiliSrc.get(cellKey(m.r, m.c)));
    for (const m of spostate) stiliSrc.delete(cellKey(m.r, m.c));
    spostate.forEach((m, i) => {
      const k = cellKey(m.r + deltaRows, m.c + deltaCols);
      if (ids[i] === undefined) stiliDest.delete(k); else stiliDest.set(k, ids[i] as number);
    });
    // convalide, celle unite e formattazioni condizionali stanno nello stato dei fogli: si spostano qui, prima della foto "dopo"
    const spostamento: Spostamento = { area: { startRow: src.startRow, endRow: src.endRow, startCol: src.startCol, endCol: src.endCol }, foglioOrigine: foglioSrc, foglioDestinazione: foglioDest, deltaRighe: deltaRows, deltaColonne: deltaCols };
    spostaDatiSopraLeCelle(statoDelFoglio(doc, foglioSrc), statoDelFoglio(doc, foglioDest), spostamento);
    for (const n of fogliConFormule) {
      if (n === foglioSrc || n === foglioDest) continue;
      const st = statoDelFoglio(doc, n);
      const nuove = st.conditionalFormats.map((r) => regolaDopoSpostamento(r, n, spostamento, false));
      if (n === doc.activeSheetName) doc.conditionalFormats = nuove; else st.conditionalFormats = nuove;
    }
    spostaCommenti(doc.comments, spostamento);
    const nomiSpostati = spostaNomi(nomiPrima, spostamento);
    const nomiCambiati = !nomiUguali(nomiPrima, nomiSpostati);
    if (nomiCambiati) {
      const registro = new NamedRangeRegistry();
      for (const n of nomiSpostati) registro.add({ ...n });
      doc.namedRanges = registro;
    }
    // grafici e tabelle pivot i cui dati sono tutti nell'area tagliata la seguono
    const clona = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
    const graficiPrima = clona(doc.charts ?? []);
    const pivotsPrima = clona(doc.pivots ?? []);
    doc.charts = graficiDopoSpostamento(doc.charts ?? [], spostamento);
    doc.pivots = pivotDopoSpostamento(doc.pivots ?? [], spostamento);
    const graficiDopo = clona(doc.charts);
    const pivotsDopo = clona(doc.pivots);
    const commentiDopo = copiaCommenti();
    const stiliDopo = fotoStili();

    const modifiche = [...tocchi.values()].filter((e) => e.oldRaw !== e.newRaw);
    await doc.client.applyBatch(modifiche.map((e) => (e.newRaw === '' ? { type: 'clear' as const, sheet: e.sheet, row: e.row, col: e.col } : { type: 'set' as const, sheet: e.sheet, row: e.row, col: e.col, raw: e.newRaw })));
    const rimettiNomi = async (nomi: NamedRange[]) => {
      const registro = new NamedRangeRegistry();
      for (const n of nomi) registro.add({ ...n });
      doc.namedRanges = registro;
      await doc.client.setNamedRanges(nomiPerMotore(registro));
    };
    if (nomiCambiati) await doc.client.setNamedRanges(nomiPerMotore(doc.namedRanges));
    const avvisaCommenti = () => this.dispatchEvent(new CustomEvent('comments-changed', { bubbles: true, composed: true }));
    doc.history.pushStep({
      description: 'Incolla (taglia)',
      changes: modifiche,
      undoAction: async () => {
        ripristinaStili(stiliPrima);
        doc.comments = new Map([...commentiPrima].map(([k, v]) => [k, { ...v }] as const));
        if (nomiCambiati) await rimettiNomi(nomiPrima);
        doc.charts = clona(graficiPrima);
        doc.pivots = clona(pivotsPrima);
        avvisaCommenti();
      },
      redoAction: async () => {
        ripristinaStili(stiliDopo);
        doc.comments = new Map([...commentiDopo].map(([k, v]) => [k, { ...v }] as const));
        if (nomiCambiati) await rimettiNomi(nomiSpostati);
        doc.charts = clona(graficiDopo);
        doc.pivots = clona(pivotsDopo);
        avvisaCommenti();
      },
    });
    avvisaCommenti();
    setInternalClipboard(null);
    doc.selection = createRangeSelection(dest.startRow, dest.startCol, dest.startRow + (src.endRow - src.startRow), dest.startCol + (src.endCol - src.startCol));
    this.cellsCache.clear();
    this.updateViewport();
    this.emitActiveFormat();
    this.updateFormulaBarValue();
    this.requestUpdate();
  }

  public async clearSelection() {
    const doc = this.getDoc();
    const changes = [];
    const batchOps = [];

    for (const sel of intervalliSelezione(doc.selection)) {
      const rCount = sel.endRow - sel.startRow + 1;
      const cCount = sel.endCol - sel.startCol + 1;
      for (let r = 0; r < rCount; r++) {
        for (let c = 0; c < cCount; c++) {
          const row = sel.startRow + r;
          const col = sel.startCol + c;
          const oldCell = await doc.client.getCell(doc.activeSheetName, row, col);
          if (oldCell.raw !== "") {
            changes.push({
              sheet: doc.activeSheetName,
              row,
              col,
              oldRaw: oldCell.raw,
              newRaw: "",
            });
            batchOps.push({
              type: "clear" as const,
              sheet: doc.activeSheetName,
              row,
              col,
            });
          }
        }
      }
    }

    if (changes.length > 0) {
      doc.history.pushStep({
        description: "Cancella celle",
        changes,
      });
      await doc.client.applyBatch(batchOps);
      this.updateFormulaBarValue();
      this.requestUpdate();
    }
  }

  /** Annullare o ripetere un'operazione fatta su un altro foglio: prima ci si porta su quel foglio, se esiste ancora. */
  private async tornaAlFoglioDelPasso(foglio: string | undefined): Promise<void> {
    const doc = this.getDoc();
    if (!foglio || foglio === doc.activeSheetName) return;
    if ((await doc.client.listSheets()).includes(foglio)) await this.switchSheet(foglio);
  }

  public async undo() {
    const doc = this.getDoc();
    const step = doc.history.popUndo();
    if (!step) return;
    await this.tornaAlFoglioDelPasso(step.sheet);

    if (step.undoAction) {
      await step.undoAction();
    }

    if (step.changes && step.changes.length > 0) {
      const batchOps = step.changes.map((c) => ({
        type: (c.oldRaw === "" ? "clear" : "set") as "clear" | "set",
        sheet: c.sheet,
        row: c.row,
        col: c.col,
        raw: c.oldRaw,
      }));
      await doc.client.applyBatch(batchOps);
    }

    if (step.styleChanges && step.styleChanges.length > 0) {
      for (const sc of step.styleChanges) {
        if (sc.type === 'cell') {
          if (sc.oldStyleId === undefined || sc.oldStyleId === 0) {
            doc.styles.cellStyles.delete(sc.target as string);
          } else {
            doc.styles.cellStyles.set(sc.target as string, sc.oldStyleId);
          }
        } else if (sc.type === 'col') {
          if (sc.oldStyleId === undefined || sc.oldStyleId === 0) {
            doc.styles.colStyles.delete(Number(sc.target));
          } else {
            doc.styles.colStyles.set(Number(sc.target), sc.oldStyleId);
          }
        } else if (sc.type === 'row') {
          if (sc.oldStyleId === undefined || sc.oldStyleId === 0) {
            doc.styles.rowStyles.delete(Number(sc.target));
          } else {
            doc.styles.rowStyles.set(Number(sc.target), sc.oldStyleId);
          }
        }
      }
    }

    this.emitActiveFormat();
    this.updateFormulaBarValue();
    this.requestUpdate();
  }

  public async redo() {
    const doc = this.getDoc();
    const step = doc.history.popRedo();
    if (!step) return;
    await this.tornaAlFoglioDelPasso(step.sheet);

    if (step.redoAction) {
      await step.redoAction();
    }

    if (step.changes && step.changes.length > 0) {
      const batchOps = step.changes.map((c) => ({
        type: (c.newRaw === "" ? "clear" : "set") as "clear" | "set",
        sheet: c.sheet,
        row: c.row,
        col: c.col,
        raw: c.newRaw,
      }));
      await doc.client.applyBatch(batchOps);
    }

    if (step.styleChanges && step.styleChanges.length > 0) {
      for (const sc of step.styleChanges) {
        if (sc.type === 'cell') {
          if (sc.newStyleId === undefined || sc.newStyleId === 0) {
            doc.styles.cellStyles.delete(sc.target as string);
          } else {
            doc.styles.cellStyles.set(sc.target as string, sc.newStyleId);
          }
        } else if (sc.type === 'col') {
          if (sc.newStyleId === undefined || sc.newStyleId === 0) {
            doc.styles.colStyles.delete(Number(sc.target));
          } else {
            doc.styles.colStyles.set(Number(sc.target), sc.newStyleId);
          }
        } else if (sc.type === 'row') {
          if (sc.newStyleId === undefined || sc.newStyleId === 0) {
            doc.styles.rowStyles.delete(Number(sc.target));
          } else {
            doc.styles.rowStyles.set(Number(sc.target), sc.newStyleId);
          }
        }
      }
    }

    this.emitActiveFormat();
    this.updateFormulaBarValue();
    this.requestUpdate();
  }

  // --- AZIONI FORMATTAZIONE ---

  public applyFormat(patch: Partial<CellStyle>, description = 'Formattazione') {
    const doc = this.getDoc();
    const sel = doc.selection;
    const styleChanges: StyleChangeRecord[] = [];

    if (sel.isFullCol) {
      for (let c = sel.range.startCol; c <= sel.range.endCol; c++) {
        const oldId = doc.styles.colStyles.get(c);
        applyFormatToColumn(doc.styles, c, patch);
        const newId = doc.styles.colStyles.get(c);
        styleChanges.push({ type: 'col', target: c, oldStyleId: oldId, newStyleId: newId });
      }
    } else if (sel.isFullRow) {
      for (let r = sel.range.startRow; r <= sel.range.endRow; r++) {
        const oldId = doc.styles.rowStyles.get(r);
        applyFormatToRow(doc.styles, r, patch);
        const newId = doc.styles.rowStyles.get(r);
        styleChanges.push({ type: 'row', target: r, oldStyleId: oldId, newStyleId: newId });
      }
    } else {
      for (const rg of intervalliSelezione(sel)) {
        for (let r = rg.startRow; r <= rg.endRow; r++) {
          for (let c = rg.startCol; c <= rg.endCol; c++) {
            const k = cellKey(r, c);
            const oldId = doc.styles.cellStyles.get(k);
            applyFormatToRange(doc.styles, { startRow: r, endRow: r, startCol: c, endCol: c }, patch);
            const newId = doc.styles.cellStyles.get(k);
            styleChanges.push({ type: 'cell', target: k, oldStyleId: oldId, newStyleId: newId });
          }
        }
      }
    }

    if (styleChanges.length > 0) {
      doc.history.pushStep({
        description,
        changes: [],
        styleChanges,
      });
    }

    this.emitActiveFormat();
    this.requestUpdate();
  }

  public applyBordersFormat(
    mode: string = this.currentBordersMode,
    style: 'thin' | 'medium' | 'dashed' = this.currentBorderStyle,
    color: string = this.currentBorderColor
  ) {
    this.currentBordersMode = mode;
    this.currentBorderStyle = style;
    this.currentBorderColor = color;

    const borderDef: BorderDef = { style, color: color || 'auto' };
    const doc = this.getDoc();
    const sel = doc.selection.range;
    const styleChanges: StyleChangeRecord[] = [];

    if (mode === 'none') {
      for (let r = sel.startRow; r <= sel.endRow; r++) {
        for (let c = sel.startCol; c <= sel.endCol; c++) {
          const k = cellKey(r, c);
          const oldId = doc.styles.cellStyles.get(k) ?? 0;
          const newId = doc.styles.registry.merge(oldId, {
            borders: {
              top: { style: 'none', color: '' },
              right: { style: 'none', color: '' },
              bottom: { style: 'none', color: '' },
              left: { style: 'none', color: '' },
            },
          });
          doc.styles.cellStyles.set(k, newId);
          styleChanges.push({ type: 'cell', target: k, oldStyleId: oldId, newStyleId: newId });
        }
      }
    } else {
      for (let r = sel.startRow; r <= sel.endRow; r++) {
        for (let c = sel.startCol; c <= sel.endCol; c++) {
          const k = cellKey(r, c);
          const oldId = doc.styles.cellStyles.get(k) ?? 0;
          const borders: Record<string, BorderDef> = {};

          if (mode === 'all') {
            borders.top = borderDef;
            borders.right = borderDef;
            borders.bottom = borderDef;
            borders.left = borderDef;
          } else if (mode === 'outer') {
            if (r === sel.startRow) borders.top = borderDef;
            if (r === sel.endRow) borders.bottom = borderDef;
            if (c === sel.startCol) borders.left = borderDef;
            if (c === sel.endCol) borders.right = borderDef;
          } else if (mode === 'top' && r === sel.startRow) {
            borders.top = borderDef;
          } else if (mode === 'bottom' && r === sel.endRow) {
            borders.bottom = borderDef;
          } else if (mode === 'left' && c === sel.startCol) {
            borders.left = borderDef;
          } else if (mode === 'right' && c === sel.endCol) {
            borders.right = borderDef;
          }

          if (Object.keys(borders).length > 0) {
            const newId = doc.styles.registry.merge(oldId, { borders });
            doc.styles.cellStyles.set(k, newId);
            styleChanges.push({ type: 'cell', target: k, oldStyleId: oldId, newStyleId: newId });
          }
        }
      }
    }

    if (styleChanges.length > 0) {
      doc.history.pushStep({
        description: t("Bordi {}", mode),
        changes: [],
        styleChanges,
      });
      this.emitActiveFormat();
      this.requestUpdate();
    }
  }

  public clearFormattingAction() {
    const doc = this.getDoc();
    const sel = doc.selection;
    const styleChanges: StyleChangeRecord[] = [];

    if (sel.isFullCol) {
      for (let c = sel.range.startCol; c <= sel.range.endCol; c++) {
        const oldId = doc.styles.colStyles.get(c);
        if (oldId !== undefined) {
          doc.styles.colStyles.delete(c);
          styleChanges.push({ type: 'col', target: c, oldStyleId: oldId, newStyleId: undefined });
        }
      }
    } else if (sel.isFullRow) {
      for (let r = sel.range.startRow; r <= sel.range.endRow; r++) {
        const oldId = doc.styles.rowStyles.get(r);
        if (oldId !== undefined) {
          doc.styles.rowStyles.delete(r);
          styleChanges.push({ type: 'row', target: r, oldStyleId: oldId, newStyleId: undefined });
        }
      }
    } else {
      for (let r = sel.range.startRow; r <= sel.range.endRow; r++) {
        for (let c = sel.range.startCol; c <= sel.range.endCol; c++) {
          const k = cellKey(r, c);
          const oldId = doc.styles.cellStyles.get(k);
          if (oldId !== undefined) {
            doc.styles.cellStyles.delete(k);
            styleChanges.push({ type: 'cell', target: k, oldStyleId: oldId, newStyleId: undefined });
          }
        }
      }
    }

    if (styleChanges.length > 0) {
      doc.history.pushStep({
        description: 'Cancella formattazione',
        changes: [],
        styleChanges,
      });
    }

    this.emitActiveFormat();
    this.requestUpdate();
  }

  public handleFormatAction(action: string, value?: string) {
    const doc = this.getDoc();
    const act = doc.selection.anchor;
    const currentStyle = resolveCellStyle(act.row, act.col, doc.styles);

    switch (action) {
      case 'format-bold':
        this.applyFormat({ bold: !currentStyle.bold }, 'Grassetto');
        break;
      case 'format-italic':
        this.applyFormat({ italic: !currentStyle.italic }, 'Corsivo');
        break;
      case 'format-underline':
        this.applyFormat({ underline: !currentStyle.underline }, 'Sottolineato');
        break;
      case 'format-strike':
        this.applyFormat({ strike: !currentStyle.strike }, 'Barrato');
        break;
      case 'cell-unlock':
        this.applyFormat({ sbloccata: true }, t('Sblocca le celle'));
        break;
      case 'cell-lock':
        this.applyFormat({ sbloccata: undefined }, t('Blocca le celle'));
        break;
      case 'cell-hide-formula':
        this.applyFormat({ formulaNascosta: true }, t('Nascondi la formula'));
        break;
      case 'cell-show-formula':
        this.applyFormat({ formulaNascosta: undefined }, t('Mostra la formula'));
        break;
      case 'change-font':
        if (value) this.applyFormat({ fontFamily: value }, t("Carattere {}", value));
        break;
      case 'change-size':
        if (value) {
          const sz = parseInt(value, 10);
          if (sz >= 8 && sz <= 72) this.applyFormat({ fontSize: sz }, t("Dimensione {}", sz));
        }
        break;
      case 'change-text-color':
        this.applyFormat({ color: value || 'auto' }, 'Colore testo');
        break;
      case 'change-fill-color':
        this.applyFormat({ fill: value || 'none' }, 'Colore riempimento');
        break;
      case 'align-left':
        this.applyFormat({ hAlign: 'left' }, 'Allinea a sinistra');
        break;
      case 'align-center':
        this.applyFormat({ hAlign: 'center' }, 'Allinea al centro');
        break;
      case 'align-right':
        this.applyFormat({ hAlign: 'right' }, 'Allinea a destra');
        break;
      case 'align-top':
        this.applyFormat({ vAlign: 'top' }, 'Allinea in alto');
        break;
      case 'align-middle':
        this.applyFormat({ vAlign: 'middle' }, 'Allinea al centro verticale');
        break;
      case 'align-bottom':
        this.applyFormat({ vAlign: 'bottom' }, 'Allinea in basso');
        break;
      case 'format-wrap':
        this.applyFormat({ wrap: !currentStyle.wrap }, 'Testo a capo');
        break;
      case 'change-number-format': {
        const presetMap: Record<string, string> = {
          auto: '',
          text: '@',
          number: '#,##0.00',
          percent: '0.00%',
          currency: '€#,##0.00',
          scientific: '0.00E+00',
          date: 'dd/mm/yyyy',
          time: 'hh:mm:ss',
          datetime: 'dd/mm/yyyy hh:mm:ss',
          ...FORMATI_PREIMPOSTATI,
        };
        if (value === 'custom') {   // "Altri formati…": la finestra del formato personalizzato la apre il programma
          this.dispatchEvent(new CustomEvent('chiedi-formato-numero', { bubbles: true, composed: true }));
          break;
        }
        const numFmt = (value && presetMap[value] !== undefined) ? presetMap[value] : (value || '');
        this.applyFormat({ numFmt }, t("Formato {}", value));
        break;
      }
      case 'set-num-fmt-auto':
        this.applyFormat({ numFmt: '' }, t("Formato Automatico"));
        break;
      case 'set-num-fmt-text':
        this.applyFormat({ numFmt: '@' }, t("Formato Testo"));
        break;
      case 'set-num-fmt-number':
        this.applyFormat({ numFmt: '#,##0.00' }, t("Formato Numero"));
        break;
      case 'format-currency':
        this.applyFormat({ numFmt: '€#,##0.00' }, t("Formato Valuta"));
        break;
      case 'format-percent':
        this.applyFormat({ numFmt: '0.00%' }, t("Formato Percentuale"));
        break;
      case 'set-num-fmt-accounting':
      case 'set-num-fmt-financial':
      case 'set-num-fmt-currency-round':
      case 'set-num-fmt-duration':
      case 'set-num-fmt-fraction':
      case 'set-num-fmt-date-long':
      case 'set-num-fmt-negative-red': {
        const id = action.slice('set-num-fmt-'.length);
        const voce = FORMATI_PREIMPOSTATI_PER_ID[id];
        if (voce) this.applyFormat({ numFmt: voce.codice }, t("Formato {}", voce.nome));
        break;
      }
      case 'set-num-fmt-custom':
        this.applyFormat({ numFmt: value ?? '' }, t("Formato personalizzato"));
        break;
      case 'set-num-fmt-scientific':
        this.applyFormat({ numFmt: '0.00E+00' }, t("Formato Scientifico"));
        break;
      case 'set-num-fmt-date':
        this.applyFormat({ numFmt: 'dd/mm/yyyy' }, t("Formato Data"));
        break;
      case 'set-num-fmt-time':
        this.applyFormat({ numFmt: 'hh:mm:ss' }, t("Formato Ora"));
        break;
      case 'set-num-fmt-datetime':
        this.applyFormat({ numFmt: 'dd/mm/yyyy hh:mm:ss' }, t("Formato Data e Ora"));
        break;
      case 'increase-decimals': {
        const nextCode = increaseDecimals(currentStyle.numFmt);
        this.applyFormat({ numFmt: nextCode }, 'Aumenta decimali');
        break;
      }
      case 'decrease-decimals': {
        const prevCode = decreaseDecimals(currentStyle.numFmt);
        this.applyFormat({ numFmt: prevCode }, 'Diminuisci decimali');
        break;
      }
      case 'format-borders':
        this.currentBordersMode = value || 'none';
        this.applyBordersFormat(this.currentBordersMode, this.currentBorderStyle, this.currentBorderColor);
        break;
      case 'change-border-style':
        this.currentBorderStyle = (value === 'medium' || value === 'dashed') ? value : 'thin';
        if (this.currentBordersMode && this.currentBordersMode !== 'none') {
          this.applyBordersFormat(this.currentBordersMode, this.currentBorderStyle, this.currentBorderColor);
        }
        break;
      case 'change-border-color':
        this.currentBorderColor = value || 'auto';
        if (this.currentBordersMode && this.currentBordersMode !== 'none') {
          this.applyBordersFormat(this.currentBordersMode, this.currentBorderStyle, this.currentBorderColor);
        }
        break;
      case 'clear-formatting':
        this.clearFormattingAction();
        break;
      case 'sort-asc':
        this.sortAsc();
        break;
      case 'sort-desc':
        this.sortDesc();
        break;
      case 'create-filter':
      case 'toggle-filter':
        this.toggleFilter();
        break;
      case 'clear-filter':
        this.clearFilters();
        break;
      case 'merge-all':
        this.mergeSelection('all');
        break;
      case 'merge-horizontal':
        this.mergeSelection('horizontal');
        break;
      case 'merge-vertical':
        this.mergeSelection('vertical');
        break;
      case 'unmerge':
        this.unmergeSelection();
        break;
      case 'insert-checkbox':
        this.insertCheckbox();
        break;
      case 'insert-chart':
        this.insertChart((value as ChartType) || 'column');
        break;
      case 'insert-pivot':
        this.insertPivotTable();
        break;
      case 'open-find-replace':
      case 'find-replace':
        this.openFind(true);
        break;
    }
  }

  // --- OPERAZIONI GRAFICI E PIVOT (M3) ---

  public async insertChart(type: ChartType = 'column'): Promise<ChartConfig> {
    const doc = this.getDoc();
    const sel = doc.selection.range;

    const categories: string[] = [];
    const seriesList: ChartSeries[] = [];

    const startRow = sel.startRow;
    const endRow = sel.endRow;
    const startCol = sel.startCol;
    const endCol = sel.endCol;

    const isSingleCell = (startRow === endRow && startCol === endCol);
    const r1 = isSingleCell ? 1 : startRow;
    const r2 = isSingleCell ? 5 : endRow;
    const c1 = isSingleCell ? 1 : startCol;
    const c2 = isSingleCell ? 2 : endCol;

    const rangeStr = `${columnIndexToLetters(c1)}${r1}:${columnIndexToLetters(c2)}${r2}`;

    for (let r = r1; r <= r2; r++) {
      const cellData = await doc.client.getCell(doc.activeSheetName, r, c1);
      const catVal = cellData.value;
      const catText = catVal.kind === 'text' ? catVal.value : catVal.kind === 'number' ? String(catVal.value) : t("Voce {}", r - r1 + 1);
      categories.push(catText);
    }

    for (let c = c1 + 1; c <= c2; c++) {
      const colLetter = columnIndexToLetters(c);
      const data: number[] = [];
      for (let r = r1; r <= r2; r++) {
        const cellData = await doc.client.getCell(doc.activeSheetName, r, c);
        const val = cellData.value;
        data.push(val.kind === 'number' ? val.value : 0);
      }
      seriesList.push({
        name: t("Serie {}", colLetter),
        data,
      });
    }

    if (seriesList.length === 0) {
      const data: number[] = [];
      for (let r = r1; r <= r2; r++) {
        const cellData = await doc.client.getCell(doc.activeSheetName, r, c1);
        const val = cellData.value;
        data.push(val.kind === 'number' ? val.value : 10 * (r - r1 + 1));
      }
      seriesList.push({
        name: t("Serie 1"),
        data,
      });
    }

    const chartId = `chart-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newChart: ChartConfig = {
      id: chartId,
      title: t("Grafico {}", doc.charts.length + 1),
      type,
      sheetName: doc.activeSheetName,
      dataRange: rangeStr,
      x: 120 + (doc.charts.length * 30),
      y: 60 + (doc.charts.length * 30),
      width: 480,
      height: 300,
      showLegend: true,
      showLabels: false,
      categories,
      series: seriesList,
    };

    doc.charts.push(newChart);
    this.selectedChartId = chartId;
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('chart-created', {
      detail: newChart,
      bubbles: true,
      composed: true,
    }));

    return newChart;
  }

  public async insertPivotTable(): Promise<PivotConfig> {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    const isSingleCell = (sel.startRow === sel.endRow && sel.startCol === sel.endCol);
    const r1 = isSingleCell ? 1 : sel.startRow;
    const r2 = isSingleCell ? 10 : sel.endRow;
    const c1 = isSingleCell ? 1 : sel.startCol;
    const c2 = isSingleCell ? 4 : sel.endCol;

    const sourceRange = `${columnIndexToLetters(c1)}${r1}:${columnIndexToLetters(c2)}${r2}`;

    const rowFieldNames: string[] = [];
    for (let c = c1; c <= c2; c++) {
      const cellData = await doc.client.getCell(doc.activeSheetName, r1, c);
      const headerVal = cellData.value;
      const name = headerVal.kind === 'text' ? headerVal.value : t("Colonna {}", columnIndexToLetters(c));
      rowFieldNames.push(name);
    }

    const pivotId = `pivot-${Date.now()}`;
    const newPivot: PivotConfig = {
      id: pivotId,
      name: t("Tabella pivot {}", doc.pivots.length + 1),
      sourceSheet: doc.activeSheetName,
      sourceRange,
      rowFields: [{ sourceColIndex: 0, name: rowFieldNames[0] || t("Campo 1") }],
      colFields: [],
      valueFields: [{
        sourceColIndex: Math.min(1, rowFieldNames.length - 1),
        name: rowFieldNames[1] || t("Valore"),
        aggregation: 'SUM',
      }],
      filters: [],
      showGrandTotals: true,
      showSubtotals: false,
    };

    doc.pivots.push(newPivot);
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('pivot-created', {
      detail: newPivot,
      bubbles: true,
      composed: true,
    }));

    return newPivot;
  }

  /** Il foglio in cui sta il risultato di ogni tabella pivot (per id): riapplicarla riscrive lo stesso foglio invece di crearne altri. */
  private pivotFogli = new Map<string, string>();

  /** La "firma" dei dati (e delle impostazioni) con cui il risultato di ogni pivot è stato calcolato l'ultima volta: se cambia, la pivot si ricalcola. */
  private firmePivot = new Map<string, string>();
  private aggiornandoPivot = false;
  private pivotDaRifare = false;

  /** Le tabelle pivot sono vive come in Google Fogli: quando cambiano i dati di partenza il risultato si riscrive da solo.
   *  La prima volta che una pivot si vede (per esempio dopo aver aperto un file) si prende nota dei dati senza riscrivere niente. */
  private async aggiornaPivot(): Promise<void> {
    const doc = this.getDoc();
    if (!doc.pivots || doc.pivots.length === 0) return;
    if (this.aggiornandoPivot) { this.pivotDaRifare = true; return; }
    this.aggiornandoPivot = true;
    try {
      do {
        this.pivotDaRifare = false;
        const fogli = await doc.client.listSheets();
        for (const p of [...doc.pivots]) {
          const risultato = p.resultSheet ?? this.pivotFogli.get(p.id);
          if (!risultato || risultato === p.sourceSheet || !fogli.includes(risultato) || !fogli.includes(p.sourceSheet)) continue;
          const a = leggiIntervalloTesto(p.sourceRange);
          if (!a || (a.endRow - a.startRow + 1) * (a.endCol - a.startCol + 1) > 20000) continue;
          const valori = await doc.client.getRange(p.sourceSheet, a.startRow, a.startCol, a.endRow, a.endCol);
          const firma = JSON.stringify([valori, p.rowFields, p.colFields, p.valueFields, p.filters, p.showGrandTotals, p.showSubtotals, p.name]);
          const nota = this.firmePivot.get(p.id);
          this.firmePivot.set(p.id, firma);
          if (nota !== undefined && nota !== firma) {
            await this.computeAndRenderPivot(p);
            this.firmePivot.set(p.id, firma);   // il ricalcolo ha già letto questi dati
          }
        }
      } while (this.pivotDaRifare);
    } catch {
      // un errore temporaneo del motore non deve rompere il disegno
    } finally {
      this.aggiornandoPivot = false;
    }
  }

  /** Un nome libero per il foglio di una tabella pivot: senza i caratteri vietati, al massimo 31 lunghi, diverso dai fogli che ci sono. */
  private nomeFoglioPivot(base: string, esistenti: string[]): string {
    const pulito = base.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').slice(0, 27).trim() || 'Pivot';
    const usati = new Set(esistenti.map((x) => x.toLowerCase()));
    let nome = pulito;
    for (let k = 2; usati.has(nome.toLowerCase()); k++) nome = `${pulito} (${k})`;
    return nome;
  }

  public async computeAndRenderPivot(config: PivotConfig, targetSheetName?: string, startRow = 1, startCol = 1) {
    const doc = this.getDoc();
    // il pannello laterale restituisce una copia della configurazione: quella del documento è l'unica che si salva e che si tiene viva, quindi la si aggiorna qui
    const idx = (doc.pivots ?? []).findIndex((p) => p.id === config.id);
    if (idx >= 0) doc.pivots = doc.pivots.map((p, i) => (i === idx ? config : p));
    this.firmePivot.delete(config.id);   // la prossima lettura dei dati riparte da questa versione
    // Il risultato non si scrive sopra i dati di partenza: va in un foglio proprio (creato la prima volta, riscritto le volte dopo).
    let sheet = targetSheetName ?? '';
    let nuovoFoglio: string | undefined;
    if (!sheet) {
      const elenco = await doc.client.listSheets();
      const esistente = config.resultSheet ?? this.pivotFogli.get(config.id);
      if (esistente && elenco.includes(esistente)) {
        sheet = esistente;
        const libro = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
        const vecchie = libro?.getSheet(sheet)?.getAllCells() ?? [];
        if (vecchie.length > 0) await doc.client.applyBatch(vecchie.map(({ row, col }) => ({ type: 'clear' as const, sheet, row, col })));
      } else {
        nuovoFoglio = this.nomeFoglioPivot(config.name, elenco);
        await doc.client.addSheet(nuovoFoglio);
        this.pivotFogli.set(config.id, nuovoFoglio);
        sheet = nuovoFoglio;
      }
    }

    const match = config.sourceRange.match(/^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/);
    if (!match) return;
    config.resultSheet = sheet;   // si salva nel file: riaperta, la pivot sa dove riscrivere il risultato
    this.pivotFogli.set(config.id, sheet);
    const c1 = columnLettersToIndex(match[1]);
    const r1 = parseInt(match[2], 10);
    const c2 = columnLettersToIndex(match[3]);
    const r2 = parseInt(match[4], 10);

    const matrix: CellValue[][] = [];
    for (let r = r1; r <= r2; r++) {
      const rowVals: CellValue[] = [];
      for (let c = c1; c <= c2; c++) {
        const cellData = await doc.client.getCell(config.sourceSheet, r, c);
        rowVals.push(cellData.value);
      }
      matrix.push(rowVals);
    }

    const result = computePivotTable(config, matrix);

    await doc.client.setCell(sheet, startRow, startCol, `${config.name} (${config.valueFields.map(v => v.aggregation + ' di ' + v.name).join(', ')})`);

    let curRow = startRow + 1;
    await doc.client.setCell(sheet, curRow, startCol, config.rowFields.map(f => f.name).join(' / '));
    for (let cIdx = 0; cIdx < result.colKeys.length; cIdx++) {
      await doc.client.setCell(sheet, curRow, startCol + 1 + cIdx, result.colKeys[cIdx]);
    }
    if (config.showGrandTotals && result.colKeys.length > 1) {
      await doc.client.setCell(sheet, curRow, startCol + 1 + result.colKeys.length, t("Totale complessivo"));
    }

    curRow++;
    for (const rData of result.rows) {
      await doc.client.setCell(sheet, curRow, startCol, rData.rowKeys.join(' - '));
      for (let cIdx = 0; cIdx < rData.cells.length; cIdx++) {
        await doc.client.setCell(sheet, curRow, startCol + 1 + cIdx, String(rData.cells[cIdx].value));
      }
      if (rData.rowTotal !== undefined && result.colKeys.length > 1) {
        await doc.client.setCell(sheet, curRow, startCol + 1 + rData.cells.length, String(rData.rowTotal));
      }
      curRow++;
    }

    if (config.showGrandTotals && result.grandTotalRow) {
      await doc.client.setCell(sheet, curRow, startCol, t("Totale complessivo"));
      for (let cIdx = 0; cIdx < result.grandTotalRow.cells.length; cIdx++) {
        await doc.client.setCell(sheet, curRow, startCol + 1 + cIdx, String(result.grandTotalRow.cells[cIdx].value));
      }
      if (result.grandTotalRow.rowTotal !== undefined && result.colKeys.length > 1) {
        await doc.client.setCell(sheet, curRow, startCol + 1 + result.grandTotalRow.cells.length, String(result.grandTotalRow.rowTotal));
      }
    }

    if (nuovoFoglio) {
      const creato = nuovoFoglio;
      await this.refreshSheetList();
      doc.history.pushStep({
        description: 'Crea tabella pivot',
        undoAction: async () => { await this.eliminaFoglio(creato); },
        redoAction: async () => {
          await doc.client.addSheet(creato);
          await this.refreshSheetList();
          await this.computeAndRenderPivot(config, creato, startRow, startCol);
          await this.switchSheet(creato);
        },
      });
      await this.switchSheet(creato);
    }
    this.cellsCache.clear();
    this.updateViewport();
    this.requestUpdate();
  }

  private handleChartSelect(id: string) {
    this.selectedChartId = id;
    this.requestUpdate();
  }

  private handleChartChange(updated: ChartConfig) {
    const doc = this.getDoc();
    const idx = doc.charts.findIndex(c => c.id === updated.id);
    if (idx >= 0) {
      doc.charts[idx] = updated;
      this.requestUpdate();
      void this.aggiornaGrafici(); // se è cambiato l'intervallo, i dati si rileggono
    }
  }

  private handleChartDelete(id: string) {
    const doc = this.getDoc();
    doc.charts = doc.charts.filter(c => c.id !== id);
    if (this.selectedChartId === id) this.selectedChartId = null;
    this.requestUpdate();
  }

  private handleChartEdit(config: ChartConfig) {
    this.selectedChartId = config.id;
    this.dispatchEvent(new CustomEvent('chart-edit-requested', {
      detail: config,
      bubbles: true,
      composed: true,
    }));
  }

  // --- OPERAZIONI STRUTTURALI (M1) ---

  /** L'aspetto del foglio attivo e i nomi, copiati: serve a ricordare com'era prima di un intervento per poterlo annullare. */
  private aspetto() {
    const doc = this.getDoc();
    return { stato: clonaStato(statoCorrente(doc)), nomi: doc.namedRanges.getAll().map((n) => ({ ...n })) };
  }

  private async applicaAspetto(a: ReturnType<FreeSheetGrid['aspetto']>): Promise<void> {
    const doc = this.getDoc();
    applicaStato(doc, clonaStato(a.stato));
    const registro = new NamedRangeRegistry();
    for (const n of a.nomi) registro.add({ ...n });
    doc.namedRanges = registro;
    await doc.client.setNamedRanges(nomiPerMotore(registro));
    this.cellsCache.clear();
    this.updateViewport();
    this.emitActiveFormat();
    this.requestUpdate();
  }

  private firmaAspetto(a: ReturnType<FreeSheetGrid['aspetto']>): string {
    return JSON.stringify([statoADati(a.stato), a.nomi]);
  }

  private registraAspetto(descrizione: string, prima: ReturnType<FreeSheetGrid['aspetto']>): void {
    const dopo = this.aspetto();
    if (this.firmaAspetto(prima) === this.firmaAspetto(dopo)) return; // non è cambiato niente: niente da annullare
    this.getDoc().history.pushStep({ description: descrizione, undoAction: () => this.applicaAspetto(prima), redoAction: () => this.applicaAspetto(dopo) });
  }

  /** Esegue un intervento che cambia solo l'aspetto del foglio (celle unite, righe nascoste, filtri, convalide...) e lo rende annullabile. */
  private conAnnulla(descrizione: string, azione: () => void): void {
    const prima = this.aspetto();
    azione();
    this.registraAspetto(descrizione, prima);
  }

  private async conAnnullaAsync(descrizione: string, azione: () => Promise<void>): Promise<void> {
    const prima = this.aspetto();
    await azione();
    this.registraAspetto(descrizione, prima);
  }

  /** Esegue (o ripete) un inserimento o un'eliminazione di righe o colonne sul foglio attivo. Il motore sposta le celle e aggiorna le formule;
   *  qui si spostano anche stili, misure, righe nascoste, celle unite, convalide, formattazioni condizionali, filtri, commenti e nomi. */
  private async applicaStruttura(op: OperazioneStruttura): Promise<void> {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    if (op.tipo === 'insert_rows') await doc.client.insertRows(foglio, op.indice, op.conta);
    else if (op.tipo === 'delete_rows') await doc.client.deleteRows(foglio, op.indice, op.conta);
    else if (op.tipo === 'insert_cols') await doc.client.insertCols(foglio, op.indice, op.conta);
    else await doc.client.deleteCols(foglio, op.indice, op.conta);
    spostaDatiAccessori(doc, op);
    // grafici e tabelle pivot seguono i loro dati: l'intervallo si sposta, si allarga o si restringe
    doc.charts = graficiDopoStruttura(doc.charts ?? [], foglio, op);
    const pivotPrima = doc.pivots ?? [];
    doc.pivots = pivotDopoStruttura(pivotPrima, foglio, op);
    await doc.client.setNamedRanges(nomiPerMotore(doc.namedRanges));
    for (const p of doc.pivots) {
      const prima = pivotPrima.find((x) => x.id === p.id);
      const risultato = p.resultSheet ?? this.pivotFogli.get(p.id);
      if (prima && risultato && risultato !== foglio && (prima.sourceRange !== p.sourceRange || prima.sourceSheet !== p.sourceSheet)) await this.computeAndRenderPivot(p);
    }
    if (this.selectedChartId && !doc.charts.some((c) => c.id === this.selectedChartId)) this.selectedChartId = null;
    this.cellsCache.clear();
    this.updateViewport();
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('comments-changed', { bubbles: true, composed: true }));
  }

  /** Una fotografia di tutto ciò che un'eliminazione può far perdere: celle, aspetto del foglio, commenti e nomi. */
  private async istantaneaStruttura() {
    const doc = this.getDoc();
    return {
      libro: (await doc.client.serialize()) as string,
      stato: clonaStato(statoCorrente(doc)),
      // le regole a formula degli altri fogli possono citare questo foglio: si riscrivono anche loro, e Annulla le rimette
      regoleAltri: [...doc.sheetStates].filter(([n]) => n !== doc.activeSheetName).map(([n, s]) => [n, JSON.parse(JSON.stringify(s.conditionalFormats)) as typeof s.conditionalFormats] as const),
      commenti: new Map([...doc.comments].map(([k, v]) => [k, { ...v }] as const)),
      nomi: doc.namedRanges.getAll().map((n) => ({ ...n })),
      grafici: JSON.parse(JSON.stringify(doc.charts ?? [])) as typeof doc.charts,
      pivots: JSON.parse(JSON.stringify(doc.pivots ?? [])) as typeof doc.pivots,
    };
  }

  private async ripristinaIstantanea(i: Awaited<ReturnType<FreeSheetGrid['istantaneaStruttura']>>): Promise<void> {
    const doc = this.getDoc();
    const registro = new NamedRangeRegistry();
    for (const n of i.nomi) registro.add({ ...n });
    doc.namedRanges = registro;
    await doc.client.setNamedRanges(nomiPerMotore(registro));
    await doc.client.restore(i.libro);
    applicaStato(doc, clonaStato(i.stato));
    for (const [n, regole] of i.regoleAltri) { const st = doc.sheetStates.get(n); if (st) st.conditionalFormats = JSON.parse(JSON.stringify(regole)) as typeof regole; }
    doc.comments = new Map([...i.commenti].map(([k, v]) => [k, { ...v }] as const));
    doc.charts = JSON.parse(JSON.stringify(i.grafici)) as typeof doc.charts;
    doc.pivots = JSON.parse(JSON.stringify(i.pivots)) as typeof doc.pivots;
    this.cellsCache.clear();
    this.updateViewport();
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('comments-changed', { bubbles: true, composed: true }));
  }

  /** Inserire righe o colonne si annulla con l'eliminazione inversa; eliminare si annulla rimettendo la fotografia di prima. */
  private async operazioneStruttura(descrizione: string, op: OperazioneStruttura): Promise<void> {
    const doc = this.getDoc();
    if (op.tipo === 'insert_rows' || op.tipo === 'insert_cols') {
      await this.applicaStruttura(op);
      const inversa: OperazioneStruttura = { ...op, tipo: op.tipo === 'insert_rows' ? 'delete_rows' : 'delete_cols' };
      doc.history.pushStep({ description: descrizione, undoAction: () => this.applicaStruttura(inversa), redoAction: () => this.applicaStruttura(op) });
      return;
    }
    const prima = await this.istantaneaStruttura();
    await this.applicaStruttura(op);
    const dopo = await this.istantaneaStruttura();
    doc.history.pushStep({ description: descrizione, undoAction: () => this.ripristinaIstantanea(prima), redoAction: () => this.ripristinaIstantanea(dopo) });
  }

  public async insertRowsAbove() {
    const sel = this.getDoc().selection.range;
    const conta = sel.endRow - sel.startRow + 1;
    await this.operazioneStruttura(t("Inserisci {} righe sopra", conta), { tipo: 'insert_rows', indice: sel.startRow, conta });
  }

  public async insertRowsBelow() {
    const sel = this.getDoc().selection.range;
    const conta = sel.endRow - sel.startRow + 1;
    await this.operazioneStruttura(t("Inserisci {} righe sotto", conta), { tipo: 'insert_rows', indice: sel.endRow + 1, conta });
  }

  public async deleteSelectedRows() {
    const sel = this.getDoc().selection.range;
    const conta = sel.endRow - sel.startRow + 1;
    await this.operazioneStruttura(t("Elimina {} righe", conta), { tipo: 'delete_rows', indice: sel.startRow, conta });
  }

  public async insertColsLeft() {
    const sel = this.getDoc().selection.range;
    const conta = sel.endCol - sel.startCol + 1;
    await this.operazioneStruttura(t("Inserisci {} colonne a sinistra", conta), { tipo: 'insert_cols', indice: sel.startCol, conta });
  }

  public async insertColsRight() {
    const sel = this.getDoc().selection.range;
    const conta = sel.endCol - sel.startCol + 1;
    await this.operazioneStruttura(t("Inserisci {} colonne a destra", conta), { tipo: 'insert_cols', indice: sel.endCol + 1, conta });
  }

  public async deleteSelectedCols() {
    const sel = this.getDoc().selection.range;
    const conta = sel.endCol - sel.startCol + 1;
    await this.operazioneStruttura(t("Elimina {} colonne", conta), { tipo: 'delete_cols', indice: sel.startCol, conta });
  }

  /** Inserisci › Minigrafico: con i numeri selezionati (una riga o una colonna) scrive =SPARKLINE(...) nella cella libera subito dopo. */
  public async inserisciMinigrafico(): Promise<string> {
    const doc = this.getDoc();
    const s = doc.selection.range;
    if (s.startRow === s.endRow && s.startCol === s.endCol) return t("Seleziona i numeri del minigrafico (una riga o una colonna), poi Inserisci › Minigrafico");
    const inRiga = s.startRow === s.endRow || (s.endCol - s.startCol >= s.endRow - s.startRow && s.startRow === s.endRow);
    const verticale = !inRiga && s.startCol === s.endCol;
    const r = verticale ? s.endRow + 1 : s.startRow, c = verticale ? s.startCol : s.endCol + 1;
    if (r > MAX_ROWS || c > MAX_COLS) return t("Non c'è posto dopo la selezione per il minigrafico");
    const intervallo = `${columnIndexToLetters(s.startCol)}${s.startRow}:${columnIndexToLetters(s.endCol)}${s.endRow}`;
    const raw = `=SPARKLINE(${intervallo})`;
    const vecchio = (await doc.client.getCell(doc.activeSheetName, r, c)).raw;
    if (vecchio !== '' && typeof window.confirm === 'function' && !window.confirm(t("La cella {} non è vuota: sostituirla con il minigrafico?", `${columnIndexToLetters(c)}${r}`))) return t("Minigrafico non inserito");
    const changes = [{ sheet: doc.activeSheetName, row: r, col: c, oldRaw: vecchio, newRaw: raw }];
    const ops = [{ type: 'set' as const, sheet: doc.activeSheetName, row: r, col: c, raw }];
    this.applicaConvalidaInBlocco(t("Minigrafico"), changes, ops);
    if (ops.length === 0) return t("Minigrafico non inserito");
    doc.history.pushStep({ description: 'Inserisci minigrafico', changes });
    await doc.client.applyBatch(ops);
    this.cellsCache.clear();
    this.updateViewport();
    this.requestUpdate();
    return t("Minigrafico inserito in {}: {}", `${columnIndexToLetters(c)}${r}`, raw);
  }

  // ---- Riempi serie (Modifica › Riempi serie...): vedi sheet/serie.ts ----
  /** Per la finestra: la direzione proposta (colonne se la selezione è più alta che larga) e se la cella di partenza è una data. */
  public async propostaSerie(): Promise<{ direzione: 'colonne' | 'righe'; data: boolean }> {
    const doc = this.getDoc();
    const s = doc.selection.range;
    const fmt = resolveCellStyle(s.startRow, s.startCol, doc.styles).numFmt ?? '';
    return { direzione: s.endRow - s.startRow >= s.endCol - s.startCol ? 'colonne' : 'righe', data: /[dmy]/i.test(fmt.replace(/"[^"]*"|\[.]/g, '')) && !/^0|#/.test(fmt) };
  }

  /** Riempie la selezione con una serie: il primo valore di ogni colonna (o riga) è la partenza. Con una cella sola e il limite
   *  la serie va avanti fino al limite. Il formato della cella di partenza passa alle altre. Un solo passo di annulla. */
  public async riempiSerie(direzione: 'colonne' | 'righe', tipo: TipoSerie, unita: UnitaData, passoTesto: string, limiteTesto: string): Promise<{ ok: boolean; messaggio: string }> {
    const doc = this.getDoc();
    const numero = (x: string): number | null => {
      const s = x.trim();
      if (s === '') return null;
      const n = Number(daInputUtente(s));
      if (Number.isFinite(n) && /^[-+]?[\d.,]+(e[-+]?\d+)?$/i.test(s)) return n;
      return testoADataSeriale(s);
    };
    const passo = numero(passoTesto);
    if (passo === null) return { ok: false, messaggio: t("Il passo non è un numero") };
    const limite = limiteTesto.trim() === '' ? undefined : numero(limiteTesto);
    if (limite === null) return { ok: false, messaggio: t("Il valore limite non è un numero o una data") };
    if (tipo === 'crescita' && passo <= 0) return { ok: false, messaggio: t("Per la crescita il passo deve essere maggiore di zero") };
    if (tipo === 'data' && unita !== 'giorno' && !Number.isInteger(passo)) return { ok: false, messaggio: t("Per mesi, anni e giorni feriali il passo deve essere un numero intero") };
    const p: ParametriSerie = { tipo, unita, passo, ...(limite !== undefined ? { limite } : {}) };
    const s = doc.selection.range;
    const colonne = direzione === 'colonne';
    const unaSola = colonne ? s.startRow === s.endRow : s.startCol === s.endCol;
    if (unaSola && limite === undefined) return { ok: false, messaggio: t("Seleziona le celle da riempire (la prima è quella di partenza) o scrivi il valore limite") };
    const changes: Array<{ sheet: string; row: number; col: number; oldRaw: string; newRaw: string }> = [];
    const ops: Array<{ type: 'set'; sheet: string; row: number; col: number; raw: string }> = [];
    const stili: StyleChangeRecord[] = [];
    let senzaNumero = 0;
    const [daL, aL] = colonne ? [s.startCol, s.endCol] : [s.startRow, s.endRow];
    for (let l = daL; l <= aL; l++) {
      const r0 = colonne ? s.startRow : l, c0 = colonne ? l : s.startCol;
      const v = (await doc.client.getCell(doc.activeSheetName, r0, c0)).value;
      if (v.kind !== 'number') { senzaNumero++; continue; }
      const quanti = unaSola ? CELLE_MASSIME_SERIE : (colonne ? s.endRow - s.startRow : s.endCol - s.startCol);
      const valori = valoriSerie(v.value, Math.min(quanti, colonne ? MAX_ROWS - r0 : MAX_COLS - c0), p);
      const stile = doc.styles.cellStyles.get(cellKey(r0, c0));
      for (let k = 0; k < valori.length && ops.length < CELLE_MASSIME_SERIE; k++) {
        const r = colonne ? r0 + k + 1 : r0, c = colonne ? c0 : c0 + k + 1;
        const vecchio = (await doc.client.getCell(doc.activeSheetName, r, c)).raw;
        const raw = String(valori[k]);
        changes.push({ sheet: doc.activeSheetName, row: r, col: c, oldRaw: vecchio, newRaw: raw });
        ops.push({ type: 'set', sheet: doc.activeSheetName, row: r, col: c, raw });
        const kk = cellKey(r, c);
        const prima = doc.styles.cellStyles.get(kk);
        if (prima !== stile) {
          if (stile === undefined) doc.styles.cellStyles.delete(kk); else doc.styles.cellStyles.set(kk, stile);
          stili.push({ type: 'cell', target: kk, oldStyleId: prima, newStyleId: stile });
        }
      }
    }
    if (ops.length === 0) return { ok: false, messaggio: senzaNumero > 0 ? t("La cella di partenza deve contenere un numero o una data") : t("Nessuna cella da riempire: il limite è già raggiunto") };
    this.applicaConvalidaInBlocco(t("Riempi serie"), changes, ops);
    doc.history.pushStep({ description: 'Riempi serie', changes, styleChanges: stili.length > 0 ? stili : undefined });
    await doc.client.applyBatch(ops);
    this.cellsCache.clear();
    this.updateViewport();
    this.updateFormulaBarValue();
    this.requestUpdate();
    return { ok: true, messaggio: t("Serie: {} celle riempite", ops.length) };
  }

  // ---- Raggruppa e struttura (Dati › Raggruppa e struttura): vedi sheet/gruppi.ts ----
  /** L'asse su cui lavorare: colonne se sono selezionate colonne intere, altrimenti righe. */
  private asseGruppo(asse?: 'righe' | 'colonne'): 'righe' | 'colonne' {
    const s = this.getDoc().selection;
    return asse ?? (s.isFullCol && !s.isFullRow ? 'colonne' : 'righe');
  }
  private nomeIntervalloGruppo(asse: 'righe' | 'colonne', da: number, a: number): string {
    const n = (i: number): string => (asse === 'righe' ? String(i) : columnIndexToLetters(i));
    return da === a ? n(da) : `${n(da)}-${n(a)}`;
  }
  /** Raggruppa le righe (o colonne) selezionate: un livello in più, al massimo 7. */
  public raggruppaSelezione(asse?: 'righe' | 'colonne'): string {
    const doc = this.getDoc();
    const ax = this.asseGruppo(asse);
    const s = doc.selection.range;
    const [da, a] = ax === 'righe' ? [s.startRow, s.endRow] : [s.startCol, s.endCol];
    if (a - da + 1 > 100000) return t("Troppe righe o colonne da raggruppare (al massimo 100000)");
    for (let i = da; i <= a; i++) if ((doc.gruppi?.[ax][i] ?? 0) >= LIVELLO_MASSIMO_GRUPPI) return t("La struttura ha già {} livelli: il massimo", LIVELLO_MASSIMO_GRUPPI);
    this.conAnnulla(t("Raggruppa"), () => { doc.gruppi = raggruppaGruppi(doc.gruppi, ax, da, a); this.requestUpdate(); });
    return ax === 'righe' ? t("Righe {} raggruppate", this.nomeIntervalloGruppo(ax, da, a)) : t("Colonne {} raggruppate", this.nomeIntervalloGruppo(ax, da, a));
  }
  /** Separa le righe (o colonne) selezionate: un livello in meno. */
  public separaSelezione(asse?: 'righe' | 'colonne'): string {
    const doc = this.getDoc();
    const ax = this.asseGruppo(asse);
    const s = doc.selection.range;
    const [da, a] = ax === 'righe' ? [s.startRow, s.endRow] : [s.startCol, s.endCol];
    const nuovi = separaGruppi(doc.gruppi, ax, da, a);
    if (!nuovi) return ax === 'righe' ? t("Nessuna riga raggruppata nella selezione") : t("Nessuna colonna raggruppata nella selezione");
    this.conAnnulla(t("Separa"), () => { doc.gruppi = copiaGruppi(nuovi); this.requestUpdate(); });
    return ax === 'righe' ? t("Righe {} separate", this.nomeIntervalloGruppo(ax, da, a)) : t("Colonne {} separate", this.nomeIntervalloGruppo(ax, da, a));
  }
  /** Il gruppo della cella attiva (prima le righe, poi le colonne). */
  private gruppoAttivo(): { asse: 'righe' | 'colonne'; da: number; a: number; livello: number } | null {
    const doc = this.getDoc();
    const c = doc.selection.anchor;
    const r = gruppoDi(doc.gruppi, 'righe', c.row);
    if (r) return { asse: 'righe', ...r };
    const k = gruppoDi(doc.gruppi, 'colonne', c.col);
    return k ? { asse: 'colonne', ...k } : null;
  }
  /** Comprime (nasconde) o espande (mostra) un gruppo di righe o colonne. */
  private impostaGruppoCompresso(asse: 'righe' | 'colonne', da: number, a: number, compresso: boolean): void {
    const doc = this.getDoc();
    this.conAnnulla(compresso ? t("Comprimi il gruppo") : t("Espandi il gruppo"), () => {
      const insieme = asse === 'righe' ? (doc.hiddenRows ??= new Set<number>()) : (doc.hiddenCols ??= new Set<number>());
      for (let i = da; i <= a; i++) { if (compresso) insieme.add(i); else insieme.delete(i); }
      this.cellsCache.clear();
      this.updateViewport();
      this.requestUpdate();
    });
  }
  public comprimiGruppo(): string {
    const g = this.gruppoAttivo();
    if (!g) return t("La cella attiva non è in un gruppo");
    this.impostaGruppoCompresso(g.asse, g.da, g.a, true);
    return t("Gruppo {} compresso", this.nomeIntervalloGruppo(g.asse, g.da, g.a));
  }
  public espandiGruppo(): string {
    const doc = this.getDoc();
    // la cella attiva può essere dentro il gruppo nascosto o sulla riga (colonna) del riepilogo subito dopo
    const c = doc.selection.anchor;
    const g = this.gruppoAttivo()
      ?? (gruppoDi(doc.gruppi, 'righe', c.row - 1) ? { asse: 'righe' as const, ...gruppoDi(doc.gruppi, 'righe', c.row - 1)! } : null)
      ?? (gruppoDi(doc.gruppi, 'colonne', c.col - 1) ? { asse: 'colonne' as const, ...gruppoDi(doc.gruppi, 'colonne', c.col - 1)! } : null);
    if (!g) return t("La cella attiva non è in un gruppo");
    this.impostaGruppoCompresso(g.asse, g.da, g.a, false);
    return t("Gruppo {} espanso", this.nomeIntervalloGruppo(g.asse, g.da, g.a));
  }
  /** Il pulsante +/− nell'intestazione della riga (o colonna) subito dopo un gruppo. */
  private alternaGruppo(asse: 'righe' | 'colonne', i: number): void {
    const doc = this.getDoc();
    const g = gruppoDi(doc.gruppi, asse, i);
    if (!g) return;
    const nascoste = asse === 'righe' ? doc.hiddenRows : doc.hiddenCols;
    this.impostaGruppoCompresso(asse, g.da, g.a, !(nascoste?.has(g.da) ?? false));
  }
  /** Lo stato del pulsante del gruppo che finisce subito prima della riga (o colonna) i: null se lì non finisce un gruppo. */
  private pulsanteGruppo(asse: 'righe' | 'colonne', i: number): { compresso: boolean } | null {
    const doc = this.getDoc();
    const prima = doc.gruppi?.[asse][i - 1] ?? 0;
    if (!prima || (doc.gruppi?.[asse][i] ?? 0) >= prima) return null;
    const g = gruppoDi(doc.gruppi, asse, i - 1)!;
    const nascoste = asse === 'righe' ? doc.hiddenRows : doc.hiddenCols;
    return { compresso: nascoste?.has(g.da) ?? false };
  }
  /** Cancella la struttura del foglio: niente più gruppi, e le righe e colonne dei gruppi tornano visibili. */
  public cancellaStruttura(): string {
    const doc = this.getDoc();
    if (!doc.gruppi) return t("Il foglio non ha una struttura");
    this.conAnnulla(t("Cancella la struttura"), () => {
      for (const k of Object.keys(doc.gruppi?.righe ?? {})) doc.hiddenRows?.delete(Number(k));
      for (const k of Object.keys(doc.gruppi?.colonne ?? {})) doc.hiddenCols?.delete(Number(k));
      doc.gruppi = undefined;
      this.cellsCache.clear();
      this.updateViewport();
      this.requestUpdate();
    });
    return t("Struttura cancellata");
  }

  public hideRow(r: number) { this.conAnnulla('Nascondi riga', () => this.hideRowImpl(r)); }
  private hideRowImpl(r: number) {
    const doc = this.getDoc();
    if (!doc.hiddenRows) doc.hiddenRows = new Set<number>();
    doc.hiddenRows.add(r);
    this.requestUpdate();
  }

  public unhideRows() { this.conAnnulla('Mostra tutte le righe', () => this.unhideRowsImpl()); }
  private unhideRowsImpl() {
    const doc = this.getDoc();
    if (doc.hiddenRows) doc.hiddenRows.clear();
    this.requestUpdate();
  }

  public hideCol(c: number) { this.conAnnulla('Nascondi colonna', () => this.hideColImpl(c)); }
  private hideColImpl(c: number) {
    const doc = this.getDoc();
    if (!doc.hiddenCols) doc.hiddenCols = new Set<number>();
    doc.hiddenCols.add(c);
    this.requestUpdate();
  }

  public unhideCols() { this.conAnnulla('Mostra tutte le colonne', () => this.unhideColsImpl()); }
  private unhideColsImpl() {
    const doc = this.getDoc();
    if (doc.hiddenCols) doc.hiddenCols.clear();
    this.requestUpdate();
  }

  public setFreezePanes(rows: number, cols: number) { this.conAnnulla(t("Blocca righe e colonne"), () => this.setFreezePanesImpl(rows, cols)); }
  private setFreezePanesImpl(rows: number, cols: number) {
    const doc = this.getDoc();
    // un blocco più grande della finestra toglierebbe lo spazio per scorrere: si ferma a 200 righe e 200 colonne
    doc.freezeRows = Math.max(0, Math.min(200, Math.floor(rows)));
    doc.freezeCols = Math.max(0, Math.min(200, Math.floor(cols)));
    this.requestUpdate();
  }

  public async pasteSpecial(type: PasteSpecialType) {
    const clip = getInternalClipboard();
    if (!clip || !clip.rawGrid || clip.rawGrid.length === 0) return;
    const doc = this.getDoc();
    const sel = doc.selection.range;

    const payloads: ClipboardCellPayload[] = [];
    for (let r = 0; r < clip.rawGrid.length; r++) {
      for (let c = 0; c < clip.rawGrid[r].length; c++) {
        const raw = clip.rawGrid[r][c];
        const dispText = clip.displayGrid && clip.displayGrid[r] ? clip.displayGrid[r][c] : raw;
        const styleId = clip.styleGrid && clip.styleGrid[r] ? clip.styleGrid[r][c] : undefined;
        const style = styleId !== undefined && clip.styleSnapshot ? clip.styleSnapshot[styleId] : undefined;
        payloads.push({
          rowOffset: r,
          colOffset: c,
          raw,
          value: { kind: 'text', value: dispText },
          style,
        });
      }
    }

    const operations = computePasteSpecial(payloads, sel.startRow, sel.startCol, type);
    const changeRecords = [];
    const batchOps = [];
    const styleChanges: StyleChangeRecord[] = [];

    for (const op of operations) {
      if (op.raw !== undefined) {
        const old = await doc.client.getCell(doc.activeSheetName, op.targetRow, op.targetCol);
        changeRecords.push({
          sheet: doc.activeSheetName,
          row: op.targetRow,
          col: op.targetCol,
          oldRaw: old.raw,
          newRaw: op.raw,
        });
        batchOps.push({
          type: 'set' as const,
          sheet: doc.activeSheetName,
          row: op.targetRow,
          col: op.targetCol,
          raw: op.raw,
        });
      }
      if (op.style !== undefined) {
        const k = cellKey(op.targetRow, op.targetCol);
        const oldId = doc.styles.cellStyles.get(k);
        const newId = doc.styles.registry.merge(oldId || 0, op.style);
        doc.styles.cellStyles.set(k, newId);
        styleChanges.push({ type: 'cell', target: k, oldStyleId: oldId, newStyleId: newId });
      }
    }

    // "Solo formati" e "Trasposto" portano con sé anche le formattazioni condizionali (come in Excel); gli altri modi no
    let regolePrima: typeof doc.conditionalFormats | undefined;
    let regoleDopo: typeof doc.conditionalFormats | undefined;
    if ((type === 'format_only' || type === 'transposed') && clip.sopra) {
      const copia = () => JSON.parse(JSON.stringify(doc.conditionalFormats)) as typeof doc.conditionalFormats;
      regolePrima = copia();
      if (type === 'transposed') incollaRegoleTrasposte(clip.sopra.regole ?? [], clip.sourceRange, sel.startRow, sel.startCol, doc.conditionalFormats);
      else incollaSopraLeCelle({ commenti: [], convalide: [], unioni: [], regole: clip.sopra.regole }, clip.sourceRange, [{ riga: sel.startRow, colonna: sel.startCol }], doc.activeSheetName, doc.comments, doc);
      regoleDopo = copia();
      if (JSON.stringify(regolePrima) === JSON.stringify(regoleDopo)) regolePrima = regoleDopo = undefined;
    }

    this.applicaConvalidaInBlocco('Incolla speciale', changeRecords, batchOps);
    if (batchOps.length > 0 || styleChanges.length > 0 || regolePrima) {
      const rimetti = (r: typeof doc.conditionalFormats) => async () => { doc.conditionalFormats = JSON.parse(JSON.stringify(r)) as typeof doc.conditionalFormats; this.requestUpdate(); };
      doc.history.pushStep({
        description: t("Incolla speciale ({})", type),
        changes: changeRecords,
        styleChanges,
        ...(regolePrima && regoleDopo ? { undoAction: rimetti(regolePrima), redoAction: rimetti(regoleDopo) } : {}),
      });
      if (batchOps.length > 0) {
        await doc.client.applyBatch(batchOps);
      }
      this.updateFormulaBarValue();
      this.updateSelectionStats();
      this.requestUpdate();
    }
  }

  public async fillDown() {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    if (sel.startRow === sel.endRow) {
      if (sel.startRow <= 1) return;
      const batchOps = [];
      const changeRecords = [];
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        const topCell = await doc.client.getCell(doc.activeSheetName, sel.startRow - 1, c);
        const curCell = await doc.client.getCell(doc.activeSheetName, sel.startRow, c);
        changeRecords.push({
          sheet: doc.activeSheetName,
          row: sel.startRow,
          col: c,
          oldRaw: curCell.raw,
          newRaw: topCell.raw,
        });
        batchOps.push({
          type: 'set' as const,
          sheet: doc.activeSheetName,
          row: sel.startRow,
          col: c,
          raw: topCell.raw,
        });
      }
      this.applicaConvalidaInBlocco('Ctrl+D', changeRecords, batchOps);
      if (batchOps.length > 0) {
        doc.history.pushStep({ description: 'Copia riga sopra (Ctrl+D)', changes: changeRecords });
        await doc.client.applyBatch(batchOps);
        this.updateFormulaBarValue();
        this.requestUpdate();
      }
      return;
    }

    const rawMap = new Map<string, string>();
    for (let c = sel.startCol; c <= sel.endCol; c++) {
      const cData = await doc.client.getCell(doc.activeSheetName, sel.startRow, c);
      rawMap.set(`${sel.startRow}:${c}`, cData.raw);
    }
    const ops = computeFillDown(sel.startRow, sel.startCol, sel.endRow, sel.endCol, (r, c) => rawMap.get(`${r}:${c}`) || '');
    const batchOps = [];
    const changeRecords = [];
    for (const op of ops) {
      const old = await doc.client.getCell(doc.activeSheetName, op.row, op.col);
      changeRecords.push({
        sheet: doc.activeSheetName,
        row: op.row,
        col: op.col,
        oldRaw: old.raw,
        newRaw: op.raw,
      });
      batchOps.push({
        type: 'set' as const,
        sheet: doc.activeSheetName,
        row: op.row,
        col: op.col,
        raw: op.raw,
      });
    }
    this.applicaConvalidaInBlocco('Ctrl+D', changeRecords, batchOps);
    if (batchOps.length > 0) {
      doc.history.pushStep({ description: 'Riempi verso il basso (Ctrl+D)', changes: changeRecords });
      await doc.client.applyBatch(batchOps);
      this.updateFormulaBarValue();
      this.requestUpdate();
    }
  }

  public async fillRight() {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    if (sel.startCol === sel.endCol) {
      if (sel.startCol <= 1) return;
      const batchOps = [];
      const changeRecords = [];
      for (let r = sel.startRow; r <= sel.endRow; r++) {
        const leftCell = await doc.client.getCell(doc.activeSheetName, r, sel.startCol - 1);
        const curCell = await doc.client.getCell(doc.activeSheetName, r, sel.startCol);
        changeRecords.push({
          sheet: doc.activeSheetName,
          row: r,
          col: sel.startCol,
          oldRaw: curCell.raw,
          newRaw: leftCell.raw,
        });
        batchOps.push({
          type: 'set' as const,
          sheet: doc.activeSheetName,
          row: r,
          col: sel.startCol,
          raw: leftCell.raw,
        });
      }
      this.applicaConvalidaInBlocco('Ctrl+R', changeRecords, batchOps);
      if (batchOps.length > 0) {
        doc.history.pushStep({ description: 'Copia colonna sinistra (Ctrl+R)', changes: changeRecords });
        await doc.client.applyBatch(batchOps);
        this.updateFormulaBarValue();
        this.requestUpdate();
      }
      return;
    }

    const rawMap = new Map<string, string>();
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      const cData = await doc.client.getCell(doc.activeSheetName, r, sel.startCol);
      rawMap.set(`${r}:${sel.startCol}`, cData.raw);
    }
    const ops = computeFillRight(sel.startRow, sel.startCol, sel.endRow, sel.endCol, (r, c) => rawMap.get(`${r}:${c}`) || '');
    const batchOps = [];
    const changeRecords = [];
    for (const op of ops) {
      const old = await doc.client.getCell(doc.activeSheetName, op.row, op.col);
      changeRecords.push({
        sheet: doc.activeSheetName,
        row: op.row,
        col: op.col,
        oldRaw: old.raw,
        newRaw: op.raw,
      });
      batchOps.push({
        type: 'set' as const,
        sheet: doc.activeSheetName,
        row: op.row,
        col: op.col,
        raw: op.raw,
      });
    }
    this.applicaConvalidaInBlocco('Ctrl+R', changeRecords, batchOps);
    if (batchOps.length > 0) {
      doc.history.pushStep({ description: 'Riempi verso destra (Ctrl+R)', changes: changeRecords });
      await doc.client.applyBatch(batchOps);
      this.updateFormulaBarValue();
      this.requestUpdate();
    }
  }

  public toggleFormatPainter() {
    const doc = this.getDoc();
    const act = doc.selection.active;
    if (!this.isFormatPainterActive) {
      this.formatPainterStyle = resolveCellStyle(act.row, act.col, doc.styles);
      this.isFormatPainterActive = true;
      this.dispatchEvent(new CustomEvent("status-message", {
        detail: { message: t("Pennello formato attivo: seleziona le celle su cui applicarlo") },
        bubbles: true,
        composed: true,
      }));
    } else {
      this.isFormatPainterActive = false;
      this.formatPainterStyle = null;
      this.dispatchEvent(new CustomEvent("status-message", {
        detail: { message: "Pronto" },
        bubbles: true,
        composed: true,
      }));
    }
    this.requestUpdate();
  }

  public async refreshSheetList() {
    const doc = this.getDoc();
    this.sheetList = await doc.client.listSheets();
    if (!this.sheetList.includes(doc.activeSheetName) && this.sheetList.length > 0) {
      // il primo foglio visibile (un foglio nascosto non diventa mai quello attivo)
      doc.activeSheetName = this.sheetList.find((n) => !nascostoDi(doc, n)) ?? this.sheetList[0];
    }
    this.requestUpdate();
    this.emitSheets();
  }

  /** Dice a chi sta fuori (le schede in alto) quali sono i fogli del file e quale è attivo. */
  private emitSheets(): void {
    const doc = this.getDoc();
    const colori: Record<string, string> = {};
    for (const nome of this.sheetList) { const c = coloreSchedaDi(doc, nome); if (c) colori[nome] = c; }
    // le schede mostrano solo i fogli visibili; i nascosti si rimostrano dal menu della scheda
    const fogli = this.sheetList.filter((n) => !nascostoDi(doc, n));
    const nascosti = this.sheetList.filter((n) => nascostoDi(doc, n));
    this.dispatchEvent(new CustomEvent('sheets-changed', { detail: { fogli, nascosti, attivo: doc.activeSheetName, colori }, bubbles: true, composed: true }));
  }

  /** I fogli nascosti, nell'ordine della cartella. */
  public fogliNascosti(): string[] {
    const doc = this.getDoc();
    return this.sheetList.filter((n) => nascostoDi(doc, n));
  }

  /** Nasconde un foglio (come Excel e Calc): deve restarne almeno uno visibile; se è quello attivo si passa al foglio visibile vicino. */
  public async nascondiFoglio(nome: string): Promise<string> {
    if (this.strutturaProtetta()) return t(MOTIVO_CARTELLA);
    const doc = this.getDoc();
    const visibili = this.sheetList.filter((n) => !nascostoDi(doc, n));
    if (!visibili.includes(nome)) return '';
    if (visibili.length <= 1) return t("Una cartella deve avere almeno un foglio visibile: il foglio non si può nascondere");
    const applica = async (nascondi: boolean): Promise<void> => {
      if (nascondi && doc.activeSheetName === nome) {
        const i = visibili.indexOf(nome);
        await this.switchSheet(visibili[i + 1] ?? visibili[i - 1]);
      }
      impostaNascosto(doc, nome, nascondi);
      if (!nascondi) await this.switchSheet(nome);
      this.emitSheets();
      this.requestUpdate();
    };
    await applica(true);
    doc.history.pushStep({ description: 'Nascondi foglio', sheet: '', undoAction: async () => applica(false), redoAction: async () => applica(true) });
    return t("Foglio «{}» nascosto: si rimostra dal menu della scheda (tasto destro › Mostra)", nome);
  }

  /** Rimostra un foglio nascosto e ci va. */
  public async mostraFoglio(nome: string): Promise<string> {
    if (this.strutturaProtetta()) return t(MOTIVO_CARTELLA);
    const doc = this.getDoc();
    if (!nascostoDi(doc, nome)) return '';
    const daDove = doc.activeSheetName;
    const applica = async (mostra: boolean): Promise<void> => {
      if (mostra) { impostaNascosto(doc, nome, false); await this.switchSheet(nome); }
      else { if (doc.activeSheetName === nome) await this.switchSheet(daDove); impostaNascosto(doc, nome, true); }
      this.emitSheets();
      this.requestUpdate();
    };
    await applica(true);
    doc.history.pushStep({ description: 'Mostra foglio', sheet: '', undoAction: async () => applica(false), redoAction: async () => applica(true) });
    return t("Foglio «{}» di nuovo visibile", nome);
  }

  /** Dopo che il contenuto del documento è stato sostituito (Apri, Nuovo, Ripristina): rilegge fogli, selezione e cache. */
  public async ricarica(): Promise<void> {
    const doc = this.getDoc();
    doc.selection = createCellSelection(1, 1);
    this.activeCellAddress = 'A1';
    this.nameBoxValue = 'A1';
    this.cellsCache.clear();
    await this.refreshSheetList();
    this.updateFormulaBarValue();
    this.updateSelectionStats();
    this.emitActiveFormat();
    this.updateViewport();
    this.requestUpdate();
  }

  public async switchSheet(name: string) {
    const doc = this.getDoc();
    if (doc.activeSheetName === name) return;
    passaAlFoglio(doc, name); // salva l'aspetto del foglio che si lascia e carica quello del nuovo
    doc.selection = createCellSelection(1, 1);
    this.activeCellAddress = 'A1';
    this.nameBoxValue = 'A1';
    this.cellsCache.clear();
    this.updateFormulaBarValue();
    this.updateSelectionStats();
    this.emitActiveFormat();
    this.updateViewport(); // ricarica le celle del foglio appena scelto: la cache è stata svuotata
    this.requestUpdate();
    this.emitSheets();
  }

  public async handleAddSheet(name?: string) {
    if (this.strutturaProtetta()) return;
    const doc = this.getDoc();
    const newName = name || `Foglio${this.sheetList.length + 1}`;
    await doc.client.addSheet(newName);
    await this.refreshSheetList();
    doc.history.pushStep({
      description: 'Aggiungi foglio',
      undoAction: async () => { await this.eliminaFoglio(newName); },
      redoAction: async () => {
        await doc.client.addSheet(newName);
        await this.refreshSheetList();
        await this.switchSheet(newName);
      },
    });
    await this.switchSheet(newName);
  }

  /** Dà un colore alla scheda di un foglio (stringa vuota = nessun colore). Si annulla e si ripete. */
  public impostaColoreSchedaFoglio(nome: string, colore: string): void {
    if (this.strutturaProtetta()) return;
    const doc = this.getDoc();
    const nuovo = /^#[0-9a-fA-F]{6}$/.test(colore) ? colore.toLowerCase() : undefined;
    const prima = coloreSchedaDi(doc, nome);
    if (prima === nuovo) return;
    const applica = (c: string | undefined) => { impostaColoreScheda(doc, nome, c); this.emitSheets(); this.requestUpdate(); };
    applica(nuovo);
    doc.history.pushStep({ description: 'Colore scheda', undoAction: async () => applica(prima), redoAction: async () => applica(nuovo) });
  }

  public handleSheetDragStart(name: string, e: DragEvent) {
    e.dataTransfer?.setData('text/plain', name);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  public handleSheetDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  public async handleSheetDrop(targetName: string, e: DragEvent) {
    e.preventDefault();
    const fromName = e.dataTransfer?.getData('text/plain');
    if (!fromName || fromName === targetName) return;
    const fromIndex = this.sheetList.indexOf(fromName);
    const toIndex = this.sheetList.indexOf(targetName);
    if (fromIndex === -1 || toIndex === -1) return;
    const doc = this.getDoc();
    await doc.client.moveSheet(fromIndex, toIndex);
    await this.refreshSheetList();
    this.dispatchEvent(new CustomEvent('document-change', {
      detail: { action: 'sheet-reordered', fromName, targetName },
      bubbles: true,
      composed: true,
    }));
  }

  public async reorderSheet(fromIndex: number, toIndex: number): Promise<boolean> {
    if (this.strutturaProtetta()) return false;
    const doc = this.getDoc();
    const res = await doc.client.moveSheet(fromIndex, toIndex);
    if (res) {
      await this.refreshSheetList();
    }
    return res;
  }

  public setRowHeight(row: number, height: number): void {
    const doc = this.getDoc();
    if (!doc.rowHeights) doc.rowHeights = new Map<number, number>();
    doc.rowHeights.set(row, Math.max(15, Math.min(500, Math.round(height))));
    this.updateViewport();
    this.requestUpdate();
  }

  // --- COMMENTI ---

  // --- IMMAGINI ---

  /** Inserisce un'immagine (già controllata: data URL ammesso) vicino all'angolo in alto a sinistra di ciò che si vede. Si annulla. Restituisce il messaggio per la barra di stato. */
  public insertImage(dataUrl: string, nome: string, larghezzaNaturale: number, altezzaNaturale: number): string {
    const doc = this.getDoc();
    if (doc.immagini.length >= LIMITE_IMMAGINI) return t("Troppe immagini nel file (massimo {})", LIMITE_IMMAGINI);
    const contenitore = this.renderRoot.querySelector('.grid-container') as HTMLElement | null;
    const n = doc.immagini.filter((i) => i.sheetName === doc.activeSheetName).length;
    const misure = misureIniziali(larghezzaNaturale, altezzaNaturale);
    const nuova = immaginiDaDati([{ id: nuovoIdImmagine(), sheetName: doc.activeSheetName, x: (contenitore?.scrollLeft ?? 0) + 90 + n * 24, y: (contenitore?.scrollTop ?? 0) + 60 + n * 24, ...misure, dataUrl, nome }])[0];
    if (!nuova) return t("Immagine non valida o troppo grande (massimo 1,5 MB; formati PNG, JPEG, GIF, WebP)");
    this.aggiungiImmagine(nuova);
    doc.history.pushStep({
      description: 'Inserisci immagine',
      undoAction: async () => { this.togliImmagine(nuova.id); },
      redoAction: async () => { this.aggiungiImmagine(nuova); },
    });
    this.selectedImageId = nuova.id;
    this.requestUpdate();
    return t("Immagine «{}» inserita: trascinala per spostarla, usa l'angolo per ridimensionarla, Canc per eliminarla", nome);
  }

  private aggiungiImmagine(img: ImmagineConfig): void {
    const doc = this.getDoc();
    doc.immagini = [...doc.immagini.filter((i) => i.id !== img.id), { ...img }];
    this.requestUpdate();
  }

  private togliImmagine(id: string): void {
    const doc = this.getDoc();
    doc.immagini = doc.immagini.filter((i) => i.id !== id);
    if (this.selectedImageId === id) this.selectedImageId = null;
    this.requestUpdate();
  }

  private impostaMisureImmagine(id: string, m: { x: number; y: number; width: number; height: number }): void {
    const doc = this.getDoc();
    doc.immagini = doc.immagini.map((i) => (i.id === id ? { ...i, ...m } : i));
    this.requestUpdate();
  }

  /** Dopo un trascinamento: registra il passo per annullarlo. */
  private immagineCambiata(id: string, prima: { x: number; y: number; width: number; height: number }, dopo: { x: number; y: number; width: number; height: number }): void {
    const doc = this.getDoc();
    this.impostaMisureImmagine(id, dopo);
    const spostata = prima.width === dopo.width && prima.height === dopo.height;
    doc.history.pushStep({
      description: spostata ? t("Sposta immagine") : t("Ridimensiona immagine"),
      undoAction: async () => { this.impostaMisureImmagine(id, prima); },
      redoAction: async () => { this.impostaMisureImmagine(id, dopo); },
    });
  }

  /** Elimina un'immagine; si annulla. */
  public deleteImage(id: string): void {
    const doc = this.getDoc();
    const img = doc.immagini.find((i) => i.id === id);
    if (!img) return;
    const copia = { ...img };
    this.togliImmagine(id);
    doc.history.pushStep({
      description: 'Elimina immagine',
      undoAction: async () => { this.aggiungiImmagine(copia); this.selectedImageId = copia.id; },
      redoAction: async () => { this.togliImmagine(copia.id); },
    });
  }

  /** Controllo ortografico (F7): accende o spegne le sottolineature del correttore mentre si scrive. Restituisce il messaggio per la barra di stato. */
  public toggleOrtografia(): string {
    // sul Mac il correttore è quello del sistema, che riconosce da solo la lingua di ogni parola: non c'è niente da controllare prima
    if (!this.ortografia && !suMac()) {
      // il correttore è quello di Windows: lavora solo per le lingue installate. Senza il dizionario della lingua del programma segnerebbe come errori anche le parole giuste.
      const lingua = localeNumeri() === 'it' ? 'it' : 'en';
      const lingue = (typeof navigator !== 'undefined' && navigator.languages?.length ? navigator.languages : [typeof navigator !== 'undefined' ? navigator.language : '']).map((l) => (l ?? '').toLowerCase());
      if (!lingue.some((l) => l === lingua || l.startsWith(`${lingua}-`))) {
        return lingua === 'it'
          ? 'Controllo ortografico non acceso: Windows non ha il dizionario italiano. Aggiungi la lingua Italiano in Impostazioni > Ora e lingua > Lingua e regione, poi riavvia il programma.'
          : t("Controllo ortografico non acceso: Windows non ha il dizionario della lingua del programma.");
      }
    }
    this.ortografia = !this.ortografia;
    try { window.localStorage.setItem('pmb_sheets.ortografia', this.ortografia ? '1' : '0'); } catch { /* il deposito può mancare: la scelta vale solo per questa sessione */ }
    return this.ortografia
      ? t("Controllo ortografico acceso: le parole sbagliate si sottolineano mentre scrivi (non nelle formule)")
      : t("Controllo ortografico spento");
  }

  /** Il valore dell'attributo `spellcheck` del campo di scrittura: acceso solo per il testo (le formule hanno nomi di funzioni che il correttore segnerebbe). */
  private ortografiaPer(testo: string): 'true' | 'false' {
    return this.ortografia && !testo.startsWith('=') ? 'true' : 'false';
  }

  /** Inserisci > Tabella: dà al blocco di dati selezionato (o a quello che contiene la cella attiva) l'aspetto di una tabella. Si annulla in un passo.
   *  Restituisce il messaggio per la barra di stato. */
  public insertTable(): string {
    const doc = this.getDoc();
    let blocco = { ...doc.selection.range };
    if (blocco.startRow === blocco.endRow && blocco.startCol === blocco.endCol) {
      const libro = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
      const foglio = libro?.getSheet(doc.activeSheetName);
      const usato = libro ? contestoNavigazione(libro, doc.activeSheetName) : undefined;
      if (!foglio || !usato) return t("Seleziona i dati da trasformare in tabella");
      const piena = (r: number, c: number) => (foglio.getCell(r, c)?.raw ?? '') !== '';
      const da = doc.selection.anchor;
      if (!piena(da.row, da.col)) return t("Seleziona i dati da trasformare in tabella (la cella attiva è vuota)");
      blocco = regioneDati(piena, da, { righe: Math.max(usato.maxUsedRow ?? 1, da.row), colonne: Math.max(usato.maxUsedCol ?? 1, da.col) });
    }
    if (blocco.endRow - blocco.startRow < 1) return t("Una tabella ha bisogno almeno di una riga di intestazione e di una riga di dati");
    if ((blocco.endRow - blocco.startRow + 1) * (blocco.endCol - blocco.startCol + 1) > 200000) return t("Il blocco è troppo grande per essere formattato come tabella");
    this.conAnnulla('Tabella', () => {
      for (const { range, ritocco } of ritocchiTabella(blocco)) applyFormatToRange(doc.styles, range, ritocco);
      doc.selection = createRangeSelection(blocco.startRow, blocco.startCol, blocco.endRow, blocco.endCol);
      this.activeCellAddress = formatSelectionAddress(doc.selection);
      this.nameBoxValue = this.activeCellAddress;
    });
    this.emitActiveFormat();
    this.requestUpdate();
    return t("Tabella {}: intestazione evidenziata e righe a strisce", formatSelectionAddress(doc.selection));
  }

  /** Apre un link: lo chiede alla finestra principale, che lo passa al programma predefinito del sistema. */
  public apriLink(url: string): void {
    this.dispatchEvent(new CustomEvent('apri-link', { detail: { url }, bubbles: true, composed: true }));
  }

  /** La cella attiva con il suo link e il suo testo, per la finestra del link. */
  /** Il formato numerico della cella attiva e il suo valore (per la finestra del formato personalizzato). */
  public getActiveCellFormat(): { codice: string; valore: CellValue } {
    const doc = this.getDoc();
    const { row, col } = doc.selection.anchor;
    return { codice: resolveCellStyle(row, col, doc.styles).numFmt ?? '', valore: this.getCellData(row, col).value };
  }

  public getActiveCellLink(): { riga: number; colonna: number; cella: string; url: string; testo: string } {
    const doc = this.getDoc();
    const { row, col } = doc.selection.anchor;
    const testo = this.cellsCache.get(cellKey(row, col))?.raw ?? '';
    return { riga: row, colonna: col, cella: `${columnIndexToLetters(col)}${row}`, url: resolveCellStyle(row, col, doc.styles).link ?? '', testo: testo.startsWith('=') ? '' : testo };
  }

  /** Mette (o toglie, con `url` indefinito) il link di una cella. Con `testo` non vuoto scrive anche il testo della cella; se la cella è vuota e il testo no, scrive l'indirizzo. Si annulla in un passo solo. */
  public async setLink(row: number, col: number, url: string | undefined, testo?: string): Promise<void> {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    const k = cellKey(row, col);
    const vecchioStile = doc.styles.cellStyles.get(k);
    applyFormatToRange(doc.styles, { startRow: row, endRow: row, startCol: col, endCol: col }, { link: url });
    const nuovoStile = doc.styles.cellStyles.get(k);
    const changes: Array<{ sheet: string; row: number; col: number; oldRaw: string; newRaw: string }> = [];
    if (url !== undefined) {
      const prima = await doc.client.getCell(foglio, row, col);
      let nuovo = (testo ?? '').trim();
      if (nuovo === '' && prima.raw === '') nuovo = url;
      if (nuovo !== '' && nuovo !== prima.raw) {
        const daScrivere = nuovo.startsWith('=') ? `'${nuovo}` : nuovo;
        await doc.client.setCell(foglio, row, col, daScrivere);
        changes.push({ sheet: foglio, row, col, oldRaw: prima.raw, newRaw: daScrivere });
      }
    }
    if (vecchioStile !== nuovoStile || changes.length > 0) {
      doc.history.pushStep({
        description: url === undefined ? 'Rimuovi link' : t("Inserisci link"),
        changes,
        styleChanges: [{ type: 'cell', target: k, oldStyleId: vecchioStile, newStyleId: nuovoStile }],
      });
    }
    this.cellsCache.clear();
    this.updateViewport();
    this.emitActiveFormat();
    this.updateFormulaBarValue();
    this.requestUpdate();
  }

  /** La cella attiva con il suo commento, per la finestra del commento. */
  public getActiveCellComment(): { riga: number; colonna: number; cella: string; testo: string; data: string } {
    const doc = this.getDoc();
    const { row, col } = doc.selection.anchor;
    const c = commentoDi(doc.comments, doc.activeSheetName, row, col);
    return { riga: row, colonna: col, cella: `${columnIndexToLetters(col)}${row}`, testo: c?.testo ?? '', data: c?.data ?? '' };
  }

  /** Scrive, cambia o toglie (testo vuoto) il commento di una cella; l'azione si può annullare. */
  public setComment(row: number, col: number, testo: string): boolean {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    const chiave = chiaveCommento(foglio, row, col);
    const prima = commentoDi(doc.comments, foglio, row, col);
    const copiaPrima = prima ? { ...prima } : undefined;
    if (!impostaCommento(doc.comments, foglio, row, col, testo, new Date())) return false;
    const dopo = commentoDi(doc.comments, foglio, row, col);
    const copiaDopo = dopo ? { ...dopo } : undefined;
    const applica = (c: Commento | undefined) => {
      if (c) doc.comments.set(chiave, { ...c }); else doc.comments.delete(chiave);
      this.requestUpdate();
      this.dispatchEvent(new CustomEvent('comments-changed', { bubbles: true, composed: true }));
    };
    doc.history.pushStep({
      description: copiaDopo ? 'Commento' : t("Elimina commento"),
      undoAction: async () => applica(copiaPrima),
      redoAction: async () => applica(copiaDopo),
    });
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('comments-changed', { bubbles: true, composed: true }));
    return true;
  }

  /** Porta la selezione su una cella (per esempio da un commento nel pannello laterale). */
  /** Il link della cella attiva, se c'è (lo usano i pulsanti con la macro «apri il link della cella»). */
  public linkDellaSelezione(): string | undefined {
    const doc = this.getDoc();
    const a = doc.selection.anchor;
    return resolveCellStyle(a.row, a.col, doc.styles).link || undefined;
  }

  public goToCell(row: number, col: number): void {
    this.selectSingle(row, col);
  }

  /** Rinomina un foglio qualunque: motore, commenti e aspetto lo seguono. */
  private async rinominaFoglioInterno(da: string, a: string): Promise<void> {
    const doc = this.getDoc();
    await doc.client.renameSheet(da, a);
    rinominaFoglioCommenti(doc.comments, da, a);
    doc.immagini = doc.immagini.map((i) => (i.sheetName === da ? { ...i, sheetName: a } : i));
    doc.pulsanti = (doc.pulsanti ?? []).map((p) => (p.sheetName === da ? { ...p, sheetName: a } : p));
    // grafici e pivot seguono il nuovo nome (senza, il grafico non si vedrebbe più: si mostra solo sul foglio che ha il suo nome)
    doc.charts = graficiDopoRinomina(doc.charts ?? [], da, a);
    doc.pivots = pivotDopoRinomina(doc.pivots ?? [], da, a);
    for (const [id, foglio] of this.pivotFogli) if (foglio === da) this.pivotFogli.set(id, a);
    if (doc.activeSheetName === da) doc.activeSheetName = a;
    else rinominaStatoFoglio(doc, da, a);
    await this.refreshSheetList();
  }

  public async renameCurrentSheet(newName: string) {
    if (this.strutturaProtetta()) return;
    const doc = this.getDoc();
    const cleanName = newName.trim();
    if (!cleanName || cleanName === doc.activeSheetName || this.sheetList.includes(cleanName)) return;
    const oldName = doc.activeSheetName;
    await this.rinominaFoglioInterno(oldName, cleanName);
    doc.history.pushStep({
      description: 'Rinomina foglio',
      undoAction: () => this.rinominaFoglioInterno(cleanName, oldName),
      redoAction: () => this.rinominaFoglioInterno(oldName, cleanName),
    });
  }

  public async deleteCurrentSheet() {
    if (this.strutturaProtetta()) return;
    const doc = this.getDoc();
    if (this.sheetList.length <= 1) return;
    // deve restare almeno un foglio visibile
    if (this.sheetList.filter((n) => !nascostoDi(doc, n)).length <= 1) { this.avvisaStato(t("Una cartella deve avere almeno un foglio visibile: prima mostra un foglio nascosto")); return; }
    const toRemove = doc.activeSheetName;
    // l'eliminazione di un foglio con dati chiede conferma (si può comunque annullare subito dopo)
    const stato = JSON.parse((await doc.client.serialize()) as string) as { sheets: Array<{ name: string; cells: Record<string, string> }> };
    const pieno = Object.keys(stato.sheets.find((f) => f.name === toRemove)?.cells ?? {}).length > 0;
    if (pieno && typeof window.confirm === 'function' && !window.confirm(t("Eliminare il foglio «{}»? I suoi dati andranno persi.", toRemove))) return;
    // fotografia di ciò che si perde: celle di tutto il file, aspetto del foglio, commenti e nomi
    const prima = {
      libro: (await doc.client.serialize()) as string,
      stato: clonaStato(statoCorrente(doc)),
      commenti: new Map([...doc.comments].map(([k, v]) => [k, { ...v }] as const)),
      nomi: doc.namedRanges.getAll().map((n) => ({ ...n })),
      immagini: doc.immagini.map((i) => ({ ...i })),
      pulsanti: (doc.pulsanti ?? []).map((p) => ({ ...p })),
      grafici: JSON.parse(JSON.stringify(doc.charts ?? [])) as typeof doc.charts,
      pivots: JSON.parse(JSON.stringify(doc.pivots ?? [])) as typeof doc.pivots,
      pivotFogli: new Map(this.pivotFogli),
    };
    await this.eliminaFoglio(toRemove);
    doc.history.pushStep({
      description: 'Elimina foglio',
      sheet: '',
      undoAction: async () => {
        const registro = new NamedRangeRegistry();
        for (const n of prima.nomi) registro.add({ ...n });
        doc.namedRanges = registro;
        await doc.client.setNamedRanges(nomiPerMotore(registro));
        await doc.client.restore(prima.libro);
        doc.comments = new Map([...prima.commenti].map(([k, v]) => [k, { ...v }] as const));
        doc.immagini = prima.immagini.map((i) => ({ ...i }));
        doc.pulsanti = prima.pulsanti.map((p) => ({ ...p }));
        doc.charts = JSON.parse(JSON.stringify(prima.grafici)) as typeof doc.charts;
        doc.pivots = JSON.parse(JSON.stringify(prima.pivots)) as typeof doc.pivots;
        this.pivotFogli = new Map(prima.pivotFogli);
        doc.sheetStates.set(toRemove, clonaStato(prima.stato));
        await this.refreshSheetList();
        await this.switchSheet(toRemove);
      },
      redoAction: async () => { await this.eliminaFoglio(toRemove); },
    });
  }

  /** Elimina un foglio qualunque (l'ultimo non si elimina) con il suo aspetto e i suoi commenti, e porta su un altro foglio se serviva. */
  private async eliminaFoglio(nome: string): Promise<void> {
    const doc = this.getDoc();
    const elenco = await doc.client.listSheets();
    if (elenco.length <= 1 || !elenco.includes(nome)) return;
    await doc.client.removeSheet(nome);
    togliCommentiFoglio(doc.comments, nome);
    doc.immagini = doc.immagini.filter((i) => i.sheetName !== nome);
    doc.pulsanti = (doc.pulsanti ?? []).filter((p) => p.sheetName !== nome);
    doc.charts = graficiDopoEliminazioneFoglio(doc.charts ?? [], nome);
    doc.pivots = pivotDopoEliminazioneFoglio(doc.pivots ?? [], nome);
    for (const [id, foglio] of [...this.pivotFogli]) if (foglio === nome || !doc.pivots.some((p) => p.id === id)) this.pivotFogli.delete(id);
    if (this.selectedChartId && !doc.charts.some((c) => c.id === this.selectedChartId)) this.selectedChartId = null;
    const rimasti = await doc.client.listSheets();
    if (doc.activeSheetName === nome) {
      scartaStatoCorrente(doc); // l'aspetto del foglio eliminato non va salvato da nessuna parte
      passaAlFoglio(doc, rimasti[0]);
    }
    eliminaStatoFoglio(doc, nome);
    await this.ricarica();
  }

  /** Crea la copia di un foglio: celle (tutte), commenti e aspetto. La copia nasce accanto agli altri fogli, non attiva. */
  private async creaCopiaFoglio(origine: string, copyName: string): Promise<void> {
    const doc = this.getDoc();
    await doc.client.addSheet(copyName);
    copiaCommentiFoglio(doc.comments, origine, copyName);
    doc.immagini = [...doc.immagini, ...doc.immagini.filter((i) => i.sheetName === origine).map((i) => ({ ...i, id: nuovoIdImmagine(), sheetName: copyName }))].slice(0, LIMITE_IMMAGINI);
    doc.pulsanti = [...(doc.pulsanti ?? []), ...(doc.pulsanti ?? []).filter((p) => p.sheetName === origine).map((p) => ({ ...p, id: nuovoIdPulsante(), sheetName: copyName }))].slice(0, LIMITE_PULSANTI);
    doc.charts = graficiDelFoglioDuplicato(doc.charts ?? [], origine, copyName, () => `chart-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
    duplicaStatoFoglio(doc, origine, copyName); // la copia ha lo stesso aspetto: stili, larghezze, celle unite, convalide...
    const stato = JSON.parse((await doc.client.serialize()) as string) as { sheets: Array<{ name: string; cells: Record<string, string> }> };
    const celle = stato.sheets.find((f) => f.name === origine)?.cells ?? {};
    const batchOps = [];
    for (const [indirizzo, raw] of Object.entries(celle)) {
      const c = parseCellAddress(indirizzo);
      if (c && raw) batchOps.push({ type: 'set' as const, sheet: copyName, row: c.row, col: c.col, raw });
    }
    if (batchOps.length > 0) await doc.client.applyBatch(batchOps);
    await this.refreshSheetList();
  }

  /** Duplica il foglio attivo con TUTTE le sue celle (non solo quelle in un'area fissa). Il nome è "Copia di X", reso unico se esiste già. */
  public async duplicateCurrentSheet() {
    if (this.strutturaProtetta()) return;
    const doc = this.getDoc();
    const origine = doc.activeSheetName;
    const esistenti = new Set((await doc.client.listSheets()).map((n) => n.toLowerCase()));
    let copyName = t("Copia di {}", origine);
    for (let n = 2; esistenti.has(copyName.toLowerCase()); n++) copyName = t("Copia di {} ({})", origine, n);
    await this.creaCopiaFoglio(origine, copyName);
    doc.history.pushStep({
      description: 'Duplica foglio',
      undoAction: async () => { await this.eliminaFoglio(copyName); },
      redoAction: async () => {
        await this.creaCopiaFoglio(origine, copyName);
        await this.switchSheet(copyName);
      },
    });
    await this.switchSheet(copyName);
  }

  public handleColContextMenu(colIndex: number, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const doc = this.getDoc();
    doc.selection = createColSelection(colIndex);
    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.contextMenu = {
      x: e.clientX,
      y: e.clientY,
      type: 'col',
      index: colIndex,
    };
    this.requestUpdate();
  }

  public handleRowContextMenu(rowIndex: number, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const doc = this.getDoc();
    doc.selection = createRowSelection(rowIndex);
    this.activeCellAddress = formatSelectionAddress(doc.selection);
    this.nameBoxValue = this.activeCellAddress;
    this.contextMenu = {
      x: e.clientX,
      y: e.clientY,
      type: 'row',
      index: rowIndex,
    };
    this.requestUpdate();
  }

  /** Menu del tasto destro su una cella: se la cella è fuori dalla selezione la seleziona, poi apre il menu dove si è cliccato. */
  public handleCellContextMenu(row: number, col: number, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (this.isEditing) return;
    const doc = this.getDoc();
    if (!isCellSelected(row, col, doc.selection)) this.selectSingle(row, col);
    this.apriMenuCella(e.clientX, e.clientY, row);
  }

  /** Apre il menu delle celle in un punto dello schermo, tenendolo dentro la finestra. */
  private apriMenuCella(x: number, y: number, index: number) {
    this.contextMenu = {
      x: Math.max(0, Math.min(x, window.innerWidth - 240)),
      y: Math.max(0, Math.min(y, window.innerHeight - 330)),
      type: 'cell',
      index,
    };
    this.requestUpdate();
  }

  /** Dal tasto Menu o da Maiusc+F10: apre il menu sotto la cella attiva. */
  private apriMenuCellaDaTastiera() {
    const a = this.getDoc().selection.anchor;
    const td = this.renderRoot.querySelector(`td[data-row="${a.row}"][data-col="${a.col}"]`) as HTMLElement | null;
    const r = td?.getBoundingClientRect();
    this.apriMenuCella(r ? r.left + 8 : 100, r ? r.bottom : 100, a.row);
  }

  public handleSheetContextMenu(sheetName: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.contextMenu = {
      x: e.clientX,
      y: e.clientY,
      type: 'sheet',
      index: 0,
      sheetName,
    };
    this.requestUpdate();
  }

  /** Risolve le voci di una regola di convalida a elenco (fisse o lette dalle celle dell'intervallo). */
  private async risolviVociElenco(regola: DataValidationRule): Promise<string[]> {
    if (regola.listItems && regola.listItems.length > 0) return regola.listItems;
    const rif = (regola.listRange || (regola.value1 ? String(regola.value1) : '')).trim().replace(/^=/, '');
    if (!rif) return [];
    const doc = this.getDoc();
    const sheetCorrente = doc.activeSheetName;
    const rangeCoord = parseRangeAddress(rif, sheetCorrente);
    if (rangeCoord) {
      const sheetNome = rangeCoord.sheet || sheetCorrente;
      const vals = await doc.client.getRange(sheetNome, rangeCoord.startRow, rangeCoord.startCol, rangeCoord.endRow, rangeCoord.endCol);
      const res: string[] = [];
      const visti = new Set<string>();
      for (const riga of vals) {
        for (const cella of riga) {
          let t = '';
          if (cella.kind === 'text') t = cella.value;
          else if (cella.kind === 'number') t = String(cella.value);
          else if (cella.kind === 'boolean') t = cella.value ? 'TRUE' : 'FALSE';
          const trimmed = t.trim();
          if (trimmed !== '' && !visti.has(trimmed.toLowerCase())) {
            visti.add(trimmed.toLowerCase());
            res.push(trimmed);
          }
        }
      }
      return res;
    }
    const cellCoord = parseCellAddress(rif, sheetCorrente);
    if (cellCoord) {
      const sheetNome = cellCoord.sheet || sheetCorrente;
      const c = await doc.client.getCell(sheetNome, cellCoord.row, cellCoord.col);
      let t = '';
      if (c.value.kind === 'text') t = c.value.value;
      else if (c.value.kind === 'number') t = String(c.value.value);
      else if (c.value.kind === 'boolean') t = c.value.value ? 'TRUE' : 'FALSE';
      else if (c.raw) t = c.raw;
      const trimmed = t.trim();
      return trimmed !== '' ? [trimmed] : [];
    }
    return [];
  }

  /** Apre la tendina di una cella con convalida a elenco, sotto la cella. */
  private apriElenco(row: number, col: number, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const regola = this.getDoc().dataValidations.get(`${row}:${col}`);
    if (!regola || regola.type !== 'list') return;
    const target = (e.currentTarget || e.target) as HTMLElement | null;
    const td = target?.closest ? target.closest('td') : null;
    const r = td?.getBoundingClientRect();
    const immediateVoci = regola.listItems || [];
    this.elencoAperto = { row, col, x: r ? r.left : (e.clientX ?? 0), y: r ? r.bottom : (e.clientY ?? 0), voci: immediateVoci };
    this.requestUpdate();

    if (immediateVoci.length === 0 && (regola.listRange || (regola.value1 && String(regola.value1).startsWith('=')))) {
      void this.risolviVociElenco(regola).then((voci) => {
        if (this.elencoAperto && this.elencoAperto.row === row && this.elencoAperto.col === col) {
          this.elencoAperto = { ...this.elencoAperto, voci };
          this.requestUpdate();
        }
      });
    }
  }

  /** Sceglie una voce della tendina: scrive il valore nella cella, come una modifica annullabile. */
  private async scegliDaElenco(voce: string) {
    const e = this.elencoAperto;
    this.elencoAperto = null;
    if (!e) return;
    const doc = this.getDoc();
    const nuovo = daInputUtente(voce);
    const vecchio = await doc.client.getCell(doc.activeSheetName, e.row, e.col);
    if (vecchio.raw !== nuovo) {
      doc.history.pushStep({ description: t("Modifica cella {}{}", columnIndexToLetters(e.col), e.row), changes: [{ sheet: doc.activeSheetName, row: e.row, col: e.col, oldRaw: vecchio.raw, newRaw: nuovo }] });
      await doc.client.setCell(doc.activeSheetName, e.row, e.col, nuovo);
    }
    this.updateFormulaBarValue();
    this.requestUpdate();
  }

  public closeContextMenu = () => {
    if (this.contextMenu) {
      this.contextMenu = null;
      this.requestUpdate();
    }
  };

  // --- OPERAZIONI DATI (M2) ---

  public async sortRange(ascending: boolean) {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    const act = doc.selection.anchor;
    const sortCol = act.col >= sel.startCol && act.col <= sel.endCol ? act.col : sel.startCol;
    await this.ordinaArea(sel, sortCol, ascending);
  }

  /** Dalla finestra del filtro: ordina i dati della tabella (la riga 1 è l'intestazione e non si muove) secondo la colonna della freccia. Se c'è un filtro lo riapplica. */
  public async ordinaColonnaDelFiltro(col: number, ascending: boolean): Promise<void> {
    const doc = this.getDoc();
    const { filterRange } = this.contestoFiltro();
    await this.ordinaArea({ startRow: filterRange.startRow + 1, endRow: filterRange.endRow, startCol: filterRange.startCol, endCol: filterRange.endCol }, col, ascending);
    if (doc.isFilterActive && doc.activeFilters.size > 0) this.applyActiveFilters();
  }

  /** Dalla finestra del filtro: le righe della tabella con quel colore (di sfondo o del testo, anche dato da una regola) vanno in cima; la riga 1 non si muove. */
  public async ordinaPerColoreDelFiltro(col: number, colore: string, tipo: 'sfondo' | 'testo'): Promise<void> {
    const doc = this.getDoc();
    const { filterRange, extra } = this.contestoFiltro();
    const leggi = tipo === 'sfondo' ? extra.getFill! : extra.getTextColor!;
    await this.ordinaArea({ startRow: filterRange.startRow + 1, endRow: filterRange.endRow, startCol: filterRange.startCol, endCol: filterRange.endCol }, col, true,
      { colore: colore.toLowerCase(), leggi: (r) => leggi(r, col) });
    if (doc.isFilterActive && doc.activeFilters.size > 0) this.applyActiveFilters();
  }

  // ---- viste filtro: i filtri del foglio salvati con un nome ----

  public visteFiltro(): VistaFiltro[] {
    return this.getDoc().visteFiltro ?? [];
  }

  /** Salva i filtri attivi come vista con quel nome (se il nome c'è già la vista si aggiorna). Dà il motivo se non si può. */
  public salvaVistaFiltro(nome: string): string | null {
    const doc = this.getDoc();
    const n = nome.trim();
    if (n === '') return t("Scrivi un nome per la vista");
    if (n.length > LUNGHEZZA_MASSIMA_NOME_VISTA) return t("Il nome può avere al massimo {} caratteri", LUNGHEZZA_MASSIMA_NOME_VISTA);
    if (!doc.isFilterActive || doc.activeFilters.size === 0) return t("Non ci sono filtri attivi da salvare: scegli prima un filtro su una colonna");
    this.conAnnulla(t("Salva vista filtro \"{}\"", n), () => {
      const viste = [...(doc.visteFiltro ?? [])];
      const filtri = [...doc.activeFilters.values()].sort((a, b) => a.col - b.col).map(filtroInJson);
      const i = viste.findIndex((v) => v.nome.toLowerCase() === n.toLowerCase());
      const area = doc.filterArea ? { area: { ...doc.filterArea } } : {};
      if (i >= 0) { const { area: _vecchia, ...resto } = viste[i]; viste[i] = { ...resto, nome: n, filtri, ...area }; }
      else viste.push({ id: `vista-${Date.now().toString(36)}-${viste.length + 1}`, nome: n, filtri, ...area });
      doc.visteFiltro = viste;
    });
    return null;
  }

  /** Mette i filtri della vista al posto di quelli attivi. */
  public applicaVistaFiltro(id: string): boolean {
    const doc = this.getDoc();
    const v = (doc.visteFiltro ?? []).find((x) => x.id === id);
    if (!v) return false;
    this.conAnnulla(t("Vista filtro \"{}\"", v.nome), () => {
      doc.activeFilters = filtriDaJson(v.filtri);
      if (v.area) doc.filterArea = { ...v.area };
      doc.isFilterActive = true;
      this.applyActiveFilters();
      this.requestUpdate();
    });
    return true;
  }

  public eliminaVistaFiltro(id: string): void {
    const doc = this.getDoc();
    const v = (doc.visteFiltro ?? []).find((x) => x.id === id);
    if (!v) return;
    this.conAnnulla(t("Elimina vista filtro \"{}\"", v.nome), () => {
      const resto = (doc.visteFiltro ?? []).filter((x) => x.id !== id);
      doc.visteFiltro = resto.length > 0 ? resto : undefined;
    });
  }

  private async ordinaArea(sel: { startRow: number; endRow: number; startCol: number; endCol: number }, sortCol: number, ascending: boolean,
    perColore?: { colore: string; leggi: (r: number) => string }): Promise<void> {
    const doc = this.getDoc();

    const cellMap = new Map<string, { raw: string; display: string }>();
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        const cell = await doc.client.getCell(doc.activeSheetName, r, c);
        cellMap.set(`${r}:${c}`, { raw: cell.raw, display: formatDisplayValue(cell.value).text });
      }
    }

    const sortRes = perColore ? { rowMappings: ordinePerColore(sel.startRow, sel.endRow, (r) => perColore.leggi(r) === perColore.colore) } : computeRowSort(
      (r, c) => cellMap.get(`${r}:${c}`)?.display || cellMap.get(`${r}:${c}`)?.raw || '',
      {
        range: sel,
        keys: [{ col: sortCol, ascending }],
        hasHeader: false,
      }
    );

    const rowMapping = new Map<number, number>();
    for (const m of sortRes.rowMappings) {
      rowMapping.set(m.fromRow, m.toRow);
    }

    const batchOps = [];
    const changeRecords = [];
    // i formati (colori, grassetto, bordi...) viaggiano con le righe, come in Excel: si leggono tutti prima di scrivere
    const stiliPrima = new Map<string, number | undefined>();
    for (let r = sel.startRow; r <= sel.endRow; r++) for (let c = sel.startCol; c <= sel.endCol; c++) stiliPrima.set(cellKey(r, c), doc.styles.cellStyles.get(cellKey(r, c)));
    const styleChanges: StyleChangeRecord[] = [];

    for (const m of sortRes.rowMappings) {
      if (m.fromRow === m.toRow) continue;
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        const idVecchio = stiliPrima.get(cellKey(m.toRow, c));
        const idNuovo = stiliPrima.get(cellKey(m.fromRow, c));
        if (idVecchio !== idNuovo) {
          if (idNuovo === undefined) doc.styles.cellStyles.delete(cellKey(m.toRow, c)); else doc.styles.cellStyles.set(cellKey(m.toRow, c), idNuovo);
          styleChanges.push({ type: 'cell', target: cellKey(m.toRow, c), oldStyleId: idVecchio, newStyleId: idNuovo });
        }
        const source = cellMap.get(`${m.fromRow}:${c}`);
        const target = cellMap.get(`${m.toRow}:${c}`);
        if (!source) continue;

        let newRaw = source.raw;
        if (newRaw.startsWith('=')) {
          newRaw = rewriteFormulaOnSort(newRaw, m.fromRow, m.toRow, rowMapping);
        }

        changeRecords.push({
          sheet: doc.activeSheetName,
          row: m.toRow,
          col: c,
          oldRaw: target?.raw || '',
          newRaw,
        });

        batchOps.push({
          type: 'set' as const,
          sheet: doc.activeSheetName,
          row: m.toRow,
          col: c,
          raw: newRaw,
        });
      }
    }

    if (batchOps.length > 0) {
      doc.history.pushStep({
        description: perColore ? t("Ordina colonna {} per colore", columnIndexToLetters(sortCol)) : t("Ordina colonna {} ({})", columnIndexToLetters(sortCol), ascending ? 'A→Z' : 'Z→A'),
        changes: changeRecords,
        ...(styleChanges.length > 0 ? { styleChanges } : {}),
      });
      await doc.client.applyBatch(batchOps);
      this.cellsCache.clear();
      this.updateViewport();
      this.requestUpdate();
    }
  }

  // ---- Dati › Rimuovi duplicati e Dati › Testo in colonne (lotto 2 del piano delle funzioni, scritti per pmb_office) ----

  /** L'area su cui lavorano Rimuovi duplicati e Testo in colonne: la selezione, o il blocco di dati attorno alla cella attiva. */
  public areaDatiSelezionata(): AreaFiltro | null {
    return this.areaPerNuovoFiltro() ?? null;
  }

  /** Il testo che si vede in una cella, come lo scrive l'utente (formule: il risultato). */
  private testoCella(cell: { raw: string; value: CellValue }): string {
    if (cell.raw.startsWith('=')) return formatDisplayValue(cell.value).text;
    return perInputUtente(cell.raw);
  }

  /** Per la finestra Rimuovi duplicati: l'area e il testo della sua prima riga (le intestazioni, se ci sono). */
  public async preparaDuplicati(): Promise<{ area: AreaFiltro; intestazioni: string[] } | { errore: string }> {
    const doc = this.getDoc();
    const area = this.areaDatiSelezionata();
    if (!area) return { errore: t("Seleziona i dati in cui cercare i duplicati") };
    if (area.endRow <= area.startRow) return { errore: t("Servono almeno due righe per cercare i duplicati") };
    const intestazioni: string[] = [];
    for (let c = area.startCol; c <= area.endCol; c++) intestazioni.push(this.testoCella(await doc.client.getCell(doc.activeSheetName, area.startRow, c)));
    return { area, intestazioni };
  }

  /**
   * Toglie dall'area le righe che nelle colonne scelte ripetono una riga precedente; le righe che restano salgono con valori, formati e formule.
   * Con l'intestazione la prima riga non si tocca. Un solo passo di Annulla.
   */
  public async rimuoviDuplicati(area: AreaFiltro, colonne: readonly number[], conIntestazione: boolean): Promise<{ tolte: number; restano: number }> {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    const prima = conIntestazione ? area.startRow + 1 : area.startRow;
    const scelte = colonne.filter((c) => c >= area.startCol && c <= area.endCol);
    if (prima > area.endRow || scelte.length === 0) return { tolte: 0, restano: Math.max(0, area.endRow - prima + 1) };
    const celle = new Map<string, { raw: string; value: CellValue }>();
    for (let r = prima; r <= area.endRow; r++) for (let c = area.startCol; c <= area.endCol; c++) {
      const x = await doc.client.getCell(foglio, r, c);
      celle.set(cellKey(r, c), { raw: x.raw, value: x.value });
    }
    const righe: number[] = [];
    for (let r = prima; r <= area.endRow; r++) righe.push(r);
    const esito = trovaDuplicati(righe, (r) => chiaveRiga(scelte.map((c) => celle.get(cellKey(r, c))?.value)));
    if (esito.tolte.length === 0) return { tolte: 0, restano: righe.length };
    const { spostamenti, daSvuotare } = compatta(prima, area.endRow, esito.tenute);
    const mappa = new Map(spostamenti.map((m) => [m.da, m.a] as [number, number]));
    const stiliPrima = new Map<string, number | undefined>();
    for (let r = prima; r <= area.endRow; r++) for (let c = area.startCol; c <= area.endCol; c++) stiliPrima.set(cellKey(r, c), doc.styles.cellStyles.get(cellKey(r, c)));
    const changes: Array<{ sheet: string; row: number; col: number; oldRaw: string; newRaw: string }> = [];
    const styleChanges: StyleChangeRecord[] = [];
    const ops: Array<{ type: 'set'; sheet: string; row: number; col: number; raw: string }> = [];
    const scrivi = (r: number, c: number, raw: string, stile: number | undefined): void => {
      const k = cellKey(r, c);
      const vecchio = celle.get(k)?.raw ?? '';
      if (vecchio !== raw) { changes.push({ sheet: foglio, row: r, col: c, oldRaw: vecchio, newRaw: raw }); ops.push({ type: 'set', sheet: foglio, row: r, col: c, raw }); }
      const idVecchio = stiliPrima.get(k);
      if (idVecchio !== stile) {
        if (stile === undefined) doc.styles.cellStyles.delete(k); else doc.styles.cellStyles.set(k, stile);
        styleChanges.push({ type: 'cell', target: k, oldStyleId: idVecchio, newStyleId: stile });
      }
    };
    for (const m of spostamenti) {
      if (m.da === m.a) continue;
      for (let c = area.startCol; c <= area.endCol; c++) {
        const src = celle.get(cellKey(m.da, c))?.raw ?? '';
        scrivi(m.a, c, src.startsWith('=') ? rewriteFormulaOnSort(src, m.da, m.a, mappa) : src, stiliPrima.get(cellKey(m.da, c)));
      }
    }
    for (const r of daSvuotare) for (let c = area.startCol; c <= area.endCol; c++) scrivi(r, c, '', undefined);
    doc.history.pushStep({ description: t("Rimuovi duplicati"), changes, ...(styleChanges.length > 0 ? { styleChanges } : {}) });
    if (ops.length > 0) await doc.client.applyBatch(ops);
    this.cellsCache.clear();
    this.updateViewport();
    this.requestUpdate();
    this.ultimoAvviso = Date.now();
    return { tolte: esito.tolte.length, restano: esito.tenute.length };
  }

  /** Per la finestra Testo in colonne: l'area (una sola colonna) e il testo delle sue celle. */
  public async preparaTestoInColonne(): Promise<{ area: AreaFiltro; testi: string[] } | { errore: string }> {
    const doc = this.getDoc();
    const area = this.areaDatiSelezionata();
    if (!area) return { errore: t("Seleziona le celle con il testo da dividere") };
    if (area.endCol !== area.startCol) return { errore: t("Testo in colonne lavora su una colonna alla volta: seleziona una sola colonna") };
    const testi: string[] = [];
    for (let r = area.startRow; r <= area.endRow; r++) testi.push(this.testoCella(await doc.client.getCell(doc.activeSheetName, r, area.startCol)));
    return { area, testi };
  }

  /** Quante celle piene a destra della colonna verrebbero sostituite dividendo i testi così. */
  public async celleSovrascritte(area: AreaFiltro, divise: readonly string[][]): Promise<number> {
    const doc = this.getDoc();
    let n = 0;
    for (let i = 0; i < divise.length; i++) {
      for (let k = 1; k < divise[i].length; k++) {
        const x = await doc.client.getCell(doc.activeSheetName, area.startRow + i, area.startCol + k);
        if (x.raw !== '') n++;
      }
    }
    return n;
  }

  /**
   * Divide i testi della colonna nelle celle a destra. Ogni pezzo si legge come se l'utente lo scrivesse nella cella
   * (numeri all'italiana, date, percentuali). Un solo passo di Annulla. Restituisce righe e colonne toccate.
   */
  public async testoInColonne(area: AreaFiltro, opz: OpzioniDivisione): Promise<{ righe: number; colonne: number }> {
    const doc = this.getDoc();
    const foglio = doc.activeSheetName;
    const testi: string[] = [];
    for (let r = area.startRow; r <= area.endRow; r++) testi.push(this.testoCella(await doc.client.getCell(foglio, r, area.startCol)));
    const divise = dividiRighe(testi, opz);
    const changes: Array<{ sheet: string; row: number; col: number; oldRaw: string; newRaw: string }> = [];
    const styleChanges: StyleChangeRecord[] = [];
    const ops: Array<{ type: 'set'; sheet: string; row: number; col: number; raw: string }> = [];
    let toccate = 0;
    for (let i = 0; i < divise.length; i++) {
      const r = area.startRow + i;
      const pezzi = divise[i];
      if (pezzi.length === 1 && pezzi[0] === testi[i]) continue; // niente da dividere
      toccate++;
      for (let k = 0; k < pezzi.length; k++) {
        const c = area.startCol + k;
        const vecchio = (await doc.client.getCell(foglio, r, c)).raw;
        const interp: { raw: string; formato?: string } = pezzi[k] === '' ? { raw: '' } : this.interpretaPerCella(pezzi[k], r, c);
        if (vecchio !== interp.raw) { changes.push({ sheet: foglio, row: r, col: c, oldRaw: vecchio, newRaw: interp.raw }); ops.push({ type: 'set', sheet: foglio, row: r, col: c, raw: interp.raw }); }
        if (interp.formato) styleChanges.push(this.formatoDaInput(r, c, interp.formato));
      }
    }
    if (changes.length === 0 && styleChanges.length === 0) return { righe: 0, colonne: 0 };
    doc.history.pushStep({ description: t("Testo in colonne"), changes, ...(styleChanges.length > 0 ? { styleChanges } : {}) });
    if (ops.length > 0) await doc.client.applyBatch(ops);
    this.cellsCache.clear();
    this.updateViewport();
    this.requestUpdate();
    this.ultimoAvviso = Date.now();
    return { righe: toccate, colonne: colonneNecessarie(divise) };
  }

  // ---- impostazione di pagina (File › Imposta pagina, area di stampa, interruzioni): lotto 3, scritto per pmb_office ----

  /** L'impostazione di pagina del foglio attivo (una copia). */
  public paginaAttiva(): ImpostaPagina {
    return copiaPagina(this.getDoc().impostaPagina ?? paginaPredefinita());
  }

  /** Cambia l'impostazione di pagina del foglio attivo. Si può annullare. */
  public impostaPaginaAttiva(p: ImpostaPagina, descrizione = t("Imposta pagina")): void {
    const doc = this.getDoc();
    this.conAnnulla(descrizione, () => impostaPaginaFoglio(doc, doc.activeSheetName, p));
    // il messaggio che il guscio mostra non va coperto subito dalle statistiche della selezione
    this.ultimoAvviso = Date.now();
    this.requestUpdate();
  }

  /** File › Area di stampa › Imposta area di stampa: la selezione diventa l'area di stampa del foglio. Restituisce il messaggio per la barra di stato. */
  public impostaAreaStampaDallaSelezione(): string {
    const doc = this.getDoc();
    const sel = doc.selection;
    if (sel.isAll) { this.cancellaAreaStampa(); return t("Area di stampa: tutto il foglio"); }
    const R = sel.range;
    const area = { startRow: R.startRow, endRow: R.endRow, startCol: R.startCol, endCol: R.endCol };
    this.impostaPaginaAttiva({ ...this.paginaAttiva(), area }, t("Imposta area di stampa"));
    return t("Area di stampa: {}", scriviAreaStampa(area));
  }

  /** File › Area di stampa › Cancella area di stampa: si torna a stampare tutto ciò che il foglio usa. */
  public cancellaAreaStampa(): string {
    const p = this.paginaAttiva();
    delete p.area;
    this.impostaPaginaAttiva(p, t("Cancella area di stampa"));
    return t("Area di stampa tolta: si stampa tutto il foglio");
  }

  /** Inserisci › Interruzione di pagina: sopra la riga attiva (o a sinistra della colonna attiva); se c'è già, si toglie. */
  public alternaInterruzionePagina(dove: 'riga' | 'colonna'): string {
    const doc = this.getDoc();
    const a = doc.selection.anchor;
    const n = dove === 'riga' ? a.row : a.col;
    if (n < 2) return dove === 'riga' ? t("Sopra la riga 1 non si può mettere un'interruzione di pagina") : t("A sinistra della colonna A non si può mettere un'interruzione di pagina");
    const p = this.paginaAttiva();
    const prima = dove === 'riga' ? p.interruzioniRighe : p.interruzioniColonne;
    const dopo = alternaInterruzione(prima, n);
    const messa = dopo.length > prima.length;
    if (dove === 'riga') p.interruzioniRighe = dopo; else p.interruzioniColonne = dopo;
    this.impostaPaginaAttiva(p, messa ? t("Inserisci interruzione di pagina") : t("Togli interruzione di pagina"));
    if (dove === 'riga') return messa ? t("Interruzione di pagina sopra la riga {}", n) : t("Tolta l'interruzione di pagina sopra la riga {}", n);
    return messa ? t("Interruzione di pagina a sinistra della colonna {}", columnIndexToLetters(n)) : t("Tolta l'interruzione di pagina a sinistra della colonna {}", columnIndexToLetters(n));
  }

  /** Toglie tutte le interruzioni di pagina a mano del foglio attivo. */
  public togliInterruzioniPagina(): string {
    const p = this.paginaAttiva();
    if (p.interruzioniRighe.length + p.interruzioniColonne.length === 0) return t("Il foglio non ha interruzioni di pagina a mano");
    p.interruzioniRighe = [];
    p.interruzioniColonne = [];
    this.impostaPaginaAttiva(p, t("Togli le interruzioni di pagina"));
    return t("Interruzioni di pagina tolte");
  }

  public sortAsc() {
    return this.sortRange(true);
  }

  public sortDesc() {
    return this.sortRange(false);
  }

  public toggleFilter() { this.conAnnulla('Filtro', () => this.toggleFilterImpl()); }
  private toggleFilterImpl() {
    const doc = this.getDoc();
    doc.isFilterActive = !doc.isFilterActive;
    if (!doc.isFilterActive) {
      doc.activeFilters.clear();
      doc.hiddenRows.clear();
      doc.filterArea = undefined;
    } else {
      doc.filterArea = this.areaPerNuovoFiltro();
      this.applyActiveFilters();
    }
    this.requestUpdate();
  }

  public clearFilters() { this.conAnnulla('Rimuovi filtri', () => this.clearFiltersImpl()); }
  private clearFiltersImpl() {
    const doc = this.getDoc();
    doc.isFilterActive = false;
    doc.activeFilters.clear();
    doc.hiddenRows.clear();
    doc.filterArea = undefined;
    this.requestUpdate();
  }

  /**
   * Dove lavora un filtro nuovo, come in Excel e Google Fogli: l'intervallo selezionato se è più di una cella, altrimenti la tabella
   * intorno alla cella attiva (le celle piene attaccate). L'intestazione è la sua prima riga. undefined (tutto il foglio dalla riga 1)
   * se intorno non c'è niente.
   */
  private areaPerNuovoFiltro(): AreaFiltro | undefined {
    const doc = this.getDoc();
    const libro = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
    if (!libro) return undefined;
    const foglio = libro.getSheet(doc.activeSheetName);
    const piena = (r: number, c: number) => { const x = foglio?.getCell(r, c); return !!x && (x.raw !== '' || x.value.kind !== 'empty'); };
    const usato = contestoNavigazione(libro, doc.activeSheetName);
    const sel = doc.selection;
    const R = sel.range;
    if (sel.isAll) return undefined;
    if (sel.isFullCol) return { startRow: 1, endRow: Math.max(usato.maxUsedRow ?? 1, 1), startCol: R.startCol, endCol: R.endCol };
    if (!sel.isFullRow && (R.endRow > R.startRow || R.endCol > R.startCol)) return { startRow: R.startRow, endRow: R.endRow, startCol: R.startCol, endCol: R.endCol };
    return regioneCorrente(sel.anchor.row, sel.anchor.col, piena, usato.maxUsedRow ?? 0, usato.maxUsedCol ?? 0) ?? undefined;
  }

  /** L'intervallo su cui lavora il filtro (la riga 1 è l'intestazione) e come si legge il testo di una cella. */
  /** Minimo e massimo dei numeri nell'intervallo di ciascuna regola grafica (scala di colore, barra, icone); si calcolano una volta per disegno. */
  private statisticheRegole(): (regola: ConditionalFormatRule) => StatisticheIntervallo | undefined {
    const doc = this.getDoc();
    const foglio = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal().getSheet(doc.activeSheetName) : undefined;
    const cache = new Map<string, StatisticheIntervallo | undefined>();
    return (regola) => {
      if (!foglio || (regola.type !== 'color_scale' && regola.type !== 'data_bar' && regola.type !== 'icon_set')) return undefined;
      if (cache.has(regola.id)) return cache.get(regola.id);
      const { startRow, endRow, startCol, endCol } = regola.range;
      const numeri: number[] = [];
      let letti = 0;
      for (let r = startRow; r <= Math.min(endRow, foglio.getMaxRow()) && letti < 200000; r++) {
        const riga = foglio.getRowMap(r);
        if (!riga) continue;
        for (let c = startCol; c <= Math.min(endCol, foglio.getMaxCol()); c++) {
          letti++;
          const v = riga.get(c)?.value;
          if (v && v.kind === 'number') numeri.push(v.value);
        }
      }
      const s = statisticheNumeri(numeri);
      cache.set(regola.id, s);
      return s;
    };
  }

  private contestoFiltro(): { filterRange: FilterRange; getVal: (r: number, c: number) => string; extra: FiltroExtra } {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    // con il motore a portata di mano il filtro lavora su tutto l'intervallo usato (la riga 1 è l'intestazione) e legge i valori dal foglio, non solo dalle celle visibili
    const libro = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
    const usato = libro ? contestoNavigazione(libro, doc.activeSheetName) : undefined;
    // con un'area (Fase 48) il filtro lavora su quella tabella, allungata alle righe scritte subito sotto; senza, su tutto il foglio dalla riga 1
    const area = doc.filterArea;
    const foglioF = libro?.getSheet(doc.activeSheetName);
    const pienaF = (r: number, c: number) => { const x = foglioF?.getCell(r, c); return !!x && (x.raw !== '' || x.value.kind !== 'empty'); };
    const filterRange: FilterRange = usato && area
      ? { startRow: area.startRow, endRow: Math.max(fineAreaFiltro(area, pienaF, usato.maxUsedRow ?? area.endRow), area.startRow + 1), startCol: area.startCol, endCol: area.endCol, hasHeader: true }
      : usato
      ? { startRow: 1, endRow: Math.max(usato.maxUsedRow ?? 1, 2), startCol: 1, endCol: Math.max(usato.maxUsedCol ?? 1, 1), hasHeader: true }
      : { startRow: sel.startRow, endRow: Math.max(sel.endRow, 100), startCol: sel.startCol, endCol: Math.max(sel.endCol, 26), hasHeader: true };
    const getVal = (r: number, c: number) => {
      const stored = libro?.getSheet(doc.activeSheetName)?.getCell(r, c);
      if (stored) return formatDisplayValue(stored.value).text || stored.raw;
      const cached = this.cellsCache.get(cellKey(r, c));
      return cached ? (formatDisplayValue(cached.value).text || cached.raw) : '';
    };
    // colori (quelli scritti nella cella e quelli che dà una formattazione condizionale) e mese di una data, per i filtri per colore e per data
    const valutaFormula = libro ? (f: string, rr: number, cc: number, angolo: { riga: number; colonna: number }) => libro.valutaCondizione(doc.activeSheetName, f, rr, cc, angolo) : undefined;
    const testoPerRegole = (r: number, c: number): string => {
      const stored = libro?.getSheet(doc.activeSheetName)?.getCell(r, c);
      return stored ? (stored.value.kind === 'number' ? String(stored.value.value) : formatDisplayValue(stored.value).text || stored.raw) : '';
    };
    const statisticheFiltro = this.statisticheRegole();
    const stileCond = (r: number, c: number) => (doc.conditionalFormats.length > 0 ? evaluateConditionalFormats(testoPerRegole(r, c), r, c, doc.conditionalFormats, statisticheFiltro, valutaFormula) : null);
    const extra: FiltroExtra = {
      getFill: (r, c) => {
        const f = resolveCellStyle(r, c, doc.styles).fill;
        return (stileCond(r, c)?.backgroundColor || (f && f !== 'none' && f !== 'auto' ? f : '')).toLowerCase();
      },
      getTextColor: (r, c) => {
        const col = resolveCellStyle(r, c, doc.styles).color;
        return (stileCond(r, c)?.textColor || (col && col !== 'auto' ? col : '')).toLowerCase();
      },
      getMonthKey: (r, c) => {
        const stored = libro?.getSheet(doc.activeSheetName)?.getCell(r, c);
        return stored && stored.value.kind === 'number' && formatoMostraData(resolveCellStyle(r, c, doc.styles).numFmt) ? chiaveMese(stored.value.value) : '';
      },
    };
    return { filterRange, getVal, extra };
  }

  public applyActiveFilters() {
    const doc = this.getDoc();
    if (!doc.isFilterActive || doc.activeFilters.size === 0) {
      doc.hiddenRows.clear();
      return;
    }
    const { filterRange, getVal, extra } = this.contestoFiltro();
    doc.hiddenRows = computeHiddenRowsFromFilters(filterRange, doc.activeFilters, getVal, extra);
    this.requestUpdate();
  }

  /** Apre la finestrella del filtro di una colonna, sotto la freccia ▼ (o in un punto qualsiasi se non si sa dov'è). */
  public apriFiltroColonna(col: number, ancora?: { x: number; y: number }): void {
    const doc = this.getDoc();
    const { filterRange, getVal, extra } = this.contestoFiltro();
    const esistente = doc.activeFilters.get(col);
    const mesi = valoriDistinti(col, filterRange, extra.getMonthKey!);
    this.filtroAperto = {
      col,
      x: ancora?.x ?? 120,
      y: ancora?.y ?? 80,
      valori: extractUniqueColumnValues(col, filterRange, getVal),
      spuntati: esistente?.selectedValues ? [...esistente.selectedValues] : null,
      condizione: esistente?.condition && esistente.condition.operator !== 'none' ? { ...esistente.condition } : null,
      attivo: !!esistente,
      coloriSfondo: valoriDistinti(col, filterRange, extra.getFill!),
      spuntatiSfondo: esistente?.fillColors ? [...esistente.fillColors] : null,
      coloriTesto: valoriDistinti(col, filterRange, extra.getTextColor!),
      spuntatiTesto: esistente?.textColors ? [...esistente.textColors] : null,
      // la lista dei mesi si offre solo se la colonna ha almeno una data
      mesi: mesi.some((m) => m !== '') ? mesi : [],
      spuntatiMesi: esistente?.months ? [...esistente.months] : null,
    };
  }

  /** Mette (o toglie) il filtro di una colonna dalla scelta fatta nella finestrella. Si annulla in un passo solo. */
  public applicaFiltroColonna(col: number, spuntati: readonly string[], condizione?: FilterCondition, colori?: { sfondo?: readonly string[]; testo?: readonly string[]; mesi?: readonly string[] }): void {
    this.filtroAperto = null;
    this.conAnnulla(t("Filtro di colonna"), () => {
      const doc = this.getDoc();
      const { filterRange, getVal, extra } = this.contestoFiltro();
      const tutti = extractUniqueColumnValues(col, filterRange, getVal);
      const lista = (leggi: ((r: number, c: number) => string) | undefined, scelti: readonly string[] | undefined, minimo: number) => {
        if (!leggi || !scelti) return undefined;
        const t = valoriDistinti(col, filterRange, leggi);
        return t.length >= minimo ? { tutti: t, spuntati: new Set(scelti) } : undefined;
      };
      const filtro = filtroDaScelta(col, tutti, new Set(spuntati), condizione, {
        sfondo: lista(extra.getFill, colori?.sfondo, 2),
        testo: lista(extra.getTextColor, colori?.testo, 2),
        mesi: extra.getMonthKey && valoriDistinti(col, filterRange, extra.getMonthKey).some((m) => m !== '') ? lista(extra.getMonthKey, colori?.mesi, 1) : undefined,
      });
      if (filtro) doc.activeFilters.set(col, filtro); else doc.activeFilters.delete(col);
      this.applyActiveFilters();
    });
  }

  /** Toglie il filtro di una colonna. */
  public rimuoviFiltroColonna(col: number): void {
    this.filtroAperto = null;
    this.conAnnulla(t("Rimuovi filtro di colonna"), () => { this.getDoc().activeFilters.delete(col); this.applyActiveFilters(); });
  }

  /** Filtra le righe in modo che restino solo quelle con, nella colonna della cella attiva, lo stesso valore di questa cella (la riga 1 è l'intestazione). */
  public filtraPerValoreDiCella() { this.conAnnulla(t("Filtra per valore"), () => this.filtraPerValoreDiCellaImpl()); }
  private filtraPerValoreDiCellaImpl() {
    const doc = this.getDoc();
    const a = doc.selection.anchor;
    const libro = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
    const stored = libro?.getSheet(doc.activeSheetName)?.getCell(a.row, a.col);
    const valore = stored ? formatDisplayValue(stored.value).text || stored.raw : (this.cellsCache.get(cellKey(a.row, a.col))?.raw ?? '');
    if (!doc.isFilterActive) doc.filterArea = this.areaPerNuovoFiltro();
    doc.isFilterActive = true;
    doc.activeFilters.set(a.col, { col: a.col, selectedValues: new Set([valore]) });
    this.applyActiveFilters();
  }

  public handleColFilterClick(col: number, ancora?: { x: number; y: number }) { this.apriFiltroColonna(col, ancora); }

  public mergeSelection(type: 'all' | 'horizontal' | 'vertical') { this.conAnnulla('Unisci celle', () => this.mergeSelectionImpl(type)); }
  private mergeSelectionImpl(type: 'all' | 'horizontal' | 'vertical') {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    if (type === 'all') {
      doc.merges = mergeAll(sel, doc.merges);
    } else if (type === 'horizontal') {
      doc.merges = mergeHorizontal(sel, doc.merges);
    } else if (type === 'vertical') {
      doc.merges = mergeVertical(sel, doc.merges);
    }
    this.requestUpdate();
  }

  public unmergeSelection() { this.conAnnulla(t("Separa celle unite"), () => this.unmergeSelectionImpl()); }
  private unmergeSelectionImpl() {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    doc.merges = unmergeCells(sel, doc.merges);
    this.requestUpdate();
  }

  public async insertCheckbox() {
    const doc = this.getDoc();
    const sel = doc.selection.range;
    const batchOps = [];
    const changeRecords = [];
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        const old = await doc.client.getCell(doc.activeSheetName, r, c);
        const k = `${r}:${c}`;
        doc.dataValidations.set(k, {
          id: `val-${k}`,
          type: 'checkbox',
          action: 'reject',
        });
        changeRecords.push({
          sheet: doc.activeSheetName,
          row: r,
          col: c,
          oldRaw: old.raw,
          newRaw: 'FALSE',
        });
        batchOps.push({
          type: 'set' as const,
          sheet: doc.activeSheetName,
          row: r,
          col: c,
          raw: 'FALSE',
        });
      }
    }
    if (batchOps.length > 0) {
      doc.history.pushStep({ description: 'Inserisci casella di controllo', changes: changeRecords });
      await doc.client.applyBatch(batchOps);
      for (const op of batchOps) {
        const k = `${op.row}:${op.col}`;
        this.cellsCache.set(k, { raw: op.raw || 'FALSE', value: { kind: 'boolean', value: false } });
      }
      this.requestUpdate();
      await this.updateComplete;
    }
  }

  public async toggleCheckboxAt(r: number, c: number) {
    const doc = this.getDoc();
    const cell = await doc.client.getCell(doc.activeSheetName, r, c);
    const nextVal = toggleCheckboxValue(cell.raw);
    doc.history.pushStep({
      description: 'Attiva/disattiva casella',
      changes: [{
        sheet: doc.activeSheetName,
        row: r,
        col: c,
        oldRaw: cell.raw,
        newRaw: nextVal,
      }],
    });
    await doc.client.setCell(doc.activeSheetName, r, c, nextVal);
    const key = `${r}:${c}`;
    const isTrue = nextVal.trim().toUpperCase() === 'TRUE';
    this.cellsCache.set(key, { raw: nextVal, value: { kind: 'boolean', value: isTrue } });
    this.requestUpdate();
    await this.updateComplete;
  }

  /** Fin dove cercare in un foglio: tutto l'intervallo usato (non solo quello che si vede a video). */
  private limitiRicerca(): (foglio: string) => { maxRow: number; maxCol: number } {
    const doc = this.getDoc();
    const libro = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
    return (foglio) => {
      if (!libro) return { maxRow: 100, maxCol: 26 };
      const usato = contestoNavigazione(libro, foglio);
      return { maxRow: usato.maxUsedRow ?? 1, maxCol: usato.maxUsedCol ?? 1 };
    };
  }

  /** Il contenuto di una cella per la ricerca: legge dal foglio, non dalle celle disegnate. */
  private cellaPerRicerca(): (foglio: string, riga: number, colonna: number) => { raw: string; display: string } | undefined {
    const doc = this.getDoc();
    const libro = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
    return (foglio, r, c) => {
      const stored = libro?.getSheet(foglio)?.getCell(r, c);
      if (stored) return { raw: stored.raw, display: formatDisplayValue(stored.value).text || stored.raw };
      const cached = this.cellsCache.get(`${r}:${c}`);
      return cached ? { raw: cached.raw, display: formatDisplayValue(cached.value).text || cached.raw } : undefined;
    };
  }

  public openFind(replaceMode: boolean) {
    this.showFindReplace = true;
    this.isReplaceMode = replaceMode;
    this.requestUpdate();
  }

  public closeFind() {
    this.showFindReplace = false;
    this.requestUpdate();
  }

  public async findNext() {
    if (!this.findQuery) return;
    const doc = this.getDoc();
    const matches = findAllMatches(
      {
        query: this.findQuery,
        currentSheetName: doc.activeSheetName,
        searchAllSheets: false,
      },
      this.limitiRicerca(),
      this.cellaPerRicerca()
    );
    this.findMatchesCount = matches.length;
    if (matches.length > 0) {
      const next = findNextMatch(matches, doc.activeSheetName, doc.selection.active.row, doc.selection.active.col);
      if (next) {
        this.selectSingle(next.row, next.col);
      }
    }
  }

  public async replaceCurrent() {
    const doc = this.getDoc();
    const act = doc.selection.anchor;
    const cell = await doc.client.getCell(doc.activeSheetName, act.row, act.col);
    const reg = buildSearchRegex({ query: this.findQuery });
    if (reg && reg.test(cell.raw)) {
      const updated = cell.raw.replace(reg, this.replaceQuery);
      if (this.applicaConvalidaInBlocco('Sostituisci', [{ row: act.row, col: act.col, newRaw: updated }], []) > 0) { this.findNext(); return; }
      doc.history.pushStep({
        description: 'Sostituisci',
        changes: [{
          sheet: doc.activeSheetName,
          row: act.row,
          col: act.col,
          oldRaw: cell.raw,
          newRaw: updated,
        }],
      });
      await doc.client.setCell(doc.activeSheetName, act.row, act.col, updated);
      this.cellsCache.clear();
      this.findNext();
    }
  }

  public async replaceAllAction() {
    if (!this.findQuery) return;
    const doc = this.getDoc();
    const res = executeReplaceAll(
      {
        query: this.findQuery,
        replacement: this.replaceQuery,
        currentSheetName: doc.activeSheetName,
      },
      this.limitiRicerca(),
      this.cellaPerRicerca()
    );
    if (res.replacements.length > 0) {
      const batchOps = [];
      const changeRecords = [];
      for (const rep of res.replacements) {
        changeRecords.push({
          sheet: rep.sheetName,
          row: rep.row,
          col: rep.col,
          oldRaw: rep.oldValue,
          newRaw: rep.newValue,
        });
        batchOps.push({
          type: 'set' as const,
          sheet: rep.sheetName,
          row: rep.row,
          col: rep.col,
          raw: rep.newValue,
        });
      }
      this.applicaConvalidaInBlocco(t("Sostituisci tutto"), changeRecords, batchOps);
      doc.history.pushStep({
        description: t("Sostituisci tutto ({} occorrenze)", res.count),
        changes: changeRecords,
      });
      await doc.client.applyBatch(batchOps);
      this.cellsCache.clear();
      this.requestUpdate();
      this.dispatchEvent(new CustomEvent("status-message", {
        detail: { message: t("Sostituite {} occorrenze", res.count) },
        bubbles: true,
        composed: true,
      }));
    }
  }

  /** Applica una convalida a ogni cella dell'intervallo, come un'unica operazione annullabile. */
  /**
   * La convalida vale anche per i valori scritti in blocco (incolla, riempimento, Ctrl+Invio, Ctrl+D e Ctrl+R, sostituisci), come in Google Fogli:
   * le celle con «Rifiuta l'input» e un valore che non va bene si tolgono da `voci` e da `operazioni` (non si scrivono);
   * con «Mostra un avviso» si scrivono e si contano. Svuotare una cella resta sempre possibile. Lo dice nella barra di stato; dà quante celle ha saltato.
   */
  private applicaConvalidaInBlocco(azione: string, voci: Array<{ row: number; col: number; newRaw: string }>, operazioni: Array<{ row: number; col: number }>, salta?: (chiave: string) => boolean): number {
    const doc = this.getDoc();
    if (doc.dataValidations.size === 0 || voci.length === 0) return 0;
    const scartate = new Set<string>();
    let avvisi = 0;
    for (const v of voci) {
      if (v.newRaw === '' || salta?.(`${v.row}:${v.col}`)) continue;
      const regola = doc.dataValidations.get(`${v.row}:${v.col}`);
      if (!regola || validateCellValue(v.newRaw, regola).valid) continue;
      if (regola.action === 'reject') scartate.add(`${v.row}:${v.col}`); else avvisi++;
    }
    if (scartate.size > 0) {
      for (const elenco of [voci, operazioni] as Array<Array<{ row: number; col: number }>>) {
        for (let i = elenco.length - 1; i >= 0; i--) if (scartate.has(`${elenco[i].row}:${elenco[i].col}`)) elenco.splice(i, 1);
      }
    }
    const celle = (n: number) => (n === 1 ? t("1 cella") : t("{} celle", n));
    const parti = [
      ...(scartate.size > 0 ? [t("{} non {}: il valore non rispetta la convalida dei dati", celle(scartate.size), scartate.size === 1 ? 'scritta' : 'scritte')] : []),
      ...(avvisi > 0 ? [t("avviso: {} con un valore che non rispetta la convalida", celle(avvisi))] : []),
    ];
    if (parti.length > 0) this.avvisaStato(`${azione}: ${parti.join('; ')}`);
    return scartate.size;
  }

  /** Le convalide del foglio raggruppate per regola, con le aree dove valgono (per l'elenco nella finestra). */
  public elencoConvalide(): ConvalidaElencata[] {
    return elencaConvalide(this.getDoc().dataValidations);
  }

  /** Dall'elenco della finestra: toglie la regola con quella firma da tutte le sue celle (se c'è) e mette quella nuova sulle aree scritte. */
  public sostituisciConvalida(firmaVecchia: string | null, aree: ReadonlyArray<{ startRow: number; endRow: number; startCol: number; endCol: number }>, regola: Record<string, unknown>): void {
    const doc = this.getDoc();
    this.conAnnulla(firmaVecchia ? t("Modifica convalida dati") : t("Convalida dati"), () => {
      if (firmaVecchia) for (const [k, r] of [...doc.dataValidations]) if (firmaConvalida(r) === firmaVecchia) doc.dataValidations.delete(k);
      for (const i of aree) {
        for (let r = i.startRow; r <= i.endRow; r++) {
          for (let c = i.startCol; c <= i.endCol; c++) this.setDataValidationRuleImpl(r, c, { ...regola, id: `val-${r}:${c}` } as unknown as DataValidationRule);
        }
      }
      this.requestUpdate();
    });
  }

  public eliminaConvalida(firma: string): void {
    const doc = this.getDoc();
    this.conAnnulla(t("Elimina convalida dati"), () => {
      for (const [k, r] of [...doc.dataValidations]) if (firmaConvalida(r) === firma) doc.dataValidations.delete(k);
      this.requestUpdate();
    });
  }

  public applicaConvalida(i: { startRow: number; endRow: number; startCol: number; endCol: number }, regola: Record<string, unknown>): void {
    this.conAnnulla(t("Convalida dati"), () => {
      for (let r = i.startRow; r <= i.endRow; r++) {
        for (let c = i.startCol; c <= i.endCol; c++) this.setDataValidationRuleImpl(r, c, { ...regola, id: `val-${r}:${c}` } as unknown as DataValidationRule);
      }
    });
  }

  /** Toglie la convalida dei dati da tutte le celle della selezione. */
  public rimuoviConvalida(): void {
    const doc = this.getDoc();
    const a = doc.selection.range;
    this.conAnnulla(t("Rimuovi convalida"), () => {
      for (const k of [...doc.dataValidations.keys()]) {
        const [r, c] = k.split(':').map(Number);
        if (r >= a.startRow && r <= a.endRow && c >= a.startCol && c <= a.endCol) doc.dataValidations.delete(k);
      }
      this.requestUpdate();
    });
  }

  /** Toglie le formattazioni condizionali che toccano la selezione. */
  public rimuoviCondizionali(): void {
    const doc = this.getDoc();
    const a = doc.selection.range;
    this.conAnnulla('Rimuovi formattazione condizionale', () => {
      doc.conditionalFormats = doc.conditionalFormats.filter((f) => !(f.range.startRow <= a.endRow && f.range.endRow >= a.startRow && f.range.startCol <= a.endCol && f.range.endCol >= a.startCol));
      this.requestUpdate();
    });
  }

  public setDataValidationRule(r: number, c: number, rule: DataValidationRule) { this.conAnnulla(t("Convalida dati"), () => this.setDataValidationRuleImpl(r, c, rule)); }
  private setDataValidationRuleImpl(r: number, c: number, rule: DataValidationRule) {
    const doc = this.getDoc();
    doc.dataValidations.set(`${r}:${c}`, rule);
    this.requestUpdate();
  }

  public addConditionalFormatRule(rule: any) { this.conAnnulla(t("Formattazione condizionale"), () => this.addConditionalFormatRuleImpl(rule)); }
  private addConditionalFormatRuleImpl(rule: any) {
    const doc = this.getDoc();
    doc.conditionalFormats.push(rule);
    this.requestUpdate();
  }

  /** Dall'elenco della finestra: la regola in quella posizione diventa quella nuova (la priorità resta la stessa). */
  public sostituisciRegolaCondizionale(indice: number, regola: ConditionalFormatRule): void {
    this.conAnnulla(t("Modifica formattazione condizionale"), () => {
      const elenco = this.getDoc().conditionalFormats;
      if (indice >= 0 && indice < elenco.length) elenco[indice] = regola; else elenco.push(regola);
      this.requestUpdate();
    });
  }

  /** Sposta la regola di un posto: verso -1 la rende più importante (vale prima delle altre), +1 meno. */
  public spostaRegolaCondizionale(indice: number, verso: -1 | 1): void {
    const elenco = this.getDoc().conditionalFormats;
    const j = indice + verso;
    if (indice < 0 || indice >= elenco.length || j < 0 || j >= elenco.length) return;
    this.conAnnulla(t("Priorità della formattazione condizionale"), () => {
      [elenco[indice], elenco[j]] = [elenco[j], elenco[indice]];
      this.requestUpdate();
    });
  }

  public eliminaRegolaCondizionale(indice: number): void {
    const elenco = this.getDoc().conditionalFormats;
    if (indice < 0 || indice >= elenco.length) return;
    this.conAnnulla(t("Elimina formattazione condizionale"), () => {
      elenco.splice(indice, 1);
      this.requestUpdate();
    });
  }

  /** Aggiunge un intervallo denominato e lo fa conoscere al motore, così le formule possono usarlo. */
  public async addNamedRange(namedRange: any): Promise<void> { await this.conAnnullaAsync(t("Intervallo denominato"), () => this.addNamedRangeImpl(namedRange)); }
  private async addNamedRangeImpl(namedRange: any): Promise<void> {
    const doc = this.getDoc();
    doc.namedRanges.add(namedRange);
    await doc.client.setNamedRanges(nomiPerMotore(doc.namedRanges));
    this.requestUpdate();
  }

  /** Toglie un intervallo denominato: le formule che lo usavano vanno in errore. */
  public async removeNamedRange(name: string): Promise<void> { await this.conAnnullaAsync(t("Elimina intervallo denominato"), () => this.removeNamedRangeImpl(name)); }
  private async removeNamedRangeImpl(name: string): Promise<void> {
    const doc = this.getDoc();
    doc.namedRanges.remove(name);
    await doc.client.setNamedRanges(nomiPerMotore(doc.namedRanges));
    this.requestUpdate();
  }

  public handlePromptRenameSheet(sheetName: string) {
    const newName = window.prompt(t("Nuovo nome del foglio:"), sheetName);
    if (newName && newName.trim() !== sheetName) {
      this.renameCurrentSheet(newName.trim());
    }
  }

  private renderContextMenu() {
    if (!this.contextMenu) return html``;
    const { x, y, type, index, sheetName } = this.contextMenu;

    return html`
      <div
        class="sheet-context-menu"
        role="menu"
        style=${styleMap({ top: `${y}px`, left: `${x}px` })}
        @click=${(e: MouseEvent) => e.stopPropagation()}
      >
        ${type === 'cell' ? html`
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.cut(); this.closeContextMenu(); }}>Taglia</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.copy(); this.closeContextMenu(); }}>Copia</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.paste(); this.closeContextMenu(); }}>Incolla</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.pasteSpecial('values_only'); this.closeContextMenu(); }}>Incolla solo valori</div>
          <div class="sheet-menu-separator" role="separator"></div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.insertRowsAbove(); this.closeContextMenu(); }}>Inserisci 1 riga sopra</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.insertRowsBelow(); this.closeContextMenu(); }}>Inserisci 1 riga sotto</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.insertColsLeft(); this.closeContextMenu(); }}>Inserisci 1 colonna a sinistra</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.insertColsRight(); this.closeContextMenu(); }}>Inserisci 1 colonna a destra</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.deleteSelectedRows(); this.closeContextMenu(); }}>Elimina righe</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.deleteSelectedCols(); this.closeContextMenu(); }}>Elimina colonne</div>
          <div class="sheet-menu-separator" role="separator"></div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.clearSelection(); this.closeContextMenu(); }}>Cancella contenuto</div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { this.handleFormatAction('clear-formatting'); this.closeContextMenu(); }}>Cancella formattazione</div>
          <div class="sheet-menu-separator" role="separator"></div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { this.dispatchEvent(new CustomEvent('chiedi-link', { bubbles: true, composed: true })); this.closeContextMenu(); }}>Link… (Ctrl+K)</div>
          ${(() => { const a = this.getDoc().selection.anchor; const l = resolveCellStyle(a.row, a.col, this.getDoc().styles).link; return l ? html`
            <div class="sheet-menu-item" role="menuitem" @click=${() => { this.apriLink(l); this.closeContextMenu(); }}>Apri link</div>
            <div class="sheet-menu-item" role="menuitem" @click=${() => { void this.setLink(a.row, a.col, undefined); this.closeContextMenu(); }}>Rimuovi link</div>` : ''; })()}
          <div class="sheet-menu-separator" role="separator"></div>
          <div class="sheet-menu-item" role="menuitem" @click=${() => { this.filtraPerValoreDiCella(); this.closeContextMenu(); }}>Filtra per il valore della cella</div>
          ${this.getDoc().isFilterActive ? html`<div class="sheet-menu-item" role="menuitem" @click=${() => { this.clearFilters(); this.closeContextMenu(); }}>Rimuovi filtri</div>` : ''}
          ${this.getDoc().dataValidations.has(`${this.getDoc().selection.anchor.row}:${this.getDoc().selection.anchor.col}`) ? html`
            <div class="sheet-menu-item" role="menuitem" @click=${() => { this.rimuoviConvalida(); this.closeContextMenu(); }}>Rimuovi convalida dei dati</div>` : ''}
        ` : type === 'col' ? html`
          <div class="sheet-menu-item" @click=${() => { this.insertColsLeft(); this.closeContextMenu(); }}>Inserisci 1 colonna a sinistra</div>
          <div class="sheet-menu-item" @click=${() => { this.insertColsRight(); this.closeContextMenu(); }}>Inserisci 1 colonna a destra</div>
          <div class="sheet-menu-item" @click=${() => { this.deleteSelectedCols(); this.closeContextMenu(); }}>Elimina colonna</div>
          <div class="sheet-menu-separator"></div>
          <div class="sheet-menu-item" @click=${() => { this.hideCol(index); this.closeContextMenu(); }}>Nascondi colonna</div>
          <div class="sheet-menu-item" @click=${() => { this.unhideCols(); this.closeContextMenu(); }}>Mostra tutte le colonne</div>
        ` : type === 'row' ? html`
          <div class="sheet-menu-item" @click=${() => { this.insertRowsAbove(); this.closeContextMenu(); }}>Inserisci 1 riga sopra</div>
          <div class="sheet-menu-item" @click=${() => { this.insertRowsBelow(); this.closeContextMenu(); }}>Inserisci 1 riga sotto</div>
          <div class="sheet-menu-item" @click=${() => { this.deleteSelectedRows(); this.closeContextMenu(); }}>Elimina riga</div>
          <div class="sheet-menu-separator"></div>
          <div class="sheet-menu-item" @click=${() => { this.hideRow(index); this.closeContextMenu(); }}>Nascondi riga</div>
          <div class="sheet-menu-item" @click=${() => { this.unhideRows(); this.closeContextMenu(); }}>Mostra tutte le righe</div>
        ` : html`
          <div class="sheet-menu-item" @click=${() => { this.handlePromptRenameSheet(sheetName || ''); this.closeContextMenu(); }}>Rinomina</div>
          <div class="sheet-menu-item" @click=${() => { this.duplicateCurrentSheet(); this.closeContextMenu(); }}>Duplica</div>
          <div class="sheet-menu-item" @click=${() => { this.deleteCurrentSheet(); this.closeContextMenu(); }}>Elimina</div>
          <div class="sheet-menu-item" data-azione="nascondi-foglio" @click=${() => { const n = sheetName || this.getDoc().activeSheetName; this.closeContextMenu(); void this.nascondiFoglio(n).then((m) => { if (m) this.avvisaStato(m); this.focusGriglia(); }); }}>Nascondi</div>
          ${this.fogliNascosti().map((n) => html`<div class="sheet-menu-item" data-azione="mostra-foglio" data-foglio=${n} @click=${() => { this.closeContextMenu(); void this.mostraFoglio(n).then((m) => { if (m) this.avvisaStato(m); this.focusGriglia(); }); }}>${t("Mostra «{}»", n)}</div>`)}
          <div class="sheet-menu-separator"></div>
          <div class="colori-scheda" role="group" aria-label="Colore della scheda">
            ${COLORI_SCHEDA.map((c) => html`<span class="campione-colore" role="button" tabindex="0" title="Colore scheda ${t(c.nome)}" aria-label="Colore scheda ${t(c.nome)}" style=${styleMap({ backgroundColor: c.valore })}
              @click=${() => { this.impostaColoreSchedaFoglio(sheetName || this.getDoc().activeSheetName, c.valore); this.closeContextMenu(); }}></span>`)}
            <span class="campione-colore nessun-colore" role="button" tabindex="0" title="Nessun colore" aria-label="Togli il colore della scheda"
              @click=${() => { this.impostaColoreSchedaFoglio(sheetName || this.getDoc().activeSheetName, ''); this.closeContextMenu(); }}>×</span>
          </div>
        `}
      </div>
    `;
  }

  // --- RENDER VISUALE ---

  render() {
    const doc = this.getDoc();
    const v = this.visibleRange;
    const zoomFactor = this.zoom / 100;
    const zF = zoomFactor;
    const headerHeight = this.altezzaIntestazione;
    // interruzioni di pagina a mano: una linea tratteggiata sopra la riga o a sinistra della colonna che comincia la pagina
    const interruzioniR = new Set(doc.impostaPagina?.interruzioniRighe ?? []);
    const interruzioniC = new Set(doc.impostaPagina?.interruzioniColonne ?? []);

    // il foglio del motore: serve a sapere se una cella è una formula (la copia delle celle disegnate ha solo i valori)
    const foglioDisegno = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal().getSheet(doc.activeSheetName) : undefined;
    const libroDisegno = doc.client instanceof InlineEngineClient ? doc.client.getWorkbookInternal() : undefined;
    const valutaRegolaFormula = libroDisegno && doc.conditionalFormats.some((x) => x.type === 'formula')
      ? (f: string, rr: number, cc: number, angolo: { riga: number; colonna: number }) => libroDisegno.valutaCondizione(doc.activeSheetName, f, rr, cc, angolo)
      : undefined;
    const statisticheDisegno = doc.conditionalFormats.length > 0 ? this.statisticheRegole() : undefined;
    // geometria di questo disegno: righe nascoste o di altezza diversa, colonne nascoste
    this._geomCache = undefined;
    this._largCache = undefined;
    const geom = this.geomRighe();
    const larghezze = this.larghezzeEffettive();
    this._geomCache = geom;
    this._largCache = larghezze;

    // righe e colonne bloccate in alto e a sinistra
    const fr = Math.min(doc.freezeRows || 0, 200);
    const fc = Math.min(doc.freezeCols || 0, 200);
    const nascostaCol = (c: number) => (doc.hiddenCols ? doc.hiddenCols.has(c) : false);

    const cols: number[] = [];
    const colonneInTesta: number[] = [];
    for (let c = 1; c <= fc && c < v.startCol; c++) if (!nascostaCol(c)) colonneInTesta.push(c);
    cols.push(...colonneInTesta);
    for (let c = v.startCol; c <= v.endCol; c++) if (!nascostaCol(c)) cols.push(c);
    const rows: number[] = [];
    const righeInTesta: number[] = [];
    for (let r = 1; r <= fr && r < v.startRow; r++) if (!geom.nascosta(r)) righeInTesta.push(r);
    rows.push(...righeInTesta);
    for (let r = geom.prossimaVisibile(v.startRow); r <= v.endRow; r = geom.prossimaVisibile(r + 1)) rows.push(r);

    let tableWidth = 44 * zoomFactor;
    for (const c of cols) {
      tableWidth += getColWidth(c, larghezze) * zoomFactor;
    }
    // le righe e colonne bloccate che il disegno aggiunge davanti spostano la tabella: si compensa
    const altezzaInTesta = righeInTesta.reduce((somma, r) => somma + geom.altezza(r) * zoomFactor, 0);
    const larghezzaInTesta = colonneInTesta.reduce((somma, c) => somma + getColWidth(c, larghezze) * zoomFactor, 0);
    // posizione di ogni riga e colonna bloccata (si incolla lì mentre il resto scorre)
    const sinistraBloccata = new Map<number, number>();
    { let x = 44 * zoomFactor; for (let c = 1; c <= fc; c++) { sinistraBloccata.set(c, x); x += getColWidth(c, larghezze) * zoomFactor; } }
    const cimaBloccata = (r: number) => headerHeight + geom.top(r) * zoomFactor;
    const stileCong = (r: number, c: number): Record<string, string | undefined> => {
      const a = r <= fr;
      const b = c <= fc;
      if (!a && !b) return {};
      return { position: 'sticky', top: a ? `${cimaBloccata(r)}px` : undefined, left: b ? `${sinistraBloccata.get(c) ?? 0}px` : undefined, zIndex: a && b ? '3' : '2' };
    };
    const stileIntestazioneRiga = (r: number): Record<string, string | undefined> => (r <= fr ? { top: `${cimaBloccata(r)}px`, zIndex: '4' } : {});
    const stileIntestazioneColonna = (c: number): Record<string, string | undefined> => (c <= fc ? { left: `${sinistraBloccata.get(c) ?? 0}px`, zIndex: '5' } : {});

    return html`
      <!-- Barra della formula -->
      <div class="formula-bar">
        <input
          type="text"
          class="cell-name-box"
          .value=${this.nameBoxValue}
          @input=${(e: Event) => (this.nameBoxValue = (e.target as HTMLInputElement).value)}
          @keydown=${this.handleNameBoxKeyDown}
          title="Casella del nome (scrivi un indirizzo es. B20 e premi Invio)"
        />
        <span class="fx-label">fx</span>
        <input
          type="text"
          class="formula-input"
          placeholder="Inserisci un valore o una formula"
          .value=${live(this.formulaBarValue)}
          spellcheck=${this.ortografiaPer(this.formulaBarValue)}
          lang=${localeNumeri() === 'it' ? 'it' : 'en'}
          @input=${this.handleFormulaBarInput}
          @focus=${() => this.startEditing(false)}
          @keydown=${this.handleEditorKeydown}
        />
      </div>

      <!-- Griglia virtualizzata -->
      <div
        class="grid-container"
        tabindex="0"
        @scroll=${this.handleScroll}
        @keydown=${this.handleGridKeyDown}
        @copy=${(e: ClipboardEvent) => {
          if (this.eDiUnCampoDiTesto(e)) return; // copiare il testo selezionato nell'editor non è copiare celle
          e.preventDefault();
          this.copy();
        }}
        @cut=${(e: ClipboardEvent) => {
          if (this.eDiUnCampoDiTesto(e)) return;
          e.preventDefault();
          this.cut();
        }}
        @paste=${(e: ClipboardEvent) => {
          if (this.eDiUnCampoDiTesto(e)) return; // incollare dentro l'editor della cella incolla testo, non celle
          e.preventDefault();
          window.clearTimeout(this.timerIncolla);
          void this.paste(e.clipboardData?.getData('text/plain') ?? '');
        }}
      >
        <div
          class="virtual-spacer"
          style=${styleMap({ width: `${v.totalWidth}px`, height: `${v.totalHeight}px` })}
        >
          <div
            class="virtual-content"
            style=${styleMap({ top: `${v.topOffset - altezzaInTesta}px`, left: `${v.leftOffset - larghezzaInTesta}px` })}
          >
            <table
              class="sheet-table"
              role="grid"
              aria-label="Foglio di calcolo"
              aria-rowcount="1048577"
              aria-colcount="16385"
              aria-multiselectable="true"
              style=${styleMap({ width: `${tableWidth}px` })}
            >
              <colgroup>
                <col style=${styleMap({ width: `${44 * zoomFactor}px` })} />
                ${cols.map(
                  (c) => html`<col style=${styleMap({ width: `${getColWidth(c, this.larghezzeEffettive()) * zoomFactor}px` })} />`
                )}
              </colgroup>
              <thead>
                <tr role="row" aria-rowindex="1">
                  <th class="corner-header" role="columnheader" aria-label="Seleziona tutto" @click=${this.handleSelectAll}></th>
                  ${cols.map(
                    (c) => html`
                      <th
                        role="columnheader"
                        aria-colindex="${c + 1}"
                        class="col-header ${doc.selection.isFullCol && doc.selection.range.startCol <= c && c <= doc.selection.range.endCol ? "selected-header" : ""}"
                        style=${styleMap({ width: `${getColWidth(c, larghezze) * zoomFactor}px`, ...stileIntestazioneColonna(c) })}
                        @mousedown=${(e: MouseEvent) => this.iniziaTrascinaIntestazione('col', c, e)}
                        @mouseenter=${() => this.trascinaSuIntestazione('col', c)}
                        @click=${(e: MouseEvent) => this.handleColHeaderClick(c, e)}
                        @contextmenu=${(e: MouseEvent) => this.handleColContextMenu(c, e)}
                      >
                        ${columnIndexToLetters(c)}
                        ${(doc.gruppi?.colonne[c] ?? 0) > 0 ? html`<span class="segno-gruppo colonna" style=${styleMap({ height: `${Math.min(7, doc.gruppi!.colonne[c]) * 2}px` })}></span>` : ''}
                        ${this.pulsanteGruppo('colonne', c) ? html`<span class="pulsante-gruppo" role="button"
                            title=${this.pulsanteGruppo('colonne', c)!.compresso ? t("Espandi il gruppo") : t("Comprimi il gruppo")}
                            @mousedown=${(e: MouseEvent) => e.stopPropagation()}
                            @click=${(e: MouseEvent) => { e.stopPropagation(); this.alternaGruppo('colonne', c - 1); }}>${this.pulsanteGruppo('colonne', c)!.compresso ? '+' : '−'}</span>` : ''}
                        ${doc.isFilterActive && (!doc.filterArea || (c >= doc.filterArea.startCol && c <= doc.filterArea.endCol)) ? html`
                          <span
                            class="col-filter-btn ${doc.activeFilters.has(c) ? 'active' : ''}"
                            @click=${(e: MouseEvent) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); this.handleColFilterClick(c, { x: r.left, y: r.bottom + 2 }); }}
                            title="Filtro colonna"
                          >▼</span>
                        ` : ''}
                        <div
                          class="col-resizer"
                          @mousedown=${(e: MouseEvent) => this.handleResizerMouseDown(c, e)}
                          @dblclick=${(e: MouseEvent) => this.handleResizerDblClick(c, e)}
                        ></div>
                      </th>
                    `
                  )}
                </tr>
              </thead>
              <tbody>
                ${rows.map(
                  (r) => html`
                    <tr role="row" aria-rowindex="${r + 1}" style=${styleMap({ height: `${geom.altezza(r) * zoomFactor}px`, maxHeight: `${geom.altezza(r) * zoomFactor}px` })}>
                      <th
                        role="rowheader"
                        class="row-header ${doc.selection.isFullRow && doc.selection.range.startRow <= r && r <= doc.selection.range.endRow ? "selected-header" : ""}"
                        style=${styleMap({ height: `${geom.altezza(r) * zoomFactor}px`, maxHeight: `${geom.altezza(r) * zoomFactor}px`, lineHeight: `${geom.altezza(r) * zoomFactor}px`, ...stileIntestazioneRiga(r) })}
                        @mousedown=${(e: MouseEvent) => this.iniziaTrascinaIntestazione('riga', r, e)}
                        @mouseenter=${() => this.trascinaSuIntestazione('riga', r)}
                        @click=${(e: MouseEvent) => this.handleRowHeaderClick(r, e)}
                        @contextmenu=${(e: MouseEvent) => this.handleRowContextMenu(r, e)}
                      >
                        ${r}
                        ${(doc.gruppi?.righe[r] ?? 0) > 0 ? html`<span class="segno-gruppo riga" style=${styleMap({ width: `${Math.min(7, doc.gruppi!.righe[r]) * 2}px` })}></span>` : ''}
                        ${this.pulsanteGruppo('righe', r) ? html`<span class="pulsante-gruppo" role="button"
                            title=${this.pulsanteGruppo('righe', r)!.compresso ? t("Espandi il gruppo") : t("Comprimi il gruppo")}
                            @mousedown=${(e: MouseEvent) => e.stopPropagation()}
                            @click=${(e: MouseEvent) => { e.stopPropagation(); this.alternaGruppo('righe', r - 1); }}>${this.pulsanteGruppo('righe', r)!.compresso ? '+' : '−'}</span>` : ''}
                        <div
                          class="row-resizer"
                          @mousedown=${(e: MouseEvent) => this.handleRowResizerMouseDown(r, e)}
                          @dblclick=${(e: MouseEvent) => this.handleRowResizerDblClick(r, e)}
                        ></div>
                      </th>
                      ${cols.map((c) => {
                        const isAct = doc.selection.anchor.row === r && doc.selection.anchor.col === c;
                        const isSel = isCellSelected(r, c, doc.selection);
                        const cellData = this.getCellData(r, c);
                        const disp = formatDisplayValue(cellData.value);
                        const cellStyle = resolveCellStyle(r, c, doc.styles);

                        const formula = this.mostraFormule && !(doc.protezione && cellStyle.formulaNascosta) ? this.formuleMostrate.get(`${r}:${c}`) : undefined;
                        // minigrafico (SPARKLINE): il motore dà «SPARKLINE:tipo:valori», qui si disegna
                        const minigrafico = formula === undefined && cellData.value.kind === 'text' ? leggiMinigrafico(cellData.value.value) : null;
                        const formattedText = minigrafico ? t("Minigrafico") : formula !== undefined ? perInputUtente(formula) : cellStyle.numFmt
                          ? formatCellValue(cellData.value, cellStyle.numFmt)
                          : disp.text;

                        // contabilità e simili («* »): il simbolo a sinistra e il numero a destra, come in Excel
                        const partiRiempimento = cellStyle.numFmt && cellData.value.kind === 'number' ? dividiPerRiempimento(cellData.value.value, cellStyle.numFmt) : null;

                        const textDecorations: string[] = [];
                        if (cellStyle.underline || cellStyle.link) textDecorations.push('underline');
                        if (cellStyle.strike) textDecorations.push('line-through');
                        const textDecStr = textDecorations.join(' ') || undefined;

                        const borders = cellStyle.borders || {};
                        const resolveBColor = (c?: string) => (!c || c === 'auto' || c === '#000000')
                          ? 'var(--color-sheet-border-auto, var(--color-text, #0f172a))'
                          : c;
                        const resolveBWidth = (s?: string) => (s === 'medium' ? '2px' : '1px');
                        const resolveBStyle = (s?: string) => (s === 'dashed' ? 'dashed' : 'solid');

                        const borderRightStr = borders.right && borders.right.style !== 'none'
                          ? `${resolveBWidth(borders.right.style)} ${resolveBStyle(borders.right.style)} ${resolveBColor(borders.right.color)}`
                          : undefined;
                        const borderBottomStr = borders.bottom && borders.bottom.style !== 'none'
                          ? `${resolveBWidth(borders.bottom.style)} ${resolveBStyle(borders.bottom.style)} ${resolveBColor(borders.bottom.color)}`
                          : undefined;
                        const borderTopStr = borders.top && borders.top.style !== 'none'
                          ? `${resolveBWidth(borders.top.style)} ${resolveBStyle(borders.top.style)} ${resolveBColor(borders.top.color)}`
                          : undefined;
                        const borderLeftStr = borders.left && borders.left.style !== 'none'
                          ? `${resolveBWidth(borders.left.style)} ${resolveBStyle(borders.left.style)} ${resolveBColor(borders.left.color)}`
                          : undefined;

                        const mergeInfo = getCellMergeInfo(r, c, doc.merges);
                        if (mergeInfo && !mergeInfo.isAnchor) {
                          return html``;
                        }
                        const rowSpan = mergeInfo ? mergeInfo.rowSpan : 1;
                        const colSpan = mergeInfo ? mergeInfo.colSpan : 1;

                        const commentoCella = commentoDi(doc.comments, doc.activeSheetName, r, c);
                        const validationRule = doc.dataValidations.get(`${r}:${c}`);
                        const filterArea = doc.filterArea;
                        const isFilterHeaderRow = doc.isFilterActive && (filterArea ? (r === filterArea.startRow && c >= filterArea.startCol && c <= filterArea.endCol) : r === 1);
                        const isFilterActiveOnCol = doc.activeFilters.has(c);
                        // un VERO/FALSO scritto a mano è una casella; il risultato di una formula si legge come testo (un clic sulla casella sovrascriverebbe la formula)
                        const eFormula = foglioDisegno?.getCell(r, c)?.formula !== undefined;
                        const isChk = validationRule?.type === 'checkbox' || (!eFormula && (isCheckboxCell(validationRule, cellData.raw) || cellData.value.kind === 'boolean'));
                        const isChecked = cellData.value.kind === 'boolean' ? cellData.value.value : isCheckboxChecked(cellData.raw);

                        const condStyle = evaluateConditionalFormats(cellData.value.kind === 'number' ? String(cellData.value.value) : (formattedText || cellData.raw), r, c, doc.conditionalFormats, statisticheDisegno, valutaRegolaFormula);
                        const effectiveBg = isSel
                          ? undefined
                          : (condStyle?.backgroundColor || (cellStyle.fill && cellStyle.fill !== 'none' && cellStyle.fill !== 'auto' ? cellStyle.fill : undefined));
                        // il colore scritto nel formato ([Red]...) vale sul colore del carattere, ma non su quello di una formattazione condizionale
                        const coloreDelNumero = cellStyle.numFmt ? coloreFormato(cellData.value, cellStyle.numFmt) : undefined;
                        const effectiveColor = condStyle?.textColor || coloreDelNumero || (cellStyle.link && (!cellStyle.color || cellStyle.color === 'auto') ? COLORE_LINK : resolveEffectiveTextColor(cellStyle.color, effectiveBg));
                        const effectiveBold = condStyle?.bold !== undefined ? condStyle.bold : cellStyle.bold;

                        const lasciaSpazio = !minigrafico && cellData.value.kind === 'text' && cellData.value.value !== '' && !cellStyle.wrap && (cellStyle.hAlign || 'left') === 'left'
                          && !isChk && colSpan === 1 && !(isAct && this.isEditing);
                        const extraPx = lasciaSpazio ? this.spazioLiberoADestra(r, c, cols[cols.length - 1] ?? c, zoomFactor) : 0;
                        const larghezzaTesto = getColWidth(c, this.larghezzeEffettive()) * zoomFactor + extraPx - 8;

                        return html`
                          <td
                            role="gridcell"
                            aria-colindex="${c + 1}"
                            aria-selected="${isSel ? "true" : "false"}"
                            aria-label="${columnIndexToLetters(c)}${r}${formattedText ? ": " + formattedText : ""}"
                            @contextmenu=${(e: MouseEvent) => this.handleCellContextMenu(r, c, e)}
                            class="sheet-cell ${interruzioniR.has(r) ? "interruzione-r" : ""} ${interruzioniC.has(c) ? "interruzione-c" : ""} ${r === fr && fr > 0 ? "congela-fondo" : ""} ${c === fc && fc > 0 ? "congela-lato" : ""} ${isAct ? "active" : ""} ${extraPx > 0 ? "trabocca" : ""} ${isSel ? "selected" : ""} ${disp.isError ? "cell-error" : ""} ${commentoCella ? "has-comment" : ""}"
                            title="${[commentoCella?.testo, cellStyle.link ? t("{} (Alt+clic per aprire)", cellStyle.link) : ''].filter(Boolean).join(' · ')}"
                            rowspan="${rowSpan > 1 ? rowSpan : 1}"
                            colspan="${colSpan > 1 ? colSpan : 1}"
                            style=${styleMap({
                              width: `${getColWidth(c, this.larghezzeEffettive()) * zoomFactor}px`,
                              height: `${(geom.top(r + rowSpan) - geom.top(r)) * zoomFactor}px`,
                              maxHeight: `${(geom.top(r + rowSpan) - geom.top(r)) * zoomFactor}px`,
                              lineHeight: `${Math.max(12, geom.altezza(r) * zoomFactor - 2)}px`,
                              textAlign: cellStyle.hAlign || disp.align,
                              verticalAlign: cellStyle.vAlign || 'middle',
                              fontWeight: effectiveBold ? '700' : 'normal',
                              fontStyle: cellStyle.italic ? 'italic' : 'normal',
                              textDecoration: textDecStr,
                              fontFamily: cellStyle.fontFamily || undefined,
                              fontSize: cellStyle.fontSize ? `${cellStyle.fontSize * zoomFactor}px` : undefined,
                              color: effectiveColor,
                              backgroundColor: effectiveBg,
                              backgroundImage: condStyle?.dataBar && !isSel ? `linear-gradient(to right, ${condStyle.dataBar.color} ${condStyle.dataBar.percent}%, transparent ${condStyle.dataBar.percent}%)` : undefined,
                              whiteSpace: cellStyle.wrap ? 'pre-wrap' : 'nowrap',
                              borderRight: borderRightStr,
                              borderBottom: borderBottomStr,
                              borderTop: borderTopStr,
                              borderLeft: borderLeftStr,
                              ...stileCong(r, c),
                            })}
                            data-row="${r}"
                            data-col="${c}"
                            data-address="${columnIndexToLetters(c)}${r}"
                            @mousedown=${(e: MouseEvent) => this.handleCellMouseDown(r, c, e)}
                            @mouseenter=${(e: MouseEvent) => this.handleCellMouseEnter(r, c, e)}
                            @dblclick=${() => this.startEditing(false)}
                          >
                            ${condStyle?.icon && ICONE[condStyle.icon] && !(isAct && this.isEditing) ? html`<span class="icona-condizionale" role="img" aria-label=${t(ICONE[condStyle.icon].nome)} style=${styleMap({ color: ICONE[condStyle.icon].colore })}>${ICONE[condStyle.icon].glifo}</span>` : ""}
                            ${isAct && this.isEditing ? "" : minigrafico ? disegnaMinigrafico(minigrafico, getColWidth(c, this.larghezzeEffettive()) * zoomFactor - 6, Math.max(8, (geom.top(r + rowSpan) - geom.top(r)) * zoomFactor - 6), effectiveColor) : isChk ? html`
                              <span class="checkbox-container" @click=${(e: MouseEvent) => { e.stopPropagation(); this.toggleCheckboxAt(r, c); }}>
                                ${isChecked
                                  ? html`<svg class="sheet-checkbox checked" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`
                                  : html`<svg class="sheet-checkbox unchecked" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`}
                              </span>
                            ` : isAct && validationRule?.type === 'list' ? html`<span class="freccia-elenco" role="button" aria-label="Apri l'elenco" @mousedown=${(e: MouseEvent) => e.stopPropagation()} @click=${(e: MouseEvent) => this.apriElenco(r, c, e)}>▾</span>${formattedText}` : extraPx > 0 ? html`<span class="testo-trabocca" style=${styleMap({ width: `${larghezzaTesto}px` })}>${formattedText}</span>` : partiRiempimento ? html`<span class="riempimento"><span>${partiRiempimento[0]}</span><span>${partiRiempimento[1]}</span></span>` : formattedText}
                            ${isFilterHeaderRow && !(isAct && this.isEditing) ? html`
                              <span
                                class="cell-filter-btn ${isFilterActiveOnCol ? 'active' : ''}"
                                @mousedown=${(e: MouseEvent) => e.stopPropagation()}
                                @click=${(e: MouseEvent) => {
                                  e.stopPropagation();
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  this.handleColFilterClick(c, { x: rect.left, y: rect.bottom + 2 });
                                }}
                                title="Filtro colonna ${columnIndexToLetters(c)}"
                                aria-label="Filtro colonna ${columnIndexToLetters(c)}"
                              >▼</span>
                            ` : ''}
                          </td>
                        `;
                      })}
                    </tr>
                  `
                )}
              </tbody>
            </table>
          </div>

          <!-- Highlight riferimenti formula con bordi colorati -->
          ${this.formulaRefHighlights.map((hl) => {
            const zF = this.zoom / 100;
            const headerHeight = this.altezzaIntestazione;
            const top = headerHeight + geom.top(hl.r1) * zF;
            const height = (geom.top(hl.r2 + 1) - geom.top(hl.r1)) * zF;

            let left = 44 * zF;
            for (let c = 1; c < hl.c1; c++) {
              left += getColWidth(c, this.larghezzeEffettive()) * zF;
            }
            let width = 0;
            for (let c = hl.c1; c <= hl.c2; c++) {
              width += getColWidth(c, this.larghezzeEffettive()) * zF;
            }

            return html`
              <div
                class="ref-highlight-box"
                style=${styleMap({
                  top: `${top}px`,
                  left: `${left}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  borderColor: hl.color,
                })}
              ></div>
            `;
          })}

          <!-- Maniglia di riempimento (Fill Handle) -->
          ${!this.isEditing && !doc.selection.isAll ? (() => {
            const sel = doc.selection.range;
            const top = headerHeight + geom.top(sel.endRow + 1) * zF - 4;
            let left = 44 * zF;
            for (let c = 1; c <= sel.endCol; c++) {
              left += getColWidth(c, this.larghezzeEffettive()) * zF;
            }
            left -= 4;
            return html`
              <div
                class="fill-handle"
                style=${styleMap({ top: `${top}px`, left: `${left}px` })}
                @mousedown=${this.handleFillHandleMouseDown}
                title="Trascina per riempire"
              ></div>
            `;
          })() : ''}

          <!-- Rettangolo di anteprima trascinamento riempimento -->
          ${this.isFillDragging && this.fillDragTarget ? (() => {
            const sel = doc.selection.range;
            const tgt = this.fillDragTarget;
            const r1 = Math.min(sel.startRow, tgt.row);
            const r2 = Math.max(sel.endRow, tgt.row);
            const c1 = Math.min(sel.startCol, tgt.col);
            const c2 = Math.max(sel.endCol, tgt.col);
            const top = headerHeight + geom.top(r1) * zF;
            const height = (geom.top(r2 + 1) - geom.top(r1)) * zF;
            let left = 44 * zF;
            for (let c = 1; c < c1; c++) {
              left += getColWidth(c, this.larghezzeEffettive()) * zF;
            }
            let width = 0;
            for (let c = c1; c <= c2; c++) {
              width += getColWidth(c, this.larghezzeEffettive()) * zF;
            }
            return html`
              <div
                class="fill-drag-rect"
                style=${styleMap({
                  top: `${top}px`,
                  left: `${left}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                })}
              ></div>
            `;
          })() : ''}

          <!-- Grafici sovrapposti (M3) -->
          ${(doc.charts || []).filter(ch => !ch.sheetName || ch.sheetName === doc.activeSheetName).map(chart => html`
            <free-chart-overlay
              .config=${chart}
              .selected=${this.selectedChartId === chart.id}
              @chart-select=${(e: CustomEvent) => this.handleChartSelect(e.detail)}
              @chart-change=${(e: CustomEvent) => this.handleChartChange(e.detail)}
              @chart-delete=${(e: CustomEvent) => this.handleChartDelete(e.detail)}
              @chart-edit=${(e: CustomEvent) => this.handleChartEdit(e.detail)}
            ></free-chart-overlay>
          `)}

          <!-- Immagini -->
          ${(doc.immagini || []).filter((im) => im.sheetName === doc.activeSheetName).map((im) => html`
            <free-immagine-overlay
              .config=${im}
              .selected=${this.selectedImageId === im.id}
              @immagine-select=${(e: CustomEvent<string>) => { this.selectedImageId = e.detail; this.selectedChartId = null; this.focusGriglia(); }}
              @immagine-change=${(e: CustomEvent<{ id: string; prima: { x: number; y: number; width: number; height: number }; dopo: { x: number; y: number; width: number; height: number } }>) => this.immagineCambiata(e.detail.id, e.detail.prima, e.detail.dopo)}
              @immagine-delete=${(e: CustomEvent<string>) => this.deleteImage(e.detail)}
            ></free-immagine-overlay>
          `)}

          <!-- Pulsanti dei file di Excel (controlli modulo con macro sicure) -->
          ${(doc.pulsanti || []).filter((p) => p.sheetName === doc.activeSheetName).map((p) => html`
            <button type="button" class="pulsante-modulo ${p.azioni ? '' : 'fermo'} ${p.stile?.verticale ? 'verticale' : ''}" data-pulsante=${p.id}
              style="left:${p.x}px;top:${p.y}px;width:${p.width}px;height:${p.height}px;${p.stile?.colore ? `color:${p.stile.colore};` : ''}${p.stile?.dimensione ? `font-size:${Math.round(p.stile.dimensione * 4 / 3)}px;` : ''}${p.stile?.grassetto ? 'font-weight:700;' : ''}${p.stile?.corsivo ? 'font-style:italic;' : ''}${p.stile?.sottolineato ? 'text-decoration:underline;' : ''}"
              title=${p.azioni ? (p.macro ? t("Esegue la macro «{}»", p.macro) : '') : t("Questa macro non si può eseguire: {}", p.motivo ?? '')}
              @mousedown=${(e: MouseEvent) => e.stopPropagation()}
              @dblclick=${(e: MouseEvent) => e.stopPropagation()}
              @click=${(e: MouseEvent) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent('pulsante-macro', { detail: { id: p.id }, bubbles: true, composed: true })); }}
            >${p.testo}</button>
          `)}

          <!-- Editor sovrapposto -->
          ${this.isEditing ? this.renderCellEditor() : ""}
        </div>
      </div>

      <!-- Barra Trova e Sostituisci (Find & Replace) -->
      ${this.showFindReplace ? html`
        <div class="find-replace-bar">
          <input
            type="text"
            class="find-replace-input find-input"
            placeholder="Trova..."
            .value=${this.findQuery}
            @input=${(e: Event) => {
              this.findQuery = (e.target as HTMLInputElement).value;
              this.findNext();
            }}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.findNext(); }}
          />
          ${this.isReplaceMode ? html`
            <input
              type="text"
              class="find-replace-input replace-input"
              placeholder="Sostituisci con..."
              .value=${this.replaceQuery}
              @input=${(e: Event) => { this.replaceQuery = (e.target as HTMLInputElement).value; }}
            />
          ` : ''}
          <button class="find-replace-btn" @click=${() => this.findNext()}>Trova</button>
          ${this.isReplaceMode ? html`
            <button class="find-replace-btn" @click=${() => this.replaceCurrent()}>Sostituisci</button>
            <button class="find-replace-btn" @click=${() => this.replaceAllAction()}>Tutto</button>
          ` : ''}
          ${this.findMatchesCount > 0 ? html`
            <span class="find-replace-count">${this.findMatchesCount} trovati</span>
          ` : ''}
          <button class="find-replace-btn" @click=${() => this.closeFind()}>✕</button>
        </div>
      ` : ''}

      <!-- Menu contestuale fluttuante -->
      ${this.contextMenu ? this.renderContextMenu() : ''}
      ${this.filtroAperto ? html`
        <free-filtro-colonna
          .colonna=${columnIndexToLetters(this.filtroAperto.col)}
          .valori=${this.filtroAperto.valori}
          .spuntatiIniziali=${this.filtroAperto.spuntati}
          .condizioneIniziale=${this.filtroAperto.condizione}
          .attivo=${this.filtroAperto.attivo}
          .x=${this.filtroAperto.x}
          .y=${this.filtroAperto.y}
          .coloriSfondo=${this.filtroAperto.coloriSfondo}
          .spuntatiSfondoIniziali=${this.filtroAperto.spuntatiSfondo}
          .coloriTesto=${this.filtroAperto.coloriTesto}
          .spuntatiTestoIniziali=${this.filtroAperto.spuntatiTesto}
          .mesi=${this.filtroAperto.mesi}
          .spuntatiMesiIniziali=${this.filtroAperto.spuntatiMesi}
          @ordina-colore=${(e: CustomEvent<{ colore: string; tipo: 'sfondo' | 'testo' }>) => { const col = this.filtroAperto!.col; this.filtroAperto = null; void this.ordinaPerColoreDelFiltro(col, e.detail.colore, e.detail.tipo); this.focusGriglia(); }}
          @ordina-colonna=${(e: CustomEvent<{ ascendente: boolean }>) => { const col = this.filtroAperto!.col; this.filtroAperto = null; void this.ordinaColonnaDelFiltro(col, e.detail.ascendente); this.focusGriglia(); }}
          @chiudi-dialogo=${() => { this.filtroAperto = null; this.focusGriglia(); }}
          @applica-filtro=${(e: CustomEvent<{ spuntati: string[]; condizione?: FilterCondition; sfondo?: string[]; testo?: string[]; mesi?: string[] }>) => { const col = this.filtroAperto!.col; this.applicaFiltroColonna(col, e.detail.spuntati, e.detail.condizione, { sfondo: e.detail.sfondo, testo: e.detail.testo, mesi: e.detail.mesi }); this.focusGriglia(); }}
          @rimuovi-filtro=${() => { const col = this.filtroAperto!.col; this.rimuoviFiltroColonna(col); this.focusGriglia(); }}
        ></free-filtro-colonna>` : ''}
      ${this.elencoAperto ? html`
        <div class="sheet-context-menu" role="listbox" style=${styleMap({ top: `${this.elencoAperto.y}px`, left: `${this.elencoAperto.x}px` })} @click=${(e: MouseEvent) => e.stopPropagation()}>
          ${this.elencoAperto.voci.length === 0 ? html`<div class="sheet-menu-item">(elenco vuoto)</div>` : this.elencoAperto.voci.map((v) => html`<div class="sheet-menu-item" role="option" @click=${() => { void this.scegliDaElenco(v); }}>${v}</div>`)}
        </div>` : ''}
    `;
  }

  private renderCellEditor() {
    const doc = this.getDoc();
    const act = doc.selection.anchor;
    const zF = this.zoom / 100;
    const geomE = this.geomRighe();
    const headerHeight = this.altezzaIntestazione;

    const top = headerHeight + geomE.top(act.row) * zF;
    let left = 44 * zF;
    for (let c = 1; c < act.col; c++) {
      left += getColWidth(c, this.larghezzeEffettive()) * zF;
    }
    const width = getColWidth(act.col, this.larghezzeEffettive()) * zF;
    const height = geomE.altezza(act.row) * zF;

    const actStyle = resolveCellStyle(act.row, act.col, doc.styles);

    return html`
      <input
        type="text"
        class="cell-editor-overlay"
        style=${styleMap({
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
          fontFamily: actStyle.fontFamily || undefined,
          fontSize: actStyle.fontSize ? `${actStyle.fontSize * zF}px` : undefined,
          fontWeight: actStyle.bold ? '700' : undefined,
          fontStyle: actStyle.italic ? 'italic' : undefined,
        })}
        .value=${live(this.editValue)}
        spellcheck=${this.ortografiaPer(this.editValue)}
        lang=${localeNumeri() === 'it' ? 'it' : 'en'}
        @input=${this.handleEditorInput}
        @keydown=${this.handleEditorKeydown}
      />
    `;
  }
}
