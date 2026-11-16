/**
 * Funzioni di Ricerca e Riferimento:
 * VLOOKUP, HLOOKUP, INDEX, MATCH, XLOOKUP (versione base), CHOOSE, ROW, COLUMN
 */

import { CellValue, numberVal, errorVal, coerceToNumber, coerceToBoolean, compareValues } from '../values';
import { EvalArg, isRangeArg, compileCriterion } from './utils';

export interface FunctionContext {
  currentSheet: string;
  currentRow: number;
  currentCol: number;
  /** legge una cella qualunque del libro (serve a OFFSET, che esce dall'area di partenza) */
  getCellValue?: (sheet: string, row: number, col: number) => CellValue;
  /** la formula scritta in una cella (serve a SUBTOTAL e AGGREGATE per riconoscere i subtotali annidati) */
  getCellFormula?: (sheet: string, row: number, col: number) => string | undefined;
  /** una riga è nascosta a mano ('manuale') o da un filtro ('filtro')? undefined se è visibile (serve a SUBTOTAL e AGGREGATE) */
  rigaNascosta?: (sheet: string, row: number) => 'manuale' | 'filtro' | undefined;
}

export function fnVLOOKUP(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 4) return errorVal('#VALUE!');
  const lookupVal = args[0];
  const table = args[1];
  const colIdxArg = args[2];
  if (isRangeArg(lookupVal) || !isRangeArg(table) || isRangeArg(colIdxArg)) {
    return errorVal('#VALUE!');
  }

  const colIdxNum = coerceToNumber(colIdxArg);
  if (colIdxNum.error) return errorVal(colIdxNum.error);
  const colIdx = Math.trunc(colIdxNum.value!);

  const rows = table.rowCount !== undefined ? table.rowCount : table.values.length;
  const cols = table.colCount !== undefined ? table.colCount : (rows > 0 ? table.values[0].length : 0);
  if (colIdx < 1 || colIdx > cols) return errorVal('#REF!');

  let exactMatch = false; // default in fogli è approssimato (TRUE)
  if (args.length === 4) {
    if (isRangeArg(args[3])) return errorVal('#VALUE!');
    const rangeLookup = coerceToBoolean(args[3]);
    if (rangeLookup.error) return errorVal(rangeLookup.error);
    exactMatch = !rangeLookup.value;
  }

  const getCell = (r: number, c: number): CellValue => {
    return table.get ? table.get(r, c) : table.values[r][c];
  };

  if (exactMatch) {
    const targetCol = colIdx - 1;
    if (table.findRowExact && (lookupVal.kind === 'number' || (lookupVal.kind === 'text' && !/[*?~]/.test(lookupVal.value)) || lookupVal.kind === 'boolean')) {
      const matchRow = table.findRowExact(0, lookupVal);
      if (matchRow !== -1) {
        return getCell(matchRow, targetCol);
      }
      return errorVal('#N/A');
    }
    const matcher = compileCriterion(lookupVal);
    for (let r = 0; r < rows; r++) {
      const firstColCell = getCell(r, 0);
      if (matcher(firstColCell)) {
        return getCell(r, targetCol);
      }
    }
    return errorVal('#N/A');
  } else {
    // Ricerca approssimata (tabella ordinata in modo crescente)
    let bestRow = -1;
    for (let r = 0; r < rows; r++) {
      const firstColCell = getCell(r, 0);
      const cmp = compareValues(firstColCell, lookupVal);
      if (cmp.error) return errorVal(cmp.error);
      if (cmp.result! <= 0) {
        bestRow = r;
      } else {
        break;
      }
    }
    if (bestRow === -1) return errorVal('#N/A');
    return getCell(bestRow, colIdx - 1);
  }
}

export function fnHLOOKUP(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 4) return errorVal('#VALUE!');
  const lookupVal = args[0];
  const table = args[1];
  const rowIdxArg = args[2];
  if (isRangeArg(lookupVal) || !isRangeArg(table) || isRangeArg(rowIdxArg)) {
    return errorVal('#VALUE!');
  }

  const rowIdxNum = coerceToNumber(rowIdxArg);
  if (rowIdxNum.error) return errorVal(rowIdxNum.error);
  const rowIdx = Math.trunc(rowIdxNum.value!);

  const rows = table.rowCount !== undefined ? table.rowCount : table.values.length;
  const cols = table.colCount !== undefined ? table.colCount : (rows > 0 ? table.values[0].length : 0);
  if (rowIdx < 1 || rowIdx > rows) return errorVal('#REF!');

  let exactMatch = false;
  if (args.length === 4) {
    if (isRangeArg(args[3])) return errorVal('#VALUE!');
    const rangeLookup = coerceToBoolean(args[3]);
    if (rangeLookup.error) return errorVal(rangeLookup.error);
    exactMatch = !rangeLookup.value;
  }

  const getCell = (r: number, c: number): CellValue => {
    return table.get ? table.get(r, c) : table.values[r][c];
  };

  if (exactMatch) {
    const matcher = compileCriterion(lookupVal);
    const targetRow = rowIdx - 1;
    for (let c = 0; c < cols; c++) {
      const firstRowCell = getCell(0, c);
      if (matcher(firstRowCell)) {
        return getCell(targetRow, c);
      }
    }
    return errorVal('#N/A');
  } else {
    let bestCol = -1;
    for (let c = 0; c < cols; c++) {
      const firstRowCell = getCell(0, c);
      const cmp = compareValues(firstRowCell, lookupVal);
      if (cmp.error) return errorVal(cmp.error);
      if (cmp.result! <= 0) {
        bestCol = c;
      } else {
        break;
      }
    }
    if (bestCol === -1) return errorVal('#N/A');
    return getCell(rowIdx - 1, bestCol);
  }
}

export function fnINDEX(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const range = args[0];
  if (!isRangeArg(range) || isRangeArg(args[1])) return errorVal('#VALUE!');
  if (args[1].kind === 'error') return args[1];

  const maxRows = range.rowCount !== undefined ? range.rowCount : range.values.length;
  const maxCols = range.colCount !== undefined ? range.colCount : (maxRows > 0 ? range.values[0].length : 0);
  const leggi = (r: number, c: number): CellValue => (range.get ? range.get(r, c) : range.values[r][c]);

  const rowArg = coerceToNumber(args[1]);
  if (rowArg.error) return errorVal(rowArg.error);
  let row = Math.trunc(rowArg.value!);
  let col = 0; // 0 = tutta la riga
  if (args.length === 3) {
    if (isRangeArg(args[2])) return errorVal('#VALUE!');
    if (args[2].kind === 'error') return args[2];
    const colArg = coerceToNumber(args[2]);
    if (colArg.error) return errorVal(colArg.error);
    col = Math.trunc(colArg.value!);
  } else if (maxRows === 1) {
    // un vettore riga con un solo indice: l'indice è la colonna
    col = row;
    row = 1;
  } else if (maxCols === 1) {
    col = 1;
  }

  if (row < 0 || row > maxRows || col < 0 || col > maxCols) return errorVal('#REF!');

  // riga 0 = tutta la colonna, colonna 0 = tutta la riga, entrambe 0 = tutto
  const righe = row === 0 ? Array.from({ length: maxRows }, (_, i) => i) : [row - 1];
  const colonne = col === 0 ? Array.from({ length: maxCols }, (_, i) => i) : [col - 1];
  if (righe.length === 1 && colonne.length === 1) return leggi(righe[0], colonne[0]);
  return { kind: 'array', values: righe.map((r) => colonne.map((c) => leggi(r, c))) };
}

export function fnMATCH(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const lookupVal = args[0];
  const lookupArray = args[1];
  if (isRangeArg(lookupVal) || !isRangeArg(lookupArray)) return errorVal('#VALUE!');

  let matchType = 1;
  if (args.length === 3) {
    if (isRangeArg(args[2])) return errorVal('#VALUE!');
    const mt = coerceToNumber(args[2]);
    if (mt.error) return errorVal(mt.error);
    matchType = Math.trunc(mt.value!);
  }

  const rows = lookupArray.rowCount !== undefined ? lookupArray.rowCount : lookupArray.values.length;
  const cols = lookupArray.colCount !== undefined ? lookupArray.colCount : (rows > 0 ? lookupArray.values[0].length : 0);
  if (rows > 1 && cols > 1) return errorVal('#VALUE!'); // Deve essere 1D

  const isRow = rows === 1;
  const length = isRow ? cols : rows;
  const getCell = (i: number): CellValue => {
    if (lookupArray.get) {
      return isRow ? lookupArray.get(0, i) : lookupArray.get(i, 0);
    }
    return isRow ? lookupArray.values[0][i] : lookupArray.values[i][0];
  };

  if (matchType === 0) {
    // Esatto: percorso rapido findRowExact se su colonna
    if (!isRow && lookupArray.findRowExact && (lookupVal.kind === 'number' || (lookupVal.kind === 'text' && !/[*?~]/.test(lookupVal.value)) || lookupVal.kind === 'boolean')) {
      const matchRow = lookupArray.findRowExact(0, lookupVal);
      if (matchRow !== -1) {
        return numberVal(matchRow + 1);
      }
      return errorVal('#N/A');
    }
    const matcher = compileCriterion(lookupVal);
    for (let i = 0; i < length; i++) {
      if (matcher(getCell(i))) {
        return numberVal(i + 1);
      }
    }
    return errorVal('#N/A');
  } else if (matchType === 1) {
    // Minore o uguale (ordinato crescente)
    let best = -1;
    for (let i = 0; i < length; i++) {
      const cmp = compareValues(getCell(i), lookupVal);
      if (cmp.error) return errorVal(cmp.error);
      if (cmp.result! <= 0) {
        best = i + 1;
      } else {
        break;
      }
    }
    if (best === -1) return errorVal('#N/A');
    return numberVal(best);
  } else if (matchType === -1) {
    // Maggiore o uguale (ordinato decrescente)
    let best = -1;
    for (let i = 0; i < length; i++) {
      const cmp = compareValues(getCell(i), lookupVal);
      if (cmp.error) return errorVal(cmp.error);
      if (cmp.result! >= 0) {
        best = i + 1;
      } else {
        break;
      }
    }
    if (best === -1) return errorVal('#N/A');
    return numberVal(best);
  }

  return errorVal('#VALUE!');
}

export function fnXLOOKUP(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length > 6) return errorVal('#VALUE!');
  const lookupVal = args[0];
  const lookupArray = args[1];
  const returnArray = args[2];
  if (isRangeArg(lookupVal) || !isRangeArg(lookupArray) || !isRangeArg(returnArray)) {
    return errorVal('#VALUE!');
  }

  const notFound = args.length >= 4 ? args[3] : errorVal('#N/A');
  let matchMode = 0;
  if (args.length >= 5) {
    if (isRangeArg(args[4])) return errorVal('#VALUE!');
    const mm = coerceToNumber(args[4]);
    if (mm.error) return errorVal(mm.error);
    matchMode = Math.trunc(mm.value!);
  }

  const lRows = lookupArray.rowCount !== undefined ? lookupArray.rowCount : lookupArray.values.length;
  const lCols = lookupArray.colCount !== undefined ? lookupArray.colCount : (lRows > 0 ? lookupArray.values[0].length : 0);
  const isLookupRow = lRows === 1;
  const count = isLookupRow ? lCols : lRows;

  const rRows = returnArray.rowCount !== undefined ? returnArray.rowCount : returnArray.values.length;
  const rCols = returnArray.colCount !== undefined ? returnArray.colCount : (rRows > 0 ? returnArray.values[0].length : 0);
  const isReturnRow = rRows === 1;
  const returnCount = isReturnRow ? rCols : rRows;

  if (count !== returnCount) return errorVal('#VALUE!');

  const getLookup = (i: number): CellValue => {
    if (lookupArray.get) return isLookupRow ? lookupArray.get(0, i) : lookupArray.get(i, 0);
    return isLookupRow ? lookupArray.values[0][i] : lookupArray.values[i][0];
  };

  const getReturn = (i: number): CellValue => {
    if (returnArray.get) return isReturnRow ? returnArray.get(0, i) : returnArray.get(i, 0);
    return isReturnRow ? returnArray.values[0][i] : returnArray.values[i][0];
  };

  if (matchMode === 0 || matchMode === 2) {
    // Percorso rapido findRowExact se ricerca esatta su colonna
    if (matchMode === 0 && !isLookupRow && lookupArray.findRowExact && (lookupVal.kind === 'number' || (lookupVal.kind === 'text' && !/[*?~]/.test(lookupVal.value)) || lookupVal.kind === 'boolean')) {
      const matchRow = lookupArray.findRowExact(0, lookupVal);
      if (matchRow !== -1) {
        return getReturn(matchRow);
      }
      return isRangeArg(notFound) ? errorVal('#VALUE!') : notFound;
    }
    const matcher = compileCriterion(lookupVal);
    for (let i = 0; i < count; i++) {
      if (matcher(getLookup(i))) {
        return getReturn(i);
      }
    }
    return isRangeArg(notFound) ? errorVal('#VALUE!') : notFound;
  } else if (matchMode === -1) {
    // Esatto o successivo minore
    let exactIdx = -1;
    let nextSmallerIdx = -1;
    let maxSmaller: CellValue | null = null;

    for (let i = 0; i < count; i++) {
      const item = getLookup(i);
      const cmp = compareValues(item, lookupVal);
      if (cmp.result === 0) {
        exactIdx = i;
        break;
      }
      if (cmp.result! < 0) {
        if (!maxSmaller || compareValues(item, maxSmaller).result! > 0) {
          maxSmaller = item;
          nextSmallerIdx = i;
        }
      }
    }
    if (exactIdx !== -1) return getReturn(exactIdx);
    if (nextSmallerIdx !== -1) return getReturn(nextSmallerIdx);
    return isRangeArg(notFound) ? errorVal('#VALUE!') : notFound;
  } else if (matchMode === 1) {
    // Esatto o successivo maggiore
    let exactIdx = -1;
    let nextLargerIdx = -1;
    let minLarger: CellValue | null = null;

    for (let i = 0; i < count; i++) {
      const item = getLookup(i);
      const cmp = compareValues(item, lookupVal);
      if (cmp.result === 0) {
        exactIdx = i;
        break;
      }
      if (cmp.result! > 0) {
        if (!minLarger || compareValues(item, minLarger).result! < 0) {
          minLarger = item;
          nextLargerIdx = i;
        }
      }
    }
    if (exactIdx !== -1) return getReturn(exactIdx);
    if (nextLargerIdx !== -1) return getReturn(nextLargerIdx);
    return isRangeArg(notFound) ? errorVal('#VALUE!') : notFound;
  }

  return errorVal('#VALUE!');
}

export function fnCHOOSE(args: EvalArg[]): CellValue {
  if (args.length < 2) return errorVal('#VALUE!');
  const idxArg = args[0];
  if (isRangeArg(idxArg)) return errorVal('#VALUE!');
  const idxNum = coerceToNumber(idxArg);
  if (idxNum.error) return errorVal(idxNum.error);

  const idx = Math.trunc(idxNum.value!);
  if (idx < 1 || idx >= args.length) return errorVal('#VALUE!');

  const chosen = args[idx];
  return isRangeArg(chosen) ? errorVal('#VALUE!') : chosen;
}

export function fnROW(args: EvalArg[], context?: FunctionContext): CellValue {
  if (args.length === 0) {
    if (!context) return errorVal('#VALUE!');
    return numberVal(context.currentRow);
  }
  if (args.length !== 1) return errorVal('#VALUE!');
  const arg = args[0];
  if (isRangeArg(arg)) {
    if (arg.coord) return numberVal(arg.coord.startRow);
    return errorVal('#VALUE!');
  }
  if (context) return numberVal(context.currentRow);
  return errorVal('#VALUE!');
}

export function fnCOLUMN(args: EvalArg[], context?: FunctionContext): CellValue {
  if (args.length === 0) {
    if (!context) return errorVal('#VALUE!');
    return numberVal(context.currentCol);
  }
  if (args.length !== 1) return errorVal('#VALUE!');
  const arg = args[0];
  if (isRangeArg(arg)) {
    if (arg.coord) return numberVal(arg.coord.startCol);
    return errorVal('#VALUE!');
  }
  if (context) return numberVal(context.currentCol);
  return errorVal('#VALUE!');
}

// ---------------------------------------------------------------------------
// FUNZIONI DI RICERCA AVANZATE (M3)
// ---------------------------------------------------------------------------

export function fnCOLUMNS(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const arg = args[0];
  if (isRangeArg(arg)) {
    return numberVal(arg.colCount);
  }
  if (arg.kind === 'error') return arg;
  if (arg.kind === 'array') {
    return numberVal(arg.values.length > 0 ? arg.values[0].length : 0);
  }
  return numberVal(1);
}

export function fnROWS(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const arg = args[0];
  if (isRangeArg(arg)) {
    return numberVal(arg.rowCount);
  }
  if (arg.kind === 'error') return arg;
  if (arg.kind === 'array') {
    return numberVal(arg.values.length);
  }
  return numberVal(1);
}

export function fnAREAS(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const arg = args[0];
  if (!isRangeArg(arg) && arg.kind === 'error') return arg;
  return numberVal(1);
}

export function fnHYPERLINK(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  if (args.length === 2) {
    return args[1] as CellValue;
  }
  return args[0] as CellValue;
}

export function fnADDRESS(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 5) return errorVal('#VALUE!');
  const rC = coerceToNumber(args[0] as CellValue); if (rC.error) return errorVal(rC.error);
  const cC = coerceToNumber(args[1] as CellValue); if (cC.error) return errorVal(cC.error);
  const row = Math.trunc(rC.value!);
  const col = Math.trunc(cC.value!);
  if (row < 1 || col < 1 || col > 16384) return errorVal('#VALUE!');

  let absNum = 1; // 1 = $A$1, 2 = A$1, 3 = $A1, 4 = A1
  if (args.length >= 3) {
    const aC = coerceToNumber(args[2] as CellValue); if (aC.error) return errorVal(aC.error);
    absNum = Math.trunc(aC.value!);
    if (absNum < 1 || absNum > 4) return errorVal('#VALUE!');
  }

  let colLetters = '';
  let tempCol = col;
  while (tempCol > 0) {
    const rem = (tempCol - 1) % 26;
    colLetters = String.fromCharCode(65 + rem) + colLetters;
    tempCol = Math.floor((tempCol - 1) / 26);
  }

  const colPrefix = (absNum === 1 || absNum === 3) ? '$' : '';
  const rowPrefix = (absNum === 1 || absNum === 2) ? '$' : '';
  let addr = `${colPrefix}${colLetters}${rowPrefix}${row}`;

  if (args.length === 5) {
    const shName = (args[4] as any).value?.toString();
    if (shName) {
      addr = `${shName}!${addr}`;
    }
  }

  return { kind: 'text', value: addr };
}

export function fnLOOKUP(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const lookupVal = args[0] as CellValue;
  if (isRangeArg(lookupVal)) return errorVal('#VALUE!');
  const vectorArg = args[1];
  if (!isRangeArg(vectorArg)) return errorVal('#VALUE!');

  // Raccogli valori del vettore di ricerca
  const lookupItems: CellValue[] = [];
  for (let r = 0; r < vectorArg.rowCount; r++) {
    for (let c = 0; c < vectorArg.colCount; c++) {
      lookupItems.push(vectorArg.get(r, c));
    }
  }

  const resultItems: CellValue[] = [];
  if (args.length === 3) {
    const resArg = args[2];
    if (!isRangeArg(resArg)) return errorVal('#VALUE!');
    for (let r = 0; r < resArg.rowCount; r++) {
      for (let c = 0; c < resArg.colCount; c++) {
        resultItems.push(resArg.get(r, c));
      }
    }
  } else {
    resultItems.push(...lookupItems);
  }

  // LOOKUP esegue ricerca binaria / approssimata su vettore ordinato
  let bestIdx = -1;
  for (let i = 0; i < lookupItems.length; i++) {
    const cmp = compareValues(lookupItems[i], lookupVal);
    if ((cmp.result || 0) <= 0) {
      bestIdx = i;
    } else {
      break;
    }
  }

  if (bestIdx === -1) return errorVal('#N/A');
  return bestIdx < resultItems.length ? resultItems[bestIdx] : resultItems[resultItems.length - 1];
}

export function fnXMATCH(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 4) return errorVal('#VALUE!');
  const lookupVal = args[0] as CellValue;
  if (isRangeArg(lookupVal)) return errorVal('#VALUE!');
  const arrayArg = args[1];
  if (!isRangeArg(arrayArg)) return errorVal('#VALUE!');

  if (args.length >= 3) {
    const mC = coerceToNumber(args[2] as CellValue);
    if (mC.error) return errorVal(mC.error);
  }

  const items: CellValue[] = [];
  for (let r = 0; r < arrayArg.rowCount; r++) {
    for (let c = 0; c < arrayArg.colCount; c++) {
      items.push(arrayArg.get(r, c));
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cmp = compareValues(lookupVal, item);
    if (cmp.result === 0) {
      return numberVal(i + 1);
    }
  }

  return errorVal('#N/A');
}

export function fnOFFSET(args: EvalArg[], _context?: FunctionContext): CellValue {
  if (args.length < 3 || args.length > 5) return errorVal('#VALUE!');
  const ref = args[0];
  if (!isRangeArg(ref) || !ref.coord) return errorVal('#VALUE!');

  const rC = coerceToNumber(args[1] as CellValue); if (rC.error) return errorVal(rC.error);
  const cC = coerceToNumber(args[2] as CellValue); if (cC.error) return errorVal(cC.error);
  const rOffset = Math.trunc(rC.value!);
  const cOffset = Math.trunc(cC.value!);

  let height = ref.rowCount;
  let width = ref.colCount;
  if (args.length >= 4) {
    const hC = coerceToNumber(args[3] as CellValue); if (hC.error) return errorVal(hC.error);
    height = Math.trunc(hC.value!);
  }
  if (args.length === 5) {
    const wC = coerceToNumber(args[4] as CellValue); if (wC.error) return errorVal(wC.error);
    width = Math.trunc(wC.value!);
  }

  if (height <= 0 || width <= 0) return errorVal('#VALUE!');

  const newStartRow = ref.coord.startRow + rOffset;
  const newStartCol = ref.coord.startCol + cOffset;
  if (newStartRow < 1 || newStartCol < 1) return errorVal('#REF!');

  // le celle si leggono dal libro: l'area spostata può stare fuori da quella di partenza
  const foglio = ref.coord.sheet ?? _context?.currentSheet ?? '';
  const getCell = (r: number, c: number): CellValue => {
    if (_context?.getCellValue) return _context.getCellValue(foglio, newStartRow + r, newStartCol + c);
    return ref.get(r + rOffset, c + cOffset);
  };

  const matrix: CellValue[][] = [];
  for (let r = 0; r < height; r++) {
    const row: CellValue[] = [];
    for (let c = 0; c < width; c++) {
      row.push(getCell(r, c));
    }
    matrix.push(row);
  }

  if (height === 1 && width === 1) {
    return matrix[0][0];
  }
  return { kind: 'array', values: matrix };
}

export function fnINDIRECT(args: EvalArg[], _context?: FunctionContext): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  if (args[0].kind === 'error') return args[0];
  const refText = (args[0] as any).value?.toString();
  if (!refText) return errorVal('#REF!');

  // Supporto base indirizzo cella A1
  const match = /^([A-Za-z]+)(\d+)$/.exec(refText.trim());
  if (!match) return errorVal('#REF!');
  return { kind: 'text', value: refText.trim() };
}

