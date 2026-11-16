// @vitest-environment node
// Test di accettazione T001 (scritto da Claude, NON modificare). Attesi calcolati a mano dalle definizioni statistiche.
import { describe, it, expect } from 'vitest';
import { createWorkbook, translateFormula } from '../../src/engine';

function valore(celle: Record<string, string>, formula: string): string {
  const wb = createWorkbook();
  wb.addSheet('S');
  for (const [k, v] of Object.entries(celle)) wb.setCell('S', k, v);
  wb.setCell('S', 'Z1', formula);
  const v: any = wb.getCell('S', 'Z1').value;
  return v.kind === 'error' ? String(v.error) : String(v.value);
}

const XY = { A1: '1', A2: '2', A3: '3', B1: '3', B2: '5', B3: '7' };
const RIDOTTI = { A1: '1', A2: '2', A3: '3', A4: '4', A5: '5', B1: '2', B2: '4', B3: '5', B4: '4', B5: '5' };

describe('T001: SLOPE, INTERCEPT, FORECAST, RSQ', () => {
  it('retta esatta y = 2x + 1', () => {
    expect(Number(valore(XY, '=SLOPE(B1:B3,A1:A3)'))).toBeCloseTo(2, 9);
    expect(Number(valore(XY, '=INTERCEPT(B1:B3,A1:A3)'))).toBeCloseTo(1, 9);
    expect(Number(valore(XY, '=FORECAST(5,B1:B3,A1:A3)'))).toBeCloseTo(11, 9);
    expect(Number(valore(XY, '=RSQ(B1:B3,A1:A3)'))).toBeCloseTo(1, 9);
  });
  it('dati con rumore: pendenza 0,6, intercetta 2,2, previsione 5,8, R quadro 0,6', () => {
    expect(Number(valore(RIDOTTI, '=SLOPE(B1:B5,A1:A5)'))).toBeCloseTo(0.6, 9);
    expect(Number(valore(RIDOTTI, '=INTERCEPT(B1:B5,A1:A5)'))).toBeCloseTo(2.2, 9);
    expect(Number(valore(RIDOTTI, '=FORECAST(6,B1:B5,A1:A5)'))).toBeCloseTo(5.8, 9);
    expect(Number(valore(RIDOTTI, '=RSQ(B1:B5,A1:A5)'))).toBeCloseTo(0.6, 9);
  });
  it('errori: lunghezze diverse, x costanti, numero di argomenti', () => {
    expect(valore({ A1: '1', A2: '2', B1: '1', B2: '2', B3: '3' }, '=SLOPE(B1:B3,A1:A2)')).toBe('#N/A');
    expect(valore({ A1: '2', A2: '2', B1: '1', B2: '5' }, '=SLOPE(B1:B2,A1:A2)')).toBe('#DIV/0!');
    expect(valore({ A1: '2', A2: '2', B1: '1', B2: '5' }, '=INTERCEPT(B1:B2,A1:A2)')).toBe('#DIV/0!');
    expect(valore({}, '=SLOPE(1)')).toBe('#VALUE!');
    expect(valore(XY, '=FORECAST("x",B1:B3,A1:A3)')).toBe('#VALUE!');
  });
  it('nomi italiani nei due versi', () => {
    expect(translateFormula('=SLOPE(B1:B3,A1:A3)', 'en', 'it')).toBe('=PENDENZA(B1:B3;A1:A3)');
    expect(translateFormula('=PENDENZA(B1:B3;A1:A3)', 'it', 'en')).toBe('=SLOPE(B1:B3,A1:A3)');
    expect(translateFormula('=INTERCEPT(B1:B3,A1:A3)', 'en', 'it')).toBe('=INTERCETTA(B1:B3;A1:A3)');
    expect(translateFormula('=PREVISIONE(5;B1:B3;A1:A3)', 'it', 'en')).toBe('=FORECAST(5,B1:B3,A1:A3)');
    expect(translateFormula('=RQ(B1:B3;A1:A3)', 'it', 'en')).toBe('=RSQ(B1:B3,A1:A3)');
  });
});
