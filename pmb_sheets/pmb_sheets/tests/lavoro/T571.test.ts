// T571: formattazioni condizionali di Excel che pmb_sheets non importava (segnalazione del 2026-11-22 su un registro di adeguata verifica):
// - le regole «periodo di tempo» (timePeriod: oggi, questo mese, mese prossimo...), usate per le scadenze;
// - i confronti con altre celle o con testo (cellIs «tra $C$2 e $E$2», «uguale a "SI"»): si leggevano solo i numeri fissi;
// - una regola su più aree ha la formula scritta per l'angolo in alto a sinistra di tutte le aree: va spostata per ogni area
//   (pmb_sheets valuta la formula rispetto all'angolo della sua area). Prima la stessa formula si copiava uguale su ogni area.
import { describe, expect, test } from 'vitest';
import { analizzaXml } from '@comune/formati/xml';
import { leggiCondizionali } from '../../src/formati/xlsx-extra';
import { Workbook } from '../../src/engine/workbook';
import type { ConditionalFormatRule } from '../../src/sheet/conditional-format';

const STILE = { backgroundColor: '#FFC7CE' };
const foglio = (cf: string) => analizzaXml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/>${cf}</worksheet>`);
const leggi = (cf: string) => leggiCondizionali(foglio(cf), [STILE as never, STILE as never]);
const vale = (w: Workbook, r: ConditionalFormatRule, riga: number, col: number) =>
  w.valutaCondizione('Foglio1', String(r.value1), riga, col, { riga: r.range.startRow, colonna: r.range.startCol });

describe('T571: formattazioni condizionali di Excel (periodi di tempo, confronti con celle, più aree)', () => {
  test('timePeriod «questo mese» e «mese prossimo» su due aree (J e O, formula scritta per J10 come fa Excel)', () => {
    const { regole, nonImportate } = leggi(`<conditionalFormatting sqref="O10:O20 J10:J20">
      <cfRule type="timePeriod" dxfId="0" priority="1" timePeriod="thisMonth"><formula>AND(MONTH(J10)=MONTH(TODAY()),YEAR(J10)=YEAR(TODAY()))</formula></cfRule>
      <cfRule type="timePeriod" dxfId="1" priority="2" timePeriod="nextMonth"><formula>AND(MONTH(J10)=MONTH(EDATE(TODAY(),0+1)),YEAR(J10)=YEAR(EDATE(TODAY(),0+1)))</formula></cfRule>
    </conditionalFormatting>`);
    expect(nonImportate).toBe(0);
    expect(regole).toHaveLength(4);
    expect(regole.every((r) => r.type === 'formula' && r.style)).toBe(true);
    const questoO = regole.find((r) => r.range.startCol === 15 && /MONTH\(TODAY\(\)\)/.test(String(r.value1)))!;
    const questoJ = regole.find((r) => r.range.startCol === 10 && /MONTH\(TODAY\(\)\)/.test(String(r.value1)))!;
    expect(String(questoJ.value1)).toContain('MONTH(J10)');
    expect(String(questoO.value1)).toContain('MONTH(O10)'); // spostata sull'area O
    const w = new Workbook();
    w.setCell('Foglio1', 'J10', '=TODAY()'); w.setCell('Foglio1', 'J11', '=EDATE(TODAY(),1)'); w.setCell('Foglio1', 'O12', '=TODAY()');
    const prossimoJ = regole.find((r) => r.range.startCol === 10 && /EDATE/.test(String(r.value1)))!;
    expect(vale(w, questoJ, 10, 10)).toBe(true);
    expect(vale(w, questoJ, 11, 10)).toBe(false);
    expect(vale(w, prossimoJ, 11, 10)).toBe(true);
    expect(vale(w, prossimoJ, 10, 10)).toBe(false);
    expect(vale(w, questoO, 12, 15)).toBe(true);   // la cella O12 guarda O12, non J12
    expect(vale(w, questoJ, 12, 10)).toBe(false);  // J12 è vuota
  });

  test('timePeriod senza formula nel file: la formula si ricava dal periodo (oggi, ieri, ultimi 7 giorni, mese scorso)', () => {
    const { regole, nonImportate } = leggi(`<conditionalFormatting sqref="A1:A10">
      <cfRule type="timePeriod" dxfId="0" priority="1" timePeriod="today"/>
      <cfRule type="timePeriod" dxfId="0" priority="2" timePeriod="yesterday"/>
      <cfRule type="timePeriod" dxfId="0" priority="3" timePeriod="last7Days"/>
      <cfRule type="timePeriod" dxfId="0" priority="4" timePeriod="lastMonth"/>
    </conditionalFormatting>`);
    expect(nonImportate).toBe(0);
    const [oggi, ieri, sette, scorso] = regole;
    const w = new Workbook();
    w.setCell('Foglio1', 'A1', '=TODAY()'); w.setCell('Foglio1', 'A2', '=TODAY()-1'); w.setCell('Foglio1', 'A3', '=TODAY()-3');
    w.setCell('Foglio1', 'A4', '=TODAY()-8'); w.setCell('Foglio1', 'A5', '=EDATE(TODAY(),-1)');
    expect([1, 2, 3, 4].map((r) => vale(w, oggi!, r, 1))).toEqual([true, false, false, false]);
    expect([1, 2, 3].map((r) => vale(w, ieri!, r, 1))).toEqual([false, true, false]);
    expect([1, 2, 3, 4].map((r) => vale(w, sette!, r, 1))).toEqual([true, true, true, false]);
    expect([1, 5].map((r) => vale(w, scorso!, r, 1))).toEqual([false, true]);
  });

  test('cellIs con riferimenti ad altre celle: «tra $C$2 e $E$2» diventa una formula e funziona', () => {
    const { regole, nonImportate } = leggi(`<conditionalFormatting sqref="C5:C20">
      <cfRule type="cellIs" dxfId="0" priority="1" operator="between"><formula>$C$2</formula><formula>$E$2</formula></cfRule>
    </conditionalFormatting>`);
    expect(nonImportate).toBe(0);
    const r = regole[0]!;
    expect(r.type).toBe('formula');
    const w = new Workbook();
    w.setCell('Foglio1', 'C2', '10'); w.setCell('Foglio1', 'E2', '20'); w.setCell('Foglio1', 'C5', '15'); w.setCell('Foglio1', 'C6', '25'); w.setCell('Foglio1', 'C7', '20');
    expect([5, 6, 7].map((riga) => vale(w, r, riga, 3))).toEqual([true, false, true]);
  });

  test('cellIs con testo e con operatori diversi; i numeri fissi restano regole «valore» come prima', () => {
    const { regole, nonImportate } = leggi(`<conditionalFormatting sqref="B1:B5">
      <cfRule type="cellIs" dxfId="0" priority="1" operator="equal"><formula>"SI"</formula></cfRule>
      <cfRule type="cellIs" dxfId="0" priority="2" operator="greaterThan"><formula>$D$1</formula></cfRule>
      <cfRule type="cellIs" dxfId="0" priority="3" operator="notBetween"><formula>$D$1</formula><formula>$D$2</formula></cfRule>
      <cfRule type="cellIs" dxfId="0" priority="4" operator="equal"><formula>0</formula></cfRule>
    </conditionalFormatting>`);
    expect(nonImportate).toBe(0);
    const [si, maggiore, fuori, zero] = regole;
    expect(zero).toMatchObject({ type: 'cell_value', operator: 'equal_to', value1: 0 });
    const w = new Workbook();
    w.setCell('Foglio1', 'B1', 'SI'); w.setCell('Foglio1', 'B2', 'NO'); w.setCell('Foglio1', 'B3', '7'); w.setCell('Foglio1', 'B4', '3');
    w.setCell('Foglio1', 'D1', '5'); w.setCell('Foglio1', 'D2', '6');
    expect([1, 2].map((riga) => vale(w, si!, riga, 2))).toEqual([true, false]);
    expect([3, 4].map((riga) => vale(w, maggiore!, riga, 2))).toEqual([true, false]);
    expect([3, 4].map((riga) => vale(w, fuori!, riga, 2))).toEqual([true, true]);
  });

  test('regola «formula» (expression) su più aree: ogni area guarda le sue celle (prima tutte guardavano la prima colonna)', () => {
    const { regole } = leggi(`<conditionalFormatting sqref="L10:L20 B10:B20">
      <cfRule type="expression" dxfId="0" priority="1"><formula>LEN(TRIM(B10))=0</formula></cfRule>
    </conditionalFormatting>`);
    const l = regole.find((r) => r.range.startCol === 12)!;
    const b = regole.find((r) => r.range.startCol === 2)!;
    expect(String(b.value1)).toBe('=LEN(TRIM(B10))=0');
    expect(String(l.value1)).toBe('=LEN(TRIM(L10))=0');
    const w = new Workbook();
    w.setCell('Foglio1', 'B10', 'pieno');
    expect(vale(w, l, 10, 12)).toBe(true);   // L10 è vuota
    expect(vale(w, b, 10, 2)).toBe(false);   // B10 è piena
  });
});
