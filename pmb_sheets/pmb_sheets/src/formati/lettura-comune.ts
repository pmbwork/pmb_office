// Parti comuni ai lettori dei formati che si aprono soltanto (.html, .dif, .slk, .xml di Excel 2003, .xlsb).
// Puro: nessun accesso al disco.
import { MAX_COLS, MAX_ROWS } from '../engine/address';
import { foglioVuoto, indirizzoCella, type FoglioScambio } from './scambio';
import { tipoLetterale } from './xlsx-scrivi';

/** Numero seriale (giorni dal 30/12/1899) di una data ISO "AAAA-MM-GG" o "AAAA-MM-GGThh:mm:ss", oppure null. */
export function serialeDaIso(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/.exec(s.trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0), Math.round(Number(`0.${m[7] ?? '0'}`) * 1000));
  return Number.isFinite(ms) ? ms / 86_400_000 + 25569 : null;
}

const NUMERO_CON_VIRGOLA = /^[+-]?(\d+|\d{1,3}(\.\d{3})+),\d+$/;
const NUMERO_SEMPLICE = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;

/**
 * Il testo che si mette in una cella per un valore letto da un file di testo o di pagina:
 * i numeri restano numeri, gli zeri iniziali ("00123"), i numeri lunghi (codici) e il testo che comincia con "=" restano testo (non si esegue nulla).
 */
export function testoPerCella(grezzo: string): { testo: string; comeTesto: boolean } {
  const v = grezzo.replace(/ /g, ' ').trim();
  if (v === '') return { testo: '', comeTesto: false };
  if (/^0\d+$/.test(v) || /^\d{16,}$/.test(v) || v.startsWith('=') || v.startsWith("'")) return { testo: `'${v}`, comeTesto: true };
  if (NUMERO_CON_VIRGOLA.test(v)) return { testo: v.replace(/\./g, '').replace(',', '.'), comeTesto: false };
  if (NUMERO_SEMPLICE.test(v)) return { testo: v, comeTesto: false };
  return { testo: v, comeTesto: false };
}

/** Scrive una cella nel foglio rispettando i limiti di righe e colonne. Un testo dichiarato come testo dal file ma che sembra un numero, un booleano o una formula si scrive con l'apice, per restare testo (e non eseguire niente). */
export function mettiCella(f: FoglioScambio, riga: number, colonna: number, testo: string, dichiaratoTesto = false): void {
  if (testo === '' || riga < 1 || colonna < 1 || riga > MAX_ROWS || colonna > MAX_COLS) return;
  const letterale = tipoLetterale(testo);
  const conApice = (dichiaratoTesto && letterale !== 'testo') || letterale === 'formula' || (testo.startsWith("'") && !testo.startsWith("''") && dichiaratoTesto);
  f.celle[indirizzoCella(riga, colonna)] = conApice ? `'${testo}` : testo;
}

/** Un foglio con un nome valido e non vuoto. */
export function nuovoFoglio(nome: string): FoglioScambio {
  const pulito = Array.from(nome.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 31).join('').replace(/^'+|'+$/g, '').trim();
  return foglioVuoto(pulito === '' ? 'Foglio' : pulito);
}

/** Rende unici i nomi dei fogli (senza badare alle maiuscole) aggiungendo un numero. */
export function nomiUniciFogli(fogli: FoglioScambio[]): void {
  const visti = new Set<string>();
  for (const f of fogli) {
    let nome = f.nome;
    let n = 2;
    while (visti.has(nome.toLowerCase())) nome = `${Array.from(f.nome).slice(0, 28).join('')} ${n++}`;
    visti.add(nome.toLowerCase());
    f.nome = nome;
  }
}
