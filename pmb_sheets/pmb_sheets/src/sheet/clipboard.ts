/**
 * Modulo puro Appunti (Clipboard):
 * - Generazione e parsing TSV standard con supporto per celle quotate, tabulazioni e ritorni a capo.
 * - Modello appunti interno con formule grezze e valori visualizzati.
 * - Traslazione delle formule con shiftFormula per incolla interno.
 * - Ripetizione tiled del blocco se l'intervallo di destinazione è un multiplo esatto.
 * Zero DOM, zero Lit, interamente testabile in ambiente Node.
 */

import { CellRange } from './selection';
import { shiftFormula } from '../engine/shift-formula';
import { MAX_ROWS, MAX_COLS } from '../engine/address';

import { CellStyle } from './styles';

import type { SopraLeCelle } from './sposta-con-celle';

export interface InternalClipboardData {
  rawGrid: string[][];
  displayGrid: string[][];
  styleGrid?: (number | undefined)[][];
  styleSnapshot?: CellStyle[];
  sourceRange: CellRange;
  /** il foglio da cui sono state copiate o tagliate le celle */
  sourceSheet?: string;
  /** il testo scritto negli appunti di sistema insieme a questa copia: serve a capire se negli appunti c'è ancora la nostra copia */
  tsv?: string;
  isCut?: boolean;
  /** commenti, convalide e celle unite che stavano sopra le celle copiate, fotografati al momento della copia */
  sopra?: SopraLeCelle;
}

/** Il testo degli appunti di sistema, reso confrontabile (a capo uniformi, senza a capo finale). */
export function normalizzaTsv(testo: string): string {
  return testo.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

// Registro singleton in memoria per gli appunti interni dell'applicazione
let internalClipboard: InternalClipboardData | null = null;

export function setInternalClipboard(data: InternalClipboardData | null): void {
  internalClipboard = data;
}

export function getInternalClipboard(): InternalClipboardData | null {
  return internalClipboard;
}

/**
 * Genera stringa TSV a partire da una matrice di valori stringa.
 * Se una cella contiene tabulazioni, a capo o doppi apici, viene racchiusa tra doppi apici con escape ("").
 */
export function generateTSV(grid: string[][]): string {
  return grid
    .map((row) =>
      row
        .map((cell) => {
          const str = cell ?? '';
          if (str.includes('\t') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join('\t')
    )
    .join('\r\n');
}

/**
 * Effettua il parsing di una stringa TSV (con supporto RFC 4180 per virgolette, a capo e tab).
 */
export function parseTSV(tsvText: string): string[][] {
  const result: string[][] = [];
  if (!tsvText || tsvText.trim() === '') return result;

  const text = tsvText;
  let row: string[] = [];
  let curCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          curCell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        curCell += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (ch === '\t') {
        row.push(curCell);
        curCell = '';
        i++;
        continue;
      } else if (ch === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        row.push(curCell);
        result.push(row);
        row = [];
        curCell = '';
        i++;
        continue;
      } else if (ch === '\n') {
        row.push(curCell);
        result.push(row);
        row = [];
        curCell = '';
        i++;
        continue;
      } else {
        curCell += ch;
        i++;
        continue;
      }
    }
  }

  // Ultima cella e riga
  row.push(curCell);
  result.push(row);

  // Se l'ultima riga è vuota (dovuta a terminatore di riga finale), la rimuove
  if (result.length > 1 && result[result.length - 1].length === 1 && result[result.length - 1][0] === '') {
    result.pop();
  }

  return result;
}

export interface CellPasteTarget {
  row: number;
  col: number;
  raw: string;
  styleId?: number;
}

/**
 * Calcola l'insieme di celle da scrivere durante un'operazione di incolla.
 * Se la destinazione è un multiplo esatto in entrambe le dimensioni della sorgente,
 * ripete il blocco a piastrelle (tiling); altrimenti incolla una singola volta dall'angolo in alto a sinistra.
 */
export function computePasteOperations(
  sourceRaw: string[][],
  targetRange: CellRange,
  sourceOriginRow?: number,
  sourceOriginCol?: number,
  sourceStyles?: (number | undefined)[][]
): CellPasteTarget[] {
  const operations: CellPasteTarget[] = [];
  const srcRows = sourceRaw.length;
  if (srcRows === 0) return operations;
  const srcCols = sourceRaw[0].length;
  if (srcCols === 0) return operations;

  const targetRows = targetRange.endRow - targetRange.startRow + 1;
  const targetCols = targetRange.endCol - targetRange.startCol + 1;

  // Verifica se la selezione di destinazione è un multiplo esatto
  const isMultipleRows = targetRows > srcRows && targetRows % srcRows === 0;
  const isMultipleCols = targetCols > srcCols && targetCols % srcCols === 0;

  let repeatRows = 1;
  let repeatCols = 1;

  if (targetRows === srcRows && targetCols === srcCols) {
    repeatRows = 1;
    repeatCols = 1;
  } else if ((targetRows > 1 || targetCols > 1) && isMultipleRows && isMultipleCols) {
    repeatRows = targetRows / srcRows;
    repeatCols = targetCols / srcCols;
  } else if (targetRows > 1 && isMultipleRows && targetCols === 1 && srcCols === 1) {
    repeatRows = targetRows / srcRows;
    repeatCols = 1;
  } else if (targetCols > 1 && isMultipleCols && targetRows === 1 && srcRows === 1) {
    repeatRows = 1;
    repeatCols = targetCols / srcCols;
  }

  const baseOriginRow = sourceOriginRow !== undefined ? sourceOriginRow : targetRange.startRow;
  const baseOriginCol = sourceOriginCol !== undefined ? sourceOriginCol : targetRange.startCol;

  for (let repR = 0; repR < repeatRows; repR++) {
    for (let repC = 0; repC < repeatCols; repC++) {
      for (let r = 0; r < srcRows; r++) {
        for (let c = 0; c < srcCols; c++) {
          const destRow = targetRange.startRow + repR * srcRows + r;
          const destCol = targetRange.startCol + repC * srcCols + c;

          if (destRow < 1 || destRow > MAX_ROWS || destCol < 1 || destCol > MAX_COLS) {
            continue;
          }

          const raw = sourceRaw[r][c];
          let finalRaw = raw;

          // Se è una formula, applica shiftFormula rispetto al delta di spostamento
          if (raw && raw.startsWith('=')) {
            const deltaR = destRow - (baseOriginRow + r);
            const deltaC = destCol - (baseOriginCol + c);
            try {
              finalRaw = shiftFormula(raw, deltaR, deltaC);
            } catch {
              finalRaw = raw;
            }
          }

          const styleId = sourceStyles?.[r]?.[c];

          operations.push({
            row: destRow,
            col: destCol,
            raw: finalRaw,
            styleId,
          });
        }
      }
    }
  }

  return operations;
}
