/**
 * Utilità per funzioni di Fogli:
 * - Criteri di ricerca e filtro con caratteri jolly (*, ?, ~)
 * - Estrazione aggregazioni (regole intervallo vs argomenti diretti)
 * - Calcolo calendario e date con epoca 1899-12-30
 */

import { CellValue, CellError, coerceToNumber, emptyVal } from '../values';
import { RangeCoord } from '../address';

export type EvalArg = CellValue | RangeArg;

export interface RangeArg {
  kind: 'range';
  rowCount: number;
  colCount: number;
  coord?: RangeCoord;
  get(rowOffset: number, colOffset: number): CellValue;
  findRowExact?(colOffset: number, val: CellValue): number;
  scanColumn?(colOffset: number, fn: (val: CellValue, r: number) => boolean | void): void;
  getColValue?(rowOffset: number, colOffset: number): CellValue;
  getColMap?(colOffset: number): Map<number, { value: CellValue }> | undefined;
  baseRow?: number;
  values: CellValue[][];
}

export function isRangeArg(arg: EvalArg): arg is RangeArg {
  return typeof arg === 'object' && arg !== null && 'kind' in arg && arg.kind === 'range';
}

/**
 * Converte un criterio (numero, stringa di confronto, wildcard) in funzione predicato.
 * Regole rigorose di tipo:
 * - Un criterio numerico (>4, 10, <=5, =10) corrisponde SOLO alle celle numeriche;
 * - Un criterio testuale con operatore ("<b") SOLO alle celle di testo;
 * - "=..." e il confronto di uguaglianza semplice seguono il tipo del criterio;
 * - Il vuoto non corrisponde a criteri con operatore '>', '<', '>=', '<=';
 * - Caratteri jolly: '*' (qualsiasi stringa), '?' (singolo carattere), '~' (escape).
 */
export interface CompiledCriterion {
  (val: CellValue): boolean;
  fastKind?: 'number' | 'text' | 'empty' | 'any';
  fastNumOp?: '=' | '<>' | '>' | '>=' | '<' | '<=';
  fastNumVal?: number;
  matchesEmpty: boolean;
}

export function compileCriterion(critVal: CellValue): CompiledCriterion {
  let fn: CompiledCriterion;
  if (critVal.kind === 'error') {
    fn = ((v: CellValue) => v.kind === 'error' && v.error === critVal.error) as CompiledCriterion;
    fn.matchesEmpty = false;
    return fn;
  }

  if (critVal.kind === 'number') {
    const target = critVal.value;
    fn = ((v: CellValue) => v.kind === 'number' && v.value === target) as CompiledCriterion;
    fn.fastKind = 'number';
    fn.fastNumOp = '=';
    fn.fastNumVal = target;
    fn.matchesEmpty = false;
    return fn;
  }

  if (critVal.kind === 'boolean') {
    const target = critVal.value;
    fn = ((v: CellValue) => v.kind === 'boolean' && v.value === target) as CompiledCriterion;
    fn.matchesEmpty = false;
    return fn;
  }

  if (critVal.kind === 'empty') {
    fn = ((v: CellValue) => v.kind === 'empty' || (v.kind === 'text' && v.value === '')) as CompiledCriterion;
    fn.matchesEmpty = true;
    fn.fastKind = 'empty';
    return fn;
  }

  if (critVal.kind === 'array') {
    return compileCriterion(critVal.values[0]?.[0] || { kind: 'empty' });
  }

  // Criterio di tipo testo
  const rawText = critVal.value.trim();

  // 1. Controllo operatori di confronto iniziali
  let op = '=';
  let rest = rawText;

  if (rawText.startsWith('<=')) {
    op = '<=';
    rest = rawText.substring(2).trim();
  } else if (rawText.startsWith('>=')) {
    op = '>=';
    rest = rawText.substring(2).trim();
  } else if (rawText.startsWith('<>')) {
    op = '<>';
    rest = rawText.substring(2).trim();
  } else if (rawText.startsWith('<')) {
    op = '<';
    rest = rawText.substring(1).trim();
  } else if (rawText.startsWith('>')) {
    op = '>';
    rest = rawText.substring(1).trim();
  } else if (rawText.startsWith('=')) {
    op = '=';
    rest = rawText.substring(1).trim();
  }

  // Se dopo l'operatore c'è un numero (es. ">4", "<=5", "10", "=10")
  const numRest = Number(rest);
  const isNumRest = rest !== '' && !Number.isNaN(numRest) && Number.isFinite(numRest);

  if (isNumRest) {
    if (op === '=') {
      fn = ((v: CellValue) => v.kind === 'number' && v.value === numRest) as CompiledCriterion;
    } else if (op === '<>') {
      fn = ((v: CellValue) => v.kind !== 'number' || v.value !== numRest) as CompiledCriterion;
    } else if (op === '>') {
      fn = ((v: CellValue) => v.kind === 'number' && v.value > numRest) as CompiledCriterion;
    } else if (op === '>=') {
      fn = ((v: CellValue) => v.kind === 'number' && v.value >= numRest) as CompiledCriterion;
    } else if (op === '<') {
      fn = ((v: CellValue) => v.kind === 'number' && v.value < numRest) as CompiledCriterion;
    } else {
      fn = ((v: CellValue) => v.kind === 'number' && v.value <= numRest) as CompiledCriterion;
    }
    fn.fastKind = 'number';
    fn.fastNumOp = op as any;
    fn.fastNumVal = numRest;
    fn.matchesEmpty = fn(emptyVal());
    return fn;
  }

  // Se è un confronto con operatore disuguaglianza (<, <=, >, >=) su testo (es. "<b")
  if (op === '<' || op === '<=' || op === '>' || op === '>=') {
    fn = ((v: CellValue) => {
      // Il vuoto non corrisponde a criteri con operatore >, <, >=, <=
      // Un criterio testuale con operatore ("<b") corrisponde SOLO alle celle di testo
      if (v.kind !== 'text') return false;
      const cmp = v.value.toLowerCase().localeCompare(rest.toLowerCase());
      switch (op) {
        case '<':
          return cmp < 0;
        case '<=':
          return cmp <= 0;
        case '>':
          return cmp > 0;
        case '>=':
          return cmp >= 0;
        default:
          return false;
      }
    }) as CompiledCriterion;
    fn.fastKind = 'text';
    fn.matchesEmpty = false;
    return fn;
  }

  // Confronto di uguaglianza o disuguaglianza (= o <>) su testo/wildcard
  // "=..." e il confronto di uguaglianza semplice seguono il tipo del criterio
  const regex = wildcardToRegex(rest);
  fn = ((v: CellValue) => {
    if (v.kind === 'empty') {
      const match = rest === '';
      return op === '=' ? match : !match;
    }
    if (v.kind === 'text') {
      const match = regex.test(v.value);
      return op === '=' ? match : !match;
    }
    // Per tipi disomogenei (numeri, booleani, errori), non corrispondono a un criterio testuale
    return op === '<>';
  }) as CompiledCriterion;
  fn.matchesEmpty = fn(emptyVal());
  return fn;
}

/**
 * Converte un pattern con wildcard (*, ?, ~) in una RegExp case-insensitive esatta.
 */
function wildcardToRegex(pattern: string): RegExp {
  let reStr = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '~' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      if (next === '*' || next === '?' || next === '~') {
        reStr += escapeRegexChar(next);
        i += 2;
        continue;
      }
    }
    if (ch === '*') {
      reStr += '.*';
    } else if (ch === '?') {
      reStr += '.';
    } else {
      reStr += escapeRegexChar(ch);
    }
    i++;
  }
  reStr += '$';
  return new RegExp(reStr, 'i');
}

function escapeRegexChar(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Estrae numeri secondo la semantica di aggregazione:
 * - Negli intervalli: ignora testo, booleani e vuoti.
 * - Negli argomenti diretti: converte booleani (TRUE=1, FALSE=0) e testo numerico ("5" -> 5).
 * Se incontra un errore, propaga l'errore.
 */
export function extractAggregationNumbers(args: EvalArg[]): { numbers: number[]; error?: CellError } {
  const numbers: number[] = [];

  for (const arg of args) {
    if (isRangeArg(arg)) {
      const rows = arg.rowCount !== undefined ? arg.rowCount : arg.values.length;
      const cols = arg.colCount !== undefined ? arg.colCount : (rows > 0 ? arg.values[0].length : 0);
      const getCell = (r: number, c: number): CellValue => arg.get ? arg.get(r, c) : arg.values[r][c];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = getCell(r, c);
          if (cell.kind === 'error') return { numbers: [], error: cell.error };
          if (cell.kind === 'number') {
            numbers.push(cell.value);
          }
          // Negli intervalli, testo, booleani e celle vuote vengono IGNORATI
        }
      }
    } else if (arg.kind === 'array') {
      for (const row of arg.values) {
        for (const cell of row) {
          if (cell.kind === 'error') return { numbers: [], error: cell.error };
          if (cell.kind === 'number') {
            numbers.push(cell.value);
          }
        }
      }
    } else {
      // Argomento diretto
      if (arg.kind === 'error') return { numbers: [], error: arg.error };
      if (arg.kind === 'empty') continue;
      const numCoerce = coerceToNumber(arg);
      if (numCoerce.error) return { numbers: [], error: numCoerce.error };
      if (numCoerce.value !== undefined) {
        numbers.push(numCoerce.value);
      }
    }
  }

  return { numbers };
}

/**
 * Arrotondamento decimale esatto basato sulla rappresentazione scientifica (Number.toString).
 * Risolve i limiti di precisione binaria IEEE 754 (es. 1.005 -> 1.01, 1.255 -> 1.26).
 * Supporta 'half-away-from-zero', 'up' (ROUNDUP) e 'down' (ROUNDDOWN).
 * Per numeri con oltre 15 cifre significative, opera come limite di rappresentazione IEEE 754.
 */
export function roundDecimalMode(
  val: number,
  digits: number,
  mode: 'half-away-from-zero' | 'up' | 'down'
): number {
  if (!Number.isFinite(val)) return val;
  if (Math.abs(val) > 1e15) return val;

  const isNeg = val < 0;
  const absVal = Math.abs(val);

  const str = absVal.toString();
  const eIdx = str.indexOf('e');
  let exp = 0;
  let baseStr = str;
  if (eIdx !== -1) {
    baseStr = str.substring(0, eIdx);
    exp = parseInt(str.substring(eIdx + 1), 10);
  }

  const shifted = Number(baseStr + 'e' + (exp + digits));

  let rounded: number;
  if (mode === 'half-away-from-zero') {
    rounded = Math.round(shifted);
  } else if (mode === 'up') {
    rounded = Math.ceil(shifted);
  } else {
    rounded = Math.floor(shifted);
  }

  const roundedStr = rounded.toString();
  const rEIdx = roundedStr.indexOf('e');
  let rExp = 0;
  let rBaseStr = roundedStr;
  if (rEIdx !== -1) {
    rBaseStr = roundedStr.substring(0, rEIdx);
    rExp = parseInt(roundedStr.substring(rEIdx + 1), 10);
  }

  const result = Number(rBaseStr + 'e' + (rExp - digits));
  return isNeg ? -result : result;
}

/**
 * Arrotondamento half-away-from-zero (es. ROUND(2.5, 0)=3, ROUND(-2.5, 0)=-3, ROUND(1.005, 2)=1.01).
 */
export function roundHalfAwayFromZero(num: number, digits: number): number {
  return roundDecimalMode(num, digits, 'half-away-from-zero');
}

// ---------------------------------------------------------------------------
// GESTIONE DATE (Seriale con epoca 1899-12-30)
// Seriale 1 = 1899-12-31, 2 = 1900-01-01
// ---------------------------------------------------------------------------

const EPOCH_MS = Date.UTC(1899, 11, 30); // 1899-12-30T00:00:00Z
const MS_PER_DAY = 86_400_000;

export function dateToSerial(year: number, month: number, day: number): number {
  // Mese 1-based (1..12)
  const dt = new Date(Date.UTC(year, month - 1, day));
  const diffMs = dt.getTime() - EPOCH_MS;
  return Math.round(diffMs / MS_PER_DAY);
}

export function serialToDate(serial: number): { year: number; month: number; day: number } {
  const dateMs = EPOCH_MS + Math.floor(serial) * MS_PER_DAY;
  const dt = new Date(dateMs);
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

export function serialToWeekday(serial: number, returnType = 1): number {
  const dt = new Date(EPOCH_MS + Math.floor(serial) * MS_PER_DAY);
  const day = dt.getUTCDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  switch (returnType) {
    case 1:
      // 1 = Sunday .. 7 = Saturday
      return day + 1;
    case 2:
      // 1 = Monday .. 7 = Sunday
      return day === 0 ? 7 : day;
    case 3:
      // 0 = Monday .. 6 = Sunday
      return day === 0 ? 6 : day - 1;
    default:
      return day + 1;
  }
}

export function addMonthsToSerial(serial: number, months: number): number {
  const { year, month, day } = serialToDate(serial);
  const targetDate = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth() + 1;

  // Calcola ultimo giorno del mese target
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  return dateToSerial(targetYear, targetMonth, clampedDay);
}
