// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

describe('Values and Coercion module', () => {
  it('coerces numeric strings in arithmetic operations ("3"+1 = 4)', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '="3" + 1');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'number', value: 4 });

    wb.setCell('Foglio1', 'A2', '=" 42.5 " * 2');
    expect(wb.getCell('Foglio1', 'A2').value).toEqual({ kind: 'number', value: 85 });
  });

  it('fails with #VALUE! on non-numeric strings in arithmetic', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '="ciao" + 1');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'error', error: '#VALUE!' });
  });

  it('coerces empty cells to 0 in numbers and "" in text', () => {
    const wb = createWorkbook();
    // B1 è vuota
    wb.setCell('Foglio1', 'A1', '=B1 + 10');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'number', value: 10 });

    wb.setCell('Foglio1', 'A2', '=B1 & "test"');
    expect(wb.getCell('Foglio1', 'A2').value).toEqual({ kind: 'text', value: 'test' });
  });

  it('coerces booleans: TRUE=1, FALSE=0 in arithmetic', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=TRUE + 5');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'number', value: 6 });

    wb.setCell('Foglio1', 'A2', '=FALSE + 5');
    expect(wb.getCell('Foglio1', 'A2').value).toEqual({ kind: 'number', value: 5 });

    wb.setCell('Foglio1', 'A3', '=TRUE * FALSE');
    expect(wb.getCell('Foglio1', 'A3').value).toEqual({ kind: 'number', value: 0 });
  });

  it('compares with type order: Number < Text < Boolean', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=1000000 < "a"');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'boolean', value: true });

    wb.setCell('Foglio1', 'A2', '="zzz" < FALSE');
    expect(wb.getCell('Foglio1', 'A2').value).toEqual({ kind: 'boolean', value: true });

    wb.setCell('Foglio1', 'A3', '=1000 < TRUE');
    expect(wb.getCell('Foglio1', 'A3').value).toEqual({ kind: 'boolean', value: true });

    wb.setCell('Foglio1', 'A4', '="test" > 9999');
    expect(wb.getCell('Foglio1', 'A4').value).toEqual({ kind: 'boolean', value: true });
  });

  it('compares text case-insensitively', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '="abc" = "ABC"');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'boolean', value: true });

    wb.setCell('Foglio1', 'A2', '="Mondo" <> "mondo"');
    expect(wb.getCell('Foglio1', 'A2').value).toEqual({ kind: 'boolean', value: false });
  });

  it('compares empty cell with 0 and empty string', () => {
    const wb = createWorkbook();
    // B1 è vuota
    wb.setCell('Foglio1', 'A1', '=B1 = 0');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'boolean', value: true });

    wb.setCell('Foglio1', 'A2', '=B1 = ""');
    expect(wb.getCell('Foglio1', 'A2').value).toEqual({ kind: 'boolean', value: true });
  });

  it('propagates errors through operations', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=10 / 0'); // #DIV/0!
    wb.setCell('Foglio1', 'A2', '=A1 + 5');
    expect(wb.getCell('Foglio1', 'A2').value).toEqual({ kind: 'error', error: '#DIV/0!' });

    wb.setCell('Foglio1', 'A3', '=A1 & "text"');
    expect(wb.getCell('Foglio1', 'A3').value).toEqual({ kind: 'error', error: '#DIV/0!' });
  });

  it('un intervallo in un calcolo si applica elemento per elemento e si espande (matrici dinamiche)', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '1');
    wb.setCell('Foglio1', 'A2', '2');
    wb.setCell('Foglio1', 'A3', '3');
    wb.setCell('Foglio1', 'B1', '=A1:A3 + 1');
    expect([2, 3, 4].map((_, i) => wb.getCell('Foglio1', `B${i + 1}`).value)).toEqual([
      { kind: 'number', value: 2 }, { kind: 'number', value: 3 }, { kind: 'number', value: 4 },
    ]);

    wb.setCell('Foglio1', 'D1', '=-A1:A3');
    expect([1, 2, 3].map((i) => wb.getCell('Foglio1', `D${i}`).value)).toEqual([
      { kind: 'number', value: -1 }, { kind: 'number', value: -2 }, { kind: 'number', value: -3 },
    ]);
  });

  it('negative test: negative test demonstrating comparison failure', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=10 > 20');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'boolean', value: false });
  });
});
