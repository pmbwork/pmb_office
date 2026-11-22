import { t } from '../i18n/lingua';
import { impronteValide, type Impronta } from '@comune/protezione/impronte';
import { controllaUnioni, unioneDi, type Unione } from './unioni';
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
export type ChiaveAttributo = 'f' | 'z' | 'k' | 'h' | 'u' | 'x' | 'v' | 'w' | 'q';
export type ChiaveParagrafo = 'al' | 'ls' | 'el' | 'ri' | 'st' | 'sp' | 'sc' | 'hr' | 'fa' | 'sg' | 'sb' | 'sa' | 'su';
export type Allineamento = 'sx' | 'ce' | 'dx' | 'gi';
/** p = puntato, n = numerato, t = elenco di attività (casella da spuntare; fa = voce fatta). */
export type TipoElenco = 'p' | 'n' | 't';
export type StileParagrafo = 'n' | 't' | 's' | '1' | '2' | '3';
/** Cella di una tabella: cs e rs = colonne e righe coperte da una cella unita (sull'ancora), co = cella coperta da un'unione, h = riga di intestazione (vedi unioni.ts). */
export interface CellaTabella { i: number; r: number; c: number; w?: number; cs?: number; rs?: number; co?: boolean; h?: boolean }
export interface Segni { g: boolean; c: boolean; s: boolean }
/** w = sottolineato doppio ('d'), q = maiuscoletto ('m'). */
export interface Attributi { f?: string; z?: number; k?: string; h?: string; u?: string; x?: string; v?: string; w?: string; q?: string }
/** Immagine incorporata: indirizzo "data:image/...;base64,...", larghezza e altezza in pixel come si vedono nel foglio;
 *  a = testo intorno: l'immagine sta a sinistra (sx) o a destra (dx) e il testo le scorre accanto (senza a: in linea con il testo). */
export type DisposizioneImmagine = 'sx' | 'dx';
/** d = testo alternativo (la descrizione per chi usa un lettore di schermo; Formato › Immagine › Testo alternativo…). */
export interface Immagine { s: string; w: number; h: number; a?: DisposizioneImmagine; d?: string }
export const LUNGHEZZA_MASSIMA_TESTO_ALTERNATIVO = 1000;
/** Una copia pulita dell'immagine (solo i campi che conosce il programma). */
export function copiaImmagine(im: Immagine): Immagine {
  return { s: im.s, w: im.w, h: im.h, ...(im.a === 'sx' || im.a === 'dx' ? { a: im.a } : {}), ...(typeof im.d === 'string' && im.d.trim() !== '' ? { d: im.d.trim().slice(0, LUNGHEZZA_MASSIMA_TESTO_ALTERNATIVO) } : {}) };
}
/** Modifica registrata (Strumenti › Revisioni): testo inserito (i) o cancellato (d), da chi (a) e quando (d, data ISO). */
export interface Revisione { t: 'i' | 'd'; a: string; d: string }
/** Un tratto: testo e formato; cm = commento a cui appartiene (identificativo), rv = modifica registrata. */
/** cu = campo di unione (Strumenti › Stampa unione): il tratto è il carattere CAMPO_UNIONE e cu il nome della colonna dell'elenco. */
/** sq = numero di una didascalia (Inserisci › Didascalia): il tratto è il carattere CAMPO_SEQUENZA e sq il nome della serie («Figura»,
 *  «Tabella»...); il numero è la posizione tra le didascalie della stessa serie e si ricalcola da solo. */
/** xr = riferimento incrociato (Inserisci › Riferimento incrociato): il tratto è il carattere CAMPO_RIFERIMENTO, xr il segnalibro del
 *  paragrafo a cui rimanda e xm che cosa mostra: 't' il testo del paragrafo, 'e' etichetta e numero della didascalia («Figura 2»). */
export type ModoRiferimento = 't' | 'e';
export interface Run extends Segni, Attributi { t: string; im?: Immagine; cm?: string; rv?: Revisione; cu?: string; sq?: string; xr?: string; xm?: ModoRiferimento }
/** Risposta a un commento. */
export interface Risposta { a: string; d: string; t: string }
/** Commento a un pezzo di testo (i tratti con cm = id): autore, data ISO, testo, risolto (ok) e risposte. */
export interface Commento { id: string; a: string; d: string; t: string; ok?: boolean; r?: Risposta[] }
/** Il carattere che sta al posto di un'immagine nel testo. */
export const OGGETTO = '\uFFFC';
/** Nel testo di un'intestazione o di un piè di pagina: il numero della pagina in cui si trova. */
export const CAMPO_PAGINA = '\uE000';
/** Nel testo di un'intestazione o di un piè di pagina: il numero di pagine del documento. */
export const CAMPO_PAGINE = '\uE001';
/** Un campo di unione nel testo (il nome della colonna è nel tratto, cu): si vede come «Nome» e la stampa unione lo sostituisce. */
export const CAMPO_UNIONE = '\uE002';
export const LUNGHEZZA_MASSIMA_NOME_CAMPO = 100;
/** Il numero di una didascalia nel testo (la serie è nel tratto, sq). */
export const CAMPO_SEQUENZA = '\uE003';
/** Un riferimento incrociato nel testo (il segnalibro è nel tratto, xr). */
export const CAMPO_RIFERIMENTO = '\uE004';
export const RIGHE_MARGINE_MASSIME = 3;
const LUNGHEZZA_MARGINE_MASSIMA = 300;
const CAMPI = /[\uE000\uE001\uE002\uE003\uE004]/g;
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
  return typeof x.s === 'string' && x.s.length <= IMMAGINE_MASSIMA && IMMAGINE_BASE64.test(x.s) && misura(x.w) && misura(x.h) && (x.a === undefined || x.a === 'sx' || x.a === 'dx')
    && (x.d === undefined || (typeof x.d === 'string' && x.d.length <= LUNGHEZZA_MASSIMA_TESTO_ALTERNATIVO));
}

/** Misure con cui mettere nel foglio un'immagine grande w per h: dentro la larghezza del testo e l'altezza massima, mai ingrandita. */
export function dimensioniIniziali(w: number, h: number): { w: number; h: number } {
  if (!(w >= 1) || !(h >= 1)) return { w: 1, h: 1 };
  const scala = Math.min(1, LARGHEZZA_TESTO / w, ALTEZZA_MASSIMA / h);
  return { w: Math.max(1, Math.round(w * scala)), h: Math.max(1, Math.round(h * scala)) };
}
export interface AttributiParagrafo { al?: Allineamento; ls?: number; el?: TipoElenco; ri?: number; st?: StileParagrafo; tb?: CellaTabella; sp?: boolean; /** interruzione di colonna prima del paragrafo (con il testo in 2 o 3 colonne) */ sc?: boolean; hr?: boolean; fa?: boolean; sg?: string; sb?: number; sa?: number; bd?: Bordo; sm?: VoceSommario; su?: string }
/** Voce del sommario: segnalibro del titolo a cui rimanda (n) e livello del titolo (l). */
export interface VoceSommario { n: string; l: 1 | 2 | 3 }
export interface Paragrafo extends AttributiParagrafo { runs: Run[] }
/** commenti: quelli con del testo nel corpo; revisioni: la registrazione delle modifiche è accesa (Word: trackRevisions). */
/** Stile di paragrafo creato dall'utente (o letto da un file): nome, stile di base (aspetto e livello nel sommario) e ciò che cambia
 *  rispetto alla base: carattere, corpo, colore, grassetto, corsivo, sottolineato (disegnati dallo stile) e allineamento, spazi e
 *  interlinea (copiati nel paragrafo quando si applica lo stile). Vedi modello/stili.ts. */
export interface StilePersonale { id: string; nome: string; base: StileParagrafo; f?: string; z?: number; k?: string; g?: boolean; c?: boolean; s?: boolean; al?: Allineamento; sb?: number; sa?: number; ls?: number }
/** protezione = il documento è in sola lettura («Limita modifica» di Word), con le impronte della password se c'è (vedi modello/storia.ts). */
export interface Documento { paragrafi: Paragrafo[]; intestazione?: Paragrafo[]; piede?: Paragrafo[]; commenti?: Commento[]; revisioni?: boolean; stili?: StilePersonale[]; protezione?: { impronte?: Impronta[] }; filigrana?: string; /** il testo su 2 o 3 colonne (Formato › Colonne; senza = 1) */ colonne?: 2 | 3 }
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
  if (r.w !== undefined) o.w = r.w;
  if (r.q !== undefined) o.q = r.q;
  if (r.im !== undefined) o.im = r.im;
  if (r.cm !== undefined) o.cm = r.cm;
  if (r.rv !== undefined) o.rv = { t: r.rv.t, a: r.rv.a, d: r.rv.d };
  if (r.cu !== undefined) o.cu = r.cu;
  if (r.sq !== undefined) o.sq = r.sq;
  if (r.xr !== undefined) { o.xr = r.xr; o.xm = r.xm === 'e' ? 'e' : 't'; }
  return o;
}
function stessaRevisione(a: Revisione | undefined, b: Revisione | undefined): boolean {
  return a === undefined || b === undefined ? a === b : a.t === b.t && a.a === b.a && a.d === b.d;
}
function stessiRun(a: Run, b: Run): boolean {
  if (a.im !== undefined || b.im !== undefined || a.cu !== undefined || b.cu !== undefined || a.sq !== undefined || b.sq !== undefined || a.xr !== undefined || b.xr !== undefined) return false;
  return a.g === b.g && a.c === b.c && a.s === b.s && a.f === b.f && a.z === b.z && a.k === b.k && a.h === b.h && a.u === b.u && a.x === b.x && a.v === b.v && a.w === b.w && a.q === b.q
    && a.cm === b.cm && stessaRevisione(a.rv, b.rv);
}
function formatoDi(r: Run): Formato { const { t, im, cm, rv, cu, sq, xr, xm, ...resto } = copiaRun(r); void t; void im; void cm; void rv; void cu; void sq; void xr; void xm; return resto; }
function runDa(t: string, f: Formato): Run { return copiaRun({ ...f, t }); }
function haFormato(f: Formato): boolean {
  return f.g || f.c || f.s || f.f !== undefined || f.z !== undefined || f.k !== undefined || f.h !== undefined || f.u !== undefined || f.x !== undefined || f.v !== undefined || f.w !== undefined || f.q !== undefined;
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
  if (p.sc !== undefined) o.sc = p.sc;
  if (p.hr !== undefined) o.hr = p.hr;
  if (p.fa !== undefined && p.el === 't') o.fa = p.fa;
  if (p.sg !== undefined) o.sg = p.sg;
  if (p.sb !== undefined) o.sb = p.sb;
  if (p.sa !== undefined) o.sa = p.sa;
  if (p.bd !== undefined) o.bd = { ...p.bd };
  if (p.sm !== undefined) o.sm = { n: p.sm.n, l: p.sm.l };
  if (p.su !== undefined) o.su = p.su;
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
  const { sp, sc, hr, sg, sm, ...resto } = a;
  void sp; void sc; void hr; void sg; void sm;
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
    // i segnalibri che cominciano con «_» sono interni (quelli dei titoli per il sommario, come in Word): non si elencano
    if (par.sg === undefined || par.sg.startsWith('_')) return;
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
    const inizio = k;
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
    // unioni e intestazione: una cella coperta ha un solo paragrafo, e la griglia delle unioni è coerente
    const griglia: Unione[][] = [];
    for (let q = inizio; q < k; q++) {
      const x = doc.paragrafi[q].tb as CellaTabella;
      if (q > inizio && stessaCella(doc.paragrafi[q - 1].tb, x)) {
        if (x.co) return 'cella coperta con più paragrafi';
        const u = unioneDi(x);
        const g = griglia[x.r][x.c];
        if (u.cs !== g.cs || u.rs !== g.rs || u.h !== g.h) return 'paragrafi della stessa cella con unioni diverse';
        continue;
      }
      (griglia[x.r] ??= [])[x.c] = unioneDi(x);
    }
    const motivo = controllaUnioni(griglia);
    if (motivo !== null) return motivo;
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

export function tagliaRuns(runs: Run[], da: number, a: number): Run[] {
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
export function lunghezzaRuns(runs: Run[]): number { return runs.reduce((n, r) => n + r.t.length, 0); }

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

/** Commento in cui cade il punto: c'è solo se il carattere prima e quello dopo sono nello stesso commento. */
export function commentoIn(doc: Documento, pos: Posizione): string | undefined {
  const q = limita(doc, pos);
  const runs = doc.paragrafi[q.p].runs;
  const prima = q.o > 0 ? tagliaRuns(runs, q.o - 1, q.o)[0]?.cm : undefined;
  const dopo = tagliaRuns(runs, q.o, q.o + 1)[0]?.cm;
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
  for (const k of ['f', 'z', 'k', 'h', 'u', 'x', 'v', 'w', 'q'] as const) {
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
  // dentro un commento il testo nuovo resta nel commento; ai bordi no (come per i link)
  const cm = segni ? undefined : commentoIn(stato.doc, i);
  const conCommento = (r: Run): Run => (cm !== undefined && cm === commentoIn(stato.doc, f) ? { ...r, cm } : r);
  const nuovi: Run[][] = righe.map((r) => (r === '' ? [] : [conCommento(runDa(r, s))]));
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

/** Ctrl+Maiusc+Invio: il testo dopo il cursore passa alla colonna successiva (con il documento in 2 o 3 colonne). */
export function inserisciSaltoColonna(stato: Stato): Stato { return inserisciSalto(stato, 'sc'); }

export function inserisciSaltoPagina(stato: Stato): Stato { return inserisciSalto(stato, 'sp'); }

function inserisciSalto(stato: Stato, chiave: 'sp' | 'sc'): Stato {
  const [i, f] = ordina(stato.doc, stato.sel);
  const st = (i.p === f.p && i.o === f.o) ? stato : cancellaSelezione(stato);
  const [pos] = ordina(st.doc, st.sel);
  const par = st.doc.paragrafi[pos.p];
  const testa = tagliaRuns(par.runs, 0, pos.o);
  const coda = tagliaRuns(par.runs, pos.o, Infinity);
  const attrs = attributiDi(par);
  const attrsTesta = attributiSenzaSpHr(attrs);
  if (par.sp) attrsTesta.sp = true;
  if (par.sc) attrsTesta.sc = true;
  const attrsCoda = { ...attributiSenzaSpHr(attrs), [chiave]: true };
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

export function modificaRun(doc: Documento, sel: Selezione, f: (r: Run) => Run): Documento {
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
  return applicaParagrafo(applicaParagrafo(senzaRun, sel, 'st', undefined), sel, 'su', undefined);
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
  const r = sostituisci(stato.doc, i, f, [[{ t: OGGETTO, g: false, c: false, s: false, im: copiaImmagine(im) }]]);
  return { doc: r.doc, sel: { ancora: r.pos, fuoco: r.pos }, pendenti: null };
}

/** Inserisce al cursore un campo di unione (Strumenti › Stampa unione): un carattere che si vede «nome» e ha il formato del testo lì. */
export function inserisciCampoUnione(stato: Stato, nome: string): Stato {
  const n = nomeCampoValido(nome);
  if (n === null) return stato;
  const [i, f] = ordina(stato.doc, stato.sel);
  const formato = stato.pendenti ?? senzaLink(formatoIn(stato.doc, i));
  const r = sostituisci(stato.doc, i, f, [[{ ...formato, t: CAMPO_UNIONE, cu: n }]]);
  return { doc: r.doc, sel: { ancora: r.pos, fuoco: r.pos }, pendenti: null };
}

/** Inserisce una didascalia «Figura N: testo» (come Inserisci › Didascalia di Word): un paragrafo nuovo dopo quello del cursore (o prima,
 *  per le tabelle come vuole l'uso), in corsivo, con il numero che si conta da solo; il cursore va in fondo alla didascalia. */
export function inserisciDidascalia(stato: Stato, serie: string, testo: string, prima = false): Stato {
  const nome = nomeCampoValido(serie);
  if (nome === null) return stato;
  const [i] = ordina(stato.doc, stato.sel);
  // in una tabella la didascalia va fuori: prima della sua prima riga o dopo l'ultima
  let p = i.p;
  const tb = stato.doc.paragrafi[p]?.tb;
  if (tb) {
    const righe = stato.doc.paragrafi.map((x, k) => (x.tb?.i === tb.i ? k : -1)).filter((k) => k >= 0);
    p = prima ? righe[0] : righe[righe.length - 1];
  }
  const corsivo = (t: string): Run => ({ t, g: false, c: true, s: false });
  const spiegazione = testo.replace(/[\r\n]+/g, ' ').trim().slice(0, 500);
  const runs: Run[] = normalizza([corsivo(`${nome} `), { ...corsivo(CAMPO_SEQUENZA), sq: nome }, ...(spiegazione ? [corsivo(`: ${spiegazione}`)] : [])]);
  const indice = prima ? p : p + 1;
  const paragrafi = [...stato.doc.paragrafi.slice(0, indice), { runs }, ...stato.doc.paragrafi.slice(indice)];
  const fine = { p: indice, o: runs.reduce((n, r) => n + r.t.length, 0) };
  return { doc: conParagrafi(stato.doc, paragrafi), sel: { ancora: fine, fuoco: fine }, pendenti: null };
}

/** Inserisce al cursore un riferimento incrociato al paragrafo `bersaglio` (un titolo, un segnalibro, una didascalia). Se il paragrafo
 *  non ha un segnalibro gliene dà uno nascosto («_Ref» e un numero, come Word); tutto in un passo. */
export function inserisciRiferimento(stato: Stato, bersaglio: number, modo: ModoRiferimento): Stato {
  const par = stato.doc.paragrafi[bersaglio];
  if (!par) return stato;
  let doc = stato.doc;
  let nome = par.sg;
  if (nome === undefined) {
    const usati = new Set(doc.paragrafi.map((p) => p.sg?.toLowerCase()).filter((x): x is string => !!x));
    let n = 1 + doc.paragrafi.length;
    while (usati.has(`_ref${n}`)) n++;
    nome = `_Ref${n}`;
    doc = conParagrafi(doc, doc.paragrafi.map((p, k) => (k === bersaglio ? { ...p, sg: nome } : p)));
  }
  const [i, f] = ordina(doc, stato.sel);
  const formato = stato.pendenti ?? senzaLink(formatoIn(doc, i));
  const r = sostituisci(doc, i, f, [[{ ...formato, t: CAMPO_RIFERIMENTO, xr: nome, xm: modo }]]);
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
  const r = sostituisci(stato.doc, da, a, [[{ t: OGGETTO, g: false, c: false, s: false, im: { ...copiaImmagine(sel.im), w, h } }]]);
  return { doc: r.doc, sel: { ancora: da, fuoco: a }, pendenti: null };
}

/** Mette al posto dell'immagine selezionata un'altra immagine (ruotata, capovolta, ritagliata), tenendo il resto del tratto (link,
 *  commento) e il testo intorno; l'immagine resta selezionata. Se non c'è un'immagine selezionata o la nuova non è ammessa, nulla cambia. */
export function sostituisciImmagine(stato: Stato, nuova: Immagine): Stato {
  const sel = immagineSelezionata(stato.doc, stato.sel);
  if (!sel || !immagineValida(nuova)) return stato;
  const da = { p: sel.p, o: sel.o };
  const a = { p: sel.p, o: sel.o + 1 };
  const vecchio = tagliaRuns(stato.doc.paragrafi[sel.p].runs, sel.o, sel.o + 1)[0];
  // la nuova immagine (ruotata, ritagliata...) tiene il testo intorno e il testo alternativo di quella di prima
  const im = copiaImmagine({ ...nuova, ...(sel.im.a !== undefined && nuova.a === undefined ? { a: sel.im.a } : {}), ...(sel.im.d !== undefined && nuova.d === undefined ? { d: sel.im.d } : {}) });
  const r = sostituisci(stato.doc, da, a, [[{ ...vecchio, t: OGGETTO, im }]]);
  return { doc: r.doc, sel: { ancora: da, fuoco: a }, pendenti: null };
}

/** Testo intorno all'immagine selezionata: a sinistra, a destra, oppure in linea con il testo (undefined). */
export function impostaDisposizioneImmagine(stato: Stato, a: DisposizioneImmagine | undefined): Stato {
  const sel = immagineSelezionata(stato.doc, stato.sel);
  if (!sel || (sel.im.a ?? undefined) === a) return stato;
  const im = copiaImmagine(sel.im);
  if (a === undefined) delete im.a; else im.a = a;
  const da = { p: sel.p, o: sel.o };
  const fine = { p: sel.p, o: sel.o + 1 };
  const vecchio = tagliaRuns(stato.doc.paragrafi[sel.p].runs, sel.o, sel.o + 1)[0];
  const r = sostituisci(stato.doc, da, fine, [[{ ...vecchio, im }]]);
  return { doc: r.doc, sel: { ancora: da, fuoco: fine }, pendenti: null };
}

/** Il testo alternativo dell'immagine selezionata ('' lo toglie). Se non c'è un'immagine selezionata, nulla cambia. */
export function impostaTestoAlternativo(stato: Stato, testo: string): Stato {
  const sel = immagineSelezionata(stato.doc, stato.sel);
  if (!sel) return stato;
  const d = testo.trim().slice(0, LUNGHEZZA_MASSIMA_TESTO_ALTERNATIVO);
  if ((sel.im.d ?? '') === d) return stato;
  const im = copiaImmagine(sel.im);
  if (d === '') delete im.d; else im.d = d;
  const da = { p: sel.p, o: sel.o };
  const fine = { p: sel.p, o: sel.o + 1 };
  const vecchio = tagliaRuns(stato.doc.paragrafi[sel.p].runs, sel.o, sel.o + 1)[0];
  const r = sostituisci(stato.doc, da, fine, [[{ ...vecchio, im }]]);
  return { doc: r.doc, sel: { ancora: da, fuoco: fine }, pendenti: null };
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
      if (r.w !== undefined) o.w = r.w;
      if (r.q !== undefined) o.q = r.q;
      if (r.im !== undefined) o.im = copiaImmagine(r.im);
      if (r.cm !== undefined) o.cm = r.cm;
      if (r.rv !== undefined) o.rv = { t: r.rv.t, a: r.rv.a, d: r.rv.d };
      if (r.cu !== undefined) o.cu = r.cu;
      if (r.sq !== undefined) o.sq = r.sq;
      if (r.xr !== undefined) { o.xr = r.xr; o.xm = r.xm ?? 't'; }
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
  const commenti = commentiUsati(doc);
  if (commenti.length > 0) o.cm = commenti.map((c) => ({ id: c.id, a: c.a, d: c.d, t: c.t, ...(c.ok ? { ok: true } : {}), ...(c.r && c.r.length > 0 ? { r: c.r.map((x) => ({ a: x.a, d: x.d, t: x.t })) } : {}) }));
  if (doc.revisioni) o.tr = true;
  const stili = stiliUsati(doc);
  if (stili.length > 0) o.su = stili.map((s) => ({ ...s }));
  if (doc.filigrana) o.fg = doc.filigrana;
  if (doc.colonne) o.co = doc.colonne;
  if (doc.protezione) o.pr = doc.protezione.impronte ? { impronte: doc.protezione.impronte.map((i) => ({ ...i })) } : {};
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
  if (x.w !== undefined) { if (x.w !== 'd') throw new Error(t('Documento non valido: sottolineato doppio')); o.w = x.w; }
  if (x.q !== undefined) { if (x.q !== 'm') throw new Error(t('Documento non valido: maiuscoletto')); o.q = x.q; }
  if (x.v !== undefined) { if (x.v !== 'p' && x.v !== 'd') throw new Error(t('Documento non valido: apice o pedice')); o.v = x.v; }
  if (x.im !== undefined) {
    if (!immagineValida(x.im) || x.t !== OGGETTO) throw new Error(t('Documento non valido: immagine'));
    o.im = copiaImmagine(x.im);
  } else if (x.t.includes(OGGETTO)) throw new Error(t('Documento non valido: immagine'));
  if (x.cm !== undefined) { if (typeof x.cm !== 'string' || !ID_COMMENTO.test(x.cm)) throw new Error(t('Documento non valido: commento')); o.cm = x.cm; }
  if (x.rv !== undefined) { const rv = revisioneValida(x.rv); if (!rv) throw new Error(t('Documento non valido: modifica registrata')); o.rv = rv; }
  if (x.cu !== undefined) {
    if (typeof x.cu !== 'string' || nomeCampoValido(x.cu) === null || x.t !== CAMPO_UNIONE) throw new Error(t('Documento non valido: campo di unione'));
    o.cu = x.cu;
  } else if (x.t.includes(CAMPO_UNIONE)) throw new Error(t('Documento non valido: campo di unione'));
  if (x.sq !== undefined) {
    if (typeof x.sq !== 'string' || nomeCampoValido(x.sq) === null || x.t !== CAMPO_SEQUENZA) throw new Error(t('Documento non valido: didascalia'));
    o.sq = x.sq;
  } else if (x.t.includes(CAMPO_SEQUENZA)) throw new Error(t('Documento non valido: didascalia'));
  if (x.xr !== undefined) {
    if (typeof x.xr !== 'string' || nomeSegnalibroValido(x.xr) === null || x.t !== CAMPO_RIFERIMENTO || (x.xm !== 't' && x.xm !== 'e')) throw new Error(t('Documento non valido: riferimento incrociato'));
    o.xr = x.xr; o.xm = x.xm;
  } else if (x.t.includes(CAMPO_RIFERIMENTO)) throw new Error(t('Documento non valido: riferimento incrociato'));
  return o;
}
/** Il nome di un campo di unione ripulito (spazi in più tolti), o null se non va bene (vuoto, troppo lungo, con caratteri di controllo). */
export function nomeCampoValido(nome: string): string | null {
  const n = nome.replace(/\s+/g, ' ').trim();
  return n !== '' && n.length <= LUNGHEZZA_MASSIMA_NOME_CAMPO && !/[\x00-\x1f\x7f\uE000-\uE002\uFFFC]/.test(n) ? n : null;
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
    for (const [k, max] of [['cs', 100], ['rs', 1000]] as const) {
      if (tb[k] === undefined) continue;
      if (!Number.isInteger(tb[k]) || (tb[k] as number) < 1 || (tb[k] as number) > max) throw new Error(t('Documento non valido: attributi del paragrafo'));
      if ((tb[k] as number) > 1) o.tb[k] = tb[k] as number;
    }
    for (const k of ['co', 'h'] as const) {
      if (tb[k] === undefined) continue;
      if (typeof tb[k] !== 'boolean') throw new Error(t('Documento non valido: attributi del paragrafo'));
      if (tb[k]) o.tb[k] = true;
    }
  }
  if (x.sp !== undefined) { if (typeof x.sp !== 'boolean') throw new Error(t('Documento non valido: attributi del paragrafo')); if (x.sp) o.sp = true; }
  if (x.sc !== undefined) { if (typeof x.sc !== 'boolean') throw new Error(t('Documento non valido: attributi del paragrafo')); if (x.sc) o.sc = true; }
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
  if (x.sm !== undefined) {
    const sm = x.sm as Record<string, unknown>;
    if (!sm || typeof sm !== 'object' || typeof sm.n !== 'string' || sm.n.length > LUNGHEZZA_MASSIMA_SEGNALIBRO || (sm.l !== 1 && sm.l !== 2 && sm.l !== 3)) throw new Error(t('Documento non valido: attributi del paragrafo'));
    o.sm = { n: sm.n, l: sm.l };
  }
  if (x.su !== undefined) { if (typeof x.su !== 'string' || !ID_STILE_PERSONALE.test(x.su)) throw new Error(t('Documento non valido: attributi del paragrafo')); o.su = x.su; }
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
  const dd = d as { cm?: unknown; tr?: unknown };
  if (dd.cm !== undefined) {
    if (!Array.isArray(dd.cm)) throw new Error(t('Documento non valido: commento'));
    const commenti = dd.cm.map((c) => { const v = commentoValido(c); if (!v) throw new Error(t('Documento non valido: commento')); return v; });
    if (commenti.length > 0) doc.commenti = commenti;
  }
  if (dd.tr !== undefined) { if (typeof dd.tr !== 'boolean') throw new Error(t('Documento non valido: modifica registrata')); if (dd.tr) doc.revisioni = true; }
  const ds = d as { su?: unknown };
  if (ds.su !== undefined) {
    if (!Array.isArray(ds.su)) throw new Error(t('Documento non valido: stile'));
    const stili = ds.su.map((s) => { const v = stileValido(s); if (!v) throw new Error(t('Documento non valido: stile')); return v; });
    if (new Set(stili.map((s) => s.id)).size !== stili.length || new Set(stili.map((s) => s.nome.toLowerCase())).size !== stili.length) throw new Error(t('Documento non valido: stile'));
    if (stili.length > 0) doc.stili = stili;
  }
  const df = d as { fg?: unknown };
  if (df.fg !== undefined) {
    const f = typeof df.fg === 'string' ? filigranaValida(df.fg) : undefined;
    if (f === undefined) throw new Error(t('Documento non valido: filigrana'));
    if (f !== '') doc.filigrana = f;
  }
  const dc = d as { co?: unknown };
  if (dc.co !== undefined) {
    if (dc.co !== 2 && dc.co !== 3) throw new Error(t('Documento non valido: colonne'));
    doc.colonne = dc.co;
  }
  const dp = d as { pr?: unknown };
  if (dp.pr !== undefined) {
    if (!dp.pr || typeof dp.pr !== 'object' || Array.isArray(dp.pr)) throw new Error(t('Documento non valido: protezione'));
    const impronte = impronteValide((dp.pr as { impronte?: unknown }).impronte);
    doc.protezione = impronte ? { impronte } : {};
  }
  const ids = new Set((doc.stili ?? []).map((s) => s.id));
  if (doc.paragrafi.some((p) => p.su !== undefined && !ids.has(p.su))) throw new Error(t('Documento non valido: stile'));
  return doc;
}

export function documentiUguali(a: Documento, b: Documento): boolean { return serializza(a) === serializza(b); }

// ---- commenti e modifiche registrate: controlli ----
/** Identificativo di un commento: lettere, cifre, trattino e trattino basso, al massimo 40 caratteri. */
export const ID_COMMENTO = /^[A-Za-z0-9_-]{1,40}$/;
export const LUNGHEZZA_MASSIMA_COMMENTO = 5000;
export const LUNGHEZZA_MASSIMA_AUTORE = 100;
const testoBreve = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
/** La modifica registrata ripulita, o undefined se non è valida. */
export function revisioneValida(x: unknown): Revisione | undefined {
  const r = x as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || (r.t !== 'i' && r.t !== 'd') || !testoBreve(r.a, LUNGHEZZA_MASSIMA_AUTORE) || !testoBreve(r.d, 40)) return undefined;
  return { t: r.t, a: r.a, d: r.d };
}
function rispostaValida(x: unknown): Risposta | undefined {
  const r = x as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || !testoBreve(r.a, LUNGHEZZA_MASSIMA_AUTORE) || !testoBreve(r.d, 40) || typeof r.t !== 'string' || r.t.length > LUNGHEZZA_MASSIMA_COMMENTO) return undefined;
  return { a: r.a, d: r.d, t: r.t };
}
/** Il commento ripulito, o undefined se non è valido. */
export function commentoValido(x: unknown): Commento | undefined {
  const c = x as Record<string, unknown> | null;
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !ID_COMMENTO.test(c.id)) return undefined;
  const base = rispostaValida(c);
  if (!base) return undefined;
  const o: Commento = { id: c.id, ...base };
  if (c.ok === true) o.ok = true;
  if (c.r !== undefined) {
    if (!Array.isArray(c.r) || c.r.length > 500) return undefined;
    const risposte = c.r.map(rispostaValida);
    if (risposte.some((r) => r === undefined)) return undefined;
    if (risposte.length > 0) o.r = risposte as Risposta[];
  }
  return o;
}
/** Gli identificativi dei commenti che hanno del testo nel corpo del documento. */
export function idCommentiNelTesto(doc: Documento): Set<string> {
  const ids = new Set<string>();
  for (const par of doc.paragrafi) for (const r of par.runs) if (r.cm !== undefined) ids.add(r.cm);
  return ids;
}
/** I commenti del documento che hanno ancora del testo (quelli il cui testo è stato cancellato tutto non contano più). */
export function commentiUsati(doc: Documento): Commento[] {
  if (!doc.commenti || doc.commenti.length === 0) return [];
  const ids = idCommentiNelTesto(doc);
  return doc.commenti.filter((c) => ids.has(c.id));
}

// ---- stili personali: controlli ----
/** Identificativo di uno stile personale: una lettera, poi lettere, cifre e trattino basso (va bene anche come styleId di Word). */
export const ID_STILE_PERSONALE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
export const LUNGHEZZA_MASSIMA_NOME_STILE = 60;
/** Lo stile ripulito, o undefined se non è valido. */
export function stileValido(x: unknown): StilePersonale | undefined {
  const s = x as Record<string, unknown>;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return undefined;
  if (typeof s.id !== 'string' || !ID_STILE_PERSONALE.test(s.id)) return undefined;
  if (typeof s.nome !== 'string' || s.nome.trim() === '' || s.nome.length > LUNGHEZZA_MASSIMA_NOME_STILE || /[\x00-\x1f\x7f]/.test(s.nome)) return undefined;
  if (!['n', 't', 's', '1', '2', '3'].includes(s.base as string)) return undefined;
  const o: StilePersonale = { id: s.id, nome: s.nome, base: s.base as StileParagrafo };
  if (s.f !== undefined) { if (typeof s.f !== 'string' || s.f === '' || s.f.length > 100 || /[\x00-\x1f\x7f"';{}<>\\]/.test(s.f)) return undefined; o.f = s.f; }
  if (s.z !== undefined) { if (typeof s.z !== 'number' || !(s.z > 0 && s.z <= 400)) return undefined; o.z = s.z; }
  if (s.k !== undefined) { if (typeof s.k !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(s.k)) return undefined; o.k = s.k; }
  for (const k of ['g', 'c', 's'] as const) { if (s[k] === undefined) continue; if (typeof s[k] !== 'boolean') return undefined; if (s[k]) o[k] = true; }
  if (s.al !== undefined) { if (!['sx', 'ce', 'dx', 'gi'].includes(s.al as string)) return undefined; o.al = s.al as Allineamento; }
  if (s.ls !== undefined) { if (typeof s.ls !== 'number' || !(s.ls >= 0.5 && s.ls <= 5)) return undefined; o.ls = s.ls; }
  for (const k of ['sb', 'sa'] as const) {
    if (s[k] === undefined) continue;
    if (typeof s[k] !== 'number' || !((s[k] as number) >= 0 && (s[k] as number) <= SPAZIO_PARAGRAFO_MASSIMO)) return undefined;
    const v = spazioValido(s[k]);
    if (v !== undefined) o[k] = v;
  }
  return o;
}
/** Gli stili personali del documento che servono (usati da un paragrafo), nell'ordine in cui sono stati creati. Quelli non usati restano
 *  nel documento finché è aperto, ma non si salvano. */
export function stiliUsati(doc: Documento): StilePersonale[] {
  if (!doc.stili || doc.stili.length === 0) return [];
  const usati = new Set<string>();
  for (const p of doc.paragrafi) if (p.su !== undefined) usati.add(p.su);
  return doc.stili.filter((s) => usati.has(s.id));
}

// ---- filigrana ----
/** La filigrana: un testo grande, chiaro e in diagonale su ogni pagina (come la filigrana di testo di Word). */
export const LUNGHEZZA_MASSIMA_FILIGRANA = 40;
/** Il testo della filigrana ripulito ('' = nessuna), o undefined se non va bene. */
export function filigranaValida(x: string): string | undefined {
  const s = x.replace(/\s+/g, ' ').trim();
  if (s.length > LUNGHEZZA_MASSIMA_FILIGRANA || /[\x00-\x1f\x7f]/.test(s)) return undefined;
  return s;
}
