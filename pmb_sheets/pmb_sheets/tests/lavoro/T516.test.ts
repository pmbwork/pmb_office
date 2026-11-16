import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createRangeSelection } from '../../src/sheet/index';
import { liberaZonaDalleRegole } from '../../src/sheet/sposta-con-celle';
import type { ConditionalFormatRule } from '../../src/sheet/conditional-format';

const regola = (id: string, r1: number, r2: number, c1: number, c2: number): ConditionalFormatRule => ({
  id, type: 'cell_value', operator: 'greater_than', value1: 10, style: { backgroundColor: '#ff0000' },
  range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 },
});
const zone = (rs: ConditionalFormatRule[]) => rs.map((r) => [r.range.startRow, r.range.endRow, r.range.startCol, r.range.endCol]);

describe('T516: liberaZonaDalleRegole', () => {
  it('una regola fuori dalla zona resta com\'è', () => {
    const rs = [regola('a', 1, 3, 1, 1)];
    liberaZonaDalleRegole(rs, { startRow: 5, endRow: 6, startCol: 1, endCol: 1 });
    expect(zone(rs)).toEqual([[1, 3, 1, 1]]);
  });
  it('una regola coperta del tutto sparisce', () => {
    const rs = [regola('a', 2, 3, 2, 2)];
    liberaZonaDalleRegole(rs, { startRow: 1, endRow: 5, startCol: 1, endCol: 3 });
    expect(rs).toEqual([]);
  });
  it('una regola coperta in parte si restringe', () => {
    const rs = [regola('a', 1, 10, 1, 1)];
    liberaZonaDalleRegole(rs, { startRow: 6, endRow: 20, startCol: 1, endCol: 1 });
    expect(zone(rs)).toEqual([[1, 5, 1, 1]]);
    expect(rs[0].id).toBe('a');
  });
  it('una regola attraversata si divide in pezzi con id diversi', () => {
    const rs = [regola('a', 1, 10, 1, 5)];
    liberaZonaDalleRegole(rs, { startRow: 4, endRow: 6, startCol: 2, endCol: 3 });
    expect(zone(rs)).toEqual([[1, 3, 1, 5], [7, 10, 1, 5], [4, 6, 1, 1], [4, 6, 4, 5]]);
    expect(new Set(rs.map((r) => r.id)).size).toBe(4);
    expect(rs[0].id).toBe('a');
  });
});

describe('T516: incollare sostituisce le regole sotto l\'area incollata', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  beforeEach(async () => {
    const tabId = `test-T516-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  const doc = () => grid['getDoc']();
  const seleziona = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc().selection.range = createRangeSelection(r1, c1, r2, c2).range; };
  const zoneDoc = () => zone(doc().conditionalFormats);

  it('incollando celle senza regole su celle con regole, la regola sotto sparisce; annulla la rimette', async () => {
    doc().conditionalFormats.push(regola('d', 1, 5, 4, 4));
    seleziona(1, 1, 3, 1); // sorgente senza regole
    await grid.copy();
    seleziona(1, 4);
    await grid.paste();
    expect(zoneDoc()).toEqual([[4, 5, 4, 4]]);
    await grid.undo();
    expect(zoneDoc()).toEqual([[1, 5, 4, 4]]);
    await grid.redo();
    expect(zoneDoc()).toEqual([[4, 5, 4, 4]]);
  });

  it('la regola copiata prende il posto di quella della destinazione', async () => {
    doc().conditionalFormats.push(regola('s', 1, 3, 1, 1), { ...regola('d', 1, 5, 4, 4), value1: 99 });
    seleziona(1, 1, 3, 1);
    await grid.copy();
    seleziona(1, 4);
    await grid.paste();
    const sullaDest = doc().conditionalFormats.filter((r) => r.range.startCol === 4);
    expect(zone(sullaDest)).toEqual([[4, 5, 4, 4], [1, 3, 4, 4]]);
    expect(sullaDest.find((r) => r.range.startRow === 1)!.value1).toBe(10);
    expect(sullaDest.find((r) => r.range.startRow === 4)!.value1).toBe(99);
  });

  it('Solo valori non tocca le regole della destinazione', async () => {
    doc().conditionalFormats.push(regola('d', 1, 5, 4, 4));
    seleziona(1, 1, 3, 1);
    await grid.copy();
    seleziona(1, 4);
    await grid.pasteSpecial('values_only');
    expect(zoneDoc()).toEqual([[1, 5, 4, 4]]);
  });

  it('Solo formato toglie le regole sotto l\'area anche se la sorgente non ne ha', async () => {
    doc().conditionalFormats.push(regola('d', 1, 5, 4, 4));
    seleziona(1, 1, 3, 1);
    await grid.copy();
    seleziona(1, 4);
    await grid.pasteSpecial('format_only');
    expect(zoneDoc()).toEqual([[4, 5, 4, 4]]);
    await grid.undo();
    expect(zoneDoc()).toEqual([[1, 5, 4, 4]]);
  });

  it('regole fuori dall\'area incollata restano', async () => {
    doc().conditionalFormats.push(regola('d', 10, 12, 4, 4));
    seleziona(1, 1, 3, 1);
    await grid.copy();
    seleziona(1, 4);
    await grid.paste();
    expect(zoneDoc()).toEqual([[10, 12, 4, 4]]);
  });
});
