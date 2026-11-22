/**
 * Stato per foglio. Un file ha più fogli e ognuno ha il suo aspetto: stili, larghezze e altezze, righe e colonne nascoste, blocco dei riquadri,
 * celle unite, convalide, formattazioni condizionali e filtri. Il documento tiene "vivo" (nei suoi campi di sempre) quello del foglio attivo;
 * quello degli altri fogli sta in `doc.sheetStates`. Cambiando foglio si salva lo stato del foglio che si lascia e si carica quello del nuovo.
 * Il registro degli stili è uno solo per tutto il file (gli stili uguali si riusano tra fogli), per foglio cambia solo a quali celle si applicano.
 * Modulo puro: niente DOM.
 */
import type { SheetDocument } from './document-store';
import type { MergeRange } from './cell-merge';
import type { DataValidationRule } from './data-validation';
import type { ConditionalFormatRule } from './conditional-format';
import { copiaPagina, eDiPartenza, ripulisciPagina, type ImpostaPagina } from './pagina';
import { copiaProtezione, protezioneValida, type ProtezioneFoglio } from './protezione';
import { copiaGruppi, gruppiValidi, type Gruppi } from './gruppi';
import { areaFiltroValida, copiaFiltro, filtriDaJson, filtroInJson, vistePulite, type AreaFiltro, type ColumnFilter, type FiltroInJson, type VistaFiltro } from './filter';

export interface StatoFoglio {
  cellStyles: Map<string, number>;
  rowStyles: Map<number, number>;
  colStyles: Map<number, number>;
  colWidths: Map<number, number>;
  rowHeights: Map<number, number>;
  hiddenRows: Set<number>;
  hiddenCols: Set<number>;
  freezeRows: number;
  freezeCols: number;
  merges: MergeRange[];
  dataValidations: Map<string, DataValidationRule>;
  conditionalFormats: ConditionalFormatRule[];
  activeFilters: Map<number, ColumnFilter>;
  isFilterActive: boolean;
  /** colore della scheda del foglio, "#rrggbb" (senza colore se manca) */
  coloreScheda?: string;
  /** il foglio è nascosto (Nascondi foglio) */
  nascosto?: boolean;
  /** viste filtro salvate del foglio */
  visteFiltro?: VistaFiltro[];
  /** la tabella su cui lavora il filtro (senza: tutto il foglio, con l'intestazione in riga 1) */
  filterArea?: AreaFiltro;
  /** impostazione di pagina per la stampa e il PDF (senza: quella di partenza) */
  impostaPagina?: ImpostaPagina;
  /** protezione del foglio (senza: non protetto) */
  protezione?: ProtezioneFoglio;
  /** righe e colonne raggruppate */
  gruppi?: Gruppi;
}

/** Un filtro come si salva nel file: i valori scelti, i colori e i mesi sono elenchi (nel documento sono Set). */
export type FiltroSalvato = FiltroInJson;

/** Lo stato di un foglio come si scrive nel file nativo. */
export interface StatoFoglioDati {
  cellStyles: Record<string, number>;
  rowStyles: Record<string, number>;
  colStyles: Record<string, number>;
  colWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  hiddenRows: number[];
  hiddenCols: number[];
  freezeRows: number;
  freezeCols: number;
  merges: MergeRange[];
  dataValidations: Record<string, DataValidationRule>;
  conditionalFormats: ConditionalFormatRule[];
  filters: { active: boolean; columns: FiltroSalvato[]; area?: AreaFiltro };
  coloreScheda?: string;
  /** il foglio è nascosto (Nascondi foglio) */
  nascosto?: boolean;
  visteFiltro?: VistaFiltro[];
  impostaPagina?: ImpostaPagina;
  protezione?: ProtezioneFoglio;
  gruppi?: Gruppi;
}

export function statoVuoto(): StatoFoglio {
  return {
    cellStyles: new Map(), rowStyles: new Map(), colStyles: new Map(),
    colWidths: new Map(), rowHeights: new Map(),
    hiddenRows: new Set(), hiddenCols: new Set(),
    freezeRows: 0, freezeCols: 0,
    merges: [], dataValidations: new Map(), conditionalFormats: [],
    activeFilters: new Map(), isFilterActive: false,
  };
}

const copiaJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Copia indipendente di uno stato (per duplicare un foglio). */
export function clonaStato(s: StatoFoglio): StatoFoglio {
  return {
    cellStyles: new Map(s.cellStyles), rowStyles: new Map(s.rowStyles), colStyles: new Map(s.colStyles),
    colWidths: new Map(s.colWidths), rowHeights: new Map(s.rowHeights),
    hiddenRows: new Set(s.hiddenRows), hiddenCols: new Set(s.hiddenCols),
    freezeRows: s.freezeRows, freezeCols: s.freezeCols,
    merges: copiaJson(s.merges),
    dataValidations: new Map([...s.dataValidations].map(([k, v]) => [k, copiaJson(v)] as const)),
    conditionalFormats: copiaJson(s.conditionalFormats),
    activeFilters: new Map([...s.activeFilters].map(([k, v]) => [k, copiaFiltro(v)] as const)),
    isFilterActive: s.isFilterActive,
    coloreScheda: s.coloreScheda,
    nascosto: s.nascosto,
    ...(s.visteFiltro ? { visteFiltro: copiaJson(s.visteFiltro) } : {}),
    ...(s.filterArea ? { filterArea: { ...s.filterArea } } : {}),
    ...(s.impostaPagina ? { impostaPagina: copiaPagina(s.impostaPagina) } : {}),
    ...(s.protezione ? { protezione: copiaProtezione(s.protezione) } : {}),
    ...(copiaGruppi(s.gruppi) ? { gruppi: copiaGruppi(s.gruppi) } : {}),
  };
}

/** Lo stato del foglio attivo, per riferimento (non copiato). */
export function statoCorrente(doc: SheetDocument): StatoFoglio {
  return {
    cellStyles: doc.styles.cellStyles, rowStyles: doc.styles.rowStyles, colStyles: doc.styles.colStyles,
    colWidths: doc.colWidths, rowHeights: doc.rowHeights,
    hiddenRows: doc.hiddenRows, hiddenCols: doc.hiddenCols,
    freezeRows: doc.freezeRows, freezeCols: doc.freezeCols,
    merges: doc.merges, dataValidations: doc.dataValidations, conditionalFormats: doc.conditionalFormats,
    activeFilters: doc.activeFilters, isFilterActive: doc.isFilterActive,
    coloreScheda: doc.coloreScheda,
    nascosto: doc.nascosto,
    visteFiltro: doc.visteFiltro,
    filterArea: doc.filterArea,
    impostaPagina: doc.impostaPagina,
    protezione: doc.protezione,
    gruppi: doc.gruppi,
  };
}

/** Mette uno stato nei campi vivi del documento (diventa il foglio attivo). */
export function applicaStato(doc: SheetDocument, s: StatoFoglio): void {
  doc.styles.cellStyles = s.cellStyles;
  doc.styles.rowStyles = s.rowStyles;
  doc.styles.colStyles = s.colStyles;
  doc.colWidths = s.colWidths;
  doc.rowHeights = s.rowHeights;
  doc.hiddenRows = s.hiddenRows;
  doc.hiddenCols = s.hiddenCols;
  doc.freezeRows = s.freezeRows;
  doc.freezeCols = s.freezeCols;
  doc.merges = s.merges;
  doc.dataValidations = s.dataValidations;
  doc.conditionalFormats = s.conditionalFormats;
  doc.activeFilters = s.activeFilters;
  doc.isFilterActive = s.isFilterActive;
  doc.coloreScheda = s.coloreScheda;
  doc.nascosto = s.nascosto;
  doc.visteFiltro = s.visteFiltro;
  doc.filterArea = s.filterArea;
  doc.impostaPagina = s.impostaPagina;
  doc.protezione = s.protezione;
  doc.gruppi = s.gruppi;
}

/** Il colore della scheda di un foglio (anche quello attivo), o undefined se non ne ha. */
export function coloreSchedaDi(doc: SheetDocument, nome: string): string | undefined {
  return nome === doc.activeSheetName ? doc.coloreScheda : doc.sheetStates.get(nome)?.coloreScheda;
}

/** Dà un colore alla scheda di un foglio (o lo toglie con undefined). */
export function impostaColoreScheda(doc: SheetDocument, nome: string, colore: string | undefined): void {
  if (nome === doc.activeSheetName) { doc.coloreScheda = colore; return; }
  const s = doc.sheetStates.get(nome) ?? statoVuoto();
  s.coloreScheda = colore;
  doc.sheetStates.set(nome, s);
}

/** Vero se il foglio (anche quello attivo) è nascosto. */
export function nascostoDi(doc: SheetDocument, nome: string): boolean {
  return (nome === doc.activeSheetName ? doc.nascosto : doc.sheetStates.get(nome)?.nascosto) === true;
}

/** Nasconde (true) o mostra (false) un foglio. */
export function impostaNascosto(doc: SheetDocument, nome: string, nascosto: boolean): void {
  const v = nascosto ? true : undefined;
  if (nome === doc.activeSheetName) { doc.nascosto = v; return; }
  const s = doc.sheetStates.get(nome) ?? statoVuoto();
  s.nascosto = v;
  doc.sheetStates.set(nome, s);
}

/** L'impostazione di pagina di un foglio (anche quello attivo), o undefined se ha quella di partenza. */
export function paginaDi(doc: SheetDocument, nome: string): ImpostaPagina | undefined {
  return nome === doc.activeSheetName ? doc.impostaPagina : doc.sheetStates.get(nome)?.impostaPagina;
}

/** Cambia l'impostazione di pagina di un foglio; quella di partenza non si tiene (undefined). */
export function impostaPaginaFoglio(doc: SheetDocument, nome: string, p: ImpostaPagina | undefined): void {
  const v = p && !eDiPartenza(p) ? copiaPagina(p) : undefined;
  if (nome === doc.activeSheetName) { doc.impostaPagina = v; return; }
  const s = doc.sheetStates.get(nome) ?? statoVuoto();
  s.impostaPagina = v;
  doc.sheetStates.set(nome, s);
}

/** Passa a un altro foglio: salva lo stato di quello che si lascia e carica quello del nuovo (vuoto se non ne ha uno). */
export function passaAlFoglio(doc: SheetDocument, nuovo: string): void {
  if (doc.activeSheetName === nuovo) return;
  doc.sheetStates.set(doc.activeSheetName, statoCorrente(doc));
  const stato = doc.sheetStates.get(nuovo) ?? statoVuoto();
  doc.sheetStates.delete(nuovo);
  applicaStato(doc, stato);
  doc.activeSheetName = nuovo;
}

/** Lo stato di un foglio qualunque (anche quello attivo), per riferimento. Se non ne ha uno è vuoto. */
export function statoDelFoglio(doc: SheetDocument, nome: string): StatoFoglio {
  return nome === doc.activeSheetName ? statoCorrente(doc) : doc.sheetStates.get(nome) ?? statoVuoto();
}

/** Un foglio è stato rinominato: lo stato lo segue. */
export function rinominaStatoFoglio(doc: SheetDocument, vecchio: string, nuovo: string): void {
  const s = doc.sheetStates.get(vecchio);
  if (!s) return;
  doc.sheetStates.delete(vecchio);
  doc.sheetStates.set(nuovo, s);
}

/** Un foglio non attivo è stato eliminato: il suo stato sparisce. (Per l'attivo, vedi `scartaStatoCorrente`.) */
export function eliminaStatoFoglio(doc: SheetDocument, nome: string): void {
  doc.sheetStates.delete(nome);
}

/** Il foglio attivo sta per essere eliminato: i campi vivi tornano vuoti, così passando a un altro foglio non si salva niente di suo. */
export function scartaStatoCorrente(doc: SheetDocument): void {
  applicaStato(doc, statoVuoto());
}

/** Un foglio è stato duplicato: la copia parte con lo stesso aspetto dell'originale. */
export function duplicaStatoFoglio(doc: SheetDocument, origine: string, copia: string): void {
  doc.sheetStates.set(copia, clonaStato(statoDelFoglio(doc, origine)));
}

// ---- da e verso il file nativo

const mappaNum = <V>(o: Record<string, V> | undefined): Map<number, V> => new Map(Object.entries(o ?? {}).map(([k, v]) => [Number(k), v] as [number, V]));
const oggetto = <V>(m: Map<number | string, V>): Record<string, V> => Object.fromEntries([...m].map(([k, v]) => [String(k), v]));

export function statoADati(s: StatoFoglio): StatoFoglioDati {
  return {
    cellStyles: oggetto(s.cellStyles),
    rowStyles: oggetto(s.rowStyles),
    colStyles: oggetto(s.colStyles),
    colWidths: oggetto(s.colWidths),
    rowHeights: oggetto(s.rowHeights),
    hiddenRows: [...s.hiddenRows].sort((a, b) => a - b),
    hiddenCols: [...s.hiddenCols].sort((a, b) => a - b),
    freezeRows: s.freezeRows || 0,
    freezeCols: s.freezeCols || 0,
    merges: copiaJson(s.merges),
    dataValidations: oggetto(s.dataValidations),
    conditionalFormats: copiaJson(s.conditionalFormats),
    filters: {
      active: !!s.isFilterActive,
      columns: [...s.activeFilters.values()].map(filtroInJson),
      ...(s.filterArea ? { area: { ...s.filterArea } } : {}),
    },
    ...(s.coloreScheda ? { coloreScheda: s.coloreScheda } : {}),
    ...(s.nascosto ? { nascosto: true } : {}),
    ...(s.visteFiltro && s.visteFiltro.length > 0 ? { visteFiltro: copiaJson(s.visteFiltro) } : {}),
    ...(s.impostaPagina && !eDiPartenza(s.impostaPagina) ? { impostaPagina: copiaPagina(s.impostaPagina) } : {}),
    ...(s.protezione ? { protezione: copiaProtezione(s.protezione) } : {}),
    ...(copiaGruppi(s.gruppi) ? { gruppi: copiaGruppi(s.gruppi) } : {}),
  };
}

export function datiAStato(d: Partial<StatoFoglioDati> | undefined): StatoFoglio {
  if (!d) return statoVuoto();
  const interi = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : []);
  return {
    cellStyles: new Map(Object.entries(d.cellStyles ?? {})),
    rowStyles: mappaNum(d.rowStyles),
    colStyles: mappaNum(d.colStyles),
    colWidths: mappaNum(d.colWidths),
    rowHeights: mappaNum(d.rowHeights),
    hiddenRows: new Set(interi(d.hiddenRows)),
    hiddenCols: new Set(interi(d.hiddenCols)),
    freezeRows: typeof d.freezeRows === 'number' ? d.freezeRows : 0,
    freezeCols: typeof d.freezeCols === 'number' ? d.freezeCols : 0,
    merges: copiaJson(Array.isArray(d.merges) ? d.merges : []),
    dataValidations: new Map(Object.entries(copiaJson(d.dataValidations ?? {}))),
    conditionalFormats: copiaJson(Array.isArray(d.conditionalFormats) ? d.conditionalFormats : []),
    activeFilters: filtriDaJson(d.filters?.columns),
    isFilterActive: !!d.filters?.active,
    ...(areaFiltroValida(d.filters?.area) ? { filterArea: areaFiltroValida(d.filters?.area) } : {}),
    ...(typeof d.coloreScheda === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.coloreScheda) ? { coloreScheda: d.coloreScheda } : {}),
    ...(d.nascosto === true ? { nascosto: true } : {}),
    ...(vistePulite(d.visteFiltro).length > 0 ? { visteFiltro: vistePulite(d.visteFiltro) } : {}),
    ...(d.impostaPagina && typeof d.impostaPagina === 'object' ? { impostaPagina: ripulisciPagina(d.impostaPagina) } : {}),
    ...(protezioneValida(d.protezione) ? { protezione: protezioneValida(d.protezione) } : {}),
    ...(gruppiValidi(d.gruppi) ? { gruppi: gruppiValidi(d.gruppi) } : {}),
  };
}

/** Protegge un foglio (con le impronte della password, se c'è) o ne toglie la protezione (undefined). */
export function impostaProtezioneFoglio(doc: SheetDocument, nome: string, p: ProtezioneFoglio | undefined): void {
  const v = copiaProtezione(p);
  if (nome === doc.activeSheetName) { doc.protezione = v; return; }
  const s = doc.sheetStates.get(nome) ?? statoVuoto();
  s.protezione = v;
  doc.sheetStates.set(nome, s);
}
