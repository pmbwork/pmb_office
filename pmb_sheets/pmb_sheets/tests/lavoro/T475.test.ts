import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

describe('T475: funzioni volatili', () => {
  it('RAND si ricalcola quando si modifica un\'altra cella, e chi lo usa lo segue', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=RAND()');
    wb.setCell('Foglio1', 'B1', '=A1*2');
    wb.setCell('Foglio1', 'C1', '1');
    const prima = wb.getCell('Foglio1', 'A1').value as { value: number };
    const primaB = wb.getCell('Foglio1', 'B1').value as { value: number };
    wb.setCell('Foglio1', 'C1', '2'); // una cella che non c'entra
    const dopo = wb.getCell('Foglio1', 'A1').value as { value: number };
    const dopoB = wb.getCell('Foglio1', 'B1').value as { value: number };
    expect(dopo.value).not.toBe(prima.value);
    expect(dopoB.value).toBeCloseTo(dopo.value * 2, 12);
    expect(dopoB.value).not.toBe(primaB.value);
  });
  it('RANDBETWEEN e le formule normali: le normali non cambiano', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=RANDBETWEEN(1,1000000)');
    wb.setCell('Foglio1', 'B1', '=5*3');
    wb.setCell('Foglio1', 'C1', '1');
    const a1 = JSON.stringify(wb.getCell('Foglio1', 'A1').value);
    wb.setCell('Foglio1', 'C1', '2');
    expect(JSON.stringify(wb.getCell('Foglio1', 'A1').value)).not.toBe(a1);
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 15 });
  });
  it('se la formula volatile viene sostituita da un valore non si ricalcola più', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=RAND()');
    wb.setCell('Foglio1', 'A1', '7');
    wb.setCell('Foglio1', 'C1', '2');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'number', value: 7 });
  });
  it('OFFSET e INDIRECT seguono le modifiche anche di celle che non cita', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '5');
    wb.setCell('Foglio1', 'B1', '=INDIRECT("A"&C1)');
    wb.setCell('Foglio1', 'C1', '1');
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 5 });
    wb.setCell('Foglio1', 'A2', '9');
    wb.setCell('Foglio1', 'C1', '2');
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 9 });
  });
});
