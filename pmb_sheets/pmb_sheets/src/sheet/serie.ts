/**
 * Riempi serie (come Home › Riempimento › Serie di Excel e Foglio › Riempi celle › Riempi serie di Calc): dal primo valore di ogni riga
 * (o colonna) della selezione si calcolano i successivi. Lineare: + passo; crescita: × passo; date: + passo giorni, giorni feriali (si
 * saltano sabato e domenica), mesi o anni (dal giorno di partenza, che si accorcia nei mesi più corti, come DATA.MESE). Con il valore
 * limite la serie si ferma prima di superarlo e le celle dopo restano come sono. Modulo puro: i numeri seriali delle date sono quelli
 * del motore (giorno 0 = 30/12/1899).
 */
import { addMonthsToSerial, serialToWeekday } from '../engine/functions/utils';

export type TipoSerie = 'lineare' | 'crescita' | 'data';
export type UnitaData = 'giorno' | 'feriale' | 'mese' | 'anno';
export interface ParametriSerie { tipo: TipoSerie; unita: UnitaData; passo: number; limite?: number }

/** Al massimo tante celle per una serie (anche partendo da una cella sola con il limite). */
export const CELLE_MASSIME_SERIE = 100_000;

/** Il k-esimo valore dopo quello di partenza (k = 1, 2, ...); null se non è un numero valido. */
export function valoreSerie(inizio: number, k: number, p: ParametriSerie): number | null {
  let v: number;
  if (p.tipo === 'lineare') v = inizio + p.passo * k;
  else if (p.tipo === 'crescita') v = inizio * Math.pow(p.passo, k);
  else if (p.unita === 'giorno') v = inizio + p.passo * k;
  else if (p.unita === 'mese') v = addMonthsToSerial(inizio, Math.trunc(p.passo) * k);
  else if (p.unita === 'anno') v = addMonthsToSerial(inizio, 12 * Math.trunc(p.passo) * k);
  else v = aggiungiFeriali(inizio, Math.trunc(p.passo) * k);
  if (!Number.isFinite(v)) return null;
  // i decimali della somma ripetuta (0,1 + 0,2...) si tolgono come fa Excel: 15 cifre significative
  return Number(v.toPrecision(15));
}

/** Vero se il valore ha già superato il limite (nel verso del passo). */
export function oltreIlLimite(v: number, inizio: number, p: ParametriSerie): boolean {
  if (p.limite === undefined) return false;
  const crescente = p.tipo === 'crescita' ? (inizio >= 0 ? p.passo >= 1 : p.passo < 1) : p.passo >= 0;
  return crescente ? v > p.limite + 1e-9 : v < p.limite - 1e-9;
}

/** I valori da scrivere dopo quello di partenza, fino a `quanti` o al limite. */
export function valoriSerie(inizio: number, quanti: number, p: ParametriSerie): number[] {
  const out: number[] = [];
  for (let k = 1; k <= Math.min(quanti, CELLE_MASSIME_SERIE); k++) {
    const v = valoreSerie(inizio, k, p);
    if (v === null || oltreIlLimite(v, inizio, p)) break;
    out.push(v);
  }
  return out;
}

/** Un giorno feriale (lunedì-venerdì) n giorni feriali dopo (o prima, se n < 0); da un sabato o una domenica si parte dal lunedì o venerdì. */
function aggiungiFeriali(inizio: number, n: number): number {
  let d = Math.floor(inizio);
  const frazione = inizio - d;
  const passo = n >= 0 ? 1 : -1;
  let resto = Math.abs(n);
  while (resto > 0) {
    d += passo;
    const g = serialToWeekday(d, 1); // 1 = domenica ... 7 = sabato
    if (g !== 1 && g !== 7) resto--;
  }
  return d + frazione;
}
