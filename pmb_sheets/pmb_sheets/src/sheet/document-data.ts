/**
 * Formato JSON versionato per i documenti di Fogli (SheetDocumentData v1).
 * Include:
 * - Dati del motore di calcolo (workbookJson)
 * - Registro stili deduplicato (styles[])
 * - Mappatura stili celle, righe e colonne
 * - Larghezze colonne personalizzate
 * - Nome del foglio attivo
 *
 * Modulo puro e deterministico; non tocca il filesystem.
 */

import { pulsantiDaDati, type PulsanteConfig } from './pulsanti';
import { copiaGruppi, gruppiValidi, type Gruppi } from './gruppi';
import { copiaProtezione, protezioneValida, type ProtezioneCartella, type ProtezioneFoglio } from './protezione';
import { copiaPagina, eDiPartenza, ripulisciPagina, type ImpostaPagina } from './pagina';
import { CellStyle, SheetStyles, StyleRegistry, createSheetStyles } from './styles';
import { SheetDocument } from './document-store';

import { MergeRange } from './cell-merge';
import { DataValidationRule } from './data-validation';
import { NamedRange } from './named-ranges';
import { ConditionalFormatRule } from './conditional-format';
import { areaFiltroValida, filtriDaJson, filtroInJson, vistePulite, type AreaFiltro, type ColumnFilter, type VistaFiltro } from './filter';
import type { ChartConfig } from './chart/chart-model';
import { immaginiDaDati, type ImmagineConfig } from './immagini';
import type { PivotConfig } from './pivot/pivot-model';
import { datiAStato, statoADati, type FiltroSalvato, type StatoFoglioDati } from './stato-fogli';
import { t } from '../i18n/lingua';
export type { FiltroSalvato, StatoFoglioDati } from './stato-fogli';
import { elencaCommenti, commentiDaDati, type CommentoSalvato } from './commenti';

export interface SheetDocumentData {
  version: 1;
  workbookJson: string;
  styles: CellStyle[];
  cellStyles: Record<string, number>;
  rowStyles: Record<string, number>;
  colStyles: Record<string, number>;
  colWidths: Record<string, number>;
  rowHeights?: Record<string, number>;
  freezeRows?: number;
  freezeCols?: number;
  coloreScheda?: string;
  nascosto?: boolean;
  /** viste filtro salvate del foglio attivo */
  visteFiltro?: VistaFiltro[];
  /** impostazione di pagina del foglio attivo */
  impostaPagina?: ImpostaPagina;
  /** protezione del foglio attivo e della struttura della cartella */
  protezione?: ProtezioneFoglio;
  protezioneCartella?: ProtezioneCartella;
  /** righe e colonne raggruppate del foglio attivo */
  gruppi?: Gruppi;
  activeSheetName: string;
  merges?: MergeRange[];
  dataValidations?: Record<string, DataValidationRule>;
  namedRanges?: NamedRange[];
  comments?: CommentoSalvato[];
  conditionalFormats?: ConditionalFormatRule[];
  hiddenRows?: number[];
  hiddenCols?: number[];
  /** filtri sulle colonne: i valori scelti sono un elenco (nel documento sono un Set) */
  filters?: { active: boolean; columns: FiltroSalvato[]; area?: AreaFiltro };
  charts?: ChartConfig[];
  images?: ImmagineConfig[];
  /** pulsanti dei file di Excel (dal 0.2.16) */
  buttons?: PulsanteConfig[];
  pivots?: PivotConfig[];
  /** l'aspetto degli altri fogli (i campi qui sopra sono quelli del foglio attivo); gli stili si riferiscono al registro `styles`, che è uno solo */
  fogliStato?: Record<string, StatoFoglioDati>;
}

/**
 * Converte uno SheetDocument in memoria nel formato puro serializzabile SheetDocumentData.
 */
export async function extractDocumentData(
  doc: SheetDocument,
  sheetStyles: SheetStyles,
): Promise<SheetDocumentData> {
  const workbookJson = (await doc.client.serialize()) as string;

  const cellStylesObj: Record<string, number> = {};
  for (const [k, v] of sheetStyles.cellStyles.entries()) {
    cellStylesObj[k] = v;
  }

  const rowStylesObj: Record<string, number> = {};
  for (const [k, v] of sheetStyles.rowStyles.entries()) {
    rowStylesObj[String(k)] = v;
  }

  const colStylesObj: Record<string, number> = {};
  for (const [k, v] of sheetStyles.colStyles.entries()) {
    colStylesObj[String(k)] = v;
  }

  const colWidthsObj: Record<string, number> = {};
  for (const [k, v] of doc.colWidths.entries()) {
    colWidthsObj[String(k)] = v;
  }

  const rowHeightsObj: Record<string, number> = {};
  if (doc.rowHeights) {
    for (const [k, v] of doc.rowHeights.entries()) {
      rowHeightsObj[String(k)] = v;
    }
  }

  const validationsObj: Record<string, DataValidationRule> = {};
  if (doc.dataValidations) {
    for (const [k, v] of doc.dataValidations.entries()) {
      validationsObj[k] = v;
    }
  }

  return {
    version: 1,
    workbookJson,
    styles: [...sheetStyles.registry.getAllStyles()],
    cellStyles: cellStylesObj,
    rowStyles: rowStylesObj,
    colStyles: colStylesObj,
    colWidths: colWidthsObj,
    rowHeights: rowHeightsObj,
    freezeRows: doc.freezeRows || 0,
    freezeCols: doc.freezeCols || 0,
    ...(doc.coloreScheda ? { coloreScheda: doc.coloreScheda } : {}),
    ...(doc.nascosto ? { nascosto: true } : {}),
    ...(doc.visteFiltro && doc.visteFiltro.length > 0 ? { visteFiltro: JSON.parse(JSON.stringify(doc.visteFiltro)) } : {}),
    ...(doc.impostaPagina && !eDiPartenza(doc.impostaPagina) ? { impostaPagina: copiaPagina(doc.impostaPagina) } : {}),
    ...(doc.protezione ? { protezione: copiaProtezione(doc.protezione) } : {}),
    ...(copiaGruppi(doc.gruppi) ? { gruppi: copiaGruppi(doc.gruppi) } : {}),
    ...(doc.protezioneCartella ? { protezioneCartella: copiaProtezione(doc.protezioneCartella) } : {}),
    activeSheetName: doc.activeSheetName || 'Foglio1',
    merges: doc.merges ? [...doc.merges] : [],
    dataValidations: validationsObj,
    namedRanges: doc.namedRanges ? doc.namedRanges.getAll() : [],
    comments: doc.comments ? elencaCommenti(doc.comments) : [],
    conditionalFormats: doc.conditionalFormats ? [...doc.conditionalFormats] : [],
    hiddenRows: [...(doc.hiddenRows ?? [])].sort((a, b) => a - b),
    hiddenCols: [...(doc.hiddenCols ?? [])].sort((a, b) => a - b),
    filters: {
      active: !!doc.isFilterActive,
      columns: [...(doc.activeFilters ?? new Map<number, ColumnFilter>()).values()].map(filtroInJson),
      ...(doc.filterArea ? { area: { ...doc.filterArea } } : {}),
    },
    charts: JSON.parse(JSON.stringify(doc.charts ?? [])),
    images: (doc.immagini ?? []).map((i) => ({ ...i })),
    ...((doc.pulsanti ?? []).length > 0 ? { buttons: pulsantiDaDati(JSON.parse(JSON.stringify(doc.pulsanti))) } : {}),
    pivots: JSON.parse(JSON.stringify(doc.pivots ?? [])),
    fogliStato: Object.fromEntries([...(doc.sheetStates ?? new Map())].map(([nome, stato]) => [nome, statoADati(stato)])),
  };
}

/**
 * Serializza un oggetto SheetDocumentData in stringa JSON formattata in modo canonico.
 */
export function serializeSheetDocumentData(data: SheetDocumentData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Deserializza una stringa JSON verificandone la versione e la struttura.
 */
export function deserializeSheetDocumentData(json: string): SheetDocumentData {
  if (typeof json !== 'string' || !json.trim()) {
    throw new Error(t("JSON vuoto o non valido per SheetDocumentData"));
  }

  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(t("Dati non validi: oggetto atteso"));
  }

  if (parsed.version !== 1) {
    throw new Error(t("Versione non supportata: {} (attesa versione 1)", parsed.version));
  }

  if (typeof parsed.workbookJson !== 'string') {
    throw new Error(t("Campo workbookJson mancante o non valido"));
  }

  if (!Array.isArray(parsed.styles)) {
    throw new Error(t("Campo styles mancante o non array"));
  }

  return {
    version: 1,
    workbookJson: parsed.workbookJson,
    styles: parsed.styles,
    cellStyles: parsed.cellStyles && typeof parsed.cellStyles === 'object' ? parsed.cellStyles : {},
    rowStyles: parsed.rowStyles && typeof parsed.rowStyles === 'object' ? parsed.rowStyles : {},
    colStyles: parsed.colStyles && typeof parsed.colStyles === 'object' ? parsed.colStyles : {},
    colWidths: parsed.colWidths && typeof parsed.colWidths === 'object' ? parsed.colWidths : {},
    rowHeights: parsed.rowHeights && typeof parsed.rowHeights === 'object' ? parsed.rowHeights : {},
    freezeRows: typeof parsed.freezeRows === 'number' ? parsed.freezeRows : 0,
    freezeCols: typeof parsed.freezeCols === 'number' ? parsed.freezeCols : 0,
    ...(typeof parsed.coloreScheda === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.coloreScheda) ? { coloreScheda: parsed.coloreScheda } : {}),
    ...(parsed.nascosto === true ? { nascosto: true } : {}),
    ...(vistePulite(parsed.visteFiltro).length > 0 ? { visteFiltro: vistePulite(parsed.visteFiltro) } : {}),
    ...(parsed.impostaPagina && typeof parsed.impostaPagina === 'object' ? { impostaPagina: ripulisciPagina(parsed.impostaPagina) } : {}),
    ...(protezioneValida(parsed.protezione) ? { protezione: protezioneValida(parsed.protezione) } : {}),
    ...(gruppiValidi(parsed.gruppi) ? { gruppi: gruppiValidi(parsed.gruppi) } : {}),
    ...(protezioneValida(parsed.protezioneCartella) ? { protezioneCartella: protezioneValida(parsed.protezioneCartella) } : {}),
    activeSheetName: typeof parsed.activeSheetName === 'string' ? parsed.activeSheetName : 'Foglio1',
    merges: Array.isArray(parsed.merges) ? parsed.merges : [],
    dataValidations: parsed.dataValidations && typeof parsed.dataValidations === 'object' ? parsed.dataValidations : {},
    namedRanges: Array.isArray(parsed.namedRanges) ? parsed.namedRanges : [],
    comments: Array.isArray(parsed.comments) ? elencaCommenti(commentiDaDati(parsed.comments)) : [],
    conditionalFormats: Array.isArray(parsed.conditionalFormats) ? parsed.conditionalFormats : [],
    hiddenRows: Array.isArray(parsed.hiddenRows) ? parsed.hiddenRows.filter((n: unknown) => Number.isInteger(n)) : [],
    hiddenCols: Array.isArray(parsed.hiddenCols) ? parsed.hiddenCols.filter((n: unknown) => Number.isInteger(n)) : [],
    filters: parsed.filters && typeof parsed.filters === 'object' && Array.isArray(parsed.filters.columns)
      ? { active: !!parsed.filters.active, columns: [...filtriDaJson(parsed.filters.columns).values()].map(filtroInJson), ...(areaFiltroValida(parsed.filters.area) ? { area: areaFiltroValida(parsed.filters.area) } : {}) }
      : { active: false, columns: [] },
    charts: Array.isArray(parsed.charts) ? parsed.charts : [],
    images: immaginiDaDati(parsed.images),
    ...(Array.isArray(parsed.buttons) && parsed.buttons.length > 0 ? { buttons: pulsantiDaDati(parsed.buttons) } : {}),
    pivots: Array.isArray(parsed.pivots) ? parsed.pivots : [],
    fogliStato: parsed.fogliStato && typeof parsed.fogliStato === 'object' && !Array.isArray(parsed.fogliStato)
      ? Object.fromEntries(Object.entries(parsed.fogliStato as Record<string, unknown>).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => [k, statoADati(datiAStato(v as Partial<StatoFoglioDati>))]))
      : {},
  };
}

/**
 * Ricostruisce lo stato SheetStyles a partire dai dati deserializzati.
 */
export function restoreSheetStylesFromData(data: SheetDocumentData): SheetStyles {
  const registry = new StyleRegistry(data.styles);
  const sheetStyles = createSheetStyles(registry);

  for (const [k, v] of Object.entries(data.cellStyles)) {
    sheetStyles.cellStyles.set(k, v);
  }

  for (const [k, v] of Object.entries(data.rowStyles)) {
    sheetStyles.rowStyles.set(Number(k), v);
  }

  for (const [k, v] of Object.entries(data.colStyles)) {
    sheetStyles.colStyles.set(Number(k), v);
  }

  return sheetStyles;
}
