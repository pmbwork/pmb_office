import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createRangeSelection } from '../../src/sheet/index';
import { nuovoIndice, nuovoIntervallo, type OperazioneStruttura } from '../../src/sheet/sposta-struttura';
import { chiaveCommento } from '../../src/sheet/commenti';

const op = (tipo: OperazioneStruttura['tipo'], indice: number, conta = 1): OperazioneStruttura => ({ tipo, indice, conta });

describe('T469: la regola per spostare indici e intervalli', () => {
  it('inserire sposta ciò che sta dall\'indice in poi', () => {
    expect([1, 2, 3, 10].map((i) => nuovoIndice(i, op('insert_rows', 3, 2)))).toEqual([1, 2, 5, 12]);
  });
  it('eliminare sposta indietro, toglie ciò che era eliminato', () => {
    expect([1, 2, 3, 4, 5, 6].map((i) => nuovoIndice(i, op('delete_cols', 3, 2)))).toEqual([1, 2, null, null, 3, 4]);
  });
  it('gli intervalli si spostano, si allargano se l\'inserimento cade dentro, si restringono o spariscono', () => {
    expect(nuovoIntervallo(5, 8, op('insert_rows', 2))).toEqual([6, 9]);
    expect(nuovoIntervallo(5, 8, op('insert_rows', 6))).toEqual([5, 9]);
    expect(nuovoIntervallo(5, 8, op('insert_rows', 9))).toEqual([5, 8]);
    expect(nuovoIntervallo(5, 8, op('delete_rows', 1, 2))).toEqual([3, 6]);
    expect(nuovoIntervallo(5, 8, op('delete_rows', 6, 2))).toEqual([5, 6]);
    expect(nuovoIntervallo(5, 8, op('delete_rows', 4, 6))).toBeNull();
    expect(nuovoIntervallo(5, 8, op('delete_rows', 7, 5))).toEqual([5, 6]);
  });
});

describe('T469: inserire ed eliminare righe e colonne sposta anche i dati accessori', () => {
  let grid: FreeSheetGrid;
  let n = 0;

  beforeEach(async () => {
    const tabId = `test-T469-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  const doc = () => grid['getDoc']();

  /** un foglio con un dato accessorio per ogni genere, tutti sulla riga 4 e sulla colonna D */
  async function preparaRiga4() {
    const d = doc();
    const f = d.activeSheetName;
    await d.client.setCell(f, 4, 1, 'x');
    d.styles.cellStyles.set('4,2', d.styles.registry.register({ bold: true }));
    d.styles.rowStyles.set(4, d.styles.registry.register({ italic: true }));
    d.rowHeights.set(4, 60);
    d.hiddenRows.add(4);
    d.merges.push({ startRow: 4, endRow: 5, startCol: 1, endCol: 2 });
    d.dataValidations.set('4:3', { type: 'list', values: ['a'] } as never);
    d.conditionalFormats.push({ id: 'r', type: 'cell-value', range: { startRow: 4, endRow: 6, startCol: 1, endCol: 1 }, operator: 'gt', value1: 1 } as never);
    d.comments.set(chiaveCommento(f, 4, 1), { testo: 'nota', data: '2026-01-01' } as never);
    d.comments.set(chiaveCommento('Altro', 4, 1), { testo: 'altro foglio', data: '2026-01-01' } as never);
    d.namedRanges.add({ name: 'Zona', sheetName: f, rangeString: 'A4:B6', startRow: 4, startCol: 1, endRow: 6, endCol: 2 });
    return f;
  }

  it('inserire una riga sopra la 4 sposta tutto di una riga', async () => {
    const f = await preparaRiga4();
    const d = doc();
    d.selection = createRangeSelection(4, 1, 4, 1);
    await grid.insertRowsAbove();
    expect([...d.styles.cellStyles.keys()]).toEqual(['5,2']);
    expect([...d.styles.rowStyles.keys()]).toEqual([5]);
    expect([...d.rowHeights.keys()]).toEqual([5]);
    expect([...d.hiddenRows]).toEqual([5]);
    expect(d.merges).toEqual([{ startRow: 5, endRow: 6, startCol: 1, endCol: 2 }]);
    expect([...d.dataValidations.keys()]).toEqual(['5:3']);
    expect(d.conditionalFormats[0].range).toEqual({ startRow: 5, endRow: 7, startCol: 1, endCol: 1 });
    expect(d.comments.has(chiaveCommento(f, 5, 1))).toBe(true);
    expect(d.comments.has(chiaveCommento(f, 4, 1))).toBe(false);
    expect(d.comments.has(chiaveCommento('Altro', 4, 1))).toBe(true); // un altro foglio non si tocca
    expect(d.namedRanges.get('Zona')).toMatchObject({ startRow: 5, endRow: 7, rangeString: 'A5:B7' });
    expect((await d.client.getCell(f, 5, 1)).raw).toBe('x');
  });

  it('annullare l\'inserimento rimette tutto com\'era; ripetere lo risposta', async () => {
    const f = await preparaRiga4();
    const d = doc();
    d.selection = createRangeSelection(4, 1, 4, 1);
    await grid.insertRowsAbove();
    await grid.undo();
    expect([...d.styles.cellStyles.keys()]).toEqual(['4,2']);
    expect(d.merges).toEqual([{ startRow: 4, endRow: 5, startCol: 1, endCol: 2 }]);
    expect(d.comments.has(chiaveCommento(f, 4, 1))).toBe(true);
    expect(d.namedRanges.get('Zona')).toMatchObject({ startRow: 4, rangeString: 'A4:B6' });
    await grid.redo();
    expect([...d.hiddenRows]).toEqual([5]);
    expect(d.merges[0].startRow).toBe(5);
  });

  it('eliminare la riga 4 toglie ciò che vi stava e sposta il resto; annullando torna tutto', async () => {
    const f = await preparaRiga4();
    const d = doc();
    d.selection = createRangeSelection(4, 1, 4, 1);
    await grid.deleteSelectedRows();
    expect(d.styles.cellStyles.size).toBe(0);
    expect(d.styles.rowStyles.size).toBe(0);
    expect(d.hiddenRows.size).toBe(0);
    expect(d.dataValidations.size).toBe(0);
    expect(d.merges).toEqual([{ startRow: 4, endRow: 4, startCol: 1, endCol: 2 }]); // l'unione 4-5 perde una riga: resta su una riga, ancora larga due colonne
    expect(d.conditionalFormats[0].range).toEqual({ startRow: 4, endRow: 5, startCol: 1, endCol: 1 });
    expect(d.comments.has(chiaveCommento(f, 4, 1))).toBe(false);
    expect(d.namedRanges.get('Zona')).toMatchObject({ startRow: 4, endRow: 5, rangeString: 'A4:B5' });
    await grid.undo();
    expect([...d.styles.cellStyles.keys()]).toEqual(['4,2']);
    expect([...d.hiddenRows]).toEqual([4]);
    expect(d.merges).toEqual([{ startRow: 4, endRow: 5, startCol: 1, endCol: 2 }]);
    expect(d.comments.get(chiaveCommento(f, 4, 1))).toMatchObject({ testo: 'nota' });
    expect(d.namedRanges.get('Zona')).toMatchObject({ startRow: 4, endRow: 6 });
    expect((await d.client.getCell(f, 4, 1)).raw).toBe('x');
  });

  it('le colonne: larghezze, nascoste, filtri e stili seguono l\'inserimento e l\'eliminazione', async () => {
    const d = doc();
    d.colWidths.set(3, 120);
    d.hiddenCols.add(3);
    d.styles.colStyles.set(3, d.styles.registry.register({ bold: true }));
    d.activeFilters.set(3, { col: 3, condition: { operator: 'not_empty' } } as never);
    d.selection = createRangeSelection(1, 1, 1, 2);
    await grid.insertColsLeft();
    expect([...d.colWidths.keys()]).toEqual([5]);
    expect([...d.hiddenCols]).toEqual([5]);
    expect([...d.styles.colStyles.keys()]).toEqual([5]);
    expect([...d.activeFilters.keys()]).toEqual([5]);
    expect(d.activeFilters.get(5)!.col).toBe(5);
    d.selection = createRangeSelection(1, 5, 1, 5);
    await grid.deleteSelectedCols();
    expect(d.colWidths.size).toBe(0);
    expect(d.hiddenCols.size).toBe(0);
    expect(d.activeFilters.size).toBe(0);
    await grid.undo();
    expect([...d.colWidths.keys()]).toEqual([5]);
    expect([...d.activeFilters.keys()]).toEqual([5]);
  });

  it('con due fogli, l\'operazione tocca solo il foglio attivo', async () => {
    const primo = doc().activeSheetName;
    const d = doc();
    d.rowHeights.set(4, 50);
    await grid.handleAddSheet('Secondo');
    d.rowHeights.set(4, 70);
    d.selection = createRangeSelection(1, 1, 1, 1);
    await grid.insertRowsAbove();
    expect([...doc().rowHeights]).toEqual([[5, 70]]);
    await grid.switchSheet(primo);
    expect([...doc().rowHeights]).toEqual([[4, 50]]);
  });
});
