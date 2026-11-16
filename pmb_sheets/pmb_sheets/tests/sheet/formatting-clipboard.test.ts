import { describe, it, expect } from 'vitest';
import {
  setInternalClipboard,
  getInternalClipboard,
  computePasteOperations,
} from '../../src/sheet/clipboard';
import { createCellSelection } from '../../src/sheet/selection';

describe('Formatting Clipboard (Copia / Taglia / Incolla con stili)', () => {
  it('appunti interni memorizzano stile e matrice stili', () => {
    setInternalClipboard({
      rawGrid: [['123', '456']],
      displayGrid: [['123', '456']],
      styleGrid: [[1, 2]],
      styleSnapshot: [{}, { bold: true }, { italic: true }],
      sourceRange: { startRow: 1, endRow: 1, startCol: 1, endCol: 2 },
      isCut: false,
    });

    const clip = getInternalClipboard();
    expect(clip).not.toBeNull();
    expect(clip?.styleGrid).toEqual([[1, 2]]);
    expect(clip?.styleSnapshot?.[1].bold).toBe(true);
    expect(clip?.styleSnapshot?.[2].italic).toBe(true);
  });

  it('computePasteOperations propaga gli stili sorgente se forniti', () => {
    const rawGrid = [['Testo']];
    const styleGrid = [[5]];
    const target = createCellSelection(10, 10);

    const ops = computePasteOperations(rawGrid, target.range, 1, 1, styleGrid);
    expect(ops.length).toBe(1);
    expect(ops[0].row).toBe(10);
    expect(ops[0].col).toBe(10);
    expect(ops[0].raw).toBe('Testo');
    expect(ops[0].styleId).toBe(5);
  });

  it('incolla esterno (senza sourceStyles) non impone styleId (lascia undefined)', () => {
    const rawGrid = [['Esterno 1', 'Esterno 2']];
    const target = createCellSelection(5, 5);

    const ops = computePasteOperations(rawGrid, target.range);
    expect(ops.length).toBe(2);
    expect(ops[0].styleId).toBeUndefined();
    expect(ops[1].styleId).toBeUndefined();
  });
});
