/**
 * Funzioni Statistiche:
 * AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTBLANK, MEDIAN, COUNTIF, AVERAGEIF
 */

import { CellValue, numberVal, errorVal, emptyVal, coerceToNumber } from '../values';
import { EvalArg, isRangeArg, RangeArg, extractAggregationNumbers, compileCriterion } from './utils';

export function fnAVERAGE(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#DIV/0!');
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return numberVal(sum / numbers.length);
}

export function fnMIN(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return numberVal(0);
  return numberVal(Math.min(...numbers));
}

export function fnMAX(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return numberVal(0);
  return numberVal(Math.max(...numbers));
}

export function fnCOUNT(args: EvalArg[]): CellValue {
  let count = 0;
  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind === 'error') return errorVal(cell.error);
          if (cell.kind === 'number') count++;
        }
      }
    } else {
      if (arg.kind === 'error') return errorVal(arg.error);
      if (arg.kind === 'number' || arg.kind === 'boolean') {
        count++;
      } else if (arg.kind === 'text') {
        // Testo numerico viene contato, testo non numerico viene ignorato
        const c = coerceToNumber(arg);
        if (c.value !== undefined && !c.error) {
          count++;
        }
      }
    }
  }
  return numberVal(count);
}

export function fnCOUNTA(args: EvalArg[]): CellValue {
  let count = 0;
  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind !== 'empty') {
            count++;
          }
        }
      }
    } else {
      if (arg.kind !== 'empty') {
        count++;
      }
    }
  }
  return numberVal(count);
}

export function fnCOUNTBLANK(args: EvalArg[]): CellValue {
  let count = 0;
  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind === 'empty' || (cell.kind === 'text' && cell.value === '')) {
            count++;
          }
        }
      }
    } else {
      if (arg.kind === 'empty' || (arg.kind === 'text' && arg.value === '')) {
        count++;
      }
    }
  }
  return numberVal(count);
}

export function fnMEDIAN(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#NUM!');

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return numberVal(sorted[mid]);
  } else {
    return numberVal((sorted[mid - 1] + sorted[mid]) / 2);
  }
}

export function fnCOUNTIF(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const rangeArg = args[0];
  const critArg = args[1];

  if (!isRangeArg(rangeArg) || isRangeArg(critArg)) return errorVal('#VALUE!');

  const predicate = compileCriterion(critArg);
  let count = 0;

  const rows = rangeArg.rowCount !== undefined ? rangeArg.rowCount : rangeArg.values.length;
  const cols = rangeArg.colCount !== undefined ? rangeArg.colCount : (rows > 0 ? rangeArg.values[0].length : 0);

  if (cols === 1 && rangeArg.getColMap) {
    const colMap = rangeArg.getColMap(0);
    const baseRow = rangeArg.baseRow || 1;
    const endRow = baseRow + rows - 1;
    const empty = emptyVal();
    if (!colMap) {
      if (predicate.matchesEmpty) count = rows;
      return numberVal(count);
    }

    if (predicate.fastKind === 'number' && !predicate.matchesEmpty) {
      const op = predicate.fastNumOp!;
      const target = predicate.fastNumVal!;
      if (colMap.size === rows && baseRow === 1) {
        for (const cell of colMap.values()) {
          const v = cell.value;
          if (v.kind === 'number') {
            const num = v.value;
            if (op === '>') { if (num > target) count++; }
            else if (op === '>=') { if (num >= target) count++; }
            else if (op === '<') { if (num < target) count++; }
            else if (op === '<=') { if (num <= target) count++; }
            else if (op === '=') { if (num === target) count++; }
            else if (op === '<>') { if (num !== target) count++; }
          }
        }
        return numberVal(count);
      }
      colMap.forEach((cell, r) => {
        if (r >= baseRow && r <= endRow) {
          const v = cell.value;
          if (v.kind === 'number') {
            const num = v.value;
            if (op === '>') { if (num > target) count++; }
            else if (op === '>=') { if (num >= target) count++; }
            else if (op === '<') { if (num < target) count++; }
            else if (op === '<=') { if (num <= target) count++; }
            else if (op === '=') { if (num === target) count++; }
            else if (op === '<>') { if (num !== target) count++; }
          }
        }
      });
      return numberVal(count);
    }

    if (!predicate.matchesEmpty) {
      colMap.forEach((cell, r) => {
        if (r >= baseRow && r <= endRow) {
          if (predicate(cell.value)) count++;
        }
      });
      return numberVal(count);
    }

    for (let r = 0; r < rows; r++) {
      const cell = colMap.get(baseRow + r);
      if (predicate(cell ? cell.value : empty)) {
        count++;
      }
    }
    return numberVal(count);
  }

  const getCell = (r: number, c: number): CellValue => rangeArg.get ? rangeArg.get(r, c) : rangeArg.values[r][c];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (predicate(getCell(r, c))) {
        count++;
      }
    }
  }

  return numberVal(count);
}

export function fnAVERAGEIF(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const rangeArg = args[0];
  const critArg = args[1];
  const avgRangeArg = args.length === 3 ? args[2] : rangeArg;

  if (!isRangeArg(rangeArg) || !isRangeArg(avgRangeArg) || isRangeArg(critArg)) {
    return errorVal('#VALUE!');
  }

  const predicate = compileCriterion(critArg);
  let sum = 0;
  let count = 0;

  const rows = rangeArg.rowCount !== undefined ? rangeArg.rowCount : rangeArg.values.length;
  const cols = rangeArg.colCount !== undefined ? rangeArg.colCount : (rows > 0 ? rangeArg.values[0].length : 0);
  const avgRows = avgRangeArg.rowCount !== undefined ? avgRangeArg.rowCount : avgRangeArg.values.length;
  const avgCols = avgRangeArg.colCount !== undefined ? avgRangeArg.colCount : (avgRows > 0 ? avgRangeArg.values[0].length : 0);

  if (cols === 1 && avgCols === 1 && rangeArg.getColMap && avgRangeArg.getColMap) {
    const colMapA = rangeArg.getColMap(0);
    const colMapB = avgRangeArg.getColMap(0);
    const baseRowA = rangeArg.baseRow || 1;
    const endRowA = baseRowA + rows - 1;
    const baseRowB = avgRangeArg.baseRow || 1;
    const empty = emptyVal();

    if (!colMapA) {
      if (!predicate.matchesEmpty) return errorVal('#DIV/0!');
    }

    if (colMapA && predicate.fastKind === 'number' && !predicate.matchesEmpty) {
      const op = predicate.fastNumOp!;
      const target = predicate.fastNumVal!;
      for (const [r, cellA] of colMapA) {
        if (r >= baseRowA && r <= endRowA) {
          const vA = cellA.value;
          if (vA.kind === 'number') {
            const num = vA.value;
            let matched = false;
            if (op === '>') matched = num > target;
            else if (op === '>=') matched = num >= target;
            else if (op === '<') matched = num < target;
            else if (op === '<=') matched = num <= target;
            else if (op === '=') matched = num === target;
            else if (op === '<>') matched = num !== target;

            if (matched) {
              const rOffset = r - baseRowA;
              if (rOffset < avgRows) {
                const cellB = colMapB ? colMapB.get(baseRowB + rOffset) : undefined;
                const valB = cellB ? cellB.value : empty;
                if (valB.kind === 'error') return valB;
                if (valB.kind === 'number') {
                  sum += valB.value;
                  count++;
                }
              }
            }
          }
        }
      }
      if (count === 0) return errorVal('#DIV/0!');
      return numberVal(sum / count);
    }

    if (colMapA && !predicate.matchesEmpty) {
      for (const [r, cellA] of colMapA) {
        if (r >= baseRowA && r <= endRowA) {
          if (predicate(cellA.value)) {
            const rOffset = r - baseRowA;
            if (rOffset < avgRows) {
              const cellB = colMapB ? colMapB.get(baseRowB + rOffset) : undefined;
              const valB = cellB ? cellB.value : empty;
              if (valB.kind === 'error') return valB;
              if (valB.kind === 'number') {
                sum += valB.value;
                count++;
              }
            }
          }
        }
      }
      if (count === 0) return errorVal('#DIV/0!');
      return numberVal(sum / count);
    }

    for (let r = 0; r < rows; r++) {
      const cellA = colMapA ? colMapA.get(baseRowA + r) : undefined;
      const valA = cellA ? cellA.value : empty;
      if (predicate(valA)) {
        if (r < avgRows) {
          const cellB = colMapB ? colMapB.get(baseRowB + r) : undefined;
          const valB = cellB ? cellB.value : empty;
          if (valB.kind === 'error') return valB;
          if (valB.kind === 'number') {
            sum += valB.value;
            count++;
          }
        }
      }
    }
    if (count === 0) return errorVal('#DIV/0!');
    return numberVal(sum / count);
  }

  const getRangeCell = (r: number, c: number): CellValue => rangeArg.get ? rangeArg.get(r, c) : rangeArg.values[r][c];
  const getAvgCell = (r: number, c: number): CellValue => avgRangeArg.get ? avgRangeArg.get(r, c) : avgRangeArg.values[r][c];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = getRangeCell(r, c);
      if (predicate(cell)) {
        if (r < avgRows && c < avgCols) {
          const avgCell = getAvgCell(r, c);
          if (avgCell.kind === 'error') return errorVal(avgCell.error);
          if (avgCell.kind === 'number') {
            sum += avgCell.value;
            count++;
          }
        }
      }
    }
  }

  if (count === 0) return errorVal('#DIV/0!');
  return numberVal(sum / count);
}

// ---------------------------------------------------------------------------
// VARIANZA E DEVIAZIONE STANDARD
// ---------------------------------------------------------------------------

export function fnVAR(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length < 2) return errorVal('#DIV/0!');
  const mean = numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
  const sumSq = numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0);
  return numberVal(sumSq / (numbers.length - 1));
}

export function fnVAR_S(args: EvalArg[]): CellValue {
  return fnVAR(args);
}

export function fnVARP(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#DIV/0!');
  const mean = numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
  const sumSq = numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0);
  return numberVal(sumSq / numbers.length);
}

export function fnVAR_P(args: EvalArg[]): CellValue {
  return fnVARP(args);
}

export function fnVARA(args: EvalArg[]): CellValue {
  // Converte anche testo (0) e booleani (1/0)
  const nums: number[] = [];
  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind === 'error') return errorVal(cell.error);
          if (cell.kind === 'number') nums.push(cell.value);
          else if (cell.kind === 'boolean') nums.push(cell.value ? 1 : 0);
          else if (cell.kind === 'text') nums.push(0);
        }
      }
    } else {
      if (arg.kind === 'error') return errorVal(arg.error);
      if (arg.kind === 'number') nums.push(arg.value);
      else if (arg.kind === 'boolean') nums.push(arg.value ? 1 : 0);
      else if (arg.kind === 'text') nums.push(0);
    }
  }
  if (nums.length < 2) return errorVal('#DIV/0!');
  const mean = nums.reduce((acc, n) => acc + n, 0) / nums.length;
  const sumSq = nums.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0);
  return numberVal(sumSq / (nums.length - 1));
}

export function fnVARPA(args: EvalArg[]): CellValue {
  const nums: number[] = [];
  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind === 'error') return errorVal(cell.error);
          if (cell.kind === 'number') nums.push(cell.value);
          else if (cell.kind === 'boolean') nums.push(cell.value ? 1 : 0);
          else if (cell.kind === 'text') nums.push(0);
        }
      }
    } else {
      if (arg.kind === 'error') return errorVal(arg.error);
      if (arg.kind === 'number') nums.push(arg.value);
      else if (arg.kind === 'boolean') nums.push(arg.value ? 1 : 0);
      else if (arg.kind === 'text') nums.push(0);
    }
  }
  if (nums.length === 0) return errorVal('#DIV/0!');
  const mean = nums.reduce((acc, n) => acc + n, 0) / nums.length;
  const sumSq = nums.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0);
  return numberVal(sumSq / nums.length);
}

export function fnSTDEV(args: EvalArg[]): CellValue {
  const v = fnVAR(args);
  if (v.kind === 'error') return v;
  return numberVal(Math.sqrt((v as any).value));
}

export function fnSTDEV_S(args: EvalArg[]): CellValue {
  return fnSTDEV(args);
}

export function fnSTDEVP(args: EvalArg[]): CellValue {
  const v = fnVARP(args);
  if (v.kind === 'error') return v;
  return numberVal(Math.sqrt((v as any).value));
}

export function fnSTDEV_P(args: EvalArg[]): CellValue {
  return fnSTDEVP(args);
}

export function fnSTDEVA(args: EvalArg[]): CellValue {
  const v = fnVARA(args);
  if (v.kind === 'error') return v;
  return numberVal(Math.sqrt((v as any).value));
}

export function fnSTDEVPA(args: EvalArg[]): CellValue {
  const v = fnVARPA(args);
  if (v.kind === 'error') return v;
  return numberVal(Math.sqrt((v as any).value));
}

// ---------------------------------------------------------------------------
// ORDINAMENTO E RANGO (LARGE, SMALL, RANK, PERCENTILE, QUARTILE)
// ---------------------------------------------------------------------------

export function fnLARGE(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers, error } = extractAggregationNumbers([args[0]]);
  if (error) return errorVal(error);
  const kC = coerceToNumber(args[1] as CellValue);
  if (kC.error) return errorVal(kC.error);
  const k = Math.trunc(kC.value!);
  if (k < 1 || k > numbers.length) return errorVal('#NUM!');
  numbers.sort((a, b) => b - a);
  return numberVal(numbers[k - 1]);
}

export function fnSMALL(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers, error } = extractAggregationNumbers([args[0]]);
  if (error) return errorVal(error);
  const kC = coerceToNumber(args[1] as CellValue);
  if (kC.error) return errorVal(kC.error);
  const k = Math.trunc(kC.value!);
  if (k < 1 || k > numbers.length) return errorVal('#NUM!');
  numbers.sort((a, b) => a - b);
  return numberVal(numbers[k - 1]);
}

export function fnRANK(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const numC = coerceToNumber(args[0] as CellValue);
  if (numC.error) return errorVal(numC.error);
  const target = numC.value!;
  const { numbers, error } = extractAggregationNumbers([args[1]]);
  if (error) return errorVal(error);

  let order = 0; // 0 = decrescente, diverso da 0 = crescente
  if (args.length === 3) {
    const oC = coerceToNumber(args[2] as CellValue);
    if (oC.error) return errorVal(oC.error);
    order = oC.value!;
  }

  if (order === 0) {
    numbers.sort((a, b) => b - a);
  } else {
    numbers.sort((a, b) => a - b);
  }

  const idx = numbers.indexOf(target);
  if (idx === -1) return errorVal('#N/A');
  return numberVal(idx + 1);
}

export function fnRANK_EQ(args: EvalArg[]): CellValue {
  return fnRANK(args);
}

export function fnRANK_AVG(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const numC = coerceToNumber(args[0] as CellValue);
  if (numC.error) return errorVal(numC.error);
  const target = numC.value!;
  const { numbers, error } = extractAggregationNumbers([args[1]]);
  if (error) return errorVal(error);

  let order = 0;
  if (args.length === 3) {
    const oC = coerceToNumber(args[2] as CellValue);
    if (oC.error) return errorVal(oC.error);
    order = oC.value!;
  }

  if (order === 0) {
    numbers.sort((a, b) => b - a);
  } else {
    numbers.sort((a, b) => a - b);
  }

  let count = 0;
  let sumRanks = 0;
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] === target) {
      count++;
      sumRanks += (i + 1);
    }
  }
  if (count === 0) return errorVal('#N/A');
  return numberVal(sumRanks / count);
}

export function fnPERCENTILE(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers, error } = extractAggregationNumbers([args[0]]);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#NUM!');
  const kC = coerceToNumber(args[1] as CellValue);
  if (kC.error) return errorVal(kC.error);
  const k = kC.value!;
  if (k < 0 || k > 1) return errorVal('#NUM!');

  numbers.sort((a, b) => a - b);
  const idx = k * (numbers.length - 1);
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  const frac = idx - low;
  const res = numbers[low] + frac * (numbers[high] - numbers[low]);
  return numberVal(res);
}

export function fnPERCENTILE_INC(args: EvalArg[]): CellValue {
  return fnPERCENTILE(args);
}

export function fnPERCENTILE_EXC(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers, error } = extractAggregationNumbers([args[0]]);
  if (error) return errorVal(error);
  const n = numbers.length;
  if (n === 0) return errorVal('#NUM!');
  const kC = coerceToNumber(args[1] as CellValue);
  if (kC.error) return errorVal(kC.error);
  const k = kC.value!;
  if (k <= 0 || k >= 1 || k < 1 / (n + 1) || k > n / (n + 1)) return errorVal('#NUM!');

  numbers.sort((a, b) => a - b);
  const idx = k * (n + 1) - 1;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  const frac = idx - low;
  return numberVal(numbers[low] + frac * (numbers[high] - numbers[low]));
}

export function fnQUARTILE(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const qC = coerceToNumber(args[1] as CellValue);
  if (qC.error) return errorVal(qC.error);
  const q = Math.trunc(qC.value!);
  if (q < 0 || q > 4) return errorVal('#NUM!');
  return fnPERCENTILE([args[0], numberVal(q * 0.25)]);
}

export function fnQUARTILE_INC(args: EvalArg[]): CellValue {
  return fnQUARTILE(args);
}

export function fnQUARTILE_EXC(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const qC = coerceToNumber(args[1] as CellValue);
  if (qC.error) return errorVal(qC.error);
  const q = Math.trunc(qC.value!);
  if (q < 1 || q > 3) return errorVal('#NUM!');
  return fnPERCENTILE_EXC([args[0], numberVal(q * 0.25)]);
}

export function fnPERCENTRANK(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const { numbers, error } = extractAggregationNumbers([args[0]]);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#NUM!');
  const xC = coerceToNumber(args[1] as CellValue);
  if (xC.error) return errorVal(xC.error);
  const x = xC.value!;

  numbers.sort((a, b) => a - b);
  if (x < numbers[0] || x > numbers[numbers.length - 1]) return errorVal('#N/A');

  let sig = 3;
  if (args.length === 3) {
    const sC = coerceToNumber(args[2] as CellValue);
    if (sC.error) return errorVal(sC.error);
    sig = Math.max(1, Math.trunc(sC.value!));
  }

  // Interpola percentuale
  let smaller = 0;
  let exact = 0;
  for (const n of numbers) {
    if (n < x) smaller++;
    else if (n === x) exact++;
  }

  const rank = (smaller + (exact > 0 ? exact - 1 : 0)) / (numbers.length - 1);
  const factor = Math.pow(10, sig);
  return numberVal(Math.trunc(rank * factor) / factor);
}

export function fnPERCENTRANK_INC(args: EvalArg[]): CellValue {
  return fnPERCENTRANK(args);
}

// ---------------------------------------------------------------------------
// CORRELAZIONE E COVARIANZA
// ---------------------------------------------------------------------------

export function fnCORREL(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers: n1, error: e1 } = extractAggregationNumbers([args[0]]);
  if (e1) return errorVal(e1);
  const { numbers: n2, error: e2 } = extractAggregationNumbers([args[1]]);
  if (e2) return errorVal(e2);
  if (n1.length !== n2.length || n1.length === 0) return errorVal('#N/A');

  const mean1 = n1.reduce((acc, n) => acc + n, 0) / n1.length;
  const mean2 = n2.reduce((acc, n) => acc + n, 0) / n2.length;

  let num = 0;
  let den1 = 0;
  let den2 = 0;
  for (let i = 0; i < n1.length; i++) {
    const d1 = n1[i] - mean1;
    const d2 = n2[i] - mean2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }
  const den = Math.sqrt(den1 * den2);
  if (den === 0) return errorVal('#DIV/0!');
  return numberVal(num / den);
}

export function fnPEARSON(args: EvalArg[]): CellValue {
  return fnCORREL(args);
}

export function fnCOVARIANCE_P(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers: n1, error: e1 } = extractAggregationNumbers([args[0]]);
  if (e1) return errorVal(e1);
  const { numbers: n2, error: e2 } = extractAggregationNumbers([args[1]]);
  if (e2) return errorVal(e2);
  if (n1.length !== n2.length || n1.length === 0) return errorVal('#N/A');

  const mean1 = n1.reduce((acc, n) => acc + n, 0) / n1.length;
  const mean2 = n2.reduce((acc, n) => acc + n, 0) / n2.length;

  let sum = 0;
  for (let i = 0; i < n1.length; i++) {
    sum += (n1[i] - mean1) * (n2[i] - mean2);
  }
  return numberVal(sum / n1.length);
}

export function fnCOVARIANCE_S(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers: n1, error: e1 } = extractAggregationNumbers([args[0]]);
  if (e1) return errorVal(e1);
  const { numbers: n2, error: e2 } = extractAggregationNumbers([args[1]]);
  if (e2) return errorVal(e2);
  if (n1.length !== n2.length || n1.length < 2) return errorVal('#DIV/0!');

  const mean1 = n1.reduce((acc, n) => acc + n, 0) / n1.length;
  const mean2 = n2.reduce((acc, n) => acc + n, 0) / n2.length;

  let sum = 0;
  for (let i = 0; i < n1.length; i++) {
    sum += (n1[i] - mean1) * (n2[i] - mean2);
  }
  return numberVal(sum / (n1.length - 1));
}

// ---------------------------------------------------------------------------
// MEDIE E CONTEGGI CONDIZIONATI MULTIPLI (COUNTIFS, AVERAGEIFS, MODA)
// ---------------------------------------------------------------------------

export function fnCOUNTIFS(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length % 2 !== 0) return errorVal('#VALUE!');
  const pairs: { range: RangeArg; test: (v: CellValue) => boolean }[] = [];

  let rows = -1;
  let cols = -1;

  for (let i = 0; i < args.length; i += 2) {
    if (!isRangeArg(args[i])) return errorVal('#VALUE!');
    const r = args[i] as RangeArg;
    if (rows === -1) {
      rows = r.rowCount;
      cols = r.colCount;
    } else if (r.rowCount !== rows || r.colCount !== cols) {
      return errorVal('#VALUE!');
    }
    const compiled = compileCriterion(args[i + 1] as CellValue);
    pairs.push({ range: r, test: compiled });
  }

  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let match = true;
      for (const pair of pairs) {
        if (!pair.test(pair.range.get(r, c))) {
          match = false;
          break;
        }
      }
      if (match) count++;
    }
  }

  return numberVal(count);
}

export function fnAVERAGEIFS(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length % 2 === 0) return errorVal('#VALUE!');
  if (!isRangeArg(args[0])) return errorVal('#VALUE!');
  const avgRange = args[0] as RangeArg;

  const pairs: { range: RangeArg; test: (v: CellValue) => boolean }[] = [];
  for (let i = 1; i < args.length; i += 2) {
    if (!isRangeArg(args[i])) return errorVal('#VALUE!');
    const r = args[i] as RangeArg;
    if (r.rowCount !== avgRange.rowCount || r.colCount !== avgRange.colCount) {
      return errorVal('#VALUE!');
    }
    const compiled = compileCriterion(args[i + 1] as CellValue);
    pairs.push({ range: r, test: compiled });
  }

  let sum = 0;
  let count = 0;
  for (let r = 0; r < avgRange.rowCount; r++) {
    for (let c = 0; c < avgRange.colCount; c++) {
      let match = true;
      for (const pair of pairs) {
        if (!pair.test(pair.range.get(r, c))) {
          match = false;
          break;
        }
      }
      if (match) {
        const cell = avgRange.get(r, c);
        if (cell.kind === 'error') return cell;
        if (cell.kind === 'number') {
          sum += cell.value;
          count++;
        }
      }
    }
  }

  if (count === 0) return errorVal('#DIV/0!');
  return numberVal(sum / count);
}

export function fnMODE(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#N/A');

  const freq = new Map<number, number>();
  for (const n of numbers) {
    freq.set(n, (freq.get(n) || 0) + 1);
  }

  let maxFreq = 1;
  let modeVal: number | undefined;
  for (const [val, count] of freq.entries()) {
    if (count > maxFreq) {
      maxFreq = count;
      modeVal = val;
    }
  }

  if (maxFreq === 1 || modeVal === undefined) return errorVal('#N/A');
  return numberVal(modeVal);
}

export function fnMODE_SNGL(args: EvalArg[]): CellValue {
  return fnMODE(args);
}

export function fnAVEDEV(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#NUM!');
  const mean = numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
  const sumDiff = numbers.reduce((acc, n) => acc + Math.abs(n - mean), 0);
  return numberVal(sumDiff / numbers.length);
}

export function fnGEOMEAN(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#NUM!');
  let sumLog = 0;
  for (const n of numbers) {
    if (n <= 0) return errorVal('#NUM!');
    sumLog += Math.log(n);
  }
  return numberVal(Math.exp(sumLog / numbers.length));
}

export function fnHARMEAN(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#NUM!');
  let sumRecip = 0;
  for (const n of numbers) {
    if (n <= 0) return errorVal('#NUM!');
    sumRecip += 1 / n;
  }
  return numberVal(numbers.length / sumRecip);
}

export function fnTRIMMEAN(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers, error } = extractAggregationNumbers([args[0]]);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#NUM!');
  const pC = coerceToNumber(args[1] as CellValue);
  if (pC.error) return errorVal(pC.error);
  const p = pC.value!;
  if (p < 0 || p >= 1) return errorVal('#NUM!');

  numbers.sort((a, b) => a - b);
  const trimCount = Math.floor((numbers.length * p) / 2);
  const trimmed = numbers.slice(trimCount, numbers.length - trimCount);
  if (trimmed.length === 0) return errorVal('#NUM!');
  return numberVal(trimmed.reduce((acc, n) => acc + n, 0) / trimmed.length);
}

export function fnFREQUENCY(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers: data, error: e1 } = extractAggregationNumbers([args[0]]);
  if (e1) return errorVal(e1);
  const { numbers: bins, error: e2 } = extractAggregationNumbers([args[1]]);
  if (e2) return errorVal(e2);

  bins.sort((a, b) => a - b);
  const counts = new Array(bins.length + 1).fill(0);

  for (const val of data) {
    let placed = false;
    for (let i = 0; i < bins.length; i++) {
      if (val <= bins[i]) {
        counts[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) {
      counts[bins.length]++;
    }
  }

  // Ritorna matrice colonna di frequenze
  const resMat: CellValue[][] = counts.map((c) => [numberVal(c)]);
  return { kind: 'array', values: resMat };
}

export function fnSKEW(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  const n = numbers.length;
  if (n < 3) return errorVal('#DIV/0!');
  const mean = numbers.reduce((acc, x) => acc + x, 0) / n;
  const s = Math.sqrt(numbers.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / (n - 1));
  if (s === 0) return errorVal('#DIV/0!');
  const m3 = numbers.reduce((acc, x) => acc + Math.pow((x - mean) / s, 3), 0);
  return numberVal((n / ((n - 1) * (n - 2))) * m3);
}

export function fnKURT(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  const n = numbers.length;
  if (n < 4) return errorVal('#DIV/0!');
  const mean = numbers.reduce((acc, x) => acc + x, 0) / n;
  const s = Math.sqrt(numbers.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / (n - 1));
  if (s === 0) return errorVal('#DIV/0!');
  const m4 = numbers.reduce((acc, x) => acc + Math.pow((x - mean) / s, 4), 0);
  const term1 = (n * (n + 1) * m4) / ((n - 1) * (n - 2) * (n - 3));
  const term2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  return numberVal(term1 - term2);
}

// [T001-1] Regressione lineare semplice: SLOPE, INTERCEPT, FORECAST, RSQ
function coppieXY(knownY: EvalArg, knownX: EvalArg): { ys: number[]; xs: number[] } | CellValue {
  const a = extractAggregationNumbers([knownY]);
  if (a.error) return errorVal(a.error);
  const b = extractAggregationNumbers([knownX]);
  if (b.error) return errorVal(b.error);
  if (a.numbers.length !== b.numbers.length || a.numbers.length === 0) return errorVal('#N/A');
  return { ys: a.numbers, xs: b.numbers };
}

function sommeRegressione(ys: number[], xs: number[]): { mx: number; my: number; sxx: number; sxy: number; syy: number } {
  const n = xs.length;
  const mx = xs.reduce((acc, v) => acc + v, 0) / n;
  const my = ys.reduce((acc, v) => acc + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  return { mx, my, sxx, sxy, syy };
}

export function fnSLOPE(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const p = coppieXY(args[0], args[1]);
  if ('kind' in p) return p;
  const s = sommeRegressione(p.ys, p.xs);
  if (s.sxx === 0) return errorVal('#DIV/0!');
  return numberVal(s.sxy / s.sxx);
}

export function fnINTERCEPT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const p = coppieXY(args[0], args[1]);
  if ('kind' in p) return p;
  const s = sommeRegressione(p.ys, p.xs);
  if (s.sxx === 0) return errorVal('#DIV/0!');
  return numberVal(s.my - (s.sxy / s.sxx) * s.mx);
}

export function fnFORECAST(args: EvalArg[]): CellValue {
  if (args.length !== 3) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  const x = coerceToNumber(args[0]);
  if (x.error || x.value === undefined) return errorVal(x.error ?? '#VALUE!');
  const p = coppieXY(args[1], args[2]);
  if ('kind' in p) return p;
  const s = sommeRegressione(p.ys, p.xs);
  if (s.sxx === 0) return errorVal('#DIV/0!');
  const pendenza = s.sxy / s.sxx;
  return numberVal(s.my - pendenza * s.mx + pendenza * x.value);
}

export function fnRSQ(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const p = coppieXY(args[0], args[1]);
  if ('kind' in p) return p;
  const s = sommeRegressione(p.ys, p.xs);
  if (s.sxx === 0 || s.syy === 0) return errorVal('#DIV/0!');
  return numberVal((s.sxy * s.sxy) / (s.sxx * s.syy));
}

// [T002-1] MAXIFS e MINIFS: massimo/minimo dei valori che rispettano tutti i criteri
function estremoSe(args: EvalArg[], cerca: 'max' | 'min'): CellValue {
  if (args.length < 3 || args.length % 2 === 0) return errorVal('#VALUE!');
  if (!isRangeArg(args[0])) return errorVal('#VALUE!');
  const base = args[0] as RangeArg;

  const coppie: { range: RangeArg; test: (v: CellValue) => boolean }[] = [];
  for (let i = 1; i < args.length; i += 2) {
    if (!isRangeArg(args[i])) return errorVal('#VALUE!');
    const r = args[i] as RangeArg;
    if (r.rowCount !== base.rowCount || r.colCount !== base.colCount) return errorVal('#VALUE!');
    coppie.push({ range: r, test: compileCriterion(args[i + 1] as CellValue) });
  }

  let trovato = false;
  let estremo = 0;
  for (let r = 0; r < base.rowCount; r++) {
    for (let c = 0; c < base.colCount; c++) {
      let tutti = true;
      for (const coppia of coppie) {
        if (!coppia.test(coppia.range.get(r, c))) {
          tutti = false;
          break;
        }
      }
      if (!tutti) continue;
      const cella = base.get(r, c);
      if (cella.kind === 'error') return cella;
      if (cella.kind !== 'number') continue;
      if (!trovato || (cerca === 'max' ? cella.value > estremo : cella.value < estremo)) estremo = cella.value;
      trovato = true;
    }
  }
  return numberVal(trovato ? estremo : 0);
}

export function fnMAXIFS(args: EvalArg[]): CellValue {
  return estremoSe(args, 'max');
}

export function fnMINIFS(args: EvalArg[]): CellValue {
  return estremoSe(args, 'min');
}
