import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { interpretaInput } from '../../src/sheet/input-locale';
import { formatCellValue } from '../../src/sheet/number-format';
import { formatDisplayNumber } from '../../src/sheet/format-display';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';
import { impostaLinguaNomi } from '../../src/engine/format-testo';
import { createWorkbook } from '../../src/engine/workbook';
import { contestoNavigazione } from '../../src/sheet/contesto-navigazione';
import { handleNavigationKey } from '../../src/sheet/navigation';
import { createCellSelection } from '../../src/sheet/selection';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { resolveCellStyle } from '../../src/sheet/styles';

describe('T477: date, ore, percentuali e valute scritte a mano', () => {
  beforeEach(() => impostaLocaleNumeri('it'));
  afterEach(() => impostaLocaleNumeri('en'));

  it.each([
    ['05/03/2026', '46086', 'dd/mm/yyyy'],
    ['5/3/26', '46086', 'dd/mm/yyyy'],
    ['05-03-2026', '46086', 'dd/mm/yyyy'],
    ['05.03.2026', '46086', 'dd/mm/yyyy'],
    ['2026-03-05', '46086', 'dd/mm/yyyy'],
    ['29/02/2024', '45351', 'dd/mm/yyyy'],
    ['01/01/1930', '10959', 'dd/mm/yyyy'],
  ])('una data: %j → %s', (testo, raw, formato) => { expect(interpretaInput(testo)).toEqual({ raw, formato }); });

  it.each(['31/02/2026', '32/01/2026', '00/01/2026', '29/02/2025', '5/13/2026', '1/2', '2026/03/05', '05/03', 'ciao 05/03/2026'])('una data impossibile o incompleta resta testo: %j', (testo) => {
    expect(interpretaInput(testo)).toEqual({ raw: testo });
  });

  it.each([
    ['12:30', '0.520833333333333', 'hh:mm'],
    ['00:00', '0', 'hh:mm'],
    ['12:30:15', '0.521006944444444', 'hh:mm:ss'],
    ['6:00 PM', '0.75', 'h:mm AM/PM'],
    ['12:00 AM', '0', 'h:mm AM/PM'],
    ['12:00 pm', '0.5', 'h:mm AM/PM'],
  ])('un\'ora: %j → %s', (testo, raw, formato) => { expect(interpretaInput(testo)).toEqual({ raw, formato }); });

  it.each(['24:00', '12:60', '12:30:61', '13:00 PM', '0:30 AM', '12:3'])('un\'ora impossibile resta testo: %j', (testo) => {
    expect(interpretaInput(testo)).toEqual({ raw: testo });
  });

  it('data e ora insieme', () => {
    expect(interpretaInput('05/03/2026 18:00')).toEqual({ raw: '46086.75', formato: 'dd/mm/yyyy hh:mm' });
    expect(interpretaInput('05/03/2026 18:00:30')).toEqual({ raw: '46086.7503472222', formato: 'dd/mm/yyyy hh:mm:ss' });
  });

  it.each([
    ['10%', '0.1', '0%'], ['10,5%', '0.105', '0.0%'], ['-3%', '-0.03', '0%'], ['0,25%', '0.0025', '0.00%'], ['1.000%', '10', '0%'], ['12,5 %', '0.125', '0.0%'],
  ])('una percentuale: %j → %s', (testo, raw, formato) => { expect(interpretaInput(testo)).toEqual({ raw, formato }); });

  it.each([
    ['€5', '5'], ['€ 1.234,50', '1234.5'], ['5 €', '5'], ['-€5', '-5'], ['€-5', '-5'], ['1.234,5€', '1234.5'], ['€0,99', '0.99'],
  ])('una valuta: %j → %s', (testo, raw) => { expect(interpretaInput(testo)).toEqual({ raw, formato: '€#,##0.00' }); });

  it('il resto resta com\'è, senza formato', () => {
    for (const t of ['ciao', '', '12', '1,5', '1.234,5', '=A1+1', "'05/03/2026", '5 euro', '€', '%', 'abc%', '12:30 circa', 'VERO']) {
      const r = interpretaInput(t);
      expect(r.formato, t).toBeUndefined();
    }
    expect(interpretaInput("'05/03/2026").raw).toBe("'05/03/2026");
    expect(interpretaInput('1,5').raw).toBe('1.5');
    expect(interpretaInput('VERO').raw).toBe('TRUE');
    expect(interpretaInput('=SOMMA(A1;A2)').raw).toBe('=SUM(A1,A2)');
  });

  it('con i numeri all\'inglese la data è mese/giorno', () => {
    impostaLocaleNumeri('en');
    expect(interpretaInput('03/05/2026')).toEqual({ raw: '46086', formato: 'dd/mm/yyyy' });
    expect(interpretaInput('13/05/2026')).toEqual({ raw: '13/05/2026' });
  });
});

describe('T477: formati numerici come in Excel', () => {
  afterEach(() => { impostaLocaleNumeri('en'); impostaLinguaNomi('en'); });

  it.each([
    [1234.5, '#,##0.00 "€"', '1,234.50 €'],
    [1234.5, '"EUR" #,##0.00', 'EUR 1,234.50'],
    [7, '000', '007'],
    [1234.5, '#,##0;[Red]-#,##0', '1,235'],
    [-1234.5, '#,##0;[Red]-#,##0', '-1,235'],
    [-1234.5, '#,##0.00;(#,##0.00)', '(1,234.50)'],
    [0, '#,##0.00;(#,##0.00);"zero"', 'zero'],
    [45356, 'dddd d mmmm yyyy', 'Tuesday 5 March 2024'],
    [45356.75, 'dd/mm/yyyy hh:mm', '05/03/2024 18:00'],
    [0.75, 'h:mm AM/PM', '6:00 PM'],
    [1.5, '[h]:mm', '36:00'],
    [2.25, '[h]:mm:ss', '54:00:00'],
    [1234.5, '[$€-410] #,##0.00', '€ 1,234.50'],
    [1.5, '# ?/?', '1 1/2'],
    [0.75, '# ?/?', '3/4'],
    [3, '# ?/?', '3'],
    [0.3333333, '# ??/??', '1/3'],
    [1.25, '# ?/8', '1 2/8'],
    [0.5, '0%', '50%'],
    [1234.5678, '0.0', '1234.6'],
    [1234.5678, '#,##0', '1,235'],
    [12345, '0.00E+00', '1.23E+04'],
    [-5, '0.00', '-5.00'],
  ])('%s con %j → %j', (n, codice, atteso) => { expect(formatCellValue(n, codice)).toBe(atteso); });

  it('in italiano il punto e la virgola dei numeri si scambiano, ma non quelli dentro le virgolette', () => {
    impostaLocaleNumeri('it');
    impostaLinguaNomi('it');
    expect(formatCellValue(1234.5, '#,##0.00 "€"')).toBe('1.234,50 €');
    expect(formatCellValue(1234.5, '0.0 "kg."')).toBe('1234,5 kg.');
    expect(formatCellValue(45356, 'dddd d mmmm yyyy')).toBe('martedì 5 marzo 2024');
    expect(formatCellValue(45356, 'dd.mm.yyyy')).toBe('05.03.2024');
    expect(formatCellValue(1234.5, '€#,##0.00')).toBe('€1.234,50');
  });

  it('i formati che il foglio già aveva continuano a dare lo stesso testo', () => {
    expect(formatCellValue(1234.5, '€#,##0.00')).toBe('€1,234.50');
    expect(formatCellValue(-1234.5, '€#,##0.00')).toBe('-€1,234.50');
    expect(formatCellValue(0.1234, '0.0%')).toBe('12.3%');
    expect(formatCellValue(45351, 'dd/mm/yyyy')).toBe('29/02/2024');
    expect(formatCellValue(0.5, 'hh:mm:ss')).toBe('12:00:00');
  });

  it('un codice che non si capisce lascia il numero com\'è', () => {
    expect(formatCellValue(123.45, 'FORM_NON_ESISTENTE_XYZ')).toBe('123.45');
    expect(formatCellValue(99, '???###!!!')).toBe('99');
    expect(formatCellValue(5, 'a;b;c;d;e')).toBe('5');
  });
});

describe('T477: numeri lunghi', () => {
  it('gli interi fino a 15 cifre si vedono per intero, i più grandi in notazione scientifica', () => {
    impostaLocaleNumeri('it');
    try {
      expect(formatDisplayNumber(8001234567890)).toBe('8001234567890');
      expect(formatDisplayNumber(12345678901234)).toBe('12345678901234');
      expect(formatDisplayNumber(-123456789012345)).toBe('-123456789012345');
      expect(formatDisplayNumber(1e15)).toBe('1e+15');
      expect(formatDisplayNumber(1.5e12 + 0.5)).toContain('e');
    } finally { impostaLocaleNumeri('en'); }
  });
});

describe('T477: Ctrl+frecce si fermano ai bordi dei dati', () => {
  function libro() {
    const w = createWorkbook();
    // colonna A: righe 1-3 piene, 4-5 vuote, 6-7 piene; riga 1: A, B, C piene, D vuota, F piena
    for (const [a, v] of [['A1', '1'], ['A2', '2'], ['A3', '3'], ['A6', '6'], ['A7', '7'], ['B1', '1'], ['C1', '1'], ['F1', '1']]) w.setCell('Foglio1', a, v);
    return w;
  }
  const vai = (w: ReturnType<typeof libro>, da: [number, number], tasto: string) => {
    const sel = handleNavigationKey(createCellSelection(da[0], da[1]), tasto, { ctrlKey: true }, contestoNavigazione(w, 'Foglio1', 20));
    return [sel!.active.row, sel!.active.col];
  };

  it('dentro un blocco va all\'ultima cella piena del blocco', () => {
    const w = libro();
    expect(vai(w, [1, 1], 'ArrowDown')).toEqual([3, 1]);
    expect(vai(w, [1, 1], 'ArrowRight')).toEqual([1, 3]);
    expect(vai(w, [6, 1], 'ArrowDown')).toEqual([7, 1]);
  });
  it('da una cella piena a fine blocco salta alla prossima piena', () => {
    const w = libro();
    expect(vai(w, [3, 1], 'ArrowDown')).toEqual([6, 1]);
    expect(vai(w, [1, 3], 'ArrowRight')).toEqual([1, 6]);
    expect(vai(w, [7, 1], 'ArrowUp')).toEqual([6, 1]);
  });
  it('da una cella vuota va alla prima piena, o al bordo del foglio se non ce ne sono', () => {
    const w = libro();
    expect(vai(w, [4, 1], 'ArrowDown')).toEqual([6, 1]);
    expect(vai(w, [4, 1], 'ArrowUp')).toEqual([3, 1]);
    expect(vai(w, [8, 1], 'ArrowDown')).toEqual([1048576, 1]);
    expect(vai(w, [1, 6], 'ArrowRight')).toEqual([1, 16384]);
  });
  it('Ctrl+Fine va all\'ultima riga e colonna usate', () => {
    const w = libro();
    expect(vai(w, [1, 1], 'End')).toEqual([7, 6]);
    expect(vai(createWorkbook(), [3, 3], 'End')).toEqual([1, 1]);
  });
  it('una cella con un risultato espanso da una formula conta come piena', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=SEQUENCE(4)');
    expect(vai(w, [1, 1], 'ArrowDown')).toEqual([4, 1]);
  });
});

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; startEditing: (r?: boolean, c?: string) => Promise<void>; commitEdit: () => Promise<void>; paste: () => Promise<void>;
  updateComplete: Promise<unknown>; editValue: string;
};
let griglia: Griglia;
let doc: SheetDocument;

async function seleziona(riga: number, col: number): Promise<void> {
  doc.selection = { anchor: { row: riga, col }, active: { row: riga, col }, range: { startRow: riga, endRow: riga, startCol: col, endCol: col } } as SheetDocument['selection'];
  griglia.requestUpdate?.call(griglia);
  await griglia.updateComplete;
}
async function scrivi(riga: number, col: number, testo: string): Promise<void> {
  await seleziona(riga, col);
  await griglia.startEditing(true, '');
  griglia.editValue = testo;
  await griglia.commitEdit();
}
const grezzo = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw;
const formato = (r: number, c: number) => resolveCellStyle(r, c, doc.styles).numFmt || '';

describe('T477: nella griglia', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    defaultDocumentStore.clear();
    const app = document.createElement('free-app') as App;
    document.body.appendChild(app);
    await app.updateComplete;
    griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
    await griglia.updateComplete;
    doc = griglia.getDoc();
  });

  it('scrivere una data la trasforma in data: numero di serie e formato, e si annulla in un colpo solo', async () => {
    await scrivi(1, 1, '05/03/2026');
    expect(await grezzo(1, 1)).toBe('46086');
    expect(formato(1, 1)).toBe('dd/mm/yyyy');
    await scrivi(1, 2, '=YEAR(A1)');
    expect(await doc.client.getCell(doc.activeSheetName, 1, 2)).toMatchObject({ value: { kind: 'number', value: 2026 } });
    doc.history.undo?.call(doc.history);
  });

  it('percentuale, valuta e ora prendono il loro formato', async () => {
    await scrivi(2, 1, '10,5%');
    await scrivi(3, 1, '€ 1.234,50');
    await scrivi(4, 1, '18:30');
    expect(await grezzo(2, 1)).toBe('0.105');
    expect(formato(2, 1)).toBe('0.0%');
    expect(await grezzo(3, 1)).toBe('1234.5');
    expect(formato(3, 1)).toBe('€#,##0.00');
    expect(formato(4, 1)).toBe('hh:mm');
  });

  it('in una cella che ha già un formato, quello non cambia; in una a formato Testo resta quello che si è scritto', async () => {
    await seleziona(5, 1);
    griglia.getDoc();
    (griglia as unknown as { applyFormat: (p: object) => void }).applyFormat({ numFmt: '0.00' });
    await scrivi(5, 1, '10%');
    expect(await grezzo(5, 1)).toBe('0.1');
    expect(formato(5, 1)).toBe('0.00');

    await seleziona(6, 1);
    (griglia as unknown as { applyFormat: (p: object) => void }).applyFormat({ numFmt: '@' });
    await scrivi(6, 1, '05/03/2026');
    expect(await grezzo(6, 1)).toBe('05/03/2026');
    expect(formato(6, 1)).toBe('@');
  });

  it('il testo lungo esce sulle celle vuote a destra e si ferma davanti alla prima piena', async () => {
    await scrivi(1, 1, 'Un testo molto lungo che non sta nella colonna A');
    await scrivi(1, 4, 'x');
    (griglia as unknown as { requestUpdate: () => void }).requestUpdate();
    await griglia.updateComplete;
    const td = (r: number, c: number) => griglia.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement;
    expect(td(1, 1).classList.contains('trabocca')).toBe(true);
    const span = td(1, 1).querySelector('.testo-trabocca') as HTMLElement;
    expect(span).toBeTruthy();
    // tre colonne (A, B, C) meno il margine; la D è piena
    const larghezza = (c: number) => parseFloat(td(1, c).style.width);
    expect(parseFloat(span.style.width)).toBeCloseTo(larghezza(1) + larghezza(2) + larghezza(3) - 8, 0);
    // la D ha il suo testo, che a sua volta esce sulle celle vuote a destra: non si sovrappone alla A
    expect(td(1, 1).querySelectorAll('.testo-trabocca')).toHaveLength(1);
  });

  it('un numero, un testo a capo o uno allineato a destra non escono', async () => {
    await scrivi(2, 1, '12345');
    await scrivi(3, 1, 'testo a capo molto lungo per la colonna');
    (griglia as unknown as { applyFormat: (p: object) => void }).applyFormat({ wrap: true });
    await scrivi(4, 1, 'testo a destra molto lungo per la colonna');
    await seleziona(4, 1);
    (griglia as unknown as { applyFormat: (p: object) => void }).applyFormat({ hAlign: 'right' });
    (griglia as unknown as { requestUpdate: () => void }).requestUpdate();
    await griglia.updateComplete;
    const td = (r: number, c: number) => griglia.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement;
    for (const r of [2, 4]) expect(td(r, 1).classList.contains('trabocca'), `riga ${r}`).toBe(false);
  });
});
