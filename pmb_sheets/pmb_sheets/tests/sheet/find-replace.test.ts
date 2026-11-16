import { describe, it, expect } from 'vitest';
import {
  buildSearchRegex,
  findAllMatches,
  findNextMatch,
  findPreviousMatch,
  performTextReplacement,
  executeReplaceAll,
  FindOptions,
  ReplaceOptions,
} from '../../src/sheet/find-replace';

describe('src/sheet/find-replace.ts - Trova e Sostituisci puro', () => {
  describe('buildSearchRegex', () => {
    it('effettua escape dei caratteri speciali se useRegex è false', () => {
      const reg = buildSearchRegex({ query: 'Costo ($)' });
      expect(reg).not.toBeNull();
      expect(reg!.test('Costo ($)')).toBe(true);
      expect(reg!.test('Costo 100')).toBe(false);
    });

    it('supporta regex pura quando useRegex è true', () => {
      const reg = buildSearchRegex({ query: '^PROD-\\d+$', useRegex: true });
      expect(reg).not.toBeNull();
      expect(reg!.test('PROD-123')).toBe(true);
      expect(reg!.test('PROD-ABC')).toBe(false);
    });

    it('gestisce matchCase e entireCell', () => {
      const regCase = buildSearchRegex({ query: 'Test', matchCase: true, entireCell: true });
      expect(regCase!.test('Test')).toBe(true);
      expect(regCase!.test('test')).toBe(false);
      expect(regCase!.test('Test 123')).toBe(false);
    });

    it('restituisce null su regex non valida senza lanciare eccezioni', () => {
      const reg = buildSearchRegex({ query: '[unclosed', useRegex: true });
      expect(reg).toBeNull();
    });
  });

  describe('findAllMatches & Navigation', () => {
    const sheetData: Record<string, { raw: string; display: string }> = {
      'Foglio1:1,1': { raw: 'Totale Fatturato', display: 'Totale Fatturato' },
      'Foglio1:1,2': { raw: '=SUM(B2:B10)', display: '1500' },
      'Foglio1:2,1': { raw: 'Fatturato Milano', display: 'Fatturato Milano' },
      'Foglio1:2,2': { raw: '1000', display: '1000' },
      'Foglio2:1,1': { raw: 'Fatturato Roma', display: 'Fatturato Roma' },
    };

    const getBounds = (_sh: string) => ({ maxRow: 2, maxCol: 2 });
    const getCell = (sh: string, r: number, c: number) => sheetData[`${sh}:${r},${c}`];

    it('trova corrispondenze nel foglio corrente', () => {
      const opts: FindOptions = {
        query: 'fatturato',
        currentSheetName: 'Foglio1',
        searchAllSheets: false,
      };

      const matches = findAllMatches(opts, getBounds, getCell);
      expect(matches.length).toBe(2);
      expect(matches[0]).toMatchObject({ sheetName: 'Foglio1', row: 1, col: 1 });
      expect(matches[1]).toMatchObject({ sheetName: 'Foglio1', row: 2, col: 1 });
    });

    it('trova corrispondenze su tutti i fogli', () => {
      const opts: FindOptions = {
        query: 'fatturato',
        sheetNames: ['Foglio1', 'Foglio2'],
        searchAllSheets: true,
      };

      const matches = findAllMatches(opts, getBounds, getCell);
      expect(matches.length).toBe(3);
      expect(matches[2]).toMatchObject({ sheetName: 'Foglio2', row: 1, col: 1 });
    });

    it('trova testo all interno delle formule quando searchInFormulas è true', () => {
      const opts: FindOptions = {
        query: 'SUM',
        currentSheetName: 'Foglio1',
        searchInFormulas: true,
      };

      const matches = findAllMatches(opts, getBounds, getCell);
      expect(matches.length).toBe(1);
      expect(matches[0]).toMatchObject({ row: 1, col: 2, isFormula: true });
    });

    it('naviga con findNextMatch e findPreviousMatch con wrap-around', () => {
      const matches = [
        { sheetName: 'Foglio1', row: 1, col: 1, text: 'A', isFormula: false },
        { sheetName: 'Foglio1', row: 2, col: 1, text: 'B', isFormula: false },
        { sheetName: 'Foglio1', row: 5, col: 3, text: 'C', isFormula: false },
      ];

      // Dalla riga 1 col 1, il successivo è riga 2 col 1
      const next1 = findNextMatch(matches, 'Foglio1', 1, 1);
      expect(next1).toBe(matches[1]);

      // Dalla riga 5 col 3 (ultimo), il successivo fa wrap-around a riga 1 col 1
      const nextWrap = findNextMatch(matches, 'Foglio1', 5, 3);
      expect(nextWrap).toBe(matches[0]);

      // Dalla riga 5 col 3, il precedente è riga 2 col 1
      const prev1 = findPreviousMatch(matches, 'Foglio1', 5, 3);
      expect(prev1).toBe(matches[1]);

      // Dalla riga 1 col 1, il precedente fa wrap-around all'ultimo
      const prevWrap = findPreviousMatch(matches, 'Foglio1', 1, 1);
      expect(prevWrap).toBe(matches[2]);
    });
  });

  describe('performTextReplacement & executeReplaceAll', () => {
    it('sostituisce testo singolo con opzioni case-insensitive', () => {
      const opts: ReplaceOptions = {
        query: 'roma',
        replacement: 'Milano',
        matchCase: false,
      };
      const res = performTextReplacement('Sede di Roma Capitale', opts);
      expect(res).toBe('Sede di Milano Capitale');
    });

    it('esegue sostituisci tutto su matrice di celle', () => {
      const sheetData: Record<string, { raw: string; display: string }> = {
        'Foglio1:1,1': { raw: 'Old_Item_1', display: 'Old_Item_1' },
        'Foglio1:1,2': { raw: 'Old_Item_2', display: 'Old_Item_2' },
        'Foglio1:2,1': { raw: 'Altro dato', display: 'Altro dato' },
      };
      const getBounds = () => ({ maxRow: 2, maxCol: 2 });
      const getCell = (_sh: string, r: number, c: number) => sheetData[`Foglio1:${r},${c}`];

      const opts: ReplaceOptions = {
        query: 'Old_Item',
        replacement: 'New_Product',
        currentSheetName: 'Foglio1',
      };

      const result = executeReplaceAll(opts, getBounds, getCell);
      expect(result.count).toBe(2);
      expect(result.replacements).toEqual([
        { sheetName: 'Foglio1', row: 1, col: 1, oldValue: 'Old_Item_1', newValue: 'New_Product_1' },
        { sheetName: 'Foglio1', row: 1, col: 2, oldValue: 'Old_Item_2', newValue: 'New_Product_2' },
      ]);
    });
  });
});
