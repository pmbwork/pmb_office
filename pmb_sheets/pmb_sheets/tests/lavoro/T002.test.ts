// @vitest-environment node
// Test di accettazione T002 (scritto da Claude, NON modificare).
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

const D = { A1: 'a', A2: 'b', A3: 'a', A4: 'a', B1: '1', B2: '2', B3: '3', B4: '9' };

describe('T002: MAXIFS e MINIFS', () => {
  it('un criterio', () => {
    expect(valore(D, '=MAXIFS(B1:B4,A1:A4,"a")')).toBe('9');
    expect(valore(D, '=MINIFS(B1:B4,A1:A4,"a")')).toBe('1');
    expect(valore(D, '=MAXIFS(B1:B4,A1:A4,"b")')).toBe('2');
  });
  it('due criteri insieme', () => {
    expect(valore(D, '=MAXIFS(B1:B4,A1:A4,"a",B1:B4,"<9")')).toBe('3');
    expect(valore(D, '=MINIFS(B1:B4,A1:A4,"a",B1:B4,">1")')).toBe('3');
  });
  it('nessuna riga corrisponde: zero', () => {
    expect(valore(D, '=MAXIFS(B1:B4,A1:A4,"z")')).toBe('0');
    expect(valore(D, '=MINIFS(B1:B4,A1:A4,"z")')).toBe('0');
  });
  it('numeri negativi e testo ignorato nell\'intervallo dei valori', () => {
    const c = { A1: 'x', A2: 'x', A3: 'x', B1: '-5', B2: 'testo', B3: '-2' };
    expect(valore(c, '=MAXIFS(B1:B3,A1:A3,"x")')).toBe('-2');
    expect(valore(c, '=MINIFS(B1:B3,A1:A3,"x")')).toBe('-5');
  });
  it('errori: intervalli di dimensione diversa e argomenti pari', () => {
    expect(valore(D, '=MAXIFS(B1:B4,A1:A3,"a")')).toBe('#VALUE!');
    expect(valore(D, '=MAXIFS(B1:B4,A1:A4)')).toBe('#VALUE!');
    expect(valore(D, '=MINIFS(5,A1:A4,"a")')).toBe('#VALUE!');
  });
  it('nomi italiani nei due versi', () => {
    expect(translateFormula('=MAXIFS(B1:B4,A1:A4,"a")', 'en', 'it')).toBe('=MAX.PIÙ.SE(B1:B4;A1:A4;"a")');
    expect(translateFormula('=MIN.PIÙ.SE(B1:B4;A1:A4;"a")', 'it', 'en')).toBe('=MINIFS(B1:B4,A1:A4,"a")');
  });
});
