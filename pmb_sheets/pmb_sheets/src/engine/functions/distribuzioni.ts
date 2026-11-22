/**
 * Distribuzioni di probabilità e statistiche che Excel ha e che mancavano (2026-11-20): binomiale, Poisson, chi quadrato, F, esponenziale,
 * gamma, lognormale, beta, Weibull, ipergeometrica, binomiale negativa, test Z, intervalli di confidenza, GAMMA, ERF, FISHER, PHI, GAUSS,
 * DEVSQ, STEYX, PROB, MODE.MULT, PERCENTRANK.EXC… e i loro vecchi nomi di Excel 2007 (BINOMDIST, CHIDIST, NORMSDIST, TDIST…), che i file
 * vecchi usano ancora.
 *
 * Scritte da zero dalle definizioni matematiche e dalla documentazione pubblica delle funzioni di Excel; i risultati si confrontano con
 * quelli di Excel installato (tests/file-prova/excel-oracolo). Calcolo: logaritmo della gamma con la serie di Stirling dopo averlo
 * spostato oltre 15, gamma incompleta con la serie (x piccolo) o la frazione continua (x grande), beta incompleta con la frazione continua,
 * inverse per bisezione fino alla precisione della macchina.
 */
import { CellValue, numberVal, errorVal, arrayVal, coerceToNumber, coerceToBoolean } from '../values';
import { EvalArg, isRangeArg, extractAggregationNumbers } from './utils';
import { normaleCdf, normaleInversa } from './extra';
import { tCodaDestra, tDueCode, tInversa } from './student';

// ---------------------------------------------------------------------------
// matematica
// ---------------------------------------------------------------------------

const LN_RADICE_2PI = 0.5 * Math.log(2 * Math.PI);

/** ln Γ(x) per x > 0: si porta x sopra 15 con Γ(x+1) = x·Γ(x), poi la serie di Stirling (errore relativo ~1e-16). */
export function lnGamma(x: number): number {
  let z = x;
  let spostamento = 0;
  while (z < 15) { spostamento += Math.log(z); z += 1; }
  const z2 = 1 / (z * z);
  const serie = (1 / 12 + z2 * (-1 / 360 + z2 * (1 / 1260 + z2 * (-1 / 1680 + z2 * (1 / 1188 + z2 * (-691 / 360360 + z2 / 156)))))) / z;
  return (z - 0.5) * Math.log(z) - z + LN_RADICE_2PI + serie - spostamento;
}

/** Γ(x) per x reale (non 0 né intero negativo): fattoriale esatto per gli interi, riflessione per i negativi. */
function gamma(x: number): number {
  if (Number.isInteger(x) && x > 0 && x <= 171) { let f = 1; for (let i = 2; i < x; i++) f *= i; return f; }
  if (x > 0) return Math.exp(lnGamma(x));
  return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
}

/** ln B(a, b) */
const lnBeta = (a: number, b: number): number => lnGamma(a) + lnGamma(b) - lnGamma(a + b);

/** Gamma incompleta regolarizzata inferiore P(a, x), per la serie. */
function gammaSerie(a: number, x: number): number {
  let termine = 1 / a;
  let somma = termine;
  for (let n = 1; n < 100000; n++) {
    termine *= x / (a + n);
    somma += termine;
    if (Math.abs(termine) < Math.abs(somma) * 1e-17) break;
  }
  return somma * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

/** Gamma incompleta regolarizzata superiore Q(a, x), per la frazione continua (metodo di Lentz). */
function gammaFrazione(a: number, x: number): number {
  const MINIMO = 1e-300;
  let b = x + 1 - a;
  let c = 1 / MINIMO;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 100000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < MINIMO) d = MINIMO;
    c = b + an / c; if (Math.abs(c) < MINIMO) c = MINIMO;
    d = 1 / d;
    const passo = d * c;
    h *= passo;
    if (Math.abs(passo - 1) < 1e-17) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** P(a, x) = γ(a, x) / Γ(a) */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (!Number.isFinite(x)) return 1;
  return x < a + 1 ? Math.min(1, gammaSerie(a, x)) : Math.max(0, 1 - gammaFrazione(a, x));
}
/** Q(a, x) = 1 − P(a, x), calcolata direttamente (precisa anche quando è piccolissima) */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (!Number.isFinite(x)) return 0;
  return x < a + 1 ? Math.max(0, 1 - gammaSerie(a, x)) : Math.min(1, gammaFrazione(a, x));
}

/** Frazione continua della beta incompleta (metodo di Lentz). */
function betaFrazione(x: number, a: number, b: number): number {
  const MINIMO = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < MINIMO) d = MINIMO;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 100000; m++) {
    const m2 = 2 * m;
    let k = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + k * d; if (Math.abs(d) < MINIMO) d = MINIMO;
    c = 1 + k / c; if (Math.abs(c) < MINIMO) c = MINIMO;
    d = 1 / d;
    h *= d * c;
    k = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + k * d; if (Math.abs(d) < MINIMO) d = MINIMO;
    c = 1 + k / c; if (Math.abs(c) < MINIMO) c = MINIMO;
    d = 1 / d;
    const passo = d * c;
    h *= passo;
    if (Math.abs(passo - 1) < 1e-17) break;
  }
  return h;
}

/** Beta incompleta regolarizzata I_x(a, b), 0 ≤ x ≤ 1. */
export function betaRegolarizzata(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const fronte = Math.exp(a * Math.log(x) + b * Math.log1p(-x) - lnBeta(a, b));
  return x < (a + 1) / (a + b + 2) ? (fronte * betaFrazione(x, a, b)) / a : 1 - (fronte * betaFrazione(1 - x, b, a)) / b;
}

/** erf(x) = P(½, x²) col segno di x; erfc(x) = 1 − erf(x) calcolata senza perdere le cifre nella coda. */
function erf(x: number): number { return x === 0 ? 0 : Math.sign(x) * gammaP(0.5, x * x); }
function erfc(x: number): number { return x >= 0 ? gammaQ(0.5, x * x) : 1 + gammaP(0.5, x * x); }

/**
 * Inversa di una funzione monotona per bisezione: il valore x in [minimo, +∞) con f(x) = obiettivo. `crescente` dice il verso di f.
 * Il limite superiore si raddoppia finché non contiene la soluzione; poi si dimezza l'intervallo fino alla precisione della macchina.
 */
function inverti(f: (x: number) => number, obiettivo: number, crescente: boolean, minimo = 0, iniziale = 1): number {
  const sotto = (x: number): boolean => (crescente ? f(x) < obiettivo : f(x) > obiettivo);
  let lo = minimo;
  let hi = Math.max(iniziale, minimo + 1);
  while (sotto(hi) && hi < 1e300) { lo = hi; hi *= 2; }
  for (let i = 0; i < 2000; i++) {
    const mezzo = (lo + hi) / 2;
    if (mezzo === lo || mezzo === hi) break;
    if (sotto(mezzo)) lo = mezzo; else hi = mezzo;
    if (hi - lo <= Math.abs(mezzo) * 2e-16) break;
  }
  return (lo + hi) / 2;
}

/** Combinazioni C(n, k) per interi: prodotto esatto finché si può, logaritmi oltre. */
function combinazioni(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  if (n <= 1029) { let c = 1; for (let i = 1; i <= kk; i++) c = (c * (n - kk + i)) / i; return Math.round(c) === c || c > 2 ** 53 ? c : Math.round(c); }
  return Math.exp(lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1));
}

// ---------------------------------------------------------------------------
// argomenti
// ---------------------------------------------------------------------------

type Num = { v?: number; e?: CellValue };
/** Un numero: un argomento omesso o una cella vuota vale `predefinito` (se c'è) o 0, come in Excel; un intervallo non va bene. */
function numero(a: EvalArg | undefined, predefinito?: number): Num {
  if (a === undefined) return predefinito === undefined ? { e: errorVal('#VALUE!') } : { v: predefinito };
  if (isRangeArg(a)) {
    if (a.rowCount === 1 && a.colCount === 1) return numero(a.get(0, 0), predefinito);
    return { e: errorVal('#VALUE!') };
  }
  if (a.kind === 'empty') return { v: predefinito ?? 0 };
  if (a.kind === 'error') return { e: a };
  if (a.kind === 'array') return numero(a.values[0]?.[0], predefinito);
  const c = coerceToNumber(a);
  return c.error ? { e: errorVal(c.error) } : { v: c.value! };
}
function logico(a: EvalArg | undefined, predefinito?: boolean): { v?: boolean; e?: CellValue } {
  if (a === undefined) return predefinito === undefined ? { e: errorVal('#VALUE!') } : { v: predefinito };
  if (isRangeArg(a)) {
    if (a.rowCount === 1 && a.colCount === 1) return logico(a.get(0, 0), predefinito);
    return { e: errorVal('#VALUE!') };
  }
  if (a.kind === 'empty') return { v: predefinito ?? false };
  if (a.kind === 'error') return { e: a };
  const c = coerceToBoolean(a);
  return c.error ? { e: errorVal(c.error) } : { v: c.value! };
}
/** Legge gli argomenti numerici in ordine; al primo errore lo restituisce. */
function numeri(args: EvalArg[], quanti: number, predefiniti: (number | undefined)[] = []): number[] | CellValue {
  const out: number[] = [];
  for (let i = 0; i < quanti; i++) {
    const n = numero(args[i], predefiniti[i]);
    if (n.e) return n.e;
    out.push(n.v!);
  }
  return out;
}
const eErrore = (x: number[] | CellValue): x is CellValue => !Array.isArray(x);
const NUM = (): CellValue => errorVal('#NUM!');
const VAL = (): CellValue => errorVal('#VALUE!');
function conteggio(args: EvalArg[], min: number, max: number): boolean { return args.length >= min && args.length <= max; }

/** I numeri di un intervallo o di una matrice, nell'ordine (testo, valori logici e celle vuote esclusi); un errore lo restituisce. */
function numeriDi(args: EvalArg[]): number[] | CellValue {
  const r = extractAggregationNumbers(args);
  return r.error ? errorVal(r.error) : r.numbers;
}
/** Le celle di un argomento come tabella. */
function tabella(a: EvalArg): CellValue[][] {
  if (isRangeArg(a)) return a.values;
  if (a.kind === 'array') return a.values;
  return [[a]];
}
/** Coppie (x, y) nella stessa posizione, tenendo solo quelle con due numeri (come Excel per le regressioni). */
function coppie(ay: EvalArg, ax: EvalArg): { ys: number[]; xs: number[] } | CellValue {
  const ty = tabella(ay).flat();
  const tx = tabella(ax).flat();
  if (ty.length !== tx.length) return errorVal('#N/A');
  const ys: number[] = [];
  const xs: number[] = [];
  for (let i = 0; i < ty.length; i++) {
    if (ty[i].kind === 'error') return ty[i];
    if (tx[i].kind === 'error') return tx[i];
    if (ty[i].kind === 'number' && tx[i].kind === 'number') { ys.push((ty[i] as { value: number }).value); xs.push((tx[i] as { value: number }).value); }
  }
  return { ys, xs };
}
const media = (v: number[]): number => v.reduce((s, x) => s + x, 0) / v.length;
function varianzaCampione(v: number[]): number { const m = media(v); return v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1); }

// ---------------------------------------------------------------------------
// distribuzioni discrete
// ---------------------------------------------------------------------------

function binomialeMassa(k: number, n: number, p: number): number {
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  if (n <= 1029) return combinazioni(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  return Math.exp(lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}
function binomialeRipartizione(k: number, n: number, p: number): number {
  if (k >= n) return 1;
  if (n <= 1029) { let s = 0; for (let i = 0; i <= k; i++) s += binomialeMassa(i, n, p); return Math.min(1, s); }
  return betaRegolarizzata(1 - p, n - k, k + 1);
}

export function fnBINOM_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const c = logico(args[3]); if (c.e) return c.e;
  const k = Math.trunc(v[0]); const n = Math.trunc(v[1]); const p = v[2];
  if (k < 0 || k > n || p < 0 || p > 1) return NUM();
  return numberVal(c.v ? binomialeRipartizione(k, n, p) : binomialeMassa(k, n, p));
}

export function fnBINOM_DIST_RANGE(args: EvalArg[]): CellValue {
  if (!conteggio(args, 3, 4)) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const n = Math.trunc(v[0]); const p = v[1]; const s = Math.trunc(v[2]);
  let s2 = s;
  if (args.length === 4) { const x = numero(args[3]); if (x.e) return x.e; s2 = Math.trunc(x.v!); }
  if (n < 0 || p < 0 || p > 1 || s < 0 || s > n || s2 < s || s2 > n) return NUM();
  let somma = 0;
  for (let i = s; i <= s2; i++) somma += binomialeMassa(i, n, p);
  return numberVal(Math.min(1, somma));
}

export function fnBINOM_INV(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const n = Math.trunc(v[0]); const p = v[1]; const alfa = v[2];
  if (n < 0 || p < 0 || p > 1 || alfa <= 0 || alfa >= 1) return NUM();   // come Excel: 0 e 1 esclusi
  let somma = 0;
  for (let k = 0; k <= n; k++) {
    somma += binomialeMassa(k, n, p);
    if (somma >= alfa * (1 - 1e-15)) return numberVal(k);
  }
  return numberVal(n);
}

function poissonMassa(k: number, m: number): number {
  if (m === 0) return k === 0 ? 1 : 0;
  return Math.exp(-m + k * Math.log(m) - lnGamma(k + 1));
}
export function fnPOISSON_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 2); if (eErrore(v)) return v;
  const c = logico(args[2]); if (c.e) return c.e;
  const k = Math.trunc(v[0]); const m = v[1];
  if (k < 0 || m < 0) return NUM();
  if (!c.v) return numberVal(poissonMassa(k, m));
  return numberVal(m === 0 ? 1 : gammaQ(k + 1, m));
}

function ipergeometricaMassa(s: number, n: number, K: number, N: number): number {
  return (combinazioni(K, s) * combinazioni(N - K, n - s)) / combinazioni(N, n);
}
function ipergeometrica(args: EvalArg[], cumulativa: boolean): CellValue {
  const v = numeri(args, 4); if (eErrore(v)) return v;
  const [s, n, K, N] = v.map(Math.trunc);
  if (s < 0 || n <= 0 || n > N || K <= 0 || K > N || N <= 0) return NUM();
  // un numero di successi impossibile (più del campione o dei successi della popolazione) ha probabilità 0, come in Excel
  if (!cumulativa) return numberVal(s > Math.min(n, K) || s < Math.max(0, n - N + K) ? 0 : ipergeometricaMassa(s, n, K, N));
  if (s >= Math.min(n, K)) return numberVal(1);
  let somma = 0;
  for (let i = Math.max(0, n - N + K); i <= s; i++) somma += ipergeometricaMassa(i, n, K, N);
  return numberVal(Math.min(1, somma));
}
export function fnHYPGEOM_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 5) return VAL();
  const c = logico(args[4]); if (c.e) return c.e;
  return ipergeometrica(args, c.v!);
}
export function fnHYPGEOMDIST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return VAL();
  return ipergeometrica(args, false);
}

function binomialeNegativa(args: EvalArg[], cumulativa: boolean): CellValue {
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const f = Math.trunc(v[0]); const s = Math.trunc(v[1]); const p = v[2];
  if (p < 0 || p >= 1 || f < 0 || s < 1) return NUM();   // Excel: #NUM! anche con probabilità 1
  if (cumulativa) return numberVal(betaRegolarizzata(p, s, f + 1));
  if (p === 0) return numberVal(0);
  return numberVal(combinazioni(f + s - 1, s - 1) * Math.pow(p, s) * Math.pow(1 - p, f));
}
export function fnNEGBINOM_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return VAL();
  const c = logico(args[3]); if (c.e) return c.e;
  return binomialeNegativa(args, c.v!);
}
export function fnNEGBINOMDIST(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  return binomialeNegativa(args, false);
}

// ---------------------------------------------------------------------------
// chi quadrato, F
// ---------------------------------------------------------------------------

/** Gradi di libertà come li legge Excel: parte intera, da 1 a 10^10. */
function gradiDiLiberta(x: number): number | null { const g = Math.trunc(x); return g < 1 || g > 1e10 ? null : g; }

function chiDensita(x: number, k: number): number {
  if (x === 0) return k === 2 ? 0.5 : k < 2 ? Infinity : 0;
  return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lnGamma(k / 2));
}
export function fnCHISQ_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 2); if (eErrore(v)) return v;
  const c = logico(args[2]); if (c.e) return c.e;
  const k = gradiDiLiberta(v[1]);
  if (v[0] < 0 || k === null) return NUM();
  return numberVal(c.v ? gammaP(k / 2, v[0] / 2) : chiDensita(v[0], k));
}
export function fnCHISQ_DIST_RT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const v = numeri(args, 2); if (eErrore(v)) return v;
  const k = gradiDiLiberta(v[1]);
  if (v[0] < 0 || k === null) return NUM();
  return numberVal(gammaQ(k / 2, v[0] / 2));
}
export function fnCHISQ_INV(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const v = numeri(args, 2); if (eErrore(v)) return v;
  const k = gradiDiLiberta(v[1]); const p = v[0];
  if (p < 0 || p >= 1 || k === null) return NUM();
  if (p === 0) return numberVal(0);
  return numberVal(inverti((x) => gammaP(k / 2, x / 2), p, true, 0, k));
}
export function fnCHISQ_INV_RT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const v = numeri(args, 2); if (eErrore(v)) return v;
  const k = gradiDiLiberta(v[1]); const p = v[0];
  if (p <= 0 || p > 1 || k === null) return NUM();
  if (p === 1) return numberVal(0);
  return numberVal(inverti((x) => gammaQ(k / 2, x / 2), p, false, 0, k));
}
export function fnCHISQ_TEST(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const oss = tabella(args[0]);
  const att = tabella(args[1]);
  const righe = oss.length; const colonne = oss[0]?.length ?? 0;
  if (att.length !== righe || (att[0]?.length ?? 0) !== colonne) return errorVal('#N/A');
  let chi = 0;
  let n = 0;
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) {
    const o = oss[r][c]; const a = att[r][c];
    if (o.kind === 'error') return o;
    if (a.kind === 'error') return a;
    if (o.kind !== 'number' || a.kind !== 'number') continue;
    if (a.value === 0) return errorVal('#DIV/0!');
    chi += (o.value - a.value) ** 2 / a.value;
    n++;
  }
  const g = righe > 1 && colonne > 1 ? (righe - 1) * (colonne - 1) : n - 1;
  if (g < 1) return errorVal('#N/A');
  return numberVal(gammaQ(g / 2, chi / 2));
}

function fRipartizione(x: number, d1: number, d2: number): number { return x <= 0 ? 0 : betaRegolarizzata((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2); }
function fCodaDestra(x: number, d1: number, d2: number): number { return x <= 0 ? 1 : betaRegolarizzata(d2 / (d2 + d1 * x), d2 / 2, d1 / 2); }
function fDensita(x: number, d1: number, d2: number): number {
  if (x === 0) return d1 === 2 ? 1 : d1 < 2 ? Infinity : 0;
  return Math.exp((d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x) - ((d1 + d2) / 2) * Math.log1p((d1 * x) / d2) - lnBeta(d1 / 2, d2 / 2));
}
function gradiF(v: number[]): [number, number] | null {
  const a = Math.trunc(v[1]); const b = Math.trunc(v[2]);
  return a < 1 || b < 1 || a >= 1e10 || b >= 1e10 ? null : [a, b];
}
export function fnF_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const c = logico(args[3]); if (c.e) return c.e;
  const g = gradiF(v);
  if (v[0] < 0 || !g) return NUM();
  return numberVal(c.v ? fRipartizione(v[0], g[0], g[1]) : fDensita(v[0], g[0], g[1]));
}
export function fnF_DIST_RT(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const g = gradiF(v);
  if (v[0] < 0 || !g) return NUM();
  return numberVal(fCodaDestra(v[0], g[0], g[1]));
}
export function fnF_INV(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const g = gradiF(v); const p = v[0];
  if (p < 0 || p >= 1 || !g) return NUM();
  if (p === 0) return numberVal(0);
  return numberVal(inverti((x) => fRipartizione(x, g[0], g[1]), p, true));
}
export function fnF_INV_RT(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const g = gradiF(v); const p = v[0];
  if (p <= 0 || p > 1 || !g) return NUM();
  if (p === 1) return numberVal(0);
  return numberVal(inverti((x) => fCodaDestra(x, g[0], g[1]), p, false));
}
export function fnF_TEST(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const a = numeriDi([args[0]]); if (eErrore(a)) return a;
  const b = numeriDi([args[1]]); if (eErrore(b)) return b;
  if (a.length < 2 || b.length < 2) return errorVal('#DIV/0!');
  const va = varianzaCampione(a); const vb = varianzaCampione(b);
  if (va === 0 || vb === 0) return errorVal('#DIV/0!');
  const coda = fCodaDestra(va / vb, a.length - 1, b.length - 1);
  return numberVal(2 * Math.min(coda, 1 - coda));
}

// ---------------------------------------------------------------------------
// continue: esponenziale, gamma, lognormale, beta, Weibull
// ---------------------------------------------------------------------------

export function fnEXPON_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 2); if (eErrore(v)) return v;
  const c = logico(args[2]); if (c.e) return c.e;
  const [x, l] = v;
  if (x < 0 || l <= 0) return NUM();
  return numberVal(c.v ? -Math.expm1(-l * x) : l * Math.exp(-l * x));
}

function gammaDensita(x: number, a: number, b: number): number {
  if (x === 0) return a <= 1 ? Infinity : 0;   // Excel: #NUM! per alfa ≤ 1
  return Math.exp((a - 1) * Math.log(x) - x / b - a * Math.log(b) - lnGamma(a));
}
export function fnGAMMA_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const c = logico(args[3]); if (c.e) return c.e;
  const [x, a, b] = v;
  if (x < 0 || a <= 0 || b <= 0) return NUM();
  return numberVal(c.v ? gammaP(a, x / b) : gammaDensita(x, a, b));
}
export function fnGAMMA_INV(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const [p, a, b] = v;
  if (p < 0 || p >= 1 || a <= 0 || b <= 0) return NUM();
  if (p === 0) return numberVal(0);
  return numberVal(b * inverti((x) => gammaP(a, x), p, true, 0, a));
}

export function fnLOGNORM_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const c = logico(args[3]); if (c.e) return c.e;
  const [x, m, s] = v;
  if (x <= 0 || s <= 0) return NUM();
  const z = (Math.log(x) - m) / s;
  return numberVal(c.v ? normaleCdf(z) : Math.exp(-0.5 * z * z) / (x * s * Math.sqrt(2 * Math.PI)));
}
export function fnLOGNORMDIST(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  return fnLOGNORM_DIST([args[0], args[1], args[2], { kind: 'boolean', value: true }]);
}
export function fnLOGNORM_INV(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const [p, m, s] = v;
  if (p <= 0 || p >= 1 || s <= 0) return NUM();
  return numberVal(Math.exp(m + s * normaleInversa(p)));
}

function beta(args: EvalArg[], cumulativa: boolean, inizioLimiti: number): CellValue {
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const lim = numeri(args.slice(inizioLimiti), 2, [0, 1]); if (eErrore(lim)) return lim;
  const [x, a, b] = v; const [A, B] = lim;
  if (a <= 0 || b <= 0 || x < A || x > B || A === B) return NUM();
  const y = (x - A) / (B - A);
  if (cumulativa) return numberVal(betaRegolarizzata(y, a, b));
  if ((y === 0 && a < 1) || (y === 1 && b < 1)) return NUM();
  if (y === 0) return numberVal(a === 1 ? b / (B - A) : 0);
  if (y === 1) return numberVal(b === 1 ? a / (B - A) : 0);
  return numberVal(Math.exp((a - 1) * Math.log(y) + (b - 1) * Math.log1p(-y) - lnBeta(a, b)) / (B - A));
}
export function fnBETA_DIST(args: EvalArg[]): CellValue {
  if (!conteggio(args, 4, 6)) return VAL();
  const c = logico(args[3]); if (c.e) return c.e;
  return beta([args[0], args[1], args[2], ...args.slice(4)], c.v!, 3);
}
export function fnBETADIST(args: EvalArg[]): CellValue {
  if (!conteggio(args, 3, 5)) return VAL();
  return beta(args, true, 3);
}
export function fnBETA_INV(args: EvalArg[]): CellValue {
  if (!conteggio(args, 3, 5)) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const lim = numeri(args.slice(3), 2, [0, 1]); if (eErrore(lim)) return lim;
  const [p, a, b] = v; const [A, B] = lim;
  if (p <= 0 || p >= 1 || a <= 0 || b <= 0 || A >= B) return NUM();   // come Excel: 0 e 1 esclusi
  // bisezione su [0, 1]
  let lo = 0; let hi = 1;
  for (let i = 0; i < 2000; i++) {
    const m = (lo + hi) / 2;
    if (m === lo || m === hi) break;
    if (betaRegolarizzata(m, a, b) < p) lo = m; else hi = m;
  }
  return numberVal(A + ((lo + hi) / 2) * (B - A));
}

export function fnWEIBULL_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const c = logico(args[3]); if (c.e) return c.e;
  const [x, a, b] = v;
  if (x < 0 || a <= 0 || b <= 0) return NUM();
  const t = Math.pow(x / b, a);
  if (c.v) return numberVal(-Math.expm1(-t));
  if (x === 0) return numberVal(a === 1 ? 1 / b : 0);   // Excel dà 0 anche per alfa < 1
  return numberVal((a / b) * Math.pow(x / b, a - 1) * Math.exp(-t));
}

// ---------------------------------------------------------------------------
// test e intervalli
// ---------------------------------------------------------------------------

export function fnZ_TEST(args: EvalArg[]): CellValue {
  if (!conteggio(args, 2, 3)) return VAL();
  const dati = numeriDi([args[0]]); if (eErrore(dati)) return dati;
  const x = numero(args[1]); if (x.e) return x.e;
  if (dati.length === 0) return errorVal('#N/A');
  let sigma: number;
  if (args.length === 3) { const s = numero(args[2]); if (s.e) return s.e; sigma = s.v!; }
  else { if (dati.length < 2) return errorVal('#DIV/0!'); sigma = Math.sqrt(varianzaCampione(dati)); }
  if (sigma === 0) return args.length === 3 ? NUM() : errorVal('#DIV/0!');
  return numberVal(1 - normaleCdf((media(dati) - x.v!) / (sigma / Math.sqrt(dati.length))));
}

export function fnCONFIDENCE_NORM(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const [alfa, s] = v; const n = Math.trunc(v[2]);
  if (alfa <= 0 || alfa >= 1 || s <= 0 || n < 1) return NUM();
  return numberVal((normaleInversa(1 - alfa / 2) * s) / Math.sqrt(n));
}
export function fnCONFIDENCE_T(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const [alfa, s] = v; const n = Math.trunc(v[2]);
  if (alfa <= 0 || alfa >= 1 || s <= 0 || n < 1) return NUM();
  if (n === 1) return errorVal('#DIV/0!');
  return numberVal((tInversa(1 - alfa / 2, n - 1) * s) / Math.sqrt(n));
}

/** TDIST(x; gradi; code) di Excel 2007: x non negativo, una o due code. */
export function fnTDIST(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const x = v[0]; const g = Math.trunc(v[1]); const code = Math.trunc(v[2]);
  if (x < 0 || g < 1 || (code !== 1 && code !== 2)) return NUM();
  return numberVal(code === 1 ? tCodaDestra(x, g) : tDueCode(x, g));
}

// ---------------------------------------------------------------------------
// altre statistiche
// ---------------------------------------------------------------------------

export function fnGAMMA(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const x = numero(args[0]); if (x.e) return x.e;
  const n = x.v!;
  if ((n <= 0 && Number.isInteger(n)) || n > 171.6243769563027) return NUM();
  return numberVal(gamma(n));
}
export function fnGAMMALN(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const x = numero(args[0]); if (x.e) return x.e;
  if (x.v! <= 0) return NUM();
  return numberVal(lnGamma(x.v!));
}
export function fnFISHER(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const x = numero(args[0]); if (x.e) return x.e;
  if (x.v! <= -1 || x.v! >= 1) return NUM();
  return numberVal(Math.atanh(x.v!));
}
export function fnFISHERINV(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const x = numero(args[0]); if (x.e) return x.e;
  return numberVal(Math.tanh(x.v!));
}
export function fnPHI(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const x = numero(args[0]); if (x.e) return x.e;
  return numberVal(Math.exp(-0.5 * x.v! * x.v!) / Math.sqrt(2 * Math.PI));
}
export function fnGAUSS(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const x = numero(args[0]); if (x.e) return x.e;
  return numberVal(0.5 * erf(x.v! / Math.SQRT2));
}
export function fnSTANDARDIZE(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  if (v[2] <= 0) return NUM();
  return numberVal((v[0] - v[1]) / v[2]);
}
export function fnDEVSQ(args: EvalArg[]): CellValue {
  if (args.length < 1) return VAL();
  const v = numeriDi(args); if (eErrore(v)) return v;
  if (v.length === 0) return NUM();
  const m = media(v);
  return numberVal(v.reduce((s, x) => s + (x - m) ** 2, 0));
}
export function fnSTEYX(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const c = coppie(args[0], args[1]); if ('kind' in c) return c;
  const { ys, xs } = c;
  const n = ys.length;
  if (n < 3) return errorVal('#DIV/0!');
  const mx = media(xs); const my = media(ys);
  let sxx = 0; let sxy = 0; let syy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  if (sxx === 0) return errorVal('#DIV/0!');
  return numberVal(Math.sqrt(Math.max(0, (syy - (sxy * sxy) / sxx) / (n - 2))));
}
export function fnPERMUTATIONA(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const v = numeri(args, 2); if (eErrore(v)) return v;
  const n = Math.trunc(v[0]); const k = Math.trunc(v[1]);
  if (n < 0 || k < 0) return NUM();
  return numberVal(Math.pow(n, k));
}
export function fnSKEW_P(args: EvalArg[]): CellValue {
  if (args.length < 1) return VAL();
  const v = numeriDi(args); if (eErrore(v)) return v;
  if (v.length === 0) return errorVal('#DIV/0!');
  const m = media(v);
  const s = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / v.length);
  if (s === 0) return errorVal('#DIV/0!');
  return numberVal(v.reduce((a, x) => a + ((x - m) / s) ** 3, 0) / v.length);
}
export function fnPROB(args: EvalArg[]): CellValue {
  if (!conteggio(args, 3, 4)) return VAL();
  const xs = tabella(args[0]).flat();
  const ps = tabella(args[1]).flat();
  if (xs.length !== ps.length) return errorVal('#N/A');
  const basso = numero(args[2]); if (basso.e) return basso.e;
  const limite = numero(args[3], basso.v!); if (limite.e) return limite.e;   // senza limite superiore conta solo x = limite inferiore
  const alto = limite.v!;
  let totale = 0;
  let somma = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]; const p = ps[i];
    if (x.kind === 'error') return x;
    if (p.kind === 'error') return p;
    if (p.kind !== 'number' || x.kind !== 'number') continue;
    if (p.value < 0 || p.value > 1) return NUM();
    totale += p.value;
    if (x.value >= basso.v! && x.value <= alto) somma += p.value;
  }
  if (Math.abs(totale - 1) > 1e-7) return NUM();
  return numberVal(somma);
}
export function fnPERCENTRANK_EXC(args: EvalArg[]): CellValue {
  if (!conteggio(args, 2, 3)) return VAL();
  const dati = numeriDi([args[0]]); if (eErrore(dati)) return dati;
  const x = numero(args[1]); if (x.e) return x.e;
  const cifre = numero(args[2], 3); if (cifre.e) return cifre.e;
  const sig = Math.trunc(cifre.v!);
  if (dati.length === 0 || sig < 1) return NUM();
  const v = [...dati].sort((a, b) => a - b);
  const n = v.length;
  if (x.v! < v[0] || x.v! > v[n - 1]) return errorVal('#N/A');
  const posto = (i: number): number => (i + 1) / (n + 1);
  let rango: number;
  const esatto = v.indexOf(x.v!);
  if (esatto >= 0) rango = posto(esatto);
  else {
    let i = 0;
    while (v[i + 1] < x.v!) i++;
    rango = posto(i) + ((x.v! - v[i]) / (v[i + 1] - v[i])) * (posto(i + 1) - posto(i));
  }
  const f = Math.pow(10, sig);
  return numberVal(Math.floor(rango * f + 1e-9) / f);
}
export function fnERF(args: EvalArg[]): CellValue {
  if (!conteggio(args, 1, 2)) return VAL();
  const a = numero(args[0]); if (a.e) return a.e;
  if (args.length === 1) return numberVal(erf(a.v!));
  const b = numero(args[1]); if (b.e) return b.e;
  return numberVal(erf(b.v!) - erf(a.v!));
}
export function fnERF_PRECISE(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  return fnERF(args);
}
export function fnERFC(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const a = numero(args[0]); if (a.e) return a.e;
  return numberVal(erfc(a.v!));
}
export function fnMODE_MULT(args: EvalArg[]): CellValue {
  if (args.length < 1) return VAL();
  const v = numeriDi(args); if (eErrore(v)) return v;
  const volte = new Map<number, number>();
  for (const x of v) volte.set(x, (volte.get(x) ?? 0) + 1);
  let massimo = 0;
  for (const c of volte.values()) massimo = Math.max(massimo, c);
  if (massimo < 2) return errorVal('#N/A');
  const mode: number[] = [];
  for (const [x, c] of volte) if (c === massimo) mode.push(x);
  return arrayVal(mode.map((x) => [numberVal(x)]));
}
