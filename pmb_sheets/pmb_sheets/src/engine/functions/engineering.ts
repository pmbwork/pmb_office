/**
 * Funzioni di Ingegneria per pmb_office Fogli:
 * BIN2DEC, DEC2BIN, HEX2DEC, DEC2HEX, OCT2DEC, DEC2OCT,
 * BIN2HEX, BIN2OCT, HEX2BIN, OCT2BIN, DELTA, GESTEP,
 * BITAND, BITOR, BITXOR, BITLSHIFT, BITRSHIFT
 */

import { CellValue, numberVal, textVal, errorVal, coerceToNumber, coerceToText } from '../values';
import { EvalArg, isRangeArg } from './utils';

function getSingleNum(arg: EvalArg): { val?: number; error?: string } {
  if (isRangeArg(arg)) return { error: '#VALUE!' };
  if (arg.kind === 'error') return { error: arg.error };
  const c = coerceToNumber(arg);
  if (c.error) return { error: c.error };
  return { val: c.value };
}

function getSingleStr(arg: EvalArg): { val?: string; error?: string } {
  if (isRangeArg(arg)) return { error: '#VALUE!' };
  if (arg.kind === 'error') return { error: arg.error };
  const c = coerceToText(arg);
  if (c.error) return { error: c.error };
  return { val: c.value };
}

export function fnBIN2DEC(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const s = getSingleStr(args[0]); if (s.error) return errorVal(s.error as any);
  const str = s.val!.trim();
  if (!/^[01]{1,10}$/.test(str)) return errorVal('#NUM!');
  if (str.length === 10 && str[0] === '1') {
    // Negativo in complemento a due (10 bit)
    const val = parseInt(str, 2) - 1024;
    return numberVal(val);
  }
  return numberVal(parseInt(str, 2));
}

export function fnDEC2BIN(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const n = getSingleNum(args[0]); if (n.error) return errorVal(n.error as any);
  const num = Math.trunc(n.val!);
  if (num < -512 || num > 511) return errorVal('#NUM!');
  let places = -1;
  if (args.length === 2) {
    const p = getSingleNum(args[1]); if (p.error) return errorVal(p.error as any);
    places = Math.trunc(p.val!);
    if (places < 1 || places > 10) return errorVal('#NUM!');
  }

  if (num < 0) {
    const bin10 = (1024 + num).toString(2);
    return textVal(bin10);
  }
  let bin = num.toString(2);
  if (places !== -1) {
    if (bin.length > places) return errorVal('#NUM!');
    bin = bin.padStart(places, '0');
  }
  return textVal(bin);
}

export function fnHEX2DEC(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const s = getSingleStr(args[0]); if (s.error) return errorVal(s.error as any);
  const str = s.val!.trim().toUpperCase();
  if (!/^[0-9A-F]{1,10}$/.test(str)) return errorVal('#NUM!');
  if (str.length === 10 && parseInt(str[0], 16) >= 8) {
    // Negativo a 40 bit
    const val = parseInt(str, 16) - 0x10000000000;
    return numberVal(val);
  }
  return numberVal(parseInt(str, 16));
}

export function fnDEC2HEX(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const n = getSingleNum(args[0]); if (n.error) return errorVal(n.error as any);
  const num = Math.trunc(n.val!);
  if (num < -549755813888 || num > 549755813887) return errorVal('#NUM!');
  let places = -1;
  if (args.length === 2) {
    const p = getSingleNum(args[1]); if (p.error) return errorVal(p.error as any);
    places = Math.trunc(p.val!);
    if (places < 1 || places > 10) return errorVal('#NUM!');
  }

  if (num < 0) {
    // 10 cifre hex
    const hex10 = (0x10000000000 + num).toString(16).toUpperCase();
    return textVal(hex10);
  }
  let hex = num.toString(16).toUpperCase();
  if (places !== -1) {
    if (hex.length > places) return errorVal('#NUM!');
    hex = hex.padStart(places, '0');
  }
  return textVal(hex);
}

export function fnOCT2DEC(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const s = getSingleStr(args[0]); if (s.error) return errorVal(s.error as any);
  const str = s.val!.trim();
  if (!/^[0-7]{1,10}$/.test(str)) return errorVal('#NUM!');
  if (str.length === 10 && parseInt(str[0], 8) >= 4) {
    const val = parseInt(str, 8) - 0x40000000; // 30-bit two's complement
    return numberVal(val);
  }
  return numberVal(parseInt(str, 8));
}

export function fnDEC2OCT(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const n = getSingleNum(args[0]); if (n.error) return errorVal(n.error as any);
  const num = Math.trunc(n.val!);
  if (num < -536870912 || num > 536870911) return errorVal('#NUM!');
  let places = -1;
  if (args.length === 2) {
    const p = getSingleNum(args[1]); if (p.error) return errorVal(p.error as any);
    places = Math.trunc(p.val!);
    if (places < 1 || places > 10) return errorVal('#NUM!');
  }

  if (num < 0) {
    const oct10 = (0x40000000 + num).toString(8);
    return textVal(oct10);
  }
  let oct = num.toString(8);
  if (places !== -1) {
    if (oct.length > places) return errorVal('#NUM!');
    oct = oct.padStart(places, '0');
  }
  return textVal(oct);
}

export function fnBIN2HEX(args: EvalArg[]): CellValue {
  const decVal = fnBIN2DEC([args[0]]);
  if (decVal.kind === 'error') return decVal;
  return fnDEC2HEX([decVal, ...(args.length >= 2 ? [args[1]] : [])]);
}

export function fnBIN2OCT(args: EvalArg[]): CellValue {
  const decVal = fnBIN2DEC([args[0]]);
  if (decVal.kind === 'error') return decVal;
  return fnDEC2OCT([decVal, ...(args.length >= 2 ? [args[1]] : [])]);
}

export function fnHEX2BIN(args: EvalArg[]): CellValue {
  const decVal = fnHEX2DEC([args[0]]);
  if (decVal.kind === 'error') return decVal;
  return fnDEC2BIN([decVal, ...(args.length >= 2 ? [args[1]] : [])]);
}

export function fnOCT2BIN(args: EvalArg[]): CellValue {
  const decVal = fnOCT2DEC([args[0]]);
  if (decVal.kind === 'error') return decVal;
  return fnDEC2BIN([decVal, ...(args.length >= 2 ? [args[1]] : [])]);
}

export function fnDELTA(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const n1 = getSingleNum(args[0]); if (n1.error) return errorVal(n1.error as any);
  let num2 = 0;
  if (args.length === 2) {
    const n2 = getSingleNum(args[1]); if (n2.error) return errorVal(n2.error as any);
    num2 = n2.val!;
  }
  return numberVal(n1.val! === num2 ? 1 : 0);
}

export function fnGESTEP(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const n1 = getSingleNum(args[0]); if (n1.error) return errorVal(n1.error as any);
  let step = 0;
  if (args.length === 2) {
    const n2 = getSingleNum(args[1]); if (n2.error) return errorVal(n2.error as any);
    step = n2.val!;
  }
  return numberVal(n1.val! >= step ? 1 : 0);
}

export function fnBITAND(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n1 = getSingleNum(args[0]); if (n1.error) return errorVal(n1.error as any);
  const n2 = getSingleNum(args[1]); if (n2.error) return errorVal(n2.error as any);
  if (n1.val! < 0 || n2.val! < 0) return errorVal('#NUM!');
  return numberVal((n1.val! | 0) & (n2.val! | 0));
}

export function fnBITOR(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n1 = getSingleNum(args[0]); if (n1.error) return errorVal(n1.error as any);
  const n2 = getSingleNum(args[1]); if (n2.error) return errorVal(n2.error as any);
  if (n1.val! < 0 || n2.val! < 0) return errorVal('#NUM!');
  return numberVal((n1.val! | 0) | (n2.val! | 0));
}

export function fnBITXOR(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n1 = getSingleNum(args[0]); if (n1.error) return errorVal(n1.error as any);
  const n2 = getSingleNum(args[1]); if (n2.error) return errorVal(n2.error as any);
  if (n1.val! < 0 || n2.val! < 0) return errorVal('#NUM!');
  return numberVal((n1.val! | 0) ^ (n2.val! | 0));
}

export function fnBITLSHIFT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n1 = getSingleNum(args[0]); if (n1.error) return errorVal(n1.error as any);
  const n2 = getSingleNum(args[1]); if (n2.error) return errorVal(n2.error as any);
  if (n1.val! < 0) return errorVal('#NUM!');
  const shift = Math.trunc(n2.val!);
  if (shift > 53 || shift < -53) return errorVal('#NUM!');
  if (shift >= 0) {
    return numberVal(n1.val! * Math.pow(2, shift));
  } else {
    return numberVal(Math.floor(n1.val! * Math.pow(2, shift)));
  }
}

export function fnBITRSHIFT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n1 = getSingleNum(args[0]); if (n1.error) return errorVal(n1.error as any);
  const n2 = getSingleNum(args[1]); if (n2.error) return errorVal(n2.error as any);
  if (n1.val! < 0) return errorVal('#NUM!');
  const shift = Math.trunc(n2.val!);
  if (shift > 53 || shift < -53) return errorVal('#NUM!');
  return fnBITLSHIFT([args[0], numberVal(-shift)]);
}

// [T003-1] CONVERT: conversione tra unità di misura (sottoinsieme delle unità più comuni; maiuscole/minuscole contano)
const UNITA_MISURA = new Map<string, { categoria: string; fattore: number }>([
  // massa (base: grammo)
  ['g', { categoria: 'massa', fattore: 1 }], ['kg', { categoria: 'massa', fattore: 1000 }], ['mg', { categoria: 'massa', fattore: 0.001 }],
  ['lbm', { categoria: 'massa', fattore: 453.59237 }], ['ozm', { categoria: 'massa', fattore: 28.349523125 }],
  // distanza (base: metro)
  ['m', { categoria: 'distanza', fattore: 1 }], ['km', { categoria: 'distanza', fattore: 1000 }], ['cm', { categoria: 'distanza', fattore: 0.01 }],
  ['mm', { categoria: 'distanza', fattore: 0.001 }], ['mi', { categoria: 'distanza', fattore: 1609.344 }], ['in', { categoria: 'distanza', fattore: 0.0254 }],
  ['ft', { categoria: 'distanza', fattore: 0.3048 }], ['yd', { categoria: 'distanza', fattore: 0.9144 }], ['Nmi', { categoria: 'distanza', fattore: 1852 }],
  // tempo (base: secondo)
  ['s', { categoria: 'tempo', fattore: 1 }], ['sec', { categoria: 'tempo', fattore: 1 }], ['mn', { categoria: 'tempo', fattore: 60 }],
  ['min', { categoria: 'tempo', fattore: 60 }], ['hr', { categoria: 'tempo', fattore: 3600 }], ['day', { categoria: 'tempo', fattore: 86400 }],
  ['yr', { categoria: 'tempo', fattore: 31557600 }],
  // volume (base: litro)
  ['l', { categoria: 'volume', fattore: 1 }], ['L', { categoria: 'volume', fattore: 1 }], ['lt', { categoria: 'volume', fattore: 1 }],
  ['ml', { categoria: 'volume', fattore: 0.001 }], ['m3', { categoria: 'volume', fattore: 1000 }], ['gal', { categoria: 'volume', fattore: 3.785411784 }],
  ['qt', { categoria: 'volume', fattore: 0.946352946 }], ['pt', { categoria: 'volume', fattore: 0.473176473 }], ['cup', { categoria: 'volume', fattore: 0.2365882365 }],
  ['tsp', { categoria: 'volume', fattore: 0.00492892159375 }], ['tbs', { categoria: 'volume', fattore: 0.01478676478125 }],
  // pressione (base: pascal)
  ['Pa', { categoria: 'pressione', fattore: 1 }], ['atm', { categoria: 'pressione', fattore: 101325 }], ['mmHg', { categoria: 'pressione', fattore: 133.322387415 }],
  ['Torr', { categoria: 'pressione', fattore: 133.32236842105263 }], ['psi', { categoria: 'pressione', fattore: 6894.757293168 }],
  // energia (base: joule)
  ['J', { categoria: 'energia', fattore: 1 }], ['kJ', { categoria: 'energia', fattore: 1000 }], ['cal', { categoria: 'energia', fattore: 4.1868 }],
  ['Wh', { categoria: 'energia', fattore: 3600 }], ['kWh', { categoria: 'energia', fattore: 3600000 }], ['BTU', { categoria: 'energia', fattore: 1055.05585262 }],
  // potenza (base: watt)
  ['W', { categoria: 'potenza', fattore: 1 }], ['kW', { categoria: 'potenza', fattore: 1000 }], ['HP', { categoria: 'potenza', fattore: 745.69987158227 }],
  // velocità (base: metri al secondo)
  ['m/s', { categoria: 'velocita', fattore: 1 }], ['km/h', { categoria: 'velocita', fattore: 1 / 3.6 }], ['mph', { categoria: 'velocita', fattore: 0.44704 }],
  ['kn', { categoria: 'velocita', fattore: 1852 / 3600 }],
]);

const A_CELSIUS: Record<string, (v: number) => number> = {
  C: (v) => v,
  F: (v) => ((v - 32) * 5) / 9,
  K: (v) => v - 273.15,
};
const DA_CELSIUS: Record<string, (c: number) => number> = {
  C: (c) => c,
  F: (c) => (c * 9) / 5 + 32,
  K: (c) => c + 273.15,
};

export function fnCONVERT(args: EvalArg[]): CellValue {
  if (args.length !== 3) return errorVal('#VALUE!');
  const n = getSingleNum(args[0]);
  if (n.error || n.val === undefined) return errorVal((n.error ?? '#VALUE!') as any);
  const da = getSingleStr(args[1]);
  if (da.error || da.val === undefined) return errorVal((da.error ?? '#VALUE!') as any);
  const a = getSingleStr(args[2]);
  if (a.error || a.val === undefined) return errorVal((a.error ?? '#VALUE!') as any);

  const temperatura = Object.prototype.hasOwnProperty.call(A_CELSIUS, da.val) && Object.prototype.hasOwnProperty.call(DA_CELSIUS, a.val);
  if (temperatura) return numberVal(DA_CELSIUS[a.val](A_CELSIUS[da.val](n.val)));

  const u1 = UNITA_MISURA.get(da.val);
  const u2 = UNITA_MISURA.get(a.val);
  if (!u1 || !u2 || u1.categoria !== u2.categoria) return errorVal('#N/A');
  return numberVal((n.val * u1.fattore) / u2.fattore);
}
