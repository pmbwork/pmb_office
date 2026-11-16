import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { translateFormula } from '../../src/engine/i18n';
import { numberVal, errorVal } from '../../src/engine/values';

describe('T333 — T335: ARRAYFORMULA e Spill degli Operatori Aritmetici (Lotto S2)', () => {
  it('ARRAYFORMULA è registrata e supporta la traduzione bidirezionale IT <-> EN', () => {
    expect(translateFormula('=ARRAYFORMULA(A1:A3*2)', 'en', 'it')).toBe('=FORMULA.MATRICIALE(A1:A3*2)');
    expect(translateFormula('=FORMULA.MATRICIALE(A1:A3*2)', 'it', 'en')).toBe('=ARRAYFORMULA(A1:A3*2)');
  });

  it('un operatore aritmetico su intervallo si espande anche senza ARRAYFORMULA (matrici dinamiche)', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '10');
    wb.setCell('Foglio1', 'A2', '20');
    wb.setCell('Foglio1', 'A3', '30');

    wb.setCell('Foglio1', 'C1', '=A1:A3*2');
    expect([1, 2, 3].map((i) => wb.getCell('Foglio1', `C${i}`).value)).toEqual([
      { kind: 'number', value: 20 }, { kind: 'number', value: 40 }, { kind: 'number', value: 60 },
    ]);
    expect(errorVal('#VALUE!').kind).toBe('error');
  });

  it('ARRAYFORMULA con moltiplicazione scalare effettua lo spill automatico (=ARRAYFORMULA(A1:A3*2))', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '10');
    wb.setCell('Foglio1', 'A2', '20');
    wb.setCell('Foglio1', 'A3', '30');

    wb.setCell('Foglio1', 'C1', '=ARRAYFORMULA(A1:A3*2)');

    // C1 è la cella master dello spill
    expect(wb.getCell('Foglio1', 'C1').value).toEqual(numberVal(20));
    // C2 e C3 ricevono lo spill
    expect(wb.getCell('Foglio1', 'C2').value).toEqual(numberVal(40));
    expect(wb.getCell('Foglio1', 'C3').value).toEqual(numberVal(60));
  });

  it('ARRAYFORMULA con operazioni elemento per elemento tra due intervalli (=ARRAYFORMULA(A1:A2+B1:B2))', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '5');
    wb.setCell('Foglio1', 'A2', '15');
    wb.setCell('Foglio1', 'B1', '2');
    wb.setCell('Foglio1', 'B2', '4');

    wb.setCell('Foglio1', 'D1', '=ARRAYFORMULA(A1:A2+B1:B2)');

    expect(wb.getCell('Foglio1', 'D1').value).toEqual(numberVal(7));
    expect(wb.getCell('Foglio1', 'D2').value).toEqual(numberVal(19));
  });

  it('FORMULA.MATRICIALE in italiano supporta operatore unario con spill (=FORMULA.MATRICIALE(-A1:A2))', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '8');
    wb.setCell('Foglio1', 'A2', '12');

    wb.setCell('Foglio1', 'B1', '=ARRAYFORMULA(-A1:A2)');

    expect(wb.getCell('Foglio1', 'B1').value).toEqual(numberVal(-8));
    expect(wb.getCell('Foglio1', 'B2').value).toEqual(numberVal(-12));
  });
});
