import { t } from '../i18n/lingua';
// Schede ("Tab") di un documento: più testi nello stesso file, ognuno col suo titolo. Nel formato .fdoc restano separate;
// negli altri formati (docx, odt, pdf, txt) si salvano una dopo l'altra, ciascuna con il titolo come intestazione e su un foglio nuovo.

import { commentiUsati, conParagrafi, deserializza, serializza, stiliUsati, type Commento, type Documento, type Paragrafo, type StilePersonale } from './documento';

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
  // i commenti di ogni scheda prendono un identificativo nuovo (numero della scheda e il loro): nel documento unito devono essere unici
  const commenti: Commento[] = [];
  let revisioni = false;
  // stili personali: uno stile uguale (stesso nome e stesso aspetto) in più schede resta uno; altrimenti prende identificativo e nome nuovi
  const stili: StilePersonale[] = [];
  const firma = (x: StilePersonale): string => JSON.stringify({ ...x, id: '' });
  const stileUnito = (x: StilePersonale, k: number): string => {
    const uguale = stili.find((y) => firma(y) === firma(x));
    if (uguale) return uguale.id;
    let id = x.id;
    for (let n = 2; stili.some((y) => y.id === id); n++) id = `${x.id.slice(0, 30)}_${k + 1}_${n}`;
    let nome = x.nome;
    for (let n = 2; stili.some((y) => y.nome.toLowerCase() === nome.toLowerCase()); n++) nome = `${x.nome.slice(0, 50)} (${n})`;
    stili.push({ ...x, id, nome });
    return id;
  };
  schede.forEach((s, k) => {
    const nuoviStili = new Map(stiliUsati(s.doc).map((x) => [x.id, stileUnito(x, k)] as const));
    paragrafi.push({ st: '1', ...(k > 0 ? { sp: true } : {}), runs: [{ t: s.titolo, g: false, c: false, s: false }] });
    const nuoveTabelle = new Map<number, number>();
    const idNuovo = (id: string): string => `${k + 1}_${id}`.slice(0, 40);
    for (const c of commentiUsati(s.doc)) commenti.push({ ...c, id: idNuovo(c.id) });
    if (s.doc.revisioni) revisioni = true;
    for (const q0 of s.doc.paragrafi) {
      const q: Paragrafo = q0.runs.some((r) => r.cm !== undefined) ? { ...q0, runs: q0.runs.map((r) => (r.cm !== undefined ? { ...r, cm: idNuovo(r.cm) } : r)) } : q0;
      const q2: Paragrafo = q.su !== undefined && nuoviStili.has(q.su) ? { ...q, su: nuoviStili.get(q.su)! } : q;
      const p: Paragrafo = q2.sg !== undefined ? { ...q2, sg: nomeUnico(q2.sg) } : q2;
      if (!p.tb) { paragrafi.push(p); continue; }
      if (!nuoveTabelle.has(p.tb.i)) nuoveTabelle.set(p.tb.i, prossimaTabella++);
      paragrafi.push({ ...p, tb: { ...p.tb, i: nuoveTabelle.get(p.tb.i)! } });
    }
  });
  const primo = schede[0].doc;
  const unito: Documento = { ...conParagrafi(primo, paragrafi), ...(primo.intestazione !== undefined ? { intestazione: primo.intestazione } : {}), ...(primo.piede !== undefined ? { piede: primo.piede } : {}) };
  delete unito.commenti;
  delete unito.revisioni;
  delete unito.stili;
  if (stili.length > 0) unito.stili = stili;
  if (commenti.length > 0) unito.commenti = commenti;
  if (revisioni) unito.revisioni = true;
  return unito;
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
