import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { columnIndexToLetters } from '../../src/engine/address';
import { translateFormula } from '../../src/engine/i18n';
import { shiftFormula } from '../../src/engine/shift-formula';
import { parseFormula } from '../../src/engine/parser';
import { printAst } from '../../src/engine/ast-printer';
import { avvisiScritturaXlsx } from '../../src/formati/xlsx-scrivi';
import { foglioVuoto } from '../../src/formati/scambio';

type V = { kind: string; value?: unknown; values?: Array<Array<{ kind: string; value?: unknown; error?: string }>>; error?: string };

function calcola(formula: string, dati: Record<string, string> = {}): V {
  const w = createWorkbook();
  for (const [ind, v] of Object.entries(dati)) w.setCell('Foglio1', ind, v);
  w.setCell('Foglio1', 'Z1', formula);
  return w.getCell('Foglio1', 'Z1').value as V;
}
const scalare = (f: string, dati?: Record<string, string>): unknown => { const r = calcola(f, dati); return r.kind === 'error' ? r.error : r.value; };
/** Una formula che dà una matrice si "spande" nelle celle vicine (da Z1): si legge il blocco spanto. */
const matrice = (f: string, dati: Record<string, string> = {}): unknown[][] => {
  const w = createWorkbook();
  for (const [ind, v] of Object.entries(dati)) w.setCell('Foglio1', ind, v);
  w.setCell('Foglio1', 'Z1', f);
  const letto = (r: number, c: number): { kind: string; value?: unknown; error?: string } => w.getCell('Foglio1', `${columnIndexToLetters(26 + c)}${r}`).value as { kind: string; value?: unknown; error?: string };
  const pieno = (r: number, c: number) => letto(r, c).kind !== 'empty';
  let righe = 0; while (pieno(righe + 1, 0)) righe++;
  let colonne = 0; while (pieno(1, colonne)) colonne++;
  if (righe === 0) throw new Error(`${f} → ${JSON.stringify(letto(1, 0))}`);
  const out: unknown[][] = [];
  for (let r = 1; r <= righe; r++) out.push(Array.from({ length: colonne }, (_, c) => { const v = letto(r, c); return v.kind === 'error' ? v.error : v.value; }));
  return out;
};

describe('T505: LAMBDA con un nome (LET) o chiamata subito', () => {
  it('LET dà un nome a una LAMBDA e la si chiama come una funzione', () => {
    expect(scalare('=LET(f,LAMBDA(x,x*2),f(5))')).toBe(10);
    expect(scalare('=LET(somma,LAMBDA(a,b,a+b),somma(2,3))')).toBe(5);
    expect(scalare('=LET(zero,LAMBDA(42),zero())')).toBe(42);
  });
  it('si può chiamare subito dopo averla scritta', () => {
    expect(scalare('=LAMBDA(x,x+1)(4)')).toBe(5);
    expect(scalare('=LAMBDA(a,b,a*b)(3,4)')).toBe(12);
    expect(scalare('=LAMBDA(t,t&"!")("ciao")')).toBe('ciao!');
  });
  it('la funzione ricorda i nomi del momento in cui è nata (chiusura)', () => {
    expect(scalare('=LET(k,10,f,LAMBDA(x,x+k),LET(k,99,f(1)))')).toBe(11);
  });
  it('un parametro con lo stesso nome di un nome esterno lo oscura solo dentro la LAMBDA', () => {
    expect(scalare('=LET(x,100,f,LAMBDA(x,x*2),f(3)+x)')).toBe(106);
  });
  it('una LAMBDA può ricevere un\'altra LAMBDA come argomento', () => {
    expect(scalare('=LET(applica,LAMBDA(g,v,g(v)),raddoppia,LAMBDA(x,x*2),applica(raddoppia,7))')).toBe(14);
    expect(scalare('=LET(compon,LAMBDA(f,g,x,f(g(x))),piuuno,LAMBDA(x,x+1),pertre,LAMBDA(x,x*3),compon(piuuno,pertre,4))')).toBe(13);
  });
  it('il corpo legge le celle e si aggiorna quando cambiano', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'B1', '10');
    w.setCell('Foglio1', 'Z1', '=LAMBDA(x,x*$B$1)(3)');
    expect((w.getCell('Foglio1', 'Z1').value as V).value).toBe(30);
    w.setCell('Foglio1', 'B1', '100');
    expect((w.getCell('Foglio1', 'Z1').value as V).value).toBe(300);
  });
  it('la LAMBDA calcolata con una matrice come argomento lavora elemento per elemento', () => {
    expect(matrice('=LAMBDA(v,v*2)({1,2,3})')).toEqual([[2, 4, 6]]);
  });
});

describe('T505: MAP', () => {
  it('applica la funzione a ogni elemento di un intervallo', () => {
    expect(matrice('=MAP(A1:A3,LAMBDA(x,x*x))', { A1: '1', A2: '2', A3: '3' })).toEqual([[1], [4], [9]]);
  });
  it('con più matrici prende gli elementi corrispondenti', () => {
    expect(matrice('=MAP(A1:A3,B1:B3,LAMBDA(a,b,a+b))', { A1: '1', A2: '2', A3: '3', B1: '10', B2: '20', B3: '30' })).toEqual([[11], [22], [33]]);
  });
  it('lavora anche su matrici a due dimensioni e su costanti matrice', () => {
    expect(matrice('=MAP({1,2;3,4},LAMBDA(x,x+10))')).toEqual([[11, 12], [13, 14]]);
  });
  it('matrici di misure diverse: le posizioni che mancano valgono #N/A', () => {
    expect(matrice('=MAP({1,2,3},{10,20},LAMBDA(a,b,a+b))')).toEqual([[11, 22, '#N/A']]);
  });
  it('un singolo valore dà un singolo valore', () => {
    expect(scalare('=MAP(5,LAMBDA(x,x*2))')).toBe(10);
  });
  it('legge riferimenti assoluti dentro la funzione', () => {
    expect(matrice('=MAP(A1:A2,LAMBDA(x,x*$B$1))', { A1: '1', A2: '2', B1: '10' })).toEqual([[10], [20]]);
  });
  it('se la LAMBDA restituisce più valori, quell\'elemento è #VALUE!', () => {
    expect(matrice('=MAP({1,2},LAMBDA(x,{1,2}))')).toEqual([['#VALUE!', '#VALUE!']]);
  });
  it('un errore in un elemento resta in quell\'elemento', () => {
    expect(matrice('=MAP({1,0,2},LAMBDA(x,10/x))')).toEqual([[10, '#DIV/0!', 5]]);
  });
  it('il numero di parametri deve coincidere con le matrici', () => {
    expect(scalare('=MAP({1,2},LAMBDA(a,b,a+b))')).toBe('#VALUE!');
    expect(scalare('=MAP({1,2},5)')).toBe('#VALUE!');
  });
  it('si aggiorna quando cambia un dato', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '1'); w.setCell('Foglio1', 'A2', '2');
    w.setCell('Foglio1', 'Z1', '=MAP(A1:A2,LAMBDA(x,x+1))');
    w.setCell('Foglio1', 'A2', '50');
    expect((w.getCell('Foglio1', 'Z2').value as V).value).toBe(51);
  });
});

describe('T505: REDUCE e SCAN', () => {
  it('REDUCE piega la matrice in un valore', () => {
    expect(scalare('=REDUCE(0,A1:A4,LAMBDA(acc,x,acc+x))', { A1: '1', A2: '2', A3: '3', A4: '4' })).toBe(10);
    expect(scalare('=REDUCE(1,{1,2,3,4},LAMBDA(a,x,a*x))')).toBe(24);
    expect(scalare('=REDUCE("",{"a","b","c"},LAMBDA(a,x,a&x))')).toBe('abc');
  });
  it('senza valore iniziale parte dal primo elemento', () => {
    expect(scalare('=REDUCE({1,2,3},LAMBDA(a,x,a+x))')).toBe(6);
    expect(scalare('=REDUCE({5},LAMBDA(a,x,a+x))')).toBe(5);
  });
  it('legge la matrice per righe', () => {
    expect(scalare('=REDUCE("",{1,2;3,4},LAMBDA(a,x,a&x))')).toBe('1234');
  });
  it('un errore ferma il calcolo e si propaga', () => {
    expect(scalare('=REDUCE(0,{1,0,2},LAMBDA(a,x,a+10/x))')).toBe('#DIV/0!');
  });
  it('SCAN dà tutti i passaggi', () => {
    expect(matrice('=SCAN(0,{1,2,3,4},LAMBDA(a,x,a+x))')).toEqual([[1, 3, 6, 10]]);
    expect(matrice('=SCAN({1,2,3},LAMBDA(a,x,a*x))')).toEqual([[1, 2, 6]]);
    expect(matrice('=SCAN(0,{1,2;3,4},LAMBDA(a,x,a+x))')).toEqual([[1, 3], [6, 10]]);
  });
  it('parametri sbagliati: #VALUE!', () => {
    expect(scalare('=REDUCE(0,{1,2},LAMBDA(a,a))')).toBe('#VALUE!');
    expect(scalare('=SCAN(0,{1,2},LAMBDA(a,b,c,a))')).toBe('#VALUE!');
  });
});

describe('T505: BYROW, BYCOL e MAKEARRAY', () => {
  it('BYROW dà un valore per riga', () => {
    expect(matrice('=BYROW({1,2;3,4;5,6},LAMBDA(r,SUM(r)))')).toEqual([[3], [7], [11]]);
    expect(matrice('=BYROW({1,2;3,4},LAMBDA(r,MAX(r)-MIN(r)))')).toEqual([[1], [1]]);
  });
  it('BYCOL dà un valore per colonna', () => {
    expect(matrice('=BYCOL({1,2;3,4;5,6},LAMBDA(c,SUM(c)))')).toEqual([[9, 12]]);
    expect(matrice('=BYCOL(A1:B2,LAMBDA(c,SUM(c)))', { A1: '1', A2: '2', B1: '10', B2: '20' })).toEqual([[3, 30]]);
  });
  it('MAKEARRAY costruisce la matrice dalle posizioni (da 1)', () => {
    expect(matrice('=MAKEARRAY(2,3,LAMBDA(r,c,r*10+c))')).toEqual([[11, 12, 13], [21, 22, 23]]);
    expect(scalare('=MAKEARRAY(1,1,LAMBDA(r,c,r+c))')).toBe(2);
  });
  it('MAKEARRAY: misure non valide o troppo grandi danno #NUM!', () => {
    expect(scalare('=MAKEARRAY(0,2,LAMBDA(r,c,1))')).toBe('#NUM!');
    expect(scalare('=MAKEARRAY(1000,1000,LAMBDA(r,c,1))')).toBe('#NUM!');
    expect(scalare('=MAKEARRAY("a",2,LAMBDA(r,c,1))')).toBe('#VALUE!');
  });
  it('un parametro di troppo o di meno: #VALUE!', () => {
    expect(scalare('=BYROW({1,2},LAMBDA(a,b,a))')).toBe('#VALUE!');
    expect(scalare('=MAKEARRAY(2,2,LAMBDA(r,1))')).toBe('#VALUE!');
  });
});

describe('T505: errori e limiti di LAMBDA', () => {
  it('numero di argomenti sbagliato nella chiamata: #VALUE!', () => {
    expect(scalare('=LET(f,LAMBDA(x,x),f(1,2))')).toBe('#VALUE!');
    expect(scalare('=LAMBDA(x,y,x+y)(1)')).toBe('#VALUE!');
  });
  it('una LAMBDA da sola o usata come valore non è un valore', () => {
    expect(scalare('=LAMBDA(x,x)')).toBe('#VALUE!');
    expect(scalare('=LET(f,LAMBDA(x,x),f+1)')).toBe('#VALUE!');
  });
  it('una funzione che non esiste resta #NAME?', () => {
    expect(scalare('=nonesiste(3)')).toBe('#NAME?');
  });
  it('parametri doppi o non nomi: #VALUE!', () => {
    expect(scalare('=LET(f,LAMBDA(x,x,x+1),f(1,2))')).toBe('#VALUE!');
  });
  it('una funzione che si richiama all\'infinito si ferma con #NUM!', () => {
    expect(scalare('=LET(f,LAMBDA(g,x,g(g,x)),f(f,1))')).toBe('#NUM!');
  });
  it('fuori da LET i nomi dei parametri non esistono', () => {
    expect(scalare('=LET(f,LAMBDA(x,x*2),f(2)+x)')).toBe('#NAME?');
  });
});

describe('T505: copiare le formule e tradurle', () => {
  it('spostando la formula si spostano i riferimenti, non i nomi dei parametri', () => {
    expect(shiftFormula('=MAP(A1:A3,LAMBDA(x,x*B1))', 1, 0)).toBe('=MAP(A2:A4,LAMBDA(x,x*B2))');
    expect(shiftFormula('=LAMBDA(x,x+1)(A1)', 2, 1)).toBe('=LAMBDA(x,x+1)(B3)');
    expect(shiftFormula('=REDUCE(0,A1:A4,LAMBDA(a,x,a+x))', 0, 1)).toBe('=REDUCE(0,B1:B4,LAMBDA(a,x,a+x))');
  });
  it('la formula con la chiamata subito dopo la LAMBDA si rilegge e si riscrive uguale', () => {
    const f = '=LAMBDA(a,b,a*b)(3,4)';
    const r = parseFormula(f);
    expect(r.ast).toBeDefined();
    expect(printAst(r.ast!)).toBe('LAMBDA(a,b,a*b)(3,4)');
  });
  it('dall\'italiano all\'inglese e ritorno', () => {
    expect(translateFormula('=LET(f;LAMBDA(x;x*2);f(5))', 'it', 'en')).toBe('=LET(f,LAMBDA(x,x*2),f(5))');
    expect(translateFormula('=SOMMA(MAP(A1:A3;LAMBDA(x;x*2)))', 'it', 'en')).toBe('=SUM(MAP(A1:A3,LAMBDA(x,x*2)))');
    expect(translateFormula('=SUM(MAP(A1:A3,LAMBDA(x,x*2)))', 'en', 'it')).toBe('=SOMMA(MAP(A1:A3;LAMBDA(x;x*2)))');
  });
});

function avvisiTesto(f: ReturnType<typeof foglioVuoto>): string {
  return avvisiScritturaXlsx({ fogli: [f], foglioAttivo: f.nome }).join(' ');
}

describe('T505: esportazione in .xlsx', () => {
  it('LAMBDA e le sue funzioni ora si scrivono come Excel richiede (Fase 49): nessun avviso', () => {
    const f = foglioVuoto('Foglio1');
    f.celle.A1 = '=MAP(B1:B3,LAMBDA(x,x*2))';
    f.celle.A2 = '=SUM(B1:B3)';
    expect(avvisiTesto(f)).not.toMatch(/LAMBDA|MAP/);
  });
  it("senza queste funzioni non c'è nessun avviso", () => {
    const f = foglioVuoto('Foglio1');
    f.celle.A1 = '=SUM(B1:B3)';
    expect(avvisiTesto(f)).toBe('');
  });
});
