import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { regioneDati, ritocchiTabella, COLORE_INTESTAZIONE, COLORE_STRISCIA } from '../../src/sheet/tabella';
import { resolveCellStyle } from '../../src/sheet/styles';

const daMappa = (celle: Array<[number, number]>) => { const s = new Set(celle.map(([r, c]) => `${r},${c}`)); return (r: number, c: number) => s.has(`${r},${c}`); };
const LIMITE = { righe: 50, colonne: 20 };

describe('T497: il blocco di dati attorno a una cella', () => {
  it('si allarga a tutto il blocco pieno e si ferma alle righe e colonne vuote', () => {
    const piena = daMappa([[2, 2], [2, 3], [2, 4], [3, 2], [3, 3], [3, 4], [4, 2], [4, 3], [4, 4], [10, 10]]);
    expect(regioneDati(piena, { row: 3, col: 3 }, LIMITE)).toEqual({ startRow: 2, endRow: 4, startCol: 2, endCol: 4 });
  });
  it('una cella isolata resta sola', () => {
    expect(regioneDati(daMappa([[5, 5]]), { row: 5, col: 5 }, LIMITE)).toEqual({ startRow: 5, endRow: 5, startCol: 5, endCol: 5 });
  });
  it('segue anche le celle in diagonale e non esce dai limiti del foglio', () => {
    expect(regioneDati(daMappa([[1, 1], [2, 2], [3, 3]]), { row: 1, col: 1 }, LIMITE)).toEqual({ startRow: 1, endRow: 3, startCol: 1, endCol: 3 });
    expect(regioneDati(daMappa([[1, 1], [1, 2], [2, 1]]), { row: 1, col: 1 }, { righe: 1, colonne: 1 })).toEqual({ startRow: 1, endRow: 1, startCol: 1, endCol: 1 });
  });
  it('un buco di una riga vuota separa due blocchi', () => {
    const piena = daMappa([[1, 1], [2, 1], [4, 1], [5, 1]]);
    expect(regioneDati(piena, { row: 1, col: 1 }, LIMITE)).toEqual({ startRow: 1, endRow: 2, startCol: 1, endCol: 1 });
  });
});

describe('T497: le formattazioni di una tabella', () => {
  it('intestazione in colore, poi righe a strisce alternate, e un filo sotto l\'ultima riga', () => {
    const r = ritocchiTabella({ startRow: 2, endRow: 6, startCol: 1, endCol: 3 });
    expect(r[0].range).toEqual({ startRow: 2, endRow: 2, startCol: 1, endCol: 3 });
    expect(r[0].ritocco.fill).toBe(COLORE_INTESTAZIONE);
    expect(r[0].ritocco.bold).toBe(true);
    const fillRighe = r.slice(1, 5).map((x) => x.ritocco.fill);
    expect(fillRighe).toEqual([COLORE_STRISCIA, undefined, COLORE_STRISCIA, undefined]);
    expect(r[r.length - 1].range.startRow).toBe(6);
    expect(r[r.length - 1].ritocco.borders?.bottom?.style).toBe('thin');
  });
  it('non tocca grassetto e colore del testo delle righe dei dati', () => {
    for (const x of ritocchiTabella({ startRow: 1, endRow: 4, startCol: 1, endCol: 2 }).slice(1, 4)) {
      expect('bold' in x.ritocco).toBe(false);
      expect('color' in x.ritocco).toBe(false);
    }
  });
});

type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; insertTable: () => string; undo: () => Promise<void> };
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
let griglia: Griglia;
let doc: SheetDocument;

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

const metti = async (r: number, c: number, v: string) => { await doc.client.setCell(doc.activeSheetName, r, c, v); };
const cella = (r: number, c: number) => resolveCellStyle(r, c, doc.styles);
const seleziona = (r: number, c: number) => { doc.selection = { anchor: { row: r, col: c }, active: { row: r, col: c }, range: { startRow: r, endRow: r, startCol: c, endCol: c } }; };

describe('T497: Inserisci > Tabella nella griglia', () => {
  it('con una cella attiva prende tutto il blocco di dati, lo colora e lo seleziona', async () => {
    for (const [r, c, v] of [[2, 2, 'Voce'], [2, 3, 'Prezzo'], [3, 2, 'caffè'], [3, 3, '1'], [4, 2, 'tè'], [4, 3, '2'], [5, 2, 'latte'], [5, 3, '3']] as Array<[number, number, string]>) await metti(r, c, v);
    await metti(9, 9, 'fuori');
    seleziona(3, 3);
    const msg = griglia.insertTable();
    expect(msg).toMatch(/B2:C5/);
    expect(cella(2, 2).fill).toBe(COLORE_INTESTAZIONE);
    expect(cella(2, 3).bold).toBe(true);
    expect(cella(3, 2).fill).toBe(COLORE_STRISCIA);
    expect(cella(4, 2).fill).toBeUndefined();
    expect(cella(5, 3).fill).toBe(COLORE_STRISCIA);
    expect(cella(9, 9).fill).toBeUndefined();
    expect(doc.selection.range).toEqual({ startRow: 2, endRow: 5, startCol: 2, endCol: 3 });
  });

  it('si annulla in un passo solo', async () => {
    await metti(1, 1, 'A'); await metti(2, 1, 'b'); await metti(3, 1, 'c');
    seleziona(1, 1);
    griglia.insertTable();
    expect(cella(1, 1).fill).toBe(COLORE_INTESTAZIONE);
    await griglia.undo();
    expect(cella(1, 1).fill).toBeUndefined();
    expect(cella(2, 1).fill).toBeUndefined();
  });

  it('con una cella vuota, una sola riga o nessun dato dice cosa serve e non cambia niente', async () => {
    seleziona(1, 1);
    expect(griglia.insertTable()).toMatch(/Seleziona i dati/);
    await metti(1, 1, 'solo');
    expect(griglia.insertTable()).toMatch(/almeno di una riga di intestazione/);
    expect(cella(1, 1).fill).toBeUndefined();
  });

  it('con un intervallo selezionato usa quello, anche se i dati continuano', async () => {
    for (let r = 1; r <= 5; r++) await metti(r, 1, `riga ${r}`);
    doc.selection = { anchor: { row: 1, col: 1 }, active: { row: 3, col: 1 }, range: { startRow: 1, endRow: 3, startCol: 1, endCol: 1 } };
    griglia.insertTable();
    expect(cella(2, 1).fill).toBe(COLORE_STRISCIA);
    expect(cella(3, 1).fill).toBeUndefined();
    expect(cella(4, 1).fill).toBeUndefined();
    expect(cella(1, 1).fill).toBe(COLORE_INTESTAZIONE);
  });

  it('ripetere il comando non sposta le strisce', async () => {
    for (let r = 1; r <= 4; r++) await metti(r, 1, `riga ${r}`);
    seleziona(1, 1);
    griglia.insertTable();
    const prima = [1, 2, 3, 4].map((r) => cella(r, 1).fill);
    seleziona(2, 1);
    griglia.insertTable();
    expect([1, 2, 3, 4].map((r) => cella(r, 1).fill)).toEqual(prima);
  });
});
