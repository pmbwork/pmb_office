// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  columnLettersToIndex,
  columnIndexToLetters,
  parseCellAddress,
  parseRangeAddress,
  formatCellAddress,
  formatRangeAddress,
  splitSheetAndLocal,
  normalizeSheetName,
  MAX_ROWS,
  MAX_COLS,
} from '../../src/engine/address';

describe('Address module', () => {
  describe('Column conversion', () => {
    it('converts single letters', () => {
      expect(columnLettersToIndex('A')).toBe(1);
      expect(columnLettersToIndex('Z')).toBe(26);
    });

    it('converts double and triple letters up to XFD', () => {
      expect(columnLettersToIndex('AA')).toBe(27);
      expect(columnLettersToIndex('AZ')).toBe(52);
      expect(columnLettersToIndex('BA')).toBe(53);
      expect(columnLettersToIndex('XFD')).toBe(MAX_COLS);
    });

    it('converts indices back to letters', () => {
      expect(columnIndexToLetters(1)).toBe('A');
      expect(columnIndexToLetters(26)).toBe('Z');
      expect(columnIndexToLetters(27)).toBe('AA');
      expect(columnIndexToLetters(52)).toBe('AZ');
      expect(columnIndexToLetters(MAX_COLS)).toBe('XFD');
    });

    it('negative test: out of bounds column index returns empty string', () => {
      expect(columnIndexToLetters(0)).toBe('');
      expect(columnIndexToLetters(MAX_COLS + 1)).toBe('');
    });
  });

  describe('splitSheetAndLocal', () => {
    it('splits simple sheet', () => {
      const res = splitSheetAndLocal('Foglio1!A1');
      expect(res.sheet).toBe('Foglio1');
      expect(res.local).toBe('A1');
    });

    it('splits quoted sheet with spaces', () => {
      const res = splitSheetAndLocal("'Dati Vendite'!A1:B10");
      expect(res.sheet).toBe('Dati Vendite');
      expect(res.local).toBe('A1:B10');
    });

    it('splits quoted sheet with escaped single quotes', () => {
      const res = splitSheetAndLocal("'L''opera d''arte'!C5");
      expect(res.sheet).toBe("L'opera d'arte");
      expect(res.local).toBe('C5');
    });

    it('handles address without sheet', () => {
      const res = splitSheetAndLocal('B12');
      expect(res.sheet).toBeUndefined();
      expect(res.local).toBe('B12');
    });
  });

  describe('parseCellAddress and formatCellAddress', () => {
    it('parses relative and absolute cell addresses', () => {
      const c1 = parseCellAddress('A1');
      expect(c1).toEqual({ sheet: undefined, row: 1, col: 1, rowAbs: false, colAbs: false });

      const c2 = parseCellAddress('$B$10', 'Foglio1');
      expect(c2).toEqual({ sheet: 'Foglio1', row: 10, col: 2, rowAbs: true, colAbs: true });

      const c3 = parseCellAddress('XFD1048576');
      expect(c3).toEqual({ sheet: undefined, row: MAX_ROWS, col: MAX_COLS, rowAbs: false, colAbs: false });
    });

    it('formats cell coordinates back to string', () => {
      expect(formatCellAddress({ row: 1, col: 1, rowAbs: false, colAbs: false })).toBe('A1');
      expect(formatCellAddress({ row: 5, col: 3, rowAbs: true, colAbs: true, sheet: 'Foglio1' })).toBe('Foglio1!$C$5');
      expect(formatCellAddress({ row: 2, col: 1, rowAbs: false, colAbs: true, sheet: 'Mio Foglio' })).toBe("'Mio Foglio'!$A2");
    });

    it('negative test: invalid cell syntax returns null', () => {
      expect(parseCellAddress('A0')).toBeNull();
      expect(parseCellAddress(`A${MAX_ROWS + 1}`)).toBeNull();
      expect(parseCellAddress('XFE1')).toBeNull();
      expect(parseCellAddress('invalid')).toBeNull();
      expect(parseCellAddress('')).toBeNull();
    });
  });

  describe('parseRangeAddress and formatRangeAddress', () => {
    it('parses rectangular ranges', () => {
      const r1 = parseRangeAddress('A1:B5');
      expect(r1).toMatchObject({ startRow: 1, startCol: 1, endRow: 5, endCol: 2 });

      const r2 = parseRangeAddress('B5:A1'); // invertiti: devono essere normalizzati min/max
      expect(r2).toMatchObject({ startRow: 1, startCol: 1, endRow: 5, endCol: 2 });
    });

    it('parses full columns and full rows', () => {
      const cols = parseRangeAddress('A:C');
      expect(cols).toMatchObject({ startRow: 1, startCol: 1, endRow: MAX_ROWS, endCol: 3, isFullCol: true });

      const rows = parseRangeAddress('2:10');
      expect(rows).toMatchObject({ startRow: 2, startCol: 1, endRow: 10, endCol: MAX_COLS, isFullRow: true });
    });

    it('formats range coordinates back to string', () => {
      const r = parseRangeAddress('A1:B5')!;
      expect(formatRangeAddress(r, false)).toBe('A1:B5');

      const colR = parseRangeAddress('A:B')!;
      expect(formatRangeAddress(colR, false)).toBe('A:B');
    });

    it('negative test: invalid ranges return null', () => {
      expect(parseRangeAddress('A1:B9999999')).toBeNull();
      expect(parseRangeAddress('invalid:range')).toBeNull();
    });
  });

  describe('normalizeSheetName', () => {
    it('normalizes sheet names for case-insensitive comparison', () => {
      expect(normalizeSheetName(' Foglio1 ')).toBe('foglio1');
      expect(normalizeSheetName('FOGLIO_DATI')).toBe('foglio_dati');
    });
  });
});
