import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import '../../src/components/sheet-grid';
import '../../src/components/chart-overlay';
import { defaultDocumentStore } from '../../src/sheet';

describe('FreeSheetGrid Advanced M3 Tests (Grafici e Pivot)', () => {
  let grid: FreeSheetGrid;

  beforeEach(async () => {
    defaultDocumentStore.removeDocument('tab-test-m3');
    grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
    grid.tabId = 'tab-test-m3';
    document.body.appendChild(grid);
    await grid.updateComplete;
  });

  afterEach(() => {
    if (grid.parentElement) {
      grid.parentElement.removeChild(grid);
    }
  });

  it('1. insertChart crea una ChartConfig e renderizza free-chart-overlay nel DOM', async () => {
    const doc = (grid as any).getDoc();
    // Popola dati A1:B3
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'Prodotto A');
    await doc.client.setCell(doc.activeSheetName, 2, 1, 'Prodotto B');
    await doc.client.setCell(doc.activeSheetName, 3, 1, 'Prodotto C');
    await doc.client.setCell(doc.activeSheetName, 1, 2, '100');
    await doc.client.setCell(doc.activeSheetName, 2, 2, '200');
    await doc.client.setCell(doc.activeSheetName, 3, 2, '300');

    (grid as any).selectSingle(1, 1);
    (grid as any).extendSelectionTo(3, 2);

    const chart = await grid.insertChart('column');
    expect(chart).toBeDefined();
    expect(chart.type).toBe('column');
    expect(chart.categories).toEqual(['Prodotto A', 'Prodotto B', 'Prodotto C']);
    expect(chart.series[0].data).toEqual([100, 200, 300]);
    expect(doc.charts.length).toBe(1);

    await grid.updateComplete;

    // Verifica presenza di free-chart-overlay nel renderRoot
    const overlay = grid.renderRoot.querySelector('free-chart-overlay');
    expect(overlay).not.toBeNull();
  });

  it('2. computeAndRenderPivot aggrega dati e li scrive sul foglio', async () => {
    const doc = (grid as any).getDoc();
    // Tabella: Regione (col 1), Vendite (col 2)
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'Regione');
    await doc.client.setCell(doc.activeSheetName, 1, 2, 'Vendite');
    await doc.client.setCell(doc.activeSheetName, 2, 1, 'Nord');
    await doc.client.setCell(doc.activeSheetName, 2, 2, '100');
    await doc.client.setCell(doc.activeSheetName, 3, 1, 'Sud');
    await doc.client.setCell(doc.activeSheetName, 3, 2, '200');
    await doc.client.setCell(doc.activeSheetName, 4, 1, 'Nord');
    await doc.client.setCell(doc.activeSheetName, 4, 2, '150');

    const pivotConfig = {
      id: 'p-1',
      name: 'Riepilogo',
      sourceSheet: doc.activeSheetName,
      sourceRange: 'A1:B4',
      rowFields: [{ sourceColIndex: 0, name: 'Regione' }],
      colFields: [],
      valueFields: [{ sourceColIndex: 1, name: 'Vendite', aggregation: 'SUM' as const }],
      filters: [],
      showGrandTotals: true,
      showSubtotals: false,
    };

    // Renderizza a partire da riga 10, colonna 1
    await grid.computeAndRenderPivot(pivotConfig, doc.activeSheetName, 10, 1);

    // Verifica celle scritte dal motore pivot
    const titleCell = await doc.client.getCell(doc.activeSheetName, 10, 1);
    expect(titleCell.raw).toContain('Riepilogo');

    // Nord: 100 + 150 = 250
    const nordLabel = await doc.client.getCell(doc.activeSheetName, 12, 1);
    const nordVal = await doc.client.getCell(doc.activeSheetName, 12, 2);
    expect(nordLabel.raw).toBe('Nord');
    expect(nordVal.raw).toBe('250');

    // Sud: 200
    const sudLabel = await doc.client.getCell(doc.activeSheetName, 13, 1);
    const sudVal = await doc.client.getCell(doc.activeSheetName, 13, 2);
    expect(sudLabel.raw).toBe('Sud');
    expect(sudVal.raw).toBe('200');

    // Totale complessivo: 450
    const totLabel = await doc.client.getCell(doc.activeSheetName, 14, 1);
    const totVal = await doc.client.getCell(doc.activeSheetName, 14, 2);
    expect(totLabel.raw).toBe('Totale complessivo');
    expect(totVal.raw).toBe('450');
  });
});
