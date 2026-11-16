// Quali celle del foglio hanno qualcosa dentro, per Ctrl+frecce (salto al bordo del blocco di dati) e Ctrl+Fine (ultima cella usata).
import type { Workbook } from '../engine/workbook';
import type { NavContext } from './navigation';

/** Il contesto di navigazione di un foglio del libro: una cella è piena se ha un contenuto o un risultato (anche espanso da una formula). */
export function contestoNavigazione(libro: Workbook, foglio: string, righeVisibili?: number): NavContext {
  const f = libro.getSheet(foglio);
  const piena = (r: number, c: number): boolean => {
    const cella = f?.getCell(r, c);
    return cella !== undefined && (cella.raw !== '' || cella.value.kind !== 'empty');
  };
  let ultimaRiga = 0;
  let ultimaColonna = 0;
  if (f) {
    for (const { row, col, cell } of f.getAllCells()) {
      if (cell.raw === '' && cell.value.kind === 'empty') continue;
      if (row > ultimaRiga) ultimaRiga = row;
      if (col > ultimaColonna) ultimaColonna = col;
    }
  }
  return { isFilled: piena, maxUsedRow: ultimaRiga || 1, maxUsedCol: ultimaColonna || 1, viewportRowCount: righeVisibili };
}
