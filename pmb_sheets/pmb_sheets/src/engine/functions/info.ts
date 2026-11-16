/**
 * Funzioni Informative:
 * ISBLANK, ISNUMBER, ISTEXT, ISERROR, ISERR, ISNA, ISLOGICAL
 */

import { CellValue, boolVal, errorVal } from '../values';
import { EvalArg, isRangeArg } from './utils';

function extractSingle(arg: EvalArg): CellValue {
  if (isRangeArg(arg)) {
    if (arg.values.length === 1 && arg.values[0].length === 1) {
      return arg.values[0][0];
    }
    return errorVal('#VALUE!');
  }
  return arg;
}

export function fnISBLANK(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  return boolVal(val.kind === 'empty');
}

export function fnISNUMBER(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  return boolVal(val.kind === 'number');
}

export function fnISTEXT(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  return boolVal(val.kind === 'text');
}

export function fnISERROR(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  return boolVal(val.kind === 'error');
}

export function fnISERR(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  return boolVal(val.kind === 'error' && val.error !== '#N/A');
}

export function fnISNA(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  return boolVal(val.kind === 'error' && val.error === '#N/A');
}

export function fnISLOGICAL(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  return boolVal(val.kind === 'boolean');
}

export function fnISNONTEXT(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  return boolVal(val.kind !== 'text');
}

export function fnISODD(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  if (val.kind === 'error') return val;
  const num = val.kind === 'number' ? Math.trunc(val.value) : (val.kind === 'boolean' ? (val.value ? 1 : 0) : NaN);
  if (Number.isNaN(num)) return errorVal('#VALUE!');
  return boolVal(Math.abs(num) % 2 !== 0);
}

export function fnISEVEN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  if (val.kind === 'error') return val;
  const num = val.kind === 'number' ? Math.trunc(val.value) : (val.kind === 'boolean' ? (val.value ? 1 : 0) : NaN);
  if (Number.isNaN(num)) return errorVal('#VALUE!');
  return boolVal(Math.abs(num) % 2 === 0);
}

export function fnTYPE(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const arg = args[0];
  if (isRangeArg(arg) || arg.kind === 'array') return { kind: 'number', value: 64 };
  if (arg.kind === 'number') return { kind: 'number', value: 1 };
  if (arg.kind === 'text') return { kind: 'number', value: 2 };
  if (arg.kind === 'boolean') return { kind: 'number', value: 4 };
  if (arg.kind === 'error') return { kind: 'number', value: 16 };
  return { kind: 'number', value: 1 }; // vuoto come 0
}

export function fnERROR_TYPE(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  if (val.kind !== 'error') return errorVal('#N/A');
  switch (val.error) {
    case '#DIV/0!': return { kind: 'number', value: 2 };
    case '#VALUE!': return { kind: 'number', value: 3 };
    case '#REF!': return { kind: 'number', value: 4 };
    case '#NAME?': return { kind: 'number', value: 5 };
    case '#NUM!': return { kind: 'number', value: 6 };
    case '#N/A': return { kind: 'number', value: 7 };
    default: return { kind: 'number', value: 8 };
  }
}

export function fnN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const val = extractSingle(args[0]);
  if (val.kind === 'error') return val;
  if (val.kind === 'number') return val;
  if (val.kind === 'boolean') return { kind: 'number', value: val.value ? 1 : 0 };
  return { kind: 'number', value: 0 };
}

export function fnNA(args: EvalArg[]): CellValue {
  if (args.length !== 0) return errorVal('#VALUE!');
  return errorVal('#N/A');
}

export function fnSHEET(_args: EvalArg[]): CellValue {
  return { kind: 'number', value: 1 };
}

export function fnSHEETS(_args: EvalArg[]): CellValue {
  return { kind: 'number', value: 1 };
}

