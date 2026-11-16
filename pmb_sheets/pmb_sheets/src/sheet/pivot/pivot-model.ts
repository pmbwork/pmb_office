/**
 * Modello dati per le Tabelle Pivot di pmb_office Fogli (M3).
 */

export type PivotAggregation = 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';

export interface PivotField {
  sourceColIndex: number; // 0-based index nella tabella sorgente
  name: string;
}

export interface PivotValueField extends PivotField {
  aggregation: PivotAggregation;
}

export interface PivotFilter {
  sourceColIndex: number;
  name: string;
  allowedValues: string[];
}

export interface PivotConfig {
  id: string;
  name: string;
  sourceSheet: string;
  sourceRange: string; // es. "A1:D10"
  /** Il foglio in cui sta il risultato (si salva nel file: riaperto, la pivot sa dove riscrivere). Assente finché non è stata disegnata. */
  resultSheet?: string;
  rowFields: PivotField[];
  colFields: PivotField[];
  valueFields: PivotValueField[];
  filters: PivotFilter[];
  showGrandTotals: boolean;
  showSubtotals: boolean;
}

export interface PivotResultCell {
  colKey: string;
  value: number | string;
}

export interface PivotResultRow {
  rowKeys: string[];
  cells: PivotResultCell[];
  rowTotal?: number;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
}

export interface PivotTableData {
  colKeys: string[];
  rowHeaders: string[];
  rows: PivotResultRow[];
  grandTotalRow?: PivotResultRow;
}
