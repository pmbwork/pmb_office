import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createCellSelection } from '../../src/sheet/index';

describe('T464: Duplica foglio copia tutto il foglio', () => {
  let grid: FreeSheetGrid;
  const tabId = 'test-T464';

  beforeEach(async () => {
    const doc = defaultDocumentStore.getOrCreateDocument(tabId);
    doc.selection = createCellSelection(1, 1);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });

  it('copia anche le celle oltre la riga 100 e la colonna Z, formule comprese', async () => {
    const doc = grid['getDoc']();
    const origine = doc.activeSheetName;
    await doc.client.setCell(origine, 1, 1, 'inizio');
    await doc.client.setCell(origine, 150, 1, 'lontano in basso');
    await doc.client.setCell(origine, 1, 40, 'lontano a destra');
    await doc.client.setCell(origine, 500, 60, '=A1&"!"');
    await grid.duplicateCurrentSheet();

    const copia = doc.activeSheetName;
    expect(copia).toBe(`Copia di ${origine}`);
    expect((await doc.client.getCell(copia, 1, 1)).raw).toBe('inizio');
    expect((await doc.client.getCell(copia, 150, 1)).raw).toBe('lontano in basso');
    expect((await doc.client.getCell(copia, 1, 40)).raw).toBe('lontano a destra');
    expect((await doc.client.getCell(copia, 500, 60)).raw).toBe('=A1&"!"');
    // il foglio originale non cambia
    expect((await doc.client.getCell(origine, 150, 1)).raw).toBe('lontano in basso');
  });

  it('duplicando due volte il nome resta unico e non si perde nessuna copia', async () => {
    const doc = grid['getDoc']();
    const origine = doc.activeSheetName;
    await doc.client.setCell(origine, 1, 1, 'x');
    await grid.duplicateCurrentSheet();
    await grid.switchSheet(origine);
    await grid.duplicateCurrentSheet();
    const nomi = await doc.client.listSheets();
    expect(nomi).toContain(`Copia di ${origine}`);
    expect(nomi).toContain(`Copia di ${origine} (2)`);
    expect(new Set(nomi.map((n) => n.toLowerCase())).size).toBe(nomi.length);
  });
});
