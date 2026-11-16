/**
 * Modulo puro Unione Celle (Cell Merge) per Fogli (pmb_office).
 * Gestisce:
 * - Unisci tutto (mergeAll)
 * - Unisci orizzontalmente (mergeHorizontal)
 * - Unisci verticalmente (mergeVertical)
 * - Scorpora / Annulla unione (unmerge)
 * - Identificazione cella master/ancora (top-left) e celle subordinate coperte.
 * - Calcolo di colSpan e rowSpan per il rendering della griglia.
 * - Adattamento delle coordinate delle celle unite su inserimento/cancellazione righe e colonne.
 * Zero DOM, zero dipendenze esterne.
 */

export interface MergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface CellMergeInfo {
  merge: MergeRange;
  isAnchor: boolean;
  rowSpan: number;
  colSpan: number;
}

/**
 * Normalizza e convalida che un intervallo sia un'unione valida (almeno 2 celle).
 */
export function createMergeRange(
  r1: number,
  c1: number,
  r2: number,
  c2: number
): MergeRange | null {
  const startRow = Math.min(r1, r2);
  const endRow = Math.max(r1, r2);
  const startCol = Math.min(c1, c2);
  const endCol = Math.max(c1, c2);

  if (startRow === endRow && startCol === endCol) {
    return null; // Singola cella, non è un'unione
  }

  return { startRow, endRow, startCol, endCol };
}

/**
 * Verifica se due intervalli si sovrappongono.
 */
export function rangesOverlap(a: MergeRange, b: MergeRange): boolean {
  return (
    a.startRow <= b.endRow &&
    a.endRow >= b.startRow &&
    a.startCol <= b.endCol &&
    a.endCol >= b.startCol
  );
}

/**
 * Unisce tutte le celle della selezione in un unico intervallo.
 */
export function mergeAll(selection: MergeRange, existingMerges: MergeRange[]): MergeRange[] {
  const newRange = createMergeRange(
    selection.startRow,
    selection.startCol,
    selection.endRow,
    selection.endCol
  );
  if (!newRange) return existingMerges;

  // Rimuove eventuali unioni preesistenti che si sovrappongono
  const filtered = existingMerges.filter((m) => !rangesOverlap(m, newRange));
  filtered.push(newRange);
  return filtered;
}

/**
 * Unisce le celle orizzontalmente (una fusione per ciascuna riga della selezione).
 */
export function mergeHorizontal(selection: MergeRange, existingMerges: MergeRange[]): MergeRange[] {
  if (selection.startCol === selection.endCol) {
    return existingMerges; // Solo una colonna, niente da fondere orizzontalmente
  }

  let result = [...existingMerges];
  for (let r = selection.startRow; r <= selection.endRow; r++) {
    const range: MergeRange = {
      startRow: r,
      endRow: r,
      startCol: selection.startCol,
      endCol: selection.endCol,
    };
    result = result.filter((m) => !rangesOverlap(m, range));
    result.push(range);
  }

  return result;
}

/**
 * Unisce le celle verticalmente (una fusione per ciascuna colonna della selezione).
 */
export function mergeVertical(selection: MergeRange, existingMerges: MergeRange[]): MergeRange[] {
  if (selection.startRow === selection.endRow) {
    return existingMerges;
  }

  let result = [...existingMerges];
  for (let c = selection.startCol; c <= selection.endCol; c++) {
    const range: MergeRange = {
      startRow: selection.startRow,
      endRow: selection.endRow,
      startCol: c,
      endCol: c,
    };
    result = result.filter((m) => !rangesOverlap(m, range));
    result.push(range);
  }

  return result;
}

/**
 * Scorpora / annulla l'unione per tutte le celle dell'intervallo selezionato.
 */
export function unmergeCells(selection: MergeRange, existingMerges: MergeRange[]): MergeRange[] {
  return existingMerges.filter((m) => !rangesOverlap(m, selection));
}

/**
 * Restituisce le informazioni di unione per una specifica cella (row, col).
 */
export function getCellMergeInfo(
  row: number,
  col: number,
  merges: MergeRange[]
): CellMergeInfo | null {
  for (const m of merges) {
    if (row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol) {
      const isAnchor = row === m.startRow && col === m.startCol;
      const rowSpan = m.endRow - m.startRow + 1;
      const colSpan = m.endCol - m.startCol + 1;
      return { merge: m, isAnchor, rowSpan, colSpan };
    }
  }
  return null;
}

/**
 * Indica se la cella è coperta da un'unione (non è l'ancora e quindi non va disegnata).
 */
export function isCellCoveredByMerge(row: number, col: number, merges: MergeRange[]): boolean {
  const info = getCellMergeInfo(row, col, merges);
  return info !== null && !info.isAnchor;
}

/**
 * Adatta gli intervalli di unione in seguito a inserimento o eliminazione di righe o colonne.
 */
export function adjustMergesOnStructureChange(
  merges: MergeRange[],
  type: 'insert_rows' | 'delete_rows' | 'insert_cols' | 'delete_cols',
  index: number,
  count: number
): MergeRange[] {
  const updated: MergeRange[] = [];

  for (const m of merges) {
    let { startRow, endRow, startCol, endCol } = m;

    if (type === 'insert_rows') {
      if (index <= startRow) {
        startRow += count;
        endRow += count;
      } else if (index <= endRow) {
        endRow += count; // Espande l'unione
      }
    } else if (type === 'delete_rows') {
      const delEnd = index + count - 1;
      // Se l'unione è interamente dentro l'intervallo eliminato, viene rimossa
      if (startRow >= index && endRow <= delEnd) {
        continue;
      }
      if (index <= startRow) {
        startRow = Math.max(index, startRow - count);
        endRow = Math.max(startRow, endRow - count);
      } else if (index <= endRow) {
        endRow = Math.max(startRow, endRow - Math.min(count, endRow - index + 1));
      }
    } else if (type === 'insert_cols') {
      if (index <= startCol) {
        startCol += count;
        endCol += count;
      } else if (index <= endCol) {
        endCol += count;
      }
    } else if (type === 'delete_cols') {
      const delEnd = index + count - 1;
      if (startCol >= index && endCol <= delEnd) {
        continue;
      }
      if (index <= startCol) {
        startCol = Math.max(index, startCol - count);
        endCol = Math.max(startCol, endCol - count);
      } else if (index <= endCol) {
        endCol = Math.max(startCol, endCol - Math.min(count, endCol - index + 1));
      }
    }

    // Se dopo la contrazione l'unione è diventata 1x1, si dissolve
    if (startRow === endRow && startCol === endCol) {
      continue;
    }

    updated.push({ startRow, endRow, startCol, endCol });
  }

  return updated;
}
