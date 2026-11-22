// Correzione automatica di pmb_docs mentre si scrive (oltre alla maiuscola a inizio frase, che sta in maiuscola.ts):
// sostituzioni da un elenco modificabile, virgolette tipografiche, trattini, DUe MAiuscole, bLOC MAIUSC, elenchi automatici.
// Ogni correzione riceve lo stato SUBITO DOPO il carattere scritto e restituisce lo stato corretto, oppure null.
// Il programma la registra come passo a sé nella storia: Ctrl+Z subito dopo annulla solo la correzione.
// Tutto puro, scritto per pmb_office: nessun accesso al browser.
import { alternaElenco, collassata, formatoIn, inserisciTesto, testoParagrafo, type Stato, type TipoElenco } from '../modello/documento';

export interface OpzioniCorrezione {
  /** sostituzioni dell'elenco e «...» → «…» */
  sostituzioni: boolean;
  /** "testo" → “testo”, l'apostrofo ' → ’ */
  virgolette: boolean;
  /** «parola - » → «parola – », «--» → «—» */
  trattini: boolean;
  /** «CIao» → «Ciao» */
  dueMaiuscole: boolean;
  /** «cIAO» → «Ciao», solo se il Bloc Maiusc è acceso */
  blocMaiusc: boolean;
  /** «1. », «- », «* », «[] » a inizio paragrafo fanno partire un elenco */
  elenchi: boolean;
  /** coppie [da, a]; il confronto con «da» non bada a maiuscole e minuscole né al tipo di apostrofo */
  elenco: ReadonlyArray<readonly [string, string]>;
}

/** Sostituzioni di partenza: errori comuni dell'italiano e dell'inglese e simboli. L'utente le cambia nella finestra Correzione automatica. */
export const SOSTITUZIONI_PREDEFINITE: ReadonlyArray<readonly [string, string]> = [
  // accenti
  ['perchè', 'perché'], ['poichè', 'poiché'], ['affinchè', 'affinché'], ['benchè', 'benché'], ['finchè', 'finché'], ['purchè', 'purché'],
  ['giacchè', 'giacché'], ['sicchè', 'sicché'], ['cosicchè', 'cosicché'], ['nè', 'né'], ['trentatrè', 'trentatré'], ['ventitrè', 'ventitré'],
  ['pò', "po'"], ["E'", 'È'], ['cè', "c'è"], ["qual'è", 'qual è'], ['un pò', "un po'"],
  // lettere scambiate o sbagliate
  ['qeusto', 'questo'], ['qesto', 'questo'], ['sopratutto', 'soprattutto'], ['propio', 'proprio'], ['daccordo', "d'accordo"],
  ['efficente', 'efficiente'], ['sufficente', 'sufficiente'], ['coscenza', 'coscienza'],
  ['teh', 'the'], ['adn', 'and'], ['recieve', 'receive'], ['seperate', 'separate'], ['definately', 'definitely'], ['occured', 'occurred'], ['untill', 'until'],
  ['wich', 'which'], ['becuase', 'because'], ['accomodate', 'accommodate'], ['thier', 'their'],
  // simboli
  ['(c)', '©'], ['(r)', '®'], ['(tm)', '™'], ['(e)', '€'], ['->', '→'], ['<-', '←'], ['=>', '⇒'], ['<=>', '⇔'], ['+-', '±'],
  ['1/2', '½'], ['1/4', '¼'], ['3/4', '¾'], ['!=', '≠'], ['<=', '≤'], ['>=', '≥'],
];
export const LUNGHEZZA_SOSTITUZIONE_MASSIMA = 200;
export const SOSTITUZIONI_MASSIME = 2000;

export const OPZIONI_PREDEFINITE: OpzioniCorrezione = {
  sostituzioni: true, virgolette: true, trattini: true, dueMaiuscole: true, blocMaiusc: true, elenchi: true, elenco: SOSTITUZIONI_PREDEFINITE,
};

/** Chiave di confronto: senza differenze di maiuscole e con apostrofi e virgolette dritti. */
export function chiaveSostituzione(t: string): string { return t.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"'); }

/** Rimette in ordine un elenco letto dal disco: coppie di testi, «da» di una o due parole, niente caratteri di controllo, niente doppioni (vale l'ultima). */
export function ripulisciSostituzioni(x: unknown): Array<[string, string]> | null {
  if (!Array.isArray(x)) return null;
  const visti = new Map<string, [string, string]>();
  for (const c of x) {
    if (!Array.isArray(c) || c.length !== 2 || typeof c[0] !== 'string' || typeof c[1] !== 'string') continue;
    const da = c[0].trim();
    const a = c[1];
    if (!/^\S+( \S+)?$/u.test(da) || a === '') continue;
    if (da.length > LUNGHEZZA_SOSTITUZIONE_MASSIMA || a.length > LUNGHEZZA_SOSTITUZIONE_MASSIMA || /[\x00-\x1f\x7f]/.test(da + a)) continue;
    const chiave = chiaveSostituzione(da);
    visti.delete(chiave);
    visti.set(chiave, [da, a]);
    if (visti.size >= SOSTITUZIONI_MASSIME) break;
  }
  return [...visti.values()];
}

const SPAZIO = /\s/u;
/** Caratteri che chiudono una parola e fanno scattare le correzioni sulla parola appena finita. */
const SEPARATORI = new Set([' ', ' ', '\t', '.', ',', ';', ':', '!', '?', ')', ']', '»']);
const APERTURE_PAROLA = /^[("'«“‘[¿¡]+/u;
/** Dopo questi caratteri (o a inizio paragrafo) una virgoletta è di apertura. */
const PRIMA_APERTURA = /[\s([{«“‘—–\-/]/u;
/** Parole con due maiuscole iniziali che sono giuste così. */
const DUE_MAIUSCOLE_GIUSTE = new Set(['MBps', 'KBps', 'GBps', 'TBps', 'MHz', 'GHz', 'KHz', 'THz', 'MWh', 'KWh', 'GWh']);

/** Sostituisce i caratteri da `da` ad `a` del paragrafo p con `nuovo`, col formato del primo carattere sostituito; il cursore resta al suo posto nel testo. */
function sostituisciPezzo(st: Stato, p: number, da: number, a: number, nuovo: string): Stato {
  const cur = st.sel.fuoco.o;
  const formato = formatoIn(st.doc, { p, o: da + 1 });
  const fatto = inserisciTesto({ ...st, sel: { ancora: { p, o: da }, fuoco: { p, o: a } } }, nuovo, formato);
  const o = cur + nuovo.length - (a - da);
  return { doc: fatto.doc, sel: { ancora: { p, o }, fuoco: { p, o } }, pendenti: st.pendenti };
}

/** `testo` con le maiuscole di `come`: tutto maiuscolo se `come` lo è (più di una lettera), con l'iniziale maiuscola se lo è quella di `come`. */
export function conMaiuscoleDi(come: string, testo: string): string {
  const lettere = come.replace(/[^\p{L}]/gu, '');
  if (lettere.length > 1 && lettere === lettere.toUpperCase() && lettere !== lettere.toLowerCase()) return testo.toUpperCase();
  const prima = lettere.charAt(0);
  if (prima !== '' && prima === prima.toUpperCase() && prima !== prima.toLowerCase()) {
    const i = testo.search(/\p{L}/u);
    return i < 0 ? testo : testo.slice(0, i) + testo.charAt(i).toUpperCase() + testo.slice(i + 1);
  }
  return testo;
}

function sembraIndirizzo(parola: string): boolean { return /:\/\/|@|^www\./i.test(parola); }

export interface ParolaCorretta {
  testo: string;
  /** la correzione comprende anche la parola prima (sostituzioni di due parole come «un pò») */
  conParolaPrima: boolean;
}

/** Correzione di una parola intera: elenco, DUe MAiuscole, bLOC MAIUSC. `primaDellaParola` serve alle sostituzioni di due parole. */
export function correggiParola(parola: string, opz: OpzioniCorrezione, blocAcceso: boolean, primaDellaParola = ''): ParolaCorretta | null {
  if (parola === '' || sembraIndirizzo(parola)) return null;
  if (opz.sostituzioni) {
    const cerca = (chiave: string): readonly [string, string] | undefined => opz.elenco.find(([da]) => chiaveSostituzione(da) === chiaveSostituzione(chiave));
    const due = /(\S+) $/u.exec(primaDellaParola);
    if (due) {
      const coppia = `${due[1]} ${parola}`;
      const t = cerca(coppia);
      if (t && t[1] !== coppia) return { testo: conMaiuscoleDi(coppia, t[1]), conParolaPrima: true };
    }
    const t = cerca(parola);
    if (t && t[1] !== parola) return { testo: conMaiuscoleDi(parola, t[1]), conParolaPrima: false };
  }
  if (opz.dueMaiuscole && /^\p{Lu}{2}\p{Ll}+$/u.test(parola) && !/^\p{Lu}{2,}s$/u.test(parola) && !DUE_MAIUSCOLE_GIUSTE.has(parola)) {
    return { testo: parola.charAt(0) + parola.slice(1).toLowerCase(), conParolaPrima: false };
  }
  if (opz.blocMaiusc && blocAcceso && /^\p{Ll}\p{Lu}{2,}$/u.test(parola)) {
    return { testo: parola.charAt(0).toUpperCase() + parola.slice(1).toLowerCase(), conParolaPrima: false };
  }
  return null;
}

/** Corregge la parola che finisce in `fine` nel paragrafo del cursore (fine = cursore prima dell'Invio, cursore - 1 dopo un separatore). */
export function correggiParolaFinoA(st: Stato, fine: number, opz: OpzioniCorrezione, blocAcceso: boolean): Stato | null {
  const { p } = st.sel.fuoco;
  const testo = testoParagrafo(st.doc.paragrafi[p]);
  let inizio = fine;
  while (inizio > 0 && !SPAZIO.test(testo.charAt(inizio - 1))) inizio--;
  let parola = testo.slice(inizio, fine);
  // le aperture davanti («(perchè», “perchè) non fanno parte della parola, salvo che la parola con loro sia nell'elenco, come «(c)»
  const aperture = APERTURE_PAROLA.exec(parola);
  if (aperture && aperture[0].length < parola.length && !opz.elenco.some(([da]) => chiaveSostituzione(da) === chiaveSostituzione(parola))) {
    inizio += aperture[0].length;
    parola = parola.slice(aperture[0].length);
  }
  if (opz.trattini) {
    // «parola - » → «parola – »; «parola -- » → «parola — »; «parola--parola» → «parola—parola»
    if ((parola === '-' || parola === '--') && inizio > 0 && testo.slice(0, inizio).trim() !== '') {
      return sostituisciPezzo(st, p, inizio, fine, parola === '-' ? '–' : '—');
    }
    const m = /^(\p{L}+)--(\p{L}+)$/u.exec(parola);
    if (m) return sostituisciPezzo(st, p, inizio + m[1].length, inizio + m[1].length + 2, '—');
  }
  const nuova = correggiParola(parola, opz, blocAcceso, testo.slice(0, inizio));
  if (nuova === null) return null;
  // con le virgolette tipografiche accese anche gli apostrofi delle sostituzioni («po'») diventano ’
  const testoNuovo = opz.virgolette ? nuova.testo.replace(/'/g, '’') : nuova.testo;
  const da = nuova.conParolaPrima ? inizio - (/(\S+) $/u.exec(testo.slice(0, inizio))?.[0].length ?? 0) : inizio;
  return sostituisciPezzo(st, p, da, fine, testoNuovo);
}

/** Virgoletta tipografica che prende il posto di quella dritta `c`, scritta dopo `prima`. */
export function virgolettaPer(c: '"' | "'", prima: string): string {
  const apre = prima === '' || PRIMA_APERTURA.test(prima.charAt(prima.length - 1));
  if (c === '"') return apre ? '“' : '”';
  return apre ? '‘' : '’';
}

/** Tipo di elenco che parte scrivendo uno spazio dopo `prima` a inizio paragrafo, oppure null. */
export function elencoDa(prima: string): TipoElenco | null {
  if (/^1[.)]$/.test(prima)) return 'n';
  if (/^[-*•]$/.test(prima)) return 'p';
  if (/^\[ ?\]$/.test(prima)) return 't';
  return null;
}

/** Dopo aver scritto il carattere `c` (il cursore è subito dopo): lo stato corretto, oppure null se non c'è niente da correggere. */
export function correggiDopoCarattere(st: Stato, c: string, opz: OpzioniCorrezione, blocAcceso = false): Stato | null {
  if (!collassata(st.sel)) return null;
  const { p, o } = st.sel.fuoco;
  const par = st.doc.paragrafi[p];
  if (!par || o < c.length) return null;
  const testo = testoParagrafo(par);
  if (testo.slice(o - c.length, o) !== c) return null;
  const prima = testo.slice(0, o - c.length);
  if ((c === '"' || c === "'") && opz.virgolette) {
    const nuova = virgolettaPer(c, prima);
    const conVirgoletta = sostituisciPezzo(st, p, o - 1, o, nuova);
    // le virgolette che chiudono finiscono anche la parola: si corregge pure quella («perchè"» → «perché”»)
    if (nuova === '”') return correggiParolaFinoA(conVirgoletta, o - 1, opz, blocAcceso) ?? conVirgoletta;
    return conVirgoletta;
  }
  if (c === '.' && opz.sostituzioni && prima.endsWith('..') && !prima.endsWith('...')) return sostituisciPezzo(st, p, o - 3, o, '…');
  if (c === ' ' && opz.elenchi && par.el === undefined && par.tb === undefined && par.st === undefined) {
    const tipo = elencoDa(prima);
    if (tipo) {
      const pos = { p, o: 0 };
      const tolto = sostituisciPezzo(st, p, 0, o, '');
      return { ...tolto, doc: alternaElenco(tolto.doc, { ancora: pos, fuoco: pos }, tipo), sel: { ancora: pos, fuoco: pos } };
    }
  }
  if (SEPARATORI.has(c)) return correggiParolaFinoA(st, o - 1, opz, blocAcceso);
  return null;
}

/** Prima dell'Invio: corregge la parola che finisce al cursore. */
export function correggiPrimaDiInvio(st: Stato, opz: OpzioniCorrezione, blocAcceso = false): Stato | null {
  if (!collassata(st.sel)) return null;
  const { p, o } = st.sel.fuoco;
  if (!st.doc.paragrafi[p] || o < 1) return null;
  return correggiParolaFinoA(st, o, opz, blocAcceso);
}
