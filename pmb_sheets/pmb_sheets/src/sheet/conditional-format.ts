/**
 * Modulo puro Formattazione Condizionale per Fogli (pmb_office).
 * Gestisce:
 * - Regole su valore cella (maggiore, minore, compreso, uguale, diverso).
 * - Regole su testo (contiene, non contiene, inizia con, finisce con, vuoto, non vuoto).
 * - Regole su data (oggi, ieri, negli ultimi 7 giorni).
 * - Regole su formula personalizzata.
 * - Scale di colore graduate (2 toni min→max o 3 toni min→mid→max con interpolazione RGB esatta).
 * - Barre dati (percentuale di riempimento graduata proporzionale all'intervallo).
 * - Set di icone semplici (frecce su/neutro/giù, indicatori verde/giallo/rosso).
 * - Gestione priorità e annullamento regole.
 * Zero DOM, zero dipendenze esterne.
 */

export type ConditionalRuleType =
  | 'cell_value'
  | 'text'
  | 'date'
  | 'formula'
  | 'color_scale'
  | 'data_bar'
  | 'icon_set';

export interface ConditionalStyle {
  backgroundColor?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dataBar?: { percent: number; color: string };
  icon?: string;
}

/** Come si fissa un estremo (o il punto medio) di una scala di colore o di una barra dati, come in Excel. */
export type TipoSoglia = 'min' | 'max' | 'numero' | 'percentuale' | 'percentile';
export interface Soglia { tipo: TipoSoglia; valore?: number }
export interface SoglieRegola { min?: Soglia; mid?: Soglia; max?: Soglia }

export interface ConditionalFormatRule {
  id: string;
  type: ConditionalRuleType;
  range: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  };
  operator?: string;
  value1?: string | number;
  value2?: string | number;
  style?: {
    backgroundColor?: string;
    textColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
  // Per scale di colore
  colorScale?: {
    minColor: string; // es. "#fca5a5" (rosso chiaro)
    midColor?: string; // es. "#fef08a" (giallo chiaro)
    maxColor: string; // es. "#86efac" (verde chiaro)
    /** senza soglie: dal valore più basso al più alto, punto medio al 50° percentile */
    soglie?: SoglieRegola;
  };
  // Per barre dati
  dataBar?: {
    color: string;
    /** senza soglie: dal valore più basso al più alto */
    soglie?: SoglieRegola;
  };
  // Per set di icone
  iconSet?: {
    type: 'arrows' | 'traffic_lights';
  };
}

/**
 * Interpola linearmente tra due colori esadecimali (#RRGGBB).
 */
export function interpolateColor(color1: string, color2: string, ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));

  const c1 = parseHexColor(color1);
  const c2 = parseHexColor(color2);

  const red = Math.round(c1.r + (c2.r - c1.r) * r);
  const green = Math.round(c1.g + (c2.g - c1.g) * r);
  const blue = Math.round(c1.b + (c2.b - c1.b) * r);

  return `#${toHex2(red)}${toHex2(green)}${toHex2(blue)}`;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
}

function toHex2(num: number): string {
  const s = num.toString(16);
  return s.length === 1 ? '0' + s : s;
}

/** `ordinati` (i numeri in ordine crescente) serve solo per le soglie a percentile; se manca il percentile si legge come percentuale. */
export type StatisticheIntervallo = { min: number; max: number; count: number; ordinati?: number[] };

/** Minimo, massimo e quantità dei numeri di un intervallo (le celle senza numero non contano); undefined se non ce ne sono. */
export function statisticheNumeri(valori: Iterable<number>): StatisticheIntervallo | undefined {
  const ordinati: number[] = [];
  for (const v of valori) if (Number.isFinite(v)) ordinati.push(v);
  if (ordinati.length === 0) return undefined;
  ordinati.sort((a, b) => a - b);
  return { min: ordinati[0], max: ordinati[ordinati.length - 1], count: ordinati.length, ordinati };
}

/** Il percentile p (0-100) di numeri già in ordine, con l'interpolazione di PERCENTILE.INCL di Excel. */
export function percentileOrdinati(ordinati: readonly number[], p: number): number {
  if (ordinati.length === 0) return 0;
  const k = (Math.max(0, Math.min(100, p)) / 100) * (ordinati.length - 1);
  const i = Math.floor(k);
  return i + 1 < ordinati.length ? ordinati[i] + (ordinati[i + 1] - ordinati[i]) * (k - i) : ordinati[i];
}

/** Il numero a cui corrisponde una soglia, nelle statistiche dell'intervallo della regola. */
export function valoreSoglia(s: Soglia | undefined, predefinita: Soglia, st: StatisticheIntervallo): number {
  const x = s ?? predefinita;
  const v = x.valore ?? 0;
  if (x.tipo === 'min') return st.min;
  if (x.tipo === 'max') return st.max;
  if (x.tipo === 'numero') return v;
  if (x.tipo === 'percentile' && st.ordinati && st.ordinati.length > 0) return percentileOrdinati(st.ordinati, v);
  return st.min + ((st.max - st.min) * Math.max(0, Math.min(100, v))) / 100;
}

const SOGLIA_MIN: Soglia = { tipo: 'min' };
const SOGLIA_MAX: Soglia = { tipo: 'max' };
const SOGLIA_MEDIA: Soglia = { tipo: 'percentile', valore: 50 };

/** Il glifo e il colore con cui si disegna un'icona di un set. */
export const ICONE: Record<string, { glifo: string; colore: string; nome: string }> = {
  arrow_up: { glifo: '▲', colore: '#188038', nome: 'su' },
  arrow_right: { glifo: '▶', colore: '#e37400', nome: 'stabile' },
  arrow_down: { glifo: '▼', colore: '#d93025', nome: 'giù' },
  traffic_green: { glifo: '●', colore: '#188038', nome: 'verde' },
  traffic_yellow: { glifo: '●', colore: '#f9ab00', nome: 'giallo' },
  traffic_red: { glifo: '●', colore: '#d93025', nome: 'rosso' },
};

/**
 * Valuta l'applicazione delle regole di formattazione condizionale per una cella.
 * `rangeStats` può essere un solo valore oppure una funzione che dà le statistiche dell'intervallo di ciascuna regola.
 * Come in Excel le regole che valgono si combinano (per esempio un colore di sfondo e una barra dati); se due danno lo
 * stesso effetto (due colori di sfondo, due icone) vince la prima dell'elenco, cioè la più importante.
 */
export function evaluateConditionalFormats(
  cellValue: string,
  row: number,
  col: number,
  rules: ConditionalFormatRule[],
  statsDati?: StatisticheIntervallo | ((regola: ConditionalFormatRule) => StatisticheIntervallo | undefined),
  customFormulaEvaluator?: (formula: string, row: number, col: number, angolo: { riga: number; colonna: number }) => boolean
): ConditionalStyle | null {
  let esito: ConditionalStyle | null = null;
  for (const rule of rules) {
    const stile = stileDiUnaRegola(cellValue, row, col, rule, statsDati, customFormulaEvaluator);
    if (!stile) continue;
    esito ??= {};
    for (const k of Object.keys(stile) as Array<keyof ConditionalStyle>) {
      if (stile[k] !== undefined && esito[k] === undefined) (esito as Record<string, unknown>)[k] = stile[k];
    }
  }
  return esito;
}

/** Lo stile che una sola regola dà alla cella, oppure null se la regola non vale lì. */
function stileDiUnaRegola(
  cellValue: string,
  row: number,
  col: number,
  rule: ConditionalFormatRule,
  statsDati?: StatisticheIntervallo | ((regola: ConditionalFormatRule) => StatisticheIntervallo | undefined),
  customFormulaEvaluator?: (formula: string, row: number, col: number, angolo: { riga: number; colonna: number }) => boolean
): ConditionalStyle | null {
  {
    // Verifica se la cella ricade nell'intervallo della regola
    if (
      row < rule.range.startRow ||
      row > rule.range.endRow ||
      col < rule.range.startCol ||
      col > rule.range.endCol
    ) {
      return null;
    }

    const rangeStats = typeof statsDati === 'function' ? statsDati(rule) : statsDati;
    const str = (cellValue ?? '').trim();
    const num = Number(str);
    const isNum = !Number.isNaN(num) && str !== '';

    // 1. Scala di colore
    if (rule.type === 'color_scale' && rule.colorScale && isNum && rangeStats) {
      const cs = rule.colorScale;
      const lo = valoreSoglia(cs.soglie?.min, SOGLIA_MIN, rangeStats);
      const hi = valoreSoglia(cs.soglie?.max, SOGLIA_MAX, rangeStats);
      if (hi > lo) {
        let bg = '';
        if (cs.midColor) {
          // il punto medio resta fra i due estremi; sotto il minimo e sopra il massimo valgono i colori estremi
          const m = Math.min(Math.max(valoreSoglia(cs.soglie?.mid, SOGLIA_MEDIA, rangeStats), lo), hi);
          bg = num <= m
            ? interpolateColor(cs.minColor, cs.midColor, m > lo ? (num - lo) / (m - lo) : 1)
            : interpolateColor(cs.midColor, cs.maxColor, hi > m ? (num - m) / (hi - m) : 1);
        } else {
          bg = interpolateColor(cs.minColor, cs.maxColor, (num - lo) / (hi - lo));
        }
        return { backgroundColor: bg };
      }
    }

    // 2. Barra dati
    if (rule.type === 'data_bar' && rule.dataBar && isNum && rangeStats) {
      const lo = valoreSoglia(rule.dataBar.soglie?.min, SOGLIA_MIN, rangeStats);
      const hi = valoreSoglia(rule.dataBar.soglie?.max, SOGLIA_MAX, rangeStats);
      const percent = hi > lo ? Math.max(0, Math.min(100, Math.round(((num - lo) / (hi - lo)) * 100))) : 0;
      return {
        dataBar: {
          percent,
          color: rule.dataBar.color,
        },
      };
    }

    // 3. Set di icone
    if (rule.type === 'icon_set' && rule.iconSet && isNum && rangeStats) {
      const { min, max } = rangeStats;
      const ratio = max > min ? (num - min) / (max - min) : 0.5;
      let icon = '';
      if (rule.iconSet.type === 'arrows') {
        if (ratio >= 0.67) icon = 'arrow_up';
        else if (ratio >= 0.33) icon = 'arrow_right';
        else icon = 'arrow_down';
      } else {
        if (ratio >= 0.67) icon = 'traffic_green';
        else if (ratio >= 0.33) icon = 'traffic_yellow';
        else icon = 'traffic_red';
      }
      return { icon };
    }

    // 4. Valore cella
    if (rule.type === 'cell_value' && isNum) {
      const op = rule.operator || 'greater_than';
      const v1 = Number(rule.value1);
      const v2 = Number(rule.value2);
      let match = false;

      if (op === 'greater_than') match = num > v1;
      else if (op === 'greater_equal') match = num >= v1;
      else if (op === 'less_than') match = num < v1;
      else if (op === 'less_equal') match = num <= v1;
      else if (op === 'equal_to') match = num === v1;
      else if (op === 'not_equal_to') match = num !== v1;
      else if (op === 'between') match = num >= v1 && num <= v2;

      if (match && rule.style) {
        return { ...rule.style };
      }
    }

    // 5. Testo
    if (rule.type === 'text') {
      const op = rule.operator || 'contains';
      const q = String(rule.value1 ?? '').toLowerCase();
      const lowerStr = str.toLowerCase();
      let match = false;

      if (op === 'contains') match = lowerStr.includes(q);
      else if (op === 'not_contains') match = !lowerStr.includes(q);
      else if (op === 'starts_with') match = lowerStr.startsWith(q);
      else if (op === 'ends_with') match = lowerStr.endsWith(q);
      else if (op === 'empty') match = str === '';
      else if (op === 'not_empty') match = str !== '';

      if (match && rule.style) {
        return { ...rule.style };
      }
    }

    // 6. Formula personalizzata
    if (rule.type === 'formula' && rule.value1 && customFormulaEvaluator) {
      if (customFormulaEvaluator(String(rule.value1), row, col, { riga: rule.range.startRow, colonna: rule.range.startCol }) && rule.style) {
        return { ...rule.style };
      }
    }
  }

  return null;
}
