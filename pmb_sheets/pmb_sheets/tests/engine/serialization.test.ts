// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

describe('Workbook Serialization and Deserialization module', () => {
  it('round-trip serialize and deserialize reproduces identical workbook state', () => {
    const wb1 = createWorkbook();
    wb1.addSheet('Dati');

    wb1.setCell('Foglio1', 'A1', '10');
    wb1.setCell('Foglio1', 'A2', '20');
    wb1.setCell('Foglio1', 'A3', '=SUM(A1:A2)');
    wb1.setCell('Foglio1', 'B1', "'Testo con apice");
    wb1.setCell('Foglio1', 'B2', 'TRUE');

    wb1.setCell('Dati', 'A1', '100');
    wb1.setCell('Dati', 'B1', '=Foglio1!A3 + Dati!A1');

    const json = wb1.serialize();
    expect(typeof json).toBe('string');
    expect(json).toContain('"version": 1');

    // Deserializza in una nuova istanza
    const wb2 = createWorkbook();
    wb2.deserialize(json);

    expect(wb2.listSheets()).toEqual(['Foglio1', 'Dati']);
    expect(wb2.getCell('Foglio1', 'A3').value).toEqual({ kind: 'number', value: 30 });
    expect(wb2.getCell('Foglio1', 'B1').value).toEqual({ kind: 'text', value: 'Testo con apice' });
    expect(wb2.getCell('Foglio1', 'B2').value).toEqual({ kind: 'boolean', value: true });
    expect(wb2.getCell('Dati', 'B1').value).toEqual({ kind: 'number', value: 130 });

    // Modifica in wb2 per verificare che il grafo sia pienamente funzionante
    wb2.setCell('Foglio1', 'A1', '50');
    expect(wb2.getCell('Foglio1', 'A3').value).toEqual({ kind: 'number', value: 70 });
    expect(wb2.getCell('Dati', 'B1').value).toEqual({ kind: 'number', value: 170 });
  });

  it('negative test: invalid JSON format throws error during deserialize', () => {
    const wb = createWorkbook();
    expect(() => {
      wb.deserialize('{ "version": 999 }');
    }).toThrow();

    expect(() => {
      wb.deserialize('stringa non json');
    }).toThrow();
  });
});
