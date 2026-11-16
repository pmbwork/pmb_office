import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { createCellSelection, createRangeSelection, aggiungiCellaASelezione, intervalliSelezione, isCellSelected } from '../../src/sheet/selection';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot; applyFormat: (p: object) => void; clearSelection: () => Promise<void> };
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

const td = (r: number, c: number) => griglia.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement;
const mouse = (el: Element, tipo: string, init: MouseEventInit = {}) => el.dispatchEvent(new MouseEvent(tipo, { bubbles: true, composed: true, button: 0, ...init }));

describe('T494: selezione multipla (modello)', () => {
  it('aggiungere una cella tiene le precedenti e fa attiva la nuova', () => {
    const s = aggiungiCellaASelezione(createRangeSelection(1, 1, 2, 2), 5, 5);
    expect(intervalliSelezione(s)).toHaveLength(2);
    expect(isCellSelected(2, 2, s)).toBe(true);
    expect(isCellSelected(5, 5, s)).toBe(true);
    expect(isCellSelected(3, 3, s)).toBe(false);
    expect(s.active).toEqual({ row: 5, col: 5 });
  });
  it('una selezione normale non ha intervalli extra', () => {
    expect(createCellSelection(1, 1).extra).toBeUndefined();
    expect(intervalliSelezione(createCellSelection(1, 1))).toHaveLength(1);
  });
});

describe('T494: Ctrl+clic nella griglia', () => {
  it('Ctrl+clic aggiunge la cella, un clic semplice riparte da una sola', async () => {
    mouse(td(1, 1), 'mousedown');
    window.dispatchEvent(new MouseEvent('mouseup'));
    mouse(td(3, 3), 'mousedown', { ctrlKey: true });
    window.dispatchEvent(new MouseEvent('mouseup'));
    mouse(td(4, 2), 'mousedown', { ctrlKey: true });
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(intervalliSelezione(doc.selection)).toHaveLength(3);
    await griglia.updateComplete;
    expect(td(1, 1).classList.contains('selected')).toBe(true);
    expect(td(3, 3).classList.contains('selected')).toBe(true);
    expect(td(4, 2).classList.contains('selected')).toBe(true);
    expect(td(2, 2).classList.contains('selected')).toBe(false);
    mouse(td(2, 1), 'mousedown');
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(intervalliSelezione(doc.selection)).toHaveLength(1);
  });

  it('Ctrl+trascina allarga solo l\'ultimo intervallo e tiene i precedenti', async () => {
    mouse(td(1, 1), 'mousedown');
    window.dispatchEvent(new MouseEvent('mouseup'));
    mouse(td(4, 4), 'mousedown', { ctrlKey: true });
    mouse(td(5, 5), 'mouseenter', { bubbles: false });
    window.dispatchEvent(new MouseEvent('mouseup'));
    const r = intervalliSelezione(doc.selection);
    expect(r).toHaveLength(2);
    expect(r[1]).toEqual({ startRow: 4, endRow: 5, startCol: 4, endCol: 5 });
    expect(r[0]).toEqual({ startRow: 1, endRow: 1, startCol: 1, endCol: 1 });
  });

  it('la formattazione e Cancella valgono su tutti gli intervalli', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'a');
    await doc.client.setCell(doc.activeSheetName, 3, 3, 'b');
    await doc.client.setCell(doc.activeSheetName, 2, 2, 'resta');
    doc.selection = aggiungiCellaASelezione(createCellSelection(1, 1), 3, 3);
    griglia.applyFormat({ bold: true });
    expect(doc.styles.cellStyles.get('1,1')).toBeDefined();
    expect(doc.styles.cellStyles.get('3,3')).toBeDefined();
    expect(doc.styles.cellStyles.get('2,2')).toBeUndefined();
    await griglia.clearSelection();
    expect((await doc.client.getCell(doc.activeSheetName, 1, 1)).raw).toBe('');
    expect((await doc.client.getCell(doc.activeSheetName, 3, 3)).raw).toBe('');
    expect((await doc.client.getCell(doc.activeSheetName, 2, 2)).raw).toBe('resta');
  });
});
