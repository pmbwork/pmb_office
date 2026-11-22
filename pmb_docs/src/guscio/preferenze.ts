// Preferenze dell'utente (tema, lingua del correttore, ortografia, maiuscola automatica, dizionario personale, accessibilità): salvate in locale sul computer.

import type { ScelteLingua } from '../i18n/lingua';
import { ripulisciSostituzioni } from '../editor/correzione';

export interface Preferenze {
  /** «sistema» segue il tema chiaro o scuro di Windows (o del Mac) e cambia con lui */
  tema: 'chiaro' | 'scuro' | 'sistema';
  /** il tema l'ha scelto l'utente (Preferenze o menu Visualizza); finché no, il programma segue il tema del computer */
  temaScelto: boolean;
  /** lingua dell'interfaccia: «auto» segue la lingua di Windows */
  interfaccia: ScelteLingua;
  /** lingua del correttore ortografico, per esempio it-IT */
  lingua: string;
  /** sottolinea gli errori mentre si scrive */
  ortografia: boolean;
  /** la prima lettera di una frase diventa maiuscola mentre si scrive */
  maiuscolaAutomatica: boolean;
  /** correzione automatica: sostituzioni dell'elenco, virgolette e trattini tipografici, DUe MAiuscole, bLOC MAIUSC, elenchi automatici */
  sostituzioniAutomatiche: boolean;
  virgoletteTipografiche: boolean;
  trattiniTipografici: boolean;
  correggiDueMaiuscole: boolean;
  correggiBlocMaiusc: boolean;
  elenchiAutomatici: boolean;
  /** elenco delle sostituzioni scelto dall'utente; null = elenco di partenza */
  sostituzioni: Array<[string, string]> | null;
  /** parole aggiunte al dizionario personale */
  dizionario: string[];
  altoContrasto: boolean;
  cursoreGrande: boolean;
  riduciAnimazioni: boolean;
  /** mostra la barra dei modelli e simboli nella finestra Equazione */
  barraEquazioni: boolean;
  /** barra degli strumenti scelta dall'utente (identificativi e separatori); null = barra predefinita */
  barra: string[] | null;
  /** menu in alto nascosti (la freccia a destra della barra, Ctrl+Maiusc+F) */
  menuNascosti: boolean;
  /** il nome con cui si firmano commenti e modifiche registrate (vuoto = «Autore») */
  autore: string;
}

export const CHIAVE_PREFERENZE = 'pmb_docs.preferenze';
export const LINGUE: ReadonlyArray<readonly [string, string]> = [
  ['it-IT', 'Italiano'], ['en-US', 'English (Stati Uniti)'], ['en-GB', 'English (Regno Unito)'], ['fr-FR', 'Français'], ['de-DE', 'Deutsch'], ['es-ES', 'Español'],
];
const PAROLE_MASSIME = 5000;
const LUNGHEZZA_PAROLA_MASSIMA = 60;

export const PREFERENZE_PREDEFINITE: Preferenze = {
  tema: 'sistema', temaScelto: false, interfaccia: 'auto', lingua: 'it-IT', ortografia: true, maiuscolaAutomatica: true, sostituzioniAutomatiche: true, virgoletteTipografiche: true, trattiniTipografici: true, correggiDueMaiuscole: true, correggiBlocMaiusc: true, elenchiAutomatici: true, sostituzioni: null, dizionario: [], altoContrasto: false, cursoreGrande: false, riduciAnimazioni: false, barraEquazioni: true, barra: null, menuNascosti: false, autore: '',
};

/** Rimette in ordine ciò che si legge dal disco: valori non ammessi tornano quelli predefiniti, il dizionario si ripulisce. */
export function ripulisciPreferenze(x: unknown): Preferenze {
  const p: Preferenze = { ...PREFERENZE_PREDEFINITE, dizionario: [] };
  if (!x || typeof x !== 'object') return p;
  const o = x as Record<string, unknown>;
  if (o.tema === 'chiaro' || o.tema === 'scuro' || o.tema === 'sistema') p.tema = o.tema;
  if (o.temaScelto === true) p.temaScelto = true;
  // fino alla 0.4.8 il predefinito era «Chiaro» e si salvava anche senza sceglierlo: un «chiaro» mai scelto torna «Come il sistema»
  else if (p.tema === 'chiaro') p.tema = 'sistema';
  if (o.interfaccia === 'auto' || o.interfaccia === 'it' || o.interfaccia === 'en') p.interfaccia = o.interfaccia;
  if (typeof o.lingua === 'string' && LINGUE.some(([c]) => c === o.lingua)) p.lingua = o.lingua;
  if (Array.isArray(o.barra)) p.barra = o.barra.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200).slice(0, 300);
  for (const k of ['ortografia', 'maiuscolaAutomatica', 'sostituzioniAutomatiche', 'virgoletteTipografiche', 'trattiniTipografici', 'correggiDueMaiuscole', 'correggiBlocMaiusc', 'elenchiAutomatici', 'altoContrasto', 'cursoreGrande', 'riduciAnimazioni', 'barraEquazioni', 'menuNascosti'] as const) if (typeof o[k] === 'boolean') p[k] = o[k] as boolean;
  p.sostituzioni = ripulisciSostituzioni(o.sostituzioni);
  if (typeof o.autore === 'string') p.autore = o.autore.replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (Array.isArray(o.dizionario)) {
    const viste = new Set<string>();
    for (const w of o.dizionario) {
      if (typeof w !== 'string') continue;
      const parola = w.trim();
      if (parola === '' || parola.length > LUNGHEZZA_PAROLA_MASSIMA || /[\x00-\x1f\x7f\s]/.test(parola)) continue;
      const chiave = parola.toLowerCase();
      if (viste.has(chiave)) continue;
      viste.add(chiave);
      p.dizionario.push(parola);
      if (p.dizionario.length >= PAROLE_MASSIME) break;
    }
  }
  return p;
}

export function leggiPreferenze(deposito: Pick<Storage, 'getItem'> | null): Preferenze {
  try {
    const t = deposito?.getItem(CHIAVE_PREFERENZE);
    return ripulisciPreferenze(t ? JSON.parse(t) : null);
  } catch {
    return ripulisciPreferenze(null);
  }
}

export function salvaPreferenze(deposito: Pick<Storage, 'setItem'> | null, p: Preferenze): void {
  try { deposito?.setItem(CHIAVE_PREFERENZE, JSON.stringify(ripulisciPreferenze(p))); } catch { /* disco pieno o accesso negato: le preferenze valgono per questa sessione */ }
}
