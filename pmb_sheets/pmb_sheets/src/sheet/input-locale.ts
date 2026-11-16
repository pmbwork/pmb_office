// Numeri e formule come li scrive e li legge una persona italiana: virgola decimale, punto per le migliaia, punto e virgola tra gli argomenti,
// nomi italiani delle funzioni. Dentro il foglio resta sempre la forma canonica (punto decimale, virgola tra gli argomenti, nomi inglesi).
import { translateFormula } from '../engine/i18n';
import { localeNumeri } from './locale-numeri';

/** 1,5  -12,50  0,5%  */
const NUMERO_IT = /^[+-]?\d+,\d+%?$/;
/** 1.234  -12.345.678,9  (almeno un gruppo di tre cifre dopo il punto) */
const NUMERO_IT_MIGLIAIA = /^[+-]?\d{1,3}(\.\d{3})+(,\d+)?%?$/;
/** la forma canonica di un numero con decimali: 1.5  -0.25  12.5% */
const NUMERO_CANONICO = /^[+-]?\d+\.\d+%?$/;

/** Dal testo scritto dall'utente alla forma canonica da dare al foglio. Quello che non è un numero italiano, un VERO/FALSO o una formula resta com'è. */
export function daInputUtente(testo: string): string {
  if (testo.startsWith('=')) return translateFormula(testo, 'it', 'en');
  const t = testo.trim();
  const maiuscolo = t.toUpperCase();
  if (maiuscolo === 'VERO') return 'TRUE';
  if (maiuscolo === 'FALSO') return 'FALSE';
  if (NUMERO_IT.test(t)) return t.replace(',', '.');
  if (NUMERO_IT_MIGLIAIA.test(t)) return t.replace(/\./g, '').replace(',', '.');
  return testo;
}

/** Dalla forma canonica del foglio a quella da mostrare mentre si modifica una cella. */
export function perInputUtente(raw: string): string {
  if (raw.startsWith('=')) return translateFormula(raw, 'en', 'it');
  if (raw === 'TRUE') return 'VERO';
  if (raw === 'FALSE') return 'FALSO';
  if (NUMERO_CANONICO.test(raw)) return raw.replace('.', ',');
  return raw;
}

// --- date, ore, percentuali e valute scritte a mano ---

export interface InputInterpretato {
  /** quello che va nella cella (forma interna del foglio) */
  raw: string;
  /** il formato da dare alla cella se non ne ha già uno: scrivere 05/03/2026 la rende una data, 10% una percentuale */
  formato?: string;
}

const GIORNI_EPOCA = Date.UTC(1899, 11, 30);
const serialeData = (anno: number, mese: number, giorno: number): number | null => {
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (d.getUTCFullYear() !== anno || d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null;
  return Math.round((d.getTime() - GIORNI_EPOCA) / 86_400_000);
};
const annoDaDueCifre = (a: string): number => {
  const n = Number(a);
  return a.length === 4 ? n : n < 30 ? 2000 + n : 1900 + n; // come Excel: 00-29 -> 2000-2029, 30-99 -> 1930-1999
};

/** La data scritta come gg/mm/aaaa, gg-mm-aaaa, gg.mm.aaaa (con l'inglese mm/gg/aaaa) o aaaa-mm-gg; il numero di serie, o null. */
function dataScritta(t: string): number | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return serialeData(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})$/.exec(t);
  if (!m) return null;
  const a = annoDaDueCifre(m[4]);
  return localeNumeri() === 'it' ? serialeData(a, Number(m[3]), Number(m[1])) : serialeData(a, Number(m[1]), Number(m[3]));
}

/** L'ora scritta come h:mm, hh:mm:ss (anche con AM/PM); la frazione di giorno e il formato, o null. */
function oraScritta(t: string): { frazione: number; secondi: boolean; ampm: boolean } | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])[Mm]?)?$/.exec(t);
  if (!m) return null;
  let ore = Number(m[1]);
  const minuti = Number(m[2]);
  const sec = m[3] !== undefined ? Number(m[3]) : 0;
  if (minuti > 59 || sec > 59) return null;
  if (m[4]) {
    if (ore < 1 || ore > 12) return null;
    ore = (ore % 12) + (m[4].toLowerCase() === 'p' ? 12 : 0);
  } else if (ore > 23) return null;
  return { frazione: (ore * 3600 + minuti * 60 + sec) / 86400, secondi: m[3] !== undefined, ampm: Boolean(m[4]) };
}

/** Un numero come lo scrive chi usa la virgola decimale e il punto per le migliaia (1.234,5  12,5  7); i decimali scritti e il valore, o null. */
function numeroScritto(t: string): { valore: number; decimali: number } | null {
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    const [i, d = ''] = t.replace(/\./g, '').split(',');
    return { valore: Number(`${i}.${d || '0'}`), decimali: d.length };
  }
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const [i, d = ''] = t.replace(',', '.').split('.');
    return { valore: Number(`${i}.${d || '0'}`), decimali: d.length };
  }
  return null;
}

const arrotonda = (n: number) => Number(n.toPrecision(15));

/**
 * Come daInputUtente, ma riconosce anche date, ore, percentuali e valute: restituisce il numero (o il numero di serie) da mettere nella cella e il formato
 * con cui mostrarlo. Quello che non si riconosce resta com'è, senza formato. `daInputUtente` resta la sola conversione di numeri, VERO/FALSO e formule.
 */
export function interpretaInput(testo: string): InputInterpretato {
  const base = daInputUtente(testo);
  if (testo.startsWith('=') || testo.startsWith("'")) return { raw: base };
  const t = testo.trim();
  if (t === '' || /^[+-]?\d+(\.\d+)?$/.test(t)) return { raw: base };
  const eNumeroOBooleano = base !== testo && !t.endsWith('%');
  if (eNumeroOBooleano) return { raw: base };

  // percentuale: 10%  10,5%  -3%
  const pc = /^([+-]?)(\S+?)\s*%$/.exec(t);
  if (pc) {
    const n = numeroScritto(pc[2]);
    if (n) {
      const valore = arrotonda((pc[1] === '-' ? -n.valore : n.valore) / 100);
      return { raw: String(valore), formato: n.decimali === 0 ? '0%' : `0.${'0'.repeat(Math.min(n.decimali, 6))}%` };
    }
  }

  // valuta: €5  € 1.234,50  5 €  -€5  €-5
  const davanti = /^(-?)\s*€\s*(-?)\s*([\d.,]+)$/.exec(t);
  const dopo = davanti ? null : /^(-?)\s*([\d.,]+)\s*€$/.exec(t);
  if (davanti || dopo) {
    const negativo = davanti ? davanti[1] === '-' || davanti[2] === '-' : dopo![1] === '-';
    const n = numeroScritto(davanti ? davanti[3] : dopo![2]);
    if (n) return { raw: String(negativo ? -n.valore : n.valore), formato: '€#,##0.00' };
  }

  // data, ora, data e ora
  const dataOra = /^(\S+)\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm]?)?)$/.exec(t);
  if (dataOra) {
    const d = dataScritta(dataOra[1]);
    const o = oraScritta(dataOra[2]);
    if (d !== null && o) return { raw: String(arrotonda(d + o.frazione)), formato: o.secondi ? 'dd/mm/yyyy hh:mm:ss' : 'dd/mm/yyyy hh:mm' };
  }
  const d = dataScritta(t);
  if (d !== null) return { raw: String(d), formato: 'dd/mm/yyyy' };
  const o = oraScritta(t);
  if (o) return { raw: String(arrotonda(o.frazione)), formato: o.ampm ? (o.secondi ? 'h:mm:ss AM/PM' : 'h:mm AM/PM') : o.secondi ? 'hh:mm:ss' : 'hh:mm' };
  return { raw: base };
}
