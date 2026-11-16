// Salvataggio automatico di pmb_sheets: la copia di emergenza dei fogli modificati e non ancora salvati. Un foglio conta come modificato
// quando il suo contenuto è diverso da com'era appena creato, aperto da file o salvato. Tutto puro: lo stato dei fogli e il deposito si passano da fuori.
import { deserializeSheetDocumentData } from '../sheet/document-data';

export const CHIAVE_RECUPERO = 'pmb_sheets.recupero';
/** millisecondi tra un controllo e il successivo */
export const INTERVALLO_CONTROLLO = 3000;
/** oltre questa lunghezza (in caratteri) la copia non si scrive: il deposito del browser ha un limite */
export const LUNGHEZZA_MASSIMA_RECUPERO = 4_500_000;

export interface Archivio { leggi(): string | null; scrivi(testo: string): boolean; cancella(): void }
/** Un foglio da conservare: il titolo e il suo contenuto in formato .fsheet */
export interface Scheda { titolo: string; dati: string }
export interface Recuperato { schede: Scheda[]; salvato: number }
/** Un foglio com'è adesso, con l'identificativo della sua scheda */
export interface SchedaViva { id: string; titolo: string; dati: string }
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

/** Il testo da conservare: ora della copia e fogli. */
export function pacchettoRecupero(schede: Scheda[], adesso: number): string {
  return JSON.stringify({ v: 1, salvato: adesso, schede });
}

function schedaValida(s: unknown): s is Scheda {
  if (typeof s !== 'object' || s === null) return false;
  const c = s as Record<string, unknown>;
  if (typeof c.titolo !== 'string' || typeof c.dati !== 'string') return false;
  try { deserializeSheetDocumentData(c.dati); return true; } catch { return false; }
}

/** Rilegge una copia di emergenza: tiene i fogli leggibili e scarta gli altri; null se non ne resta nessuno. */
export function leggiRecupero(testo: string | null): Recuperato | null {
  if (testo === null) return null;
  let dati: unknown;
  try { dati = JSON.parse(testo); } catch { return null; }
  if (dati === null) return null; // gli altri valori che non sono oggetti non hanno i campi cercati qui sotto
  const d = dati as Record<string, unknown>;
  if (d.v !== 1 || !Array.isArray(d.schede)) return null;
  if (typeof d.salvato !== 'number' || !Number.isFinite(d.salvato)) return null;
  const schede = d.schede.filter(schedaValida).map((s) => ({ titolo: s.titolo, dati: s.dati }));
  return schede.length === 0 ? null : { schede, salvato: d.salvato };
}

/** Il salvataggio automatico: a ogni controllo scrive la copia dei fogli modificati, solo se è cambiata dall'ultima volta. */
export class Recupero {
  /** come è andata l'ultima scrittura, null se non ne è ancora avvenuta nessuna */
  esito: EsitoScrittura | null = null;
  private readonly ora: () => number;
  private readonly base = new Map<string, string>();
  private ultima: string | null = null;

  constructor(private readonly archivio: Archivio, opzioni: { ora?: () => number } = {}) {
    this.ora = opzioni.ora ?? (() => Date.now());
  }

  /** Il foglio della scheda è com'è su disco o appena creato: conta come modificato solo se cambia da qui in poi. */
  pulita(id: string, dati: string): void { this.base.set(id, dati); }

  /** Il foglio è diverso da com'era su disco o appena creato? (false se non c'è ancora un riferimento) */
  modificata(id: string, dati: string): boolean {
    const riferimento = this.base.get(id);
    return riferimento !== undefined && riferimento !== dati;
  }

  /** La scheda è stata chiusa: non serve più ricordare com'era. */
  chiusa(id: string): void { this.base.delete(id); }

  /** Guarda i fogli di adesso. Il primo che si vede per una scheda senza riferimento diventa il suo riferimento. */
  controlla(vive: SchedaViva[]): void {
    const modificate: Scheda[] = [];
    for (const v of vive) {
      const riferimento = this.base.get(v.id);
      if (riferimento === undefined) this.base.set(v.id, v.dati);
      else if (riferimento !== v.dati) modificate.push({ titolo: v.titolo, dati: v.dati });
    }
    const firma = JSON.stringify(modificate);
    if (firma === this.ultima) return;
    this.ultima = firma;
    if (modificate.length === 0) { this.archivio.cancella(); this.esito = 'vuoto'; return; }
    const testo = pacchettoRecupero(modificate, this.ora());
    if (testo.length > LUNGHEZZA_MASSIMA_RECUPERO) { this.esito = 'troppo-grande'; return; }
    if (this.archivio.scrivi(testo)) { this.esito = 'scritto'; return; }
    this.esito = 'errore';
    this.ultima = null;
  }

  /** La copia di emergenza che c'è adesso, se c'è. */
  trova(): Recuperato | null { return leggiRecupero(this.archivio.leggi()); }

  /** Butta via la copia di emergenza; al prossimo controllo si riscrive se ci sono ancora fogli modificati. */
  scarta(): void {
    this.archivio.cancella();
    this.ultima = null;
  }
}
