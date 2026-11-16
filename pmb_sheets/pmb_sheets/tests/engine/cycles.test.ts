// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

describe('Circular dependency detection module', () => {
  it('detects direct 2-node cycle (A1=B1, B1=A1) without breaking other cells', () => {
    const wb = createWorkbook();

    // Cella indipendente C1 e D1
    wb.setCell('Foglio1', 'C1', '10');
    wb.setCell('Foglio1', 'D1', '=C1 * 2'); // 20

    // Creazione del ciclo tra A1 e B1
    wb.setCell('Foglio1', 'A1', '=B1');
    wb.setCell('Foglio1', 'B1', '=A1');

    // A1 e B1 devono essere contrassegnate come #CIRCULAR!
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });

    // Le celle indipendenti C1 e D1 devono rimanere intatte
    expect(wb.getCell('Foglio1', 'C1').value).toEqual({ kind: 'number', value: 10 });
    expect(wb.getCell('Foglio1', 'D1').value).toEqual({ kind: 'number', value: 20 });
  });

  it('restores normal calculation when a cycle is broken', () => {
    const wb = createWorkbook();

    // Creazione ciclo A1 -> B1 -> A1
    wb.setCell('Foglio1', 'A1', '=B1');
    wb.setCell('Foglio1', 'B1', '=A1 + 1');

    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });

    // Rottura del ciclo: A1 diventa un valore costante numerico
    wb.setCell('Foglio1', 'A1', '50');

    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'number', value: 50 });
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 51 });
  });

  it('detects 3-node cycle (A1 -> B1 -> C1 -> A1)', () => {
    const wb = createWorkbook();

    wb.setCell('Foglio1', 'A1', '=B1');
    wb.setCell('Foglio1', 'B1', '=C1');
    wb.setCell('Foglio1', 'C1', '=A1');

    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });
    expect(wb.getCell('Foglio1', 'C1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });

    // Rottura impostando C1 = 100
    wb.setCell('Foglio1', 'C1', '100');
    expect(wb.getCell('Foglio1', 'C1').value).toEqual({ kind: 'number', value: 100 });
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 100 });
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'number', value: 100 });
  });

  it('detects self-referencing cycle (A1 = A1 + 1)', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=A1 + 1');
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });
  });

  it('negative test: acyclic linear graph is not marked circular', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '1');
    wb.setCell('Foglio1', 'A2', '=A1 + 1');
    wb.setCell('Foglio1', 'A3', '=A2 + 1');
    expect(wb.getCell('Foglio1', 'A3').value).toEqual({ kind: 'number', value: 3 });
  });
});
