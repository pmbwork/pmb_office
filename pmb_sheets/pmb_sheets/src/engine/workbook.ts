/**
 * Modello della cartella di lavoro (Workbook) e gestione del foglio di calcolo (Sheet).
 * API pubblica del motore di Fogli:
 * - Sparse storage
 * - Propagazione dirty e ricalcolo topologico iterativo
 * - Notifiche onChange
 * - Serializzazione e deserializzazione JSON versionata
 * Zero dipendenze esterne, zero DOM, zero I/O.
 */

import {
  parseCellAddress,
  parseRangeAddress,
  formatCellAddress,
  formatRangeAddress,
  normalizeSheetName,
  makeCellKey,
  RangeCoord,
} from './address';
import { printAst } from './ast-printer';
import {
  CellValue,
  CellError,
  ValueKind,
  numberVal,
  textVal,
  boolVal,
  emptyVal,
  errorVal,
  compareValues,
} from './values';
import { ASTNode, parseFormula } from './parser';
import { DependencyGraph } from './graph';
import { Evaluator, EvalContext } from './evaluator';
import { shiftFormula } from './shift-formula';
import { RangeArg } from './functions/utils';
import { defaultFunctionRegistry } from './functions/registry';
import {
  rewriteFormulaOnStructureChange,
  StructureChangeOptions,
} from './structure';

export interface PublicCellInfo {
  raw: string;
  value: CellValue;
  kind: ValueKind;
  formula?: string;
  error?: CellError;
  spilledFrom?: { row: number; col: number; masterAddress: string };
  isSpillMaster?: boolean;
}

interface StoredCell {
  raw: string;
  value: CellValue;
  formula?: string;
  ast?: ASTNode;
  spilledFrom?: { row: number; col: number; masterAddress: string };
  spillMatrix?: CellValue[][];
}

export interface CellChange {
  sheet: string;
  address: string;
}

export type ChangeListener = (changedCells: CellChange[]) => void;

export class Sheet {
  public readonly name: string;
  // Sparse storage: row -> col -> StoredCell and col -> row -> StoredCell
  private cells = new Map<number, Map<number, StoredCell>>();
  private cols = new Map<number, Map<number, StoredCell>>();
  private maxRow = 0;
  private maxCol = 0;

  constructor(name: string) {
    this.name = name;
  }

  public getMaxRow(): number {
    return this.maxRow;
  }

  public getMaxCol(): number {
    return this.maxCol;
  }

  public getRowMap(row: number): Map<number, StoredCell> | undefined {
    return this.cells.get(row);
  }

  public getColMap(col: number): Map<number, StoredCell> | undefined {
    return this.cols.get(col);
  }

  public getCell(row: number, col: number): StoredCell | undefined {
    const rowMap = this.cells.get(row);
    return rowMap ? rowMap.get(col) : undefined;
  }

  public setCell(row: number, col: number, cell: StoredCell): void {
    if (row > this.maxRow) this.maxRow = row;
    if (col > this.maxCol) this.maxCol = col;
    let rowMap = this.cells.get(row);
    if (!rowMap) {
      rowMap = new Map();
      this.cells.set(row, rowMap);
    }
    rowMap.set(col, cell);

    let colMap = this.cols.get(col);
    if (!colMap) {
      colMap = new Map();
      this.cols.set(col, colMap);
    }
    colMap.set(row, cell);
  }

  public deleteCell(row: number, col: number): void {
    const rowMap = this.cells.get(row);
    if (rowMap) {
      rowMap.delete(col);
      if (rowMap.size === 0) {
        this.cells.delete(row);
      }
    }
    const colMap = this.cols.get(col);
    if (colMap) {
      colMap.delete(row);
      if (colMap.size === 0) {
        this.cols.delete(col);
      }
    }
  }

  private spillMasters = new Map<string, string[]>();
  public blockedSpillMasters = new Set<string>();

  public clearSpill(row: number, col: number): { row: number; col: number }[] {
    const key = `${row}:${col}`;
    if (this.spillMasters.size === 0) return [];
    const children = this.spillMasters.get(key);
    if (!children || children.length === 0) return [];
    this.spillMasters.delete(key);
    const cleared: { row: number; col: number }[] = [];
    for (const childKey of children) {
      const [rStr, cStr] = childKey.split(':');
      const cr = parseInt(rStr, 10);
      const cc = parseInt(cStr, 10);
      const cell = this.getCell(cr, cc);
      if (cell && cell.spilledFrom && cell.spilledFrom.row === row && cell.spilledFrom.col === col) {
        this.deleteCell(cr, cc);
        cleared.push({ row: cr, col: cc });
      }
    }
    return cleared;
  }

  public applySpill(
    row: number,
    col: number,
    matrix: CellValue[][]
  ): { success: boolean; affected: { row: number; col: number }[] } {
    const key = `${row}:${col}`;
    const H = matrix.length;
    const W = H > 0 ? matrix[0].length : 0;
    if (H <= 1 && W <= 1) {
      this.blockedSpillMasters.delete(key);
      const cleared = this.clearSpill(row, col);
      return { success: true, affected: cleared };
    }

    // Verifica collisioni con celle non vuote
    for (let dr = 0; dr < H; dr++) {
      for (let dc = 0; dc < W; dc++) {
        if (dr === 0 && dc === 0) continue;
        const tr = row + dr;
        const tc = col + dc;
        const existing = this.getCell(tr, tc);
        if (existing) {
          if (
            existing.spilledFrom &&
            existing.spilledFrom.row === row &&
            existing.spilledFrom.col === col
          ) {
            continue;
          }
          if (existing.value.kind !== 'empty' || existing.raw !== '' || existing.formula) {
            const cleared = this.clearSpill(row, col);
            this.blockedSpillMasters.add(key);
            return { success: false, affected: cleared };
          }
        }
      }
    }

    this.blockedSpillMasters.delete(key);
    const cleared = this.clearSpill(row, col);
    const affected: { row: number; col: number }[] = [...cleared];
    const childrenKeys: string[] = [];
    const masterAddr = formatCellAddress({ row, col, rowAbs: false, colAbs: false }, false);

    for (let dr = 0; dr < H; dr++) {
      for (let dc = 0; dc < W; dc++) {
        if (dr === 0 && dc === 0) continue;
        const tr = row + dr;
        const tc = col + dc;
        this.setCell(tr, tc, {
          raw: '',
          value: matrix[dr][dc],
          spilledFrom: { row, col, masterAddress: masterAddr },
        });
        affected.push({ row: tr, col: tc });
        childrenKeys.push(`${tr}:${tc}`);
      }
    }

    this.spillMasters.set(key, childrenKeys);
    return { success: true, affected };
  }

  public getAllCells(): { row: number; col: number; cell: StoredCell }[] {
    const list: { row: number; col: number; cell: StoredCell }[] = [];
    for (const [row, rowMap] of this.cells.entries()) {
      for (const [col, cell] of rowMap.entries()) {
        list.push({ row, col, cell });
      }
    }
    return list;
  }

  public shiftRows(startRow: number, count: number): void {
    if (count <= 0) return;
    const newCells = new Map<number, Map<number, StoredCell>>();
    for (const [r, rowMap] of this.cells.entries()) {
      const targetR = r >= startRow ? r + count : r;
      newCells.set(targetR, rowMap);
    }
    this.cells = newCells;

    const newCols = new Map<number, Map<number, StoredCell>>();
    for (const [c, colMap] of this.cols.entries()) {
      const newColMap = new Map<number, StoredCell>();
      for (const [r, cell] of colMap.entries()) {
        const targetR = r >= startRow ? r + count : r;
        newColMap.set(targetR, cell);
      }
      newCols.set(c, newColMap);
    }
    this.cols = newCols;
    if (this.maxRow >= startRow) {
      this.maxRow += count;
    }
  }

  public removeRows(startRow: number, count: number): { removedCells: { row: number; col: number; cell: StoredCell }[] } {
    const endRow = startRow + count - 1;
    const removedCells: { row: number; col: number; cell: StoredCell }[] = [];
    const newCells = new Map<number, Map<number, StoredCell>>();
    for (const [r, rowMap] of this.cells.entries()) {
      if (r >= startRow && r <= endRow) {
        for (const [c, cell] of rowMap.entries()) {
          removedCells.push({ row: r, col: c, cell });
        }
      } else if (r > endRow) {
        newCells.set(r - count, rowMap);
      } else {
        newCells.set(r, rowMap);
      }
    }
    this.cells = newCells;

    const newCols = new Map<number, Map<number, StoredCell>>();
    for (const [c, colMap] of this.cols.entries()) {
      const newColMap = new Map<number, StoredCell>();
      for (const [r, cell] of colMap.entries()) {
        if (r >= startRow && r <= endRow) {
          // eliminata
        } else if (r > endRow) {
          newColMap.set(r - count, cell);
        } else {
          newColMap.set(r, cell);
        }
      }
      if (newColMap.size > 0) {
        newCols.set(c, newColMap);
      }
    }
    this.cols = newCols;

    let max = 0;
    for (const r of this.cells.keys()) {
      if (r > max) max = r;
    }
    this.maxRow = max;
    return { removedCells };
  }

  public shiftCols(startCol: number, count: number): void {
    if (count <= 0) return;
    const newCols = new Map<number, Map<number, StoredCell>>();
    for (const [c, colMap] of this.cols.entries()) {
      const targetC = c >= startCol ? c + count : c;
      newCols.set(targetC, colMap);
    }
    this.cols = newCols;

    const newCells = new Map<number, Map<number, StoredCell>>();
    for (const [r, rowMap] of this.cells.entries()) {
      const newRowMap = new Map<number, StoredCell>();
      for (const [c, cell] of rowMap.entries()) {
        const targetC = c >= startCol ? c + count : c;
        newRowMap.set(targetC, cell);
      }
      newCells.set(r, newRowMap);
    }
    this.cells = newCells;
    if (this.maxCol >= startCol) {
      this.maxCol += count;
    }
  }

  public removeCols(startCol: number, count: number): { removedCells: { row: number; col: number; cell: StoredCell }[] } {
    const endCol = startCol + count - 1;
    const removedCells: { row: number; col: number; cell: StoredCell }[] = [];
    const newCols = new Map<number, Map<number, StoredCell>>();
    for (const [c, colMap] of this.cols.entries()) {
      if (c >= startCol && c <= endCol) {
        for (const [r, cell] of colMap.entries()) {
          removedCells.push({ row: r, col: c, cell });
        }
      } else if (c > endCol) {
        newCols.set(c - count, colMap);
      } else {
        newCols.set(c, colMap);
      }
    }
    this.cols = newCols;

    const newCells = new Map<number, Map<number, StoredCell>>();
    for (const [r, rowMap] of this.cells.entries()) {
      const newRowMap = new Map<number, StoredCell>();
      for (const [c, cell] of rowMap.entries()) {
        if (c >= startCol && c <= endCol) {
          // eliminata
        } else if (c > endCol) {
          newRowMap.set(c - count, cell);
        } else {
          newRowMap.set(c, cell);
        }
      }
      if (newRowMap.size > 0) {
        newCells.set(r, newRowMap);
      }
    }
    this.cells = newCells;

    let max = 0;
    for (const c of this.cols.keys()) {
      if (c > max) max = c;
    }
    this.maxCol = max;
    return { removedCells };
  }
}

export class Workbook {
  // fogli indicizzati per nome normalizzato (lowercase)
  private sheets = new Map<string, Sheet>();
  private sheetOriginalNames: string[] = [];
  private graph = new DependencyGraph();
  /** Le celle con una formula che usa funzioni volatili (RAND, NOW, TODAY, OFFSET, INDIRECT...): si ricalcolano a ogni modifica. */
  private volatili = new Set<string>();
  private dentroVolatili = false;
  /** Le celle con SUBTOTAL o AGGREGATE: dipendono da quali righe sono nascoste, e si ricalcolano quando cambia. */
  private sensibiliAlNascosto = new Set<string>();
  /** Le celle con NOW o TODAY: il loro valore cambia con il passare del tempo anche se nessuno tocca niente. */
  private delTempo = new Set<string>();
  /** Righe nascoste per foglio (nome normalizzato): a mano o da un filtro. Lo stato lo dà il programma, non si salva nel file del motore. */
  private nascoste = new Map<string, { manuali: Set<number>; filtrate: Set<number> }>();
  private changeListeners: ChangeListener[] = [];
  /** intervalli denominati: nome (maiuscolo) -> riferimento, per esempio "FATTURATO" -> "Foglio1!A1:B10" */
  private nomi = new Map<string, string>();

  constructor() {
    this.addSheet('Foglio1');
  }

  public addSheet(name: string): Sheet {
    const norm = normalizeSheetName(name);
    if (this.sheets.has(norm)) {
      throw new Error(`Un foglio con il nome '${name}' esiste già`);
    }
    const sheet = new Sheet(name);
    this.sheets.set(norm, sheet);
    this.sheetOriginalNames.push(name);
    return sheet;
  }

  public removeSheet(name: string): boolean {
    const norm = normalizeSheetName(name);
    if (!this.sheets.has(norm)) return false;
    if (this.sheets.size <= 1) {
      throw new Error('La cartella di lavoro deve contenere almeno un foglio');
    }
    this.sheets.delete(norm);
    this.sheetOriginalNames = this.sheetOriginalNames.filter(
      (n) => normalizeSheetName(n) !== norm
    );
    // Un ricalcolo completo aggiornerà a #REF! le formule dipendenti
    this.recalculate();
    return true;
  }

  /** Quante celle usano NOW o TODAY (se zero, non serve ricalcolare niente con il passare del tempo). */
  public celleDelTempo(): number {
    return this.delTempo.size;
  }

  /**
   * Ricalcola le celle che usano NOW o TODAY e ciò che ne dipende, come se fosse passato del tempo. Le altre funzioni volatili (RAND, OFFSET...) non si toccano:
   * un numero a caso non deve cambiare da solo. Restituisce le celle il cui valore è davvero cambiato.
   */
  public ricalcolaFunzioniDelTempo(): string[] {
    const chiavi = [...this.delTempo];
    if (chiavi.length === 0) return [];
    const cambiate: string[] = [];
    // il ricalcolo delle dipendenze rivaluta di norma tutte le funzioni volatili: qui no, un numero a caso non deve cambiare perché passa il tempo
    const eraDentro = this.dentroVolatili;
    this.dentroVolatili = true;
    try {
      for (const key of chiavi) {
        const [sh, rStr, cStr] = key.split(/!|:/);
        const sheet = this.getSheet(sh);
        const riga = parseInt(rStr, 10);
        const colonna = parseInt(cStr, 10);
        const stored = sheet?.getCell(riga, colonna);
        if (!sheet || !stored || !stored.ast) { this.delTempo.delete(key); continue; }
        this.evaluateStoredCell(sheet, riga, colonna, stored, key, cambiate);
      }
      for (const k of this.recalculateDependents(chiavi)) if (!cambiate.includes(k)) cambiate.push(k);
    } finally {
      this.dentroVolatili = eraDentro;
    }
    return cambiate;
  }

  /** La riga è nascosta a mano, da un filtro, o visibile (undefined)? */
  public statoRigaNascosta(sheetName: string, row: number): 'manuale' | 'filtro' | undefined {
    const n = this.nascoste.get(normalizeSheetName(sheetName));
    if (!n) return undefined;
    if (n.filtrate.has(row)) return 'filtro';
    return n.manuali.has(row) ? 'manuale' : undefined;
  }

  /**
   * Dice al motore quali righe di un foglio sono nascoste a mano e quali da un filtro: SUBTOTAL e AGGREGATE le ignorano come in Excel.
   * Se qualcosa è cambiato ricalcola le celle che usano quelle funzioni e ciò che ne dipende; restituisce le celle cambiate.
   */
  public setHiddenRows(sheetName: string, manuali: Iterable<number>, filtrate: Iterable<number>): string[] {
    const norm = normalizeSheetName(sheetName);
    const nuovo = { manuali: new Set(manuali), filtrate: new Set(filtrate) };
    const prima = this.nascoste.get(norm);
    const uguali = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((x) => b.has(x));
    const eVuoto = nuovo.manuali.size === 0 && nuovo.filtrate.size === 0;
    if ((!prima && eVuoto) || (prima && uguali(prima.manuali, nuovo.manuali) && uguali(prima.filtrate, nuovo.filtrate))) return [];
    if (eVuoto) this.nascoste.delete(norm); else this.nascoste.set(norm, nuovo);
    const chiavi = [...this.sensibiliAlNascosto];
    if (chiavi.length === 0) return [];
    const cambiate: string[] = [];
    for (const key of chiavi) {
      const [sh, rStr, cStr] = key.split(/!|:/);
      const sheet = this.getSheet(sh);
      const riga = parseInt(rStr, 10);
      const colonna = parseInt(cStr, 10);
      const stored = sheet?.getCell(riga, colonna);
      if (!sheet || !stored || !stored.ast) { this.sensibiliAlNascosto.delete(key); continue; }
      this.evaluateStoredCell(sheet, riga, colonna, stored, key, cambiate);
    }
    for (const k of this.recalculateDependents(chiavi)) if (!cambiate.includes(k)) cambiate.push(k);
    return cambiate;
  }

  /**
   * Imposta gli intervalli denominati della cartella di lavoro e rilegge tutte le formule,
   * così quelle che usano un nome appena definito (o tolto) si aggiornano.
   */
  public setNamedRanges(elenco: Array<{ name: string; ref: string }>): void {
    this.nomi = new Map(elenco.map((n) => [n.name.toUpperCase(), n.ref]));
    const daRileggere: Array<{ foglio: string; riga: number; colonna: number; formula: string }> = [];
    for (const sheet of this.sheets.values()) {
      for (const item of sheet.getAllCells()) {
        if (item.cell.formula) daRileggere.push({ foglio: sheet.name, riga: item.row, colonna: item.col, formula: item.cell.formula });
      }
    }
    for (const f of daRileggere) {
      this.setCell(f.foglio, formatCellAddress({ row: f.riga, col: f.colonna, rowAbs: false, colAbs: false }, false), f.formula);
    }
  }

  public renameSheet(oldName: string, newName: string): boolean {
    const oldNorm = normalizeSheetName(oldName);
    const newNorm = normalizeSheetName(newName);
    if (!this.sheets.has(oldNorm)) return false;
    if (oldNorm !== newNorm && this.sheets.has(newNorm)) {
      throw new Error(`Un foglio con il nome '${newName}' esiste già`);
    }
    const sheet = this.sheets.get(oldNorm)!;
    (sheet as any).name = newName;
    this.sheets.delete(oldNorm);
    this.sheets.set(newNorm, sheet);

    const idx = this.sheetOriginalNames.findIndex((n) => normalizeSheetName(n) === oldNorm);
    if (idx !== -1) {
      this.sheetOriginalNames[idx] = newName;
    }

    // Riscrive i riferimenti alle formule di tutti i fogli
    const rewriteSheetInNode = (node: ASTNode): void => {
      switch (node.type) {
        case 'Cell':
          if (node.coord.sheet && normalizeSheetName(node.coord.sheet) === oldNorm) {
            node.coord.sheet = newName;
            node.raw = formatCellAddress(node.coord, true);
          }
          break;
        case 'Range':
          if (node.coord.sheet && normalizeSheetName(node.coord.sheet) === oldNorm) {
            node.coord.sheet = newName;
            node.raw = formatRangeAddress(node.coord, true);
          }
          break;
        case 'Unary':
        case 'Postfix':
          rewriteSheetInNode(node.expr);
          break;
        case 'Binary':
          rewriteSheetInNode(node.left);
          rewriteSheetInNode(node.right);
          break;
        case 'Call':
          node.args.forEach(rewriteSheetInNode);
          break;
      }
    };

    // Ricostruisce le dipendenze nel grafo aggiornato
    this.graph = new DependencyGraph();
    for (const sh of this.sheets.values()) {
      for (const { row, col, cell } of sh.getAllCells()) {
        if (cell.ast) {
          rewriteSheetInNode(cell.ast);
          cell.raw = '=' + printAst(cell.ast);
          const refs = DependencyGraph.extractReferencesFromAST(cell.ast, sh.name);
          const cellKey = makeCellKey(sh.name, row, col);
          this.graph.setDependencies(cellKey, refs.cells, refs.ranges);
        }
      }
    }

    this.recalculate();
    return true;
  }

  public insertRows(sheetName: string, startRow: number, count = 1): void {
    const sheet = this.getSheet(sheetName);
    if (!sheet || count <= 0) return;

    sheet.shiftRows(startRow, count);
    this.rewriteAllFormulas({
      type: 'insert_rows',
      targetSheet: sheet.name,
      startIndex: startRow,
      count,
    });
    this.rebuildGraphAndRecalculate();
  }

  public deleteRows(sheetName: string, startRow: number, count = 1): void {
    const sheet = this.getSheet(sheetName);
    if (!sheet || count <= 0) return;

    sheet.removeRows(startRow, count);
    this.rewriteAllFormulas({
      type: 'delete_rows',
      targetSheet: sheet.name,
      startIndex: startRow,
      count,
    });
    this.rebuildGraphAndRecalculate();
  }

  public insertCols(sheetName: string, startCol: number, count = 1): void {
    const sheet = this.getSheet(sheetName);
    if (!sheet || count <= 0) return;

    sheet.shiftCols(startCol, count);
    this.rewriteAllFormulas({
      type: 'insert_cols',
      targetSheet: sheet.name,
      startIndex: startCol,
      count,
    });
    this.rebuildGraphAndRecalculate();
  }

  public deleteCols(sheetName: string, startCol: number, count = 1): void {
    const sheet = this.getSheet(sheetName);
    if (!sheet || count <= 0) return;

    sheet.removeCols(startCol, count);
    this.rewriteAllFormulas({
      type: 'delete_cols',
      targetSheet: sheet.name,
      startIndex: startCol,
      count,
    });
    this.rebuildGraphAndRecalculate();
  }

  private rewriteAllFormulas(opt: Omit<StructureChangeOptions, 'formulaSheet'>): void {
    for (const sh of this.sheets.values()) {
      for (const { row, col, cell } of sh.getAllCells()) {
        if (cell.raw && cell.raw.startsWith('=')) {
          const newRaw = rewriteFormulaOnStructureChange(cell.raw, {
            ...opt,
            formulaSheet: sh.name,
          });
          if (newRaw !== cell.raw) {
            cell.raw = newRaw;
            const parsed = this.parseRawInput(newRaw, sh.name, row, col);
            cell.formula = parsed.formula;
            cell.ast = parsed.ast;
            cell.value = parsed.value;
          }
        }
      }
    }
  }

  private rebuildGraphAndRecalculate(): void {
    this.graph = new DependencyGraph();
    for (const sh of this.sheets.values()) {
      for (const { row, col, cell } of sh.getAllCells()) {
        if (cell.ast) {
          const refs = DependencyGraph.extractReferencesFromAST(cell.ast, sh.name);
          const cellKey = makeCellKey(sh.name, row, col);
          this.graph.setDependencies(cellKey, refs.cells, refs.ranges);
        }
      }
    }
    this.recalculate();
  }

  public getSheet(name: string): Sheet | undefined {
    return this.sheets.get(normalizeSheetName(name));
  }

  public listSheets(): string[] {
    return [...this.sheetOriginalNames];
  }

  /** Sposta la posizione di un foglio dall'indice fromIndex a toIndex */
  public moveSheet(fromIndex: number, toIndex: number): boolean {
    if (fromIndex < 0 || fromIndex >= this.sheetOriginalNames.length) return false;
    if (toIndex < 0 || toIndex >= this.sheetOriginalNames.length) return false;
    if (fromIndex === toIndex) return true;
    const [removed] = this.sheetOriginalNames.splice(fromIndex, 1);
    this.sheetOriginalNames.splice(toIndex, 0, removed);
    return true;
  }

  public onChange(listener: ChangeListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }

  private notifyChange(changedCellKeys: string[]): void {
    if (changedCellKeys.length === 0 || this.changeListeners.length === 0) return;
    const nameMap = new Map<string, string>();
    for (const name of this.sheetOriginalNames) {
      nameMap.set(normalizeSheetName(name), name);
    }
    const changes: CellChange[] = changedCellKeys.map((k) => {
      const bangIdx = k.indexOf('!');
      const colonIdx = k.indexOf(':', bangIdx + 1);
      const rawSheet = k.substring(0, bangIdx);
      const row = parseInt(k.substring(bangIdx + 1, colonIdx), 10);
      const col = parseInt(k.substring(colonIdx + 1), 10);
      const displaySheet = nameMap.get(normalizeSheetName(rawSheet)) || rawSheet;
      const address = formatCellAddress({ row, col, rowAbs: false, colAbs: false }, false);
      return {
        sheet: displaySheet,
        address,
      };
    });
    for (const listener of this.changeListeners) {
      listener(changes);
    }
  }

  /**
   * Imposta il contenuto grezzo di una cella e propaga il ricalcolo incrementale.
   */
  public setCell(sheetName: string, address: string, rawInput: string): void {
    const targetSheet = this.getSheet(sheetName);
    if (!targetSheet) {
      throw new Error(`Foglio non trovato: '${sheetName}'`);
    }

    const coord = parseCellAddress(address, targetSheet.name);
    if (!coord) {
      throw new Error(`Indirizzo di cella non valido: '${address}'`);
    }

    const cellKey = makeCellKey(targetSheet.name, coord.row, coord.col);
    const existing = targetSheet.getCell(coord.row, coord.col);
    const oldVal = existing ? existing.value : emptyVal();

    // 1. Parsing del rawInput
    const parsed = this.parseRawInput(rawInput, targetSheet.name, coord.row, coord.col);

    // 2. Aggiornamento dipendenze nel grafo
    if (parsed.ast && contieneFunzioniVolatili(parsed.ast)) this.volatili.add(cellKey);
    else this.volatili.delete(cellKey);
    if (parsed.ast && contieneFunzioniNominate(parsed.ast, FUNZIONI_SENSIBILI_AL_NASCOSTO)) this.sensibiliAlNascosto.add(cellKey);
    else this.sensibiliAlNascosto.delete(cellKey);
    if (parsed.ast && contieneFunzioniNominate(parsed.ast, FUNZIONI_DEL_TEMPO)) this.delTempo.add(cellKey);
    else this.delTempo.delete(cellKey);
    if (parsed.ast) {
      const refs = DependencyGraph.extractReferencesFromAST(parsed.ast, targetSheet.name);
      this.graph.setDependencies(cellKey, refs.cells, refs.ranges);
    } else {
      this.graph.removeDependencies(cellKey);
    }

    const changedKeys: string[] = [];
    const changedSet = new Set<string>();

    // Se la cella sovrascritta era una cella spilled, collisione con il master
    if (existing && existing.spilledFrom) {
      const master = existing.spilledFrom;
      const masterStored = targetSheet.getCell(master.row, master.col);
      if (masterStored) {
        const cleared = targetSheet.clearSpill(master.row, master.col);
        masterStored.value = errorVal('#SPILL!');
        masterStored.spillMatrix = undefined;
        targetSheet.blockedSpillMasters.add(`${master.row}:${master.col}`);
        const mKey = makeCellKey(targetSheet.name, master.row, master.col);
        if (!changedSet.has(mKey)) {
          changedSet.add(mKey);
          changedKeys.push(mKey);
        }
        for (const aff of cleared) {
          const cKey = makeCellKey(targetSheet.name, aff.row, aff.col);
          if (!changedSet.has(cKey)) {
            changedSet.add(cKey);
            changedKeys.push(cKey);
          }
        }
      }
    }

    // 3. Salvataggio della cella modificata e gestione matrice dinamica
    let savedVal = parsed.value;
    let savedSpillMatrix: CellValue[][] | undefined;
    if (parsed.value.kind === 'array') {
      const spillRes = targetSheet.applySpill(coord.row, coord.col, parsed.value.values);
      if (!spillRes.success) {
        savedVal = errorVal('#SPILL!');
      } else {
        savedSpillMatrix = parsed.value.values;
        savedVal = parsed.value.values[0][0];
      }
      for (const aff of spillRes.affected) {
        const affKey = makeCellKey(targetSheet.name, aff.row, aff.col);
        if (!changedSet.has(affKey)) {
          changedSet.add(affKey);
          changedKeys.push(affKey);
        }
      }
    } else {
      targetSheet.blockedSpillMasters.delete(`${coord.row}:${coord.col}`);
      if (existing?.spillMatrix) {
        const cleared = targetSheet.clearSpill(coord.row, coord.col);
        for (const aff of cleared) {
          const affKey = makeCellKey(targetSheet.name, aff.row, aff.col);
          if (!changedSet.has(affKey)) {
            changedSet.add(affKey);
            changedKeys.push(affKey);
          }
        }
      }
    }

    targetSheet.setCell(coord.row, coord.col, {
      raw: rawInput,
      value: savedVal,
      formula: parsed.formula,
      ast: parsed.ast,
      spillMatrix: savedSpillMatrix,
    });

    // Se il valore della cella corrente è cambiato rispetto al precedente
    const cmp = compareValues(oldVal, parsed.value);
    if (cmp.result !== 0 || oldVal.kind !== parsed.value.kind) {
      changedKeys.push(cellKey);
      changedSet.add(cellKey);
    }

    // 4. Ricalcolo incrementale iterativo dei soli discendenti (O(1) dedup)
    const propChanged = this.recalculateDependents([cellKey]);
    for (const k of propChanged) {
      if (!changedSet.has(k)) {
        changedSet.add(k);
        changedKeys.push(k);
      }
    }

    // 5. Notifica listener
    this.notifyChange(changedKeys);
  }

  /**
   * Applica un lotto di operazioni di impostazione/cancellazione celle in modo atomico:
   * analizza, aggiorna il grafo, calcola i valori, ricalcola le dipendenze in un'unica passata
   * e invia un'unica notifica globale ai listener.
   */
  public applyBatch(
    operations: { sheet: string; row: number; col: number; raw: string }[]
  ): void {
    if (operations.length === 0) return;

    const dirtyKeys: string[] = [];
    const changedSet = new Set<string>();
    const changedKeys: string[] = [];

    for (const op of operations) {
      const targetSheet = this.getSheet(op.sheet);
      if (!targetSheet) continue;

      const cellKey = makeCellKey(targetSheet.name, op.row, op.col);
      const existing = targetSheet.getCell(op.row, op.col);
      const oldVal = existing ? existing.value : emptyVal();

      const parsed = this.parseRawInput(op.raw, targetSheet.name, op.row, op.col);

      if (parsed.ast) {
        const refs = DependencyGraph.extractReferencesFromAST(parsed.ast, targetSheet.name);
        this.graph.setDependencies(cellKey, refs.cells, refs.ranges);
      } else {
        this.graph.removeDependencies(cellKey);
      }

      targetSheet.setCell(op.row, op.col, {
        raw: op.raw,
        value: parsed.value,
        formula: parsed.formula,
        ast: parsed.ast,
      });

      const cmp = compareValues(oldVal, parsed.value);
      if (cmp.result !== 0 || oldVal.kind !== parsed.value.kind) {
        if (!changedSet.has(cellKey)) {
          changedSet.add(cellKey);
          changedKeys.push(cellKey);
        }
      }
      dirtyKeys.push(cellKey);
    }

    if (dirtyKeys.length > 0) {
      const propChanged = this.recalculateDependents(dirtyKeys);
      for (const k of propChanged) {
        if (!changedSet.has(k)) {
          changedSet.add(k);
          changedKeys.push(k);
        }
      }
    }

    this.notifyChange(changedKeys);
  }

  /**
   * Cancella una cella.
   */
  public clearCell(sheetName: string, address: string): void {
    this.setCell(sheetName, address, '');
  }

  /**
   * Restituisce le informazioni pubbliche su una cella.
   */
  public getCell(sheetName: string, address: string): PublicCellInfo {
    const targetSheet = this.getSheet(sheetName);
    if (!targetSheet) {
      return {
        raw: '',
        value: errorVal('#REF!'),
        kind: 'error',
        error: '#REF!',
      };
    }

    const coord = parseCellAddress(address, targetSheet.name);
    if (!coord) {
      return {
        raw: '',
        value: errorVal('#REF!'),
        kind: 'error',
        error: '#REF!',
      };
    }

    const stored = targetSheet.getCell(coord.row, coord.col);
    if (!stored) {
      return {
        raw: '',
        value: emptyVal(),
        kind: 'empty',
      };
    }

    return {
      raw: stored.raw,
      value: stored.value,
      kind: stored.value.kind,
      formula: stored.formula,
      error: stored.value.kind === 'error' ? stored.value.error : undefined,
      spilledFrom: stored.spilledFrom,
      isSpillMaster: stored.spillMatrix !== undefined,
    };
  }

  /**
   * Restituisce una matrice 2D di CellValue per un dato intervallo.
   */
  public getRange(sheetName: string, rangeStr: string): CellValue[][] {
    const targetSheet = this.getSheet(sheetName);
    if (!targetSheet) {
      return [[errorVal('#REF!')]];
    }

    const rng = parseRangeAddress(rangeStr, targetSheet.name);
    if (!rng) {
      return [[errorVal('#REF!')]];
    }

    return this.getRangeValuesInternal(rng);
  }

  /**
   * Esegue un ricalcolo completo di tutte le formule del Workbook.
   */
  public recalculate(): void {
    const allFormulaKeys: string[] = [];
    for (const sheet of this.sheets.values()) {
      for (const item of sheet.getAllCells()) {
        if (item.cell.ast) {
          allFormulaKeys.push(makeCellKey(sheet.name, item.row, item.col));
        }
      }
    }

    const { evaluationOrder, circularKeys } = this.graph.getFullTopologicalOrder(allFormulaKeys);
    const actuallyChanged: string[] = [];

    // Imposta #CIRCULAR! sulle celle cicliche
    for (const cKey of circularKeys) {
      const [sh, rStr, cStr] = cKey.split(/!|:/);
      const sheet = this.getSheet(sh);
      if (sheet) {
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        const stored = sheet.getCell(r, c);
        if (stored) {
          const oldVal = stored.value;
          stored.value = errorVal('#CIRCULAR!');
          if (oldVal.kind !== 'error' || oldVal.error !== '#CIRCULAR!') {
            actuallyChanged.push(cKey);
          }
        }
      }
    }

    // Valutazione ordinata topologicamente (iterativa)
    for (const nodeKey of evaluationOrder) {
      const [sh, rStr, cStr] = nodeKey.split(/!|:/);
      const sheet = this.getSheet(sh);
      if (!sheet) continue;

      const r = parseInt(rStr, 10);
      const c = parseInt(cStr, 10);
      const stored = sheet.getCell(r, c);
      if (!stored || !stored.ast) continue;

      this.evaluateStoredCell(sheet, r, c, stored, nodeKey, actuallyChanged);
    }

    this.notifyChange(actuallyChanged);
  }

  /**
   * Ricalcola in ordine topologico iterativo i soli nodi discendenti.
   */
  private recalculateDependents(
    seedKeys: string[]
  ): string[] {
    const { evaluationOrder, circularKeys } = this.graph.getTopologicalOrder(seedKeys);
    const actuallyChanged: string[] = [];

    // Imposta #CIRCULAR! sulle celle cicliche
    for (const cKey of circularKeys) {
      const [sh, rStr, cStr] = cKey.split(/!|:/);
      const sheet = this.getSheet(sh);
      if (sheet) {
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        const stored = sheet.getCell(r, c);
        if (stored) {
          const oldVal = stored.value;
          stored.value = errorVal('#CIRCULAR!');
          if (oldVal.kind !== 'error' || oldVal.error !== '#CIRCULAR!') {
            actuallyChanged.push(cKey);
          }
        }
      }
    }

    // Valutazione ordinata topologicamente (iterativa)
    for (const nodeKey of evaluationOrder) {
      const [sh, rStr, cStr] = nodeKey.split(/!|:/);
      const sheet = this.getSheet(sh);
      if (!sheet) continue;

      const r = parseInt(rStr, 10);
      const c = parseInt(cStr, 10);
      const stored = sheet.getCell(r, c);
      if (!stored || !stored.ast) continue;

      this.evaluateStoredCell(sheet, r, c, stored, nodeKey, actuallyChanged);
    }

    // Ricalcola eventuali celle master con #SPILL! nei fogli coinvolti per ripristinare lo spill
    const sheetsChecked = new Set<string>();
    for (const key of seedKeys) {
      const sh = key.split(/!|:/)[0];
      if (!sheetsChecked.has(sh)) {
        sheetsChecked.add(sh);
        const sheet = this.getSheet(sh);
        if (sheet && sheet.blockedSpillMasters.size > 0) {
          for (const mPos of Array.from(sheet.blockedSpillMasters)) {
            const [rStr, cStr] = mPos.split(':');
            const mr = parseInt(rStr, 10);
            const mc = parseInt(cStr, 10);
            const stored = sheet.getCell(mr, mc);
            if (stored && stored.ast) {
              const mKey = makeCellKey(sheet.name, mr, mc);
              this.evaluateStoredCell(sheet, mr, mc, stored, mKey, actuallyChanged);
            }
          }
        }
      }
    }

    // Le celle volatili si ricalcolano a ogni modifica, insieme a ciò che ne dipende
    if (!this.dentroVolatili && this.volatili.size > 0) {
      this.dentroVolatili = true;
      try {
        const chiavi = [...this.volatili];
        for (const key of chiavi) {
          const [sh, rStr, cStr] = key.split(/!|:/);
          const sheet = this.getSheet(sh);
          const riga = parseInt(rStr, 10);
          const colonna = parseInt(cStr, 10);
          const stored = sheet?.getCell(riga, colonna);
          if (!sheet || !stored || !stored.ast) { this.volatili.delete(key); continue; }
          this.evaluateStoredCell(sheet, riga, colonna, stored, key, actuallyChanged);
        }
        for (const k of this.recalculateDependents(chiavi)) if (!actuallyChanged.includes(k)) actuallyChanged.push(k);
      } finally {
        this.dentroVolatili = false;
      }
    }

    return actuallyChanged;
  }

  private evaluateStoredCell(
    sheet: Sheet,
    r: number,
    c: number,
    stored: StoredCell,
    nodeKey: string,
    actuallyChanged: string[]
  ): void {
    const evalContext: EvalContext = {
      currentSheet: sheet.name,
      currentRow: r,
      currentCol: c,
      getCellValue: (targetSh, tr, tc) => this.getCellValueInternal(targetSh, tr, tc),
      getCellFormula: (targetSh, tr, tc) => this.getFormulaInternal(targetSh, tr, tc),
      getRangeArg: (targetRng) => this.getRangeArgInternal(targetRng),
      getRangeValues: (targetRng) => this.getRangeValuesInternal(targetRng),
      rigaNascosta: (targetSh, tr) => this.statoRigaNascosta(targetSh, tr),
    };

    const evaluator = new Evaluator(evalContext);
    let newVal: CellValue;
    try {
      newVal = evaluator.evaluate(stored.ast!);
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
      newVal = errorVal('#ERROR!');
    }
    const oldVal = stored.value;

    if (newVal.kind === 'array') {
      const spillRes = sheet.applySpill(r, c, newVal.values);
      if (!spillRes.success) {
        stored.value = errorVal('#SPILL!');
        stored.spillMatrix = undefined;
      } else {
        stored.value = newVal.values[0][0];
        stored.spillMatrix = newVal.values;
      }
      for (const aff of spillRes.affected) {
        actuallyChanged.push(makeCellKey(sheet.name, aff.row, aff.col));
      }
    } else {
      sheet.blockedSpillMasters.delete(`${r}:${c}`);
      if (stored.spillMatrix) {
        stored.spillMatrix = undefined;
        const cleared = sheet.clearSpill(r, c);
        for (const aff of cleared) {
          actuallyChanged.push(makeCellKey(sheet.name, aff.row, aff.col));
        }
      }
      stored.value = newVal;
    }

    const cmp = compareValues(oldVal, stored.value);
    if (cmp.result !== 0 || oldVal.kind !== stored.value.kind) {
      actuallyChanged.push(nodeKey);
    }
  }

  /** La formula scritta in una cella (con il "="), o undefined se la cella non ne ha una. */
  private getFormulaInternal(sheetName: string, row: number, col: number): string | undefined {
    const stored = this.getSheet(sheetName)?.getCell(row, col);
    return stored && stored.formula ? stored.formula : undefined;
  }

  private getCellValueInternal(sheetName: string, row: number, col: number): CellValue {
    const sheet = this.getSheet(sheetName);
    if (!sheet) return errorVal('#REF!');
    const stored = sheet.getCell(row, col);
    if (!stored) return emptyVal();
    return stored.value;
  }

  private getRangeArgInternal(rng: RangeCoord): RangeArg {
    const sheetName = rng.sheet || '';
    const sheet = this.getSheet(sheetName);
    if (!sheet) {
      return {
        kind: 'range',
        rowCount: 1,
        colCount: 1,
        coord: rng,
        get: () => errorVal('#REF!'),
        get values() {
          return [[errorVal('#REF!')]];
        },
      };
    }

    const maxSheetRow = Math.max(sheet.getMaxRow(), 1);
    const maxSheetCol = Math.max(sheet.getMaxCol(), 1);

    const rStart = rng.startRow;
    const rEnd = rng.isFullCol ? Math.min(rng.endRow, Math.max(maxSheetRow, rStart)) : rng.endRow;
    const cStart = rng.startCol;
    const cEnd = rng.isFullRow ? Math.min(rng.endCol, Math.max(maxSheetCol, cStart)) : rng.endCol;

    const rowCount = Math.max(0, rEnd - rStart + 1);
    const colCount = Math.max(0, cEnd - cStart + 1);

    let cachedMatrix: CellValue[][] | undefined;

    return {
      kind: 'range',
      rowCount,
      colCount,
      coord: rng,
      baseRow: rStart,
      getColMap: (cOffset: number) => {
        if (cOffset < 0 || cOffset >= colCount) return undefined;
        return sheet.getColMap(cStart + cOffset);
      },
      get: (rOffset: number, cOffset: number): CellValue => {
        if (rOffset < 0 || rOffset >= rowCount || cOffset < 0 || cOffset >= colCount) {
          return errorVal('#REF!');
        }
        const row = rStart + rOffset;
        const col = cStart + cOffset;
        const rowMap = sheet.getRowMap(row);
        if (!rowMap) return emptyVal();
        const stored = rowMap.get(col);
        return stored ? stored.value : emptyVal();
      },
      scanColumn: (colOffset: number, fn: (val: CellValue, r: number) => boolean | void) => {
        if (colOffset < 0 || colOffset >= colCount) return;
        const col = cStart + colOffset;
        const colMap = sheet.getColMap(col);
        const empty = emptyVal();
        if (!colMap) {
          for (let r = 0; r < rowCount; r++) {
            if (fn(empty, r) === false) break;
          }
          return;
        }
        for (let r = 0; r < rowCount; r++) {
          const cell = colMap.get(rStart + r);
          if (fn(cell ? cell.value : empty, r) === false) break;
        }
      },
      getColValue: (rOffset: number, cOffset: number): CellValue => {
        const col = cStart + cOffset;
        const colMap = sheet.getColMap(col);
        if (!colMap) return emptyVal();
        const cell = colMap.get(rStart + rOffset);
        return cell ? cell.value : emptyVal();
      },
      findRowExact: (colOffset: number, val: CellValue): number => {
        if (colOffset < 0 || colOffset >= colCount) return -1;
        const col = cStart + colOffset;
        const colMap = sheet.getColMap(col);
        if (!colMap) return -1;

        if (val.kind === 'number') {
          const target = val.value;
          for (let r = 0; r < rowCount; r++) {
            const cell = colMap.get(rStart + r);
            if (cell && cell.value.kind === 'number' && cell.value.value === target) {
              return r;
            }
          }
        } else if (val.kind === 'text') {
          const target = val.value.toLowerCase();
          for (let r = 0; r < rowCount; r++) {
            const cell = colMap.get(rStart + r);
            if (cell && cell.value.kind === 'text' && cell.value.value.toLowerCase() === target) {
              return r;
            }
          }
        } else if (val.kind === 'boolean') {
          const target = val.value;
          for (let r = 0; r < rowCount; r++) {
            const cell = colMap.get(rStart + r);
            if (cell && cell.value.kind === 'boolean' && cell.value.value === target) {
              return r;
            }
          }
        }
        return -1;
      },
      get values() {
        if (!cachedMatrix) {
          cachedMatrix = [];
          for (let r = 0; r < rowCount; r++) {
            const rowArr: CellValue[] = [];
            const row = rStart + r;
            const rowMap = sheet.getRowMap(row);
            for (let c = 0; c < colCount; c++) {
              const col = cStart + c;
              const stored = rowMap ? rowMap.get(col) : undefined;
              rowArr.push(stored ? stored.value : emptyVal());
            }
            cachedMatrix.push(rowArr);
          }
        }
        return cachedMatrix;
      },
    };
  }

  public getRangeValues(rng: RangeCoord): CellValue[][] {
    return this.getRangeValuesInternal(rng);
  }

  private getRangeValuesInternal(rng: RangeCoord): CellValue[][] {
    return this.getRangeArgInternal(rng).values;
  }

  private astCondizioni = new Map<string, ASTNode | null>();

  /** Valuta la formula di una formattazione condizionale per la cella (riga, colonna): i riferimenti relativi sono quelli della cella in alto a sinistra
   *  dell'intervallo della regola e si spostano con la cella (come in Excel). Vero se il risultato è VERO o un numero diverso da zero; errori e testi sono falso. */
  public valutaCondizione(sheetName: string, formula: string, row: number, col: number, angolo: { riga: number; colonna: number }): boolean {
    const chiave = `${sheetName}|${row - angolo.riga}|${col - angolo.colonna}|${formula}`;
    let ast = this.astCondizioni.get(chiave);
    if (ast === undefined) {
      ast = null;
      try {
        const spostata = shiftFormula(formula.trim().startsWith('=') ? formula : `=${formula}`, row - angolo.riga, col - angolo.colonna);
        const res = parseFormula(spostata.substring(1).trim(), sheetName, (nome) => this.nomi.get(nome.toUpperCase()));
        ast = res.error || !res.ast ? null : res.ast;
      } catch {
        ast = null;
      }
      if (this.astCondizioni.size > 5000) this.astCondizioni.clear();
      this.astCondizioni.set(chiave, ast);
    }
    if (!ast) return false;
    const evalContext: EvalContext = {
      currentSheet: sheetName,
      currentRow: row,
      currentCol: col,
      getCellValue: (sh, r, c) => this.getCellValueInternal(sh, r, c),
      getCellFormula: (sh, r, c) => this.getFormulaInternal(sh, r, c),
      getRangeArg: (rng) => this.getRangeArgInternal(rng),
      getRangeValues: (rng) => this.getRangeValuesInternal(rng),
      rigaNascosta: (sh, r) => this.statoRigaNascosta(sh, r),
    };
    try {
      let v = new Evaluator(evalContext).evaluate(ast);
      if (v.kind === 'array') v = v.values[0]?.[0] ?? v;
      return (v.kind === 'boolean' && v.value) || (v.kind === 'number' && v.value !== 0);
    } catch {
      return false;
    }
  }

  private parseRawInput(
    rawInput: string,
    sheetName: string,
    row: number,
    col: number
  ): { value: CellValue; formula?: string; ast?: ASTNode } {
    if (rawInput === '') {
      return { value: emptyVal() };
    }

    // 1. Apice singolo iniziale forza testo puro
    if (rawInput.startsWith("'")) {
      return { value: textVal(rawInput.substring(1)) };
    }

    // 2. Formula (inizia con '=')
    if (rawInput.startsWith('=')) {
      const formulaBody = rawInput.substring(1).trim();
      let parseRes: ReturnType<typeof parseFormula>;
      try {
        parseRes = parseFormula(formulaBody, sheetName, (nome) => this.nomi.get(nome.toUpperCase()));
      } catch (e) {
        if (!(e instanceof RangeError)) throw e; // formula annidata o lunga oltre ciò che si riesce a leggere
        return { value: errorVal('#ERROR!'), formula: rawInput };
      }
      if (parseRes.error || !parseRes.ast) {
        return {
          value: errorVal('#ERROR!'),
          formula: rawInput,
        };
      }

      // Valutazione iniziale della formula
      const evalContext: EvalContext = {
        currentSheet: sheetName,
        currentRow: row,
        currentCol: col,
        getCellValue: (sh, r, c) => this.getCellValueInternal(sh, r, c),
        getCellFormula: (sh, r, c) => this.getFormulaInternal(sh, r, c),
        getRangeArg: (rng) => this.getRangeArgInternal(rng),
        getRangeValues: (rng) => this.getRangeValuesInternal(rng),
        rigaNascosta: (sh, r) => this.statoRigaNascosta(sh, r),
      };

      const evaluator = new Evaluator(evalContext);
      let val: CellValue;
      try {
        val = evaluator.evaluate(parseRes.ast);
      } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        return { value: errorVal('#ERROR!'), formula: rawInput };
      }

      return {
        value: val,
        formula: rawInput,
        ast: parseRes.ast,
      };
    }

    // 3. Booleano
    const upper = rawInput.trim().toUpperCase();
    if (upper === 'TRUE') {
      return { value: boolVal(true) };
    }
    if (upper === 'FALSE') {
      return { value: boolVal(false) };
    }

    // 4. Numero (con punto decimale standard)
    const trimmed = rawInput.trim();
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (Number.isFinite(num)) {
        return { value: numberVal(num) };
      }
      return { value: errorVal('#NUM!') };
    }

    // 5. Testo ordinario
    return { value: textVal(rawInput) };
  }

  /**
   * Serializzazione JSON della cartella di lavoro con versione.
   */
  public serialize(): string {
    const data = {
      version: 1,
      sheets: this.sheetOriginalNames.map((name) => {
        const sheet = this.getSheet(name)!;
        const cells: Record<string, string> = {};
        for (const item of sheet.getAllCells()) {
          const addr = formatCellAddress({
            row: item.row,
            col: item.col,
            rowAbs: false,
            colAbs: false,
          }, false);
          cells[addr] = item.cell.raw;
        }
        return {
          name,
          cells,
        };
      }),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Deserializzazione JSON.
   */
  public deserialize(jsonStr: string): void {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sheets)) {
      throw new Error('Formato JSON di cartella di lavoro non valido');
    }

    // Reset stato interno
    this.sheets.clear();
    this.sheetOriginalNames = [];
    this.graph = new DependencyGraph();

    for (const shData of parsed.sheets) {
      this.addSheet(shData.name);
      if (shData.cells && typeof shData.cells === 'object') {
        for (const [addr, raw] of Object.entries(shData.cells)) {
          this.setCell(shData.name, addr, raw as string);
        }
      }
    }
  }
}

export function createWorkbook(): Workbook {
  return new Workbook();
}

const FUNZIONI_SENSIBILI_AL_NASCOSTO = ['SUBTOTAL', 'AGGREGATE'];
const FUNZIONI_DEL_TEMPO = ['NOW', 'TODAY'];

/** La formula usa almeno una delle funzioni date (per nome canonico)? */
function contieneFunzioniNominate(ast: ASTNode, nomi: readonly string[]): boolean {
  switch (ast.type) {
    case 'Call': return nomi.includes(ast.name.toUpperCase()) || ast.args.some((a) => contieneFunzioniNominate(a, nomi));
    case 'Unary': case 'Postfix': return contieneFunzioniNominate(ast.expr, nomi);
    case 'Binary': return contieneFunzioniNominate(ast.left, nomi) || contieneFunzioniNominate(ast.right, nomi);
    case 'Array': return ast.rows.some((riga) => riga.some((c) => contieneFunzioniNominate(c, nomi)));
    default: return false;
  }
}

/** La formula usa almeno una funzione volatile (si ricalcola a ogni modifica del foglio)? */
function contieneFunzioniVolatili(ast: ASTNode): boolean {
  switch (ast.type) {
    case 'Call': return defaultFunctionRegistry.isVolatile(ast.name) || ast.args.some(contieneFunzioniVolatili);
    case 'Unary': case 'Postfix': return contieneFunzioniVolatili(ast.expr);
    case 'Binary': return contieneFunzioniVolatili(ast.left) || contieneFunzioniVolatili(ast.right);
    case 'Array': return ast.rows.some((riga) => riga.some(contieneFunzioniVolatili));
    default: return false;
  }
}
