// Impostazione di pagina di un foglio di pmb_sheets (File › Imposta pagina…) e divisione del foglio in pagine.
// Scritto per pmb_office (lotto 3 del piano delle funzioni, 2026-11-18). Modulo puro: niente DOM, niente motore.
// Misure della carta e dei margini in millimetri; larghezze e altezze delle celle in pixel a 96 dpi, come nel foglio.
import { columnIndexToLetters, MAX_COLS, MAX_ROWS, parseCellAddress } from '../engine/address';

export type FormatoCarta = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
export type Orientamento = 'verticale' | 'orizzontale';
export interface TestiMargine { sinistra: string; centro: string; destra: string }
export interface Intervallo { da: number; a: number }
export interface AreaStampa { startRow: number; endRow: number; startCol: number; endCol: number }

export interface ImpostaPagina {
  formato: FormatoCarta;
  orientamento: Orientamento;
  /** margini in mm */
  margini: { alto: number; basso: number; sinistro: number; destro: number };
  /** scala in percento (usata quando `adatta` è null) */
  scala: number;
  /** adatta a un numero di pagine in larghezza e in altezza (0 = quante servono); null = usa la scala */
  adatta: { larghezza: number; altezza: number } | null;
  /** l'area di stampa; senza, tutto ciò che il foglio usa */
  area?: AreaStampa;
  /** righe e colonne da ripetere in cima e a sinistra di ogni pagina */
  righeRipetute?: Intervallo;
  colonneRipetute?: Intervallo;
  intestazione: TestiMargine;
  pie: TestiMargine;
  /** stampa la griglia delle celle e le intestazioni di riga e di colonna (1, 2, 3… e A, B, C…) */
  griglia: boolean;
  intestazioniRigheColonne: boolean;
  centraOrizzontale: boolean;
  centraVerticale: boolean;
  /** ordine delle pagine: prima in giù poi a destra, o prima a destra poi in giù */
  ordine: 'giu' | 'destra';
  /** interruzioni di pagina a mano: la riga (o la colonna) che comincia una pagina nuova */
  interruzioniRighe: number[];
  interruzioniColonne: number[];
}

/** Carta: larghezza e altezza in verticale, in mm. */
export const CARTA: Record<FormatoCarta, [number, number]> = {
  A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6],
};
export const NOMI_CARTA: Record<FormatoCarta, string> = { A4: 'A4', A3: 'A3', A5: 'A5', Letter: 'Lettera (US)', Legal: 'Legale (US)' };

/** Campi di intestazione e piè di pagina. */
export const CAMPI = ['&[Pagina]', '&[Pagine]', '&[Foglio]', '&[File]', '&[Data]', '&[Ora]'] as const;

export function paginaPredefinita(): ImpostaPagina {
  return {
    formato: 'A4', orientamento: 'verticale',
    margini: { alto: 15, basso: 15, sinistro: 15, destro: 15 },
    scala: 100,
    // come prima di questa funzione: il foglio si riduce per entrare in larghezza in una pagina
    adatta: { larghezza: 1, altezza: 0 },
    intestazione: { sinistra: '', centro: '&[Foglio]', destra: '' },
    pie: { sinistra: '', centro: '&[Pagina] / &[Pagine]', destra: '' },
    griglia: false, intestazioniRigheColonne: false,
    centraOrizzontale: false, centraVerticale: false,
    ordine: 'giu', interruzioniRighe: [], interruzioniColonne: [],
  };
}

const LUNGHEZZA_TESTO = 255;
const INTERRUZIONI_MASSIME = 1000;
const numeroTra = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const intero = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function testiValidi(x: unknown, base: TestiMargine): TestiMargine {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const pulito = (v: unknown, d: string): string => (typeof v === 'string' ? v.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '').slice(0, LUNGHEZZA_TESTO) : d);
  return { sinistra: pulito(o.sinistra, base.sinistra), centro: pulito(o.centro, base.centro), destra: pulito(o.destra, base.destra) };
}
function intervalloValido(x: unknown, max: number): Intervallo | undefined {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !intero(o.da, 1, max) || !intero(o.a, 1, max) || (o.da as number) > (o.a as number)) return undefined;
  return { da: o.da as number, a: o.a as number };
}
export function areaValida(x: unknown): AreaStampa | undefined {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return undefined;
  if (!intero(o.startRow, 1, MAX_ROWS) || !intero(o.endRow, 1, MAX_ROWS) || !intero(o.startCol, 1, MAX_COLS) || !intero(o.endCol, 1, MAX_COLS)) return undefined;
  if ((o.startRow as number) > (o.endRow as number) || (o.startCol as number) > (o.endCol as number)) return undefined;
  return { startRow: o.startRow as number, endRow: o.endRow as number, startCol: o.startCol as number, endCol: o.endCol as number };
}
function interruzioni(x: unknown, max: number): number[] {
  if (!Array.isArray(x)) return [];
  return [...new Set(x.filter((n): n is number => intero(n, 2, max)))].sort((a, b) => a - b).slice(0, INTERRUZIONI_MASSIME);
}

/** Rimette in ordine un'impostazione letta da un file: i valori non ammessi tornano quelli predefiniti. */
export function ripulisciPagina(x: unknown): ImpostaPagina {
  const p = paginaPredefinita();
  if (!x || typeof x !== 'object') return p;
  const o = x as Record<string, unknown>;
  if (typeof o.formato === 'string' && o.formato in CARTA) p.formato = o.formato as FormatoCarta;
  if (o.orientamento === 'verticale' || o.orientamento === 'orizzontale') p.orientamento = o.orientamento;
  const m = (o.margini && typeof o.margini === 'object' ? o.margini : {}) as Record<string, unknown>;
  for (const k of ['alto', 'basso', 'sinistro', 'destro'] as const) if (numeroTra(m[k], 0, 100)) p.margini[k] = Math.round((m[k] as number) * 10) / 10;
  if (numeroTra(o.scala, 10, 400)) p.scala = Math.round(o.scala);
  if (o.adatta === null) p.adatta = null;
  else if (o.adatta && typeof o.adatta === 'object') {
    const a = o.adatta as Record<string, unknown>;
    const l = intero(a.larghezza, 0, 100) ? a.larghezza : 1;
    const h = intero(a.altezza, 0, 100) ? a.altezza : 0;
    p.adatta = l === 0 && h === 0 ? null : { larghezza: l, altezza: h };
  }
  const area = areaValida(o.area);
  if (area) p.area = area;
  const rr = intervalloValido(o.righeRipetute, MAX_ROWS);
  if (rr) p.righeRipetute = rr;
  const cr = intervalloValido(o.colonneRipetute, MAX_COLS);
  if (cr) p.colonneRipetute = cr;
  p.intestazione = testiValidi(o.intestazione, p.intestazione);
  p.pie = testiValidi(o.pie, p.pie);
  for (const k of ['griglia', 'intestazioniRigheColonne', 'centraOrizzontale', 'centraVerticale'] as const) if (typeof o[k] === 'boolean') p[k] = o[k] as boolean;
  if (o.ordine === 'giu' || o.ordine === 'destra') p.ordine = o.ordine;
  p.interruzioniRighe = interruzioni(o.interruzioniRighe, MAX_ROWS);
  p.interruzioniColonne = interruzioni(o.interruzioniColonne, MAX_COLS);
  return p;
}

/** Vero se l'impostazione è quella di partenza (allora non si scrive nei file). */
export function eDiPartenza(p: ImpostaPagina): boolean {
  return JSON.stringify(ripulisciPagina(p)) === JSON.stringify(paginaPredefinita());
}

/** Copia indipendente. */
export function copiaPagina(p: ImpostaPagina): ImpostaPagina { return ripulisciPagina(JSON.parse(JSON.stringify(p))); }

/** Larghezza e altezza della carta come si usa (girata se orizzontale), in mm. */
export function misureCarta(p: Pick<ImpostaPagina, 'formato' | 'orientamento'>): { larghezza: number; altezza: number } {
  const [w, h] = CARTA[p.formato];
  return p.orientamento === 'orizzontale' ? { larghezza: h, altezza: w } : { larghezza: w, altezza: h };
}
export const PX_PER_MM = 96 / 25.4;

/** La zona utile per le celle (carta meno margini), in pixel. */
export function zonaUtile(p: ImpostaPagina): { larghezza: number; altezza: number } {
  const c = misureCarta(p);
  const l = Math.max(10, c.larghezza - p.margini.sinistro - p.margini.destro);
  const h = Math.max(10, c.altezza - p.margini.alto - p.margini.basso);
  return { larghezza: l * PX_PER_MM, altezza: h * PX_PER_MM };
}

// ---- campi di intestazione e piè di pagina ----

export interface ValoriCampi { pagina: number; pagine: number; foglio: string; file: string; data: string; ora: string }

/** Il testo con i campi sostituiti. «&&» scrive una & sola. */
export function sostituisciCampi(testo: string, v: ValoriCampi): string {
  return testo
    .replace(/&&/g, '\u0000')
    .replace(/&\[Pagina\]/g, String(v.pagina))
    .replace(/&\[Pagine\]/g, String(v.pagine))
    .replace(/&\[Foglio\]/g, v.foglio)
    .replace(/&\[File\]/g, v.file)
    .replace(/&\[Data\]/g, v.data)
    .replace(/&\[Ora\]/g, v.ora)
    .replace(/\u0000/g, '&');
}

// ---- righe e colonne scritte dall'utente ----

/** «1:2», «$1:$2», «3» → righe; null se non è un intervallo di righe valido. Vuoto → undefined (nessuna). */
export function leggiRighe(testo: string): Intervallo | null | undefined {
  const t = testo.trim().replace(/\$/g, '');
  if (t === '') return undefined;
  const m = /^(\d+)(?::(\d+))?$/.exec(t);
  if (!m) return null;
  const da = Number(m[1]);
  const a = Number(m[2] ?? m[1]);
  if (!intero(da, 1, MAX_ROWS) || !intero(a, 1, MAX_ROWS)) return null;
  return { da: Math.min(da, a), a: Math.max(da, a) };
}
function lettereANumero(s: string): number {
  let n = 0;
  for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
/** «A:B», «$A:$C», «B» → colonne; null se non è valido. Vuoto → undefined. */
export function leggiColonne(testo: string): Intervallo | null | undefined {
  const t = testo.trim().replace(/\$/g, '');
  if (t === '') return undefined;
  const m = /^([A-Za-z]{1,3})(?::([A-Za-z]{1,3}))?$/.exec(t);
  if (!m) return null;
  const da = lettereANumero(m[1]);
  const a = lettereANumero(m[2] ?? m[1]);
  if (!intero(da, 1, MAX_COLS) || !intero(a, 1, MAX_COLS)) return null;
  return { da: Math.min(da, a), a: Math.max(da, a) };
}
export function scriviRighe(i: Intervallo | undefined): string { return i ? `${i.da}:${i.a}` : ''; }
export function scriviColonne(i: Intervallo | undefined): string { return i ? `${columnIndexToLetters(i.da)}:${columnIndexToLetters(i.a)}` : ''; }

// ---- divisione in pagine ----

export interface DatiImpaginazione {
  /** l'area da stampare */
  area: AreaStampa;
  /** larghezza di una colonna e altezza di una riga in pixel (0 = nascosta) */
  larghezza: (c: number) => number;
  altezza: (r: number) => number;
}
export interface PaginaStampa {
  /** righe e colonne del foglio stampate su questa pagina, nell'ordine (prima quelle ripetute) */
  righe: number[];
  colonne: number[];
  /** quante delle righe e delle colonne qui sopra sono quelle ripetute */
  righeRipetute: number;
  colonneRipetute: number;
}
export interface Impaginazione { scala: number; pagine: PaginaStampa[]; colonnePagine: number; righePagine: number }

/** Spazio occupato dalle intestazioni di riga e colonna (A, B… e 1, 2…), in pixel prima della scala. */
export const LARGHEZZA_NUMERI_RIGA = 36;
export const ALTEZZA_LETTERE_COLONNA = 18;

function gruppi(prima: number, ultima: number, misura: (i: number) => number, spazio: number, ripetute: Intervallo | undefined, interruzioni: ReadonlySet<number>, scala: number): number[][] {
  const visibili: number[] = [];
  for (let i = prima; i <= ultima; i++) if (misura(i) > 0) visibili.push(i);
  const misuraRipetute = (inizio: number): number => {
    if (!ripetute || inizio <= ripetute.a) return 0;
    let s = 0;
    for (let i = ripetute.da; i <= ripetute.a; i++) s += misura(i);
    return s * scala;
  };
  const out: number[][] = [];
  let attuale: number[] = [];
  let usato = 0;
  for (const i of visibili) {
    const m = misura(i) * scala;
    const nuovaPagina = attuale.length > 0 && (interruzioni.has(i) || usato + m > spazio - misuraRipetute(attuale[0]) + 0.01);
    if (nuovaPagina) { out.push(attuale); attuale = []; usato = 0; }
    attuale.push(i);
    usato += m;
  }
  if (attuale.length > 0) out.push(attuale);
  return out.length > 0 ? out : [[]];
}

function conRipetute(gruppo: number[], ripetute: Intervallo | undefined, misura: (i: number) => number): { elenco: number[]; quante: number } {
  if (!ripetute || gruppo.length === 0 || gruppo[0] <= ripetute.a) return { elenco: gruppo, quante: 0 };
  const extra: number[] = [];
  for (let i = ripetute.da; i <= ripetute.a; i++) if (misura(i) > 0) extra.push(i);
  return { elenco: [...extra, ...gruppo], quante: extra.length };
}

function provaScala(d: DatiImpaginazione, p: ImpostaPagina, scala: number): { colonne: number[][]; righe: number[][] } {
  const z = zonaUtile(p);
  const extraL = p.intestazioniRigheColonne ? LARGHEZZA_NUMERI_RIGA * scala : 0;
  const extraH = p.intestazioniRigheColonne ? ALTEZZA_LETTERE_COLONNA * scala : 0;
  const colonne = gruppi(d.area.startCol, d.area.endCol, d.larghezza, z.larghezza - extraL, p.colonneRipetute, new Set(p.interruzioniColonne), scala);
  const righe = gruppi(d.area.startRow, d.area.endRow, d.altezza, z.altezza - extraH, p.righeRipetute, new Set(p.interruzioniRighe), scala);
  return { colonne, righe };
}

/** Divide l'area in pagine secondo l'impostazione: scala fissa, oppure la scala più grande (fino al 100%) che sta nel numero di pagine chiesto. */
export function impagina(d: DatiImpaginazione, p: ImpostaPagina): Impaginazione {
  let scala = p.adatta ? 1 : p.scala / 100;
  let prova = provaScala(d, p, scala);
  if (p.adatta) {
    const { larghezza: nl, altezza: nh } = p.adatta;
    const entra = (x: { colonne: number[][]; righe: number[][] }): boolean => !((nl > 0 && x.colonne.length > nl) || (nh > 0 && x.righe.length > nh));
    if (!entra(prova)) {
      // la scala più grande che entra, cercata dimezzando l'intervallo; se nemmeno il 10% basta (interruzioni a mano) resta il 10%
      let basso = 0.1, alto = 1;
      for (let k = 0; k < 40; k++) {
        const medio = (basso + alto) / 2;
        if (entra(provaScala(d, p, medio))) basso = medio; else alto = medio;
      }
      scala = basso;
      prova = provaScala(d, p, scala);
    }
  }
  const pagine: PaginaStampa[] = [];
  const unisci = (gr: number[], gc: number[]): void => {
    const r = conRipetute(gr, p.righeRipetute, d.altezza);
    const c = conRipetute(gc, p.colonneRipetute, d.larghezza);
    pagine.push({ righe: r.elenco, colonne: c.elenco, righeRipetute: r.quante, colonneRipetute: c.quante });
  };
  if (p.ordine === 'giu') { for (const gc of prova.colonne) for (const gr of prova.righe) unisci(gr, gc); }
  else { for (const gr of prova.righe) for (const gc of prova.colonne) unisci(gr, gc); }
  return { scala, pagine, colonnePagine: prova.colonne.length, righePagine: prova.righe.length };
}

/** Aggiunge o toglie un'interruzione (riga o colonna che comincia una pagina nuova). */
export function alternaInterruzione(elenco: readonly number[], n: number): number[] {
  if (n < 2) return [...elenco];
  return elenco.includes(n) ? elenco.filter((x) => x !== n) : [...elenco, n].sort((a, b) => a - b);
}

/** «A1:F40» (anche con i $) → area; una cella sola vale come area di una cella. Vuoto → undefined; non valido → null. */
export function leggiAreaStampa(testo: string): AreaStampa | null | undefined {
  const t = testo.trim().replace(/\$/g, '').toUpperCase();
  if (t === '') return undefined;
  const parti = t.split(':');
  if (parti.length > 2) return null;
  const a = parseCellAddress(parti[0]);
  const b = parseCellAddress(parti[1] ?? parti[0]);
  if (!a || !b) return null;
  return areaValida({ startRow: Math.min(a.row, b.row), endRow: Math.max(a.row, b.row), startCol: Math.min(a.col, b.col), endCol: Math.max(a.col, b.col) }) ?? null;
}
export function scriviAreaStampa(a: AreaStampa | undefined): string {
  return a ? `${columnIndexToLetters(a.startCol)}${a.startRow}:${columnIndexToLetters(a.endCol)}${a.endRow}` : '';
}

