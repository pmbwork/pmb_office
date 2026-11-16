import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot;
  toggleFilter: () => void; clearFilters: () => void; requestUpdate: () => void;
};
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };

let griglia: Griglia;
let doc: SheetDocument;

const TABELLA: Array<[number, number, string]> = [
  [4, 2, 'Categoria'], [4, 3, 'Prezzo'],
  [5, 2, 'Frutta'],    [5, 3, '10'],
  [6, 2, 'Verdura'],   [6, 3, '20'],
];

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  const app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
  for (const [r, c, v] of TABELLA) await doc.client.setCell(doc.activeSheetName, r, c, v);
});

describe('Frecce del filtro nell\'intestazione della tabella', () => {
  it('disegna il pulsante freccia .cell-filter-btn nelle celle della riga d\'intestazione della tabella', async () => {
    // Seleziona una cella della tabella (es. B5) e attiva il filtro
    doc.selection = { anchor: { row: 5, col: 2 }, active: { row: 5, col: 2 }, range: { startRow: 5, endRow: 5, startCol: 2, endCol: 2 } };
    griglia.toggleFilter();
    griglia.requestUpdate();
    await griglia.updateComplete;

    expect(doc.isFilterActive).toBe(true);
    expect(doc.filterArea).toEqual({ startRow: 4, endRow: 6, startCol: 2, endCol: 3 });

    // La riga d'intestazione è la riga 4 (B4 e C4)
    const cellaB4 = griglia.renderRoot.querySelector('td.sheet-cell[data-row="4"][data-col="2"]');
    const cellaC4 = griglia.renderRoot.querySelector('td.sheet-cell[data-row="4"][data-col="3"]');
    expect(cellaB4?.querySelector('.cell-filter-btn')).not.toBeNull();
    expect(cellaC4?.querySelector('.cell-filter-btn')).not.toBeNull();

    // Le righe dati (5 e 6) non devono avere il pulsante
    const cellaB5 = griglia.renderRoot.querySelector('td.sheet-cell[data-row="5"][data-col="2"]');
    expect(cellaB5?.querySelector('.cell-filter-btn')).toBeNull();

    // Cliccando sulla freccia della cella B4 si apre il popup del filtro
    const btnB4 = cellaB4?.querySelector('.cell-filter-btn') as HTMLElement;
    btnB4.click();
    await griglia.updateComplete;

    const popup = griglia.renderRoot.querySelector('free-filtro-colonna');
    expect(popup).not.toBeNull();
  });
});

