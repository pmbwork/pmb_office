// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

describe('Robustness and Fuzz testing module', () => {
  it('handles syntactically invalid formulas with #ERROR! without throwing', () => {
    const wb = createWorkbook();

    const invalidFormulas = [
      '=(1 + 2',             // parentesi aperta non chiusa
      '=1 + * 2',            // operatore doppio
      '=',                   // solo uguale
      '=+ / 3',              // operatore senza operando
      '="stringa aperta',    // stringa non chiusa
      '=10..2',              // doppio punto
      '=(((())))',           // vuoto tra parentesi
    ];

    for (const f of invalidFormulas) {
      expect(() => {
        wb.setCell('Foglio1', 'A1', f);
      }).not.toThrow();

      const res = wb.getCell('Foglio1', 'A1').value;
      expect(res.kind).toBe('error');
      expect((res as any).error).toBe('#ERROR!');
    }
  });

  it('handles unknown functions with #NAME?', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=FUNZIONE_INVENTATA(1, 2, 3)');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'error', error: '#NAME?' });
  });

  it('handles sheet names with spaces and escaped single quotes', () => {
    const wb = createWorkbook();
    wb.addSheet("L'opera d'arte");
    wb.setCell("L'opera d'arte", 'A1', '100');

    wb.setCell('Foglio1', 'B1', "='L''opera d''arte'!A1 + 50");
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 150 });
  });

  it('fuzz testing: 2,000 random strings never throw unhandled exceptions', () => {
    const wb = createWorkbook();
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=+-*/^%&(),.:"\'$#!? \t\n';

    function getRandomString(len: number): string {
      let str = '';
      for (let i = 0; i < len; i++) {
        str += chars[Math.floor(Math.random() * chars.length)];
      }
      return str;
    }

    let unhandledErrors = 0;
    const NUM_FUZZ = 2000;

    for (let i = 0; i < NUM_FUZZ; i++) {
      const len = Math.floor(Math.random() * 30);
      const isFormula = Math.random() < 0.7; // 70% delle stringhe iniziano con '='
      const randomStr = (isFormula ? '=' : '') + getRandomString(len);

      try {
        wb.setCell('Foglio1', 'A1', randomStr);
      } catch (err) {
        unhandledErrors++;
      }
    }

    expect(unhandledErrors).toBe(0);
  });

  it('negative test: verifying that a known valid formula is not #ERROR!', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=1 + 1');
    expect(wb.getCell('Foglio1', 'A1').value).not.toEqual({ kind: 'error', error: '#ERROR!' });
  });
});
