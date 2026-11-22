// Rimuovi duplicati (Dati › Rimuovi duplicati…), scritto per pmb_office. Modulo puro: niente DOM, niente motore.
// Una riga è un duplicato se nelle colonne scelte ha gli stessi valori di una riga che viene prima: resta la prima, le altre si tolgono
// e le righe che restano salgono, nell'ordine in cui erano. Il confronto guarda il valore (non come è mostrato), non bada a maiuscole e
// minuscole né agli spazi in fondo e in cima al testo: «Rossi», «rossi» e « ROSSI » sono uguali; 1 e «1» no (numero e testo).
import type { CellValue } from '../engine/values';

/** Chiave di confronto di un valore. */
export function chiaveValore(v: CellValue | undefined): string {
  if (!v || v.kind === 'empty') return 'v';
  switch (v.kind) {
    case 'number': return `n:${Object.is(v.value, -0) ? 0 : v.value}`;
    case 'boolean': return `b:${v.value ? 1 : 0}`;
    case 'text': { const t = v.value.trim().toLocaleLowerCase('it'); return t === '' ? 'v' : `t:${t}`; }
    case 'error': return `e:${v.error}`;
    case 'array': return `a:${v.values.map((r) => r.map(chiaveValore).join('\u0001')).join('\u0002')}`;
  }
}

/** Chiave di una riga: le chiavi delle colonne scelte, in ordine. */
export function chiaveRiga(valori: ReadonlyArray<CellValue | undefined>): string {
  return valori.map(chiaveValore).join('\u0000');
}

export interface EsitoDuplicati {
  /** righe che restano, nell'ordine */
  tenute: number[];
  /** righe tolte perché duplicate */
  tolte: number[];
}

/** Divide le righe in tenute e tolte. `chiave(r)` è la chiave della riga r (vedi chiaveRiga). Le righe tutte vuote nelle colonne scelte contano come le altre. */
export function trovaDuplicati(righe: readonly number[], chiave: (r: number) => string): EsitoDuplicati {
  const viste = new Set<string>();
  const tenute: number[] = [];
  const tolte: number[] = [];
  for (const r of righe) {
    const k = chiave(r);
    if (viste.has(k)) tolte.push(r);
    else { viste.add(k); tenute.push(r); }
  }
  return { tenute, tolte };
}

export interface Spostamento { da: number; a: number }

/**
 * Dove va ogni riga tenuta quando le tolte spariscono: le tenute si compattano a partire da `primaRiga`, e le righe in fondo
 * rimaste libere (`daSvuotare`) si svuotano.
 */
export function compatta(primaRiga: number, ultimaRiga: number, tenute: readonly number[]): { spostamenti: Spostamento[]; daSvuotare: number[] } {
  const spostamenti = tenute.map((r, i) => ({ da: r, a: primaRiga + i }));
  const daSvuotare: number[] = [];
  for (let r = primaRiga + tenute.length; r <= ultimaRiga; r++) daSvuotare.push(r);
  return { spostamenti, daSvuotare };
}
