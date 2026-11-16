import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createRangeSelection } from '../../src/sheet/index';
import { incollaRegoleTrasposte } from '../../src/sheet/sposta-con-celle';
import type { ConditionalFormatRule } from '../../src/sheet/conditional-format';

const regola = (id: string, r1: number, r2: number, c1: number, c2: number, type: 'cell_value' | 'formula' = 'cell_value'): ConditionalFormatRule => ({
  id, type, operator: 'greater_than', value1: type === 'formula' ? '=A1>1' : 10, style: { backgroundColor: '#ff0000' },
  range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 },
});
const zone = (rs: ConditionalFormatRule[]) => rs.map((r) => [r.range.startRow, r.range.endRow, r.range.startCol, r.range.endCol]);

describe('T518: incollaRegoleTrasposte', () => {
  it('righe e colonne si scambiano rispetto all\'angolo della destinazione', () => {
    const elenco: ConditionalFormatRule[] = [];
    // sorgente A1:C2 (2 righe x 3 colonne); la regola copre la riga 2, colonne 1-3 -> sulla destinazione D5: colonna 2 (E), righe 5-7
    incollaRegoleTrasposte([regola('a', 2, 2, 1, 3)], { startRow: 1, endRow: 2, startCol: 1, endCol: 3 }, 5, 4, elenco);
    expect(zone(elenco)).toEqual([[5, 7, 5, 5]]);
  });
  it('libera la zona trasposta dalle regole che c\'erano e salta quelle con formula', () => {
    const elenco = [regola('d', 5, 9, 4, 4)];
    incollaRegoleTrasposte([regola('f', 1, 2, 1, 3, 'formula')], { startRow: 1, endRow: 2, startCol: 1, endCol: 3 }, 5, 4, elenco);
    expect(zone(elenco)).toEqual([[8, 9, 4, 4]]);
  });
});

describe('T518: Incolla speciale > Trasposto con la griglia vera', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  beforeEach(async () => {
    const tabId = `test-T518-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  const doc = () => grid['getDoc']();
  const seleziona = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc().selection.range = createRangeSelection(r1, c1, r2, c2).range; };
  it('la regola di una colonna diventa la regola di una riga; annulla la toglie', async () => {
    doc().conditionalFormats.push(regola('a', 1, 3, 1, 1));
    seleziona(1, 1, 3, 1);
    await grid.copy();
    seleziona(6, 3);
    await grid.pasteSpecial('transposed');
    expect(zone(doc().conditionalFormats)).toEqual([[1, 3, 1, 1], [6, 6, 3, 5]]);
    await grid.undo();
    expect(zone(doc().conditionalFormats)).toEqual([[1, 3, 1, 1]]);
    await grid.redo();
    expect(zone(doc().conditionalFormats)).toEqual([[1, 3, 1, 1], [6, 6, 3, 5]]);
  });
});
