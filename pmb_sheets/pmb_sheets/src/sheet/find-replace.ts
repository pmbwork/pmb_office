/**
 * Modulo puro Trova e Sostituisci per Fogli (pmb_office).
 * Gestisce:
 * - Ricerca nel foglio corrente o in tutti i fogli della cartella di lavoro.
 * - Opzioni avanzate: corrispondenza maiuscole/minuscole (matchCase), cella intera (entireCell), espressioni regolari (useRegex).
 * - Ricerca nelle formule (raw) o nei valori calcolati/visualizzati (display).
 * - Trova successivo / precedente con ordinamento naturale delle celle (per riga, poi per colonna).
 * - Sostituisci singolo e Sostituisci tutto con calcolo deterministico delle modifiche e conteggio.
 * Zero DOM, zero dipendenze esterne.
 */

export interface FindOptions {
  query: string;
  sheetNames?: string[];
  currentSheetName?: string;
  searchAllSheets?: boolean;
  matchCase?: boolean;
  entireCell?: boolean;
  useRegex?: boolean;
  searchInFormulas?: boolean;
}

export interface ReplaceOptions extends FindOptions {
  replacement: string;
}

export interface CellMatch {
  sheetName: string;
  row: number;
  col: number;
  text: string;
  isFormula: boolean;
}

export interface ReplacementItem {
  sheetName: string;
  row: number;
  col: number;
  oldValue: string;
  newValue: string;
}

export interface ReplaceAllResult {
  replacements: ReplacementItem[];
  count: number;
}

export interface SheetCellProvider {
  (sheetName: string, row: number, col: number): { raw: string; display: string } | undefined;
}

export interface SheetBoundsProvider {
  (sheetName: string): { maxRow: number; maxCol: number };
}

/**
 * Costruisce una RegExp sicura in base alle opzioni di ricerca.
 */
export function buildSearchRegex(options: FindOptions): RegExp | null {
  const { query, matchCase = false, entireCell = false, useRegex = false } = options;
  if (!query) return null;

  let pattern = query;
  if (!useRegex) {
    // Escape caratteri speciali regex se non è modalità regex pura
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  if (entireCell) {
    pattern = `^${pattern}$`;
  }

  const flags = matchCase ? 'g' : 'gi';
  try {
    return new RegExp(pattern, flags);
  } catch {
    // Regex malformata inserita dall'utente
    return null;
  }
}

/**
 * Trova tutte le corrispondenze nella cartella o nel foglio specificato.
 */
export function findAllMatches(
  options: FindOptions,
  getSheetBounds: SheetBoundsProvider,
  getCell: SheetCellProvider
): CellMatch[] {
  const regex = buildSearchRegex(options);
  if (!regex) return [];

  const sheetsToSearch: string[] =
    options.searchAllSheets && options.sheetNames && options.sheetNames.length > 0
      ? options.sheetNames
      : [options.currentSheetName || 'Foglio1'];

  const matches: CellMatch[] = [];

  for (const sheetName of sheetsToSearch) {
    const bounds = getSheetBounds(sheetName);
    const maxRow = Math.max(1, bounds.maxRow);
    const maxCol = Math.max(1, bounds.maxCol);

    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const cell = getCell(sheetName, r, c);
        if (!cell) continue;

        const targetText = options.searchInFormulas ? cell.raw : cell.display || cell.raw;
        if (!targetText) continue;

        regex.lastIndex = 0;
        if (regex.test(targetText)) {
          matches.push({
            sheetName,
            row: r,
            col: c,
            text: targetText,
            isFormula: cell.raw.startsWith('='),
          });
        }
      }
    }
  }

  return matches;
}

/**
 * Trova la corrispondenza successiva a partire dalla cella attiva.
 */
export function findNextMatch(
  matches: CellMatch[],
  currentSheet: string,
  currentRow: number,
  currentCol: number
): CellMatch | null {
  if (matches.length === 0) return null;

  // Cerca il primo match che compare DOPO la posizione corrente
  for (const m of matches) {
    if (m.sheetName === currentSheet) {
      if (m.row > currentRow || (m.row === currentRow && m.col > currentCol)) {
        return m;
      }
    }
  }

  // Se non trovato dopo, fa wrap-around tornando al primo match
  return matches[0];
}

/**
 * Trova la corrispondenza precedente a partire dalla cella attiva.
 */
export function findPreviousMatch(
  matches: CellMatch[],
  currentSheet: string,
  currentRow: number,
  currentCol: number
): CellMatch | null {
  if (matches.length === 0) return null;

  // Cerca all'indietro
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.sheetName === currentSheet) {
      if (m.row < currentRow || (m.row === currentRow && m.col < currentCol)) {
        return m;
      }
    }
  }

  // Wrap-around all'ultimo
  return matches[matches.length - 1];
}

/**
 * Esegue la sostituzione su un singolo testo di cella.
 */
export function performTextReplacement(
  originalText: string,
  options: ReplaceOptions
): string {
  const regex = buildSearchRegex(options);
  if (!regex) return originalText;

  regex.lastIndex = 0;
  return originalText.replace(regex, options.replacement);
}

/**
 * Esegue la sostituzione globale (Sostituisci tutto) su tutti i match trovati.
 */
export function executeReplaceAll(
  options: ReplaceOptions,
  getSheetBounds: SheetBoundsProvider,
  getCell: SheetCellProvider
): ReplaceAllResult {
  const matches = findAllMatches(options, getSheetBounds, getCell);
  const replacements: ReplacementItem[] = [];

  for (const m of matches) {
    const cell = getCell(m.sheetName, m.row, m.col);
    if (!cell) continue;

    const source = options.searchInFormulas ? cell.raw : cell.raw; // Scrittura sempre su raw
    const updated = performTextReplacement(source, options);

    if (updated !== source) {
      replacements.push({
        sheetName: m.sheetName,
        row: m.row,
        col: m.col,
        oldValue: source,
        newValue: updated,
      });
    }
  }

  return {
    replacements,
    count: replacements.length,
  };
}
