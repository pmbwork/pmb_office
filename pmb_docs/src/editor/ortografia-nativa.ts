// Correttore ortografico di Windows (via la parte nativa di Tauri): errori di un elenco di paragrafi e suggerimenti.
// Nel browser normale e nei test la parte nativa non c'è: i comandi dicono perché e non rompono niente.

import { chiamaTauriConErrore } from '../guscio/tauri';

/** Errore in un paragrafo (posizioni in unità UTF-16 come le stringhe di JavaScript). azione: 0 parola errata, 1 parola ripetuta (da togliere), 2 da sostituire con `sostituto`. */
export interface ErroreNativo { da: number; a: number; azione: 0 | 1 | 2; sostituto: string }

export interface EsitoControllo { errori: ErroreNativo[][] | null; messaggio: string | null }

/** Toglie i mezzi caratteri Unicode spaiati (un file può contenerli): la parte nativa rifiuterebbe tutta la richiesta. Si sostituiscono con U+FFFD, uno per uno, così le posizioni non cambiano. */
export function senzaSurrogatiSpaiati(t: string): string {
  return /[\ud800-\udfff]/.test(t) ? t.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '�') : t;
}

/** Controlla i testi (uno per paragrafo). `errori` è null se il correttore non c'è o la lingua non è disponibile; `messaggio` dice perché. */
export async function controllaNativo(testi: string[], lingua: string): Promise<EsitoControllo> {
  const r = await chiamaTauriConErrore<ErroreNativo[][]>('ortografia_controlla', { paragrafi: testi.map(senzaSurrogatiSpaiati), lingua });
  if (r.valore === null || !Array.isArray(r.valore) || r.valore.length !== testi.length) return { errori: null, messaggio: r.errore ?? 'risposta del correttore non valida' };
  return { errori: r.valore, messaggio: null };
}

/** I suggerimenti di Windows per una parola (al massimo 8); vuoto se non ce ne sono o il correttore non c'è. */
export async function suggerisciNativo(parola: string, lingua: string): Promise<string[]> {
  const r = await chiamaTauriConErrore<string[]>('ortografia_suggerisci', { parola: senzaSurrogatiSpaiati(parola), lingua });
  return Array.isArray(r.valore) ? r.valore.filter((x) => typeof x === 'string' && x !== '') : [];
}

/** Lingue per cui Windows ha il dizionario, tra quelle proposte. */
export async function lingueDisponibili(lingue: string[]): Promise<string[]> {
  const ok: string[] = [];
  for (const l of lingue) {
    const r = await chiamaTauriConErrore<boolean>('ortografia_lingua', { lingua: l });
    if (r.valore === true) ok.push(l);
  }
  return ok;
}
