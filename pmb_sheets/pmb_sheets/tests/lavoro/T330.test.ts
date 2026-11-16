import { describe, it, expect, beforeEach } from 'vitest';
import { createWorkbook } from '../../src/engine/workbook';
import { InlineEngineClient } from '../../src/sheet/engine-client';
import '../../src/components/sheet-grid';

describe('T330 — T332: Drag & Drop Schede Foglio e Altezza Riga (Lotto S1)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('Workbook.moveSheet riordina correttamente i fogli per indice', () => {
    const wb = createWorkbook();
    wb.addSheet('Dati');
    wb.addSheet('Grafici');

    expect(wb.listSheets()).toEqual(['Foglio1', 'Dati', 'Grafici']);

    // Sposta 'Grafici' (indice 2) in prima posizione (indice 0)
    const ok = wb.moveSheet(2, 0);
    expect(ok).toBe(true);
    expect(wb.listSheets()).toEqual(['Grafici', 'Foglio1', 'Dati']);

    // Sposta 'Grafici' (indice 0) a indice 1
    wb.moveSheet(0, 1);
    expect(wb.listSheets()).toEqual(['Foglio1', 'Grafici', 'Dati']);

    // Indici fuori intervallo restituiscono false
    expect(wb.moveSheet(-1, 0)).toBe(false);
    expect(wb.moveSheet(0, 10)).toBe(false);
  });

  it('EngineClient.moveSheet riordina le schede e aggiorna listSheets', async () => {
    const client = new InlineEngineClient();
    await client.addSheet('Entrate');
    await client.addSheet('Uscite');

    const listaIniziale = await client.listSheets();
    expect(listaIniziale).toEqual(['Foglio1', 'Entrate', 'Uscite']);

    const ok = await client.moveSheet(2, 1);
    expect(ok).toBe(true);

    const listaFinale = await client.listSheets();
    expect(listaFinale).toEqual(['Foglio1', 'Uscite', 'Entrate']);
  });

  it('SheetGrid integra reorderSheet e supporta setRowHeight per altezze riga personalizzate', async () => {
    const grid: any = document.createElement('free-sheet-grid');
    document.body.appendChild(grid);
    await grid.updateComplete;

    await grid.handleAddSheet('Budget');
    await grid.handleAddSheet('Report');

    expect(grid.sheetList).toContain('Budget');
    expect(grid.sheetList).toContain('Report');

    // Riordino schede
    const ok = await grid.reorderSheet(1, 0);
    expect(ok).toBe(true);

    // Impostazione altezza riga personalizzata
    grid.setRowHeight(3, 48);
    const doc = grid.getDoc();
    expect(doc.rowHeights.get(3)).toBe(48);
  });
});
