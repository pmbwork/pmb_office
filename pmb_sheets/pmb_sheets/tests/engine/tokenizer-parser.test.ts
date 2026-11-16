// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/engine/tokenizer';
import { parseFormula } from '../../src/engine/parser';
import { Evaluator } from '../../src/engine/evaluator';
import { emptyVal } from '../../src/engine/values';

describe('Tokenizer and Parser module', () => {
  describe('Tokenizer', () => {
    it('tokenizes simple arithmetic', () => {
      const { tokens, error } = tokenize('1 + 2 * 3');
      expect(error).toBeUndefined();
      expect(tokens.map((t) => t.type)).toEqual(['NUMBER', 'PLUS', 'NUMBER', 'STAR', 'NUMBER', 'EOF']);
    });

    it('tokenizes string with escaped double quotes', () => {
      const { tokens, error } = tokenize('"Ciao ""Mondo"""');
      expect(error).toBeUndefined();
      expect(tokens[0].type).toBe('STRING');
      expect(tokens[0].value).toBe('Ciao "Mondo"');
    });

    it('tokenizes error literals', () => {
      const { tokens, error } = tokenize('#DIV/0! + #NAME?');
      expect(error).toBeUndefined();
      expect(tokens[0].type).toBe('ERROR');
      expect(tokens[0].errorValue).toBe('#DIV/0!');
      expect(tokens[2].type).toBe('ERROR');
      expect(tokens[2].errorValue).toBe('#NAME?');
    });

    it('tokenizes cell references and ranges', () => {
      const { tokens, error } = tokenize('A1 + $B$2 + Foglio1!C3:D10');
      expect(error).toBeUndefined();
      expect(tokens[0].type).toBe('CELL');
      expect(tokens[2].type).toBe('CELL');
      expect(tokens[4].type).toBe('RANGE');
    });

    it('negative test: unclosed string literal produces error', () => {
      const { error } = tokenize('"stringa non chiusa');
      expect(error).toBeDefined();
    });

    it('negative test: invalid character produces error', () => {
      const { error } = tokenize('1 @ 2');
      expect(error).toBeDefined();
    });
  });

  describe('Parser precedence and associativity', () => {
    const dummyContext = {
      currentSheet: 'Foglio1',
      currentRow: 1,
      currentCol: 1,
      getCellValue: () => emptyVal(),
      getRangeValues: () => [],
    };

    function evalFormulaStr(formula: string): any {
      const { ast, error } = parseFormula(formula);
      if (error || !ast) throw new Error(error || 'Parse error');
      const evaluator = new Evaluator(dummyContext);
      return evaluator.evaluate(ast);
    }

    it('Unary minus has higher precedence than power: -2^2 = (-2)^2 = 4', () => {
      const val = evalFormulaStr('=-2^2');
      expect(val).toEqual({ kind: 'number', value: 4 });
    });

    it('Power associates to the left: 2^3^2 = (2^3)^2 = 64', () => {
      const val = evalFormulaStr('=2^3^2');
      expect(val).toEqual({ kind: 'number', value: 64 });
    });

    it('Postfix % divides by 100 with higher precedence than binary ops', () => {
      const val1 = evalFormulaStr('=50%');
      expect(val1).toEqual({ kind: 'number', value: 0.5 });

      const val2 = evalFormulaStr('=10 + 50%');
      expect(val2).toEqual({ kind: 'number', value: 10.5 });
    });

    it('Standard precedence: multiplication before addition', () => {
      const val = evalFormulaStr('=2 + 3 * 4');
      expect(val).toEqual({ kind: 'number', value: 14 });

      const parenVal = evalFormulaStr('=(2 + 3) * 4');
      expect(parenVal).toEqual({ kind: 'number', value: 20 });
    });

    it('Concatenation & precedes comparisons', () => {
      const val = evalFormulaStr('="a" & "b" = "ab"');
      expect(val).toEqual({ kind: 'boolean', value: true });
    });

    it('negative test: unmatched parentheses produce error', () => {
      const res = parseFormula('(1 + 2');
      expect(res.error).toBeDefined();
    });

    it('negative test: missing operator produces error', () => {
      const res = parseFormula('1 2');
      expect(res.error).toBeDefined();
    });
  });
});
