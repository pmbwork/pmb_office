// T552: funzioni di Excel aggiunte il 2026-11-20 (distribuzioni con i vecchi nomi, statistiche, matematiche, finanziarie, TEXTBEFORE e
// TEXTAFTER…), confrontate una per una con i risultati di Excel installato (tests/file-prova/excel-oracolo/funzioni-2026-11-20.json, scritto
// da LAVORO/studio-microsoft-office/oracolo_excel.py). Più: nomi italiani come quelli di Excel e prefissi _xlfn. nei .xlsx.
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { translateFormula } from '../../src/engine/i18n';
import { defaultFunctionRegistry } from '../../src/engine/functions/registry';

interface Caso { formula: string; numero?: number; testo?: string; logico?: boolean; errore?: string; vuoto?: boolean }
const oracolo = JSON.parse(fs.readFileSync('tests/file-prova/excel-oracolo/funzioni-2026-11-20.json', 'utf-8')) as { dati: Record<string, number | string>; casi: Caso[] };

/** Gli errori come li scrive Excel in italiano → come li chiama il motore. */
const ERRORI: Record<string, string> = { '#N/D': '#N/A', '#VALORE!': '#VALUE!', '#NOME?': '#NAME?', '#RIF!': '#REF!', '#NUM!': '#NUM!', '#DIV/0!': '#DIV/0!', '#NULLO!': '#NULL!', '#ESPANSIONE!': '#SPILL!', '#CALC!': '#CALC!' };

function cartella() {
  const wb = createWorkbook();
  for (const [a, v] of Object.entries(oracolo.dati)) wb.setCell('Foglio1', a, String(v));
  return wb;
}
// VALUETOTEXT e ARRAYTOTEXT dipendono dalla lingua di Excel (virgola decimale, separatori italiani): sono provati qui sotto a parte
const DIPENDE_DALLA_LINGUA = /^=(VALUETOTEXT|ARRAYTOTEXT)\(/;

describe('T552: le stesse risposte di Excel', () => {
  const wb = cartella();
  const casi = oracolo.casi.filter((c) => !DIPENDE_DALLA_LINGUA.test(c.formula));
  it(`${casi.length} formule`, () => {
    const diversi: string[] = [];
    casi.forEach((c, i) => {
      const cella = `AA${i + 1}`;
      wb.setCell('Foglio1', cella, c.formula);
      const v = wb.getCell('Foglio1', cella).value as { kind: string; value?: unknown; error?: string };
      let ok = false;
      let atteso = '';
      if (c.errore !== undefined) { atteso = ERRORI[c.errore] ?? c.errore; ok = v.kind === 'error' && v.error === atteso; }
      else if (c.numero !== undefined) {
        atteso = String(c.numero);
        const n = v.value as number;
        ok = v.kind === 'number' && (Math.abs(n - c.numero) <= 1e-9 * Math.max(1, Math.abs(c.numero)) || Math.abs(n - c.numero) < 1e-14);
      } else if (c.testo !== undefined) { atteso = JSON.stringify(c.testo); ok = v.kind === 'text' && v.value === c.testo; }
      else if (c.logico !== undefined) { atteso = String(c.logico); ok = v.kind === 'boolean' && v.value === c.logico; }
      if (!ok) diversi.push(`${c.formula}: Excel ${atteso}, pmb_sheets ${v.kind === 'error' ? v.error : JSON.stringify(v.value)}`);
    });
    expect(diversi).toEqual([]);
  });
});

describe('T552: VALUETOTEXT e ARRAYTOTEXT (separatori del motore: punto decimale, «,» tra colonne, «;» tra righe)', () => {
  const wb = cartella();
  const calcola = (f: string): unknown => { wb.setCell('Foglio1', 'AB1', f); const v = wb.getCell('Foglio1', 'AB1').value as { kind: string; value?: unknown; error?: string }; return v.kind === 'error' ? v.error : v.value; };
  it('come Excel, a parte i separatori della lingua', () => {
    expect(calcola('=VALUETOTEXT("abc")')).toBe('abc');
    expect(calcola('=VALUETOTEXT("abc",1)')).toBe('"abc"');
    expect(calcola('=VALUETOTEXT(12.5)')).toBe('12.5');           // Excel in italiano: 12,5
    expect(calcola('=VALUETOTEXT(1/0)')).toBe('#DIV/0!');         // un errore diventa il suo nome, come testo
    expect(calcola('=VALUETOTEXT(Z99,1)')).toBe('');
    expect(calcola('=VALUETOTEXT(5,2)')).toBe('#VALUE!');
    expect(calcola('=ARRAYTOTEXT(A1:A3)')).toBe('3, 7, 7');        // Excel in italiano: 3; 7; 7
    expect(calcola('=ARRAYTOTEXT(T2:T3,1)')).toBe('{"a-b-c-d";"senza separatori"}');
    expect(calcola('=ARRAYTOTEXT(A1:B2,1)')).toBe('{3,2.5;7,6.1}'); // Excel in italiano: {3\2,5.7\6,1}
    expect(calcola('=ARRAYTOTEXT(Z98:Z99,1)')).toBe('{;}');
    expect(calcola('=ARRAYTOTEXT(1/0)')).toBe('#DIV/0!');
    expect(calcola('=ARRAYTOTEXT(A1:A2,3)')).toBe('#VALUE!');
  });
});

describe('T552: nomi italiani come in Excel', () => {
  it('le funzioni nuove e quelle che avevano un nome diverso da Excel', () => {
    expect(translateFormula('=BINOM.DIST(3,10,0.3,TRUE)', 'en', 'it')).toBe('=DISTRIB.BINOM.N(3;10;0,3;VERO)');
    expect(translateFormula('=DISTRIB.BINOM.N(3;10;0,3;VERO)', 'it', 'en')).toBe('=BINOM.DIST(3,10,0.3,TRUE)');
    expect(translateFormula('=TEXTBEFORE(A1,"-")', 'en', 'it')).toBe('=TESTO.PRECEDENTE(A1;"-")');
    expect(translateFormula('=PROB(A1:A4,B1:B4,2)', 'en', 'it')).toBe('=PROBABILITÀ(A1:A4;B1:B4;2)');
    // DB e DDB: in Excel AMMORT è DDB e AMMORT.FISSO è DB (prima pmb_sheets chiamava AMMORT la DB)
    expect(translateFormula('=DDB(1000,100,5,1)', 'en', 'it')).toBe('=AMMORT(1000;100;5;1)');
    expect(translateFormula('=DB(1000,100,5,1)', 'en', 'it')).toBe('=AMMORT.FISSO(1000;100;5;1)');
    expect(translateFormula('=AMMORT(1000;100;5;1)', 'it', 'en')).toBe('=DDB(1000,100,5,1)');
    expect(translateFormula('=NORM.S.INV(0.9)', 'en', 'it')).toBe('=INV.NORM.S(0,9)');
    expect(translateFormula('=NORMSINV(0.9)', 'en', 'it')).toBe('=INV.NORM.ST(0,9)');
    expect(translateFormula('=IFNA(A1,0)', 'en', 'it')).toBe('=SE.NON.DISP.(A1;0)');
    expect(translateFormula('=SE.NON.DISP.(A1;0)', 'it', 'en')).toBe('=IFNA(A1,0)');
    // i vecchi nomi di pmb_sheets si capiscono ancora, se Excel non li usa per un'altra funzione
    expect(translateFormula('=SE.NON.DISP(A1;0)', 'it', 'en')).toBe('=IFNA(A1,0)');
    expect(translateFormula('=PRENDI(A1:A5;2)', 'it', 'en')).toBe('=TAKE(A1:A5,2)');
  });
  it('il motore calcola anche scritto in italiano, e nessun nome italiano copre un nome inglese', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '=DISTRIB.BINOM.N(3,10,0.3,TRUE)');
    expect((wb.getCell('Foglio1', 'A1').value as { value: number }).value).toBeCloseTo(0.6496107184, 9);
    wb.setCell('Foglio1', 'A2', '=AMMORT(1000,100,5,1)');
    expect((wb.getCell('Foglio1', 'A2').value as { value: number }).value).toBe(400);   // DDB: 1000 × 2/5
    for (const n of defaultFunctionRegistry.listAll()) expect(defaultFunctionRegistry.has(n)).toBe(true);
  });
});

describe('T552: prefissi delle funzioni recenti nei .xlsx, come li scrive Excel', () => {
  it('senza prefisso Excel mostrerebbe #NOME? (provato su Excel installato con IFNA e T.DIST)', async () => {
    const { formulaPerExcel } = await import('../../src/formati/xlsx-scrivi');
    expect(formulaPerExcel('=IFNA(A1,0)')).toBe('_xlfn.IFNA(A1,0)');
    expect(formulaPerExcel('=T.DIST(1,5,TRUE)')).toBe('_xlfn.T.DIST(1,5,TRUE)');
    expect(formulaPerExcel('=BINOM.DIST(3,10,0.3,TRUE)+BINOMDIST(3,10,0.3,TRUE)')).toBe('_xlfn.BINOM.DIST(3,10,0.3,TRUE)+BINOMDIST(3,10,0.3,TRUE)');
    expect(formulaPerExcel('=SORTBY(A1:A3,B1:B3)')).toBe('_xlfn.SORTBY(A1:A3,B1:B3)');
    expect(formulaPerExcel('=SORT(A1:A3)')).toBe('_xlfn._xlws.SORT(A1:A3)');
    expect(formulaPerExcel('=ISO.CEILING(4.3)+TAKE(A1:A5,2)')).toBe('ISO.CEILING(4.3)+_xlfn.TAKE(A1:A5,2)');
    expect(formulaPerExcel('=TEXTBEFORE(A1,"T.DIST(")')).toBe('_xlfn.TEXTBEFORE(A1,"T.DIST(")');
  });
});

describe('T552: nomi delle funzioni nei .ods, come li scrive e li legge LibreOffice', () => {
  it('COM.MICROSOFT. e LEGACY. dove servono, FDIST e B dello standard; rileggendo si torna al nome di partenza', async () => {
    const { formulaPerOds } = await import('../../src/formati/ods-scrivi');
    const { formulaDaOds } = await import('../../src/formati/ods-leggi');
    // senza COM.MICROSOFT. LibreOffice dà #NAME? (provato con NORM.DIST)
    expect(formulaPerOds('=NORM.DIST(42,40,1.5,TRUE)')).toBe('of:=COM.MICROSOFT.NORM.DIST(42;40;1.5;TRUE())');
    expect(formulaPerOds('=F.DIST(A1,3,7,TRUE)+FDIST(A1,3,7)')).toBe('of:=FDIST([.A1];3;7;TRUE())+LEGACY.FDIST([.A1];3;7)');
    expect(formulaPerOds('=BINOM.DIST.RANGE(60,0.75,45,50)')).toBe('of:=B(60;0.75;45;50)');
    expect(formulaPerOds('=SKEW.P(A1:A8)+TEXTBEFORE(B1,"-")')).toBe('of:=SKEWP([.A1:.A8])+COM.MICROSOFT.TEXTBEFORE([.B1];"-")');
    for (const f of ['=NORM.DIST(42,40,1.5,TRUE)', '=F.DIST(A1,3,7,TRUE)+FDIST(A1,3,7)', '=BINOM.DIST.RANGE(60,0.75,45,50)', '=SKEW.P(A1:A8)+TEXTBEFORE(B1,"-")',
      '=CHIDIST(3,4)+NORMSINV(0.9)+TDIST(1,5,2)', '=XLOOKUP(A1,B1:B5,C1:C5)', '=CEILING(4.3,2)+FLOOR(4.3,2)']) {
      expect(formulaDaOds(formulaPerOds(f))).toBe(f);
    }
  });
});
