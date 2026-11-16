import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { translateFormula } from '../../src/engine/i18n';

type Dati = Record<string, string>;
function mostra(v: { kind: string; [k: string]: unknown }): string {
  if (v.kind === 'number') return String(Number((v.value as number).toPrecision(10)));
  if (v.kind === 'text') return JSON.stringify(v.value);
  if (v.kind === 'boolean') return v.value ? 'TRUE' : 'FALSE';
  if (v.kind === 'error') return v.error as string;
  if (v.kind === 'empty') return '';
  return '?';
}
/** Il risultato della formula in J1 e, se si espande, delle celle sotto/accanto */
function griglia(formula: string, dati: Dati = {}, righe = 1, colonne = 1): string[][] {
  const wb = createWorkbook();
  for (const [a, v] of Object.entries(dati)) wb.setCell('Foglio1', a, v);
  wb.setCell('Foglio1', 'J1', formula);
  const out: string[][] = [];
  for (let r = 0; r < righe; r++) {
    const riga: string[] = [];
    for (let c = 0; c < colonne; c++) riga.push(mostra(wb.getCell('Foglio1', `${String.fromCharCode(74 + c)}${1 + r}`).value));
    out.push(riga);
  }
  return out;
}
const calcola = (formula: string, dati: Dati = {}) => griglia(formula, dati)[0][0];
const A = { A1: '5', A2: '12', A3: '20', A4: '8', A5: '30' };

describe('T474: correzioni a funzioni esistenti', () => {
  it('IPMT e PPMT: ammortamento corretto (segni come negli altri fogli)', () => {
    // prestito di 10.000 al 5% annuo, 60 rate mensili
    expect(calcola('=IPMT(0.05/12,1,60,-10000)')).toBe('41.66666667');
    expect(calcola('=PPMT(0.05/12,1,60,-10000)')).toBe('147.0456698');
    expect(calcola('=IPMT(0.05/12,1,60,10000)')).toBe('-41.66666667');
    expect(calcola('=PPMT(0.05/12,1,60,10000)')).toBe('-147.0456698');
    // rata = interessi + capitale in ogni periodo
    expect(calcola('=PMT(0.05/12,60,-10000)-IPMT(0.05/12,30,60,-10000)-PPMT(0.05/12,30,60,-10000)')).toBe('0');
    expect(calcola('=IPMT(0.05/12,1,60,-10000,0,1)')).toBe('0'); // rate anticipate: la prima non ha interessi
    expect(calcola('=IPMT(0,3,60,-10000)')).toBe('0');
  });
  it('SORT accetta FALSE/VERO e 1/-1 per l\'ordine', () => {
    expect(griglia('=SORT(A1:A5,1,FALSE)', A, 5).map((r) => r[0])).toEqual(['30', '20', '12', '8', '5']);
    expect(griglia('=SORT(A1:A5,1,TRUE)', A, 5).map((r) => r[0])).toEqual(['5', '8', '12', '20', '30']);
    expect(griglia('=SORT(A1:A5,1,-1)', A, 5).map((r) => r[0])).toEqual(['30', '20', '12', '8', '5']);
    expect(griglia('=SORTBY(A1:A5,A1:A5,FALSE)', A, 5).map((r) => r[0])).toEqual(['30', '20', '12', '8', '5']);
  });
  it('le date scritte come testo valgono come date', () => {
    expect(calcola('=DAYS("2026-03-05","2026-03-01")')).toBe('4');
    expect(calcola('=DAYS("05/03/2026","01/03/2026")')).toBe('4');
    expect(calcola('=YEAR("2026-03-05")')).toBe('2026');
    expect(calcola('=EDATE("2026-01-31",1)')).toBe('46081');
    expect(calcola('=DAYS("boh","2026-03-01")')).toBe('#VALUE!');
  });
  it('SEARCH con ? e * (il caso dell\'audit "l?l" in "hello" non ha corrispondenze: #VALUE! è giusto)', () => {
    expect(calcola('=SEARCH("e?l","hello")')).toBe('2');
    expect(calcola('=SEARCH("l*o","hello")')).toBe('3');
    expect(calcola('=SEARCH("l?l","hello")')).toBe('#VALUE!');
  });
  it('i nomi italiani di PARI e DISPARI non collidono più con VAL.PARI e VAL.DISPARI', () => {
    expect(translateFormula('=PARI(3)', 'it', 'en')).toBe('=EVEN(3)');
    expect(translateFormula('=DISPARI(3)', 'it', 'en')).toBe('=ODD(3)');
    expect(translateFormula('=VAL.PARI(3)', 'it', 'en')).toBe('=ISEVEN(3)');
    expect(translateFormula('=VAL.DISPARI(3)', 'it', 'en')).toBe('=ISODD(3)');
    expect(translateFormula('=SEN(1)+ARCTAN(1)+GRADI(1)+RADIANTI(1)', 'it', 'en')).toBe('=SIN(1)+ATAN(1)+DEGREES(1)+RADIANS(1)');
    expect(translateFormula('=SIN(1)', 'en', 'it')).toBe('=SEN(1)');
  });
});

describe('T474: statistica', () => {
  it('COUNTUNIQUE, AVERAGEA, MAXA, MINA, COMBINA', () => {
    expect(calcola('=COUNTUNIQUE(A1:A5,B1:B2)', { ...A, B1: '5', B2: 'x' })).toBe('6');
    expect(calcola('=COUNTUNIQUE(B1:B4)', { B1: 'a', B2: 'A', B3: 'b', B4: '' })).toBe('2');
    expect(calcola('=AVERAGEA(A1:A3)', { A1: '4', A2: 'x', A3: 'TRUE' })).toBe('1.666666667'); // (4+0+1)/3
    expect(calcola('=MAXA(A1:A3)', { A1: '-4', A2: 'x', A3: '-1' })).toBe('0');
    expect(calcola('=MINA(A1:A3)', { A1: '4', A2: 'TRUE', A3: '3' })).toBe('1');
    expect(calcola('=COMBINA(4,3)')).toBe('20');
    expect(calcola('=COMBINA(10,0)')).toBe('1');
    expect(calcola('=COMBINA(-1,2)')).toBe('#NUM!');
  });
  it('distribuzione normale', () => {
    expect(calcola('=NORM.S.DIST(0,TRUE)')).toBe('0.5');
    expect(calcola('=NORM.S.DIST(1.96,TRUE)')).toBe('0.9750021049');
    expect(calcola('=NORM.DIST(110,100,15,TRUE)')).toBe('0.7475074625');
    expect(calcola('=NORM.DIST(100,100,15,FALSE)')).toBe('0.02659615203');
    expect(calcola('=NORM.S.DIST(0,FALSE)')).toBe('0.3989422804');
    expect(calcola('=NORM.INV(0.975,0,1)')).toBe('1.959963985');
    expect(calcola('=NORM.S.INV(0.5)')).toBe('0');
    expect(calcola('=NORM.INV(0.9,100,15)')).toBe('119.2232735');
    expect(calcola('=NORM.INV(1.5,0,1)')).toBe('#NUM!');
    expect(calcola('=NORM.DIST(1,0,0,TRUE)')).toBe('#NUM!');
  });
  it('TREND e LINEST (retta di regressione)', () => {
    const d = { A1: '1', A2: '2', A3: '3', A4: '4', B1: '3', B2: '5', B3: '7', B4: '9' }; // y = 2x + 1
    expect(griglia('=LINEST(B1:B4,A1:A4)', d, 1, 2)[0]).toEqual(['2', '1']);
    expect(griglia('=TREND(B1:B4,A1:A4,A5:A6)', { ...d, A5: '5', A6: '6' }, 2)[0][0]).toBe('11');
    expect(griglia('=TREND(B1:B4,A1:A4,A5:A6)', { ...d, A5: '5', A6: '6' }, 2)[1][0]).toBe('13');
    expect(calcola('=TREND(B1:B4,A1:A4,10)', d)).toBe('21');
    const stat = griglia('=LINEST(B1:B4,A1:A4,TRUE,TRUE)', d, 5, 2);
    expect(stat[2][0]).toBe('1'); // r²
    expect(stat[3][1]).toBe('2'); // gradi di libertà
    expect(griglia('=LINEST(B1:B4,A1:A4,FALSE)', d, 1, 2)[0][1]).toBe('0'); // senza intercetta
    expect(calcola('=LINEST(B1:B4,A1:A1)', d)).toMatch(/#/);
  });
});

describe('T474: riepiloghi', () => {
  it('SUBTOTAL: i codici 1-11 e 101-111', () => {
    const d = { A1: '4', A2: '8', A3: '6' };
    expect([1, 2, 3, 4, 5, 6, 9].map((n) => calcola(`=SUBTOTAL(${n},A1:A3)`, d))).toEqual(['6', '3', '3', '8', '4', '192', '18']);
    expect(calcola('=SUBTOTAL(109,A1:A3)', d)).toBe('18');
    expect(calcola('=SUBTOTAL(12,A1:A3)', d)).toBe('#VALUE!');
  });
  it('AGGREGATE: funzioni 1-19 e opzione per ignorare gli errori', () => {
    const d = { A1: '4', A2: '=1/0', A3: '6', A4: '10' };
    expect(calcola('=AGGREGATE(9,6,A1:A4)', d)).toBe('20'); // somma ignorando gli errori
    expect(calcola('=AGGREGATE(9,0,A1:A4)', d)).toBe('#DIV/0!');
    expect(calcola('=AGGREGATE(14,6,A1:A4,1)', d)).toBe('10'); // il più grande
    expect(calcola('=AGGREGATE(15,6,A1:A4,2)', d)).toBe('6'); // il secondo più piccolo
    expect(calcola('=AGGREGATE(12,6,A1:A4)', d)).toBe('6'); // mediana
    expect(calcola('=AGGREGATE(30,6,A1:A4)', d)).toBe('#VALUE!');
  });
});

describe('T474: finanza', () => {
  it('EFFECT e NOMINAL', () => {
    expect(calcola('=EFFECT(0.12,12)')).toBe('0.1268250301');
    expect(calcola('=NOMINAL(0.1268250301,12)')).toBe('0.12');
    expect(calcola('=EFFECT(-1,12)')).toBe('#NUM!');
  });
  it('XNPV e XIRR', () => {
    const d = { A1: '-10000', A2: '2750', A3: '4250', A4: '3250', A5: '2750', B1: '2008-01-01', B2: '2008-03-01', B3: '2008-10-30', B4: '2009-02-15', B5: '2009-04-01' };
    expect(calcola('=XNPV(0.09,A1:A5,B1:B5)', d)).toBe('2086.647602');
    expect(calcola('=XIRR(A1:A5,B1:B5)', d)).toBe('0.3733625335');
    expect(calcola('=XIRR(A1:A2,B1:B2)', { A1: '100', A2: '200', B1: '2020-01-01', B2: '2021-01-01' })).toBe('#NUM!');
  });
  it('MIRR', () => {
    const d = { A1: '-120000', A2: '39000', A3: '30000', A4: '21000', A5: '37000', A6: '46000' };
    expect(calcola('=MIRR(A1:A6,0.1,0.12)', d)).toBe('0.1260941304');
  });
  it('CUMIPMT e CUMPRINC', () => {
    expect(calcola('=CUMIPMT(0.09/12,360,125000,13,24,0)')).toBe('-11135.23213');
    expect(calcola('=CUMPRINC(0.09/12,360,125000,13,24,0)')).toBe('-934.1071234');
    expect(calcola('=CUMIPMT(0.09/12,360,125000,0,24,0)')).toBe('#NUM!');
  });
});

describe('T474: calendario', () => {
  it('NETWORKDAYS.INTL con i vari codici di fine settimana', () => {
    // dal lunedì 2026-03-02 alla domenica 2026-03-08
    expect(calcola('=NETWORKDAYS.INTL("2026-03-02","2026-03-08")')).toBe('5');
    expect(calcola('=NETWORKDAYS.INTL("2026-03-02","2026-03-08",11)')).toBe('6'); // solo la domenica di riposo
    expect(calcola('=NETWORKDAYS.INTL("2026-03-02","2026-03-08",7)')).toBe('5'); // riposo venerdì-sabato
    expect(calcola('=NETWORKDAYS.INTL("2026-03-02","2026-03-08","0000011")')).toBe('5');
    expect(calcola('=NETWORKDAYS.INTL("2026-03-02","2026-03-08","1000001")')).toBe('5'); // riposo lunedì e domenica
    expect(calcola('=NETWORKDAYS.INTL("2026-03-02","2026-03-08",1,"2026-03-04")')).toBe('4'); // con un festivo
    expect(calcola('=NETWORKDAYS.INTL("2026-03-08","2026-03-02")')).toBe('-5');
    expect(calcola('=NETWORKDAYS.INTL("2026-03-02","2026-03-08",99)')).toBe('#VALUE!');
  });
  it('WORKDAY.INTL', () => {
    expect(calcola('=WORKDAY.INTL("2026-03-06",1)')).toBe(calcola('=DATE(2026,3,9)')); // da venerdì al lunedì 9 marzo
    expect(calcola('=WORKDAY.INTL("2026-03-06",1,11)')).toBe(calcola('=DATE(2026,3,7)')); // con riposo la domenica, il sabato conta
    expect(calcola('=WORKDAY.INTL("2026-03-09",-1)')).toBe(calcola('=DATE(2026,3,6)'));
    expect(calcola('=WORKDAY.INTL("2026-03-06",0)')).toBe(calcola('=DATE(2026,3,6)'));
    expect(calcola('=WORKDAY.INTL("2026-03-06",2,1,"2026-03-09")')).toBe(calcola('=DATE(2026,3,11)'));
  });
});

describe('T474: matrici', () => {
  it('VSTACK e HSTACK', () => {
    const d = { A1: '1', A2: '2', B1: 'a', B2: 'b', B3: 'c' };
    expect(griglia('=VSTACK(A1:A2,B1:B3)', d, 5).map((r) => r[0])).toEqual(['1', '2', '"a"', '"b"', '"c"']);
    expect(griglia('=HSTACK(A1:A2,B1:B3)', d, 3, 2)).toEqual([['1', '"a"'], ['2', '"b"'], ['#N/A', '"c"']]);
    expect(griglia('=VSTACK(A1:B2,B3)', d, 3, 2)[2]).toEqual(['"c"', '#N/A']);
  });
  it('TEXTSPLIT', () => {
    expect(griglia('=TEXTSPLIT("a,b,c",",")', {}, 1, 3)[0]).toEqual(['"a"', '"b"', '"c"']);
    expect(griglia('=TEXTSPLIT("a,b;c,d",",",";")', {}, 2, 2)).toEqual([['"a"', '"b"'], ['"c"', '"d"']]);
    expect(griglia('=TEXTSPLIT("a,,c",",",,TRUE)', {}, 1, 2)[0]).toEqual(['"a"', '"c"']);
    expect(griglia('=TEXTSPLIT("a,b;c",",",";",FALSE,0,"-")', {}, 2, 2)).toEqual([['"a"', '"b"'], ['"c"', '"-"']]);
    expect(griglia('=TEXTSPLIT("a-b+c",{"-","+"})', {}, 1, 3)[0]).toEqual(['"a"', '"b"', '"c"']);
    expect(griglia('=TEXTSPLIT("aXbxc","x",,FALSE,1)', {}, 1, 3)[0]).toEqual(['"a"', '"b"', '"c"']);
  });
  it('RANDARRAY: dimensioni e intervallo', () => {
    const g = griglia('=RANDARRAY(3,2,10,20,TRUE)', {}, 3, 2);
    for (const r of g) for (const c of r) { const n = Number(c); expect(Number.isInteger(n) && n >= 10 && n <= 20).toBe(true); }
    const u = Number(calcola('=RANDARRAY()'));
    expect(u >= 0 && u < 1).toBe(true);
    expect(calcola('=RANDARRAY(0)')).toBe('#VALUE!');
  });
  it('MDETERM e MINVERSE', () => {
    const d = { A1: '4', B1: '7', A2: '2', B2: '6' };
    expect(calcola('=MDETERM(A1:B2)', d)).toBe('10');
    expect(griglia('=MINVERSE(A1:B2)', d, 2, 2)).toEqual([['0.6', '-0.7'], ['-0.2', '0.4']]);
    expect(calcola('=MDETERM(A1:B2)', { A1: '1', B1: '2', A2: '2', B2: '4' })).toBe('0');
    expect(calcola('=MINVERSE(A1:B2)', { A1: '1', B1: '2', A2: '2', B2: '4' })).toBe('#NUM!');
    expect(calcola('=MDETERM(A1:B3)', { A1: '1', B1: '2', A2: '2', B2: '4', A3: '1', B3: '1' })).toBe('#VALUE!');
  });
  it('SEC, CSC, COT', () => {
    expect(calcola('=SEC(0)')).toBe('1');
    expect(calcola('=CSC(PI()/2)')).toBe('1');
    expect(calcola('=COT(PI()/4)')).toBe('1');
    expect(calcola('=CSC(0)')).toBe('#DIV/0!');
  });
});

describe('T474: ISFORMULA, FORMULATEXT, CELL', () => {
  const d = { A1: '5', A2: '=A1*2', A3: 'ciao' };
  it('ISFORMULA e FORMULATEXT', () => {
    expect(calcola('=ISFORMULA(A2)', d)).toBe('TRUE');
    expect(calcola('=ISFORMULA(A1)', d)).toBe('FALSE');
    expect(calcola('=FORMULATEXT(A2)', d)).toBe('"=A1*2"');
    expect(calcola('=FORMULATEXT(A1)', d)).toBe('#N/A');
  });
  it('CELL', () => {
    expect(calcola('=CELL("row",A3)', d)).toBe('3');
    expect(calcola('=CELL("col",C1)', d)).toBe('3');
    expect(calcola('=CELL("address",B4)', d)).toBe('"$B$4"');
    expect(calcola('=CELL("contents",A3)', d)).toBe('"ciao"');
    expect(calcola('=CELL("type",A3)', d)).toBe('"l"');
    expect(calcola('=CELL("type",A1)', d)).toBe('"v"');
    expect(calcola('=CELL("type",C9)', d)).toBe('"b"');
    expect(calcola('=CELL("boh",A1)', d)).toBe('#VALUE!');
  });
});
