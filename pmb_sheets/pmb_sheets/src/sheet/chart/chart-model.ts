/**
 * Modello e tipi per i Grafici di pmb_office Fogli (Milestone M3).
 * Supporta 8 tipi di grafici:
 * - colonne (column)
 * - barre (bar)
 * - linee (line)
 * - area (area)
 * - torta (pie)
 * - ciambella (donut)
 * - dispersione (scatter)
 * - combinato (combo: colonne + linea)
 */

export type ChartType =
  | 'column'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'combo';

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
  type?: 'column' | 'line'; // Per grafico combinato
}

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  sheetName: string;
  dataRange: string; // es. "A1:B5"
  x: number; // coordinate posizionamento sul foglio (in px)
  y: number;
  width: number;
  height: number;
  xAxisTitle?: string;
  yAxisTitle?: string;
  showLegend: boolean;
  showLabels: boolean;
  categories: string[];
  series: ChartSeries[];
}

export const CHART_PALETTE = [
  '#2563eb', // Blu primario
  '#10b981', // Smeraldo
  '#f59e0b', // Ambra
  '#ef4444', // Corallo / Rosso
  '#8b5cf6', // Viola
  '#06b6d4', // Ciano
  '#ec4899', // Rosa
  '#14b8a6', // Foglia di tè
];
