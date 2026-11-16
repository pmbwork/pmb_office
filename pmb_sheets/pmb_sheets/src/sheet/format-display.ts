/**
 * Modulo puro Formattazione e visualizzazione celle:
 * - Numeri: allineati a destra, massimo 10 cifre significative.
 * - Testo: allineato a sinistra.
 * - Booleani e Errori: centrati.
 * - Errori: contrassegnati con isError per applicare i token di colore del tema.
 * Zero DOM, zero Lit, interamente testabile in ambiente Node.
 */

import { CellValue } from '../engine/values';

import { localizzaBooleano, localizzaNumero } from './locale-numeri';
export interface DisplayInfo {
  text: string;
  align: 'left' | 'right' | 'center';
  isError?: boolean;
}

/**
 * Formatta un numero a massimo 10 cifre significative.
 */
function formatDisplayNumberBase(num: number): string {
  if (!Number.isFinite(num)) {
    return '#NUM!';
  }
  if (num === 0) {
    return '0';
  }

  const abs = Math.abs(num);
  // Gli interi fino a 15 cifre (codici a barre, numeri di conto) si vedono per intero, perché 15 sono le cifre che il foglio conserva con certezza.
  if (Number.isInteger(num) && abs < 1e15) return String(num);
  // Se il numero è estremamente grande (>= 1e11) o piccolissimo (< 1e-9), usa notazione scientifica
  if (abs >= 1e11 || (abs < 1e-9 && abs > 0)) {
    const expStr = num.toExponential(9);
    // Rimuove gli zeri finali della mantissa
    return expStr.replace(/(\.[0-9]*[1-9])0+e/, '$1e').replace(/\.0+e/, 'e');
  }

  // Altrimenti precisione a 10 cifre significative
  const precStr = parseFloat(num.toPrecision(10)).toString();
  return precStr;
}

export function formatDisplayValue(value: CellValue): DisplayInfo {
  switch (value.kind) {
    case 'empty':
      return { text: '', align: 'left' };

    case 'number':
      return {
        text: formatDisplayNumber(value.value),
        align: 'right',
      };

    case 'text':
      return {
        text: value.value,
        align: 'left',
      };

    case 'boolean':
      return {
        text: localizzaBooleano(value.value),
        align: 'center',
      };

    case 'error':
      return {
        text: value.error,
        align: 'center',
        isError: true,
      };

    case 'array':
      if (value.values.length > 0 && value.values[0].length > 0) {
        return formatDisplayValue(value.values[0][0]);
      }
      return { text: '', align: 'left' };
  }
}

/** Come formatDisplayNumberBase, ma con il punto e la virgola dei numeri nella lingua scelta. */
export function formatDisplayNumber(num: number): string {
  return localizzaNumero(formatDisplayNumberBase(num));
}
