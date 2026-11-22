// L'elenco dei destinatari della stampa unione (e di chi ha bisogno di una tabella semplice): il primo foglio di un .xlsx o .ods, o un
// .csv/.tsv/.txt, letto come testo, con i nomi delle colonne nella prima riga. I numeri si scrivono come si vedono in italiano o in
// inglese (virgola o punto), le date di Excel e di LibreOffice come gg/mm/aaaa. Puro: riceve i byte, non tocca il disco.
// Specifiche: ECMA-376 (SpreadsheetML), OASIS ODF 1.3. Scritto per pmb_office, senza codice di altri programmi.
import { leggiCsv } from './csv';
import { leggiZip } from './zip';
import { analizzaXml, figliElemento, trova, type NodoXml } from './xml';

export interface ElencoDati { colonne: string[]; righe: string[][] }
export const RIGHE_MASSIME_ELENCO = 10000;
export const COLONNE_MASSIME_ELENCO = 200;

const testoNodo = (n: NodoXml | undefined): string => !n ? '' : n.figli.map((f) => (typeof f === 'string' ? f : f.nome === 'text:s' ? ' '.repeat(Math.max(1, Number(f.attributi['text:c'] ?? 1))) : f.nome === 'text:tab' ? '\t' : f.nome === 'text:line-break' ? '\n' : testoNodo(f))).join('');

/** Un numero come si scrive a mano (senza separatore delle migliaia, con la virgola in italiano). */
function numeroTesto(n: number, virgola: boolean): string {
  if (!Number.isFinite(n)) return '';
  const s = String(Number(n.toPrecision(15)));
  return virgola ? s.replace('.', ',') : s;
}
/** Una data seriale (giorno 0 = 30/12/1899, come Excel e LibreOffice) come gg/mm/aaaa (con l'ora se c'è). */
function dataTesto(seriale: number): string {
  const ms = Math.round((seriale - 25569) * 86400000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const due = (x: number): string => String(x).padStart(2, '0');
  const giorno = `${due(d.getUTCDate())}/${due(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  return d.getUTCHours() + d.getUTCMinutes() > 0 ? `${giorno} ${due(d.getUTCHours())}:${due(d.getUTCMinutes())}` : giorno;
}

/** Le righe lette diventano colonne (prima riga) e righe: nomi vuoti → «Colonna N», righe vuote in fondo tolte. */
function daTabella(tabella: string[][]): ElencoDati {
  // fino all'ultima colonna con qualcosa (i fogli hanno spesso colonne vuote «ripetute» in fondo)
  const ultima = (r: string[]): number => { for (let i = r.length - 1; i >= 0; i--) if ((r[i] ?? '').trim() !== '') return i + 1; return 0; };
  const larghezza = Math.min(COLONNE_MASSIME_ELENCO, tabella.reduce((m, r) => Math.max(m, ultima(r)), 0));
  const intestazione = tabella[0] ?? [];
  const colonne = Array.from({ length: larghezza }, (_, i) => (intestazione[i] ?? '').replace(/\s+/g, ' ').trim() || `Colonna ${i + 1}`);
  const righe = tabella.slice(1, RIGHE_MASSIME_ELENCO + 1).map((r) => Array.from({ length: larghezza }, (_, i) => r[i] ?? ''));
  while (righe.length > 0 && righe[righe.length - 1].every((v) => v.trim() === '')) righe.pop();
  return { colonne, righe };
}

/** Numero della colonna (da 0) dal riferimento A1. */
function colonnaDi(rif: string): number {
  const m = /^([A-Z]+)/.exec(rif);
  if (!m) return -1;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}
const rigaDi = (rif: string): number => Number(/(\d+)$/.exec(rif)?.[1] ?? 0) - 1;

/** I formati numerici di date (gg, mm, aa) nei codici di Excel. */
const FORMATI_DATA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
function eFormatoData(codice: string): boolean {
  const s = codice.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
  return /[dy]/i.test(s) || (/m/i.test(s) && !/[0#]/.test(s));
}

async function leggiXlsx(voci: Map<string, Uint8Array>, virgola: boolean): Promise<ElencoDati> {
  const testo = (p: string): string | undefined => { const b = voci.get(p); return b ? new TextDecoder().decode(b) : undefined; };
  const cartella = analizzaXml(testo('xl/workbook.xml') ?? '');
  const primo = figliElemento(trova(cartella, 'sheets') ?? cartella, 'sheet')[0];
  const rels = testo('xl/_rels/workbook.xml.rels');
  let percorso = 'xl/worksheets/sheet1.xml';
  if (primo && rels) {
    const rid = primo.attributi['r:id'];
    const r = figliElemento(analizzaXml(rels), 'Relationship').find((x) => x.attributi['Id'] === rid);
    const target = r?.attributi['Target'];
    if (target) percorso = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  const condivise = (() => {
    const s = testo('xl/sharedStrings.xml');
    if (!s) return [] as string[];
    return figliElemento(analizzaXml(s), 'si').map((si) => {
      const t = figliElemento(si, 't')[0];
      return t ? testoNodo(t) : figliElemento(si, 'r').map((r) => testoNodo(figliElemento(r, 't')[0])).join('');
    });
  })();
  // gli stili che sono date
  const date = new Set<number>();
  const stili = testo('xl/styles.xml');
  if (stili) {
    const radice = analizzaXml(stili);
    const personali = new Map(figliElemento(trova(radice, 'numFmts') ?? radice, 'numFmt').map((f) => [Number(f.attributi.numFmtId), f.attributi.formatCode ?? ''] as const));
    figliElemento(trova(radice, 'cellXfs') ?? radice, 'xf').forEach((xf, i) => {
      const id = Number(xf.attributi.numFmtId ?? 0);
      if (FORMATI_DATA.has(id) || (personali.has(id) && eFormatoData(personali.get(id)!))) date.add(i);
    });
  }
  const foglio = analizzaXml(testo(percorso) ?? '<worksheet/>');
  const tabella: string[][] = [];
  for (const riga of figliElemento(trova(foglio, 'sheetData') ?? foglio, 'row')) {
    const r = riga.attributi.r ? Number(riga.attributi.r) - 1 : tabella.length;
    if (r < 0 || r > RIGHE_MASSIME_ELENCO) continue;
    for (const c of figliElemento(riga, 'c')) {
      const col = c.attributi.r ? colonnaDi(c.attributi.r) : -1;
      if (col < 0 || col >= COLONNE_MASSIME_ELENCO) continue;
      const tipo = c.attributi.t ?? 'n';
      const v = testoNodo(figliElemento(c, 'v')[0]);
      let valore = '';
      if (tipo === 's') valore = condivise[Number(v)] ?? '';
      else if (tipo === 'inlineStr') valore = testoNodo(figliElemento(trova(c, 'is') ?? c, 't')[0]);
      else if (tipo === 'b') valore = v === '1' ? 'VERO' : 'FALSO';
      else if (tipo === 'str' || tipo === 'e') valore = v;
      else if (v !== '') valore = date.has(Number(c.attributi.s ?? 0)) ? dataTesto(Number(v)) : numeroTesto(Number(v), virgola);
      while (tabella.length <= (c.attributi.r ? rigaDi(c.attributi.r) : r)) tabella.push([]);
      tabella[c.attributi.r ? rigaDi(c.attributi.r) : r][col] = valore;
    }
  }
  return daTabella(tabella.map((r) => Array.from(r, (x) => x ?? '')));
}

function leggiOds(voci: Map<string, Uint8Array>, virgola: boolean): ElencoDati {
  const b = voci.get('content.xml');
  if (!b) throw new Error('content.xml mancante');
  const radice = analizzaXml(new TextDecoder().decode(b));
  const foglio = trova(radice, 'office:body/office:spreadsheet');
  const tabella0 = foglio ? figliElemento(foglio, 'table:table')[0] : undefined;
  const tabella: string[][] = [];
  if (!tabella0) return daTabella([]);
  const righeDi = (n: NodoXml): NodoXml[] => n.figli.flatMap((f) => typeof f === 'string' ? [] : f.nome === 'table:table-row' ? [f] : ['table:table-row-group', 'table:table-header-rows', 'table:table-rows'].includes(f.nome) ? righeDi(f) : []);
  for (const riga of righeDi(tabella0)) {
    const ripeti = Math.min(Number(riga.attributi['table:number-rows-repeated'] ?? 1), RIGHE_MASSIME_ELENCO + 1 - tabella.length);
    const celle: string[] = [];
    for (const c of riga.figli) {
      if (typeof c === 'string' || (c.nome !== 'table:table-cell' && c.nome !== 'table:covered-table-cell')) continue;
      const n = Math.min(Number(c.attributi['table:number-columns-repeated'] ?? 1), COLONNE_MASSIME_ELENCO - celle.length);
      const tipo = c.attributi['office:value-type'];
      let valore = figliElemento(c, 'text:p').map(testoNodo).join('\n');
      if (tipo === 'float' || tipo === 'percentage' || tipo === 'currency') { const x = Number(c.attributi['office:value']); if (Number.isFinite(x) && tipo === 'float') valore = numeroTesto(x, virgola); }
      else if (tipo === 'date') { const d = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(c.attributi['office:date-value'] ?? ''); if (d) valore = `${d[3]}/${d[2]}/${d[1]}${d[4] && (d[4] !== '00' || d[5] !== '00') ? ` ${d[4]}:${d[5]}` : ''}`; }
      for (let k = 0; k < n; k++) celle.push(valore);
      if (celle.length >= COLONNE_MASSIME_ELENCO) break;
    }
    for (let k = 0; k < ripeti; k++) tabella.push(celle);
    if (tabella.length > RIGHE_MASSIME_ELENCO) break;
  }
  return daTabella(tabella);
}

/** L'elenco da un file: .xlsx (anche .xlsm), .ods, .csv, .tsv o .txt. virgola = numeri con la virgola decimale (italiano). */
export async function leggiElenco(bytes: Uint8Array, nome: string, virgola = true): Promise<ElencoDati> {
  const est = nome.toLowerCase().split('.').pop() ?? '';
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (zip) {
    const voci = await leggiZip(bytes);
    if (voci.has('xl/workbook.xml')) return leggiXlsx(voci, virgola);
    if (voci.has('content.xml')) return leggiOds(voci, virgola);
    throw new Error('il file non è un foglio di calcolo (.xlsx o .ods)');
  }
  if (!['csv', 'tsv', 'txt', ''].includes(est)) throw new Error('formato non riconosciuto: si leggono .xlsx, .ods, .csv e .txt');
  let testo = new TextDecoder('utf-8').decode(bytes);
  if (testo.includes('�')) testo = new TextDecoder('windows-1252').decode(bytes);
  return daTabella(leggiCsv(testo, est === 'tsv' ? { delimitatore: '\t' } : {}));
}
