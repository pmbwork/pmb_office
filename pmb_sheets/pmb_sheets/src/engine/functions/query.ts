/**
 * QUERY(dati; "query"; [intestazioni]) — mini linguaggio di interrogazione alla Google Fogli.
 *
 * Clausole supportate (parole chiave senza distinzione tra maiuscole e minuscole):
 *   select · where · group by · order by · limit · offset · label
 * Le colonne si chiamano Col1, Col2, … Funzioni di aggregazione: sum, avg, count, min, max.
 * Funzioni di testo: upper, lower. Operatori aritmetici + - * / sulle colonne numeriche.
 * Confronti: = != <> < > <= >= contains, starts with, ends with, matches (regex a tutta
 * stringa), like (% e _), is null, is not null; e and, or, not con le parentesi.
 *
 * Non supportati (restituiscono #VALUE!): pivot, format, options, funzioni di data.
 * Modulo puro: lavora solo su matrici di CellValue.
 */

import { CellValue, numberVal, textVal, boolVal, emptyVal, errorVal, arrayVal, coerceToText, coerceToNumber } from '../values';
import { EvalArg, isRangeArg } from './utils';
import { argToMatrix } from './array';

// ───────────── Lessico ─────────────

type Tok = { k: 'w'; v: string; l: string } | { k: 'n'; v: number } | { k: 's'; v: string } | { k: 'o'; v: string };

class ErroreQuery extends Error {
  constructor(messaggio: string, public codice: '#VALUE!' | '#DIV/0!' = '#VALUE!') {
    super(messaggio);
  }
}

function lessico(testo: string): Tok[] {
  const t: Tok[] = [];
  let i = 0;
  while (i < testo.length) {
    const c = testo[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, s = '';
      for (;;) {
        if (j >= testo.length) throw new ErroreQuery('stringa non chiusa');
        if (testo[j] === c) {
          if (testo[j + 1] === c) { s += c; j += 2; continue; } // virgolette raddoppiate
          break;
        }
        s += testo[j++];
      }
      t.push({ k: 's', v: s });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(testo[i + 1] ?? ''))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?|^[0-9]+\.?/.exec(testo.slice(i))!;
      t.push({ k: 'n', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(testo.slice(i))!;
      t.push({ k: 'w', v: m[0], l: m[0].toLowerCase() });
      i += m[0].length;
      continue;
    }
    const due = testo.slice(i, i + 2);
    if (['<=', '>=', '<>', '!='].includes(due)) { t.push({ k: 'o', v: due }); i += 2; continue; }
    if ('=<>+-*/(),'.includes(c)) { t.push({ k: 'o', v: c }); i++; continue; }
    throw new ErroreQuery(`carattere non valido "${c}"`);
  }
  return t;
}

// ───────────── Alberi ─────────────

type Espr =
  | { t: 'col'; i: number }
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'agg'; f: Agg; a: Espr }
  | { t: 'fn'; f: 'upper' | 'lower'; a: Espr }
  | { t: 'neg'; a: Espr }
  | { t: 'bin'; op: '+' | '-' | '*' | '/'; l: Espr; r: Espr };

type Agg = 'sum' | 'avg' | 'count' | 'min' | 'max';
const AGGREGATI = new Set<string>(['sum', 'avg', 'count', 'min', 'max']);
const FUNZIONI_TESTO = new Set<string>(['upper', 'lower']);

type Cond =
  | { t: 'and' | 'or'; l: Cond; r: Cond }
  | { t: 'not'; a: Cond }
  | { t: 'nullo'; a: Espr; negato: boolean }
  | { t: 'cmp'; op: string; l: Espr; r: Espr };

interface Voce { e: Espr }
interface Ordine { e: Espr; discendente: boolean }
interface Piano {
  select: Voce[] | null;          // null = tutte le colonne
  where: Cond | null;
  groupBy: number[];
  orderBy: Ordine[];
  limit: number | null;
  offset: number;
  label: Array<{ e: Espr; testo: string }>;
}

const CLAUSOLE = new Set(['select', 'where', 'group', 'order', 'limit', 'offset', 'label', 'pivot', 'format', 'options']);

// ───────────── Analisi sintattica ─────────────

class Analizzatore {
  private p = 0;
  constructor(private tok: Tok[], private nCol: number) {}

  private peek(): Tok | undefined { return this.tok[this.p]; }
  private parola(l?: string): boolean {
    const t = this.peek();
    return !!t && t.k === 'w' && (l === undefined || t.l === l);
  }
  private op(v?: string): boolean {
    const t = this.peek();
    return !!t && t.k === 'o' && (v === undefined || t.v === v);
  }
  private prendiOp(v: string): void {
    if (!this.op(v)) throw new ErroreQuery(`atteso "${v}"`);
    this.p++;
  }
  private prendiParola(l: string): void {
    if (!this.parola(l)) throw new ErroreQuery(`attesa la parola "${l}"`);
    this.p++;
  }

  piano(): Piano {
    const piano: Piano = { select: null, where: null, groupBy: [], orderBy: [], limit: null, offset: 0, label: [] };
    const viste = new Set<string>();
    while (this.p < this.tok.length) {
      const t = this.tok[this.p];
      if (t.k !== 'w') throw new ErroreQuery('attesa una clausola');
      if (viste.has(t.l)) throw new ErroreQuery(`clausola "${t.l}" ripetuta`);
      viste.add(t.l);
      this.p++;
      switch (t.l) {
        case 'select': piano.select = this.voci(); break;
        case 'where': piano.where = this.condizione(); break;
        case 'group': this.prendiParola('by'); piano.groupBy = this.colonne(); break;
        case 'order': this.prendiParola('by'); piano.orderBy = this.ordinamento(); break;
        case 'limit': piano.limit = this.intero('limit'); break;
        case 'offset': piano.offset = this.intero('offset'); break;
        case 'label': piano.label = this.etichette(); break;
        default: throw new ErroreQuery(`clausola non supportata: ${t.v}`);
      }
    }
    return piano;
  }

  private intero(nome: string): number {
    const t = this.peek();
    if (!t || t.k !== 'n' || !Number.isInteger(t.v) || t.v < 0) throw new ErroreQuery(`${nome} vuole un intero non negativo`);
    this.p++;
    return t.v;
  }

  private colonna(nome: string): number {
    const m = /^col([0-9]+)$/i.exec(nome);
    if (!m) throw new ErroreQuery(`colonna sconosciuta: ${nome}`);
    const i = parseInt(m[1], 10) - 1;
    if (i < 0 || i >= this.nCol) throw new ErroreQuery(`${nome} fuori dai dati`);
    return i;
  }

  private colonne(): number[] {
    const out: number[] = [];
    do {
      const t = this.peek();
      if (!t || t.k !== 'w') throw new ErroreQuery('attesa una colonna');
      this.p++;
      out.push(this.colonna(t.v));
    } while (this.consumaVirgola());
    return out;
  }

  private consumaVirgola(): boolean {
    if (this.op(',')) { this.p++; return true; }
    return false;
  }

  private voci(): Voce[] {
    if (this.op('*')) { this.p++; return Array.from({ length: this.nCol }, (_, i) => ({ e: { t: 'col', i } as Espr })); }
    const out: Voce[] = [];
    do out.push({ e: this.espressione() }); while (this.consumaVirgola());
    return out;
  }

  private ordinamento(): Ordine[] {
    const out: Ordine[] = [];
    do {
      const e = this.espressione();
      let discendente = false;
      if (this.parola('desc')) { discendente = true; this.p++; }
      else if (this.parola('asc')) this.p++;
      out.push({ e, discendente });
    } while (this.consumaVirgola());
    return out;
  }

  private etichette(): Array<{ e: Espr; testo: string }> {
    const out: Array<{ e: Espr; testo: string }> = [];
    do {
      const e = this.espressione();
      const t = this.peek();
      if (!t || t.k !== 's') throw new ErroreQuery('label vuole un testo tra apici');
      this.p++;
      out.push({ e, testo: t.v });
    } while (this.consumaVirgola());
    return out;
  }

  // espressioni aritmetiche
  espressione(): Espr {
    let l = this.termine();
    while (this.op('+') || this.op('-')) {
      const o = (this.tok[this.p++] as { v: string }).v as '+' | '-';
      l = { t: 'bin', op: o, l, r: this.termine() };
    }
    return l;
  }
  private termine(): Espr {
    let l = this.unario();
    while (this.op('*') || this.op('/')) {
      const o = (this.tok[this.p++] as { v: string }).v as '*' | '/';
      l = { t: 'bin', op: o, l, r: this.unario() };
    }
    return l;
  }
  private unario(): Espr {
    if (this.op('-')) { this.p++; return { t: 'neg', a: this.unario() }; }
    return this.primario();
  }
  private primario(): Espr {
    const t = this.peek();
    if (!t) throw new ErroreQuery('espressione incompleta');
    if (t.k === 'n') { this.p++; return { t: 'num', v: t.v }; }
    if (t.k === 's') { this.p++; return { t: 'str', v: t.v }; }
    if (t.k === 'o' && t.v === '(') {
      this.p++;
      const e = this.espressione();
      this.prendiOp(')');
      return e;
    }
    if (t.k === 'w') {
      if (t.l === 'true' || t.l === 'false') { this.p++; return { t: 'bool', v: t.l === 'true' }; }
      const seguente = this.tok[this.p + 1];
      if (seguente && seguente.k === 'o' && seguente.v === '(') {
        if (AGGREGATI.has(t.l)) {
          this.p += 2;
          const a = this.espressione();
          this.prendiOp(')');
          return { t: 'agg', f: t.l as Agg, a };
        }
        if (FUNZIONI_TESTO.has(t.l)) {
          this.p += 2;
          const a = this.espressione();
          this.prendiOp(')');
          return { t: 'fn', f: t.l as 'upper' | 'lower', a };
        }
        throw new ErroreQuery(`funzione non supportata: ${t.v}`);
      }
      if (CLAUSOLE.has(t.l)) throw new ErroreQuery(`attesa un'espressione, trovata "${t.v}"`);
      this.p++;
      return { t: 'col', i: this.colonna(t.v) };
    }
    throw new ErroreQuery('espressione non valida');
  }

  // condizioni
  condizione(): Cond {
    let l = this.congiunzione();
    while (this.parola('or')) { this.p++; l = { t: 'or', l, r: this.congiunzione() }; }
    return l;
  }
  private congiunzione(): Cond {
    let l = this.negazione();
    while (this.parola('and')) { this.p++; l = { t: 'and', l, r: this.negazione() }; }
    return l;
  }
  private negazione(): Cond {
    if (this.parola('not')) { this.p++; return { t: 'not', a: this.negazione() }; }
    return this.atomo();
  }
  private atomo(): Cond {
    if (this.op('(')) {
      const inizio = this.p;
      try {
        this.p++;
        const c = this.condizione();
        this.prendiOp(')');
        // se segue un operatore di confronto, le parentesi appartenevano a un'espressione
        if (!this.segueConfronto()) return c;
      } catch (e) {
        if (!(e instanceof ErroreQuery)) throw e;
      }
      this.p = inizio;
    }
    return this.confronto();
  }
  private segueConfronto(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.k === 'o') return ['=', '<', '>', '<=', '>=', '<>', '!=', '+', '-', '*', '/'].includes(t.v);
    return t.k === 'w' && ['contains', 'starts', 'ends', 'matches', 'like', 'is'].includes(t.l);
  }
  private confronto(): Cond {
    const l = this.espressione();
    const t = this.peek();
    if (!t) throw new ErroreQuery('confronto incompleto');
    if (t.k === 'o' && ['=', '<', '>', '<=', '>=', '<>', '!='].includes(t.v)) {
      this.p++;
      return { t: 'cmp', op: t.v === '<>' ? '!=' : t.v, l, r: this.espressione() };
    }
    if (t.k === 'w') {
      if (t.l === 'is') {
        this.p++;
        let negato = false;
        if (this.parola('not')) { negato = true; this.p++; }
        this.prendiParola('null');
        return { t: 'nullo', a: l, negato };
      }
      if (t.l === 'contains' || t.l === 'matches' || t.l === 'like') {
        this.p++;
        return { t: 'cmp', op: t.l, l, r: this.espressione() };
      }
      if (t.l === 'starts' || t.l === 'ends') {
        this.p++;
        this.prendiParola('with');
        return { t: 'cmp', op: `${t.l} with`, l, r: this.espressione() };
      }
    }
    throw new ErroreQuery('atteso un operatore di confronto');
  }
}

// ───────────── Esecuzione ─────────────

type Riga = CellValue[];

function chiave(e: Espr): string {
  switch (e.t) {
    case 'col': return `Col${e.i + 1}`;
    case 'num': return String(e.v);
    case 'str': return JSON.stringify(e.v);
    case 'bool': return String(e.v);
    case 'agg': return `${e.f}(${chiave(e.a)})`;
    case 'fn': return `${e.f}(${chiave(e.a)})`;
    case 'neg': return `-${chiave(e.a)}`;
    case 'bin': return `(${chiave(e.l)}${e.op}${chiave(e.r)})`;
  }
}

function haAggregati(e: Espr): boolean {
  switch (e.t) {
    case 'agg': return true;
    case 'fn': case 'neg': return haAggregati(e.a);
    case 'bin': return haAggregati(e.l) || haAggregati(e.r);
    default: return false;
  }
}

function condizioneConAggregati(c: Cond): boolean {
  switch (c.t) {
    case 'and': case 'or': return condizioneConAggregati(c.l) || condizioneConAggregati(c.r);
    case 'not': return condizioneConAggregati(c.a);
    case 'nullo': return haAggregati(c.a);
    case 'cmp': return haAggregati(c.l) || haAggregati(c.r);
  }
}

function colonneFuoriAggregato(e: Espr, dentro = false, out: number[] = []): number[] {
  switch (e.t) {
    case 'col': if (!dentro) out.push(e.i); break;
    case 'agg': colonneFuoriAggregato(e.a, true, out); break;
    case 'fn': case 'neg': colonneFuoriAggregato(e.a, dentro, out); break;
    case 'bin': colonneFuoriAggregato(e.l, dentro, out); colonneFuoriAggregato(e.r, dentro, out); break;
  }
  return out;
}

const VUOTO: CellValue = emptyVal();
const èVuoto = (v: CellValue) => v.kind === 'empty';

function valuta(e: Espr, righe: Riga[]): CellValue {
  switch (e.t) {
    case 'col': return righe.length ? (righe[0][e.i] ?? VUOTO) : VUOTO;
    case 'num': return numberVal(e.v);
    case 'str': return textVal(e.v);
    case 'bool': return boolVal(e.v);
    case 'neg': {
      const v = valuta(e.a, righe);
      return v.kind === 'number' ? numberVal(-v.value) : v.kind === 'error' ? v : VUOTO;
    }
    case 'fn': {
      const v = valuta(e.a, righe);
      if (v.kind !== 'text') return v.kind === 'error' ? v : VUOTO;
      return textVal(e.f === 'upper' ? v.value.toUpperCase() : v.value.toLowerCase());
    }
    case 'bin': {
      const a = valuta(e.l, righe), b = valuta(e.r, righe);
      if (a.kind === 'error') return a;
      if (b.kind === 'error') return b;
      if (a.kind !== 'number' || b.kind !== 'number') return VUOTO;
      switch (e.op) {
        case '+': return numberVal(a.value + b.value);
        case '-': return numberVal(a.value - b.value);
        case '*': return numberVal(a.value * b.value);
        case '/': return b.value === 0 ? errorVal('#DIV/0!') : numberVal(a.value / b.value);
      }
      return VUOTO;
    }
    case 'agg': {
      const valori = righe.map((r) => valuta(e.a, [r]));
      const pieni = valori.filter((v) => !èVuoto(v));
      switch (e.f) {
        case 'count': return numberVal(pieni.length);
        case 'sum': case 'avg': {
          const numeri = pieni.filter((v): v is Extract<CellValue, { kind: 'number' }> => v.kind === 'number').map((v) => v.value);
          if (!numeri.length) return VUOTO;
          const somma = numeri.reduce((x, y) => x + y, 0);
          return numberVal(e.f === 'sum' ? somma : somma / numeri.length);
        }
        case 'min': case 'max': {
          if (!pieni.length) return VUOTO;
          let m = pieni[0];
          for (const v of pieni.slice(1)) {
            const c = ordina(v, m);
            if (e.f === 'min' ? c < 0 : c > 0) m = v;
          }
          return m;
        }
      }
    }
  }
}

/** Ordine totale: vuoti, poi booleani, numeri, testi. */
function rango(v: CellValue): number {
  switch (v.kind) {
    case 'empty': return 0;
    case 'boolean': return 1;
    case 'number': return 2;
    case 'text': return 3;
    default: return 4;
  }
}
function ordina(a: CellValue, b: CellValue): number {
  const ra = rango(a), rb = rango(b);
  if (ra !== rb) return ra - rb;
  if (a.kind === 'number' && b.kind === 'number') return a.value - b.value;
  if (a.kind === 'text' && b.kind === 'text') return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  if (a.kind === 'boolean' && b.kind === 'boolean') return Number(a.value) - Number(b.value);
  return 0;
}

function perLike(modello: string): RegExp {
  let r = '';
  for (const c of modello) r += c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${r}$`, 's');
}

function vero(c: Cond, riga: Riga): boolean {
  switch (c.t) {
    case 'and': return vero(c.l, riga) && vero(c.r, riga);
    case 'or': return vero(c.l, riga) || vero(c.r, riga);
    case 'not': return !vero(c.a, riga);
    case 'nullo': {
      const v = valuta(c.a, [riga]);
      return c.negato ? !èVuoto(v) : èVuoto(v);
    }
    case 'cmp': {
      const a = valuta(c.l, [riga]), b = valuta(c.r, [riga]);
      if (a.kind === 'error' || b.kind === 'error') return false;
      if (c.op === 'contains' || c.op === 'starts with' || c.op === 'ends with' || c.op === 'matches' || c.op === 'like') {
        if (a.kind !== 'text' || b.kind !== 'text') return false;
        switch (c.op) {
          case 'contains': return a.value.includes(b.value);
          case 'starts with': return a.value.startsWith(b.value);
          case 'ends with': return a.value.endsWith(b.value);
          case 'matches':
            try { return new RegExp(`^(?:${b.value})$`).test(a.value); } catch { throw new ErroreQuery('espressione regolare non valida'); }
          default: return perLike(b.value).test(a.value);
        }
      }
      // confronti: solo tra valori dello stesso tipo, i vuoti non sono mai uguali a niente
      if (a.kind === 'empty' || b.kind === 'empty') return c.op === '!=' ? !(a.kind === 'empty' && b.kind === 'empty') : false;
      if (a.kind !== b.kind) return c.op === '!=';
      const d = ordina(a, b);
      switch (c.op) {
        case '=': return d === 0;
        case '!=': return d !== 0;
        case '<': return d < 0;
        case '>': return d > 0;
        case '<=': return d <= 0;
        case '>=': return d >= 0;
      }
      return false;
    }
  }
}

function serializza(v: CellValue): string {
  switch (v.kind) {
    case 'number': return `n${v.value}`;
    case 'text': return `t${v.value}`;
    case 'boolean': return `b${v.value}`;
    case 'empty': return 'e';
    default: return 'x';
  }
}

function indovinaIntestazioni(dati: Riga[]): number {
  if (dati.length < 2) return 0;
  const prima = dati[0];
  return prima.length > 0 && prima.every((v) => v.kind === 'text') ? 1 : 0;
}

/** Esegue la query su una matrice. Lancia ErroreQuery se la query non è valida. */
export function eseguiQuery(matrice: Riga[], testo: string, intestazioni = -1): CellValue[][] {
  const nCol = matrice.reduce((m, r) => Math.max(m, r.length), 0);
  if (nCol === 0) throw new ErroreQuery('dati vuoti');
  const tutte = matrice.map((r) => Array.from({ length: nCol }, (_, i) => r[i] ?? VUOTO));
  const nInt = Math.min(intestazioni < 0 ? indovinaIntestazioni(tutte) : Math.trunc(intestazioni), tutte.length);
  const righeIntestazione = tutte.slice(0, nInt);
  let righe = tutte.slice(nInt);

  const piano = new Analizzatore(lessico(testo), nCol).piano();
  const voci: Voce[] = piano.select ?? Array.from({ length: nCol }, (_, i) => ({ e: { t: 'col', i } as Espr }));

  // WHERE: niente aggregati
  if (piano.where) {
    const w = piano.where;
    if (condizioneConAggregati(w)) throw new ErroreQuery('where non ammette funzioni di aggregazione');
    righe = righe.filter((r) => vero(w, r));
  }

  const raggruppato = piano.groupBy.length > 0 || voci.some((v) => haAggregati(v.e)) || piano.orderBy.some((o) => haAggregati(o.e));

  // gruppi: ogni gruppo è un insieme di righe
  let gruppi: Riga[][];
  if (!raggruppato) {
    gruppi = righe.map((r) => [r]);
  } else {
    for (const e of [...voci.map((v) => v.e), ...piano.orderBy.map((o) => o.e)]) {
      for (const i of colonneFuoriAggregato(e)) {
        if (!piano.groupBy.includes(i)) throw new ErroreQuery(`Col${i + 1} deve stare in group by o dentro un aggregato`);
      }
    }
    if (piano.groupBy.length === 0) {
      gruppi = [righe];
    } else {
      const mappa = new Map<string, Riga[]>();
      for (const r of righe) {
        const k = piano.groupBy.map((i) => serializza(r[i])).join('\u0001');
        const g = mappa.get(k);
        if (g) g.push(r); else mappa.set(k, [r]);
      }
      gruppi = [...mappa.values()];
    }
  }

  // ORDER BY (stabile)
  if (piano.orderBy.length) {
    const chiavi = new Map<Riga[], CellValue[]>();
    for (const g of gruppi) chiavi.set(g, piano.orderBy.map((o) => valuta(o.e, g)));
    gruppi = gruppi
      .map((g, n) => ({ g, n }))
      .sort((x, y) => {
        const kx = chiavi.get(x.g)!, ky = chiavi.get(y.g)!;
        for (let i = 0; i < piano.orderBy.length; i++) {
          const c = ordina(kx[i], ky[i]);
          if (c !== 0) return piano.orderBy[i].discendente ? -c : c;
        }
        return x.n - y.n;
      })
      .map((x) => x.g);
  }

  // OFFSET e LIMIT
  gruppi = gruppi.slice(piano.offset, piano.limit === null ? undefined : piano.offset + piano.limit);

  const risultato: CellValue[][] = gruppi.map((g) => voci.map((v) => valuta(v.e, g)));

  // intestazione
  if (nInt > 0) {
    const nomeColonna = (i: number): string => {
      const parti = righeIntestazione.map((r) => coerceToText(r[i]).value ?? '').filter((s) => s !== '');
      return parti.length ? parti.join(' ') : `Col${i + 1}`;
    };
    const nome = (e: Espr): string => {
      const k = chiave(e);
      const etichetta = piano.label.find((l) => chiave(l.e) === k);
      if (etichetta) return etichetta.testo;
      if (e.t === 'col') return nomeColonna(e.i);
      if (e.t === 'agg') return `${e.f} ${e.a.t === 'col' ? nomeColonna(e.a.i) : chiave(e.a)}`;
      return k;
    };
    risultato.unshift(voci.map((v) => textVal(nome(v.e))));
  }
  if (risultato.length === 0) throw new ErroreQuery('nessun risultato', '#VALUE!');
  return risultato;
}

/** QUERY(dati; query; [intestazioni]) */
export function fnQUERY(args: EvalArg[]): CellValue {
  if (args.length < 2 || args.length > 3) return errorVal('#VALUE!');
  if (!isRangeArg(args[0]) && args[0].kind === 'error') return args[0];
  const q = args[1] as CellValue;
  if (q.kind === 'error') return q;
  const testo = coerceToText(q);
  if (testo.error) return errorVal(testo.error);
  let intestazioni = -1;
  if (args.length === 3) {
    const h = args[2] as CellValue;
    if (h.kind === 'error') return h;
    if (h.kind !== 'empty') {
      const n = coerceToNumber(h);
      if (n.error) return errorVal(n.error);
      intestazioni = n.value!;
    }
  }
  try {
    const mat = argToMatrix(args[0]);
    const r = eseguiQuery(mat, testo.value!, intestazioni);
    return arrayVal(r);
  } catch (e) {
    if (e instanceof ErroreQuery) {
      if (e.message === 'nessun risultato') return errorVal('#N/A');
      return errorVal(e.codice);
    }
    throw e;
  }
}
