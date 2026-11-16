import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

const valore = (w: ReturnType<typeof createWorkbook>, foglio: string, indirizzo: string) => w.getCell(foglio, indirizzo).value;

function conDati() {
  const w = createWorkbook();
  w.setCell('Foglio1', 'A1', '10');
  w.setCell('Foglio1', 'A2', '20');
  w.setCell('Foglio1', 'A3', '30');
  w.setCell('Foglio1', 'D1', '0.5');
  return w;
}

describe('intervalli denominati nel motore', () => {
  it('un nome vale il suo intervallo dentro una funzione', () => {
    const w = conDati();
    w.setNamedRanges([{ name: 'Fatturato', ref: 'Foglio1!A1:A3' }]);
    w.setCell('Foglio1', 'B1', '=SUM(Fatturato)');
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ kind: 'number', value: 60 });
  });

  it('maiuscole e minuscole non contano', () => {
    const w = conDati();
    w.setNamedRanges([{ name: 'Fatturato', ref: 'Foglio1!A1:A3' }]);
    w.setCell('Foglio1', 'B1', '=SUM(fatturato)');
    w.setCell('Foglio1', 'B2', '=SUM(FATTURATO)');
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ value: 60 });
    expect(valore(w, 'Foglio1', 'B2')).toMatchObject({ value: 60 });
  });

  it('un nome di una sola cella si usa come un numero', () => {
    const w = conDati();
    w.setNamedRanges([{ name: 'Tasso', ref: 'Foglio1!D1' }]);
    w.setCell('Foglio1', 'B1', '=A1*Tasso');
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ kind: 'number', value: 5 });
  });

  it('cambiando una cella dell\'intervallo la formula si aggiorna', () => {
    const w = conDati();
    w.setNamedRanges([{ name: 'Fatturato', ref: 'Foglio1!A1:A3' }]);
    w.setCell('Foglio1', 'B1', '=SUM(Fatturato)');
    w.setCell('Foglio1', 'A2', '100');
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ value: 140 });
  });

  it('un nome definito dopo la formula la sistema', () => {
    const w = conDati();
    w.setCell('Foglio1', 'B1', '=SUM(Fatturato)');
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ kind: 'error' });
    w.setNamedRanges([{ name: 'Fatturato', ref: 'Foglio1!A1:A3' }]);
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ kind: 'number', value: 60 });
  });

  it('un nome tolto rimette la formula in errore', () => {
    const w = conDati();
    w.setNamedRanges([{ name: 'Fatturato', ref: 'Foglio1!A1:A3' }]);
    w.setCell('Foglio1', 'B1', '=SUM(Fatturato)');
    w.setNamedRanges([]);
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ kind: 'error' });
  });

  it('il nome può puntare a un altro foglio, anche con spazi nel nome', () => {
    const w = conDati();
    w.addSheet('Dati 2');
    w.setCell('Dati 2', 'A1', '1');
    w.setCell('Dati 2', 'A2', '2');
    w.setNamedRanges([{ name: 'Piccoli', ref: "'Dati 2'!A1:A2" }]);
    w.setCell('Foglio1', 'B1', '=SUM(Piccoli)');
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ value: 3 });
  });

  it('i nomi sopravvivono al salvataggio e alla rilettura della cartella di lavoro', () => {
    const w = conDati();
    w.setNamedRanges([{ name: 'Fatturato', ref: 'Foglio1!A1:A3' }]);
    w.setCell('Foglio1', 'B1', '=SUM(Fatturato)');
    const salvato = w.serialize();
    const w2 = createWorkbook();
    w2.setNamedRanges([{ name: 'Fatturato', ref: 'Foglio1!A1:A3' }]);
    w2.deserialize(salvato);
    expect(valore(w2, 'Foglio1', 'B1')).toMatchObject({ value: 60 });
  });

  it('una funzione con lo stesso nome di un intervallo continua a funzionare come funzione', () => {
    const w = conDati();
    w.setNamedRanges([{ name: 'SUM', ref: 'Foglio1!D1' }]);
    w.setCell('Foglio1', 'B1', '=SUM(A1:A3)');
    expect(valore(w, 'Foglio1', 'B1')).toMatchObject({ value: 60 });
  });
});
