/**
 * Motore di Calcolo delle Tabelle Pivot per pmb_office Fogli (M3).
 * Raggruppa per righe e colonne, applica filtri e calcola aggregazioni:
 * SUM, COUNT, AVERAGE, MIN, MAX con totali generali e parziali.
 */

import { CellValue, coerceToNumber } from '../../engine';
import {
  PivotConfig,
  PivotTableData,
  PivotResultRow,
  PivotResultCell,
  PivotAggregation,
} from './pivot-model';
import { t } from '../../i18n/lingua';

function cellToString(cell: CellValue): string {
  if (cell.kind === 'text') return cell.value;
  if (cell.kind === 'number') return String(cell.value);
  if (cell.kind === 'boolean') return cell.value ? 'VERO' : 'FALSO';
  if (cell.kind === 'error') return cell.error;
  return '';
}

function aggregateValues(values: number[], agg: PivotAggregation): number {
  if (agg === 'COUNT') return values.length;
  if (values.length === 0) return 0;
  if (agg === 'SUM') return values.reduce((a, b) => a + b, 0);
  if (agg === 'AVERAGE') return values.reduce((a, b) => a + b, 0) / values.length;
  if (agg === 'MIN') return Math.min(...values);
  if (agg === 'MAX') return Math.max(...values);
  return 0;
}

/**
 * Calcola la tabella pivot a partire dalla matrice sorgente (riga 0 = intestazioni, righe 1..N = dati).
 */
export function computePivotTable(
  config: PivotConfig,
  sourceMatrix: CellValue[][]
): PivotTableData {
  if (!sourceMatrix || sourceMatrix.length < 2) {
    return {
      colKeys: [],
      rowHeaders: config.rowFields.map((f) => f.name),
      rows: [],
    };
  }

  const dataRows = sourceMatrix.slice(1);

  // 1. Filtra le righe in base a config.filters
  const filteredRows = dataRows.filter((row) => {
    if (!config.filters || config.filters.length === 0) return true;
    for (const flt of config.filters) {
      if (flt.allowedValues && flt.allowedValues.length > 0) {
        const cellVal = cellToString(row[flt.sourceColIndex] || { kind: 'empty' });
        if (!flt.allowedValues.includes(cellVal)) {
          return false;
        }
      }
    }
    return true;
  });

  // 2. Raccoglie le chiavi di riga e colonna univoche
  // Mappa: rowKey -> colKey -> number[] di valori estratti
  const groups = new Map<string, Map<string, number[]>>();
  const rowKeyMap = new Map<string, string[]>(); // rowKey -> rowKeys array
  const uniqueColKeys = new Set<string>();

  for (const row of filteredRows) {
    // Calcola rowKey (es. "Nord|2023")
    const rParts = config.rowFields.map((f) => cellToString(row[f.sourceColIndex] || { kind: 'empty' }));
    const rowKey = rParts.length > 0 ? rParts.join(' / ') : 'Totale';
    rowKeyMap.set(rowKey, rParts);

    // Calcola colKey (es. "Q1")
    const cParts = config.colFields.map((f) => cellToString(row[f.sourceColIndex] || { kind: 'empty' }));
    const colKey = cParts.length > 0 ? cParts.join(' / ') : t("Valore");
    uniqueColKeys.add(colKey);

    if (!groups.has(rowKey)) {
      groups.set(rowKey, new Map());
    }
    const rowMap = groups.get(rowKey)!;
    if (!rowMap.has(colKey)) {
      rowMap.set(colKey, []);
    }

    // Estrae il valore da aggregare (dal primo valueField se presente)
    if (config.valueFields.length > 0) {
      const vf = config.valueFields[0];
      const cell = row[vf.sourceColIndex] || { kind: 'empty' };
      const num = coerceToNumber(cell);
      const valNum = num.error ? 0 : num.value!;
      rowMap.get(colKey)!.push(valNum);
    } else {
      rowMap.get(colKey)!.push(1); // Default conteggio
    }
  }

  const sortedColKeys = Array.from(uniqueColKeys).sort();
  const sortedRowKeys = Array.from(groups.keys()).sort();
  const aggType = config.valueFields.length > 0 ? config.valueFields[0].aggregation : 'SUM';

  const resultRows: PivotResultRow[] = [];

  // 3. Costruisce le righe di risultato
  for (const rKey of sortedRowKeys) {
    const rowMap = groups.get(rKey)!;
    const cells: PivotResultCell[] = [];
    const allRowNums: number[] = [];

    for (const cKey of sortedColKeys) {
      const nums = rowMap.get(cKey) || [];
      allRowNums.push(...nums);
      const aggResult = nums.length > 0 ? aggregateValues(nums, aggType) : 0;
      cells.push({
        colKey: cKey,
        value: Math.round(aggResult * 100) / 100,
      });
    }

    const rowTotal = allRowNums.length > 0 ? aggregateValues(allRowNums, aggType) : 0;
    resultRows.push({
      rowKeys: rowKeyMap.get(rKey) || [rKey],
      cells,
      rowTotal: Math.round(rowTotal * 100) / 100,
    });
  }

  // 4. Totale Generale (Grand Total Row)
  let grandTotalRow: PivotResultRow | undefined;
  if (config.showGrandTotals) {
    const gtCells: PivotResultCell[] = [];
    const allGrandNums: number[] = [];

    for (const cKey of sortedColKeys) {
      const colNums: number[] = [];
      for (const rowMap of groups.values()) {
        const nums = rowMap.get(cKey);
        if (nums) colNums.push(...nums);
      }
      allGrandNums.push(...colNums);
      const colTotal = colNums.length > 0 ? aggregateValues(colNums, aggType) : 0;
      gtCells.push({
        colKey: cKey,
        value: Math.round(colTotal * 100) / 100,
      });
    }

    const totalGrand = allGrandNums.length > 0 ? aggregateValues(allGrandNums, aggType) : 0;
    grandTotalRow = {
      rowKeys: [t("Totale complessivo")],
      cells: gtCells,
      rowTotal: Math.round(totalGrand * 100) / 100,
      isGrandTotal: true,
    };
  }

  return {
    colKeys: sortedColKeys,
    rowHeaders: config.rowFields.map((f) => f.name),
    rows: resultRows,
    grandTotalRow,
  };
}
