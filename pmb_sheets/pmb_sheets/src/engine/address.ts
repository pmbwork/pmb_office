/**
 * Gestione degli indirizzi di cella, coordinate e intervalli.
 * Nessuna dipendenza esterna, nessun accesso al DOM o filesystem.
 */

export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384; // XFD

export interface CellCoord {
  sheet?: string;
  row: number; // 1-based (1..1048576)
  col: number; // 1-based (1..16384)
  rowAbs: boolean;
  colAbs: boolean;
}

export interface RangeCoord {
  sheet?: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  startRowAbs: boolean;
  startColAbs: boolean;
  endRowAbs: boolean;
  endColAbs: boolean;
  isFullCol?: boolean;
  isFullRow?: boolean;
}

/**
 * Converte lettere di colonna (es. 'A', 'Z', 'AA', 'XFD') in indice 1-based.
 */
export function columnLettersToIndex(colStr: string): number {
  let result = 0;
  const upper = colStr.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i);
    if (code < 65 || code > 90) return 0;
    result = result * 26 + (code - 64);
  }
  return result;
}

/**
 * Converte un indice di colonna 1-based in lettere (es. 1 -> 'A', 26 -> 'Z', 27 -> 'AA').
 */
export function columnIndexToLetters(colIndex: number): string {
  if (colIndex < 1 || colIndex > MAX_COLS) return '';
  let temp = colIndex;
  let result = '';
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    temp = Math.floor((temp - 1) / 26);
  }
  return result;
}

/**
 * Normalizza il nome di un foglio per confronto case-insensitive.
 */
export function normalizeSheetName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Esegue l'escape del nome di un foglio (racchiuso tra apici se contiene spazi o caratteri speciali).
 */
export function formatSheetName(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return name;
  }
  return `'${name.replace(/'/g, "''")}'`;
}

/**
 * Separa l'eventuale parte del nome foglio dal riferimento locale.
 * Supporta sia 'Nome con spazi'!A1 che Foglio1!A1.
 */
export function splitSheetAndLocal(address: string): { sheet?: string; local: string } {
  const trimmed = address.trim();
  if (trimmed.startsWith("'")) {
    let i = 1;
    let sheet = '';
    while (i < trimmed.length) {
      if (trimmed[i] === "'") {
        if (i + 1 < trimmed.length && trimmed[i + 1] === "'") {
          sheet += "'";
          i += 2;
        } else {
          // fine nome foglio quotato
          i++;
          if (i < trimmed.length && trimmed[i] === '!') {
            i++;
            return { sheet, local: trimmed.substring(i).trim() };
          }
          break;
        }
      } else {
        sheet += trimmed[i];
        i++;
      }
    }
  }

  const bangIdx = trimmed.indexOf('!');
  if (bangIdx !== -1) {
    const sheet = trimmed.substring(0, bangIdx).trim();
    const local = trimmed.substring(bangIdx + 1).trim();
    return { sheet, local };
  }

  return { local: trimmed };
}

const CELL_REGEX = /^(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]{0,6})$/;

/**
 * Effettua il parsing di un indirizzo di singola cella (es. 'A1', '$B$10', 'Foglio1!A1').
 */
export function parseCellAddress(address: string, defaultSheet?: string): CellCoord | null {
  const { sheet, local } = splitSheetAndLocal(address);
  const targetSheet = sheet !== undefined ? sheet : defaultSheet;

  const match = CELL_REGEX.exec(local);
  if (!match) return null;

  const colAbs = match[1] === '$';
  const col = columnLettersToIndex(match[2]);
  const rowAbs = match[3] === '$';
  const row = parseInt(match[4], 10);

  if (col < 1 || col > MAX_COLS || row < 1 || row > MAX_ROWS) {
    return null;
  }

  return {
    sheet: targetSheet,
    row,
    col,
    rowAbs,
    colAbs,
  };
}

const FULL_COL_REGEX = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})$/;
const FULL_ROW_REGEX = /^(\$?)([1-9][0-9]{0,6}):(\$?)([1-9][0-9]{0,6})$/;

/**
 * Effettua il parsing di un intervallo rettangolare (es. 'A1:B5', 'A:C', '1:5', 'Foglio2!A1:B10').
 */
export function parseRangeAddress(rangeStr: string, defaultSheet?: string): RangeCoord | null {
  const { sheet, local } = splitSheetAndLocal(rangeStr);
  const targetSheet = sheet !== undefined ? sheet : defaultSheet;

  // 1. Colonne intere (es. A:B o $A:$B)
  const colMatch = FULL_COL_REGEX.exec(local);
  if (colMatch) {
    const startColAbs = colMatch[1] === '$';
    const c1 = columnLettersToIndex(colMatch[2]);
    const endColAbs = colMatch[3] === '$';
    const c2 = columnLettersToIndex(colMatch[4]);
    if (c1 < 1 || c1 > MAX_COLS || c2 < 1 || c2 > MAX_COLS) return null;

    return {
      sheet: targetSheet,
      startRow: 1,
      startCol: Math.min(c1, c2),
      endRow: MAX_ROWS,
      endCol: Math.max(c1, c2),
      startRowAbs: false,
      startColAbs,
      endRowAbs: false,
      endColAbs,
      isFullCol: true,
    };
  }

  // 2. Righe intere (es. 1:10 o $1:$10)
  const rowMatch = FULL_ROW_REGEX.exec(local);
  if (rowMatch) {
    const startRowAbs = rowMatch[1] === '$';
    const r1 = parseInt(rowMatch[2], 10);
    const endRowAbs = rowMatch[3] === '$';
    const r2 = parseInt(rowMatch[4], 10);
    if (r1 < 1 || r1 > MAX_ROWS || r2 < 1 || r2 > MAX_ROWS) return null;

    return {
      sheet: targetSheet,
      startRow: Math.min(r1, r2),
      startCol: 1,
      endRow: Math.max(r1, r2),
      endCol: MAX_COLS,
      startRowAbs,
      startColAbs: false,
      endRowAbs,
      endColAbs: false,
      isFullRow: true,
    };
  }

  // 3. Intervallo standard cella-cella (es. A1:B5)
  const parts = local.split(':');
  if (parts.length === 2) {
    const c1 = parseCellAddress(parts[0]);
    const c2 = parseCellAddress(parts[1]);
    if (!c1 || !c2) return null;

    return {
      sheet: targetSheet,
      startRow: Math.min(c1.row, c2.row),
      startCol: Math.min(c1.col, c2.col),
      endRow: Math.max(c1.row, c2.row),
      endCol: Math.max(c1.col, c2.col),
      startRowAbs: c1.rowAbs,
      startColAbs: c1.colAbs,
      endRowAbs: c2.rowAbs,
      endColAbs: c2.colAbs,
    };
  }

  // 4. Singola cella trattata come intervallo 1x1
  const single = parseCellAddress(local);
  if (single) {
    return {
      sheet: targetSheet,
      startRow: single.row,
      startCol: single.col,
      endRow: single.row,
      endCol: single.col,
      startRowAbs: single.rowAbs,
      startColAbs: single.colAbs,
      endRowAbs: single.rowAbs,
      endColAbs: single.colAbs,
    };
  }

  return null;
}

/**
 * Formatta un oggetto CellCoord in stringa canonica.
 */
export function formatCellAddress(coord: CellCoord, includeSheet = true): string {
  const colStr = (coord.colAbs ? '$' : '') + columnIndexToLetters(coord.col);
  const rowStr = (coord.rowAbs ? '$' : '') + coord.row.toString();
  const cell = colStr + rowStr;
  if (includeSheet && coord.sheet) {
    return `${formatSheetName(coord.sheet)}!${cell}`;
  }
  return cell;
}

/**
 * Formatta un oggetto RangeCoord in stringa canonica.
 */
export function formatRangeAddress(range: RangeCoord, includeSheet = true): string {
  let rangeStr = '';
  if (range.isFullCol) {
    const c1 = (range.startColAbs ? '$' : '') + columnIndexToLetters(range.startCol);
    const c2 = (range.endColAbs ? '$' : '') + columnIndexToLetters(range.endCol);
    rangeStr = `${c1}:${c2}`;
  } else if (range.isFullRow) {
    const r1 = (range.startRowAbs ? '$' : '') + range.startRow;
    const r2 = (range.endRowAbs ? '$' : '') + range.endRow;
    rangeStr = `${r1}:${r2}`;
  } else {
    const c1 = (range.startColAbs ? '$' : '') + columnIndexToLetters(range.startCol) + (range.startRowAbs ? '$' : '') + range.startRow;
    const c2 = (range.endColAbs ? '$' : '') + columnIndexToLetters(range.endCol) + (range.endRowAbs ? '$' : '') + range.endRow;
    rangeStr = `${c1}:${c2}`;
  }

  if (includeSheet && range.sheet) {
    return `${formatSheetName(range.sheet)}!${rangeStr}`;
  }
  return rangeStr;
}

/**
 * Genera una chiave sparsa stringa canonica univoca per foglio e coordinate.
 * Esempio: 'foglio1!1:1' per riga 1 colonna 1.
 */
export function makeCellKey(sheet: string, row: number, col: number): string {
  return `${normalizeSheetName(sheet)}!${row}:${col}`;
}

export function parseCellKey(key: string): { sheet: string; row: number; col: number } {
  const [sheet, rc] = key.split('!');
  const [rowStr, colStr] = rc.split(':');
  return {
    sheet,
    row: parseInt(rowStr, 10),
    col: parseInt(colStr, 10),
  };
}
