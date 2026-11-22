// Lettura di file .xlsx (Excel, Google Fogli, LibreOffice) nel modello di scambio. Puro: riceve i byte, non tocca il disco.
// Valori: i numeri restano numeri (le date sono numeri seriali con il loro formato), i testi che sembrano numeri o booleani
// ricevono il formato Testo per restare testi, le formule si importano col nome inglese (senza i prefissi _xlfn.) e senza valore in cache.
// Si importano anche: righe e colonne nascoste, convalide dei dati, formattazioni condizionali (le regole che l'app conosce), commenti, nomi definiti semplici.
// Non si importano: grafici, immagini, tabelle pivot, filtri automatici, collegamenti, rientro e rotazione del testo, colori del tema (avvisi).
// Limite: i nomi degli elementi XML senza prefisso (come li scrivono Excel e Google Fogli); file con prefissi tipo "x:worksheet" non sono letti.
import { impronteValide } from '@comune/protezione/impronte';
import type { ProtezioneFoglio } from '../sheet/protezione';
import { leggiZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, testoXml, trova, type NodoXml } from '@comune/formati/xml';
import type { BorderDef, BorderSet, CellStyle } from '../sheet/styles';
import { MAX_COLS, MAX_ROWS, columnIndexToLetters, parseCellAddress } from '../engine/address';
import { shiftFormula } from '../engine/shift-formula';
import type { FoglioScambio, Scambio } from './scambio';
import { leggiDisegno } from './xlsx-immagini';
import { leggiNomiStampa, leggiPaginaXlsx, unisciPagina } from './xlsx-pagina';
import { elencoControlli, leggiControlli, leggiIntervallo, type ControlliLetti } from './xlsx-controlli';
import { leggiMacro, nomeMacro, type MacroLetta } from './vba';
import type { PulsanteScambio } from '../sheet/pulsanti';
import { leggiAutoFiltro, leggiCollegamenti, leggiCommenti, leggiCondizionali, leggiConvalide, leggiDxfs, leggiNomi } from './xlsx-extra';
import { NOME_FOGLIO_PREDEFINITO, foglioVuoto, indirizzoCella } from './scambio';
import { tipoLetterale } from './xlsx-scrivi';
import { t } from '../i18n/lingua';

/** La protezione di un foglio o della cartella dagli attributi di Excel: impronta SHA-512 (con il prefisso «workbook» per la cartella)
 *  o la password vecchia a 16 bit; altri algoritmi non si sanno controllare e la protezione resta senza password. */
function protezioneDaAttributi(a: Record<string, string>, prefisso: '' | 'workbook'): ProtezioneFoglio {
  const p = (k: string): string => (prefisso === '' ? k : prefisso + k.charAt(0).toUpperCase() + k.slice(1));
  const alg = a[p('algorithmName')];
  if (alg === 'SHA-512' && a[p('hashValue')] && a[p('saltValue')] !== undefined) {
    const impronte = impronteValide([{ alg: 'SHA-512', hash: a[p('hashValue')], sale: a[p('saltValue')], giri: Number(a[p('spinCount')] ?? 100000) }]);
    return impronte ? { impronte } : {};
  }
  const vecchia = a[prefisso === '' ? 'password' : 'workbookPassword'];
  if (vecchia) { const impronte = impronteValide([{ alg: 'legacy', hash: vecchia }]); return impronte ? { impronte } : {}; }
  return {};
}

export interface RisultatoXlsx { scambio: Scambio; avvisi: string[] }

const MAX_COLONNE_PER_INTERVALLO = 1000;
const DECODIFICA = new TextDecoder();

export const FORMATI_INTEGRATI: Record<number, string> = {
  1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 14: 'dd/mm/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy',
  18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'hh:mm', 21: 'hh:mm:ss', 22: 'dd/mm/yyyy hh:mm', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 49: '@',
  // formati integrati che i file spesso usano senza scriverli (frazioni, contabilità con le parentesi, scientifico)
  12: '# ?/?', 13: '# ??/??', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 48: '##0.0E+0',
};

const elenco = (n: NodoXml | undefined, nome: string): NodoXml[] => (n ? figliElemento(n, nome) : []);
const vero = (v: string | undefined): boolean => v === '1' || v === 'true';
const vuoto = (s: CellStyle | undefined): boolean => s === undefined || Object.keys(s).length === 0;
const copia = (s: CellStyle): CellStyle => JSON.parse(JSON.stringify(s)) as CellStyle;
const intero = (v: number, min: number, max: number): boolean => Number.isInteger(v) && v >= min && v <= max;

/** Colore ARGB o RGB del file come "#rrggbb"; i colori del tema o a indice non si importano. */
function colore(n: NodoXml | undefined): string | undefined {
  const rgb = n?.attributi.rgb;
  if (rgb !== undefined && /^[0-9a-fA-F]{8}$/.test(rgb)) return `#${rgb.slice(2).toLowerCase()}`;
  if (rgb !== undefined && /^[0-9a-fA-F]{6}$/.test(rgb)) return `#${rgb.toLowerCase()}`;
  return undefined;
}

/** Formato numerico come lo usa Fogli: il simbolo dell'euro tra virgolette o tra parentesi quadre torna semplice. */
export function codiceFormatoFogli(codice: string): string {
  return codice.replace(/\[\$€[^\]]*\]/g, '€').replace(/"€"/g, '€');
}

/** Vero se il formato mostra date od orari (serve a correggere i file col calendario 1904). */
export function eFormatoData(codice: string): boolean {
  return /[dmyhs]/i.test(codice.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''));
}

const LATI_BORDO: Record<string, BorderDef['style']> = {
  thin: 'thin', double: 'thin', medium: 'medium', thick: 'medium',
  dashed: 'dashed', dotted: 'dashed', hair: 'dashed', dashDot: 'dashed', dashDotDot: 'dashed', mediumDashed: 'dashed', mediumDashDot: 'dashed', mediumDashDotDot: 'dashed', slantDashDot: 'dashed',
};

interface TabellaStili { xf: CellStyle[]; data: boolean[]; rientroORotazione?: boolean }

function leggiStili(st: NodoXml | undefined): TabellaStili {
  if (!st) return { xf: [], data: [] };
  const personalizzati = new Map<number, string>();
  for (const n of elenco(trova(st, 'numFmts'), 'numFmt')) {
    const id = Number(n.attributi.numFmtId);
    if (Number.isInteger(id) && n.attributi.formatCode !== undefined) personalizzati.set(id, n.attributi.formatCode);
  }
  const caratteri = elenco(trova(st, 'fonts'), 'font');
  const riempimenti = elenco(trova(st, 'fills'), 'fill');
  const bordi = elenco(trova(st, 'borders'), 'border');
  const base = caratteri[0];
  const nomeBase = base ? trova(base, 'name')?.attributi.val : undefined;
  const dimensioneBase = base ? Number(trova(base, 'sz')?.attributi.val) : NaN;
  const acceso = (n: NodoXml | undefined): boolean => n !== undefined && n.attributi.val !== '0' && n.attributi.val !== 'false';

  const xf: CellStyle[] = [];
  const data: boolean[] = [];
  let rientroORotazione = false;
  for (const x of elenco(trova(st, 'cellXfs'), 'xf')) {
    const s: CellStyle = {};
    const f = caratteri[Number(x.attributi.fontId)];
    if (f) {
      if (acceso(trova(f, 'b'))) s.bold = true;
      if (acceso(trova(f, 'i'))) s.italic = true;
      if (acceso(trova(f, 'strike'))) s.strike = true;
      const u = trova(f, 'u');
      if (u && u.attributi.val !== 'none') s.underline = true;
      const nome = trova(f, 'name')?.attributi.val;
      if (nome !== undefined && nome !== '' && nome !== nomeBase) s.fontFamily = nome;
      const dimensione = Number(trova(f, 'sz')?.attributi.val);
      if (Number.isFinite(dimensione) && dimensione > 0 && dimensione !== dimensioneBase) s.fontSize = dimensione;
      const c = colore(trova(f, 'color'));
      if (c) s.color = c;
    }
    const riempimento = riempimenti[Number(x.attributi.fillId)];
    const motivo = riempimento ? trova(riempimento, 'patternFill') : undefined;
    if (motivo && motivo.attributi.patternType === 'solid') {
      const c = colore(trova(motivo, 'fgColor'));
      if (c) s.fill = c;
    }
    const bordo = bordi[Number(x.attributi.borderId)];
    if (bordo) {
      const lati: BorderSet = {};
      for (const lato of ['left', 'right', 'top', 'bottom'] as const) {
        const n = trova(bordo, lato);
        const stile = n ? LATI_BORDO[n.attributi.style ?? ''] : undefined;
        if (n && stile) lati[lato] = { style: stile, color: colore(trova(n, 'color')) ?? '#000000' };
      }
      if (Object.keys(lati).length > 0) s.borders = lati;
    }
    const a = trova(x, 'alignment');
    if (a && (Number(a.attributi.indent ?? 0) > 0 || Number(a.attributi.textRotation ?? 0) !== 0)) rientroORotazione = true;
    if (a) {
      const o = a.attributi.horizontal;
      if (o === 'left' || o === 'right') s.hAlign = o;
      else if (o === 'center' || o === 'centerContinuous') s.hAlign = 'center';
      const v = a.attributi.vertical;
      if (v === 'top') s.vAlign = 'top';
      else if (v === 'center') s.vAlign = 'middle';
      else if (v === 'bottom') s.vAlign = 'bottom';
      if (vero(a.attributi.wrapText)) s.wrap = true;
    }
    // protezione della cella: di serie bloccata e con la formula visibile
    const pr = trova(x, 'protection');
    if (pr) {
      if (pr.attributi.locked !== undefined && !vero(pr.attributi.locked)) s.sbloccata = true;
      if (vero(pr.attributi.hidden)) s.formulaNascosta = true;
    }
    const idFormato = Number(x.attributi.numFmtId ?? 0);
    const codice = personalizzati.get(idFormato) ?? FORMATI_INTEGRATI[idFormato];
    if (codice !== undefined && codice !== '' && codice.toLowerCase() !== 'general') s.numFmt = codiceFormatoFogli(codice);
    xf.push(s);
    data.push(codice !== undefined && eFormatoData(codice));
  }
  return { xf, data, rientroORotazione };
}

/** Testo di una stringa condivisa: i frammenti formattati si uniscono, la pronuncia (rPh) si scarta. */
function testoStringa(si: NodoXml): string {
  let s = '';
  for (const f of si.figli) {
    if (typeof f === 'string') continue;
    if (f.nome === 't') s += testoXml(f);
    else if (f.nome === 'r') { const t = trova(f, 't'); if (t) s += testoXml(t); }
  }
  return s;
}

/** Toglie i prefissi _xlfn. e _xlws. delle funzioni recenti e _xlpm. dei parametri di LAMBDA e LET (fuori dai testi tra virgolette). */
export function senzaPrefissi(formula: string): string {
  return formula.split(/("(?:[^"]|"")*")/).map((parte, i) => (i % 2 === 1 ? parte : parte.replace(/_xl(?:fn|ws|pm)\./g, ''))).join('');
}

interface Contesto { stringhe: string[]; stili: TabellaStili; calendario1904: boolean }

function valoreCella(x: NodoXml, tipo: string, c: Contesto, data: boolean): string | undefined {
  if (tipo === 'inlineStr') { const i = trova(x, 'is'); return i ? testoStringa(i) : undefined; }
  const v = trova(x, 'v');
  if (!v) return undefined;
  const vt = testoXml(v);
  switch (tipo) {
    case 's': return c.stringhe[Number(vt)];
    case 'str': case 'e': return vt;
    case 'b': return vt.trim() === '1' || vt.trim().toLowerCase() === 'true' ? 'TRUE' : 'FALSE';
    case 'd': {
      const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(vt.trim()) ? `${vt.trim()}T00:00:00Z` : /Z$|[+-]\d{2}:\d{2}$/.test(vt.trim()) ? vt.trim() : `${vt.trim()}Z`);
      return Number.isFinite(ms) ? String(ms / 86_400_000 + 25569) : vt;
    }
    default: {
      if (vt.trim() === '') return undefined;
      const n = Number(vt.trim());
      return Number.isFinite(n) ? String(c.calendario1904 && data ? n + 1462 : n) : vt;
    }
  }
}

function intervallo(rif: string): { startRow: number; endRow: number; startCol: number; endCol: number } | null {
  const parti = rif.split(':');
  if (parti.length !== 2) return null;
  const a = parseCellAddress(parti[0]);
  const b = parseCellAddress(parti[1]);
  if (!a || !b) return null;
  const m = { startRow: Math.min(a.row, b.row), endRow: Math.max(a.row, b.row), startCol: Math.min(a.col, b.col), endCol: Math.max(a.col, b.col) };
  return m.startRow === m.endRow && m.startCol === m.endCol ? null : m;
}

function leggiFoglio(nome: string, radice: NodoXml | undefined, c: Contesto): FoglioScambio {
  const f = foglioVuoto(nome);
  if (!radice) return f;
  const condivise = new Map<string, { testo: string; riga: number; colonna: number }>();
  let rigaPrecedente = 0;
  for (const r of elenco(trova(radice, 'sheetData'), 'row')) {
    const numero = Number(r.attributi.r);
    const riga = intero(numero, 1, Infinity) ? numero : rigaPrecedente + 1;
    rigaPrecedente = riga;
    if (riga > MAX_ROWS) continue;
    if (vero(r.attributi.hidden)) (f.righeNascoste ??= []).push(riga);
    const livelloR = Number(r.attributi.outlineLevel);
    if (Number.isInteger(livelloR) && livelloR >= 1 && livelloR <= 7) ((f.gruppi ??= { righe: {}, colonne: {} }).righe[riga] = livelloR);
    if (vero(r.attributi.customFormat)) {
      const st = c.stili.xf[Number(r.attributi.s)];
      if (st && !vuoto(st)) f.stiliRiga[riga] = copia(st);
    }
    const ht = Number(r.attributi.ht);
    if (vero(r.attributi.customHeight) && Number.isFinite(ht) && ht > 0) f.altezze[riga] = Math.round(ht / 0.75);
    let colonnaPrecedente = 0;
    for (const x of elenco(r, 'c')) {
      const coord = x.attributi.r !== undefined ? parseCellAddress(x.attributi.r) : null;
      if (x.attributi.r !== undefined && !coord) continue;
      const colonna = coord ? coord.col : colonnaPrecedente + 1;
      const rigaCella = coord ? coord.row : riga;
      colonnaPrecedente = colonna;
      if (colonna > MAX_COLS || rigaCella > MAX_ROWS) continue;
      const tipo = x.attributi.t ?? 'n';
      const indiceStile = Number(x.attributi.s ?? 0);
      const stile = c.stili.xf[indiceStile] ?? {};
      let testo: string | undefined;
      const nodoFormula = trova(x, 'f');
      if (nodoFormula) {
        const corpo = senzaPrefissi(testoXml(nodoFormula).trim());
        const si = nodoFormula.attributi.si;
        if (nodoFormula.attributi.t === 'shared' && si !== undefined) {
          if (corpo !== '') { condivise.set(si, { testo: corpo, riga: rigaCella, colonna }); testo = `=${corpo}`; }
          else {
            const madre = condivise.get(si);
            if (madre) { try { testo = shiftFormula(`=${madre.testo}`, rigaCella - madre.riga, colonna - madre.colonna); } catch { testo = undefined; } }
          }
        } else if (corpo !== '') testo = `=${corpo}`;
      }
      if (testo === undefined) testo = valoreCella(x, tipo, c, c.stili.data[indiceStile] === true);
      const ref = indirizzoCella(rigaCella, colonna);
      let finale = stile;
      if (testo !== undefined && testo !== '') {
        f.celle[ref] = testo;
        const letterale = tipoLetterale(testo);
        if ((tipo === 's' || tipo === 'str' || tipo === 'inlineStr') && (letterale === 'numero' || letterale === 'booleano')) finale = { ...stile, numFmt: '@' };
      }
      if (!vuoto(finale)) f.stili[ref] = copia(finale);
    }
  }

  for (const col of elenco(trova(radice, 'cols'), 'col')) {
    const da = Number(col.attributi.min);
    const a = Math.min(Number(col.attributi.max), MAX_COLS);
    if (!intero(da, 1, MAX_COLS) || !(a >= da) || a - da + 1 > MAX_COLONNE_PER_INTERVALLO) continue;
    const larghezza = Number(col.attributi.width);
    const st = col.attributi.style !== undefined ? c.stili.xf[Number(col.attributi.style)] : undefined;
    for (let n = da; n <= a; n++) {
      if (vero(col.attributi.hidden)) (f.colonneNascoste ??= []).push(n);
      const livelloC = Number(col.attributi.outlineLevel);
      if (Number.isInteger(livelloC) && livelloC >= 1 && livelloC <= 7) ((f.gruppi ??= { righe: {}, colonne: {} }).colonne[n] = livelloC);
      if (vero(col.attributi.customWidth) && Number.isFinite(larghezza) && larghezza > 0) f.larghezze[n] = Math.round(larghezza * 7 + 5);
      if (st && !vuoto(st)) f.stiliColonna[n] = copia(st);
    }
  }

  for (const m of elenco(trova(radice, 'mergeCells'), 'mergeCell')) {
    const u = m.attributi.ref !== undefined ? intervallo(m.attributi.ref) : null;
    if (u) f.unioni.push(u);
  }

  const pagina = leggiPaginaXlsx(radice);
  if (pagina) f.pagina = pagina;

  const protetto = trova(radice, 'sheetProtection');
  if (protetto && protetto.attributi.sheet !== undefined && vero(protetto.attributi.sheet)) f.protezione = protezioneDaAttributi(protetto.attributi, '');

  const coloreTab = trova(radice, 'sheetPr/tabColor')?.attributi.rgb;
  if (typeof coloreTab === 'string' && /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(coloreTab)) f.colore = `#${coloreTab.slice(-6).toLowerCase()}`;

  const pannello = trova(radice, 'sheetViews/sheetView/pane');
  if (pannello && (pannello.attributi.state === 'frozen' || pannello.attributi.state === 'frozenSplit')) {
    const colonne = Math.floor(Number(pannello.attributi.xSplit ?? 0));
    const righe = Math.floor(Number(pannello.attributi.ySplit ?? 0));
    if (intero(colonne, 0, MAX_COLS)) f.colonneCongelate = colonne;
    if (intero(righe, 0, MAX_ROWS)) f.righeCongelate = righe;
  }
  return f;
}

/** Percorso di una parte del pacchetto a partire dalla cartella della parte che la cita. */
function risolvi(cartella: string, destinazione: string): string {
  const uscita: string[] = [];
  for (const p of (destinazione.startsWith('/') ? destinazione.slice(1) : cartella + destinazione).split('/')) {
    if (p === '..') uscita.pop();
    else if (p !== '.' && p !== '') uscita.push(p);
  }
  return uscita.join('/');
}

async function leggi(bytes: Uint8Array): Promise<RisultatoXlsx> {
  const voci = await leggiZip(bytes);
  const parte = (nome: string): NodoXml | undefined => {
    const d = voci.get(nome);
    return d ? analizzaXml(DECODIFICA.decode(d)) : undefined;
  };
  let nomeCartella = 'xl/workbook.xml';
  const principale = elenco(parte('_rels/.rels'), 'Relationship').find((r) => r.attributi.Type?.endsWith('/officeDocument'));
  if (principale?.attributi.Target) nomeCartella = risolvi('', principale.attributi.Target);
  const cartella = parte(nomeCartella);
  if (!cartella) throw new Error(t("File .xlsx non valido: manca la cartella di lavoro"));
  const dir = nomeCartella.slice(0, nomeCartella.lastIndexOf('/') + 1);
  const relazioni = new Map<string, { tipo: string; destinazione: string }>();
  for (const r of elenco(parte(`${dir}_rels/${nomeCartella.slice(dir.length)}.rels`), 'Relationship')) {
    if (r.attributi.Id !== undefined && r.attributi.Target !== undefined) relazioni.set(r.attributi.Id, { tipo: r.attributi.Type ?? '', destinazione: risolvi(dir, r.attributi.Target) });
  }
  const parteDiTipo = (fine: string, predefinita: string): string => [...relazioni.values()].find((r) => r.tipo.endsWith(fine))?.destinazione ?? predefinita;

  const stringhe = elenco(parte(parteDiTipo('/sharedStrings', `${dir}sharedStrings.xml`)), 'si').map(testoStringa);
  const nodoStili = parte(parteDiTipo('/styles', `${dir}styles.xml`));
  const dxfs = leggiDxfs(nodoStili);
  const contesto: Contesto = {
    stringhe,
    stili: leggiStili(nodoStili),
    calendario1904: vero(trova(cartella, 'workbookPr')?.attributi.date1904),
  };

  const fogli: FoglioScambio[] = [];
  const nomiInOrdine: string[] = [];
  let condizionaliNonImportate = 0;
  let filtri = false;
  let collegamenti = false;
  let immaginiScartate = 0;
  let altriDisegni = false;
  const nascosti: string[] = [];
  // controlli modulo (caselle combinate, pulsanti) per foglio: le tendine si completano dopo, quando ci sono tutti i fogli (l'elenco può stare su un altro)
  const controlliFogli = new Map<FoglioScambio, ControlliLetti>();
  for (const s of elenco(trova(cartella, 'sheets'), 'sheet')) {
    const nome = s.attributi.name ?? `Foglio${nomiInOrdine.length + 1}`;
    nomiInOrdine.push(nome);
    const rel = s.attributi['r:id'] !== undefined ? relazioni.get(s.attributi['r:id']) : undefined;
    if (!rel || !rel.tipo.endsWith('/worksheet')) continue;
    const radice = parte(rel.destinazione);
    const foglio = leggiFoglio(nome, radice, contesto);
    if (radice) {
      const convalide = leggiConvalide(radice);
      if (convalide.length > 0) foglio.convalide = convalide;
      const { regole, nonImportate } = leggiCondizionali(radice, dxfs);
      if (regole.length > 0) foglio.condizionali = regole;
      condizionaliNonImportate += nonImportate;
      const autoFiltro = leggiAutoFiltro(radice);
      if (autoFiltro.filtro) foglio.filtro = autoFiltro.filtro;
      if (autoFiltro.nonImportati > 0) filtri = true;
      // commenti: la parte dei commenti è indicata dalle relazioni del foglio
      const cartellaFoglio = rel.destinazione.slice(0, rel.destinazione.lastIndexOf('/') + 1);
      const nomeRel = `${cartellaFoglio}_rels/${rel.destinazione.slice(cartellaFoglio.length)}.rels`;
      const relazioniFoglio = elenco(parte(nomeRel), 'Relationship');
      const destinazioni = new Map<string, string>();
      for (const r of relazioniFoglio) if (r.attributi.Id !== undefined && r.attributi.Type?.endsWith('/hyperlink') && r.attributi.TargetMode === 'External' && r.attributi.Target) destinazioni.set(r.attributi.Id, r.attributi.Target);
      const { link, scartati } = leggiCollegamenti(radice, destinazioni);
      for (const l of link) { const a = indirizzoCella(l.riga, l.colonna); foglio.stili[a] = { ...foglio.stili[a], link: l.url }; }
      if (scartati > 0) collegamenti = true;
      // immagini: il disegno del foglio e i byte indicati dalle sue relazioni
      const relDisegno = relazioniFoglio.find((r) => r.attributi.Type?.endsWith('/drawing'));
      if (relDisegno?.attributi.Target) try {
        const percorso = risolvi(cartellaFoglio, relDisegno.attributi.Target);
        const cartellaDisegno = percorso.slice(0, percorso.lastIndexOf('/') + 1);
        const mediaDelDisegno = new Map<string, string>();
        for (const r of elenco(parte(`${cartellaDisegno}_rels/${percorso.slice(cartellaDisegno.length)}.rels`), 'Relationship')) {
          if (r.attributi.Id !== undefined && r.attributi.Target && r.attributi.Type?.endsWith('/image')) mediaDelDisegno.set(r.attributi.Id, risolvi(cartellaDisegno, r.attributi.Target));
        }
        const esito = leggiDisegno(parte(percorso), (id) => { const p = mediaDelDisegno.get(id); return p === undefined ? undefined : voci.get(p); }, foglio);
        if (esito.immagini.length > 0) foglio.immagini = esito.immagini;
        immaginiScartate += esito.scartate;
        if (esito.altri) altriDisegni = true;
      } catch {
        altriDisegni = true; // un disegno rovinato non deve far rifiutare il file: si apre senza di lui e lo si dice
      }
      // controlli modulo: proprietà in xl/ctrlProps, testo dei pulsanti nel disegno VML del foglio
      if (elencoControlli(radice)) try {
        const proprieta = new Map<string, string>();
        for (const r of relazioniFoglio) if (r.attributi.Id !== undefined && r.attributi.Target && r.attributi.Type?.endsWith('/ctrlProp')) proprieta.set(r.attributi.Id, risolvi(cartellaFoglio, r.attributi.Target));
        const relVml = relazioniFoglio.find((r) => r.attributi.Type?.endsWith('/vmlDrawing'));
        const byteVml = relVml?.attributi.Target ? voci.get(risolvi(cartellaFoglio, relVml.attributi.Target)) : undefined;
        const vml = byteVml && byteVml.length < 8 * 1024 * 1024 ? new TextDecoder('utf-8').decode(byteVml) : undefined;
        const letti = leggiControlli(radice, (id) => { const pp = proprieta.get(id); const nodo = pp ? parte(pp) : undefined; return nodo; }, vml, foglio);
        if (letti.tendine.length + letti.pulsanti.length + letti.altri + letti.collegate > 0) controlliFogli.set(foglio, letti);
      } catch { /* controlli rovinati: il foglio si apre senza */ }
      const relCommenti = relazioniFoglio.find((r) => r.attributi.Type?.endsWith('/comments'));
      if (relCommenti?.attributi.Target) {
        const commenti = leggiCommenti(parte(risolvi(cartellaFoglio, relCommenti.attributi.Target)));
        if (commenti.length > 0) foglio.commenti = commenti;
      }
    }
    if (s.attributi.state === 'hidden' || s.attributi.state === 'veryHidden') { foglio.nascosto = true; nascosti.push(nome); }
    fogli.push(foglio);
  }
  if (fogli.length === 0) throw new Error(t("File .xlsx non valido: nessun foglio"));

  const indiceAttivo = Number(trova(cartella, 'bookViews/workbookView')?.attributi.activeTab ?? 0);
  const nomeAttivo = nomiInOrdine[indiceAttivo];
  const foglioAttivo = fogli.some((f) => f.nome === nomeAttivo) ? nomeAttivo : (fogli[0]?.nome ?? NOME_FOGLIO_PREDEFINITO);

  const { nomi: nomiDefiniti, nonImportati: nomiNonImportati } = leggiNomi(cartella, fogli.map((f) => f.nome));
  // aree di stampa e titoli: i nomi _xlnm hanno la posizione del foglio nell'elenco della cartella
  const stampa = leggiNomiStampa(cartella);
  for (const [i, voce] of stampa) {
    const f = fogli.find((x) => x.nome === nomiInOrdine[i]);
    if (!f) continue;
    const p = unisciPagina(f.pagina, voce);
    if (p) f.pagina = p;
  }
  const nomiVoci = [...voci.keys()];
  const avvisi: string[] = [];
  // macro del file (.xlsm): tradotte in azioni sicure, solo per i pulsanti
  let macro = new Map<string, MacroLetta>();
  const binVba = voci.get(`${dir}vbaProject.bin`);
  if (binVba && controlliFogli.size > 0) { try { macro = leggiMacro(binVba); } catch { macro = new Map(); } }
  let tendine = 0; let pulsanti = 0; let pulsantiFermi = 0; let altriControlli = 0;
  for (const [foglio, letti] of controlliFogli) {
    altriControlli += letti.altri + letti.collegate;
    // caselle combinate → tendina della cella che coprono, con la voce scelta nel controllo scritta nella cella (se è vuota)
    for (const t0 of letti.tendine) {
      const intervallo = leggiIntervallo(t0.elenco, foglio.nome);
      const origine = intervallo ? fogli.find((f) => f.nome.toLowerCase() === intervallo.foglio.toLowerCase()) : undefined;
      if (!intervallo || !origine) { altriControlli++; continue; }
      const indirizzo = indirizzoCella(t0.riga, t0.colonna);
      const voci2: string[] = [];
      for (let rr = intervallo.da.riga; rr <= intervallo.a.riga; rr++) for (let cc = intervallo.da.colonna; cc <= intervallo.a.colonna; cc++) {
        const a = indirizzoCella(rr, cc);
        const testo = origine.celle[a] ?? '';
        voci2.push(origine.calcolati?.[a]?.valore ?? (testo.startsWith('=') ? '' : testo));
      }
      const scelta = t0.scelta >= 1 ? voci2[t0.scelta - 1] ?? '' : '';
      if (scelta !== '' && (foglio.celle[indirizzo] ?? '') === '') foglio.celle[indirizzo] = scelta;
      const riferimento = `${/^[A-Za-z_][A-Za-z0-9_.]*$/.test(origine.nome) ? origine.nome : `'${origine.nome.replace(/'/g, "''")}'`}!$${columnIndexToLetters(intervallo.da.colonna)}$${intervallo.da.riga}:$${columnIndexToLetters(intervallo.a.colonna)}$${intervallo.a.riga}`;
      (foglio.convalide ??= []).push({ intervallo: { startRow: t0.riga, endRow: t0.riga, startCol: t0.colonna, endCol: t0.colonna }, regola: { id: '', type: 'list', value1: riferimento, listRange: riferimento, action: 'warn' } });
      tendine++;
    }
    // pulsanti con la macro tradotta in azioni sicure (o il motivo per cui non si può eseguire)
    const elenco: PulsanteScambio[] = [];
    for (const p0 of letti.pulsanti) {
      const nome = p0.macro ? nomeMacro(p0.macro) : '';
      const m = nome ? macro.get(nome.toLowerCase()) : undefined;
      const motivo = !nome ? 'nessuna macro collegata' : !m ? 'la macro non è nel file' : m.azioni === null ? `istruzione non eseguibile: ${m.motivo ?? ''}` : undefined;
      if (motivo) pulsantiFermi++;
      elenco.push({ x: p0.x, y: p0.y, width: p0.width, height: p0.height, testo: p0.testo, ...(nome ? { macro: nome } : {}), ...(m?.azioni ? { azioni: m.azioni } : {}), ...(motivo ? { motivo } : {}), ...(p0.stile ? { stile: p0.stile } : {}) });
      pulsanti++;
    }
    if (elenco.length > 0) foglio.pulsanti = elenco;
  }
  if (tendine > 0) avvisi.push(tendine === 1 ? t("Una casella combinata del file è diventata la tendina della cella che copriva.") : t("{} caselle combinate del file sono diventate tendine delle celle che coprivano.", tendine));
  if (pulsanti > 0) avvisi.push(pulsantiFermi === 0
    ? t("{} pulsanti con macro: eseguono solo comandi sicuri (vai a un foglio, seleziona una cella, apri il link della cella).", pulsanti)
    : pulsantiFermi === 1
      ? t("{} pulsanti con macro; uno ha una macro che pmb_sheets non può eseguire (esegue solo: vai a un foglio, seleziona una cella, apri il link della cella).", pulsanti)
      : t("{} pulsanti con macro; {} hanno una macro che pmb_sheets non può eseguire (esegue solo: vai a un foglio, seleziona una cella, apri il link della cella).", pulsanti, pulsantiFermi));
  if (altriControlli > 0) avvisi.push(altriControlli === 1
    ? t("Un controllo del file non è stato importato (elenco non valido, collegato a una cella o di un tipo che pmb_sheets non gestisce).")
    : t("{} controlli del file non sono stati importati (elenco non valido, collegati a una cella o di un tipo che pmb_sheets non gestisce).", altriControlli));
  if (altriDisegni || nomiVoci.some((n) => n.startsWith('xl/charts/'))) avvisi.push(t("Grafici e disegni del file non sono stati importati."));
  if (immaginiScartate > 0) avvisi.push(t("{} (formato non ammesso, più grande di 1,5 MB o rovinata).", immaginiScartate === 1 ? "Un'immagine del file non è stata importata" : `${immaginiScartate} immagini del file non sono state importate`));
  if (nomiVoci.some((n) => n.startsWith('xl/pivotTables/'))) avvisi.push(t("Le tabelle pivot del file non sono state importate."));
  if (condizionaliNonImportate > 0) avvisi.push(t("{} (tipo non supportato).", condizionaliNonImportate === 1 ? 'Una formattazione condizionale del file non è stata importata' : `${condizionaliNonImportate} formattazioni condizionali del file non sono state importate`));
  if (nomiNonImportati > 0) avvisi.push(nomiNonImportati === 1
    ? t("Un nome definito del file non è stato importato (non è un intervallo semplice di un foglio).")
    : t("{} nomi definiti del file non sono stati importati (non è un intervallo semplice di un foglio).", nomiNonImportati));
  if (filtri) avvisi.push(t("Alcuni criteri dei filtri automatici del file (condizioni, colori, date, primi 10) non sono stati importati: resta il filtro sulla tabella con i valori spuntati."));
  if (collegamenti) avvisi.push(t("Alcuni collegamenti ipertestuali del file non sono stati importati (quelli dentro il file o con un indirizzo non ammesso)."));
  if (contesto.stili.rientroORotazione) avvisi.push(t("Il rientro e la rotazione del testo non sono stati importati."));
  // i fogli nascosti restano nascosti (Mostra fogli nascosti li rimostra); il foglio attivo è sempre uno visibile
  void nascosti;
  const cp = trova(cartella, 'workbookProtection');
  const protezioneCartella = cp && vero(cp.attributi.lockStructure) ? protezioneDaAttributi(cp.attributi, 'workbook') : undefined;
  return { scambio: { fogli, foglioAttivo, ...(nomiDefiniti.length > 0 ? { nomi: nomiDefiniti } : {}), ...(protezioneCartella ? { protezioneCartella } : {}) }, avvisi };
}

/** Dai byte di un file .xlsx al modello di scambio, con gli avvisi su ciò che non si importa. Un file non valido dà un errore chiaro ("File .xlsx non valido: ..."). */

export async function leggiXlsx(bytes: Uint8Array): Promise<RisultatoXlsx> {
  try {
    return await leggi(bytes);
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    throw new Error(messaggio.startsWith(t("File .xlsx non valido")) ? messaggio : t("File .xlsx non valido: {}", messaggio));
  }
}
