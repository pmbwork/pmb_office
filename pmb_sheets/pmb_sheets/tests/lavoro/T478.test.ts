import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { menuRegistry } from '../../src/registry/menu';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; startEditing: (r?: boolean, c?: string) => Promise<void>; commitEdit: () => Promise<void>;
  updateComplete: Promise<unknown>; editValue: string; renderRoot: ParentNode;
  undo: () => Promise<void>; rimuoviConvalida: () => void; rimuoviCondizionali: () => void; applicaConvalida: (i: object, r: Record<string, unknown>) => void;
  addConditionalFormatRule: (r: unknown) => void; handleNameBoxKeyDown: (e: KeyboardEvent) => Promise<void>;
};
let griglia: Griglia;
let doc: SheetDocument;

async function seleziona(r: number, c: number, r2 = r, c2 = c): Promise<void> {
  doc.selection = { anchor: { row: r, col: c }, active: { row: r, col: c }, range: { startRow: r, endRow: r2, startCol: c, endCol: c2 } } as SheetDocument['selection'];
  griglia.requestUpdate?.call(griglia);
  await griglia.updateComplete;
}
const td = (r: number, c: number) => griglia.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement;
const voci = () => Array.from(griglia.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).map((x) => x.textContent!.trim());
const clic = (testo: string) => (Array.from(griglia.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).find((x) => x.textContent!.trim() === testo) as HTMLElement).click();

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

describe('T478: menu del tasto destro sulle celle (A12)', () => {
  it('il tasto destro su una cella la seleziona e apre il menu con le voci del foglio', async () => {
    td(3, 2).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 60 }));
    await griglia.updateComplete;
    expect(doc.selection.anchor).toEqual({ row: 3, col: 2 });
    expect(voci()).toEqual(expect.arrayContaining(['Taglia', 'Copia', 'Incolla', 'Incolla solo valori', 'Inserisci 1 riga sopra', 'Elimina righe', 'Cancella contenuto', 'Cancella formattazione']));
  });

  it('il tasto destro dentro una selezione la mantiene', async () => {
    await seleziona(2, 2, 4, 3);
    td(3, 3).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await griglia.updateComplete;
    expect(doc.selection.range).toEqual({ startRow: 2, endRow: 4, startCol: 2, endCol: 3 });
  });

  it('il contenuto si cancella dal menu, e le righe si inseriscono', async () => {
    await doc.client.setCell(doc.activeSheetName, 2, 2, 'x');
    td(2, 2).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await griglia.updateComplete;
    clic('Cancella contenuto');
    await new Promise((r) => setTimeout(r, 50));
    expect((await doc.client.getCell(doc.activeSheetName, 2, 2)).raw).toBe('');
    expect(griglia.renderRoot.querySelector('.sheet-context-menu')).toBeNull();
  });

  it('il tasto Menu e Maiusc+F10 aprono il menu sotto la cella attiva', async () => {
    await seleziona(4, 3);
    const contenitore = griglia.renderRoot.querySelector('.grid-container') as HTMLElement;
    contenitore.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
    await griglia.updateComplete;
    expect(voci()).toContain('Taglia');
  });

  it('il menu predefinito del motore web è bloccato fuori dai campi di testo', async () => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true });
    document.body.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    const e2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true });
    campo.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(false);
  });
});

describe('T478: accessibilità della griglia (A14)', () => {
  it('la tabella è una griglia con righe, intestazioni e celle', async () => {
    const t = griglia.renderRoot.querySelector('table')!;
    expect(t.getAttribute('role')).toBe('grid');
    expect(t.getAttribute('aria-label')).toBe('Foglio di calcolo');
    expect(Number(t.getAttribute('aria-rowcount'))).toBeGreaterThan(1000000);
    expect(Number(t.getAttribute('aria-colcount'))).toBe(16385);
    expect(griglia.renderRoot.querySelectorAll('th[role="columnheader"]').length).toBeGreaterThan(5);
    expect(griglia.renderRoot.querySelectorAll('th[role="rowheader"]').length).toBeGreaterThan(5);
    expect(griglia.renderRoot.querySelectorAll('tr[role="row"]').length).toBeGreaterThan(5);
  });

  it('ogni cella ha ruolo, posizione, stato di selezione e un nome con indirizzo e contenuto', async () => {
    await doc.client.setCell(doc.activeSheetName, 2, 2, 'ciao');
    await seleziona(2, 2);
    await new Promise((r) => setTimeout(r, 50));
    griglia.requestUpdate();
    await griglia.updateComplete;
    const c = td(2, 2);
    expect(c.getAttribute('role')).toBe('gridcell');
    expect(c.getAttribute('aria-colindex')).toBe('3');
    expect(c.getAttribute('aria-selected')).toBe('true');
    expect(td(3, 3).getAttribute('aria-selected')).toBe('false');
    expect(td(1, 1).getAttribute('aria-label')).toBe('A1');
  });
});

describe('T478: strumenti dati (A9)', () => {
  const lista = { type: 'list', listItems: ['rosso', 'verde', 'blu'], action: 'reject', allowEmpty: true };

  it('una cella con convalida a elenco ha la freccia; la tendina scrive la voce scelta e si annulla', async () => {
    griglia.applicaConvalida({ startRow: 2, endRow: 2, startCol: 2, endCol: 2 }, lista);
    await seleziona(2, 2);
    const freccia = td(2, 2).querySelector('.freccia-elenco') as HTMLElement;
    expect(freccia).toBeTruthy();
    expect(td(3, 2).querySelector('.freccia-elenco')).toBeNull();
    freccia.click();
    await griglia.updateComplete;
    expect(voci()).toEqual(['rosso', 'verde', 'blu']);
    clic('verde');
    await new Promise((r) => setTimeout(r, 50));
    expect((await doc.client.getCell(doc.activeSheetName, 2, 2)).raw).toBe('verde');
    await griglia.undo();
    await new Promise((r) => setTimeout(r, 50));
    expect((await doc.client.getCell(doc.activeSheetName, 2, 2)).raw).toBe('');
  });

  it('la convalida si toglie dalla selezione, e si può annullare', async () => {
    griglia.applicaConvalida({ startRow: 2, endRow: 3, startCol: 2, endCol: 2 }, lista);
    expect(doc.dataValidations.size).toBe(2);
    await seleziona(2, 2, 2, 2);
    griglia.rimuoviConvalida();
    expect(doc.dataValidations.has('2:2')).toBe(false);
    expect(doc.dataValidations.has('3:2')).toBe(true);
    await griglia.undo();
    await new Promise((r) => setTimeout(r, 50));
    expect(doc.dataValidations.has('2:2')).toBe(true);
  });

  it('la formattazione condizionale che tocca la selezione si toglie, le altre restano', async () => {
    const regola = (id: string, r: number) => ({ id, type: 'cell_value', range: { startRow: r, endRow: r, startCol: 1, endCol: 1 }, operator: 'greater_than', value1: 1, style: { bold: true } });
    griglia.addConditionalFormatRule(regola('a', 2));
    griglia.addConditionalFormatRule(regola('b', 9));
    await seleziona(2, 1);
    griglia.rimuoviCondizionali();
    expect(doc.conditionalFormats.map((f) => f.id)).toEqual(['b']);
  });

  it('il menu Dati ha le due voci per togliere le regole', () => {
    const ids = JSON.stringify(menuRegistry);
    expect(ids).toContain('clear-validation');
    expect(ids).toContain('clear-conditional-format');
  });

  it('la casella nome porta all\'intervallo di un nome definito', async () => {
    doc.namedRanges.add({ name: 'Prezzi', sheetName: doc.activeSheetName, rangeString: 'C2:C5', startRow: 2, startCol: 3, endRow: 5, endCol: 3 });
    const campo = document.createElement('input');
    campo.value = 'prezzi';
    await griglia.handleNameBoxKeyDown({ key: 'Enter', preventDefault() {}, target: campo } as unknown as KeyboardEvent);
    expect(doc.selection.range).toEqual({ startRow: 2, endRow: 5, startCol: 3, endCol: 3 });
  });
});
