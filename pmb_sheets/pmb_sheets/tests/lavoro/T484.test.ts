import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ParentNode;
  openFind: (sostituisci: boolean) => void; findNext: () => Promise<void>; replaceAllAction: () => Promise<void>;
  findQuery: string; replaceQuery: string; findMatchesCount: number;
};
let griglia: Griglia;
let doc: SheetDocument;
const raw = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw;

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

describe('T484: trova e sostituisci su tutto il foglio', () => {
  it('trova anche le celle lontane da quelle che si vedono (riga 150, colonna 40)', async () => {
    await doc.client.setCell(doc.activeSheetName, 3, 2, 'cercami');
    await doc.client.setCell(doc.activeSheetName, 150, 3, 'cercami');
    await doc.client.setCell(doc.activeSheetName, 40, 40, 'cercami');
    await doc.client.setCell(doc.activeSheetName, 5, 5, 'altro');
    griglia.openFind(false);
    griglia.findQuery = 'cercami';
    await griglia.findNext();
    expect(griglia.findMatchesCount).toBe(3);
    // il primo risultato dopo A1, in ordine di righe
    expect([doc.selection.active.row, doc.selection.active.col]).toEqual([3, 2]);
  });

  it('i risultati si trovano anche con la cache delle celle vuota', async () => {
    await doc.client.setCell(doc.activeSheetName, 500, 2, 'lontano');
    (griglia as unknown as { cellsCache: Map<string, unknown> }).cellsCache.clear();
    griglia.openFind(false);
    griglia.findQuery = 'lontano';
    await griglia.findNext();
    expect(griglia.findMatchesCount).toBe(1);
    expect(doc.selection.active.row).toBe(500);
  });

  it('"Sostituisci tutto" cambia anche le celle fuori dalla zona visibile, in un solo annulla', async () => {
    await doc.client.setCell(doc.activeSheetName, 2, 1, 'foo bar');
    await doc.client.setCell(doc.activeSheetName, 300, 2, 'foo');
    await doc.client.setCell(doc.activeSheetName, 20, 30, 'xfoo');
    griglia.openFind(true);
    griglia.findQuery = 'foo';
    griglia.replaceQuery = 'baz';
    await griglia.replaceAllAction();
    expect(await raw(2, 1)).toBe('baz bar');
    expect(await raw(300, 2)).toBe('baz');
    expect(await raw(20, 30)).toBe('xbaz');
  });
});
