import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { translateFormula } from '../../src/engine/i18n';
import { betaIncompleta, tDensita, tInversa, tRipartizione } from '../../src/engine/functions/student';

// valori di riferimento calcolati con scipy 1.17 (scipy.stats.t, ttest_rel, ttest_ind)
const A = [3.2, 4.1, 5.0, 6.3, 7.7, 5.5, 4.9, 6.1];
const B = [2.9, 3.8, 5.5, 5.1, 6.9, 4.2, 4.4, 5.8];
const C = [10.5, 12.1, 9.8, 11.4, 13.0];

const vicino = (x: number, atteso: number, rel = 1e-9) => expect(Math.abs(x - atteso)).toBeLessThanOrEqual(Math.max(Math.abs(atteso) * rel, 1e-14));

function calcola(formula: string, dati: Record<string, number[]> = {}): { kind: string; value?: unknown; error?: string } {
  const w = createWorkbook();
  for (const [col, valori] of Object.entries(dati)) valori.forEach((v, i) => w.setCell('Foglio1', `${col}${i + 1}`, String(v)));
  w.setCell('Foglio1', 'Z1', formula);
  return w.getCell('Foglio1', 'Z1').value as { kind: string; value?: unknown; error?: string };
}
const numero = (formula: string, dati?: Record<string, number[]>): number => {
  const r = calcola(formula, dati);
  if (r.kind !== 'number') throw new Error(`${formula} → ${JSON.stringify(r)}`);
  return r.value as number;
};

describe('T504: matematica della distribuzione t', () => {
  it('la beta incompleta regolarizzata ha i valori noti', () => {
    expect(betaIncompleta(0, 2, 3)).toBe(0);
    expect(betaIncompleta(1, 2, 3)).toBe(1);
    vicino(betaIncompleta(0.5, 1, 1), 0.5);          // uniforme
    vicino(betaIncompleta(0.25, 2, 2), 0.15625);      // 3x²−2x³ con x = 0,25
  });
  it('ripartizione, densità e inversa coincidono con scipy', () => {
    const cdf: Array<[number, number, number]> = [[1.5, 10, 0.9177463367772799], [-1.5, 10, 0.08225366322272007], [0, 5, 0.5], [2.228139, 10, 0.9750000062735588], [3.5, 3, 0.9802594811903587], [-0.25, 1, 0.42202086962263063], [0.5, 2, 0.6666666666666666]];
    for (const [t, g, atteso] of cdf) vicino(tRipartizione(t, g), atteso);
    for (const [t, g, atteso] of [[1.5, 10, 0.12744479428709166], [0, 5, 0.3796066898224944], [-2, 3, 0.06750966066389291], [0.3, 1, 0.29202741851723923]] as Array<[number, number, number]>) vicino(tDensita(t, g), atteso);
    for (const [p, g, atteso] of [[0.975, 10, 2.2281388519862744], [0.025, 10, -2.2281388519862753], [0.9, 5, 1.4758840488244815], [0.999, 2, 22.327124770119866], [0.6, 1, 0.32491969623290634], [0.01, 40, -2.4232567793348583]] as Array<[number, number, number]>) vicino(tInversa(p, g), atteso, 1e-9);
    expect(tInversa(0.5, 3)).toBe(0);
  });
  it('l\'inversa e la ripartizione si annullano a vicenda', () => {
    for (const g of [1, 2, 5, 17, 100]) for (const p of [0.001, 0.05, 0.3, 0.7, 0.95, 0.999]) vicino(tRipartizione(tInversa(p, g), g), p, 1e-9);
  });
});

describe('T504: funzioni T.DIST e compagne nel foglio', () => {
  it('T.DIST (ripartizione e densità)', () => {
    vicino(numero('=T.DIST(1.5,10,TRUE)'), 0.9177463367772799);
    vicino(numero('=T.DIST(-1.5,10,TRUE)'), 0.08225366322272007);
    vicino(numero('=T.DIST(1.5,10,FALSE)'), 0.12744479428709166);
    vicino(numero('=T.DIST(0.3,1,FALSE)'), 0.29202741851723923);
  });
  it('T.DIST.2T e T.DIST.RT', () => {
    vicino(numero('=T.DIST.2T(2.228139,10)'), 0.04999998745288254);
    vicino(numero('=T.DIST.2T(1,5)'), 0.3632174676491229);
    vicino(numero('=T.DIST.RT(1.5,10)'), 0.08225366322272007);
    vicino(numero('=T.DIST.RT(-1.5,10)'), 0.9177463367772799);
  });
  it('T.INV e T.INV.2T', () => {
    vicino(numero('=T.INV(0.975,10)'), 2.2281388519862744);
    vicino(numero('=T.INV(0.025,10)'), -2.2281388519862753);
    vicino(numero('=T.INV.2T(0.05,10)'), 2.2281388519862744);
    vicino(numero('=T.INV.2T(0.1,5)'), 2.0150483733330233);
    expect(numero('=T.INV.2T(1,4)')).toBe(0);
    expect(numero('=T.INV(0.5,3)')).toBe(0);
  });
  it('i gradi di libertà si troncano a intero, e valori fuori campo danno #NUM!', () => {
    vicino(numero('=T.DIST(1.5,10.9,TRUE)'), numero('=T.DIST(1.5,10,TRUE)'));
    for (const f of ['=T.DIST(1,0,TRUE)', '=T.DIST.2T(-1,5)', '=T.INV(0,5)', '=T.INV(1,5)', '=T.INV(0.5,0)', '=T.INV.2T(0,5)', '=T.INV.2T(1.5,5)']) expect(calcola(f).error ?? calcola(f).kind).toBe('#NUM!');
  });
  it('argomenti sbagliati: #VALUE!', () => {
    for (const f of ['=T.DIST(1,5)', '=T.DIST("a",5,TRUE)', '=T.INV(0.5)']) expect(calcola(f).error ?? calcola(f).kind).toBe('#VALUE!');
  });
});

describe('T504: T.TEST', () => {
  const dati = { A, B, C };
  it('a coppie (tipo 1), due code e una coda', () => {
    vicino(numero('=T.TEST(A1:A8,B1:B8,2,1)', dati), 0.03695147680230186, 1e-8);
    vicino(numero('=T.TEST(A1:A8,B1:B8,1,1)', dati), 0.01847573840115093, 1e-8);
  });
  it('due campioni con la stessa varianza (tipo 2)', () => {
    vicino(numero('=T.TEST(A1:A8,C1:C5,2,2)', dati), 7.99150619504392e-06, 1e-7);
    vicino(numero('=T.TEST(A1:A8,C1:C5,1,2)', dati), 3.99575309752196e-06, 1e-7);
  });
  it('due campioni con varianze diverse (tipo 3, Welch con gradi di libertà frazionari)', () => {
    vicino(numero('=T.TEST(A1:A8,C1:C5,2,3)', dati), 1.8102198493141778e-05, 1e-7);
    vicino(numero('=T.TEST(A1:A8,C1:C5,1,3)', dati), 9.051099246570889e-06, 1e-7);
  });
  it('code o tipo fuori campo: #NUM!; coppie di lunghezza diversa: #N/A; dati insufficienti o senza variazione: #DIV/0!', () => {
    expect(calcola('=T.TEST(A1:A8,B1:B8,3,1)', dati).error).toBe('#NUM!');
    expect(calcola('=T.TEST(A1:A8,B1:B8,2,4)', dati).error).toBe('#NUM!');
    expect(calcola('=T.TEST(A1:A8,C1:C5,2,1)', dati).error).toBe('#N/A');
    expect(calcola('=T.TEST(A1:A1,B1:B1,2,2)', dati).error).toBe('#DIV/0!');
    expect(calcola('=T.TEST(D1:D3,E1:E3,2,2)', { D: [5, 5, 5], E: [5, 5, 5] }).error).toBe('#DIV/0!');
    expect(calcola('=T.TEST(D1:D3,E1:E3,2,1)', { D: [5, 6, 7], E: [4, 5, 6] }).error).toBe('#DIV/0!');   // differenze tutte uguali
    expect(calcola('=T.TEST(A1:A8,B1:B8,2)', dati).error).toBe('#VALUE!');
  });
  it('un errore dentro i dati si propaga', () => {
    const w = createWorkbook();
    ['1', '2', '3', '=1/0'].forEach((v, i) => w.setCell('Foglio1', `A${i + 1}`, v));
    ['2', '3', '4', '5'].forEach((v, i) => w.setCell('Foglio1', `B${i + 1}`, v));
    w.setCell('Foglio1', 'Z1', '=T.TEST(A1:A4,B1:B4,2,2)');
    expect((w.getCell('Foglio1', 'Z1').value as { error?: string }).error).toBe('#DIV/0!');
  });
});

describe('T504: nomi italiani', () => {
  it.each([
    ['=DISTRIB.T.N(1,5;10;VERO)', '=T.DIST(1.5,10,TRUE)'],
    ['=DISTRIB.T.2T(2;7)', '=T.DIST.2T(2,7)'],
    ['=DISTRIB.T.DS(2;7)', '=T.DIST.RT(2,7)'],
    ['=INV.T(0,975;10)', '=T.INV(0.975,10)'],
    ['=INV.T.2T(0,05;10)', '=T.INV.2T(0.05,10)'],
    ['=TEST.T(A1:A8;B1:B8;2;1)', '=T.TEST(A1:A8,B1:B8,2,1)'],
  ])('%s → %s', (it, en) => {
    expect(translateFormula(it, 'it', 'en')).toBe(en);
  });
  it('verso l\'italiano', () => {
    expect(translateFormula('=T.TEST(A1:A8,B1:B8,2,1)', 'en', 'it')).toBe('=TEST.T(A1:A8;B1:B8;2;1)');
    expect(translateFormula('=T.INV.2T(0.05,10)', 'en', 'it')).toBe('=INV.T.2T(0,05;10)');
  });
});
