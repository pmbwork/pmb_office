import { describe, it, expect } from 'vitest';
import {
  parseListItems,
  validateCellValue,
  DataValidationRule,
} from '../../src/sheet/data-validation';

describe('src/sheet/data-validation.ts - Convalida dati pura', () => {
  describe('parseListItems', () => {
    it('divide stringa per virgole e rimuove spazi in eccesso', () => {
      expect(parseListItems('Rosso, Verde, Blu, Giallo ')).toEqual(['Rosso', 'Verde', 'Blu', 'Giallo']);
      expect(parseListItems('')).toEqual([]);
    });
  });

  describe('validateCellValue - List', () => {
    const listRule: DataValidationRule = {
      id: 'rule-1',
      type: 'list',
      listItems: ['Approvato', 'In attesa', 'Rifiutato'],
      action: 'reject',
      helpText: 'Scegli uno stato valido.',
    };

    it('accetta valori presenti nella lista (case-insensitive)', () => {
      expect(validateCellValue('approvato', listRule).valid).toBe(true);
      expect(validateCellValue('In attesa', listRule).valid).toBe(true);
    });

    it('rifiuta valori estranei con messaggio ed azione reject', () => {
      const res = validateCellValue('Annullato', listRule);
      expect(res.valid).toBe(false);
      expect(res.action).toBe('reject');
      expect(res.message).toBe('Scegli uno stato valido.');
    });

    it('accetta cella vuota se allowEmpty non è false', () => {
      expect(validateCellValue('', listRule).valid).toBe(true);
    });

    it('rifiuta cella vuota se allowEmpty è false', () => {
      const strictRule: DataValidationRule = { ...listRule, allowEmpty: false };
      expect(validateCellValue('', strictRule).valid).toBe(false);
    });
  });

  describe('validateCellValue - Numbers', () => {
    const numberBetweenRule: DataValidationRule = {
      id: 'rule-num',
      type: 'number',
      operator: 'between',
      value1: 10,
      value2: 100,
      action: 'reject',
    };

    it('valida numero compreso tra 10 e 100', () => {
      expect(validateCellValue('50', numberBetweenRule).valid).toBe(true);
      expect(validateCellValue('10', numberBetweenRule).valid).toBe(true);
      expect(validateCellValue('100', numberBetweenRule).valid).toBe(true);
      expect(validateCellValue('5', numberBetweenRule).valid).toBe(false);
      expect(validateCellValue('150', numberBetweenRule).valid).toBe(false);
    });

    it('rifiuta testo non numerico', () => {
      expect(validateCellValue('ciao', numberBetweenRule).valid).toBe(false);
    });

    it('supporta operatori greater_than e less_equal', () => {
      const gtRule: DataValidationRule = {
        id: 'rule-gt',
        type: 'number',
        operator: 'greater_than',
        value1: 0,
        action: 'warn',
      };
      expect(validateCellValue('15', gtRule).valid).toBe(true);
      expect(validateCellValue('0', gtRule).valid).toBe(false);
      expect(validateCellValue('-1', gtRule).action).toBe('warn');
    });
  });

  describe('validateCellValue - Checkbox & Custom', () => {
    it('valida casella di controllo booleana', () => {
      const chkRule: DataValidationRule = { id: 'chk', type: 'checkbox', action: 'reject' };
      expect(validateCellValue('TRUE', chkRule).valid).toBe(true);
      expect(validateCellValue('false', chkRule).valid).toBe(true);
      expect(validateCellValue('VERO', chkRule).valid).toBe(true);
      expect(validateCellValue('FALSO', chkRule).valid).toBe(true);
      expect(validateCellValue('forse', chkRule).valid).toBe(false);
    });

    it('valida con valutatore di formula personalizzata', () => {
      const customRule: DataValidationRule = {
        id: 'cst',
        type: 'custom',
        value1: '=A1>10',
        action: 'reject',
      };
      const evaluator = (f: string) => f.includes('>10');
      expect(validateCellValue('20', customRule, evaluator).valid).toBe(true);
    });
  });
});
