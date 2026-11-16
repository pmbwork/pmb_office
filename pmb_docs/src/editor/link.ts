// Link di pmb_docs: controllo degli indirizzi e modifiche al documento (inserire, cambiare, togliere un link).
// Tutto puro. Un link è un attributo del testo (u): vale solo per indirizzi http, https e mailto.
import {
  applicaAttributo, cursore, collassata, formatoIn, inserisciTesto, ordina, testoParagrafo, urlValido,
  type Documento, type Formato, type Posizione, type Stato,
} from '../modello/documento';

/** Un link nel documento: il tratto di testo (dentro un solo paragrafo) che porta lo stesso indirizzo. */
export interface LinkTrovato { p: number; da: number; a: number; u: string; testo: string }

/** Cosa c'è sotto il cursore o la selezione, per il dialogo: indirizzo (null se non c'è link), testo, e se c'è una selezione. */
export interface StatoLink { url: string | null; testo: string; selezione: boolean }

const POSTA = /^[^\s@/:?#]+@[^\s@/:?#]+\.[^\s@/:?#]+$/;
const DOMINIO = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:[/?#]\S*)?$/i;

/**
 * Trasforma quello che scrive l'utente in un indirizzo valido: "www.esempio.it" diventa https://www.esempio.it,
 * "me@esempio.it" diventa mailto:me@esempio.it. Restituisce null se non è un indirizzo accettato (per esempio javascript:).
 */
export function normalizzaUrl(testo: string): string | null {
  const t = testo.trim();
  if (t === '') return null;
  if (/^(?:https?:\/\/|mailto:)/i.test(t)) return urlValido(t) ? t : null;
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t)) return null;
  let u: string | null = null;
  if (POSTA.test(t)) u = `mailto:${t}`;
  else if (DOMINIO.test(t)) u = `https://${t}`;
  return u !== null && urlValido(u) ? u : null;
}

function runInPosizione(doc: Documento, p: number, o: number): { u?: string } | undefined {
  const runs = doc.paragrafi[p].runs;
  let pos = 0;
  for (const r of runs) {
    if (o >= pos && o < pos + r.t.length) return r;
    pos += r.t.length;
  }
  return undefined;
}

/** Il link che contiene il carattere subito prima del punto, oppure quello subito dopo; null se il punto non tocca nessun link. */
export function linkAl(doc: Documento, pos: Posizione): LinkTrovato | null {
  const p = Math.min(Math.max(0, pos.p), doc.paragrafi.length - 1);
  const t = testoParagrafo(doc.paragrafi[p]);
  const o = Math.min(Math.max(0, pos.o), t.length);
  const prima = o > 0 ? runInPosizione(doc, p, o - 1)?.u : undefined;
  const dopo = o < t.length ? runInPosizione(doc, p, o)?.u : undefined;
  const u = prima ?? dopo;
  if (u === undefined) return null;
  let da = prima !== undefined ? o - 1 : o;
  let a = prima !== undefined ? o : o + 1;
  while (da > 0 && runInPosizione(doc, p, da - 1)?.u === u) da--;
  while (a < t.length && runInPosizione(doc, p, a)?.u === u) a++;
  return { p, da, a, u, testo: t.slice(da, a) };
}

/** Cosa mostrare nel dialogo del link per lo stato corrente. */
export function statoLink(stato: Stato): StatoLink {
  const [i, f] = ordina(stato.doc, stato.sel);
  if (collassata(stato.sel)) {
    const l = linkAl(stato.doc, i);
    return l ? { url: l.u, testo: l.testo, selezione: false } : { url: null, testo: '', selezione: false };
  }
  const testo = i.p === f.p ? testoParagrafo(stato.doc.paragrafi[i.p]).slice(i.o, f.o) : '';
  let url: string | null | undefined;
  for (let p = i.p; p <= f.p; p++) {
    const da = p === i.p ? i.o : 0;
    const a = p === f.p ? f.o : testoParagrafo(stato.doc.paragrafi[p]).length;
    for (let o = da; o < a; o++) {
      const u = runInPosizione(stato.doc, p, o)?.u ?? null;
      if (url === undefined) url = u;
      else if (url !== u) return { url: null, testo, selezione: true };
    }
  }
  return { url: url ?? null, testo, selezione: true };
}

function intervallo(p: number, da: number, a: number) {
  return { ancora: { p, o: da }, fuoco: { p, o: a } };
}

/** Scrive il testo al posto di da-a nello stesso paragrafo, come link, e lascia il cursore subito dopo. */
function scriviLink(stato: Stato, p: number, da: number, a: number, testo: string, url: string, mantieniFormato = false): Stato {
  let formato: Formato | undefined;
  if (mantieniFormato) { const { u, ...resto } = formatoIn(stato.doc, { p, o: da + 1 }); void u; formato = resto; }
  const base = inserisciTesto({ ...stato, sel: intervallo(p, da, a), pendenti: null }, testo, formato);
  const fine = da + testo.length;
  return { doc: applicaAttributo(base.doc, intervallo(p, da, fine), 'u', url), sel: cursore(p, fine), pendenti: null };
}

/**
 * Mette un link. Con del testo selezionato la selezione diventa il link; col cursore dentro un link ne cambia l'indirizzo
 * (e il testo, se se ne dà uno diverso); col cursore altrove scrive il testo (o l'indirizzo, se manca) come link.
 * Se l'indirizzo non è valido restituisce lo stato identico.
 */
export function inserisciLink(stato: Stato, indirizzo: string, testo?: string): Stato {
  const url = normalizzaUrl(indirizzo);
  if (url === null) return stato;
  if (!collassata(stato.sel)) {
    return { ...stato, doc: applicaAttributo(stato.doc, stato.sel, 'u', url), pendenti: null };
  }
  const [c] = ordina(stato.doc, stato.sel);
  const nuovoTesto = (testo ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
  const esistente = linkAl(stato.doc, c);
  if (esistente) {
    if (nuovoTesto.trim() !== '' && nuovoTesto !== esistente.testo) return scriviLink(stato, esistente.p, esistente.da, esistente.a, nuovoTesto, url, true);
    return { ...stato, doc: applicaAttributo(stato.doc, intervallo(esistente.p, esistente.da, esistente.a), 'u', url), pendenti: null };
  }
  return scriviLink(stato, c.p, c.o, c.o, nuovoTesto.trim() !== '' ? nuovoTesto : url, url);
}

/** Toglie il link dalla selezione, o dal link sotto il cursore. Il testo resta. Se non c'è niente da togliere restituisce lo stato identico. */
export function rimuoviLink(stato: Stato): Stato {
  if (!collassata(stato.sel)) {
    const s = statoLink(stato);
    if (s.url === null && !haUnLink(stato)) return stato;
    return { ...stato, doc: applicaAttributo(stato.doc, stato.sel, 'u', undefined), pendenti: null };
  }
  const l = linkAl(stato.doc, ordina(stato.doc, stato.sel)[0]);
  if (!l) return stato;
  return { ...stato, doc: applicaAttributo(stato.doc, intervallo(l.p, l.da, l.a), 'u', undefined), pendenti: null };
}

function haUnLink(stato: Stato): boolean {
  const [i, f] = ordina(stato.doc, stato.sel);
  for (let p = i.p; p <= f.p; p++) {
    const da = p === i.p ? i.o : 0;
    const a = p === f.p ? f.o : testoParagrafo(stato.doc.paragrafi[p]).length;
    for (let o = da; o < a; o++) if (runInPosizione(stato.doc, p, o)?.u !== undefined) return true;
  }
  return false;
}
