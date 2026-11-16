/**
 * Modulo puro Navigazione da tastiera:
 * - Regole frecce, Ctrl+frecce (salto al bordo del blocco di dati),
 *   Home, Ctrl+Home, Ctrl+Fine, PagSu/PagGiù, estensione con Maiusc.
 * Zero DOM, zero Lit, interamente testabile in ambiente Node.
 */

import {
  SelectionState,
  createCellSelection,
  createRangeSelection,
  clampRow,
  clampCol,
} from './selection';
import { MAX_ROWS, MAX_COLS } from '../engine/address';

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface NavContext {
  isFilled?: (row: number, col: number) => boolean;
  maxUsedRow?: number;
  maxUsedCol?: number;
  viewportRowCount?: number;
}

/**
 * Calcola la nuova posizione per Ctrl+Freccia saltando al bordo del blocco dati.
 * Regola:
 * - Se la cella corrente e la successiva sono piene: vai all'ultima piena della sequenza continua.
 * - Altrimenti: cerca la prossima cella piena nella direzione; se non ce ne sono, vai al limite del foglio.
 */
export function findBoundaryJump(
  startRow: number,
  startCol: number,
  dir: NavDirection,
  context: NavContext
): { row: number; col: number } {
  const isFilled = context.isFilled || (() => false);

  const dRow = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
  const dCol = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;

  const currentFilled = isFilled(startRow, startCol);
  const nextR = startRow + dRow;
  const nextC = startCol + dCol;

  // Se siamo già al limite del foglio
  if (nextR < 1 || nextR > MAX_ROWS || nextC < 1 || nextC > MAX_COLS) {
    return { row: startRow, col: startCol };
  }

  const nextFilled = isFilled(nextR, nextC);

  if (currentFilled && nextFilled) {
    // Caso 1: sia corrente che successiva sono piene -> vai all'ultima piena della sequenza
    let curR = nextR;
    let curC = nextC;
    while (true) {
      const stepR = curR + dRow;
      const stepC = curC + dCol;
      if (stepR < 1 || stepR > MAX_ROWS || stepC < 1 || stepC > MAX_COLS) {
        return { row: curR, col: curC };
      }
      if (!isFilled(stepR, stepC)) {
        return { row: curR, col: curC };
      }
      curR = stepR;
      curC = stepC;
    }
  } else {
    // Caso 2: corrente o successiva vuota -> cerca la prima piena, o vai al limite
    let curR = nextR;
    let curC = nextC;
    while (curR >= 1 && curR <= MAX_ROWS && curC >= 1 && curC <= MAX_COLS) {
      if (isFilled(curR, curC)) {
        return { row: curR, col: curC };
      }
      curR += dRow;
      curC += dCol;
    }
    // Nessuna piena trovata: limite del foglio
    return {
      row: dir === 'up' ? 1 : dir === 'down' ? MAX_ROWS : startRow,
      col: dir === 'left' ? 1 : dir === 'right' ? MAX_COLS : startCol,
    };
  }
}

export function handleNavigationKey(
  currentSel: SelectionState,
  key: string,
  modifiers: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  context: NavContext = {}
): SelectionState | null {
  if (modifiers.altKey) return null;

  const active = currentSel.active;
  const anchor = currentSel.anchor;
  const shift = Boolean(modifiers.shiftKey);
  const ctrl = Boolean(modifiers.ctrlKey);

  let targetRow = active.row;
  let targetCol = active.col;

  switch (key) {
    case 'ArrowUp':
      if (ctrl) {
        const jump = findBoundaryJump(active.row, active.col, 'up', context);
        targetRow = jump.row;
        targetCol = jump.col;
      } else {
        targetRow = clampRow(active.row - 1);
      }
      break;

    case 'ArrowDown':
      if (ctrl) {
        const jump = findBoundaryJump(active.row, active.col, 'down', context);
        targetRow = jump.row;
        targetCol = jump.col;
      } else {
        targetRow = clampRow(active.row + 1);
      }
      break;

    case 'ArrowLeft':
      if (ctrl) {
        const jump = findBoundaryJump(active.row, active.col, 'left', context);
        targetRow = jump.row;
        targetCol = jump.col;
      } else {
        targetCol = clampCol(active.col - 1);
      }
      break;

    case 'ArrowRight':
      if (ctrl) {
        const jump = findBoundaryJump(active.row, active.col, 'right', context);
        targetRow = jump.row;
        targetCol = jump.col;
      } else {
        targetCol = clampCol(active.col + 1);
      }
      break;

    case 'Home':
      if (ctrl) {
        targetRow = 1;
        targetCol = 1;
      } else {
        targetCol = 1;
      }
      break;

    case 'End':
      if (ctrl) {
        targetRow = clampRow(context.maxUsedRow || 1);
        targetCol = clampCol(context.maxUsedCol || 1);
      }
      break;

    case 'PageUp': {
      const step = context.viewportRowCount || 20;
      targetRow = clampRow(active.row - step);
      break;
    }

    case 'PageDown': {
      const step = context.viewportRowCount || 20;
      targetRow = clampRow(active.row + step);
      break;
    }

    default:
      return null;
  }

  if (targetRow === active.row && targetCol === active.col && !shift && currentSel.range.startRow === currentSel.range.endRow && currentSel.range.startCol === currentSel.range.endCol) {
    return currentSel;
  }

  if (shift) {
    return createRangeSelection(anchor.row, anchor.col, targetRow, targetCol);
  } else {
    return createCellSelection(targetRow, targetCol);
  }
}
