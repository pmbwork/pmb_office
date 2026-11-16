import { t } from '../i18n/lingua';
// Modello del documento di pmb_docs: dati puri e funzioni che non modificano mai l'ingresso.
// Un documento è un elenco di paragrafi; un paragrafo è un elenco di tratti di testo con
// grassetto (g), corsivo (c), sottolineato (s) e, se serve, carattere (f), corpo in punti (z),
// colore del testo (k) ed evidenziazione (h). Un paragrafo può avere allineamento (al), interlinea (ls),
// elenco (el), rientro (ri) e stile (st). Un tratto può essere un link (u: indirizzo http, https o mailto);
// il link non si eredita ai bordi: scrivendo subito prima o dopo il testo del link, il testo nuovo non è un link.
// Un paragrafo può essere dentro la cella di una tabella (tb: numero della tabella, riga, colonna): vedi controllaTabelle.
// Un'immagine sta nel testo come un carattere solo (OGGETTO, U+FFFC) in un tratto con l'attributo im (immagine incorporata,
// larghezza e altezza in pixel): si sposta, si cancella e si annulla come una lettera.
// Le posizioni sono in unità UTF-16.
// Un documento può avere un'intestazione e un piè di pagina (da 1 a 3 paragrafi ciascuno, uguali su tutte le pagine): sono testo semplice
// con allineamento, grassetto, corsivo, sottolineato, carattere, corpo e colori, e due campi, il numero della pagina (CAMPO_PAGINA)
// e il numero delle pagine (CAMPO_PAGINE), che stanno nel testo come un carattere solo. Il corpo del testo non li contiene mai.
// Gli attributi "di default" non sono scritti: assenti = valore normale. Mai chiavi con valore undefined.

export type NomeSegno = 'g' | 'c' | 's';
export type ChiaveAttributo = 'f' | 'z' | 'k' | 'h' | 'u' | 'x' | 'v';
export type ChiaveParagrafo = 'al' | 'ls' | 'el' | 'ri' | 'st' | 'sp' | 'hr' | 'fa' | 'sg' | 'sb' | 'sa';
export type Allineamento = 'sx' | 'ce' | 'dx' | 'gi';
/** p = puntato, n = numerato, t = elenco di attività (casella da spuntare; fa = voce fatta). */
export type TipoElenco = 'p' | 'n' | 't';
export type StileParagrafo = 'n' | 't' | 's' | '1' | '2' | '3';
export interface CellaTabella { i: number; r: number; c: number; w?: number }
export interface Segni { g: boolean; c: boolean; s: boolean }
export interface Attributi { f?: string; z?: number; k?: string; h?: string; u?: string; x?: string; v?: string }
/** Immagine incorporata: indirizzo "data:image/...;base64,...", larghezza e altezza in pixel come si vedono nel foglio. */
export interface Immagine { s: string; w: number; h: number }
export interface Run extends Segni, Attributi { t: string; im?: Immagine }
/** Il carattere che sta al posto di un'immagine nel testo. */
export const OGGETTO = '\uFFFC';
/** Nel testo di un'intestazione o di un piè di pagina: il numero della pagina in cui si trova. */
export const CAMPO_PAGINA = '\uE000';
/** Nel testo di un'intestazione o di un piè di pagina: il numero di pagine del documento. */
export const CAMPO_PAGINE = '\uE001';
export const RIGHE_MARGINE_MASSIME = 3;
const LUNGHEZZA_MARGINE_MASSIMA = 300;
const CAMPI = /[\uE000\uE001]/g;
const HA_CAMPI = /[\uE000\uE001]/;
const IMMAGINE_BASE64 = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const IMMAGINE_MASSIMA = 7_000_000;
export const LARGHEZZA_TESTO = 602;
export const ALTEZZA_MASSIMA = 900;

/** Un'immagine ammessa: png, jpeg, gif o webp incorporata (non svg), non enorme, con misure da 1 a 10000. */
export function immagineValida(im: unknown): im is Immagine {
  const x = im as Record<string, unknown> | null;
  if (!x || typeof x !== 'object') return false;
  const misura = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 10000;
  return typeof x.s === 'string' && x.s.length <= IMMAGINE_MASSIMA && IMMAGINE_BASE64.test(x.s) && misura(x.w) && misura(x.h);
}

/** Misure con cui mettere nel foglio un'immagine grande w per h: dentro la larghezza del testo e l'altezza massima, mai ingrandita. */
export function dimensioniIniziali(w: number, h: number): { w: number; h: number } {
  if (!(w >= 1) || !(h >= 1)) return { w: 1, h: 1 };
  const scala = Math.min(1, LARGHEZZA_TESTO / w, ALTEZZA_MASSIMA / h);
  return { w: Math.max(1, Math.round(w * scala)), h: Math.max(1, Math.round(h * scala)) };
}
export interface AttributiParagrafo { al?: Allineamento; ls?: number; el?: TipoElenco; ri?: number; st?: StileParagrafo; tb?: CellaTabella; sp?: boolean; hr?: boolean; fa?: boolean; sg?: string; sb?: number; sa?: number; bd?: Bordo }
export interface Paragrafo extends AttributiParagrafo { runs: Run[] }
export interface Documento { paragrafi: Paragrafo[]; intestazione?: Paragrafo[]; piede?: Paragrafo[] }
export interface Posizione { p: number; o: number }
export interface Selezione { ancora: Posizione; fuoco: Posizione }
export type Formato = Segni & Attributi;
export interface Stato { doc: Documento; sel: Selezione; pendenti: Formato | null }
export type Mossa =
  | 'sinistra' | 'destra' | 'inizioParagrafo' | 'fineParagrafo'
  | 'inizioDocumento' | 'fineDocumento' | 'parolaSinistra' | 'parolaDestra';

export const CORPO_NORMALE = 11;
export const CARATTERE_NORMALE = 'Arial';
export const PASSI_CORPO = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96];
const RIENTRO_MASSIMO = 8;

export function segniVuoti(): Segni { return { g: false, c: false, s: false }; }

function copiaRun(r: Run, t: string = r.t): Run {
  const o: Run = { t, g: r.g, c: r.c, s: r.s };
  if (r.f !== undefined) o.f = r.f;
  if (r.z !== undefined) o.z = r.z;
  if (r.k !== undefined) o.k = r.k;
  if (r.h !== undefined) o.h = r.h;
  if (r.u !== undefined) o.u = r.u;
  if (r.x !== undefined) o.x = r.x;
  if (r.v !== undefined) o.v = r.v;
  if (r.im !== undefined) o.im = r.im;
  return o;
}
function stessiRun(a: Run, b: Run): boolean {
  if (a.im !== undefined || b.im !== undefined) return false;
  return a.g === b.g && a.c === b.c && a.s === b.s && a.f === b.f && a.z === b.z && a.k === b.k && a.h === b.h && a.u === b.u && a.x === b.x && a.v === b.v;
}
function formatoDi(r: Run): Formato { const { t, im, ...resto } = copiaRun(r); void t; void im; return resto; }
function runDa(t: string, f: Formato): Run { return copiaRun({ ...f, t }); }
function haFormato(f: Formato): boolean {
  return f.g || f.c || f.s || f.f !== undefined || f.z !== undefined || f.k !== undefined || f.h !== undefined || f.u !== undefined || f.x !== undefined || f.v !== undefined;
}
const INDIRIZZO_LINK = /^(?:https?:\/\/[^\s\x00-\x1f\x7f/?#]+|mailto:[^\s\x00-\x1f\x7f]+)/i;
/** Un indirizzo che pmb_docs accetta in un link: solo http, https e mailto, senza spazi né caratteri di controllo. */
export function urlValido(u: string): boolean {
  return u.length <= 2000 && INDIRIZZO_LINK.test(u) && !/[\s\x00-\x1f\x7f]/.test(u);
}
function senzaLink(f: Formato): Formato { const { u, ...resto } = f; void u; return resto; }
function attributiDi(p: Paragrafo): AttributiParagrafo {
  const o: AttributiParagrafo = {};
  if (p.al !== undefined) o.al = p.al;
  if (p.ls !== undefined) o.ls = p.ls;
  if (p.el !== undefined) o.el = p.el;
  if (p.ri !== undefined) o.ri = p.ri;
  if (p.st !== undefined) o.st = p.st;
  if (p.tb !== undefined) o.tb = { ...p.tb };
  if (p.sp !== undefined) o.sp = p.sp;
  if (p.hr !== undefined) o.hr = p.hr;
  if (p.fa !== undefined && p.el === 't') o.fa = p.fa;
  if (p.sg !== undefined) o.sg = p.sg;
  if (p.sb !== undefined) o.sb = p.sb;
  if (p.sa !== undefined) o.sa = p.sa;
  if (p.bd !== undefined) o.bd = { ...p.bd };
  return o;
}

/** Bordo attorno a un paragrafo: spessore in punti, colore #rrggbb, stile (c continuo, t tratteggiato, p puntinato). */
export type StileBordo = 'c' | 't' | 'p';
export interface Bordo { w: number; c: string; s: StileBordo }
export const BORDO_PREDEFINITO: Bordo = { w: 1, c: '#000000', s: 'c' };
export const SPESSORI_BORDO = [0.5, 1, 2, 3, 4.5] as const;
/** Il bordo ripulito (spessore da 0,5 a 6 pt a mezzi punti, colore minuscolo), o undefined se non è valido. */
export function bordoValido(x: unknown): Bordo | undefined {
  const b = x as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return undefined;
  if (typeof b.w !== 'number' || !Number.isFinite(b.w) || b.w < 0.25 || b.w > 6) return undefined;
  if (typeof b.c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(b.c)) return undefined;
  if (b.s !== 'c' && b.s !== 't' && b.s !== 'p') return undefined;
  return { w: Math.max(0.5, Math.round(b.w * 2) / 2), c: b.c.toLowerCase(), s: b.s };
}
/** Mette, cambia o toglie (parziale null) il bordo dei paragrafi toccati; le parti non indicate restano com'erano (o quelle predefinite). */
export function impostaBordo(doc: Documento, sel: Selezione, parziale: Partial<Bordo> | null): Documento {
  return modificaParagrafi(doc, sel, (par) => {
    const n: Paragrafo = { ...attributiDi(par), runs: par.runs };
    if (parziale === null) delete n.bd;
    else n.bd = bordoValido({ ...(par.bd ?? BORDO_PREDEFINITO), ...parziale }) ?? par.bd ?? { ...BORDO_PREDEFINITO };
    return n;
  });
}

/** Spazio massimo prima o dopo un paragrafo, in punti. */
export const SPAZIO_PARAGRAFO_MASSIMO = 200;
/** Spazio prima/dopo ripulito: da 0 a 200 pt, mezzo punto di precisione; undefined se è zero o non è valido. */
export function spazioValido(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.round(Math.min(SPAZIO_PARAGRAFO_MASSIMO, v) * 2) / 2;
}
/** Gli attributi per un paragrafo nuovo nato da uno esistente: niente salto di pagina, linea orizzontale, né segnalibro (il nome è unico). */
function attributiSenzaSpHr(a: AttributiParagrafo): AttributiParagrafo {
  const { sp, hr, sg, ...resto } = a;
  void sp; void hr; void sg;
  return resto;
}

export const LUNGHEZZA_MASSIMA_SEGNALIBRO = 60;
/** Il nome di un segnalibro ripulito (spazi ai lati e interni ridotti), oppure null se non è ammesso (vuoto, troppo lungo, caratteri di controllo). */
export function nomeSegnalibroValido(nome: string): string | null {
  const n = nome.replace(/\s+/g, ' ').trim();
  if (n === '' || n.length > LUNGHEZZA_MASSIMA_SEGNALIBRO || /[\x00-\x1f\x7f]/.test(n)) return null;
  return n;
}

export interface VoceSegnalibro { nome: string; p: number; anteprima: string }
/** I segnalibri del documento, nell'ordine in cui compaiono. */
export function elencoSegnalibri(doc: Documento): VoceSegnalibro[] {
  const out: VoceSegnalibro[] = [];
  doc.paragrafi.forEach((par, p) => {
    if (par.sg === undefined) return;
    out.push({ nome: par.sg, p, anteprima: par.runs.map((r) => r.t).join('').replace(/\s+/g, ' ').trim().slice(0, 60) });
  });
  return out;
}

/** Mette il segnalibro `nome` sul paragrafo p. Se il nome esiste già altrove si sposta; un paragrafo ha un solo segnalibro (il nuovo sostituisce il vecchio). */
export function impostaSegnalibro(doc: Documento, p: number, nome: string): Documento {
  const n = nomeSegnalibroValido(nome);
  if (n === null || p < 0 || p >= doc.paragrafi.length) return doc;
  const minuscolo = n.toLowerCase();
  return conParagrafi(doc, doc.paragrafi.map((par, i) => {
    if (i === p) return { ...attributiDi(par), sg: n, runs: par.runs };
    if (par.sg !== undefined && par.sg.toLowerCase() === minuscolo) { const { sg, ...resto } = attributiDi(par); void sg; return { ...resto, runs: par.runs }; }
    return par;
  }));
}

/** Toglie il segnalibro con quel nome (non fa niente se non c'è). */
export function togliSegnalibro(doc: Documento, nome: string): Documento {
  const minuscolo = nome.toLowerCase();
  if (!doc.paragrafi.some((par) => par.sg !== undefined && par.sg.toLowerCase() === minuscolo)) return doc;
  return conParagrafi(doc, doc.paragrafi.map((par) => {
    if (par.sg === undefined || par.sg.toLowerCase() !== minuscolo) return par;
    const { sg, ...resto } = attributiDi(par); void sg;
    return { ...resto, runs: par.runs };
  }));
}

export function stessaCella(a: CellaTabella | undefined, b: CellaTabella | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.i === b.i && a.r === b.r && a.c === b.c;
}

/** null se le tabelle del documento sono in ordine; altrimenti il motivo. Ogni tabella è contigua, riga per riga, e rettangolare. */
export function controllaTabelle(doc: Documento): string | null {
  const visti = new Set<number>();
  let k = 0;
  while (k < doc.paragrafi.length) {
    const tb = doc.paragrafi[k].tb;
    if (!tb) { k++; continue; }
    if (visti.has(tb.i)) return 'tabella spezzata';
    visti.add(tb.i);
    let r = 0;
    let c = 0;
    let colonne = -1;
    if (tb.r !== 0 || tb.c !== 0) return 'tabella che non comincia dalla prima cella';
    for (k++; k < doc.paragrafi.length && doc.paragrafi[k].tb?.i === tb.i; k++) {
      const x = doc.paragrafi[k].tb as CellaTabella;
      if (x.r === r && x.c === c) continue;
      if (x.r === r && x.c === c + 1) { c++; continue; }
      if (x.r === r + 1 && x.c === 0) {
        if (colonne < 0) colonne = c + 1;
        else if (c + 1 !== colonne) return 'righe di lunghezza diversa';
        r++;
        c = 0;
        continue;
      }
      return 'celle fuori ordine';
    }
    if (colonne >= 0 && c + 1 !== colonne) return 'righe di lunghezza diversa';
  }
  return null;
}

export function normalizza(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (r.t === '') continue;
    const u = out[out.length - 1];
    if (u && stessiRun(u, r)) u.t += r.t;
    else out.push(copiaRun(r));
  }
  return out;
}

export function testoParagrafo(p: Paragrafo): string { return p.runs.map((r) => r.t).join(''); }
export function testoDi(doc: Documento): string { return doc.paragrafi.map(testoParagrafo).join('\n'); }
export function documentoVuoto(): Documento { return { paragrafi: [{ runs: [] }] }; }
/** Lo stesso documento con altri paragrafi nel corpo: intestazione e piè di pagina restano. */
export function conParagrafi(doc: Documento, paragrafi: Paragrafo[]): Documento { return { ...doc, paragrafi }; }

export function daTesto(testo: string, segni?: Segni): Documento {
  const s = segni ?? segniVuoti();
  const righe = testo.replace(/\r\n?/g, '\n').replace(/\uFFFC/g, '').replace(CAMPI, '').split('\n');
  return { paragrafi: righe.map((r) => ({ runs: r === '' ? [] : [{ t: r, g: s.g, c: s.c, s: s.s }] })) };
}

export function cursore(p: number, o: number): Selezione { return { ancora: { p, o }, fuoco: { p, o } }; }
export function statoIniziale(doc: Documento = documentoVuoto()): Stato { return { doc, sel: cursore(0, 0), pendenti: null }; }

function limita(doc: Documento, pos: Posizione): Posizione {
  const p = Math.min(Math.max(0, pos.p), doc.paragrafi.length - 1);
  const lung = testoParagrafo(doc.paragrafi[p]).length;
  return { p, o: Math.min(Math.max(0, pos.o), lung) };
}
function prima(a: Posizione, b: Posizione): boolean { return a.p < b.p || (a.p === b.p && a.o <= b.o); }

export function ordina(doc: Documento, sel: Selezione): [Posizione, Posizione] {
  const a = limita(doc, sel.ancora);
  const f = limita(doc, sel.fuoco);
  return prima(a, f) ? [a, f] : [f, a];
}
export function collassata(sel: Selezione): boolean {
  return sel.ancora.p === sel.fuoco.p && sel.ancora.o === sel.fuoco.o;
}

function tagliaRuns(runs: Run[], da: number, a: number): Run[] {
  const out: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const fine = pos + r.t.length;
    const s = Math.max(da, pos);
    const e = Math.min(a, fine);
    if (s < e) out.push(copiaRun(r, r.t.slice(s - pos, e - pos)));
    pos = fine;
  }
  return out;
}
function lunghezzaRuns(runs: Run[]): number { return runs.reduce((n, r) => n + r.t.length, 0); }

/** Formato completo (segni e attributi) del carattere prima della posizione, o del primo a inizio paragrafo. */
export function formatoIn(doc: Documento, pos: Posizione): Formato {
  const q = limita(doc, pos);
  const par = doc.paragrafi[q.p];
  if (q.o > 0) return formatoDi(tagliaRuns(par.runs, q.o - 1, q.o)[0]);
  const r = par.runs[0];
  return r ? formatoDi(r) : segniVuoti();
}

/** Indirizzo del link in cui cade il punto: c'è solo se il carattere prima e quello dopo sono nello stesso link. */
export function linkIn(doc: Documento, pos: Posizione): string | undefined {
  const q = limita(doc, pos);
  const runs = doc.paragrafi[q.p].runs;
  const prima = q.o > 0 ? tagliaRuns(runs, q.o - 1, q.o)[0]?.u : undefined;
  const dopo = tagliaRuns(runs, q.o, q.o + 1)[0]?.u;
  return prima !== undefined && prima === dopo ? prima : undefined;
}

export function segniIn(doc: Documento, pos: Posizione): Segni {
  const f = formatoIn(doc, pos);
  return { g: f.g, c: f.c, s: f.s };
}

function runInIntervallo(doc: Documento, i: Posizione, f: Posizione): Run[] {
  const out: Run[] = [];
  for (let p = i.p; p <= f.p; p++) {
    const da = p === i.p ? i.o : 0;
    const a = p === f.p ? f.o : testoParagrafo(doc.paragrafi[p]).length;
    out.push(...tagliaRuns(doc.paragrafi[p].runs, da, a));
  }
  return out;
}

export function segniSelezione(doc: Documento, sel: Selezione): Segni {
  const [i, f] = ordina(doc, sel);
  if (i.p === f.p && i.o === f.o) return segniIn(doc, i);
  const runs = runInIntervallo(doc, i, f);
  if (runs.length === 0) return segniIn(doc, i);
  return { g: runs.every((r) => r.g), c: runs.every((r) => r.c), s: runs.every((r) => r.s) };
}

/** Segni e attributi della selezione: un attributo è presente solo se è uguale in tutto il testo selezionato. */
export function formatoSelezione(doc: Documento, sel: Selezione): Formato {
  const [i, f] = ordina(doc, sel);
  const runs = i.p === f.p && i.o === f.o ? [] : runInIntervallo(doc, i, f);
  if (runs.length === 0) return formatoIn(doc, i);
  const out: Formato = { g: runs.every((r) => r.g), c: runs.every((r) => r.c), s: runs.every((r) => r.s) };
  for (const k of ['f', 'z', 'k', 'h', 'u', 'x', 'v'] as const) {
    const v = runs[0][k];
    if (v !== undefined && runs.every((r) => r[k] === v)) (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

function sostituisci(doc: Documento, da: Posizione, a: Posizione, nuovi: Run[][]): { doc: Documento; pos: Posizione } {
  const testa = tagliaRuns(doc.paragrafi[da.p].runs, 0, da.o);
  const coda = tagliaRuns(doc.paragrafi[a.p].runs, a.o, Infinity);
  let blocchi: Run[][];
  if (nuovi.length === 1) blocchi = [[...testa, ...nuovi[0], ...coda]];
  else blocchi = [[...testa, ...nuovi[0]], ...nuovi.slice(1, -1), [...nuovi[nuovi.length - 1], ...coda]];
  const attrs = attributiDi(doc.paragrafi[da.p]);
  const paragrafi = [
    ...doc.paragrafi.slice(0, da.p),
    ...blocchi.map((r, idx) => ({ ...(idx === 0 ? attrs : attributiSenzaSpHr(attrs)), runs: normalizza(r) })),
    ...doc.paragrafi.slice(a.p + 1),
  ];
  const ultimo = nuovi[nuovi.length - 1];
  const pos = nuovi.length === 1
    ? { p: da.p, o: da.o + lunghezzaRuns(ultimo) }
    : { p: da.p + nuovi.length - 1, o: lunghezzaRuns(ultimo) };
  return { doc: conParagrafi(doc, paragrafi), pos };
}

export function inserisciTesto(stato: Stato, testo: string, segni?: Segni): Stato {
  const [i, f] = ordina(stato.doc, stato.sel);
  const nuovoTesto = testo.replace(/\r\n?/g, '\n').replace(/\uFFFC/g, '').replace(CAMPI, '');
  if (nuovoTesto === '' && i.p === f.p && i.o === f.o) return { ...stato, pendenti: null };
  let s: Formato;
  if (segni) s = segni;
  else if (stato.pendenti) s = stato.pendenti;
  else {
    s = senzaLink(formatoIn(stato.doc, i));
    // dentro un link (anche sostituendo un pezzo del suo testo) il testo nuovo resta nel link; ai bordi no
    const u = linkIn(stato.doc, i);
    if (u !== undefined && u === linkIn(stato.doc, f)) s = { ...s, u };
  }
  const righe = nuovoTesto.split('\n');
  const nuovi: Run[][] = righe.map((r) => (r === '' ? [] : [runDa(r, s)]));
  const r = sostituisci(stato.doc, i, f, nuovi);
  const resta = righe.length > 1 && righe[righe.length - 1] === '' && haFormato(s);
  return { doc: r.doc, sel: { ancora: r.pos, fuoco: r.pos }, pendenti: resta ? { ...s } : null };
}

export function cancellaSelezione(stato: Stato): Stato {
  const [i, f] = ordina(stato.doc, stato.sel);
  if (i.p === f.p && i.o === f.o) return stato;
  const r = sostituisci(stato.doc, i, f, [[]]);
  return { doc: r.doc, sel: { ancora: r.pos, fuoco: r.pos }, pendenti: null };
}

const alta = (c: number): boolean => c >= 0xd800 && c <= 0xdbff;
const bassa = (c: number): boolean => c >= 0xdc00 && c <= 0xdfff;
function passoIndietro(t: string, o: number): number {
  return o >= 2 && bassa(t.charCodeAt(o - 1)) && alta(t.charCodeAt(o - 2)) ? 2 : 1;
}
function passoAvanti(t: string, o: number): number {
  return o + 1 < t.length && alta(t.charCodeAt(o)) && bassa(t.charCodeAt(o + 1)) ? 2 : 1;
}

export function cancella(stato: Stato, direzione: 'indietro' | 'avanti'): Stato {
  if (!collassata(stato.sel)) return cancellaSelezione(stato);
  const [c] = ordina(stato.doc, stato.sel);
  const t = testoParagrafo(stato.doc.paragrafi[c.p]);
  let da: Posizione;
  let a: Posizione;
  if (direzione === 'indietro') {
    if (c.o > 0) { da = { p: c.p, o: c.o - passoIndietro(t, c.o) }; a = c; }
    else if (c.p > 0) { da = { p: c.p - 1, o: testoParagrafo(stato.doc.paragrafi[c.p - 1]).length }; a = c; }
    else return stato;
  } else {
    if (c.o < t.length) { da = c; a = { p: c.p, o: c.o + passoAvanti(t, c.o) }; }
    else if (c.p < stato.doc.paragrafi.length - 1) { da = c; a = { p: c.p + 1, o: 0 }; }
    else return stato;
  }
  const r = sostituisci(stato.doc, da, a, [[]]);
  return { doc: r.doc, sel: { ancora: r.pos, fuoco: r.pos }, pendenti: null };
}

export function inserisciSaltoPagina(stato: Stato): Stato {
  const [i, f] = ordina(stato.doc, stato.sel);
  const st = (i.p === f.p && i.o === f.o) ? stato : cancellaSelezione(stato);
  const [pos] = ordina(st.doc, st.sel);
  const par = st.doc.paragrafi[pos.p];
  const testa = tagliaRuns(par.runs, 0, pos.o);
  const coda = tagliaRuns(par.runs, pos.o, Infinity);
  const attrs = attributiDi(par);
  const attrsTesta = attributiSenzaSpHr(attrs);
  if (par.sp) attrsTesta.sp = true;
  const attrsCoda = { ...attributiSenzaSpHr(attrs), sp: true };
  const p1: Paragrafo = { ...attrsTesta, runs: normalizza(testa) };
  const p2: Paragrafo = { ...attrsCoda, runs: normalizza(coda) };
  const nuoviParagrafi = [
    ...st.doc.paragrafi.slice(0, pos.p),
    p1,
    p2,
    ...st.doc.paragrafi.slice(pos.p + 1),
  ];
  const nuovaPos: Posizione = { p: pos.p + 1, o: 0 };
  return {
    doc: conParagrafi(st.doc, nuoviParagrafi),
    sel: { ancora: nuovaPos, fuoco: nuovaPos },
    pendenti: null,
  };
}

export function inserisciLineaOrizzontale(stato: Stato): Stato {
  const [i, f] = ordina(stato.doc, stato.sel);
  const st = (i.p === f.p && i.o === f.o) ? stato : cancellaSelezione(stato);
  const [pos] = ordina(st.doc, st.sel);
  const par = st.doc.paragrafi[pos.p];
  const lung = testoParagrafo(par).length;
  if (lung === 0 && !par.tb) {
    const pHr: Paragrafo = { hr: true, runs: [] };
    const pSuccessivo: Paragrafo = { runs: [] };
    const nuoviParagrafi = [
      ...st.doc.paragrafi.slice(0, pos.p),
      pHr,
      pSuccessivo,
      ...st.doc.paragrafi.slice(pos.p + 1),
    ];
    const nuovaPos: Posizione = { p: pos.p + 1, o: 0 };
    return {
      doc: conParagrafi(st.doc, nuoviParagrafi),
      sel: { ancora: nuovaPos, fuoco: nuovaPos },
      pendenti: null,
    };
  }
  const testa = tagliaRuns(par.runs, 0, pos.o);
  const coda = tagliaRuns(par.runs, pos.o, Infinity);
  const attrs = attributiDi(par);
  const p1: Paragrafo = { ...attrs, runs: normalizza(testa) };
  const pHr: Paragrafo = { hr: true, runs: [] };
  const p2: Paragrafo = { ...attributiSenzaSpHr(attrs), runs: normalizza(coda) };
  const nuoviParagrafi = [
    ...st.doc.paragrafi.slice(0, pos.p),
    p1,
    pHr,
    p2,
    ...st.doc.paragrafi.slice(pos.p + 1),
  ];
  const nuovaPos: Posizione = { p: pos.p + 2, o: 0 };
  return {
    doc: conParagrafi(st.doc, nuoviParagrafi),
    sel: { ancora: nuovaPos, fuoco: nuovaPos },
    pendenti: null,
  };
}

function modificaRun(doc: Documento, sel: Selezione, f: (r: Run) => Run): Documento {
  const [i, fi] = ordina(doc, sel);
  if (i.p === fi.p && i.o === fi.o) return doc;
  const paragrafi = doc.paragrafi.map((par, p) => {
    if (p < i.p || p > fi.p) return par;
    const lung = testoParagrafo(par).length;
    const da = p === i.p ? i.o : 0;
    const a = p === fi.p ? fi.o : lung;
    if (da >= a) return par;
    const centro = tagliaRuns(par.runs, da, a).map(f);
    return { ...attributiDi(par), runs: normalizza([...tagliaRuns(par.runs, 0, da), ...centro, ...tagliaRuns(par.runs, a, Infinity)]) };
  });
  return conParagrafi(doc, paragrafi);
}

export function applicaSegno(doc: Documento, sel: Selezione, nome: NomeSegno, valore: boolean): Documento {
  return modificaRun(doc, sel, (r) => ({ ...r, [nome]: valore }));
}

export function applicaAttributo(doc: Documento, sel: Selezione, chiave: ChiaveAttributo, valore: string | number | undefined): Documento {
  return modificaRun(doc, sel, (r) => {
    const n = copiaRun(r);
    if (valore === undefined) delete n[chiave];
    else (n as unknown as Record<string, unknown>)[chiave] = valore;
    return n;
  });
}

export function alternaSegno(stato: Stato, nome: NomeSegno): Stato {
  if (collassata(stato.sel)) {
    const base: Formato = stato.pendenti ?? senzaLink(formatoIn(stato.doc, ordina(stato.doc, stato.sel)[0]));
    return { ...stato, pendenti: { ...base, [nome]: !base[nome] } };
  }
  const valore = !segniSelezione(stato.doc, stato.sel)[nome];
  return { ...stato, doc: applicaSegno(stato.doc, stato.sel, nome, valore), pendenti: null };
}

/** Imposta (o toglie, con undefined) carattere, corpo, colore o evidenziazione: sulla selezione, o sul testo che si scriverà. */
export function impostaAttributo(stato: Stato, chiave: ChiaveAttributo, valore: string | number | undefined): Stato {
  if (collassata(stato.sel)) {
    const base: Formato = stato.pendenti ?? senzaLink(formatoIn(stato.doc, ordina(stato.doc, stato.sel)[0]));
    const n: Formato = { ...base };
    if (valore === undefined) delete n[chiave];
    else (n as unknown as Record<string, unknown>)[chiave] = valore;
    return { ...stato, pendenti: n };
  }
  return { ...stato, doc: applicaAttributo(stato.doc, stato.sel, chiave, valore), pendenti: null };
}

/** Formato che "Copia formato" porta da un punto a un altro: segni e attributi del testo (mai il link) e allineamento, interlinea e stile del paragrafo. */
export interface FormatoCopiato { testo: Formato; paragrafo: { al?: Allineamento; ls?: number; st?: StileParagrafo; sb?: number; sa?: number } }

/** Il formato da copiare: quello del testo scritto in questo punto (o di tutta la selezione, se uniforme) e del suo paragrafo. */
export function formatoDaCopiare(stato: Stato): FormatoCopiato {
  const testo = senzaLink(stato.pendenti ?? formatoSelezione(stato.doc, stato.sel));
  const a = attributiParagrafo(stato.doc, ordina(stato.doc, stato.sel)[0]);
  const paragrafo: FormatoCopiato['paragrafo'] = {};
  if (a.al !== undefined) paragrafo.al = a.al;
  if (a.ls !== undefined) paragrafo.ls = a.ls;
  if (a.st !== undefined) paragrafo.st = a.st;
  if (a.sb !== undefined) paragrafo.sb = a.sb;
  if (a.sa !== undefined) paragrafo.sa = a.sa;
  return { testo, paragrafo };
}

/** Applica un formato copiato alla selezione (testo e paragrafi toccati). Con la selezione vuota non cambia niente. */
export function incollaFormato(stato: Stato, copia: FormatoCopiato): Stato {
  if (collassata(stato.sel)) return stato;
  const t = copia.testo;
  let doc = modificaRun(stato.doc, stato.sel, (r) => {
    const n = copiaRun(r);
    n.g = !!t.g; n.c = !!t.c; n.s = !!t.s;
    for (const k of ['f', 'z', 'k', 'h', 'x', 'v'] as const) {
      if (t[k] === undefined) delete n[k];
      else (n as unknown as Record<string, unknown>)[k] = t[k];
    }
    return n;
  });
  doc = applicaParagrafo(doc, stato.sel, 'al', copia.paragrafo.al);
  doc = applicaParagrafo(doc, stato.sel, 'ls', copia.paragrafo.ls);
  doc = applicaParagrafo(doc, stato.sel, 'st', copia.paragrafo.st);
  doc = applicaParagrafo(doc, stato.sel, 'sb', copia.paragrafo.sb);
  doc = applicaParagrafo(doc, stato.sel, 'sa', copia.paragrafo.sa);
  return { ...stato, doc, pendenti: null };
}

/** Corpo successivo o precedente tra i passi di Google Documenti (8, 9, 10, 11, 12, 14, 18, ...). */
export function corpoSuccessivo(z: number, direzione: 1 | -1): number {
  if (direzione === 1) return PASSI_CORPO.find((p) => p > z) ?? PASSI_CORPO[PASSI_CORPO.length - 1];
  const minori = PASSI_CORPO.filter((p) => p < z);
  return minori.length > 0 ? minori[minori.length - 1] : PASSI_CORPO[0];
}

// ---- attributi di paragrafo ----
export function attributiParagrafo(doc: Documento, pos: Posizione): AttributiParagrafo {
  return attributiDi(doc.paragrafi[limita(doc, pos).p]);
}

function modificaParagrafi(doc: Documento, sel: Selezione, f: (p: Paragrafo) => Paragrafo): Documento {
  const [i, fi] = ordina(doc, sel);
  return conParagrafi(doc, doc.paragrafi.map((par, p) => (p >= i.p && p <= fi.p ? f(par) : par)));
}

export function applicaParagrafo(doc: Documento, sel: Selezione, chiave: ChiaveParagrafo, valore: string | number | boolean | undefined): Documento {
  return modificaParagrafi(doc, sel, (par) => {
    const n: Paragrafo = { ...attributiDi(par), runs: par.runs };
    if (valore === undefined) delete n[chiave];
    else (n as unknown as Record<string, unknown>)[chiave] = valore;
    return n;
  });
}

/** Sposta il rientro dei paragrafi toccati (da 0 a 8 livelli). */
export function cambiaRientro(doc: Documento, sel: Selezione, delta: number): Documento {
  return modificaParagrafi(doc, sel, (par) => {
    const nuovo = Math.min(RIENTRO_MASSIMO, Math.max(0, (par.ri ?? 0) + delta));
    const n: Paragrafo = { ...attributiDi(par), runs: par.runs };
    if (nuovo === 0) delete n.ri; else n.ri = nuovo;
    return n;
  });
}

/** Elenco puntato o numerato: lo toglie se tutti i paragrafi toccati lo hanno già, altrimenti lo mette a tutti. */
export function alternaElenco(doc: Documento, sel: Selezione, tipo: TipoElenco): Documento {
  const [i, f] = ordina(doc, sel);
  const tutti = doc.paragrafi.slice(i.p, f.p + 1).every((p) => p.el === tipo);
  const nuovo = applicaParagrafo(doc, sel, 'el', tutti ? undefined : tipo);
  // la spunta ha senso solo nelle voci di un elenco di attività: cambiando o togliendo l'elenco si perde
  return tipo === 't' && !tutti ? nuovo : applicaParagrafo(nuovo, sel, 'fa', undefined);
}

/** Spunta o toglie la spunta alla voce dell'elenco di attività che sta nel paragrafo p (non fa niente se non lo è). */
export function alternaFatto(doc: Documento, p: number): Documento {
  const par = doc.paragrafi[p];
  if (!par || par.el !== 't') return doc;
  const pos = { p, o: 0 };
  return applicaParagrafo(doc, { ancora: pos, fuoco: pos }, 'fa', par.fa ? undefined : true);
}

/** Toglie grassetto, corsivo, sottolineato, carattere, corpo e colori dal testo selezionato e lo stile dai paragrafi toccati. */
export function pulisciFormato(doc: Documento, sel: Selezione): Documento {
  const senzaRun = modificaRun(doc, sel, (r) => ({ t: r.t, g: false, c: false, s: false, ...(r.u !== undefined ? { u: r.u } : {}), ...(r.im !== undefined ? { im: r.im } : {}) }));
  return applicaParagrafo(senzaRun, sel, 'st', undefined);
}

/** Numero di ogni voce degli elenchi numerati (null per i paragrafi che non sono voci numerate). */
export function numeriElenco(doc: Documento): Array<number | null> {
  const contatori: number[] = [];
  return doc.paragrafi.map((par) => {
    if (par.el === undefined) { contatori.length = 0; return null; }
    const livello = par.ri ?? 0;
    contatori.length = Math.min(contatori.length, livello + 1);
    while (contatori.length < livello + 1) contatori.push(0);
    if (par.el === 'p' || par.el === 't') { contatori.length = 0; return null; }
    contatori[livello] += 1;
    return contatori[livello];
  });
}

export function estraiTesto(doc: Documento, sel: Selezione): string {
  const [i, f] = ordina(doc, sel);
  const parti: string[] = [];
  for (let p = i.p; p <= f.p; p++) {
    const t = testoParagrafo(doc.paragrafi[p]);
    parti.push(t.slice(p === i.p ? i.o : 0, p === f.p ? f.o : t.length).replace(/\uFFFC/g, ''));
  }
  return parti.join('\n');
}

export function muovi(doc: Documento, pos: Posizione, mossa: Mossa): Posizione {
  const { p, o } = limita(doc, pos);
  const t = testoParagrafo(doc.paragrafi[p]);
  const ultimo = doc.paragrafi.length - 1;
  const fineDi = (n: number): number => testoParagrafo(doc.paragrafi[n]).length;
  const spazio = (ch: string): boolean => /\s/.test(ch);
  switch (mossa) {
    case 'sinistra':
      if (o > 0) return { p, o: o - passoIndietro(t, o) };
      return p > 0 ? { p: p - 1, o: fineDi(p - 1) } : { p, o };
    case 'destra':
      if (o < t.length) return { p, o: o + passoAvanti(t, o) };
      return p < ultimo ? { p: p + 1, o: 0 } : { p, o };
    case 'inizioParagrafo': return { p, o: 0 };
    case 'fineParagrafo': return { p, o: t.length };
    case 'inizioDocumento': return { p: 0, o: 0 };
    case 'fineDocumento': return { p: ultimo, o: fineDi(ultimo) };
    case 'parolaSinistra': {
      if (o === 0) return p > 0 ? { p: p - 1, o: fineDi(p - 1) } : { p, o };
      let i = o;
      while (i > 0 && spazio(t[i - 1])) i--;
      while (i > 0 && !spazio(t[i - 1])) i--;
      return { p, o: i };
    }
    case 'parolaDestra': {
      if (o === t.length) return p < ultimo ? { p: p + 1, o: 0 } : { p, o };
      let i = o;
      while (i < t.length && !spazio(t[i])) i++;
      while (i < t.length && spazio(t[i])) i++;
      return { p, o: i };
    }
  }
}

export function sposta(stato: Stato, mossa: Mossa): Stato {
  const [i, f] = ordina(stato.doc, stato.sel);
  if (!collassata(stato.sel) && (mossa === 'sinistra' || mossa === 'destra')) {
    const q = mossa === 'sinistra' ? i : f;
    return { ...stato, sel: { ancora: q, fuoco: q }, pendenti: null };
  }
  const q = muovi(stato.doc, limita(stato.doc, stato.sel.fuoco), mossa);
  return { ...stato, sel: { ancora: q, fuoco: q }, pendenti: null };
}
export function estendi(stato: Stato, mossa: Mossa): Stato {
  const fuoco = muovi(stato.doc, limita(stato.doc, stato.sel.fuoco), mossa);
  return { ...stato, sel: { ancora: limita(stato.doc, stato.sel.ancora), fuoco }, pendenti: null };
}
export function selezionaTutto(stato: Stato): Stato {
  const ultimo = stato.doc.paragrafi.length - 1;
  const fine = { p: ultimo, o: testoParagrafo(stato.doc.paragrafi[ultimo]).length };
  return { ...stato, sel: { ancora: { p: 0, o: 0 }, fuoco: fine }, pendenti: null };
}

export function contaParole(doc: Documento): number {
  return testoDi(doc).split(/\s+/).filter((x) => x !== '').length;
}
export function contaCaratteri(doc: Documento, senzaSpazi = false): number {
  const t = doc.paragrafi.map(testoParagrafo).join('');
  return Array.from(senzaSpazi ? t.replace(/\s+/g, '') : t).length;
}

// ---- immagini ----
/** Mette l'immagine al cursore (al posto della selezione) e porta il cursore dopo di lei. Se l'immagine non è ammessa restituisce lo stato identico. */
export function inserisciImmagine(stato: Stato, im: Immagine): Stato {
  if (!immagineValida(im)) return stato;
  const [i, f] = ordina(stato.doc, stato.sel);
  const r = sostituisci(stato.doc, i, f, [[{ t: OGGETTO, g: false, c: false, s: false, im: { s: im.s, w: im.w, h: im.h } }]]);
  return { doc: r.doc, sel: { ancora: r.pos, fuoco: r.pos }, pendenti: null };
}

/** L'immagine selezionata (la selezione è esattamente un carattere ed è un'immagine), con la sua posizione. */
export function immagineSelezionata(doc: Documento, sel: Selezione): { p: number; o: number; im: Immagine } | null {
  const [i, f] = ordina(doc, sel);
  if (i.p !== f.p || f.o !== i.o + 1) return null;
  const run = tagliaRuns(doc.paragrafi[i.p].runs, i.o, f.o)[0];
  return run?.im ? { p: i.p, o: i.o, im: run.im } : null;
}

/** Cambia la larghezza dell'immagine selezionata (da 20 a 2000 pixel) tenendo le proporzioni; l'immagine resta selezionata. */
export function impostaLarghezzaImmagine(stato: Stato, larghezza: number): Stato {
  const sel = immagineSelezionata(stato.doc, stato.sel);
  if (!sel || !Number.isFinite(larghezza)) return stato;
  const w = Math.min(2000, Math.max(20, Math.round(larghezza)));
  const h = Math.max(1, Math.round((w * sel.im.h) / sel.im.w));
  const da = { p: sel.p, o: sel.o };
  const a = { p: sel.p, o: sel.o + 1 };
  const r = sostituisci(stato.doc, da, a, [[{ t: OGGETTO, g: false, c: false, s: false, im: { s: sel.im.s, w, h } }]]);
  return { doc: r.doc, sel: { ancora: da, fuoco: a }, pendenti: null };
}

// ---- intestazione e piè di pagina ----
/** Perché un blocco di intestazione o di piè di pagina non è ammesso, o null se va bene. */
export function controllaMargine(paragrafi: Paragrafo[]): string | null {
  if (!Array.isArray(paragrafi) || paragrafi.length < 1 || paragrafi.length > RIGHE_MARGINE_MASSIME) return `da 1 a ${RIGHE_MARGINE_MASSIME} paragrafi`;
  for (const p of paragrafi) {
    if (p.el !== undefined || p.ri !== undefined || p.st !== undefined || p.tb !== undefined || p.ls !== undefined) return "solo l'allineamento";
    if (testoParagrafo(p).length > LUNGHEZZA_MARGINE_MASSIMA) return 'riga troppo lunga';
    for (const r of p.runs) if (r.im !== undefined || r.u !== undefined || r.t.includes(OGGETTO)) return 'niente immagini né link';
  }
  return null;
}

function margineVuoto(paragrafi: Paragrafo[]): boolean { return paragrafi.every((p) => p.runs.length === 0); }

function conMargine(doc: Documento, chiave: 'intestazione' | 'piede', paragrafi: Paragrafo[] | undefined): Documento {
  const nuovo: Documento = { ...doc };
  delete nuovo[chiave];
  if (paragrafi === undefined || paragrafi.length === 0 || margineVuoto(paragrafi)) return nuovo;
  const motivo = controllaMargine(paragrafi);
  if (motivo !== null) throw new Error(chiave === 'intestazione' ? t('Intestazione non valido: {}', motivo) : t('Piè di pagina non valido: {}', motivo));
  nuovo[chiave] = paragrafi.map((p) => ({ ...attributiDi(p), runs: normalizza(p.runs) }));
  return nuovo;
}

/** Il documento con questa intestazione (undefined, nessun paragrafo o solo paragrafi vuoti: la toglie). Un'intestazione non ammessa dà un errore. */
export function impostaIntestazione(doc: Documento, paragrafi: Paragrafo[] | undefined): Documento { return conMargine(doc, 'intestazione', paragrafi); }
/** Il documento con questo piè di pagina (undefined, nessun paragrafo o solo paragrafi vuoti: lo toglie). Un piè di pagina non ammesso dà un errore. */
export function impostaPiede(doc: Documento, paragrafi: Paragrafo[] | undefined): Documento { return conMargine(doc, 'piede', paragrafi); }

/** I paragrafi di un'intestazione o di un piè di pagina come si leggono nella pagina `pagina` di `pagine`: i campi diventano numeri. */
export function paragrafiConCampi(paragrafi: Paragrafo[], pagina: number, pagine: number): Paragrafo[] {
  return paragrafi.map((p) => ({
    ...attributiDi(p),
    runs: normalizza(p.runs.map((r) => copiaRun(r, r.t.split(CAMPO_PAGINA).join(String(pagina)).split(CAMPO_PAGINE).join(String(pagine))))),
  }));
}

/** Il testo che si scrive in un dialogo ({pagina} e {pagine} sono i campi) come paragrafi con questo allineamento; nessun testo dà nessun paragrafo. */
export function paragrafiDaTesto(testo: string, al: Allineamento = 'sx'): Paragrafo[] {
  const righe = testo.replace(/\r\n?/g, '\n').replace(CAMPI, '').replace(/\uFFFC/g, '').split('\n');
  while (righe.length > 0 && righe[righe.length - 1] === '') righe.pop();
  return righe.map((r) => {
    const t = r.split('{pagina}').join(CAMPO_PAGINA).split('{pagine}').join(CAMPO_PAGINE);
    return { ...(al === 'sx' ? {} : { al }), runs: t === '' ? [] : [{ t, g: false, c: false, s: false }] };
  });
}

/** Il contrario di paragrafiDaTesto: il testo di un'intestazione o di un piè di pagina con i campi scritti {pagina} e {pagine}. */
export function testoDaParagrafi(paragrafi: Paragrafo[] | undefined): string {
  return (paragrafi ?? []).map((p) => testoParagrafo(p).split(CAMPO_PAGINA).join('{pagina}').split(CAMPO_PAGINE).join('{pagine}')).join('\n');
}

/** L'allineamento del primo paragrafo di un'intestazione o di un piè di pagina (sinistra se non c'è). */
export function allineamentoMargine(paragrafi: Paragrafo[] | undefined): Allineamento { return paragrafi?.[0]?.al ?? 'sx'; }

// ---- salvataggio ----
function serializzaParagrafi(paragrafi: Paragrafo[]): unknown[] {
  return paragrafi.map((par) => {
    const runs = par.runs.map((r) => {
      const o: Record<string, unknown> = { t: r.t };
      if (r.g) o.g = true;
      if (r.c) o.c = true;
      if (r.s) o.s = true;
      if (r.f !== undefined) o.f = r.f;
      if (r.z !== undefined) o.z = r.z;
      if (r.k !== undefined) o.k = r.k;
      if (r.h !== undefined) o.h = r.h;
      if (r.u !== undefined) o.u = r.u;
      if (r.x !== undefined) { o.x = r.x; }
      if (r.v !== undefined) { o.v = r.v; }
      if (r.im !== undefined) o.im = { s: r.im.s, w: r.im.w, h: r.im.h };
      return o;
    });
    const a = attributiDi(par);
    return Object.keys(a).length === 0 ? runs : { a, r: runs };
  });
}

export function serializza(doc: Documento): string {
  const o: Record<string, unknown> = { v: 1, p: serializzaParagrafi(doc.paragrafi) };
  if (doc.intestazione !== undefined) o.ih = serializzaParagrafi(doc.intestazione);
  if (doc.piede !== undefined) o.pf = serializzaParagrafi(doc.piede);
  return JSON.stringify(o);
}

const COLORE = /^#[0-9a-fA-F]{3,8}$/;
function leggiRun(r: unknown): Run {
  const x = r as Record<string, unknown>;
  if (!x || typeof x !== 'object' || typeof x.t !== 'string') throw new Error(t('Documento non valido: tratto di testo'));
  const o: Run = { t: x.t, g: x.g === true, c: x.c === true, s: x.s === true };
  if (x.f !== undefined) { if (typeof x.f !== 'string' || x.f === '') throw new Error(t('Documento non valido: carattere')); o.f = x.f; }
  if (x.z !== undefined) { if (typeof x.z !== 'number' || !(x.z > 0 && x.z <= 400)) throw new Error(t('Documento non valido: corpo')); o.z = x.z; }
  if (x.k !== undefined) { if (typeof x.k !== 'string' || !COLORE.test(x.k)) throw new Error(t('Documento non valido: colore')); o.k = x.k; }
  if (x.h !== undefined) { if (typeof x.h !== 'string' || !COLORE.test(x.h)) throw new Error(t('Documento non valido: colore')); o.h = x.h; }
  if (x.u !== undefined) { if (typeof x.u !== 'string' || !urlValido(x.u)) throw new Error(t('Documento non valido: link')); o.u = x.u; }
  if (x.x !== undefined) { if (x.x !== 'b') throw new Error(t('Documento non valido: barrato')); o.x = x.x; }
  if (x.v !== undefined) { if (x.v !== 'p' && x.v !== 'd') throw new Error(t('Documento non valido: apice o pedice')); o.v = x.v; }
  if (x.im !== undefined) {
    if (!immagineValida(x.im) || x.t !== OGGETTO) throw new Error(t('Documento non valido: immagine'));
    o.im = { s: x.im.s, w: x.im.w, h: x.im.h };
  } else if (x.t.includes(OGGETTO)) throw new Error(t('Documento non valido: immagine'));
  return o;
}
function leggiAttributi(a: unknown): AttributiParagrafo {
  const x = a as Record<string, unknown>;
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error(t('Documento non valido: attributi del paragrafo'));
  const o: AttributiParagrafo = {};
  if (x.al !== undefined) { if (!['sx', 'ce', 'dx', 'gi'].includes(x.al as string)) throw new Error(t('Documento non valido: attributi del paragrafo')); o.al = x.al as Allineamento; }
  if (x.ls !== undefined) { if (typeof x.ls !== 'number' || !(x.ls >= 0.5 && x.ls <= 5)) throw new Error(t('Documento non valido: attributi del paragrafo')); o.ls = x.ls; }
  if (x.el !== undefined) { if (x.el !== 'p' && x.el !== 'n' && x.el !== 't') throw new Error(t('Documento non valido: attributi del paragrafo')); o.el = x.el; }
  if (x.ri !== undefined) { if (!Number.isInteger(x.ri) || (x.ri as number) < 1 || (x.ri as number) > RIENTRO_MASSIMO) throw new Error(t('Documento non valido: attributi del paragrafo')); o.ri = x.ri as number; }
  if (x.st !== undefined) { if (!['n', 't', 's', '1', '2', '3'].includes(x.st as string)) throw new Error(t('Documento non valido: attributi del paragrafo')); o.st = x.st as StileParagrafo; }
  if (x.tb !== undefined) {
    const tb = x.tb as Record<string, unknown>;
    const intero = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
    if (!tb || typeof tb !== 'object' || !intero(tb.i, 1e9) || !intero(tb.r, 999) || !intero(tb.c, 99)) throw new Error(t('Documento non valido: attributi del paragrafo'));
    o.tb = { i: tb.i, r: tb.r, c: tb.c };
  }
  if (x.sp !== undefined) { if (typeof x.sp !== 'boolean') throw new Error(t('Documento non valido: attributi del paragrafo')); if (x.sp) o.sp = true; }
  if (x.hr !== undefined) { if (typeof x.hr !== 'boolean') throw new Error(t('Documento non valido: attributi del paragrafo')); if (x.hr) o.hr = true; }
  if (x.fa !== undefined) { if (typeof x.fa !== 'boolean') throw new Error(t('Documento non valido: attributi del paragrafo')); if (x.fa && o.el === 't') o.fa = true; }
  for (const k of ['sb', 'sa'] as const) {
    if (x[k] === undefined) continue;
    if (typeof x[k] !== 'number' || !(x[k] as number >= 0 && x[k] as number <= SPAZIO_PARAGRAFO_MASSIMO)) throw new Error(t('Documento non valido: attributi del paragrafo'));
    const v = spazioValido(x[k]);
    if (v !== undefined) o[k] = v;
  }
  if (x.bd !== undefined) { const b = bordoValido(x.bd); if (!b) throw new Error(t('Documento non valido: attributi del paragrafo')); o.bd = b; }
  if (x.sg !== undefined) { const n = typeof x.sg === 'string' ? nomeSegnalibroValido(x.sg) : null; if (n === null) throw new Error(t('Documento non valido: attributi del paragrafo')); o.sg = n; }
  return o;
}

function leggiParagrafo(par: unknown): Paragrafo {
  if (Array.isArray(par)) return { runs: normalizza(par.map(leggiRun)) };
  const x = par as { a?: unknown; r?: unknown };
  if (!x || typeof x !== 'object' || !Array.isArray(x.r)) throw new Error(t('Documento non valido: paragrafo'));
  return { ...leggiAttributi(x.a), runs: normalizza(x.r.map(leggiRun)) };
}

function leggiMargine(valore: unknown, nome: string): Paragrafo[] | undefined {
  if (valore === undefined) return undefined;
  if (!Array.isArray(valore)) throw new Error(t('Documento non valido: {}', nome));
  const paragrafi = valore.map(leggiParagrafo);
  if (paragrafi.length > 0 && !margineVuoto(paragrafi) && controllaMargine(paragrafi) !== null) throw new Error(t('Documento non valido: {}', nome));
  return paragrafi.length === 0 || margineVuoto(paragrafi) ? undefined : paragrafi;
}

export function deserializza(testo: string): Documento {
  let dati: unknown;
  try { dati = JSON.parse(testo); } catch { throw new Error(t('Documento non valido: JSON illeggibile')); }
  const d = dati as { v?: unknown; p?: unknown; ih?: unknown; pf?: unknown };
  if (!d || typeof d !== 'object' || d.v !== 1 || !Array.isArray(d.p)) throw new Error(t('Documento non valido: versione o paragrafi'));
  const paragrafi: Paragrafo[] = d.p.map(leggiParagrafo);
  if (paragrafi.some((p) => HA_CAMPI.test(testoParagrafo(p)))) throw new Error(t('Documento non valido: campo'));
  const doc: Documento = { paragrafi: paragrafi.length > 0 ? paragrafi : [{ runs: [] }] };
  const intestazione = leggiMargine(d.ih, 'intestazione');
  const piede = leggiMargine(d.pf, 'piè di pagina');
  if (intestazione !== undefined) doc.intestazione = intestazione;
  if (piede !== undefined) doc.piede = piede;
  if (controllaTabelle(doc) !== null) throw new Error(t('Documento non valido: tabella'));
  return doc;
}

export function documentiUguali(a: Documento, b: Documento): boolean { return serializza(a) === serializza(b); }
