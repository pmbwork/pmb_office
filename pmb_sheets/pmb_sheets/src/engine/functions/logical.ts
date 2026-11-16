/**
 * Funzioni Logiche:
 * IF, IFS, AND, OR, NOT, IFERROR, IFNA, TRUE, FALSE, SWITCH
 */

import { CellValue, boolVal, errorVal, coerceToBoolean, compareValues } from '../values';
import { EvalArg, isRangeArg } from './utils';

export function fnTRUE(args: EvalArg[]): CellValue {
  if (args.length !== 0) return errorVal('#VALUE!');
  return boolVal(true);
}

export function fnFALSE(args: EvalArg[]): CellValue {
  if (args.length !== 0) return errorVal('#VALUE!');
  return boolVal(false);
}

export function fnNOT(args: EvalArg[]): CellValue {
  if (args.length !== 1 || isRangeArg(args[0])) return errorVal('#VALUE!');
  const c = coerceToBoolean(args[0]);
  if (c.error) return errorVal(c.error);
  return boolVal(!c.value);
}

export function fnAND(args: EvalArg[]): CellValue {
  if (args.length === 0) return errorVal('#VALUE!');
  let hasBool = false;

  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind === 'error') return errorVal(cell.error);
          if (cell.kind === 'boolean' || cell.kind === 'number') {
            const b = coerceToBoolean(cell);
            if (!b.value) return boolVal(false);
            hasBool = true;
          }
        }
      }
    } else {
      if (arg.kind === 'error') return errorVal(arg.error);
      const b = coerceToBoolean(arg);
      if (b.error) return errorVal(b.error);
      if (!b.value) return boolVal(false);
      hasBool = true;
    }
  }

  if (!hasBool) return errorVal('#VALUE!');
  return boolVal(true);
}

export function fnOR(args: EvalArg[]): CellValue {
  if (args.length === 0) return errorVal('#VALUE!');
  let hasBool = false;

  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind === 'error') return errorVal(cell.error);
          if (cell.kind === 'boolean' || cell.kind === 'number') {
            const b = coerceToBoolean(cell);
            if (b.value) return boolVal(true);
            hasBool = true;
          }
        }
      }
    } else {
      if (arg.kind === 'error') return errorVal(arg.error);
      const b = coerceToBoolean(arg);
      if (b.error) return errorVal(b.error);
      if (b.value) return boolVal(true);
      hasBool = true;
    }
  }

  if (!hasBool) return errorVal('#VALUE!');
  return boolVal(false);
}

export function fnIF(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const condArg = args[0];
  if (isRangeArg(condArg)) return errorVal('#VALUE!');
  const cond = coerceToBoolean(condArg);
  if (cond.error) return errorVal(cond.error);

  if (cond.value) {
    const res = args[1];
    return isRangeArg(res) ? errorVal('#VALUE!') : res;
  } else {
    if (args.length === 3) {
      const res = args[2];
      return isRangeArg(res) ? errorVal('#VALUE!') : res;
    }
    return boolVal(false);
  }
}

export function fnIFS(args: EvalArg[]): CellValue {
  if (args.length === 0 || args.length % 2 !== 0) return errorVal('#VALUE!');

  for (let i = 0; i < args.length; i += 2) {
    const condArg = args[i];
    if (isRangeArg(condArg)) return errorVal('#VALUE!');
    const cond = coerceToBoolean(condArg);
    if (cond.error) return errorVal(cond.error);
    if (cond.value) {
      const valArg = args[i + 1];
      return isRangeArg(valArg) ? errorVal('#VALUE!') : valArg;
    }
  }

  return errorVal('#N/A');
}

export function fnIFERROR(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const val = args[0];
  if (isRangeArg(val)) return errorVal('#VALUE!');
  if (val.kind === 'error') {
    const fallback = args[1];
    return isRangeArg(fallback) ? errorVal('#VALUE!') : fallback;
  }
  return val;
}

export function fnIFNA(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const val = args[0];
  if (isRangeArg(val)) return errorVal('#VALUE!');
  if (val.kind === 'error' && val.error === '#N/A') {
    const fallback = args[1];
    return isRangeArg(fallback) ? errorVal('#VALUE!') : fallback;
  }
  return val;
}

export function fnSWITCH(args: EvalArg[]): CellValue {
  if (args.length < 3) return errorVal('#VALUE!');
  const target = args[0];
  if (isRangeArg(target)) return errorVal('#VALUE!');

  let i = 1;
  while (i + 1 < args.length) {
    const caseVal = args[i];
    const resultVal = args[i + 1];
    if (!isRangeArg(caseVal)) {
      const cmp = compareValues(target, caseVal);
      if (cmp.result === 0) {
        return isRangeArg(resultVal) ? errorVal('#VALUE!') : resultVal;
      }
    }
    i += 2;
  }

  // Se c'è un argomento finale dispari, è il default
  if (i < args.length) {
    const defaultVal = args[i];
    return isRangeArg(defaultVal) ? errorVal('#VALUE!') : defaultVal;
  }

  return errorVal('#N/A');
}

export function fnXOR(args: EvalArg[]): CellValue {
  if (args.length === 0) return errorVal('#VALUE!');
  let trueCount = 0;
  let hasBool = false;

  for (const arg of args) {
    if (isRangeArg(arg)) {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind === 'error') return errorVal(cell.error);
          if (cell.kind === 'boolean' || cell.kind === 'number') {
            const b = coerceToBoolean(cell);
            if (b.value) trueCount++;
            hasBool = true;
          }
        }
      }
    } else {
      if (arg.kind === 'error') return errorVal(arg.error);
      const b = coerceToBoolean(arg);
      if (b.error) return errorVal(b.error);
      if (b.value) trueCount++;
      hasBool = true;
    }
  }

  if (!hasBool) return errorVal('#VALUE!');
  // Nello standard XOR è TRUE se il numero di valori TRUE è dispari
  return boolVal(trueCount % 2 !== 0);
}

