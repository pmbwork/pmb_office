/**
 * Modello puro per gli stili e formati delle celle di Fogli.
 * Indipendente dal motore di calcolo; archiviazione sparsa e deduplicazione con registro.
 */

export type BorderLineStyle = 'thin' | 'medium' | 'dashed' | 'none';

export interface BorderDef {
  style: BorderLineStyle;
  color: string;
}

export interface BorderSet {
  top?: BorderDef;
  right?: BorderDef;
  bottom?: BorderDef;
  left?: BorderDef;
}

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontFamily?: string;
  fontSize?: number;
  color?: string; // hex o 'auto'
  fill?: string;  // hex o 'none'
  hAlign?: HorizontalAlign;
  vAlign?: VerticalAlign;
  wrap?: boolean;
  numFmt?: string;
  borders?: BorderSet;
  /** indirizzo del link della cella (vedi link.ts) */
  link?: string;
  /** la cella si può scrivere anche con il foglio protetto (di serie le celle sono bloccate, come in Excel; vedi protezione.ts) */
  sbloccata?: boolean;
  /** con il foglio protetto la formula non si mostra */
  formulaNascosta?: boolean;
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Converte un CellStyle parziale o totale in una chiave canonica univoca per la deduplicazione.
 */
export function canonicalStyleKey(style: Readonly<CellStyle>): string {
  const clean: Record<string, unknown> = {};
  if (style.bold !== undefined) clean.bold = Boolean(style.bold);
  if (style.italic !== undefined) clean.italic = Boolean(style.italic);
  if (style.underline !== undefined) clean.underline = Boolean(style.underline);
  if (style.strike !== undefined) clean.strike = Boolean(style.strike);
  if (style.fontFamily !== undefined && style.fontFamily.trim().length > 0) {
    clean.fontFamily = style.fontFamily.trim();
  }
  if (typeof style.fontSize === 'number' && Number.isFinite(style.fontSize)) {
    clean.fontSize = style.fontSize;
  }
  if (style.color !== undefined && style.color.length > 0) clean.color = style.color;
  if (style.fill !== undefined && style.fill.length > 0) clean.fill = style.fill;
  if (style.hAlign !== undefined) clean.hAlign = style.hAlign;
  if (style.vAlign !== undefined) clean.vAlign = style.vAlign;
  if (style.wrap !== undefined) clean.wrap = Boolean(style.wrap);
  if (style.numFmt !== undefined && style.numFmt.length > 0) clean.numFmt = style.numFmt;
  if (typeof style.link === 'string' && style.link.length > 0) clean.link = style.link;
  // protezione: si tengono solo i valori diversi da quello di serie (bloccata, formula visibile)
  if (style.sbloccata === true) clean.sbloccata = true;
  if (style.formulaNascosta === true) clean.formulaNascosta = true;
  if (style.borders) {
    const borders: Record<string, BorderDef> = {};
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const b = style.borders[side];
      if (b && b.style !== 'none') {
        borders[side] = { style: b.style, color: b.color || '#000000' };
      }
    }
    if (Object.keys(borders).length > 0) {
      clean.borders = borders;
    }
  }

  return stableStringify(clean);
}

/**
 * Registro deduplicato degli stili.
 * Stile 0 e sempre lo stile predefinito vuoto ({}).
 */
export class StyleRegistry {
  private _styles: CellStyle[] = [{}];
  private _keyToId = new Map<string, number>();

  constructor(initialStyles?: readonly CellStyle[]) {
    this._keyToId.set('{}', 0);
    if (initialStyles && initialStyles.length > 0) {
      // Indice 0 deve essere sempre {}
      this._styles = [{}];
      this._keyToId.clear();
      this._keyToId.set('{}', 0);
      for (let i = 0; i < initialStyles.length; i++) {
        const s = initialStyles[i];
        if (i === 0) continue;
        const key = canonicalStyleKey(s);
        if (!this._keyToId.has(key)) {
          const id = this._styles.length;
          this._styles.push(Object.freeze({ ...s }));
          this._keyToId.set(key, id);
        }
      }
    }
  }

  get count(): number {
    return this._styles.length;
  }

  getStyle(id: number): Readonly<CellStyle> {
    if (id < 0 || id >= this._styles.length) {
      return this._styles[0];
    }
    return this._styles[id];
  }

  getAllStyles(): readonly CellStyle[] {
    return this._styles;
  }

  /**
   * Registra uno stile o ne restituisce l'id se gia presente.
   */
  register(style: Readonly<CellStyle>): number {
    const key = canonicalStyleKey(style);
    const existing = this._keyToId.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const id = this._styles.length;
    const frozen = Object.freeze(JSON.parse(key) as CellStyle);
    this._styles.push(frozen);
    this._keyToId.set(key, id);
    return id;
  }

  /**
   * Fondo uno stile esistente con modifiche parziali e restituisce il nuovo id.
   */
  merge(baseId: number, patch: Readonly<Partial<CellStyle>>): number {
    const base = this.getStyle(baseId);
    const merged: CellStyle = { ...base };

    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) {
        delete (merged as Record<string, unknown>)[k];
      } else if (k === 'borders' && typeof v === 'object' && v !== null) {
        const curBorders = { ...(merged.borders || {}) };
        Object.assign(curBorders, v);
        merged.borders = curBorders;
      } else {
        (merged as Record<string, unknown>)[k] = v;
      }
    }

    return this.register(merged);
  }

  clone(): StyleRegistry {
    const next = new StyleRegistry();
    next._styles = [...this._styles];
    next._keyToId = new Map(this._keyToId);
    return next;
  }
}

/**
 * Struttura di memorizzazione sparsa degli stili per un foglio.
 */
export interface SheetStyles {
  registry: StyleRegistry;
  /** r,c -> styleId */
  cellStyles: Map<string, number>;
  /** rowIndex -> styleId */
  rowStyles: Map<number, number>;
  /** colIndex -> styleId */
  colStyles: Map<number, number>;
}

export function createSheetStyles(registry?: StyleRegistry): SheetStyles {
  return {
    registry: registry ?? new StyleRegistry(),
    cellStyles: new Map(),
    rowStyles: new Map(),
    colStyles: new Map(),
  };
}

export function cloneSheetStyles(source: Readonly<SheetStyles>): SheetStyles {
  return {
    registry: source.registry.clone(),
    cellStyles: new Map(source.cellStyles),
    rowStyles: new Map(source.rowStyles),
    colStyles: new Map(source.colStyles),
  };
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } {
  const parts = key.split(',');
  return { row: Number(parts[0]), col: Number(parts[1]) };
}

/**
 * Risoluzione a strati:
 * Cella > Colonna > Riga > Predefinito (stile 0)
 */
export function resolveCellStyle(row: number, col: number, sheetStyles: Readonly<SheetStyles>): Readonly<CellStyle> {
  const key = cellKey(row, col);
  const cellId = sheetStyles.cellStyles.get(key);
  const colId = sheetStyles.colStyles.get(col);
  const rowId = sheetStyles.rowStyles.get(row);

  // Se la cella ha uno stile specifico e col/row non hanno stili, ritorno direttamente
  if (cellId !== undefined && colId === undefined && rowId === undefined) {
    return sheetStyles.registry.getStyle(cellId);
  }
  if (cellId === undefined && colId === undefined && rowId === undefined) {
    return sheetStyles.registry.getStyle(0);
  }

  // Altrimenti componiamo gli strati: Riga <- Colonna <- Cella
  const rowStyle = rowId !== undefined ? sheetStyles.registry.getStyle(rowId) : {};
  const colStyle = colId !== undefined ? sheetStyles.registry.getStyle(colId) : {};
  const cellStyle = cellId !== undefined ? sheetStyles.registry.getStyle(cellId) : {};

  // Merge con precedenza corretta
  const merged: CellStyle = {
    ...rowStyle,
    ...colStyle,
    ...cellStyle,
  };

  // Se ci sono bordi, fondi per singolo lato: cell > col > row
  if (rowStyle.borders || colStyle.borders || cellStyle.borders) {
    merged.borders = {
      ...(rowStyle.borders || {}),
      ...(colStyle.borders || {}),
      ...(cellStyle.borders || {}),
    };
  }

  // lo stile composto serve solo a leggere e a disegnare: non si aggiunge all'elenco degli stili del documento (2026-11-19). Prima si
  // registrava, e il solo disegno di una cella con lo stile della riga e quello della colonna cambiava il documento, che risultava
  // «modificato» appena aperto (lo si è visto aprendo un .xls di Excel 4.0)
  return Object.freeze(merged);
}

/**
 * Applicazione di un formato parziale a un intervallo di celle.
 */
export function applyFormatToRange(
  sheetStyles: SheetStyles,
  range: { startRow: number; endRow: number; startCol: number; endCol: number },
  patch: Readonly<Partial<CellStyle>>,
): void {
  const rMin = Math.min(range.startRow, range.endRow);
  const rMax = Math.max(range.startRow, range.endRow);
  const cMin = Math.min(range.startCol, range.endCol);
  const cMax = Math.max(range.startCol, range.endCol);

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const key = cellKey(r, c);
      const currentId = sheetStyles.cellStyles.get(key) ?? 0;
      const nextId = sheetStyles.registry.merge(currentId, patch);
      if (nextId === 0) {
        sheetStyles.cellStyles.delete(key);
      } else {
        sheetStyles.cellStyles.set(key, nextId);
      }
    }
  }
}

/**
 * Applicazione di un formato a un'intera colonna.
 * Tempo costante O(1) sul dizionario colonne + riscrive la proprieta nelle sole celle gia esistenti
 * di quella colonna in cellStyles (mai 1 milione di celle).
 */
export function applyFormatToColumn(
  sheetStyles: SheetStyles,
  col: number,
  patch: Readonly<Partial<CellStyle>>,
): void {
  const currentId = sheetStyles.colStyles.get(col) ?? 0;
  const nextId = sheetStyles.registry.merge(currentId, patch);
  if (nextId === 0) {
    sheetStyles.colStyles.delete(col);
  } else {
    sheetStyles.colStyles.set(col, nextId);
  }

  // Riscrive la proprieta sulle celle sparse gia esistenti in memoria per questa colonna
  for (const [k, cId] of sheetStyles.cellStyles.entries()) {
    const parsed = parseCellKey(k);
    if (parsed.col === col) {
      const mergedCellId = sheetStyles.registry.merge(cId, patch);
      if (mergedCellId === 0) {
        sheetStyles.cellStyles.delete(k);
      } else {
        sheetStyles.cellStyles.set(k, mergedCellId);
      }
    }
  }
}

/**
 * Applicazione di un formato a un'intera riga.
 * Tempo costante O(1) sul dizionario righe + riscrive la proprieta nelle sole celle sparse esistenti.
 */
export function applyFormatToRow(
  sheetStyles: SheetStyles,
  row: number,
  patch: Readonly<Partial<CellStyle>>,
): void {
  const currentId = sheetStyles.rowStyles.get(row) ?? 0;
  const nextId = sheetStyles.registry.merge(currentId, patch);
  if (nextId === 0) {
    sheetStyles.rowStyles.delete(row);
  } else {
    sheetStyles.rowStyles.set(row, nextId);
  }

  // Riscrive la proprieta sulle celle sparse gia esistenti in memoria per questa riga
  for (const [k, cId] of sheetStyles.cellStyles.entries()) {
    const parsed = parseCellKey(k);
    if (parsed.row === row) {
      const mergedCellId = sheetStyles.registry.merge(cId, patch);
      if (mergedCellId === 0) {
        sheetStyles.cellStyles.delete(k);
      } else {
        sheetStyles.cellStyles.set(k, mergedCellId);
      }
    }
  }
}

/**
 * Cancella la formattazione esplicita per un intervallo di celle.
 */
export function clearFormatFromRange(
  sheetStyles: SheetStyles,
  range: { startRow: number; endRow: number; startCol: number; endCol: number },
): void {
  const rMin = Math.min(range.startRow, range.endRow);
  const rMax = Math.max(range.startRow, range.endRow);
  const cMin = Math.min(range.startCol, range.endCol);
  const cMax = Math.max(range.startCol, range.endCol);

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      sheetStyles.cellStyles.delete(cellKey(r, c));
    }
  }
}
