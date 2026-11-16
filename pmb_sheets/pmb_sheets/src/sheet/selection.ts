/**
 * Modulo puro Selezione: gestione dello stato di selezione di una cella,
 * di un intervallo rettangolare, di righe intere, colonne intere e tutto il foglio.
 * Zero DOM, zero Lit, interamente testabile in ambiente Node.
 */

import { columnIndexToLetters, columnLettersToIndex, MAX_ROWS, MAX_COLS } from '../engine/address';
import { t } from '../i18n/lingua';
export { columnIndexToLetters, columnLettersToIndex };

export interface CellPosition {
  row: number; // 1..1048576
  col: number; // 1..16384
}

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SelectionState {
  anchor: CellPosition;  // Cella iniziale (punto fermo del drag/Shift)
  active: CellPosition;  // Cella attiva (dove batte il cursore)
  range: CellRange;      // Intervallo normalizzato (start <= end)
  isFullRow?: boolean;
  isFullCol?: boolean;
  isAll?: boolean;
  /** altri intervalli selezionati prima di `range` (Ctrl+clic): `range` resta l'ultimo, quello della cella attiva */
  extra?: CellRange[];
}

/** Tutti gli intervalli della selezione: prima gli extra, poi quello principale. */
export function intervalliSelezione(sel: SelectionState): CellRange[] {
  return [...(sel.extra ?? []), sel.range];
}

/** Aggiunge alla selezione una nuova cella (Ctrl+clic): la selezione di prima resta, la nuova cella diventa l'attiva. */
export function aggiungiCellaASelezione(sel: SelectionState, row: number, col: number): SelectionState {
  return { ...createCellSelection(row, col), extra: intervalliSelezione(sel) };
}

export function clampRow(row: number): number {
  return Math.max(1, Math.min(MAX_ROWS, Math.trunc(row)));
}

export function clampCol(col: number): number {
  return Math.max(1, Math.min(MAX_COLS, Math.trunc(col)));
}

export function normalizeRange(r: CellRange): CellRange {
  return {
    startRow: Math.min(r.startRow, r.endRow),
    endRow: Math.max(r.startRow, r.endRow),
    startCol: Math.min(r.startCol, r.endCol),
    endCol: Math.max(r.startCol, r.endCol),
  };
}

export function createCellSelection(row: number, col: number): SelectionState {
  const r = clampRow(row);
  const c = clampCol(col);
  return {
    anchor: { row: r, col: c },
    active: { row: r, col: c },
    range: { startRow: r, startCol: c, endRow: r, endCol: c },
    isFullRow: false,
    isFullCol: false,
    isAll: false,
  };
}

export function createRangeSelection(
  anchorRow: number,
  anchorCol: number,
  activeRow: number,
  activeCol: number
): SelectionState {
  const aR = clampRow(anchorRow);
  const aC = clampCol(anchorCol);
  const actR = clampRow(activeRow);
  const actC = clampCol(activeCol);

  const range = normalizeRange({
    startRow: aR,
    startCol: aC,
    endRow: actR,
    endCol: actC,
  });

  const isFullRow = range.startCol === 1 && range.endCol === MAX_COLS;
  const isFullCol = range.startRow === 1 && range.endRow === MAX_ROWS;
  const isAll = isFullRow && isFullCol;

  return {
    anchor: { row: aR, col: aC },
    active: { row: actR, col: actC },
    range,
    isFullRow,
    isFullCol,
    isAll,
  };
}

export function createRowSelection(startRow: number, endRow?: number): SelectionState {
  const r1 = clampRow(startRow);
  const r2 = clampRow(endRow !== undefined ? endRow : startRow);
  return {
    anchor: { row: r1, col: 1 },
    active: { row: r2, col: 1 },
    range: {
      startRow: Math.min(r1, r2),
      startCol: 1,
      endRow: Math.max(r1, r2),
      endCol: MAX_COLS,
    },
    isFullRow: true,
    isFullCol: false,
    isAll: Math.min(r1, r2) === 1 && Math.max(r1, r2) === MAX_ROWS,
  };
}

export function createColSelection(startCol: number, endCol?: number): SelectionState {
  const c1 = clampCol(startCol);
  const c2 = clampCol(endCol !== undefined ? endCol : startCol);
  return {
    anchor: { row: 1, col: c1 },
    active: { row: 1, col: c2 },
    range: {
      startRow: 1,
      startCol: Math.min(c1, c2),
      endRow: MAX_ROWS,
      endCol: Math.max(c1, c2),
    },
    isFullRow: false,
    isFullCol: true,
    isAll: Math.min(c1, c2) === 1 && Math.max(c1, c2) === MAX_COLS,
  };
}

export function createAllSelection(): SelectionState {
  return {
    anchor: { row: 1, col: 1 },
    active: { row: 1, col: 1 },
    range: {
      startRow: 1,
      startCol: 1,
      endRow: MAX_ROWS,
      endCol: MAX_COLS,
    },
    isFullRow: true,
    isFullCol: true,
    isAll: true,
  };
}

export function isCellSelected(row: number, col: number, sel: SelectionState): boolean {
  const dentro = (r: CellRange) => row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol;
  return dentro(sel.range) || (sel.extra !== undefined && sel.extra.some(dentro));
}

export function isSingleCellSelected(sel: SelectionState): boolean {
  return sel.range.startRow === sel.range.endRow && sel.range.startCol === sel.range.endCol;
}

export function formatSelectionAddress(sel: SelectionState): string {
  if (sel.isAll) {
    return 'A1:XFD1048576';
  }
  if (sel.isFullRow) {
    if (sel.range.startRow === sel.range.endRow) {
      return `${sel.range.startRow}:${sel.range.startRow}`;
    }
    return `${sel.range.startRow}:${sel.range.endRow}`;
  }
  if (sel.isFullCol) {
    const c1 = columnIndexToLetters(sel.range.startCol);
    const c2 = columnIndexToLetters(sel.range.endCol);
    if (sel.range.startCol === sel.range.endCol) {
      return `${c1}:${c1}`;
    }
    return `${c1}:${c2}`;
  }
  if (isSingleCellSelected(sel)) {
    return `${columnIndexToLetters(sel.range.startCol)}${sel.range.startRow}`;
  }
  const start = `${columnIndexToLetters(sel.range.startCol)}${sel.range.startRow}`;
  const end = `${columnIndexToLetters(sel.range.endCol)}${sel.range.endRow}`;
  return `${start}:${end}`;
}

export function parseNameBoxAddress(
  text: string
): { selection?: SelectionState; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: t("Indirizzo vuoto") };
  }

  // 1. Colonne intere (es. A:A, A:C)
  const fullColMatch = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(trimmed);
  if (fullColMatch) {
    const c1 = columnLettersToIndex(fullColMatch[1]);
    const c2 = columnLettersToIndex(fullColMatch[2]);
    if (c1 < 1 || c1 > MAX_COLS || c2 < 1 || c2 > MAX_COLS) {
      return { error: t("Colonna fuori dai limiti: {}", trimmed) };
    }
    return { selection: createColSelection(c1, c2) };
  }

  // 2. Righe intere (es. 1:1, 1:10)
  const fullRowMatch = /^([1-9][0-9]{0,6}):([1-9][0-9]{0,6})$/.exec(trimmed);
  if (fullRowMatch) {
    const r1 = parseInt(fullRowMatch[1], 10);
    const r2 = parseInt(fullRowMatch[2], 10);
    if (r1 < 1 || r1 > MAX_ROWS || r2 < 1 || r2 > MAX_ROWS) {
      return { error: t("Riga fuori dai limiti: {}", trimmed) };
    }
    return { selection: createRowSelection(r1, r2) };
  }

  // 3. Intervallo cella:cella (es. A1:B5)
  const rangeMatch = /^([A-Za-z]{1,3})([1-9][0-9]{0,6}):([A-Za-z]{1,3})([1-9][0-9]{0,6})$/.exec(trimmed);
  if (rangeMatch) {
    const c1 = columnLettersToIndex(rangeMatch[1]);
    const r1 = parseInt(rangeMatch[2], 10);
    const c2 = columnLettersToIndex(rangeMatch[3]);
    const r2 = parseInt(rangeMatch[4], 10);
    if (c1 < 1 || c1 > MAX_COLS || c2 < 1 || c2 > MAX_COLS || r1 < 1 || r1 > MAX_ROWS || r2 < 1 || r2 > MAX_ROWS) {
      return { error: t("Coordinate fuori dai limiti: {}", trimmed) };
    }
    return { selection: createRangeSelection(r1, c1, r2, c2) };
  }

  // 4. Singola cella (es. B20)
  const singleMatch = /^([A-Za-z]{1,3})([1-9][0-9]{0,6})$/.exec(trimmed);
  if (singleMatch) {
    const c = columnLettersToIndex(singleMatch[1]);
    const r = parseInt(singleMatch[2], 10);
    if (c < 1 || c > MAX_COLS || r < 1 || r > MAX_ROWS) {
      return { error: t("Cella fuori dai limiti: {}", trimmed) };
    }
    return { selection: createCellSelection(r, c) };
  }

  return { error: t("Indirizzo non valido: {}", trimmed) };
}
