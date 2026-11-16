import { t } from '../i18n/lingua';
// Chiamate ai comandi della parte nativa (Tauri). Nel browser normale, o nei test, non c'è: non succede niente e non si rompe nulla.

import { urlValido } from '../modello/documento';

type Invocatore = (comando: string, argomenti?: Record<string, unknown>) => Promise<unknown>;

function trovaInvocatore(): Invocatore | null {
  const w = window as unknown as { __TAURI__?: { core?: { invoke?: Invocatore } }; __TAURI_INTERNALS__?: { invoke?: Invocatore } };
  return w.__TAURI__?.core?.invoke ?? w.__TAURI_INTERNALS__?.invoke ?? null;
}

/** true se la pagina gira dentro l'app nativa */
export function dentroTauri(): boolean { return trovaInvocatore() !== null; }

/** Chiama un comando nativo. Restituisce null se non siamo nell'app o se il comando fallisce. */
export async function chiamaTauri<T = unknown>(comando: string, argomenti: Record<string, unknown> = {}): Promise<T | null> {
  const invoca = trovaInvocatore();
  if (!invoca) return null;
  try {
    return (await invoca(comando, argomenti)) as T;
  } catch (e) {
    console.warn(`Comando nativo "${comando}" non riuscito:`, e);
    return null;
  }
}

/** Come chiamaTauri, ma dice anche perché non è riuscito (per esempio "Windows non ha il dizionario per la lingua..."). */
export async function chiamaTauriConErrore<T = unknown>(comando: string, argomenti: Record<string, unknown> = {}): Promise<{ valore: T | null; errore: string | null }> {
  const invoca = trovaInvocatore();
  if (!invoca) return { valore: null, errore: t("Il correttore ortografico funziona nell'app installata, non nel browser") };
  try {
    return { valore: (await invoca(comando, argomenti)) as T, errore: null };
  } catch (e) {
    return { valore: null, errore: typeof e === 'string' ? e : (e as Error)?.message ?? 'errore sconosciuto' };
  }
}

/**
 * Apre un indirizzo (solo http, https o mailto) nel programma predefinito del computer: nell'app con il comando nativo,
 * nel browser con una scheda nuova. Restituisce false se l'indirizzo non è ammesso o non si è potuto aprire.
 */
export async function apriIndirizzo(url: string): Promise<boolean> {
  if (!urlValido(url)) return false;
  if (dentroTauri()) return (await chiamaTauri<boolean>('open_url', { url })) === true;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Chiama un comando nativo passandogli dei byte grezzi (il contenuto di un file) e dice anche perché è fallito: la parte nativa risponde con un codice. */
export async function chiamaTauriGrezzo<T = unknown>(comando: string, byte: Uint8Array): Promise<{ valore: T | null; errore: string | null }> {
  const invoca = trovaInvocatore();
  if (!invoca) return { valore: null, errore: 'NON_NELL_APP' };
  try {
    const f = invoca as unknown as (c: string, a: unknown, o?: unknown) => Promise<unknown>;
    return { valore: (await f(comando, byte, { headers: { 'Content-Type': 'application/octet-stream' } })) as T, errore: null };
  } catch (e) {
    return { valore: null, errore: typeof e === 'string' ? e : (e as Error)?.message ?? 'ERRORE' };
  }
}
