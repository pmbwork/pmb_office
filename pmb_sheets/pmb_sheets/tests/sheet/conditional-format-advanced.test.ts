import { describe, it, expect } from 'vitest';
import {
  interpolateColor,
  evaluateConditionalFormats,
  ConditionalFormatRule,
} from '../../src/sheet/conditional-format';

describe('tests/sheet/conditional-format-advanced.test.ts - Casi avanzati formattazione condizionale', () => {
  it('interpola scala di colori a 3 punti (min -> mid -> max)', () => {
    const rule: ConditionalFormatRule = {
      id: 'scale3',
      type: 'color_scale',
      range: { startRow: 1, endRow: 10, startCol: 1, endCol: 1 },
      colorScale: {
        minColor: '#ff0000', // Rosso
        midColor: '#ffff00', // Giallo
        maxColor: '#00ff00', // Verde
      },
    };
    const stats = { min: 0, max: 100, count: 10 };

    // Valore 0 -> Rosso esatto
    expect(evaluateConditionalFormats('0', 1, 1, [rule], stats)?.backgroundColor).toBe('#ff0000');
    // Valore 50 -> Giallo esatto
    expect(evaluateConditionalFormats('50', 5, 1, [rule], stats)?.backgroundColor).toBe('#ffff00');
    // Valore 100 -> Verde esatto
    expect(evaluateConditionalFormats('100', 10, 1, [rule], stats)?.backgroundColor).toBe('#00ff00');
  });

  it('gestisce numeri negativi nelle scale di colore', () => {
    const rule: ConditionalFormatRule = {
      id: 'scaleNeg',
      type: 'color_scale',
      range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
      colorScale: {
        minColor: '#000000',
        maxColor: '#ffffff',
      },
    };
    const stats = { min: -100, max: 100, count: 5 };
    // Valore 0 è esattamente a metà tra -100 e 100
    expect(evaluateConditionalFormats('0', 1, 1, [rule], stats)?.backgroundColor).toBe('#808080');
  });

  it('valuta regole testuali con not_contains, starts_with ed empty', () => {
    const rules: ConditionalFormatRule[] = [
      {
        id: 'r_empty',
        type: 'text',
        range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
        operator: 'empty',
        style: { backgroundColor: '#f3f4f6' },
      },
      {
        id: 'r_start',
        type: 'text',
        range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
        operator: 'starts_with',
        value1: 'OK',
        style: { textColor: '#16a34a', bold: true },
      },
    ];

    expect(evaluateConditionalFormats('', 1, 1, rules)?.backgroundColor).toBe('#f3f4f6');
    expect(evaluateConditionalFormats('OK - Eseguito', 2, 1, rules)?.textColor).toBe('#16a34a');
  });

  it('rispetta la priorità sequenziale delle regole (la prima corrispondente vince)', () => {
    const rules: ConditionalFormatRule[] = [
      {
        id: 'priority1',
        type: 'cell_value',
        range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
        operator: 'greater_than',
        value1: 100,
        style: { backgroundColor: '#dcfce7' }, // Verde
      },
      {
        id: 'priority2',
        type: 'cell_value',
        range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
        operator: 'greater_than',
        value1: 50,
        style: { backgroundColor: '#fef08a' }, // Giallo
      },
    ];

    // Valore 150 soddisfa sia >100 che >50; deve vincere la prima regola (verde)
    const res = evaluateConditionalFormats('150', 1, 1, rules);
    expect(res?.backgroundColor).toBe('#dcfce7');

    // Valore 75 soddisfa solo la seconda (giallo)
    const res2 = evaluateConditionalFormats('75', 2, 1, rules);
    expect(res2?.backgroundColor).toBe('#fef08a');
  });

  it('ignora celle fuori dall intervallo specificato nella regola', () => {
    const rule: ConditionalFormatRule = {
      id: 'bounded',
      type: 'cell_value',
      range: { startRow: 2, endRow: 4, startCol: 2, endCol: 3 }, // B2:C4
      operator: 'greater_than',
      value1: 0,
      style: { bold: true },
    };

    // A1 (1,1) è fuori dall'intervallo B2:C4
    expect(evaluateConditionalFormats('100', 1, 1, [rule])).toBeNull();
    // B2 (2,2) è dentro
    expect(evaluateConditionalFormats('100', 2, 2, [rule])?.bold).toBe(true);
  });
});
