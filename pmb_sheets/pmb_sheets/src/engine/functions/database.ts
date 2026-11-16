/**
 * Funzioni Database per pmb_office Fogli:
 * DSUM, DCOUNT, DCOUNTA, DAVERAGE, DMIN, DMAX, DPRODUCT, DVAR, DVARP, DSTDEV, DSTDEVP, DGET
 *
 * Parametri:
 * - database: RangeArg con riga di intestazione e righe di dati.
 * - field: string (nome colonna) oppure number (indice 1-based di colonna).
 * - criteria: RangeArg con riga intestazione campi e righe condizioni (OR su righe diverse, AND sulla stessa riga).
 */

import { CellValue, numberVal, errorVal, coerceToText } from '../values';
import { EvalArg, isRangeArg, RangeArg, compileCriterion } from './utils';

interface ExtractedDb {
  headers: string[];
  fieldIndex: number;
  matchingRows: number[][]; // valori numerici della colonna campo per le righe che soddisfano i criteri
  matchingCells: CellValue[]; // tutti i CellValue della colonna campo per DCOUNTA / DGET
  error?: string;
}

function processDbArgs(args: EvalArg[]): ExtractedDb {
  if (args.length !== 3) return { headers: [], fieldIndex: -1, matchingRows: [], matchingCells: [], error: '#VALUE!' };
  if (!isRangeArg(args[0]) || !isRangeArg(args[2])) {
    return { headers: [], fieldIndex: -1, matchingRows: [], matchingCells: [], error: '#VALUE!' };
  }

  const db = args[0] as RangeArg;
  const fieldArg = args[1];
  const crit = args[2] as RangeArg;

  if (db.rowCount < 2 || db.colCount < 1 || crit.rowCount < 2 || crit.colCount < 1) {
    return { headers: [], fieldIndex: -1, matchingRows: [], matchingCells: [], error: '#VALUE!' };
  }

  // 1. Leggi intestazioni database (riga 0)
  const dbHeaders: string[] = [];
  for (let c = 0; c < db.colCount; c++) {
    const cell = db.get(0, c);
    const txt = coerceToText(cell);
    dbHeaders.push(txt.value ? txt.value.trim().toLowerCase() : '');
  }

  // 2. Trova fieldIndex (0-based)
  let fieldIdx = -1;
  if (!isRangeArg(fieldArg)) {
    if (fieldArg.kind === 'number') {
      fieldIdx = Math.trunc(fieldArg.value) - 1;
    } else if (fieldArg.kind === 'text') {
      const targetHeader = fieldArg.value.trim().toLowerCase();
      fieldIdx = dbHeaders.indexOf(targetHeader);
    }
  }
  if (fieldIdx < 0 || fieldIdx >= db.colCount) {
    return { headers: dbHeaders, fieldIndex: -1, matchingRows: [], matchingCells: [], error: '#VALUE!' };
  }

  // 3. Parsa i criteri:
  // riga 0 di crit = nomi colonna; righe 1..crit.rowCount - 1 = pattern di test
  interface CritCondition {
    colIndex: number;
    test: (val: CellValue) => boolean;
  }
  const orGroups: CritCondition[][] = [];

  for (let r = 1; r < crit.rowCount; r++) {
    const andGroup: CritCondition[] = [];
    for (let c = 0; c < crit.colCount; c++) {
      const headerCell = crit.get(0, c);
      const hTxt = coerceToText(headerCell);
      const hName = hTxt.value ? hTxt.value.trim().toLowerCase() : '';
      if (!hName) continue;
      const targetCol = dbHeaders.indexOf(hName);
      if (targetCol === -1) continue;

      const critCell = crit.get(r, c);
      if (critCell.kind === 'empty') continue;
      const compiled = compileCriterion(critCell);
      andGroup.push({ colIndex: targetCol, test: compiled });
    }
    if (andGroup.length > 0) {
      orGroups.push(andGroup);
    }
  }

  // 4. Filtra righe database (da 1 a db.rowCount - 1)
  const matchingCells: CellValue[] = [];
  const matchingNumbers: number[] = [];

  for (let r = 1; r < db.rowCount; r++) {
    // Verifica criteri: se orGroups è vuoto, corrisponde tutto
    let matches = orGroups.length === 0;
    for (const group of orGroups) {
      let groupMatches = true;
      for (const cond of group) {
        const val = db.get(r, cond.colIndex);
        if (!cond.test(val)) {
          groupMatches = false;
          break;
        }
      }
      if (groupMatches) {
        matches = true;
        break;
      }
    }

    if (matches) {
      const cell = db.get(r, fieldIdx);
      matchingCells.push(cell);
      if (cell.kind === 'number') {
        matchingNumbers.push(cell.value);
      }
    }
  }

  return {
    headers: dbHeaders,
    fieldIndex: fieldIdx,
    matchingRows: [matchingNumbers],
    matchingCells,
  };
}

export function fnDSUM(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  const nums = p.matchingRows[0] || [];
  const sum = nums.reduce((acc, n) => acc + n, 0);
  return numberVal(sum);
}

export function fnDCOUNT(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  return numberVal((p.matchingRows[0] || []).length);
}

export function fnDCOUNTA(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  const count = p.matchingCells.filter((c) => c.kind !== 'empty').length;
  return numberVal(count);
}

export function fnDAVERAGE(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  const nums = p.matchingRows[0] || [];
  if (nums.length === 0) return errorVal('#DIV/0!');
  const sum = nums.reduce((acc, n) => acc + n, 0);
  return numberVal(sum / nums.length);
}

export function fnDMIN(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  const nums = p.matchingRows[0] || [];
  if (nums.length === 0) return numberVal(0);
  return numberVal(Math.min(...nums));
}

export function fnDMAX(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  const nums = p.matchingRows[0] || [];
  if (nums.length === 0) return numberVal(0);
  return numberVal(Math.max(...nums));
}

export function fnDPRODUCT(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  const nums = p.matchingRows[0] || [];
  if (nums.length === 0) return numberVal(0);
  return numberVal(nums.reduce((acc, n) => acc * n, 1));
}

export function fnDVAR(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  const nums = p.matchingRows[0] || [];
  if (nums.length < 2) return errorVal('#DIV/0!');
  const mean = nums.reduce((acc, n) => acc + n, 0) / nums.length;
  const sumSq = nums.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0);
  return numberVal(sumSq / (nums.length - 1));
}

export function fnDVARP(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  const nums = p.matchingRows[0] || [];
  if (nums.length === 0) return errorVal('#DIV/0!');
  const mean = nums.reduce((acc, n) => acc + n, 0) / nums.length;
  const sumSq = nums.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0);
  return numberVal(sumSq / nums.length);
}

export function fnDSTDEV(args: EvalArg[]): CellValue {
  const varVal = fnDVAR(args);
  if (varVal.kind === 'error') return varVal;
  return numberVal(Math.sqrt((varVal as any).value));
}

export function fnDSTDEVP(args: EvalArg[]): CellValue {
  const varVal = fnDVARP(args);
  if (varVal.kind === 'error') return varVal;
  return numberVal(Math.sqrt((varVal as any).value));
}

export function fnDGET(args: EvalArg[]): CellValue {
  const p = processDbArgs(args);
  if (p.error) return errorVal(p.error as any);
  if (p.matchingCells.length === 0) return errorVal('#VALUE!');
  if (p.matchingCells.length > 1) return errorVal('#NUM!');
  return p.matchingCells[0];
}
