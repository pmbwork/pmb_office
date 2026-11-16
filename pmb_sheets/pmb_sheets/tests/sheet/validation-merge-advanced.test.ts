import { describe, it, expect } from 'vitest';
import { validateCellValue, DataValidationRule } from '../../src/sheet/data-validation';
import {
  mergeAll,
  mergeHorizontal,
  mergeVertical,
  unmergeCells,
  getCellMergeInfo,
  adjustMergesOnStructureChange,
  MergeRange,
} from '../../src/sheet/cell-merge';

describe('tests/sheet/validation-merge-advanced.test.ts - Casi avanzati convalida e unione', () => {
  describe('Convalida Dati Avanzata', () => {
    it('valida numeri con operatori greater_equal e less_equal', () => {
      const geRule: DataValidationRule = {
        id: 'ge',
        type: 'number',
        operator: 'greater_equal',
        value1: 18,
        action: 'reject',
      };
      expect(validateCellValue('18', geRule).valid).toBe(true);
      expect(validateCellValue('17.9', geRule).valid).toBe(false);

      const leRule: DataValidationRule = {
        id: 'le',
        type: 'number',
        operator: 'less_equal',
        value1: 100,
        action: 'reject',
      };
      expect(validateCellValue('100', leRule).valid).toBe(true);
      expect(validateCellValue('101', leRule).valid).toBe(false);
    });

    it('valida date con operatore between', () => {
      const dateRule: DataValidationRule = {
        id: 'dt',
        type: 'date',
        operator: 'between',
        value1: '2024-01-01',
        value2: '2024-12-31',
        action: 'reject',
      };
      expect(validateCellValue('2024-06-15', dateRule).valid).toBe(true);
      expect(validateCellValue('2023-12-31', dateRule).valid).toBe(false);
      expect(validateCellValue('2025-01-01', dateRule).valid).toBe(false);
      expect(validateCellValue('non-una-data', dateRule).valid).toBe(false);
    });

    it('valida lunghezza testo con operatori less_equal e greater_equal', () => {
      const lenRule: DataValidationRule = {
        id: 'len',
        type: 'text_length',
        operator: 'between',
        value1: 3,
        value2: 10,
        action: 'reject',
      };
      expect(validateCellValue('abc', lenRule).valid).toBe(true);
      expect(validateCellValue('1234567890', lenRule).valid).toBe(true);
      expect(validateCellValue('ab', lenRule).valid).toBe(false);
      expect(validateCellValue('12345678901', lenRule).valid).toBe(false);
    });

    it('restituisce l azione corretta (warn vs reject)', () => {
      const warnRule: DataValidationRule = {
        id: 'w',
        type: 'number',
        operator: 'greater_than',
        value1: 0,
        action: 'warn',
        helpText: 'Attenzione: valore negativo.',
      };
      const res = validateCellValue('-5', warnRule);
      expect(res.valid).toBe(false);
      expect(res.action).toBe('warn');
      expect(res.message).toBe('Attenzione: valore negativo.');
    });
  });

  describe('Unione Celle Avanzata', () => {
    it('gestisce unioni complesse multi-cella e calcolo colSpan/rowSpan', () => {
      // Unione 4 righe x 5 colonne (C3:G6)
      const merges: MergeRange[] = [{ startRow: 3, endRow: 6, startCol: 3, endCol: 7 }];

      const anchor = getCellMergeInfo(3, 3, merges);
      expect(anchor).not.toBeNull();
      expect(anchor!.isAnchor).toBe(true);
      expect(anchor!.rowSpan).toBe(4);
      expect(anchor!.colSpan).toBe(5);

      // Cella interna
      const inner = getCellMergeInfo(4, 5, merges);
      expect(inner).not.toBeNull();
      expect(inner!.isAnchor).toBe(false);
    });

    it('elimina colonne riducendo o cancellando l unione', () => {
      // Unione B2:D4 (colonne 2, 3, 4)
      const merges: MergeRange[] = [{ startRow: 2, endRow: 4, startCol: 2, endCol: 4 }];

      // Elimina colonna 3 (C)
      const res1 = adjustMergesOnStructureChange(merges, 'delete_cols', 3, 1);
      expect(res1.length).toBe(1);
      expect(res1[0]).toEqual({ startRow: 2, endRow: 4, startCol: 2, endCol: 3 });

      // Elimina interamente le colonne rimanenti
      const res2 = adjustMergesOnStructureChange(res1, 'delete_cols', 1, 5);
      expect(res2.length).toBe(0);
    });

    it('inserisce colonne espandendo l unione interna', () => {
      const merges: MergeRange[] = [{ startRow: 2, endRow: 4, startCol: 2, endCol: 4 }];
      // Inserisce 2 colonne a indice 3 (dentro l unione)
      const res = adjustMergesOnStructureChange(merges, 'insert_cols', 3, 2);
      expect(res).toEqual([{ startRow: 2, endRow: 4, startCol: 2, endCol: 6 }]);
    });
  });
});
