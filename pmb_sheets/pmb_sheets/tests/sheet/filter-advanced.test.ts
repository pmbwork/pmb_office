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

describe('tests/sheet/filter-advanced.test.ts - Casi avanzati filtri', () => {
  it('valuta condizioni testuali con spazi e caratteri accentati', () => {
    expect(evaluateCondition('Società Agricola', { operator: 'text_contains', value1: 'agricola' })).toBe(true);
    expect(evaluateCondition('Caffè', { operator: 'text_ends_with', value1: 'ffè' })).toBe(true);
    expect(evaluateCondition('È un test', { operator: 'text_starts_with', value1: 'è' })).toBe(true);
  });

  it('valuta operatori numerici not_equal_to ed equal_to con stringhe e numeri', () => {
    expect(evaluateCondition('100', { operator: 'not_equal_to', value1: 50 })).toBe(true);
    expect(evaluateCondition('100', { operator: 'not_equal_to', value1: 100 })).toBe(false);
    expect(evaluateCondition('ABC', { operator: 'equal_to', value1: 'abc' })).toBe(true);
    expect(evaluateCondition('ABC', { operator: 'not_equal_to', value1: 'xyz' })).toBe(true);
  });

  it('valuta operatori between ai bordi estremi esatti', () => {
    expect(evaluateCondition('10', { operator: 'between', value1: 10, value2: 20 })).toBe(true);
    expect(evaluateCondition('20', { operator: 'between', value1: 10, value2: 20 })).toBe(true);
    expect(evaluateCondition('9.99', { operator: 'between', value1: 10, value2: 20 })).toBe(false);
    expect(evaluateCondition('20.01', { operator: 'between', value1: 10, value2: 20 })).toBe(false);
  });

  it('valuta operatore not_between ai bordi estremi esatti', () => {
    expect(evaluateCondition('9', { operator: 'not_between', value1: 10, value2: 20 })).toBe(true);
    expect(evaluateCondition('21', { operator: 'not_between', value1: 10, value2: 20 })).toBe(true);
    expect(evaluateCondition('10', { operator: 'not_between', value1: 10, value2: 20 })).toBe(false);
    expect(evaluateCondition('20', { operator: 'not_between', value1: 10, value2: 20 })).toBe(false);
  });

  it('filtra su matrice di dati con 10 righe e condizioni multiple', () => {
    const data: Record<string, string> = {
      '1,1': 'A', '1,2': '10',
      '2,1': 'B', '2,2': '20',
      '3,1': 'A', '3,2': '30',
      '4,1': 'C', '4,2': '40',
      '5,1': 'A', '5,2': '50',
      '6,1': 'B', '6,2': '60',
      '7,1': 'C', '7,2': '70',
      '8,1': 'A', '8,2': '80',
      '9,1': 'B', '9,2': '90',
      '10,1': 'A', '10,2': '100',
    };
    const getVal = (r: number, c: number) => data[`${r},${c}`] || '';

    const range: FilterRange = { startRow: 1, endRow: 10, startCol: 1, endCol: 2, hasHeader: false };
    const filters = new Map<number, ColumnFilter>([
      [1, { col: 1, selectedValues: new Set(['A']) }], // Solo A: righe 1, 3, 5, 8, 10
      [2, { col: 2, condition: { operator: 'greater_than', value1: 30 } }], // Valore > 30: righe 5, 8, 10
    ]);

    const hidden = computeHiddenRowsFromFilters(range, filters, getVal);
    // Righe visibili: 5, 8, 10. Righe nascoste: 1, 2, 3, 4, 6, 7, 9
    expect(Array.from(hidden).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 6, 7, 9]);
  });

  it('estrae valori univoci preservando ordinamento e gestendo valori duplicati e vuoti', () => {
    const data: Record<string, string> = {
      '1,1': 'X',
      '2,1': 'Y',
      '3,1': 'X',
      '4,1': '',
      '5,1': 'Z',
      '6,1': '',
    };
    const getVal = (r: number, c: number) => data[`${r},${c}`] || '';
    const range: FilterRange = { startRow: 1, endRow: 6, startCol: 1, endCol: 1, hasHeader: false };

    const uniques = extractUniqueColumnValues(1, range, getVal);
    expect(uniques).toEqual(['X', 'Y', 'Z', '']);
  });

  it('modifica e aggiorna filtri all interno di una vista filtro', () => {
    const range: FilterRange = { startRow: 1, endRow: 20, startCol: 1, endCol: 5 };
    const view = createFilterView('v1', 'Report trimestrale', range);
    expect(view.filters.size).toBe(0);

    view.filters.set(2, { col: 2, condition: { operator: 'not_empty' } });
    expect(view.filters.size).toBe(1);
    expect(view.filters.get(2)?.condition?.operator).toBe('not_empty');
  });
});
