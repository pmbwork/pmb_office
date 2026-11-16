import { describe, it, expect } from 'vitest';
import {
  createMergeRange,
  rangesOverlap,
  mergeAll,
  mergeHorizontal,
  mergeVertical,
  unmergeCells,
  getCellMergeInfo,
  isCellCoveredByMerge,
  adjustMergesOnStructureChange,
  MergeRange,
} from '../../src/sheet/cell-merge';

describe('src/sheet/cell-merge.ts - Unione celle pura', () => {
  describe('createMergeRange & rangesOverlap', () => {
    it('restituisce null per singola cella 1x1', () => {
      expect(createMergeRange(1, 1, 1, 1)).toBeNull();
    });

    it('normalizza coordinate invertite', () => {
      const m = createMergeRange(5, 4, 2, 1);
      expect(m).toEqual({ startRow: 2, endRow: 5, startCol: 1, endCol: 4 });
    });

    it('rileva sovrapposizione tra intervalli', () => {
      const a: MergeRange = { startRow: 1, endRow: 3, startCol: 1, endCol: 3 };
      const b: MergeRange = { startRow: 2, endRow: 4, startCol: 2, endCol: 5 };
      const c: MergeRange = { startRow: 5, endRow: 6, startCol: 1, endCol: 1 };
      expect(rangesOverlap(a, b)).toBe(true);
      expect(rangesOverlap(a, c)).toBe(false);
    });
  });

  describe('mergeAll, mergeHorizontal, mergeVertical, unmergeCells', () => {
    it('mergeAll sostituisce unioni sovrapposte', () => {
      const initial: MergeRange[] = [{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }];
      const selection: MergeRange = { startRow: 1, endRow: 4, startCol: 1, endCol: 3 };
      const res = mergeAll(selection, initial);
      expect(res.length).toBe(1);
      expect(res[0]).toEqual(selection);
    });

    it('mergeHorizontal divide la selezione in un unione per riga', () => {
      const selection: MergeRange = { startRow: 2, endRow: 4, startCol: 1, endCol: 3 };
      const res = mergeHorizontal(selection, []);
      expect(res.length).toBe(3);
      expect(res).toEqual([
        { startRow: 2, endRow: 2, startCol: 1, endCol: 3 },
        { startRow: 3, endRow: 3, startCol: 1, endCol: 3 },
        { startRow: 4, endRow: 4, startCol: 1, endCol: 3 },
      ]);
    });

    it('mergeVertical divide la selezione in un unione per colonna', () => {
      const selection: MergeRange = { startRow: 1, endRow: 3, startCol: 2, endCol: 4 };
      const res = mergeVertical(selection, []);
      expect(res.length).toBe(3);
      expect(res).toEqual([
        { startRow: 1, endRow: 3, startCol: 2, endCol: 2 },
        { startRow: 1, endRow: 3, startCol: 3, endCol: 3 },
        { startRow: 1, endRow: 3, startCol: 4, endCol: 4 },
      ]);
    });

    it('unmergeCells rimuove le unioni sovrapposte', () => {
      const merges: MergeRange[] = [
        { startRow: 1, endRow: 2, startCol: 1, endCol: 2 },
        { startRow: 5, endRow: 6, startCol: 5, endCol: 6 },
      ];
      const res = unmergeCells({ startRow: 1, endRow: 1, startCol: 1, endCol: 1 }, merges);
      expect(res.length).toBe(1);
      expect(res[0]).toEqual({ startRow: 5, endRow: 6, startCol: 5, endCol: 6 });
    });
  });

  describe('getCellMergeInfo & isCellCoveredByMerge', () => {
    const merges: MergeRange[] = [
      { startRow: 2, endRow: 4, startCol: 2, endCol: 3 }, // 3 righe x 2 colonne (B2:C4)
    ];

    it('identifica la cella master in B2 (row 2, col 2)', () => {
      const info = getCellMergeInfo(2, 2, merges);
      expect(info).not.toBeNull();
      expect(info!.isAnchor).toBe(true);
      expect(info!.rowSpan).toBe(3);
      expect(info!.colSpan).toBe(2);
      expect(isCellCoveredByMerge(2, 2, merges)).toBe(false);
    });

    it('identifica la cella coperta in C3 (row 3, col 3)', () => {
      const info = getCellMergeInfo(3, 3, merges);
      expect(info).not.toBeNull();
      expect(info!.isAnchor).toBe(false);
      expect(isCellCoveredByMerge(3, 3, merges)).toBe(true);
    });

    it('restituisce null per cella non unita (A1)', () => {
      expect(getCellMergeInfo(1, 1, merges)).toBeNull();
      expect(isCellCoveredByMerge(1, 1, merges)).toBe(false);
    });
  });

  describe('adjustMergesOnStructureChange', () => {
    it('trasla le unioni quando viene inserita una riga prima dell intervallo', () => {
      const merges: MergeRange[] = [{ startRow: 3, endRow: 5, startCol: 1, endCol: 2 }];
      const res = adjustMergesOnStructureChange(merges, 'insert_rows', 2, 1);
      expect(res).toEqual([{ startRow: 4, endRow: 6, startCol: 1, endCol: 2 }]);
    });

    it('espande l unione quando una riga viene inserita all interno', () => {
      const merges: MergeRange[] = [{ startRow: 3, endRow: 5, startCol: 1, endCol: 2 }];
      const res = adjustMergesOnStructureChange(merges, 'insert_rows', 4, 2);
      expect(res).toEqual([{ startRow: 3, endRow: 7, startCol: 1, endCol: 2 }]);
    });

    it('elimina l unione se viene cancellata interamente', () => {
      const merges: MergeRange[] = [{ startRow: 3, endRow: 4, startCol: 1, endCol: 2 }];
      const res = adjustMergesOnStructureChange(merges, 'delete_rows', 2, 5);
      expect(res.length).toBe(0);
    });
  });
});
