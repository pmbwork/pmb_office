/**
 * Formati numerici e di data come quelli di Excel e Fogli Google: "0.00", "#,##0", "000", "0.0%", "0.00E+00", "#,##0.00;(#,##0.00)",
 * "dd/mm/yyyy", "dddd d mmmm yyyy", "hh:mm:ss", "h:mm AM/PM", "@".
 * Il codice è sempre scritto nella forma inglese (punto decimale, virgola per le migliaia), come tutte le formule del motore.
 * Modulo puro: niente DOM, niente motore di calcolo.
 */
import { roundDecimalMode } from './functions/utils';

export type LinguaNomi = 'it' | 'en';
let linguaNomi: LinguaNomi = 'en';

/** La lingua dei nomi di mesi e giorni che escono da "mmmm" e "dddd". */
export function impostaLinguaNomi(lingua: LinguaNomi): void { linguaNomi = lingua; }

const MESI = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
};
const MESI_ABB = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
};
const GIORNI = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  it: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
};
const GIORNI_ABB = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  it: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
};

type Pezzo =
  | { t: 'lit'; v: string; crudo?: boolean }
  | { t: 'ph'; c: '0' | '#' | '?' }
  | { t: 'dot' }
  | { t: 'comma' }
  | { t: 'pct' }
  | { t: 'exp'; segno: '+' | '-' }
  | { t: 'data'; v: string }
  | { t: 'testo' };

/** Divide il codice nelle sezioni separate da ";" (fuori dalle virgolette). */
function sezioni(codice: string): string[] {
  const out: string[] = [];
  let corrente = '';
  let virgolette = false;
  for (let i = 0; i < codice.length; i++) {
    const ch = codice[i];
    if (ch === '"') virgolette = !virgolette;
    if (ch === '\\' && i + 1 < codice.length) { corrente += ch + codice[++i]; continue; }
    if (ch === ';' && !virgolette) { out.push(corrente); corrente = ''; continue; }
    corrente += ch;
  }
  out.push(corrente);
  return out;
}

const TOKEN_DATA = /^(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|am\/pm|A\/P|a\/p)/;

/** Quando è vero, «* » (riempi lo spazio che resta) scrive questo segnaposto invece del carattere: serve a dividere il testo in due parti, vedi dividiPerRiempimento. */
let marcaRiempimento = false;
const SEGNAPOSTO_RIEMPIMENTO = '\u0001';

function tokenizza(sez: string): Pezzo[] {
  const pezzi: Pezzo[] = [];
  let i = 0;
  while (i < sez.length) {
    const ch = sez[i];
    if (ch === '"') {
      const fine = sez.indexOf('"', i + 1);
      const testo = sez.slice(i + 1, fine === -1 ? sez.length : fine);
      pezzi.push({ t: 'lit', v: testo });
      i = fine === -1 ? sez.length : fine + 1;
    } else if (ch === '\\' && i + 1 < sez.length) {
      pezzi.push({ t: 'lit', v: sez[i + 1] });
      i += 2;
    } else if (ch === '_' && i + 1 < sez.length) {
      pezzi.push({ t: 'lit', v: ' ' });
      i += 2;
    } else if (ch === '*' && i + 1 < sez.length) {
      // "* " riempie lo spazio che resta in cella: nel testo che esce si scrive una volta sola (o, per dividerlo, un segnaposto)
      pezzi.push({ t: 'lit', v: marcaRiempimento ? SEGNAPOSTO_RIEMPIMENTO : sez[i + 1] });
      i += 2;
    } else if (ch === '[') {
      const fine = sez.indexOf(']', i);
      const dentro = sez.slice(i + 1, fine === -1 ? sez.length : fine);
      const valuta = /^\$([^-\]]*)(?:-.*)?$/.exec(dentro);
      if (/^(h+|m+|s+)$/i.test(dentro)) pezzi.push({ t: 'data', v: `[${dentro}]` }); // ore, minuti o secondi trascorsi: [h]:mm
      else if (valuta) { if (valuta[1] !== '') pezzi.push({ t: 'lit', v: valuta[1] }); } // [$€-410]: il simbolo della valuta
      i = fine === -1 ? sez.length : fine + 1; // [Red], [Blue]...: i colori sono ignorati
    } else if (ch === '0' || ch === '#' || ch === '?') {
      pezzi.push({ t: 'ph', c: ch });
      i++;
    } else if (ch === '.') { pezzi.push({ t: 'dot' }); i++; }
    else if (ch === ',') { pezzi.push({ t: 'comma' }); i++; }
    else if (ch === '%') { pezzi.push({ t: 'pct' }); i++; }
    else if ((ch === 'E' || ch === 'e') && (sez[i + 1] === '+' || sez[i + 1] === '-')) {
      pezzi.push({ t: 'exp', segno: sez[i + 1] as '+' | '-' });
      i += 2;
    } else if (ch === '@') { pezzi.push({ t: 'testo' }); i++; }
    else {
      const m = TOKEN_DATA.exec(sez.slice(i)) ?? TOKEN_DATA.exec(sez.slice(i).toLowerCase());
      if (m && /[a-zA-Z]/.test(ch)) {
        pezzi.push({ t: 'data', v: sez.slice(i, i + m[0].length) });
        i += m[0].length;
      } else {
        pezzi.push({ t: 'lit', v: ch, crudo: true });
        i++;
      }
    }
  }
  return pezzi;
}

/** Come in Excel, fuori dalle virgolette si possono scrivere come testo solo questi caratteri (e le cifre fisse); ogni altra lettera o simbolo rende il formato non valido. */
const LETTERALI_AMMESSI = new Set([' ', '$', '€', '£', '¥', '-', '+', '/', '(', ')', ':', '^', '&', "'", '~', '{', '}', '<', '>', '=']);

/** Vero se il codice è un formato che l'interprete sa scrivere: nessun carattere sconosciuto fuori dalle virgolette e almeno un segnaposto, una data, un testo o un testo fisso. */
export function formatoRiconosciuto(codice: string): boolean {
  const parti = sezioni(codice);
  if (parti.length > 4) return false;
  // virgolette non chiuse o parentesi quadre non chiuse: il formato non è valido (come in Excel)
  for (const sez of parti) {
    let aperte = false;
    for (let i = 0; i < sez.length; i++) {
      if (sez[i] === '\\') { i++; continue; }
      if (sez[i] === '"') aperte = !aperte;
    }
    if (aperte) return false;
    const fuori = sez.replace(/"[^"]*"/g, '');
    if ((fuori.match(/\[/g)?.length ?? 0) !== (fuori.match(/\]/g)?.length ?? 0)) return false;
  }
  return parti.every((sez) => {
    const pezzi = tokenizza(sez);
    if (pezzi.some((p) => p.t === 'lit' && p.crudo && !LETTERALI_AMMESSI.has(p.v) && !/^[0-9]$/.test(p.v))) return false;
    return pezzi.some((p) => p.t === 'ph' || p.t === 'data' || p.t === 'testo' || (p.t === 'lit' && !p.crudo)) || sez.trim() === '';
  });
}

const eData = (pezzi: Pezzo[]) => pezzi.some((p) => p.t === 'data');

/** I separatori dei numeri nel testo che esce: ',' per le migliaia e '.' per i decimali all'inglese, il contrario all'italiana. */
let sepMigliaia = ',';
let sepDecimali = '.';

function raggruppa(cifre: string): string {
  return cifre.replace(/\B(?=(\d{3})+(?!\d))/g, sepMigliaia);
}

/** Un formato con la barra tra segnaposto ("# ?/?", "?/8", "# ??/??"): il numero come frazione, o null se non è un formato a frazione. */
function formattaFrazione(x: number, pezzi: Pezzo[]): string | null {
  const barra = pezzi.findIndex((p, k) => p.t === 'lit' && p.v === '/' && p.crudo && k > 0 && pezzi[k - 1].t === 'ph');
  if (barra < 0) return null;
  // numeratore: i segnaposto attaccati alla barra; la parte intera: i segnaposto prima, separati da un testo (di solito uno spazio)
  let iNum = barra - 1;
  while (iNum > 0 && pezzi[iNum - 1].t === 'ph') iNum--;
  const haIntero = pezzi.slice(0, iNum).some((p) => p.t === 'ph');
  // denominatore: segnaposto (massimo di quante cifre) o cifre fisse (/8, /16)
  let fine = barra + 1;
  let cifreFisse = '';
  let segnaposto = 0;
  while (fine < pezzi.length) {
    const p = pezzi[fine];
    if (p.t === 'ph') segnaposto++;
    else if (p.t === 'lit' && p.crudo && /^\d$/.test(p.v) && segnaposto === 0) cifreFisse += p.v;
    else break;
    fine++;
  }
  if (segnaposto === 0 && cifreFisse === '') return null;
  const intero = haIntero ? Math.floor(x) : 0;
  const resto = x - intero;
  let num = 0;
  let den = 1;
  if (cifreFisse !== '') {
    den = Number(cifreFisse);
    num = Math.round(resto * den);
  } else {
    const massimo = 10 ** segnaposto - 1;
    let errore = Infinity;
    for (let q = 1; q <= massimo; q++) {
      const p = Math.round(resto * q);
      const e = Math.abs(resto - p / q);
      if (e < errore - 1e-12) { errore = e; num = p; den = q; }
      if (e < 1e-12) break;
    }
  }
  let nInt = intero;
  if (num === den) { nInt += haIntero ? 1 : 0; num = haIntero ? 0 : num; }
  const prima = pezzi.slice(0, iNum).map((p) => (p.t === 'lit' ? p.v : p.t === 'ph' ? '' : '')).join('');
  const dopo = pezzi.slice(fine).map((p) => (p.t === 'lit' ? p.v : '')).join('');
  const parteIntera = haIntero && (nInt > 0 || num === 0) ? String(nInt) : '';
  const parteFrazione = num === 0 && haIntero ? '' : `${num}/${den}`;
  const separatore = parteIntera !== '' && parteFrazione !== '' ? prima.trim() === '' ? ' ' : prima : '';
  return parteIntera + separatore + parteFrazione + dopo;
}

/** Numero (valore assoluto) secondo una sezione numerica. */
function formattaCifre(n: number, pezzi: Pezzo[]): string {
  const percento = pezzi.filter((p) => p.t === 'pct').length;
  let valore = n * 100 ** percento;

  // posizione delle virgole: tra segnaposto = migliaia, dopo l'ultimo segnaposto intero = divide per mille
  const idxPunto = pezzi.findIndex((p) => p.t === 'dot');
  const idxEsp = pezzi.findIndex((p) => p.t === 'exp');
  const fineInt = idxPunto >= 0 ? idxPunto : idxEsp >= 0 ? idxEsp : pezzi.length;
  let ultimoPhInt = -1;
  for (let k = 0; k < fineInt; k++) if (pezzi[k].t === 'ph') ultimoPhInt = k;
  let ultimoPhTot = -1;
  const limite = idxEsp >= 0 ? idxEsp : pezzi.length;
  for (let k = 0; k < limite; k++) if (pezzi[k].t === 'ph') ultimoPhTot = k;
  let primoPh = -1;
  for (let k = 0; k < pezzi.length; k++) if (pezzi[k].t === 'ph') { primoPh = k; break; }
  let migliaia = false;
  const rimaste: Pezzo[] = [];
  pezzi.forEach((p, k) => {
    if (p.t === 'comma') {
      if (k > primoPh && primoPh >= 0 && k < ultimoPhInt) { migliaia = true; return; }
      if (k > ultimoPhTot && ultimoPhTot >= 0 && k < limite) { valore /= 1000; return; }
      rimaste.push({ t: 'lit', v: ',' });
      return;
    }
    rimaste.push(p);
  });

  const iPunto = rimaste.findIndex((p) => p.t === 'dot');
  const iEsp = rimaste.findIndex((p) => p.t === 'exp');
  const fineI = iPunto >= 0 ? iPunto : iEsp >= 0 ? iEsp : rimaste.length;
  const intPezzi = rimaste.slice(0, fineI);
  const decPezzi = iPunto >= 0 ? rimaste.slice(iPunto + 1, iEsp >= 0 ? iEsp : rimaste.length) : [];
  const espPezzi = iEsp >= 0 ? rimaste.slice(iEsp) : [];
  const decimali = decPezzi.filter((p) => p.t === 'ph').length;
  const cifreIntere = intPezzi.filter((p) => p.t === 'ph').length;

  let esponente = 0;
  if (iEsp >= 0 && valore !== 0) {
    esponente = Math.floor(Math.log10(valore)) - (Math.max(cifreIntere, 1) - 1);
    valore = valore / 10 ** esponente;
    if (Number(roundDecimalMode(valore, decimali, 'half-away-from-zero').toFixed(decimali).split('.')[0]) >= 10 ** Math.max(cifreIntere, 1)) {
      esponente += 1;
      valore = valore / 10;
    }
  }

  const arrotondato = roundDecimalMode(valore, decimali, 'half-away-from-zero');
  const [parteIntera, parteDecimale = ''] = arrotondato.toFixed(decimali).split('.');
  // solo gli 0 impongono le cifre (con zeri davanti); i ? al posto di una cifra mancante scrivono spazi (più sotto)
  const minimoCifre = intPezzi.filter((p) => p.t === 'ph' && p.c === '0').length;
  let cifre = parteIntera === '0' && minimoCifre === 0 ? '' : parteIntera;
  if (cifre.length < minimoCifre) cifre = cifre.padStart(minimoCifre, '0');

  // parte intera: i segnaposto si riempiono da destra; le cifre in più stanno davanti
  const eIntermedi = intPezzi.some((p, k) => p.t === 'lit' && intPezzi.slice(0, k).some((q) => q.t === 'ph') && intPezzi.slice(k + 1).some((q) => q.t === 'ph'));
  let int = '';
  if (!eIntermedi) {
    let numero = migliaia ? raggruppa(cifre) : cifre;
    // # davanti che non ha cifre non scrive niente; ? al posto di una cifra mancante scrive uno spazio
    const mancanti = intPezzi.filter((p) => p.t === 'ph' && p.c === '?').length - cifre.length;
    if (mancanti > 0) numero = ' '.repeat(mancanti) + numero;
    let messo = false;
    for (const p of intPezzi) {
      if (p.t === 'ph') { if (!messo) { int += numero; messo = true; } } else if (p.t === 'lit') int += p.v;
    }
    if (!messo && numero !== '') int = numero + int;
  } else {
    const resto = cifre.split('');
    const out: string[] = [];
    for (let k = intPezzi.length - 1; k >= 0; k--) {
      const p = intPezzi[k];
      if (p.t === 'ph') {
        const c = resto.pop();
        out.unshift(c !== undefined ? c : p.c === '0' ? '0' : p.c === '?' ? ' ' : '');
      } else if (p.t === 'lit') out.unshift(p.v);
    }
    int = resto.join('') + out.join('');
  }

  // parte decimale
  let dec = '';
  if (decPezzi.length > 0) {
    const cifreDec = parteDecimale.split('');
    let ultimoPieno = -1;
    cifreDec.forEach((c, k) => { if (c !== '0') ultimoPieno = k; });
    let fine = '';
    let d = 0;
    for (const p of decPezzi) {
      if (p.t === 'ph') {
        const c = cifreDec[d] ?? '0';
        const oltre = d > ultimoPieno;
        if (p.c === '0') fine += c;
        else if (oltre) fine += p.c === '?' ? ' ' : '';
        else fine += c;
        d++;
      } else if (p.t === 'lit') fine += p.v;
      else if (p.t === 'pct') fine += '%';
    }
    dec = (decimali > 0 && /[0-9]/.test(fine) ? sepDecimali : '') + fine;
    if (decimali > 0 && !/[0-9]/.test(fine)) dec = fine.trim() === '' ? '' : fine;
  }
  // segni di percentuale e testi fuori dalle parti: nella parte intera
  const pctInInt = intPezzi.filter((p) => p.t === 'pct').length;
  if (pctInInt > 0) int += '%'.repeat(pctInInt);

  let esp = '';
  if (iEsp >= 0) {
    const cifreEsp = espPezzi.filter((p) => p.t === 'ph').length || 2;
    const segno = esponente < 0 ? '-' : (espPezzi[0] as { segno: '+' | '-' }).segno === '+' ? '+' : '';
    esp = `E${segno}${String(Math.abs(esponente)).padStart(cifreEsp, '0')}`;
  }
  return int + dec + esp;
}

function formattaData(serial: number, pezzi: Pezzo[]): string | null {
  const trascorso = pezzi.some((p) => p.t === 'data' && p.v.startsWith('['));
  if (!Number.isFinite(serial) || serial < 0 || (!trascorso && serial > 2958465.999)) return null;
  let giorni = Math.floor(serial);
  let secondi = Math.round((serial - giorni) * 86400);
  if (secondi >= 86400) { secondi -= 86400; giorni += 1; }
  const dt = new Date(Date.UTC(1899, 11, 30) + giorni * 86400000);
  const anno = dt.getUTCFullYear();
  const mese = dt.getUTCMonth();
  const giorno = dt.getUTCDate();
  const giornoSett = dt.getUTCDay();
  const ore = Math.floor(secondi / 3600);
  const minuti = Math.floor((secondi % 3600) / 60);
  const sec = secondi % 60;
  const dodici = pezzi.some((p) => p.t === 'data' && /^(am\/pm|a\/p)$/i.test(p.v));
  const due = (n: number) => String(n).padStart(2, '0');
  const dati = pezzi.filter((p) => p.t === 'data') as Array<{ t: 'data'; v: string }>;

  let out = '';
  pezzi.forEach((p) => {
    if (p.t === 'lit') { out += p.v; return; }
    if (p.t === 'dot') { out += '.'; return; }
    if (p.t === 'comma') { out += ','; return; }
    if (p.t === 'ph') { out += p.c === '0' ? '0' : ''; return; }
    if (p.t !== 'data') { out += p.t === 'pct' ? '%' : ''; return; }
    const v = p.v;
    const minuscolo = v.toLowerCase();
    // "m" e "mm" sono i minuti se vengono subito dopo le ore o subito prima dei secondi
    const k = dati.indexOf(p);
    const eMinuti = (minuscolo === 'm' || minuscolo === 'mm') && ((dati[k - 1] && /^\[?h/i.test(dati[k - 1].v)) || (dati[k + 1] && /^\[?s/i.test(dati[k + 1].v)));
    const totale = Math.round(serial * 86400);
    switch (true) {
      case minuscolo.startsWith('['): {
        const unita = minuscolo[1];
        const n = unita === 'h' ? Math.floor(totale / 3600) : unita === 'm' ? Math.floor(totale / 60) : totale;
        out += String(n).padStart(minuscolo.length - 2, '0');
        break;
      }
      case minuscolo === 'yyyy': out += String(anno).padStart(4, '0'); break;
      case minuscolo === 'yy': out += due(anno % 100); break;
      case eMinuti: out += minuscolo === 'mm' ? due(minuti) : String(minuti); break;
      case minuscolo === 'mmmm': out += MESI[linguaNomi][mese]; break;
      case minuscolo === 'mmm': out += MESI_ABB[linguaNomi][mese]; break;
      case minuscolo === 'mm': out += due(mese + 1); break;
      case minuscolo === 'm': out += String(mese + 1); break;
      case minuscolo === 'dddd': out += GIORNI[linguaNomi][giornoSett]; break;
      case minuscolo === 'ddd': out += GIORNI_ABB[linguaNomi][giornoSett]; break;
      case minuscolo === 'dd': out += due(giorno); break;
      case minuscolo === 'd': out += String(giorno); break;
      case minuscolo === 'hh': out += due(dodici ? ((ore + 11) % 12) + 1 : ore); break;
      case minuscolo === 'h': out += String(dodici ? ((ore + 11) % 12) + 1 : ore); break;
      case minuscolo === 'ss': out += due(sec); break;
      case minuscolo === 's': out += String(sec); break;
      case minuscolo === 'am/pm': out += ore < 12 ? 'AM' : 'PM'; break;
      case minuscolo === 'a/p': out += ore < 12 ? 'A' : 'P'; break;
      default: break;
    }
  });
  return out;
}

interface Condizione { op: '<' | '<=' | '>' | '>=' | '=' | '<>'; valore: number }

/** La condizione di una sezione, per esempio [>=100] o [<0]; null se non ce n'è. */
function condizioneDi(sez: string): Condizione | null {
  const m = /\[\s*(<=|>=|<>|<|>|=)\s*(-?[0-9]+(?:\.[0-9]+)?)\s*\]/.exec(sez);
  return m ? { op: m[1] as Condizione['op'], valore: Number(m[2]) } : null;
}

function vale(c: Condizione, x: number): boolean {
  switch (c.op) {
    case '<': return x < c.valore;
    case '<=': return x <= c.valore;
    case '>': return x > c.valore;
    case '>=': return x >= c.valore;
    case '=': return x === c.valore;
    default: return x !== c.valore;
  }
}

/** Quale sezione del formato vale per il numero, e se il segno meno lo deve scrivere il programma.
 *  Senza condizioni: positivi, negativi, zero (se ci sono tre sezioni). Con condizioni ([>=100]...): la prima sezione la cui condizione è vera,
 *  altrimenti la prima senza condizione (o l'ultima). */
function scegliSezione(valore: number, parti: string[]): { indice: number; automatico: boolean } {
  const negativo = valore < 0;
  const condizioni = parti.slice(0, 2).map(condizioneDi);
  if (condizioni.some((c) => c !== null)) {
    let indice = -1;
    for (let i = 0; i < condizioni.length; i++) if (condizioni[i] && vale(condizioni[i]!, valore)) { indice = i; break; }
    if (indice < 0) indice = parti.findIndex((_s, i) => i >= 2 || condizioni[i] === null);
    if (indice < 0) indice = parti.length - 1;
    const c = indice < 2 ? condizioni[indice] : null;
    // una sezione riservata ai numeri negativi ([<0]) scrive già il suo segno; le altre lasciano il meno automatico
    const riservataAiNegativi = c !== null && (c.op === '<' || c.op === '<=') && c.valore <= 0;
    return { indice, automatico: negativo && !riservataAiNegativi };
  }
  if (parti.length === 1) return { indice: 0, automatico: negativo };
  if (parti.length === 2) return { indice: negativo ? 1 : 0, automatico: false };
  return { indice: negativo ? 1 : valore === 0 ? 2 : 0, automatico: false };
}

const COLORI_FORMATO: Record<string, string> = {
  black: '#000000', blue: '#0000ff', cyan: '#00a0a0', green: '#008000', magenta: '#ff00ff', red: '#d00000', white: '#ffffff', yellow: '#b09000',
};

/** Il colore scritto nel formato per questo numero ([Red], [Blue]...), come colore CSS; null se la sezione che vale non ne ha. */
export function coloreDelFormato(valore: number, codice: string): string | null {
  if (!Number.isFinite(valore)) return null;
  const parti = sezioni(codice);
  const { indice } = scegliSezione(valore, parti);
  const m = /\[\s*(black|blue|cyan|green|magenta|red|white|yellow)\s*\]/i.exec(parti[Math.min(indice, parti.length - 1)]);
  return m ? COLORI_FORMATO[m[1].toLowerCase()] : null;
}

/** Il testo di un numero scritto con il formato dato. null se il valore non si può scrivere con quel formato (data fuori campo). */
export function formattaNumero(valore: number, codice: string, lingua: LinguaNomi = linguaNomi): string | null {
  if (!Number.isFinite(valore)) return null;
  sepMigliaia = lingua === 'it' ? '.' : ',';
  sepDecimali = lingua === 'it' ? ',' : '.';
  const trim = codice.trim();
  if (trim === '' || trim.toLowerCase() === 'general' || trim.toLowerCase() === 'standard') return String(Number(valore.toPrecision(12)));

  const parti = sezioni(codice);
  const { indice, automatico } = scegliSezione(valore, parti);
  const sezione = parti[Math.min(indice, parti.length - 1)];
  const pezzi = tokenizza(sezione);

  if (eData(pezzi)) {
    return formattaData(valore, pezzi);
  }
  // una sezione fatta solo di testo fisso ("alto", "zero") scrive solo quel testo, non il numero
  if (!pezzi.some((p) => p.t === 'ph' || p.t === 'dot' || p.t === 'exp' || p.t === 'pct' || p.t === 'testo')) {
    return pezzi.map((p) => (p.t === 'lit' ? p.v : '')).join('');
  }
  if (pezzi.some((p) => p.t === 'testo') && !pezzi.some((p) => p.t === 'ph')) {
    return pezzi.map((p) => (p.t === 'testo' ? String(Number(valore.toPrecision(12))) : p.t === 'lit' ? p.v : '')).join('');
  }
  const frazione = formattaFrazione(Math.abs(valore), pezzi);
  if (frazione !== null) return (automatico ? '-' : '') + frazione;
  const cifre = formattaCifre(Math.abs(valore), pezzi);
  return (automatico ? '-' : '') + cifre;
}

/**
 * Per i formati con «* » (la contabilità: «€ ····· 1.234,50»): il testo diviso in quello che sta a sinistra (il simbolo) e quello che sta a destra (il numero),
 * perché la cella li allontani come in Excel. null se il formato non riempie niente o il valore non si scrive. Il testo normale (formattaNumero) non cambia.
 */
export function dividiPerRiempimento(valore: number, codice: string, lingua: LinguaNomi = linguaNomi): [string, string] | null {
  if (!codice.includes('*')) return null;
  marcaRiempimento = true;
  try {
    const testo = formattaNumero(valore, codice, lingua);
    if (testo === null) return null;
    const i = testo.indexOf(SEGNAPOSTO_RIEMPIMENTO);
    return i < 0 ? null : [testo.slice(0, i), testo.slice(i + 1)];
  } finally {
    marcaRiempimento = false;
  }
}

/** Il testo di un valore di testo secondo l'eventuale sezione dei testi del formato ("@" o quarta sezione); null se il formato non ha una parte per i testi. */
export function formattaTesto(testo: string, codice: string): string | null {
  const parti = sezioni(codice);
  const sez = parti.length >= 4 ? parti[3] : parti.length === 1 && codice.includes('@') ? parti[0] : null;
  if (sez === null) return null;
  return tokenizza(sez).map((p) => (p.t === 'testo' ? testo : p.t === 'lit' ? p.v : '')).join('');
}
