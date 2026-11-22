/**
 * Precedenti e dipendenti (come Formule › Individua precedenti / dipendenti di Excel): le celle che una formula usa, e le formule che
 * usano una cella. I riferimenti si leggono con il tokenizer del motore (non con un'espressione regolare: un "A1" dentro un testo
 * non conta, e i riferimenti con il nome del foglio vanno a quel foglio). Righe e colonne intere (A:A, 3:3) valgono per tutto.
 * Modulo puro.
 */
import { tokenize } from '../engine/tokenizer';
import { MAX_COLS, MAX_ROWS, columnLettersToIndex } from '../engine/address';

export interface Riferimento { foglio: string; r1: number; c1: number; r2: number; c2: number }

function cella(testo: string): { r?: number; c?: number } | null {
  const m = /^\$?([A-Za-z]{0,3})\$?([0-9]{0,7})$/.exec(testo);
  if (!m || (m[1] === '' && m[2] === '')) return null;
  return { ...(m[1] !== '' ? { c: columnLettersToIndex(m[1].toUpperCase()) } : {}), ...(m[2] !== '' ? { r: Number(m[2]) } : {}) };
}

/** I riferimenti di una formula ("=..."): per ognuno il foglio (quello della cella se non è scritto) e il rettangolo. */
export function riferimentiFormula(raw: string, foglioCorrente: string): Riferimento[] {
  if (!raw.startsWith('=')) return [];
  const { tokens } = tokenize(raw.slice(1));
  const out: Riferimento[] = [];
  for (const t of tokens) {
    if (t.type !== 'CELL' && t.type !== 'RANGE') continue;
    let testo = t.value;
    let foglio = foglioCorrente;
    const esclamativo = testo.lastIndexOf('!');
    if (esclamativo >= 0) {
      foglio = testo.slice(0, esclamativo).replace(/^'(.*)'$/, '$1').replace(/''/g, "'");
      testo = testo.slice(esclamativo + 1);
    }
    const [a, b] = testo.split(':');
    const p = cella(a);
    const q = b !== undefined ? cella(b) : p;
    if (!p || !q) continue;
    const r1 = Math.min(p.r ?? 1, q.r ?? 1), r2 = Math.max(p.r ?? MAX_ROWS, q.r ?? MAX_ROWS);
    const c1 = Math.min(p.c ?? 1, q.c ?? 1), c2 = Math.max(p.c ?? MAX_COLS, q.c ?? MAX_COLS);
    if (r1 < 1 || c1 < 1) continue;
    out.push({ foglio, r1, c1, r2, c2 });
  }
  return out;
}

/** Le formule (tra quelle date) che usano la cella (foglio, riga, colonna), nell'ordine in cui sono date. */
export function dipendenti(formule: Array<{ foglio: string; riga: number; colonna: number; raw: string }>, foglio: string, riga: number, colonna: number): Array<{ foglio: string; riga: number; colonna: number }> {
  const basso = foglio.toLowerCase();
  return formule.filter((f) => riferimentiFormula(f.raw, f.foglio).some((r) => r.foglio.toLowerCase() === basso && riga >= r.r1 && riga <= r.r2 && colonna >= r.c1 && colonna <= r.c2))
    .map((f) => ({ foglio: f.foglio, riga: f.riga, colonna: f.colonna }));
}

/** Le formule della cartella dal JSON del motore ({ sheets: [{ name, cells: { A1: raw } }] }). */
export function formuleDellaCartella(json: string): Array<{ foglio: string; riga: number; colonna: number; raw: string }> {
  let d: { sheets?: Array<{ name?: string; cells?: Record<string, unknown> }> };
  try { d = JSON.parse(json); } catch { return []; }
  const out: Array<{ foglio: string; riga: number; colonna: number; raw: string }> = [];
  for (const s of d.sheets ?? []) {
    if (typeof s.name !== 'string') continue;
    for (const [indirizzo, raw] of Object.entries(s.cells ?? {})) {
      if (typeof raw !== 'string' || !raw.startsWith('=')) continue;
      const m = /^([A-Z]{1,3})([0-9]{1,7})$/.exec(indirizzo);
      if (m) out.push({ foglio: s.name, riga: Number(m[2]), colonna: columnLettersToIndex(m[1]), raw });
    }
  }
  return out;
}
