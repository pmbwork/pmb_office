import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { daInputUtente, perInputUtente } from '../../src/sheet/input-locale';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

describe('T311: dal testo scritto alla forma interna', () => {
  it.each([
    ['1,5', '1.5'], ['-0,25', '-0.25'], ['+3,14', '+3.14'], ['0,5', '0.5'], ['12,5%', '12.5%'], ['10,0', '10.0'],
    [' 1,5 ', '1.5'], ['  -2,75', '-2.75'],
  ])('un numero con la virgola: %j → %j', (entra, esce) => { expect(daInputUtente(entra)).toBe(esce); });

  it.each([
    ['1.234', '1234'], ['1.234.567', '1234567'], ['1.234,56', '1234.56'], ['-12.345,5', '-12345.5'], ['+1.000', '+1000'], ['999.999,9%', '999999.9%'],
  ])('un numero con il punto delle migliaia: %j → %j', (entra, esce) => { expect(daInputUtente(entra)).toBe(esce); });

  it.each([
    '1.5', '10', '-7', 'abc', '', ' ', '1,5,3', '1,5 kg', '3,', ',5', '12.34', '1.2345', '1,234.5', '1.234.5', 'v1,5', '0x1,5', '1,5%%', '1;5', '1,5e3',
    '1234.567', '1.234 kg', '1.23.456', '1.50.000', '1.234,', '1.234,5,6',
  ])('quello che non è un numero italiano resta com\'è: %j', (testo) => { expect(daInputUtente(testo)).toBe(testo); });

  it('le formule si traducono: nomi, punto e virgola, virgola decimale, parole VERO e FALSO', () => {
    expect(daInputUtente('=SOMMA(B2;B3)')).toBe('=SUM(B2,B3)');
    expect(daInputUtente('=A1*1,5')).toBe('=A1*1.5');
    expect(daInputUtente('=SE(A1>0,5;1,25;2)')).toBe('=IF(A1>0.5,1.25,2)');
    expect(daInputUtente('=VERO')).toBe('=TRUE');
    expect(daInputUtente('=SE(FALSO;1;2)')).toBe('=IF(FALSE,1,2)');
    expect(daInputUtente('=SOMMA.SE(A1:A5;">3";B1:B5)')).toBe('=SUMIF(A1:A5,">3",B1:B5)');
  });
  it('le stringhe tra virgolette nelle formule non si toccano', () => {
    expect(daInputUtente('=SE(A1;"uno; due, 1,5";"x")')).toBe('=IF(A1,"uno; due, 1,5","x")');
  });
  it('una formula già scritta con le virgole tra celle resta com\'è, e il segno uguale da solo anche', () => {
    expect(daInputUtente('=SUM(A1,A2)')).toBe('=SUM(A1,A2)');
    expect(daInputUtente('=')).toBe('=');
  });
  it('una formula con spazi iniziali prima del segno uguale non è una formula', () => {
    expect(daInputUtente(' =SOMMA(A1;A2)')).toBe(' =SOMMA(A1;A2)');
  });
});

describe('T311: dalla forma interna al testo da mostrare mentre si modifica', () => {
  it.each([
    ['1.5', '1,5'], ['-0.25', '-0,25'], ['+3.14', '+3,14'], ['12.5%', '12,5%'], ['0.001', '0,001'],
  ])('un numero con i decimali: %j → %j', (raw, mostrato) => { expect(perInputUtente(raw)).toBe(mostrato); });

  it.each(['10', '-7', 'abc', '', '1.2.3', 'v1.5', '1.5kg', '.5', '5.', '1,5', '1e3'])('il resto resta com\'è: %j', (raw) => { expect(perInputUtente(raw)).toBe(raw); });

  it('le formule si traducono nell\'altro verso', () => {
    expect(perInputUtente('=SUM(B2,B3)')).toBe('=SOMMA(B2;B3)');
    expect(perInputUtente('=A1*1.5')).toBe('=A1*1,5');
    expect(perInputUtente('=IF(A1>0.5,1.25,2)')).toBe('=SE(A1>0,5;1,25;2)');
    expect(perInputUtente('=TRUE')).toBe('=VERO');
    expect(perInputUtente('=SUMIF(A1:A5,">3",B1:B5)')).toBe('=SOMMA.SE(A1:A5;">3";B1:B5)');
  });
  it('andata e ritorno: quello che si mostra, riscritto così com\'è, dà di nuovo la forma interna', () => {
    for (const raw of ['1.5', '-0.25', '12.5%', '100', 'testo', '=SUM(B2,B3)', '=A1*1.5', '=IF(A1>0.5,1.25,2)', '=SUMIF(A1:A5,">3",B1:B5)', '=TRUE', '=SUM(A1:A3)/COUNT(A1:A3)']) {
      expect(daInputUtente(perInputUtente(raw)), raw).toBe(raw);
    }
  });
});

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; startEditing: (r?: boolean, c?: string) => Promise<void>; commitEdit: () => Promise<void>; paste: () => Promise<void>;
  updateComplete: Promise<unknown>; editValue: string; formulaBarValue: string; isEditing: boolean;
  handleEditorKeydown: (e: KeyboardEvent) => Promise<void>; handleCellMouseDown: (r: number, c: number, e: MouseEvent) => void;
};

let griglia: Griglia;
let doc: SheetDocument;

async function seleziona(riga: number, col: number, riga2 = riga, col2 = col): Promise<void> {
  doc.selection = { anchor: { row: riga, col }, active: { row: riga, col }, range: { startRow: riga, endRow: riga2, startCol: col, endCol: col2 } } as SheetDocument['selection'];
  griglia.requestUpdate?.call(griglia);
  await griglia.updateComplete;
}
async function scrivi(riga: number, col: number, testo: string): Promise<void> {
  await seleziona(riga, col);
  await griglia.startEditing(true, '');
  griglia.editValue = testo;
  await griglia.commitEdit();
}
const grezzo = async (r: number, c: number): Promise<string> => (await doc.client.getCell(doc.activeSheetName, r, c)).raw;
const valore = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).value;

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
afterEach(() => { vi.unstubAllGlobals(); });

describe('T311: nella griglia', () => {
  it('scrivere 1,5 e 2,25 dà due numeri, e =SOMMA(B2;B3) fa 3,75', async () => {
    await scrivi(2, 2, '1,5');
    await scrivi(3, 2, '2,25');
    expect(await grezzo(2, 2)).toBe('1.5');
    expect(await valore(2, 2)).toMatchObject({ kind: 'number', value: 1.5 });
    expect(await valore(3, 2)).toMatchObject({ kind: 'number', value: 2.25 });
    await scrivi(4, 2, '=SOMMA(B2;B3)');
    expect(await grezzo(4, 2)).toBe('=SUM(B2,B3)');
    expect(await valore(4, 2)).toMatchObject({ kind: 'number', value: 3.75 });
  });

  it('le migliaia con il punto e le percentuali con la virgola', async () => {
    await scrivi(1, 1, '1.234,5');
    await scrivi(2, 1, '1.000');
    await scrivi(3, 1, '12,5%');
    expect(await grezzo(1, 1)).toBe('1234.5');
    expect(await grezzo(2, 1)).toBe('1000');
    expect(await grezzo(3, 1)).toBe('0.125'); // 12,5% è il numero 0,125 mostrato come percentuale
    expect(await valore(1, 1)).toMatchObject({ kind: 'number', value: 1234.5 });
  });

  it('una formula con la virgola decimale: =A1*1,5', async () => {
    await scrivi(1, 1, '10');
    await scrivi(1, 2, '=A1*1,5');
    expect(await grezzo(1, 2)).toBe('=A1*1.5');
    expect(await valore(1, 2)).toMatchObject({ kind: 'number', value: 15 });
  });

  it('il testo normale non cambia', async () => {
    await scrivi(1, 1, 'Mela, rossa; buona');
    await scrivi(2, 1, '1,5 kg');
    expect(await grezzo(1, 1)).toBe('Mela, rossa; buona');
    expect(await grezzo(2, 1)).toBe('1,5 kg');
  });

  it('rimodificando una cella si rivede quello che si è scritto: numeri con la virgola, formule con i nomi italiani', async () => {
    await scrivi(2, 2, '1,5');
    await scrivi(4, 2, '=SOMMA(B2;B3)');
    await seleziona(2, 2);
    await griglia.startEditing(false);
    expect(griglia.editValue).toBe('1,5');
    expect(griglia.formulaBarValue).toBe('1,5');
    griglia.isEditing = false;
    await seleziona(4, 2);
    await griglia.startEditing(false);
    expect(griglia.editValue).toBe('=SOMMA(B2;B3)');
  });

  it('la barra della formula mostra la formula in italiano quando si seleziona la cella', async () => {
    await scrivi(4, 2, '=SOMMA(B2;B3)');
    await seleziona(4, 2);
    await vi.waitFor(() => expect(griglia.formulaBarValue).toBe('=SOMMA(B2;B3)'));
    await scrivi(1, 1, '2,5');
    await seleziona(1, 1);
    await vi.waitFor(() => expect(griglia.formulaBarValue).toBe('2,5'));
  });

  it('riaprire una cella e confermare senza cambiare lascia il valore interno come prima', async () => {
    await scrivi(2, 2, '1,5');
    await seleziona(2, 2);
    await griglia.startEditing(false);
    await griglia.commitEdit();
    expect(await grezzo(2, 2)).toBe('1.5');
    await scrivi(4, 2, '=SOMMA(B2;B3)');
    await seleziona(4, 2);
    await griglia.startEditing(false);
    await griglia.commitEdit();
    expect(await grezzo(4, 2)).toBe('=SUM(B2,B3)');
  });

  it('partendo a scrivere sopra (sostituisce) il testo iniziale non viene toccato', async () => {
    await seleziona(1, 1);
    await griglia.startEditing(true, '7');
    expect(griglia.editValue).toBe('7');
  });

  it('Ctrl+Invio riempie la selezione con il numero convertito', async () => {
    await seleziona(1, 1, 2, 1);
    await griglia.startEditing(true, '');
    griglia.editValue = '2,5';
    await griglia.handleEditorKeydown(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true }));
    expect(await grezzo(1, 1)).toBe('2.5');
    expect(await grezzo(2, 1)).toBe('2.5');
  });

  it('incollare da fuori testo con la virgola decimale lo mette come numeri', async () => {
    vi.stubGlobal('navigator', { clipboard: { readText: async () => '1,5\t2,5\n3,75\tx\n' } });
    await seleziona(1, 1);
    await griglia.paste();
    expect(await grezzo(1, 1)).toBe('1.5');
    expect(await grezzo(1, 2)).toBe('2.5');
    expect(await grezzo(2, 1)).toBe('3.75');
    expect(await grezzo(2, 2)).toBe('x');
  });

  it('cliccando una cella dopo un punto e virgola, in una formula, se ne inserisce il riferimento', async () => {
    await seleziona(1, 1);
    await griglia.startEditing(true, '');
    griglia.editValue = '=SOMMA(A1;';
    griglia.handleCellMouseDown(3, 2, new MouseEvent('mousedown'));
    expect(griglia.editValue).toBe('=SOMMA(A1;B3');
  });

  it('dopo una virgola, un operatore o una parentesi il clic su una cella continua a inserire il riferimento', async () => {
    for (const fine of [',', '+', '(', '*']) {
      await seleziona(1, 1);
      griglia.isEditing = false;
      await griglia.startEditing(true, '');
      griglia.editValue = `=SUM(A1${fine}`;
      griglia.handleCellMouseDown(2, 3, new MouseEvent('mousedown'));
      expect(griglia.editValue, fine).toBe(`=SUM(A1${fine}C2`);
    }
  });

  it('dopo una lettera il clic su una cella non inserisce il riferimento', async () => {
    await seleziona(1, 1);
    await griglia.startEditing(true, '');
    griglia.editValue = '=SOMMA(A1';
    griglia.handleCellMouseDown(2, 3, new MouseEvent('mousedown'));
    expect(griglia.editValue).not.toContain('C2');
  });
});
