// Scrittura di file .xlsx (Excel, Google Fogli) dal modello di scambio. Puro: restituisce i byte, non tocca il disco.
// Le formule si scrivono col nome inglese e SENZA valore calcolato: Excel e Google Fogli le ricalcolano all'apertura (fullCalcOnLoad).
// I testi delle celle si leggono come li legge il motore: "=..." formula, TRUE/FALSE booleano, numero con punto decimale, altrimenti testo.
import { livelloMassimo } from '../sheet/gruppi';
import type { Impronta } from '@comune/protezione/impronte';
import { scriviZip, type VoceZip } from '@comune/formati/zip';
import { elemento, escapaXml } from '@comune/formati/xml';
import type { BorderDef, CellStyle } from '../sheet/styles';
import { MAX_COLS, MAX_ROWS, parseCellAddress } from '../engine/address';
import type { FoglioScambio, Scambio } from './scambio';
import { nomiStampaXml, paginaXml, sheetPrPagina } from './xlsx-pagina';
import { autoFiltroXml, collegamentiFoglio, collegamentiXml, commentiXml, condizionaliXml, convalideXml, dxfXml, nomiXml, relazioniCollegamenti, vmlCommentiXml } from './xlsx-extra';
import { tokenize } from '../engine/tokenizer';
import { Parser, type ASTNode } from '../engine/parser';
import { COLORE_LINK } from '../sheet/link';
import { estensioneImmagine } from '../sheet/immagini';
import { disegnoXml, immaginiPerExcel, immaginiWebp } from './xlsx-immagini';
import { NOME_FOGLIO_PREDEFINITO, foglioVuoto, indirizzoCella } from './scambio';
import { t } from '../i18n/lingua';

/** Gli attributi della password come li scrive Excel: l'impronta SHA-512 (algorithmName, hashValue, saltValue, spinCount; per la
 *  cartella con il prefisso «workbook») o, se c'è solo quella vecchia, l'attributo password (workbookPassword). Le impronte di
 *  LibreOffice (SHA-256) Excel non le conosce: senza le altre la protezione resta, senza password. */
function attributiImpronta(impronte: Impronta[] | undefined, prefisso: '' | 'workbook'): Record<string, string | number> {
  const p = (k: string): string => (prefisso === '' ? k : prefisso + k.charAt(0).toUpperCase() + k.slice(1));
  const moderna = impronte?.find((i) => i.alg === 'SHA-512' && i.sale !== undefined);
  if (moderna) return { [p('algorithmName')]: 'SHA-512', [p('hashValue')]: moderna.hash, [p('saltValue')]: moderna.sale!, [p('spinCount')]: moderna.giri ?? 100000 };
  const vecchia = impronte?.find((i) => i.alg === 'legacy');
  if (vecchia) return { [prefisso === '' ? 'password' : 'workbookPassword']: vecchia.hash };
  return {};
}

export type TipoLetterale = 'formula' | 'booleano' | 'numero' | 'testo';

const NUMERO = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** Che cosa è il testo di una cella, con le stesse regole del motore di calcolo. */
export function tipoLetterale(testo: string): TipoLetterale {
  if (testo.startsWith('=') && testo.length > 1) return 'formula';
  const t = testo.trim();
  const maiuscolo = t.toUpperCase();
  if (maiuscolo === 'TRUE' || maiuscolo === 'FALSE') return 'booleano';
  if (NUMERO.test(t) && Number.isFinite(Number(t))) return 'numero';
  return 'testo';
}

const NOME_VIETATO = /[\\/?*[\]:]/g;

/** Nomi dei fogli ammessi da Excel: al massimo 31 caratteri, senza \ / ? * [ ] :, senza apostrofi ai bordi, mai vuoti, mai ripetuti (senza badare alle maiuscole). */
export function nomiFoglioXlsx(nomi: string[]): string[] {
  const usati = new Set<string>();
  return nomi.map((nome, i) => {
    let base = nome.replace(NOME_VIETATO, '_').slice(0, 31).replace(/^'+|'+$/g, '').trim();
    if (base === '') base = `Foglio${i + 1}`;
    let candidato = base;
    for (let k = 2; usati.has(candidato.toLowerCase()); k++) {
      const suffisso = ` (${k})`;
      candidato = base.slice(0, 31 - suffisso.length) + suffisso;
    }
    usati.add(candidato.toLowerCase());
    return candidato;
  });
}

/** Avvisi per l'utente: i fogli che nel file hanno un nome diverso. Le formule che li citano non vengono corrette. */
export function avvisiScritturaXlsx(s: Scambio): string[] {
  const nuovi = nomiFoglioXlsx(s.fogli.map((f) => f.nome));
  const avvisi: string[] = [];
  s.fogli.forEach((f, i) => {
    if (nuovi[i] !== f.nome) avvisi.push(t("Il foglio «{}» è stato chiamato «{}» nel file perché Excel non ammette quel nome: le formule che lo citano non sono state corrette.", f.nome, nuovi[i]));
  });
  const usate = new Set<string>();
  for (const f of s.fogli) for (const testo of Object.values(f.celle)) {
    if (!testo.startsWith('=')) continue;
    for (const m of testo.toUpperCase().matchAll(/([A-Z][A-Z0-9.]*)\(/g)) {
      if (SOLO_PMB_SHEETS.includes(m[1])) usate.add(m[1]);
    }
  }
  if (usate.size > 0) avvisi.push(t("Queste funzioni non esistono in Excel e lì daranno #NAME?: {}.", [...usate].join(', ')));
  const perse: string[] = [];
  for (const f of s.fogli) for (const r of f.condizionali ?? []) {
    // barre dati e set di icone si scrivono (Fase 43); una barra si perde solo se il suo colore non è #rrggbb
    if (r.type === 'date') perse.push(t("regole sulle date"));
    else if (r.type === 'data_bar' && !/^#[0-9a-fA-F]{6}$/.test(r.dataBar?.color ?? '')) perse.push(t("barre dati con un colore che Excel non legge"));
  }
  if (perse.length > 0) avvisi.push(t("Non si conservano nel file Excel: {}.", [...new Set(perse)].join(', ')));
  const webp = s.fogli.reduce((n, f) => n + immaginiWebp(f), 0);
  if (webp > 0) avvisi.push(t("{} nel file Excel: Excel non legge il formato WebP (nel formato pmb_sheets si conserva).", webp === 1 ? 'Un\'immagine WebP non è stata scritta' : `${webp} immagini WebP non sono state scritte`));
  return avvisi;
}

/**
 * Funzioni che Excel ha aggiunto dopo il 2007: nel file vogliono un prefisso (_xlfn. o _xlfn._xlws.) sul nome, altrimenti Excel le mostra come
 * #NOME?. Elenco ricavato da Excel stesso (2026-11-20): un .xlsx salvato da Excel con una formula per ogni funzione di pmb_sheets
 * (LAVORO/studio-microsoft-office/prefissi_xlsx.py).
 */
const PREFISSI_FUNZIONI: Record<string, string> = {
  MAXIFS: '_xlfn.', MINIFS: '_xlfn.', ISFORMULA: '_xlfn.', FORMULATEXT: '_xlfn.',
  IMTAN: '_xlfn.', IMSEC: '_xlfn.', IMCSC: '_xlfn.', IMCOT: '_xlfn.', IMSINH: '_xlfn.', IMCOSH: '_xlfn.', IMSECH: '_xlfn.', IMCSCH: '_xlfn.', ENCODEURL: '_xlfn.',
  ACOT: '_xlfn.', ACOTH: '_xlfn.', AGGREGATE: '_xlfn.', ARABIC: '_xlfn.', ARRAYTOTEXT: '_xlfn.', BASE: '_xlfn.', 'BETA.DIST': '_xlfn.',
  'BETA.INV': '_xlfn.', 'BINOM.DIST': '_xlfn.', 'BINOM.DIST.RANGE': '_xlfn.', 'BINOM.INV': '_xlfn.', BITAND: '_xlfn.', BITLSHIFT: '_xlfn.',
  BITOR: '_xlfn.', BITRSHIFT: '_xlfn.', BITXOR: '_xlfn.', BYCOL: '_xlfn.', BYROW: '_xlfn.', 'CEILING.MATH': '_xlfn.', 'CEILING.PRECISE': '_xlfn.',
  'CHISQ.DIST': '_xlfn.', 'CHISQ.DIST.RT': '_xlfn.', 'CHISQ.INV': '_xlfn.', 'CHISQ.INV.RT': '_xlfn.', 'CHISQ.TEST': '_xlfn.', CHOOSECOLS: '_xlfn.',
  CHOOSEROWS: '_xlfn.', COMBINA: '_xlfn.', CONCAT: '_xlfn.', 'CONFIDENCE.NORM': '_xlfn.', 'CONFIDENCE.T': '_xlfn.', COT: '_xlfn.', COTH: '_xlfn.',
  'COVARIANCE.P': '_xlfn.', 'COVARIANCE.S': '_xlfn.', CSC: '_xlfn.', CSCH: '_xlfn.', DAYS: '_xlfn.', DECIMAL: '_xlfn.', DROP: '_xlfn.',
  'ERF.PRECISE': '_xlfn.', 'ERFC.PRECISE': '_xlfn.', EXPAND: '_xlfn.', 'EXPON.DIST': '_xlfn.', 'F.DIST': '_xlfn.', 'F.DIST.RT': '_xlfn.',
  'F.INV': '_xlfn.', 'F.INV.RT': '_xlfn.', 'F.TEST': '_xlfn.', FILTER: '_xlfn._xlws.', 'FLOOR.MATH': '_xlfn.', 'FLOOR.PRECISE': '_xlfn.',
  'FORECAST.LINEAR': '_xlfn.', GAMMA: '_xlfn.', 'GAMMA.DIST': '_xlfn.', 'GAMMA.INV': '_xlfn.', 'GAMMALN.PRECISE': '_xlfn.', GAUSS: '_xlfn.',
  HSTACK: '_xlfn.', 'HYPGEOM.DIST': '_xlfn.', IFNA: '_xlfn.', IFS: '_xlfn.', ISOWEEKNUM: '_xlfn.', LAMBDA: '_xlfn.', LET: '_xlfn.',
  'LOGNORM.DIST': '_xlfn.', 'LOGNORM.INV': '_xlfn.', MAKEARRAY: '_xlfn.', MAP: '_xlfn.', 'MODE.MULT': '_xlfn.', 'MODE.SNGL': '_xlfn.',
  MUNIT: '_xlfn.', 'NEGBINOM.DIST': '_xlfn.', 'NORM.DIST': '_xlfn.', 'NORM.INV': '_xlfn.', 'NORM.S.DIST': '_xlfn.', 'NORM.S.INV': '_xlfn.',
  NUMBERVALUE: '_xlfn.', PDURATION: '_xlfn.', 'PERCENTILE.EXC': '_xlfn.', 'PERCENTILE.INC': '_xlfn.', 'PERCENTRANK.EXC': '_xlfn.',
  'PERCENTRANK.INC': '_xlfn.', PERMUTATIONA: '_xlfn.', PHI: '_xlfn.', 'POISSON.DIST': '_xlfn.', 'QUARTILE.EXC': '_xlfn.', 'QUARTILE.INC': '_xlfn.',
  RANDARRAY: '_xlfn.', REDUCE: '_xlfn.', RRI: '_xlfn.', SCAN: '_xlfn.', SEC: '_xlfn.', SECH: '_xlfn.', SEQUENCE: '_xlfn.', SHEET: '_xlfn.',
  SHEETS: '_xlfn.', 'SKEW.P': '_xlfn.', SORT: '_xlfn._xlws.', SORTBY: '_xlfn.', 'STDEV.P': '_xlfn.', 'STDEV.S': '_xlfn.', SWITCH: '_xlfn.',
  'T.DIST': '_xlfn.', 'T.DIST.2T': '_xlfn.', 'T.DIST.RT': '_xlfn.', 'T.INV': '_xlfn.', 'T.INV.2T': '_xlfn.', 'T.TEST': '_xlfn.', TAKE: '_xlfn.',
  TEXTAFTER: '_xlfn.', TEXTBEFORE: '_xlfn.', TEXTJOIN: '_xlfn.', TEXTSPLIT: '_xlfn.', TOCOL: '_xlfn.', TOROW: '_xlfn.', UNICHAR: '_xlfn.',
  UNICODE: '_xlfn.', UNIQUE: '_xlfn.', VALUETOTEXT: '_xlfn.', 'VAR.P': '_xlfn.', 'VAR.S': '_xlfn.', VSTACK: '_xlfn.', 'WEIBULL.DIST': '_xlfn.',
  WRAPCOLS: '_xlfn.', WRAPROWS: '_xlfn.', XLOOKUP: '_xlfn.', XMATCH: '_xlfn.', XOR: '_xlfn.', 'Z.TEST': '_xlfn.',
};
const RICONOSCI_NUOVE = new RegExp(`(?<![A-Za-z0-9_.])(${Object.keys(PREFISSI_FUNZIONI).sort((x, y) => y.length - x.length).map((n) => n.replace(/\./g, '\\.')).join('|')})\\(`, 'gi');

/** Funzioni di pmb_sheets che in Excel non esistono: nel file ci vanno lo stesso, ma lì daranno #NAME?. */
const SOLO_PMB_SHEETS = ['COUNTUNIQUE', 'ARRAYFORMULA', 'FORMULA.MATRICIALE', 'REGEXMATCH', 'REGEXEXTRACT', 'REGEXREPLACE', 'SPARKLINE', 'FLATTEN', 'QUERY'];

/** I nomi dei parametri di LAMBDA (tutti gli argomenti tranne l'ultimo) e dei nomi di LET (gli argomenti 1, 3, 5... tranne l'ultimo), in maiuscolo. */
function parametriLambda(formula: string): Set<string> {
  const nomi = new Set<string>();
  const { tokens, error } = tokenize(formula);
  if (error || !tokens) return nomi;
  const { ast } = new Parser(tokens).parse();
  const visita = (n: ASTNode | undefined): void => {
    if (!n) return;
    if (n.type === 'Call') {
      const f = n.name.toUpperCase();
      n.args.forEach((a, i) => {
        const eNome = (f === 'LAMBDA' && i < n.args.length - 1) || (f === 'LET' && i % 2 === 0 && i < n.args.length - 1);
        if (eNome && a.type === 'Name') nomi.add(a.name.toUpperCase());
      });
      n.args.forEach(visita);
    } else if (n.type === 'Binary') { visita(n.left); visita(n.right); }
    else if (n.type === 'Unary' || n.type === 'Postfix') visita(n.expr);
    else if (n.type === 'Array') n.rows.forEach((r) => r.forEach(visita));
  };
  visita(ast ?? undefined);
  return nomi;
}

/** Un nome scritto da solo (non un pezzo di un altro nome, non un foglio "Foglio1!", non dopo "Foglio1!"). */
const IDENTIFICATORE = /(?<![A-Za-z0-9_.$!\\])([A-Za-z_\\][A-Za-z0-9_.]*)(?![A-Za-z0-9_.!])/g;

/**
 * Formula come va scritta nel file: senza "=" iniziale, con il prefisso _xlfn. sulle funzioni che Excel ha aggiunto dopo il 2007
 * e _xlpm. sui nomi dei parametri di LAMBDA e di LET, come li scrive Excel 365 (fuori dai testi tra virgolette e dai nomi di foglio tra apici).
 */
export function formulaPerExcel(formula: string): string {
  const senza = formula.startsWith('=') ? formula.slice(1) : formula;
  const parametri = /LAMBDA|LET/i.test(senza) ? parametriLambda(senza) : new Set<string>();
  return senza.split(/("(?:[^"]|"")*"|'(?:[^']|'')*')/).map((parte, i) => {
    if (i % 2 === 1) return parte;
    const conParametri = parametri.size === 0 ? parte : parte.replace(IDENTIFICATORE, (nome: string) => (parametri.has(nome.toUpperCase()) ? `_xlpm.${nome}` : nome));
    return conParametri.replace(RICONOSCI_NUOVE, (_, nome: string) => `${PREFISSI_FUNZIONI[nome.toUpperCase()]}${nome.toUpperCase()}(`);
  }).join('');
}

/** Formato numerico come lo vuole Excel: il simbolo dell'euro fuori dalle virgolette va tra virgolette. */
export function codiceFormatoExcel(formato: string): string {
  return formato.split(/("[^"]*"|\[[^\]]*\])/).map((parte, i) => (i % 2 === 1 ? parte : parte.replace(/€/g, '"€"'))).join('');
}

const FORMATI_INTEGRATI: Record<string, number> = { '': 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10, '0.00E+00': 11, '@': 49 };
const STILI_BORDO = new Set(['thin', 'medium', 'dashed']);

function argb(colore: string | undefined): string | undefined {
  return colore !== undefined && /^#[0-9a-fA-F]{6}$/.test(colore) ? `FF${colore.slice(1).toUpperCase()}` : undefined;
}

function latoBordo(nome: string, b: BorderDef | undefined): string {
  if (!b || !STILI_BORDO.has(b.style)) return `<${nome}/>`;
  const colore = argb(b.color);
  return elemento(nome, { style: b.style }, [colore ? elemento('color', { rgb: colore }) : elemento('color', { auto: 1 })]);
}

/** Le tabelle di caratteri, riempimenti, bordi, formati e combinazioni di stili del file, senza doppioni. L'indice 0 è lo stile vuoto. */
class TabellaStili {
  private readonly caratteri: string[] = [];
  private readonly riempimenti: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  private readonly bordi: string[] = [];
  private readonly formati: string[] = [];
  private readonly combinazioni: string[] = [];
  private readonly dxfs: string[] = [];

  constructor() { this.indice({}); }

  /** Indice dello stile differenziale (colori e grassetto di una formattazione condizionale). */
  dxf(stile: Parameters<typeof dxfXml>[0]): number {
    return this.voce(this.dxfs, dxfXml(stile));
  }

  private voce(lista: string[], xml: string): number {
    let i = lista.indexOf(xml);
    if (i < 0) { i = lista.length; lista.push(xml); }
    return i;
  }

  /** Indice della combinazione per questo stile (la crea se serve). */
  indice(st: Readonly<CellStyle>): number {
    const dimensione = typeof st.fontSize === 'number' && Number.isFinite(st.fontSize) && st.fontSize > 0 && st.fontSize <= 409 ? st.fontSize : 10;
    const nome = typeof st.fontFamily === 'string' && st.fontFamily.trim() !== '' ? st.fontFamily : 'Arial';
    const coloreTesto = argb(st.color);
    const fontId = this.voce(this.caratteri, elemento('font', {}, [
      ...(st.bold ? ['<b/>'] : []), ...(st.italic ? ['<i/>'] : []), ...(st.strike ? ['<strike/>'] : []), ...(st.underline ? ['<u/>'] : []),
      elemento('sz', { val: dimensione }), ...(coloreTesto ? [elemento('color', { rgb: coloreTesto })] : []), elemento('name', { val: nome }),
    ]));
    const sfondo = argb(st.fill);
    const fillId = sfondo ? this.voce(this.riempimenti, `<fill><patternFill patternType="solid"><fgColor rgb="${sfondo}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const b = st.borders;
    const borderId = this.voce(this.bordi, elemento('border', {}, [latoBordo('left', b?.left), latoBordo('right', b?.right), latoBordo('top', b?.top), latoBordo('bottom', b?.bottom), '<diagonal/>']));
    const formato = typeof st.numFmt === 'string' ? st.numFmt : '';
    const numFmtId = FORMATI_INTEGRATI[formato] ?? 164 + this.voce(this.formati, codiceFormatoExcel(formato));
    const orizzontale = st.hAlign === 'left' || st.hAlign === 'center' || st.hAlign === 'right' ? st.hAlign : undefined;
    const verticale = st.vAlign === 'top' ? 'top' : st.vAlign === 'middle' ? 'center' : st.vAlign === 'bottom' ? 'bottom' : undefined;
    const a = st.wrap ? 1 : undefined;
    const allineamento = orizzontale || verticale || a ? [elemento('alignment', { horizontal: orizzontale, vertical: verticale, wrapText: a })] : [];
    // protezione della cella come la scrive Excel: di serie bloccata, «locked=0» se si può scrivere col foglio protetto, «hidden=1» per la formula nascosta
    const protezione = st.sbloccata || st.formulaNascosta ? [elemento('protection', { locked: st.sbloccata ? 0 : undefined, hidden: st.formulaNascosta ? 1 : undefined })] : [];
    return this.voce(this.combinazioni, elemento('xf', {
      numFmtId, fontId, fillId, borderId, xfId: 0,
      applyNumberFormat: numFmtId !== 0 ? 1 : undefined, applyFont: fontId !== 0 ? 1 : undefined, applyFill: fillId !== 0 ? 1 : undefined,
      applyBorder: borderId !== 0 ? 1 : undefined, applyAlignment: allineamento.length > 0 ? 1 : undefined, applyProtection: protezione.length > 0 ? 1 : undefined,
    }, [...allineamento, ...protezione]));
  }

  xml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${elemento('styleSheet', { xmlns: NS_PRINCIPALE }, [
      ...(this.formati.length > 0 ? [elemento('numFmts', { count: this.formati.length }, this.formati.map((c, i) => elemento('numFmt', { numFmtId: 164 + i, formatCode: c })))] : []),
      elemento('fonts', { count: this.caratteri.length }, this.caratteri),
      elemento('fills', { count: this.riempimenti.length }, this.riempimenti),
      elemento('borders', { count: this.bordi.length }, this.bordi),
      elemento('cellStyleXfs', { count: 1 }, ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>']),
      elemento('cellXfs', { count: this.combinazioni.length }, this.combinazioni),
      elemento('cellStyles', { count: 1 }, ['<cellStyle name="Normal" xfId="0" builtinId="0"/>']),
      ...(this.dxfs.length > 0 ? [elemento('dxfs', { count: this.dxfs.length }, this.dxfs)] : []),
    ])}`;
  }
}

const NS_PRINCIPALE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_RELAZIONI = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PACCHETTO = 'http://schemas.openxmlformats.org/package/2006/relationships';
const INTESTAZIONE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const intero = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const arrotonda = (n: number): number => Math.round(n * 100) / 100;

/** Stile di una cella: strati Riga < Colonna < Cella, i bordi si fondono lato per lato (come nel documento di Fogli). */
function stileRisolto(f: FoglioScambio, riga: number, colonna: number): CellStyle {
  const r = f.stiliRiga[riga];
  const c = f.stiliColonna[colonna];
  const k = f.stili[indirizzoCella(riga, colonna)];
  const m: CellStyle = { ...r, ...c, ...k };
  if (typeof m.link === 'string' && m.link !== '') { if (!m.color || m.color === 'auto') m.color = COLORE_LINK; m.underline = true; }
  if (r?.borders || c?.borders || k?.borders) m.borders = { ...r?.borders, ...c?.borders, ...k?.borders };
  return m;
}

interface CellaScritta { riga: number; colonna: number; testo: string }

function fogliXml(f: FoglioScambio, attivo: boolean, stili: TabellaStili, stringhe: string[], indiciStringhe: Map<string, number>, haCommenti: boolean, haDisegno: boolean): string {
  const celle = new Map<string, CellaScritta>();
  for (const [a, testo] of Object.entries(f.celle)) {
    const c = parseCellAddress(a);
    if (c && typeof testo === 'string' && testo !== '' && intero(c.row, 1, MAX_ROWS) && intero(c.col, 1, MAX_COLS)) celle.set(`${c.row},${c.col}`, { riga: c.row, colonna: c.col, testo });
  }
  const soloStile = new Set<string>();
  for (const a of Object.keys(f.stili)) {
    const c = parseCellAddress(a);
    if (c && intero(c.row, 1, MAX_ROWS) && intero(c.col, 1, MAX_COLS) && !celle.has(`${c.row},${c.col}`)) soloStile.add(`${c.row},${c.col}`);
  }
  const righe = new Set<number>();
  for (const c of celle.values()) righe.add(c.riga);
  for (const k of soloStile) righe.add(Number(k.split(',')[0]));
  for (const k of Object.keys(f.stiliRiga)) if (intero(Number(k), 1, MAX_ROWS)) righe.add(Number(k));
  for (const k of Object.keys(f.altezze)) if (intero(Number(k), 1, MAX_ROWS)) righe.add(Number(k));
  const nascoste = new Set((f.righeNascoste ?? []).filter((n) => intero(n, 1, MAX_ROWS)));
  for (const n of nascoste) righe.add(n);
  // righe raggruppate (struttura): outlineLevel come Excel
  const livelliRiga = f.gruppi?.righe ?? {};
  for (const k of Object.keys(livelliRiga)) if (intero(Number(k), 1, MAX_ROWS)) righe.add(Number(k));

  // le colonne usate di ogni riga, raggruppate una volta sola (rileggere tutte le celle a ogni riga rendeva il salvataggio quadratico)
  const colonnePerRiga = new Map<number, number[]>();
  for (const c of celle.values()) { const l = colonnePerRiga.get(c.riga); if (l) l.push(c.colonna); else colonnePerRiga.set(c.riga, [c.colonna]); }
  for (const k of soloStile) { const [r, c] = k.split(',').map(Number); const l = colonnePerRiga.get(r); if (l) l.push(c); else colonnePerRiga.set(r, [c]); }

  let minR = Infinity, maxR = 0, minC = Infinity, maxC = 0;
  const riga = (n: number): string => {
    const nelle: Array<{ colonna: number; xml: string }> = [];
    const ammessa = (testo: string, st: CellStyle): TipoLetterale => {
      const tipo = tipoLetterale(testo);
      return st.numFmt === '@' && tipo !== 'formula' ? 'testo' : tipo;
    };
    const chiavi = colonnePerRiga.get(n) ?? [];
    for (const colonna of chiavi) {
      const st = stileRisolto(f, n, colonna);
      const xf = stili.indice(st);
      const cella = celle.get(`${n},${colonna}`);
      const ref = indirizzoCella(n, colonna);
      minR = Math.min(minR, n); maxR = Math.max(maxR, n); minC = Math.min(minC, colonna); maxC = Math.max(maxC, colonna);
      const s = xf !== 0 ? xf : undefined;
      if (!cella) { nelle.push({ colonna, xml: elemento('c', { r: ref, s }) }); continue; }
      const tipo = ammessa(cella.testo, st);
      if (tipo === 'formula') {
        const calcolato = f.calcolati?.[ref];
        const valore = calcolato ? [elemento('v', {}, [escapaXml(calcolato.valore)])] : [];
        nelle.push({ colonna, xml: elemento('c', { r: ref, s, t: calcolato && calcolato.tipo !== 'n' ? calcolato.tipo : undefined }, [elemento('f', {}, [escapaXml(formulaPerExcel(cella.testo))]), ...valore]) });
      }
      else if (tipo === 'booleano') nelle.push({ colonna, xml: elemento('c', { r: ref, s, t: 'b' }, [elemento('v', {}, [cella.testo.trim().toUpperCase() === 'TRUE' ? '1' : '0'])]) });
      else if (tipo === 'numero') nelle.push({ colonna, xml: elemento('c', { r: ref, s }, [elemento('v', {}, [String(Number(cella.testo.trim()))])]) });
      else {
        const testoCella = cella.testo.startsWith("'") && cella.testo.length > 1 ? cella.testo.slice(1) : cella.testo; // l'apostrofo iniziale forza il testo: non fa parte del testo
        let i = indiciStringhe.get(testoCella);
        if (i === undefined) { i = stringhe.length; stringhe.push(testoCella); indiciStringhe.set(testoCella, i); }
        nelle.push({ colonna, xml: elemento('c', { r: ref, s, t: 's' }, [elemento('v', {}, [String(i)])]) });
      }
    }
    nelle.sort((x, y) => x.colonna - y.colonna);
    const stileRiga = f.stiliRiga[n];
    const xfRiga = stileRiga ? stili.indice(stileRiga) : 0;
    const altezza = f.altezze[n];
    return elemento('row', {
      r: n, s: xfRiga !== 0 ? xfRiga : undefined, customFormat: xfRiga !== 0 ? 1 : undefined,
      ht: typeof altezza === 'number' && altezza > 0 ? arrotonda(altezza * 0.75) : undefined, customHeight: typeof altezza === 'number' && altezza > 0 ? 1 : undefined,
      hidden: nascoste.has(n) ? 1 : undefined,
      outlineLevel: livelliRiga[n] ? livelliRiga[n] : undefined,
    }, nelle.map((x) => x.xml));
  };
  const datiRighe = [...righe].sort((x, y) => x - y).map(riga);

  const colonne = new Set<number>();
  for (const k of Object.keys(f.larghezze)) if (intero(Number(k), 1, MAX_COLS)) colonne.add(Number(k));
  for (const k of Object.keys(f.stiliColonna)) if (intero(Number(k), 1, MAX_COLS)) colonne.add(Number(k));
  const colonneNascoste = new Set((f.colonneNascoste ?? []).filter((n) => intero(n, 1, MAX_COLS)));
  for (const n of colonneNascoste) colonne.add(n);
  const livelliColonna = f.gruppi?.colonne ?? {};
  for (const k of Object.keys(livelliColonna)) if (intero(Number(k), 1, MAX_COLS)) colonne.add(Number(k));
  const elencoColonne = [...colonne].sort((x, y) => x - y).map((n) => {
    const larghezza = f.larghezze[n];
    const ha = typeof larghezza === 'number' && larghezza > 0;
    const xf = f.stiliColonna[n] ? stili.indice(f.stiliColonna[n]) : 0;
    return elemento('col', { min: n, max: n, width: ha ? Math.max(0, arrotonda((larghezza - 5) / 7)) : 8.43, customWidth: ha ? 1 : undefined, style: xf !== 0 ? xf : undefined, hidden: colonneNascoste.has(n) ? 1 : undefined, outlineLevel: livelliColonna[n] ? livelliColonna[n] : undefined });
  });

  const rc = intero(f.righeCongelate, 0, MAX_ROWS) ? f.righeCongelate : 0;
  const cc = intero(f.colonneCongelate, 0, MAX_COLS) ? f.colonneCongelate : 0;
  const pannello = rc > 0 || cc > 0
    ? [elemento('pane', {
      xSplit: cc > 0 ? cc : undefined, ySplit: rc > 0 ? rc : undefined, topLeftCell: indirizzoCella(rc + 1, cc + 1),
      activePane: rc > 0 && cc > 0 ? 'bottomRight' : rc > 0 ? 'bottomLeft' : 'topRight', state: 'frozen',
    })]
    : [];
  const unioni = f.unioni
    .filter((m) => intero(m.startRow, 1, MAX_ROWS) && intero(m.endRow, 1, MAX_ROWS) && intero(m.startCol, 1, MAX_COLS) && intero(m.endCol, 1, MAX_COLS)
      && m.startRow <= m.endRow && m.startCol <= m.endCol && !(m.startRow === m.endRow && m.startCol === m.endCol))
    .map((m) => elemento('mergeCell', { ref: `${indirizzoCella(m.startRow, m.startCol)}:${indirizzoCella(m.endRow, m.endCol)}` }));

  const dimensione = maxR > 0 ? `${indirizzoCella(minR, minC)}:${indirizzoCella(maxR, maxC)}` : 'A1';
  const condizionali = condizionaliXml(f, (st) => stili.dxf(st));
  return INTESTAZIONE_XML + elemento('worksheet', { xmlns: NS_PRINCIPALE, 'xmlns:r': NS_RELAZIONI }, [
    ...(sheetPrFigli(f).length > 0 ? [elemento('sheetPr', {}, sheetPrFigli(f))] : []),
    elemento('dimension', { ref: dimensione }),
    elemento('sheetViews', {}, [elemento('sheetView', { tabSelected: attivo ? 1 : undefined, workbookViewId: 0 }, pannello)]),
    elemento('sheetFormatPr', { defaultRowHeight: 15, outlineLevelRow: livelloMassimo(f.gruppi, 'righe') || undefined, outlineLevelCol: livelloMassimo(f.gruppi, 'colonne') || undefined }),
    ...(elencoColonne.length > 0 ? [elemento('cols', {}, elencoColonne)] : []),
    elemento('sheetData', {}, datiRighe),
    ...(f.protezione ? [elemento('sheetProtection', { ...attributiImpronta(f.protezione.impronte, ''), sheet: 1, objects: 1, scenarios: 1 })] : []),
    ...autoFiltroXml(f),
    ...(unioni.length > 0 ? [elemento('mergeCells', { count: unioni.length }, unioni)] : []),
    ...condizionali,
    ...convalideXml(f),
    ...collegamentiXml(collegamentiFoglio(f)),
    ...paginaXml(f),
    ...(haDisegno ? [elemento('drawing', { 'r:id': 'rIdD1' })] : []),
    ...(haCommenti ? [elemento('legacyDrawing', { 'r:id': 'rId1' })] : []),
  ]);
}

/** I figli di <sheetPr>, nell'ordine dello schema: colore della scheda, poi l'adatta a pagine. */
function sheetPrFigli(f: FoglioScambio): string[] {
  return [
    ...(typeof f.colore === 'string' && /^#[0-9a-fA-F]{6}$/.test(f.colore) ? [elemento('tabColor', { rgb: `FF${f.colore.slice(1).toUpperCase()}` })] : []),
    ...sheetPrPagina(f),
  ];
}

/** Dal modello di scambio ai byte di un file .xlsx. Stesso contenuto, stessi byte. */
export async function scriviXlsx(s: Scambio): Promise<Uint8Array> {
  const origine = s.fogli.length > 0 ? s.fogli : [foglioVuoto(NOME_FOGLIO_PREDEFINITO)];
  const nomi = nomiFoglioXlsx(origine.map((f) => f.nome));
  const indiceAttivo = Math.max(0, origine.findIndex((f) => f.nome === s.foglioAttivo));
  const stili = new TabellaStili();
  const stringhe: string[] = [];
  const indiciStringhe = new Map<string, number>();
  const conCommenti = origine.map((f) => commentiXml(f) !== null);
  const immaginiFoglio = origine.map(immaginiPerExcel);
  const conDisegno = immaginiFoglio.map((l) => l.length > 0);
  const pagine = origine.map((f, i) => fogliXml(f, i === indiceAttivo, stili, stringhe, indiciStringhe, conCommenti[i], conDisegno[i]));
  // i byte delle immagini: un file per immagine in xl/media, numerati su tutto il libro
  let contaMedia = 0;
  const mediaFoglio = immaginiFoglio.map((l) => l.map((im) => { contaMedia++; return { im, nome: `image${contaMedia}.${estensioneImmagine(im.tipo)}` }; }));
  const estensioniUsate = new Set(mediaFoglio.flat().map((m) => estensioneImmagine(m.im.tipo)));
  const n = origine.length;
  const nomiNelFile = new Map(origine.map((f, i) => [f.nome, nomi[i]] as const));

  const tipiContenuto = INTESTAZIONE_XML + elemento('Types', { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' }, [
    elemento('Default', { Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' }),
    elemento('Default', { Extension: 'xml', ContentType: 'application/xml' }),
    ...(conCommenti.some(Boolean) ? [elemento('Default', { Extension: 'vml', ContentType: 'application/vnd.openxmlformats-officedocument.vmlDrawing' })] : []),
    ...[...estensioniUsate].map((e) => elemento('Default', { Extension: e, ContentType: `image/${e}` })),
    elemento('Override', { PartName: '/xl/workbook.xml', ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml' }),
    ...origine.map((_, i) => elemento('Override', { PartName: `/xl/worksheets/sheet${i + 1}.xml`, ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml' })),
    ...origine.flatMap((_, i) => (conDisegno[i] ? [elemento('Override', { PartName: `/xl/drawings/drawing${i + 1}.xml`, ContentType: 'application/vnd.openxmlformats-officedocument.drawing+xml' })] : [])),
    ...origine.flatMap((_, i) => (conCommenti[i] ? [elemento('Override', { PartName: `/xl/comments${i + 1}.xml`, ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml' })] : [])),
    elemento('Override', { PartName: '/xl/styles.xml', ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml' }),
    elemento('Override', { PartName: '/xl/sharedStrings.xml', ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml' }),
  ]);
  const relazioniRadice = INTESTAZIONE_XML + elemento('Relationships', { xmlns: NS_PACCHETTO }, [
    elemento('Relationship', { Id: 'rId1', Type: `${NS_RELAZIONI}/officeDocument`, Target: 'xl/workbook.xml' }),
  ]);
  const cartella = INTESTAZIONE_XML + elemento('workbook', { xmlns: NS_PRINCIPALE, 'xmlns:r': NS_RELAZIONI }, [
    ...(s.protezioneCartella ? [elemento('workbookProtection', { ...attributiImpronta(s.protezioneCartella.impronte, 'workbook'), lockStructure: 1 })] : []),
    elemento('bookViews', {}, [elemento('workbookView', { activeTab: indiceAttivo })]),
    elemento('sheets', {}, nomi.map((nome, i) => elemento('sheet', { name: nome, sheetId: i + 1, state: origine[i].nascosto && i !== indiceAttivo ? 'hidden' : undefined, 'r:id': `rId${i + 1}` }))),
    ...nomiXml(s.nomi ?? [], nomiNelFile, origine.flatMap((f, i) => (f.filtro ? [{ indice: i, foglio: nomi[i], area: f.filtro.area }] : [])), nomiStampaXml(origine, nomi)),
    elemento('calcPr', { calcId: 191029, fullCalcOnLoad: 1 }),
  ]);
  const relazioniCartella = INTESTAZIONE_XML + elemento('Relationships', { xmlns: NS_PACCHETTO }, [
    ...origine.map((_, i) => elemento('Relationship', { Id: `rId${i + 1}`, Type: `${NS_RELAZIONI}/worksheet`, Target: `worksheets/sheet${i + 1}.xml` })),
    elemento('Relationship', { Id: `rId${n + 1}`, Type: `${NS_RELAZIONI}/styles`, Target: 'styles.xml' }),
    elemento('Relationship', { Id: `rId${n + 2}`, Type: `${NS_RELAZIONI}/sharedStrings`, Target: 'sharedStrings.xml' }),
  ]);
  const stringheCondivise = INTESTAZIONE_XML + elemento('sst', { xmlns: NS_PRINCIPALE, count: stringhe.length, uniqueCount: stringhe.length },
    stringhe.map((t) => elemento('si', {}, [elemento('t', { 'xml:space': 'preserve' }, [escapaXml(t)])])));

  const codifica = new TextEncoder();
  const voce = (nome: string, testo: string): VoceZip => ({ nome, dati: codifica.encode(testo) });
  return scriviZip([
    voce('[Content_Types].xml', tipiContenuto),
    voce('_rels/.rels', relazioniRadice),
    voce('xl/workbook.xml', cartella),
    voce('xl/_rels/workbook.xml.rels', relazioniCartella),
    voce('xl/styles.xml', stili.xml()),
    voce('xl/sharedStrings.xml', stringheCondivise),
    ...pagine.map((p, i) => voce(`xl/worksheets/sheet${i + 1}.xml`, p)),
    ...origine.flatMap((f, i) => {
      const links = collegamentiFoglio(f);
      if (!conCommenti[i] && links.length === 0 && !conDisegno[i]) return [];
      return [
        ...(conDisegno[i] ? [
          voce(`xl/drawings/drawing${i + 1}.xml`, disegnoXml(mediaFoglio[i].map((m) => m.im), (k) => `rId${k + 1}`)),
          voce(`xl/drawings/_rels/drawing${i + 1}.xml.rels`, INTESTAZIONE_XML + elemento('Relationships', { xmlns: NS_PACCHETTO }, mediaFoglio[i].map((m, k) => elemento('Relationship', { Id: `rId${k + 1}`, Type: `${NS_RELAZIONI}/image`, Target: `../media/${m.nome}` })))),
          ...mediaFoglio[i].map((m): VoceZip => ({ nome: `xl/media/${m.nome}`, dati: m.im.byte })),
        ] : []),
        ...(conCommenti[i] ? [
          voce(`xl/comments${i + 1}.xml`, commentiXml(f) as string),
          voce(`xl/drawings/vmlDrawing${i + 1}.vml`, vmlCommentiXml(f)),
        ] : []),
        voce(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, INTESTAZIONE_XML + elemento('Relationships', { xmlns: NS_PACCHETTO }, [
          ...(conCommenti[i] ? [
            elemento('Relationship', { Id: 'rId1', Type: `${NS_RELAZIONI}/vmlDrawing`, Target: `../drawings/vmlDrawing${i + 1}.vml` }),
            elemento('Relationship', { Id: 'rId2', Type: `${NS_RELAZIONI}/comments`, Target: `../comments${i + 1}.xml` }),
          ] : []),
          ...relazioniCollegamenti(links, `${NS_RELAZIONI}/hyperlink`),
          ...(conDisegno[i] ? [elemento('Relationship', { Id: 'rIdD1', Type: `${NS_RELAZIONI}/drawing`, Target: `../drawings/drawing${i + 1}.xml` })] : []),
        ])),
      ];
    }),
  ]);
}
