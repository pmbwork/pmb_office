/**
 * Funzioni aggiunte dopo il primo giro: statistiche (COUNTUNIQUE, AVERAGEA, MAXA, MINA, NORM.*, TREND, LINEST), riepiloghi (SUBTOTAL, AGGREGATE),
 * finanza (XIRR, XNPV, MIRR, CUMIPMT, CUMPRINC, EFFECT, NOMINAL), calendario (NETWORKDAYS.INTL, WORKDAY.INTL), matrici (VSTACK, HSTACK, TEXTSPLIT,
 * RANDARRAY, MDETERM, MINVERSE), trigonometria (SEC, CSC, COT) e COMBINA.
 */
import { CellValue, numberVal, textVal, errorVal, arrayVal, emptyVal, coerceToNumber, coerceToText, coerceToBoolean } from '../values';
import { EvalArg, isRangeArg, serialToWeekday } from './utils';
import { testoADataSeriale } from './date';
import { fnIPMT, fnPPMT } from './financial';

type Implementazione = (args: EvalArg[], contesto?: unknown) => CellValue;

// ---- aiuti

function comeMatrice(a: EvalArg): CellValue[][] {
  if (isRangeArg(a)) return a.values;
  if (a.kind === 'array') return a.values;
  return [[a]];
}

function appiattisci(args: EvalArg[]): CellValue[] {
  const out: CellValue[] = [];
  for (const a of args) for (const riga of comeMatrice(a)) for (const c of riga) out.push(c);
  return out;
}

const numero = (a: EvalArg | undefined, predefinito?: number): { v?: number; e?: CellValue } => {
  if (a === undefined || (!isRangeArg(a) && a.kind === 'empty')) return predefinito === undefined ? { e: errorVal('#VALUE!') } : { v: predefinito };
  if (isRangeArg(a)) return { e: errorVal('#VALUE!') };
  if (a.kind === 'error') return { e: a };
  const c = coerceToNumber(a);
  return c.error ? { e: errorVal(c.error) } : { v: c.value! };
};

/** Solo i numeri di una colonna o riga, nell'ordine (celle non numeriche scartate). */
function soloNumeri(a: EvalArg): number[] {
  return appiattisci([a]).filter((c): c is Extract<CellValue, { kind: 'number' }> => c.kind === 'number').map((c) => c.value);
}

// ---- statistiche

export function fnCOUNTUNIQUE(args: EvalArg[]): CellValue {
  if (args.length === 0) return errorVal('#VALUE!');
  const visti = new Set<string>();
  for (const c of appiattisci(args)) {
    if (c.kind === 'error') return c;
    if (c.kind === 'empty') continue;
    visti.add(c.kind === 'text' ? `t:${c.value.toLowerCase()}` : c.kind === 'number' ? `n:${c.value}` : c.kind === 'boolean' ? `b:${c.value}` : 'x');
  }
  return numberVal(visti.size);
}

/** Valori per le funzioni "A" (AVERAGEA, MAXA, MINA): testo = 0, VERO = 1, FALSO = 0, vuoti ignorati. */
function valoriA(args: EvalArg[]): { numeri: number[]; errore?: CellValue } {
  const numeri: number[] = [];
  for (const a of args) {
    const celle = comeMatrice(a);
    const direttoScalare = !isRangeArg(a) && a.kind !== 'array';
    for (const riga of celle) for (const c of riga) {
      if (c.kind === 'error') return { numeri, errore: c };
      if (c.kind === 'empty') continue;
      if (c.kind === 'number') numeri.push(c.value);
      else if (c.kind === 'boolean') numeri.push(c.value ? 1 : 0);
      else if (c.kind === 'text') {
        if (direttoScalare) { const n = coerceToNumber(c); if (n.error) return { numeri, errore: errorVal('#VALUE!') }; numeri.push(n.value!); } else numeri.push(0);
      }
    }
  }
  return { numeri };
}

export function fnAVERAGEA(args: EvalArg[]): CellValue {
  const { numeri, errore } = valoriA(args);
  if (errore) return errore;
  if (numeri.length === 0) return errorVal('#DIV/0!');
  return numberVal(numeri.reduce((s, x) => s + x, 0) / numeri.length);
}
export function fnMAXA(args: EvalArg[]): CellValue {
  const { numeri, errore } = valoriA(args);
  if (errore) return errore;
  return numberVal(numeri.length === 0 ? 0 : Math.max(...numeri));
}
export function fnMINA(args: EvalArg[]): CellValue {
  const { numeri, errore } = valoriA(args);
  if (errore) return errore;
  return numberVal(numeri.length === 0 ? 0 : Math.min(...numeri));
}

export function fnCOMBINA(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n = numero(args[0]); if (n.e) return n.e;
  const k = numero(args[1]); if (k.e) return k.e;
  const N = Math.trunc(n.v!);
  const K = Math.trunc(k.v!);
  if (N < 0 || K < 0 || (N === 0 && K > 0)) return errorVal('#NUM!');
  if (K === 0) return numberVal(1);
  // C(N+K-1, K) con prodotto progressivo
  let r = 1;
  for (let i = 1; i <= K; i++) r = (r * (N + i - 1)) / i;
  return numberVal(Math.round(r));
}

function phiDensita(z: number): number { return Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI); }
/** Funzione di ripartizione della normale standard (serie convergente: precisione di macchina fino a |z| < 8). */
export function normaleCdf(z: number): number {
  if (z < 0) return 1 - normaleCdf(-z);
  if (z > 8.5) return 1;
  let somma = z;
  let termine = z;
  for (let k = 1; k < 400; k++) {
    termine *= (z * z) / (2 * k + 1);
    somma += termine;
    if (termine < 1e-17 * somma) break;
  }
  return 0.5 + phiDensita(z) * somma;
}
/** Inversa della normale standard (algoritmo di Acklam + un passo di Halley). */
export function normaleInversa(p: number): number {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const bassa = 0.02425;
  let x: number;
  if (p < bassa) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p > 1 - bassa) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const e = normaleCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

export function fnNORM_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return errorVal('#VALUE!');
  const x = numero(args[0]); if (x.e) return x.e;
  const m = numero(args[1]); if (m.e) return m.e;
  const s = numero(args[2]); if (s.e) return s.e;
  if (s.v! <= 0) return errorVal('#NUM!');
  const cum = isRangeArg(args[3]) ? { error: '#VALUE!' as const } : coerceToBoolean(args[3]);
  if ('error' in cum && cum.error) return errorVal(cum.error);
  const z = (x.v! - m.v!) / s.v!;
  return numberVal((cum as { value?: boolean }).value ? normaleCdf(z) : phiDensita(z) / s.v!);
}
export function fnNORM_S_DIST(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return errorVal('#VALUE!');
  const z = numero(args[0]); if (z.e) return z.e;
  let cumulativa = true;
  if (args.length === 2) {
    if (isRangeArg(args[1])) return errorVal('#VALUE!');
    const c = coerceToBoolean(args[1]);
    if (c.error) return errorVal(c.error);
    cumulativa = c.value!;
  }
  return numberVal(cumulativa ? normaleCdf(z.v!) : phiDensita(z.v!));
}
export function fnNORM_INV(args: EvalArg[]): CellValue {
  if (args.length !== 3) return errorVal('#VALUE!');
  const p = numero(args[0]); if (p.e) return p.e;
  const m = numero(args[1]); if (m.e) return m.e;
  const s = numero(args[2]); if (s.e) return s.e;
  if (p.v! <= 0 || p.v! >= 1 || s.v! <= 0) return errorVal('#NUM!');
  return numberVal(m.v! + s.v! * normaleInversa(p.v!));
}
export function fnNORM_S_INV(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const p = numero(args[0]); if (p.e) return p.e;
  if (p.v! <= 0 || p.v! >= 1) return errorVal('#NUM!');
  return numberVal(normaleInversa(p.v!));
}

// ---- regressione lineare semplice

interface Retta { m: number; b: number; n: number; ssx: number; sxy: number; ssy: number; mediaX: number; mediaY: number }

function calcolaRetta(y: number[], x: number[], costante: boolean): Retta | null {
  const n = y.length;
  if (n === 0 || x.length !== n) return null;
  const mediaX = x.reduce((s, v) => s + v, 0) / n;
  const mediaY = y.reduce((s, v) => s + v, 0) / n;
  let ssx = 0;
  let sxy = 0;
  let ssy = 0;
  if (costante) {
    for (let i = 0; i < n; i++) { ssx += (x[i] - mediaX) ** 2; sxy += (x[i] - mediaX) * (y[i] - mediaY); ssy += (y[i] - mediaY) ** 2; }
    if (ssx === 0) return null;
    const m = sxy / ssx;
    return { m, b: mediaY - m * mediaX, n, ssx, sxy, ssy, mediaX, mediaY };
  }
  let sxx = 0;
  let sxyy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) { sxx += x[i] * x[i]; sxyy += x[i] * y[i]; syy += y[i] * y[i]; }
  if (sxx === 0) return null;
  return { m: sxyy / sxx, b: 0, n, ssx: sxx, sxy: sxyy, ssy: syy, mediaX, mediaY };
}

function datiRegressione(args: EvalArg[]): { y: number[]; x: number[]; formaY: [number, number]; errore?: CellValue } {
  const mY = comeMatrice(args[0]);
  const celleY = mY.flat();
  if (celleY.some((c) => c.kind !== 'number')) return { y: [], x: [], formaY: [0, 0], errore: errorVal('#VALUE!') };
  const y = celleY.map((c) => (c as { value: number }).value);
  let x: number[];
  if (args.length >= 2 && !(!isRangeArg(args[1]) && args[1].kind === 'empty')) {
    const celleX = comeMatrice(args[1]).flat();
    if (celleX.some((c) => c.kind !== 'number')) return { y: [], x: [], formaY: [0, 0], errore: errorVal('#VALUE!') };
    x = celleX.map((c) => (c as { value: number }).value);
  } else x = y.map((_, i) => i + 1);
  if (x.length !== y.length) return { y: [], x: [], formaY: [0, 0], errore: errorVal('#VALUE!') };
  return { y, x, formaY: [mY.length, mY[0]?.length ?? 0] };
}

export function fnLINEST(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 4) return errorVal('#VALUE!');
  const { y, x, errore } = datiRegressione(args);
  if (errore) return errore;
  let costante = true;
  if (args.length >= 3 && !(!isRangeArg(args[2]) && args[2].kind === 'empty')) { const c = coerceToBoolean(args[2] as CellValue); if (c.error) return errorVal(c.error); costante = c.value!; }
  let stat = false;
  if (args.length === 4) { const c = coerceToBoolean(args[3] as CellValue); if (c.error) return errorVal(c.error); stat = c.value!; }
  const r = calcolaRetta(y, x, costante);
  if (!r) return errorVal('#NUM!');
  const riga1: CellValue[] = [numberVal(r.m), numberVal(r.b)];
  if (!stat) return arrayVal([riga1]);
  const residui = y.reduce((s, yi, i) => s + (yi - (r.m * x[i] + r.b)) ** 2, 0);
  const df = r.n - (costante ? 2 : 1);
  const seY = df > 0 ? Math.sqrt(residui / df) : 0;
  const seM = df > 0 ? seY / Math.sqrt(r.ssx) : 0;
  const seB = costante && df > 0 ? seY * Math.sqrt(1 / r.n + r.mediaX ** 2 / r.ssx) : 0;
  const ssReg = costante ? r.sxy ** 2 / r.ssx : r.m ** 2 * r.ssx;
  const r2 = costante ? (r.ssy === 0 ? 1 : ssReg / r.ssy) : ssReg / (ssReg + residui);
  const F = df > 0 && residui > 0 ? ssReg / (residui / df) : 0;
  return arrayVal([
    riga1,
    [numberVal(seM), numberVal(costante ? seB : 0)],
    [numberVal(r2), numberVal(seY)],
    [numberVal(F), numberVal(df)],
    [numberVal(ssReg), numberVal(residui)],
  ]);
}

export function fnTREND(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 4) return errorVal('#VALUE!');
  const { y, x, errore } = datiRegressione(args);
  if (errore) return errore;
  let costante = true;
  if (args.length === 4) { const c = coerceToBoolean(args[3] as CellValue); if (c.error) return errorVal(c.error); costante = c.value!; }
  const r = calcolaRetta(y, x, costante);
  if (!r) return errorVal('#NUM!');
  let nuoveX: CellValue[][];
  if (args.length >= 3 && !(!isRangeArg(args[2]) && args[2].kind === 'empty')) nuoveX = comeMatrice(args[2]);
  else nuoveX = comeMatrice(args[1] !== undefined && !(!isRangeArg(args[1]) && args[1].kind === 'empty') ? args[1] : arrayVal(y.map((_, i) => [numberVal(i + 1)]).map((r2) => r2)));
  const out: CellValue[][] = [];
  for (const riga of nuoveX) {
    const nuova: CellValue[] = [];
    for (const c of riga) {
      if (c.kind !== 'number') { nuova.push(errorVal('#VALUE!')); continue; }
      nuova.push(numberVal(r.m * c.value + r.b));
    }
    out.push(nuova);
  }
  return out.length === 1 && out[0].length === 1 ? out[0][0] : arrayVal(out);
}

// ---- SUBTOTAL e AGGREGATE

const NOMI_SUBTOTAL = ['AVERAGE', 'COUNT', 'COUNTA', 'MAX', 'MIN', 'PRODUCT', 'STDEV', 'STDEVP', 'SUM', 'VAR', 'VARP'];
const NOMI_AGGREGATE = ['AVERAGE', 'COUNT', 'COUNTA', 'MAX', 'MIN', 'PRODUCT', 'STDEV.S', 'STDEV.P', 'SUM', 'VAR.S', 'VAR.P', 'MEDIAN', 'MODE.SNGL', 'LARGE', 'SMALL', 'PERCENTILE.INC', 'QUARTILE.INC', 'PERCENTILE.EXC', 'QUARTILE.EXC'];

const FORMULA_CON_SUBTOTALE = /\b(SUBTOTAL|AGGREGATE)\s*\(/i;

interface ContestoNascoste {
  rigaNascosta?: (sheet: string, row: number) => 'manuale' | 'filtro' | undefined;
  getCellFormula?: (sheet: string, row: number, col: number) => string | undefined;
}

/** L'intervallo senza le righe che vanno ignorate (nascoste, secondo `ignora`) e senza le celle che contengono a loro volta un SUBTOTAL o un AGGREGATE
 *  (Excel non li conta due volte). Argomenti che non sono intervalli di celle restano come sono. */
function senzaRigheDaIgnorare(arg: EvalArg, contesto: unknown, ignora: 'filtro' | 'tutte' | 'nessuna', ignoraAnnidati: boolean): EvalArg {
  const ctx = (contesto ?? {}) as ContestoNascoste;
  if (!isRangeArg(arg) || !arg.coord) return arg;
  const foglio = arg.coord.sheet ?? '';
  const primaRiga = arg.coord.startRow;
  const primaColonna = arg.coord.startCol;
  const righe: CellValue[][] = [];
  let cambiato = false;
  for (let r = 0; r < arg.rowCount; r++) {
    const nascosta = ignora === 'nessuna' ? undefined : ctx.rigaNascosta?.(foglio, primaRiga + r);
    if (nascosta && (ignora === 'tutte' || nascosta === 'filtro')) { cambiato = true; continue; }
    const riga: CellValue[] = [];
    for (let c = 0; c < arg.colCount; c++) {
      let v = arg.get(r, c);
      if (ignoraAnnidati && v.kind !== 'empty' && v.kind !== 'text' && ctx.getCellFormula) {
        const formula = ctx.getCellFormula(foglio, primaRiga + r, primaColonna + c);
        if (formula !== undefined && FORMULA_CON_SUBTOTALE.test(formula)) { v = emptyVal(); cambiato = true; }
      }
      riga.push(v);
    }
    righe.push(riga);
  }
  if (!cambiato) return arg;
  return { kind: 'range', rowCount: righe.length, colCount: arg.colCount, get: (r, c) => righe[r]?.[c] ?? emptyVal(), values: righe };
}

export function fnSUBTOTAL(args: EvalArg[], cerca: (nome: string) => Implementazione | undefined, contesto?: unknown): CellValue {
  if (args.length < 2) return errorVal('#VALUE!');
  const f = numero(args[0]); if (f.e) return f.e;
  let codice = Math.trunc(f.v!);
  // 1-11 saltano le righe nascoste da un filtro, 101-111 anche quelle nascoste a mano; i SUBTOTAL annidati non si contano mai
  const ignora: 'filtro' | 'tutte' = codice >= 101 && codice <= 111 ? 'tutte' : 'filtro';
  if (codice >= 101 && codice <= 111) codice -= 100;
  if (codice < 1 || codice > 11) return errorVal('#VALUE!');
  const impl = cerca(NOMI_SUBTOTAL[codice - 1]);
  if (!impl) return errorVal('#NAME?');
  return impl(args.slice(1).map((a) => senzaRigheDaIgnorare(a, contesto, ignora, true)), contesto);
}

export function fnAGGREGATE(args: EvalArg[], cerca: (nome: string) => Implementazione | undefined, contesto?: unknown): CellValue {
  if (args.length < 3) return errorVal('#VALUE!');
  const f = numero(args[0]); if (f.e) return f.e;
  const o = numero(args[1]); if (o.e) return o.e;
  const codice = Math.trunc(f.v!);
  const opzioni = Math.trunc(o.v!);
  if (codice < 1 || codice > 19 || opzioni < 0 || opzioni > 7) return errorVal('#VALUE!');
  const ignoraErrori = opzioni === 2 || opzioni === 3 || opzioni === 6 || opzioni === 7;
  const impl = cerca(NOMI_AGGREGATE[codice - 1]);
  if (!impl) return errorVal('#NAME?');
  // opzioni 1, 3, 5, 7: ignora le righe nascoste (anche dai filtri); 0, 1, 2, 3: ignora i SUBTOTAL e AGGREGATE annidati
  const ignoraNascoste = opzioni === 1 || opzioni === 3 || opzioni === 5 || opzioni === 7;
  const matrice = comeMatrice(senzaRigheDaIgnorare(args[2], contesto, ignoraNascoste ? 'tutte' : 'nessuna', opzioni <= 3));
  const celle = ignoraErrori ? matrice.map((r) => r.filter((c) => c.kind !== 'error')).filter((r) => r.length > 0) : matrice;
  const dati: EvalArg = { kind: 'range', rowCount: celle.length, colCount: celle[0]?.length ?? 0, values: celle, get: (r, c) => celle[r]?.[c] ?? emptyVal() };
  return impl(codice >= 14 ? [dati, ...args.slice(3)] : [dati], contesto);
}

// ---- finanza

function flussiEDate(valori: EvalArg, date: EvalArg): { v: number[]; d: number[]; e?: CellValue } {
  const v = comeMatrice(valori).flat();
  const d = comeMatrice(date).flat();
  if (v.length !== d.length || v.length < 2) return { v: [], d: [], e: errorVal('#NUM!') };
  const num: number[] = [];
  const dat: number[] = [];
  for (let i = 0; i < v.length; i++) {
    if (v[i].kind === 'error') return { v: [], d: [], e: v[i] };
    const x = coerceToNumber(v[i]);
    if (x.error) return { v: [], d: [], e: errorVal(x.error) };
    let giorno: number;
    const di = d[i];
    if (di.kind === 'text') { const t = testoADataSeriale(di.value); if (t === null) return { v: [], d: [], e: errorVal('#VALUE!') }; giorno = t; }
    else { const c = coerceToNumber(di); if (c.error) return { v: [], d: [], e: errorVal(c.error) }; giorno = Math.floor(c.value!); }
    num.push(x.value!);
    dat.push(giorno);
  }
  if (dat.some((g) => g < dat[0])) return { v: [], d: [], e: errorVal('#NUM!') };
  return { v: num, d: dat };
}

const xnpvValore = (tasso: number, v: number[], d: number[]) => v.reduce((s, x, i) => s + x / (1 + tasso) ** ((d[i] - d[0]) / 365), 0);

export function fnXNPV(args: EvalArg[]): CellValue {
  if (args.length !== 3) return errorVal('#VALUE!');
  const r = numero(args[0]); if (r.e) return r.e;
  if (r.v! <= -1) return errorVal('#NUM!');
  const { v, d, e } = flussiEDate(args[1], args[2]);
  if (e) return e;
  return numberVal(xnpvValore(r.v!, v, d));
}

export function fnXIRR(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  const { v, d, e } = flussiEDate(args[0], args[1]);
  if (e) return e;
  if (!v.some((x) => x > 0) || !v.some((x) => x < 0)) return errorVal('#NUM!');
  let guess = 0.1;
  if (args.length === 3) { const g = numero(args[2]); if (g.e) return g.e; guess = g.v!; }
  // Newton, poi bisezione se non converge
  let x = guess;
  for (let i = 0; i < 100; i++) {
    const f = xnpvValore(x, v, d);
    const h = 1e-7;
    const derivata = (xnpvValore(x + h, v, d) - f) / h;
    if (!Number.isFinite(f) || derivata === 0 || !Number.isFinite(derivata)) break;
    const nuovo = x - f / derivata;
    if (nuovo <= -1) { x = (x - 1) / 2 + 0.0000001; continue; }
    if (Math.abs(nuovo - x) < 1e-12) return numberVal(nuovo);
    x = nuovo;
  }
  let lo = -0.999999;
  let hi = 10;
  let flo = xnpvValore(lo, v, d);
  const fhi = xnpvValore(hi, v, d);
  if (flo * fhi > 0) return errorVal('#NUM!');
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fm = xnpvValore(mid, v, d);
    if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
  }
  return numberVal((lo + hi) / 2);
}

export function fnMIRR(args: EvalArg[]): CellValue {
  if (args.length !== 3) return errorVal('#VALUE!');
  const v = soloNumeri(args[0]);
  const fin = numero(args[1]); if (fin.e) return fin.e;
  const rei = numero(args[2]); if (rei.e) return rei.e;
  const n = v.length;
  if (n < 2 || !v.some((x) => x > 0) || !v.some((x) => x < 0)) return errorVal('#DIV/0!');
  const npv = (t: number, flussi: number[]) => flussi.reduce((s, x, i) => s + x / (1 + t) ** (i + 1), 0);
  const positivi = v.map((x) => (x > 0 ? x : 0));
  const negativi = v.map((x) => (x < 0 ? x : 0));
  const fvPos = -npv(rei.v!, positivi) * (1 + rei.v!) ** n;
  const pvNeg = npv(fin.v!, negativi) * (1 + fin.v!);
  return numberVal((fvPos / pvNeg) ** (1 / (n - 1)) - 1);
}

function cumulativo(args: EvalArg[], funzione: (a: EvalArg[]) => CellValue): CellValue {
  if (args.length !== 6) return errorVal('#VALUE!');
  const rate = numero(args[0]); if (rate.e) return rate.e;
  const nper = numero(args[1]); if (nper.e) return nper.e;
  const pv = numero(args[2]); if (pv.e) return pv.e;
  const inizio = numero(args[3]); if (inizio.e) return inizio.e;
  const fine = numero(args[4]); if (fine.e) return fine.e;
  const tipo = numero(args[5]); if (tipo.e) return tipo.e;
  const s = Math.trunc(inizio.v!);
  const f = Math.trunc(fine.v!);
  if (rate.v! <= 0 || nper.v! <= 0 || pv.v! <= 0 || s < 1 || f < s || f > nper.v! || (tipo.v !== 0 && tipo.v !== 1)) return errorVal('#NUM!');
  let somma = 0;
  for (let per = s; per <= f; per++) {
    const r = funzione([numberVal(rate.v!), numberVal(per), numberVal(nper.v!), numberVal(pv.v!), numberVal(0), numberVal(tipo.v!)]);
    if (r.kind === 'error') return r;
    somma += (r as { value: number }).value;
  }
  return numberVal(somma);
}
export const fnCUMIPMT = (args: EvalArg[]): CellValue => cumulativo(args, fnIPMT);
export const fnCUMPRINC = (args: EvalArg[]): CellValue => cumulativo(args, fnPPMT);

export function fnEFFECT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const n = numero(args[0]); if (n.e) return n.e;
  const m = numero(args[1]); if (m.e) return m.e;
  const periodi = Math.trunc(m.v!);
  if (n.v! <= 0 || periodi < 1) return errorVal('#NUM!');
  return numberVal((1 + n.v! / periodi) ** periodi - 1);
}
export function fnNOMINAL(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const e = numero(args[0]); if (e.e) return e.e;
  const m = numero(args[1]); if (m.e) return m.e;
  const periodi = Math.trunc(m.v!);
  if (e.v! <= 0 || periodi < 1) return errorVal('#NUM!');
  return numberVal(periodi * ((1 + e.v!) ** (1 / periodi) - 1));
}

// ---- calendario con fine settimana a scelta

/** I giorni di riposo (0 = lunedì ... 6 = domenica) secondo il codice del fine settimana: 1-7, 11-17 o un testo di 7 caratteri 0/1 da lunedì. */
function riposo(arg: EvalArg | undefined): boolean[] | null {
  if (arg === undefined || (!isRangeArg(arg) && arg.kind === 'empty')) return [false, false, false, false, false, true, true];
  if (isRangeArg(arg)) return null;
  if (arg.kind === 'text' && /^[01]{7}$/.test(arg.value)) { if (arg.value === '1111111') return null; return arg.value.split('').map((c) => c === '1'); }
  const n = coerceToNumber(arg as CellValue);
  if (n.error) return null;
  const c = Math.trunc(n.value!);
  const g = [false, false, false, false, false, false, false];
  if (c >= 1 && c <= 7) { const primo = (c === 1 ? 5 : c - 2); g[primo] = true; g[(primo + 1) % 7] = true; return g; } // 1 = sab-dom, 2 = dom-lun, 3 = lun-mar...
  if (c >= 11 && c <= 17) { g[c === 11 ? 6 : c - 12] = true; return g; } // 11 = domenica, 12 = lunedì...
  return null;
}

function festivi(arg: EvalArg | undefined): { set?: Set<number>; e?: CellValue } {
  const set = new Set<number>();
  if (arg === undefined) return { set };
  for (const c of appiattisci([arg])) {
    if (c.kind === 'empty') continue;
    if (c.kind === 'error') return { e: c };
    if (c.kind === 'text') { const t = testoADataSeriale(c.value); if (t === null) return { e: errorVal('#VALUE!') }; set.add(Math.floor(t)); continue; }
    const n = coerceToNumber(c);
    if (n.error) return { e: errorVal(n.error) };
    set.add(Math.floor(n.value!));
  }
  return { set };
}

const dataDaArg = (a: EvalArg): { v?: number; e?: CellValue } => {
  if (isRangeArg(a)) return { e: errorVal('#VALUE!') };
  if (a.kind === 'error') return { e: a };
  if (a.kind === 'text') { const t = testoADataSeriale(a.value); if (t !== null) return { v: Math.floor(t) }; }
  const c = coerceToNumber(a);
  return c.error ? { e: errorVal(c.error) } : { v: Math.floor(c.value!) };
};
const giornoSettimana = (serial: number) => serialToWeekday(serial, 2) - 1; // 0 = lunedì

export function fnNETWORKDAYS_INTL(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 4) return errorVal('#VALUE!');
  const a = dataDaArg(args[0]); if (a.e) return a.e;
  const b = dataDaArg(args[1]); if (b.e) return b.e;
  const rip = riposo(args[2]); if (!rip) return errorVal('#VALUE!');
  const h = festivi(args[3]); if (h.e) return h.e;
  const [da, a2, segno] = a.v! <= b.v! ? [a.v!, b.v!, 1] : [b.v!, a.v!, -1];
  if (a2 - da > 3_000_000) return errorVal('#NUM!');
  let n = 0;
  for (let d = da; d <= a2; d++) if (!rip[giornoSettimana(d)] && !h.set!.has(d)) n++;
  return numberVal(n * segno);
}

export function fnWORKDAY_INTL(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 4) return errorVal('#VALUE!');
  const s = dataDaArg(args[0]); if (s.e) return s.e;
  const g = numero(args[1]); if (g.e) return g.e;
  const rip = riposo(args[2]); if (!rip) return errorVal('#VALUE!');
  const h = festivi(args[3]); if (h.e) return h.e;
  let giorni = Math.trunc(g.v!);
  if (Math.abs(giorni) > 1_000_000) return errorVal('#NUM!');
  const passo = giorni >= 0 ? 1 : -1;
  let d = s.v!;
  giorni = Math.abs(giorni);
  while (giorni > 0) {
    d += passo;
    if (!rip[giornoSettimana(d)] && !h.set!.has(d)) giorni--;
  }
  return numberVal(d);
}

// ---- matrici

const NA = errorVal('#N/A');

export function fnVSTACK(args: EvalArg[]): CellValue {
  if (args.length === 0) return errorVal('#VALUE!');
  for (const a of args) if (!isRangeArg(a) && a.kind === 'error') return a;
  const mats = args.map(comeMatrice);
  const larghezza = Math.max(...mats.map((m) => m[0]?.length ?? 0));
  const out: CellValue[][] = [];
  for (const m of mats) for (const riga of m) out.push(Array.from({ length: larghezza }, (_, c) => riga[c] ?? NA));
  return arrayVal(out);
}
export function fnHSTACK(args: EvalArg[]): CellValue {
  if (args.length === 0) return errorVal('#VALUE!');
  for (const a of args) if (!isRangeArg(a) && a.kind === 'error') return a;
  const mats = args.map(comeMatrice);
  const altezza = Math.max(...mats.map((m) => m.length));
  const out: CellValue[][] = Array.from({ length: altezza }, () => []);
  for (const m of mats) {
    const larg = m[0]?.length ?? 0;
    for (let r = 0; r < altezza; r++) for (let c = 0; c < larg; c++) out[r].push(m[r]?.[c] ?? NA);
  }
  return arrayVal(out);
}

function elencoDelimitatori(a: EvalArg | undefined): string[] | null {
  if (a === undefined || (!isRangeArg(a) && a.kind === 'empty')) return [];
  const out: string[] = [];
  for (const c of appiattisci([a])) {
    const t = coerceToText(c);
    if (t.error) return null;
    if (t.value === '') return null;
    out.push(t.value!);
  }
  return out;
}

function dividi(testo: string, delim: string[], minuscole: boolean): string[] {
  if (delim.length === 0) return [testo];
  const pezzi: string[] = [];
  let corrente = '';
  const t = minuscole ? testo.toLowerCase() : testo;
  const d = delim.map((x) => (minuscole ? x.toLowerCase() : x));
  let i = 0;
  while (i < testo.length) {
    const hit = d.map((x, k) => ({ k, x })).filter(({ x }) => t.startsWith(x, i)).sort((p, q) => q.x.length - p.x.length)[0];
    if (hit) { pezzi.push(corrente); corrente = ''; i += hit.x.length; } else { corrente += testo[i]; i++; }
  }
  pezzi.push(corrente);
  return pezzi;
}

export function fnTEXTSPLIT(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 6) return errorVal('#VALUE!');
  if (isRangeArg(args[0])) return errorVal('#VALUE!');
  if (args[0].kind === 'error') return args[0];
  const t = coerceToText(args[0]); if (t.error) return errorVal(t.error);
  const dc = elencoDelimitatori(args[1]); if (dc === null) return errorVal('#VALUE!');
  const dr = elencoDelimitatori(args[2]); if (dr === null) return errorVal('#VALUE!');
  if (dc.length === 0 && dr.length === 0) return errorVal('#VALUE!');
  let ignora = false;
  if (args[3] !== undefined && !(!isRangeArg(args[3]) && args[3].kind === 'empty')) { const b = coerceToBoolean(args[3] as CellValue); if (b.error) return errorVal(b.error); ignora = b.value!; }
  let minuscole = false;
  if (args[4] !== undefined && !(!isRangeArg(args[4]) && args[4].kind === 'empty')) { const m = numero(args[4]); if (m.e) return m.e; minuscole = m.v === 1; }
  const riempi: CellValue = args[5] !== undefined && !isRangeArg(args[5]) && args[5].kind !== 'empty' ? (args[5] as CellValue) : NA;
  const righe = dividi(t.value!, dr, minuscole).map((r) => dividi(r, dc, minuscole)).map((r) => (ignora ? r.filter((x) => x !== '') : r));
  const filtrate = ignora ? righe.filter((r) => r.length > 0) : righe;
  const larghezza = Math.max(1, ...filtrate.map((r) => r.length));
  const out = filtrate.map((r) => Array.from({ length: larghezza }, (_, c) => (c < r.length ? textVal(r[c]) : riempi)));
  return out.length === 1 && out[0].length === 1 ? out[0][0] : arrayVal(out);
}

export function fnRANDARRAY(args: EvalArg[]): CellValue {
  if (args.length > 5) return errorVal('#VALUE!');
  const righe = numero(args[0], 1); if (righe.e) return righe.e;
  const colonne = numero(args[1], 1); if (colonne.e) return colonne.e;
  const min = numero(args[2], 0); if (min.e) return min.e;
  const max = numero(args[3], 1); if (max.e) return max.e;
  let intero = false;
  if (args[4] !== undefined && !isRangeArg(args[4]) && args[4].kind !== 'empty') { const b = coerceToBoolean(args[4] as CellValue); if (b.error) return errorVal(b.error); intero = b.value!; }
  const R = Math.trunc(righe.v!);
  const C = Math.trunc(colonne.v!);
  if (R < 1 || C < 1 || R * C > 1_000_000 || min.v! > max.v!) return errorVal('#VALUE!');
  const out: CellValue[][] = [];
  for (let r = 0; r < R; r++) {
    const riga: CellValue[] = [];
    for (let c = 0; c < C; c++) {
      riga.push(numberVal(intero ? Math.floor(min.v! + Math.random() * (Math.floor(max.v!) - Math.ceil(min.v!) + 1)) : min.v! + Math.random() * (max.v! - min.v!)));
    }
    out.push(riga);
  }
  return out.length === 1 && out[0].length === 1 ? out[0][0] : arrayVal(out);
}

function matriceNumerica(a: EvalArg): number[][] | null {
  const m = comeMatrice(a);
  if (m.length === 0 || m.length !== (m[0]?.length ?? -1)) return null;
  const out: number[][] = [];
  for (const riga of m) {
    const r: number[] = [];
    for (const c of riga) { if (c.kind !== 'number') return null; r.push(c.value); }
    out.push(r);
  }
  return out;
}

export function fnMDETERM(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const m = matriceNumerica(args[0]);
  if (!m) return errorVal('#VALUE!');
  const n = m.length;
  let det = 1;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;
    if (m[p][i] === 0) return numberVal(0);
    if (p !== i) { [m[p], m[i]] = [m[i], m[p]]; det = -det; }
    det *= m[i][i];
    for (let r = i + 1; r < n; r++) {
      const f = m[r][i] / m[i][i];
      for (let c = i; c < n; c++) m[r][c] -= f * m[i][c];
    }
  }
  return numberVal(Number(det.toPrecision(14)));
}

export function fnMINVERSE(args: EvalArg[]): CellValue {
  if (args.length !== 1) return errorVal('#VALUE!');
  const m = matriceNumerica(args[0]);
  if (!m) return errorVal('#VALUE!');
  const n = m.length;
  const a = m.map((riga, i) => [...riga, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-14) return errorVal('#NUM!');
    [a[p], a[i]] = [a[i], a[p]];
    const pivot = a[i][i];
    for (let c = 0; c < 2 * n; c++) a[i][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = a[r][i];
      if (f !== 0) for (let c = 0; c < 2 * n; c++) a[r][c] -= f * a[i][c];
    }
  }
  return arrayVal(a.map((riga) => riga.slice(n).map((x) => numberVal(Number(x.toPrecision(14))))));
}

// ---- trigonometria

const unaria = (f: (x: number) => number) => (args: EvalArg[]): CellValue => {
  if (args.length !== 1) return errorVal('#VALUE!');
  const x = numero(args[0]); if (x.e) return x.e;
  const r = f(x.v!);
  return Number.isFinite(r) ? numberVal(r) : errorVal('#DIV/0!');
};
export const fnSEC = unaria((x) => 1 / Math.cos(x));
export const fnCSC = unaria((x) => 1 / Math.sin(x));
export const fnCOT = unaria((x) => 1 / Math.tan(x));

