/**
 * Contratto asincrono EngineClient e implementazione concreta InlineEngineClient.
 * I componenti della UI e i moduli applicativi NON importano mai direttamente il motore di calcolo:
 * dialogano esclusivamente tramite questa interfaccia.
 * Ciò garantisce che in futuro il motore possa essere spostato in un Web Worker
 * semplicemente sostituendo l'implementazione con WorkerEngineClient senza toccare la UI.
 */

import {
  createWorkbook,
  Workbook,
  formatCellAddress,
} from '../engine/index';
import type { CellValue, CellChange } from '../engine/index';

export type { CellChange, CellValue };
export { formatCellAddress };

export interface CellData {
  raw: string;
  value: CellValue;
  formula?: string;
  formatted?: string;
}

export interface BatchOp {
  type: 'set' | 'clear';
  sheet: string;
  row: number;
  col: number;
  raw?: string;
}

export interface EngineClient {
  setCell(sheet: string, row: number, col: number, raw: string): Promise<void>;
  getCell(sheet: string, row: number, col: number): Promise<CellData>;
  getRange(
    sheet: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): Promise<CellValue[][]>;
  clearCell(sheet: string, row: number, col: number): Promise<void>;
  applyBatch(operations: BatchOp[]): Promise<void>;
  onChange(callback: (changes: CellChange[]) => void): () => void;
  serialize(): Promise<any>;
  restore(state: string): Promise<void>;
  recalculate(): Promise<void>;
  setNamedRanges(elenco: Array<{ name: string; ref: string }>): Promise<void>;
  /** Le righe nascoste di un foglio (a mano e da un filtro): SUBTOTAL e AGGREGATE le ignorano e si ricalcolano. */
  setHiddenRows(sheet: string, manuali: Iterable<number>, filtrate: Iterable<number>): Promise<void>;
  /** Ricalcola le celle con NOW e TODAY (e ciò che ne dipende); restituisce quante celle sono cambiate. 0 se non ce ne sono o non è cambiato niente. */
  ricalcolaTempo(): Promise<number>;
  /** I passi di Valuta formula: i pezzi della formula, dal più interno, con il loro valore in quella cella. */
  valutaPassi(sheet: string, row: number, col: number, formula: string): Promise<Array<{ testo: string; valore: CellValue | null }>>;
  renameSheet(oldName: string, newName: string): Promise<void>;
  addSheet(name: string): Promise<void>;
  removeSheet(name: string): Promise<void>;
  moveSheet(fromIndex: number, toIndex: number): Promise<boolean>;
  listSheets(): Promise<string[]>;
  insertRows(sheet: string, startRow: number, count?: number): Promise<void>;
  deleteRows(sheet: string, startRow: number, count?: number): Promise<void>;
  insertCols(sheet: string, startCol: number, count?: number): Promise<void>;
  deleteCols(sheet: string, startCol: number, count?: number): Promise<void>;
}

export class InlineEngineClient implements EngineClient {
  private workbook: Workbook;

  constructor(workbook?: Workbook) {
    this.workbook = workbook || createWorkbook();
  }

  public getWorkbookInternal(): Workbook {
    return this.workbook;
  }

  public async setCell(sheet: string, row: number, col: number, raw: string): Promise<void> {
    const address = formatCellAddress({ row, col, rowAbs: false, colAbs: false }, false);
    this.workbook.setCell(sheet, address, raw);
  }

  public async getCell(sheet: string, row: number, col: number): Promise<CellData> {
    const address = formatCellAddress({ row, col, rowAbs: false, colAbs: false }, false);
    const cell = this.workbook.getCell(sheet, address);
    return {
      raw: cell.raw,
      value: cell.value,
      formula: cell.formula,
    };
  }

  public async getRange(
    sheet: string,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): Promise<CellValue[][]> {
    const r1 = Math.min(startRow, endRow);
    const r2 = Math.max(startRow, endRow);
    const c1 = Math.min(startCol, endCol);
    const c2 = Math.max(startCol, endCol);

    return this.workbook.getRangeValues({
      sheet,
      startRow: r1,
      startCol: c1,
      endRow: r2,
      endCol: c2,
      startRowAbs: false,
      startColAbs: false,
      endRowAbs: false,
      endColAbs: false,
    });
  }

  public async clearCell(sheet: string, row: number, col: number): Promise<void> {
    const address = formatCellAddress({ row, col, rowAbs: false, colAbs: false }, false);
    this.workbook.setCell(sheet, address, '');
  }

  public async applyBatch(operations: BatchOp[]): Promise<void> {
    const batch = operations.map((op) => ({
      sheet: op.sheet,
      row: op.row,
      col: op.col,
      raw: op.type === 'clear' ? '' : op.raw || '',
    }));
    this.workbook.applyBatch(batch);
  }

  public onChange(callback: (changes: CellChange[]) => void): () => void {
    return this.workbook.onChange(callback);
  }

  public async serialize(): Promise<any> {
    return this.workbook.serialize();
  }

  public async restore(state: string): Promise<void> {
    this.workbook.deserialize(state);
  }

  public async recalculate(): Promise<void> {
    this.workbook.recalculate();
  }

  public async setNamedRanges(elenco: Array<{ name: string; ref: string }>): Promise<void> {
    this.workbook.setNamedRanges(elenco);
  }

  public async setHiddenRows(sheet: string, manuali: Iterable<number>, filtrate: Iterable<number>): Promise<void> {
    this.workbook.setHiddenRows(sheet, manuali, filtrate);
  }

  public async ricalcolaTempo(): Promise<number> {
    return this.workbook.ricalcolaFunzioniDelTempo().length;
  }

  public async valutaPassi(sheet: string, row: number, col: number, formula: string): Promise<Array<{ testo: string; valore: CellValue | null }>> {
    return this.workbook.valutaPassi(sheet, row, col, formula);
  }

  public async renameSheet(oldName: string, newName: string): Promise<void> {
    this.workbook.renameSheet(oldName, newName);
  }

  public async addSheet(name: string): Promise<void> {
    this.workbook.addSheet(name);
  }

  public async removeSheet(name: string): Promise<void> {
    this.workbook.removeSheet(name);
  }

  public async moveSheet(fromIndex: number, toIndex: number): Promise<boolean> {
    return this.workbook.moveSheet(fromIndex, toIndex);
  }

  public async listSheets(): Promise<string[]> {
    return this.workbook.listSheets();
  }

  public async insertRows(sheet: string, startRow: number, count = 1): Promise<void> {
    this.workbook.insertRows(sheet, startRow, count);
  }

  public async deleteRows(sheet: string, startRow: number, count = 1): Promise<void> {
    this.workbook.deleteRows(sheet, startRow, count);
  }

  public async insertCols(sheet: string, startCol: number, count = 1): Promise<void> {
    this.workbook.insertCols(sheet, startCol, count);
  }

  public async deleteCols(sheet: string, startCol: number, count = 1): Promise<void> {
    this.workbook.deleteCols(sheet, startCol, count);
  }
}
