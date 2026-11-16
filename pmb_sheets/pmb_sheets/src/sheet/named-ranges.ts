import { t } from '../i18n/lingua';
/**
 * Modulo puro di Gestione Nomi di Intervallo (Named Ranges) per Fogli (pmb_office).
 * Gestisce:
 * - Validazione sintattica dei nomi (convenzioni canoniche: niente spazi, non deve somigliare a un riferimento di cella come A1 o R1C1).
 * - Mappatura nome -> foglio e intervallo di coordinate (startRow, startCol, endRow, endCol).
 * - Riscrittura automatica delle formule quando un intervallo viene rinominato.
 * - Risoluzione dei nomi nelle formule del motore di calcolo.
 * Zero DOM, zero dipendenze esterne.
 */

export interface NamedRange {
  name: string;
  sheetName: string;
  rangeString: string; // es. "A1:B10" o "Foglio1!A1:B10"
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/**
 * Verifica se una stringa è un nome valido per un intervallo denominato:
 * - Deve iniziare con una lettera (A-Z, a-z) o un trattino basso (_)
 * - Può contenere solo lettere, numeri e trattini bassi
 * - Lunghezza compresa tra 1 e 255 caratteri
 * - Non può essere un riferimento di cella valido (es. A1, BC12, R1C1)
 * - Non può coincidere con valori booleani TRUE/FALSE
 */
export function isValidNamedRangeName(name: string): boolean {
  if (!name || name.length > 255) return false;

  const validIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (!validIdentifier.test(name)) return false;

  const upper = name.toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE' || upper === 'VERO' || upper === 'FALSO') {
    return false;
  }

  // Verifica che non sia una coordinata di cella tipo A1 o Z9999
  const cellCoordRegex = /^[A-Za-z]{1,3}\d+$/;
  if (cellCoordRegex.test(name)) return false;

  // Verifica sintassi R1C1
  const r1c1Regex = /^R\d+C\d+$/i;
  if (r1c1Regex.test(name)) return false;

  return true;
}

export class NamedRangeRegistry {
  private ranges = new Map<string, NamedRange>();

  public add(range: NamedRange): void {
    if (!isValidNamedRangeName(range.name)) {
      throw new Error(t("Nome intervallo non valido: \"{}\"", range.name));
    }
    this.ranges.set(range.name.toUpperCase(), { ...range });
  }

  public get(name: string): NamedRange | undefined {
    return this.ranges.get(name.toUpperCase());
  }

  public has(name: string): boolean {
    return this.ranges.has(name.toUpperCase());
  }

  public remove(name: string): boolean {
    return this.ranges.delete(name.toUpperCase());
  }

  public rename(oldName: string, newName: string): boolean {
    if (!isValidNamedRangeName(newName)) {
      throw new Error(t("Nuovo nome intervallo non valido: \"{}\"", newName));
    }
    const existing = this.get(oldName);
    if (!existing) return false;

    this.remove(oldName);
    this.add({ ...existing, name: newName });
    return true;
  }

  public getAll(): NamedRange[] {
    return Array.from(this.ranges.values());
  }

  public clear(): void {
    this.ranges.clear();
  }
}

/**
 * Riscrive le formule aggiornando il nome di un intervallo denominato che è stato rinominato.
 */
export function rewriteFormulaOnRangeRename(
  formula: string,
  oldName: string,
  newName: string
): string {
  if (!formula.startsWith('=')) return formula;

  // Cerca il nome come identificatore isolato (non parte di un altro identificatore o stringa)
  const regex = new RegExp(`(?<![A-Za-z0-9_])${oldName}(?![A-Za-z0-9_])`, 'gi');
  return formula.replace(regex, newName);
}

/**
 * Risolve i nomi di intervallo sostituendoli con i riferimenti canonici (es. Fatturato -> Foglio1!A1:B10).
 */
export function expandNamedRangesInFormula(
  formula: string,
  registry: NamedRangeRegistry,
  currentSheet: string
): string {
  if (!formula.startsWith('=')) return formula;

  let expanded = formula;
  for (const nr of registry.getAll()) {
    const regex = new RegExp(`(?<![A-Za-z0-9_])${nr.name}(?![A-Za-z0-9_])`, 'gi');
    const targetRef = nr.sheetName === currentSheet ? nr.rangeString : `${nr.sheetName}!${nr.rangeString}`;
    expanded = expanded.replace(regex, targetRef);
  }

  return expanded;
}
