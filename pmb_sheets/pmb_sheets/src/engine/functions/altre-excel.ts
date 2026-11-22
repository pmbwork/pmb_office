/**
 * Altre funzioni di Excel che mancavano (2026-11-20): trigonometria iperbolica e inversa (ACOT, ACOTH, COTH, CSCH, SECH), arrotondamenti
 * «precisi» (CEILING.PRECISE, FLOOR.PRECISE, ISO.CEILING), MUNIT, finanziarie (VDB, ISPMT, FVSCHEDULE, PDURATION, RRI, DOLLARDE, DOLLARFR)
 * e testo (TEXTBEFORE, TEXTAFTER, VALUETOTEXT, ARRAYTOTEXT).
 *
 * Scritte da zero dalla documentazione pubblica delle funzioni di Excel; i risultati si confrontano con Excel installato
 * (tests/file-prova/excel-oracolo). VALUETOTEXT e ARRAYTOTEXT scrivono i numeri e le matrici con i separatori interni del motore
 * (punto decimale, «,» tra le colonne e «;» tra le righe), come gli altri testi prodotti dalle formule.
 */
import { CellValue, numberVal, textVal, errorVal, arrayVal, coerceToNumber, coerceToText, coerceToBoolean } from '../values';
import { EvalArg, isRangeArg } from './utils';

type Num = { v?: number; e?: CellValue };
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
function numeri(args: EvalArg[], quanti: number, predefiniti: (number | undefined)[] = []): number[] | CellValue {
  const out: number[] = [];
  for (let i = 0; i < quanti; i++) { const n = numero(args[i], predefiniti[i]); if (n.e) return n.e; out.push(n.v!); }
  return out;
}
const eErrore = (x: number[] | CellValue): x is CellValue => !Array.isArray(x);
const NUM = (): CellValue => errorVal('#NUM!');
const VAL = (): CellValue => errorVal('#VALUE!');
function tabella(a: EvalArg): CellValue[][] {
  if (isRangeArg(a)) return a.values;
  if (a.kind === 'array') return a.values;
  return [[a]];
}
/** Arrotonda a 15 cifre significative (toglie i resti binari come 0,24000000000000002). */
const quindiciCifre = (x: number): number => (x === 0 || !Number.isFinite(x) ? x : Number(x.toPrecision(15)));

function unoNumero(args: EvalArg[], f: (x: number) => CellValue): CellValue {
  if (args.length !== 1) return VAL();
  const x = numero(args[0]); if (x.e) return x.e;
  return f(x.v!);
}

// ---- trigonometria
export const fnACOT = (args: EvalArg[]): CellValue => unoNumero(args, (x) => numberVal(Math.PI / 2 - Math.atan(x)));
export const fnACOTH = (args: EvalArg[]): CellValue => unoNumero(args, (x) => (Math.abs(x) <= 1 ? NUM() : numberVal(0.5 * Math.log((x + 1) / (x - 1)))));
export const fnCOTH = (args: EvalArg[]): CellValue => unoNumero(args, (x) => (x === 0 ? errorVal('#DIV/0!') : numberVal(1 / Math.tanh(x))));
export const fnCSCH = (args: EvalArg[]): CellValue => unoNumero(args, (x) => (x === 0 ? errorVal('#DIV/0!') : numberVal(1 / Math.sinh(x))));
export const fnSECH = (args: EvalArg[]): CellValue => unoNumero(args, (x) => numberVal(1 / Math.cosh(x)));

// ---- arrotondamenti
/** Multiplo di `passo` verso +∞ (alto) o verso −∞ (basso), qualunque sia il segno del passo. */
function multiplo(n: number, passo: number, alto: boolean): number {
  const s = Math.abs(passo);
  if (s === 0 || n === 0) return 0;
  let q = n / s;
  const vicino = Math.round(q);
  if (Math.abs(q - vicino) < 1e-12 * Math.max(1, Math.abs(q))) q = vicino;
  return quindiciCifre((alto ? Math.ceil(q) : Math.floor(q)) * s);
}
function arrotondaPreciso(args: EvalArg[], alto: boolean): CellValue {
  if (args.length < 1 || args.length > 2) return VAL();
  const v = numeri(args, 2, [undefined, 1]); if (eErrore(v)) return v;
  return numberVal(multiplo(v[0], v[1], alto));
}
export const fnCEILING_PRECISE = (args: EvalArg[]): CellValue => arrotondaPreciso(args, true);
export const fnFLOOR_PRECISE = (args: EvalArg[]): CellValue => arrotondaPreciso(args, false);

export function fnMUNIT(args: EvalArg[]): CellValue {
  if (args.length !== 1) return VAL();
  const x = numero(args[0]); if (x.e) return x.e;
  const n = Math.trunc(x.v!);
  if (n < 1) return VAL();
  if (n > 10000) return NUM();
  const righe: CellValue[][] = [];
  for (let r = 0; r < n; r++) { const riga: CellValue[] = []; for (let c = 0; c < n; c++) riga.push(numberVal(r === c ? 1 : 0)); righe.push(riga); }
  return arrayVal(righe);
}

// ---- finanziarie

/**
 * VDB: ammortamento a quote decrescenti (di `fattore` volte la quota costante) tra il periodo `inizio` e il periodo `fine`, anche frazionari.
 * Ogni periodo intero ammortizza il valore residuo × fattore / vita, senza scendere sotto il valore di recupero; quando la quota costante sul
 * residuo (residuo − recupero) / periodi rimasti diventa più grande, si passa a quella (se `senzaPassaggio` è falso). Dentro un periodo la
 * quota si divide in proporzione.
 */
export function fnVDB(args: EvalArg[]): CellValue {
  if (args.length < 5 || args.length > 7) return VAL();
  const v = numeri(args, 6, [undefined, undefined, undefined, undefined, undefined, 2]); if (eErrore(v)) return v;
  const [costo, recupero, vita, inizio, fine, fattore] = v;
  let senzaPassaggio = false;
  if (args.length === 7 && !isRangeArg(args[6]) && args[6].kind !== 'empty') {
    const b = coerceToBoolean(args[6] as CellValue); if (b.error) return errorVal(b.error); senzaPassaggio = b.value!;
  }
  if (costo < 0 || recupero < 0 || vita <= 0 || inizio < 0 || fine < inizio || fine > vita || fattore <= 0) return NUM();
  /**
   * Ammortamento dal tempo `da` al tempo `a`, partendo dal valore residuo `residuo`: periodi lunghi 1 contati da `da` (l'ultimo può essere
   * più corto e prende la quota in proporzione). Così fa Excel con un inizio frazionario: VDB(…; 3,5; 7,25) conta 3,5→4,5→5,5→6,5→7,25
   * sul residuo a 3,5 (ricostruito confrontando i risultati di Excel installato).
   */
  const percorri = (residuo: number, da: number, a: number): number => {
    let totale = 0;
    for (let t = da; t < a - 1e-12; t += 1) {
      const durata = Math.min(1, a - t);
      let decrescente = (residuo * fattore) / vita;
      if (residuo - decrescente < recupero) decrescente = Math.max(0, residuo - recupero);
      const rimasti = vita - t;
      const lineare = rimasti > 0 ? (residuo - recupero) / rimasti : 0;
      let q = !senzaPassaggio && lineare > decrescente ? lineare : decrescente;
      q = Math.max(0, Math.min(q * durata, residuo - recupero));
      residuo -= q;
      totale += q;
    }
    return totale;
  };
  const primaDellInizio = percorri(costo, 0, inizio);
  return numberVal(percorri(costo - primaDellInizio, inizio, fine));
}

export function fnISPMT(args: EvalArg[]): CellValue {
  if (args.length !== 4) return VAL();
  const v = numeri(args, 4); if (eErrore(v)) return v;
  const [tasso, per, nper, va] = v;
  if (nper === 0) return errorVal('#DIV/0!');
  return numberVal(va * tasso * (per / nper - 1));
}

export function fnFVSCHEDULE(args: EvalArg[]): CellValue {
  if (args.length !== 2) return VAL();
  const p = numero(args[0]); if (p.e) return p.e;
  let valore = p.v!;
  for (const c of tabella(args[1]).flat()) {
    if (c.kind === 'error') return c;
    if (c.kind === 'empty') continue;
    const n = coerceToNumber(c); if (n.error) return VAL();
    valore *= 1 + n.value!;
  }
  return numberVal(valore);
}

export function fnPDURATION(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const [tasso, va, vf] = v;
  if (tasso <= 0 || va <= 0 || vf <= 0) return NUM();
  return numberVal((Math.log(vf) - Math.log(va)) / Math.log1p(tasso));
}

export function fnRRI(args: EvalArg[]): CellValue {
  if (args.length !== 3) return VAL();
  const v = numeri(args, 3); if (eErrore(v)) return v;
  const [nper, va, vf] = v;
  if (nper <= 0 || va === 0) return NUM();
  return numberVal(Math.pow(vf / va, 1 / nper) - 1);
}

/** Cifre decimali che servono per scrivere i numeratori di una frazione con denominatore `d` (16 → 2, 100 → 2, 8 → 1). */
const cifreFrazione = (d: number): number => Math.max(1, Math.ceil(Math.log10(d) - 1e-12));
function dollaro(args: EvalArg[], decimale: boolean): CellValue {
  if (args.length !== 2) return VAL();
  const v = numeri(args, 2); if (eErrore(v)) return v;
  const d = Math.trunc(v[1]);
  if (d < 0) return NUM();
  if (d === 0) return errorVal('#DIV/0!');
  const segno = v[0] < 0 ? -1 : 1;
  const x = Math.abs(v[0]);
  const intero = Math.floor(x);
  const parte = x - intero;
  const scala = Math.pow(10, cifreFrazione(d));
  const r = decimale ? intero + (parte * scala) / d : intero + (parte * d) / scala;
  return numberVal(segno * quindiciCifre(r));
}
export const fnDOLLARDE = (args: EvalArg[]): CellValue => dollaro(args, true);
export const fnDOLLARFR = (args: EvalArg[]): CellValue => dollaro(args, false);

// ---- testo

interface Taglio { inizio: number; fine: number }
/**
 * Dove si taglia il testo per TEXTBEFORE e TEXTAFTER: la n-esima occorrenza di uno dei separatori (da sinistra se n > 0, da destra se n < 0).
 * Con `fineComeSeparatore` la fine del testo (da sinistra) o il suo inizio (da destra) contano come un separatore in più.
 */
function trovaTaglio(testo: string, separatori: string[], n: number, ignoraMaiuscole: boolean, fineComeSeparatore: boolean): Taglio | null {
  const t = ignoraMaiuscole ? testo.toLowerCase() : testo;
  const seps = separatori.map((s) => (ignoraMaiuscole ? s.toLowerCase() : s));
  if (seps.some((s) => s === '')) return n > 0 ? { inizio: 0, fine: 0 } : { inizio: testo.length, fine: testo.length };
  const trovati: Taglio[] = [];
  let i = 0;
  while (i <= t.length) {
    let migliore: Taglio | null = null;
    for (const s of seps) {
      const p = t.indexOf(s, i);
      if (p >= 0 && (migliore === null || p < migliore.inizio || (p === migliore.inizio && p + s.length > migliore.fine))) migliore = { inizio: p, fine: p + s.length };
    }
    if (!migliore) break;
    trovati.push(migliore);
    i = migliore.fine;
  }
  if (n > 0) {
    if (n <= trovati.length) return trovati[n - 1];
    return fineComeSeparatore && n === trovati.length + 1 ? { inizio: testo.length, fine: testo.length } : null;
  }
  const k = -n;
  if (k <= trovati.length) return trovati[trovati.length - k];
  return fineComeSeparatore && k === trovati.length + 1 ? { inizio: 0, fine: 0 } : null;
}

function testoPrimaDopo(args: EvalArg[], prima: boolean): CellValue {
  if (args.length < 2 || args.length > 6) return VAL();
  const separatori: string[] = [];
  for (const c of tabella(args[1]).flat()) {
    if (c.kind === 'error') return c;
    const s = coerceToText(c); if (s.error) return errorVal(s.error);
    separatori.push(s.value!);
  }
  const v = numeri(args.slice(2), 3, [1, 0, 0]); if (eErrore(v)) return v;
  const n = Math.trunc(v[0]);
  const ignora = v[1] !== 0;
  const fine = v[2] !== 0;
  const seNonTrovato: CellValue | undefined = args.length === 6 && !isRangeArg(args[5]) && args[5].kind !== 'empty' ? (args[5] as CellValue)
    : args.length === 6 && isRangeArg(args[5]) ? args[5].get(0, 0) : undefined;
  const una = (c: CellValue): CellValue => {
    if (c.kind === 'error') return c;
    const s = coerceToText(c); if (s.error) return errorVal(s.error);
    const testo = s.value!;
    if (n === 0 || Math.abs(n) > testo.length) return n === 0 || testo.length > 0 ? VAL() : seNonTrovato ?? errorVal('#N/A');
    const taglio = trovaTaglio(testo, separatori, n, ignora, fine);
    if (!taglio) return seNonTrovato ?? errorVal('#N/A');
    return textVal(prima ? testo.slice(0, taglio.inizio) : testo.slice(taglio.fine));
  };
  const t = args[0];
  if (isRangeArg(t) || t.kind === 'array') {
    const celle = tabella(t);
    if (celle.length === 1 && celle[0].length === 1) return una(celle[0][0]);
    return arrayVal(celle.map((r) => r.map(una)));
  }
  return una(t);
}
export const fnTEXTBEFORE = (args: EvalArg[]): CellValue => testoPrimaDopo(args, true);
export const fnTEXTAFTER = (args: EvalArg[]): CellValue => testoPrimaDopo(args, false);

/** Un valore come testo: formato 0 conciso, 1 rigoroso (il testo tra virgolette). Gli errori diventano il loro nome. */
function comeTesto(c: CellValue, rigoroso: boolean): string {
  if (c.kind === 'error') return c.error;
  if (c.kind === 'empty') return '';
  if (c.kind === 'text') return rigoroso ? `"${c.value.replace(/"/g, '""')}"` : c.value;
  return coerceToText(c).value ?? '';
}
function formato(a: EvalArg | undefined): number | CellValue {
  const f = numero(a, 0); if (f.e) return f.e;
  const n = Math.trunc(f.v!);
  return n === 0 || n === 1 ? n : VAL();
}
export function fnVALUETOTEXT(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return VAL();
  const f = formato(args[1]); if (typeof f !== 'number') return f;
  const a = args[0];
  const una = (c: CellValue): CellValue => textVal(comeTesto(c, f === 1));
  if (isRangeArg(a) || a.kind === 'array') {
    const celle = tabella(a);
    if (celle.length === 1 && celle[0].length === 1) return una(celle[0][0]);
    return arrayVal(celle.map((r) => r.map(una)));
  }
  return una(a);
}
export function fnARRAYTOTEXT(args: EvalArg[]): CellValue {
  if (args.length < 1 || args.length > 2) return VAL();
  const f = formato(args[1]); if (typeof f !== 'number') return f;
  const a = args[0];
  if (!isRangeArg(a) && a.kind === 'error') return a;
  const celle = tabella(a);
  if (f === 0) return textVal(celle.flat().map((c) => comeTesto(c, false)).join(', '));
  return textVal('{' + celle.map((r) => r.map((c) => comeTesto(c, true)).join(',')).join(';') + '}');
}
