import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../../src/sheet/history';
import { createSheetStyles, applyFormatToRange, resolveCellStyle } from '../../src/sheet/styles';

describe('Formatting History (Annulla / Ripeti)', () => {
  it('annulla e ripete formattazione su cella singola', () => {
    const history = new HistoryManager(50);
    const ss = createSheetStyles();

    // Stato iniziale: default
    expect(resolveCellStyle(1, 1, ss).bold).toBeUndefined();

    // Applica grassetto
    applyFormatToRange(ss, { startRow: 1, endRow: 1, startCol: 1, endCol: 1 }, { bold: true });
    history.pushStep({
      description: 'Grassetto',
      changes: [],
      styleChanges: [
        {
          type: 'cell',
          target: '1,1',
          oldStyleId: 0,
          newStyleId: ss.cellStyles.get('1,1'),
        },
      ],
    });

    expect(resolveCellStyle(1, 1, ss).bold).toBe(true);
    expect(history.canUndo()).toBe(true);

    // Annulla (Undo)
    const undoStep = history.popUndo();
    expect(undoStep).not.toBeNull();
    if (undoStep?.styleChanges) {
      for (const sc of undoStep.styleChanges) {
        if (sc.type === 'cell') {
          if (sc.oldStyleId === 0 || sc.oldStyleId === undefined) {
            ss.cellStyles.delete(sc.target as string);
          } else {
            ss.cellStyles.set(sc.target as string, sc.oldStyleId);
          }
        }
      }
    }
    expect(resolveCellStyle(1, 1, ss).bold).toBeUndefined();
    expect(history.canRedo()).toBe(true);

    // Ripeti (Redo)
    const redoStep = history.popRedo();
    expect(redoStep).not.toBeNull();
    if (redoStep?.styleChanges) {
      for (const sc of redoStep.styleChanges) {
        if (sc.type === 'cell' && sc.newStyleId !== undefined) {
          ss.cellStyles.set(sc.target as string, sc.newStyleId);
        }
      }
    }
    expect(resolveCellStyle(1, 1, ss).bold).toBe(true);
  });

  it('passo atomico unico per operazione con modifica combinata di valore e stile', () => {
    const history = new HistoryManager(50);
    const ss = createSheetStyles();

    // Registra uno step atomico con modifica valore E modifica stile
    history.pushStep({
      description: 'Incolla con stile',
      changes: [
        {
          sheet: 'Foglio1',
          row: 1,
          col: 1,
          oldRaw: '',
          newRaw: '100',
          oldStyleId: 0,
          newStyleId: 1,
        },
      ],
      styleChanges: [
        {
          type: 'cell',
          target: '1,1',
          oldStyleId: 0,
          newStyleId: 1,
        },
      ],
    });

    expect(history.getUndoCount()).toBe(1);
    const step = history.popUndo();
    expect(step?.changes.length).toBe(1);
    expect(step?.styleChanges?.length).toBe(1);
    expect(history.getRedoCount()).toBe(1);
  });
});
