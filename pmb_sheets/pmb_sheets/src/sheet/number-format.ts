/**
 * Formattatore numerico puro per celle di Fogli.
 * Gestisce formati Automatico, Testo, Numero, Percentuale, Valuta Euro, Scientifico, Data e Ora.
 * Nessuna dipendenza esterna; fallback resiliente su formato Automatico.
 */

import { localizzaNumero, localeNumeri } from './locale-numeri';
import { coloreDelFormato, formattaNumero, formatoRiconosciuto } from '../engine/format-testo';
export const NUMBER_FORMAT_PRESETS = {
  AUTO: '',
  TEXT: '@',
  NUMBER_PLAIN: '0.00',
  NUMBER_GROUPED: '#,##0.00',
  PERCENT_INT: '0%',
  PERCENT_ONE_DEC: '0.0%',
  PERCENT_TWO_DEC: '0.00%',
  CURRENCY_EUR: '€#,##0.00',
  SCIENTIFIC: '0.00E+00',
  DATE_DMY: 'dd/mm/yyyy',
  TIME_HMS: 'hh:mm:ss',
  DATETIME: 'dd/mm/yyyy hh:mm:ss',
} as const;

/**
 * Data seriale origine standard (1899-12-30 UTC).
 * Seriale 1 = 31/12/1899, Seriale 45351 = 29/02/2024.
 */
const MS_PER_DAY = 86_400_000;
const SERIAL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/**
 * Verifica se un valore e numerico finito.
 */
function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Converte un numero seriale in Date UTC.
 */
export function serialToDate(serial: number): Date {
  const utcMs = SERIAL_EPOCH_UTC + Math.round(serial * MS_PER_DAY);
  return new Date(utcMs);
}

/**
 * Converte una Date UTC in numero seriale.
 */
export function dateToSerial(date: Date): number {
  const diff = date.getTime() - SERIAL_EPOCH_UTC;
  return diff / MS_PER_DAY;
}

/**
 * Formatta un numero raggruppando le migliaia con virgola e separando i decimali con punto.
 */
function formatGroupedNumber(num: number, minDecimals: number, maxDecimals: number, useGrouping: boolean): string {
  const isNegative = num < 0;
  const absVal = Math.abs(num);

  // Arrotondamento ai decimali massimi
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(absVal * factor) / factor;

  const fixed = rounded.toFixed(maxDecimals);
  const parts = fixed.split('.');
  let integerPart = parts[0];
  let decimalPart = parts[1] || '';

  // Rimozione zeri superflui se minDecimals < maxDecimals
  if (minDecimals < maxDecimals) {
    while (decimalPart.length > minDecimals && decimalPart.endsWith('0')) {
      decimalPart = decimalPart.slice(0, -1);
    }
  }

  if (useGrouping) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const formatted = decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formatta un valore in notazione scientifica (es. 1.23E+04).
 */
function formatScientific(num: number, decimals: number): string {
  if (num === 0) {
    const dec = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
    return `0${dec}E+00`;
  }
  const isNeg = num < 0;
  const abs = Math.abs(num);
  const exponent = Math.floor(Math.log10(abs));
  const mantissa = abs / Math.pow(10, exponent);

  const roundedMantissa = mantissa.toFixed(decimals);
  const expSign = exponent >= 0 ? '+' : '-';
  const expPadded = Math.abs(exponent).toString().padStart(2, '0');
  const signStr = isNeg ? '-' : '';

  return `${signStr}${roundedMantissa}E${expSign}${expPadded}`;
}

/**
 * Formatta una data seriale in stringa dd/mm/yyyy.
 */
function formatDate(serial: number): string {
  if (serial < 0 || !Number.isFinite(serial)) return String(serial);
  const date = serialToDate(serial);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Formatta la parte frazionaria di un seriale in hh:mm:ss.
 */
function formatTime(serial: number): string {
  if (!Number.isFinite(serial)) return String(serial);
  // Frazione del giorno: solo parte decimale (0..1)
  let frac = Math.abs(serial) % 1;
  const totalSeconds = Math.round(frac * 86400);
  const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Formatta data e ora combinata (dd/mm/yyyy hh:mm:ss).
 */
function formatDateTime(serial: number): string {
  return `${formatDate(serial)} ${formatTime(serial)}`;
}

/**
 * Funzione pura principale per la formattazione di una cella.
 * - Testo, booleani ed errori (#...) passano inalterati.
 * - I numeri vengono formattati in base al codice specificato.
 * - Se il codice non e valido o non specificato, ricade sul formato Automatico (stringa nativa).
 */
function formatCellValueBase(value: unknown, formatCode?: string | null): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Supporto nativo per CellValue restituito dal motore ({ kind: 'number', value: ... })
  if (typeof value === 'object') {
    const cv = value as { kind?: string; value?: unknown; message?: string };
    if (cv.kind === 'number') {
      value = cv.value;
    } else if (cv.kind === 'text') {
      return String(cv.value ?? '');
    } else if (cv.kind === 'boolean') {
      return cv.value ? 'VERO' : 'FALSO';
    } else if (cv.kind === 'error') {
      return cv.message || String(cv.value || '#ERRORE!');
    } else if (cv.kind === 'empty') {
      return '';
    }
  }

  // Errori del motore o booleani passano inalterati
  if (typeof value === 'boolean') {
    return value ? 'VERO' : 'FALSO';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (!isNumeric(value)) {
    return String(value);
  }

  const code = (formatCode || '').trim();
  if (!code || code === NUMBER_FORMAT_PRESETS.AUTO) {
    // Formato Automatico: numero nativo senza zeri di coda artificiali
    // Gestione numeri interi ed esponenziali se grandissimi
    if (Math.abs(value) >= 1e15 || (Math.abs(value) > 0 && Math.abs(value) < 1e-6)) {
      return value.toExponential(4).replace('e', 'E');
    }
    return String(value);
  }

  // Testo esplicito @: restituisce la rappresentazione testuale del numero
  if (code === '@') {
    return String(value);
  }

  // Valuta Euro
  if (code === '€#,##0.00' || code === '€#,##0') {
    const decimals = code.includes('.00') ? 2 : 0;
    const isNeg = value < 0;
    const absVal = Math.abs(value);
    const formatted = formatGroupedNumber(absVal, decimals, decimals, true);
    return isNeg ? `-€${formatted}` : `€${formatted}`;
  }

  // Percentuale: moltiplica per 100
  if (code.includes('%')) {
    const pctValue = value * 100;
    if (code === '0%') {
      return `${Math.round(pctValue)}%`;
    }
    if (code === '0.0%') {
      return `${formatGroupedNumber(pctValue, 1, 1, false)}%`;
    }
    if (code === '0.00%') {
      return `${formatGroupedNumber(pctValue, 2, 2, false)}%`;
    }
    // Pattern percentuale generico 0.0...%
    const match = code.match(/0\.([0]+)%/);
    if (match) {
      const dec = match[1].length;
      return `${formatGroupedNumber(pctValue, dec, dec, false)}%`;
    }
    return `${formatGroupedNumber(pctValue, 2, 2, false)}%`;
  }

  // Scientifico
  if (code.includes('E+') || code.includes('e+')) {
    const match = code.match(/0\.([0]+)E\+/i);
    const decimals = match ? match[1].length : 2;
    return formatScientific(value, decimals);
  }

  // Date e Ore
  if (code === 'dd/mm/yyyy hh:mm:ss' || code === 'yyyy-mm-dd hh:mm:ss') {
    return formatDateTime(value);
  }
  if (code === 'dd/mm/yyyy' || code === 'd/m/yyyy') {
    return formatDate(value);
  }
  if (code === 'hh:mm:ss' || code === 'h:mm:ss') {
    return formatTime(value);
  }

  // Numeri con decimali e/o raggruppamento
  // Formati come 0, 0.0, 0.00, 0.000, #,##0, #,##0.00, ecc.
  const hasGrouping = code.includes(',');
  const dotIndex = code.indexOf('.');

  if (dotIndex !== -1) {
    const decPart = code.slice(dotIndex + 1);
    const decCount = (decPart.match(/0/g) || []).length;
    return formatGroupedNumber(value, decCount, decCount, hasGrouping);
  } else if (code.includes('0')) {
    return formatGroupedNumber(value, 0, 0, hasGrouping);
  }

  // Fallback: se il codice non e compreso, non lancia eccezioni ma restituisce il valore base
  return String(value);
}

/**
 * Aumenta di 1 i decimali del formato corrente.
 */
export function increaseDecimals(currentCode?: string | null): string {
  const code = (currentCode || '').trim();
  if (!code || code === NUMBER_FORMAT_PRESETS.AUTO) {
    return '0.0';
  }
  if (code === '@') {
    return '@';
  }
  if (code.includes('%')) {
    const match = code.match(/0(\.0+)?%/);
    if (!match || !match[1]) return '0.0%';
    const decs = match[1].length; // include il punto, quindi numero di zeri = length - 1
    return `0.${'0'.repeat(decs)}%`;
  }
  if (code.startsWith('€')) {
    const hasDec = code.includes('.');
    if (!hasDec) return '€#,##0.0';
    const parts = code.split('.');
    return `${parts[0]}.${parts[1]}0`;
  }
  if (code.includes('E+') || code.includes('e+')) {
    const match = code.match(/0\.([0]+)E\+/i);
    const currentDecs = match ? match[1].length : 2;
    return `0.${'0'.repeat(currentDecs + 1)}E+00`;
  }

  const hasGrouping = code.includes(',');
  const base = hasGrouping ? '#,##0' : '0';
  if (!code.includes('.')) {
    return `${base}.0`;
  }
  const parts = code.split('.');
  return `${parts[0]}.${parts[1]}0`;
}

/**
 * Diminuisce di 1 i decimali del formato corrente (minimo 0 decimali).
 */
export function decreaseDecimals(currentCode?: string | null): string {
  const code = (currentCode || '').trim();
  if (!code || code === NUMBER_FORMAT_PRESETS.AUTO) {
    return '0';
  }
  if (code === '@') {
    return '@';
  }
  if (code.includes('%')) {
    const match = code.match(/0\.([0]+)%/);
    if (!match) return '0%';
    const curDecs = match[1].length;
    if (curDecs <= 1) return '0%';
    return `0.${'0'.repeat(curDecs - 1)}%`;
  }
  if (code.startsWith('€')) {
    if (!code.includes('.')) return '€#,##0';
    const parts = code.split('.');
    if (parts[1].length <= 1) return '€#,##0';
    return `${parts[0]}.${parts[1].slice(0, -1)}`;
  }
  if (code.includes('E+') || code.includes('e+')) {
    const match = code.match(/0\.([0]+)E\+/i);
    const currentDecs = match ? match[1].length : 2;
    if (currentDecs <= 1) return '0.0E+00';
    return `0.${'0'.repeat(currentDecs - 1)}E+00`;
  }

  if (!code.includes('.')) {
    return code;
  }
  const parts = code.split('.');
  if (parts[1].length <= 1) {
    return parts[0];
  }
  return `${parts[0]}.${parts[1].slice(0, -1)}`;
}

/** Il colore che il formato dà al numero ([Red], [Blue]...) come colore CSS, o undefined se non ne ha. Vale solo per i numeri. */
export function coloreFormato(value: unknown, formatCode?: string | null): string | undefined {
  const codice = (formatCode || '').trim();
  if (codice === '' || !codice.includes('[')) return undefined;
  const numero = typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'number' ? (value as { value: unknown }).value : value;
  if (typeof numero !== 'number' || !formatoRiconosciuto(codice)) return undefined;
  return coloreDelFormato(numero, codice) ?? undefined;
}

/** Come formatCellValueBase, ma con il punto e la virgola dei numeri nella lingua scelta. Date e ore non hanno punti né virgole e restano uguali. */
export function formatCellValue(value: unknown, formatCode?: string | null): string {
  // il formato scritto come in Excel (sezioni, "€" tra virgolette, parentesi, [Red], date lunghe, AM/PM...) lo scrive l'interprete completo;
  // solo se non sa cosa farne si ricade sul vecchio comportamento
  const codice = (formatCode || '').trim();
  const numero = typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'number' ? (value as { value: unknown }).value : value;
  if (codice !== '' && codice !== '@' && typeof numero === 'number' && Number.isFinite(numero) && formatoRiconosciuto(codice)) {
    const nuovo = formattaNumero(numero, codice, localeNumeri());
    if (nuovo !== null) return nuovo;
  }
  const testo = formatCellValueBase(value, formatCode);
  const v = typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'number' ? (value as { value: unknown }).value : value;
  return typeof v === 'number' ? localizzaNumero(testo) : testo;
}
