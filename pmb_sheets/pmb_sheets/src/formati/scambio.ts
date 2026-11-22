// Modello di scambio dei file di Fogli: quello che i formati (XLSX, ODS, CSV) sanno leggere e scrivere, e come si passa da e verso
// i dati del documento (SheetDocumentData). Tutto puro: niente file, niente motore di calcolo.
// Il testo di una cella è quello che scrive l'utente ("12", "ciao", "=SUM(A1:A3)", funzioni col nome inglese). Righe e colonne partono da 1.
// Ogni foglio ha i suoi stili, larghezze, altezze, celle unite e righe/colonne bloccate (vedi sheet/stato-fogli.ts).
import type { CellStyle } from '../sheet/styles';
import { StyleRegistry, cellKey, parseCellKey } from '../sheet/styles';
import type { SheetDocumentData } from '../sheet/document-data';
import { datiAStato, statoADati, type StatoFoglioDati } from '../sheet/stato-fogli';
import type { MergeRange } from '../sheet/cell-merge';
import type { DataValidationRule } from '../sheet/data-validation';
import type { ConditionalFormatRule } from '../sheet/conditional-format';
import { areaFiltroValida } from '../sheet/filter';
import type { NamedRange } from '../sheet/named-ranges';
import type { CommentoSalvato } from '../sheet/commenti';
import { MAX_COLS, MAX_ROWS, columnIndexToLetters, parseCellAddress } from '../engine/address';
import { ORIGINE_X, ORIGINE_Y, byteDaDataUrl, dataUrlDaByte, immaginiDaDati, nuovoIdImmagine, type ImmagineConfig, type ImmagineScambio } from '../sheet/immagini';
import { nuovoIdPulsante, pulsantiDaDati, type PulsanteConfig, type PulsanteScambio } from '../sheet/pulsanti';
import { t } from '../i18n/lingua';
import { copiaPagina, eDiPartenza, type ImpostaPagina } from '../sheet/pagina';
import { copiaProtezione, protezioneValida, type ProtezioneCartella, type ProtezioneFoglio } from '../sheet/protezione';
import { gruppiValidi, type Gruppi } from '../sheet/gruppi';

export interface FoglioScambio {
  nome: string;
  /** testo di ogni cella piena, per indirizzo ("A1") */
  celle: Record<string, string>;
  /** stile delle singole celle, per indirizzo */
  stili: Record<string, CellStyle>;
  /** stile di intere righe (numero di riga) e colonne (numero di colonna) */
  stiliRiga: Record<number, CellStyle>;
  stiliColonna: Record<number, CellStyle>;
  /** larghezza delle colonne e altezza delle righe, in pixel */
  larghezze: Record<number, number>;
  altezze: Record<number, number>;
  unioni: MergeRange[];
  righeCongelate: number;
  colonneCongelate: number;
  /** colore della scheda del foglio, "#rrggbb" */
  colore?: string;
  /** righe e colonne nascoste (numeri da 1) */
  righeNascoste?: number[];
  colonneNascoste?: number[];
  /** il foglio è nascosto (Nascondi foglio; nei .xlsx state="hidden", nei .ods table:display="false") */
  nascosto?: boolean;
  /** convalide dei dati: ogni voce è un intervallo con la sua regola */
  convalide?: ConvalidaScambio[];
  /** formattazioni condizionali */
  condizionali?: ConditionalFormatRule[];
  /** commenti sulle celle */
  commenti?: CommentoScambio[];
  /** immagini sopra le celle: posizione in pixel dall'angolo di A1 */
  immagini?: ImmagineScambio[];
  /** pulsanti dei file di Excel (controlli modulo) con la macro tradotta in azioni sicure: posizione dall'angolo di A1 */
  pulsanti?: PulsanteScambio[];
  /** risultati delle formule (per i formati che li memorizzano): indirizzo → valore calcolato */
  calcolati?: Record<string, ValoreCalcolato>;
  /** il filtro del foglio, se è acceso: la tabella (intestazione nella prima riga) e, per colonna, i valori spuntati */
  filtro?: FiltroScambio;
  /** impostazione di pagina per la stampa (senza: quella di partenza) */
  pagina?: ImpostaPagina;
  /** il foglio è protetto (con le impronte della password, se c'è) */
  protezione?: ProtezioneFoglio;
  /** righe e colonne raggruppate: numero (da 1) → livello (1-7) */
  gruppi?: Gruppi;
}

export interface FiltroScambio { area: { startRow: number; endRow: number; startCol: number; endCol: number }; colonne: Array<{ col: number; valori?: string[] }> }

export interface ConvalidaScambio { intervallo: { startRow: number; endRow: number; startCol: number; endCol: number }; regola: DataValidationRule }
export interface CommentoScambio { riga: number; colonna: number; testo: string; autore?: string }
export type ValoreCalcolato = { tipo: 'n' | 'str' | 'b' | 'e'; valore: string };
/** Un nome definito: l'intervallo è locale al foglio ("C2:C4", senza $) */
export interface NomeScambio { nome: string; foglio: string; riferimento: string }

export interface Scambio { fogli: FoglioScambio[]; foglioAttivo: string; nomi?: NomeScambio[]; /** struttura della cartella protetta */ protezioneCartella?: ProtezioneCartella }

export const NOME_FOGLIO_PREDEFINITO = 'Foglio1';

export function foglioVuoto(nome: string): FoglioScambio {
  return { nome, celle: {}, stili: {}, stiliRiga: {}, stiliColonna: {}, larghezze: {}, altezze: {}, unioni: [], righeCongelate: 0, colonneCongelate: 0 };
}

/** Indirizzo di una cella: riga 3, colonna 2 → "B3". */
export function indirizzoCella(riga: number, colonna: number): string { return `${columnIndexToLetters(colonna)}${riga}`; }

const intero = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const positivo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100000;
const vuoto = (s: CellStyle | undefined): boolean => s === undefined || Object.keys(s).length === 0;

function unioneValida(m: unknown): m is MergeRange {
  const x = m as Record<string, unknown> | null;
  return !!x && typeof x === 'object' && intero(x.startRow, 1, MAX_ROWS) && intero(x.endRow, 1, MAX_ROWS) && intero(x.startCol, 1, MAX_COLS) && intero(x.endCol, 1, MAX_COLS)
    && (x.startRow as number) <= (x.endRow as number) && (x.startCol as number) <= (x.endCol as number)
    && !((x.startRow === x.endRow) && (x.startCol === x.endCol));
}

function leggiCartella(json: string): Array<{ nome: string; celle: Record<string, string> }> {
  let dati: unknown;
  try { dati = JSON.parse(json); } catch { throw new Error(t("Cartella di lavoro non valida: JSON illeggibile")); }
  const d = dati as { version?: unknown; sheets?: unknown };
  if (!d || typeof d !== 'object' || d.version !== 1 || !Array.isArray(d.sheets)) throw new Error(t("Cartella di lavoro non valida: versione o fogli"));
  return d.sheets.map((s: unknown) => {
    const f = s as { name?: unknown; cells?: unknown };
    if (!f || typeof f !== 'object' || typeof f.name !== 'string') throw new Error(t("Cartella di lavoro non valida: nome del foglio"));
    const celle: Record<string, string> = {};
    if (f.cells && typeof f.cells === 'object') {
      for (const [a, v] of Object.entries(f.cells as Record<string, unknown>)) {
        if (typeof v === 'string' && v !== '' && parseCellAddress(a) !== null) celle[a] = v;
      }
    }
    return { nome: f.name, celle };
  });
}

/** La parte di uno stato di foglio che il modello di scambio conosce. */
type StatoScambio = Pick<StatoFoglioDati, 'cellStyles' | 'rowStyles' | 'colStyles' | 'colWidths' | 'rowHeights' | 'freezeRows' | 'freezeCols' | 'merges' | 'hiddenRows' | 'hiddenCols' | 'dataValidations' | 'conditionalFormats' | 'coloreScheda' | 'nascosto' | 'filters' | 'impostaPagina' | 'protezione' | 'gruppi'>;

/** Dai dati del documento al modello di scambio. Ogni foglio porta i suoi stili, larghezze, altezze, unioni e blocchi. */
export function scambioDaDocumento(data: SheetDocumentData): Scambio {
  const base = leggiCartella(data.workbookJson);
  if (base.length === 0) base.push({ nome: NOME_FOGLIO_PREDEFINITO, celle: {} });
  const attivo = base.find((f) => f.nome === data.activeSheetName)?.nome ?? base[0].nome;
  const fogli = base.map((f) => ({ ...foglioVuoto(f.nome), celle: f.celle }));
  // i campi di primo livello sono quelli del foglio attivo, gli altri fogli stanno in fogliStato
  const stati: Record<string, Partial<StatoScambio>> = {
    ...(data.fogliStato ?? {}),
    [attivo]: { cellStyles: data.cellStyles, rowStyles: data.rowStyles, colStyles: data.colStyles, colWidths: data.colWidths, rowHeights: data.rowHeights, freezeRows: data.freezeRows, freezeCols: data.freezeCols, merges: data.merges, hiddenRows: data.hiddenRows, hiddenCols: data.hiddenCols, dataValidations: data.dataValidations, conditionalFormats: data.conditionalFormats, coloreScheda: data.coloreScheda, nascosto: data.nascosto, filters: data.filters, impostaPagina: data.impostaPagina, protezione: data.protezione, gruppi: data.gruppi },
  };
  const stile = (id: unknown): CellStyle | undefined => {
    if (!intero(id, 1, data.styles.length - 1)) return undefined;
    const s = data.styles[id];
    return vuoto(s) ? undefined : (JSON.parse(JSON.stringify(s)) as CellStyle);
  };
  for (const f of fogli) {
    const d = stati[f.nome];
    if (!d) continue;
    for (const [k, id] of Object.entries(d.cellStyles ?? {})) {
      const { row, col } = parseCellKey(k);
      const s = stile(id);
      if (s && intero(row, 1, MAX_ROWS) && intero(col, 1, MAX_COLS) && cellKey(row, col) === k) f.stili[indirizzoCella(row, col)] = s;
    }
    for (const [k, id] of Object.entries(d.rowStyles ?? {})) {
      const n = Number(k);
      const s = stile(id);
      if (s && intero(n, 1, MAX_ROWS)) f.stiliRiga[n] = s;
    }
    for (const [k, id] of Object.entries(d.colStyles ?? {})) {
      const n = Number(k);
      const s = stile(id);
      if (s && intero(n, 1, MAX_COLS)) f.stiliColonna[n] = s;
    }
    for (const [k, v] of Object.entries(d.colWidths ?? {})) if (intero(Number(k), 1, MAX_COLS) && positivo(v)) f.larghezze[Number(k)] = v;
    for (const [k, v] of Object.entries(d.rowHeights ?? {})) if (intero(Number(k), 1, MAX_ROWS) && positivo(v)) f.altezze[Number(k)] = v;
    f.unioni = (d.merges ?? []).filter(unioneValida).map((m) => ({ startRow: m.startRow, endRow: m.endRow, startCol: m.startCol, endCol: m.endCol }));
    f.righeCongelate = intero(d.freezeRows, 0, MAX_ROWS) ? (d.freezeRows as number) : 0;
    f.colonneCongelate = intero(d.freezeCols, 0, MAX_COLS) ? (d.freezeCols as number) : 0;
    if (typeof d.coloreScheda === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.coloreScheda)) f.colore = d.coloreScheda;
    if (d.nascosto === true) f.nascosto = true;
    if (d.impostaPagina && !eDiPartenza(d.impostaPagina)) f.pagina = copiaPagina(d.impostaPagina);
    if (protezioneValida(d.protezione)) f.protezione = protezioneValida(d.protezione);
    if (gruppiValidi(d.gruppi)) f.gruppi = gruppiValidi(d.gruppi);
    const righeNascoste = (d.hiddenRows ?? []).filter((n) => intero(n, 1, MAX_ROWS));
    if (righeNascoste.length > 0) f.righeNascoste = righeNascoste;
    const colonneNascoste = (d.hiddenCols ?? []).filter((n) => intero(n, 1, MAX_COLS));
    if (colonneNascoste.length > 0) f.colonneNascoste = colonneNascoste;
    const convalide = Object.entries(d.dataValidations ?? {}).flatMap(([k, regola]) => {
      const [r, c] = k.split(':').map(Number);
      return intero(r, 1, MAX_ROWS) && intero(c, 1, MAX_COLS) && regola ? [{ intervallo: { startRow: r, endRow: r, startCol: c, endCol: c }, regola: JSON.parse(JSON.stringify(regola)) as DataValidationRule }] : [];
    });
    if (convalide.length > 0) f.convalide = convalide;
    const condizionali = JSON.parse(JSON.stringify(d.conditionalFormats ?? [])) as ConditionalFormatRule[];
    if (condizionali.length > 0) f.condizionali = condizionali;
    // il filtro acceso: la sua tabella (senza area salvata, tutto l'intervallo usato dalla riga 1) e i valori spuntati
    if (d.filters?.active) {
      const area = areaFiltroValida(d.filters.area) ?? areaUsata(f.celle);
      if (area) {
        const colonne = (d.filters.columns ?? []).filter((c) => intero(c.col, area.startCol, area.endCol))
          .map((c) => ({ col: c.col, ...(Array.isArray(c.selectedValues) ? { valori: c.selectedValues.filter((v) => typeof v === 'string') } : {}) }));
        f.filtro = { area, colonne };
      }
    }
    const commenti = (data.comments ?? []).filter((m) => m.foglio === f.nome).map((m: CommentoSalvato) => ({ riga: m.riga, colonna: m.colonna, testo: m.testo }));
    if (commenti.length > 0) f.commenti = commenti;
    const immagini: ImmagineScambio[] = [];
    for (const im of data.images ?? []) {
      if (im.sheetName !== f.nome) continue;
      const b = byteDaDataUrl(im.dataUrl);
      if (b) immagini.push({ x: Math.max(0, Math.round(im.x - ORIGINE_X)), y: Math.max(0, Math.round(im.y - ORIGINE_Y)), width: im.width, height: im.height, nome: im.nome, tipo: b.tipo, byte: b.byte });
    }
    if (immagini.length > 0) f.immagini = immagini;
    const pulsanti: PulsanteScambio[] = (data.buttons ?? []).filter((p) => p.sheetName === f.nome)
      .map((p) => ({ x: Math.max(0, Math.round(p.x - ORIGINE_X)), y: Math.max(0, Math.round(p.y - ORIGINE_Y)), width: p.width, height: p.height, testo: p.testo, ...(p.macro ? { macro: p.macro } : {}), ...(p.azioni ? { azioni: p.azioni.map((a) => ({ ...a })) } : {}), ...(p.motivo ? { motivo: p.motivo } : {}), ...(p.stile ? { stile: { ...p.stile } } : {}) }));
    if (pulsanti.length > 0) f.pulsanti = pulsanti;
  }
  const nomi: NomeScambio[] = (data.namedRanges ?? [])
    .filter((n: NamedRange) => fogli.some((f) => f.nome === n.sheetName))
    .map((n: NamedRange) => ({ nome: n.name, foglio: n.sheetName, riferimento: n.rangeString.includes('!') ? n.rangeString.slice(n.rangeString.lastIndexOf('!') + 1) : n.rangeString }));
  const cartella = protezioneValida(data.protezioneCartella);
  return { fogli, foglioAttivo: attivo, ...(nomi.length > 0 ? { nomi } : {}), ...(cartella ? { protezioneCartella: cartella } : {}) };
}

/** Tutto l'intervallo usato del foglio, dalla riga 1 e dalla colonna A: dove lavorava il filtro prima che avesse un'area. */
function areaUsata(celle: Record<string, string>): { startRow: number; endRow: number; startCol: number; endCol: number } | undefined {
  let r = 0, c = 0;
  for (const a of Object.keys(celle)) { const p = parseCellAddress(a); if (p) { r = Math.max(r, p.row); c = Math.max(c, p.col); } }
  return r > 0 && c > 0 ? { startRow: 1, endRow: Math.max(r, 2), startCol: 1, endCol: c } : undefined;
}

/** Nomi dei fogli utilizzabili: senza spazi ai bordi, mai vuoti, mai ripetuti (senza badare alle maiuscole). */
function nomiUnici(nomi: string[]): string[] {
  const usati = new Set<string>();
  return nomi.map((nome, i) => {
    let n = nome.trim() === '' ? `Foglio${i + 1}` : nome.trim();
    let candidato = n;
    for (let k = 2; usati.has(candidato.toLowerCase()); k++) candidato = `${n} (${k})`;
    n = candidato;
    usati.add(n.toLowerCase());
    return n;
  });
}

/** Dal modello di scambio ai dati del documento. Ogni foglio conserva i suoi stili e le sue misure; quelli del foglio attivo vanno nei campi di primo livello, gli altri in fogliStato. */
export function documentoDaScambio(s: Scambio): SheetDocumentData {
  const tutti = s.fogli.length > 0 ? s.fogli : [foglioVuoto(NOME_FOGLIO_PREDEFINITO)];
  // almeno un foglio resta visibile, e il foglio attivo è sempre uno visibile (come in Excel)
  const origine = tutti.every((f) => f.nascosto === true) ? tutti.map((f, i) => (i === 0 ? { ...f, nascosto: false } : f)) : tutti;
  const nomi = nomiUnici(origine.map((f) => f.nome));
  const scelto = origine.findIndex((f) => f.nome === s.foglioAttivo);
  const indiceAttivo = scelto >= 0 && origine[scelto].nascosto !== true ? scelto : Math.max(0, origine.findIndex((f) => f.nascosto !== true));
  const cartella = {
    version: 1,
    sheets: origine.map((fg, i) => {
      const cells: Record<string, string> = {};
      for (const [a, v] of Object.entries(fg.celle)) if (typeof v === 'string' && v !== '' && parseCellAddress(a) !== null) cells[a.toUpperCase()] = v;
      return { name: nomi[i], cells };
    }),
  };
  const registro = new StyleRegistry();
  const statoDi = (f: FoglioScambio): StatoScambio => {
    const cellStyles: Record<string, number> = {};
    for (const [a, st] of Object.entries(f.stili)) {
      const c = parseCellAddress(a);
      if (c && !vuoto(st)) cellStyles[cellKey(c.row, c.col)] = registro.register(st);
    }
    const rowStyles: Record<string, number> = {};
    for (const [k, st] of Object.entries(f.stiliRiga)) if (intero(Number(k), 1, MAX_ROWS) && !vuoto(st)) rowStyles[k] = registro.register(st);
    const colStyles: Record<string, number> = {};
    for (const [k, st] of Object.entries(f.stiliColonna)) if (intero(Number(k), 1, MAX_COLS) && !vuoto(st)) colStyles[k] = registro.register(st);
    const colWidths: Record<string, number> = {};
    for (const [k, v] of Object.entries(f.larghezze)) if (intero(Number(k), 1, MAX_COLS) && positivo(v)) colWidths[k] = v;
    const rowHeights: Record<string, number> = {};
    for (const [k, v] of Object.entries(f.altezze)) if (intero(Number(k), 1, MAX_ROWS) && positivo(v)) rowHeights[k] = v;
    return {
      cellStyles, rowStyles, colStyles, colWidths, rowHeights,
      freezeRows: intero(f.righeCongelate, 0, MAX_ROWS) ? f.righeCongelate : 0,
      freezeCols: intero(f.colonneCongelate, 0, MAX_COLS) ? f.colonneCongelate : 0,
      ...(typeof f.colore === 'string' && /^#[0-9a-fA-F]{6}$/.test(f.colore) ? { coloreScheda: f.colore } : {}),
      ...(f.nascosto === true ? { nascosto: true } : {}),
      ...(f.pagina && !eDiPartenza(f.pagina) ? { impostaPagina: copiaPagina(f.pagina) } : {}),
      ...(protezioneValida(f.protezione) ? { protezione: protezioneValida(f.protezione) } : {}),
      ...(gruppiValidi(f.gruppi) ? { gruppi: gruppiValidi(f.gruppi) } : {}),
      merges: f.unioni.filter(unioneValida).map((m) => ({ startRow: m.startRow, endRow: m.endRow, startCol: m.startCol, endCol: m.endCol })),
      hiddenRows: (f.righeNascoste ?? []).filter((n) => intero(n, 1, MAX_ROWS)),
      hiddenCols: (f.colonneNascoste ?? []).filter((n) => intero(n, 1, MAX_COLS)),
      dataValidations: Object.fromEntries((f.convalide ?? []).flatMap((v) => {
        const voci: Array<[string, DataValidationRule]> = [];
        const i = v.intervallo;
        if (!(intero(i.startRow, 1, MAX_ROWS) && intero(i.endRow, 1, MAX_ROWS) && intero(i.startCol, 1, MAX_COLS) && intero(i.endCol, 1, MAX_COLS))) return voci;
        for (let r = i.startRow; r <= i.endRow && voci.length < 50_000; r++) for (let c = i.startCol; c <= i.endCol && voci.length < 50_000; c++) voci.push([`${r}:${c}`, { ...v.regola, id: `val-${r}:${c}` }]);
        return voci;
      })),
      conditionalFormats: (f.condizionali ?? []).map((r, k) => ({ ...JSON.parse(JSON.stringify(r)), id: r.id || `cf-${k + 1}` })) as ConditionalFormatRule[],
      filters: f.filtro && areaFiltroValida(f.filtro.area)
        ? { active: true, columns: f.filtro.colonne.filter((c) => intero(c.col, 1, MAX_COLS) && Array.isArray(c.valori)).map((c) => ({ col: c.col, selectedValues: [...c.valori!] })), area: areaFiltroValida(f.filtro.area)! }
        : { active: false, columns: [] },
    };
  };
  // il foglio attivo per primo: così i suoi stili hanno gli indici più bassi nel registro
  const attivoStato = statoDi(origine[indiceAttivo]);
  const fogliStato: Record<string, StatoFoglioDati> = {};
  origine.forEach((fg, i) => {
    if (i === indiceAttivo) return;
    fogliStato[nomi[i]] = statoADati(datiAStato(statoDi(fg)));
  });
  const commenti: CommentoSalvato[] = [];
  const adesso = new Date().toISOString();
  origine.forEach((fg, i) => {
    for (const m of fg.commenti ?? []) if (intero(m.riga, 1, MAX_ROWS) && intero(m.colonna, 1, MAX_COLS) && m.testo.trim() !== '') commenti.push({ foglio: nomi[i], riga: m.riga, colonna: m.colonna, testo: m.testo, data: adesso });
  });
  const immagini: ImmagineConfig[] = [];
  origine.forEach((fg, i) => {
    (fg.immagini ?? []).forEach((im, k) => {
      immagini.push({ id: `${nuovoIdImmagine()}-${i}-${k}`, sheetName: nomi[i], x: im.x + ORIGINE_X, y: im.y + ORIGINE_Y, width: im.width, height: im.height, dataUrl: dataUrlDaByte(im.byte, im.tipo), nome: im.nome });
    });
  });
  const pulsanti: PulsanteConfig[] = [];
  origine.forEach((fg, i) => {
    for (const p of fg.pulsanti ?? []) pulsanti.push({ id: nuovoIdPulsante(), sheetName: nomi[i], x: p.x + ORIGINE_X, y: p.y + ORIGINE_Y, width: p.width, height: p.height, testo: p.testo, ...(p.macro ? { macro: p.macro } : {}), ...(p.azioni ? { azioni: p.azioni } : {}), ...(p.motivo ? { motivo: p.motivo } : {}), ...(p.stile ? { stile: p.stile } : {}) });
  });
  const nomiDefiniti: NamedRange[] = [];
  for (const n of s.nomi ?? []) {
    const idx = origine.findIndex((fg) => fg.nome === n.foglio);
    const area = n.riferimento.split(':').map((x) => parseCellAddress(x));
    if (idx < 0 || area.some((x) => !x) || area.length > 2) continue;
    const a = area[0]!;
    const b = area[1] ?? a;
    nomiDefiniti.push({ name: n.nome, sheetName: nomi[idx], rangeString: n.riferimento, startRow: Math.min(a.row, b.row), startCol: Math.min(a.col, b.col), endRow: Math.max(a.row, b.row), endCol: Math.max(a.col, b.col) });
  }
  return {
    version: 1,
    workbookJson: JSON.stringify(cartella, null, 2),
    styles: [...registro.getAllStyles()],
    ...attivoStato,
    activeSheetName: nomi[indiceAttivo],
    namedRanges: nomiDefiniti,
    comments: commenti,
    images: immaginiDaDati(immagini),
    ...(pulsanti.length > 0 ? { buttons: pulsantiDaDati(pulsanti) } : {}),
    fogliStato,
    ...(protezioneValida(s.protezioneCartella) ? { protezioneCartella: copiaProtezione(protezioneValida(s.protezioneCartella)) } : {}),
  };
}

/** Avvisi per l'utente su ciò che non si conserva passando a un documento di Fogli. Ogni foglio ora conserva i suoi stili e le sue misure: non c'è più niente da dire. */
export function avvisiDiConversione(_s: Scambio): string[] {
  return [];
}
