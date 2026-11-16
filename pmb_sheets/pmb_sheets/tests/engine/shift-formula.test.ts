import { describe, it, expect } from 'vitest';
import { shiftFormula } from '../../src/engine/shift-formula';
import { createWorkbook } from '../../src/engine/index';

describe('shiftFormula - Funzione pura di spostamento formule', () => {
  it('1. Cella relativa semplice spostata in basso e a destra', () => {
    expect(shiftFormula('=A1', 1, 1)).toBe('=B2');
  });

  it('2. Cella relativa con delta solo riga', () => {
    expect(shiftFormula('=A1', 5, 0)).toBe('=A6');
  });

  it('3. Cella relativa con delta solo colonna', () => {
    expect(shiftFormula('=A1', 0, 3)).toBe('=D1');
  });

  it('4. Cella assoluta $A$1 non si sposta mai', () => {
    expect(shiftFormula('=$A$1', 5, 5)).toBe('=$A$1');
  });

  it('5. Cella mista $A1: colonna fissa, riga relativa', () => {
    expect(shiftFormula('=$A1', 2, 3)).toBe('=$A3');
  });

  it('6. Cella mista A$1: riga fissa, colonna relativa', () => {
    expect(shiftFormula('=A$1', 2, 3)).toBe('=D$1');
  });

  it('7. Intervallo semplice A1:B2 spostato', () => {
    expect(shiftFormula('=A1:B2', 1, 1)).toBe('=B2:C3');
  });

  it('8. Intervallo completamente assoluto $A$1:$B$2 resta fisso', () => {
    expect(shiftFormula('=$A$1:$B$2', 3, 3)).toBe('=$A$1:$B$2');
  });

  it('9. Intervallo misto $A1:B$2', () => {
    expect(shiftFormula('=$A1:B$2', 2, 2)).toBe('=$A3:D$2');
  });

  it('10. Colonna intera relativa A:A spostata in colonna', () => {
    expect(shiftFormula('=A:A', 0, 2)).toBe('=C:C');
  });

  it('11. Colonna intera A:A non risente di deltaRows', () => {
    expect(shiftFormula('=A:A', 5, 2)).toBe('=C:C');
  });

  it('12. Colonna intera assoluta $A:$A resta fissa', () => {
    expect(shiftFormula('=$A:$A', 5, 2)).toBe('=$A:$A');
  });

  it('13. Riga intera relativa 1:1 spostata in riga', () => {
    expect(shiftFormula('=1:1', 3, 0)).toBe('=4:4');
  });

  it('14. Riga intera 1:1 non risente di deltaCols', () => {
    expect(shiftFormula('=1:1', 3, 5)).toBe('=4:4');
  });

  it('15. Riga intera assoluta $1:$1 resta fissa', () => {
    expect(shiftFormula('=$1:$1', 3, 5)).toBe('=$1:$1');
  });

  it('16. Nome foglio standard Foglio1!A1 conservato', () => {
    expect(shiftFormula('=Foglio1!A1', 1, 1)).toBe('=Foglio1!B2');
  });

  it('17. Nome foglio con spazi e apici \'Il mio foglio\'!A1 conservato', () => {
    expect(shiftFormula("='Il mio foglio'!A1", 2, 1)).toBe("='Il mio foglio'!B3");
  });

  it('18. Nome foglio con apici interni \'L\'\'arte\'!A1:B2 conservato', () => {
    expect(shiftFormula("='L''arte'!A1:B2", 1, 1)).toBe("='L''arte'!B2:C3");
  });

  it('19. Stringa letterale contenente "A1" non viene modificata', () => {
    expect(shiftFormula('="A1" & A1', 1, 1)).toBe('="A1"&B2');
  });

  it('20. Funzione con stringhe e numeri: =IF(A1>0,"Positivo","A1")', () => {
    expect(shiftFormula('=IF(A1>0,"Positivo","A1")', 1, 1)).toBe('=IF(B2>0,"Positivo","A1")');
  });

  it('21. Formula aritmetica complessa: =A1*B1 + C1/D1', () => {
    expect(shiftFormula('=A1*B1+C1/D1', 1, 1)).toBe('=B2*C2+D2/E2');
  });

  it('22. Parentesi preservate: =A1*(B1+C1)', () => {
    expect(shiftFormula('=A1*(B1+C1)', 1, 1)).toBe('=B2*(C2+D2)');
  });

  it('23. Chiamata annidata =SUM(A1:B2,AVERAGE(C1:D2))', () => {
    expect(shiftFormula('=SUM(A1:B2,AVERAGE(C1:D2))', 2, 2)).toBe('=SUM(C3:D4,AVERAGE(E3:F4))');
  });

  it('24. Uscita dai limiti a sinistra (colonna < 1) diventa #REF!', () => {
    expect(shiftFormula('=A1', 0, -1)).toBe('=#REF!');
  });

  it('25. Uscita dai limiti in alto (riga < 1) diventa #REF!', () => {
    expect(shiftFormula('=A1', -1, 0)).toBe('=#REF!');
  });

  it('26. Uscita dai limiti su intervallo: A1:B2 con deltaRows = -1 diventa #REF!', () => {
    expect(shiftFormula('=A1:B2', -1, 0)).toBe('=#REF!');
  });

  it('27. Uscita dai limiti su colonna intera: A:A con deltaCols = -1 diventa #REF!', () => {
    expect(shiftFormula('=A:A', 0, -1)).toBe('=#REF!');
  });

  it('28. Uscita dai limiti su riga intera: 1:1 con deltaRows = -1 diventa #REF!', () => {
    expect(shiftFormula('=1:1', -1, 0)).toBe('=#REF!');
  });

  it('29. Uscita dal limite massimo: riga > 1048576 diventa #REF!', () => {
    expect(shiftFormula('=A1048576', 1, 0)).toBe('=#REF!');
  });

  it('30. Uscita dal limite massimo: colonna > 16384 (XFD) diventa #REF!', () => {
    expect(shiftFormula('=XFD1', 0, 1)).toBe('=#REF!');
  });

  it('31. Operatore postfisso percentuale =A1%', () => {
    expect(shiftFormula('=A1%', 1, 1)).toBe('=B2%');
  });

  it('32. Operatore unario negativo =-(A1+B1)', () => {
    expect(shiftFormula('=-(A1+B1)', 1, 1)).toBe('=-(B2+C2)');
  });

  it('33. Test negativo: formula sintatticamente errata lancia eccezione', () => {
    expect(() => shiftFormula('=SUM(++', 1, 1)).toThrow();
  });

  it('34. Test negativo: formula vuota lancia eccezione', () => {
    expect(() => shiftFormula('', 1, 1)).toThrow();
  });
});

describe('renameSheet - Riscrittura riferimenti nelle formule', () => {
  it('riscrive correttamente i riferimenti tra fogli quando un foglio viene rinominato', () => {
    const wb = createWorkbook();
    wb.addSheet('Dati');
    wb.addSheet('Report');

    wb.setCell('Dati', 'A1', '100');
    wb.setCell('Report', 'A1', '=Dati!A1 * 2');
    wb.setCell('Report', 'B1', '=SUM(Dati!A1:A5)');

    expect(wb.getCell('Report', 'A1').value).toEqual({ kind: 'number', value: 200 });

    // Rinomina 'Dati' in 'Sorgente'
    wb.renameSheet('Dati', 'Sorgente');

    // Verifica che la formula sia stata riscritta
    expect(wb.getCell('Report', 'A1').raw).toBe('=Sorgente!A1*2');
    expect(wb.getCell('Report', 'B1').raw).toBe('=SUM(Sorgente!A1:A5)');

    // Verifica che il valore sia ancora corretto
    expect(wb.getCell('Report', 'A1').value).toEqual({ kind: 'number', value: 200 });

    // Modificando Sorgente!A1 deve ricalcolarsi Report!A1
    wb.setCell('Sorgente', 'A1', '50');
    expect(wb.getCell('Report', 'A1').value).toEqual({ kind: 'number', value: 100 });
  });

  it('riscrive i riferimenti con fogli contenenti spazi e apici', () => {
    const wb = createWorkbook();
    wb.addSheet('Il mio foglio');
    wb.addSheet('Riepilogo');

    wb.setCell('Il mio foglio', 'A1', '42');
    wb.setCell('Riepilogo', 'A1', "='Il mio foglio'!A1 + 1");

    expect(wb.getCell('Riepilogo', 'A1').value).toEqual({ kind: 'number', value: 43 });

    wb.renameSheet('Il mio foglio', 'Nuovo');

    expect(wb.getCell('Riepilogo', 'A1').raw).toBe('=Nuovo!A1+1');
    expect(wb.getCell('Riepilogo', 'A1').value).toEqual({ kind: 'number', value: 43 });
  });
});
