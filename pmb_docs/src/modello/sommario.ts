// Sommario e struttura del documento di pmb_docs: funzioni pure.
// Un titolo è un paragrafo con lo stile Titolo 1, 2 o 3. Il sommario è un blocco di paragrafi con l'attributo sm: il nome del segnalibro
// del titolo a cui rimandano (n) e il livello (l). I titoli prendono un segnalibro interno «_Toc…» (come in Word, dove i segnalibri che
// cominciano con «_» sono nascosti). Il numero di pagina non è nel testo: lo calcola l'editor dopo l'impaginazione.
import { conParagrafi, ordina, testoParagrafo, type Documento, type Paragrafo, type Stato } from './documento';

export type LivelloTitolo = 1 | 2 | 3;
export interface VoceStruttura { p: number; livello: LivelloTitolo; testo: string; sg?: string }

const livelloDi = (par: Paragrafo): LivelloTitolo | null => (par.st === '1' ? 1 : par.st === '2' ? 2 : par.st === '3' ? 3 : null);
const testoVoce = (par: Paragrafo): string => testoParagrafo(par).replace(/[￼]/g, '').replace(/\s+/g, ' ').trim();

/** I titoli del documento (Titolo 1-3, non vuoti, fuori dal sommario), nell'ordine. */
export function strutturaDocumento(doc: Documento): VoceStruttura[] {
  const out: VoceStruttura[] = [];
  doc.paragrafi.forEach((par, p) => {
    const l = livelloDi(par);
    if (l === null || par.sm) return;
    const testo = testoVoce(par);
    if (testo === '') return;
    out.push({ p, livello: l, testo, ...(par.sg !== undefined ? { sg: par.sg } : {}) });
  });
  return out;
}
/** Il titolo della sezione in cui sta il paragrafo p (l'ultimo titolo prima o su p), o null. */
export function titoloCorrente(doc: Documento, p: number): number | null {
  let trovato: number | null = null;
  for (const v of strutturaDocumento(doc)) { if (v.p <= p) trovato = v.p; else break; }
  return trovato;
}

/** Dà ai titoli senza segnalibro un segnalibro interno «_TocNNNNNNNN» unico; restituisce il documento e i nomi per paragrafo. */
function segnaTitoli(doc: Documento): { doc: Documento; nomi: Map<number, string> } {
  const usati = new Set(doc.paragrafi.filter((x) => x.sg !== undefined).map((x) => x.sg!.toLowerCase()));
  let prossimo = 1;
  const nuovoNome = (): string => {
    let n: string;
    do { n = `_Toc${String(prossimo++).padStart(8, '0')}`; } while (usati.has(n.toLowerCase()));
    usati.add(n.toLowerCase());
    return n;
  };
  const nomi = new Map<number, string>();
  const paragrafi = doc.paragrafi.map((par, p) => {
    if (livelloDi(par) === null || par.sm || testoVoce(par) === '') return par;
    if (par.sg !== undefined) { nomi.set(p, par.sg); return par; }
    const n = nuovoNome();
    nomi.set(p, n);
    return { ...par, sg: n };
  });
  return { doc: conParagrafi(doc, paragrafi), nomi };
}
function vociSommario(doc: Documento, nomi: Map<number, string>): Paragrafo[] {
  return strutturaDocumento(doc).map((v) => ({ sm: { n: nomi.get(v.p) ?? v.sg ?? '', l: v.livello }, runs: [{ t: v.testo, g: false, c: false, s: false }] }));
}

/** I blocchi di paragrafi del sommario: [inizio, fine) per ognuno. */
export function blocchiSommario(doc: Documento): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let p = 0; p < doc.paragrafi.length; p++) {
    if (!doc.paragrafi[p].sm) continue;
    let q = p;
    while (q < doc.paragrafi.length && doc.paragrafi[q].sm) q++;
    out.push([p, q]);
    p = q;
  }
  return out;
}

/**
 * Inserisce il sommario nel punto del cursore (al posto del paragrafo se è vuoto, altrimenti dopo). null se non ci sono titoli o se il
 * cursore è in una tabella o già nel sommario.
 */
export function inserisciSommario(stato: Stato): Stato | null {
  const [c] = ordina(stato.doc, stato.sel);
  const qui = stato.doc.paragrafi[c.p];
  if (qui.tb || qui.sm) return null;
  const { doc, nomi } = segnaTitoli(stato.doc);
  const voci = vociSommario(doc, nomi);
  if (voci.length === 0) return null;
  const vuoto = testoParagrafo(qui) === '';
  const dove = vuoto ? c.p : c.p + 1;
  const paragrafi = [...doc.paragrafi.slice(0, dove), ...voci, { runs: [] }, ...doc.paragrafi.slice(vuoto ? c.p + 1 : c.p + 1)];
  // il paragrafo vuoto dopo il sommario serve a continuare a scrivere; se c'è già un paragrafo vuoto subito dopo, non se ne aggiunge un altro
  const dopo = paragrafi[dove + voci.length + 1];
  if (dopo && testoParagrafo(dopo) === '' && !dopo.tb && !dopo.sm) paragrafi.splice(dove + voci.length, 1);
  const pos = { p: dove + voci.length, o: 0 };
  return { doc: conParagrafi(doc, paragrafi), sel: { ancora: pos, fuoco: pos }, pendenti: null };
}

/** Rifà ogni sommario del documento con i titoli di adesso (stesso posto). Lo stesso documento se non ce ne sono. */
export function aggiornaSommario(doc0: Documento): Documento {
  if (blocchiSommario(doc0).length === 0) return doc0;
  const { doc, nomi } = segnaTitoli(doc0);
  const voci = vociSommario(doc, nomi);
  const paragrafi: Paragrafo[] = [];
  for (let p = 0; p < doc.paragrafi.length; p++) {
    if (!doc.paragrafi[p].sm) { paragrafi.push(doc.paragrafi[p]); continue; }
    while (p + 1 < doc.paragrafi.length && doc.paragrafi[p + 1].sm) p++;
    paragrafi.push(...(voci.length > 0 ? voci.map((v) => ({ ...v, runs: v.runs.map((r) => ({ ...r })) })) : [{ runs: [] }]));
  }
  return conParagrafi(doc, paragrafi);
}

/** Il paragrafo del titolo a cui rimanda una voce del sommario (dal nome del segnalibro), o null. */
export function destinazioneVoce(doc: Documento, nome: string): number | null {
  const m = nome.toLowerCase();
  const p = doc.paragrafi.findIndex((x) => x.sg !== undefined && x.sg.toLowerCase() === m && !x.sm);
  return p >= 0 ? p : null;
}
