// T561: strumenti di pmb_sheets (1): ricerca obiettivo (sheet/ricerca-obiettivo.ts) confrontata con Range.GoalSeek di Excel
// (LAVORO/studio-microsoft-office/excel_obiettivo.py, 2026-11-20), sul motore di calcolo vero.
import { describe, expect, test } from 'vitest';
import { ricercaObiettivo } from '../../src/sheet/ricerca-obiettivo';
import { InlineEngineClient } from '../../src/sheet/engine-client';

// formula in B1 che dipende da A1, valore da raggiungere, partenza, A1 trovato da Excel
const EXCEL: Array<[string, number, number, number]> = [
  ['=A1^3-2*A1', 5, 1, 2.094548592299497],
  ['=A1*A1', 2, 1, 1.4142112625265164],
  ['=1000*(1+A1)^10', 2000, 0.01, 0.07177346328832605],
  ['=SQRT(A1)+A1', 10, 0, 7.2982470937992865],
];

describe('T561: ricerca obiettivo', () => {
  test.each(EXCEL)('%s = %d partendo da %d: come Excel', async (formula, obiettivo, partenza, excel) => {
    const c = new InlineEngineClient();
    const foglio = (await c.listSheets())[0];
    await c.setCell(foglio, 1, 1, String(partenza));
    await c.setCell(foglio, 1, 2, formula);
    const e = await ricercaObiettivo(async (x) => {
      await c.setCell(foglio, 1, 1, String(x));
      const v = (await c.getCell(foglio, 1, 2)).value;
      return v.kind === 'number' ? v.value : null;
    }, obiettivo, partenza);
    expect(e.trovato).toBe(true);
    expect(Math.abs((e.valore as number) - obiettivo)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(e.x - excel)).toBeLessThan(0.001 * Math.max(1, Math.abs(excel)));
  });
  test('senza soluzione (x² = -1) non trova e lo dice; con errori nella formula salta i punti senza valore', async () => {
    const e = await ricercaObiettivo(async (x) => x * x, -1, 3);
    expect(e.trovato).toBe(false);
    const r = await ricercaObiettivo(async (x) => (x < 0 ? null : Math.sqrt(x)), 3, -5);
    expect(r.trovato).toBe(true);
    expect(Math.abs(r.x - 9)).toBeLessThan(0.01);
  });
});

describe('T561: precedenti e dipendenti', () => {
  test('i riferimenti di una formula: celle, intervalli, altri fogli, righe e colonne intere; un testo non conta', async () => {
    const { riferimentiFormula } = await import('../../src/sheet/precedenti');
    expect(riferimentiFormula('=SUM(A1:B3)+$C$2*Dati!D4+"E5"', 'F')).toEqual([
      { foglio: 'F', r1: 1, c1: 1, r2: 3, c2: 2 }, { foglio: 'F', r1: 2, c1: 3, r2: 2, c2: 3 }, { foglio: 'Dati', r1: 4, c1: 4, r2: 4, c2: 4 }]);
    const colonna = riferimentiFormula('=SUM(B:B)', 'F')[0];
    expect([colonna.c1, colonna.c2, colonna.r1, colonna.r2 > 1000000]).toEqual([2, 2, 1, true]);
    expect(riferimentiFormula('12', 'F')).toEqual([]);
  });
  test('i dipendenti dal JSON del motore vero', async () => {
    const { dipendenti, formuleDellaCartella } = await import('../../src/sheet/precedenti');
    const c = new InlineEngineClient();
    const f = (await c.listSheets())[0];
    await c.setCell(f, 1, 1, '5');
    await c.setCell(f, 1, 2, '=A1*2');
    await c.setCell(f, 2, 2, '=SUM(A1:A9)');
    await c.setCell(f, 3, 2, '=C9');
    const d = dipendenti(formuleDellaCartella(String(await c.serialize())), f, 1, 1);
    expect(d.map((x) => [x.riga, x.colonna]).sort()).toEqual([[1, 2], [2, 2]]);
  });
});

describe('T561: subtotali come Excel', () => {
  test('il piano dà le stesse righe e formule di Range.Subtotal di Excel (excel_subtotali.py)', async () => {
    const { pianoSubtotali } = await import('../../src/sheet/subtotali');
    const p = pianoSubtotali(['Nord', 'Nord', 'Sud', 'Sud', 'Sud', 'Est'], 2, 1, [3], 9, (v) => `${v} Totale`, 'Totale complessivo');
    expect(p.inserisci).toEqual([4, 8, 10, 11]);
    // le celle come le lascia Excel (righe 4, 8, 10, 11)
    expect(p.celle).toEqual([
      { riga: 4, colonna: 1, raw: 'Nord Totale' }, { riga: 4, colonna: 3, raw: '=SUBTOTAL(9,C2:C3)' },
      { riga: 8, colonna: 1, raw: 'Sud Totale' }, { riga: 8, colonna: 3, raw: '=SUBTOTAL(9,C5:C7)' },
      { riga: 10, colonna: 1, raw: 'Est Totale' }, { riga: 10, colonna: 3, raw: '=SUBTOTAL(9,C9:C9)' },
      { riga: 11, colonna: 1, raw: 'Totale complessivo' }, { riga: 11, colonna: 3, raw: '=SUBTOTAL(9,C2:C9)' },
    ]);
  });
  test('sul motore vero: inserite le righe, i totali tornano', async () => {
    const { pianoSubtotali } = await import('../../src/sheet/subtotali');
    const c = new InlineEngineClient();
    const f = (await c.listSheets())[0];
    const dati = [['Zona', 'Importo'], ['Nord', '10'], ['Nord', '20'], ['Sud', '5'], ['Sud', '7']];
    for (let r = 0; r < dati.length; r++) for (let k = 0; k < 2; k++) await c.setCell(f, r + 1, k + 1, dati[r][k]);
    const p = pianoSubtotali(['Nord', 'Nord', 'Sud', 'Sud'], 2, 1, [2], 9, (v) => `${v} Totale`, 'Totale complessivo');
    for (const r of p.inserisci) await c.insertRows(f, r, 1);
    for (const x of p.celle) await c.setCell(f, x.riga, x.colonna, x.raw);
    const v = async (r: number) => (await c.getCell(f, r, 2)).value;
    expect([await v(4), await v(7), await v(8)].map((x) => (x.kind === 'number' ? x.value : null))).toEqual([30, 12, 42]);
  });
});
