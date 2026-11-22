// Lettura di file .ods (OpenDocument, LibreOffice) nel modello di scambio. Puro: riceve i byte, non tocca il disco.
// Valori: numeri, percentuali e valute restano numeri; date e ore diventano numeri seriali col loro formato; i testi che sembrano numeri o
// booleani ricevono il formato Testo per restare testi; le formule si importano col nome inglese e senza valore in cache.
// Si importano anche righe e colonne nascoste, commenti, convalide dei dati, nomi definiti semplici e formattazioni condizionali (forma di LibreOffice).
// Non si importano: grafici, immagini, tabelle pivot, nomi complessi, formattazioni condizionali di tipi che il foglio non ha (avvisi).
import { impronteValide } from '@comune/protezione/impronte';
import type { ProtezioneFoglio } from '../sheet/protezione';
import { leggiZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, testoXml, trova, type NodoXml } from '@comune/formati/xml';
import type { BorderSet, CellStyle } from '../sheet/styles';
import { MAX_COLS, MAX_ROWS } from '../engine/address';
import type { DataValidationRule } from '../sheet/data-validation';
import type { CommentoScambio, ConvalidaScambio, FoglioScambio, NomeScambio, Scambio } from './scambio';
import { leggiArea } from './xlsx-extra';
import { NOME_FOGLIO_PREDEFINITO, foglioVuoto, indirizzoCella } from './scambio';
import { tipoLetterale } from './xlsx-scrivi';
import { TIPO_ODS } from './ods-scrivi';
import { coloriDegliStiliTabella, leggiMastri, mastriDegliStiliTabella, paginaDellaTabella, stiliTabellaNascosti } from './ods-pagina';
import { leggiCondizionaliOds } from './ods-condizionali';
import type { ConditionalFormatRule } from '../sheet/conditional-format';

const TIPO_ODS_MODELLO = 'application/vnd.oasis.opendocument.spreadsheet-template';
import { t } from '../i18n/lingua';

/** La chiave della protezione ODF: base64 dell'impronta della password (SHA-1 di serie, SHA-256 se lo dice l'attributo). */
function protezioneDaOds(a: Record<string, string>): ProtezioneFoglio {
  const chiave = a['table:protection-key'];
  if (!chiave) return {};
  const metodo = a['table:protection-key-digest-algorithm'] ?? 'http://www.w3.org/2000/09/xmldsig#sha1';
  const alg = /sha256$/.test(metodo) ? 'SHA-256' : /sha1$/.test(metodo) ? 'SHA-1' : null;
  const impronte = alg ? impronteValide([{ alg, hash: chiave }]) : undefined;
  return impronte ? { impronte } : {};
}

export interface RisultatoOds { scambio: Scambio; avvisi: string[] }

const MAX_RIPETIZIONI_VUOTE = 1000;
const DECODIFICA = new TextDecoder();

const elenco = (n: NodoXml | undefined, nome: string): NodoXml[] => (n ? figliElemento(n, nome) : []);
const vuoto = (s: CellStyle | undefined): boolean => s === undefined || Object.keys(s).length === 0;
const copia = (s: CellStyle): CellStyle => JSON.parse(JSON.stringify(s)) as CellStyle;
const intero = (v: number, min: number, max: number): boolean => Number.isInteger(v) && v >= min && v <= max;
const ripetizioni = (n: NodoXml, nome: string): number => { const v = Number(n.attributi[nome] ?? 1); return Number.isInteger(v) && v >= 1 ? v : 1; };

/** Elementi di certi nomi, anche dentro i gruppi (per esempio le righe di intestazione), nell'ordine del file. */
function raccogli(nodo: NodoXml | undefined, nomi: string[], gruppi: string[]): NodoXml[] {
  const fuori: NodoXml[] = [];
  for (const f of nodo?.figli ?? []) {
    if (typeof f === 'string') continue;
    if (nomi.includes(f.nome)) fuori.push(f);
    else if (gruppi.includes(f.nome)) fuori.push(...raccogli(f, nomi, gruppi));
  }
  return fuori;
}

/** Raggruppa e struttura: per ogni riga (o colonna) il numero di table:table-row-group (o -column-group) che la contengono. */
function livelliDeiGruppi(nodo: NodoXml | undefined, gruppo: string, altri: string[], livello = 0, fuori = new Map<NodoXml, number>()): Map<NodoXml, number> {
  for (const f of nodo?.figli ?? []) {
    if (typeof f === 'string') continue;
    if (f.nome === gruppo) livelliDeiGruppi(f, gruppo, altri, livello + 1, fuori);
    else if (altri.includes(f.nome)) livelliDeiGruppi(f, gruppo, altri, livello, fuori);
    else if (livello > 0) fuori.set(f, Math.min(7, livello));
  }
  return fuori;
}

function esiste(nodo: NodoXml, condizione: (n: NodoXml) => boolean): boolean {
  if (condizione(nodo)) return true;
  return nodo.figli.some((f) => typeof f !== 'string' && esiste(f, condizione));
}

// ---- lunghezze ----
function pixelGrezzi(valore: string | undefined): number | undefined {
  const m = /^(-?\d*\.?\d+)(cm|mm|in|pt|px)$/.exec((valore ?? '').trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2] === 'cm' ? (n * 96) / 2.54 : m[2] === 'mm' ? (n * 96) / 25.4 : m[2] === 'in' ? n * 96 : m[2] === 'pt' ? (n * 96) / 72 : n;
}
function lunghezzaPx(valore: string | undefined): number | undefined {
  const px = pixelGrezzi(valore);
  return px === undefined ? undefined : Math.round(px);
}
function lunghezzaPt(valore: string | undefined): number | undefined {
  const px = pixelGrezzi(valore);
  return px === undefined ? undefined : (px * 72) / 96;
}

// ---- formule: da OpenFormula al testo di Fogli ----
const PARTE_RIF = "(?:\\$?(?:'((?:[^']|'')+)'|([^.'\\]\\s]+)))?\\.(\\$?[A-Za-z]{1,3}\\$?\\d+|\\$?[A-Za-z]{1,3}|\\$?\\d+)";
const RIF_ODS = new RegExp(`^${PARTE_RIF}(?::${PARTE_RIF})?$`);
const nomeFoglioCitato = (nome: string): string => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nome) ? nome : `'${nome.replace(/'/g, "''")}'`);

/** OpenFormula → Excel per le funzioni con un nome diverso (provate su LibreOffice installato, 2026-11-20). */
const NOMI_STANDARD_ODS: Record<string, string> = { FDIST: 'F.DIST', FINV: 'F.INV', SKEWP: 'SKEW.P', B: 'BINOM.DIST.RANGE' };

function codiceFogli(c: string): string {
  let s = c.replace(/\[([^\]]*)\]/g, (tutto, dentro: string) => {
    const m = RIF_ODS.exec(dentro);
    if (!m) return tutto;
    const foglio = m[1] !== undefined ? nomeFoglioCitato(m[1].replace(/''/g, "'")) : m[2] !== undefined ? nomeFoglioCitato(m[2]) : '';
    return `${foglio ? `${foglio}!` : ''}${m[3]}${m[6] !== undefined ? `:${m[6]}` : ''}`;
  });
  let uscita = '';
  let graffe = 0;
  for (const ch of s) {
    if (ch === '{') graffe++;
    if (ch === '}') graffe = Math.max(0, graffe - 1);
    if (ch === ';') uscita += ',';
    else if (ch === '|' && graffe > 0) uscita += ';';
    else uscita += ch;
  }
  s = uscita.replace(/(?<![A-Za-z0-9_.])(?:COM\.MICROSOFT|ORG\.OPENOFFICE|ORG\.LIBREOFFICE)\./gi, '');
  // nomi dello standard diversi da quelli di Excel (prima di togliere LEGACY.: LEGACY.FDIST è la vecchia FDIST di Excel, FDIST è F.DIST)
  s = s.replace(/(?<![A-Za-z0-9_.])(FDIST|FINV|SKEWP|B)\(/gi, (_t, n: string) => `${NOMI_STANDARD_ODS[n.toUpperCase()]}(`);
  s = s.replace(/(?<![A-Za-z0-9_.])LEGACY\.(?=[A-Za-z])/gi, '');
  return s.replace(/(?<![A-Za-z0-9_.])(TRUE|FALSE)\(\)/gi, (_t, v: string) => v.toUpperCase());
}

/** Formula di OpenFormula ("of:=SUM([.A1:.B3])") come si scrive in Fogli ("=SUM(A1:B3)"). */
export function formulaDaOds(formula: string): string {
  const senza = formula.replace(/^(?:of:)?=/, '');
  return `=${senza.split(/("(?:[^"]|"")*")/).map((parte, i) => (i % 2 === 1 ? parte : codiceFogli(parte))).join('')}`;
}

// ---- stili ----
const LATI_BORDO = ['top', 'right', 'bottom', 'left'] as const;
const STILI_TRATTEGGIATI = ['dashed', 'dotted'];

function bordo(valore: string | undefined): { style: 'thin' | 'medium' | 'dashed'; color: string } | null | undefined {
  if (valore === undefined) return undefined;
  const parti = valore.trim().split(/\s+/);
  const stile = parti.find((p) => ['none', 'hidden', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'].includes(p));
  if (!stile || stile === 'none' || stile === 'hidden') return null;
  const spessore = lunghezzaPt(parti.find((p) => /^-?\d*\.?\d+(cm|mm|in|pt|px)$/.test(p))) ?? 0.74;
  const colore = parti.find((p) => /^#[0-9a-fA-F]{6}$/.test(p));
  const style = STILI_TRATTEGGIATI.includes(stile) ? 'dashed' : stile === 'solid' && spessore >= 1.5 ? 'medium' : 'thin';
  return { style, color: colore ? colore.toLowerCase() : '#000000' };
}

function unisci(base: CellStyle, sopra: CellStyle): CellStyle {
  const m: CellStyle = { ...base, ...sopra };
  if (base.borders || sopra.borders) m.borders = { ...base.borders, ...sopra.borders };
  return m;
}

interface StileOds { genitore?: string; dati?: string; proprieta: CellStyle }

function proprieta(stile: NodoXml): CellStyle {
  const s: CellStyle = {};
  const cella = trova(stile, 'style:table-cell-properties');
  if (cella) {
    const sfondo = cella.attributi['fo:background-color'];
    if (sfondo !== undefined && /^#[0-9a-fA-F]{6}$/.test(sfondo)) s.fill = sfondo.toLowerCase();
    const lati: BorderSet = {};
    const tutti = bordo(cella.attributi['fo:border']);
    for (const l of LATI_BORDO) {
      const b = bordo(cella.attributi[`fo:border-${l}`]);
      const effettivo = b === undefined ? tutti : b;
      if (effettivo) lati[l] = effettivo;
    }
    if (Object.keys(lati).length > 0) s.borders = lati;
    const v = cella.attributi['style:vertical-align'];
    if (v === 'top' || v === 'middle' || v === 'bottom') s.vAlign = v;
    if (cella.attributi['fo:wrap-option'] === 'wrap') s.wrap = true;
    const protezione = cella.attributi['style:cell-protect'];
    if (protezione !== undefined) {
      const parti = protezione.split(/\s+/);
      if (parti.includes('none') || (parti.includes('formula-hidden') && !parti.includes('protected'))) s.sbloccata = true;
      if (parti.includes('formula-hidden') || parti.includes('hidden-and-protected')) s.formulaNascosta = true;
    }
  }
  const paragrafo = trova(stile, 'style:paragraph-properties');
  const allineamento = paragrafo?.attributi['fo:text-align'];
  if (allineamento === 'start' || allineamento === 'left') s.hAlign = 'left';
  else if (allineamento === 'end' || allineamento === 'right') s.hAlign = 'right';
  else if (allineamento === 'center') s.hAlign = 'center';
  const testo = trova(stile, 'style:text-properties');
  if (testo) {
    const peso = testo.attributi['fo:font-weight'];
    if (peso === 'bold' || (peso !== undefined && Number(peso) >= 600)) s.bold = true;
    const corsivo = testo.attributi['fo:font-style'];
    if (corsivo === 'italic' || corsivo === 'oblique') s.italic = true;
    const sottolineato = testo.attributi['style:text-underline-style'];
    if (sottolineato !== undefined && sottolineato !== 'none') s.underline = true;
    const barrato = testo.attributi['style:text-line-through-style'];
    if (barrato !== undefined && barrato !== 'none') s.strike = true;
    const famiglia = (testo.attributi['fo:font-family'] ?? testo.attributi['style:font-name'] ?? '').replace(/^['"]|['"]$/g, '').trim();
    if (famiglia !== '') s.fontFamily = famiglia;
    const dimensione = /^(\d*\.?\d+)pt$/.exec(testo.attributi['fo:font-size'] ?? '');
    if (dimensione && Number(dimensione[1]) > 0) s.fontSize = Number(dimensione[1]);
    const c = testo.attributi['fo:color'];
    if (c !== undefined && /^#[0-9a-fA-F]{6}$/.test(c)) s.color = c.toLowerCase();
  }
  return s;
}

// ---- formati numerici ----
const letterale = (testo: string): string => {
  const pulito = testo.replace(/"/g, '');
  return /[A-Za-z]/.test(pulito) ? `"${pulito}"` : pulito;
};

function parteNumero(n: NodoXml): string {
  const decimali = Number(n.attributi['number:decimal-places'] ?? 0);
  const minimo = Math.max(1, Number(n.attributi['number:min-integer-digits'] ?? 1));
  const intera = n.attributi['number:grouping'] === 'true' ? '#,##0' : '0'.repeat(minimo);
  return decimali > 0 ? `${intera}.${'0'.repeat(decimali)}` : intera;
}

/** Codice di formato di Fogli per uno stile dei dati di OpenDocument; '' se non si sa tradurre o se è il formato Automatico (un numero senza cifre decimali dichiarate, come lo scrive LibreOffice). */
function codiceDati(stile: NodoXml): string {
  const figliNodo = stile.figli.filter((f): f is NodoXml => typeof f !== 'string');
  if (stile.nome === 'number:number-style' && figliNodo.length === 1 && figliNodo[0].nome === 'number:number' && figliNodo[0].attributi['number:decimal-places'] === undefined) return '';
  const lungo = (n: NodoXml): boolean => n.attributi['number:style'] === 'long';
  const pezzi = stile.figli.filter((f): f is NodoXml => typeof f !== 'string').map((f) => {
    switch (f.nome) {
      case 'number:number': return parteNumero(f);
      case 'number:scientific-number': {
        const esponente = Math.max(1, Number(f.attributi['number:min-exponent-digits'] ?? 2));
        return `${parteNumero(f)}E+${'0'.repeat(esponente)}`;
      }
      case 'number:currency-symbol': return testoXml(f);
      case 'number:text': return letterale(testoXml(f));
      case 'number:text-content': return '@';
      case 'number:year': return lungo(f) ? 'yyyy' : 'yy';
      case 'number:month': return f.attributi['number:textual'] === 'true' ? (lungo(f) ? 'mmmm' : 'mmm') : lungo(f) ? 'mm' : 'm';
      case 'number:day': return lungo(f) ? 'dd' : 'd';
      case 'number:day-of-week': return lungo(f) ? 'dddd' : 'ddd';
      case 'number:hours': return lungo(f) ? 'hh' : 'h';
      case 'number:minutes': return lungo(f) ? 'mm' : 'm';
      case 'number:seconds': return lungo(f) ? 'ss' : 's';
      case 'number:am-pm': return 'AM/PM';
      default: return '';
    }
  });
  if (stile.nome === 'number:boolean-style') return '';
  return pezzi.join('');
}

// ---- date e ore ----
const GIORNO_MS = 86_400_000;
const ZERO_PREDEFINITO = Date.UTC(1899, 11, 30);
const arrotonda = (n: number): string => String(Number(n.toPrecision(12)));

function serialeDaData(valore: string): string | null {
  const m = /^(-?\d{4,})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?))?/.exec(valore.trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), 0, 0) + Math.round(Number(m[6] ?? 0) * 1000);
  return Number.isFinite(ms) ? arrotonda((ms - ZERO_PREDEFINITO) / GIORNO_MS) : null;
}

function serialeDaDurata(valore: string): string | null {
  const m = /^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(valore.trim());
  if (!m || m[1] !== undefined) return null;
  const secondi = Number(m[4] ?? 0) * 86400 + Number(m[5] ?? 0) * 3600 + Number(m[6] ?? 0) * 60 + Number(m[7] ?? 0);
  return arrotonda(secondi / 86400);
}

// ---- testo delle celle ----
function testoParagrafo(n: NodoXml): string {
  let s = '';
  for (const f of n.figli) {
    if (typeof f === 'string') { s += f.replace(/[ \t\r\n]+/g, ' '); continue; }
    if (f.nome === 'text:s') s += ' '.repeat(Math.max(1, Number(f.attributi['text:c'] ?? 1)));
    else if (f.nome === 'text:tab') s += '\t';
    else if (f.nome === 'text:line-break') s += '\n';
    else if (f.nome === 'text:span' || f.nome === 'text:a') s += testoParagrafo(f);
  }
  return s;
}
const testoCella = (c: NodoXml): string => c.figli.filter((f): f is NodoXml => typeof f !== 'string' && (f.nome === 'text:p' || f.nome === 'text:h')).map(testoParagrafo).join('\n');

// ---- impostazioni di vista ----
function trovaTutti(n: NodoXml, condizione: (x: NodoXml) => boolean, fuori: NodoXml[] = []): NodoXml[] {
  if (condizione(n)) fuori.push(n);
  for (const f of n.figli) if (typeof f !== 'string') trovaTutti(f, condizione, fuori);
  return fuori;
}

interface Impostazioni { attivo?: string; blocchi: Map<string, { righe: number; colonne: number }> }

function leggiImpostazioni(x: NodoXml | undefined): Impostazioni {
  const risultato: Impostazioni = { blocchi: new Map() };
  if (!x) return risultato;
  const voci = (n: NodoXml): Map<string, string> => new Map(elenco(n, 'config:config-item').map((v) => [v.attributi['config:name'] ?? '', testoXml(v).trim()]));
  const attivo = trovaTutti(x, (n) => n.nome === 'config:config-item' && n.attributi['config:name'] === 'ActiveTable')[0];
  if (attivo) risultato.attivo = testoXml(attivo).trim();
  for (const tabelle of trovaTutti(x, (n) => n.nome === 'config:config-item-map-named' && n.attributi['config:name'] === 'Tables')) {
    for (const t of elenco(tabelle, 'config:config-item-map-entry')) {
      const v = voci(t);
      const colonne = v.get('HorizontalSplitMode') === '2' ? Number(v.get('HorizontalSplitPosition') ?? 0) : 0;
      const righe = v.get('VerticalSplitMode') === '2' ? Number(v.get('VerticalSplitPosition') ?? 0) : 0;
      risultato.blocchi.set(t.attributi['config:name'] ?? '', { righe: intero(righe, 0, MAX_ROWS) ? righe : 0, colonne: intero(colonne, 0, MAX_COLS) ? colonne : 0 });
    }
  }
  return risultato;
}

// ---- convalide, commenti, nomi ----
/** Divide gli argomenti di una condizione (separati da ; o ,) senza spezzare i testi tra virgolette né i riferimenti tra parentesi. */
function dividiArgomenti(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let virgolette = false;
  let profondita = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      if (virgolette && s[i + 1] === '"') { cur += '""'; i++; continue; }
      virgolette = !virgolette;
      cur += ch;
      continue;
    }
    if (!virgolette) {
      if (ch === '(' || ch === '[') profondita++;
      if (ch === ')' || ch === ']') profondita--;
      if ((ch === ';' || ch === ',') && profondita === 0) { out.push(cur.trim()); cur = ''; continue; }
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter((x) => x !== '');
}

function valoreCondizione(t: string): string | number {
  if (/^"[\s\S]*"$/.test(t)) return t.slice(1, -1).replace(/""/g, '"');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : t;
}

const OPERATORE_DA_ODS: Record<string, string> = { '=': 'equal_to', '!=': 'not_equal_to', '<>': 'not_equal_to', '>': 'greater_than', '>=': 'greater_equal', '<': 'less_than', '<=': 'less_equal' };

/** Dalla condizione di una convalida di OpenDocument alla regola del foglio, o null se non è una delle forme conosciute. */
export function condizioneDaOds(condizione: string): Partial<DataValidationRule> | null {
  const c = condizione.replace(/\bof:/g, '').trim();
  let m = /^cell-content-is-in-list\(([\s\S]*)\)$/.exec(c);
  if (m) {
    const args = dividiArgomenti(m[1]);
    if (args.length === 1 && /^\[\.\$?[A-Za-z]{1,3}\$?\d+(:\.\$?[A-Za-z]{1,3}\$?\d+)?\]$/.test(args[0])) return { type: 'list', value1: args[0].replace(/[[\]$.]/g, '') };
    if (args.length === 0) return null;
    return { type: 'list', listItems: args.map((a) => String(valoreCondizione(a))) };
  }
  m = /^is-true-formula\(([\s\S]*)\)$/.exec(c);
  if (m) return { type: 'custom', value1: formulaDaOds(`of:=${m[1]}`) };
  m = /^cell-content-text-length-is-(not-)?between\(([\s\S]*)\)$/.exec(c);
  if (m) {
    const a = dividiArgomenti(m[2]);
    return a.length === 2 ? { type: 'text_length', operator: m[1] ? 'not_between' : 'between', value1: valoreCondizione(a[0]), value2: valoreCondizione(a[1]) } : null;
  }
  m = /^cell-content-text-length\(\)\s*(>=|<=|!=|<>|=|>|<)\s*([\s\S]+)$/.exec(c);
  if (m) return { type: 'text_length', operator: OPERATORE_DA_ODS[m[1]] as DataValidationRule['operator'], value1: valoreCondizione(m[2].trim()) };
  m = /^cell-content-is-(?:whole-number|decimal-number|date)\(\)\s+and\s+([\s\S]+)$/.exec(c);
  if (m) {
    const tipo = /is-date\(\)/.test(c) ? 'date' : 'number';
    const resto = m[1].trim();
    const tra = /^cell-content-is-(not-)?between\(([\s\S]*)\)$/.exec(resto);
    if (tra) {
      const a = dividiArgomenti(tra[2]);
      return a.length === 2 ? { type: tipo, operator: tra[1] ? 'not_between' : 'between', value1: valoreCondizione(a[0]), value2: valoreCondizione(a[1]) } : null;
    }
    const conf = /^cell-content\(\)\s*(>=|<=|!=|<>|=|>|<)\s*([\s\S]+)$/.exec(resto);
    return conf ? { type: tipo, operator: OPERATORE_DA_ODS[conf[1]] as DataValidationRule['operator'], value1: valoreCondizione(conf[2].trim()) } : null;
  }
  return null;
}

/** Le convalide definite nel file, per nome. Quelle con una condizione che non si conosce non si importano e si contano. */
function leggiConvalideOds(foglio: NodoXml): { regole: Map<string, DataValidationRule>; nonImportate: number } {
  const regole = new Map<string, DataValidationRule>();
  let nonImportate = 0;
  for (const v of elenco(trova(foglio, 'table:content-validations'), 'table:content-validation')) {
    const nome = v.attributi['table:name'];
    const base = nome !== undefined ? condizioneDaOds(v.attributi['table:condition'] ?? '') : null;
    if (nome === undefined || !base) { nonImportate++; continue; }
    const aiuto = trova(v, 'table:help-message');
    const errore = trova(v, 'table:error-message');
    const testoAiuto = aiuto ? elenco(aiuto, 'text:p').map(testoParagrafo).join('\n').trim() : '';
    regole.set(nome, {
      id: '', action: errore?.attributi['table:message-type'] === 'stop' || errore === undefined ? 'reject' : 'warn', ...base,
      ...(v.attributi['table:allow-empty-cell'] === 'false' ? { allowEmpty: false } : {}),
      ...(testoAiuto !== '' ? { helpText: testoAiuto } : {}),
    } as DataValidationRule);
  }
  return { regole, nonImportate };
}

/** Il commento di una cella (`office:annotation`), se c'è. */
function commentoDi(cella: NodoXml): { testo: string; autore?: string } | null {
  const a = elenco(cella, 'office:annotation')[0];
  if (!a) return null;
  const testo = elenco(a, 'text:p').map(testoParagrafo).join('\n');
  if (testo.trim() === '') return null;
  const autore = trova(a, 'dc:creator');
  const nomeAutore = autore ? testoXml(autore).trim() : '';
  return { testo, ...(nomeAutore !== '' ? { autore: nomeAutore } : {}) };
}

const RIF_NOME_ODS = /^\$?(?:'((?:[^']|'')+)'|([^.'$]+))\.\$?([A-Za-z]{1,3})\$?(\d+)(?::(?:\$?(?:'(?:[^']|'')+'|[^.'$]+))?\.\$?([A-Za-z]{1,3})\$?(\d+))?$/;

/** I nomi definiti semplici (un intervallo di un foglio del file); gli altri restano fuori e si contano. */
function leggiNomiOds(foglio: NodoXml, nomiFoglio: string[]): { nomi: NomeScambio[]; nonImportati: number } {
  const nomi: NomeScambio[] = [];
  let nonImportati = 0;
  const gruppo = trova(foglio, 'table:named-expressions');
  nonImportati += elenco(gruppo, 'table:named-expression').length;
  // i nomi locali a un foglio (dentro `table:table`) non si importano: il documento ha solo nomi per tutto il file
  for (const tabella of elenco(foglio, 'table:table')) {
    const locali = elenco(tabella, 'table:named-expressions')[0];
    nonImportati += elenco(locali, 'table:named-range').length + elenco(locali, 'table:named-expression').length;
  }
  for (const n of elenco(gruppo, 'table:named-range')) {
    const nome = n.attributi['table:name'] ?? '';
    const m = RIF_NOME_ODS.exec(n.attributi['table:cell-range-address'] ?? '');
    const nomeFoglio = m ? (m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]) : undefined;
    const riferimento = m ? `${m[3].toUpperCase()}${m[4]}${m[5] ? `:${m[5].toUpperCase()}${m[6]}` : ''}` : '';
    if (!m || nomeFoglio === undefined || !nomiFoglio.includes(nomeFoglio) || leggiArea(riferimento) === null || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nome)) { nonImportati++; continue; }
    nomi.push({ nome, foglio: nomeFoglio, riferimento });
  }
  return { nomi, nonImportati };
}

interface Contesto {
  convalide: Map<string, DataValidationRule>;
  stili: Map<string, StileOds>;
  /** nome visibile (style:display-name) → nome dello stile: le condizioni di LibreOffice citano il nome visibile */
  nomiVisibili: Map<string, string>;
  dati: Map<string, string>;
  colonne: Map<string, number>;
  righe: Map<string, number>;
  base: CellStyle;
}

/** Stile completo di una cella: le proprietà del genitore sotto quelle dello stile, il formato dai dati, il carattere solo se diverso dallo stile Default. */
function risolvi(nome: string | undefined, c: Contesto): CellStyle {
  if (nome === undefined) return {};
  const catena: StileOds[] = [];
  const visti = new Set<string>();
  for (let n: string | undefined = nome; n !== undefined && !visti.has(n) && catena.length < 20; ) {
    visti.add(n);
    const s = c.stili.get(n);
    if (!s) break;
    catena.unshift(s);
    n = s.genitore;
  }
  let risultato: CellStyle = {};
  let dati: string | undefined;
  for (const s of catena) {
    risultato = unisci(risultato, s.proprieta);
    if (s.dati !== undefined) dati = s.dati;
  }
  if (risultato.fontFamily !== undefined && risultato.fontFamily === c.base.fontFamily) delete risultato.fontFamily;
  if (risultato.fontSize !== undefined && risultato.fontSize === c.base.fontSize) delete risultato.fontSize;
  if (risultato.color !== undefined && risultato.color === c.base.color) delete risultato.color;
  const codice = dati !== undefined ? c.dati.get(dati) : undefined;
  if (codice !== undefined && codice !== '') risultato.numFmt = codice;
  return risultato;
}

/** Lo stile che applica una condizione (per nome o per nome visibile), con quello che una formattazione condizionale sa fare. */
function stileCondizionale(nome: string, c: Contesto): NonNullable<ConditionalFormatRule['style']> | undefined {
  let st: CellStyle = {};
  const visti = new Set<string>();
  for (let n: string | undefined = c.stili.has(nome) ? nome : c.nomiVisibili.get(nome); n !== undefined && !visti.has(n) && visti.size < 20; ) {
    visti.add(n);
    const s = c.stili.get(n);
    // lo stile Default (carattere e colore di tutto il foglio) non fa parte della condizione
    if (!s || n === 'Default') break;
    st = unisci(s.proprieta, st);
    n = s.genitore;
  }
  if (visti.size === 0) return undefined;
  const out: NonNullable<ConditionalFormatRule['style']> = {};
  if (st.fill) out.backgroundColor = st.fill;
  if (st.color) out.textColor = st.color;
  if (st.bold) out.bold = true;
  if (st.italic) out.italic = true;
  if (st.underline) out.underline = true;
  return out;
}

const NASCOSTO = ['collapse', 'filter'];

function leggiTabella(t: NodoXml, c: Contesto, blocchi: Impostazioni['blocchi']): FoglioScambio {
  const nome = t.attributi['table:name'] ?? NOME_FOGLIO_PREDEFINITO;
  const f = foglioVuoto(nome);
  const stileColonna = new Map<number, string>();
  const colonneNascoste: number[] = [];
  const righeNascoste: number[] = [];
  const commenti: CommentoScambio[] = [];
  const celleConvalida = new Map<string, Array<{ r: number; c: number }>>();

  const livelliColonne = livelliDeiGruppi(t, 'table:table-column-group', ['table:table-header-columns', 'table:table-columns']);
  const livelliRighe = livelliDeiGruppi(t, 'table:table-row-group', ['table:table-header-rows', 'table:table-rows']);
  const gruppi = { righe: {} as Record<number, number>, colonne: {} as Record<number, number> };
  let colonna = 1;
  for (const col of raccogli(t, ['table:table-column'], ['table:table-column-group', 'table:table-header-columns', 'table:table-columns'])) {
    const n = ripetizioni(col, 'table:number-columns-repeated');
    const livelloCol = livelliColonne.get(col);
    if (livelloCol) for (let k = 0; k < n && k < MAX_RIPETIZIONI_VUOTE && colonna + k <= MAX_COLS; k++) gruppi.colonne[colonna + k] = livelloCol;
    if (n <= MAX_RIPETIZIONI_VUOTE && colonna <= MAX_COLS) {
      const larghezza = c.colonne.get(col.attributi['table:style-name'] ?? '');
      const predefinito = col.attributi['table:default-cell-style-name'];
      const nascostaCol = NASCOSTO.includes(col.attributi['table:visibility'] ?? '');
      for (let k = 0; k < n && colonna + k <= MAX_COLS; k++) {
        if (nascostaCol) colonneNascoste.push(colonna + k);
        if (larghezza !== undefined && larghezza > 0) f.larghezze[colonna + k] = larghezza;
        if (predefinito !== undefined) {
          const st = risolvi(predefinito, c);
          if (!vuoto(st)) { f.stiliColonna[colonna + k] = copia(st); stileColonna.set(colonna + k, predefinito); }
        }
      }
    }
    colonna += n;
  }

  let riga = 1;
  for (const r of raccogli(t, ['table:table-row'], ['table:table-row-group', 'table:table-header-rows', 'table:table-rows'])) {
    const nRighe = ripetizioni(r, 'table:number-rows-repeated');
    const livelloRiga = livelliRighe.get(r);
    if (livelloRiga) for (let k = 0; k < nRighe && k < MAX_RIPETIZIONI_VUOTE && riga + k <= MAX_ROWS; k++) gruppi.righe[riga + k] = livelloRiga;
    const celle: Array<{ colonna: number; x: NodoXml; n: number }> = [];
    let col = 1;
    for (const x of r.figli) {
      if (typeof x === 'string' || (x.nome !== 'table:table-cell' && x.nome !== 'table:covered-table-cell')) continue;
      const n = ripetizioni(x, 'table:number-columns-repeated');
      celle.push({ colonna: col, x, n });
      col += n;
    }
    const predefinitoRiga = r.attributi['table:default-cell-style-name'];
    const altezza = c.righe.get(r.attributi['table:style-name'] ?? '');
    const haContenuto = celle.some((x) => x.x.attributi['office:value-type'] !== undefined || x.x.attributi['table:formula'] !== undefined);
    const nascosta = NASCOSTO.includes(r.attributi['table:visibility'] ?? '');
    const haStile = nascosta || predefinitoRiga !== undefined || celle.some((x) => x.x.attributi['table:style-name'] !== undefined || x.x.nome === 'table:covered-table-cell' || x.x.attributi['table:number-columns-spanned'] !== undefined
      || x.x.attributi['table:content-validation-name'] !== undefined || commentoDi(x.x) !== null);
    const copie = haContenuto || nRighe <= MAX_RIPETIZIONI_VUOTE ? nRighe : 0;
    if (copie === 0 || (!haContenuto && !haStile && altezza === undefined)) { riga += nRighe; continue; }
    for (let k = 0; k < copie && riga + k <= MAX_ROWS; k++) {
      const numero = riga + k;
      if (nascosta) righeNascoste.push(numero);
      if (predefinitoRiga !== undefined) {
        const st = risolvi(predefinitoRiga, c);
        if (!vuoto(st)) f.stiliRiga[numero] = copia(st);
      }
      if (altezza !== undefined && altezza > 0) f.altezze[numero] = altezza;
      for (const { colonna: da, x, n } of celle) {
        const vuotaSenzaStile = x.attributi['office:value-type'] === undefined && x.attributi['table:formula'] === undefined && x.attributi['table:style-name'] === undefined && x.nome === 'table:table-cell' && x.attributi['table:number-columns-spanned'] === undefined
          && x.attributi['table:content-validation-name'] === undefined && commentoDi(x) === null;
        if (vuotaSenzaStile) continue;
        const contiene = x.attributi['office:value-type'] !== undefined || x.attributi['table:formula'] !== undefined;
        const copieCella = contiene || n <= MAX_RIPETIZIONI_VUOTE ? n : 0;
        for (let j = 0; j < copieCella && da + j <= MAX_COLS; j++) {
          const cc = da + j;
          const ref = indirizzoCella(numero, cc);
          const nomeStile = x.attributi['table:style-name'] ?? predefinitoRiga ?? stileColonna.get(cc);
          let stile = risolvi(nomeStile, c);
          let testo: string | undefined;
          const tipo = x.attributi['office:value-type'];
          const formula = x.attributi['table:formula'];
          if (formula !== undefined && /^(of:)?=/.test(formula)) {
            testo = formulaDaOds(formula);
          }
          if (testo === undefined) {
            if (tipo === 'float' || tipo === 'percentage' || tipo === 'currency') {
              const v = Number(x.attributi['office:value']);
              if (x.attributi['office:value'] !== undefined && Number.isFinite(v)) testo = String(v);
            } else if (tipo === 'date') testo = serialeDaData(x.attributi['office:date-value'] ?? '') ?? undefined;
            else if (tipo === 'time') testo = serialeDaDurata(x.attributi['office:time-value'] ?? '') ?? undefined;
            else if (tipo === 'boolean') testo = x.attributi['office:boolean-value'] === 'true' ? 'TRUE' : 'FALSE';
            else if (tipo === 'string') testo = x.attributi['office:string-value'] ?? testoCella(x);
          }
          if (testo !== undefined && testo !== '') {
            f.celle[ref] = testo;
            const lett = tipoLetterale(testo);
            if (tipo === 'string' && (lett === 'numero' || lett === 'booleano')) stile = { ...stile, numFmt: '@' };
          }
          if (!vuoto(stile)) f.stili[ref] = copia(stile);
          const nomeConvalida = x.attributi['table:content-validation-name'];
          if (nomeConvalida !== undefined && c.convalide.has(nomeConvalida)) {
            const lista = celleConvalida.get(nomeConvalida) ?? [];
            if (lista.length < 100000) lista.push({ r: numero, c: cc });
            celleConvalida.set(nomeConvalida, lista);
          }
          if (k === 0 && j === 0) {
            const commento = commentoDi(x);
            if (commento) commenti.push({ riga: numero, colonna: cc, ...commento });
          }
          if (k === 0 && j === 0 && x.nome === 'table:table-cell') {
            const nc = ripetizioni(x, 'table:number-columns-spanned');
            const nr = ripetizioni(x, 'table:number-rows-spanned');
            if (nc > 1 || nr > 1) f.unioni.push({ startRow: numero, endRow: Math.min(MAX_ROWS, numero + nr - 1), startCol: cc, endCol: Math.min(MAX_COLS, cc + nc - 1) });
          }
        }
      }
    }
    riga += nRighe;
  }

  const blocco = blocchi.get(nome);
  if (blocco) { f.righeCongelate = blocco.righe; f.colonneCongelate = blocco.colonne; }
  if (righeNascoste.length > 0) f.righeNascoste = righeNascoste;
  if (Object.keys(gruppi.righe).length + Object.keys(gruppi.colonne).length > 0) f.gruppi = gruppi;
  if (colonneNascoste.length > 0) f.colonneNascoste = colonneNascoste;
  if (commenti.length > 0) f.commenti = commenti;
  const convalide: ConvalidaScambio[] = [];
  for (const [nomeConvalida, celle] of celleConvalida) {
    const regola = c.convalide.get(nomeConvalida) as DataValidationRule;
    for (const { r, c: col } of celle) convalide.push({ intervallo: { startRow: r, endRow: r, startCol: col, endCol: col }, regola: { ...regola } });
  }
  if (convalide.length > 0) f.convalide = convalide;
  return f;
}

async function leggi(bytes: Uint8Array): Promise<RisultatoOds> {
  const voci = await leggiZip(bytes);
  const parte = (nome: string): NodoXml | undefined => {
    const d = voci.get(nome);
    return d ? analizzaXml(DECODIFICA.decode(d)) : undefined;
  };
  const tipo = voci.get('mimetype');
  // i modelli (.ots) hanno un altro tipo, ma stessa struttura
  if (tipo !== undefined && ![TIPO_ODS, TIPO_ODS_MODELLO].includes(DECODIFICA.decode(tipo).trim())) throw new Error(t("non è un foglio di calcolo OpenDocument"));
  return daParti(parte, [...voci.keys()]);
}

/** OpenDocument "piatto" (.fods): un solo file XML con stili, contenuto e impostazioni insieme. */
export function leggiFods(bytes: Uint8Array): RisultatoOds {
  try {
    const radice = analizzaXml(DECODIFICA.decode(bytes));
    if (radice.nome !== 'office:document') throw new Error(t("non è un foglio di calcolo OpenDocument"));
    return daParti((nome) => (nome === 'META-INF/manifest.xml' ? undefined : radice), []);
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    throw new Error(messaggio.startsWith(t("File .ods non valido")) ? messaggio : t("File .ods non valido: {}", messaggio));
  }
}

function daParti(parte: (nome: string) => NodoXml | undefined, nomiVoci: string[]): RisultatoOds {
  const manifest = parte('META-INF/manifest.xml');
  if (manifest && esiste(manifest, (n) => n.nome === 'manifest:encryption-data')) throw new Error(t("il file è protetto da password: non si può aprire"));
  const contenuto = parte('content.xml');
  if (!contenuto) throw new Error(t("manca il contenuto"));
  const foglio = trova(contenuto, 'office:body/office:spreadsheet');
  if (!foglio) throw new Error(t("non è un foglio di calcolo OpenDocument"));

  const convalideFile = leggiConvalideOds(foglio);
  const c: Contesto = { convalide: convalideFile.regole, stili: new Map(), nomiVisibili: new Map(), dati: new Map(), colonne: new Map(), righe: new Map(), base: {} };
  const gruppiStili = [
    ...elenco(parte('styles.xml'), 'office:styles'), ...elenco(parte('styles.xml'), 'office:automatic-styles'),
    ...elenco(contenuto, 'office:styles'), ...elenco(contenuto, 'office:automatic-styles'),
  ];
  let mappeOds = false;
  const DATI = ['number:number-style', 'number:percentage-style', 'number:currency-style', 'number:date-style', 'number:time-style', 'number:text-style', 'number:boolean-style'];
  for (const g of gruppiStili) {
    for (const s of g.figli) {
      if (typeof s === 'string') continue;
      const nome = s.attributi['style:name'];
      if (nome === undefined) continue;
      if (DATI.includes(s.nome)) c.dati.set(nome, codiceDati(s));
      else if (s.nome === 'style:style') {
        const famiglia = s.attributi['style:family'];
        if (famiglia === 'table-cell') {
          c.stili.set(nome, { genitore: s.attributi['style:parent-style-name'], dati: s.attributi['style:data-style-name'], proprieta: proprieta(s) });
          const visibile = s.attributi['style:display-name'];
          if (visibile !== undefined && !c.stili.has(visibile)) c.nomiVisibili.set(visibile, nome);
          if (figliElemento(s, 'style:map').length > 0) mappeOds = true;
        }
        else if (famiglia === 'table-column') { const l = lunghezzaPx(trova(s, 'style:table-column-properties')?.attributi['style:column-width']); if (l !== undefined) c.colonne.set(nome, l); }
        else if (famiglia === 'table-row') {
          const p = trova(s, 'style:table-row-properties');
          const h = lunghezzaPx(p?.attributi['style:row-height']);
          if (h !== undefined && p?.attributi['style:use-optimal-row-height'] === 'false') c.righe.set(nome, h);
        }
      }
    }
  }
  const predefinito = c.stili.get('Default');
  if (predefinito) c.base = { fontFamily: predefinito.proprieta.fontFamily, fontSize: predefinito.proprieta.fontSize, color: predefinito.proprieta.color };

  const impostazioni = leggiImpostazioni(parte('settings.xml'));
  const mastri = leggiMastri(parte('styles.xml'));
  const stiliTabella = mastriDegliStiliTabella(gruppiStili);
  const coloriTabella = coloriDegliStiliTabella(gruppiStili);
  const tabelleNascoste = stiliTabellaNascosti(gruppiStili);
  let condizionaliNonImportate = 0;
  let condizionaliLibreOffice = false;
  const formulaCondizione = (e: string): string => formulaDaOds(`of:=${e}`);
  const fogli = elenco(foglio, 'table:table').map((t) => {
    const f = leggiTabella(t, c, impostazioni.blocchi);
    if (t.attributi['table:protected'] === 'true') f.protezione = protezioneDaOds(t.attributi);
    const pagina = paginaDellaTabella(t, stiliTabella, mastri);
    if (pagina) f.pagina = pagina;
    const colore = coloriTabella.get(t.attributi['table:style-name'] ?? '');
    if (colore) f.colore = colore;
    if (tabelleNascoste.has(t.attributi['table:style-name'] ?? '')) f.nascosto = true;
    if (trova(t, 'calcext:conditional-formats')) condizionaliLibreOffice = true;
    const cond = leggiCondizionaliOds(t, (nome) => stileCondizionale(nome, c), formulaCondizione);
    if (cond.regole.length > 0) f.condizionali = cond.regole;
    condizionaliNonImportate += cond.nonImportate;
    return f;
  });
  if (fogli.length === 0) throw new Error(t("nessun foglio"));
  const foglioAttivo = fogli.some((x) => x.nome === impostazioni.attivo) ? (impostazioni.attivo as string) : fogli[0].nome;

  const avvisi: string[] = [];
  const zero = trova(foglio, 'table:calculation-settings/table:null-date')?.attributi['table:date-value'];
  if (zero !== undefined && zero.trim() !== '1899-12-30') avvisi.push(t("Il file usa una data di partenza del calendario diversa dal 30/12/1899: le date scritte come numeri possono risultare sfalsate."));
  if (nomiVoci.some((n) => n.startsWith('Object ') || n.startsWith('Pictures/')) || esiste(foglio, (n) => n.nome.startsWith('draw:'))) avvisi.push(t("Grafici, immagini e disegni del file non sono stati importati."));
  if (esiste(foglio, (n) => n.nome === 'table:data-pilot-tables')) avvisi.push(t("Le tabelle pivot del file non sono state importate."));
  // senza la forma di LibreOffice restano solo le condizioni nella forma base (style:map), che non si importano
  if (mappeOds && !condizionaliLibreOffice) avvisi.push(t("Le formattazioni condizionali del file non sono state importate."));
  if (condizionaliNonImportate > 0) avvisi.push(condizionaliNonImportate === 1 ? t("Una formattazione condizionale del file non è stata importata (il suo tipo non è tra quelli supportati).") : t("{} formattazioni condizionali del file non sono state importate (il loro tipo non è tra quelli supportati).", condizionaliNonImportate));
  if (convalideFile.nonImportate > 0) avvisi.push(convalideFile.nonImportate === 1 ? t("Una convalida dei dati del file non è stata importata (la sua condizione non è tra quelle supportate).") : t("{} convalide dei dati del file non sono state importate (la loro condizione non è tra quelle supportate).", convalideFile.nonImportate));
  const nomiFile = leggiNomiOds(foglio, fogli.map((x) => x.nome));
  if (nomiFile.nonImportati > 0) avvisi.push(nomiFile.nonImportati === 1 ? t("Un nome definito del file non è stato importato (non è un intervallo semplice di un foglio).") : t("{} nomi definiti del file non sono stati importati (non sono intervalli semplici di un foglio).", nomiFile.nonImportati));
  const protezioneCartella = foglio.attributi['table:structure-protected'] === 'true' ? protezioneDaOds(foglio.attributi) : undefined;
  return { scambio: { fogli, foglioAttivo, ...(nomiFile.nomi.length > 0 ? { nomi: nomiFile.nomi } : {}), ...(protezioneCartella ? { protezioneCartella } : {}) }, avvisi };
}

/** Dai byte di un file .ods al modello di scambio, con gli avvisi su ciò che non si importa. Un file non valido dà un errore chiaro ("File .ods non valido: ..."). */
export async function leggiOds(bytes: Uint8Array): Promise<RisultatoOds> {
  try {
    return await leggi(bytes);
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    throw new Error(messaggio.startsWith(t("File .ods non valido")) ? messaggio : t("File .ods non valido: {}", messaggio));
  }
}
