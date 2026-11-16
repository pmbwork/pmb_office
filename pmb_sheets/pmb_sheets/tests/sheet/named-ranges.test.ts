import { describe, it, expect } from 'vitest';
import {
  isValidNamedRangeName,
  NamedRangeRegistry,
  rewriteFormulaOnRangeRename,
  expandNamedRangesInFormula,
} from '../../src/sheet/named-ranges';

describe('src/sheet/named-ranges.ts - Nomi di intervallo puri', () => {
  describe('isValidNamedRangeName', () => {
    it('valida identificatori canonici corretti', () => {
      expect(isValidNamedRangeName('Fatturato')).toBe(true);
      expect(isValidNamedRangeName('_totale_2024')).toBe(true);
      expect(isValidNamedRangeName('prezzo_unitario')).toBe(true);
    });

    it('rifiuta nomi che somigliano a celle (A1, BC99)', () => {
      expect(isValidNamedRangeName('A1')).toBe(false);
      expect(isValidNamedRangeName('B12')).toBe(false);
      expect(isValidNamedRangeName('ZZ500')).toBe(false);
      expect(isValidNamedRangeName('R1C1')).toBe(false);
    });

    it('rifiuta caratteri speciali, spazi o booleani', () => {
      expect(isValidNamedRangeName('Fatturato Mese')).toBe(false);
      expect(isValidNamedRangeName('Fatturato-Totale')).toBe(false);
      expect(isValidNamedRangeName('TRUE')).toBe(false);
      expect(isValidNamedRangeName('123abc')).toBe(false);
    });
  });

  describe('NamedRangeRegistry', () => {
    it('aggiunge, ottiene ed elenca intervalli denominati', () => {
      const reg = new NamedRangeRegistry();
      reg.add({
        name: 'Prezzi',
        sheetName: 'Foglio1',
        rangeString: 'A1:A10',
        startRow: 1,
        startCol: 1,
        endRow: 10,
        endCol: 1,
      });

      expect(reg.has('Prezzi')).toBe(true);
      expect(reg.has('prezzi')).toBe(true); // Case-insensitive
      expect(reg.get('prezzi')?.rangeString).toBe('A1:A10');
      expect(reg.getAll().length).toBe(1);
    });

    it('rinomina intervallo denominato', () => {
      const reg = new NamedRangeRegistry();
      reg.add({
        name: 'VecchioNome',
        sheetName: 'Foglio1',
        rangeString: 'B1:B5',
        startRow: 1,
        startCol: 2,
        endRow: 5,
        endCol: 2,
      });

      expect(reg.rename('VecchioNome', 'NuovoNome')).toBe(true);
      expect(reg.has('VecchioNome')).toBe(false);
      expect(reg.has('NuovoNome')).toBe(true);
    });
  });

  describe('rewriteFormulaOnRangeRename & expandNamedRangesInFormula', () => {
    it('riscrive la formula quando il range viene rinominato', () => {
      const formula = '=SUM(Vendite) * 1.22';
      const rewritten = rewriteFormulaOnRangeRename(formula, 'Vendite', 'Fatturato');
      expect(rewritten).toBe('=SUM(Fatturato) * 1.22');
    });

    it('non sostituisce identificatori parziali', () => {
      const formula = '=SUM(Vendite_Totali) + Vendite';
      const rewritten = rewriteFormulaOnRangeRename(formula, 'Vendite', 'Fatturato');
      expect(rewritten).toBe('=SUM(Vendite_Totali) + Fatturato');
    });

    it('espande nomi di intervallo nelle formule per il calcolo', () => {
      const reg = new NamedRangeRegistry();
      reg.add({
        name: 'Fatturato',
        sheetName: 'Foglio1',
        rangeString: 'B2:B20',
        startRow: 2,
        startCol: 2,
        endRow: 20,
        endCol: 2,
      });

      const formula = '=SUM(Fatturato)';
      const expanded = expandNamedRangesInFormula(formula, reg, 'Foglio1');
      expect(expanded).toBe('=SUM(B2:B20)');

      const expandedCross = expandNamedRangesInFormula(formula, reg, 'Foglio2');
      expect(expandedCross).toBe('=SUM(Foglio1!B2:B20)');
    });
  });
});
