import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { tabs: Array<{ id: string; type: string }>; statusMessage: string; activeTabId: string }

let app: App;
let dentro: Dentro;

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  dentro = app as unknown as Dentro;
});

const menu = (action: string, label = action) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label }, bubbles: true, composed: true }));
const griglia = async (): Promise<HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; sheetList: string[] }> => {
  const g = app.renderRoot.querySelector(`free-sheet-grid[data-tab-id="${dentro.activeTabId}"]`) as HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; sheetList: string[] };
  await g.updateComplete;
  return g;
};

describe('T319: Seleziona tutto', () => {
  it('Modifica › Seleziona tutto seleziona l\'intero foglio e aggiorna il nome della selezione', async () => {
    const g = await griglia();
    const doc = g.getDoc();
    expect(doc.selection.isAll).toBeFalsy();
    menu('select-all', 'Seleziona tutto');
    await g.updateComplete;
    expect(doc.selection.isAll).toBe(true);
    expect(doc.selection.range.startRow).toBe(1);
    expect(doc.selection.range.startCol).toBe(1);
    expect(doc.selection.range.endRow).toBeGreaterThan(1000);
    expect((g as unknown as { nameBoxValue: string }).nameBoxValue).not.toBe('A1');
  });

});

describe('T319: Nuovo foglio dal menu Inserisci', () => {
  it('aggiunge un foglio, lo apre e ne mostra il nome', async () => {
    const g = await griglia();
    expect(g.sheetList).toEqual(['Foglio1']);
    menu('insert-sheet', 'Nuovo foglio');
    await vi.waitFor(() => expect(g.sheetList).toEqual(['Foglio1', 'Foglio2']));
    await vi.waitFor(() => expect(g.getDoc().activeSheetName).toBe('Foglio2'));
  });

  it('una seconda volta aggiunge un terzo foglio', async () => {
    const g = await griglia();
    menu('insert-sheet');
    await vi.waitFor(() => expect(g.sheetList).toHaveLength(2));
    menu('insert-sheet');
    await vi.waitFor(() => expect(g.sheetList).toEqual(['Foglio1', 'Foglio2', 'Foglio3']));
    expect(g.getDoc().activeSheetName).toBe('Foglio3');
  });

  it('il foglio nuovo è vuoto e quello di prima conserva i suoi dati', async () => {
    const g = await griglia();
    const doc = g.getDoc();
    await doc.client.setCell('Foglio1', 1, 1, 'resta');
    menu('insert-sheet');
    await vi.waitFor(() => expect(doc.activeSheetName).toBe('Foglio2'));
    expect((await doc.client.getCell('Foglio2', 1, 1)).raw).toBe('');
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('resta');
  });

});

describe('T319: Informazioni', () => {
  it('Aiuto › Informazioni su pmb_sheets scrive il messaggio nella barra di stato', async () => {
    menu('about-app', 'Informazioni su pmb_sheets');
    expect(dentro.statusMessage).toBe('pmb_sheets: fogli di lavoro per Windows, per uso locale');
  });
});

describe('T319: le altre voci senza azione dicono ancora che non ci sono', () => {
  it.each(['voce-inventata'])('%s', (azione) => {
    menu(azione, 'Voce');
    expect(dentro.statusMessage).toBe('Funzione non ancora disponibile: Voce');
  });
});
