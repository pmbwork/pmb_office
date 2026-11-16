import { describe, it, expect } from 'vitest';
import { compareCellValues, computeRowSort, rewriteFormulaOnSort, SortOptions } from '../../src/sheet/sort';

describe('tests/sheet/sort-advanced.test.ts - Casi limite e avanzati ordinamento', () => {
  it('confronta numeri negativi e positivi', () => {
    expect(compareCellValues('-10', '-5', true)).toBeLessThan(0);
    expect(compareCellValues('-5', '-10', true)).toBeGreaterThan(0);
    expect(compareCellValues('-10', '0', true)).toBeLessThan(0);
    expect(compareCellValues('0', '-10', true)).toBeGreaterThan(0);
  });

  it('confronta numeri decimali ad alta precisione', () => {
    expect(compareCellValues('3.14159', '3.14158', true)).toBeGreaterThan(0);
    expect(compareCellValues('0.0001', '0.0002', true)).toBeLessThan(0);
  });

  it('ordina stringhe alfanumeriche in ordine naturale (Item 2 prima di Item 10)', () => {
    expect(compareCellValues('Item 2', 'Item 10', true)).toBeLessThan(0);
    expect(compareCellValues('Capitolo 1', 'Capitolo 2', true)).toBeLessThan(0);
  });

  it('supporta ordinamento su 3 chiavi gerarchiche', () => {
    // Regione (col 1), Anno (col 2), Vendite (col 3)
    const grid: Record<string, string> = {
      '1,1': 'Lazio', '1,2': '2023', '1,3': '100',
      '2,1': 'Lombardia', '2,2': '2023', '2,3': '500',
      '3,1': 'Lazio', '3,2': '2022', '3,3': '200',
      '4,1': 'Lazio', '4,2': '2023', '4,3': '300',
    };
    const getVal = (r: number, c: number) => grid[`${r},${c}`] || '';

    const opts: SortOptions = {
      range: { startRow: 1, endRow: 4, startCol: 1, endCol: 3 },
      keys: [
        { col: 1, ascending: true },  // Regione A→Z (Lazio prima di Lombardia)
        { col: 2, ascending: true },  // Anno crescente (2022 prima di 2023)
        { col: 3, ascending: false }, // Vendite decrescenti (300 prima di 100)
      ],
    };

    const res = computeRowSort(getVal, opts);
    // 1. Lazio 2022 (riga 3)
    // 2. Lazio 2023 300 (riga 4)
    // 3. Lazio 2023 100 (riga 1)
    // 4. Lombardia 2023 500 (riga 2)
    expect(res.newOrder).toEqual([3, 4, 1, 2]);
  });

  it('non altera ordine se intervallo ha 0 o 1 riga', () => {
    const getVal = () => 'test';
    const optsEmpty: SortOptions = {
      range: { startRow: 2, endRow: 2, startCol: 1, endCol: 2 },
      keys: [{ col: 1, ascending: true }],
    };
    expect(computeRowSort(getVal, optsEmpty).rowMappings.length).toBe(0);
  });

  it('gestisce celle contenenti formule ignorando il segno uguale nel confronto numerico', () => {
    // Cella con formula non viene trattata come numero grezzo nel sort statico dei valori
    expect(compareCellValues('=A1+B1', '10', true)).toBeGreaterThan(0);
  });

  it('riscrive formule complesse con riferimenti multipli e intervalli', () => {
    const map = new Map<number, number>([
      [2, 10],
      [3, 11],
    ]);
    const formula = '=SUM(A2, B3, $C$1, D$5)';
    const rewritten = rewriteFormulaOnSort(formula, 2, 10, map);
    expect(rewritten).toBe('=SUM(A10, B11, $C$1, D$5)');
  });

  it('riscrive correttamente riferimenti quando una riga sale di indice (da 8 a 3)', () => {
    const map = new Map<number, number>([[8, 3]]);
    const formula = '=F8 * 1.2';
    const rewritten = rewriteFormulaOnSort(formula, 8, 3, map);
    expect(rewritten).toBe('=F3 * 1.2');
  });
});
