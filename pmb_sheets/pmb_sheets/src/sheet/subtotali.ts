/**
 * Subtotali (come Dati › Subtotali di Excel): in una tabella con l'intestazione, a ogni cambio di valore della colonna del gruppo si
 * aggiunge una riga «<valore> Totale» con SUBTOTAL(funzione; intervallo del gruppo) nelle colonne scelte, e in fondo il «Totale
 * complessivo» su tutti i dati (SUBTOTAL ignora da sé i subtotali che contiene). Come Excel, provato con Range.Subtotal
 * (LAVORO/studio-microsoft-office/excel_subtotali.py). Qui si calcola il piano; le righe le inserisce la griglia. Modulo puro.
 */
import { columnIndexToLetters } from '../engine/address';

/** Le funzioni di SUBTOTAL che si possono scegliere: numero e nome. */
export const FUNZIONI_SUBTOTALE: Array<[number, string]> = [[9, 'Somma'], [1, 'Media'], [2, 'Conteggio dei numeri'], [3, 'Conteggio'], [4, 'Massimo'], [5, 'Minimo'], [6, 'Prodotto']];

export interface PianoSubtotali {
  /** le righe da inserire, nell'ordine in cui si inseriscono (ognuna con le coordinate di quel momento: le precedenti sono già inserite) */
  inserisci: number[];
  /** le celle da scrivere dopo gli inserimenti (coordinate finali) */
  celle: Array<{ riga: number; colonna: number; raw: string }>;
}

/**
 * valori = il testo della colonna del gruppo per ogni riga di dati, dall'alto; primaRiga = la riga del primo dato (sotto l'intestazione).
 * etichetta(valore) e complessivo danno i testi delle righe dei totali (nella lingua del programma).
 */
export function pianoSubtotali(valori: string[], primaRiga: number, colonnaGruppo: number, colonne: number[], funzione: number,
  etichetta: (valore: string) => string, complessivo: string): PianoSubtotali {
  const inserisci: number[] = [];
  const celle: PianoSubtotali['celle'] = [];
  if (valori.length === 0 || colonne.length === 0) return { inserisci, celle };
  const somma = (col: number, da: number, a: number): string => `=SUBTOTAL(${funzione},${columnIndexToLetters(col)}${da}:${columnIndexToLetters(col)}${a})`;
  let aggiunte = 0;
  let inizio = 0;
  for (let i = 1; i <= valori.length; i++) {
    if (i < valori.length && valori[i] === valori[inizio]) continue;
    const da = primaRiga + inizio + aggiunte;
    const a = primaRiga + i - 1 + aggiunte;
    inserisci.push(a + 1);
    celle.push({ riga: a + 1, colonna: colonnaGruppo, raw: etichetta(valori[inizio]) });
    for (const c of colonne) celle.push({ riga: a + 1, colonna: c, raw: somma(c, da, a) });
    aggiunte++;
    inizio = i;
  }
  // il totale complessivo sotto l'ultimo subtotale, sull'intervallo dal primo all'ultimo dato
  const ultimoDato = primaRiga + valori.length - 1 + aggiunte - 1;
  const riga = ultimoDato + 2;
  inserisci.push(riga);
  celle.push({ riga, colonna: colonnaGruppo, raw: complessivo });
  for (const c of colonne) celle.push({ riga, colonna: c, raw: somma(c, primaRiga, ultimoDato) });
  return { inserisci, celle };
}
