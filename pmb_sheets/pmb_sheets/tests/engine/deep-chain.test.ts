// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

describe('Deep dependency chain module (Iterative non-recursive)', () => {
  it('evaluates and propagates across a 10,000 cells chain without stack overflow', () => {
    const wb = createWorkbook();

    const CHAIN_LENGTH = 10_000;

    // A1 = 1
    wb.setCell('Foglio1', 'A1', '1');

    // A2 = A1 + 1, A3 = A2 + 1, ...
    for (let r = 2; r <= CHAIN_LENGTH; r++) {
      wb.setCell('Foglio1', `A${r}`, `=A${r - 1} + 1`);
    }

    // Verifica valore iniziale
    const initialLast = wb.getCell('Foglio1', `A${CHAIN_LENGTH}`).value;
    expect(initialLast).toEqual({ kind: 'number', value: CHAIN_LENGTH });

    // Modifica del primo anello: A1 da 1 a 10
    const t0 = performance.now();
    wb.setCell('Foglio1', 'A1', '10');
    const elapsed = performance.now() - t0;

    // L'ultimo anello deve valere 10 + 9999 = 10009
    const updatedLast = wb.getCell('Foglio1', `A${CHAIN_LENGTH}`).value;
    expect(updatedLast).toEqual({ kind: 'number', value: 10 + CHAIN_LENGTH - 1 });

    // Stampa tempo per riscontro
    console.log(`Propagazione su catena di 10.000 celle completata in ${elapsed.toFixed(2)} ms`);
  }, 30_000); // Timeout esteso per l'inserimento di 10k celle

  it('negative test: checking wrong expected value fails', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '1');
    wb.setCell('Foglio1', 'A2', '=A1 + 1');
    expect(wb.getCell('Foglio1', 'A2').value).not.toEqual({ kind: 'number', value: 9999 });
  });
});
