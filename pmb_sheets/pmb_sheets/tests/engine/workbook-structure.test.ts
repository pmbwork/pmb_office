import { describe, it, expect } from 'vitest';
import { createWorkbook, Workbook } from '../../src/engine/workbook';
import { InlineEngineClient } from '../../src/sheet/engine-client';

describe('Workbook & EngineClient: Integrazione Inserisci/Elimina Righe e Colonne (M1)', () => {
  it('inserisce una riga a riga 2: trasla celle e adatta formule', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '10');
    wb.setCell('Foglio1', 'A2', '20');
    wb.setCell('Foglio1', 'A3', '=A1+A2');

    expect(wb.getCell('Foglio1', 'A3').value).toEqual({ kind: 'number', value: 30 });

    // Inseriamo 1 riga a riga 2
    wb.insertRows('Foglio1', 2, 1);

    // Ora: A1=10, A2 è vuota, A3=20, A4 è la formula che prima era in A3
    expect(wb.getCell('Foglio1', 'A1').value).toEqual({ kind: 'number', value: 10 });
    expect(wb.getCell('Foglio1', 'A2').value).toEqual({ kind: 'empty' });
    expect(wb.getCell('Foglio1', 'A3').value).toEqual({ kind: 'number', value: 20 });

    // La formula in A4 deve fare riferimento a A1 (invariato) e A3 (ex A2) -> =A1+A3
    const cellA4 = wb.getCell('Foglio1', 'A4');
    expect(cellA4.raw).toBe('=A1+A3');
    expect(cellA4.value).toEqual({ kind: 'number', value: 30 });
  });

  it('elimina la riga referenziata: la formula diventa #REF!', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '10');
    wb.setCell('Foglio1', 'A2', '50');
    wb.setCell('Foglio1', 'A3', '=A1+A2');

    expect(wb.getCell('Foglio1', 'A3').value).toEqual({ kind: 'number', value: 60 });

    // Eliminiamo la riga 2 (A2)
    wb.deleteRows('Foglio1', 2, 1);

    // Ora la formula era in A3, ora è in A2: =A1+#REF!
    const cellA2 = wb.getCell('Foglio1', 'A2');
    expect(cellA2.raw).toBe('=A1+#REF!');
    expect(cellA2.value).toEqual({ kind: 'error', error: '#REF!' });
  });

  it('intervallo SUM su inserimento riga interna si espande e ricalcola il nuovo valore', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '1');
    wb.setCell('Foglio1', 'A2', '2');
    wb.setCell('Foglio1', 'A3', '3');
    wb.setCell('Foglio1', 'B1', '=SUM(A1:A3)');

    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 6 });

    // Inseriamo 1 riga a riga 2
    wb.insertRows('Foglio1', 2, 1);

    // B1 deve ora avere formula =SUM(A1:A4)
    expect(wb.getCell('Foglio1', 'B1').raw).toBe('=SUM(A1:A4)');

    // Scriviamo nella nuova riga inserita A2 il valore 100
    wb.setCell('Foglio1', 'A2', '100');

    // Il nuovo totale deve essere 1 + 100 + 2 + 3 = 106
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 106 });
  });

  it('inserimento ed eliminazione colonne tramite InlineEngineClient', async () => {
    const client = new InlineEngineClient();
    await client.setCell('Foglio1', 1, 1, '5'); // A1 = 5
    await client.setCell('Foglio1', 1, 2, '7'); // B1 = 7
    await client.setCell('Foglio1', 1, 3, '=A1+B1'); // C1 = A1+B1 = 12

    const c1Before = await client.getCell('Foglio1', 1, 3);
    expect(c1Before.value).toEqual({ kind: 'number', value: 12 });

    // Inseriamo 1 colonna a colonna 2 (colonna B)
    await client.insertCols('Foglio1', 2, 1);

    // Ora D1 (ex C1) contiene =A1+C1 (ex B1)
    const d1 = await client.getCell('Foglio1', 1, 4);
    expect(d1.raw).toBe('=A1+C1');
    expect(d1.value).toEqual({ kind: 'number', value: 12 });

    // Eliminiamo la colonna inserita B (colonna 2)
    await client.deleteCols('Foglio1', 2, 1);

    // C1 torna =A1+B1 con valore 12!
    const c1After = await client.getCell('Foglio1', 1, 3);
    expect(c1After.raw).toBe('=A1+B1');
    expect(c1After.value).toEqual({ kind: 'number', value: 12 });
  });

  it('formula in getCell() viene allineata a raw dopo insertRows/deleteRows/insertCols/deleteCols', async () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '10');
    wb.setCell('Foglio1', 'A2', '20');
    wb.setCell('Foglio1', 'A3', '=A1+A2');

    expect(wb.getCell('Foglio1', 'A3').formula).toBe('=A1+A2');

    // Inserisci riga a riga 2
    wb.insertRows('Foglio1', 2, 1);
    const cellA4 = wb.getCell('Foglio1', 'A4');
    expect(cellA4.raw).toBe('=A1+A3');
    // QUESTO DEVE ESSERE UGUALE A RAW:
    expect(cellA4.formula).toBe('=A1+A3');

    // Anche via EngineClient
    const client = new InlineEngineClient(wb);
    const clientCellA4 = await client.getCell('Foglio1', 4, 1);
    expect(clientCellA4.raw).toBe('=A1+A3');
    expect(clientCellA4.formula).toBe('=A1+A3');

    // Elimina riga inserita
    wb.deleteRows('Foglio1', 2, 1);
    const cellA3After = wb.getCell('Foglio1', 'A3');
    expect(cellA3After.raw).toBe('=A1+A2');
    expect(cellA3After.formula).toBe('=A1+A2');
  });
});
