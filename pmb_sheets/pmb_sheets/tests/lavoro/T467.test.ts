import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/index';

describe('T467: cambiando foglio si vedono i dati del foglio scelto', () => {
  let grid: FreeSheetGrid;
  beforeEach(async () => {
    defaultDocumentStore.removeDocument('test-T467');
    defaultDocumentStore.getOrCreateDocument('test-T467');
    grid = new FreeSheetGrid();
    grid.tabId = 'test-T467';
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });

  const celle = (g: FreeSheetGrid) => (g as unknown as { cellsCache: Map<string, { raw: string }> }).cellsCache;
  const vista = (g: FreeSheetGrid) => (g.shadowRoot!.querySelector('[data-row="1"][data-col="1"]')?.textContent ?? '').trim();

  it('tornando a un foglio con dati, le celle sono di nuovo caricate e mostrate', async () => {
    const doc = grid['getDoc']();
    const primo = doc.activeSheetName;
    await doc.client.setCell(primo, 1, 1, 'uno');
    await grid.handleAddSheet('Secondo');
    await doc.client.setCell('Secondo', 1, 1, 'due');
    await grid.switchSheet(primo);
    await vi_waitFor(() => celle(grid).get('1:1')?.raw !== undefined && celle(grid).size > 0);
    await grid.updateComplete;
    expect(vista(grid)).toBe('uno');
    await grid.switchSheet('Secondo');
    await vi_waitFor(() => vista(grid) === 'due');
    expect(vista(grid)).toBe('due');
  });

  it('avvisa chi sta fuori dei fogli e di quale è attivo', async () => {
    const visti: Array<{ fogli: string[]; attivo: string }> = [];
    grid.addEventListener('sheets-changed', (e) => visti.push((e as CustomEvent).detail));
    await grid.handleAddSheet('Altro');
    expect(visti.at(-1)).toEqual({ fogli: [grid['getDoc']().activeSheetName === 'Altro' ? visti.at(-1)!.fogli[0] : '', 'Altro'].filter(Boolean), nascosti: [], attivo: 'Altro', colori: {} });
  });
});

async function vi_waitFor(cond: () => boolean, ms = 2000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('condizione non raggiunta');
    await new Promise((r) => setTimeout(r, 20));
  }
}
