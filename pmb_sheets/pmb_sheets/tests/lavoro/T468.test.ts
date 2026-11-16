import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/index';
import { applicaDati, estraiDati } from '../../src/formati/documento';
import { deserializeSheetDocumentData, serializeSheetDocumentData } from '../../src/sheet/document-data';
import { scambioDaDocumento } from '../../src/formati/scambio';

describe('T468: ogni foglio ha il suo aspetto', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  let tabId = '';

  beforeEach(async () => {
    tabId = `test-T468-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });

  const doc = () => grid['getDoc']();

  /** dà al foglio attivo un aspetto riconoscibile: stile, larghezza, riga nascosta, unione, blocco, convalida */
  function decora(): void {
    const d = doc();
    const id = d.styles.registry.register({ bold: true });
    d.styles.cellStyles.set('1,1', id);
    d.colWidths.set(2, 150);
    d.hiddenRows.add(3);
    d.merges.push({ startRow: 5, endRow: 5, startCol: 1, endCol: 2 });
    d.freezeRows = 1;
    d.dataValidations.set('A1', { type: 'list', values: ['a', 'b'] } as never);
  }
  const vuoto = () => {
    const d = doc();
    return [d.styles.cellStyles.size, d.colWidths.size, d.hiddenRows.size, d.merges.length, d.freezeRows, d.dataValidations.size];
  };

  it('un foglio nuovo parte senza stili, misure, unioni, blocchi e convalide di quello da cui si viene', async () => {
    decora();
    await grid.handleAddSheet('Secondo');
    expect(vuoto()).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('tornando al primo foglio ritrova il suo aspetto, senza averlo mescolato con l\'altro', async () => {
    const primo = doc().activeSheetName;
    decora();
    await grid.handleAddSheet('Secondo');
    doc().colWidths.set(7, 200);
    doc().merges.push({ startRow: 9, endRow: 9, startCol: 3, endCol: 4 });
    await grid.switchSheet(primo);
    expect(vuoto()).toEqual([1, 1, 1, 1, 1, 1]);
    expect([...doc().colWidths.keys()]).toEqual([2]);
    expect(doc().merges).toEqual([{ startRow: 5, endRow: 5, startCol: 1, endCol: 2 }]);
    await grid.switchSheet('Secondo');
    expect([...doc().colWidths.keys()]).toEqual([7]);
    expect(doc().merges).toEqual([{ startRow: 9, endRow: 9, startCol: 3, endCol: 4 }]);
    expect(doc().hiddenRows.size).toBe(0);
  });

  it('rinominare un foglio non gli fa perdere l\'aspetto', async () => {
    const primo = doc().activeSheetName;
    await grid.handleAddSheet('Secondo');
    doc().colWidths.set(4, 90);
    await grid.switchSheet(primo);
    await grid.switchSheet('Secondo');
    await grid.renameCurrentSheet('Vendite');
    await grid.switchSheet(primo);
    await grid.switchSheet('Vendite');
    expect([...doc().colWidths]).toEqual([[4, 90]]);
  });

  it('eliminare un foglio toglie anche il suo aspetto e non sporca quello che resta', async () => {
    const primo = doc().activeSheetName;
    decora();
    await grid.handleAddSheet('Secondo');
    doc().colWidths.set(9, 70);
    // eliminazione senza domande: il foglio è vuoto di dati
    await grid.deleteCurrentSheet();
    expect(doc().activeSheetName).toBe(primo);
    expect(vuoto()).toEqual([1, 1, 1, 1, 1, 1]);
    expect([...doc().colWidths.keys()]).toEqual([2]);
    expect(doc().sheetStates.size).toBe(0);
  });

  it('duplicare un foglio copia anche il suo aspetto, in modo indipendente', async () => {
    const primo = doc().activeSheetName;
    decora();
    await doc().client.setCell(primo, 1, 1, 'x');
    await grid.duplicateCurrentSheet();
    expect(doc().activeSheetName).toBe(`Copia di ${primo}`);
    expect(vuoto()).toEqual([1, 1, 1, 1, 1, 1]);
    doc().colWidths.set(2, 999);
    await grid.switchSheet(primo);
    expect(doc().colWidths.get(2)).toBe(150);
  });

  it('il file nativo conserva l\'aspetto di ogni foglio, e un file senza questo campo si apre come prima', async () => {
    const primo = doc().activeSheetName;
    decora();
    await grid.handleAddSheet('Secondo');
    doc().colWidths.set(6, 33);
    doc().hiddenCols.add(4);
    const dati = await estraiDati(doc());
    expect(Object.keys(dati.fogliStato ?? {})).toEqual([primo]);
    expect(dati.colWidths).toEqual({ 6: 33 });

    const testo = serializeSheetDocumentData(dati);
    const altro = defaultDocumentStore.getOrCreateDocument(`${tabId}-copia`);
    await applicaDati(altro, deserializeSheetDocumentData(testo));
    expect(altro.activeSheetName).toBe('Secondo');
    expect([...altro.colWidths]).toEqual([[6, 33]]);
    expect([...altro.hiddenCols]).toEqual([4]);
    expect(altro.sheetStates.get(primo)?.merges).toEqual([{ startRow: 5, endRow: 5, startCol: 1, endCol: 2 }]);
    expect([...(altro.sheetStates.get(primo)?.hiddenRows ?? [])]).toEqual([3]);

    const vecchio = JSON.parse(testo) as Record<string, unknown>;
    delete vecchio.fogliStato;
    const compat = defaultDocumentStore.getOrCreateDocument(`${tabId}-vecchio`);
    await applicaDati(compat, deserializeSheetDocumentData(JSON.stringify(vecchio)));
    expect(compat.sheetStates.size).toBe(0);
    expect([...compat.colWidths]).toEqual([[6, 33]]);
  });

  it('lo scambio con Excel e OpenDocument porta lo stile di ogni foglio', async () => {
    const primo = doc().activeSheetName;
    decora();
    await grid.handleAddSheet('Secondo');
    doc().colWidths.set(3, 60);
    const s = scambioDaDocumento(await estraiDati(doc()));
    expect(s.fogli.find((f) => f.nome === primo)!.stili.A1).toMatchObject({ bold: true });
    expect(s.fogli.find((f) => f.nome === primo)!.larghezze).toEqual({ 2: 150 });
    expect(s.fogli.find((f) => f.nome === 'Secondo')!.larghezze).toEqual({ 3: 60 });
    expect(s.fogli.find((f) => f.nome === 'Secondo')!.stili).toEqual({});
  });

  it('annullare un intervento fatto su un altro foglio riporta prima su quel foglio', async () => {
    const primo = doc().activeSheetName;
    await grid.handleAddSheet('Secondo');
    await grid.switchSheet(primo);
    const d = doc();
    d.history.pushStep({ description: 'prova', undoAction: async () => { d.colWidths.set(1, 10); } });
    await grid.switchSheet('Secondo');
    expect(doc().activeSheetName).toBe('Secondo');
    await grid.undo();
    expect(doc().activeSheetName).toBe(primo);
    expect(doc().colWidths.get(1)).toBe(10);
  });
});
