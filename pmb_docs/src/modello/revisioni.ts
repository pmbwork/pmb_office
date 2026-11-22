// Commenti e modifiche registrate (revisioni) di pmb_docs: funzioni pure sul modello del documento.
// Un commento è un elenco nel documento (doc.commenti: autore, data, testo, risposte, risolto) più l'attributo cm sui tratti di testo
// a cui si riferisce; quando tutto il suo testo viene cancellato, il commento sparisce da solo (vedi commentiUsati).
// Con la registrazione accesa (doc.revisioni) il testo scritto si segna come inserito (rv.t = 'i') e quello cancellato non sparisce
// ma si segna come cancellato (rv.t = 'd'); il proprio testo inserito e poi cancellato sparisce davvero, come in Word.
// Gli a capo e l'unione di due paragrafi non si registrano: si fanno e basta.
import {
  cancella, collassata, commentiUsati, conParagrafi, idCommentiNelTesto, inserisciTesto, lunghezzaRuns, modificaRun, muovi, normalizza, ordina,
  tagliaRuns, testoParagrafo, LUNGHEZZA_MASSIMA_AUTORE, LUNGHEZZA_MASSIMA_COMMENTO,
  type Commento, type Documento, type Paragrafo, type Posizione, type Revisione, type Run, type Selezione, type Stato,
} from './documento';

/** Il nome usato per commenti e modifiche se nelle preferenze non c'è. */
export const AUTORE_PREDEFINITO = 'Autore';
/** Data e ora di adesso, nel formato dei file di Word (ISO senza millesimi). */
export function adesso(): string { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }
/** Il nome dell'autore ripulito: spazi ridotti, al massimo 100 caratteri, quello predefinito se è vuoto. */
export function autoreValido(nome: string | undefined): string {
  const n = (nome ?? '').replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, LUNGHEZZA_MASSIMA_AUTORE);
  return n === '' ? AUTORE_PREDEFINITO : n;
}
const testoCommento = (t: string): string => t.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim().slice(0, LUNGHEZZA_MASSIMA_COMMENTO);

// ===================== commenti =====================

export interface VoceCommento extends Commento { p: number; o: number; ancorato: string }

/** I commenti con del testo, nell'ordine in cui il loro testo compare, con il punto dove comincia e un pezzo del testo commentato. */
export function elencoCommenti(doc: Documento): VoceCommento[] {
  const inizio = new Map<string, { p: number; o: number; testo: string }>();
  doc.paragrafi.forEach((par, p) => {
    let o = 0;
    for (const r of par.runs) {
      if (r.cm !== undefined) {
        const v = inizio.get(r.cm);
        if (!v) inizio.set(r.cm, { p, o, testo: r.t });
        else if (v.testo.length < 80) v.testo += (v.p === p ? '' : ' ') + r.t;
      }
      o += r.t.length;
    }
  });
  return commentiUsati(doc)
    .map((c) => { const v = inizio.get(c.id)!; return { ...c, p: v.p, o: v.o, ancorato: v.testo.replace(/￼/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) }; })
    .sort((a, b) => a.p - b.p || a.o - b.o);
}

/** Un identificativo nuovo: il numero più alto usato più uno. */
function nuovoId(doc: Documento): string {
  let massimo = 0;
  for (const c of doc.commenti ?? []) { const n = Number(c.id); if (Number.isInteger(n) && n > massimo) massimo = n; }
  for (const id of idCommentiNelTesto(doc)) { const n = Number(id); if (Number.isInteger(n) && n > massimo) massimo = n; }
  return String(massimo + 1);
}

/** La parola in cui sta il punto (lettere e cifre), o null se il punto non è dentro o accanto a una parola. */
function parolaIn(doc: Documento, pos: Posizione): Selezione | null {
  const t = testoParagrafo(doc.paragrafi[pos.p]);
  const parola = /[\p{L}\p{N}_'’-]/u;
  let da = pos.o;
  let a = pos.o;
  while (da > 0 && parola.test(t[da - 1])) da--;
  while (a < t.length && parola.test(t[a])) a++;
  if (da === a) return null;
  return { ancora: { p: pos.p, o: da }, fuoco: { p: pos.p, o: a } };
}

/**
 * Commenta il testo selezionato (o la parola dove sta il cursore). Restituisce il nuovo stato e l'identificativo del commento,
 * oppure null se il testo del commento è vuoto o non c'è niente da commentare. Il testo commentato resta selezionato.
 */
export function aggiungiCommento(stato: Stato, testo: string, autore: string, data = adesso()): { stato: Stato; id: string } | null {
  const t = testoCommento(testo);
  if (t === '') return null;
  const [i, f] = ordina(stato.doc, stato.sel);
  const sel = collassata(stato.sel) ? parolaIn(stato.doc, i) : { ancora: i, fuoco: f };
  if (!sel) return null;
  const id = nuovoId(stato.doc);
  const marcato = modificaRun(stato.doc, sel, (r) => ({ ...r, cm: id }));
  if (marcato === stato.doc) return null;
  const doc: Documento = { ...marcato, commenti: [...commentiUsati(marcato), { id, a: autoreValido(autore), d: data, t }] };
  return { stato: { doc, sel, pendenti: null }, id };
}

function cambiaCommento(doc: Documento, id: string, f: (c: Commento) => Commento | null): Documento {
  if (!doc.commenti?.some((c) => c.id === id)) return doc;
  const commenti = doc.commenti.map((c) => (c.id === id ? f(c) : c)).filter((c): c is Commento => c !== null);
  return { ...doc, commenti };
}
/** Aggiunge una risposta al commento (niente se il testo è vuoto). */
export function rispondiCommento(doc: Documento, id: string, testo: string, autore: string, data = adesso()): Documento {
  const t = testoCommento(testo);
  if (t === '') return doc;
  return cambiaCommento(doc, id, (c) => ({ ...c, r: [...(c.r ?? []), { a: autoreValido(autore), d: data, t }] }));
}
/** Cambia il testo del commento (niente se il testo nuovo è vuoto). */
export function modificaTestoCommento(doc: Documento, id: string, testo: string): Documento {
  const t = testoCommento(testo);
  if (t === '') return doc;
  return cambiaCommento(doc, id, (c) => ({ ...c, t }));
}
/** Segna il commento come risolto (o lo riapre). */
export function risolviCommento(doc: Documento, id: string, risolto: boolean): Documento {
  return cambiaCommento(doc, id, (c) => { const { ok, ...resto } = c; void ok; return risolto ? { ...resto, ok: true } : resto; });
}
function senzaCommentiNelTesto(doc: Documento, togli: (id: string) => boolean): Paragrafo[] {
  return doc.paragrafi.map((par) => {
    if (!par.runs.some((r) => r.cm !== undefined && togli(r.cm))) return par;
    return { ...par, runs: normalizza(par.runs.map((r) => { if (r.cm === undefined || !togli(r.cm)) return r; const { cm, ...resto } = r; void cm; return resto; })) };
  });
}
/** Elimina il commento e le sue risposte; il testo resta, senza commento. */
export function eliminaCommento(doc: Documento, id: string): Documento {
  const paragrafi = senzaCommentiNelTesto(doc, (x) => x === id);
  const commenti = (doc.commenti ?? []).filter((c) => c.id !== id);
  const out: Documento = { ...conParagrafi(doc, paragrafi) };
  if (commenti.length > 0) out.commenti = commenti; else delete out.commenti;
  return out;
}
/** Elimina tutti i commenti del documento. */
export function eliminaTuttiICommenti(doc: Documento): Documento {
  const out: Documento = { ...conParagrafi(doc, senzaCommentiNelTesto(doc, () => true)) };
  delete out.commenti;
  return out;
}
/** Il commento del testo dove sta il punto (il carattere dopo, altrimenti quello prima). */
export function commentoNelPunto(doc: Documento, pos: Posizione): string | undefined {
  const runs = doc.paragrafi[pos.p]?.runs ?? [];
  return tagliaRuns(runs, pos.o, pos.o + 1)[0]?.cm ?? (pos.o > 0 ? tagliaRuns(runs, pos.o - 1, pos.o)[0]?.cm : undefined);
}
/** Da dove a dove va il testo del commento (dal primo all'ultimo carattere), o null se non ha testo. */
export function intervalloCommento(doc: Documento, id: string): Selezione | null {
  let primo: Posizione | null = null;
  let ultimo: Posizione | null = null;
  doc.paragrafi.forEach((par, p) => {
    let o = 0;
    for (const r of par.runs) {
      if (r.cm === id) { if (!primo) primo = { p, o }; ultimo = { p, o: o + r.t.length }; }
      o += r.t.length;
    }
  });
  return primo && ultimo ? { ancora: primo, fuoco: ultimo } : null;
}

// ===================== modifiche registrate =====================

/** Accende o spegne la registrazione delle modifiche. */
export function alternaRegistrazione(doc: Documento): Documento {
  const out = { ...doc };
  if (doc.revisioni) delete out.revisioni; else out.revisioni = true;
  return out;
}

/**
 * Segna come cancellato il testo tra da e a: il testo inserito dallo stesso autore sparisce davvero, quello già cancellato resta com'è,
 * il resto prende la modifica «cancellato». Restituisce il documento e quanti caratteri sono spariti nell'ultimo paragrafo toccato.
 */
function segnaCancellazione(doc: Documento, da: Posizione, a: Posizione, rv: Revisione): { doc: Documento; tolti: number } {
  let tolti = 0;
  const paragrafi = doc.paragrafi.map((par, p) => {
    if (p < da.p || p > a.p) return par;
    const lung = testoParagrafo(par).length;
    const i = p === da.p ? da.o : 0;
    const f = p === a.p ? a.o : lung;
    if (i >= f) return par;
    const centro: Run[] = [];
    let toltiQui = 0;
    for (const r of tagliaRuns(par.runs, i, f)) {
      if (r.rv?.t === 'i' && r.rv.a === rv.a) { toltiQui += r.t.length; continue; }
      if (r.rv?.t === 'd') { centro.push(r); continue; }
      centro.push({ ...r, rv: { ...rv } });
    }
    if (p === a.p) tolti = toltiQui;
    return { ...par, runs: normalizza([...tagliaRuns(par.runs, 0, i), ...centro, ...tagliaRuns(par.runs, f, Infinity)]) };
  });
  return { doc: conParagrafi(doc, paragrafi), tolti };
}

/** Cancellazione con la registrazione accesa: Backspace, Canc (anche di una parola con Ctrl) o la cancellazione della selezione. */
export function cancellaConRevisione(stato: Stato, direzione: 'indietro' | 'avanti', parola: boolean, autore: string, data = adesso()): Stato {
  const rv: Revisione = { t: 'd', a: autoreValido(autore), d: data };
  let da: Posizione;
  let a: Posizione;
  if (!collassata(stato.sel)) [da, a] = ordina(stato.doc, stato.sel);
  else {
    const [c] = ordina(stato.doc, stato.sel);
    const t = testoParagrafo(stato.doc.paragrafi[c.p]);
    // al bordo del paragrafo l'unione dei paragrafi non si registra: si fa come sempre
    if ((direzione === 'indietro' && c.o === 0) || (direzione === 'avanti' && c.o === t.length)) return cancella(stato, direzione);
    const altro = parola ? muovi(stato.doc, c, direzione === 'indietro' ? 'parolaSinistra' : 'parolaDestra') : muovi(stato.doc, c, direzione === 'indietro' ? 'sinistra' : 'destra');
    if (altro.p !== c.p) return stato;
    [da, a] = direzione === 'indietro' ? [altro, c] : [c, altro];
  }
  const r = segnaCancellazione(stato.doc, da, a, rv);
  // all'indietro il cursore va prima del testo cancellato, in avanti dopo (saltando quello che è rimasto, segnato come cancellato)
  const pos = direzione === 'indietro' || !collassata(stato.sel) ? da : { p: a.p, o: a.o - r.tolti };
  return { doc: r.doc, sel: { ancora: pos, fuoco: pos }, pendenti: null };
}

/** Scrittura (o incolla) con la registrazione accesa: la selezione si segna come cancellata e il testo nuovo come inserito, dopo di lei. */
export function inserisciConRevisione(stato: Stato, testo: string, autore: string, data = adesso()): Stato {
  let st = stato;
  if (!collassata(st.sel)) {
    const [da, a] = ordina(st.doc, st.sel);
    const r = segnaCancellazione(st.doc, da, a, { t: 'd', a: autoreValido(autore), d: data });
    const fine = da.p === a.p ? { p: a.p, o: a.o - r.tolti } : { p: a.p, o: a.o - r.tolti };
    st = { doc: r.doc, sel: { ancora: fine, fuoco: fine }, pendenti: st.pendenti };
  }
  const [inizio] = ordina(st.doc, st.sel);
  const dopo = inserisciTesto(st, testo);
  const [fine] = ordina(dopo.doc, dopo.sel);
  const rv: Revisione = { t: 'i', a: autoreValido(autore), d: data };
  const doc = modificaRun(dopo.doc, { ancora: inizio, fuoco: fine }, (r) => (r.rv?.t === 'd' ? r : { ...r, rv: { ...rv } }));
  return { ...dopo, doc };
}

/** Il blocco di testo con la stessa modifica registrata attorno al punto (il carattere dopo, altrimenti quello prima), o null. */
function bloccoRevisioneNelPunto(doc: Documento, pos: Posizione): Selezione | null {
  const runs = doc.paragrafi[pos.p]?.runs ?? [];
  let o = 0;
  let trovato = -1;
  for (let k = 0; k < runs.length; k++) {
    const fine = o + runs[k].t.length;
    if (runs[k].rv && ((pos.o >= o && pos.o < fine) || (pos.o === fine && trovato === -1))) { trovato = k; if (pos.o < fine) break; }
    o = fine;
  }
  if (trovato === -1) return null;
  const inizio = lunghezzaRuns(runs.slice(0, trovato));
  return { ancora: { p: pos.p, o: inizio }, fuoco: { p: pos.p, o: inizio + runs[trovato].t.length } };
}

/**
 * Accetta (o rifiuta) le modifiche registrate nella selezione; con il solo cursore, quella in cui sta il cursore; senza selezione
 * (sel undefined) tutte. Accettare: l'inserito resta normale, il cancellato sparisce. Rifiutare: il contrario.
 */
export function risolviRevisioni(doc: Documento, accetta: boolean, sel?: Selezione): Documento {
  let ambito: Selezione | null = null;
  if (sel) {
    ambito = collassata(sel) ? bloccoRevisioneNelPunto(doc, ordina(doc, sel)[0]) : sel;
    if (!ambito) return doc;
  }
  const [da, a] = ambito ? ordina(doc, ambito) : [{ p: 0, o: 0 }, { p: doc.paragrafi.length - 1, o: Infinity }];
  let cambiato = false;
  const paragrafi = doc.paragrafi.map((par, p) => {
    if (p < da.p || p > a.p || !par.runs.some((r) => r.rv)) return par;
    const i = p === da.p ? da.o : 0;
    const f = p === a.p ? a.o : Infinity;
    const centro: Run[] = [];
    for (const r of tagliaRuns(par.runs, i, f)) {
      if (!r.rv) { centro.push(r); continue; }
      cambiato = true;
      const resta = (r.rv.t === 'i') === accetta;
      if (resta) { const { rv, ...senza } = r; void rv; centro.push(senza); }
    }
    return { ...par, runs: normalizza([...tagliaRuns(par.runs, 0, i), ...centro, ...tagliaRuns(par.runs, f, Infinity)]) };
  });
  return cambiato ? conParagrafi(doc, paragrafi) : doc;
}

export interface VoceRevisione { tipo: 'i' | 'd'; autore: string; data: string; testo: string; p: number; o: number; fine: number }
/** Le modifiche registrate, blocco per blocco, nell'ordine del documento. */
export function elencoRevisioni(doc: Documento): VoceRevisione[] {
  const out: VoceRevisione[] = [];
  doc.paragrafi.forEach((par, p) => {
    let o = 0;
    for (const r of par.runs) {
      const fine = o + r.t.length;
      if (r.rv) {
        const u = out[out.length - 1];
        if (u && u.p === p && u.fine === o && u.tipo === r.rv.t && u.autore === r.rv.a) { u.testo += r.t; u.fine = fine; }
        else out.push({ tipo: r.rv.t, autore: r.rv.a, data: r.rv.d, testo: r.t, p, o, fine });
      }
      o = fine;
    }
  });
  return out;
}
/** La modifica registrata dopo (o prima) del punto, come selezione, o null se non ce ne sono. */
export function prossimaRevisione(doc: Documento, pos: Posizione, verso: 1 | -1): Selezione | null {
  const voci = elencoRevisioni(doc);
  const dopo = (v: VoceRevisione): boolean => v.p > pos.p || (v.p === pos.p && v.o > pos.o);
  const primaDi = (v: VoceRevisione): boolean => v.p < pos.p || (v.p === pos.p && v.fine < pos.o);
  const v = verso === 1 ? voci.find(dopo) : [...voci].reverse().find(primaDi);
  return v ? { ancora: { p: v.p, o: v.o }, fuoco: { p: v.p, o: v.fine } } : null;
}

/** Il documento come sarà accettando tutte le modifiche, senza commenti: per i formati che non li conoscono (testo, PDF, HTML, RTF). */
export function versioneFinale(doc: Documento): Documento {
  const accettato = risolviRevisioni(doc, true);
  const out = eliminaTuttiICommenti(accettato);
  delete out.revisioni;
  return out;
}
/** Il documento ha commenti o modifiche registrate? */
export function haCommentiORevisioni(doc: Documento): boolean {
  return doc.paragrafi.some((par) => par.runs.some((r) => r.cm !== undefined || r.rv !== undefined));
}
