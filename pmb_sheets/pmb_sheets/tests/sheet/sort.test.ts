import { describe, it, expect } from 'vitest';
import { compareCellValues, computeRowSort, rewriteFormulaOnSort, SortOptions } from '../../src/sheet/sort';

describe('src/sheet/sort.ts - Ordinamento puro e riscrittura formule', () => {
  describe('compareCellValues', () => {
    it('ordina celle vuote sempre in fondo in modalità crescente', () => {
      expect(compareCellValues('', '10', true)).toBeGreaterThan(0);
      expect(compareCellValues('abc', '', true)).toBeLessThan(0);
      expect(compareCellValues('', '', true)).toBe(0);
      expect(compareCellValues('   ', 'foo', true)).toBeGreaterThan(0);
    });

    it('ordina celle vuote sempre in fondo anche in modalità decrescente', () => {
      expect(compareCellValues('', '10', false)).toBeGreaterThan(0);
      expect(compareCellValues('abc', '', false)).toBeLessThan(0);
    });

    it('confronta numeri matematicamente', () => {
      expect(compareCellValues('2', '10', true)).toBeLessThan(0);
      expect(compareCellValues('10', '2', true)).toBeGreaterThan(0);
      expect(compareCellValues('10', '2', false)).toBeLessThan(0);
      expect(compareCellValues('100.5', '100.25', true)).toBeGreaterThan(0);
      expect(compareCellValues('-5', '0', true)).toBeLessThan(0);
    });

    it('posiziona i numeri prima del testo', () => {
      expect(compareCellValues('99', 'apple', true)).toBeLessThan(0);
      expect(compareCellValues('apple', '99', true)).toBeGreaterThan(0);
    });

    it('confronta date ISO YYYY-MM-DD', () => {
      expect(compareCellValues('2023-01-15', '2023-05-20', true)).toBeLessThan(0);
      expect(compareCellValues('2024-02-29', '2023-12-31', true)).toBeGreaterThan(0);
    });

    it('confronta date europee DD/MM/YYYY', () => {
      expect(compareCellValues('15/01/2023', '20/05/2023', true)).toBeLessThan(0);
      expect(compareCellValues('01/12/2023', '30/11/2023', true)).toBeGreaterThan(0);
    });

    it('confronta stringhe case-insensitive', () => {
      expect(compareCellValues('apple', 'Banana', true)).toBeLessThan(0);
      expect(compareCellValues('banana', 'Apple', true)).toBeGreaterThan(0);
      expect(compareCellValues('Test', 'test', true)).toBe(0);
    });
  });

  describe('computeRowSort', () => {
    it('ordina righe numeriche in una colonna singola A→Z', () => {
      const data: Record<string, string> = {
        '1,1': '40',
        '2,1': '10',
        '3,1': '30',
        '4,1': '20',
      };
      const getVal = (r: number, c: number) => data[`${r},${c}`] || '';

      const opts: SortOptions = {
        range: { startRow: 1, endRow: 4, startCol: 1, endCol: 1 },
        keys: [{ col: 1, ascending: true }],
      };

      const result = computeRowSort(getVal, opts);
      // Row 2 (10), Row 4 (20), Row 3 (30), Row 1 (40)
      expect(result.newOrder).toEqual([2, 4, 3, 1]);
      expect(result.rowMappings).toEqual([
        { fromRow: 2, toRow: 1 },
        { fromRow: 4, toRow: 2 },
        { fromRow: 3, toRow: 3 },
        { fromRow: 1, toRow: 4 },
      ]);
    });

    it('ordina righe in una colonna singola Z→A', () => {
      const data: Record<string, string> = {
        '1,1': '40',
        '2,1': '10',
        '3,1': '30',
        '4,1': '20',
      };
      const getVal = (r: number, c: number) => data[`${r},${c}`] || '';

      const opts: SortOptions = {
        range: { startRow: 1, endRow: 4, startCol: 1, endCol: 1 },
        keys: [{ col: 1, ascending: false }],
      };

      const result = computeRowSort(getVal, opts);
      expect(result.newOrder).toEqual([1, 3, 4, 2]);
    });

    it('preserva la riga di intestazione se hasHeader è true', () => {
      const data: Record<string, string> = {
        '1,1': 'Intestazione',
        '2,1': 'Zeta',
        '3,1': 'Alfa',
        '4,1': 'Beta',
      };
      const getVal = (r: number, c: number) => data[`${r},${c}`] || '';

      const opts: SortOptions = {
        range: { startRow: 1, endRow: 4, startCol: 1, endCol: 1 },
        keys: [{ col: 1, ascending: true }],
        hasHeader: true,
      };

      const result = computeRowSort(getVal, opts);
      // Riga 1 resta esclusa. Righe 2,3,4: Alfa (3), Beta (4), Zeta (2)
      expect(result.newOrder).toEqual([3, 4, 2]);
      expect(result.rowMappings).toEqual([
        { fromRow: 3, toRow: 2 },
        { fromRow: 4, toRow: 3 },
        { fromRow: 2, toRow: 4 },
      ]);
    });

    it('supporta ordinamento a più colonne (chiave secondaria)', () => {
      // Reparto (col 1), Stipendio (col 2)
      const data: Record<string, string> = {
        '1,1': 'Vendite', '1,2': '3000',
        '2,1': 'Amministrazione', '2,2': '2500',
        '3,1': 'Vendite', '3,2': '1500',
        '4,1': 'Amministrazione', '4,2': '3200',
      };
      const getVal = (r: number, c: number) => data[`${r},${c}`] || '';

      const opts: SortOptions = {
        range: { startRow: 1, endRow: 4, startCol: 1, endCol: 2 },
        keys: [
          { col: 1, ascending: true },  // Reparto A→Z
          { col: 2, ascending: false }, // Stipendio Z→A
        ],
      };

      const result = computeRowSort(getVal, opts);
      // Amministrazione: riga 4 (3200) poi riga 2 (2500)
      // Vendite: riga 1 (3000) poi riga 3 (1500)
      expect(result.newOrder).toEqual([4, 2, 1, 3]);
    });

    it('mantiene celle vuote in coda anche con testo e numeri', () => {
      const data: Record<string, string> = {
        '1,1': '',
        '2,1': 'Beta',
        '3,1': '',
        '4,1': 'Alfa',
      };
      const getVal = (r: number, c: number) => data[`${r},${c}`] || '';

      const opts: SortOptions = {
        range: { startRow: 1, endRow: 4, startCol: 1, endCol: 1 },
        keys: [{ col: 1, ascending: true }],
      };

      const result = computeRowSort(getVal, opts);
      expect(result.newOrder).toEqual([4, 2, 1, 3]);
    });
  });

  describe('rewriteFormulaOnSort', () => {
    it('aggiorna riferimenti relativi della stessa riga spostata', () => {
      // Cella riga 2 con formula =A2*10 spostata in riga 5
      const map = new Map<number, number>([
        [2, 5],
        [3, 2],
      ]);
      const formula = '=A2*10 + B2';
      const rewritten = rewriteFormulaOnSort(formula, 2, 5, map);
      expect(rewritten).toBe('=A5*10 + B5');
    });

    it('preserva coordinate assolute $A$2 o A$2', () => {
      const map = new Map<number, number>([[2, 5]]);
      const formula = '=$A$2 + B$2 + $C2';
      // $A$2 e B$2 non cambiano. $C2 (colonna assoluta, riga relativa) diventa $C5
      const rewritten = rewriteFormulaOnSort(formula, 2, 5, map);
      expect(rewritten).toBe('=$A$2 + B$2 + $C5');
    });

    it('aggiorna riferimenti a righe diverse se presenti nella mappa di ordinamento', () => {
      // Riga 2 spostata a 4; fa riferimento a riga 3 che è stata spostata a 1
      const map = new Map<number, number>([
        [2, 4],
        [3, 1],
      ]);
      const formula = '=A2 + B3';
      const rewritten = rewriteFormulaOnSort(formula, 2, 4, map);
      expect(rewritten).toBe('=A4 + B1');
    });

    it('non tocca riferimenti con nome di foglio esterno', () => {
      const map = new Map<number, number>([[2, 5]]);
      const formula = '=Foglio2!A2 + A2';
      const rewritten = rewriteFormulaOnSort(formula, 2, 5, map);
      expect(rewritten).toBe('=Foglio2!A2 + A5');
    });
  });
});
