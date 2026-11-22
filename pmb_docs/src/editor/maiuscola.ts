// Maiuscola automatica a inizio frase (come «Correzione automatica» di Word e LibreOffice): la lettera minuscola scritta
// a inizio paragrafo o dopo la fine di una frase (. ! ? seguiti da uno spazio) diventa maiuscola.
// Non scatta dopo le abbreviazioni comuni (es., ecc., sig., p.es., e.g. ...), dopo i puntini di sospensione
// e dopo una lettera sola col punto (iniziali, «p.»). Tutto puro: nessun accesso al browser.
import { collassata, testoParagrafo, type Paragrafo, type Stato } from '../modello/documento';

/** Abbreviazioni (senza il punto finale, in minuscolo) dopo cui il punto non chiude la frase. */
export const ABBREVIAZIONI: ReadonlySet<string> = new Set([
  // italiano
  'es', 'ecc', 'pag', 'pagg', 'sig', 'sigg', 'sig.ra', 'sig.na', 'dott', 'dott.ssa', 'dr', 'prof', 'prof.ssa', 'ing', 'avv', 'arch', 'geom', 'rag',
  'sen', 'egr', 'gent', 'gent.mo', 'gent.ma', 'spett', 'cfr', 'vd', 'art', 'artt', 'cap', 'capp', 'nr', 'num', 'tel', 'cell', 'ca', 'cit', 'op',
  'vol', 'voll', 'ed', 'fig', 'figg', 'tab', 'rif', 'prot', 'ult', 'sez', 'lett', 'cod', 'p.es', 'a.c', 'd.c', 's.p.a', 's.r.l', 'n.b',
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ott', 'nov', 'dic',
  // inglese
  'e.g', 'i.e', 'etc', 'vs', 'mr', 'mrs', 'ms', 'st', 'approx', 'jr', 'sr', 'inc', 'ltd', 'co', 'corp', 'dept', 'jan', 'aug', 'sept', 'oct', 'dec',
]);

const APERTURE = `"'«“‘([¿¡`;
const CHIUSURE = `"'»”’)]`;
const SOLO_APERTURE = new RegExp(`^[\\s${classe(APERTURE)}]*$`, 'u');
// ...parola, segno di fine frase, eventuali chiusure, almeno uno spazio, eventuali aperture
const FINE_FRASE = new RegExp(`(\\S*?)([.!?]+)[${classe(CHIUSURE)}]*\\s+[${classe(APERTURE)}]*$`, 'u');

function classe(s: string): string { return s.replace(/[\\\]\[^-]/g, '\\$&'); }

/** Vero se una lettera scritta dopo `prima` (il testo del paragrafo che la precede) comincia una frase. */
export function iniziaFrase(prima: string): boolean {
  if (SOLO_APERTURE.test(prima)) return true;
  const m = FINE_FRASE.exec(prima);
  if (!m) return false;
  const parola = m[1].replace(new RegExp(`^[${classe(APERTURE)}]+`, 'u'), '');
  const segni = m[2];
  if (segni.includes('!') || segni.includes('?')) return true;
  if (segni.length > 1) return false; // puntini di sospensione «...»
  if (parola === '') return true;
  const chiave = parola.toLowerCase();
  if (ABBREVIAZIONI.has(chiave)) return false;
  if (/^\p{L}$/u.test(parola)) return false; // iniziale o «p.»
  // sigle col punto dentro, come «a.C.» o «U.S.A.»: pezzi di una o due lettere
  if (/^(?:\p{L}{1,2}\.)+\p{L}{1,2}$/u.test(parola)) return false;
  return true;
}

/** La lettera maiuscola che prende il posto di `c`, oppure null se `c` non è una minuscola che si trasforma in un carattere solo. */
export function maiuscolaDi(c: string): string | null {
  if (!/^\p{Ll}$/u.test(c)) return null;
  const m = c.toUpperCase();
  return m !== c && m.length === c.length ? m : null;
}

/** Sostituisce il carattere in posizione `o` del paragrafo con `nuovo` (stessa lunghezza), lasciando il formato com'è. */
function sostituisciCarattere(par: Paragrafo, o: number, nuovo: string): Paragrafo {
  let inizio = 0;
  const runs = par.runs.map((r) => {
    const fine = inizio + r.t.length;
    const dentro = o >= inizio && o < fine;
    const k = o - inizio;
    inizio = fine;
    return dentro ? { ...r, t: r.t.slice(0, k) + nuovo + r.t.slice(k + nuovo.length) } : r;
  });
  return { ...par, runs };
}

/**
 * Dopo aver scritto una lettera: se è una minuscola che comincia una frase, lo stato con la lettera maiuscola
 * (stessa selezione e stesso formato); altrimenti null. `stato` è lo stato subito dopo l'inserimento della lettera.
 */
export function maiuscolaAutomatica(stato: Stato): Stato | null {
  if (!collassata(stato.sel)) return null;
  const { p, o } = stato.sel.fuoco;
  const par = stato.doc.paragrafi[p];
  if (!par || o < 1) return null;
  const testo = testoParagrafo(par);
  const lettera = testo.charAt(o - 1);
  const nuova = maiuscolaDi(lettera);
  if (nuova === null || !iniziaFrase(testo.slice(0, o - 1))) return null;
  const paragrafi = stato.doc.paragrafi.slice();
  paragrafi[p] = sostituisciCarattere(par, o - 1, nuova);
  return { ...stato, doc: { ...stato.doc, paragrafi } };
}
