import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { tabs: Array<{ id: string; title: string; type: string }>; statusMessage: string; activeTabId: string; zoom: number }
type Griglia = HTMLElement & { handleFormatAction: (a: string, v?: string) => void; pasteSpecial: (t: string) => void; setFreezePanes: (r: number, c: number) => void; getDoc: () => SheetDocument; updateComplete: Promise<unknown> };

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

const griglia = async (): Promise<Griglia> => {
  const g = app.renderRoot.querySelector(`free-sheet-grid[data-tab-id="${dentro.activeTabId}"]`) as Griglia;
  await g.updateComplete;
  return g;
};
const doc = async (): Promise<SheetDocument> => (await griglia()).getDoc();
const menu = (action: string, label = action) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label }, bubbles: true, composed: true }));
const barra = (action: string, label = action) => app.renderRoot.querySelector('free-toolbar')?.dispatchEvent(new CustomEvent('toolbar-action', { detail: { action, label }, bubbles: true, composed: true }));
const seleziona = (d: SheetDocument, r1: number, c1: number, r2: number, c2: number) => {
  d.selection = { anchor: { row: r1, col: c1 }, active: { row: r1, col: c1 }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 } } as SheetDocument['selection'];
};
const grezzo = async (d: SheetDocument, r: number, c: number): Promise<string> => (await d.client.getCell(d.activeSheetName, r, c)).raw;
const AZIONI = ['sort-asc', 'sort-desc', 'create-filter', 'clear-filter', 'merge-all', 'merge-horizontal', 'merge-vertical', 'unmerge', 'find-replace', 'insert-checkbox'];

describe('T309: avvio di Fogli', () => {
  it('si apre su un foglio di calcolo con la griglia', async () => {
    expect(dentro.tabs).toEqual([{ id: 'tab-1', title: 'Foglio senza titolo' }]);
    expect(dentro.activeTabId).toBe('tab-1');
    const g = await griglia();
    expect(g.hasAttribute('hidden')).toBe(false);
    expect(app.renderRoot.querySelector('free-editor-doc')).toBeNull();
  });

  it('il "+" delle schede in alto aggiunge un foglio al file e lo mostra', async () => {
    app.renderRoot.querySelector('free-tabs')?.dispatchEvent(new CustomEvent('tab-created', { bubbles: true, composed: true }));
    await vi.waitFor(() => expect((dentro as unknown as { fogli: string[] }).fogli).toEqual(['Foglio1', 'Foglio2']));
    expect((dentro as unknown as { foglioAttivo: string }).foglioAttivo).toBe('Foglio2');
    expect(dentro.tabs).toHaveLength(1); // sempre un solo file
  });

});

describe('T309: ordinamento, filtri, celle unite e altro dal menu', () => {
  it.each(AZIONI)('dal menu "%s" arriva alla griglia', async (azione) => {
    const g = await griglia();
    const chiamate = vi.spyOn(g, 'handleFormatAction').mockImplementation(() => {});
    menu(azione, 'Etichetta');
    expect(chiamate).toHaveBeenCalledTimes(1);
    expect(chiamate).toHaveBeenCalledWith(azione);
    expect(dentro.statusMessage).not.toContain('non ancora disponibile');
  });

  it('Ordina A→Z e Z→A riordinano davvero le righe selezionate', async () => {
    const d = await doc();
    await d.client.setCell(d.activeSheetName, 1, 1, '3');
    await d.client.setCell(d.activeSheetName, 2, 1, '1');
    await d.client.setCell(d.activeSheetName, 3, 1, '2');
    seleziona(d, 1, 1, 3, 1);
    menu('sort-asc');
    await vi.waitFor(async () => expect([await grezzo(d, 1, 1), await grezzo(d, 2, 1), await grezzo(d, 3, 1)]).toEqual(['1', '2', '3']));
    menu('sort-desc');
    await vi.waitFor(async () => expect([await grezzo(d, 1, 1), await grezzo(d, 2, 1), await grezzo(d, 3, 1)]).toEqual(['3', '2', '1']));
  });

  it('Crea un filtro lo attiva e Rimuovi filtri lo toglie', async () => {
    const d = await doc();
    await d.client.setCell(d.activeSheetName, 1, 1, 'a');
    await d.client.setCell(d.activeSheetName, 2, 1, 'b');
    seleziona(d, 1, 1, 2, 1);
    expect(d.isFilterActive).toBe(false);
    menu('create-filter');
    await vi.waitFor(() => expect(d.isFilterActive).toBe(true));
    menu('clear-filter');
    await vi.waitFor(() => expect(d.isFilterActive).toBe(false));
  });

  it('Unisci tutto e Separa le celle unite funzionano dal menu', async () => {
    const d = await doc();
    seleziona(d, 1, 1, 1, 2);
    menu('merge-all');
    await vi.waitFor(() => expect(d.merges).toHaveLength(1));
    menu('unmerge');
    await vi.waitFor(() => expect(d.merges).toHaveLength(0));
  });

  it('una voce davvero non realizzata dice ancora "Funzione non ancora disponibile"', async () => {
    menu('voce-inventata', 'Voce inventata');
    expect(dentro.statusMessage).toBe('Funzione non ancora disponibile: Voce inventata');
  });

});

describe('T309: ordinamento, filtri e celle unite dalla barra strumenti', () => {
  it.each([...AZIONI, 'toggle-filter'])('dalla barra "%s" arriva alla griglia', async (azione) => {
    const g = await griglia();
    const chiamate = vi.spyOn(g, 'handleFormatAction').mockImplementation(() => {});
    barra(azione, 'Etichetta');
    expect(chiamate).toHaveBeenCalledTimes(1);
    expect(chiamate).toHaveBeenCalledWith(azione);
    expect(dentro.statusMessage).not.toBe('Azione strumento: Etichetta');
  });

  it('il pulsante Filtro e il pulsante Unisci celle fanno il loro lavoro', async () => {
    const d = await doc();
    await d.client.setCell(d.activeSheetName, 1, 1, 'x');
    seleziona(d, 1, 1, 1, 2);
    barra('merge-all', 'Unisci celle');
    await vi.waitFor(() => expect(d.merges).toHaveLength(1));
    barra('create-filter', 'Filtro');
    await vi.waitFor(() => expect(d.isFilterActive).toBe(true));
  });

  it('un\'azione della barra non realizzata dice ancora "Azione strumento"', async () => {
    barra('list-bullets', 'Elenco puntato');
    expect(dentro.statusMessage).toBe('Azione strumento: Elenco puntato');
  });
});

describe('T309: blocca righe e colonne', () => {
  it('righe e colonne si bloccano ciascuna per conto suo, l\'altra misura resta com\'è', async () => {
    const d = await doc();
    const stato = () => [d.freezeRows, d.freezeCols];
    expect(stato()).toEqual([0, 0]);
    menu('freeze-rows-1');
    expect(stato()).toEqual([1, 0]);
    menu('freeze-cols-2');
    expect(stato()).toEqual([1, 2]);
    menu('freeze-rows-2');
    expect(stato()).toEqual([2, 2]);
    menu('freeze-cols-1');
    expect(stato()).toEqual([2, 1]);
    menu('freeze-rows-0');
    expect(stato()).toEqual([0, 1]);
    menu('freeze-cols-0');
    expect(stato()).toEqual([0, 0]);
  });
  it('vale per il foglio del file aperto', async () => {
    const d = await doc();
    menu('freeze-cols-1');
    menu('freeze-rows-2');
    expect([d.freezeRows, d.freezeCols]).toEqual([2, 1]);
  });

});

describe('T309: dai sottomenu fino in fondo', () => {
  const barraMenu = (): ShadowRoot => (app.renderRoot.querySelector('free-menubar') as HTMLElement).shadowRoot as ShadowRoot;
  async function scegli(menuNome: string, voce: string, sotto: string): Promise<void> {
    const b = app.renderRoot.querySelector('free-menubar') as HTMLElement & { updateComplete: Promise<unknown> };
    Array.from(barraMenu().querySelectorAll<HTMLButtonElement>('.menu-btn')).find((x) => (x.textContent ?? '').trim() === menuNome)!.click();
    await b.updateComplete;
    Array.from(barraMenu().querySelectorAll<HTMLElement>('.dropdown-menu > .dropdown-item')).find((x) => (x.querySelector(':scope > span')?.textContent ?? '').trim() === voce)!.click();
    await b.updateComplete;
    Array.from(barraMenu().querySelectorAll<HTMLElement>('.submenu .sub-item')).find((x) => (x.querySelector('span')?.textContent ?? '').trim() === sotto)!.click();
    await b.updateComplete;
  }

  it('Visualizza › Zoom › 150% cambia lo zoom', async () => {
    expect(dentro.zoom).toBe(100);
    await scegli('Visualizza', 'Zoom', '150%');
    expect(dentro.zoom).toBe(150);
    await scegli('Visualizza', 'Zoom', '75%');
    expect(dentro.zoom).toBe(75);
  });

  it('Visualizza › Blocca › 1 riga e poi 2 colonne bloccano righe e colonne', async () => {
    const d = await doc();
    await scegli('Visualizza', 'Blocca', '1 riga');
    await scegli('Visualizza', 'Blocca', '2 colonne');
    expect([d.freezeRows, d.freezeCols]).toEqual([1, 2]);
  });

  it('Modifica › Incolla speciale › Solo valori arriva alla griglia', async () => {
    const g = await griglia();
    const incolla = vi.spyOn(g, 'pasteSpecial').mockImplementation(() => {});
    await scegli('Modifica', 'Incolla speciale', 'Solo valori');
    expect(incolla).toHaveBeenCalledWith('values_only');
    await scegli('Modifica', 'Incolla speciale', 'Trasposto');
    expect(incolla).toHaveBeenLastCalledWith('transposed');
  });
});
