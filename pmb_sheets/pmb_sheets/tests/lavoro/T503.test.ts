import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { fotografaSopraLeCelle, incollaSopraLeCelle, sopraVuoto, type DatiSopraLeCelle } from '../../src/sheet/sposta-con-celle';
import { chiaveCommento, commentoDi, type Commento } from '../../src/sheet/commenti';
import type { DataValidationRule } from '../../src/sheet/data-validation';

const regola = (id = 'v'): DataValidationRule => ({ id, type: 'list', listItems: ['a', 'b'], action: 'reject' });
const dati = (): DatiSopraLeCelle => ({ merges: [], dataValidations: new Map(), conditionalFormats: [] });
const c = (t: string): Commento => ({ testo: t, data: '2026-11-08T10:00:00.000Z' });
const area = (r1: number, r2: number, c1: number, c2: number) => ({ startRow: r1, endRow: r2, startCol: c1, endCol: c2 });

describe('T503: fotografare ciò che sta sopra le celle copiate', () => {
  it('prende commenti, convalide e unioni dell\'area (le unioni solo se intere), non quelli fuori', () => {
    const d = dati();
    d.dataValidations.set('1:1', regola('a')); d.dataValidations.set('9:9', regola('fuori'));
    d.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }, { startRow: 2, endRow: 4, startCol: 1, endCol: 1 }, { startRow: 20, endRow: 20, startCol: 1, endCol: 2 });
    const m = new Map<string, Commento>([[chiaveCommento('F', 1, 2), c('uno')], [chiaveCommento('F', 30, 30), c('lontano')], [chiaveCommento('G', 1, 1), c('altro foglio')]]);
    const f = fotografaSopraLeCelle(area(1, 3, 1, 2), 'F', m, d);
    expect(f.commenti.map((x) => x.testo)).toEqual(['uno']);
    expect(f.convalide.map((x) => `${x.riga}:${x.colonna}=${x.regola.id}`)).toEqual(['1:1=a']);
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }]);   // 2..4 esce dall'area: non si prende
  });
  it('è una copia: cambiare la sorgente dopo non cambia la fotografia', () => {
    const d = dati(); d.dataValidations.set('1:1', regola('a')); d.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 });
    const f = fotografaSopraLeCelle(area(1, 1, 1, 2), 'F', new Map(), d);
    d.dataValidations.get('1:1')!.id = 'cambiata'; d.merges[0].endCol = 9;
    expect(f.convalide[0].regola.id).toBe('a');
    expect(f.unioni[0].endCol).toBe(2);
  });
  it('sopraVuoto riconosce l\'assenza di tutto', () => {
    expect(sopraVuoto(undefined)).toBe(true);
    expect(sopraVuoto({ commenti: [], convalide: [], unioni: [] })).toBe(true);
    expect(sopraVuoto({ commenti: [{ riga: 1, colonna: 1, testo: 'x', data: '' }], convalide: [], unioni: [] })).toBe(false);
  });
});

describe('T503: incollare ciò che stava sopra le celle', () => {
  const sopra = { commenti: [{ riga: 1, colonna: 1, testo: 'nota', data: 'd' }], convalide: [{ riga: 1, colonna: 2, regola: regola('r') }], unioni: [{ startRow: 2, endRow: 2, startCol: 1, endCol: 2 }] };
  const A = area(1, 2, 1, 2);
  it('mette commenti, convalide e unioni spostati di quanto serve, e la sorgente resta', () => {
    const d = dati(); const m = new Map<string, Commento>([[chiaveCommento('F', 1, 1), c('nota')]]);
    d.dataValidations.set('1:2', regola('r')); d.merges.push({ startRow: 2, endRow: 2, startCol: 1, endCol: 2 });
    incollaSopraLeCelle(sopra, A, [{ riga: 5, colonna: 4 }], 'F', m, d);
    expect(m.get(chiaveCommento('F', 5, 4))!.testo).toBe('nota');
    expect(m.has(chiaveCommento('F', 1, 1))).toBe(true);
    expect([...d.dataValidations.keys()].sort()).toEqual(['1:2', '5:5']);
    expect(d.merges).toContainEqual({ startRow: 6, endRow: 6, startCol: 4, endCol: 5 });
    expect(d.merges).toContainEqual({ startRow: 2, endRow: 2, startCol: 1, endCol: 2 });
  });
  it('se l\'incolla ripete il blocco, ogni piastrella riceve la sua copia', () => {
    const d = dati(); const m = new Map<string, Commento>();
    incollaSopraLeCelle(sopra, A, [{ riga: 1, colonna: 4 }, { riga: 3, colonna: 4 }, { riga: 5, colonna: 4 }], 'F', m, d);
    expect([...m.keys()].sort()).toEqual([chiaveCommento('F', 1, 4), chiaveCommento('F', 3, 4), chiaveCommento('F', 5, 4)].sort());
    expect(d.merges).toHaveLength(3);
    expect([...d.dataValidations.keys()].sort()).toEqual(['1:5', '3:5', '5:5']);
  });
  it('la regola incollata è una copia indipendente', () => {
    const d = dati();
    incollaSopraLeCelle(sopra, A, [{ riga: 5, colonna: 4 }, { riga: 8, colonna: 4 }], 'F', new Map(), d);
    d.dataValidations.get('5:5')!.id = 'cambiata';
    expect(d.dataValidations.get('8:5')!.id).toBe('r');
    expect(sopra.convalide[0].regola.id).toBe('r');
  });
  it('non cancella ciò che la destinazione aveva dove la sorgente non ha niente; sostituisce dove ha qualcosa', () => {
    const d = dati(); const m = new Map<string, Commento>([[chiaveCommento('F', 5, 4), c('vecchio')], [chiaveCommento('F', 6, 4), c('resta')]]);
    d.dataValidations.set('5:5', regola('vecchia')); d.dataValidations.set('6:4', regola('resta'));
    incollaSopraLeCelle(sopra, A, [{ riga: 5, colonna: 4 }], 'F', m, d);
    expect(m.get(chiaveCommento('F', 5, 4))!.testo).toBe('nota');           // sostituito
    expect(m.get(chiaveCommento('F', 6, 4))!.testo).toBe('resta');          // la sorgente non ha niente in A2: resta
    expect(d.dataValidations.get('5:5')!.id).toBe('r');                      // sostituita
    expect(d.dataValidations.get('6:4')!.id).toBe('resta');
  });
  it('una unione già presente nella destinazione che si sovrappone alla nuova viene tolta', () => {
    const d = dati(); d.merges.push({ startRow: 6, endRow: 7, startCol: 5, endCol: 6 }, { startRow: 40, endRow: 41, startCol: 1, endCol: 1 });
    incollaSopraLeCelle(sopra, A, [{ riga: 5, colonna: 4 }], 'F', new Map(), d);         // nuova unione D6:E6, tocca E6:F7
    expect(d.merges).toContainEqual({ startRow: 6, endRow: 6, startCol: 4, endCol: 5 });
    expect(d.merges).toContainEqual({ startRow: 40, endRow: 41, startCol: 1, endCol: 1 });
    expect(d.merges).toHaveLength(2);
  });
  it('senza niente da incollare non cambia niente', () => {
    const d = dati(); d.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 });
    const m = new Map<string, Commento>([[chiaveCommento('F', 5, 4), c('resta')]]);
    incollaSopraLeCelle({ commenti: [], convalide: [], unioni: [] }, A, [{ riga: 5, colonna: 4 }], 'F', m, d);
    expect(m.size).toBe(1); expect(d.merges).toHaveLength(1); expect(d.dataValidations.size).toBe(0);
  });
});

type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot;
  copy: () => Promise<void>; cut: () => Promise<void>; paste: (t?: string) => Promise<void>; pasteSpecial: (t: string) => Promise<void>;
  undo: () => Promise<void>; redo: () => Promise<void>; setComment: (r: number, c: number, t: string) => boolean;
};
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

const sel = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc.selection = { anchor: { row: r1, col: c1 }, active: { row: r2, col: c2 }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 } }; };
const testoCommento = (r: number, col: number) => commentoDi(doc.comments, doc.activeSheetName, r, col)?.testo;
const raw = async (r: number, col: number) => (await doc.client.getCell(doc.activeSheetName, r, col)).raw;

async function preparaBlocco() {
  await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
  await doc.client.setCell(doc.activeSheetName, 1, 2, 'y');
  await doc.client.setCell(doc.activeSheetName, 2, 1, '1');
  await doc.client.setCell(doc.activeSheetName, 2, 2, '2');
  griglia.setComment(1, 1, 'una nota');
  doc.dataValidations.set('2:2', regola('v2'));
  doc.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 });
}

describe('T503: copia e incolla nella griglia', () => {
  it('commenti, convalide e celle unite arrivano alla destinazione e la sorgente li tiene', async () => {
    await preparaBlocco();
    sel(1, 1, 2, 2);
    await griglia.copy();
    sel(5, 4);
    await griglia.paste('');
    expect([await raw(5, 4), await raw(6, 5)]).toEqual(['x', '2']);
    expect(testoCommento(5, 4)).toBe('una nota');
    expect(testoCommento(1, 1)).toBe('una nota');
    expect([...doc.dataValidations.keys()].sort()).toEqual(['2:2', '6:5']);
    expect(doc.merges).toHaveLength(2);
    expect(doc.merges).toContainEqual({ startRow: 5, endRow: 5, startCol: 4, endCol: 5 });
  });

  it('Annulla toglie solo ciò che l\'incolla ha portato, Ripeti lo rimette', async () => {
    await preparaBlocco();
    sel(1, 1, 2, 2);
    await griglia.copy();
    sel(5, 4);
    await griglia.paste('');
    await griglia.undo();
    expect(await raw(5, 4)).toBe('');
    expect(testoCommento(5, 4)).toBeUndefined();
    expect(testoCommento(1, 1)).toBe('una nota');
    expect([...doc.dataValidations.keys()]).toEqual(['2:2']);
    expect(doc.merges).toEqual([{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }]);
    await griglia.redo();
    expect(testoCommento(5, 4)).toBe('una nota');
    expect([...doc.dataValidations.keys()].sort()).toEqual(['2:2', '6:5']);
    expect(doc.merges).toHaveLength(2);
  });

  it('con la selezione che è un multiplo del blocco, il blocco si ripete e ogni ripetizione ha il suo commento', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    griglia.setComment(1, 1, 'nota');
    sel(1, 1);
    await griglia.copy();
    sel(1, 4, 3, 4);                       // D1:D3, tre ripetizioni di una cella
    await griglia.paste('');
    expect([testoCommento(1, 4), testoCommento(2, 4), testoCommento(3, 4)]).toEqual(['nota', 'nota', 'nota']);
  });

  it('si porta ciò che c\'era al momento della copia, anche se la sorgente cambia prima di incollare', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    griglia.setComment(1, 1, 'prima');
    sel(1, 1);
    await griglia.copy();
    griglia.setComment(1, 1, 'dopo');
    sel(4, 4);
    await griglia.paste('');
    expect(testoCommento(4, 4)).toBe('prima');
    expect(testoCommento(1, 1)).toBe('dopo');
  });

  it('se la sorgente non ha un commento, quello della destinazione resta', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    griglia.setComment(4, 4, 'resta qui');
    sel(1, 1);
    await griglia.copy();
    sel(4, 4);
    await griglia.paste('');
    expect(await raw(4, 4)).toBe('x');
    expect(testoCommento(4, 4)).toBe('resta qui');
  });

  it('"Incolla solo valori" non porta commenti, convalide né unioni', async () => {
    await preparaBlocco();
    sel(1, 1, 2, 2);
    await griglia.copy();
    sel(5, 4);
    await griglia.pasteSpecial('values_only');
    expect(await raw(5, 4)).toBe('x');
    expect(testoCommento(5, 4)).toBeUndefined();
    expect([...doc.dataValidations.keys()]).toEqual(['2:2']);
    expect(doc.merges).toHaveLength(1);
  });

  it('un testo incollato da fuori (appunti di sistema) non porta niente', async () => {
    await preparaBlocco();
    sel(7, 7);
    await griglia.paste('ciao\tmondo');
    expect(await raw(7, 7)).toBe('ciao');
    expect(testoCommento(7, 7)).toBeUndefined();
    expect(doc.merges).toHaveLength(1);
  });

  it('il taglio continua a spostare (non a copiare): la sorgente perde il commento', async () => {
    await preparaBlocco();
    sel(1, 1, 2, 2);
    await griglia.cut();
    sel(5, 4);
    await griglia.paste('');
    expect(testoCommento(5, 4)).toBe('una nota');
    expect(testoCommento(1, 1)).toBeUndefined();
  });
});
