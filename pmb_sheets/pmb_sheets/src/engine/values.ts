/**
 * Tipi di valori, costanti di errore, conversioni e confronti.
 * Zero dipendenze esterne.
 */

export type CellError =
  | '#DIV/0!'
  | '#VALUE!'
  | '#REF!'
  | '#NAME?'
  | '#N/A'
  | '#NUM!'
  | '#CIRCULAR!'
  | '#SPILL!'
  | '#ERROR!';

export const CELL_ERRORS: ReadonlySet<CellError> = new Set([
  '#DIV/0!',
  '#VALUE!',
  '#REF!',
  '#NAME?',
  '#N/A',
  '#NUM!',
  '#CIRCULAR!',
  '#SPILL!',
  '#ERROR!',
]);

export type ValueKind = 'number' | 'text' | 'boolean' | 'empty' | 'error' | 'array';

export interface NumberValue {
  kind: 'number';
  value: number;
}

export interface TextValue {
  kind: 'text';
  value: string;
}

export interface BooleanValue {
  kind: 'boolean';
  value: boolean;
}

export interface EmptyValue {
  kind: 'empty';
}

export interface ErrorValue {
  kind: 'error';
  error: CellError;
}

export interface ArrayValue {
  kind: 'array';
  values: CellValue[][];
}

export type CellValue = NumberValue | TextValue | BooleanValue | EmptyValue | ErrorValue | ArrayValue;

export const EMPTY_VALUE: EmptyValue = { kind: 'empty' };

export function numberVal(value: number): CellValue {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return { kind: 'error', error: '#NUM!' };
  }
  return { kind: 'number', value };
}

export function textVal(value: string): CellValue {
  return { kind: 'text', value };
}

export function boolVal(value: boolean): CellValue {
  return { kind: 'boolean', value };
}

export function emptyVal(): CellValue {
  return EMPTY_VALUE;
}

export function errorVal(error: CellError): CellValue {
  return { kind: 'error', error };
}

export function arrayVal(values: CellValue[][]): CellValue {
  return { kind: 'array', values };
}

export function isNumber(v: CellValue): v is NumberValue {
  return v.kind === 'number';
}

export function isText(v: CellValue): v is TextValue {
  return v.kind === 'text';
}

export function isBoolean(v: CellValue): v is BooleanValue {
  return v.kind === 'boolean';
}

export function isEmpty(v: CellValue): v is EmptyValue {
  return v.kind === 'empty';
}

export function isError(v: CellValue): v is ErrorValue {
  return v.kind === 'error';
}

export function isArray(v: CellValue): v is ArrayValue {
  return v.kind === 'array';
}

/**
 * Coercizione aritmetica a numero.
 * - numero: ritorna il valore.
 * - testo: se parsabile come float puro ritorna il numero, altrimenti #VALUE!.
 * - booleano: TRUE -> 1, FALSE -> 0.
 * - vuoto: 0.
 * - errore: propaga l'errore.
 * - array: valuta l'elemento in alto a sinistra (0,0).
 */
export function coerceToNumber(val: CellValue): { value?: number; error?: CellError } {
  if (val.kind === 'error') return { error: val.error };
  if (val.kind === 'array') {
    const top = val.values[0]?.[0] || emptyVal();
    return coerceToNumber(top);
  }
  if (val.kind === 'number') return { value: val.value };
  if (val.kind === 'boolean') return { value: val.value ? 1 : 0 };
  if (val.kind === 'empty') return { value: 0 };

  if (val.kind === 'text') {
    const trimmed = val.value.trim();
    if (trimmed === '') return { value: 0 };
    // Notazione numerica standard (punto decimale)
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (Number.isFinite(num)) {
        return { value: num };
      }
      return { error: '#NUM!' };
    }
    return { error: '#VALUE!' };
  }

  return { error: '#VALUE!' };
}

/**
 * Coercizione a testo (usata ad esempio per concatenazione &).
 */
export function coerceToText(val: CellValue): { value?: string; error?: CellError } {
  if (val.kind === 'error') return { error: val.error };
  if (val.kind === 'array') {
    const top = val.values[0]?.[0] || emptyVal();
    return coerceToText(top);
  }
  if (val.kind === 'text') return { value: val.value };
  if (val.kind === 'number') return { value: val.value.toString() };
  if (val.kind === 'boolean') return { value: val.value ? 'TRUE' : 'FALSE' };
  if (val.kind === 'empty') return { value: '' };
  return { error: '#VALUE!' };
}

/**
 * Coercizione a booleano.
 */
export function coerceToBoolean(val: CellValue): { value?: boolean; error?: CellError } {
  if (val.kind === 'error') return { error: val.error };
  if (val.kind === 'array') {
    const top = val.values[0]?.[0] || emptyVal();
    return coerceToBoolean(top);
  }
  if (val.kind === 'boolean') return { value: val.value };
  if (val.kind === 'number') return { value: val.value !== 0 };
  if (val.kind === 'empty') return { value: false };
  if (val.kind === 'text') {
    const upper = val.value.trim().toUpperCase();
    if (upper === 'TRUE') return { value: true };
    if (upper === 'FALSE') return { value: false };
    return { error: '#VALUE!' };
  }
  return { error: '#VALUE!' };
}

/**
 * Ordinamento comparativo tra valori eterogenei:
 * Numero < Testo < Booleano
 * Ritorna:
 *   < 0 se a < b
 *   = 0 se a == b
 *   > 0 se a > b
 * Se uno dei due è un errore, propaga l'errore.
 */
export function compareValues(a: CellValue, b: CellValue): { result?: number; error?: CellError } {
  if (a.kind === 'error') return { error: a.error };
  if (b.kind === 'error') return { error: b.error };

  const normA = a.kind === 'array' ? (a.values[0]?.[0] || emptyVal()) : a;
  const normB = b.kind === 'array' ? (b.values[0]?.[0] || emptyVal()) : b;

  if (normA.kind === 'error') return { error: normA.error };
  if (normB.kind === 'error') return { error: normB.error };

  // Trattamento delle celle vuote nei confronti
  // Se una è vuota e l'altra è numero, il vuoto vale 0
  // Se una è vuota e l'altra è testo, il vuoto vale ""
  // Se entrambe sono vuote, sono uguali (0)
  if (normA.kind === 'empty' && normB.kind === 'empty') {
    return { result: 0 };
  }
  let effectiveA: CellValue = normA;
  let effectiveB: CellValue = normB;

  if (normA.kind === 'empty') {
    if (normB.kind === 'number') effectiveA = numberVal(0);
    else if (normB.kind === 'text') effectiveA = textVal('');
    else if (normB.kind === 'boolean') effectiveA = boolVal(false);
  } else if (normB.kind === 'empty') {
    if (normA.kind === 'number') effectiveB = numberVal(0);
    else if (normA.kind === 'text') effectiveB = textVal('');
    else if (normA.kind === 'boolean') effectiveB = boolVal(false);
  }

  // Rango di tipo per comparazione tra tipi differenti:
  // number: 1, text: 2, boolean: 3
  const typeRank = (v: CellValue): number => {
    switch (v.kind) {
      case 'number':
        return 1;
      case 'text':
        return 2;
      case 'boolean':
        return 3;
      default:
        return 0;
    }
  };

  const rankA = typeRank(effectiveA);
  const rankB = typeRank(effectiveB);

  if (rankA !== rankB) {
    return { result: rankA - rankB };
  }

  // Stesso tipo
  if (effectiveA.kind === 'number' && effectiveB.kind === 'number') {
    if (effectiveA.value === effectiveB.value) return { result: 0 };
    // come negli altri fogli di calcolo: nel confronto contano 15 cifre significative (0,1+0,2 è uguale a 0,3)
    if (Number(effectiveA.value.toPrecision(15)) === Number(effectiveB.value.toPrecision(15))) return { result: 0 };
    return { result: effectiveA.value < effectiveB.value ? -1 : 1 };
  }

  if (effectiveA.kind === 'text' && effectiveB.kind === 'text') {
    // Confronto case-insensitive
    const lowA = effectiveA.value.toLowerCase();
    const lowB = effectiveB.value.toLowerCase();
    if (lowA === lowB) return { result: 0 };
    return { result: lowA < lowB ? -1 : 1 };
  }

  if (effectiveA.kind === 'boolean' && effectiveB.kind === 'boolean') {
    if (effectiveA.value === effectiveB.value) return { result: 0 };
    return { result: !effectiveA.value && effectiveB.value ? -1 : 1 };
  }

  return { result: 0 };
}
