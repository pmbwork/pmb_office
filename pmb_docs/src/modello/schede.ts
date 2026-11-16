import { t } from '../i18n/lingua';
// Schede ("Tab") di un documento: più testi nello stesso file, ognuno col suo titolo. Nel formato .fdoc restano separate;
// negli altri formati (docx, odt, pdf, txt) si salvano una dopo l'altra, ciascuna con il titolo come intestazione e su un foglio nuovo.

import { conParagrafi, deserializza, serializza, type Documento, type Paragrafo } from './documento';

export interface Scheda { titolo: string; doc: Documento }
export const SCHEDE_MASSIME = 20;
export const LUNGHEZZA_TITOLO_SCHEDA = 80;

/** Il titolo ripulito (spazi ridotti), oppure null se è vuoto, troppo lungo o ha caratteri di controllo. */
export function titoloSchedaValido(t: string): string | null {
  const s = t.replace(/\s+/g, ' ').trim();
  if (s === '' || s.length > LUNGHEZZA_TITOLO_SCHEDA || /[\x00-\x1f\x7f]/.test(s)) return null;
  return s;
}

/** Un titolo "Scheda N" che non sia già usato. */
export function titoloNuovaScheda(esistenti: string[]): string {
  const usati = new Set(esistenti.map((t) => t.toLowerCase()));
  for (let n = esistenti.length + 1; ; n++) { const t = `Scheda ${n}`; if (!usati.has(t.toLowerCase())) return t; }
}

/** Tutte le schede in un solo documento: con una scheda sola è quella; con più, ognuna comincia con il suo titolo (Titolo 1) su un foglio nuovo. */
export function unisciSchede(schede: Scheda[]): Documento {
  if (schede.length === 1) return schede[0].doc;
  const paragrafi: Paragrafo[] = [];
  let prossimaTabella = 0;
  const nomiSegnalibri = new Set<string>();
  /** Il nome di un segnalibro, cambiato (con un numero) se un'altra scheda ne ha già uno uguale: nel documento unito i nomi devono essere unici. */
  const nomeUnico = (nome: string): string => {
    let n = nome;
    for (let k = 2; nomiSegnalibri.has(n.toLowerCase()); k++) n = `${nome} (${k})`;
    nomiSegnalibri.add(n.toLowerCase());
    return n;
  };
  schede.forEach((s, k) => {
    paragrafi.push({ st: '1', ...(k > 0 ? { sp: true } : {}), runs: [{ t: s.titolo, g: false, c: false, s: false }] });
    const nuoveTabelle = new Map<number, number>();
    for (const q of s.doc.paragrafi) {
      const p: Paragrafo = q.sg !== undefined ? { ...q, sg: nomeUnico(q.sg) } : q;
      if (!p.tb) { paragrafi.push(p); continue; }
      if (!nuoveTabelle.has(p.tb.i)) nuoveTabelle.set(p.tb.i, prossimaTabella++);
      paragrafi.push({ ...p, tb: { ...p.tb, i: nuoveTabelle.get(p.tb.i)! } });
    }
  });
  const primo = schede[0].doc;
  return { ...conParagrafi(primo, paragrafi), ...(primo.intestazione !== undefined ? { intestazione: primo.intestazione } : {}), ...(primo.piede !== undefined ? { piede: primo.piede } : {}) };
}

/** Il file .fdoc con più schede: ogni scheda è un documento .fdoc scritto come testo, col suo titolo. */
export function serializzaSchede(schede: Scheda[]): string {
  return JSON.stringify({ v: 1, schede: schede.map((s) => ({ t: s.titolo, d: serializza(s.doc) })) });
}

/** Le schede di un file .fdoc, oppure null se il file è un documento normale (senza schede). Lancia un errore se le schede sono scritte male. */
export function leggiSchede(testo: string): Scheda[] | null {
  let dati: unknown;
  try { dati = JSON.parse(testo); } catch { return null; }
  const o = dati as { v?: unknown; schede?: unknown };
  if (!o || typeof o !== 'object' || !Array.isArray(o.schede)) return null;
  if (o.v !== 1 || o.schede.length < 1 || o.schede.length > SCHEDE_MASSIME) throw new Error(t('Documento non valido: da 1 a {} schede', SCHEDE_MASSIME));
  const nomi: string[] = [];
  return o.schede.map((x: unknown) => {
    const s = x as { t?: unknown; d?: unknown };
    if (!s || typeof s !== 'object' || typeof s.d !== 'string') throw new Error(t('Documento non valido: scheda'));
    const titolo = (typeof s.t === 'string' ? titoloSchedaValido(s.t) : null) ?? titoloNuovaScheda(nomi);
    nomi.push(titolo);
    return { titolo, doc: deserializza(s.d) };
  });
}
