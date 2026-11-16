import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createRangeSelection } from '../../src/sheet/index';
import { bloccatiDopoStruttura, type OperazioneStruttura } from '../../src/sheet/sposta-struttura';

const op = (tipo: OperazioneStruttura['tipo'], indice: number, conta = 1): OperazioneStruttura => ({ tipo, indice, conta });

describe('T513: la regola del blocco dei riquadri', () => {
  it('inserire dentro la zona bloccata la allarga', () => {
    expect(bloccatiDopoStruttura(3, op('insert_rows', 1))).toBe(4);
    expect(bloccatiDopoStruttura(3, op('insert_rows', 3, 2))).toBe(5);
  });
  it('inserire subito sotto la zona bloccata, o più giù, non la tocca', () => {
    expect(bloccatiDopoStruttura(3, op('insert_rows', 4))).toBe(3);
    expect(bloccatiDopoStruttura(3, op('insert_rows', 50, 5))).toBe(3);
  });
  it('eliminare dentro la zona la restringe delle sole righe bloccate tolte', () => {
    expect(bloccatiDopoStruttura(3, op('delete_rows', 2))).toBe(2);
    expect(bloccatiDopoStruttura(3, op('delete_rows', 1, 3))).toBe(0);
    expect(bloccatiDopoStruttura(3, op('delete_rows', 2, 10))).toBe(1);   // elimina righe 2..11: della zona ne toglie 2
    expect(bloccatiDopoStruttura(3, op('delete_rows', 5, 4))).toBe(3);    // tutto sotto: non cambia
  });
  it('senza blocco resta senza blocco', () => {
    expect(bloccatiDopoStruttura(0, op('insert_rows', 1, 4))).toBe(0);
    expect(bloccatiDopoStruttura(0, op('delete_cols', 1, 4))).toBe(0);
  });
});

describe('T513: il blocco segue le righe e le colonne inserite o eliminate', () => {
  let grid: FreeSheetGrid;
  let n = 0;

  beforeEach(async () => {
    const tabId = `test-T513-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  const doc = () => grid['getDoc']();
  const seleziona = (riga: number, col: number, rigaFine = riga, colFine = col) => { doc().selection.range = createRangeSelection(riga, col, rigaFine, colFine).range; };
  const blocco = () => [doc().freezeRows, doc().freezeCols];

  it('inserire una riga sopra la zona bloccata la allarga, e annullare la rimette com\'era', async () => {
    grid.setFreezePanes(2, 1);
    seleziona(2, 1);
    await grid.insertRowsAbove();
    expect(blocco()).toEqual([3, 1]);
    await grid.undo();
    expect(blocco()).toEqual([2, 1]);
    await grid.redo();
    expect(blocco()).toEqual([3, 1]);
  });

  it('inserire sotto la zona bloccata non la cambia', async () => {
    grid.setFreezePanes(2, 1);
    seleziona(5, 1);
    await grid.insertRowsAbove();
    expect(blocco()).toEqual([2, 1]);
    seleziona(3, 1);
    await grid.insertRowsAbove();   // subito sotto la riga 2
    expect(blocco()).toEqual([2, 1]);
  });

  it('eliminare una riga bloccata restringe la zona; annullare la ridà', async () => {
    grid.setFreezePanes(3, 0);
    seleziona(2, 1);
    await grid.deleteSelectedRows();
    expect(blocco()).toEqual([2, 0]);
    await grid.undo();
    expect(blocco()).toEqual([3, 0]);
    await grid.redo();
    expect(blocco()).toEqual([2, 0]);
  });

  it('le colonne seguono la stessa regola', async () => {
    grid.setFreezePanes(0, 2);
    seleziona(1, 1);
    await grid.insertColsLeft();
    expect(blocco()).toEqual([0, 3]);
    seleziona(1, 1);
    await grid.deleteSelectedCols();
    expect(blocco()).toEqual([0, 2]);
    seleziona(9, 5);
    await grid.insertColsLeft();
    expect(blocco()).toEqual([0, 2]);
  });

  it('eliminare tutte le righe bloccate toglie il blocco', async () => {
    grid.setFreezePanes(2, 0);
    seleziona(1, 1, 2, 1);
    await grid.deleteSelectedRows();
    expect(blocco()).toEqual([0, 0]);
    await grid.undo();
    expect(blocco()).toEqual([2, 0]);
  });
});
