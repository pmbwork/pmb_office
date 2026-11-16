import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/components/sheet-grid';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/document-store';

describe('FreeSheetGrid Data Operations Component Tests (M2)', () => {
  let grid: FreeSheetGrid;

  beforeEach(async () => {
    defaultDocumentStore.clear();
    grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
    grid.tabId = 'test-data-tab';
    document.body.appendChild(grid);
    await grid.updateComplete;
  });

  it('1. Ordinamento crescente A→Z su colonna riordina le celle e le formule', async () => {
    const doc = (grid as any).getDoc();
    await doc.client.setCell(doc.activeSheetName, 1, 1, '50');
    await doc.client.setCell(doc.activeSheetName, 2, 1, '10');
    await doc.client.setCell(doc.activeSheetName, 3, 1, '30');

    // Seleziona intervallo A1:A3
    (grid as any).selectSingle(1, 1);
    (grid as any).extendSelectionTo(3, 1);

    await grid.sortAsc();

    const c1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
    const c2 = await doc.client.getCell(doc.activeSheetName, 2, 1);
    const c3 = await doc.client.getCell(doc.activeSheetName, 3, 1);

    expect(c1.raw).toBe('10');
    expect(c2.raw).toBe('30');
    expect(c3.raw).toBe('50');
  });

  it('2. Ordinamento decrescente Z→A su colonna', async () => {
    const doc = (grid as any).getDoc();
    await doc.client.setCell(doc.activeSheetName, 1, 1, '10');
    await doc.client.setCell(doc.activeSheetName, 2, 1, '30');
    await doc.client.setCell(doc.activeSheetName, 3, 1, '20');

    (grid as any).selectSingle(1, 1);
    (grid as any).extendSelectionTo(3, 1);

    await grid.sortDesc();

    const c1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
    const c2 = await doc.client.getCell(doc.activeSheetName, 2, 1);
    const c3 = await doc.client.getCell(doc.activeSheetName, 3, 1);

    expect(c1.raw).toBe('30');
    expect(c2.raw).toBe('20');
    expect(c3.raw).toBe('10');
  });

  it('3. Attivazione e rimozione filtri', async () => {
    const doc = (grid as any).getDoc();
    expect(doc.isFilterActive).toBe(false);

    grid.toggleFilter();
    expect(doc.isFilterActive).toBe(true);

    grid.clearFilters();
    expect(doc.isFilterActive).toBe(false);
    expect(doc.hiddenRows.size).toBe(0);
  });

  it('4. Unione celle e annulla unione', async () => {
    const doc = (grid as any).getDoc();
    (grid as any).selectSingle(2, 2);
    (grid as any).extendSelectionTo(3, 4); // B2:D3 (2 righe x 3 colonne)

    grid.mergeSelection('all');
    expect(doc.merges.length).toBe(1);
    expect(doc.merges[0]).toEqual({ startRow: 2, endRow: 3, startCol: 2, endCol: 4 });

    grid.unmergeSelection();
    expect(doc.merges.length).toBe(0);
  });

  it('5. Inserimento e toggle casella di controllo', async () => {
    const doc = (grid as any).getDoc();
    (grid as any).selectSingle(1, 1);

    await grid.insertCheckbox();
    const cell = await doc.client.getCell(doc.activeSheetName, 1, 1);
    expect(cell.raw).toBe('FALSE');

    await grid.toggleCheckboxAt(1, 1);
    const toggled = await doc.client.getCell(doc.activeSheetName, 1, 1);
    expect(toggled.raw).toBe('TRUE');
  });

  it('6. Barra Trova e Sostituisci', async () => {
    grid.openFind(true);
    await grid.updateComplete;

    const bar = grid.renderRoot.querySelector('.find-replace-bar');
    expect(bar).not.toBeNull();

    grid.closeFind();
    await grid.updateComplete;
    expect(grid.renderRoot.querySelector('.find-replace-bar')).toBeNull();
  });
});
