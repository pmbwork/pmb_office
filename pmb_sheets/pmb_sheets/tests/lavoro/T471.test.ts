import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createRangeSelection, createCellSelection, setInternalClipboard, getInternalClipboard } from '../../src/sheet/index';
import { computeFillValue, valoreSerie, type FillSourceCell } from '../../src/sheet/fill';
import { aggiornaPerSpostamento, type BloccoSpostato } from '../../src/engine/sposta-riferimenti';

const celle = (...raws: string[]): FillSourceCell[] => raws.map((raw, i) => ({ row: i + 1, col: 1, raw }));
const giu = (src: FillSourceCell[], riga: number) => computeFillValue(src, riga, 1, 'down');

describe('T471: riempimento (A4)', () => {
  it('un numero solo si copia, anche con decimali', () => {
    expect(giu(celle('7'), 2)).toBe('7');
    expect(giu(celle('1.5'), 4)).toBe('1.5');
  });
  it('due o più numeri seguono la tendenza lineare, in basso e in alto', () => {
    expect([3, 4, 5].map((r) => giu(celle('10', '20'), r))).toEqual(['30', '40', '50']);
    expect(giu(celle('1', '2', '3'), 4)).toBe('4');
    expect(giu(celle('1', '2', '4'), 4)).toBe('5.33333333333'); // la retta passa tra i tre punti (pendenza 1,5), non solo per i primi due
    expect(computeFillValue(celle('10', '20'), 0, 1, 'up')).toBe('0');
    expect(giu(celle('0.1', '0.2'), 3)).toBe('0.3'); // niente rumore di virgola mobile
  });
  it('tre valori in progressione continuano la progressione (non solo i primi due)', () => {
    expect(giu(celle('5', '10', '15'), 4)).toBe('20');
  });
  it('mesi e giorni, interi o abbreviati, italiano e inglese; ricordano le maiuscole', () => {
    expect(giu(celle('Gen'), 2)).toBe('Feb');
    expect(giu(celle('Dic'), 2)).toBe('Gen');
    expect(giu(celle('lunedì'), 7 + 1)).toBe('lunedì');
    expect(giu(celle('Lunedì'), 3)).toBe('Mercoledì');
    expect(giu(celle('GENNAIO'), 2)).toBe('FEBBRAIO');
    expect(giu(celle('Monday'), 2)).toBe('Tuesday');
    expect(giu(celle('gio', 'ven'), 3)).toBe('sab');
    expect(giu(celle('gen', 'mar'), 3)).toBe('mag'); // passo 2
  });
  it('date: una cella avanza di un giorno, due celle di quanto distano', () => {
    expect(giu(celle('01/03/2026'), 2)).toBe('02/03/2026');
    expect(giu(celle('28/02/2026'), 2)).toBe('01/03/2026');
    expect(giu(celle('2026-12-31'), 2)).toBe('2027-01-01');
    expect(giu(celle('01/01/2026', '08/01/2026'), 3)).toBe('15/01/2026');
  });
  it('testo con numero in fondo: avanza, con gli zeri iniziali', () => {
    expect(giu(celle('Voce 1'), 3)).toBe('Voce 3');
    expect(giu(celle('Riga 001'), 2)).toBe('Riga 002');
    expect(giu(celle('Voce 1', 'Voce 3'), 3)).toBe('Voce 5');
  });
  it('testo qualunque e formule: si ripetono in ciclo, le formule traslano', () => {
    expect(giu(celle('alfa', 'beta'), 3)).toBe('alfa');
    expect(giu(celle('alfa', 'beta'), 4)).toBe('beta');
    expect(giu(celle('=A1*2'), 2)).toBe('=A2*2');
    expect(valoreSerie(['alfa'], 3)).toBeNull();
  });
});

describe('T471: riferimenti nelle formule dopo un taglia (C3)', () => {
  const blocco = (extra: Partial<BloccoSpostato> = {}): BloccoSpostato => ({ foglio: 'F', startRow: 1, endRow: 1, startCol: 2, endCol: 2, deltaRows: 7, deltaCols: 3, foglioDestinazione: 'F', ...extra });
  it('la formula spostata resta com\'era se cita celle fuori dal blocco', () => {
    expect(aggiornaPerSpostamento('=A1*2', 'F', blocco(), true)).toBe('=A1*2');
  });
  it('chi cita una cella spostata la segue, anche con riferimenti assoluti', () => {
    expect(aggiornaPerSpostamento('=B1+1', 'F', blocco(), false)).toBe('=E8+1');
    expect(aggiornaPerSpostamento('=$B$1+1', 'F', blocco(), false)).toBe('=$E$8+1');
  });
  it('una formula che non cita il blocco non cambia nemmeno nel testo', () => {
    expect(aggiornaPerSpostamento('=SUM( A1 : A3 )', 'F', blocco(), false)).toBe('=SUM( A1 : A3 )');
  });
  it('un intervallo segue solo se sta tutto dentro il blocco', () => {
    const b = blocco({ startRow: 1, endRow: 3, startCol: 1, endCol: 1, deltaRows: 10, deltaCols: 0 });
    expect(aggiornaPerSpostamento('=SUM(A1:A3)', 'F', b, false)).toBe('=SUM(A11:A13)');
    expect(aggiornaPerSpostamento('=SUM(A1:A5)', 'F', b, false)).toBe('=SUM(A1:A5)');
  });
  it('un altro foglio con lo stesso indirizzo non c\'entra', () => {
    expect(aggiornaPerSpostamento('=B1+Altro!B1', 'F', blocco(), false)).toBe('=E8+Altro!B1');
    expect(aggiornaPerSpostamento('=Altro!B1', 'F', blocco(), false)).toBe('=Altro!B1');
  });
  it('verso un altro foglio: i riferimenti aggiornati portano il foglio, e le formule spostate indicano il foglio di partenza', () => {
    const b = blocco({ foglioDestinazione: 'Dest' });
    expect(aggiornaPerSpostamento('=B1+1', 'F', b, false)).toBe('=Dest!E8+1');
    expect(aggiornaPerSpostamento('=A1*2', 'F', b, true)).toBe('=F!A1*2');
  });
  it('una formula illeggibile si restituisce com\'è', () => {
    expect(aggiornaPerSpostamento('=SUM(', 'F', blocco(), false)).toBe('=SUM(');
  });
});

describe('T471: taglia, incolla, appunti e cella attiva nella griglia', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  let appunti = '';

  beforeEach(async () => {
    setInternalClipboard(null);
    appunti = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { appunti = t; }, readText: async () => appunti } });
    const tabId = `test-T471-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  const doc = () => grid['getDoc']();
  const raw = async (r: number, c: number, f = doc().activeSheetName) => (await doc().client.getCell(f, r, c)).raw;
  const seleziona = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc().selection = r1 === r2 && c1 === c2 ? createCellSelection(r1, c1) : createRangeSelection(r1, c1, r2, c2); };

  it('taglia e incolla sposta la formula senza cambiarla e fa seguire chi la citava', async () => {
    const d = doc();
    const f = d.activeSheetName;
    await d.client.setCell(f, 1, 1, '10');
    await d.client.setCell(f, 1, 2, '=A1*2');
    await d.client.setCell(f, 3, 1, '=B1+1');
    seleziona(1, 2);
    await grid.cut();
    seleziona(8, 5);
    await grid.paste();
    expect(await raw(8, 5)).toBe('=A1*2'); // non =D8*2
    expect(await raw(1, 2)).toBe('');
    expect(await raw(3, 1)).toBe('=E8+1'); // chi la citava la segue
    expect((await d.client.getCell(f, 3, 1)).value).toMatchObject({ kind: 'number', value: 21 });
    // annulla riporta tutto
    await grid.undo();
    expect(await raw(1, 2)).toBe('=A1*2');
    expect(await raw(3, 1)).toBe('=B1+1');
    expect(await raw(8, 5)).toBe('');
  });

  it('taglia sposta anche gli stili e un blocco che si sovrappone a se stesso non si perde', async () => {
    const d = doc();
    const f = d.activeSheetName;
    await d.client.setCell(f, 1, 1, 'a');
    await d.client.setCell(f, 2, 1, 'b');
    await d.client.setCell(f, 3, 1, 'c');
    d.styles.cellStyles.set('1,1', d.styles.registry.register({ bold: true }));
    seleziona(1, 1, 3, 1);
    await grid.cut();
    seleziona(2, 1);
    await grid.paste();
    expect([await raw(1, 1), await raw(2, 1), await raw(3, 1), await raw(4, 1)]).toEqual(['', 'a', 'b', 'c']);
    expect([...d.styles.cellStyles.keys()]).toEqual(['2,1']);
    await grid.undo();
    expect([await raw(1, 1), await raw(2, 1), await raw(3, 1), await raw(4, 1)]).toEqual(['a', 'b', 'c', '']);
    expect([...doc().styles.cellStyles.keys()]).toEqual(['1,1']);
  });

  it('taglia verso un altro foglio: le formule tornano a citare il foglio di partenza', async () => {
    const d = doc();
    const primo = d.activeSheetName;
    await d.client.setCell(primo, 1, 1, '5');
    await d.client.setCell(primo, 2, 1, '=A1*3');
    seleziona(2, 1);
    await grid.cut();
    await grid.handleAddSheet('Altro');
    seleziona(1, 1);
    await grid.paste();
    expect(await raw(1, 1, 'Altro')).toBe(`=${primo}!A1*3`);
    expect(await raw(2, 1, primo)).toBe('');
    expect((await d.client.getCell('Altro', 1, 1)).value).toMatchObject({ kind: 'number', value: 15 });
  });

  it('copia e incolla (non taglia) traslano le formule come prima', async () => {
    const d = doc();
    const f = d.activeSheetName;
    await d.client.setCell(f, 1, 2, '=A1*2');
    seleziona(1, 2);
    await grid.copy();
    seleziona(5, 4);
    await grid.paste();
    expect(await raw(5, 4)).toBe('=C5*2');
    expect(await raw(1, 2)).toBe('=A1*2');
  });

  it('appunti: se un altro programma copia qualcosa, Ctrl+V incolla quello e non la vecchia copia interna', async () => {
    const d = doc();
    const f = d.activeSheetName;
    await d.client.setCell(f, 1, 1, 'interno');
    seleziona(1, 1);
    await grid.copy();
    expect(getInternalClipboard()).not.toBeNull();
    appunti = 'da fuori'; // copiato in un altro programma
    seleziona(3, 1);
    await grid.paste();
    expect(await raw(3, 1)).toBe('da fuori');
    expect(getInternalClipboard()).toBeNull();
  });

  it('appunti: se negli appunti c\'è ancora la nostra copia si incolla quella interna (con formule e stili)', async () => {
    const d = doc();
    const f = d.activeSheetName;
    await d.client.setCell(f, 1, 1, '=2+3');
    d.styles.cellStyles.set('1,1', d.styles.registry.register({ italic: true }));
    seleziona(1, 1);
    await grid.copy();
    seleziona(4, 1);
    await grid.paste();
    expect(await raw(4, 1)).toBe('=2+3'); // la formula, non il valore 5 scritto negli appunti di sistema
    expect(d.styles.cellStyles.has('4,1')).toBe(true);
  });

  it('appunti di sistema non leggibili: si usa la copia interna', async () => {
    const d = doc();
    await d.client.setCell(d.activeSheetName, 1, 1, 'x');
    seleziona(1, 1);
    await grid.copy();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {}, readText: async () => { throw new Error('permesso negato'); } } });
    seleziona(2, 1);
    await grid.paste();
    expect(await raw(2, 1)).toBe('x');
  });

  it('gli stili incollati vengono tradotti nel registro del file di adesso', async () => {
    const d = doc();
    seleziona(1, 1);
    const id = d.styles.registry.register({ bold: true, color: '#ff0000' });
    d.styles.cellStyles.set('1,1', id);
    await grid.copy();
    // si cambia il registro (come aprendo un altro file): gli indici non coincidono più
    const clip = getInternalClipboard()!;
    d.styles.registry.register({ underline: true });
    seleziona(5, 5);
    await grid.paste();
    const nuovo = d.styles.cellStyles.get('5,5')!;
    expect(d.styles.registry.getAllStyles()[nuovo]).toMatchObject({ bold: true, color: '#ff0000' });
    expect(clip.styleSnapshot![id]).toMatchObject({ bold: true });
  });

  it('dopo un trascinamento la cella in cui si scrive è la prima, non l\'ultima', async () => {
    seleziona(2, 1, 4, 2);
    const d = doc();
    expect(d.selection.anchor).toEqual({ row: 2, col: 1 });
    await grid.startEditing(true, 'x');
    await grid.updateComplete;
    grid['editValue'] = 'scritto';
    await grid.commitEdit();
    expect(await raw(2, 1)).toBe('scritto');
    expect(await raw(4, 2)).toBe('');
  });

  it('l\'ordinamento usa la colonna della prima cella selezionata', async () => {
    const d = doc();
    const f = d.activeSheetName;
    for (const [r, a, b] of [[1, '3', 'z'], [2, '1', 'y'], [3, '2', 'x']] as const) { await d.client.setCell(f, r, 1, a); await d.client.setCell(f, r, 2, b); }
    seleziona(1, 1, 3, 2); // da A1 a B3: la cella attiva è A1
    await grid.sortRange(true);
    expect([await raw(1, 1), await raw(2, 1), await raw(3, 1)]).toEqual(['1', '2', '3']);
    expect(vi.isMockFunction(grid.sortRange)).toBe(false);
  });
});
