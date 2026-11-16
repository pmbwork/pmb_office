// Lingua dell'interfaccia di pmb_sheets (italiano o inglese). Stesso sistema di pmb_docs (src/i18n di pmb_docs): i due file vanno tenuti allineati.
// Il testo italiano è la chiave: t('Salva') restituisce «Salva» in italiano e la traduzione in inglese; se in inglese manca la traduzione
// si ricade sull'italiano e il testo finisce nell'insieme `mancanti` (lo controlla un test, così nessun testo resta senza traduzione).
// Nei testi, `{}` è il posto di un valore: t('Parole: {}', 12). In inglese i valori restano nello stesso ordine.
import { EN } from './en';
import { scorciatoiaPerSistema, testoPerSistema } from '@comune/piattaforma';

export type Lingua = 'it' | 'en';
export type ScelteLingua = 'auto' | Lingua;

let corrente: Lingua = 'it';
export const mancanti = new Set<string>();

export function linguaCorrente(): Lingua { return corrente; }

/** Cambia la lingua e avvisa i componenti, che si ridisegnano (evento «lingua-cambiata» sulla finestra). */
export function impostaLingua(l: Lingua): void {
  if (l === corrente) return;
  corrente = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lingua-cambiata', { detail: { lingua: l } }));
}

/** La lingua di Windows (o del browser): italiano se comincia per «it», altrimenti inglese. */
export function linguaDaSistema(): Lingua {
  const l = typeof navigator !== 'undefined' ? (navigator.language ?? '') : '';
  return l.toLowerCase().startsWith('it') ? 'it' : 'en';
}

export function risolviLingua(scelta: ScelteLingua): Lingua { return scelta === 'auto' ? linguaDaSistema() : scelta; }

/** Sostituisce i `{}` del modello con i valori, in ordine. Se i valori sono meno dei `{}`, quelli in più restano come sono. */
export function riempi(modello: string, valori: ReadonlyArray<unknown>): string {
  if (valori.length === 0) return modello;
  let i = 0;
  return modello.replace(/\{\}/g, (m) => (i < valori.length ? String(valori[i++]) : m));
}

/** La traduzione di un testo (con valori al posto dei `{}`). */
export function tradotto(testo: string): string { return testoPerSistema(tradottoPerLingua(testo)); }

function tradottoPerLingua(testo: string): string {
  if (corrente === 'it') return testo.replace(/\|[a-z]+$/, ''); // «Annulla|azione»: il suffisso distingue due significati dello stesso testo italiano
  const e = EN[testo];
  if (e === undefined) { if (/[A-Za-zÀ-ÿ]{2,}/.test(testo)) mancanti.add(testo); return testo; } // numeri e simboli: niente da tradurre
  return e;
}

export function t(testo: string, ...valori: unknown[]): string { return riempi(tradotto(testo), valori); }

/** L'etichetta di una voce di menu o di un pulsante della barra: «Annulla» lì vuol dire «annulla l'ultima modifica» (Undo), non «chiudi senza fare» (Cancel). */
export function tVoce(etichetta: string): string { return t(etichetta === 'Annulla' ? 'Annulla|azione' : etichetta); }

/** Un'etichetta composta di voci di menu («Modifica › Incolla speciale», «Modifica > Incolla speciale» nella ricerca dei menu): ogni pezzo tradotto come voce. */
export function tEtichetta(etichetta: string): string { return etichetta.split(/( › | > )/).map((p, i) => (i % 2 ? p : tVoce(p))).join(''); }

/** Il nome di un gruppo del catalogo della barra: «Menu Modifica» o il nome di un gruppo della barra. */
export function tGruppo(gruppo: string): string { return gruppo.startsWith('Menu ') ? t('Menu {}', tVoce(gruppo.slice(5))) : t(gruppo); }

/** Il nome della lingua come si scrive nella lista della finestra Preferenze (non si traduce: ognuno si riconosce nella sua). */
export const NOMI_LINGUA: Record<Lingua, string> = { it: 'Italiano', en: 'English' };

/** Il formato di date e orari della lingua corrente (per toLocaleString e simili). */
export function localeCorrente(): string { return corrente === 'en' ? 'en-GB' : 'it-IT'; }

/** Una scorciatoia da tastiera scritta per la lingua corrente: «Ctrl+Maiusc+S» diventa «Ctrl+Shift+S» in inglese. */
export function scorciatoia(s: string): string {
  return scorciatoiaPerSistema(corrente === 'en' ? s.replace(/Maiusc/g, 'Shift').replace(/Invio/g, 'Enter').replace(/Canc\b/g, 'Del') : s); // su Mac: «⇧⌘S»
}

/** Un numero decimale scritto per la lingua corrente: 1,15 in italiano, 1.15 in inglese. */
export function numero(n: number): string { return corrente === 'en' ? String(n) : String(n).replace('.', ','); }
