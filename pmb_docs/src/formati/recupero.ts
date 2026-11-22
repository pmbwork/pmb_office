// Salvataggio automatico e recupero di pmb_docs dopo una chiusura anomala: una sola copia di emergenza del documento aperto,
// scritta poco dopo ogni modifica e cancellata quando non serve più. Tutto puro: il deposito (localStorage) e il timer si passano da fuori.
import { deserializza, serializza, testoDi, type Documento } from '../modello/documento';

export const CHIAVE_RECUPERO = 'pmb_docs.recupero';
/** millisecondi tra la prima modifica e la scrittura della copia */
export const RITARDO_SALVATAGGIO = 2000;
/** oltre questa lunghezza (in caratteri) la copia non si scrive: il deposito del browser ha un limite */
export const LUNGHEZZA_MASSIMA_RECUPERO = 4_500_000;

export interface Archivio { leggi(): string | null; scrivi(testo: string): boolean; cancella(): void }
export interface Recuperato { titolo: string; doc: Documento; salvato: number }
export type EsitoScrittura = 'scritto' | 'vuoto' | 'troppo-grande' | 'errore';
type Deposito = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Archivio su un deposito tipo localStorage; se il deposito manca o dà errore non si rompe niente: non legge, non scrive. */
export function archivioDa(deposito: Deposito | null | undefined, chiave: string = CHIAVE_RECUPERO): Archivio {
  return {
    leggi(): string | null {
      try { return deposito ? deposito.getItem(chiave) : null; } catch { return null; }
    },
    scrivi(testo: string): boolean {
      if (!deposito) return false;
      try { deposito.setItem(chiave, testo); return true; } catch { return false; }
    },
    cancella(): void {
      try { if (deposito) deposito.removeItem(chiave); } catch { /* niente da cancellare */ }
    },
  };
}

/** Un documento senza niente di scritto: senza testo (con due paragrafi il testo ha già un a capo), senza tabelle né intestazione e piè di pagina. */
export function eVuoto(doc: Documento): boolean {
  if (doc.intestazione !== undefined || doc.piede !== undefined) return false;
  return doc.paragrafi[0]?.tb === undefined && testoDi(doc) === '';
}

/** Il testo da conservare: titolo, ora della copia e documento serializzato. */
export function pacchettoRecupero(titolo: string, doc: Documento, adesso: number): string {
  return JSON.stringify({ v: 1, titolo, salvato: adesso, doc: serializza(doc) });
}

/** Rilegge una copia di emergenza; null se non c'è, è rovinata o è un documento vuoto. */
export function leggiRecupero(testo: string | null): Recuperato | null {
  if (testo === null) return null;
  let dati: unknown;
  try { dati = JSON.parse(testo); } catch { return null; }
  if (dati === null) return null; // gli altri valori che non sono oggetti non hanno i campi cercati qui sotto
  const d = dati as Record<string, unknown>;
  if (d.v !== 1 || typeof d.titolo !== 'string' || typeof d.doc !== 'string') return null;
  if (typeof d.salvato !== 'number' || !Number.isFinite(d.salvato)) return null;
  let doc: Documento;
  try { doc = deserializza(d.doc); } catch { return null; }
  if (eVuoto(doc)) return null;
  return { titolo: d.titolo, doc, salvato: d.salvato };
}

export interface OpzioniRecupero {
  ritardo?: number;
  /** chiamata dopo ogni scrittura con il suo esito (il guscio avvisa se la copia non si può scrivere) */
  dopoScrittura?: (esito: EsitoScrittura) => void;
  ora?: () => number;
  imposta?: (azione: () => void, ms: number) => unknown;
  annulla?: (id: unknown) => void;
}

/** Il salvataggio automatico: "segnala" a ogni modifica, la copia si scrive al massimo dopo il ritardo dalla prima modifica non ancora scritta. */
export class Recupero {
  /** come è andata l'ultima scrittura, null se non ne è ancora avvenuta nessuna */
  esito: EsitoScrittura | null = null;
  private readonly ritardo: number;
  private readonly ora: () => number;
  private readonly imposta: (azione: () => void, ms: number) => unknown;
  private readonly annulla: (id: unknown) => void;
  private readonly dopoScrittura?: (esito: EsitoScrittura) => void;
  private timer: unknown = null;
  private inAttesa: { titolo: string; doc: Documento | (() => Documento) } | null = null;

  constructor(private readonly archivio: Archivio, opzioni: OpzioniRecupero = {}) {
    this.ritardo = opzioni.ritardo ?? RITARDO_SALVATAGGIO;
    this.ora = opzioni.ora ?? (() => Date.now());
    this.imposta = opzioni.imposta ?? ((azione, ms) => setTimeout(azione, ms));
    this.annulla = opzioni.annulla ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    this.dopoScrittura = opzioni.dopoScrittura;
  }

  /** Il documento è cambiato: si scriverà la versione più recente tra poco. */
  segnala(titolo: string, doc: Documento | (() => Documento)): void {
    this.inAttesa = { titolo, doc };
    if (this.timer !== null) return;
    this.timer = this.imposta(() => { this.timer = null; this.scriviOra(); }, this.ritardo);
  }

  /** Scrive subito quello che è in attesa (per esempio prima di chiudere). Un documento vuoto cancella la copia. */
  scriviOra(): void {
    if (this.timer !== null) { this.annulla(this.timer); this.timer = null; }
    const corrente = this.inAttesa;
    if (corrente === null) return;
    this.inAttesa = null;
    const doc = typeof corrente.doc === 'function' ? corrente.doc() : corrente.doc;
    if (eVuoto(doc)) { this.archivio.cancella(); this.esito = 'vuoto'; }
    else {
      const testo = pacchettoRecupero(corrente.titolo, doc, this.ora());
      this.esito = testo.length > LUNGHEZZA_MASSIMA_RECUPERO ? 'troppo-grande' : this.archivio.scrivi(testo) ? 'scritto' : 'errore';
    }
    this.dopoScrittura?.(this.esito);
  }

  /** La copia di emergenza che c'è adesso, se c'è. */
  trova(): Recuperato | null { return leggiRecupero(this.archivio.leggi()); }

  /** Non serve più (file salvato, documento nuovo o aperto da file): niente scrittura in sospeso e copia cancellata. */
  scarta(): void {
    if (this.timer !== null) { this.annulla(this.timer); this.timer = null; }
    this.inAttesa = null;
    this.archivio.cancella();
  }
}
