import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  isRowVisible,
  computeHiddenRowsFromFilters,
  extractUniqueColumnValues,
  ColumnFilter,
  FilterRange,
  createFilterView,
} from '../../src/sheet/filter';

describe('src/sheet/filter.ts - Filtri per colonna e viste filtro', () => {
  describe('evaluateCondition', () => {
    it('gestisce empty e not_empty', () => {
      expect(evaluateCondition('', { operator: 'empty' })).toBe(true);
      expect(evaluateCondition('  ', { operator: 'empty' })).toBe(true);
      expect(evaluateCondition('abc', { operator: 'empty' })).toBe(false);

      expect(evaluateCondition('abc', { operator: 'not_empty' })).toBe(true);
      expect(evaluateCondition('', { operator: 'not_empty' })).toBe(false);
    });

    it('gestisce text_contains e text_not_contains case-insensitive', () => {
      expect(evaluateCondition('Milano Nord', { operator: 'text_contains', value1: 'milano' })).toBe(true);
      expect(evaluateCondition('Roma Centro', { operator: 'text_contains', value1: 'milano' })).toBe(false);

      expect(evaluateCondition('Torino', { operator: 'text_not_contains', value1: 'milano' })).toBe(true);
      expect(evaluateCondition('Milano', { operator: 'text_not_contains', value1: 'milano' })).toBe(false);
    });

    it('gestisce text_starts_with e text_ends_with', () => {
      expect(evaluateCondition('PROD-1234', { operator: 'text_starts_with', value1: 'prod' })).toBe(true);
      expect(evaluateCondition('ITEM-1234', { operator: 'text_starts_with', value1: 'prod' })).toBe(false);

      expect(evaluateCondition('report.pdf', { operator: 'text_ends_with', value1: '.pdf' })).toBe(true);
      expect(evaluateCondition('report.docx', { operator: 'text_ends_with', value1: '.pdf' })).toBe(false);
    });

    it('gestisce text_exact', () => {
      expect(evaluateCondition('Verde', { operator: 'text_exact', value1: 'verde' })).toBe(true);
      expect(evaluateCondition('Verde Chiaro', { operator: 'text_exact', value1: 'verde' })).toBe(false);
    });

    it('gestisce confronti numerici (greater, less, equal)', () => {
      expect(evaluateCondition('100', { operator: 'greater_than', value1: 50 })).toBe(true);
      expect(evaluateCondition('50', { operator: 'greater_than', value1: 50 })).toBe(false);
      expect(evaluateCondition('50', { operator: 'greater_equal', value1: 50 })).toBe(true);

      expect(evaluateCondition('25', { operator: 'less_than', value1: 50 })).toBe(true);
      expect(evaluateCondition('50', { operator: 'less_than', value1: 50 })).toBe(false);
      expect(evaluateCondition('50', { operator: 'less_equal', value1: 50 })).toBe(true);

      expect(evaluateCondition('42', { operator: 'equal_to', value1: 42 })).toBe(true);
      expect(evaluateCondition('42', { operator: 'not_equal_to', value1: 42 })).toBe(false);
    });

    it('gestisce intervalli between e not_between', () => {
      expect(evaluateCondition('15', { operator: 'between', value1: 10, value2: 20 })).toBe(true);
      expect(evaluateCondition('10', { operator: 'between', value1: 10, value2: 20 })).toBe(true);
      expect(evaluateCondition('25', { operator: 'between', value1: 10, value2: 20 })).toBe(false);

      expect(evaluateCondition('5', { operator: 'not_between', value1: 10, value2: 20 })).toBe(true);
      expect(evaluateCondition('15', { operator: 'not_between', value1: 10, value2: 20 })).toBe(false);
    });
  });

  describe('isRowVisible & computeHiddenRowsFromFilters', () => {
    const grid: Record<string, string> = {
      '1,1': 'ID', '1,2': 'Categoria', '1,3': 'Importo',
      '2,1': '1', '2,2': 'Hardware', '2,3': '500',
      '3,1': '2', '3,2': 'Software', '3,3': '120',
      '4,1': '3', '4,2': 'Hardware', '4,3': '50',
      '5,1': '4', '5,2': 'Servizi', '5,3': '800',
    };
    const getVal = (r: number, c: number) => grid[`${r},${c}`] || '';

    const range: FilterRange = {
      startRow: 1,
      endRow: 5,
      startCol: 1,
      endCol: 3,
      hasHeader: true,
    };

    it('filtra per valori univoci selezionati', () => {
      const filters = new Map<number, ColumnFilter>([
        [2, { col: 2, selectedValues: new Set(['Hardware', 'Servizi']) }],
      ]);

      // Riga 2 (Hardware) visibile, Riga 3 (Software) nascosta, Riga 4 (Hardware) visibile, Riga 5 (Servizi) visibile
      expect(isRowVisible(2, filters, getVal)).toBe(true);
      expect(isRowVisible(3, filters, getVal)).toBe(false);

      const hidden = computeHiddenRowsFromFilters(range, filters, getVal);
      expect(Array.from(hidden)).toEqual([3]);
    });

    it('combina filtri su colonne multiple in AND logico', () => {
      const filters = new Map<number, ColumnFilter>([
        [2, { col: 2, selectedValues: new Set(['Hardware']) }], // Solo Hardware (righe 2 e 4)
        [3, { col: 3, condition: { operator: 'greater_than', value1: 100 } }], // Importo > 100 (riga 2 = 500, riga 4 = 50)
      ]);

      const hidden = computeHiddenRowsFromFilters(range, filters, getVal);
      // Riga 2 visibile; Righe 3 (Software), 4 (Importo <= 100), 5 (Servizi) nascoste
      expect(Array.from(hidden).sort()).toEqual([3, 4, 5]);
    });

    it('restituisce set vuoto se nessun filtro è attivo', () => {
      const hidden = computeHiddenRowsFromFilters(range, new Map(), getVal);
      expect(hidden.size).toBe(0);
    });
  });

  describe('extractUniqueColumnValues', () => {
    it('estrae valori univoci ordinati escludendo intestazione', () => {
      const grid: Record<string, string> = {
        '1,1': 'Città',
        '2,1': 'Roma',
        '3,1': 'Milano',
        '4,1': 'Roma',
        '5,1': 'Napoli',
        '6,1': '',
      };
      const getVal = (r: number, c: number) => grid[`${r},${c}`] || '';

      const range: FilterRange = {
        startRow: 1,
        endRow: 6,
        startCol: 1,
        endCol: 1,
        hasHeader: true,
      };

      const uniques = extractUniqueColumnValues(1, range, getVal);
      expect(uniques).toEqual(['Milano', 'Napoli', 'Roma', '']);
    });

    it('filtra valori univoci con stringa di ricerca', () => {
      const grid: Record<string, string> = {
        '1,1': 'Prodotto',
        '2,1': 'Monitor 24',
        '3,1': 'Mouse wireless',
        '4,1': 'Monitor 27',
      };
      const getVal = (r: number, c: number) => grid[`${r},${c}`] || '';
      const range: FilterRange = { startRow: 1, endRow: 4, startCol: 1, endCol: 1, hasHeader: true };

      const uniques = extractUniqueColumnValues(1, range, getVal, 'monitor');
      expect(uniques).toEqual(['Monitor 24', 'Monitor 27']);
    });
  });

  describe('createFilterView', () => {
    it('crea vista filtro con identificativo e copia filtri', () => {
      const range: FilterRange = { startRow: 1, endRow: 10, startCol: 1, endCol: 3, hasHeader: true };
      const filters = new Map<number, ColumnFilter>([
        [1, { col: 1, condition: { operator: 'not_empty' } }],
      ]);

      const fv = createFilterView('fv-1', 'Solo attivi', range, filters);
      expect(fv.id).toBe('fv-1');
      expect(fv.name).toBe('Solo attivi');
      expect(fv.filters.size).toBe(1);
    });
  });
});
