/**
 * Modulo per le operazioni di Incolla Speciale (M1):
 * - Solo valori (mantiene stili e incolla solo i valori calcolati o costanti)
 * - Solo formato (copia solo stili, bordi, font, colori e formati numerici)
 * - Formule senza formato (incolla le formule shiftate ma senza alterare stili destinazione)
 * - Trasposto (inverte righe e colonne: cella in (r, c) va in (destRow + c - 1, destCol + r - 1))
 * - Pennello formato (copia stile da una cella e applica all'intervallo selezionato)
 * Zero DOM, puramente testabile in ambiente Node.
 */

import { CellStyle } from './styles';
import { shiftFormula } from '../engine/shift-formula';
import { formatDisplayValue } from './format-display';
import type { CellValue } from '../engine/values';

export type PasteSpecialType = 'values_only' | 'format_only' | 'formulas_only' | 'transposed';

export interface ClipboardCellPayload {
  rowOffset: number; // 0-based relativo alla selezione d'origine
  colOffset: number; // 0-based relativo alla selezione d'origine
  raw: string;
  value: CellValue;
  style?: CellStyle;
}

export interface PasteSpecialOperation {
  targetRow: number;
  targetCol: number;
  raw?: string;
  style?: CellStyle;
}

/**
 * Calcola l'insieme di operazioni di incolla speciale da applicare sulla destinazione.
 */
export function computePasteSpecial(
  payloads: ClipboardCellPayload[],
  targetStartRow: number,
  targetStartCol: number,
  type: PasteSpecialType
): PasteSpecialOperation[] {
  const operations: PasteSpecialOperation[] = [];

  for (const item of payloads) {
    let tRow: number;
    let tCol: number;

    if (type === 'transposed') {
      // Inversione: riga diventa colonna, colonna diventa riga
      tRow = targetStartRow + item.colOffset;
      tCol = targetStartCol + item.rowOffset;
    } else {
      tRow = targetStartRow + item.rowOffset;
      tCol = targetStartCol + item.colOffset;
    }

    switch (type) {
      case 'values_only': {
        // Incolla il testo del valore calcolato
        const disp = formatDisplayValue(item.value);
        operations.push({
          targetRow: tRow,
          targetCol: tCol,
          raw: disp.text,
        });
        break;
      }

      case 'format_only': {
        if (item.style) {
          operations.push({
            targetRow: tRow,
            targetCol: tCol,
            style: { ...item.style },
          });
        }
        break;
      }

      case 'formulas_only': {
        let formulaRaw = item.raw;
        if (formulaRaw.trim().startsWith('=')) {
          try {
            formulaRaw = shiftFormula(formulaRaw, item.rowOffset, item.colOffset);
          } catch {
            formulaRaw = item.raw;
          }
        }
        operations.push({
          targetRow: tRow,
          targetCol: tCol,
          raw: formulaRaw,
        });
        break;
      }

      case 'transposed': {
        // Sia dati/formule che stili trasposti
        let formulaRaw = item.raw;
        if (formulaRaw.trim().startsWith('=')) {
          try {
            // Su trasposizione una riga diventa colonna
            formulaRaw = shiftFormula(formulaRaw, item.colOffset, item.rowOffset);
          } catch {
            formulaRaw = item.raw;
          }
        }
        operations.push({
          targetRow: tRow,
          targetCol: tCol,
          raw: formulaRaw,
          style: item.style ? { ...item.style } : undefined,
        });
        break;
      }
    }
  }

  return operations;
}
