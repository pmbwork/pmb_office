import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/index';
import { fotografaSopraLeCelle, incollaSopraLeCelle } from '../../src/sheet/sposta-con-celle';
import { Workbook } from '../../src/engine/workbook';
import type { ConditionalFormatRule } from '../../src/sheet/conditional-format';

const regolaF = (id: string, f: string, r1: number, r2: number, c1: number, c2: number): ConditionalFormatRule => ({
  id, type: 'formula', value1: f, style: { backgroundColor: '#ff0000' }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 },
});

describe('T517: valutaCondizione (formula di una regola)', () => {
  const libro = () => new Workbook();
  it('i riferimenti relativi seguono la cella, quelli assoluti no', () => {
    const w = libro();
    w.setCell('Foglio1', 'A1', '5'); w.setCell('Foglio1', 'A2', '50'); w.setCell('Foglio1', 'B1', '10');
    const angolo = { riga: 1, colonna: 1 };
    expect(w.valutaCondizione('Foglio1', '=A1>10', 1, 1, angolo)).toBe(false);
    expect(w.valutaCondizione('Foglio1', '=A1>10', 2, 1, angolo)).toBe(true);
    expect(w.valutaCondizione('Foglio1', '=A1>$B$1', 2, 1, angolo)).toBe(true);
    expect(w.valutaCondizione('Foglio1', '=A1>$B$1', 1, 1, angolo)).toBe(false);
  });
  it('numero diverso da zero è vero, zero testo ed errore sono falso', () => {
    const w = libro();
    const a = { riga: 1, colonna: 1 };
    expect(w.valutaCondizione('Foglio1', '=1', 1, 1, a)).toBe(true);
    expect(w.valutaCondizione('Foglio1', '=0', 1, 1, a)).toBe(false);
    expect(w.valutaCondizione('Foglio1', '="x"', 1, 1, a)).toBe(false);
    expect(w.valutaCondizione('Foglio1', '=1/0', 1, 1, a)).toBe(false);
    expect(w.valutaCondizione('Foglio1', '=(((', 1, 1, a)).toBe(false);
  });
});

describe('T517: la copia sposta i riferimenti delle regole con formula', () => {
  it('la regola copiata più sotto e a destra cita le celle giuste', () => {
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [regolaF('a', '=B1>5', 1, 2, 1, 1)] };
    const area = { startRow: 1, endRow: 2, startCol: 1, endCol: 1 };
    const f = fotografaSopraLeCelle(area, 'Foglio1', new Map(), dati);
    incollaSopraLeCelle(f, area, [{ riga: 4, colonna: 3 }], 'Foglio1', new Map(), dati);
    expect(dati.conditionalFormats.find((r) => r.range.startRow === 4)!.value1).toBe('=D4>5');
  });
  it('un riferimento assoluto resta', () => {
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [regolaF('a', '=A1>$F$1', 1, 2, 1, 1)] };
    const area = { startRow: 1, endRow: 2, startCol: 1, endCol: 1 };
    const f = fotografaSopraLeCelle(area, 'Foglio1', new Map(), dati);
    incollaSopraLeCelle(f, area, [{ riga: 5, colonna: 1 }], 'Foglio1', new Map(), dati);
    expect(dati.conditionalFormats.find((r) => r.range.startRow === 5)!.value1).toBe('=A5>$F$1');
  });
  it('copiando solo la parte bassa di una regola, la formula segue il nuovo angolo', () => {
    const dati = { merges: [], dataValidations: new Map(), conditionalFormats: [regolaF('a', '=A1>5', 1, 10, 1, 1)] };
    const area = { startRow: 4, endRow: 6, startCol: 1, endCol: 1 };
    const f = fotografaSopraLeCelle(area, 'Foglio1', new Map(), dati);
    expect(f.regole[0].value1).toBe('=A4>5');
    incollaSopraLeCelle(f, area, [{ riga: 4, colonna: 3 }], 'Foglio1', new Map(), dati);
    expect(dati.conditionalFormats.find((r) => r.range.startCol === 3)!.value1).toBe('=C4>5');
  });
});

describe('T517: la griglia colora con la regola a formula', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  beforeEach(async () => {
    const tabId = `test-T517-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  it('la riga con B maggiore di 10 prende il colore', async () => {
    const doc = grid['getDoc']();
    await doc.client.applyBatch([
      { type: 'set', sheet: doc.activeSheetName, row: 1, col: 2, raw: '5' },
      { type: 'set', sheet: doc.activeSheetName, row: 2, col: 2, raw: '50' },
    ]);
    doc.conditionalFormats.push(regolaF('a', '=$B1>10', 1, 3, 1, 2));
    grid.requestUpdate();
    await grid.updateComplete;
    const bg = (r: number, c: number) => (grid.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement | null)?.style.backgroundColor;
    expect(bg(2, 1)).toBeTruthy();
    expect(bg(1, 1)).toBeFalsy();
  });
});
