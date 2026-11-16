import { describe, it, expect } from 'vitest';
import { createWorkbook, type Workbook } from '../../src/engine/workbook';
import { translateFormula } from '../../src/engine/i18n';

const num = (w: Workbook, a: string, foglio = 'Foglio1'): unknown => {
  const v = w.getCell(foglio, a).value as { kind: string; value?: unknown; error?: string };
  return v.kind === 'error' ? v.error : v.value;
};

/** Dati in A1:A6 = 1, 2, 3, 4, 5, 6 e le formule da provare in C1... */
function libro(formule: string[] = []): Workbook {
  const w = createWorkbook();
  for (let i = 1; i <= 6; i++) w.setCell('Foglio1', `A${i}`, String(i));
  formule.forEach((f, i) => w.setCell('Foglio1', `C${i + 1}`, f));
  return w;
}

describe('T511: SUBTOTAL e AGGREGATE ignorano le righe nascoste', () => {
  it('senza righe nascoste tutto vale come prima', () => {
    const w = libro(['=SUBTOTAL(9,A1:A6)', '=SUBTOTAL(109,A1:A6)', '=SUBTOTAL(2,A1:A6)', '=AGGREGATE(9,5,A1:A6)']);
    expect([num(w, 'C1'), num(w, 'C2'), num(w, 'C3'), num(w, 'C4')]).toEqual([21, 21, 6, 21]);
  });

  it('righe nascoste a mano: 109 le salta, 9 le conta (come in Excel)', () => {
    const w = libro(['=SUBTOTAL(9,A1:A6)', '=SUBTOTAL(109,A1:A6)', '=SUBTOTAL(103,A1:A6)', '=SUBTOTAL(3,A1:A6)']);
    w.setHiddenRows('Foglio1', [2, 4], []);
    expect([num(w, 'C1'), num(w, 'C2'), num(w, 'C3'), num(w, 'C4')]).toEqual([21, 21 - 2 - 4, 4, 6]);
  });

  it('righe nascoste da un filtro: le saltano sia 9 sia 109', () => {
    const w = libro(['=SUBTOTAL(9,A1:A6)', '=SUBTOTAL(109,A1:A6)', '=SUBTOTAL(1,A1:A6)', '=SUBTOTAL(104,A1:A6)']);
    w.setHiddenRows('Foglio1', [], [1, 2, 3]);
    expect([num(w, 'C1'), num(w, 'C2'), num(w, 'C3'), num(w, 'C4')]).toEqual([15, 15, 5, 6]);
  });

  it('a mano e da filtro insieme', () => {
    const w = libro(['=SUBTOTAL(9,A1:A6)', '=SUBTOTAL(109,A1:A6)']);
    w.setHiddenRows('Foglio1', [6], [1]);
    expect([num(w, 'C1'), num(w, 'C2')]).toEqual([20, 14]);
  });

  it('il risultato si aggiorna quando le righe tornano visibili, senza toccare le celle', () => {
    const w = libro(['=SUBTOTAL(109,A1:A6)']);
    w.setHiddenRows('Foglio1', [1, 2, 3], []);
    expect(num(w, 'C1')).toBe(15);
    w.setHiddenRows('Foglio1', [], []);
    expect(num(w, 'C1')).toBe(21);
  });

  it('chi dipende dal subtotale si aggiorna a catena', () => {
    const w = libro(['=SUBTOTAL(109,A1:A6)', '=C1*10', '=C2+1']);
    w.setHiddenRows('Foglio1', [6], []);
    expect([num(w, 'C1'), num(w, 'C2'), num(w, 'C3')]).toEqual([15, 150, 151]);
  });

  it('setHiddenRows dice quali celle sono cambiate e non fa niente se lo stato è uguale', () => {
    const w = libro(['=SUBTOTAL(109,A1:A6)', '=SUM(A1:A6)']);
    const cambiate = w.setHiddenRows('Foglio1', [1], []);
    expect(cambiate.some((k) => k.includes('1:3') || /C.*1$/.test(k) || k.length > 0)).toBe(true);
    expect(w.setHiddenRows('Foglio1', [1], [])).toEqual([]);
    expect(num(w, 'C2')).toBe(21);   // SOMMA normale: non guarda le righe nascoste
  });

  it('le funzioni normali non cambiano con le righe nascoste', () => {
    const w = libro(['=SUM(A1:A6)', '=COUNT(A1:A6)', '=MAX(A1:A6)']);
    w.setHiddenRows('Foglio1', [6], [1, 2]);
    expect([num(w, 'C1'), num(w, 'C2'), num(w, 'C3')]).toEqual([21, 6, 6]);
  });

  it('i SUBTOTAL annidati non si contano due volte', () => {
    const w = createWorkbook();
    ['10', '20', '=SUBTOTAL(9,A1:A2)', '5', '=SUBTOTAL(9,A1:A4)'].forEach((v, i) => w.setCell('Foglio1', `A${i + 1}`, v));
    w.setCell('Foglio1', 'C1', '=SUBTOTAL(9,A1:A5)');
    w.setCell('Foglio1', 'C2', '=SUM(A1:A5)');
    expect(num(w, 'A3')).toBe(30);
    expect(num(w, 'A5')).toBe(35);   // 10 + 20 + 5: il subtotale A3 dentro A1:A4 non si somma
    expect(num(w, 'C1')).toBe(35);   // 10 + 20 + 5
    expect(num(w, 'C2')).toBe(100);  // SOMMA normale conta tutto
  });

  it('i subtotali annidati restano esclusi anche se la riga è nascosta o no', () => {
    const w = createWorkbook();
    ['1', '2', '=SUBTOTAL(9,A1:A2)', '4'].forEach((v, i) => w.setCell('Foglio1', `A${i + 1}`, v));
    w.setCell('Foglio1', 'C1', '=SUBTOTAL(109,A1:A4)');
    expect(num(w, 'C1')).toBe(7);
    w.setHiddenRows('Foglio1', [1], []);
    expect(num(w, 'C1')).toBe(6);
  });

  it('SUBTOTAL su più intervalli e su testo e vuoti', () => {
    const w = createWorkbook();
    ['1', 'x', '3', '', '5'].forEach((v, i) => { if (v !== '') w.setCell('Foglio1', `A${i + 1}`, v); });
    ['10', '20'].forEach((v, i) => w.setCell('Foglio1', `B${i + 1}`, v));
    w.setCell('Foglio1', 'C1', '=SUBTOTAL(109,A1:A5,B1:B2)');
    w.setCell('Foglio1', 'C2', '=SUBTOTAL(103,A1:A5)');
    w.setCell('Foglio1', 'C3', '=SUBTOTAL(102,A1:A5)');
    w.setHiddenRows('Foglio1', [1, 2], []);
    // le righe 1 e 2 sono nascoste anche per la colonna B: restano A3 (3), A5 (5) e nessuna di B
    expect([num(w, 'C1'), num(w, 'C2'), num(w, 'C3')]).toEqual([3 + 5, 2, 2]);
  });

  it('i codici fuori campo danno #VALUE!', () => {
    const w = libro(['=SUBTOTAL(12,A1:A6)', '=SUBTOTAL(0,A1:A6)', '=SUBTOTAL(112,A1:A6)']);
    expect([num(w, 'C1'), num(w, 'C2'), num(w, 'C3')]).toEqual(['#VALUE!', '#VALUE!', '#VALUE!']);
  });

  it('ogni foglio ha le sue righe nascoste', () => {
    const w = libro(['=SUBTOTAL(109,A1:A6)']);
    w.addSheet('Altro');
    for (let i = 1; i <= 3; i++) w.setCell('Altro', `A${i}`, String(i * 100));
    w.setCell('Altro', 'C1', '=SUBTOTAL(109,A1:A3)');
    w.setHiddenRows('Foglio1', [1], []);
    expect(num(w, 'C1')).toBe(20);
    expect(num(w, 'C1', 'Altro')).toBe(600);
    w.setHiddenRows('Altro', [], [2]);
    expect(num(w, 'C1', 'Altro')).toBe(400);
    expect(num(w, 'C1')).toBe(20);
  });

  it('una formula che cita un altro foglio guarda le righe nascoste di quel foglio', () => {
    const w = libro();
    w.addSheet('Altro');
    w.setCell('Altro', 'C1', '=SUBTOTAL(109,Foglio1!A1:A6)');
    w.setHiddenRows('Foglio1', [3], []);
    expect(num(w, 'C1', 'Altro')).toBe(18);
  });

  it('AGGREGATE: le opzioni 1, 3, 5 e 7 saltano le righe nascoste, 4 e 6 no', () => {
    const w = libro(['=AGGREGATE(9,5,A1:A6)', '=AGGREGATE(9,4,A1:A6)', '=AGGREGATE(9,6,A1:A6)', '=AGGREGATE(9,1,A1:A6)', '=AGGREGATE(9,7,A1:A6)', '=AGGREGATE(4,5,A1:A6)']);
    w.setHiddenRows('Foglio1', [6], [5]);
    expect([num(w, 'C1'), num(w, 'C2'), num(w, 'C3'), num(w, 'C4'), num(w, 'C5'), num(w, 'C6')]).toEqual([10, 21, 21, 10, 10, 4]);
  });

  it('AGGREGATE: le opzioni 0-3 ignorano i subtotali annidati, 4-7 no', () => {
    const w = createWorkbook();
    ['1', '2', '=SUBTOTAL(9,A1:A2)'].forEach((v, i) => w.setCell('Foglio1', `A${i + 1}`, v));
    w.setCell('Foglio1', 'C1', '=AGGREGATE(9,0,A1:A3)');
    w.setCell('Foglio1', 'C2', '=AGGREGATE(9,4,A1:A3)');
    expect([num(w, 'C1'), num(w, 'C2')]).toEqual([3, 6]);
  });

  it('i nomi italiani (SUBTOTALE, AGGREGA) funzionano come in inglese', () => {
    const w = libro();
    w.setCell('Foglio1', 'C1', translateFormula('=SUBTOTALE(109;A1:A6)', 'it', 'en'));
    w.setCell('Foglio1', 'C2', translateFormula('=AGGREGA(9;5;A1:A6)', 'it', 'en'));
    w.setHiddenRows('Foglio1', [1, 2], []);
    expect([num(w, 'C1'), num(w, 'C2')]).toEqual([18, 18]);
  });

  it('una formula riscritta dopo aver nascosto le righe usa subito lo stato nascosto', () => {
    const w = libro();
    w.setHiddenRows('Foglio1', [1, 2, 3], []);
    w.setCell('Foglio1', 'C1', '=SUBTOTAL(109,A1:A6)');
    expect(num(w, 'C1')).toBe(15);
    w.setCell('Foglio1', 'C1', '=SUM(A1:A6)');   // non più sensibile al nascosto
    w.setHiddenRows('Foglio1', [], []);
    expect(num(w, 'C1')).toBe(21);
  });

  it('serializzare e riaprire il libro non rompe il ricalcolo', () => {
    const w = libro(['=SUBTOTAL(109,A1:A6)']);
    const copia = createWorkbook();
    copia.deserialize(w.serialize());
    copia.setHiddenRows('Foglio1', [1], []);
    expect(num(copia, 'C1')).toBe(20);
  });
});
