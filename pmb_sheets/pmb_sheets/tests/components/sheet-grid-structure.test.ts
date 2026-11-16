import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createCellSelection, createRangeSelection } from '../../src/sheet/index';

describe('FreeSheetGrid Structure & Multi-sheet Component Tests (M1)', () => {
  let grid: FreeSheetGrid;
  const tabId = 'test-structure-tab';

  beforeEach(async () => {
    // Reset o creazione documento pulito
    const doc = defaultDocumentStore.getOrCreateDocument(tabId);
    doc.styles.cellStyles.clear();
    doc.selection = createCellSelection(1, 1);
    doc.hiddenRows = new Set();
    doc.hiddenCols = new Set();
    doc.freezeRows = 0;
    doc.freezeCols = 0;

    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });

  it('1. Inserisci riga sopra sposta le celle verso il basso', async () => {
    const doc = grid['getDoc']();
    await doc.client.setCell(doc.activeSheetName, 1, 1, '10');
    await doc.client.setCell(doc.activeSheetName, 2, 1, '20');

    // Seleziona la riga 2
    doc.selection = createRangeSelection(2, 1, 2, 1);
    await grid.insertRowsAbove();
    await grid.updateComplete;

    const cell1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
    const cell2 = await doc.client.getCell(doc.activeSheetName, 2, 1);
    const cell3 = await doc.client.getCell(doc.activeSheetName, 3, 1);

    expect(cell1.raw).toBe('10');
    expect(cell2.raw).toBe(''); // Nuova riga vuota inserita
    expect(cell3.raw).toBe('20'); // La vecchia riga 2 è diventata riga 3
  });

  it('2. Undo di inserisci riga ripristina la struttura precedente', async () => {
    const doc = grid['getDoc']();
    await doc.client.setCell(doc.activeSheetName, 1, 1, '100');
    await doc.client.setCell(doc.activeSheetName, 2, 1, '200');

    doc.selection = createRangeSelection(2, 1, 2, 1);
    await grid.insertRowsAbove();
    await grid.undo();
    await grid.updateComplete;

    const cell1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
    const cell2 = await doc.client.getCell(doc.activeSheetName, 2, 1);

    expect(cell1.raw).toBe('100');
    expect(cell2.raw).toBe('200');
  });

  it('3. Gestione schede fogli: aggiungi foglio, switch foglio e isolamento dati', async () => {
    const doc = grid['getDoc']();
    await doc.client.setCell('Foglio1', 1, 1, 'Dati Foglio 1');

    await grid.handleAddSheet('Foglio2');
    await grid.updateComplete;

    expect(grid['sheetList']).toContain('Foglio2');
    expect(doc.activeSheetName).toBe('Foglio2');

    // In Foglio2 la cella A1 è vuota
    const cFoglio2 = await doc.client.getCell('Foglio2', 1, 1);
    expect(cFoglio2.raw).toBe('');

    // Scrive in Foglio2
    await doc.client.setCell('Foglio2', 1, 1, 'Dati Foglio 2');

    // Switch indietro a Foglio1
    await grid.switchSheet('Foglio1');
    await grid.updateComplete;
    expect(doc.activeSheetName).toBe('Foglio1');

    const cFoglio1 = await doc.client.getCell('Foglio1', 1, 1);
    expect(cFoglio1.raw).toBe('Dati Foglio 1');
  });

  it('4. Nascondi e mostra righe / colonne', async () => {
    grid.hideRow(3);
    grid.hideCol(2);

    const doc = grid['getDoc']();
    expect(doc.hiddenRows?.has(3)).toBe(true);
    expect(doc.hiddenCols?.has(2)).toBe(true);

    grid.unhideRows();
    grid.unhideCols();
    expect(doc.hiddenRows?.size).toBe(0);
    expect(doc.hiddenCols?.size).toBe(0);
  });

  it('5. Riempimento verso il basso con fillDown() (Ctrl+D)', async () => {
    const doc = grid['getDoc']();
    await doc.client.setCell(doc.activeSheetName, 1, 1, '10');
    await doc.client.setCell(doc.activeSheetName, 1, 2, '=A1*2');

    // Seleziona intervallo da A1 ad A4 e applica fillDown
    doc.selection = createRangeSelection(1, 1, 4, 1);
    await grid.fillDown();

    // Seleziona intervallo da B1 a B3 e applica fillDown
    doc.selection = createRangeSelection(1, 2, 3, 2);
    await grid.fillDown();
    await grid.updateComplete;

    const c1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
    const c2 = await doc.client.getCell(doc.activeSheetName, 2, 1);
    const c3 = await doc.client.getCell(doc.activeSheetName, 3, 1);
    const c4 = await doc.client.getCell(doc.activeSheetName, 4, 1);

    expect(c1.raw).toBe('10');
    expect(c2.raw).toBe('10');
    expect(c3.raw).toBe('10');
    expect(c4.raw).toBe('10');

    // Verifica traslazione formule con shiftFormula
    const b1 = await doc.client.getCell(doc.activeSheetName, 1, 2);
    const b2 = await doc.client.getCell(doc.activeSheetName, 2, 2);
    const b3 = await doc.client.getCell(doc.activeSheetName, 3, 2);

    expect(b1.raw).toBe('=A1*2');
    expect(b2.raw).toBe('=A2*2');
    expect(b3.raw).toBe('=A3*2');
  });

  it('6. Pennello formato: copia lo stile e lo applica alla cella successiva', async () => {
    const doc = grid['getDoc']();
    doc.selection = createCellSelection(1, 1);
    grid.applyFormat({ bold: true, color: '#dc2626' });

    // Attiva pennello formato su A1
    grid.toggleFormatPainter();
    expect(grid['isFormatPainterActive']).toBe(true);

    // Clic su B2
    const fakeEvent = new MouseEvent('mousedown');
    grid['handleCellMouseDown'](2, 2, fakeEvent);
    await grid.updateComplete;

    expect(grid['isFormatPainterActive']).toBe(false);
    const styleB2 = doc.styles.registry.getStyle(doc.styles.cellStyles.get('2,2') || 0);
    expect(styleB2.bold).toBe(true);
    expect(styleB2.color).toBe('#dc2626');
  });
});
