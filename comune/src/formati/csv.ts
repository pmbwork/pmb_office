/**
 * CSV: lettura e scrittura di file a valori separati (compito T010).
 */

export interface OpzioniLettura {
  /** Carattere separatore dei campi. Se manca, lo si ricava con rilevaDelimitatore. */
  delimitatore?: string;
}

export interface OpzioniScrittura {
  /** Carattere separatore dei campi. Predefinito: virgola. */
  delimitatore?: string;
  /** Fine riga. Predefinito: '\r\n'. */
  fineRiga?: '\n' | '\r\n';
}

const CANDIDATI = [',', ';', '\t', '|'];

/** Ricava il separatore più probabile tra , ; tab | guardando le prime righe del testo. */
export function rilevaDelimitatore(testo: string): string {
  const t = testo.replace(/^﻿/, '');
  const conteggi: number[][] = [];
  let corrente = CANDIDATI.map(() => 0);
  let vuota = true;
  let inVirgolette = false;
  const chiudiRiga = (): void => {
    if (!vuota) conteggi.push(corrente);
    corrente = CANDIDATI.map(() => 0);
    vuota = true;
  };
  for (let i = 0; i < t.length && conteggi.length < 10; i++) {
    const ch = t[i];
    if (ch === '"') {
      inVirgolette = !inVirgolette;
      vuota = false;
      continue;
    }
    if (!inVirgolette && (ch === '\n' || ch === '\r')) {
      chiudiRiga();
      continue;
    }
    vuota = false;
    if (!inVirgolette) {
      const k = CANDIDATI.indexOf(ch);
      if (k >= 0) corrente[k]++;
    }
  }
  if (conteggi.length < 10) chiudiRiga();
  if (conteggi.length === 0) return ',';

  let scelto = -1;
  let migliore = 0;
  for (let k = 0; k < CANDIDATI.length; k++) {
    const n0 = conteggi[0][k];
    if (n0 > 0 && conteggi.every((r) => r[k] === n0) && n0 > migliore) {
      migliore = n0;
      scelto = k;
    }
  }
  if (scelto >= 0) return CANDIDATI[scelto];

  let totaleMax = 0;
  for (let k = 0; k < CANDIDATI.length; k++) {
    const tot = conteggi.reduce((acc, r) => acc + r[k], 0);
    if (tot > totaleMax) {
      totaleMax = tot;
      scelto = k;
    }
  }
  return scelto >= 0 ? CANDIDATI[scelto] : ',';
}

/** Legge un testo CSV e restituisce le righe, ciascuna come elenco di campi. */
export function leggiCsv(testo: string, opzioni: OpzioniLettura = {}): string[][] {
  const t = testo.replace(/^﻿/, '');
  if (t === '') return [];
  const d = opzioni.delimitatore ?? rilevaDelimitatore(t);
  const righe: string[][] = [];
  let riga: string[] = [];
  let campo = '';
  let inV = false;
  let i = 0;
  while (i < t.length) {
    const ch = t[i];
    if (inV) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        inV = false;
        i++;
        continue;
      }
      campo += ch;
      i++;
      continue;
    }
    if (ch === '"' && campo === '') {
      inV = true;
      i++;
      continue;
    }
    if (ch === d) {
      riga.push(campo);
      campo = '';
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = '';
      if (ch === '\r' && t[i + 1] === '\n') i++;
      i++;
      continue;
    }
    campo += ch;
    i++;
  }
  const ultimo = t[t.length - 1];
  if (inV || (ultimo !== '\n' && ultimo !== '\r')) {
    riga.push(campo);
    righe.push(riga);
  }
  return righe;
}

/** Scrive le righe come testo CSV. */
export function scriviCsv(righe: string[][], opzioni: OpzioniScrittura = {}): string {
  const d = opzioni.delimitatore ?? ',';
  const fr = opzioni.fineRiga ?? '\r\n';
  const campo = (v: string): string =>
    v.includes(d) || v.includes('"') || v.includes('\n') || v.includes('\r') ? '"' + v.replace(/"/g, '""') + '"' : v;
  return righe.map((r) => r.map(campo).join(d) + fr).join('');
}
