import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createRangeSelection } from '../../src/sheet/index';
import { fotografaSopraLeCelle, incollaSopraLeCelle, sopraVuoto } from '../../src/sheet/sposta-con-celle';
import type { ConditionalFormatRule } from '../../src/sheet/conditional-format';

const regola = (id: string, r1: number, r2: number, c1: number, c2: number, valore = 10): ConditionalFormatRule => ({
  id, type: 'cell_value', operator: 'greater_than', value1: valore, style: { backgroundColor: '#ff0000' },
  range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 },
});

describe('T514: la regola pura (fotografia e incolla delle formattazioni condizionali)', () => {
  it('la fotografia porta le regole che toccano l\'area, ritagliate all\'area', () => {
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [regola('a', 1, 10, 1, 1), regola('b', 20, 30, 5, 5)] };
    const f = fotografaSopraLeCelle({ startRow: 3, endRow: 6, startCol: 1, endCol: 2 }, 'Foglio1', new Map(), dati);
    expect(f.regole).toHaveLength(1);
    expect(f.regole[0].range).toEqual({ startRow: 3, endRow: 6, startCol: 1, endCol: 1 });
    expect(f.regole[0].value1).toBe(10);
  });

  it('senza regole la fotografia è vuota', () => {
    const f = fotografaSopraLeCelle({ startRow: 1, endRow: 2, startCol: 1, endCol: 1 }, 'Foglio1', new Map(), { merges: [], dataValidations: new Map(), conditionalFormats: [] });
    expect(sopraVuoto(f)).toBe(true);
  });

  it('una copia è staccata dalla sorgente: cambiare la regola dopo non cambia ciò che si incolla', () => {
    const r = regola('a', 1, 5, 1, 1);
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [r] };
    const f = fotografaSopraLeCelle({ startRow: 1, endRow: 5, startCol: 1, endCol: 1 }, 'Foglio1', new Map(), dati);
    r.value1 = 999;
    expect(f.regole[0].value1).toBe(10);
  });

  it('incollare mette la regola sulla zona di destinazione, con un id nuovo, e lascia quella di partenza', () => {
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [regola('a', 1, 5, 1, 1)] };
    const area = { startRow: 1, endRow: 5, startCol: 1, endCol: 1 };
    const f = fotografaSopraLeCelle(area, 'Foglio1', new Map(), dati);
    incollaSopraLeCelle(f, area, [{ riga: 1, colonna: 4 }], 'Foglio1', new Map(), dati);
    expect(dati.conditionalFormats).toHaveLength(2);
    expect(dati.conditionalFormats[1].range).toEqual({ startRow: 1, endRow: 5, startCol: 4, endCol: 4 });
    expect(dati.conditionalFormats[1].id).not.toBe('a');
    expect(dati.conditionalFormats[0].range.startCol).toBe(1);
  });

  it('incollare due volte sulla stessa zona non accumula regole identiche', () => {
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [regola('a', 1, 5, 1, 1)] };
    const area = { startRow: 1, endRow: 5, startCol: 1, endCol: 1 };
    const f = fotografaSopraLeCelle(area, 'Foglio1', new Map(), dati);
    incollaSopraLeCelle(f, area, [{ riga: 1, colonna: 4 }], 'Foglio1', new Map(), dati);
    incollaSopraLeCelle(f, area, [{ riga: 1, colonna: 4 }], 'Foglio1', new Map(), dati);
    incollaSopraLeCelle(f, area, [{ riga: 1, colonna: 1 }], 'Foglio1', new Map(), dati);   // su se stessi
    expect(dati.conditionalFormats).toHaveLength(2);
  });

  it('un incolla che ripete il blocco mette una regola per ogni piastrella', () => {
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [regola('a', 1, 2, 1, 1)] };
    const area = { startRow: 1, endRow: 2, startCol: 1, endCol: 1 };
    const f = fotografaSopraLeCelle(area, 'Foglio1', new Map(), dati);
    incollaSopraLeCelle(f, area, [{ riga: 5, colonna: 3 }, { riga: 7, colonna: 3 }], 'Foglio1', new Map(), dati);
    expect(dati.conditionalFormats.map((r) => r.range.startRow)).toEqual([1, 5, 7]);
  });

  it('una regola diversa sulla stessa zona viene sostituita da quella copiata (Fase 38)', () => {
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [regola('a', 1, 5, 1, 1, 10), regola('x', 1, 5, 4, 4, 77)] };
    const area = { startRow: 1, endRow: 5, startCol: 1, endCol: 1 };
    const f = fotografaSopraLeCelle(area, 'Foglio1', new Map(), dati);
    incollaSopraLeCelle(f, area, [{ riga: 1, colonna: 4 }], 'Foglio1', new Map(), dati);
    expect(dati.conditionalFormats).toHaveLength(2);
    expect(dati.conditionalFormats.some((r) => r.id === 'x')).toBe(false);
  });
});

describe('T514: la copia porta le formattazioni condizionali (griglia vera)', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  beforeEach(async () => {
    const tabId = `test-T514-${++n}`;
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

  it('copiare e incollare porta la regola, annulla la toglie, ripeti la rimette', async () => {
    doc().conditionalFormats.push(regola('a', 1, 4, 1, 1));
    seleziona(1, 1, 4, 1);
    await grid.copy();
    seleziona(1, 3);
    await grid.paste();
    expect(zone()).toEqual([[1, 4, 1, 1], [1, 4, 3, 3]]);
    await grid.undo();
    expect(zone()).toEqual([[1, 4, 1, 1]]);
    await grid.redo();
    expect(zone()).toEqual([[1, 4, 1, 1], [1, 4, 3, 3]]);
  });

  it('copiando solo una parte dell\'intervallo, la regola nuova copre solo quella parte', async () => {
    doc().conditionalFormats.push(regola('a', 1, 10, 1, 1));
    seleziona(2, 1, 3, 1);
    await grid.copy();
    seleziona(6, 4);
    await grid.paste();
    expect(zone()).toEqual([[1, 10, 1, 1], [6, 7, 4, 4]]);
  });

  it('copiando celle senza regole non si aggiunge niente; la regola sotto l\'area incollata si toglie (Fase 38), quella fuori resta', async () => {
    doc().conditionalFormats.push(regola('a', 1, 4, 1, 1), regola('b', 8, 9, 1, 1));
    seleziona(1, 5, 4, 5);
    await grid.copy();
    seleziona(1, 1);
    await grid.paste();
    expect(zone()).toEqual([[8, 9, 1, 1]]);
  });

  it('il taglio continua a spostare la regola, senza lasciarne una copia', async () => {
    doc().conditionalFormats.push(regola('a', 1, 4, 1, 1));
    seleziona(1, 1, 4, 1);
    await grid.cut();
    seleziona(1, 3);
    await grid.paste();
    expect(zone()).toEqual([[1, 4, 3, 3]]);
  });
});
