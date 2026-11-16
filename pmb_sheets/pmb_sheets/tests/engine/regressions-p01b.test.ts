import { describe, it, expect, vi } from 'vitest';
import { createWorkbook } from '../../src/engine';
import { defaultFunctionRegistry } from '../../src/engine/functions/registry';
import { EvalArg, RangeArg } from '../../src/engine/functions/utils';
import { errorVal, textVal, emptyVal, numberVal, CellValue } from '../../src/engine/values';

describe('P01b Regression Tests', () => {
  // 1. Criteri di SUMIF/COUNTIF/AVERAGEIF senza distinzione di tipo
  describe('1. Criteri tipo-specifici (SUMIF, COUNTIF, AVERAGEIF)', () => {
    it('rispetta la distinzione di tipo nei criteri numerici e testuali', () => {
      const wb = createWorkbook();
      wb.addSheet('Dati');
      // A1:A5 = 1, 5, 10, "apple", "avocado"
      wb.setCell('Dati', 'A1', '1');
      wb.setCell('Dati', 'A2', '5');
      wb.setCell('Dati', 'A3', '10');
      wb.setCell('Dati', 'A4', '"apple"');
      wb.setCell('Dati', 'A5', '"avocado"');

      // B1:B5 = 10, 20, 30, 40, 50
      wb.setCell('Dati', 'B1', '10');
      wb.setCell('Dati', 'B2', '20');
      wb.setCell('Dati', 'B3', '30');
      wb.setCell('Dati', 'B4', '40');
      wb.setCell('Dati', 'B5', '50');

      // Criterio numerico >4 corrisponde SOLO a numeri (5 e 10), non al testo
      wb.setCell('Dati', 'C1', '=COUNTIF(A1:A5, ">4")');
      expect(wb.getCell('Dati', 'C1').value).toEqual({ kind: 'number', value: 2 });

      // Criterio testuale con operatore "<b" corrisponde SOLO a testo ("apple", "avocado")
      wb.setCell('Dati', 'C2', '=COUNTIF(A1:A5, "<b")');
      expect(wb.getCell('Dati', 'C2').value).toEqual({ kind: 'number', value: 2 });

      // SUMIF con somma su B: solo righe 2 e 3 (20 + 30 = 50)
      wb.setCell('Dati', 'C3', '=SUMIF(A1:A5, ">4", B1:B5)');
      expect(wb.getCell('Dati', 'C3').value).toEqual({ kind: 'number', value: 50 });

      // AVERAGEIF con media su B: (20 + 30) / 2 = 25
      wb.setCell('Dati', 'C4', '=AVERAGEIF(A1:A5, ">4", B1:B5)');
      expect(wb.getCell('Dati', 'C4').value).toEqual({ kind: 'number', value: 25 });

      // SUMIF senza intervallo somma: somma direttamente su A (5 + 10 = 15)
      wb.setCell('Dati', 'C5', '=SUMIF(A1:A5, ">4")');
      expect(wb.getCell('Dati', 'C5').value).toEqual({ kind: 'number', value: 15 });
    });
  });

  // 2. Righe intere nelle formule
  describe('2. Righe intere nelle formule (1:1, 1:2, $1:$1)', () => {
    it('supporta righe intere nelle formule e rileva correttamente cicli', () => {
      const wb = createWorkbook();
      wb.addSheet('Righe');

      // Popola alcune celle di riga 1
      wb.setCell('Righe', 'B1', '10');
      wb.setCell('Righe', 'C1', '20');

      // In A2 (riga diversa), =SUM(1:1) deve funzionare e dare 30
      wb.setCell('Righe', 'A2', '=SUM(1:1)');
      expect(wb.getCell('Righe', 'A2').value).toEqual({ kind: 'number', value: 30 });

      // Formula con $1:$1 e 1:2
      wb.setCell('Righe', 'A3', '=SUM($1:$1)');
      expect(wb.getCell('Righe', 'A3').value).toEqual({ kind: 'number', value: 30 });

      wb.setCell('Righe', 'B2', '5');
      wb.setCell('Righe', 'A4', '=SUM(1:2)');
      // Riga 1: B1(10)+C1(20) = 30. Riga 2: A2(30)+B2(5) = 35. Totale 1:2 = 65.
      expect(wb.getCell('Righe', 'A4').value).toEqual({ kind: 'number', value: 65 });

      // Invece se inserita nella stessa riga (es. D1 con =SUM(1:1)), deve rilevare ciclo
      wb.setCell('Righe', 'D1', '=SUM(1:1)');
      expect(wb.getCell('Righe', 'D1').value).toEqual({ kind: 'error', error: '#CIRCULAR!' });
    });
  });

  // 3. Rimozione di un foglio e ripristino
  describe('3. Rimozione di un foglio e ripristino dipendenze', () => {
    it('propaga #REF! quando un foglio viene rimosso e ripristina i valori quando ricreato', () => {
      const wb = createWorkbook();
      wb.addSheet('S');
      wb.addSheet('T');

      wb.setCell('T', 'A1', '7');
      wb.setCell('S', 'A1', '=T!A1*2');
      wb.setCell('S', 'A2', '=A1+1');

      expect(wb.getCell('S', 'A1').value).toEqual({ kind: 'number', value: 14 });
      expect(wb.getCell('S', 'A2').value).toEqual({ kind: 'number', value: 15 });

      // Rimuove foglio T
      wb.removeSheet('T');

      // S!A1 deve diventare #REF! e propagarsi a S!A2
      expect(wb.getCell('S', 'A1').value).toEqual({ kind: 'error', error: '#REF!' });
      expect(wb.getCell('S', 'A2').value).toEqual({ kind: 'error', error: '#REF!' });

      // Ricreazione del foglio T con lo stesso nome
      wb.addSheet('T');
      wb.setCell('T', 'A1', '7');
      wb.recalculate();

      expect(wb.getCell('S', 'A1').value).toEqual({ kind: 'number', value: 14 });
      expect(wb.getCell('S', 'A2').value).toEqual({ kind: 'number', value: 15 });
    });
  });

  // 4. ROUND sui numeri binari non esatti
  describe('4. ROUND con precisione decimale (half-away-from-zero esatto)', () => {
    it('arrotonda correttamente i casi critici IEEE 754', () => {
      const wb = createWorkbook();
      const testCases: [string, number][] = [
        ['=ROUND(1.005, 2)', 1.01],
        ['=ROUND(1.255, 2)', 1.26],
        ['=ROUND(0.285, 2)', 0.29],
        ['=ROUND(2.675, 2)', 2.68],
        ['=ROUND(8.345, 2)', 8.35],
        ['=ROUND(-1.005, 2)', -1.01],
        ['=ROUND(1234.5678, -2)', 1200],
        ['=ROUND(0.5, 0)', 1],
        ['=ROUND(-0.5, 0)', -1],
        ['=ROUND(1E+20, 2)', 1e20],
        ['=ROUNDUP(1.001, 2)', 1.01],
        ['=ROUNDDOWN(1.009, 2)', 1.00],
        ['=CEILING(1.255, 0.01)', 1.26],
        ['=FLOOR(1.255, 0.01)', 1.25],
      ];

      for (const [formula, expected] of testCases) {
        wb.setCell('Foglio1', 'A1', formula);
        const cell = wb.getCell('Foglio1', 'A1');
        expect(cell.value).toEqual({ kind: 'number', value: expected });
      }
    });
  });

  // 5. Prestazioni, HLOOKUP e Catena 50.000 celle
  describe('5. Prestazioni e HLOOKUP', () => {
    it('esegue HLOOKUP orizzontale correttamente', () => {
      const wb = createWorkbook();
      wb.addSheet('HData');
      wb.setCell('HData', 'A1', 'Codice');
      wb.setCell('HData', 'B1', 'Prezzo');
      wb.setCell('HData', 'C1', 'Qta');

      wb.setCell('HData', 'A2', '100');
      wb.setCell('HData', 'B2', '250');
      wb.setCell('HData', 'C2', '12');

      wb.setCell('HData', 'A3', '=HLOOKUP("Prezzo", A1:C2, 2, FALSE)');
      expect(wb.getCell('HData', 'A3').value).toEqual({ kind: 'number', value: 250 });
    });

    it('calcola e propaga su catena di 50.000 celle in tempo lineare (< 8 s)', () => {
      const wb = createWorkbook();
      wb.addSheet('Chain');

      // Crea catena A1..A50000
      wb.setCell('Chain', 'A1', '1');
      for (let i = 2; i <= 50000; i++) {
        wb.setCell('Chain', `A${i}`, `=A${i - 1}+1`);
      }

      const tStart = performance.now();
      wb.setCell('Chain', 'A1', '10');
      const duration = performance.now() - tStart;

      expect(wb.getCell('Chain', 'A50000').value).toEqual({ kind: 'number', value: 50009 });
      expect(duration).toBeLessThan(8000);
    });
  });

  // 6. onChange restituisce { sheet: string, address: string }
  describe('6. Listener onChange strutturato { sheet, address }', () => {
    it('restituisce oggetti { sheet, address } in notazione A1', () => {
      const wb = createWorkbook();
      let lastChanges: any[] = [];
      wb.onChange((changes) => {
        lastChanges = changes;
      });

      wb.setCell('Foglio1', 'H1', '42');

      expect(lastChanges).toBeDefined();
      expect(lastChanges.length).toBeGreaterThan(0);
      expect(lastChanges[0]).toEqual({
        sheet: 'Foglio1',
        address: 'H1',
      });
    });
  });

  // 7. Regressione trasversale su tutte le 71 funzioni
  describe('7. Regressione trasversale su tutte le 71 funzioni', () => {
    it('ogni funzione gestisce input errato e propaga errore in ingresso', () => {
      const allNames = defaultFunctionRegistry.listAll();
      expect(allNames.length).toBeGreaterThanOrEqual(71);

      // Funzioni logiche / informative speciali che intercettano, contano o verificano errori intenzionalmente
      const errorHandlingFunctions = new Set([
        'IFERROR', 'IFNA', 'ISERROR', 'ISERR', 'ISNA', 'COUNTA', 'COUNTBLANK',
        'ISBLANK', 'ISNUMBER', 'ISTEXT', 'ISLOGICAL', 'ISNONTEXT', 'TYPE', 'ERROR.TYPE', 'SHEET', 'SHEETS'
      ]);

      for (const fnName of allNames) {
        const fn = defaultFunctionRegistry.get(fnName);
        expect(fn, `Funzione ${fnName} non trovata nel registro`).toBeDefined();

        // (a) Test con errore in ingresso (#DIV/0!)
        const inputError = errorVal('#DIV/0!');
        const resWithErr = fn!([inputError]);
        if (!errorHandlingFunctions.has(fnName)) {
          // La maggior parte delle funzioni propaga l'errore
          expect(
            resWithErr.kind,
            `Funzione ${fnName} non ha propagato l'errore: ${JSON.stringify(resWithErr)}`
          ).toBe('error');
        } else {
          // Le funzioni speciali gestiscono l'errore
          expect(resWithErr).toBeDefined();
        }

        // (b) Test con tipo non valido (es. stringa non parsabile a funzione numerica)
        const invalidTypeArg = textVal('non_un_numero');
        const resInvalid = fn!([invalidTypeArg]);
        expect(resInvalid).toBeDefined();
      }
    });
  });
});
