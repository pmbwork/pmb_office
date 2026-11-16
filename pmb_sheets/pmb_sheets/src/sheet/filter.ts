/**
 * Modulo puro filtri per Fogli (pmb_office).
 * Gestisce:
 * - Filtri per colonna con valori selezionati (inclusione/esclusione valori univoci).
 * - Filtri per condizioni logiche (confronti matematici, testuali, vuote/non vuote, intervalli).
 * - Ricerca testuale per filtrare la lista dei valori univoci.
 * - Calcolo deterministico dell'insieme delle righe da nascondere (hiddenRows).
 * - Viste filtro (Filter Views): configurazioni salvate di filtri su intervalli specifici.
 * Zero DOM, zero dipendenze esterne (a parte la conversione di un numero seriale in data).
 */

import { serialToDate } from './number-format';

export type FilterConditionOperator =
  | 'none'
  | 'empty'
  | 'not_empty'
  | 'text_contains'
  | 'text_not_contains'
  | 'text_starts_with'
  | 'text_ends_with'
  | 'text_exact'
  | 'greater_than'
  | 'greater_equal'
  | 'less_than'
  | 'less_equal'
  | 'equal_to'
  | 'not_equal_to'
  | 'between'
  | 'not_between';

export interface FilterCondition {
  operator: FilterConditionOperator;
  value1?: string | number;
  value2?: string | number;
}

export interface ColumnFilter {
  col: number;
  // Se specificato, la cella deve avere uno dei valori presenti in questo Set
  selectedValues?: Set<string>;
  condition?: FilterCondition;
  /** colori di sfondo ammessi ('' = cella senza colore) */
  fillColors?: Set<string>;
  /** colori del testo ammessi ('' = colore automatico) */
  textColors?: Set<string>;
  /** mesi ammessi, come 'AAAA-MM' ('' = cella che non è una data) */
  months?: Set<string>;
}

/** Ciò che serve per filtrare per colore o per data: il colore dello sfondo e del testo di una cella e il suo mese ('AAAA-MM', '' se non è una data). */
export interface FiltroExtra {
  getFill?: (r: number, c: number) => string;
  getTextColor?: (r: number, c: number) => string;
  getMonthKey?: (r: number, c: number) => string;
}

/** Un filtro come si scrive nel file: gli insiemi diventano elenchi (in JSON un Set diventerebbe {} e si perderebbe). */
export type FiltroInJson = Omit<ColumnFilter, 'selectedValues' | 'fillColors' | 'textColors' | 'months'> & {
  selectedValues?: string[];
  fillColors?: string[];
  textColors?: string[];
  months?: string[];
};

const INSIEMI_FILTRO = ['selectedValues', 'fillColors', 'textColors', 'months'] as const;

export function filtroInJson(f: ColumnFilter): FiltroInJson {
  const out: Record<string, unknown> = { col: f.col };
  if (f.condition) out.condition = { ...f.condition };
  for (const k of INSIEMI_FILTRO) if (f[k]) out[k] = [...f[k]!];
  return out as FiltroInJson;
}

/** Al contrario, accettando anche file scritti male (un insieme che non è un elenco si ignora, come se quel criterio non ci fosse). */
export function filtroDaJson(f: unknown): ColumnFilter | null {
  if (!f || typeof f !== 'object') return null;
  const g = f as Record<string, unknown>;
  const col = Number(g.col);
  if (!Number.isInteger(col) || col < 1) return null;
  const out: ColumnFilter = { col };
  if (g.condition && typeof g.condition === 'object' && typeof (g.condition as FilterCondition).operator === 'string') out.condition = { ...(g.condition as FilterCondition) };
  for (const k of INSIEMI_FILTRO) {
    const v = g[k];
    if (Array.isArray(v)) out[k] = new Set(v.filter((x): x is string => typeof x === 'string'));
  }
  return out;
}

/** I filtri di un file (o di una vista) come mappa colonna → filtro. */
export function filtriDaJson(elenco: unknown): Map<number, ColumnFilter> {
  const m = new Map<number, ColumnFilter>();
  if (Array.isArray(elenco)) for (const x of elenco) { const f = filtroDaJson(x); if (f) m.set(f.col, f); }
  return m;
}

export function copiaFiltro(f: ColumnFilter): ColumnFilter {
  return filtroDaJson(filtroInJson(f))!;
}

/** Dove lavora il filtro: la tabella, con l'intestazione nella prima riga (le righe sopra non si nascondono né si ordinano). */
export interface AreaFiltro { startRow: number; endRow: number; startCol: number; endCol: number }

/** Un'area letta da un file, oppure undefined se non è ben formata. */
export function areaFiltroValida(x: unknown): AreaFiltro | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const g = x as Record<string, unknown>;
  const n = (k: string) => (Number.isInteger(g[k]) && (g[k] as number) >= 1 ? (g[k] as number) : null);
  const a = { startRow: n('startRow'), endRow: n('endRow'), startCol: n('startCol'), endCol: n('endCol') };
  if (a.startRow === null || a.endRow === null || a.startCol === null || a.endCol === null || a.endRow < a.startRow || a.endCol < a.startCol) return undefined;
  return a as AreaFiltro;
}

/**
 * Il blocco di celle piene attaccate attorno alla cella (la «regione corrente» di Excel, quella che prende Ctrl+A dentro una tabella):
 * il rettangolo si allarga finché sul suo bordo (diagonali comprese) c'è una cella piena. `ultimaRiga` e `ultimaColonna` sono le ultime usate
 * del foglio (oltre non c'è niente). null se la cella e le sue vicine sono vuote.
 */
export function regioneCorrente(riga: number, colonna: number, piena: (r: number, c: number) => boolean, ultimaRiga: number, ultimaColonna: number): AreaFiltro | null {
  let r0 = riga, r1 = riga, c0 = colonna, c1 = colonna;
  const maxR = Math.max(ultimaRiga, riga), maxC = Math.max(ultimaColonna, colonna);
  const rigaPiena = (r: number, da: number, a: number) => { for (let c = Math.max(1, da); c <= Math.min(maxC, a); c++) if (piena(r, c)) return true; return false; };
  const colonnaPiena = (c: number, da: number, a: number) => { for (let r = Math.max(1, da); r <= Math.min(maxR, a); r++) if (piena(r, c)) return true; return false; };
  for (let cambiato = true; cambiato;) {
    cambiato = false;
    if (r0 > 1 && rigaPiena(r0 - 1, c0 - 1, c1 + 1)) { r0--; cambiato = true; }
    if (r1 < maxR && rigaPiena(r1 + 1, c0 - 1, c1 + 1)) { r1++; cambiato = true; }
    if (c0 > 1 && colonnaPiena(c0 - 1, r0 - 1, r1 + 1)) { c0--; cambiato = true; }
    if (c1 < maxC && colonnaPiena(c1 + 1, r0 - 1, r1 + 1)) { c1++; cambiato = true; }
  }
  if (r0 === r1 && c0 === c1 && !piena(riga, colonna)) return null;
  return { startRow: r0, endRow: r1, startCol: c0, endCol: c1 };
}

/** Fin dove arriva il filtro: le righe scritte subito sotto la tabella (senza righe vuote in mezzo) ci entrano, come in Excel. */
export function fineAreaFiltro(area: AreaFiltro, piena: (r: number, c: number) => boolean, ultimaRiga: number): number {
  let fine = area.endRow;
  const haDati = (r: number) => { for (let c = area.startCol; c <= area.endCol; c++) if (piena(r, c)) return true; return false; };
  while (fine < ultimaRiga && haDati(fine + 1)) fine++;
  return fine;
}

/** Una vista filtro: i filtri delle colonne salvati con un nome, da richiamare quando serve (come le viste filtro di Google Fogli). */
export interface VistaFiltro {
  id: string;
  nome: string;
  filtri: FiltroInJson[];
  /** la tabella su cui lavora (manca nelle viste salvate prima che il filtro avesse un'area: allora è tutto il foglio dalla riga 1) */
  area?: AreaFiltro;
}

export const LUNGHEZZA_MASSIMA_NOME_VISTA = 60;

/** Le viste lette da un file: si tengono solo quelle ben formate. */
export function vistePulite(v: unknown): VistaFiltro[] {
  if (!Array.isArray(v)) return [];
  const out: VistaFiltro[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const g = x as Record<string, unknown>;
    if (typeof g.nome !== 'string' || g.nome.trim() === '') continue;
    const filtri = [...filtriDaJson(g.filtri).values()].map(filtroInJson);
    if (filtri.length === 0) continue;
    const area = areaFiltroValida(g.area);
    out.push({ id: typeof g.id === 'string' && g.id !== '' ? g.id : `vista-${out.length + 1}`, nome: g.nome.trim().slice(0, LUNGHEZZA_MASSIMA_NOME_VISTA), filtri, ...(area ? { area } : {}) });
  }
  return out;
}

/**
 * Ordina per colore, come in Excel: le righe da..a che hanno il colore scelto vanno in cima, le altre seguono;
 * dentro i due gruppi l'ordine resta quello di prima. Dà da quale riga a quale si sposta ciascuna.
 */
export function ordinePerColore(da: number, a: number, inCima: (riga: number) => boolean): Array<{ fromRow: number; toRow: number }> {
  const righe: number[] = [];
  for (let r = da; r <= a; r++) righe.push(r);
  const nuovo = [...righe.filter((r) => inCima(r)), ...righe.filter((r) => !inCima(r))];
  return nuovo.map((fromRow, i) => ({ fromRow, toRow: da + i }));
}

export interface FilterRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  hasHeader?: boolean;
}

export interface FilterView {
  id: string;
  name: string;
  range: FilterRange;
  filters: Map<number, ColumnFilter>;
}

/**
 * Valuta se un singolo valore soddisfa la condizione di filtro.
 */
export function evaluateCondition(val: string, cond?: FilterCondition): boolean {
  if (!cond || cond.operator === 'none') return true;

  const str = val.trim();
  const lowerStr = str.toLowerCase();
  const isEmpty = str === '';

  switch (cond.operator) {
    case 'empty':
      return isEmpty;
    case 'not_empty':
      return !isEmpty;

    case 'text_contains': {
      const q = String(cond.value1 ?? '').toLowerCase();
      return lowerStr.includes(q);
    }
    case 'text_not_contains': {
      const q = String(cond.value1 ?? '').toLowerCase();
      return !lowerStr.includes(q);
    }
    case 'text_starts_with': {
      const q = String(cond.value1 ?? '').toLowerCase();
      return lowerStr.startsWith(q);
    }
    case 'text_ends_with': {
      const q = String(cond.value1 ?? '').toLowerCase();
      return lowerStr.endsWith(q);
    }
    case 'text_exact': {
      const q = String(cond.value1 ?? '').toLowerCase();
      return lowerStr === q;
    }

    case 'greater_than': {
      const n = Number(str);
      const limit = Number(cond.value1);
      return !Number.isNaN(n) && !Number.isNaN(limit) && n > limit;
    }
    case 'greater_equal': {
      const n = Number(str);
      const limit = Number(cond.value1);
      return !Number.isNaN(n) && !Number.isNaN(limit) && n >= limit;
    }
    case 'less_than': {
      const n = Number(str);
      const limit = Number(cond.value1);
      return !Number.isNaN(n) && !Number.isNaN(limit) && n < limit;
    }
    case 'less_equal': {
      const n = Number(str);
      const limit = Number(cond.value1);
      return !Number.isNaN(n) && !Number.isNaN(limit) && n <= limit;
    }
    case 'equal_to': {
      const n = Number(str);
      const limit = Number(cond.value1);
      if (!Number.isNaN(n) && !Number.isNaN(limit)) {
        return n === limit;
      }
      return lowerStr === String(cond.value1 ?? '').toLowerCase();
    }
    case 'not_equal_to': {
      const n = Number(str);
      const limit = Number(cond.value1);
      if (!Number.isNaN(n) && !Number.isNaN(limit)) {
        return n !== limit;
      }
      return lowerStr !== String(cond.value1 ?? '').toLowerCase();
    }
    case 'between': {
      const n = Number(str);
      const low = Number(cond.value1);
      const high = Number(cond.value2);
      return !Number.isNaN(n) && !Number.isNaN(low) && !Number.isNaN(high) && n >= low && n <= high;
    }
    case 'not_between': {
      const n = Number(str);
      const low = Number(cond.value1);
      const high = Number(cond.value2);
      return !Number.isNaN(n) && !Number.isNaN(low) && !Number.isNaN(high) && (n < low || n > high);
    }
    default:
      return true;
  }
}

/**
 * Valuta se una riga passa tutti i filtri attivi sulle diverse colonne.
 */
export function isRowVisible(
  row: number,
  filters: Map<number, ColumnFilter>,
  getCellValue: (r: number, c: number) => string,
  extra?: FiltroExtra
): boolean {
  for (const [col, colFilter] of filters.entries()) {
    if (colFilter.fillColors && extra?.getFill && !colFilter.fillColors.has(extra.getFill(row, col))) return false;
    if (colFilter.textColors && extra?.getTextColor && !colFilter.textColors.has(extra.getTextColor(row, col))) return false;
    if (colFilter.months && extra?.getMonthKey && !colFilter.months.has(extra.getMonthKey(row, col))) return false;
    const val = getCellValue(row, col);

    // Controllo selezione valori univoci
    if (colFilter.selectedValues && !colFilter.selectedValues.has(val)) {
      return false;
    }

    // Controllo condizione logica
    if (colFilter.condition && !evaluateCondition(val, colFilter.condition)) {
      return false;
    }
  }

  return true;
}

/**
 * Calcola l'insieme di righe da nascondere all'interno dell'intervallo filtrato.
 */
export function computeHiddenRowsFromFilters(
  range: FilterRange,
  filters: Map<number, ColumnFilter>,
  getCellValue: (r: number, c: number) => string,
  extra?: FiltroExtra
): Set<number> {
  const hidden = new Set<number>();
  if (filters.size === 0) return hidden;

  const startRow = range.hasHeader ? range.startRow + 1 : range.startRow;
  for (let r = startRow; r <= range.endRow; r++) {
    if (!isRowVisible(r, filters, getCellValue, extra)) {
      hidden.add(r);
    }
  }

  return hidden;
}

/**
 * Estrae la lista dei valori univoci ordinati presenti in una colonna dell'intervallo.
 */
export function extractUniqueColumnValues(
  col: number,
  range: FilterRange,
  getCellValue: (r: number, c: number) => string,
  searchQuery?: string
): string[] {
  const valuesSet = new Set<string>();
  const startRow = range.hasHeader ? range.startRow + 1 : range.startRow;

  for (let r = startRow; r <= range.endRow; r++) {
    const v = getCellValue(r, col);
    valuesSet.add(v);
  }

  let list = Array.from(valuesSet);
  if (searchQuery && searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter((v) => v.toLowerCase().includes(q));
  }

  // Ordina con stringhe/numeri e vuote in coda
  list.sort((a, b) => {
    if (a === '' && b === '') return 0;
    if (a === '') return 1;
    if (b === '') return -1;
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  return list;
}

/** I valori distinti che una funzione di lettura dà per le righe dati della colonna, in ordine ("" in coda). Serve per le liste dei colori. */
export function valoriDistinti(col: number, range: FilterRange, leggi: (r: number, c: number) => string): string[] {
  const insieme = new Set<string>();
  for (let r = range.hasHeader ? range.startRow + 1 : range.startRow; r <= range.endRow; r++) insieme.add(leggi(r, col));
  return [...insieme].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
}

/** Vero se il formato numerico mostra date o orari. */
export function formatoMostraData(codice: string | undefined): boolean {
  return !!codice && /[dmyhs]/i.test(codice.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''));
}

const NOMI_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** Il mese di un numero seriale di data, come 'AAAA-MM'. */
export function chiaveMese(seriale: number): string {
  const d = serialToDate(Math.floor(seriale));
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** I mesi presenti, raggruppati per anno e in ordine di calendario: serve alla finestra del filtro per data. La chiave vuota (celle senza data) non entra. */
export function raggruppaMesi(chiavi: readonly string[]): Array<{ anno: string; mesi: Array<{ chiave: string; etichetta: string }> }> {
  const perAnno = new Map<string, Array<{ chiave: string; etichetta: string }>>();
  for (const k of [...chiavi].filter((x) => /^\d{4}-\d{2}$/.test(x)).sort()) {
    const anno = k.slice(0, 4);
    if (!perAnno.has(anno)) perAnno.set(anno, []);
    perAnno.get(anno)!.push({ chiave: k, etichetta: NOMI_MESI[Number(k.slice(5)) - 1] });
  }
  return [...perAnno].map(([anno, mesi]) => ({ anno, mesi }));
}

/**
 * Crea una nuova vista filtro vuota o da filtri correnti.
 */
export function createFilterView(
  id: string,
  name: string,
  range: FilterRange,
  initialFilters?: Map<number, ColumnFilter>
): FilterView {
  return {
    id,
    name,
    range: { ...range },
    filters: initialFilters ? new Map(initialFilters) : new Map(),
  };
}

// ---- finestra del filtro di una colonna (valori da spuntare + una condizione) ----

/** Le condizioni che la finestra offre, con quanti valori chiedono (0, 1 o 2) e come si leggono. */
export const CONDIZIONI_FILTRO: ReadonlyArray<{ operator: FilterConditionOperator; etichetta: string; valori: 0 | 1 | 2 }> = [
  { operator: 'none', etichetta: 'Nessuna', valori: 0 },
  { operator: 'empty', etichetta: 'È vuota', valori: 0 },
  { operator: 'not_empty', etichetta: 'Non è vuota', valori: 0 },
  { operator: 'text_contains', etichetta: 'Il testo contiene', valori: 1 },
  { operator: 'text_not_contains', etichetta: 'Il testo non contiene', valori: 1 },
  { operator: 'text_starts_with', etichetta: 'Il testo inizia con', valori: 1 },
  { operator: 'text_ends_with', etichetta: 'Il testo finisce con', valori: 1 },
  { operator: 'text_exact', etichetta: 'Il testo è esattamente', valori: 1 },
  { operator: 'greater_than', etichetta: 'Maggiore di', valori: 1 },
  { operator: 'greater_equal', etichetta: 'Maggiore o uguale a', valori: 1 },
  { operator: 'less_than', etichetta: 'Minore di', valori: 1 },
  { operator: 'less_equal', etichetta: 'Minore o uguale a', valori: 1 },
  { operator: 'equal_to', etichetta: 'È uguale a', valori: 1 },
  { operator: 'not_equal_to', etichetta: 'È diverso da', valori: 1 },
  { operator: 'between', etichetta: 'È compreso tra', valori: 2 },
  { operator: 'not_between', etichetta: 'Non è compreso tra', valori: 2 },
];

/** Quanti valori chiede una condizione (0 se non esiste). */
export function valoriDellaCondizione(operator: FilterConditionOperator): 0 | 1 | 2 {
  return CONDIZIONI_FILTRO.find((c) => c.operator === operator)?.valori ?? 0;
}

/** Una condizione è completa quando ha tutti i valori che chiede (un numero per i confronti numerici). */
export function condizioneCompleta(c: FilterCondition | undefined): c is FilterCondition {
  if (!c || c.operator === 'none') return false;
  const n = valoriDellaCondizione(c.operator);
  const pieno = (v: string | number | undefined) => v !== undefined && String(v).trim() !== '';
  if (n >= 1 && !pieno(c.value1)) return false;
  if (n === 2 && !pieno(c.value2)) return false;
  const numerici: FilterConditionOperator[] = ['greater_than', 'greater_equal', 'less_than', 'less_equal', 'between', 'not_between'];
  if (numerici.includes(c.operator)) {
    if (Number.isNaN(Number(c.value1))) return false;
    if (n === 2 && Number.isNaN(Number(c.value2))) return false;
  }
  return true;
}

/** Dalla scelta fatta nella finestra al filtro della colonna.
 *  `tutti`: tutti i valori della colonna; `spuntati`: quelli lasciati visibili. Se sono spuntati tutti e non c'è una condizione completa
 *  non serve nessun filtro (restituisce `null`, cioè "togli il filtro di questa colonna"). */
export interface SceltaLista { tutti: readonly string[]; spuntati: ReadonlySet<string> }

export function filtroDaScelta(col: number, tutti: readonly string[], spuntati: ReadonlySet<string>, condizione?: FilterCondition, extra?: { sfondo?: SceltaLista; testo?: SceltaLista; mesi?: SceltaLista }): ColumnFilter | null {
  const tuttiSpuntati = tutti.every((v) => spuntati.has(v));
  const conCondizione = condizioneCompleta(condizione);
  const parziale = (x?: SceltaLista): Set<string> | undefined => (x && !x.tutti.every((v) => x.spuntati.has(v)) ? new Set(x.tutti.filter((v) => x.spuntati.has(v))) : undefined);
  const sfondo = parziale(extra?.sfondo);
  const testo = parziale(extra?.testo);
  const mesi = parziale(extra?.mesi);
  if (tuttiSpuntati && !conCondizione && !sfondo && !testo && !mesi) return null;
  const f: ColumnFilter = { col };
  if (sfondo) f.fillColors = sfondo;
  if (testo) f.textColors = testo;
  if (mesi) f.months = mesi;
  if (!tuttiSpuntati) f.selectedValues = new Set(tutti.filter((v) => spuntati.has(v)));
  if (conCondizione) f.condition = { operator: condizione.operator, value1: condizione.value1, ...(valoriDellaCondizione(condizione.operator) === 2 ? { value2: condizione.value2 } : {}) };
  return f;
}
