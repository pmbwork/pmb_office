/**
 * Distribuzione t di Student e T.TEST: T.DIST, T.DIST.2T, T.DIST.RT, T.INV, T.INV.2T, T.TEST.
 * Il calcolo passa dalla funzione beta incompleta regolarizzata (frazione continua di Lentz), la stessa strada dei programmi statistici:
 * P(T > |t|) = ½ · I_x(ν/2, ½) con x = ν / (ν + t²). I valori si controllano contro scipy nei test.
 */
import { CellValue, numberVal, errorVal, coerceToNumber, coerceToBoolean } from '../values';
import { EvalArg, isRangeArg } from './utils';

// ---- matematica

/** Logaritmo della funzione gamma (approssimazione di Lanczos, precisione ~1e-15 per x > 0). */
function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Frazione continua della beta incompleta (metodo di Lentz). */
function betaCf(x: number, a: number, b: number): number {
  const TINY = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return h;
}

/** Beta incompleta regolarizzata I_x(a, b), per 0 ≤ x ≤ 1. */
export function betaIncompleta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betaCf(x, a, b)) / a : 1 - (bt * betaCf(1 - x, b, a)) / b;
}

/** Probabilità che T superi |t| da un solo lato, con `gdl` gradi di libertà (anche non interi). */
function codaUnLato(absT: number, gdl: number): number {
  if (!Number.isFinite(absT)) return 0;
  return 0.5 * betaIncompleta(gdl / (gdl + absT * absT), gdl / 2, 0.5);
}

/** Funzione di ripartizione: P(T ≤ t). */
export function tRipartizione(t: number, gdl: number): number {
  const coda = codaUnLato(Math.abs(t), gdl);
  return t > 0 ? 1 - coda : coda;
}

/** Coda destra: P(T > t). */
export function tCodaDestra(t: number, gdl: number): number {
  const coda = codaUnLato(Math.abs(t), gdl);
  return t > 0 ? coda : 1 - coda;
}

/** Due code: P(|T| > |t|). */
export function tDueCode(t: number, gdl: number): number {
  return 2 * codaUnLato(Math.abs(t), gdl);
}

/** Densità di probabilità. */
export function tDensita(t: number, gdl: number): number {
  return Math.exp(logGamma((gdl + 1) / 2) - logGamma(gdl / 2) - 0.5 * Math.log(gdl * Math.PI) - ((gdl + 1) / 2) * Math.log(1 + (t * t) / gdl));
}

/** Inversa della ripartizione: il t tale che P(T ≤ t) = p, per 0 < p < 1 (ricerca per bisezione sulla coda, precisione piena). */
export function tInversa(p: number, gdl: number): number {
  if (p === 0.5) return 0;
  const sopra = p > 0.5;
  const coda = sopra ? 1 - p : p;               // probabilità nella coda, in (0, 0.5)
  // si cerca t ≥ 0 con coda unilatera = `coda`: la coda è decrescente in t
  let lo = 0;
  let hi = 1;
  while (codaUnLato(hi, gdl) > coda && hi < 1e300) hi *= 2;
  for (let i = 0; i < 400; i++) {
    const mid = (lo + hi) / 2;
    if (codaUnLato(mid, gdl) > coda) lo = mid; else hi = mid;
    if (hi - lo <= Math.abs(hi) * 1e-16) break;
  }
  const t = (lo + hi) / 2;
  return sopra ? t : -t;
}

// ---- aiuti per gli argomenti

function comeMatrice(a: EvalArg): CellValue[][] {
  if (isRangeArg(a)) return a.values;
  if (a.kind === 'array') return a.values;
  return [[a]];
}

const numero = (a: EvalArg | undefined): { v?: number; e?: CellValue } => {
  if (a === undefined || (!isRangeArg(a) && a.kind === 'empty')) return { e: errorVal('#VALUE!') };
  if (isRangeArg(a)) return { e: errorVal('#VALUE!') };
  if (a.kind === 'error') return { e: a };
  const c = coerceToNumber(a);
  return c.error ? { e: errorVal(c.error) } : { v: c.value! };
};

/** I gradi di libertà come li legge Excel: la parte intera, almeno 1. */
function gradi(a: EvalArg | undefined): { v?: number; e?: CellValue } {
  const g = numero(a);
  if (g.e) return g;
  const n = Math.trunc(g.v!);
  return n < 1 ? { e: errorVal('#NUM!') } : { v: n };
}

// ---- le funzioni

export function fnT_DIST(args: EvalArg[]): CellValue {
  if (args.length !== 3) return errorVal('#VALUE!');
  const x = numero(args[0]); if (x.e) return x.e;
  const g = gradi(args[1]); if (g.e) return g.e;
  if (isRangeArg(args[2])) return errorVal('#VALUE!');
  const cum = coerceToBoolean(args[2]);
  if (cum.error) return errorVal(cum.error);
  return numberVal(cum.value ? tRipartizione(x.v!, g.v!) : tDensita(x.v!, g.v!));
}

export function fnT_DIST_2T(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const x = numero(args[0]); if (x.e) return x.e;
  const g = gradi(args[1]); if (g.e) return g.e;
  if (x.v! < 0) return errorVal('#NUM!');
  return numberVal(tDueCode(x.v!, g.v!));
}

export function fnT_DIST_RT(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const x = numero(args[0]); if (x.e) return x.e;
  const g = gradi(args[1]); if (g.e) return g.e;
  return numberVal(tCodaDestra(x.v!, g.v!));
}

export function fnT_INV(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const p = numero(args[0]); if (p.e) return p.e;
  const g = gradi(args[1]); if (g.e) return g.e;
  if (p.v! <= 0 || p.v! >= 1) return errorVal('#NUM!');
  return numberVal(tInversa(p.v!, g.v!));
}

export function fnT_INV_2T(args: EvalArg[]): CellValue {
  if (args.length !== 2) return errorVal('#VALUE!');
  const p = numero(args[0]); if (p.e) return p.e;
  const g = gradi(args[1]); if (g.e) return g.e;
  if (p.v! <= 0 || p.v! > 1) return errorVal('#NUM!');
  return numberVal(tInversa(1 - p.v! / 2, g.v!));
}

function mediaEVarianza(v: number[]): { media: number; varianza: number } {
  const media = v.reduce((s, x) => s + x, 0) / v.length;
  const varianza = v.reduce((s, x) => s + (x - media) * (x - media), 0) / (v.length - 1);
  return { media, varianza };
}

/** T.TEST(matrice1, matrice2, code, tipo): probabilità del test t. Tipo 1 = a coppie, 2 = due campioni con la stessa varianza, 3 = due campioni con varianze diverse (Welch). */
export function fnT_TEST(args: EvalArg[]): CellValue {
  if (args.length !== 4) return errorVal('#VALUE!');
  const code = numero(args[2]); if (code.e) return code.e;
  const tipo = numero(args[3]); if (tipo.e) return tipo.e;
  const nCode = Math.trunc(code.v!);
  const nTipo = Math.trunc(tipo.v!);
  if ((nCode !== 1 && nCode !== 2) || (nTipo !== 1 && nTipo !== 2 && nTipo !== 3)) return errorVal('#NUM!');
  const m1 = comeMatrice(args[0]).flat();
  const m2 = comeMatrice(args[1]).flat();
  for (const c of [...m1, ...m2]) if (c.kind === 'error') return c;
  let t: number;
  let gdl: number;
  if (nTipo === 1) {
    if (m1.length !== m2.length) return errorVal('#N/A');
    const diff: number[] = [];
    for (let i = 0; i < m1.length; i++) {
      const a = m1[i]; const b = m2[i];
      if (a.kind === 'number' && b.kind === 'number') diff.push(a.value - b.value);
    }
    if (diff.length < 2) return errorVal('#DIV/0!');
    const { media, varianza } = mediaEVarianza(diff);
    if (varianza === 0) return errorVal('#DIV/0!');
    t = media / Math.sqrt(varianza / diff.length);
    gdl = diff.length - 1;
  } else {
    const a = m1.filter((c): c is Extract<CellValue, { kind: 'number' }> => c.kind === 'number').map((c) => c.value);
    const b = m2.filter((c): c is Extract<CellValue, { kind: 'number' }> => c.kind === 'number').map((c) => c.value);
    if (a.length < 2 || b.length < 2) return errorVal('#DIV/0!');
    const s1 = mediaEVarianza(a);
    const s2 = mediaEVarianza(b);
    if (nTipo === 2) {
      gdl = a.length + b.length - 2;
      const raggruppata = ((a.length - 1) * s1.varianza + (b.length - 1) * s2.varianza) / gdl;
      if (raggruppata === 0) return errorVal('#DIV/0!');
      t = (s1.media - s2.media) / Math.sqrt(raggruppata * (1 / a.length + 1 / b.length));
    } else {
      const e1 = s1.varianza / a.length;
      const e2 = s2.varianza / b.length;
      if (e1 + e2 === 0) return errorVal('#DIV/0!');
      t = (s1.media - s2.media) / Math.sqrt(e1 + e2);
      gdl = ((e1 + e2) * (e1 + e2)) / ((e1 * e1) / (a.length - 1) + (e2 * e2) / (b.length - 1));
    }
  }
  return numberVal(nCode === 1 ? codaUnLato(Math.abs(t), gdl) : tDueCode(t, gdl));
}
