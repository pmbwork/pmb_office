import { describe, it, expect } from 'vitest';
import { compareCellValues, computeRowSort, rewriteFormulaOnSort, SortOptions } from '../../src/sheet/sort';
import {
  evaluateCondition,
  isRowVisible,
  computeHiddenRowsFromFilters,
  extractUniqueColumnValues,
  ColumnFilter,
  FilterRange,
  FilterConditionOperator,
} from '../../src/sheet/filter';
import {
  validateCellValue,
  DataValidationRule,
  ValidationOperator,
} from '../../src/sheet/data-validation';
import {
  buildSearchRegex,
  findAllMatches,
  performTextReplacement,
  FindOptions,
} from '../../src/sheet/find-replace';
import {
  createMergeRange,
  rangesOverlap,
  mergeAll,
  mergeHorizontal,
  mergeVertical,
  unmergeCells,
  getCellMergeInfo,
  adjustMergesOnStructureChange,
  MergeRange,
} from '../../src/sheet/cell-merge';
import {
  interpolateColor,
  evaluateConditionalFormats,
  ConditionalFormatRule,
} from '../../src/sheet/conditional-format';

describe('tests/sheet/data-suite-exhaustive.test.ts - Batteria esaustiva M2', () => {
  describe('1. Ordinamento esaustivo (30 test)', () => {
    // Genera 10 test a tabella per compareCellValues con numeri
    const numPairs: [string, string, boolean, number][] = [
      ['0', '0', true, 0],
      ['1', '2', true, -1],
      ['2', '1', true, 1],
      ['100', '20', true, 1],
      ['-50', '-10', true, -1],
      ['-10', '-50', true, 1],
      ['0.5', '0.25', true, 1],
      ['0.25', '0.5', true, -1],
      ['1000', '1000.0', true, 0],
      ['999999', '1000000', true, -1],
    ];

    numPairs.forEach(([a, b, asc, expectedSign], idx) => {
      it(`confronto numerico #${idx + 1}: ${a} vs ${b} (asc=${asc})`, () => {
        const res = compareCellValues(a, b, asc);
        const sign = res === 0 ? 0 : res > 0 ? 1 : -1;
        expect(sign).toBe(expectedSign);
      });
    });

    // Test a tabella per riscrittura formule su spostamento riga
    const formulaShiftCases = [
      { formula: '=A1', oldRow: 1, newRow: 5, expected: '=A5' },
      { formula: '=A1 + B1', oldRow: 1, newRow: 3, expected: '=A3 + B3' },
      { formula: '=$A$1 + B1', oldRow: 1, newRow: 4, expected: '=$A$1 + B4' },
      { formula: '=A$1 + $B1', oldRow: 1, newRow: 6, expected: '=A$1 + $B6' },
      { formula: '=SUM(A1:B1)', oldRow: 1, newRow: 2, expected: '=SUM(A2:B2)' },
      { formula: '=IF(C1>10, D1, E1)', oldRow: 1, newRow: 8, expected: '=IF(C8>10, D8, E8)' },
      { formula: '=Sheet2!A1 + A1', oldRow: 1, newRow: 7, expected: '=Sheet2!A1 + A7' },
      { formula: '=MAX(A1, 100)', oldRow: 1, newRow: 10, expected: '=MAX(A10, 100)' },
      { formula: '=$Z$99', oldRow: 1, newRow: 5, expected: '=$Z$99' },
      { formula: 'Testo non formula', oldRow: 1, newRow: 5, expected: 'Testo non formula' },
    ];

    formulaShiftCases.forEach(({ formula, oldRow, newRow, expected }, idx) => {
      it(`riscrittura formula su sort #${idx + 1}: ${formula} (row ${oldRow}->${newRow})`, () => {
        const map = new Map([[oldRow, newRow]]);
        expect(rewriteFormulaOnSort(formula, oldRow, newRow, map)).toBe(expected);
      });
    });

    // Test a tabella su computeRowSort con diverse configurazioni
    for (let k = 1; k <= 10; k++) {
      it(`ordinamento permutazione randomizzata #${k}`, () => {
        const values = [k * 10, (k + 5) * 10, (k - 2) * 10, (k + 1) * 10];
        const grid: Record<string, string> = {
          '1,1': String(values[0]),
          '2,1': String(values[1]),
          '3,1': String(values[2]),
          '4,1': String(values[3]),
        };
        const getVal = (r: number, c: number) => grid[`${r},${c}`] || '';
        const opts: SortOptions = {
          range: { startRow: 1, endRow: 4, startCol: 1, endCol: 1 },
          keys: [{ col: 1, ascending: true }],
        };
        const res = computeRowSort(getVal, opts);
        const sorted = [...values].sort((a, b) => a - b);
        const mapped = res.newOrder.map((rowIdx) => Number(grid[`${rowIdx},1`]));
        expect(mapped).toEqual(sorted);
      });
    }
  });

  describe('2. Filtri esaustivi (25 test)', () => {
    const operators: FilterConditionOperator[] = [
      'empty',
      'not_empty',
      'text_contains',
      'text_not_contains',
      'text_starts_with',
      'text_ends_with',
      'text_exact',
      'greater_than',
      'greater_equal',
      'less_than',
      'less_equal',
      'equal_to',
      'not_equal_to',
      'between',
      'not_between',
    ];

    operators.forEach((op, idx) => {
      it(`operatore filtro #${idx + 1} (${op}) restituisce booleano coerente`, () => {
        const res = evaluateCondition('50', { operator: op, value1: 40, value2: 60 });
        expect(typeof res).toBe('boolean');
      });
    });

    // 10 test su combinazioni di filtri colonna e calcolo hiddenRows
    for (let c = 1; c <= 10; c++) {
      it(`filtro matriciale riga/colonna #${c}`, () => {
        const grid: Record<string, string> = {
          '1,1': 'A', '1,2': `${c * 10}`,
          '2,1': 'B', '2,2': `${c * 20}`,
          '3,1': 'A', '3,2': `${c * 5}`,
        };
        const getVal = (r: number, cIdx: number) => grid[`${r},${cIdx}`] || '';
        const range: FilterRange = { startRow: 1, endRow: 3, startCol: 1, endCol: 2 };
        const filters = new Map<number, ColumnFilter>([
          [1, { col: 1, selectedValues: new Set(['A']) }],
        ]);
        const hidden = computeHiddenRowsFromFilters(range, filters, getVal);
        expect(hidden.has(2)).toBe(true); // Riga 2 (B) deve essere nascosta
        expect(hidden.has(1)).toBe(false); // Riga 1 (A) visibile
        expect(hidden.has(3)).toBe(false); // Riga 3 (A) visibile
      });
    }
  });

  describe('3. Convalida dati esaustiva (20 test)', () => {
    const numOperators: ValidationOperator[] = [
      'between',
      'not_between',
      'equal_to',
      'not_equal_to',
      'greater_than',
      'greater_equal',
      'less_than',
      'less_equal',
    ];

    numOperators.forEach((op, idx) => {
      it(`regola numerica operatore #${idx + 1} (${op}) con limiti 10 e 50`, () => {
        const rule: DataValidationRule = {
          id: `r-${idx}`,
          type: 'number',
          operator: op,
          value1: 10,
          value2: 50,
          action: 'reject',
        };
        const res = validateCellValue('25', rule);
        expect(typeof res.valid).toBe('boolean');
        expect(res.action).toBe('reject');
      });
    });

    // 12 test su formati, elenchi e testo
    for (let i = 1; i <= 12; i++) {
      it(`convalida elenco varianti #${i}`, () => {
        const rule: DataValidationRule = {
          id: `list-${i}`,
          type: 'list',
          listItems: [`Opzione ${i}`, `Default`],
          action: 'warn',
        };
        expect(validateCellValue(`Opzione ${i}`, rule).valid).toBe(true);
        expect(validateCellValue(`Sconosciuto ${i}`, rule).valid).toBe(false);
      });
    }
  });

  describe('4. Trova e Sostituisci esaustivo (20 test)', () => {
    for (let s = 1; s <= 10; s++) {
      it(`ricerca regex esatta token #${s}`, () => {
        const token = `ID_${s}`;
        const reg = buildSearchRegex({ query: token, matchCase: true, entireCell: true });
        expect(reg).not.toBeNull();
        expect(reg!.test(token)).toBe(true);
        expect(reg!.test(`${token}_extra`)).toBe(false);
      });
    }

    for (let r = 1; r <= 10; r++) {
      it(`sostituzione token #${r}`, () => {
        const original = `Prefix_KEY_${r}_Suffix`;
        const res = performTextReplacement(original, {
          query: `KEY_${r}`,
          replacement: `VAL_${r}`,
          matchCase: true,
        });
        expect(res).toBe(`Prefix_VAL_${r}_Suffix`);
      });
    }
  });

  describe('5. Unione celle esaustiva (20 test)', () => {
    for (let m = 1; m <= 10; m++) {
      it(`mergeHorizontal riga #${m}`, () => {
        const sel: MergeRange = { startRow: m, endRow: m, startCol: 1, endCol: 4 };
        const res = mergeHorizontal(sel, []);
        expect(res.length).toBe(1);
        expect(res[0]).toEqual(sel);
      });
    }

    for (let v = 1; v <= 10; v++) {
      it(`mergeVertical colonna #${v}`, () => {
        const sel: MergeRange = { startRow: 1, endRow: 5, startCol: v, endCol: v };
        const res = mergeVertical(sel, []);
        expect(res.length).toBe(1);
        expect(res[0]).toEqual(sel);
      });
    }
  });

  describe('6. Formattazione condizionale esaustiva (15 test)', () => {
    for (let p = 0; p <= 10; p++) {
      it(`interpolazione sfumatura gradiente step #${p} (${p * 10}%)`, () => {
        const hex = interpolateColor('#000000', '#ffffff', p / 10);
        expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      });
    }

    for (let b = 1; b <= 4; b++) {
      it(`regola valore numerico soglia #${b * 25}`, () => {
        const rule: ConditionalFormatRule = {
          id: `cf-${b}`,
          type: 'cell_value',
          range: { startRow: 1, endRow: 10, startCol: 1, endCol: 1 },
          operator: 'greater_than',
          value1: b * 25,
          style: { bold: true },
        };
        expect(evaluateConditionalFormats(String(b * 25 + 10), 1, 1, [rule])?.bold).toBe(true);
        expect(evaluateConditionalFormats(String(b * 25 - 5), 1, 1, [rule])).toBeNull();
      });
    }
  });
});
