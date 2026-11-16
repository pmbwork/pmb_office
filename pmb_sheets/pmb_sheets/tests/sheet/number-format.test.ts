import { describe, it, expect } from 'vitest';
import {
  formatCellValue,
  increaseDecimals,
  decreaseDecimals,
  serialToDate,
  dateToSerial,
} from '../../src/sheet/number-format';

describe('number-format pure module (Tabella di oltre 60 casi di test)', () => {
  // 1. Automatico / Generico (10 casi)
  describe('1. Formato Automatico / Generico', () => {
    it.each([
      [0, '', '0'],
      [123, '', '123'],
      [-45.67, '', '-45.67'],
      [0.0001, '', '0.0001'],
      [1e16, '', '1.0000E+16'],
      [null, '', ''],
      [undefined, '', ''],
      ['Testo normale', '', 'Testo normale'],
      [true, '', 'VERO'],
      [false, '', 'FALSO'],
    ])('valore %s con codice "%s" -> %s', (val, code, expected) => {
      expect(formatCellValue(val, code)).toBe(expected);
    });
  });

  // 2. Testo esplicito @ (5 casi)
  describe('2. Testo @', () => {
    it.each([
      ['Ciao Mondo', '@', 'Ciao Mondo'],
      [123.45, '@', '123.45'],
      [0, '@', '0'],
      [-999, '@', '-999'],
      ['#RIF!', '@', '#RIF!'],
    ])('valore %s con codice "@" -> %s', (val, code, expected) => {
      expect(formatCellValue(val, code)).toBe(expected);
    });
  });

  // 3. Formati Numerici (0.00, #,##0.00, arrotondamento, negativi) (12 casi)
  describe('3. Numeri con decimali e migliaia', () => {
    it.each([
      [1234.5, '#,##0.00', '1,234.50'],
      [1234.567, '#,##0.00', '1,234.57'],
      [-1234.5, '#,##0.00', '-1,234.50'],
      [0, '#,##0.00', '0.00'],
      [5, '0.00', '5.00'],
      [-5.1, '0.00', '-5.10'],
      [1000000, '#,##0.00', '1,000,000.00'],
      [1000000, '#,##0', '1,000,000'],
      [42.999, '0', '43'],
      [0.004, '0.00', '0.00'],
      [0.005, '0.00', '0.01'],
      [-0.005, '0.00', '-0.01'],
    ])('numero %s con codice "%s" -> %s', (val, code, expected) => {
      expect(formatCellValue(val, code)).toBe(expected);
    });
  });

  // 4. Valuta Euro €#,##0.00 (8 casi)
  describe('4. Valuta Euro', () => {
    it.each([
      [1234.5, '€#,##0.00', '€1,234.50'],
      [-1234.5, '€#,##0.00', '-€1,234.50'],
      [0, '€#,##0.00', '€0.00'],
      [50, '€#,##0.00', '€50.00'],
      [-0.5, '€#,##0.00', '-€0.50'],
      [9999999.99, '€#,##0.00', '€9,999,999.99'],
      [1500, '€#,##0', '€1,500'],
      [-1500, '€#,##0', '-€1,500'],
    ])('valuta %s con codice "%s" -> %s', (val, code, expected) => {
      expect(formatCellValue(val, code)).toBe(expected);
    });
  });

  // 5. Percentuali (8 casi)
  describe('5. Percentuali', () => {
    it.each([
      [0.256, '0.0%', '25.6%'],
      [0.256, '0.00%', '25.60%'],
      [0.256, '0%', '26%'],
      [1, '0%', '100%'],
      [1.5, '0.0%', '150.0%'],
      [-0.05, '0.00%', '-5.00%'],
      [0, '0%', '0%'],
      [2.5555, '0.00%', '255.55%'],
    ])('percentuale %s con codice "%s" -> %s', (val, code, expected) => {
      expect(formatCellValue(val, code)).toBe(expected);
    });
  });

  // 6. Notazione scientifica (6 casi)
  describe('6. Notazione scientifica', () => {
    it.each([
      [12345, '0.00E+00', '1.23E+04'],
      [0.00123, '0.00E+00', '1.23E-03'],
      [0, '0.00E+00', '0.00E+00'],
      [-54321, '0.00E+00', '-5.43E+04'],
      [100, '0.000E+00', '1.000E+02'],
      [-0.05, '0.00E+00', '-5.00E-02'],
    ])('scientifico %s con codice "%s" -> %s', (val, code, expected) => {
      expect(formatCellValue(val, code)).toBe(expected);
    });
  });

  // 7. Date e Ore (epoca 1899-12-30 UTC) (8 casi)
  describe('7. Date e Ore', () => {
    it('seriale 45351 (29 febbraio 2024 bisestile)', () => {
      expect(formatCellValue(45351, 'dd/mm/yyyy')).toBe('29/02/2024');
    });

    it('seriale 1 (31 dicembre 1899)', () => {
      expect(formatCellValue(1, 'dd/mm/yyyy')).toBe('31/12/1899');
    });

    it('seriale 0 (30 dicembre 1899)', () => {
      expect(formatCellValue(0, 'dd/mm/yyyy')).toBe('30/12/1899');
    });

    it('ora seriale 0.5 (mezzogiorno = 12:00:00)', () => {
      expect(formatCellValue(0.5, 'hh:mm:ss')).toBe('12:00:00');
    });

    it('ora seriale 0.75 (18:00:00)', () => {
      expect(formatCellValue(0.75, 'hh:mm:ss')).toBe('18:00:00');
    });

    it('ora seriale 0.25 (06:00:00)', () => {
      expect(formatCellValue(0.25, 'hh:mm:ss')).toBe('06:00:00');
    });

    it('data e ora combinate: 45351.5 -> 29/02/2024 12:00:00', () => {
      expect(formatCellValue(45351.5, 'dd/mm/yyyy hh:mm:ss')).toBe('29/02/2024 12:00:00');
    });

    it('roundtrip serialToDate e dateToSerial per il 29/02/2024', () => {
      const d = serialToDate(45351);
      expect(d.getUTCFullYear()).toBe(2024);
      expect(d.getUTCMonth()).toBe(1); // Febbraio (0-based)
      expect(d.getUTCDate()).toBe(29);
      expect(dateToSerial(d)).toBe(45351);
    });
  });

  // 8. Errori e tipi non numerici non devono rompersi (6 casi)
  describe('8. Resilienza non numerici ed errori', () => {
    it.each([
      ['#DIV/0!', '0.00', '#DIV/0!'],
      ['#N/A', '€#,##0.00', '#N/A'],
      ['#VALORE!', '0%', '#VALORE!'],
      ['testo alfabetico', '0.00', 'testo alfabetico'],
      [true, '0.00', 'VERO'],
      [false, '€#,##0.00', 'FALSO'],
    ])('valore non numerico %s con codice %s resta inalterato', (val, code, expected) => {
      expect(formatCellValue(val, code)).toBe(expected);
    });
  });

  // 9. Codici non validi ricadono su Automatico senza lanciare eccezioni (4 casi)
  describe('9. Codici sconosciuti/non validi', () => {
    it.each([
      [123.45, 'FORM_NON_ESISTENTE_XYZ', '123.45'],
      [99, '???###!!!', '99'],
      [-7, 'INVALID_CODE', '-7'],
      [0, '', '0'],
    ])('fallback sicuro per codice sconosciuto: %s con %s -> %s', (val, code, expected) => {
      expect(() => formatCellValue(val, code)).not.toThrow();
      expect(formatCellValue(val, code)).toBe(expected);
    });
  });

  // 10. Aumenta e diminuisci decimali (8 casi)
  describe('10. Aumenta e diminuisci decimali', () => {
    it('aumenta decimali da 0 a 0.0', () => {
      expect(increaseDecimals('0')).toBe('0.0');
      expect(increaseDecimals('0.0')).toBe('0.00');
      expect(increaseDecimals('0.00')).toBe('0.000');
    });

    it('aumenta decimali su percentuale', () => {
      expect(increaseDecimals('0%')).toBe('0.0%');
      expect(increaseDecimals('0.0%')).toBe('0.00%');
    });

    it('diminuisce decimali fino a zero', () => {
      expect(decreaseDecimals('0.000')).toBe('0.00');
      expect(decreaseDecimals('0.00')).toBe('0.0');
      expect(decreaseDecimals('0.0')).toBe('0');
      expect(decreaseDecimals('0')).toBe('0');
    });

    it('diminuisce decimali su valuta euro', () => {
      expect(decreaseDecimals('€#,##0.00')).toBe('€#,##0.0');
      expect(decreaseDecimals('€#,##0.0')).toBe('€#,##0');
      expect(decreaseDecimals('€#,##0')).toBe('€#,##0');
    });
  });
});
