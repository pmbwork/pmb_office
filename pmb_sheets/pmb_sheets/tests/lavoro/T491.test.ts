import { describe, it, expect, afterEach } from 'vitest';
import { translateFormula } from '../../src/engine/i18n';
import { daInputUtente, perInputUtente } from '../../src/sheet/input-locale';
import { createWorkbook } from '../../src/engine/workbook';
import { impostaLinguaNomi } from '../../src/engine/format-testo';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';

afterEach(() => { impostaLinguaNomi('en'); impostaLocaleNumeri('en'); });

describe('T491: nomi italiani', () => {
  it.each([['=LUNGHEZZA(A1)', '=LEN(A1)'], ['=LUNGH(A1)', '=LEN(A1)'], ['=MCM(4;6)', '=LCM(4,6)'], ['=m.c.m(4;6)', '=LCM(4,6)'], ['=MCD(12;18)', '=GCD(12,18)']])('%s → %s', (it, en) => {
    expect(translateFormula(it, 'it', 'en')).toBe(en);
  });
  it('verso l\'italiano LCM diventa MCM e LEN resta LUNGH', () => {
    expect(translateFormula('=LCM(4,6)', 'en', 'it')).toBe('=MCM(4;6)');
    expect(translateFormula('=LEN(A1)', 'en', 'it')).toBe('=LUNGHEZZA(A1)');   // il nome di Excel (2026-11-20); LUNGH si capisce ancora
  });
});

describe('T491: TESTO con il formato scritto all\'italiana', () => {
  it.each([
    ['=TESTO(1234,5;"#.##0,00")', '=TEXT(1234.5,"#,##0.00")'],
    ['=TESTO(A1;"gg/mm/aaaa")', '=TEXT(A1,"dd/mm/yyyy")'],
    ['=TESTO(A1;"gggg d mmmm aaaa")', '=TEXT(A1,"dddd d mmmm yyyy")'],
    ['=TESTO(A1;"0,0%")', '=TEXT(A1,"0.0%")'],
    ['=TESTO(A1;"hh:mm AM/PM")', '=TEXT(A1,"hh:mm AM/PM")'],
    ['=TESTO(A1;"#.##0,00 ""€""")', '=TEXT(A1,"#,##0.00 ""€""")'],
    ['=TESTO(A1;"[h]:mm")', '=TEXT(A1,"[h]:mm")'],
    ['=SE(TESTO(A1;"aaaa")="2026";"si";"no")', '=IF(TEXT(A1,"yyyy")="2026","si","no")'],
    ['=TESTO(SOMMA(A1:A3);"#.##0")', '=TEXT(SUM(A1:A3),"#,##0")'],
    ['=TESTO(A1;B1)', '=TEXT(A1,B1)'],
  ])('%s → %s', (it, en) => {
    expect(translateFormula(it, 'it', 'en')).toBe(en);
  });

  it.each([
    ['=TEXT(1234.5,"#,##0.00")', '=TESTO(1234,5;"#.##0,00")'],
    ['=TEXT(A1,"dd/mm/yyyy")', '=TESTO(A1;"gg/mm/aaaa")'],
    ['=TEXT(A1,"dddd d mmmm yyyy")', '=TESTO(A1;"gggg g mmmm aaaa")'],
  ])('ritorno: %s → %s', (en, it) => {
    expect(translateFormula(en, 'en', 'it')).toBe(it);
  });

  it('andata e ritorno non cambiano la formula', () => {
    for (const f of ['=TESTO(A1;"gg/mm/aaaa hh:mm")', '=TESTO(1234,5;"#.##0,00")', '=SE(TESTO(A1;"mmmm")="marzo";1;0)']) {
      expect(perInputUtente(daInputUtente(f))).toBe(f);
    }
  });

  it('altre funzioni con testi tra virgolette non vengono toccate', () => {
    expect(translateFormula('=CONCATENA("gg.aa";",")', 'it', 'en')).toBe('=CONCATENATE("gg.aa",",")');
    expect(translateFormula('=SE(A1="a.b";"g";"a")', 'it', 'en')).toBe('=IF(A1="a.b","g","a")');
  });
});

describe('T491: il risultato di TESTO segue la lingua del programma', () => {
  const calcola = (formula: string, a1 = 1234.5): { kind: string; value?: unknown } => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', String(a1));
    w.setCell('Foglio1', 'B1', daInputUtente(formula));
    return w.getCell('Foglio1', 'B1').value as { kind: string; value?: unknown };
  };

  it('in italiano =TESTO(A1;"#.##0,00") scrive 1.234,50', () => {
    impostaLinguaNomi('it'); impostaLocaleNumeri('it');
    expect(calcola('=TESTO(A1;"#.##0,00")').value).toBe('1.234,50');
    expect(calcola('=TESTO(A1;"0,0")').value).toBe('1234,5');
    expect(calcola('=TESTO(A1;"0,0%")', 0.256).value).toBe('25,6%');
  });

  it('in italiano le date escono con i nomi italiani: =TESTO(A1;"gggg d mmmm aaaa")', () => {
    impostaLinguaNomi('it'); impostaLocaleNumeri('it');
    expect(calcola('=TESTO(A1;"gggg d mmmm aaaa")', 46086).value).toBe('giovedì 5 marzo 2026');
    expect(calcola('=TESTO(A1;"gg/mm/aaaa")', 46086).value).toBe('05/03/2026');
  });

  it('in inglese resta tutto com\'era', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '1234.5');
    w.setCell('Foglio1', 'B1', '=TEXT(A1,"#,##0.00")');
    expect((w.getCell('Foglio1', 'B1').value as { value: unknown }).value).toBe('1,234.50');
  });
});

describe('T491: VERO/FALSO dentro le celle e alias', () => {
  it('SOMMA.PRODOTTO si traduce come MATR.SOMMA.PRODOTTO', () => {
    expect(translateFormula('=SOMMA.PRODOTTO(A1:A3;B1:B3)', 'it', 'en')).toBe('=SUMPRODUCT(A1:A3,B1:B3)');
    expect(translateFormula('=SUMPRODUCT(A1:A3,B1:B3)', 'en', 'it')).toBe('=MATR.SOMMA.PRODOTTO(A1:A3;B1:B3)');
  });
});
