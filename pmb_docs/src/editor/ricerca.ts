// Trova e sostituisci per pmb_docs: cercare nel testo e sostituire, un risultato alla volta o tutti insieme.
// Tutto puro: lavora sul documento e restituisce un nuovo documento. Le ricerche non attraversano i paragrafi.
import { formatoIn, inserisciTesto, testoParagrafo, type Documento, type Posizione, type Stato } from '../modello/documento';

export interface OpzioniRicerca { maiuscole: boolean; parolaIntera: boolean; regex: boolean }
export const OPZIONI_PREDEFINITE: OpzioniRicerca = { maiuscole: false, parolaIntera: false, regex: false };

export interface Corrispondenza {
  p: number;
  /** inizio e fine nel paragrafo (unità UTF-16, la fine è esclusa) */
  da: number;
  a: number;
  trovato: string;
  /** i gruppi tra parentesi di un'espressione regolare ("" per quelli che non hanno trovato niente) */
  gruppi: string[];
}
export interface RisultatoRicerca { corrispondenze: Corrispondenza[]; errore: string | null; troncato: boolean }
export const MASSIMO_CORRISPONDENZE = 5000;

function costruisci(query: string, opz: OpzioniRicerca): RegExp {
  let sorgente = opz.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (opz.parolaIntera) sorgente = `(?<![\\p{L}\\p{N}_])(?:${sorgente})(?![\\p{L}\\p{N}_])`;
  return new RegExp(sorgente, opz.maiuscole ? 'gu' : 'giu');
}

/** Tutte le corrispondenze, in ordine di lettura. Una ricerca vuota non trova niente; un'espressione regolare sbagliata dà un errore. */
export function cerca(doc: Documento, query: string, opz: OpzioniRicerca = OPZIONI_PREDEFINITE): RisultatoRicerca {
  if (query === '') return { corrispondenze: [], errore: null, troncato: false };
  let re: RegExp;
  try { re = costruisci(query, opz); } catch { return { corrispondenze: [], errore: 'Espressione regolare non valida', troncato: false }; }
  const out: Corrispondenza[] = [];
  for (let p = 0; p < doc.paragrafi.length; p++) {
    const t = testoParagrafo(doc.paragrafi[p]);
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      if (m[0] === '') { re.lastIndex += 1; continue; }
      out.push({ p, da: m.index, a: m.index + m[0].length, trovato: m[0], gruppi: m.slice(1).map((g) => g ?? '') });
      if (out.length >= MASSIMO_CORRISPONDENZE) return { corrispondenze: out, errore: null, troncato: true };
    }
  }
  return { corrispondenze: out, errore: null, troncato: false };
}

/** Testo che sostituisce una corrispondenza. Con le espressioni regolari valgono $& (tutto il trovato), $1...$99 (i gruppi) e $$ (un dollaro). */
export function espandiSostituto(modello: string, c: Corrispondenza, regex: boolean): string {
  if (!regex) return modello;
  return modello.replace(/\$(\$|&|\d{1,2})/g, (tutto, x: string) => {
    if (x === '$') return '$';
    if (x === '&') return c.trovato;
    const n = Number(x);
    return n >= 1 && n <= c.gruppi.length ? c.gruppi[n - 1] : tutto;
  });
}

/** Sostituisce una corrispondenza; il nuovo testo ha il formato del primo carattere sostituito e il cursore resta dopo di lui. */
export function sostituisciUna(stato: Stato, c: Corrispondenza, sostituto: string, opz: OpzioniRicerca = OPZIONI_PREDEFINITE): Stato {
  const formato = formatoIn(stato.doc, { p: c.p, o: c.da + 1 });
  const selezionato: Stato = { doc: stato.doc, sel: { ancora: { p: c.p, o: c.da }, fuoco: { p: c.p, o: c.a } }, pendenti: null };
  return inserisciTesto(selezionato, espandiSostituto(sostituto, c, opz.regex), formato);
}

/** Sostituisce tutte le corrispondenze indicate (dall'ultima alla prima, così le posizioni restano valide). */
export function sostituisciTutte(stato: Stato, corrispondenze: Corrispondenza[], sostituto: string, opz: OpzioniRicerca = OPZIONI_PREDEFINITE): { stato: Stato; conteggio: number } {
  let s = stato;
  for (let i = corrispondenze.length - 1; i >= 0; i--) s = sostituisciUna(s, corrispondenze[i], sostituto, opz);
  return { stato: corrispondenze.length === 0 ? stato : s, conteggio: corrispondenze.length };
}

function prima(a: { p: number; o: number }, b: { p: number; o: number }): boolean { return a.p < b.p || (a.p === b.p && a.o < b.o); }

/** Indice della prima corrispondenza che comincia dalla posizione in poi (con ritorno all'inizio); -1 se non ce ne sono. */
export function indiceDopo(corr: Corrispondenza[], pos: Posizione): number {
  if (corr.length === 0) return -1;
  const i = corr.findIndex((c) => !prima({ p: c.p, o: c.da }, pos));
  return i < 0 ? 0 : i;
}

/** Indice della corrispondenza che comincia prima della posizione (con ritorno alla fine); -1 se non ce ne sono. */
export function indicePrima(corr: Corrispondenza[], pos: Posizione): number {
  if (corr.length === 0) return -1;
  for (let i = corr.length - 1; i >= 0; i--) if (prima({ p: corr[i].p, o: corr[i].da }, pos)) return i;
  return corr.length - 1;
}

/** Indice a passo +1 o -1 da quello dato, con ritorno dall'altra parte. */
export function vicina(totale: number, indice: number, passo: 1 | -1): number {
  if (totale <= 0) return -1;
  return (((indice + passo) % totale) + totale) % totale;
}
