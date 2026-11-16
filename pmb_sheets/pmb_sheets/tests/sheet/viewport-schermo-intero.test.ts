import { describe, it, expect } from 'vitest';
import { computeVisibleRange, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, MAX_DOM_CELLS_CEILING, MAX_DOM_CELLS_SOFT } from '../../src/sheet/viewport';

// Regressione: a schermo intero la griglia mostrava solo 36 righe, perché il tetto di celle
// tagliava le righe visibili invece del margine extra attorno all'area visibile.
describe('viewport: schermi grandi e schermo intero', () => {
  const righeVisibili = (altezza: number, zoom = 100) => Math.ceil(altezza / (DEFAULT_ROW_HEIGHT * zoom / 100));
  const colonneVisibili = (larghezza: number, zoom = 100) => Math.ceil(larghezza / (DEFAULT_COL_WIDTH * zoom / 100));

  it.each([
    ['Full HD', 1920, 940],
    ['2K', 2560, 1300],
    ['4K', 3840, 2000],
  ])('%s: si vedono tutte le righe e tutte le colonne dell\'area', (_nome, larghezza, altezza) => {
    const v = computeVisibleRange({ scrollTop: 0, scrollLeft: 0, viewportWidth: larghezza, viewportHeight: altezza });
    expect(v.endRow - v.startRow + 1).toBeGreaterThanOrEqual(righeVisibili(altezza));
    expect(v.endCol - v.startCol + 1).toBeGreaterThanOrEqual(colonneVisibili(larghezza));
    expect(v.totalRenderedCells).toBeLessThan(MAX_DOM_CELLS_CEILING);
  });

  it('con lo scroll lontano dall\'inizio si vedono lo stesso tutte le righe', () => {
    const v = computeVisibleRange({ scrollTop: 22 * 5000, scrollLeft: 90 * 30, viewportWidth: 2560, viewportHeight: 1300 });
    expect(v.endRow).toBeGreaterThanOrEqual(5001 + righeVisibili(1300) - 1);
    expect(v.endCol).toBeGreaterThanOrEqual(31 + colonneVisibili(2560) - 1);
  });

  it('con larghezze di colonna personalizzate si vedono ancora tutte le righe', () => {
    const colWidths = new Map<number, number>([[1, 60], [2, 60], [3, 60]]);
    const v = computeVisibleRange({ scrollTop: 0, scrollLeft: 0, viewportWidth: 3000, viewportHeight: 1300, colWidths });
    expect(v.endRow - v.startRow + 1).toBeGreaterThanOrEqual(righeVisibili(1300));
  });

  it('con poche celle resta il margine extra attorno all\'area visibile', () => {
    const v = computeVisibleRange({ scrollTop: 22 * 100, scrollLeft: 90 * 10, viewportWidth: 900, viewportHeight: 440 });
    expect(v.startRow).toBeLessThan(101);
    expect(v.startCol).toBeLessThan(11);
    expect(v.totalRenderedCells).toBeLessThan(MAX_DOM_CELLS_SOFT);
  });

  it('un viewport enorme resta sotto il tetto duro', () => {
    const v = computeVisibleRange({ scrollTop: 0, scrollLeft: 0, viewportWidth: 8000, viewportHeight: 6000, zoom: 50 });
    expect(v.totalRenderedCells).toBeLessThan(MAX_DOM_CELLS_CEILING);
  });
});
