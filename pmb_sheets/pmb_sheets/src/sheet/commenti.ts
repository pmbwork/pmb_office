// Commenti sulle celle di pmb_sheets: un commento per cella, con testo e data.
// Modulo puro (niente DOM): la chiave unisce riga, colonna e nome del foglio.

export interface Commento {
  testo: string;
  /** quando è stato scritto o cambiato l'ultima volta, in formato ISO */
  data: string;
}

export interface CommentoSalvato extends Commento {
  foglio: string;
  riga: number;
  colonna: number;
}

export const LUNGHEZZA_MASSIMA_COMMENTO = 5000;

export function chiaveCommento(foglio: string, riga: number, colonna: number): string {
  return `${riga}:${colonna}!${foglio}`;
}

function leggiChiave(chiave: string): { foglio: string; riga: number; colonna: number } | null {
  const m = /^(\d+):(\d+)!([\s\S]*)$/.exec(chiave);
  return m ? { riga: Number(m[1]), colonna: Number(m[2]), foglio: m[3] } : null;
}

/** Il commento della cella, se c'è. */
export function commentoDi(mappa: Map<string, Commento>, foglio: string, riga: number, colonna: number): Commento | undefined {
  return mappa.get(chiaveCommento(foglio, riga, colonna));
}

/** Scrive il commento di una cella; un testo vuoto (o di soli spazi) lo toglie. Restituisce true se qualcosa è cambiato. */
export function impostaCommento(mappa: Map<string, Commento>, foglio: string, riga: number, colonna: number, testo: string, adesso: Date): boolean {
  const chiave = chiaveCommento(foglio, riga, colonna);
  const pulito = testo.trim().slice(0, LUNGHEZZA_MASSIMA_COMMENTO);
  const prima = mappa.get(chiave);
  if (pulito === '') return mappa.delete(chiave);
  if (prima && prima.testo === pulito) return false;
  mappa.set(chiave, { testo: pulito, data: adesso.toISOString() });
  return true;
}

/** I commenti di un foglio (o di tutti), in ordine di riga e poi di colonna. */
export function elencaCommenti(mappa: Map<string, Commento>, foglio?: string): CommentoSalvato[] {
  const elenco: CommentoSalvato[] = [];
  for (const [chiave, c] of mappa) {
    const k = leggiChiave(chiave);
    if (!k || (foglio !== undefined && k.foglio !== foglio)) continue;
    elenco.push({ ...k, testo: c.testo, data: c.data });
  }
  return elenco.sort((a, b) => a.foglio.localeCompare(b.foglio) || a.riga - b.riga || a.colonna - b.colonna);
}

/** Dall'elenco salvato nel file alla mappa in memoria: le voci rovinate si scartano. */
export function commentiDaDati(dati: unknown): Map<string, Commento> {
  const mappa = new Map<string, Commento>();
  if (!Array.isArray(dati)) return mappa;
  for (const v of dati) {
    if (!v || typeof v !== 'object') continue;
    const { foglio, riga, colonna, testo, data } = v as Record<string, unknown>;
    if (typeof foglio !== 'string' || typeof testo !== 'string' || testo.trim() === '') continue;
    if (!Number.isInteger(riga) || !Number.isInteger(colonna) || (riga as number) < 1 || (colonna as number) < 1) continue;
    mappa.set(chiaveCommento(foglio, riga as number, colonna as number), {
      testo: testo.slice(0, LUNGHEZZA_MASSIMA_COMMENTO),
      data: typeof data === 'string' ? data : '',
    });
  }
  return mappa;
}

/** Quando un foglio cambia nome i suoi commenti lo seguono. */
export function rinominaFoglioCommenti(mappa: Map<string, Commento>, vecchio: string, nuovo: string): void {
  for (const c of elencaCommenti(mappa, vecchio)) {
    mappa.delete(chiaveCommento(vecchio, c.riga, c.colonna));
    mappa.set(chiaveCommento(nuovo, c.riga, c.colonna), { testo: c.testo, data: c.data });
  }
}

/** Quando un foglio si elimina i suoi commenti vanno via con lui. */
export function togliCommentiFoglio(mappa: Map<string, Commento>, foglio: string): void {
  for (const c of elencaCommenti(mappa, foglio)) mappa.delete(chiaveCommento(foglio, c.riga, c.colonna));
}

/** Copia i commenti di un foglio su un altro (per «Duplica foglio»). */
export function copiaCommentiFoglio(mappa: Map<string, Commento>, da: string, a: string): void {
  for (const c of elencaCommenti(mappa, da)) mappa.set(chiaveCommento(a, c.riga, c.colonna), { testo: c.testo, data: c.data });
}
