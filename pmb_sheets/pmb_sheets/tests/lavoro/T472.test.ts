import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { parseFormula } from '../../src/engine/parser';
import { printAst } from '../../src/engine/ast-printer';
import { shiftFormula } from '../../src/engine/shift-formula';

type Dati = Record<string, string>;
/** Calcola una formula in D1 (con A1:C5 e G1:H4 come da dati) e dà il testo del risultato: numeri come numeri, testo tra virgolette, errori col nome. */
function calcola(formula: string, dati: Dati = {}, cella = 'J1'): string {
  const wb = createWorkbook();
  for (const [a, v] of Object.entries(dati)) wb.setCell('Foglio1', a, v);
  wb.setCell('Foglio1', cella, formula);
  const v = wb.getCell('Foglio1', cella).value;
  return mostra(v);
}
function mostra(v: { kind: string; [k: string]: unknown }): string {
  if (v.kind === 'number') return String(Number((v.value as number).toPrecision(12)));
  if (v.kind === 'text') return JSON.stringify(v.value);
  if (v.kind === 'boolean') return v.value ? 'TRUE' : 'FALSE';
  if (v.kind === 'error') return v.error as string;
  if (v.kind === 'empty') return '';
  return `array:${JSON.stringify(v.values)}`;
}
function colonna(formula: string, dati: Dati, cella: string, righe: number): string[] {
  const wb = createWorkbook();
  for (const [a, v] of Object.entries(dati)) wb.setCell('Foglio1', a, v);
  wb.setCell('Foglio1', cella, formula);
  const col = cella.replace(/\d+/g, '');
  const r0 = Number(cella.replace(/\D+/g, ''));
  return Array.from({ length: righe }, (_, i) => mostra(wb.getCell('Foglio1', `${col}${r0 + i}`).value));
}

const A = { A1: '5', A2: '12', A3: '20', A4: '8', A5: '30' };
const MELE = { B1: 'mela', B2: 'pera', B3: 'mela', B4: 'kiwi', B5: 'mela' };

describe('T472: calcolo su intervalli e matrici (matrici dinamiche)', () => {
  it('SUMPRODUCT con condizioni', () => {
    expect(calcola('=SUMPRODUCT((A1:A5>10)*1)', A)).toBe('3');
    expect(calcola('=SUMPRODUCT(--(B1:B5="mela"))', MELE)).toBe('3');
    expect(calcola('=SUMPRODUCT((B1:B5="mela")*(A1:A5))', { ...A, ...MELE })).toBe('55');
  });
  it('SUM, MAX e SUM(IF()) su espressioni con intervalli', () => {
    expect(calcola('=SUM(A1:A5*2)', A)).toBe('150');
    expect(calcola('=MAX(A1:A5*C1:C5)', { ...A, C1: '1', C2: '2', C3: '3', C4: '4', C5: '5' })).toBe('150');
    expect(calcola('=SUM(IF(A1:A5>10,1,0))', A)).toBe('3');
  });
  it('FILTER e funzioni che lo usano', () => {
    expect(colonna('=FILTER(A1:A5,A1:A5>10)', A, 'J1', 3)).toEqual(['12', '20', '30']);
    expect(calcola('=SUM(FILTER(A1:A5,A1:A5>10))', A)).toBe('62');
    expect(calcola('=INDEX(SORT(A1:A5),2)', A)).toBe('8');
  });
  it('un intervallo da solo si espande; una cella sola vale il suo contenuto', () => {
    expect(colonna('=A1:A3', A, 'J1', 3)).toEqual(['5', '12', '20']);
    expect(calcola('=A1:A1', A)).toBe('5');
  });
  it('IF e IFERROR su intervalli lavorano elemento per elemento', () => {
    expect(colonna('=IF(A1:A5>10,"alto","basso")', A, 'J1', 5)).toEqual(['"basso"', '"alto"', '"alto"', '"basso"', '"alto"']);
    expect(colonna('=IFERROR(10/(A1:A3-12),0)', A, 'J1', 3)).toEqual(['-1.42857142857', '0', '1.25']);
  });
  it('funzioni a un valore alla volta applicate a un intervallo', () => {
    expect(colonna('=ROUND(A1:A3/7,1)', A, 'J1', 3)).toEqual(['0.7', '1.7', '2.9']);
    expect(colonna('=UPPER(B1:B3)', MELE, 'J1', 3)).toEqual(['"MELA"', '"PERA"', '"MELA"']);
    expect(calcola('=SUM(LEN(B1:B5))', MELE)).toBe('20');
  });
  it('+"x" vale "x"', () => {
    expect(calcola('=+"x"')).toBe('"x"');
    expect(calcola('=+5')).toBe('5');
  });
});

describe('T472: argomenti vuoti e costanti matrice', () => {
  const G = { G1: '1', G2: '3', G3: '5', G4: '7', H1: 'a', H2: 'b', H3: 'c', H4: 'd' };
  it('XLOOKUP con argomento vuoto e modalità di ricerca', () => {
    expect(calcola('=XLOOKUP(4,G1:G4,H1:H4,,-1)', G)).toBe('"b"');
  });
  it('IF con ramo vuoto vale 0', () => {
    expect(calcola('=IF(TRUE,,5)')).toBe('0');
    expect(calcola('=IF(FALSE,5,)')).toBe('0');
  });
  it('INDEX con riga vuota prende tutta la colonna', () => {
    expect(colonna('=INDEX(G1:H4,,2)', G, 'J1', 4)).toEqual(['"a"', '"b"', '"c"', '"d"']);
  });
  it('costanti matrice: {1,2;3,4}', () => {
    expect(calcola('=SUM({1,2;3,4})')).toBe('10');
    expect(colonna('=FREQUENCY(A1:A5,{10,20})', A, 'J1', 3)).toEqual(['2', '2', '1']);
    expect(calcola('=INDEX({10,20,30},2)')).toBe('20');
    expect(calcola('=SUM({-1,2})')).toBe('1');
  });
  it('si leggono e si riscrivono senza cambiare', () => {
    for (const f of ['=SUM({1,2;3,4})', '=IF(A1,,B1)', '=INDEX(A1:B3,,2)', '=XLOOKUP(1,A1:A3,B1:B3,,-1)']) {
      const p = parseFormula(f);
      expect(p.error).toBeUndefined();
      expect(`=${printAst(p.ast!)}`).toBe(f);
    }
    expect(shiftFormula('=IF(A1,,B1)', 1, 1)).toBe('=IF(B2,,C2)');
  });
  it('righe di lunghezza diversa o parentesi mancanti sono un errore di lettura', () => {
    expect(parseFormula('=SUM({1,2;3})').error).toBeTruthy();
    expect(parseFormula('=SUM({1,2').error).toBeTruthy();
  });
});

describe('T472: riferimenti: OFFSET, INDIRECT, LET', () => {
  it('OFFSET su una cella sola dà il valore; su un intervallo una matrice', () => {
    expect(calcola('=OFFSET(A1,2,0)', A)).toBe('20');
    expect(calcola('=SUM(OFFSET(A1,1,0,3,1))', A)).toBe('40');
  });
  it('INDIRECT legge la cella indicata dal testo', () => {
    expect(calcola('=INDIRECT("A2")', A)).toBe('12');
    expect(calcola('=SUM(INDIRECT("A1:A3"))', A)).toBe('37');
    expect(calcola('=INDIRECT("B"&2)', { B2: 'ciao' })).toBe('"ciao"');
    expect(calcola('=INDIRECT("zzz")')).toBe('#REF!');
  });
  it('LET dà nomi ai valori', () => {
    expect(calcola('=LET(x,5,y,x*2,y+1)')).toBe('11');
    expect(calcola('=LET(r,A1:A5,SUM(r)/COUNT(r))', A)).toBe('15');
    expect(calcola('=LET(x,5,x+z)')).toBe('#NAME?');
    expect(calcola('=LET(x,5)')).toBe('#VALUE!');
  });
  it('un nome sconosciuto dà #NAME?', () => {
    expect(calcola('=pippo+1')).toBe('#NAME?');
  });
});

describe('T472: confronti', () => {
  it('0,1+0,2 è uguale a 0,3', () => {
    expect(calcola('=0.1+0.2=0.3')).toBe('TRUE');
    expect(calcola('=0.1+0.2<>0.3')).toBe('FALSE');
    expect(calcola('=1.0000000000001=1')).toBe('FALSE'); // una differenza vera non sparisce
  });
});
