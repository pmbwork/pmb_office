// @vitest-environment node
// Test di accettazione T003 (scritto da Claude, NON modificare). Attesi dalle definizioni delle unità.
import { describe, it, expect } from 'vitest';
import { createWorkbook, translateFormula } from '../../src/engine';

function valore(formula: string): string {
  const wb = createWorkbook();
  wb.addSheet('S');
  wb.setCell('S', 'Z1', formula);
  const v: any = wb.getCell('S', 'Z1').value;
  return v.kind === 'error' ? String(v.error) : String(v.value);
}
const num = (f: string) => Number(valore(f));

describe('T003: CONVERT', () => {
  it('temperatura', () => {
    expect(num('=CONVERT(100,"C","F")')).toBeCloseTo(212, 9);
    expect(num('=CONVERT(0,"C","K")')).toBeCloseTo(273.15, 9);
    expect(num('=CONVERT(212,"F","C")')).toBeCloseTo(100, 9);
    expect(num('=CONVERT(-40,"C","F")')).toBeCloseTo(-40, 9);
    expect(num('=CONVERT(300,"K","C")')).toBeCloseTo(26.85, 9);
    expect(num('=CONVERT(5,"C","C")')).toBeCloseTo(5, 9);
  });
  it('distanza, massa, tempo, volume', () => {
    expect(num('=CONVERT(1,"km","m")')).toBeCloseTo(1000, 9);
    expect(num('=CONVERT(1,"mi","km")')).toBeCloseTo(1.609344, 9);
    expect(num('=CONVERT(12,"in","ft")')).toBeCloseTo(1, 9);
    expect(num('=CONVERT(1,"kg","lbm")')).toBeCloseTo(2.2046226218, 8);
    expect(num('=CONVERT(2,"hr","mn")')).toBeCloseTo(120, 9);
    expect(num('=CONVERT(1,"yr","day")')).toBeCloseTo(365.25, 9);
    expect(num('=CONVERT(1,"gal","l")')).toBeCloseTo(3.785411784, 9);
  });
  it('pressione, energia, potenza, velocità', () => {
    expect(num('=CONVERT(1,"atm","Pa")')).toBeCloseTo(101325, 6);
    expect(num('=CONVERT(1,"kWh","J")')).toBeCloseTo(3600000, 6);
    expect(num('=CONVERT(1,"HP","W")')).toBeCloseTo(745.69987158227, 6);
    expect(num('=CONVERT(60,"mph","km/h")')).toBeCloseTo(96.56064, 6);
  });
  it('errori', () => {
    expect(valore('=CONVERT(1,"m","kg")')).toBe('#N/A');
    expect(valore('=CONVERT(1,"zz","m")')).toBe('#N/A');
    expect(valore('=CONVERT(1,"KM","m")')).toBe('#N/A');
    expect(valore('=CONVERT(1,"C","m")')).toBe('#N/A');
    expect(valore('=CONVERT("a","m","km")')).toBe('#VALUE!');
    expect(valore('=CONVERT(1,"m")')).toBe('#VALUE!');
  });
  it('nome italiano nei due versi', () => {
    expect(translateFormula('=CONVERT(1,"km","m")', 'en', 'it')).toBe('=CONVERTI(1;"km";"m")');
    expect(translateFormula('=CONVERTI(1;"km";"m")', 'it', 'en')).toBe('=CONVERT(1,"km","m")');
  });
});
