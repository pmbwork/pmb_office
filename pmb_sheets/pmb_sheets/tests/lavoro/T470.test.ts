import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createRangeSelection } from '../../src/sheet/index';

describe('T470: Annulla e Ripeti coprono anche l\'aspetto del foglio e i fogli', () => {
  let grid: FreeSheetGrid;
  let n = 0;

  beforeEach(async () => {
    const tabId = `test-T470-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  const doc = () => grid['getDoc']();

  it('celle unite: unisci e separa si annullano e si ripetono', async () => {
    const d = doc();
    d.selection = createRangeSelection(2, 2, 3, 3);
    grid.mergeSelection('all');
    expect(d.merges).toHaveLength(1);
    await grid.undo();
    expect(doc().merges).toHaveLength(0);
    await grid.redo();
    expect(doc().merges).toHaveLength(1);
    doc().selection = createRangeSelection(2, 2, 3, 3);
    grid.unmergeSelection();
    expect(doc().merges).toHaveLength(0);
    await grid.undo();
    expect(doc().merges).toHaveLength(1);
  });

  it('righe e colonne nascoste: nascondi e mostra tutto si annullano', async () => {
    grid.hideRow(3);
    grid.hideCol(2);
    expect([...doc().hiddenRows]).toEqual([3]);
    grid.unhideRows();
    expect(doc().hiddenRows.size).toBe(0);
    await grid.undo(); // annulla "mostra tutte le righe"
    expect([...doc().hiddenRows]).toEqual([3]);
    await grid.undo(); // annulla "nascondi colonna"
    expect(doc().hiddenCols.size).toBe(0);
    await grid.undo(); // annulla "nascondi riga"
    expect(doc().hiddenRows.size).toBe(0);
    await grid.redo();
    expect([...doc().hiddenRows]).toEqual([3]);
  });

  it('blocco di righe e colonne', async () => {
    grid.setFreezePanes(2, 1);
    expect([doc().freezeRows, doc().freezeCols]).toEqual([2, 1]);
    await grid.undo();
    expect([doc().freezeRows, doc().freezeCols]).toEqual([0, 0]);
    await grid.redo();
    expect([doc().freezeRows, doc().freezeCols]).toEqual([2, 1]);
  });

  it('un intervento che non cambia niente non lascia passi da annullare', async () => {
    const prima = doc().history.getUndoCount();
    grid.unhideRows();
    grid.unmergeSelection();
    expect(doc().history.getUndoCount()).toBe(prima);
  });

  it('convalida su un intervallo: un solo passo per tutte le celle', async () => {
    const prima = doc().history.getUndoCount();
    grid.applicaConvalida({ startRow: 1, endRow: 3, startCol: 1, endCol: 2 }, { type: 'list', values: ['a', 'b'] });
    expect(doc().dataValidations.size).toBe(6);
    expect(doc().history.getUndoCount()).toBe(prima + 1);
    await grid.undo();
    expect(doc().dataValidations.size).toBe(0);
    await grid.redo();
    expect(doc().dataValidations.size).toBe(6);
  });

  it('formattazione condizionale', async () => {
    grid.addConditionalFormatRule({ id: 'r1', type: 'cell-value', range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 }, operator: 'gt', value1: 3 });
    expect(doc().conditionalFormats).toHaveLength(1);
    await grid.undo();
    expect(doc().conditionalFormats).toHaveLength(0);
    await grid.redo();
    expect(doc().conditionalFormats).toHaveLength(1);
  });

  it('intervalli denominati: aggiungi ed elimina si annullano e le formule tornano a funzionare', async () => {
    const d = doc();
    const f = d.activeSheetName;
    await d.client.setCell(f, 1, 1, '5');
    await d.client.setCell(f, 2, 1, '7');
    await grid.addNamedRange({ name: 'Dati', sheetName: f, rangeString: 'A1:A2', startRow: 1, startCol: 1, endRow: 2, endCol: 1 });
    await d.client.setCell(f, 4, 1, '=SUM(Dati)');
    expect((await d.client.getCell(f, 4, 1)).value).toMatchObject({ kind: 'number', value: 12 });
    await grid.removeNamedRange('Dati');
    expect((await d.client.getCell(f, 4, 1)).value.kind).toBe('error');
    await grid.undo();
    expect(doc().namedRanges.has('Dati')).toBe(true);
    expect((await d.client.getCell(f, 4, 1)).value).toMatchObject({ kind: 'number', value: 12 });
  });

  it('filtri: attivare e togliere si annullano', async () => {
    const d = doc();
    d.selection = createRangeSelection(1, 1, 5, 2);
    grid.toggleFilter();
    const attivo = doc().isFilterActive;
    await grid.undo();
    expect(doc().isFilterActive).toBe(!attivo);
    await grid.redo();
    expect(doc().isFilterActive).toBe(attivo);
  });

  it('aggiungere un foglio si annulla (il foglio sparisce) e si ripete', async () => {
    const primo = doc().activeSheetName;
    await grid.handleAddSheet('Secondo');
    expect(await doc().client.listSheets()).toEqual([primo, 'Secondo']);
    await grid.undo();
    expect(await doc().client.listSheets()).toEqual([primo]);
    expect(doc().activeSheetName).toBe(primo);
    await grid.redo();
    expect(await doc().client.listSheets()).toEqual([primo, 'Secondo']);
    expect(doc().activeSheetName).toBe('Secondo');
  });

  it('rinominare un foglio si annulla, e il suo aspetto lo segue', async () => {
    const primo = doc().activeSheetName;
    doc().colWidths.set(2, 111);
    await grid.renameCurrentSheet('Conti');
    expect(doc().activeSheetName).toBe('Conti');
    await grid.undo();
    expect(doc().activeSheetName).toBe(primo);
    expect(await doc().client.listSheets()).toEqual([primo]);
    expect(doc().colWidths.get(2)).toBe(111);
    await grid.redo();
    expect(doc().activeSheetName).toBe('Conti');
  });

  it('eliminare un foglio con dati si annulla: tornano le celle, l\'aspetto e i commenti', async () => {
    const primo = doc().activeSheetName;
    await grid.handleAddSheet('Dati');
    const d = doc();
    await d.client.setCell('Dati', 1, 1, 'importante');
    d.colWidths.set(3, 77);
    d.merges.push({ startRow: 2, endRow: 2, startCol: 1, endCol: 2 });
    d.comments.set('1:1!Dati', { testo: 'nota', data: '2026-01-01' } as never);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await grid.deleteCurrentSheet();
    expect(await doc().client.listSheets()).toEqual([primo]);
    expect(doc().comments.has('1:1!Dati')).toBe(false);
    await grid.undo();
    expect(await doc().client.listSheets()).toEqual([primo, 'Dati']);
    expect(doc().activeSheetName).toBe('Dati');
    expect((await doc().client.getCell('Dati', 1, 1)).raw).toBe('importante');
    expect(doc().colWidths.get(3)).toBe(77);
    expect(doc().merges).toEqual([{ startRow: 2, endRow: 2, startCol: 1, endCol: 2 }]);
    expect(doc().comments.get('1:1!Dati')).toMatchObject({ testo: 'nota' });
    await grid.redo();
    expect(await doc().client.listSheets()).toEqual([primo]);
  });

  it('duplicare un foglio si annulla', async () => {
    const primo = doc().activeSheetName;
    await doc().client.setCell(primo, 1, 1, 'x');
    await grid.duplicateCurrentSheet();
    expect(await doc().client.listSheets()).toHaveLength(2);
    await grid.undo();
    expect(await doc().client.listSheets()).toEqual([primo]);
    expect(doc().activeSheetName).toBe(primo);
  });
});
