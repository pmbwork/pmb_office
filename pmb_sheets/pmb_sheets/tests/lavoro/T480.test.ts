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
  filtraPerValoreDiCella: () => void; clearFilters: () => void; undo: () => Promise<void>;
};
let app: App;
let griglia: Griglia;
let doc: SheetDocument;

async function seleziona(r: number, c: number): Promise<void> {
  doc.selection = { anchor: { row: r, col: c }, active: { row: r, col: c }, range: { startRow: r, endRow: r, startCol: c, endCol: c } } as SheetDocument['selection'];
  griglia.requestUpdate?.call(griglia);
  await griglia.updateComplete;
}

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
  // intestazione + 200 righe di dati: oltre quelle che si vedono a video
  await doc.client.setCell(doc.activeSheetName, 1, 1, 'Frutta');
  await doc.client.setCell(doc.activeSheetName, 1, 2, 'Numero');
  for (let r = 2; r <= 201; r++) {
    await doc.client.setCell(doc.activeSheetName, r, 1, r % 3 === 0 ? 'mela' : 'pera');
    await doc.client.setCell(doc.activeSheetName, r, 2, String(r));
  }
});

describe('T480: filtro per il valore della cella', () => {
  it('restano solo le righe con lo stesso valore, anche fuori dalla zona visibile, e l\'intestazione', async () => {
    await seleziona(3, 1); // "mela"
    griglia.filtraPerValoreDiCella();
    expect(doc.isFilterActive).toBe(true);
    expect(doc.hiddenRows.has(1)).toBe(false);
    expect(doc.hiddenRows.has(3)).toBe(false); // mela
    expect(doc.hiddenRows.has(2)).toBe(true); // pera
    expect(doc.hiddenRows.has(200)).toBe(true); // pera, molto in basso
    expect(doc.hiddenRows.has(201)).toBe(false); // 201 % 3 = 0: mela
    expect(doc.hiddenRows.size).toBe(200 - 67); // 67 righe di mela tra 2 e 201
  });

  it('si può annullare e togliere', async () => {
    await seleziona(3, 1);
    griglia.filtraPerValoreDiCella();
    await griglia.undo();
    expect(doc.hiddenRows.size).toBe(0);
    griglia.filtraPerValoreDiCella();
    expect(doc.hiddenRows.size).toBeGreaterThan(0);
    griglia.clearFilters();
    expect(doc.hiddenRows.size).toBe(0);
    expect(doc.isFilterActive).toBe(false);
  });

  it('la voce è nel menu del tasto destro e "Rimuovi filtri" compare solo a filtro attivo', async () => {
    const td = () => griglia.renderRoot.querySelector('td[data-row="3"][data-col="1"]') as HTMLElement;
    const voci = () => Array.from(griglia.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).map((x) => x.textContent!.trim());
    td().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await griglia.updateComplete;
    expect(voci()).toContain('Filtra per il valore della cella');
    expect(voci()).not.toContain('Rimuovi filtri');
    (Array.from(griglia.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).find((x) => x.textContent!.trim() === 'Filtra per il valore della cella') as HTMLElement).click();
    await griglia.updateComplete;
    expect(doc.isFilterActive).toBe(true);
    td().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await griglia.updateComplete;
    expect(voci()).toContain('Rimuovi filtri');
  });
});

describe('T480: annunci per i lettori di schermo', () => {
  it('la barra di stato è una regione che annuncia i messaggi', async () => {
    const barra = app.renderRoot.querySelector('free-statusbar') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
    await barra.updateComplete;
    const area = barra.renderRoot.querySelector('.status-left')!;
    expect(area.getAttribute('role')).toBe('status');
    expect(area.getAttribute('aria-live')).toBe('polite');
  });
});

describe('T480: il testo che esce sulle celle vicine non ruba i clic', () => {
  it('lo stile del testo che trabocca ha pointer-events: none', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/components/sheet-grid.ts', 'utf8');
    const blocco = /\.testo-trabocca \{[^}]*\}/.exec(css)![0];
    expect(blocco).toContain('pointer-events: none');
  });
});
