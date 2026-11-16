/**
 * Modulo puro Viewport: calcolo dell'intervallo visibile da scroll, dimensioni e zoom.
 * Gestisce la virtualizzazione su 1.048.576 righe e 16.384 colonne (A..XFD).
 * Tiene basso il numero di celle nel DOM: sotto 1.500 quando basta togliere il margine extra attorno all'area visibile,
 * e comunque sotto il tetto duro di 6.000. L'area visibile non viene mai tagliata sotto il tetto duro (a schermo intero si vedono tutte le righe).
 * Zero DOM, zero Lit, interamente testabile in ambiente Node.
 */

import { GeometriaRighe } from './geometria';

export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384; // XFD
export const DEFAULT_ROW_HEIGHT = 22; // px
export const DEFAULT_COL_WIDTH = 90; // px
/** oltre questo numero di celle si toglie il margine extra (le righe e colonne fuori dall'area visibile) */
export const MAX_DOM_CELLS_SOFT = 1_500;
/** tetto duro: oltre questo numero anche l'area visibile viene limitata (viewport enorme o zoom minimo) */
export const MAX_DOM_CELLS_CEILING = 6_000;

export interface ViewportConfig {
  scrollTop: number;
  scrollLeft: number;
  viewportWidth: number;
  viewportHeight: number;
  zoom?: number; // percentuale (es. 100, 50..200)
  colWidths?: Map<number, number>;
  rowHeight?: number;
  /** righe nascoste o con altezza personalizzata (misure del foglio, senza zoom); senza, le righe sono tutte alte uguale */
  righe?: GeometriaRighe;
  overscanRows?: number;
  overscanCols?: number;
}

export interface VisibleRange {
  startRow: number; // 1-based inclusivo
  endRow: number;   // 1-based inclusivo
  startCol: number; // 1-based inclusivo
  endCol: number;   // 1-based inclusivo
  rowCount: number;
  colCount: number;
  totalRenderedCells: number;

  // Offset di posizionamento per lo spacer virtuale
  topOffset: number;   // px
  leftOffset: number;  // px

  // Dimensioni totali del foglio virtualizzato
  totalHeight: number; // px
  totalWidth: number;  // px
}

export function getColWidth(col: number, colWidths?: Map<number, number>): number {
  if (colWidths && colWidths.has(col)) {
    return colWidths.get(col)!;
  }
  return DEFAULT_COL_WIDTH;
}

export function computeTotalWidth(colWidths?: Map<number, number>): number {
  let total = MAX_COLS * DEFAULT_COL_WIDTH;
  if (colWidths) {
    for (const [col, w] of colWidths.entries()) {
      if (col >= 1 && col <= MAX_COLS) {
        total += (w - DEFAULT_COL_WIDTH);
      }
    }
  }
  return total;
}

/** L'intervallo visibile; se con il margine extra le celle sono troppe, il margine si toglie e resta solo ciò che si vede. */
export function computeVisibleRange(config: ViewportConfig): VisibleRange {
  const intero = calcolaIntervallo(config);
  if (intero.totalRenderedCells < MAX_DOM_CELLS_SOFT) return intero;
  return calcolaIntervallo({ ...config, overscanRows: 0, overscanCols: 0 });
}

function calcolaIntervallo(config: ViewportConfig): VisibleRange {
  const zoomFactor = (config.zoom || 100) / 100;
  const rowHeight = (config.rowHeight || DEFAULT_ROW_HEIGHT) * zoomFactor;
  const vWidth = Math.max(100, config.viewportWidth);
  const vHeight = Math.max(100, config.viewportHeight);
  const sTop = Math.max(0, config.scrollTop);
  const sLeft = Math.max(0, config.scrollLeft);

  const geom = config.righe && !config.righe.uniforme ? config.righe : undefined;
  const totalHeight = geom ? geom.totale() * zoomFactor : MAX_ROWS * rowHeight;
  const totalWidth = computeTotalWidth(config.colWidths) * zoomFactor;

  // 1. Calcolo righe visibili
  const overscanRows = config.overscanRows !== undefined ? config.overscanRows : 5;
  const overscanCols = config.overscanCols !== undefined ? config.overscanCols : 3;
  let startRow0: number;
  let endRow0: number;
  if (geom) {
    // righe nascoste o di altezza diversa: si cerca per altezza (senza zoom) la prima e l'ultima riga che si vedono
    const primaVisibile = geom.rigaDaY(sTop / zoomFactor);
    const ultimaVisibile = geom.rigaDaY((sTop + vHeight) / zoomFactor);
    startRow0 = Math.max(0, primaVisibile - 1 - overscanRows);
    endRow0 = Math.min(MAX_ROWS - 1, ultimaVisibile - 1 + overscanRows);
  } else {
    const firstVisibleRow0 = Math.floor(sTop / rowHeight);
    const visibleRowCapacity = Math.ceil(vHeight / rowHeight);
    startRow0 = Math.max(0, firstVisibleRow0 - overscanRows);
    endRow0 = Math.min(MAX_ROWS - 1, firstVisibleRow0 + visibleRowCapacity + overscanRows);
  }

  // 2. Calcolo colonne visibili (tenendo conto di eventuali larghezze personalizzate)
  let currentX = 0;
  let startCol0 = 0;
  let endCol0 = 0;
  let foundStart = false;

  // Se non ci sono larghezze custom, calcolo diretto O(1)
  if (!config.colWidths || config.colWidths.size === 0) {
    const colWidth = DEFAULT_COL_WIDTH * zoomFactor;
    const firstVisibleCol0 = Math.floor(sLeft / colWidth);
    const visibleColCapacity = Math.ceil(vWidth / colWidth);

    startCol0 = Math.max(0, firstVisibleCol0 - overscanCols);
    endCol0 = Math.min(MAX_COLS - 1, firstVisibleCol0 + visibleColCapacity + overscanCols);
  } else {
    // Calcolo con larghezze custom
    const targetLeft = sLeft;
    const targetRight = sLeft + vWidth;

    for (let c = 0; c < MAX_COLS; c++) {
      const w = getColWidth(c + 1, config.colWidths) * zoomFactor;
      const nextX = currentX + w;

      if (!foundStart && nextX > targetLeft) {
        startCol0 = Math.max(0, c - overscanCols);
        foundStart = true;
      }
      if (foundStart && currentX >= targetRight) {
        endCol0 = Math.min(MAX_COLS - 1, c + overscanCols);
        break;
      }
      currentX = nextX;
    }
    if (!foundStart) {
      startCol0 = Math.max(0, MAX_COLS - 1 - overscanCols);
      endCol0 = MAX_COLS - 1;
    }
    if (endCol0 < startCol0) {
      endCol0 = Math.min(MAX_COLS - 1, startCol0 + 30);
    }
  }

  // 3. Verifica del tetto duro di celle nel DOM (le righe nascoste non si disegnano: non contano)
  const righeVisibili = (da0: number, a0: number): number => (a0 - da0 + 1) - (geom ? geom.contaNascosteTra(da0 + 1, a0 + 1) : 0);
  let rowCount = righeVisibili(startRow0, endRow0);
  let colCount = endCol0 - startCol0 + 1;
  let totalCells = rowCount * colCount;

  if (totalCells >= MAX_DOM_CELLS_CEILING) {
    // Se supera il tetto duro (viewport enorme o zoom minimo) limita anche l'area visibile
    const maxCols = Math.min(colCount, 40);
    const maxRows = Math.floor((MAX_DOM_CELLS_CEILING - 50) / maxCols);
    endCol0 = Math.min(MAX_COLS - 1, startCol0 + maxCols - 1);
    if (geom) {
      let contate = 0;
      let r0 = startRow0;
      while (r0 <= endRow0 && contate < maxRows) { if (!geom.nascosta(r0 + 1)) contate++; r0++; }
      endRow0 = Math.max(startRow0, r0 - 1);
    } else {
      endRow0 = Math.min(MAX_ROWS - 1, startRow0 + maxRows - 1);
    }
    rowCount = righeVisibili(startRow0, endRow0);
    colCount = endCol0 - startCol0 + 1;
    totalCells = rowCount * colCount;
  }

  // 4. Calcolo topOffset e leftOffset
  const topOffset = geom ? geom.top(startRow0 + 1) * zoomFactor : startRow0 * rowHeight;
  let leftOffset = 0;
  if (!config.colWidths || config.colWidths.size === 0) {
    leftOffset = startCol0 * DEFAULT_COL_WIDTH * zoomFactor;
  } else {
    for (let c = 0; c < startCol0; c++) {
      leftOffset += getColWidth(c + 1, config.colWidths) * zoomFactor;
    }
  }

  return {
    startRow: startRow0 + 1,
    endRow: endRow0 + 1,
    startCol: startCol0 + 1,
    endCol: endCol0 + 1,
    rowCount,
    colCount,
    totalRenderedCells: totalCells,
    topOffset,
    leftOffset,
    totalHeight,
    totalWidth,
  };
}
