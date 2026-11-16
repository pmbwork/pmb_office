import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createRangeSelection } from '../../src/sheet/index';
import type { ConditionalFormatRule } from '../../src/sheet/conditional-format';

const regola = (id: string, r1: number, r2: number, c1: number, c2: number): ConditionalFormatRule => ({
  id, type: 'cell_value', operator: 'greater_than', value1: 10, style: { backgroundColor: '#ff0000' },
  range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 },
});

describe('T515: Incolla speciale > Solo formato porta le formattazioni condizionali', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  beforeEach(async () => {
    const tabId = `test-T515-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  const doc = () => grid['getDoc']();
  const seleziona = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc().selection.range = createRangeSelection(r1, c1, r2, c2).range; };
  const zone = () => doc().conditionalFormats.map((r) => [r.range.startRow, r.range.endRow, r.range.startCol, r.range.endCol]);

  it('Solo formato porta la regola, annulla la toglie, ripeti la rimette', async () => {
    doc().conditionalFormats.push(regola('a', 1, 3, 1, 1));
    seleziona(1, 1, 3, 1);
    await grid.copy();
    seleziona(1, 4);
    await grid.pasteSpecial('format_only');
    expect(zone()).toEqual([[1, 3, 1, 1], [1, 3, 4, 4]]);
    await grid.undo();
    expect(zone()).toEqual([[1, 3, 1, 1]]);
    await grid.redo();
    expect(zone()).toEqual([[1, 3, 1, 1], [1, 3, 4, 4]]);
  });

  it('Solo valori e Solo formule non portano le regole', async () => {
    doc().conditionalFormats.push(regola('a', 1, 3, 1, 1));
    seleziona(1, 1, 3, 1);
    await grid.copy();
    seleziona(1, 4);
    await grid.pasteSpecial('values_only');
    await grid.pasteSpecial('formulas_only');
    expect(zone()).toEqual([[1, 3, 1, 1]]);
  });

  it('ripetere Solo formato sulla stessa zona non accumula regole', async () => {
    doc().conditionalFormats.push(regola('a', 1, 3, 1, 1));
    seleziona(1, 1, 3, 1);
    await grid.copy();
    seleziona(1, 4);
    await grid.pasteSpecial('format_only');
    await grid.pasteSpecial('format_only');
    expect(zone()).toHaveLength(2);
  });
});
