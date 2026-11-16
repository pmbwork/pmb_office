import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ParentNode; startEditing: (r?: boolean, c?: string) => Promise<void>; isEditing: boolean; editValue: string;
};
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

const editor = () => griglia.renderRoot.querySelector('.cell-editor-overlay') as HTMLInputElement;
const premi = (key: string, extra: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...extra });
  editor().dispatchEvent(e);
  return e;
};

describe('T487: scrivere nell\'editor della cella (i tasti non vengono rubati dalla griglia)', () => {
  it('le lettere scritte nell\'editor non vengono bloccate (altrimenti restava solo il primo carattere)', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    await griglia.startEditing(true, 'a');
    expect(griglia.isEditing).toBe(true);
    for (const k of ['b', 'c', '1', ',', ' ', '=', '€']) expect(premi(k).defaultPrevented, k).toBe(false);
  });

  it('Backspace, Canc, frecce, Home/Fine e Ctrl+A nell\'editor restano all\'editor: non cancellano né spostano la selezione', async () => {
    await doc.client.setCell(doc.activeSheetName, 2, 2, 'contenuto');
    doc.selection = { anchor: { row: 2, col: 2 }, active: { row: 2, col: 2 }, range: { startRow: 2, endRow: 2, startCol: 2, endCol: 2 } } as SheetDocument['selection'];
    griglia.requestUpdate?.call(griglia);
    await griglia.updateComplete;
    await griglia.startEditing(false);
    expect(editor()).toBeTruthy();
    for (const k of ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) expect(premi(k).defaultPrevented, k).toBe(false);
    expect(premi('a', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(premi('z', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(premi('b', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(doc.selection.anchor).toEqual({ row: 2, col: 2 });
    expect(doc.selection.isAll).toBeFalsy();
    expect((await doc.client.getCell(doc.activeSheetName, 2, 2)).raw).toBe('contenuto');
  });

  it('Invio, Tab ed Esc nell\'editor continuano a confermare e annullare', async () => {
    await griglia.startEditing(true, 'a');
    editor().value = 'ciao';
    editor().dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    premi('Enter');
    await new Promise((r) => setTimeout(r, 50));
    expect((await doc.client.getCell(doc.activeSheetName, 1, 1)).raw).toBe('ciao');
    expect(griglia.isEditing).toBe(false);
  });

  it('con la griglia selezionata (non in modifica) le lettere iniziano ancora la scrittura', async () => {
    const contenitore = griglia.renderRoot.querySelector('.grid-container') as HTMLElement;
    const e = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true });
    contenitore.dispatchEvent(e);
    await new Promise((r) => setTimeout(r, 50));
    expect(e.defaultPrevented).toBe(true);
    expect(griglia.isEditing).toBe(true);
    expect(griglia.editValue).toBe('q');
  });
});
