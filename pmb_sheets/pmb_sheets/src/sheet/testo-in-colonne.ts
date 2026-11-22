// Testo in colonne (Dati › Testo in colonne…), scritto per pmb_office. Modulo puro: niente DOM, niente motore.
// Divide il testo di ogni cella di una colonna in più pezzi, con un separatore (rilevato da sé o scelto) oppure a larghezza fissa;
// i pezzi vanno nella cella stessa e in quelle alla sua destra.

export type TipoSeparatore = 'auto' | 'virgola' | 'puntoevirgola' | 'tab' | 'spazio' | 'punto' | 'barra' | 'personalizzato' | 'larghezza';

export interface OpzioniDivisione {
  separatore: TipoSeparatore;
  /** il separatore scelto a mano (con «personalizzato»): uno o più caratteri */
  personalizzato?: string;
  /** con «larghezza»: le posizioni (in caratteri, dalla prima) in cui tagliare, per esempio [10, 25] */
  posizioni?: number[];
  /** più separatori di fila contano come uno solo (utile con gli spazi) */
  consecutiviComeUno: boolean;
  /** il testo tra virgolette "..." resta unito anche se contiene il separatore; "" dentro le virgolette è una virgoletta */
  virgolette: boolean;
  /** toglie gli spazi in cima e in fondo a ogni pezzo */
  togliSpazi: boolean;
}

export const OPZIONI_DIVISIONE: OpzioniDivisione = { separatore: 'auto', consecutiviComeUno: false, virgolette: true, togliSpazi: true };
/** Colonne al massimo per riga (un testo enorme non crea migliaia di colonne). */
export const PEZZI_MASSIMI = 512;

const CARATTERI: Record<Exclude<TipoSeparatore, 'auto' | 'personalizzato' | 'larghezza'>, string> = {
  virgola: ',', puntoevirgola: ';', tab: '\t', spazio: ' ', punto: '.', barra: '|',
};
const CANDIDATI = ['\t', ';', ',', '|'];

/**
 * Il separatore più probabile per queste righe: fra tabulazione, punto e virgola, virgola e barra, quello presente in più righe
 * con lo stesso numero di volte (come fa un file CSV); a parità vince quello che compare di più. Se nessuno c'è, lo spazio.
 */
export function rilevaSeparatore(righe: readonly string[]): string {
  const piene = righe.filter((r) => r.trim() !== '').slice(0, 200);
  let migliore = ' ';
  let punti = 0;
  for (const c of CANDIDATI) {
    const conti = piene.map((r) => contaFuoriVirgolette(r, c));
    const conLui = conti.filter((n) => n > 0);
    if (conLui.length === 0) continue;
    // quante righe hanno il numero di separatori più frequente
    const freq = new Map<number, number>();
    for (const n of conLui) freq.set(n, (freq.get(n) ?? 0) + 1);
    const costanti = Math.max(...freq.values());
    const p = costanti * 1000 + conLui.reduce((a, b) => a + b, 0);
    if (p > punti) { punti = p; migliore = c; }
  }
  return migliore;
}

function contaFuoriVirgolette(riga: string, sep: string): number {
  let n = 0;
  let dentro = false;
  for (const ch of riga) {
    if (ch === '"') dentro = !dentro;
    else if (ch === sep && !dentro) n++;
  }
  return n;
}

/** Il separatore da usare (null con la larghezza fissa). */
export function separatoreDi(opz: OpzioniDivisione, righe: readonly string[]): string | null {
  if (opz.separatore === 'larghezza') return null;
  if (opz.separatore === 'auto') return rilevaSeparatore(righe);
  if (opz.separatore === 'personalizzato') return opz.personalizzato && opz.personalizzato !== '' ? opz.personalizzato : null;
  return CARATTERI[opz.separatore];
}

/** Divide un testo con un separatore (anche di più caratteri). */
export function dividiConSeparatore(testo: string, sep: string, opz: Pick<OpzioniDivisione, 'consecutiviComeUno' | 'virgolette' | 'togliSpazi'>): string[] {
  const pezzi: string[] = [];
  let attuale = '';
  let dentro = false;
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (opz.virgolette && ch === '"') {
      if (dentro && testo[i + 1] === '"') { attuale += '"'; i++; continue; }
      if (!dentro && attuale.trim() === '') { dentro = true; attuale = ''; continue; }
      if (dentro) { dentro = false; continue; }
    }
    if (!dentro && testo.startsWith(sep, i)) {
      pezzi.push(attuale);
      attuale = '';
      i += sep.length - 1;
      if (opz.consecutiviComeUno) while (testo.startsWith(sep, i + 1)) i += sep.length;
      if (pezzi.length >= PEZZI_MASSIMI - 1) { attuale = testo.slice(i + 1); break; }
      continue;
    }
    attuale += ch;
  }
  pezzi.push(attuale);
  let fuori = opz.togliSpazi ? pezzi.map((p) => p.trim()) : pezzi;
  // con «consecutivi come uno» anche i separatori in cima e in fondo non creano colonne vuote
  if (opz.consecutiviComeUno) {
    while (fuori.length > 1 && fuori[0] === '') fuori = fuori.slice(1);
    while (fuori.length > 1 && fuori[fuori.length - 1] === '') fuori = fuori.slice(0, -1);
  }
  return fuori;
}

/** Divide un testo a larghezza fissa: taglia nelle posizioni date (ordinate, senza doppioni, maggiori di zero). */
export function dividiALarghezza(testo: string, posizioni: readonly number[], togliSpazi: boolean): string[] {
  const tagli = [...new Set(posizioni.filter((p) => Number.isInteger(p) && p > 0))].sort((a, b) => a - b).slice(0, PEZZI_MASSIMI - 1);
  const pezzi: string[] = [];
  let da = 0;
  for (const p of tagli) { pezzi.push(testo.slice(da, p)); da = p; }
  pezzi.push(testo.slice(da));
  const fuori = togliSpazi ? pezzi.map((p) => p.trim()) : pezzi;
  // pezzi vuoti in fondo (testo più corto dei tagli) non contano
  while (fuori.length > 1 && fuori[fuori.length - 1] === '') fuori.pop();
  return fuori;
}

/** Legge le posizioni scritte dall'utente, per esempio «10; 25» o «10, 25»; null se non sono numeri interi positivi. */
export function leggiPosizioni(testo: string): number[] | null {
  const parti = testo.split(/[\s,;]+/).filter((p) => p !== '');
  if (parti.length === 0) return null;
  const n = parti.map((p) => Number(p));
  return n.every((x) => Number.isInteger(x) && x > 0 && x < 10000) ? n : null;
}

/** Il risultato per tutte le righe: per ognuna i pezzi (una riga vuota resta [''] e non tocca le colonne a destra). */
export function dividiRighe(righe: readonly string[], opz: OpzioniDivisione): string[][] {
  if (opz.separatore === 'larghezza') {
    const pos = opz.posizioni ?? [];
    return righe.map((r) => (r === '' ? [''] : dividiALarghezza(r, pos, opz.togliSpazi)));
  }
  const sep = separatoreDi(opz, righe);
  if (sep === null) return righe.map((r) => [r]);
  return righe.map((r) => (r === '' ? [''] : dividiConSeparatore(r, sep, opz)));
}

/** Quante colonne serviranno al massimo. */
export function colonneNecessarie(divise: readonly string[][]): number {
  return divise.reduce((m, p) => Math.max(m, p.length), 1);
}
