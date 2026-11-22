/**
 * Funzioni di Matrice Dinamica (Dynamic Array) per pmb_office Fogli:
 * FILTER, SORT, SORTBY, UNIQUE, SEQUENCE, TRANSPOSE, MMULT,
 * FLATTEN, CHOOSEROWS, CHOOSECOLS, TOCOL, TOROW, EXPAND, TAKE, DROP, WRAPROWS, WRAPCOLS, SPARKLINE
 */

import {
  CellValue,
  numberVal,
  textVal,
  errorVal,
  arrayVal,
  coerceToNumber,
  coerceToBoolean,
  compareValues,
} from '../values';
import { EvalArg, isRangeArg } from './utils';

/**
 * Converte qualsiasi EvalArg (scalare, range, array) in una matrice 2D CellValue[][].
 */
export function argToMatrix(arg: EvalArg): CellValue[][] {
  if (isRangeArg(arg)) {
    const rows: CellValue[][] = [];
    for (let r = 0; r < arg.rowCount; r++) {
      const row: CellValue[] = [];
      for (let c = 0; c < arg.colCount; c++) {
        row.push(arg.get(r, c));
      }
      rows.push(row);
    }
    return rows;
  }
  if (arg.kind === 'array') {
    return arg.values;
  }
  return [[arg]];
}

/**
 * ARRAYFORMULA(array_formula)
 * Abilita l'emissione di intervalli e matrici dinamiche.
 */
export function fnARRAYFORMULA(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const arg = args[0];
  if (arg.kind === 'error') return arg;
  return arrayVal(argToMatrix(arg));
}

/**
 * SEQUENCE(rows, [columns], [start], [step])
 */
export function fnSEQUENCE(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 4) return errorVal('#VALUE!');
  const rCoerce = coerceToNumber(args[0] as CellValue);
  if (rCoerce.error) return errorVal(rCoerce.error);
  const rows = Math.trunc(rCoerce.value!);
  if (rows < 1) return errorVal('#VALUE!');

  let cols = 1;
  if (args.length >= 2) {
    const cCoerce = coerceToNumber(args[1] as CellValue);
    if (cCoerce.error) return errorVal(cCoerce.error);
    cols = Math.trunc(cCoerce.value!);
    if (cols < 1) return errorVal('#VALUE!');
  }

  let start = 1;
  if (args.length >= 3) {
    const sCoerce = coerceToNumber(args[2] as CellValue);
    if (sCoerce.error) return errorVal(sCoerce.error);
    start = sCoerce.value!;
  }

  let step = 1;
  if (args.length === 4) {
    const stCoerce = coerceToNumber(args[3] as CellValue);
    if (stCoerce.error) return errorVal(stCoerce.error);
    step = stCoerce.value!;
  }

  const matrix: CellValue[][] = [];
  let curr = start;
  for (let r = 0; r < rows; r++) {
    const row: CellValue[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(numberVal(curr));
      curr += step;
    }
    matrix.push(row);
  }

  return arrayVal(matrix);
}

/**
 * TRANSPOSE(array)
 */
export function fnTRANSPOSE(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  if (!isRangeArg(args[0]) && args[0].kind === 'error') return args[0];
  const mat = argToMatrix(args[0]);
  const rows = mat.length;
  if (rows === 0) return arrayVal([]);
  const cols = mat[0].length;

  const transposed: CellValue[][] = [];
  for (let c = 0; c < cols; c++) {
    const newRow: CellValue[] = [];
    for (let r = 0; r < rows; r++) {
      newRow.push(mat[r][c]);
    }
    transposed.push(newRow);
  }
  return arrayVal(transposed);
}

/**
 * FILTER(array, include, [if_empty])
 */
export function fnFILTER(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const mat = argToMatrix(args[0]);
  const incMat = argToMatrix(args[1]);

  if (mat.length !== incMat.length) return errorVal('#VALUE!');

  const filtered: CellValue[][] = [];
  for (let r = 0; r < mat.length; r++) {
    const condCell = incMat[r][0];
    const b = coerceToBoolean(condCell);
    if (b.error) return errorVal(b.error);
    if (b.value) {
      filtered.push([...mat[r]]);
    }
  }

  if (filtered.length === 0) {
    if (args.length === 3) {
      return args[2] as CellValue;
    }
    return errorVal('#CALC!' as any);
  }

  return arrayVal(filtered);
}

/**
 * UNIQUE(array, [by_col], [exactly_once])
 */
export function fnUNIQUE(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 3) return errorVal('#VALUE!');
  if (!isRangeArg(args[0]) && args[0].kind === 'error') return args[0];
  let mat = argToMatrix(args[0]);
  let byCol = false;
  let exactlyOnce = false;

  if (args.length >= 2) {
    const b = coerceToBoolean(args[1] as CellValue);
    if (b.error) return errorVal(b.error);
    byCol = b.value!;
  }
  if (args.length === 3) {
    const e = coerceToBoolean(args[2] as CellValue);
    if (e.error) return errorVal(e.error);
    exactlyOnce = e.value!;
  }

  if (byCol) {
    const trans = fnTRANSPOSE([arrayVal(mat)]);
    mat = (trans as any).values;
  }

  // Chiave serializzata per ogni riga
  const keyMap = new Map<string, { count: number; row: CellValue[] }>();
  for (const row of mat) {
    const key = row.map((c) => `${c.kind}:${c.kind === 'number' ? c.value : (c.kind === 'text' ? c.value : (c.kind === 'boolean' ? c.value : ''))}`).join('|');
    const existing = keyMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      keyMap.set(key, { count: 1, row });
    }
  }

  const resultRows: CellValue[][] = [];
  for (const entry of keyMap.values()) {
    if (!exactlyOnce || entry.count === 1) {
      resultRows.push(entry.row);
    }
  }

  if (resultRows.length === 0) {
    return errorVal('#CALC!' as any);
  }

  let finalRes = arrayVal(resultRows);
  if (byCol) {
    finalRes = fnTRANSPOSE([finalRes]) as any;
  }
  return finalRes;
}

/**
 * SORT(array, [sort_index], [sort_order], [by_col])
 */
export function fnSORT(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 4) return errorVal('#VALUE!');
  if (!isRangeArg(args[0]) && args[0].kind === 'error') return args[0];
  let mat = argToMatrix(args[0]);
  if (mat.length === 0) return arrayVal([]);

  let sortIdx = 1;
  let sortOrder = 1; // 1 = crescente, -1 = decrescente
  let byCol = false;

  if (args.length >= 2) {
    const s = coerceToNumber(args[1] as CellValue);
    if (s.error) return errorVal(s.error);
    sortIdx = Math.trunc(s.value!);
  }
  if (args.length >= 3) {
    // l'ordine è VERO/1 per crescente, FALSO/-1 per decrescente
    const a2 = args[2] as CellValue;
    if (a2.kind === 'boolean') sortOrder = a2.value ? 1 : -1;
    else {
      const o = coerceToNumber(a2);
      if (o.error) return errorVal(o.error);
      sortOrder = o.value! > 0 ? 1 : -1;
    }
  }
  if (args.length === 4) {
    const b = coerceToBoolean(args[3] as CellValue);
    if (b.error) return errorVal(b.error);
    byCol = b.value!;
  }

  if (byCol) {
    mat = (fnTRANSPOSE([arrayVal(mat)]) as any).values;
  }

  const colIdx = sortIdx - 1;
  if (colIdx < 0 || colIdx >= mat[0].length) return errorVal('#VALUE!');

  const sorted = [...mat].sort((rowA, rowB) => {
    const cmp = compareValues(rowA[colIdx], rowB[colIdx]);
    const diff = cmp.result || 0;
    return diff * sortOrder;
  });

  let res = arrayVal(sorted);
  if (byCol) {
    res = fnTRANSPOSE([res]) as any;
  }
  return res;
}

/**
 * SORTBY(array, by_array, [sort_order])
 */
export function fnSORTBY(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const mat = argToMatrix(args[0]);
  const byMat = argToMatrix(args[1]);
  if (mat.length !== byMat.length) return errorVal('#VALUE!');

  let sortOrder = 1;
  if (args.length === 3) {
    const a2 = args[2] as CellValue;
    if (a2.kind === 'boolean') sortOrder = a2.value ? 1 : -1;
    else {
      const o = coerceToNumber(a2);
      if (o.error) return errorVal(o.error);
      sortOrder = o.value! > 0 ? 1 : -1;
    }
  }

  const indices = mat.map((_, i) => i);
  indices.sort((iA, iB) => {
    const cmp = compareValues(byMat[iA][0], byMat[iB][0]);
    return (cmp.result || 0) * sortOrder;
  });

  const sorted = indices.map((i) => mat[i]);
  return arrayVal(sorted);
}

/**
 * MMULT(array1, array2)
 */
export function fnMMULT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const m1 = argToMatrix(args[0]);
  const m2 = argToMatrix(args[1]);

  const r1 = m1.length;
  const c1 = r1 > 0 ? m1[0].length : 0;
  const r2 = m2.length;
  const c2 = r2 > 0 ? m2[0].length : 0;

  if (c1 !== r2 || r1 === 0 || c2 === 0) return errorVal('#VALUE!');

  const resMat: CellValue[][] = [];
  for (let r = 0; r < r1; r++) {
    const resRow: CellValue[] = [];
    for (let c = 0; c < c2; c++) {
      let sum = 0;
      for (let k = 0; k < c1; k++) {
        const v1 = coerceToNumber(m1[r][k]);
        if (v1.error) return errorVal(v1.error);
        const v2 = coerceToNumber(m2[k][c]);
        if (v2.error) return errorVal(v2.error);
        sum += v1.value! * v2.value!;
      }
      resRow.push(numberVal(sum));
    }
    resMat.push(resRow);
  }

  return arrayVal(resMat);
}

/**
 * FLATTEN(array)
 */
export function fnFLATTEN(args: EvalArg[]): CellValue {
  if (args.length === 0) return errorVal('#VALUE!');
  if (!isRangeArg(args[0]) && args[0].kind === 'error') return args[0];
  const result: CellValue[][] = [];
  for (const arg of args) {
    const mat = argToMatrix(arg);
    for (const row of mat) {
      for (const cell of row) {
        result.push([cell]);
      }
    }
  }
  return arrayVal(result);
}

/**
 * CHOOSEROWS(array, ...row_nums)
 */
export function fnCHOOSEROWS(args: EvalArg[]): CellValue {
  if (args.length < 2) return errorVal('#VALUE!');
  const mat = argToMatrix(args[0]);
  const outRows: CellValue[][] = [];

  for (let i = 1; i < args.length; i++) {
    const c = coerceToNumber(args[i] as CellValue);
    if (c.error) return errorVal(c.error);
    let rIdx = Math.trunc(c.value!);
    if (rIdx < 0) {
      rIdx = mat.length + rIdx + 1;
    }
    if (rIdx < 1 || rIdx > mat.length) return errorVal('#VALUE!');
    outRows.push([...mat[rIdx - 1]]);
  }

  return arrayVal(outRows);
}

/**
 * CHOOSECOLS(array, ...col_nums)
 */
export function fnCHOOSECOLS(args: EvalArg[]): CellValue {
  if (args.length < 2) return errorVal('#VALUE!');
  const mat = argToMatrix(args[0]);
  if (mat.length === 0) return arrayVal([]);
  const numCols = mat[0].length;
  const colIndices: number[] = [];

  for (let i = 1; i < args.length; i++) {
    const c = coerceToNumber(args[i] as CellValue);
    if (c.error) return errorVal(c.error);
    let cIdx = Math.trunc(c.value!);
    if (cIdx < 0) {
      cIdx = numCols + cIdx + 1;
    }
    if (cIdx < 1 || cIdx > numCols) return errorVal('#VALUE!');
    colIndices.push(cIdx - 1);
  }

  const outRows: CellValue[][] = [];
  for (const row of mat) {
    const outRow: CellValue[] = [];
    for (const c of colIndices) {
      outRow.push(row[c]);
    }
    outRows.push(outRow);
  }

  return arrayVal(outRows);
}

/**
 * TOCOL(array, [ignore], [scan_by_column])
 */
export function fnTOCOL(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 3) return errorVal('#VALUE!');
  if (!isRangeArg(args[0]) && args[0].kind === 'error') return args[0];
  const mat = argToMatrix(args[0]);
  let ignore = 0; // 0: all, 1: blank, 2: errors, 3: blank & errors
  let scanByCol = false;

  if (args.length >= 2) {
    const ig = coerceToNumber(args[1] as CellValue);
    if (ig.error) return errorVal(ig.error);
    ignore = Math.trunc(ig.value!);
  }
  if (args.length === 3) {
    const s = coerceToBoolean(args[2] as CellValue);
    if (s.error) return errorVal(s.error);
    scanByCol = s.value!;
  }

  const outRows: CellValue[][] = [];
  const rows = mat.length;
  const cols = rows > 0 ? mat[0].length : 0;

  const processCell = (cell: CellValue) => {
    if (ignore === 1 && cell.kind === 'empty') return;
    if (ignore === 2 && cell.kind === 'error') return;
    if (ignore === 3 && (cell.kind === 'empty' || cell.kind === 'error')) return;
    outRows.push([cell]);
  };

  if (!scanByCol) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        processCell(mat[r][c]);
      }
    }
  } else {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        processCell(mat[r][c]);
      }
    }
  }

  return arrayVal(outRows);
}

/**
 * TOROW(array, [ignore], [scan_by_column])
 */
export function fnTOROW(args: EvalArg[]): CellValue {
  const colRes = fnTOCOL(args);
  if (colRes.kind === 'error') return colRes;
  return fnTRANSPOSE([colRes]);
}

/**
 * TAKE(array, rows, [columns])
 */
export function fnTAKE(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const mat = argToMatrix(args[0]);
  const rC = coerceToNumber(args[1] as CellValue);
  if (rC.error) return errorVal(rC.error);
  const rows = Math.trunc(rC.value!);

  let cols = mat.length > 0 ? mat[0].length : 0;
  if (args.length === 3) {
    const cC = coerceToNumber(args[2] as CellValue);
    if (cC.error) return errorVal(cC.error);
    cols = Math.trunc(cC.value!);
  }

  let selectedRows: CellValue[][];
  if (rows > 0) {
    selectedRows = mat.slice(0, Math.min(rows, mat.length));
  } else if (rows < 0) {
    selectedRows = mat.slice(Math.max(0, mat.length + rows));
  } else {
    return errorVal('#VALUE!');
  }

  const finalMat: CellValue[][] = [];
  for (const row of selectedRows) {
    if (cols > 0) {
      finalMat.push(row.slice(0, Math.min(cols, row.length)));
    } else if (cols < 0) {
      finalMat.push(row.slice(Math.max(0, row.length + cols)));
    } else {
      return errorVal('#VALUE!');
    }
  }

  return arrayVal(finalMat);
}

/**
 * DROP(array, rows, [columns])
 */
export function fnDROP(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const mat = argToMatrix(args[0]);
  const rC = coerceToNumber(args[1] as CellValue);
  if (rC.error) return errorVal(rC.error);
  const rows = Math.trunc(rC.value!);

  let cols = 0;
  if (args.length === 3) {
    const cC = coerceToNumber(args[2] as CellValue);
    if (cC.error) return errorVal(cC.error);
    cols = Math.trunc(cC.value!);
  }

  let selectedRows: CellValue[][];
  if (rows > 0) {
    selectedRows = mat.slice(rows);
  } else if (rows < 0) {
    selectedRows = mat.slice(0, mat.length + rows);
  } else {
    selectedRows = [...mat];
  }

  if (selectedRows.length === 0) return errorVal('#CALC!' as any);

  const finalMat: CellValue[][] = [];
  for (const row of selectedRows) {
    if (cols > 0) {
      finalMat.push(row.slice(cols));
    } else if (cols < 0) {
      finalMat.push(row.slice(0, row.length + cols));
    } else {
      finalMat.push([...row]);
    }
  }

  if (finalMat.length === 0 || finalMat[0].length === 0) return errorVal('#CALC!' as any);
  return arrayVal(finalMat);
}

/**
 * EXPAND(array, rows, [columns], [pad_with])
 */
export function fnEXPAND(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 4) return errorVal('#VALUE!');
  const mat = argToMatrix(args[0]);
  const rC = coerceToNumber(args[1] as CellValue);
  if (rC.error) return errorVal(rC.error);
  const targetRows = Math.trunc(rC.value!);
  if (targetRows < mat.length) return errorVal('#VALUE!');

  let targetCols = mat.length > 0 ? mat[0].length : 0;
  if (args.length >= 3) {
    const cC = coerceToNumber(args[2] as CellValue);
    if (cC.error) return errorVal(cC.error);
    targetCols = Math.trunc(cC.value!);
    if (targetCols < (mat[0]?.length || 0)) return errorVal('#VALUE!');
  }

  const pad: CellValue = args.length === 4 ? (args[3] as CellValue) : errorVal('#N/A');

  const outMat: CellValue[][] = [];
  for (let r = 0; r < targetRows; r++) {
    const row: CellValue[] = [];
    for (let c = 0; c < targetCols; c++) {
      if (r < mat.length && c < mat[r].length) {
        row.push(mat[r][c]);
      } else {
        row.push(pad);
      }
    }
    outMat.push(row);
  }

  return arrayVal(outMat);
}

/**
 * WRAPROWS(vector, wrap_count, [pad_with])
 */
export function fnWRAPROWS(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const flat = fnFLATTEN([args[0]]);
  const items = (flat as any).values.map((r: CellValue[]) => r[0]);
  const countCoerce = coerceToNumber(args[1] as CellValue);
  if (countCoerce.error) return errorVal(countCoerce.error);
  const wrapCount = Math.trunc(countCoerce.value!);
  if (wrapCount < 1) return errorVal('#VALUE!');

  const pad: CellValue = args.length === 3 ? (args[2] as CellValue) : errorVal('#N/A');
  const outRows: CellValue[][] = [];

  for (let i = 0; i < items.length; i += wrapCount) {
    const row: CellValue[] = [];
    for (let j = 0; j < wrapCount; j++) {
      if (i + j < items.length) {
        row.push(items[i + j]);
      } else {
        row.push(pad);
      }
    }
    outRows.push(row);
  }

  return arrayVal(outRows);
}

/**
 * WRAPCOLS(vector, wrap_count, [pad_with])
 */
export function fnWRAPCOLS(args: EvalArg[]): CellValue {
  const rowRes = fnWRAPROWS(args);
  if (rowRes.kind === 'error') return rowRes;
  return fnTRANSPOSE([rowRes]);
}

/**
 * SPARKLINE(data, [options])
 * Genera stringa descrittiva o SVG vettoriale per minigrafico in cella.
 */
export function fnSPARKLINE(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  if (!isRangeArg(args[0]) && args[0].kind === 'error') return args[0];
  const mat = argToMatrix(args[0]);
  const nums: number[] = [];
  for (const row of mat) {
    for (const cell of row) {
      if (cell.kind === 'number') nums.push(cell.value);
    }
  }
  if (nums.length === 0) return errorVal('#VALUE!');
  // opzioni come in Fogli Google: {"charttype"\"column"} (righe chiave/valore); di serie la linea
  let tipo = 'line';
  if (args.length === 2) {
    for (const riga of argToMatrix(args[1])) {
      const k = riga[0], v = riga[1];
      if (k?.kind === 'text' && k.value.toLowerCase() === 'charttype' && v?.kind === 'text') {
        const scelto = v.value.toLowerCase();
        if (scelto === 'column' || scelto === 'bar') tipo = 'column';
      }
    }
  }
  // Formato compatto per rendering della cella: "SPARKLINE:<tipo>:<valori separati da virgola>" (la griglia lo disegna)
  return textVal(`SPARKLINE:${tipo}:${nums.slice(0, 1000).join(',')}`);
}
