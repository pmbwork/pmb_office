// @vitest-environment node
// Batteria di verifica INDIPENDENTE (scritta da Claude, non da Gemini). Gli attesi sono ricavati dalla specifica di
// P01/P01b e dal ragionamento, non dall'output del motore. Se un caso fallisce si corregge il motore, non l'atteso.
import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';

function fmt(v: any): string {
  switch (v.kind) {
    case 'number': return String(v.value);
    case 'text': return JSON.stringify(v.value);
    case 'boolean': return v.value ? 'TRUE' : 'FALSE';
    case 'empty': return 'EMPTY';
    case 'error': return String(v.error);
    default: return 'KIND?' + JSON.stringify(v);
  }
}
type C = [Record<string, string>, string, string];
const V = { A1: '1', B1: 'a', A2: '2', B2: 'b', A3: '3', B3: 'c' };
const CR = { A1: '1', A2: '5', A3: '10', A4: 'apple', A5: 'avocado', B1: '10', B2: '20', B3: '30', B4: '40', B5: '50' };
const H = { A1: '1', B1: '2', C1: '3', A2: 'x', B2: 'y', C2: 'z' };
const cases: C[] = [
  [{}, '=-2^2', '4'], [{}, '=2^3^2', '64'], [{}, '=50%', '0.5'], [{}, '=1+2*3', '7'], [{}, '=10/4', '2.5'], [{}, '=2^-1', '0.5'],
  [{ A1: '3' }, '=-A1^2', '9'], [{}, '="a"&"b"&1', '"ab1"'], [{}, '=(1+2)*3', '9'], [{}, '=1-1-1', '-1'], [{}, '=--1', '1'],
  [{}, '=1=1', 'TRUE'], [{}, '=1<>1', 'FALSE'], [{}, '=2>=2', 'TRUE'], [{}, '=2*3%', '0.06'], [{}, '=1+2&3', '"33"'],
  [{}, '="3"+1', '4'], [{}, '="x"+1', '#VALUE!'], [{}, '=TRUE+1', '2'], [{}, '=A1+1', '1'], [{}, '=A1&"x"', '"x"'],
  [{}, '=1/0', '#DIV/0!'], [{}, '=1/0+1', '#DIV/0!'], [{}, '=IFERROR(1/0,"e")', '"e"'],
  [{}, '=1<"a"', 'TRUE'], [{}, '="a"<TRUE', 'TRUE'], [{}, '="A"="a"', 'TRUE'], [{}, '=A1=0', 'TRUE'], [{}, '=A1=""', 'TRUE'], [{}, '=TRUE>999', 'TRUE'], [{}, '="b">"a"', 'TRUE'],
  [{ A1: '1', A2: 'x', A3: 'TRUE' }, '=SUM(A1:A3)', '1'], [{}, '=SUM(1,TRUE,"5")', '7'], [{}, '=SUM("x")', '#VALUE!'],
  [{ A1: '1', A2: 'x', A3: 'TRUE' }, '=COUNT(A1:A3)', '1'], [{ A1: '1', A2: 'x', A3: 'TRUE' }, '=COUNTA(A1:A3)', '3'],
  [{}, '=AVERAGE(B1:B3)', '#DIV/0!'], [{ A2: 'x' }, '=MEDIAN(A2:A2)', '#NUM!'], [{ A2: 'x' }, '=MIN(A2:A2)', '0'], [{}, '=MAX(B1:B3)', '0'], [{}, '=COUNTBLANK(B1:B3)', '3'],
  [{ A1: '1', A2: '2', A3: '3', A4: '4' }, '=AVERAGE(A1:A4)', '2.5'], [{ A1: '1', A2: '2', A3: '3', A4: '4' }, '=MEDIAN(A1:A4)', '2.5'],
  [{ A1: '1', A2: '2', A3: '3', A4: '4' }, '=MEDIAN(A1:A3)', '2'], [{ A1: '1', A2: '2', A3: '3', A4: '4' }, '=PRODUCT(A1:A4)', '24'],
  [{ A1: '1', A2: '2', A3: '3', A4: '4' }, '=SUMPRODUCT(A1:A2,A3:A4)', '11'], [{ A1: '1', A2: '2', A3: '3', A4: '4' }, '=MIN(A1:A4)', '1'],
  [{ A1: '1', A2: '2', A3: '3' }, '=SUM(A:A)', '6'], [{ A1: '1', B1: '2' }, '=SUM(1:1)', '3'], [{ A1: '1', B1: '2' }, '=SUM($1:$1)', '3'],
  [{ A1: '1', B2: '2', C3: '4' }, '=SUM(1:2)', '3'], [{ A1: '1', B1: '2' }, '=SUM(1:3)', '3'], [{ A1: '1', B1: '2' }, '=SUM($A:$B)', '3'],
  [{}, '=ROUND(2.5,0)', '3'], [{}, '=ROUND(-2.5,0)', '-3'], [{}, '=ROUND(1234,-2)', '1200'], [{}, '=ROUND(2.675,2)', '2.68'],
  [{}, '=ROUND(1.005,2)', '1.01'], [{}, '=ROUND(1.255,2)', '1.26'], [{}, '=ROUND(0.285,2)', '0.29'], [{}, '=ROUND(8.345,2)', '8.35'],
  [{}, '=ROUND(-1.005,2)', '-1.01'], [{}, '=ROUND(0.5,0)', '1'], [{}, '=ROUND(-0.5,0)', '-1'], [{}, '=ROUND(1234.5678,-2)', '1200'],
  [{}, '=ROUND(1E+20,2)', '100000000000000000000'], [{}, '=ROUND(3.14159,2)', '3.14'], [{}, '=ROUND(0.1+0.2,1)', '0.3'], [{}, '=ROUND(1E-7,3)', '0'],
  [{}, '=ROUNDUP(-1.1,0)', '-2'], [{}, '=ROUNDUP(1.234,2)', '1.24'], [{}, '=ROUNDUP(2.0000001,0)', '3'], [{}, '=ROUNDDOWN(-1.9,0)', '-1'], [{}, '=ROUNDDOWN(1.239,2)', '1.23'],
  [{}, '=INT(-1.5)', '-2'], [{}, '=MOD(-3,2)', '1'], [{}, '=MOD(3,-2)', '-1'], [{}, '=MOD(3,0)', '#DIV/0!'], [{}, '=SQRT(-1)', '#NUM!'],
  [{}, '=CEILING(2.1,1)', '3'], [{}, '=CEILING(1.23,0.1)', '1.3'], [{}, '=FLOOR(2.9,1)', '2'], [{}, '=FLOOR(1.29,0.1)', '1.2'], [{}, '=SIGN(-5)', '-1'], [{}, '=PI()', String(Math.PI)],
  [{}, '=ABS(-3)', '3'], [{}, '=POWER(2,10)', '1024'], [{}, '=0.1+0.2', String(0.1 + 0.2)],
  [{}, '=IF(1>2,"a","b")', '"b"'], [{}, '=IF(TRUE,1)', '1'], [{}, '=IFS(FALSE,1,TRUE,2)', '2'], [{}, '=IFS(FALSE,1)', '#N/A'],
  [{}, '=SWITCH(2,1,"a",2,"b","z")', '"b"'], [{}, '=SWITCH(9,1,"a","z")', '"z"'], [{}, '=AND(TRUE,TRUE)', 'TRUE'], [{}, '=OR(FALSE,FALSE)', 'FALSE'],
  [{}, '=NOT(TRUE)', 'FALSE'], [{}, '=IFNA(#N/A,"x")', '"x"'], [{}, '=IFERROR(#N/A,1)', '1'], [{}, '=IF(1/0,1,2)', '#DIV/0!'], [{}, '=IF(TRUE,1,1/0)', '1'],
  [{}, '=IFERROR(IFERROR(1/0,1/0),5)', '5'],
  [{}, '=LEFT("abc",2)', '"ab"'], [{}, '=RIGHT("abc",2)', '"bc"'], [{}, '=MID("abcdef",2,3)', '"bcd"'], [{}, '=LEN("héllo")', '5'], [{}, '=UPPER("aB")', '"AB"'],
  [{}, '=LOWER("aB")', '"ab"'], [{}, '=TRIM("  a   b ")', '"a b"'], [{}, '=SUBSTITUTE("aaa","a","b",2)', '"aba"'], [{}, '=SUBSTITUTE("aaa","a","b")', '"bbb"'],
  [{}, '=FIND("b","abc")', '2'], [{}, '=FIND("B","abc")', '#VALUE!'], [{}, '=SEARCH("B","abc")', '2'], [{}, '=SEARCH("a?c","xabc")', '2'], [{}, '=REPT("ab",3)', '"ababab"'],
  [{}, '=TEXTJOIN(",",TRUE,"a","","b")', '"a,b"'], [{}, '=TEXTJOIN(",",FALSE,"a","","b")', '"a,,b"'], [{}, '=VALUE("12")', '12'], [{}, '=VALUE("x")', '#VALUE!'],
  [{}, '=CONCAT("a",1,TRUE)', '"a1TRUE"'], [{}, '=CONCATENATE("a","b")', '"ab"'], [{}, '=LEFT("abc")', '"a"'], [{}, '=LEFT("abc",-1)', '#VALUE!'], [{}, '=MID("abc",0,1)', '#VALUE!'],
  [{}, '=LEN("")', '0'], [{}, '=""&""', '""'], [{}, '="a""b"', '"a\\"b"'],
  [V, '=VLOOKUP(2,A1:B3,2,FALSE)', '"b"'], [V, '=VLOOKUP(2.5,A1:B3,2,TRUE)', '"b"'], [V, '=VLOOKUP(9,A1:B3,2,FALSE)', '#N/A'], [V, '=VLOOKUP(2,A1:B3,3,FALSE)', '#REF!'],
  [V, '=VLOOKUP(0,A1:B3,2,TRUE)', '#N/A'], [V, '=MATCH(3,A1:A3,0)', '3'], [V, '=MATCH(2.5,A1:A3,1)', '2'], [V, '=INDEX(A1:B3,2,2)', '"b"'], [V, '=INDEX(A1:A3,3)', '3'],
  [V, '=INDEX(A1:B3,4,1)', '#REF!'], [V, '=XLOOKUP(3,A1:A3,B1:B3)', '"c"'], [V, '=XLOOKUP(9,A1:A3,B1:B3,"nf")', '"nf"'], [V, '=XLOOKUP(9,A1:A3,B1:B3)', '#N/A'],
  [V, '=CHOOSE(2,"a","b")', '"b"'], [V, '=CHOOSE(3,"a","b")', '#VALUE!'], [V, '=ROW(A5)', '5'], [V, '=COLUMN(C1)', '3'], [V, '=VLOOKUP("B",B1:B3,1,FALSE)', '"b"'],
  [H, '=HLOOKUP(2,A1:C2,2,FALSE)', '"y"'], [H, '=HLOOKUP(2.5,A1:C2,2,TRUE)', '"y"'], [H, '=HLOOKUP(9,A1:C2,2,FALSE)', '#N/A'], [H, '=HLOOKUP(2,A1:C2,3,FALSE)', '#REF!'],
  [{}, '=DATE(2024,2,29)', '45351'], [{}, '=YEAR(45351)', '2024'], [{}, '=MONTH(45351)', '2'], [{}, '=DAY(45351)', '29'], [{}, '=WEEKDAY(45351)', '5'], [{}, '=WEEKDAY(45351,2)', '4'],
  [{}, '=DATE(2024,14,1)', '45689'], [{}, '=EDATE(DATE(2024,1,31),1)', '45351'], [{}, '=DATE(2024,1,0)', '45291'], [{}, '=DATE(2000,1,1)', '36526'],
  [{}, '=ISBLANK(B1)', 'TRUE'], [{}, '=ISBLANK("")', 'FALSE'], [{}, '=ISNUMBER("1")', 'FALSE'], [{}, '=ISNUMBER(1)', 'TRUE'], [{}, '=ISTEXT("a")', 'TRUE'], [{}, '=ISERROR(1/0)', 'TRUE'],
  [{}, '=ISERR(#N/A)', 'FALSE'], [{}, '=ISNA(#N/A)', 'TRUE'], [{}, '=ISLOGICAL(TRUE)', 'TRUE'], [{}, '=ISNUMBER(A1)', 'FALSE'],
  [CR, '=SUMIF(A1:A5,">4")', '15'], [CR, '=SUMIF(A1:A5,">4",B1:B5)', '50'], [CR, '=COUNTIF(A1:A5,"a*")', '2'], [CR, '=COUNTIF(A1:A5,"<>apple")', '4'], [CR, '=COUNTIF(A1:A5,10)', '1'],
  [CR, '=COUNTIF(A1:A5,"a?ple")', '1'], [CR, '=AVERAGEIF(A1:A5,">=5")', '7.5'], [CR, '=COUNTIF(A1:A5,"APPLE")', '1'], [CR, '=COUNTIF(A1:A5,"<=5")', '2'],
  [CR, '=COUNTIF(A1:A5,">4")', '2'], [CR, '=COUNTIF(A1:A5,"<b")', '2'], [CR, '=AVERAGEIF(A1:A5,">4",B1:B5)', '25'], [CR, '=COUNTIF(A1:A5,">=1")', '3'],
  [CR, '=COUNTIF(A1:A5,"=5")', '1'], [CR, '=COUNTIF(A1:A5,"apple")', '1'], [CR, '=COUNTIF(F1:F3,">0")', '0'], [CR, '=COUNTIF(A1:A5,"<>5")', '4'],
  [{ A1: '1', A2: '2', A3: '3' }, '=A1:A3+1', '2'], [{}, '=1+', '#ERROR!'], [{}, '=SUM(', '#ERROR!'], [{}, '=FOO(1)', '#NAME?'], [{}, '=)', '#ERROR!'], [{}, '=1 2', '#ERROR!'],
  [{}, '="abc', '#ERROR!'], [{}, '=SUM(1,2))', '#ERROR!'], [{}, '=1:', '#ERROR!'], [{}, '=SUM(1:)', '#ERROR!'],
];

function evalCase(setup: Record<string, string>, formula: string): string {
  const wb = createWorkbook(); wb.addSheet('S');
  for (const [k, v] of Object.entries(setup)) wb.setCell('S', k, v);
  wb.setCell('S', 'Z99', formula);
  return fmt(wb.getCell('S', 'Z99').value);
}

describe('Batteria indipendente di Claude (2)', () => {
  it('casi a tabella', () => {
    const bad: string[] = [];
    for (const [setup, formula, expected] of cases) {
      let got: string; try { got = evalCase(setup, formula); } catch (e: any) { got = 'THROW:' + e.message; }
      if (got !== expected) bad.push(`${formula} setup=${JSON.stringify(setup).slice(0, 40)} atteso=${expected} ottenuto=${got}`);
    }
    expect(bad).toEqual([]);
  });

  it('righe intere e cicli di posizione', () => {
    const wb = createWorkbook(); wb.addSheet('S');
    wb.setCell('S', 'A1', '5'); wb.setCell('S', 'A2', '=SUM(1:1)'); const a2 = fmt(wb.getCell('S', 'A2').value);
    wb.setCell('S', 'B1', '=SUM(1:1)'); wb.setCell('S', 'C1', '=SUM($1:$1)');
    const out = { B1: fmt(wb.getCell('S', 'B1').value), A2: a2, C1: fmt(wb.getCell('S', 'C1').value) };
    wb.setCell('S', 'D5', '=SUM(D:D)'); const colSelf = fmt(wb.getCell('S', 'D5').value);
    expect(out.B1).toBe('#CIRCULAR!'); expect(out.A2).toBe('5'); expect(out.C1).toBe('#CIRCULAR!'); expect(colSelf).toBe('#CIRCULAR!');
  });

  it('cicli, fogli, riscrittura, onChange, rinomina, serializzazione', () => {
    const wb = createWorkbook(); wb.addSheet('S'); wb.addSheet('Altro'); wb.addSheet('Il mio foglio');
    wb.setCell('Altro', 'A1', '7'); wb.setCell('Il mio foglio', 'A1', '3'); wb.setCell('S', 'C1', '1');
    wb.setCell('S', 'A1', '=B1'); wb.setCell('S', 'B1', '=A1');
    const r1 = [fmt(wb.getCell('S', 'A1').value), fmt(wb.getCell('S', 'B1').value), fmt(wb.getCell('S', 'C1').value)];
    wb.setCell('S', 'B1', '5'); const r2 = [fmt(wb.getCell('S', 'A1').value), fmt(wb.getCell('S', 'B1').value)];
    wb.setCell('S', 'D1', '=D1+1'); wb.setCell('S', 'E1', '=D1+1');
    const selfDown = [fmt(wb.getCell('S', 'D1').value), fmt(wb.getCell('S', 'E1').value)];
    wb.setCell('S', 'F1', '=Altro!A1*2'); wb.setCell('S', 'F2', "='Il mio foglio'!A1+1"); wb.setCell('S', 'F3', '=Nope!A1'); wb.setCell('S', 'F4', '=F1+1');
    const xs = [fmt(wb.getCell('S', 'F1').value), fmt(wb.getCell('S', 'F2').value), fmt(wb.getCell('S', 'F3').value)];
    wb.removeSheet('Altro');
    const afterRemove = [fmt(wb.getCell('S', 'F1').value), fmt(wb.getCell('S', 'F4').value)];
    wb.addSheet('Altro'); wb.setCell('Altro', 'A1', '10'); wb.recalculate();
    const afterRecreate = [fmt(wb.getCell('S', 'F1').value), fmt(wb.getCell('S', 'F4').value)];
    wb.setCell('S', 'G1', '=1+1'); wb.setCell('S', 'G2', '=G1*10'); wb.setCell('S', 'G1', '5'); const g2 = fmt(wb.getCell('S', 'G2').value);
    wb.clearCell('S', 'G1'); const g2b = fmt(wb.getCell('S', 'G2').value);
    const changes: any[] = []; const off = wb.onChange((c: any) => changes.push(c));
    wb.setCell('S', 'H1', '1'); wb.setCell('S', 'H2', '=H1+1'); wb.setCell('S', 'H3', '=H2+1'); changes.length = 0;
    wb.setCell('S', 'H1', '10'); off();
    const ser = wb.serialize(); const wb2 = createWorkbook(); wb2.deserialize(ser);
    const same = [fmt(wb2.getCell('S', 'H3').value), fmt(wb2.getCell('S', 'A1').value), wb2.serialize() === ser];
    // rinomina
    let renameOut: any = 'n/d';
    try { const ok = (wb as any).renameSheet('Il mio foglio', 'Nuovo'); wb.recalculate(); renameOut = { ok, F2: fmt(wb.getCell('S', 'F2').value), vecchio: fmt(wb.getCell('Nuovo', 'A1').value) }; } catch (e: any) { renameOut = 'ERR ' + e.message; }
    console.log('CICLI ' + JSON.stringify({ r1, r2, selfDown, xs, afterRemove, afterRecreate, g2, g2b, onChange: JSON.stringify(changes), same, renameOut }));
    expect(r1).toEqual(['#CIRCULAR!', '#CIRCULAR!', '1']); expect(r2).toEqual(['5', '5']); expect(selfDown).toEqual(['#CIRCULAR!', '#CIRCULAR!']);
    expect(xs).toEqual(['14', '4', '#REF!']); expect(afterRemove).toEqual(['#REF!', '#REF!']); expect(afterRecreate).toEqual(['20', '21']);
    expect(g2).toBe('50'); expect(g2b).toBe('0'); expect(same).toEqual(['12', '5', true]);
    expect(changes.flat().map((c: any) => c.address).sort()).toEqual(['H1', 'H2', 'H3']);
  });

  it('robustezza e prestazioni', () => {
    const t = (n: number) => { const wb = createWorkbook(); wb.addSheet('S'); wb.setCell('S', 'A1', '1'); for (let i = 2; i <= n; i++) wb.setCell('S', `A${i}`, `=A${i - 1}+1`); const a = performance.now(); wb.setCell('S', 'A1', '100'); return [Math.round(performance.now() - a), fmt(wb.getCell('S', `A${n}`).value)]; };
    const c10 = t(10000), c50 = t(50000), c100 = t(100000);
    const w2 = createWorkbook(); w2.addSheet('S');
    for (let i = 1; i <= 10000; i++) w2.setCell('S', `A${i}`, String(i));
    for (let j = 1; j <= 1000; j++) w2.setCell('S', `B${j}`, '=SUM(A1:A10000)');
    const s0 = performance.now(); w2.setCell('S', 'A5000', '0'); const wide = Math.round(performance.now() - s0);
    const b1 = fmt(w2.getCell('S', 'B1').value);
    const w4 = createWorkbook(); w4.addSheet('S');
    for (let i = 1; i <= 50000; i++) { w4.setCell('S', `A${i}`, String(i)); w4.setCell('S', `B${i}`, `v${i}`); }
    const v0 = performance.now(); for (let k = 0; k < 50; k++) w4.setCell('S', 'D1', `=VLOOKUP(${49000 + k},A1:B50000,2,FALSE)`); const vl = Math.round((performance.now() - v0) / 50 * 100) / 100;
    const vlv = fmt(w4.getCell('S', 'D1').value);
    // XLOOKUP, MATCH, COUNTIF su 50k
    const x0 = performance.now(); for (let k = 0; k < 50; k++) w4.setCell('S', 'E1', `=MATCH(${49000 + k},A1:A50000,0)`); const mt = Math.round((performance.now() - x0) / 50 * 100) / 100;
    const k0 = performance.now(); for (let k = 0; k < 50; k++) w4.setCell('S', 'F1', `=COUNTIF(A1:A50000,">${k}")`); const ci = Math.round((performance.now() - k0) / 50 * 100) / 100;
    const vocab = ['=', '(', ')', ',', '+', '-', '*', '/', '^', '&', '%', '<', '>', '<=', '<>', '1', '2.5', '"a"', '""', 'A1', '$B$2', 'A1:B2', 'A:A', '1:1', '$1:$2', '1:', ':3', 'Sheet!A1', "'x y'!C3",
      'SUM', 'IF', 'VLOOKUP', 'TRUE', '#N/A', '#REF!', ':', '!', "'", '"', 'XFD1048577', 'A0', '1e999', ' ', '\t', 'é', '€', '0:0', '1048577:1'];
    let seed = 777; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let thrown = 0; const wf = createWorkbook(); wf.addSheet('S');
    for (let k = 0; k < 4000; k++) { let f = '='; const n = 1 + Math.floor(rnd() * 12); for (let i = 0; i < n; i++) f += vocab[Math.floor(rnd() * vocab.length)]; try { wf.setCell('S', 'A1', f); const c = wf.getCell('S', 'A1'); if (!c || !c.value) thrown++; } catch { thrown++; } }
    // soglie larghe: servono a intercettare regressioni di ordine di grandezza (es. ritorno al comportamento quadratico), non a misurare
    expect(c50[0]).toBeLessThan(3000); expect(c100[0]).toBeLessThan(6000); expect(vl).toBeLessThan(10); expect(vlv).toBe('"v49049"');
    void wide; void mt; void ci; void c10;
    expect(c50[1]).toBe('50099'); expect(c100[1]).toBe('100099'); expect(b1).toBe(String(10000 * 10001 / 2 - 5000)); expect(thrown).toBe(0);
  }, 180000);
});
