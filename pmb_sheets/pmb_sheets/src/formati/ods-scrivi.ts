// Scrittura di file .ods (OpenDocument, LibreOffice) dal modello di scambio. Puro: restituisce i byte, non tocca il disco.
// Il file ha: mimetype (non compresso, primo), manifest, contenuto (celle, stili, formati numerici, colonne, righe, celle unite) e impostazioni di vista (foglio attivo, blocchi).
// Le formule si scrivono in OpenFormula ("of:=SUM([.A1:.B3])") e SENZA valore in cache: chi apre il file le ricalcola.
// I testi delle celle si leggono come li legge il motore: "=..." formula, TRUE/FALSE booleano, numero con punto decimale, altrimenti testo.
import { scriviZip, type VoceZip } from '@comune/formati/zip';
import { elemento, escapaXml } from '@comune/formati/xml';
import type { BorderDef, CellStyle } from '../sheet/styles';
import { MAX_COLS, MAX_ROWS, parseCellAddress } from '../engine/address';
import type { DataValidationRule } from '../sheet/data-validation';
import type { FoglioScambio, NomeScambio, Scambio } from './scambio';
import { NOME_FOGLIO_PREDEFINITO, foglioVuoto, indirizzoCella } from './scambio';
import { tipoLetterale } from './xlsx-scrivi';
import { t } from '../i18n/lingua';

const NS_UFFICIO = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const NS_STILE = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
const NS_TESTO = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const NS_TABELLA = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const NS_FO = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';
const NS_NUMERO = 'urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0';
const NS_FORMULA = 'urn:oasis:names:tc:opendocument:xmlns:of:1.2';
const NS_CONFIG = 'urn:oasis:names:tc:opendocument:xmlns:config:1.0';
const NS_MANIFEST = 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';
export const TIPO_ODS = 'application/vnd.oasis.opendocument.spreadsheet';
const INTESTAZIONE_XML = '<?xml version="1.0" encoding="UTF-8"?>\n';

const NOME_VIETATO = /[\\/?*[\]:]/g;

/** Nomi dei fogli ammessi: senza \ / ? * [ ] :, senza apostrofi ai bordi, mai vuoti, mai ripetuti (senza badare alle maiuscole). */
export function nomiFoglioOds(nomi: string[]): string[] {
  const usati = new Set<string>();
  return nomi.map((nome, i) => {
    let base = nome.replace(NOME_VIETATO, '_').replace(/^'+|'+$/g, '').trim();
    if (base === '') base = `Foglio${i + 1}`;
    let candidato = base;
    for (let k = 2; usati.has(candidato.toLowerCase()); k++) candidato = `${base} (${k})`;
    usati.add(candidato.toLowerCase());
    return candidato;
  });
}

// ---- formule: dal testo di Fogli a OpenFormula ----
const FUNZIONI_NUOVE = ['MAXIFS', 'MINIFS', 'IFS', 'SWITCH', 'TEXTJOIN', 'CONCAT', 'XLOOKUP', 'XMATCH'];
const RICONOSCI_NUOVE = new RegExp(`(?<![A-Za-z0-9_.])(${FUNZIONI_NUOVE.join('|')})\\(`, 'gi');
const FUORI = '(?<![A-Za-z0-9_.$\'"!])';
const NOME_FOGLIO_RIF = `(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_]*))!`;
const CELLA = '\\$?[A-Za-z]{1,3}\\$?\\d+';
const RIF_CON_FOGLIO = new RegExp(`${FUORI}${NOME_FOGLIO_RIF}(${CELLA})(?::(${CELLA}))?(?![A-Za-z0-9_(])`, 'g');
const RIF_SEMPLICE = new RegExp(`${FUORI}(${CELLA})(?::(${CELLA}))?(?![A-Za-z0-9_(!])`, 'g');
const RIF_COLONNE = new RegExp(`${FUORI}(\\$?[A-Za-z]{1,3}):(\\$?[A-Za-z]{1,3})(?![A-Za-z0-9_(!])`, 'g');
const RIF_RIGHE = new RegExp(`${FUORI}(\\$?\\d+):(\\$?\\d+)(?![A-Za-z0-9_.!])`, 'g');
const LOGICI = /(?<![A-Za-z0-9_.])(TRUE|FALSE)(?![A-Za-z0-9_(])/gi;

function nomeFoglioOds(quotato: string | undefined, semplice: string | undefined): string {
  if (quotato !== undefined) return `'${quotato}'`;
  return semplice as string;
}

function codiceOds(c: string): string {
  let s = c.replace(RIF_CON_FOGLIO, (_t, q: string | undefined, n: string | undefined, a: string, b: string | undefined) => `[$${nomeFoglioOds(q, n)}.${a}${b ? `:.${b}` : ''}]`);
  s = s.replace(RIF_COLONNE, (_t, a: string, b: string) => `[.${a}:.${b}]`);
  s = s.replace(RIF_RIGHE, (_t, a: string, b: string) => `[.${a}:.${b}]`);
  s = s.replace(RIF_SEMPLICE, (_t, a: string, b: string | undefined) => `[.${a}${b ? `:.${b}` : ''}]`);
  s = s.replace(LOGICI, (_t, v: string) => `${v.toUpperCase()}()`);
  s = s.replace(RICONOSCI_NUOVE, (_t, nome: string) => `COM.MICROSOFT.${nome.toUpperCase()}(`);
  let uscita = '';
  let graffe = 0;
  let dentroRif = false;
  for (const ch of s) {
    if (ch === '[') dentroRif = true;
    else if (ch === ']') dentroRif = false;
    if (!dentroRif && ch === '{') graffe++;
    if (!dentroRif && ch === '}') graffe = Math.max(0, graffe - 1);
    if (!dentroRif && ch === ',') uscita += ';';
    else if (!dentroRif && ch === ';' && graffe > 0) uscita += '|';
    else uscita += ch;
  }
  return uscita;
}

/** Formula come va scritta nel file: in OpenFormula, col prefisso "of:=" (fuori dai testi tra virgolette). */
export function formulaPerOds(formula: string): string {
  const senza = formula.startsWith('=') ? formula.slice(1) : formula;
  return `of:=${senza.split(/("(?:[^"]|"")*")/).map((parte, i) => (i % 2 === 1 ? parte : codiceOds(parte))).join('')}`;
}

// ---- formati dei numeri: dal codice di Fogli agli stili dei dati di OpenDocument ----
export type TipoFormatoOds = 'numero' | 'percentuale' | 'valuta' | 'scientifico' | 'data' | 'ora' | 'datora' | 'testo';
export interface FormatoOds { tipo: TipoFormatoOds; xml: (nome: string) => string }

const normalizza = (c: string): string => c.replace(/\[\$€[^\]]*\]/g, '€').replace(/"€"/g, '€');
const numero = (intero: string, decimali: string | undefined, extra = ''): string => elemento('number:number', {
  'number:decimal-places': decimali ? decimali.length : 0,
  'number:min-integer-digits': (intero.match(/0/g) ?? []).length,
  'number:grouping': intero.includes(',') ? 'true' : undefined,
}) + extra;

interface Pezzo { k: 'a4' | 'a2' | 'mese' | 'min' | 'g' | 'gs' | 'o' | 's' | 'ampm' | 'lit'; v: string }

function pezziData(codice: string): Pezzo[] | null {
  if (/[[\]\d]/.test(codice.replace(/"[^"]*"/g, ''))) return null;
  const pezzi: Pezzo[] = [];
  const re = /yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|"([^"]*)"|\\(.)|(.)/gi;
  for (const m of codice.matchAll(re)) {
    const t = m[0].toLowerCase();
    if (m[1] !== undefined) pezzi.push({ k: 'lit', v: m[1] });
    else if (m[2] !== undefined) pezzi.push({ k: 'lit', v: m[2] });
    else if (m[3] !== undefined) pezzi.push({ k: 'lit', v: m[3] });
    else if (t === 'yyyy') pezzi.push({ k: 'a4', v: t });
    else if (t === 'yy') pezzi.push({ k: 'a2', v: t });
    else if (t === 'dddd' || t === 'ddd') pezzi.push({ k: 'gs', v: t });
    else if (t === 'dd' || t === 'd') pezzi.push({ k: 'g', v: t });
    else if (t === 'hh' || t === 'h') pezzi.push({ k: 'o', v: t });
    else if (t === 'ss' || t === 's') pezzi.push({ k: 's', v: t });
    else if (t === 'am/pm') pezzi.push({ k: 'ampm', v: t });
    else pezzi.push({ k: 'mese', v: t });
  }
  // "m" e "mm" sono minuti se vicino a ore o secondi, altrimenti mesi
  const significativi = pezzi.map((p, i) => ({ p, i })).filter((x) => x.p.k !== 'lit');
  significativi.forEach((x, n) => {
    if (x.p.k !== 'mese' || x.p.v.length > 2) return;
    const prima = significativi[n - 1]?.p.k;
    const dopo = significativi[n + 1]?.p.k;
    if (prima === 'o' || dopo === 's') x.p.k = 'min';
  });
  return pezzi.some((p) => p.k !== 'lit') ? pezzi : null;
}

/** Il formato numerico di Fogli come stile dei dati di OpenDocument, o null se non è tra quelli che si sanno scrivere. */
export function formatoOds(codice: string): FormatoOds | null {
  const c = normalizza(codice);
  if (c === '@') return { tipo: 'testo', xml: (n) => elemento('number:text-style', { 'style:name': n }, [elemento('number:text-content')]) };
  const num = /^(€ ?)?([#0,]*0)(?:\.(0+))?( ?€)?$/.exec(c);
  if (num) {
    const [, davanti, intero, decimali, dietro] = num;
    if (davanti === undefined && dietro === undefined) return { tipo: 'numero', xml: (n) => elemento('number:number-style', { 'style:name': n }, [numero(intero, decimali)]) };
    const simbolo = elemento('number:currency-symbol', { 'number:language': 'it', 'number:country': 'IT' }, [escapaXml('€')]);
    const spazio = elemento('number:text', {}, [' ']);
    const corpo = davanti !== undefined
      ? [simbolo, ...(davanti.endsWith(' ') ? [spazio] : []), numero(intero, decimali)]
      : [numero(intero, decimali), ...((dietro as string).startsWith(' ') ? [spazio] : []), simbolo];
    return { tipo: 'valuta', xml: (n) => elemento('number:currency-style', { 'style:name': n }, corpo) };
  }
  const per = /^([#0,]*0)(?:\.(0+))?%$/.exec(c);
  if (per) {
    const [, intero, decimali] = per;
    return { tipo: 'percentuale', xml: (n) => elemento('number:percentage-style', { 'style:name': n }, [numero(intero, decimali), elemento('number:text', {}, ['%'])]) };
  }
  const sci = /^([#0]*0)(?:\.(0+))?E\+(0+)$/.exec(c);
  if (sci) {
    const [, intero, decimali, esponente] = sci;
    return {
      tipo: 'scientifico',
      xml: (n) => elemento('number:number-style', { 'style:name': n }, [elemento('number:scientific-number', {
        'number:decimal-places': decimali ? decimali.length : 0, 'number:min-integer-digits': (intero.match(/0/g) ?? []).length, 'number:min-exponent-digits': esponente.length,
      })]),
    };
  }
  const pezzi = pezziData(c);
  if (!pezzi) return null;
  const haData = pezzi.some((p) => ['a4', 'a2', 'mese', 'g', 'gs'].includes(p.k));
  const haOra = pezzi.some((p) => ['o', 'min', 's', 'ampm'].includes(p.k));
  const figli = pezzi.map((p) => {
    switch (p.k) {
      case 'a4': return elemento('number:year', { 'number:style': 'long' });
      case 'a2': return elemento('number:year');
      case 'mese': return p.v.length >= 3 ? elemento('number:month', { 'number:textual': 'true', 'number:style': p.v.length === 4 ? 'long' : undefined }) : elemento('number:month', { 'number:style': p.v === 'mm' ? 'long' : undefined });
      case 'g': return elemento('number:day', { 'number:style': p.v === 'dd' ? 'long' : undefined });
      case 'gs': return elemento('number:day-of-week', { 'number:style': p.v === 'dddd' ? 'long' : undefined });
      case 'o': return elemento('number:hours', { 'number:style': p.v === 'hh' ? 'long' : undefined });
      case 'min': return elemento('number:minutes', { 'number:style': p.v === 'mm' ? 'long' : undefined });
      case 's': return elemento('number:seconds', { 'number:style': p.v === 'ss' ? 'long' : undefined });
      case 'ampm': return elemento('number:am-pm');
      default: return elemento('number:text', {}, [escapaXml(p.v)]);
    }
  });
  const tipo: TipoFormatoOds = haData && haOra ? 'datora' : haData ? 'data' : 'ora';
  return { tipo, xml: (n) => elemento(haData ? 'number:date-style' : 'number:time-style', { 'style:name': n }, figli) };
}

// ---- date e ore ----
const GIORNO_MS = 86_400_000;
const SERIALE_MASSIMO = 2_958_465;

/** Data (con o senza ora) di un numero seriale, come testo ISO; null se il numero non è una data valida. */
function dataIso(n: number, conOra: boolean): string | null {
  if (!Number.isFinite(n) || n < 0 || n > SERIALE_MASSIMO) return null;
  const iso = new Date(Math.round((n - 25569) * GIORNO_MS)).toISOString();
  return conOra ? iso.slice(0, 19) : iso.slice(0, 10);
}

/** Durata di un numero seriale (giorni), nel formato di OpenDocument ("PT12H30M00S"); null se negativo. */
function durataIso(n: number): string | null {
  if (!Number.isFinite(n) || n < 0 || n > 1e6) return null;
  const totale = Math.round(n * 86400 * 1000) / 1000;
  const ore = Math.floor(totale / 3600);
  const minuti = Math.floor((totale % 3600) / 60);
  const secondi = Math.round((totale % 60) * 1000) / 1000;
  return `PT${ore}H${String(minuti).padStart(2, '0')}M${secondi < 10 ? '0' : ''}${secondi}S`;
}

/** La durata come la mostra un orologio ("12:00:00", "42:30:05"): è il testo visibile della cella. */
function durataTesto(n: number): string {
  const totale = Math.round(n * 86400);
  const due = (v: number): string => (v < 10 ? `0${v}` : String(v));
  return `${due(Math.floor(totale / 3600))}:${due(Math.floor((totale % 3600) / 60))}:${due(totale % 60)}`;
}

// ---- stili ----
const STILI_BORDO: Record<string, string> = { thin: '0.74pt solid', medium: '1.76pt solid', dashed: '0.74pt dashed' };
const colore = (c: string | undefined): string | undefined => (c !== undefined && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : undefined);
const lato = (b: BorderDef | undefined): string | undefined => (b && STILI_BORDO[b.style] ? `${STILI_BORDO[b.style]} ${colore(b.color) ?? '#000000'}` : undefined);

class TabellaStili {
  readonly dati: string[] = [];
  readonly celle: string[] = [];
  readonly colonne: string[] = [];
  readonly righe: string[] = [];
  readonly nonSupportati = new Set<string>();
  private readonly nomiDati = new Map<string, string>();
  private readonly tipiDati = new Map<string, TipoFormatoOds>();
  private readonly nomiCelle = new Map<string, string>();
  private readonly nomiColonne = new Map<string, string>();
  private readonly nomiRighe = new Map<string, string>();

  private formato(codice: string): { nome: string; tipo: TipoFormatoOds } | null {
    const noto = this.nomiDati.get(codice);
    if (noto) return { nome: noto, tipo: this.tipiDati.get(codice) as TipoFormatoOds };
    const f = formatoOds(codice);
    if (!f) { this.nonSupportati.add(codice); return null; }
    const nome = `N${this.dati.length + 1}`;
    this.dati.push(f.xml(nome));
    this.nomiDati.set(codice, nome);
    this.tipiDati.set(codice, f.tipo);
    return { nome, tipo: f.tipo };
  }

  /** Il tipo di formato di una cella (per scrivere numeri, date e ore nel modo giusto). */
  tipoFormato(st: CellStyle): TipoFormatoOds | null {
    return typeof st.numFmt === 'string' && st.numFmt !== '' ? this.formato(st.numFmt)?.tipo ?? null : null;
  }

  /** Nome dello stile di cella per questo stile (lo crea se serve), o undefined se lo stile non cambia niente. */
  nome(st: Readonly<CellStyle>): string | undefined {
    const f = typeof st.numFmt === 'string' && st.numFmt !== '' ? this.formato(st.numFmt) : null;
    const sfondo = colore(st.fill);
    const b = st.borders;
    const cella = elemento('style:table-cell-properties', {
      'fo:background-color': sfondo,
      'fo:border-top': lato(b?.top), 'fo:border-bottom': lato(b?.bottom), 'fo:border-left': lato(b?.left), 'fo:border-right': lato(b?.right),
      'style:vertical-align': st.vAlign === 'top' ? 'top' : st.vAlign === 'middle' ? 'middle' : st.vAlign === 'bottom' ? 'bottom' : undefined,
      'fo:wrap-option': st.wrap ? 'wrap' : undefined,
    });
    const allineamento = st.hAlign === 'left' ? 'start' : st.hAlign === 'right' ? 'end' : st.hAlign === 'center' ? 'center' : undefined;
    const dimensione = typeof st.fontSize === 'number' && Number.isFinite(st.fontSize) && st.fontSize > 0 && st.fontSize <= 409 ? `${st.fontSize}pt` : undefined;
    const testo = elemento('style:text-properties', {
      'fo:font-weight': st.bold ? 'bold' : undefined, 'fo:font-style': st.italic ? 'italic' : undefined,
      'style:text-underline-style': st.underline ? 'solid' : undefined, 'style:text-underline-width': st.underline ? 'auto' : undefined, 'style:text-underline-color': st.underline ? 'font-color' : undefined,
      'style:text-line-through-style': st.strike ? 'solid' : undefined,
      'fo:font-family': typeof st.fontFamily === 'string' && st.fontFamily.trim() !== '' ? st.fontFamily : undefined,
      'fo:font-size': dimensione, 'fo:color': colore(st.color),
    });
    const figli = [cella, ...(allineamento ? [elemento('style:paragraph-properties', { 'fo:text-align': allineamento })] : []), testo].filter((x) => x !== '<style:table-cell-properties/>' && x !== '<style:text-properties/>');
    if (figli.length === 0 && !f) return undefined;
    const xml = (n: string): string => elemento('style:style', { 'style:name': n, 'style:family': 'table-cell', 'style:data-style-name': f?.nome }, figli);
    const chiave = xml('');
    let nome = this.nomiCelle.get(chiave);
    if (!nome) { nome = `ce${this.celle.length + 1}`; this.celle.push(xml(nome)); this.nomiCelle.set(chiave, nome); }
    return nome;
  }

  colonna(larghezzaPx: number | undefined): string | undefined {
    if (larghezzaPx === undefined) return undefined;
    const cm = `${Math.round((larghezzaPx / 96) * 2.54 * 10000) / 10000}cm`;
    let nome = this.nomiColonne.get(cm);
    if (!nome) {
      nome = `co${this.colonne.length + 1}`;
      this.colonne.push(elemento('style:style', { 'style:name': nome, 'style:family': 'table-column' }, [elemento('style:table-column-properties', { 'style:column-width': cm, 'style:use-optimal-column-width': 'false' })]));
      this.nomiColonne.set(cm, nome);
    }
    return nome;
  }

  riga(altezzaPx: number | undefined): string | undefined {
    if (altezzaPx === undefined) return undefined;
    const cm = `${Math.round((altezzaPx / 96) * 2.54 * 10000) / 10000}cm`;
    let nome = this.nomiRighe.get(cm);
    if (!nome) {
      nome = `ro${this.righe.length + 1}`;
      this.righe.push(elemento('style:style', { 'style:name': nome, 'style:family': 'table-row' }, [elemento('style:table-row-properties', { 'style:row-height': cm, 'style:use-optimal-row-height': 'false' })]));
      this.nomiRighe.set(cm, nome);
    }
    return nome;
  }
}

const intero = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const positivo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100000;

/** Stile di una cella: strati Riga < Colonna < Cella, i bordi si fondono lato per lato (come nel documento di Fogli). */
function stileRisolto(f: FoglioScambio, riga: number, colonna: number): CellStyle {
  const r = f.stiliRiga[riga];
  const c = f.stiliColonna[colonna];
  const k = f.stili[indirizzoCella(riga, colonna)];
  const m: CellStyle = { ...r, ...c, ...k };
  if (r?.borders || c?.borders || k?.borders) m.borders = { ...r?.borders, ...c?.borders, ...k?.borders };
  return m;
}

/** Testo di una cella come paragrafi di OpenDocument: a capo, tabulazioni e spazi multipli hanno il loro elemento. */
function paragrafi(testo: string): string[] {
  return testo.replace(/\r\n?/g, '\n').split('\n').map((riga) => {
    const corpo = escapaXml(riga).replace(/\t/g, '<text:tab/>').replace(/ {2,}|^ | $/g, (spazi) => `<text:s text:c="${spazi.length}"/>`);
    return `<text:p>${corpo}</text:p>`;
  });
}

// ---- convalide dei dati ----
const OPERATORE_CONFRONTO: Record<string, string> = { equal_to: '=', not_equal_to: '!=', greater_than: '>', greater_equal: '>=', less_than: '<', less_equal: '<=' };

function valoreCondizione(v: unknown): string | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  const t = String(v).trim();
  return /^[+-]?\d+(\.\d+)?$/.test(t) ? t : `"${t.replace(/"/g, '""')}"`;
}

/** La condizione di una convalida nella forma di OpenDocument ("of:cell-content-is-between(1;10)"), o null se la regola non si sa scrivere. */
export function condizioneConvalida(r: DataValidationRule): string | null {
  const op = r.operator ?? 'between';
  const a = valoreCondizione(r.value1);
  const b = valoreCondizione(r.value2);
  const doppio = op === 'between' || op === 'not_between';
  const confronto = (tra: string, uno: string): string | null => (doppio ? (a && b ? `of:${tra}(${a};${b})` : null) : a && OPERATORE_CONFRONTO[op] ? `of:${uno}${OPERATORE_CONFRONTO[op]}${a}` : null);
  const traNome = op === 'not_between' ? 'cell-content-is-not-between' : 'cell-content-is-between';
  switch (r.type) {
    case 'list': {
      if (r.listItems && r.listItems.length > 0) return `of:cell-content-is-in-list(${r.listItems.map((x) => `"${x.replace(/"/g, '""')}"`).join(';')})`;
      const rif = String(r.value1 ?? '').trim();
      return /^\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?$/.test(rif) ? `of:cell-content-is-in-list(${codiceOds(rif)})` : null;
    }
    case 'checkbox': return 'of:cell-content-is-in-list("TRUE";"FALSE")';
    case 'number': { const c = confronto(traNome, 'cell-content()'); return c && `of:cell-content-is-decimal-number() and ${c}`; }
    case 'date': { const c = confronto(traNome, 'cell-content()'); return c && `of:cell-content-is-date() and ${c}`; }
    case 'text_length': return confronto(op === 'not_between' ? 'cell-content-text-length-is-not-between' : 'cell-content-text-length-is-between', 'cell-content-text-length()');
    case 'custom': { const f = String(r.value1 ?? '').trim().replace(/^=/, ''); return f === '' ? null : `of:is-true-formula(${codiceOds(f)})`; }
    default: return null;
  }
}

/** Le convalide del file: ogni regola diversa ha un nome (val1, val2...) e una voce in `table:content-validations`. */
class Convalide {
  readonly voci: string[] = [];
  private nomi = new Map<string, string | null>();
  nome(regola: DataValidationRule): string | null {
    const { id: _id, ...senzaId } = regola;
    const chiave = JSON.stringify(senzaId);
    if (this.nomi.has(chiave)) return this.nomi.get(chiave) ?? null;
    const condizione = condizioneConvalida(regola);
    if (condizione === null) { this.nomi.set(chiave, null); return null; }
    const nome = `val${this.voci.length + 1}`;
    this.voci.push(elemento('table:content-validation', {
      'table:name': nome, 'table:condition': condizione, 'table:allow-empty-cell': regola.allowEmpty === false ? 'false' : 'true',
      'table:display-list': regola.type === 'list' ? 'unsorted' : undefined, 'table:base-cell-address': '.A1',
    }, [
      ...(regola.helpText ? [elemento('table:help-message', { 'table:display': 'true' }, paragrafi(regola.helpText))] : []),
      elemento('table:error-message', { 'table:message-type': regola.action === 'warn' ? 'warning' : 'stop', 'table:display': 'true' }),
    ]));
    this.nomi.set(chiave, nome);
    return nome;
  }
}

const RIF_NOME_LOCALE = /^([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?$/;
function foglioInRif(nome: string): string { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(nome) ? nome : `'${nome.replace(/'/g, "''")}'`; }

/** I nomi definiti come `table:named-range` ("$Foglio1.$C$2:.$C$4"); quelli di fogli che non esistono più o con riferimenti strani si saltano. */
function nomiDefinitiXml(nomi: NomeScambio[] | undefined, origine: FoglioScambio[], nomiFile: string[]): string[] {
  const voci: string[] = [];
  for (const n of nomi ?? []) {
    const i = origine.findIndex((f) => f.nome === n.foglio);
    const m = RIF_NOME_LOCALE.exec(n.riferimento.replace(/\$/g, ''));
    if (i < 0 || !m || n.nome.trim() === '') continue;
    const f = foglioInRif(nomiFile[i]);
    const primo = `$${m[1].toUpperCase()}$${m[2]}`;
    const intervallo = m[3] ? `$${f}.${primo}:.$${m[3].toUpperCase()}$${m[4]}` : `$${f}.${primo}`;
    voci.push(elemento('table:named-range', { 'table:name': n.nome, 'table:base-cell-address': `$${f}.${primo}`, 'table:cell-range-address': intervallo }));
  }
  return voci.length > 0 ? [elemento('table:named-expressions', {}, voci)] : [];
}

/** Aggiunge il commento (`office:annotation`) subito dentro l'apertura della cella: deve venire prima dei paragrafi. */
function conCommento(xml: string, commento: string): string {
  const fineApertura = xml.indexOf('>');
  if (xml.endsWith('/>') && fineApertura === xml.length - 1) return `${xml.slice(0, -2)}>${commento}</table:table-cell>`;
  return `${xml.slice(0, fineApertura + 1)}${commento}${xml.slice(fineApertura + 1)}`;
}

interface CellaOds { riga: number; colonna: number; testo?: string; stile?: string }

function tabellaXml(nome: string, f: FoglioScambio, stili: TabellaStili, convalide: Convalide): string {
  const celle = new Map<string, CellaOds>();
  const prendi = (r: number, c: number): CellaOds => {
    const k = `${r},${c}`;
    let x = celle.get(k);
    if (!x) { x = { riga: r, colonna: c }; celle.set(k, x); }
    return x;
  };
  for (const [a, testo] of Object.entries(f.celle)) {
    const c = parseCellAddress(a);
    if (c && typeof testo === 'string' && testo !== '' && intero(c.row, 1, MAX_ROWS) && intero(c.col, 1, MAX_COLS)) prendi(c.row, c.col).testo = testo;
  }
  for (const a of Object.keys(f.stili)) {
    const c = parseCellAddress(a);
    if (c && intero(c.row, 1, MAX_ROWS) && intero(c.col, 1, MAX_COLS)) prendi(c.row, c.col);
  }
  const convalidaDi = new Map<string, string>();
  for (const v of f.convalide ?? []) {
    const nomeVal = convalide.nome(v.regola);
    const { startRow, endRow, startCol, endCol } = v.intervallo;
    if (nomeVal === null || !(intero(startRow, 1, MAX_ROWS) && intero(endRow, startRow, MAX_ROWS) && intero(startCol, 1, MAX_COLS) && intero(endCol, startCol, MAX_COLS))) continue;
    for (let r = startRow; r <= endRow && convalidaDi.size < 100000; r++) for (let c = startCol; c <= endCol; c++) { convalidaDi.set(`${r},${c}`, nomeVal); prendi(r, c); }
  }
  const commentoDi = new Map<string, { testo: string; autore?: string }>();
  for (const cm of f.commenti ?? []) {
    if (intero(cm.riga, 1, MAX_ROWS) && intero(cm.colonna, 1, MAX_COLS) && typeof cm.testo === 'string') { commentoDi.set(`${cm.riga},${cm.colonna}`, cm); prendi(cm.riga, cm.colonna); }
  }
  const righeNascoste = new Set((f.righeNascoste ?? []).filter((r) => intero(r, 1, MAX_ROWS)));
  const colonneNascoste = new Set((f.colonneNascoste ?? []).filter((c) => intero(c, 1, MAX_COLS)));
  const unioni = f.unioni.filter((m) => intero(m.startRow, 1, MAX_ROWS) && intero(m.endRow, 1, MAX_ROWS) && intero(m.startCol, 1, MAX_COLS) && intero(m.endCol, 1, MAX_COLS)
    && m.startRow <= m.endRow && m.startCol <= m.endCol && !(m.startRow === m.endRow && m.startCol === m.endCol));
  const coperte = new Set<string>();
  const testaUnione = new Map<string, { righe: number; colonne: number }>();
  for (const m of unioni) {
    if (testaUnione.has(`${m.startRow},${m.startCol}`) || coperte.has(`${m.startRow},${m.startCol}`)) continue;
    testaUnione.set(`${m.startRow},${m.startCol}`, { righe: m.endRow - m.startRow + 1, colonne: m.endCol - m.startCol + 1 });
    prendi(m.startRow, m.startCol);
    for (let r = m.startRow; r <= m.endRow; r++) for (let c = m.startCol; c <= m.endCol; c++) if (r !== m.startRow || c !== m.startCol) { coperte.add(`${r},${c}`); prendi(r, c); }
  }
  const righeUsate = new Set<number>();
  for (const x of celle.values()) righeUsate.add(x.riga);
  for (const k of Object.keys(f.stiliRiga)) if (intero(Number(k), 1, MAX_ROWS)) righeUsate.add(Number(k));
  for (const r of righeNascoste) righeUsate.add(r);
  for (const k of Object.keys(f.altezze)) if (intero(Number(k), 1, MAX_ROWS) && positivo(f.altezze[Number(k)])) righeUsate.add(Number(k));
  let colonneTot = 1;
  for (const x of celle.values()) colonneTot = Math.max(colonneTot, x.colonna);
  for (const k of [...Object.keys(f.larghezze), ...Object.keys(f.stiliColonna)]) if (intero(Number(k), 1, MAX_COLS)) colonneTot = Math.max(colonneTot, Number(k));
  for (const c of colonneNascoste) colonneTot = Math.max(colonneTot, c);

  const cellaXml = (x: CellaOds): string => {
    const st = stileRisolto(f, x.riga, x.colonna);
    const stile = stili.nome(st);
    const k = `${x.riga},${x.colonna}`;
    if (coperte.has(k)) return elemento('table:covered-table-cell', { 'table:style-name': stile });
    const u = testaUnione.get(k);
    const base: Record<string, string | number | undefined> = {
      'table:style-name': stile, 'table:number-columns-spanned': u && u.colonne > 1 ? u.colonne : undefined, 'table:number-rows-spanned': u && u.righe > 1 ? u.righe : undefined,
      'table:content-validation-name': convalidaDi.get(k),
    };
    const cm = commentoDi.get(k);
    if (cm) {
      const annotazione = elemento('office:annotation', {}, [...(cm.autore ? [elemento('dc:creator', {}, [escapaXml(cm.autore)])] : []), ...paragrafi(cm.testo)]);
      return conCommento(cellaSenzaCommento(x, base, st), annotazione);
    }
    return cellaSenzaCommento(x, base, st);
  };

  const cellaSenzaCommento = (x: CellaOds, base: Record<string, string | number | undefined>, st: CellStyle): string => {
    if (x.testo === undefined) return elemento('table:table-cell', base);
    const formato = stili.tipoFormato(st);
    const tipo = st.numFmt === '@' && tipoLetterale(x.testo) !== 'formula' ? 'testo' : tipoLetterale(x.testo);
    if (tipo === 'formula') return elemento('table:table-cell', { ...base, 'table:formula': formulaPerOds(x.testo) });
    if (tipo === 'booleano') {
      const vero = x.testo.trim().toUpperCase() === 'TRUE';
      return elemento('table:table-cell', { ...base, 'office:value-type': 'boolean', 'office:boolean-value': vero ? 'true' : 'false' }, [`<text:p>${vero ? 'TRUE' : 'FALSE'}</text:p>`]);
    }
    if (tipo === 'numero') {
      const n = Number(x.testo.trim());
      const t = String(n);
      if (formato === 'data' || formato === 'datora') {
        const iso = dataIso(n, formato === 'datora' || !Number.isInteger(n));
        if (iso) return elemento('table:table-cell', { ...base, 'office:value-type': 'date', 'office:date-value': iso }, [`<text:p>${iso}</text:p>`]);
      }
      if (formato === 'ora') {
        const d = durataIso(n);
        if (d) return elemento('table:table-cell', { ...base, 'office:value-type': 'time', 'office:time-value': d }, [`<text:p>${durataTesto(n)}</text:p>`]);
      }
      const tipoValore = formato === 'percentuale' ? 'percentage' : formato === 'valuta' ? 'currency' : 'float';
      return elemento('table:table-cell', { ...base, 'office:value-type': tipoValore, 'office:value': t, 'office:currency': tipoValore === 'currency' ? 'EUR' : undefined }, [`<text:p>${t}</text:p>`]);
    }
    return elemento('table:table-cell', { ...base, 'office:value-type': 'string' }, paragrafi(x.testo));
  };

  const colonneXml: string[] = [];
  let c = 1;
  while (c <= colonneTot) {
    const larghezza = positivo(f.larghezze[c]) ? f.larghezze[c] : undefined;
    const stileCol = f.stiliColonna[c] ? stili.nome(f.stiliColonna[c]) : undefined;
    const nascosta = colonneNascoste.has(c);
    let fine = c;
    while (fine + 1 <= colonneTot) {
      const l2 = positivo(f.larghezze[fine + 1]) ? f.larghezze[fine + 1] : undefined;
      const s2 = f.stiliColonna[fine + 1] ? stili.nome(f.stiliColonna[fine + 1]) : undefined;
      if (l2 !== larghezza || s2 !== stileCol || colonneNascoste.has(fine + 1) !== nascosta) break;
      fine++;
    }
    colonneXml.push(elemento('table:table-column', {
      'table:style-name': stili.colonna(larghezza), 'table:number-columns-repeated': fine > c ? fine - c + 1 : undefined, 'table:default-cell-style-name': stileCol,
      'table:visibility': nascosta ? 'collapse' : undefined,
    }));
    c = fine + 1;
  }

  // le celle di ogni riga, raggruppate una volta sola (filtrarle a ogni riga rendeva il salvataggio quadratico)
  const celleTipo = [...celle.values()];
  const cellePerRiga = new Map<number, typeof celleTipo>();
  for (const x of celleTipo) { const l = cellePerRiga.get(x.riga); if (l) l.push(x); else cellePerRiga.set(x.riga, [x]); }
  const righeXml: string[] = [];
  let precedente = 0;
  for (const r of [...righeUsate].sort((a, b) => a - b)) {
    if (r - precedente > 1) righeXml.push(elemento('table:table-row', { 'table:number-rows-repeated': r - precedente - 1 > 1 ? r - precedente - 1 : undefined }, [elemento('table:table-cell')]));
    const delle = (cellePerRiga.get(r) ?? []).slice().sort((a, b) => a.colonna - b.colonna);
    const parti: string[] = [];
    let ultima = 0;
    for (const x of delle) {
      if (x.colonna - ultima > 1) parti.push(elemento('table:table-cell', { 'table:number-columns-repeated': x.colonna - ultima - 1 > 1 ? x.colonna - ultima - 1 : undefined }));
      parti.push(cellaXml(x));
      ultima = x.colonna;
    }
    const stileRiga = f.stiliRiga[r] ? stili.nome(f.stiliRiga[r]) : undefined;
    righeXml.push(elemento('table:table-row', { 'table:style-name': stili.riga(positivo(f.altezze[r]) ? f.altezze[r] : undefined), 'table:default-cell-style-name': stileRiga, 'table:visibility': righeNascoste.has(r) ? 'collapse' : undefined }, parti.length > 0 ? parti : [elemento('table:table-cell')]));
    precedente = r;
  }
  if (righeXml.length === 0) righeXml.push(elemento('table:table-row', {}, [elemento('table:table-cell')]));
  return elemento('table:table', { 'table:name': nome }, [...colonneXml, ...righeXml]);
}

function impostazioniXml(origine: FoglioScambio[], nomi: string[], attivo: string): string {
  const voce = (nome: string, tipo: string, valore: string | number): string => elemento('config:config-item', { 'config:name': nome, 'config:type': tipo }, [String(valore)]);
  const tabelle = origine.map((f, i) => {
    const rc = intero(f.righeCongelate, 0, MAX_ROWS) ? f.righeCongelate : 0;
    const cc = intero(f.colonneCongelate, 0, MAX_COLS) ? f.colonneCongelate : 0;
    return elemento('config:config-item-map-entry', { 'config:name': nomi[i] }, [
      voce('HorizontalSplitMode', 'short', cc > 0 ? 2 : 0), voce('VerticalSplitMode', 'short', rc > 0 ? 2 : 0),
      voce('HorizontalSplitPosition', 'int', cc), voce('VerticalSplitPosition', 'int', rc),
      voce('ActiveSplitRange', 'short', rc > 0 && cc > 0 ? 3 : rc > 0 ? 2 : cc > 0 ? 1 : 2),
      voce('PositionLeft', 'int', 0), voce('PositionRight', 'int', cc), voce('PositionTop', 'int', 0), voce('PositionBottom', 'int', rc),
    ]);
  });
  const vista = elemento('config:config-item-map-entry', {}, [
    voce('ViewId', 'string', 'view1'),
    elemento('config:config-item-map-named', { 'config:name': 'Tables' }, tabelle),
    voce('ActiveTable', 'string', attivo),
  ]);
  return INTESTAZIONE_XML + elemento('office:document-settings', { 'xmlns:office': NS_UFFICIO, 'xmlns:config': NS_CONFIG, 'xmlns:ooo': 'http://openoffice.org/2004/office', 'office:version': '1.3' }, [
    elemento('office:settings', {}, [elemento('config:config-item-set', { 'config:name': 'ooo:view-settings' }, [elemento('config:config-item-map-indexed', { 'config:name': 'Views' }, [vista])])]),
  ]);
}

/** Avvisi per l'utente: fogli rinominati e formati numerici che OpenDocument non conosce (le celle si vedranno col formato Automatico). */
export function avvisiScritturaOds(s: Scambio): string[] {
  const nuovi = nomiFoglioOds(s.fogli.map((f) => f.nome));
  const avvisi: string[] = [];
  s.fogli.forEach((f, i) => {
    if (nuovi[i] !== f.nome) avvisi.push(t("Il foglio «{}» è stato chiamato «{}» nel file perché OpenDocument non ammette quel nome: le formule che lo citano non sono state corrette.", f.nome, nuovi[i]));
  });
  const visti = new Set<string>();
  for (const f of s.fogli) {
    for (const st of [...Object.values(f.stili), ...Object.values(f.stiliRiga), ...Object.values(f.stiliColonna)]) {
      const codice = st.numFmt;
      if (typeof codice === 'string' && codice !== '' && !visti.has(codice) && formatoOds(codice) === null) {
        visti.add(codice);
        avvisi.push(t("Il formato numerico «{}» non è supportato da OpenDocument: le celle si vedranno col formato Automatico.", codice));
      }
    }
  }
  return avvisi;
}

/** Dal modello di scambio ai byte di un file .ods. Stesso contenuto, stessi byte. */
export async function scriviOds(s: Scambio): Promise<Uint8Array> {
  const origine = s.fogli.length > 0 ? s.fogli : [foglioVuoto(NOME_FOGLIO_PREDEFINITO)];
  const nomi = nomiFoglioOds(origine.map((f) => f.nome));
  const indiceAttivo = Math.max(0, origine.findIndex((f) => f.nome === s.foglioAttivo));
  const stili = new TabellaStili();
  const convalide = new Convalide();
  const tabelle = origine.map((f, i) => tabellaXml(nomi[i], f, stili, convalide));
  const contenuto = INTESTAZIONE_XML + elemento('office:document-content', {
    'xmlns:office': NS_UFFICIO, 'xmlns:style': NS_STILE, 'xmlns:text': NS_TESTO, 'xmlns:table': NS_TABELLA, 'xmlns:fo': NS_FO, 'xmlns:number': NS_NUMERO, 'xmlns:of': NS_FORMULA, 'xmlns:dc': 'http://purl.org/dc/elements/1.1/', 'office:version': '1.3',
  }, [
    elemento('office:automatic-styles', {}, [...stili.dati, ...stili.colonne, ...stili.righe, ...stili.celle]),
    elemento('office:body', {}, [elemento('office:spreadsheet', {}, [
      ...(convalide.voci.length > 0 ? [elemento('table:content-validations', {}, convalide.voci)] : []),
      ...tabelle,
      ...nomiDefinitiXml(s.nomi, origine, nomi),
    ])]),
  ]);
  const manifest = INTESTAZIONE_XML + elemento('manifest:manifest', { 'xmlns:manifest': NS_MANIFEST, 'manifest:version': '1.3' }, [
    elemento('manifest:file-entry', { 'manifest:full-path': '/', 'manifest:version': '1.3', 'manifest:media-type': TIPO_ODS }),
    elemento('manifest:file-entry', { 'manifest:full-path': 'content.xml', 'manifest:media-type': 'text/xml' }),
    elemento('manifest:file-entry', { 'manifest:full-path': 'settings.xml', 'manifest:media-type': 'text/xml' }),
  ]);
  const codifica = new TextEncoder();
  const voce = (nome: string, testo: string): VoceZip => ({ nome, dati: codifica.encode(testo) });
  return scriviZip([
    { nome: 'mimetype', dati: codifica.encode(TIPO_ODS), senzaCompressione: true },
    voce('META-INF/manifest.xml', manifest),
    voce('content.xml', contenuto),
    voce('settings.xml', impostazioniXml(origine, nomi, nomi[indiceAttivo])),
  ]);
}
