/**
 * Funzioni Matematiche:
 * SUM, PRODUCT, ABS, ROUND, ROUNDUP, ROUNDDOWN, INT, MOD, POWER, SQRT,
 * SIGN, CEILING, FLOOR, PI, SUMIF, SUMPRODUCT
 */

import { CellValue, numberVal, textVal, errorVal, emptyVal, coerceToNumber } from '../values';
import { EvalArg, isRangeArg, RangeArg, extractAggregationNumbers, roundHalfAwayFromZero, roundDecimalMode, compileCriterion } from './utils';

export function fnSUM(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return numberVal(sum);
}

export function fnPRODUCT(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return numberVal(0);
  const prod = numbers.reduce((acc, n) => acc * n, 1);
  return numberVal(prod);
}

export function fnABS(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const arg = args[0];
  if (isRangeArg(arg)) return errorVal('#VALUE!');
  const c = coerceToNumber(arg);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.abs(c.value!));
}

export function fnROUND(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  const c1 = coerceToNumber(args[0]);
  if (c1.error) return errorVal(c1.error);
  let digits = 0;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const c2 = coerceToNumber(args[1]);
    if (c2.error) return errorVal(c2.error);
    digits = Math.trunc(c2.value!);
  }
  return numberVal(roundHalfAwayFromZero(c1.value!, digits));
}

export function fnROUNDUP(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  const c1 = coerceToNumber(args[0]);
  if (c1.error) return errorVal(c1.error);
  let digits = 0;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const c2 = coerceToNumber(args[1]);
    if (c2.error) return errorVal(c2.error);
    digits = Math.trunc(c2.value!);
  }
  return numberVal(roundDecimalMode(c1.value!, digits, 'up'));
}

export function fnROUNDDOWN(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  const c1 = coerceToNumber(args[0]);
  if (c1.error) return errorVal(c1.error);
  let digits = 0;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const c2 = coerceToNumber(args[1]);
    if (c2.error) return errorVal(c2.error);
    digits = Math.trunc(c2.value!);
  }
  return numberVal(roundDecimalMode(c1.value!, digits, 'down'));
}

export function fnINT(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0]);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.floor(c.value!));
}

export function fnMOD(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const c1 = coerceToNumber(args[0]);
  if (c1.error) return errorVal(c1.error);
  const c2 = coerceToNumber(args[1]);
  if (c2.error) return errorVal(c2.error);
  const d = c2.value!;
  if (d === 0) return errorVal('#DIV/0!');
  const n = c1.value!;
  // Formula standard MOD(n, d) = n - d * INT(n / d)
  const res = n - d * Math.floor(n / d);
  return numberVal(res);
}

export function fnPOWER(args: EvalArg[]): CellValue {
  if (args.length !== 2 || isRangeArg(args[0]) || isRangeArg(args[1])) return errorVal('#VALUE!');
  const c1 = coerceToNumber(args[0]);
  if (c1.error) return errorVal(c1.error);
  const c2 = coerceToNumber(args[1]);
  if (c2.error) return errorVal(c2.error);
  const base = c1.value!;
  const exp = c2.value!;
  if (base === 0 && exp === 0) return numberVal(1);
  if (base === 0 && exp < 0) return errorVal('#DIV/0!');
  if (base < 0 && !Number.isInteger(exp)) return errorVal('#NUM!');
  const res = Math.pow(base, exp);
  if (!Number.isFinite(res) || Number.isNaN(res)) return errorVal('#NUM!');
  return numberVal(res);
}

export function fnSQRT(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0]);
  if (c.error) return errorVal(c.error);
  if (c.value! < 0) return errorVal('#NUM!');
  return numberVal(Math.sqrt(c.value!));
}

export function fnSIGN(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0]);
  if (c.error) return errorVal(c.error);
  const v = c.value!;
  if (v > 0) return numberVal(1);
  if (v < 0) return numberVal(-1);
  return numberVal(0);
}

export function fnCEILING(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  const c1 = coerceToNumber(args[0]);
  if (c1.error) return errorVal(c1.error);
  let sig = 1;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const c2 = coerceToNumber(args[1]);
    if (c2.error) return errorVal(c2.error);
    sig = c2.value!;
  }
  const val = c1.value!;
  if (sig === 0) return numberVal(0);
  if (val > 0 && sig < 0) return errorVal('#NUM!');
  const prec = getDecimalPlaces(sig);
  const quotient = roundDecimalMode(val / sig, 10, 'half-away-from-zero');
  const raw = Math.ceil(quotient) * sig;
  return numberVal(roundDecimalMode(raw, prec, 'half-away-from-zero'));
}

export function fnFLOOR(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  const c1 = coerceToNumber(args[0]);
  if (c1.error) return errorVal(c1.error);
  let sig = 1;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const c2 = coerceToNumber(args[1]);
    if (c2.error) return errorVal(c2.error);
    sig = c2.value!;
  }
  const val = c1.value!;
  if (sig === 0) return errorVal('#DIV/0!');
  if (val > 0 && sig < 0) return errorVal('#NUM!');
  const prec = getDecimalPlaces(sig);
  const quotient = roundDecimalMode(val / sig, 10, 'half-away-from-zero');
  const raw = Math.floor(quotient) * sig;
  return numberVal(roundDecimalMode(raw, prec, 'half-away-from-zero'));
}

function getDecimalPlaces(n: number): number {
  const str = n.toString();
  const eIdx = str.indexOf('e-');
  if (eIdx !== -1) {
    return parseInt(str.substring(eIdx + 2), 10);
  }
  const dot = str.indexOf('.');
  return dot === -1 ? 0 : str.length - dot - 1;
}

export function fnPI(args: EvalArg[]): CellValue {
  if (args.length !== 0) return errorVal('#VALUE!');
  return numberVal(Math.PI);
}

export function fnSUMIF(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const rangeArg = args[0];
  const critArg = args[1];
  const sumRangeArg = args.length === 3 ? args[2] : rangeArg;

  if (!isRangeArg(rangeArg) || !isRangeArg(sumRangeArg)) return errorVal('#VALUE!');
  if (isRangeArg(critArg)) return errorVal('#VALUE!');

  const predicate = compileCriterion(critArg);
  let total = 0;

  const rows = rangeArg.rowCount !== undefined ? rangeArg.rowCount : rangeArg.values.length;
  const cols = rangeArg.colCount !== undefined ? rangeArg.colCount : (rows > 0 ? rangeArg.values[0].length : 0);
  const sumRows = sumRangeArg.rowCount !== undefined ? sumRangeArg.rowCount : sumRangeArg.values.length;
  const sumCols = sumRangeArg.colCount !== undefined ? sumRangeArg.colCount : (sumRows > 0 ? sumRangeArg.values[0].length : 0);

  const getSumCell = sumRangeArg.getColValue
    ? (r: number) => sumRangeArg.getColValue!(r, 0)
    : (r: number, c: number): CellValue => sumRangeArg.get ? sumRangeArg.get(r, c) : sumRangeArg.values[r][c];

  if (cols === 1 && sumCols === 1 && rangeArg.getColMap && sumRangeArg.getColMap) {
    const colMapA = rangeArg.getColMap(0);
    const colMapB = sumRangeArg.getColMap(0);
    const baseRowA = rangeArg.baseRow || 1;
    const endRowA = baseRowA + rows - 1;
    const baseRowB = sumRangeArg.baseRow || 1;
    const empty = emptyVal();

    if (!colMapA) {
      if (!predicate.matchesEmpty) return numberVal(0);
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
              if (rOffset < sumRows) {
                const cellB = colMapB ? colMapB.get(baseRowB + rOffset) : undefined;
                const valB = cellB ? cellB.value : empty;
                if (valB.kind === 'error') return valB;
                if (valB.kind === 'number') {
                  total += valB.value;
                }
              }
            }
          }
        }
      }
      return numberVal(total);
    }

    if (colMapA && !predicate.matchesEmpty) {
      for (const [r, cellA] of colMapA) {
        if (r >= baseRowA && r <= endRowA) {
          if (predicate(cellA.value)) {
            const rOffset = r - baseRowA;
            if (rOffset < sumRows) {
              const cellB = colMapB ? colMapB.get(baseRowB + rOffset) : undefined;
              const valB = cellB ? cellB.value : empty;
              if (valB.kind === 'error') return valB;
              if (valB.kind === 'number') {
                total += valB.value;
              }
            }
          }
        }
      }
      return numberVal(total);
    }

    for (let r = 0; r < rows; r++) {
      const cellA = colMapA ? colMapA.get(baseRowA + r) : undefined;
      const valA = cellA ? cellA.value : empty;
      if (predicate(valA)) {
        if (r < sumRows) {
          const cellB = colMapB ? colMapB.get(baseRowB + r) : undefined;
          const valB = cellB ? cellB.value : empty;
          if (valB.kind === 'error') return valB;
          if (valB.kind === 'number') {
            total += valB.value;
          }
        }
      }
    }
    return numberVal(total);
  }

  const getRangeCell = (r: number, c: number): CellValue => rangeArg.get ? rangeArg.get(r, c) : rangeArg.values[r][c];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = getRangeCell(r, c);
      if (predicate(cell)) {
        if (r < sumRows && c < sumCols) {
          const sumCell = getSumCell(r, c);
          if (sumCell.kind === 'error') return errorVal(sumCell.error);
          if (sumCell.kind === 'number') {
            total += sumCell.value;
          }
        }
      }
    }
  }

  return numberVal(total);
}

export function fnSUMPRODUCT(args: EvalArg[]): CellValue {
  if (args.length === 0) return errorVal('#VALUE!');
  const ranges: CellValue[][][] = [];

  let rows = -1;
  let cols = -1;

  for (const arg of args) {
    if (!isRangeArg(arg)) {
      // Se è uno scalare, trattalo come matrice 1x1
      ranges.push([[arg]]);
      if (rows === -1) {
        rows = 1;
        cols = 1;
      } else if (rows !== 1 || cols !== 1) {
        return errorVal('#VALUE!');
      }
    } else {
      const r = arg.values.length;
      const c = r > 0 ? arg.values[0].length : 0;
      if (rows === -1) {
        rows = r;
        cols = c;
      } else if (rows !== r || cols !== c) {
        return errorVal('#VALUE!');
      }
      ranges.push(arg.values);
    }
  }

  let total = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let prod = 1;
      for (const mat of ranges) {
        const cell = mat[r][c];
        if (cell.kind === 'error') return errorVal(cell.error);
        if (cell.kind === 'number') {
          prod *= cell.value;
        } else {
          // Elementi non numerici in SUMPRODUCT valgono 0
          prod = 0;
          break;
        }
      }
      total += prod;
    }
  }

  return numberVal(total);
}

// ---------------------------------------------------------------------------
// FUNZIONI TRIGONOMETRICHE
// ---------------------------------------------------------------------------

export function fnSIN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.sin(c.value!));
}

export function fnCOS(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.cos(c.value!));
}

export function fnTAN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.tan(c.value!));
}

export function fnASIN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  if (c.value! < -1 || c.value! > 1) return errorVal('#NUM!');
  return numberVal(Math.asin(c.value!));
}

export function fnACOS(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  if (c.value! < -1 || c.value! > 1) return errorVal('#NUM!');
  return numberVal(Math.acos(c.value!));
}

export function fnATAN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.atan(c.value!));
}

export function fnATAN2(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const x = coerceToNumber(args[0] as CellValue);
  if (x.error) return errorVal(x.error);
  const y = coerceToNumber(args[1] as CellValue);
  if (y.error) return errorVal(y.error);
  if (x.value === 0 && y.value === 0) return errorVal('#DIV/0!');
  // Nello standard ATAN2(x_num, y_num) calcola atan2(y, x)
  return numberVal(Math.atan2(y.value!, x.value!));
}

export function fnSINH(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.sinh(c.value!));
}

export function fnCOSH(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.cosh(c.value!));
}

export function fnTANH(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.tanh(c.value!));
}

export function fnASINH(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal(Math.asinh(c.value!));
}

export function fnACOSH(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  if (c.value! < 1) return errorVal('#NUM!');
  return numberVal(Math.acosh(c.value!));
}

export function fnATANH(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  if (c.value! <= -1 || c.value! >= 1) return errorVal('#NUM!');
  return numberVal(Math.atanh(c.value!));
}

export function fnRADIANS(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal((c.value! * Math.PI) / 180);
}

export function fnDEGREES(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  return numberVal((c.value! * 180) / Math.PI);
}

// ---------------------------------------------------------------------------
// LOGARITMI ED ESPONENZIALI
// ---------------------------------------------------------------------------

export function fnLN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  if (c.value! <= 0) return errorVal('#NUM!');
  return numberVal(Math.log(c.value!));
}

export function fnLOG(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  if (c.value! <= 0) return errorVal('#NUM!');
  let base = 10;
  if (args.length === 2) {
    const b = coerceToNumber(args[1] as CellValue);
    if (b.error) return errorVal(b.error);
    if (b.value! <= 0 || b.value! === 1) return errorVal('#NUM!');
    base = b.value!;
  }
  return numberVal(Math.log(c.value!) / Math.log(base));
}

export function fnLOG10(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  return fnLOG([args[0], numberVal(10)]);
}

export function fnEXP(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  const res = Math.exp(c.value!);
  if (!Number.isFinite(res)) return errorVal('#NUM!');
  return numberVal(res);
}

export function fnSQRTPI(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  if (c.value! < 0) return errorVal('#NUM!');
  return numberVal(Math.sqrt(c.value! * Math.PI));
}

// ---------------------------------------------------------------------------
// ARROTONDAMENTO E TEORIA DEI NUMERI
// ---------------------------------------------------------------------------

export function fnTRUNC(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  let digits = 0;
  if (args.length === 2) {
    const d = coerceToNumber(args[1] as CellValue);
    if (d.error) return errorVal(d.error);
    digits = Math.trunc(d.value!);
  }
  const factor = Math.pow(10, digits);
  return numberVal(Math.trunc(c.value! * factor) / factor);
}

export function fnEVEN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  const v = c.value!;
  const sign = v < 0 ? -1 : 1;
  let ceil = Math.ceil(Math.abs(v));
  if (ceil % 2 !== 0) ceil++;
  return numberVal(sign * ceil);
}

export function fnODD(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  const v = c.value!;
  if (v === 0) return numberVal(1);
  const sign = v < 0 ? -1 : 1;
  let ceil = Math.ceil(Math.abs(v));
  if (ceil % 2 === 0) ceil++;
  return numberVal(sign * ceil);
}

export function fnMROUND(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n = coerceToNumber(args[0] as CellValue);
  if (n.error) return errorVal(n.error);
  const m = coerceToNumber(args[1] as CellValue);
  if (m.error) return errorVal(m.error);
  if (m.value === 0) return numberVal(0);
  if ((n.value! > 0 && m.value! < 0) || (n.value! < 0 && m.value! > 0)) {
    return errorVal('#NUM!');
  }
  return numberVal(Math.round(n.value! / m.value!) * m.value!);
}

export function fnCEILING_MATH(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 3) return errorVal('#VALUE!');
  const n = coerceToNumber(args[0] as CellValue);
  if (n.error) return errorVal(n.error);
  let sig = n.value! >= 0 ? 1 : -1;
  if (args.length >= 2) {
    const s = coerceToNumber(args[1] as CellValue);
    if (s.error) return errorVal(s.error);
    sig = s.value!;
  }
  if (sig === 0) return numberVal(0);
  sig = Math.abs(sig);

  let mode = 0; // 0 = verso zero se negativo; diverso da 0 = lontano da zero
  if (args.length === 3) {
    const m = coerceToNumber(args[2] as CellValue);
    if (m.error) return errorVal(m.error);
    mode = m.value!;
  }

  const num = n.value!;
  if (num >= 0) {
    return numberVal(Math.ceil(num / sig) * sig);
  } else {
    if (mode === 0) {
      return numberVal(Math.ceil(num / sig) * sig);
    } else {
      return numberVal(Math.floor(num / sig) * sig);
    }
  }
}

export function fnFLOOR_MATH(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 3) return errorVal('#VALUE!');
  const n = coerceToNumber(args[0] as CellValue);
  if (n.error) return errorVal(n.error);
  let sig = n.value! >= 0 ? 1 : -1;
  if (args.length >= 2) {
    const s = coerceToNumber(args[1] as CellValue);
    if (s.error) return errorVal(s.error);
    sig = s.value!;
  }
  if (sig === 0) return numberVal(0);
  sig = Math.abs(sig);

  let mode = 0;
  if (args.length === 3) {
    const m = coerceToNumber(args[2] as CellValue);
    if (m.error) return errorVal(m.error);
    mode = m.value!;
  }

  const num = n.value!;
  if (num >= 0) {
    return numberVal(Math.floor(num / sig) * sig);
  } else {
    if (mode === 0) {
      return numberVal(Math.floor(num / sig) * sig);
    } else {
      return numberVal(Math.ceil(num / sig) * sig);
    }
  }
}

export function fnQUOTIENT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n = coerceToNumber(args[0] as CellValue);
  if (n.error) return errorVal(n.error);
  const d = coerceToNumber(args[1] as CellValue);
  if (d.error) return errorVal(d.error);
  if (d.value === 0) return errorVal('#DIV/0!');
  return numberVal(Math.trunc(n.value! / d.value!));
}

function gcdTwo(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function fnGCD(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#VALUE!');
  for (const n of numbers) {
    if (n < 0) return errorVal('#NUM!');
  }
  let res = Math.trunc(numbers[0]);
  for (let i = 1; i < numbers.length; i++) {
    res = gcdTwo(res, numbers[i]);
  }
  return numberVal(res);
}

export function fnLCM(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  if (numbers.length === 0) return errorVal('#VALUE!');
  for (const n of numbers) {
    if (n < 0) return errorVal('#NUM!');
    if (Math.trunc(n) === 0) return numberVal(0);
  }
  let res = Math.trunc(numbers[0]);
  for (let i = 1; i < numbers.length; i++) {
    const b = Math.trunc(numbers[i]);
    res = Math.abs(res * b) / gcdTwo(res, b);
  }
  return numberVal(res);
}

export function fnFACT(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  const n = Math.trunc(c.value!);
  if (n < 0) return errorVal('#NUM!');
  if (n > 170) return errorVal('#NUM!'); // Overflow IEEE 754
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return numberVal(f);
}

export function fnFACTDOUBLE(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  const n = Math.trunc(c.value!);
  if (n < -1) return errorVal('#NUM!');
  if (n === -1 || n === 0) return numberVal(1);
  let f = 1;
  for (let i = n; i >= 1; i -= 2) f *= i;
  return numberVal(f);
}

export function fnCOMBIN(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const nC = coerceToNumber(args[0] as CellValue);
  if (nC.error) return errorVal(nC.error);
  const kC = coerceToNumber(args[1] as CellValue);
  if (kC.error) return errorVal(kC.error);
  const n = Math.trunc(nC.value!);
  const k = Math.trunc(kC.value!);
  if (n < 0 || k < 0 || n < k) return errorVal('#NUM!');
  if (k === 0 || k === n) return numberVal(1);
  const m = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= m; i++) {
    res = (res * (n - m + i)) / i;
  }
  return numberVal(Math.round(res));
}

export function fnPERMUT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const nC = coerceToNumber(args[0] as CellValue);
  if (nC.error) return errorVal(nC.error);
  const kC = coerceToNumber(args[1] as CellValue);
  if (kC.error) return errorVal(kC.error);
  const n = Math.trunc(nC.value!);
  const k = Math.trunc(kC.value!);
  if (n < 0 || k < 0 || n < k) return errorVal('#NUM!');
  let res = 1;
  for (let i = 0; i < k; i++) {
    res *= (n - i);
  }
  return numberVal(res);
}

export function fnMULTINOMIAL(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  let sum = 0;
  for (const n of numbers) {
    if (n < 0) return errorVal('#NUM!');
    sum += Math.trunc(n);
  }
  const fSum = fnFACT([numberVal(sum)]);
  if (fSum.kind === 'error') return fSum;
  let denom = 1;
  for (const n of numbers) {
    const fPart = fnFACT([numberVal(Math.trunc(n))]);
    if (fPart.kind === 'error') return fPart;
    denom *= (fPart as any).value;
  }
  return numberVal((fSum as any).value / denom);
}

// ---------------------------------------------------------------------------
// SOMMATORIE AVANZATE
// ---------------------------------------------------------------------------

export function fnSUMIFS(args: EvalArg[]): CellValue {
  if (args.length < 3 || args.length % 2 === 0) return errorVal('#VALUE!');
  if (!isRangeArg(args[0])) return errorVal('#VALUE!');
  const sumRange = args[0] as RangeArg;

  const criteriaPairs: { range: RangeArg; test: (val: CellValue) => boolean }[] = [];
  for (let i = 1; i < args.length; i += 2) {
    if (!isRangeArg(args[i])) return errorVal('#VALUE!');
    const critRange = args[i] as RangeArg;
    if (critRange.rowCount !== sumRange.rowCount || critRange.colCount !== sumRange.colCount) {
      return errorVal('#VALUE!');
    }
    const compiled = compileCriterion(args[i + 1] as CellValue);
    criteriaPairs.push({ range: critRange, test: compiled });
  }

  let total = 0;
  for (let r = 0; r < sumRange.rowCount; r++) {
    for (let c = 0; c < sumRange.colCount; c++) {
      let matches = true;
      for (const pair of criteriaPairs) {
        const val = pair.range.get(r, c);
        if (!pair.test(val)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        const cell = sumRange.get(r, c);
        if (cell.kind === 'error') return cell;
        if (cell.kind === 'number') {
          total += cell.value;
        }
      }
    }
  }

  return numberVal(total);
}

export function fnSUMSQ(args: EvalArg[]): CellValue {
  const { numbers, error } = extractAggregationNumbers(args);
  if (error) return errorVal(error);
  const sum = numbers.reduce((acc, n) => acc + n * n, 0);
  return numberVal(sum);
}

export function fnSUMX2MY2(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers: n1, error: e1 } = extractAggregationNumbers([args[0]]);
  if (e1) return errorVal(e1);
  const { numbers: n2, error: e2 } = extractAggregationNumbers([args[1]]);
  if (e2) return errorVal(e2);
  if (n1.length !== n2.length || n1.length === 0) return errorVal('#N/A');
  let sum = 0;
  for (let i = 0; i < n1.length; i++) {
    sum += n1[i] * n1[i] - n2[i] * n2[i];
  }
  return numberVal(sum);
}

export function fnSUMX2PY2(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers: n1, error: e1 } = extractAggregationNumbers([args[0]]);
  if (e1) return errorVal(e1);
  const { numbers: n2, error: e2 } = extractAggregationNumbers([args[1]]);
  if (e2) return errorVal(e2);
  if (n1.length !== n2.length || n1.length === 0) return errorVal('#N/A');
  let sum = 0;
  for (let i = 0; i < n1.length; i++) {
    sum += n1[i] * n1[i] + n2[i] * n2[i];
  }
  return numberVal(sum);
}

export function fnSUMXMY2(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const { numbers: n1, error: e1 } = extractAggregationNumbers([args[0]]);
  if (e1) return errorVal(e1);
  const { numbers: n2, error: e2 } = extractAggregationNumbers([args[1]]);
  if (e2) return errorVal(e2);
  if (n1.length !== n2.length || n1.length === 0) return errorVal('#N/A');
  let sum = 0;
  for (let i = 0; i < n1.length; i++) {
    const diff = n1[i] - n2[i];
    sum += diff * diff;
  }
  return numberVal(sum);
}

export function fnSERIESSUM(args: EvalArg[]): CellValue {
  if (args.length !== 4) return errorVal('#VALUE!');
  const xC = coerceToNumber(args[0] as CellValue);
  if (xC.error) return errorVal(xC.error);
  const nC = coerceToNumber(args[1] as CellValue);
  if (nC.error) return errorVal(nC.error);
  const mC = coerceToNumber(args[2] as CellValue);
  if (mC.error) return errorVal(mC.error);
  const { numbers: coeffs, error } = extractAggregationNumbers([args[3]]);
  if (error) return errorVal(error);
  if (coeffs.length === 0) return errorVal('#VALUE!');

  const x = xC.value!;
  let power = nC.value!;
  const step = mC.value!;
  let sum = 0;
  for (const a of coeffs) {
    sum += a * Math.pow(x, power);
    power += step;
  }
  return numberVal(sum);
}

// ---------------------------------------------------------------------------
// FUNZIONI VOLATILI / PSEUDO-RANDOM
// ---------------------------------------------------------------------------

export function fnRAND(args: EvalArg[]): CellValue {
  if (args.length !== 0) return errorVal('#VALUE!');
  return numberVal(Math.random());
}

export function fnRANDBETWEEN(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const bC = coerceToNumber(args[0] as CellValue);
  if (bC.error) return errorVal(bC.error);
  const tC = coerceToNumber(args[1] as CellValue);
  if (tC.error) return errorVal(tC.error);
  const bottom = Math.ceil(bC.value!);
  const top = Math.floor(tC.value!);
  if (bottom > top) return errorVal('#NUM!');
  const rand = Math.floor(Math.random() * (top - bottom + 1)) + bottom;
  return numberVal(rand);
}

// ---------------------------------------------------------------------------
// CONVERSIONI
// ---------------------------------------------------------------------------

export function fnROMAN(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const c = coerceToNumber(args[0] as CellValue);
  if (c.error) return errorVal(c.error);
  let num = Math.trunc(c.value!);
  if (num < 0 || num > 3999) return errorVal('#VALUE!');
  if (num === 0) return textVal('');

  const lookup: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let res = '';
  for (const [val, roman] of lookup) {
    while (num >= val) {
      res += roman;
      num -= val;
    }
  }
  return textVal(res);
}

export function fnARABIC(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  if (args[0].kind === 'error') return args[0];
  const str = (args[0] as any).value?.toString().trim().toUpperCase();
  if (!str) return numberVal(0);

  const romanMap: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000
  };
  let total = 0;
  let prev = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    const curr = romanMap[str[i]];
    if (curr === undefined) return errorVal('#VALUE!');
    if (curr < prev) {
      total -= curr;
    } else {
      total += curr;
      prev = curr;
    }
  }
  return numberVal(total);
}

export function fnBASE(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const nC = coerceToNumber(args[0] as CellValue);
  if (nC.error) return errorVal(nC.error);
  const rC = coerceToNumber(args[1] as CellValue);
  if (rC.error) return errorVal(rC.error);
  const num = Math.trunc(nC.value!);
  const radix = Math.trunc(rC.value!);
  if (num < 0 || radix < 2 || radix > 36) return errorVal('#NUM!');
  let minLen = 0;
  if (args.length === 3) {
    const lC = coerceToNumber(args[2] as CellValue);
    if (lC.error) return errorVal(lC.error);
    minLen = Math.trunc(lC.value!);
    if (minLen < 0) return errorVal('#NUM!');
  }
  let res = num.toString(radix).toUpperCase();
  if (minLen > res.length) {
    res = res.padStart(minLen, '0');
  }
  return textVal(res);
}

export function fnDECIMAL(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  if (args[0].kind === 'error') return args[0];
  const textStr = (args[0] as any).value?.toString().trim();
  const rC = coerceToNumber(args[1] as CellValue);
  if (rC.error) return errorVal(rC.error);
  const radix = Math.trunc(rC.value!);
  if (radix < 2 || radix > 36) return errorVal('#NUM!');
  const parsed = parseInt(textStr, radix);
  if (Number.isNaN(parsed)) return errorVal('#NUM!');
  return numberVal(parsed);
}

