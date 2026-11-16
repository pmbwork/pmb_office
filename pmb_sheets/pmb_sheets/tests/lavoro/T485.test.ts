import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ParentNode; undo: () => Promise<void>; redo: () => Promise<void>;
  insertPivotTable: () => Promise<{ id: string; name: string; sourceRange: string; valueFields: Array<{ name: string }> }>;
  computeAndRenderPivot: (cfg: unknown, foglio?: string) => Promise<void>;
};
let griglia: Griglia;
let doc: SheetDocument;
const celle = async (foglio: string, righe: number, colonne: number) => {
  const m = await doc.client.getRange(foglio, 1, 1, righe, colonne);
  return m.map((r) => r.map((v) => (v.kind === 'empty' ? '' : String((v as { value?: unknown }).value ?? ''))));
};
async function seleziona(r1: number, c1: number, r2: number, c2: number) {
  doc.selection = { anchor: { row: r1, col: c1 }, active: { row: r2, col: c2 }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 } } as SheetDocument['selection'];
  griglia.requestUpdate?.call(griglia);
  await griglia.updateComplete;
}

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  const app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
  const dati: Array<[string, string]> = [['Frutta', 'Numero'], ['mela', '5'], ['pera', '8'], ['kiwi', '3'], ['uva', '6'], ['fico', '9']];
  for (let i = 0; i < dati.length; i++) {
    await doc.client.setCell(doc.activeSheetName, i + 1, 1, dati[i][0]);
    await doc.client.setCell(doc.activeSheetName, i + 1, 2, dati[i][1]);
  }
});

describe('T485: la tabella pivot non scrive sopra i dati', () => {
  it('il risultato va in un foglio nuovo e i dati di partenza restano', async () => {
    await seleziona(1, 1, 6, 2);
    const cfg = await griglia.insertPivotTable();
    await griglia.computeAndRenderPivot(cfg);
    const fogli = await doc.client.listSheets();
    expect(fogli).toEqual(['Foglio1', cfg.name]);
    expect(doc.activeSheetName).toBe(cfg.name); // ci si porta sul foglio nuovo
    const origine = await celle('Foglio1', 6, 2);
    expect(origine[0]).toEqual(['Frutta', 'Numero']);
    expect(origine[5]).toEqual(['fico', '9']);
    const pivot = await celle(cfg.name, 9, 2);
    expect(pivot.flat()).toContain('Totale complessivo');
    expect(pivot.flat()).toContain('31');
    expect(pivot.flat()).toContain('mela');
  });

  it('riapplicare la stessa tabella riscrive lo stesso foglio, senza crearne altri né lasciare avanzi', async () => {
    await seleziona(1, 1, 6, 2);
    const cfg = await griglia.insertPivotTable();
    await griglia.computeAndRenderPivot(cfg);
    await griglia.computeAndRenderPivot({ ...cfg, showGrandTotals: false });
    expect(await doc.client.listSheets()).toHaveLength(2);
    const pivot = await celle(cfg.name, 10, 2);
    expect(pivot.flat()).not.toContain('Totale complessivo');
    expect(pivot.flat()).toContain('uva');
  });

  it('si annulla (il foglio sparisce) e si ripete (torna con i suoi valori)', async () => {
    await seleziona(1, 1, 6, 2);
    const cfg = await griglia.insertPivotTable();
    await griglia.computeAndRenderPivot(cfg);
    await griglia.undo();
    expect(await doc.client.listSheets()).toEqual(['Foglio1']);
    expect((await celle('Foglio1', 1, 2))[0]).toEqual(['Frutta', 'Numero']);
    await griglia.redo();
    expect(await doc.client.listSheets()).toHaveLength(2);
    expect((await celle(cfg.name, 9, 2)).flat()).toContain('31');
  });

  it('con un nome già usato il foglio prende un altro nome', async () => {
    await doc.client.addSheet('Tabella pivot 1');
    await seleziona(1, 1, 6, 2);
    const cfg = await griglia.insertPivotTable();
    await griglia.computeAndRenderPivot(cfg);
    const fogli = await doc.client.listSheets();
    expect(fogli).toContain('Tabella pivot 1 (2)');
  });

  it('con un foglio di destinazione indicato scrive lì (come prima)', async () => {
    await doc.client.addSheet('Qui');
    await seleziona(1, 1, 6, 2);
    const cfg = await griglia.insertPivotTable();
    await griglia.computeAndRenderPivot(cfg, 'Qui');
    expect(await doc.client.listSheets()).toEqual(['Foglio1', 'Qui']);
    expect((await celle('Qui', 9, 2)).flat()).toContain('31');
  });
});
