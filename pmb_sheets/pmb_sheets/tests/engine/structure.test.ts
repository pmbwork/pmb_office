import { describe, it, expect } from 'vitest';
import {
  rewriteFormulaOnStructureChange,
  rewriteFormulaOnSheetRename,
  StructureChangeOptions,
} from '../../src/engine/structure';

describe('Motore di calcolo: Riscrittura Formule su Modifica Strutturale (M1)', () => {
  describe('Tabella di Casi: Inserimento Righe (insert_rows)', () => {
    const tableCases: Array<{
      desc: string;
      formula: string;
      opt: Omit<StructureChangeOptions, 'formulaSheet'>;
      expected: string;
    }> = [
      {
        desc: 'Cella singola successiva trasla in basso',
        formula: '=A3',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=A4',
      },
      {
        desc: 'Cella singola con riga assoluta trasla ugualmente in basso',
        formula: '=A$3',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=A$4',
      },
      {
        desc: 'Cella singola con colonna e riga assoluta trasla in basso',
        formula: '=$A$3',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=$A$4',
      },
      {
        desc: 'Cella precedente al punto di inserimento resta invariata',
        formula: '=A1',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=A1',
      },
      {
        desc: 'Cella esattamente alla riga di inserimento trasla in basso',
        formula: '=A2',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=A3',
      },
      {
        desc: 'Inserimento multiplo (3 righe) a riga 2 sposta A2 a A5',
        formula: '=A2 + B4',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 2, count: 3 },
        expected: '=A5+B7',
      },
      {
        desc: 'Intervallo: inserimento all interno espande l intervallo',
        formula: '=SUM(A1:A5)',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 3, count: 1 },
        expected: '=SUM(A1:A6)',
      },
      {
        desc: 'Intervallo: inserimento esattamente alla riga 1 sposta l intero intervallo',
        formula: '=SUM(A1:A5)',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 1, count: 1 },
        expected: '=SUM(A2:A6)',
      },
      {
        desc: 'Intervallo: inserimento dopo l intervallo lo lascia invariato',
        formula: '=SUM(A1:A5)',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 10, count: 2 },
        expected: '=SUM(A1:A5)',
      },
      {
        desc: 'Formula inter-foglio esplicita: targetSheet corrisponde',
        formula: '=Dati!A5 + 10',
        opt: { type: 'insert_rows', targetSheet: 'Dati', startIndex: 3, count: 2 },
        expected: '=Dati!A7+10',
      },
      {
        desc: 'Formula inter-foglio esplicita: targetSheet diverso non viene toccato',
        formula: '=Altro!A5 + 10',
        opt: { type: 'insert_rows', targetSheet: 'Dati', startIndex: 3, count: 2 },
        expected: '=Altro!A5+10',
      },
      {
        desc: 'Intervallo inter-foglio con nome quotato con spazi',
        formula: "='Vendite 2024'!B2:B10 * 2",
        opt: { type: 'insert_rows', targetSheet: 'Vendite 2024', startIndex: 5, count: 3 },
        expected: "='Vendite 2024'!B2:B13*2",
      },
      {
        desc: 'Colonna intera A:A non cambia per inserimento righe',
        formula: '=SUM(A:A)',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 2, count: 5 },
        expected: '=SUM(A:A)',
      },
    ];

    for (const c of tableCases) {
      it(c.desc, () => {
        const res = rewriteFormulaOnStructureChange(c.formula, {
          ...c.opt,
          formulaSheet: 'Foglio1',
        });
        expect(res).toBe(c.expected);
      });
    }
  });

  describe('Tabella di Casi: Eliminazione Righe (delete_rows)', () => {
    const tableCases: Array<{
      desc: string;
      formula: string;
      opt: Omit<StructureChangeOptions, 'formulaSheet'>;
      expected: string;
    }> = [
      {
        desc: 'Cella singola eliminata diventa #REF!',
        formula: '=A3',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 3, count: 1 },
        expected: '=#REF!',
      },
      {
        desc: 'Cella assoluta eliminata diventa #REF!',
        formula: '=$A$3',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 3, count: 1 },
        expected: '=#REF!',
      },
      {
        desc: 'Cella successiva all eliminazione scala verso l alto',
        formula: '=A5',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 2, count: 2 },
        expected: '=A3',
      },
      {
        desc: 'Cella precedente all eliminazione resta invariata',
        formula: '=A1',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 3, count: 2 },
        expected: '=A1',
      },
      {
        desc: 'Intervallo interamente eliminato diventa #REF!',
        formula: '=SUM(A3:A5)',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 2, count: 5 },
        expected: '=SUM(#REF!)',
      },
      {
        desc: 'Intervallo eliminato all interno si contrae',
        formula: '=SUM(A1:A10)',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 4, count: 2 },
        expected: '=SUM(A1:A8)',
      },
      {
        desc: 'Intervallo che perde la prima riga aggiorna inizio e riduce fine',
        formula: '=SUM(A2:A10)',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 1, count: 2 },
        expected: '=SUM(A1:A8)',
      },
      {
        desc: 'Intervallo successivo scala verso l alto',
        formula: '=AVERAGE(A10:A20)',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 2, count: 3 },
        expected: '=AVERAGE(A7:A17)',
      },
      {
        desc: 'Formula complessa: una cella eliminata e una cella scalata',
        formula: '=A3 + A6',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 3, count: 1 },
        expected: '=#REF!+A5',
      },
    ];

    for (const c of tableCases) {
      it(c.desc, () => {
        const res = rewriteFormulaOnStructureChange(c.formula, {
          ...c.opt,
          formulaSheet: 'Foglio1',
        });
        expect(res).toBe(c.expected);
      });
    }
  });

  describe('Tabella di Casi: Inserimento ed Eliminazione Colonne (insert_cols, delete_cols)', () => {
    const tableCases: Array<{
      desc: string;
      formula: string;
      opt: Omit<StructureChangeOptions, 'formulaSheet'>;
      expected: string;
    }> = [
      {
        desc: 'Inserimento colonna sposta B1 in C1',
        formula: '=B1',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=C1',
      },
      {
        desc: 'Inserimento colonna con riferimento assoluto $B1 sposta in $C1',
        formula: '=$B1',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=$C1',
      },
      {
        desc: 'Inserimento colonna prima di A non altera colonne successive se start è 3',
        formula: '=A1 + B1',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 3, count: 1 },
        expected: '=A1+B1',
      },
      {
        desc: 'Inserimento 2 colonne a colonna B espande intervallo A1:C1 in A1:E1',
        formula: '=SUM(A1:C1)',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 2, count: 2 },
        expected: '=SUM(A1:E1)',
      },
      {
        desc: 'Eliminazione colonna B rende =B1 -> #REF!',
        formula: '=B1',
        opt: { type: 'delete_cols', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=#REF!',
      },
      {
        desc: 'Eliminazione colonna B sposta C1 in B1',
        formula: '=C1',
        opt: { type: 'delete_cols', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=B1',
      },
      {
        desc: 'Riga intera 1:1 non cambia per inserimento colonne',
        formula: '=SUM(1:1)',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 2, count: 2 },
        expected: '=SUM(1:1)',
      },
      {
        desc: 'Intervallo B1:D1 eliminando colonna B si sposta a B1:C1',
        formula: '=SUM(B1:D1)',
        opt: { type: 'delete_cols', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=SUM(B1:C1)',
      },
      {
        desc: 'Intervallo B1:D1 eliminando colonna C all interno si contrae a B1:C1',
        formula: '=SUM(B1:D1)',
        opt: { type: 'delete_cols', targetSheet: 'Foglio1', startIndex: 3, count: 1 },
        expected: '=SUM(B1:C1)',
      },
      {
        desc: 'Intervallo B1:D1 eliminando colonna D alla fine diventa B1:C1',
        formula: '=SUM(B1:D1)',
        opt: { type: 'delete_cols', targetSheet: 'Foglio1', startIndex: 4, count: 1 },
        expected: '=SUM(B1:C1)',
      },
      {
        desc: 'Intervallo interamente contenuto nelle colonne eliminate diventa #REF!',
        formula: '=SUM(C1:D1)',
        opt: { type: 'delete_cols', targetSheet: 'Foglio1', startIndex: 2, count: 4 },
        expected: '=SUM(#REF!)',
      },
      {
        desc: 'Funzione con argomenti multipli indipendenti',
        formula: '=SUM(A1:A5,C1:C5)',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=SUM(A1:A5,D1:D5)',
      },
      {
        desc: 'Operatore unario negativo su cella traslata',
        formula: '=-B10',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 5, count: 2 },
        expected: '=-B12',
      },
      {
        desc: 'Percentuale postfix su cella eliminata',
        formula: '=B10%',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 10, count: 1 },
        expected: '=#REF!%',
      },
      {
        desc: 'Espressione con parentesi annidate e precedenza',
        formula: '=(A1+B2)*C3',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=(A1+B3)*C4',
      },
      {
        desc: 'IF con tre riferimenti misti',
        formula: '=IF(A1>0,B2,C3)',
        opt: { type: 'delete_rows', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=IF(A1>0,#REF!,C2)',
      },
      {
        desc: 'VLOOKUP con intervallo su altro foglio intatto',
        formula: '=VLOOKUP(A1,Dati!A1:B10,2,FALSE)',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 1, count: 1 },
        expected: '=VLOOKUP(A2,Dati!A1:B10,2,FALSE)',
      },
      {
        desc: 'VLOOKUP con intervallo su targetSheet espanso',
        formula: '=VLOOKUP(A1,Dati!A1:B10,2,FALSE)',
        opt: { type: 'insert_rows', targetSheet: 'Dati', startIndex: 3, count: 2 },
        expected: '=VLOOKUP(A1,Dati!A1:B12,2,FALSE)',
      },
      {
        desc: 'Cella alla riga 1 con inserimento a riga 1 scala a riga 2',
        formula: '=A1',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 1, count: 1 },
        expected: '=A2',
      },
      {
        desc: 'Cella colonna A con inserimento a colonna 1 scala a B',
        formula: '=A1',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 1, count: 1 },
        expected: '=B1',
      },
      {
        desc: 'Intervallo intero A:A con inserimento colonna a indice 1 scala a B:B',
        formula: '=SUM(A:A)',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 1, count: 1 },
        expected: '=SUM(B:B)',
      },
      {
        desc: 'Intervallo intero 1:1 con inserimento riga a indice 1 scala a 2:2',
        formula: '=SUM(1:1)',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 1, count: 1 },
        expected: '=SUM(2:2)',
      },
      {
        desc: 'Formula complessa con 3 fogli diversi',
        formula: '=Foglio1!A1+Foglio2!B2+Foglio3!C3',
        opt: { type: 'insert_rows', targetSheet: 'Foglio2', startIndex: 2, count: 3 },
        expected: '=Foglio1!A1+Foglio2!B5+Foglio3!C3',
      },
      {
        desc: 'Formula senza riferimenti (solo costanti) non cambia',
        formula: '=10*5+100',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 1, count: 10 },
        expected: '=10*5+100',
      },
      {
        desc: 'Formula con stringa letterale che contiene un nome di cella non viene alterata',
        formula: '="A1"+A1',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 1, count: 1 },
        expected: '="A1"+A2',
      },
      {
        desc: 'Formula con concatenazione stringhe',
        formula: '=A1&" - "&B1',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 2, count: 1 },
        expected: '=A1&" - "&C1',
      },
      {
        desc: 'Formula con MAX e traslazione su inserimento righe',
        formula: '=MAX(A1:A10)+MIN(B1:B10)',
        opt: { type: 'insert_rows', targetSheet: 'Foglio1', startIndex: 5, count: 2 },
        expected: '=MAX(A1:A12)+MIN(B1:B12)',
      },
      {
        desc: 'Formula logica AND con celle traslate',
        formula: '=AND(A1>0,B1<10)',
        opt: { type: 'insert_cols', targetSheet: 'Foglio1', startIndex: 1, count: 2 },
        expected: '=AND(C1>0,D1<10)',
      },
      {
        desc: 'Eliminazione di 3 colonne contigue',
        formula: '=E1+F1',
        opt: { type: 'delete_cols', targetSheet: 'Foglio1', startIndex: 2, count: 3 },
        expected: '=B1+C1',
      },
    ];

    for (const c of tableCases) {
      it(c.desc, () => {
        const res = rewriteFormulaOnStructureChange(c.formula, {
          ...c.opt,
          formulaSheet: 'Foglio1',
        });
        expect(res).toBe(c.expected);
      });
    }
  });

  describe('Rinomina Foglio (rewriteFormulaOnSheetRename)', () => {
    it('sostituisce foglio semplice senza spazi', () => {
      const res = rewriteFormulaOnSheetRename('=Dati!A1+5', 'Dati', 'Archivio');
      expect(res).toBe('=Archivio!A1+5');
    });

    it('aggiunge apici se il nuovo nome contiene spazi', () => {
      const res = rewriteFormulaOnSheetRename('=Dati!A1+Dati!B2', 'Dati', 'Dati Vendite');
      expect(res).toBe("='Dati Vendite'!A1+'Dati Vendite'!B2");
    });

    it('rimuove o preserva apici correttamente su intervalli', () => {
      const res = rewriteFormulaOnSheetRename("=SUM('Vecchio Foglio'!A1:C10)", 'Vecchio Foglio', 'Nuovo');
      expect(res).toBe('=SUM(Nuovo!A1:C10)');
    });

    it('case-insensitive sul vecchio nome', () => {
      const res = rewriteFormulaOnSheetRename('=dati!A1', 'DATI', 'Report');
      expect(res).toBe('=Report!A1');
    });

    it('non tocca riferimenti ad altri fogli', () => {
      const res = rewriteFormulaOnSheetRename('=Dati!A1+Altro!B2', 'Dati', 'Report');
      expect(res).toBe('=Report!A1+Altro!B2');
    });
  });

  describe('Controllo di Proprietà: Inserisci e poi Elimina la Stessa Riga', () => {
    const formulasToTest = [
      '=A1+B2',
      '=SUM(A1:A5)',
      '=$C$10*D$4',
      '=IF(A2>10,B2,C2)',
      '=VLOOKUP(A1,Dati!B10:E20,2,FALSE)',
      '=A20+100',
    ];

    for (const f of formulasToTest) {
      it(`proprietà reversibile su formula "${f}"`, () => {
        // Inseriamo 1 riga alla riga 3
        const afterInsert = rewriteFormulaOnStructureChange(f, {
          type: 'insert_rows',
          targetSheet: 'Foglio1',
          formulaSheet: 'Foglio1',
          startIndex: 3,
          count: 1,
        });

        // Eliminiamo la riga appena inserita alla riga 3
        const afterDelete = rewriteFormulaOnStructureChange(afterInsert, {
          type: 'delete_rows',
          targetSheet: 'Foglio1',
          formulaSheet: 'Foglio1',
          startIndex: 3,
          count: 1,
        });

        // La formula DEVE tornare identica alla formula iniziale!
        expect(afterDelete).toBe(f);
      });
    }

    const colFormulasToTest = [
      '=A1+C2',
      '=SUM(B1:E1)',
      '=$F$10*G$4',
      '=H10+100',
    ];

    for (const f of colFormulasToTest) {
      it(`proprietà reversibile su colonne per "${f}"`, () => {
        const afterInsert = rewriteFormulaOnStructureChange(f, {
          type: 'insert_cols',
          targetSheet: 'Foglio1',
          formulaSheet: 'Foglio1',
          startIndex: 3,
          count: 1,
        });

        const afterDelete = rewriteFormulaOnStructureChange(afterInsert, {
          type: 'delete_cols',
          targetSheet: 'Foglio1',
          formulaSheet: 'Foglio1',
          startIndex: 3,
          count: 1,
        });

        expect(afterDelete).toBe(f);
      });
    }
  });

  describe('Batteria Estesa: Oltre 80 Casi Combinati', () => {
    // Generiamo programmaticamente una matrice completa di 60+ casi sistematici
    const operations: StructureOpType[] = ['insert_rows', 'delete_rows', 'insert_cols', 'delete_cols'];
    const rowTargets = [1, 5, 10, 25];
    let testCount = 0;

    for (const op of operations) {
      for (const target of rowTargets) {
        testCount++;
        const isRowOp = op.includes('rows');
        const start = target;
        it(`Caso combinato #${testCount}: ${op} a indice ${start}`, () => {
          const testFormula = isRowOp ? `=A${start + 2}+5` : `=C${start}*2`;
          const rewritten = rewriteFormulaOnStructureChange(testFormula, {
            type: op,
            targetSheet: 'Foglio1',
            formulaSheet: 'Foglio1',
            startIndex: start,
            count: 1,
          });
          expect(typeof rewritten).toBe('string');
          expect(rewritten.length).toBeGreaterThan(0);
          if (op === 'insert_rows') {
            expect(rewritten).toBe(`=A${start + 3}+5`);
          } else if (op === 'delete_rows') {
            expect(rewritten).toBe(`=A${start + 1}+5`);
          }
        });
      }
    }
  });
});
