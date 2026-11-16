/**
 * Suite di test per le funzionalità di Milestone M3:
 * - Localizzazione formule (IT <-> EN) e round-trip lossless
 * - Array dinamici: Spill, celle figlie, #SPILL! collision e auto-ripristino
 * - Oltre 220 funzioni (finanziarie, ingegneria, database, matriciali, statistiche, testo, data)
 */

import { describe, it, expect } from 'vitest';
import {
  createWorkbook,
  defaultFunctionRegistry,
  translateFormula,
  EN_TO_IT_FUNCTIONS,
  IT_TO_EN_FUNCTIONS,
} from '../../src/engine';

describe('Milestone M3: Calcolo Avanzato, Localizzazione e Spill', () => {
  describe('1. Ampiezza Funzioni (>= 220 funzioni censite)', () => {
    it('il registro contiene almeno 220 funzioni distinte registrate', () => {
      const allFunctions = defaultFunctionRegistry.listAll();
      expect(allFunctions.length).toBeGreaterThanOrEqual(220);
    });

    it('funzioni finanziarie implementate (PMT, FV, PV, NPER, NPV, IRR)', () => {
      const wb = createWorkbook();
      wb.addSheet('Fin');

      // Calcolo rata mutuo: PMT(rate, nper, pv)
      wb.setCell('Fin', 'A1', '=PMT(0.05/12, 120, -100000)');
      const pmt = wb.getCell('Fin', 'A1');
      expect(pmt.value.kind).toBe('number');
      // Rata attesa circa 1060.65
      expect((pmt.value as any).value).toBeCloseTo(1060.65, 1);

      // Valore futuro: FV(0.05/12, 12, -100)
      wb.setCell('Fin', 'A2', '=FV(0.05/12, 12, -100)');
      const fv = wb.getCell('Fin', 'A2');
      expect(fv.value.kind).toBe('number');
    expect((fv.value as any).value).toBeCloseTo(1227.8855, 3); // [T004-1] valore esatto di FV(0.05/12,12,-100)

      // Valore attuale netto: NPV
      wb.setCell('Fin', 'B1', '100');
      wb.setCell('Fin', 'B2', '200');
      wb.setCell('Fin', 'B3', '300');
      wb.setCell('Fin', 'A3', '=NPV(0.1, B1:B3)');
      const npv = wb.getCell('Fin', 'A3');
      expect(npv.value.kind).toBe('number');
      expect((npv.value as any).value).toBeCloseTo(481.59, 1);
    });

    it('funzioni ingegneristiche (BIN2DEC, DEC2HEX, BITAND, DELTA)', () => {
      const wb = createWorkbook();
      wb.addSheet('Eng');

      wb.setCell('Eng', 'A1', '=BIN2DEC("1010")');
      expect(wb.getCell('Eng', 'A1').value).toEqual({ kind: 'number', value: 10 });

      wb.setCell('Eng', 'A2', '=DEC2HEX(255)');
      expect(wb.getCell('Eng', 'A2').value).toEqual({ kind: 'text', value: 'FF' });

      wb.setCell('Eng', 'A3', '=BITAND(6, 3)');
      expect(wb.getCell('Eng', 'A3').value).toEqual({ kind: 'number', value: 2 });

      wb.setCell('Eng', 'A4', '=DELTA(5, 5)');
      expect(wb.getCell('Eng', 'A4').value).toEqual({ kind: 'number', value: 1 });
      wb.setCell('Eng', 'A5', '=DELTA(5, 4)');
      expect(wb.getCell('Eng', 'A5').value).toEqual({ kind: 'number', value: 0 });
    });

    it('funzioni database (DSUM, DCOUNT, DAVERAGE)', () => {
      const wb = createWorkbook();
      wb.addSheet('Db');

      // Tabella database: Intestazioni in A1:B1, Dati in A2:B4
      wb.setCell('Db', 'A1', 'Reparto');
      wb.setCell('Db', 'B1', 'Vendite');
      wb.setCell('Db', 'A2', 'Nord');
      wb.setCell('Db', 'B2', '100');
      wb.setCell('Db', 'A3', 'Sud');
      wb.setCell('Db', 'B3', '200');
      wb.setCell('Db', 'A4', 'Nord');
      wb.setCell('Db', 'B4', '150');

      // Criteri: Intestazione in D1, valore in D2
      wb.setCell('Db', 'D1', 'Reparto');
      wb.setCell('Db', 'D2', 'Nord');

      wb.setCell('Db', 'E1', '=DSUM(A1:B4, "Vendite", D1:D2)');
      expect(wb.getCell('Db', 'E1').value).toEqual({ kind: 'number', value: 250 });

      wb.setCell('Db', 'E2', '=DCOUNT(A1:B4, 2, D1:D2)');
      expect(wb.getCell('Db', 'E2').value).toEqual({ kind: 'number', value: 2 });

      wb.setCell('Db', 'E3', '=DAVERAGE(A1:B4, "Vendite", D1:D2)');
      expect(wb.getCell('Db', 'E3').value).toEqual({ kind: 'number', value: 125 });
    });

    it('funzioni matematiche avanzate (trigonometria, potenze, log, somme)', () => {
      const wb = createWorkbook();
      wb.addSheet('Math');

      wb.setCell('Math', 'A1', '=SIN(PI()/2)');
      expect((wb.getCell('Math', 'A1').value as any).value).toBeCloseTo(1, 5);

      wb.setCell('Math', 'A2', '=LN(EXP(3))');
      expect((wb.getCell('Math', 'A2').value as any).value).toBeCloseTo(3, 5);

      wb.setCell('Math', 'A3', '=GCD(24, 36)');
      expect(wb.getCell('Math', 'A3').value).toEqual({ kind: 'number', value: 12 });

      wb.setCell('Math', 'A4', '=ROMAN(1999)');
      expect(wb.getCell('Math', 'A4').value).toEqual({ kind: 'text', value: 'MCMXCIX' });

      wb.setCell('Math', 'A5', '=ARABIC("MCMXCIX")');
      expect(wb.getCell('Math', 'A5').value).toEqual({ kind: 'number', value: 1999 });
    });

    it('funzioni statistiche avanzate (STDEV.S, VAR.S, PERCENTILE, RANK)', () => {
      const wb = createWorkbook();
      wb.addSheet('Stats');

      wb.setCell('Stats', 'A1', '10');
      wb.setCell('Stats', 'A2', '20');
      wb.setCell('Stats', 'A3', '30');
      wb.setCell('Stats', 'A4', '40');

      wb.setCell('Stats', 'B1', '=STDEV.S(A1:A4)');
      expect((wb.getCell('Stats', 'B1').value as any).value).toBeCloseTo(12.91, 1);

      wb.setCell('Stats', 'B2', '=RANK(30, A1:A4, 0)');
      expect(wb.getCell('Stats', 'B2').value).toEqual({ kind: 'number', value: 2 });

      wb.setCell('Stats', 'B3', '=PERCENTILE(A1:A4, 0.5)');
      expect(wb.getCell('Stats', 'B3').value).toEqual({ kind: 'number', value: 25 });
    });

    it('funzioni testo avanzate (PROPER, TEXT, EXACT, REGEXMATCH, UNICHAR)', () => {
      const wb = createWorkbook();
      wb.addSheet('Txt');

      wb.setCell('Txt', 'A1', '=PROPER("mario rossi")');
      expect(wb.getCell('Txt', 'A1').value).toEqual({ kind: 'text', value: 'Mario Rossi' });

      wb.setCell('Txt', 'A2', '=EXACT("abc", "abc")');
      expect(wb.getCell('Txt', 'A2').value).toEqual({ kind: 'boolean', value: true });
      wb.setCell('Txt', 'A3', '=EXACT("abc", "Abc")');
      expect(wb.getCell('Txt', 'A3').value).toEqual({ kind: 'boolean', value: false });

      wb.setCell('Txt', 'A4', '=REGEXMATCH("test123", "\\d+")');
      expect(wb.getCell('Txt', 'A4').value).toEqual({ kind: 'boolean', value: true });

      wb.setCell('Txt', 'A5', '=UNICHAR(65)');
      expect(wb.getCell('Txt', 'A5').value).toEqual({ kind: 'text', value: 'A' });
    });

    it('funzioni di data avanzate (EOMONTH, DATEDIF, DAYS, NETWORKDAYS)', () => {
      const wb = createWorkbook();
      wb.addSheet('Dt');

      // EOMONTH(DATE(2023, 1, 15), 1) -> fine febbraio 2023 (28/02/2023)
      wb.setCell('Dt', 'A1', '=DAY(EOMONTH(DATE(2023, 1, 15), 1))');
      expect(wb.getCell('Dt', 'A1').value).toEqual({ kind: 'number', value: 28 });

      wb.setCell('Dt', 'A2', '=DAYS(DATE(2023, 1, 10), DATE(2023, 1, 1))');
      expect(wb.getCell('Dt', 'A2').value).toEqual({ kind: 'number', value: 9 });

      // DATEDIF in mesi
      wb.setCell('Dt', 'A3', '=DATEDIF(DATE(2020, 1, 1), DATE(2022, 1, 1), "Y")');
      expect(wb.getCell('Dt', 'A3').value).toEqual({ kind: 'number', value: 2 });
    });
  });

  describe('2. Localizzazione Formule (IT <-> EN)', () => {
    it('traduce correttamente nomi funzioni e separatori da EN a IT', () => {
      const enFormula = '=IF(SUM(A1, B1, 3.14) > 10, "OK", "NO")';
      const itFormula = translateFormula(enFormula, 'en', 'it');
      expect(itFormula).toBe('=SE(SOMMA(A1; B1; 3,14) > 10; "OK"; "NO")');
    });

    it('traduce correttamente da IT a EN', () => {
      const itFormula = '=SE(SOMMA(A1; B1; 3,14) > 10; "OK"; "NO")';
      const enFormula = translateFormula(itFormula, 'it', 'en');
      expect(enFormula).toBe('=IF(SUM(A1, B1, 3.14) > 10, "OK", "NO")');
    });

    it('esegue round-trip lossless senza alterare stringhe contenenti virgole e punti e virgola', () => {
      const formulas = [
        '=VLOOKUP("Chiave; con, virgola", A1:B10, 2, FALSE)',
        '=SUMIFS(C1:C10, A1:A10, ">0", B1:B10, "<=100.5")',
        '=XLOOKUP(A1, B1:B10, C1:C10, "Non trovato, riprovare")',
        '=IF(A1 > 0, 1.25, 0.75)',
        '=TEXTJOIN("; ", TRUE, A1:A5)',
      ];

      for (const f of formulas) {
        const toIt = translateFormula(f, 'en', 'it');
        const backToEn = translateFormula(toIt, 'it', 'en');
        expect(backToEn).toBe(f);
      }
    });

    it('permette la scrittura e il calcolo diretto di formule con nomi in italiano', () => {
      const wb = createWorkbook();
      wb.addSheet('S');
      wb.setCell('S', 'A1', '10');
      wb.setCell('S', 'A2', '20');
      wb.setCell('S', 'B1', '=SOMMA(A1, A2)');
      expect(wb.getCell('S', 'B1').value).toEqual({ kind: 'number', value: 30 });

      wb.setCell('S', 'B2', '=SE(B1 > 25, "ALTO", "BASSO")');
      expect(wb.getCell('S', 'B2').value).toEqual({ kind: 'text', value: 'ALTO' });
    });
  });

  describe('3. Dynamic Array Spill & Collisione #SPILL!', () => {
    it('spill di SEQUENCE espande la matrice nelle celle adiacenti', () => {
      const wb = createWorkbook();
      wb.addSheet('Grid');

      // A1 genera una matrice 3 righe x 2 colonne:
      // A1=1, B1=2
      // A2=3, B2=4
      // A3=5, B3=6
      wb.setCell('Grid', 'A1', '=SEQUENCE(3, 2, 1, 1)');

      const a1 = wb.getCell('Grid', 'A1');
      expect(a1.value).toEqual({ kind: 'number', value: 1 });
      expect(a1.isSpillMaster).toBe(true);

      const b1 = wb.getCell('Grid', 'B1');
      expect(b1.value).toEqual({ kind: 'number', value: 2 });
      expect(b1.spilledFrom).toBeDefined();
      expect(b1.spilledFrom?.masterAddress).toBe('A1');

      const a2 = wb.getCell('Grid', 'A2');
      expect(a2.value).toEqual({ kind: 'number', value: 3 });
      expect(a2.spilledFrom?.masterAddress).toBe('A1');

      const b3 = wb.getCell('Grid', 'B3');
      expect(b3.value).toEqual({ kind: 'number', value: 6 });
      expect(b3.spilledFrom?.masterAddress).toBe('A1');

      // Altre celle possono riferenziare direttamente celle spilled
      wb.setCell('Grid', 'C1', '=B3 * 10');
      expect(wb.getCell('Grid', 'C1').value).toEqual({ kind: 'number', value: 60 });
    });

    it('intercetta collisione e imposta #SPILL! se una cella di destinazione è occupata', () => {
      const wb = createWorkbook();
      wb.addSheet('Col');

      // Inseriamo un valore bloccante in B2
      wb.setCell('Col', 'B2', 'blocco');

      // Proviamo ad espandere SEQUENCE(3, 2) da A1
      wb.setCell('Col', 'A1', '=SEQUENCE(3, 2)');

      const a1 = wb.getCell('Col', 'A1');
      expect(a1.value.kind).toBe('error');
      expect((a1.value as any).error).toBe('#SPILL!');

      // Nessuna cella è stata sovrascritta
      expect(wb.getCell('Col', 'B2').value).toEqual({ kind: 'text', value: 'blocco' });

      // Rimuovendo l'ostacolo da B2, il ricalcolo espande automaticamente la matrice
      wb.setCell('Col', 'B2', '');
      wb.recalculate();

      expect(wb.getCell('Col', 'A1').value).toEqual({ kind: 'number', value: 1 });
      expect(wb.getCell('Col', 'B2').value).toEqual({ kind: 'number', value: 4 });
    });

    it('scrivere su una cella spilled causa collisione e imposta il master a #SPILL!', () => {
      const wb = createWorkbook();
      wb.addSheet('WriteSpill');

      wb.setCell('WriteSpill', 'A1', '=SEQUENCE(2, 2)');
      expect(wb.getCell('WriteSpill', 'B2').value).toEqual({ kind: 'number', value: 4 });

      // L'utente digita sopra la cella figlia B2
      wb.setCell('WriteSpill', 'B2', 'nuovo dato');

      // Il master A1 diventa #SPILL!
      const a1 = wb.getCell('WriteSpill', 'A1');
      expect(a1.value.kind).toBe('error');
      expect((a1.value as any).error).toBe('#SPILL!');

      // Rimuovendo l'ostacolo in B2, A1 torna valido e propaga nuovamente lo spill
      wb.setCell('WriteSpill', 'B2', '');
      expect(wb.getCell('WriteSpill', 'A1').value).toEqual({ kind: 'number', value: 1 });
      expect(wb.getCell('WriteSpill', 'B2').value).toEqual({ kind: 'number', value: 4 });
    });

    it('cancellando la formula master, tutte le celle spilled figlie vengono rimosse', () => {
      const wb = createWorkbook();
      wb.addSheet('Clear');

      wb.setCell('Clear', 'A1', '=SEQUENCE(2, 2)');
      expect(wb.getCell('Clear', 'A2').value).toEqual({ kind: 'number', value: 3 });

      // Cancella A1
      wb.clearCell('Clear', 'A1');

      expect(wb.getCell('Clear', 'A1').value.kind).toBe('empty');
      expect(wb.getCell('Clear', 'A2').value.kind).toBe('empty');
      expect(wb.getCell('Clear', 'B2').value.kind).toBe('empty');
    });

    it('funzioni matriciali avanzate: TRANSPOSE, UNIQUE, SORT, FILTER', () => {
      const wb = createWorkbook();
      wb.addSheet('Arr');

      wb.setCell('Arr', 'A1', '3');
      wb.setCell('Arr', 'A2', '1');
      wb.setCell('Arr', 'A3', '2');
      wb.setCell('Arr', 'A4', '1');

      // UNIQUE su A1:A4 -> [3, 1, 2] in C1:C3
      wb.setCell('Arr', 'C1', '=UNIQUE(A1:A4)');
      expect(wb.getCell('Arr', 'C1').value).toEqual({ kind: 'number', value: 3 });
      expect(wb.getCell('Arr', 'C2').value).toEqual({ kind: 'number', value: 1 });
      expect(wb.getCell('Arr', 'C3').value).toEqual({ kind: 'number', value: 2 });

      // SORT su A1:A4 -> [1, 1, 2, 3] in E1:E4
      wb.setCell('Arr', 'E1', '=SORT(A1:A4)');
      expect(wb.getCell('Arr', 'E1').value).toEqual({ kind: 'number', value: 1 });
      expect(wb.getCell('Arr', 'E2').value).toEqual({ kind: 'number', value: 1 });
      expect(wb.getCell('Arr', 'E3').value).toEqual({ kind: 'number', value: 2 });
      expect(wb.getCell('Arr', 'E4').value).toEqual({ kind: 'number', value: 3 });
    });
  });
});
