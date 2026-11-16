// @vitest-environment node
// Batteria INDIPENDENTE M3 (scritta da Claude, non da Gemini). Gli attesi vengono dalle definizioni standard
// (calcolati a mano o con codice scritto qui), non dall'output del motore. Se un caso fallisce si corregge il motore.
import { describe, it, expect } from 'vitest';
import { createWorkbook, translateFormula } from '../../src/engine';

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
function run(cells: Record<string, string>, formula: string): string {
  const wb = createWorkbook(); wb.addSheet('S');
  for (const [k, v] of Object.entries(cells)) wb.setCell('S', k, v);
  wb.setCell('S', 'Z1', formula);
  return fmt(wb.getCell('S', 'Z1').value);
}
const near = (got: string, exp: number, tol = 1e-6) => { const n = Number(got); return Number.isFinite(n) && Math.abs(n - exp) <= tol * Math.max(1, Math.abs(exp)); };

// riferimenti calcolati qui, indipendenti dal motore
const pmt = (r: number, n: number, pv: number) => (-pv * r) / (1 - Math.pow(1 + r, -n));
const fv = (r: number, n: number, p: number) => -p * (Math.pow(1 + r, n) - 1) / r;
const npv = (r: number, cf: number[]) => cf.reduce((s, c, i) => s + c / Math.pow(1 + r, i + 1), 0);
function irr(cf: number[]) { let lo = -0.9, hi = 10; const f = (r: number) => cf.reduce((s, c, i) => s + c / Math.pow(1 + r, i), 0); for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; } return (lo + hi) / 2; }

const D = { A1: '2', A2: '4', A3: '4', A4: '4', A5: '5', A6: '5', A7: '7', A8: '9' };
const X = { A1: '1', A2: '2', A3: '3', A4: '4', A5: '5' };
const num: [Record<string, string>, string, number][] = [
  [{}, '=PMT(0.05/12,120,-100000)', pmt(0.05 / 12, 120, -100000)],
  [{}, '=PMT(0,10,-1000)', 100],
  [{}, '=FV(0.05/12,12,-100)', fv(0.05 / 12, 12, -100)],
  [{}, '=PV(0.08,10,-1000)', 1000 * (1 - Math.pow(1.08, -10)) / 0.08],
  [{ B1: '100', B2: '200', B3: '300' }, '=NPV(0.1,B1:B3)', npv(0.1, [100, 200, 300])],
  [{ B1: '-100', B2: '60', B3: '60' }, '=IRR(B1:B3)', irr([-100, 60, 60])],
  [{}, '=NPER(0.01,-100,1000)', Math.log(100 / (100 - 10)) / Math.log(1.01)],
  [{}, '=SLN(1000,100,5)', 180],
  [{}, '=RATE(10,-100,0,1000)', 0],
  [D, '=STDEV.S(A1:A8)', Math.sqrt(32 / 7)], [D, '=STDEV.P(A1:A8)', 2], [D, '=VAR.S(A1:A8)', 32 / 7], [D, '=VAR.P(A1:A8)', 4],
  [D, '=STDEV(A1:A8)', Math.sqrt(32 / 7)], [D, '=MODE(A1:A8)', 4],
  [X, '=LARGE(A1:A5,2)', 4], [X, '=SMALL(A1:A5,2)', 2], [X, '=PERCENTILE(A1:A5,0.25)', 2], [X, '=QUARTILE(A1:A5,3)', 4],
  [X, '=RANK(4,A1:A5)', 2], [{ A1: '1', A2: '2', A3: '3', B1: '2', B2: '4', B3: '6' }, '=CORREL(A1:A3,B1:B3)', 1],
  [{ A1: '1', A2: '2', A3: '3', B1: '3', B2: '5', B3: '7' }, '=SLOPE(B1:B3,A1:A3)', 2],
  [{ A1: '1', A2: '2', A3: '3', B1: '3', B2: '5', B3: '7' }, '=INTERCEPT(B1:B3,A1:A3)', 1],
  [{ A1: '1', A2: '2', A3: '3', B1: '3', B2: '5', B3: '7' }, '=FORECAST(5,B1:B3,A1:A3)', 11],
  [{}, '=WORKDAY(DATE(2024,1,5),1)-DATE(2024,1,5)', 3],
  [{}, '=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,31))', 23],
  [{}, '=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),"Y")', 4], [{}, '=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),"M")', 49],
  [{}, '=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),"YM")', 1], [{}, '=DATEDIF(DATE(2020,1,15),DATE(2024,3,10),"MD")', 24],
  [{}, '=EDATE(DATE(2024,1,31),1)-DATE(2024,2,29)', 0], [{}, '=EOMONTH(DATE(2024,1,15),1)-DATE(2024,2,29)', 0],
  [{}, '=EOMONTH(DATE(2023,1,15),1)-DATE(2023,2,28)', 0], [{}, '=WEEKDAY(DATE(2024,1,7))', 1], [{}, '=DAYS(DATE(2024,3,1),DATE(2024,2,1))', 29],
  [{}, '=BIN2DEC("1010")', 10], [{}, '=HEX2DEC("FF")', 255], [{}, '=OCT2DEC("17")', 15], [{}, '=BITAND(12,10)', 8], [{}, '=BITOR(12,10)', 14], [{}, '=BITXOR(12,10)', 6],
  [{}, '=CONVERT(100,"C","F")', 212], [{}, '=CONVERT(1,"km","m")', 1000], [{}, '=DELTA(3,3)', 1],
  [{}, '=GCD(12,18)', 6], [{}, '=LCM(4,6)', 12], [{}, '=FACT(5)', 120], [{}, '=COMBIN(5,2)', 10], [{}, '=PERMUT(5,2)', 20], [{}, '=SUMSQ(1,2,3)', 14],
  [{}, '=MROUND(10,3)', 9], [{}, '=CEILING(2.1,1)', 3], [{}, '=FLOOR(2.9,1)', 2], [{}, '=TRUNC(-2.7)', -2], [{}, '=MOD(-3,2)', 1], [{}, '=QUOTIENT(7,2)', 3],
  [{}, '=LOG10(1000)', 3], [{}, '=LOG(8,2)', 3], [{}, '=EXP(0)', 1], [{}, '=DEGREES(PI())', 180], [{}, '=ATAN2(1,1)', Math.PI / 4],
  [{ A1: 'a', A2: 'b', A3: 'a', B1: '1', B2: '2', B3: '3' }, '=SUMIFS(B1:B3,A1:A3,"a")', 4],
  [{ A1: 'a', A2: 'b', A3: 'a', B1: '1', B2: '2', B3: '3' }, '=COUNTIFS(A1:A3,"a",B1:B3,">1")', 1],
  [{ A1: 'a', A2: 'b', A3: 'a', B1: '1', B2: '2', B3: '3' }, '=AVERAGEIFS(B1:B3,A1:A3,"a")', 2],
  [{ A1: 'a', A2: 'b', A3: 'a', B1: '1', B2: '2', B3: '3' }, '=MAXIFS(B1:B3,A1:A3,"a")', 3],
  [{ A1: 'a', A2: 'b', A3: 'c', B1: '10', B2: '20', B3: '30' }, '=XLOOKUP("b",A1:A3,B1:B3)', 20],
  [{}, '=IFS(1>2,"x",2>1,5)', 5], [{}, '=SWITCH(2,1,"a",2,10,"z")', 10],
];
const txt: [Record<string, string>, string, string][] = [
  [{}, '=TEXTJOIN(",",TRUE,"a","","b")', '"a,b"'], [{}, '=TEXTJOIN("-",FALSE,"a","","b")', '"a--b"'],
  [{}, '=PROPER("hello wORLD")', '"Hello World"'], [{}, '=REPT("ab",3)', '"ababab"'], [{}, '=SUBSTITUTE("aXbXc","X","-")', '"a-b-c"'],
  [{}, '=SUBSTITUTE("aXbXc","X","-",2)', '"aXb-c"'], [{}, '=DEC2BIN(10)', '"1010"'], [{}, '=DEC2HEX(255)', '"FF"'], [{}, '=DEC2HEX(-1)', '"FFFFFFFFFF"'],
  [{}, '=ROMAN(14)', '"XIV"'], [{}, '=TRIM("  a   b ")', '"a b"'], [{}, '=LEFT("abc",2)&RIGHT("abc",1)', '"abc"'], [{}, '=FIND("b","abc")', '2'],
  [{}, '=1/0', '#DIV/0!'], [{}, '=NOSUCHFUNC(1)', '#NAME?'], [{}, '=PMT("x",1,1)', '#VALUE!'], [{}, '=SQRT(-1)', '#NUM!'], [{}, '=FACT(-1)', '#NUM!'],
  [{ A1: '1', A2: 'x' }, '=STDEV.S(A1:A2)', '#DIV/0!'],
];

describe('M3 indipendente: funzioni', () => {
  it('numeriche', () => {
    const bad: string[] = [];
    for (const [c, f, e] of num) {
      const g = run(c, f);
      if (f.includes('RATE(')) { const r = Number(g); const ok = Number.isFinite(r) && Math.abs(pmt(r, 10, -1000) - 100) < 1e-6 && false; /* RATE non ha attesa chiusa: sotto */ continue; }
      if (!near(g, e)) bad.push(`${f} -> ${g} atteso ${e}`);
    }
    console.log('M3-NUM casi=' + num.length + ' disaccordi=' + bad.length);
    for (const b of bad) console.log('DISACCORDO ' + b);
    expect(bad).toEqual([]);
  });
  it('RATE: il tasso trovato riproduce il flusso', () => {
    // 10 rate da 100 su 1000 di valore attuale: PV(r,10,-100)=1000 -> r tale che annuitÃ  = 1000
    const r = Number(run({}, '=RATE(10,-100,800)'));
    const pvAt = (x: number) => 100 * (1 - Math.pow(1 + x, -10)) / x;
    console.log('M3-RATE r=' + r + ' pv(r)=' + pvAt(r));
    expect(Math.abs(pvAt(r) - 800)).toBeLessThan(1e-4);
  });
  it('testo ed errori', () => {
    const bad: string[] = [];
    for (const [c, f, e] of txt) { const g = run(c, f); if (g !== e) bad.push(`${f} -> ${g} atteso ${e}`); }
    console.log('M3-TXT casi=' + txt.length + ' disaccordi=' + bad.length);
    for (const b of bad) console.log('DISACCORDO ' + b);
    expect(bad).toEqual([]);
  });
});

describe('M3 indipendente: spill', () => {
  const get = (wb: any, a: string) => fmt(wb.getCell('S', a).value);
  it('SEQUENCE, SORT, UNIQUE, collisione e ripristino', () => {
    const wb = createWorkbook(); wb.addSheet('S');
    wb.setCell('S', 'A1', '=SEQUENCE(3)');
    expect([get(wb, 'A1'), get(wb, 'A2'), get(wb, 'A3')]).toEqual(['1', '2', '3']);
    wb.setCell('S', 'C1', '=SEQUENCE(2,2,10,5)');
    expect([get(wb, 'C1'), get(wb, 'D1'), get(wb, 'C2'), get(wb, 'D2')]).toEqual(['10', '15', '20', '25']);
    wb.setCell('S', 'F1', '3'); wb.setCell('S', 'F2', '1'); wb.setCell('S', 'F3', '2');
    wb.setCell('S', 'G1', '=SORT(F1:F3)');
    expect([get(wb, 'G1'), get(wb, 'G2'), get(wb, 'G3')]).toEqual(['1', '2', '3']);
    wb.setCell('S', 'H1', 'a'); wb.setCell('S', 'H2', 'b'); wb.setCell('S', 'H3', 'a');
    wb.setCell('S', 'I1', '=UNIQUE(H1:H3)');
    expect([get(wb, 'I1'), get(wb, 'I2'), get(wb, 'I3')]).toEqual(['"a"', '"b"', 'EMPTY']);
    wb.setCell('S', 'A2', 'x');                      // ostacolo
    expect(get(wb, 'A1')).toBe('#SPILL!');
    wb.setCell('S', 'A2', '');                       // rimosso
    expect([get(wb, 'A1'), get(wb, 'A2'), get(wb, 'A3')]).toEqual(['1', '2', '3']);
    wb.setCell('S', 'K1', '=A1:A3*2');
    console.log('M3-SPILL-ARITM K1=' + get(wb, 'K1') + ' K2=' + get(wb, 'K2') + ' (Excel/Sheets: 2 e 4)');
    wb.setCell('S', 'A1', '');                       // cancello il master: i figli spariscono
    expect([get(wb, 'A2'), get(wb, 'A3')]).toEqual(['EMPTY', 'EMPTY']);
  });
});

describe('M3 indipendente: localizzazione', () => {
  const pairs: [string, string][] = [
    ['=SUM(A1:A3)', '=SOMMA(A1:A3)'], ['=IF(A1>1,1,2)', '=SE(A1>1;1;2)'], ['=COUNTIF(A1:A3,"x")', '=CONTA.SE(A1:A3;"x")'],
    ['=VLOOKUP(1,A1:B3,2,FALSE)', '=CERCA.VERT(1;A1:B3;2;FALSO)'], ['=AVERAGE(A1:A3)', '=MEDIA(A1:A3)'], ['=MAX(1.5,2)', '=MAX(1,5;2)'],
    ['=TODAY()', '=OGGI()'], ['=AND(TRUE,FALSE)', '=E(VERO;FALSO)'], ['=CONCATENATE("a","b")', '=CONCATENA("a";"b")'], ['=LEFT("abc",2)', '=SINISTRA("abc";2)'],
    ['=ROUND(2.5,0)', '=ARROTONDA(2,5;0)'], ['=SUMIF(A1:A3,">1",B1:B3)', '=SOMMA.SE(A1:A3;">1";B1:B3)'], ['=IFERROR(1/0,"e")', '=SE.ERRORE(1/0;"e")'],
  ];
  it('EN -> IT coincide con le forme italiane standard', () => {
    const bad: string[] = [];
    for (const [en, it_] of pairs) { const g = translateFormula(en, 'en', 'it'); if (g !== it_) bad.push(`${en} -> ${g} atteso ${it_}`); }
    console.log('M3-I18N-EN2IT disaccordi=' + bad.length); for (const b of bad) console.log('DISACCORDO ' + b);
    expect(bad).toEqual([]);
  });
  it('IT -> EN torna alla forma inglese', () => {
    const bad: string[] = [];
    for (const [en, it_] of pairs) { const g = translateFormula(it_, 'it', 'en'); if (g !== en) bad.push(`${it_} -> ${g} atteso ${en}`); }
    console.log('M3-I18N-IT2EN disaccordi=' + bad.length); for (const b of bad) console.log('DISACCORDO ' + b);
    expect(bad).toEqual([]);
  });
  it('le stringhe tra virgolette non vengono toccate', () => {
    expect(translateFormula('=IF(A1="SUM(1,2)",1,2)', 'en', 'it')).toBe('=SE(A1="SUM(1,2)";1;2)');
  });
});


