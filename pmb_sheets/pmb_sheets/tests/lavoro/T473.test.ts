import { describe, it, expect, afterEach } from 'vitest';
import { formattaNumero, impostaLinguaNomi } from '../../src/engine/format-testo';
import { createWorkbook } from '../../src/engine/workbook';

const f = (n: number, codice: string) => formattaNumero(n, codice);
const serie = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, m - 1, d) / 86400000 + 25569 + (h * 3600 + mi * 60 + s) / 86400;

describe('T473: formati numerici (TEXT)', () => {
  it('zeri iniziali e decimali', () => {
    expect(f(5, '000')).toBe('005');
    expect(f(1234.5, '0')).toBe('1235');
    expect(f(1234.567, '0.00')).toBe('1234.57');
    expect(f(0.5, '#.00')).toBe('.50');
    expect(f(0.5, '0.0#')).toBe('0.5');
    expect(f(3.14159, '0.0##')).toBe('3.142');
    expect(f(2, '0.00')).toBe('2.00');
  });
  it('migliaia e scala', () => {
    expect(f(1234567.891, '#,##0.00')).toBe('1,234,567.89');
    expect(f(1234567, '#,##0')).toBe('1,234,567');
    expect(f(999, '#,##0')).toBe('999');
    expect(f(1234567, '#,##0,')).toBe('1,235'); // una virgola in fondo divide per mille
    expect(f(1234567, '0.0,,')).toBe('1.2');
  });
  it('percentuali', () => {
    expect(f(0.256, '0%')).toBe('26%');
    expect(f(0.256, '0.0%')).toBe('25.6%');
    expect(f(1.5, '0.00%')).toBe('150.00%');
  });
  it('notazione scientifica', () => {
    expect(f(12345.678, '0.00E+00')).toBe('1.23E+04');
    expect(f(0.000123, '0.00E+00')).toBe('1.23E-04');
    expect(f(5, '0.0E+0')).toBe('5.0E+0');
  });
  it('sezioni: positivi, negativi, zero', () => {
    expect(f(-5, '0;(0)')).toBe('(5)');
    expect(f(5, '0;(0)')).toBe('5');
    expect(f(-1234.5, '#,##0.00;(#,##0.00)')).toBe('(1,234.50)');
    expect(f(0, '0;-0;"zero"')).toBe('zero');
    expect(f(-5, '0.0')).toBe('-5.0'); // una sola sezione: il meno lo mette il programma
  });
  it('testo e simboli dentro il formato', () => {
    expect(f(5, '0 "pezzi"')).toBe('5 pezzi');
    expect(f(1234.5, '#,##0.00 "€"')).toBe('1,234.50 €');
    expect(f(1234.5, '"€" #,##0.00')).toBe('€ 1,234.50');
    expect(f(5, '\\#0')).toBe('#5');
    expect(f(5, '[Red]0')).toBe('5');
    expect(f(5551234, '000-0000')).toBe('555-1234');
    expect(f(5, '@')).toBe('5');
  });
  it('date e ore', () => {
    const d = serie(2026, 3, 5, 14, 7, 9);
    expect(f(d, 'dd/mm/yyyy')).toBe('05/03/2026');
    expect(f(d, 'yyyy-mm-dd')).toBe('2026-03-05');
    expect(f(d, 'd/m/yy')).toBe('5/3/26');
    expect(f(d, 'dddd')).toBe('Thursday');
    expect(f(d, 'ddd d mmm yyyy')).toBe('Thu 5 Mar 2026');
    expect(f(d, 'mmmm')).toBe('March');
    expect(f(d, 'h:mm')).toBe('14:07');
    expect(f(d, 'hh:mm:ss')).toBe('14:07:09');
    expect(f(d, 'h:mm AM/PM')).toBe('2:07 PM');
    expect(f(d, 'dd/mm/yyyy hh:mm')).toBe('05/03/2026 14:07');
    expect(f(serie(2026, 1, 1, 0, 30), 'h:mm AM/PM')).toBe('12:30 AM');
  });
  it('i nomi di mesi e giorni seguono la lingua scelta', () => {
    impostaLinguaNomi('it');
    const d = serie(2026, 3, 5);
    expect(f(d, 'dddd d mmmm yyyy')).toBe('giovedì 5 marzo 2026');
    expect(f(d, 'ddd mmm')).toBe('gio mar');
  });
  it('una data fuori campo non si scrive', () => {
    expect(f(-5, 'dd/mm/yyyy')).toBeNull();
  });
});

afterEach(() => impostaLinguaNomi('en'));

describe('T473: TEXT nella cella', () => {
  const t = (formula: string) => { const wb = createWorkbook(); wb.setCell('Foglio1', 'A1', formula); const v = wb.getCell('Foglio1', 'A1').value; return v.kind === 'text' ? v.value : v.kind === 'error' ? v.error : String((v as { value?: unknown }).value); };
  it('i casi dell\'audit', () => {
    expect(t('=TEXT(5,"000")')).toBe('005');
    expect(t('=TEXT(DATE(2026,5,5),"dddd")')).toBe('Tuesday');
    expect(t('=TEXT(DATE(2026,3,3),"mmmm")')).toBe('March');
    expect(t('=TEXT(12345.678,"0.00E+00")')).toBe('1.23E+04');
    expect(t('=TEXT(-5,"0;(0)")')).toBe('(5)');
    expect(t('=TEXT(0.5,"h:mm")')).toBe('12:00');
    expect(t('=TEXT(5,"@")')).toBe('5');
    expect(t('=TEXT("abc","@")')).toBe('abc');
    expect(t('=TEXT("abc","0")')).toBe('abc');
    expect(t('=TEXT(1234.5,"#,##0.00")')).toBe('1,234.50');
    expect(t('=TEXT(0.256,"0.0%")')).toBe('25.6%');
    expect(t('=TEXT(DATE(2026,3,5),"dd/mm/yyyy")')).toBe('05/03/2026');
  });
});
