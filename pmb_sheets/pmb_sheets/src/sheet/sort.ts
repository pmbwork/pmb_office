/**
 * Modulo puro di ordinamento per Fogli (pmb_office).
 * Gestisce:
 * - Ordinamento A→Z e Z→A per singola o più colonne (chiavi multiple di ordinamento).
 * - Opzione riga di intestazione (preserva la prima riga dell'intervallo).
 * - Tipi misti (numeri ordinati numericamente, date cronologicamente, testo case-insensitive, celle vuote in fondo).
 * - Calcolo della permutazione delle righe (row mapping).
 * - Riscrittura coerente delle formule per le righe spostate (riferimenti relativi adattati al nuovo indice di riga).
 * Zero DOM, zero dipendenze esterne.
 */

export interface SortKey {
  col: number;
  ascending: boolean;
}

export interface SortRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface SortOptions {
  range: SortRange;
  keys: SortKey[];
  hasHeader?: boolean;
}

export interface SortCellData {
  raw: string;
  display?: string;
  styleId?: number;
}

export interface RowSortResult {
  fromRow: number;
  toRow: number;
}

export interface SortExecutionResult {
  rowMappings: RowSortResult[];
  newOrder: number[]; // Indici originali delle righe ordinate nell'ordine risultante
}

/**
 * Confronta due valori di cella secondo le regole canoniche dei fogli di calcolo:
 * 1. Celle vuote (o solo spazi) vanno sempre in fondo, indipendentemente da ascending.
 * 2. Valori numerici confrontati per grandezza matematica.
 * 3. Valori data (formato YYYY-MM-DD o DD/MM/YYYY) confrontati cronologicamente.
 * 4. Valori testuali confrontati lessicograficamente (case-insensitive).
 */
export function compareCellValues(
  valA: string | undefined | null,
  valB: string | undefined | null,
  ascending = true
): number {
  const strA = (valA ?? '').trim();
  const strB = (valB ?? '').trim();

  const emptyA = strA === '';
  const emptyB = strB === '';

  // Le celle vuote vanno sempre in fondo
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  const numA = Number(strA);
  const numB = Number(strB);
  const isNumA = !Number.isNaN(numA) && !strA.startsWith('=');
  const isNumB = !Number.isNaN(numB) && !strB.startsWith('=');

  let cmp = 0;
  if (isNumA && isNumB) {
    cmp = numA - numB;
  } else if (isNumA && !isNumB) {
    cmp = -1; // Numeri prima del testo
  } else if (!isNumA && isNumB) {
    cmp = 1;
  } else {
    // Prova confronto date (ISO YYYY-MM-DD o IT DD/MM/YYYY)
    const dateA = parseDateToTimestamp(strA);
    const dateB = parseDateToTimestamp(strB);
    if (dateA !== null && dateB !== null) {
      cmp = dateA - dateB;
    } else {
      cmp = strA.toLowerCase().localeCompare(strB.toLowerCase(), undefined, { numeric: true });
    }
  }

  return ascending ? cmp : -cmp;
}

function parseDateToTimestamp(str: string): number | null {
  // ISO date YYYY-MM-DD
  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(str);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]) - 1;
    const d = Number(isoMatch[3]);
    const dt = new Date(Date.UTC(y, m, d));
    return Number.isNaN(dt.getTime()) ? null : dt.getTime();
  }
  // European date DD/MM/YYYY
  const itMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(str);
  if (itMatch) {
    const d = Number(itMatch[1]);
    const m = Number(itMatch[2]) - 1;
    const y = Number(itMatch[3]);
    const dt = new Date(Date.UTC(y, m, d));
    return Number.isNaN(dt.getTime()) ? null : dt.getTime();
  }
  return null;
}

/**
 * Calcola la nuova sequenza di righe data una matrice di dati e opzioni di ordinamento.
 */
export function computeRowSort(
  getCellValue: (row: number, col: number) => string,
  options: SortOptions
): SortExecutionResult {
  const { range, keys, hasHeader = false } = options;
  const startRow = hasHeader ? range.startRow + 1 : range.startRow;
  const endRow = range.endRow;

  if (startRow >= endRow || keys.length === 0) {
    return {
      rowMappings: [],
      newOrder: Array.from({ length: Math.max(0, endRow - startRow + 1) }, (_, i) => startRow + i),
    };
  }

  const rowsToSort: number[] = [];
  for (let r = startRow; r <= endRow; r++) {
    rowsToSort.push(r);
  }

  rowsToSort.sort((rowA, rowB) => {
    for (const key of keys) {
      const valA = getCellValue(rowA, key.col);
      const valB = getCellValue(rowB, key.col);
      const cmp = compareCellValues(valA, valB, key.ascending);
      if (cmp !== 0) return cmp;
    }
    // Preserva stabilità se tutte le chiavi sono uguali
    return rowA - rowB;
  });

  const rowMappings: RowSortResult[] = [];
  for (let i = 0; i < rowsToSort.length; i++) {
    const originalRow = rowsToSort[i];
    const targetRow = startRow + i;
    rowMappings.push({ fromRow: originalRow, toRow: targetRow });
  }

  return {
    rowMappings,
    newOrder: rowsToSort,
  };
}

/**
 * Adatta i riferimenti relativi in una formula quando una riga viene spostata
 * da `oldRow` a `newRow` all'interno di un ordinamento.
 * Riferimenti con coordinate assolute ($) rimangono intatti.
 * Riferimenti che puntano a righe facenti parte del blocco ordinato vengono aggiornati
 * verso la loro nuova posizione mappata.
 */
export function rewriteFormulaOnSort(
  formula: string,
  oldRow: number,
  newRow: number,
  rowMapping: Map<number, number>
): string {
  if (!formula.startsWith('=')) return formula;

  // Regex per tokenizzare riferimenti a celle tipo A1, $A1, A$1, $A$1 o Sheet!A1
  const cellRefRegex = /('?[A-Za-z0-9_]+'?!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g;

  return formula.replace(cellRefRegex, (match, sheetPrefix, colDollar, colLetters, rowDollar, rowDigits) => {
    // Se c'è un prefisso foglio diverso, non tocca
    if (sheetPrefix) return match;

    const rowNum = Number(rowDigits);
    const isRowAbsolute = rowDollar === '$';

    if (isRowAbsolute) {
      return match; // Riga assoluta non cambia mai
    }

    // Se il riferimento punta ad un'altra riga che è stata spostata nell'ordinamento:
    if (rowMapping.has(rowNum)) {
      const mappedRow = rowMapping.get(rowNum)!;
      return `${colDollar}${colLetters}${rowDollar}${mappedRow}`;
    }

    // Se il riferimento è relativo e appartiene alla stessa riga (es. =B3*2 in riga 3)
    if (rowNum === oldRow) {
      return `${colDollar}${colLetters}${rowDollar}${newRow}`;
    }

    return match;
  });
}
