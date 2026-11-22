/**
 * Numeri complessi (COMPLEX, IMSUM, IMPRODUCT, IMSQRT, IMSIN…), funzioni di Bessel (BESSELJ, BESSELY, BESSELI, BESSELK), HEX2OCT, OCT2HEX
 * ed ENCODEURL: funzioni di Excel che mancavano (2026-11-20), scritte da zero dalle definizioni matematiche e dalla documentazione pubblica
 * di Excel; i risultati si confrontano con Excel installato (tests/file-prova/excel-oracolo/funzioni-2026-11-20b.json).
 *
 * Un numero complesso è un testo come «3+4i», «-2j», «i», «5» (separatore decimale del motore: il punto). Il risultato si scrive con al più
 * 15 cifre significative, senza la parte nulla, con «i» o «j» come nei dati (due suffissi diversi insieme: #VALUE!).
 * Le funzioni di Bessel di ordine intero si calcolano dalle loro rappresentazioni integrali (regola dei trapezi sul periodo, che per funzioni
 * periodiche lisce converge rapidissima, e Simpson dove serve): precisione molto migliore di quella di Excel, che è circa 1e-8.
 */
import { CellValue, numberVal, textVal, errorVal, coerceToNumber, coerceToText } from '../values';
import { EvalArg, isRangeArg } from './utils';
import { fnHEX2DEC, fnDEC2OCT, fnOCT2DEC, fnDEC2HEX } from './engineering';

// ---------------------------------------------------------------------------
// numeri complessi
// ---------------------------------------------------------------------------

interface Complesso { re: number; im: number; s?: 'i' | 'j' }
type Esito = Complesso | CellValue;
const eErr = (x: Esito): x is CellValue => 'kind' in x;
const NUM = (): CellValue => errorVal('#NUM!');
const VAL = (): CellValue => errorVal('#VALUE!');

const N = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const SOLO_REALE = new RegExp(`^[+-]?${N}$`);
const SOLO_IMMAGINARIO = new RegExp(`^([+-]?)(${N})?([ij])$`);
const COMPLETO = new RegExp(`^([+-]?${N})([+-])(${N})?([ij])$`);

/** Il complesso scritto in un testo, o null se il testo non lo è. */
function leggiTesto(t: string): Complesso | null {
  if (SOLO_REALE.test(t)) return { re: Number(t), im: 0 };
  let m = SOLO_IMMAGINARIO.exec(t);
  if (m) return { re: 0, im: (m[1] === '-' ? -1 : 1) * (m[2] === undefined ? 1 : Number(m[2])), s: m[3] as 'i' | 'j' };
  m = COMPLETO.exec(t);
  if (m) return { re: Number(m[1]), im: (m[2] === '-' ? -1 : 1) * (m[3] === undefined ? 1 : Number(m[3])), s: m[4] as 'i' | 'j' };
  return null;
}
/** Un valore di cella come complesso: numero → reale, testo → letto, cella vuota → 0; valori logici #VALUE!, testo non valido #NUM!. */
function daValore(v: CellValue | undefined): Esito {
  if (!v || v.kind === 'empty') return { re: 0, im: 0 };
  if (v.kind === 'error') return v;
  if (v.kind === 'number') return { re: v.value, im: 0 };
  if (v.kind === 'boolean' || v.kind === 'array') return v.kind === 'array' ? daValore(v.values[0]?.[0]) : VAL();
  const c = leggiTesto(v.value);
  return c ?? NUM();
}
function daArgomento(a: EvalArg | undefined): Esito {
  if (a === undefined) return VAL();
  if (isRangeArg(a)) return a.rowCount === 1 && a.colCount === 1 ? daValore(a.get(0, 0)) : VAL();
  return daValore(a);
}
/** Il suffisso di più numeri: quello scritto (i se nessuno lo dice); due diversi: errore. */
function suffissoDi(...zs: Complesso[]): 'i' | 'j' | null {
  let s: 'i' | 'j' | undefined;
  for (const z of zs) { if (z.s) { if (s && s !== z.s) return null; s = z.s; } }
  return s ?? 'i';
}

/** Un numero come lo scrive Excel nei complessi: al più 15 cifre significative, esponente maiuscolo. */
function cifre(x: number): string {
  const v = Number(x.toPrecision(15));
  return (Object.is(v, -0) ? '0' : String(v)).replace('e', 'E');
}
function scrivi(z: Complesso, s: 'i' | 'j'): CellValue {
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return NUM();
  const re = Number(z.re.toPrecision(15)) || 0;
  const im = Number(z.im.toPrecision(15)) || 0;
  if (im === 0) return textVal(cifre(re));
  const parteIm = im === 1 ? '' : im === -1 ? '-' : cifre(im);
  if (re === 0) return textVal(parteIm + s);
  return textVal(cifre(re) + (im > 0 ? '+' : '') + parteIm + s);
}

// operazioni
const somma = (a: Complesso, b: Complesso): Complesso => ({ re: a.re + b.re, im: a.im + b.im });
const prodotto = (a: Complesso, b: Complesso): Complesso => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
function quoziente(a: Complesso, b: Complesso): Complesso | null {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return null;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
const modulo = (z: Complesso): number => Math.hypot(z.re, z.im);
const argomento = (z: Complesso): number => Math.atan2(z.im, z.re);
const sen = (z: Complesso): Complesso => ({ re: Math.sin(z.re) * Math.cosh(z.im), im: Math.cos(z.re) * Math.sinh(z.im) });
const cos = (z: Complesso): Complesso => ({ re: Math.cos(z.re) * Math.cosh(z.im), im: -Math.sin(z.re) * Math.sinh(z.im) });
const senh = (z: Complesso): Complesso => ({ re: Math.sinh(z.re) * Math.cos(z.im), im: Math.cosh(z.re) * Math.sin(z.im) });
const cosh = (z: Complesso): Complesso => ({ re: Math.cosh(z.re) * Math.cos(z.im), im: Math.sinh(z.re) * Math.sin(z.im) });
const UNO: Complesso = { re: 1, im: 0 };

/** Una funzione di un complesso che dà un complesso (null = fuori dominio, #NUM!). */
function unaria(f: (z: Complesso) => Complesso | null) {
  return (args: EvalArg[]): CellValue => {
    if (args.length !== 1) return VAL();
    const z = daArgomento(args[0]); if (eErr(z)) return z;
    const r = f(z);
    return r ? scrivi(r, z.s ?? 'i') : NUM();
  };
}
/** Una funzione di un complesso che dà un numero. */
function reale(f: (z: Complesso) => number | CellValue) {
  return (args: EvalArg[]): CellValue => {
    if (args.length !== 1) return VAL();
    const z = daArgomento(args[0]); if (eErr(z)) return z;
    const r = f(z);
    return typeof r === 'number' ? numberVal(r) : r;
  };
}

export const fnIMABS = reale(modulo);
export const fnIMREAL = reale((z) => z.re);
export const fnIMAGINARY = reale((z) => z.im);
export const fnIMARGUMENT = reale((z) => (z.re === 0 && z.im === 0 ? errorVal('#DIV/0!') : argomento(z)));
export const fnIMCONJUGATE = unaria((z) => ({ re: z.re, im: -z.im }));
export const fnIMSQRT = unaria((z) => { const r = Math.sqrt(modulo(z)); const t = argomento(z) / 2; return { re: r * Math.cos(t), im: r * Math.sin(t) }; });
export const fnIMEXP = unaria((z) => { const e = Math.exp(z.re); return { re: e * Math.cos(z.im), im: e * Math.sin(z.im) }; });
const logaritmo = (base: number) => (z: Complesso): Complesso | null => {
  const r = modulo(z);
  if (r === 0) return null;
  return { re: Math.log(r) / base, im: argomento(z) / base };
};
export const fnIMLN = unaria(logaritmo(1));
export const fnIMLOG10 = unaria(logaritmo(Math.LN10));
export const fnIMLOG2 = unaria(logaritmo(Math.LN2));
export const fnIMSIN = unaria(sen);
export const fnIMCOS = unaria(cos);
export const fnIMTAN = unaria((z) => quoziente(sen(z), cos(z)));
export const fnIMSEC = unaria((z) => quoziente(UNO, cos(z)));
export const fnIMCSC = unaria((z) => quoziente(UNO, sen(z)));
export const fnIMCOT = unaria((z) => quoziente(cos(z), sen(z)));
export const fnIMSINH = unaria(senh);
export const fnIMCOSH = unaria(cosh);
export const fnIMSECH = unaria((z) => quoziente(UNO, cosh(z)));
export const fnIMCSCH = unaria((z) => quoziente(UNO, senh(z)));

export function fnCOMPLEX(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return VAL();
  const valori: number[] = [];
  for (const a of args.slice(0, 2)) {
    if (isRangeArg(a)) return VAL();
    if (a.kind === 'error') return a;
    const n = coerceToNumber(a); if (n.error) return errorVal(n.error);
    valori.push(n.value!);
  }
  let s: 'i' | 'j' = 'i';
  if (args.length === 3 && !isRangeArg(args[2]) && args[2].kind !== 'empty') {
    const t = coerceToText(args[2] as CellValue);
    if (t.error) return errorVal(t.error);
    if (t.value === 'j') s = 'j'; else if (t.value !== 'i' && t.value !== '') return VAL();
  }
  return scrivi({ re: valori[0], im: valori[1] }, s);
}

/** IMSUM e IMPRODUCT: tutti i numeri, anche da intervalli. */
function accumula(args: EvalArg[], f: (a: Complesso, b: Complesso) => Complesso, iniziale: Complesso): CellValue {
  if (args.length < 1) return VAL();
  const zs: Complesso[] = [];
  for (const a of args) {
    const celle = isRangeArg(a) ? a.values.flat() : !isRangeArg(a) && a.kind === 'array' ? a.values.flat() : [a as CellValue];
    for (const c of celle) { const z = daValore(c); if (eErr(z)) return z; zs.push(z); }
  }
  const s = suffissoDi(...zs);
  if (!s) return VAL();
  return scrivi(zs.reduce(f, iniziale), s);
}
export const fnIMSUM = (args: EvalArg[]): CellValue => accumula(args, somma, { re: 0, im: 0 });
export const fnIMPRODUCT = (args: EvalArg[]): CellValue => accumula(args, prodotto, UNO);

function binaria(args: EvalArg[], f: (a: Complesso, b: Complesso) => Complesso | null): CellValue {
  if (args.length !== 2) return VAL();
  const a = daArgomento(args[0]); if (eErr(a)) return a;
  const b = daArgomento(args[1]); if (eErr(b)) return b;
  const s = suffissoDi(a, b);
  if (!s) return VAL();
  const r = f(a, b);
  return r ? scrivi(r, s) : NUM();
}
export const fnIMSUB = (args: EvalArg[]): CellValue => binaria(args, (a, b) => ({ re: a.re - b.re, im: a.im - b.im }));
export const fnIMDIV = (args: EvalArg[]): CellValue => binaria(args, quoziente);

export function fnIMPOWER(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const z = daArgomento(args[0]); if (eErr(z)) return z;
  const e = args[1];
  if (isRangeArg(e)) return VAL();
  if (e.kind === 'error') return e;
  const n = coerceToNumber(e); if (n.error) return errorVal(n.error);
  const r = modulo(z);
  if (r === 0) return n.value! > 0 ? textVal('0') : NUM();
  const rn = Math.pow(r, n.value!);
  const t = argomento(z) * n.value!;
  return scrivi({ re: rn * Math.cos(t), im: rn * Math.sin(t) }, z.s ?? 'i');
}

// ---------------------------------------------------------------------------
// Bessel (ordine intero n ≥ 0)
// ---------------------------------------------------------------------------

/** Regola dei trapezi su un periodo intero [0, 2π] con m punti (per funzioni periodiche lisce l'errore cala in modo esponenziale). */
function periodo(f: (t: number) => number, m: number): number {
  let s = 0;
  for (let k = 0; k < m; k++) s += f((2 * Math.PI * k) / m);
  return (s * 2 * Math.PI) / m;
}
/** Simpson su [a, b] con m intervalli (m pari). */
function simpson(f: (t: number) => number, a: number, b: number, m: number): number {
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let k = 1; k < m; k++) s += f(a + k * h) * (k % 2 ? 4 : 2);
  return (s * h) / 3;
}
/** Trapezi su [0, ∞) per una funzione che si spegne in fretta: si va avanti finché i termini non contano più. */
function codaInfinita(f: (t: number) => number, h = 0.01): number {
  let s = f(0) / 2;
  for (let k = 1; k < 200000; k++) {
    const v = f(k * h);
    s += v;
    if (Math.abs(v) < 1e-18 * Math.abs(s) && k * h > 1) break;
  }
  return s * h;
}
const punti = (x: number, n: number): number => Math.max(64, 2 * Math.ceil(Math.abs(x) + n) + 64);

function besselJ(x: number, n: number): number { return periodo((t) => Math.cos(n * t - x * Math.sin(t)), punti(x, n)) / (2 * Math.PI); }
function besselI(x: number, n: number): number { return periodo((t) => Math.exp(x * Math.cos(t)) * Math.cos(n * t), punti(x, n)) / (2 * Math.PI); }
function besselK(x: number, n: number): number { return codaInfinita((t) => Math.exp(-x * Math.cosh(t)) * Math.cosh(n * t)); }
function besselY(x: number, n: number): number {
  const prima = simpson((t) => Math.sin(x * Math.sin(t) - n * t), 0, Math.PI, 2 * punti(x, n) + 2000) / Math.PI;
  const segno = n % 2 === 0 ? 1 : -1;
  // la seconda parte non è piatta in 0 (i trapezi sbaglierebbero di h²): Simpson fino a dove l'integranda si spegne
  const g = (t: number): number => (Math.exp(n * t) + segno * Math.exp(-n * t)) * Math.exp(-x * Math.sinh(t));
  let fine = 1;
  while (Math.abs(g(fine)) > 1e-20 && fine < 100) fine *= 1.5;
  const seconda = simpson(g, 0, fine, 20000) / Math.PI;
  return prima - seconda;
}
function bessel(args: EvalArg[], f: (x: number, n: number) => number, soloPositivi: boolean): CellValue {
  if (args.length !== 2) return VAL();
  const v: number[] = [];
  for (const a of args) {
    if (isRangeArg(a)) { if (a.rowCount === 1 && a.colCount === 1) { const c = coerceToNumber(a.get(0, 0)); if (c.error) return errorVal(c.error); v.push(c.value!); continue; } return VAL(); }
    if (a.kind === 'error') return a;
    if (a.kind === 'boolean') return VAL();
    const c = coerceToNumber(a); if (c.error) return errorVal(c.error);
    v.push(c.value!);
  }
  const x = v[0];
  const n = Math.trunc(v[1]);
  if (n < 0 || (soloPositivi && x <= 0)) return NUM();
  return numberVal(f(x, n));
}
export const fnBESSELJ = (args: EvalArg[]): CellValue => bessel(args, besselJ, false);
export const fnBESSELI = (args: EvalArg[]): CellValue => bessel(args, besselI, false);
export const fnBESSELY = (args: EvalArg[]): CellValue => bessel(args, besselY, true);
export const fnBESSELK = (args: EvalArg[]): CellValue => bessel(args, besselK, true);

// ---------------------------------------------------------------------------
// basi e indirizzi
// ---------------------------------------------------------------------------

export function fnHEX2OCT(args: EvalArg[]): CellValue {
  const d = fnHEX2DEC([args[0]]);
  if (d.kind === 'error') return d;
  return fnDEC2OCT([d, ...(args.length >= 2 ? [args[1]] : [])]);
}
export function fnOCT2HEX(args: EvalArg[]): CellValue {
  const d = fnOCT2DEC([args[0]]);
  if (d.kind === 'error') return d;
  return fnDEC2HEX([d, ...(args.length >= 2 ? [args[1]] : [])]);
}
/** ENCODEURL: testo in UTF-8 con %XX per tutto tranne lettere, cifre, «-», «_» e «.» (come Excel, che codifica anche la tilde). */
export function fnENCODEURL(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const a = args[0];
  const v = isRangeArg(a) ? a.get(0, 0) : a;
  if (v.kind === 'error') return v;
  const t = coerceToText(v); if (t.error) return errorVal(t.error);
  let out = '';
  for (const b of new TextEncoder().encode(t.value!)) {
    const c = String.fromCharCode(b);
    out += /[A-Za-z0-9\-_.]/.test(c) && b < 128 ? c : `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return textVal(out);
}
