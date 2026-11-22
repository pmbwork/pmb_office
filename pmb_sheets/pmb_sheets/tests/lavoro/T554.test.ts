// T554: numeri complessi, Bessel, HEX2OCT/OCT2HEX, ENCODEURL, FINDB/SEARCHB/REPLACEB e ISREF (2026-11-20), confrontati con i risultati di Excel
// installato (tests/file-prova/excel-oracolo/funzioni-2026-11-20b.json, da LAVORO/studio-microsoft-office/oracolo_excel_2.py).
// I complessi si confrontano come numeri (parte reale e immaginaria, suffisso): Excel calcola cos(π/2) e simili in modo un po' diverso
// (1,22514845490862E-16 invece di 1,22464679914735E-16). Le funzioni di Bessel di Excel sono approssimate (BESSELJ(0;0) = 1,0000000028; BESSELJ(10;3) = 0,05837984 invece di 0,0583793793, il valore delle tavole che dà pmb_sheets):
// tolleranza 1e-6. Excel in italiano legge e scrive i complessi con la virgola: i casi col punto si provano a parte.
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { translateFormula } from '../../src/engine/i18n';

interface Caso { formula: string; numero?: number; testo?: string; logico?: boolean; errore?: string }
const oracolo = JSON.parse(fs.readFileSync('tests/file-prova/excel-oracolo/funzioni-2026-11-20b.json', 'utf-8')) as { dati: Record<string, number | string>; casi: Caso[] };
const ERRORI: Record<string, string> = { '#N/D': '#N/A', '#VALORE!': '#VALUE!', '#NUM!': '#NUM!', '#DIV/0!': '#DIV/0!' };
/** Casi che in Excel italiano dipendono dalla virgola decimale (testi col punto, la cella A3, ENCODEURL di un numero decimale). */
const LINGUA = (c: Caso): boolean => (/"[^"]*\d\.\d[^"]*"|A1:A4|A1:A3/.test(c.formula) && c.errore === '#NUM!') || c.formula === '=ENCODEURL(12.5)';

function complesso(t: string): { re: number; im: number; s: string } | null {
  const x = t.replace(/,/g, '.');
  const m = /^([+-]?[\d.]+(?:E[+-]?\d+)?)?(?:([+-]?)([\d.]+(?:E[+-]?\d+)?)?([ij]))?$/.exec(x);
  if (!m || x === '') return null;
  const re = m[1] !== undefined && !(m[4] && m[2] === '' && m[3] === undefined && m[1] !== undefined && false) ? Number(m[1]) : 0;
  if (!m[4]) return { re, im: 0, s: '' };
  const segno = m[2] === '-' ? -1 : 1;
  // «2i», «-3.5j»: il numero letto come reale è in realtà la parte immaginaria
  if (m[2] === '' && m[3] === undefined && m[1] !== undefined) return { re: 0, im: Number(m[1]), s: m[4] };
  if (m[1] === undefined) return { re: 0, im: segno * (m[3] === undefined ? 1 : Number(m[3])), s: m[4] };
  return { re, im: segno * (m[3] === undefined ? 1 : Number(m[3])), s: m[4] };
}
const vicini = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

function cartella() {
  const wb = createWorkbook();
  for (const [a, v] of Object.entries(oracolo.dati)) wb.setCell('Foglio1', a, String(v));
  return wb;
}

describe('T554: le stesse risposte di Excel', () => {
  const wb = cartella();
  const casi = oracolo.casi.filter((c) => !LINGUA(c));
  it(`${casi.length} formule`, () => {
    const diversi: string[] = [];
    casi.forEach((c, i) => {
      wb.setCell('Foglio1', `AA${i + 1}`, c.formula);
      const v = wb.getCell('Foglio1', `AA${i + 1}`).value as { kind: string; value?: unknown; error?: string };
      let ok = false;
      if (c.errore !== undefined) ok = v.kind === 'error' && v.error === (ERRORI[c.errore] ?? c.errore);
      else if (c.numero !== undefined) ok = v.kind === 'number' && vicini(v.value as number, c.numero, /^=BESSEL/.test(c.formula) ? 1e-6 : 1e-12);
      else if (c.logico !== undefined) ok = v.kind === 'boolean' && v.value === c.logico;
      else if (c.testo !== undefined) {
        const atteso = /^=(COMPLEX|IM)/.test(c.formula) ? complesso(c.testo) : null;
        if (atteso && v.kind === 'text') {
          const dato = complesso(v.value as string);
          const scala = Math.max(1, Math.hypot(atteso.re, atteso.im));
          ok = !!dato && dato.s === atteso.s && Math.abs(dato.re - atteso.re) <= 1e-13 * scala && Math.abs(dato.im - atteso.im) <= 1e-13 * scala;
        } else ok = v.kind === 'text' && v.value === c.testo;
      }
      if (!ok) diversi.push(`${c.formula}: Excel ${JSON.stringify(c)}, pmb_sheets ${v.kind === 'error' ? v.error : JSON.stringify(v.value)}`);
    });
    expect(diversi).toEqual([]);
  });
});

describe('T554: col punto decimale del motore, e nomi italiani', () => {
  const wb = cartella();
  const calcola = (f: string): unknown => { wb.setCell('Foglio1', 'AB1', f); const v = wb.getCell('Foglio1', 'AB1').value as { kind: string; value?: unknown; error?: string }; return v.kind === 'error' ? v.error : v.value; };
  it('i casi che Excel italiano legge con la virgola', () => {
    expect(calcola('=IMABS("-2.5+0.5i")')).toBeCloseTo(Math.sqrt(6.5), 13);
    expect(calcola('=IMCONJUGATE("-2.5+0.5i")')).toBe('-2.5-0.5i');
    expect(calcola('=IMREAL("1.5e2+3E-1i")')).toBe(150);
    expect(calcola('=IMAGINARY("1.5e2+3E-1i")')).toBe(0.3);
    expect(calcola('=IMSUM(A1:A4)')).toBe('1.5+3.5i');
    expect(calcola('=IMPRODUCT(A1:A3,2)')).toBe('-53+21i');           // (3+4i)(1-2i) = 11-2i; ·(-2.5+0.5i) = -26.5+10.5i; ·2
    expect(calcola('=COMPLEX(1.5,-2.25)')).toBe('1.5-2.25i');
    expect(calcola('=ENCODEURL(12.5)')).toBe('12.5');
  });
  it('nomi italiani come in Excel', () => {
    expect(translateFormula('=IMSUM(A1,A2)', 'en', 'it')).toBe('=COMP.SOMMA(A1;A2)');
    expect(translateFormula('=BESSEL.J(1;2)', 'it', 'en')).toBe('=BESSELJ(1,2)');
    expect(translateFormula('=ISREF(A1)', 'en', 'it')).toBe('=VAL.RIF(A1)');
  });
});

describe('T554: Bessel con i valori delle tavole (più precisi di quelli di Excel)', () => {
  it('J, Y, I, K', () => {
    const wb = createWorkbook();
    const calcola = (f: string): number => { wb.setCell('Foglio1', 'A1', f); return (wb.getCell('Foglio1', 'A1').value as { value: number }).value; };
    expect(calcola('=BESSELJ(10,3)')).toBeCloseTo(0.05837937930518666, 13);
    expect(calcola('=BESSELJ(0,0)')).toBe(1);
    expect(calcola('=BESSELY(1.5,1)')).toBeCloseTo(-0.4123086269739113, 11);
    expect(calcola('=BESSELY(2.5,0)')).toBeCloseTo(0.4980703596152316, 11);
    expect(calcola('=BESSELI(1.5,1)')).toBeCloseTo(0.9816664285779076, 13);
    expect(calcola('=BESSELK(1.5,1)')).toBeCloseTo(0.2773878004568438, 11);
  });
});

describe('T554: nei file', () => {
  it('.xlsx con _xlfn. dove lo scrive Excel, .ods con i nomi di LibreOffice', async () => {
    const { formulaPerExcel } = await import('../../src/formati/xlsx-scrivi');
    const { formulaPerOds } = await import('../../src/formati/ods-scrivi');
    expect(formulaPerExcel('=IMSUM(A1,IMTAN(A2))&ENCODEURL(B1)')).toBe('IMSUM(A1,_xlfn.IMTAN(A2))&_xlfn.ENCODEURL(B1)');
    expect(formulaPerOds('=IMCSCH(A1)&ENCODEURL(B1)')).toBe('of:=IMCSCH([.A1])&COM.MICROSOFT.ENCODEURL([.B1])');
  });
});
