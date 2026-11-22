/**
 * Modulo puro DocumentStore:
 * - Mantiene lo stato completo isolato per ciascuna scheda di Fogli (un documento per scheda).
 * - Preserva: istanza del client/motore di calcolo, selezione attiva, scroll, larghezze colonne, cronologia.
 * - Passare da una scheda all'altra e tornare non perde né dati, né selezione, né scroll.
 * Zero DOM, zero Lit, interamente testabile in ambiente Node.
 */

import type { ImpostaPagina } from './pagina';
import { EngineClient, InlineEngineClient } from './engine-client';
import { SelectionState, createCellSelection } from './selection';
import { HistoryManager } from './history';
import type { ProtezioneCartella, ProtezioneFoglio } from './protezione';
import type { Gruppi } from './gruppi';

import { SheetStyles, createSheetStyles } from './styles';
import { MergeRange } from './cell-merge';
import { DataValidationRule } from './data-validation';
import { NamedRangeRegistry } from './named-ranges';
import { ConditionalFormatRule } from './conditional-format';
import { ColumnFilter, type AreaFiltro, type VistaFiltro } from './filter';
import { ChartConfig } from './chart/chart-model';
import type { ImmagineConfig } from './immagini';
import { PivotConfig } from './pivot/pivot-model';
import type { Commento } from './commenti';
import type { StatoFoglio } from './stato-fogli';
import { t } from '../i18n/lingua';

export interface SheetDocument {
  tabId: string;
  title: string;
  client: EngineClient;
  selection: SelectionState;
  scroll: { left: number; top: number };
  colWidths: Map<number, number>;
  rowHeights: Map<number, number>;
  hiddenRows: Set<number>;
  hiddenCols: Set<number>;
  freezeRows: number;
  freezeCols: number;
  /** colore della scheda del foglio attivo ("#rrggbb") */
  coloreScheda?: string;
  /** il foglio attivo è nascosto (succede solo mentre lo si nasconde: il foglio attivo è sempre uno visibile) */
  nascosto?: boolean;
  /** viste filtro salvate del foglio attivo */
  visteFiltro?: VistaFiltro[];
  /** la tabella su cui lavora il filtro del foglio attivo (senza: tutto il foglio, con l'intestazione in riga 1) */
  filterArea?: AreaFiltro;
  /** impostazione di pagina del foglio attivo (senza: quella di partenza) */
  impostaPagina?: ImpostaPagina;
  /** la password per aprire del file (solo in memoria): con lei i .xlsx e .ods si salvano cifrati */
  passwordApertura?: string;
  /** righe e colonne raggruppate del foglio attivo (vedi gruppi.ts) */
  gruppi?: Gruppi;
  /** protezione del foglio attivo (senza: non protetto); vedi protezione.ts */
  protezione?: ProtezioneFoglio;
  /** struttura della cartella protetta (senza: non protetta) */
  protezioneCartella?: ProtezioneCartella;
  history: HistoryManager;
  activeSheetName: string;
  styles: SheetStyles;
  merges: MergeRange[];
  dataValidations: Map<string, DataValidationRule>;
  namedRanges: NamedRangeRegistry;
  /** commenti sulle celle: chiave riga:colonna!foglio (vedi commenti.ts) */
  comments: Map<string, Commento>;
  conditionalFormats: ConditionalFormatRule[];
  activeFilters: Map<number, ColumnFilter>;
  isFilterActive: boolean;
  charts: ChartConfig[];
  /** immagini sopra le celle (vedi immagini.ts); ognuna sta su un foglio */
  immagini: ImmagineConfig[];
  pivots: PivotConfig[];
  /** l'aspetto degli altri fogli del file (quello del foglio attivo sta nei campi qui sopra): vedi stato-fogli.ts */
  sheetStates: Map<string, StatoFoglio>;
}

export class DocumentStore {
  private documents = new Map<string, SheetDocument>();

  public getOrCreateDocument(
    tabId: string,
    title = t("Foglio senza titolo"),
    clientFactory?: () => EngineClient
  ): SheetDocument {
    let doc = this.documents.get(tabId);
    if (!doc) {
      const client = clientFactory ? clientFactory() : new InlineEngineClient();
      doc = {
        tabId,
        title,
        client,
        selection: createCellSelection(1, 1),
        scroll: { left: 0, top: 0 },
        colWidths: new Map<number, number>(),
        rowHeights: new Map<number, number>(),
        hiddenRows: new Set<number>(),
        hiddenCols: new Set<number>(),
        freezeRows: 0,
        freezeCols: 0,
        history: new HistoryManager(200),
        activeSheetName: 'Foglio1',
        styles: createSheetStyles(),
        merges: [],
        dataValidations: new Map<string, DataValidationRule>(),
        namedRanges: new NamedRangeRegistry(),
        comments: new Map<string, Commento>(),
        conditionalFormats: [],
        activeFilters: new Map<number, ColumnFilter>(),
        isFilterActive: false,
        charts: [],
        immagini: [],
        pivots: [],
        sheetStates: new Map<string, StatoFoglio>(),
      };
      doc.history.contesto = () => doc!.activeSheetName;
      this.documents.set(tabId, doc);
    }
    return doc;
  }

  public getDocument(tabId: string): SheetDocument | undefined {
    return this.documents.get(tabId);
  }

  public hasDocument(tabId: string): boolean {
    return this.documents.has(tabId);
  }

  public removeDocument(tabId: string): boolean {
    return this.documents.delete(tabId);
  }

  public updateScroll(tabId: string, left: number, top: number): void {
    const doc = this.documents.get(tabId);
    if (doc) {
      doc.scroll.left = Math.max(0, left);
      doc.scroll.top = Math.max(0, top);
    }
  }

  public updateSelection(tabId: string, sel: SelectionState): void {
    const doc = this.documents.get(tabId);
    if (doc) {
      doc.selection = sel;
    }
  }

  public setColWidth(tabId: string, col: number, width: number): void {
    const doc = this.documents.get(tabId);
    if (doc) {
      doc.colWidths.set(col, Math.max(20, Math.min(1000, width)));
    }
  }

  public getSheetStyles(tabId: string): SheetStyles | undefined {
    return this.documents.get(tabId)?.styles;
  }

  public clear(): void {
    this.documents.clear();
  }
}

// Istanza globale singleton del DocumentStore per l'app
export const defaultDocumentStore = new DocumentStore();
