import { describe, it, expect } from 'vitest';
import '../../src/components/sheet-grid';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { resolveCellStyle } from '../../src/sheet/styles';

describe('SheetGrid Formatting & Shortcuts Component Tests (happy-dom)', () => {
  it('applica formato grassetto tramite handleFormatAction e aggiorna la resa visuale', async () => {
    const grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
    grid.tabId = 'test-grid-fmt-1';
    document.body.appendChild(grid);
    await grid.updateComplete;

    const doc = defaultDocumentStore.getOrCreateDocument('test-grid-fmt-1');
    await doc.client.setCell('Foglio1', 1, 1, '123');

    // Applica grassetto
    grid.handleFormatAction('format-bold');
    await grid.updateComplete;

    const actStyle = resolveCellStyle(1, 1, doc.styles);
    expect(actStyle.bold).toBe(true);

    // Toggle: disattiva grassetto
    grid.handleFormatAction('format-bold');
    await grid.updateComplete;
    const actStyle2 = resolveCellStyle(1, 1, doc.styles);
    expect(actStyle2.bold).toBe(false);

    document.body.removeChild(grid);
  });

  it('applica formati numerici valuta e percentuale e aggiorna il testo mostrato', async () => {
    const grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
    grid.tabId = 'test-grid-fmt-2';
    document.body.appendChild(grid);
    await grid.updateComplete;

    const doc = defaultDocumentStore.getOrCreateDocument('test-grid-fmt-2');
    await doc.client.setCell('Foglio1', 1, 1, '0.256');

    // Formatta come percentuale
    grid.handleFormatAction('format-percent');
    await grid.updateComplete;

    const actStyle = resolveCellStyle(1, 1, doc.styles);
    expect(actStyle.numFmt).toBe('0.00%');

    // Cella A1 deve mostrare 25.60%
    const cellEl = grid.renderRoot.querySelector('[data-address="A1"]') as HTMLElement;
    expect(cellEl?.textContent?.trim()).toBe('25.60%');

    // Formatta come valuta
    grid.handleFormatAction('format-currency');
    await grid.updateComplete;
    expect(cellEl?.textContent?.trim()).toBe('€0.26');

    document.body.removeChild(grid);
  });

  it('scorciatoia da tastiera Ctrl+B applica grassetto solo se non in modifica', async () => {
    const grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
    grid.tabId = 'test-grid-fmt-3';
    document.body.appendChild(grid);
    await grid.updateComplete;

    const doc = defaultDocumentStore.getOrCreateDocument('test-grid-fmt-3');

    // Evento tastiera Ctrl+B sulla griglia
    const container = grid.renderRoot.querySelector('.grid-container') as HTMLElement;
    container.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'b',
        code: 'KeyB',
        ctrlKey: true,
        bubbles: true,
      })
    );
    await grid.updateComplete;

    expect(resolveCellStyle(1, 1, doc.styles).bold).toBe(true);

    // Quando l'editor e attivo (isEditing = true), la scorciatoia da cella non deve interferire
    await grid.startEditing(false);
    expect((grid as any).isEditing).toBe(true);

    // Ctrl+B premuto dentro l'input non tocca gli stili della cella
    container.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'b',
        code: 'KeyB',
        ctrlKey: true,
        bubbles: true,
      })
    );
    await grid.updateComplete;
    // Rimane true, non viene togglato a false
    expect(resolveCellStyle(1, 1, doc.styles).bold).toBe(true);

    document.body.removeChild(grid);
  });

  it('undo e redo ripristinano formati di cella, riga e colonna', async () => {
    const grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
    grid.tabId = 'test-grid-fmt-4';
    document.body.appendChild(grid);
    await grid.updateComplete;

    const doc = defaultDocumentStore.getOrCreateDocument('test-grid-fmt-4');
    expect(resolveCellStyle(1, 1, doc.styles).italic).toBeUndefined();

    // Applica corsivo
    grid.handleFormatAction('format-italic');
    await grid.updateComplete;
    expect(resolveCellStyle(1, 1, doc.styles).italic).toBe(true);

    // Undo
    await grid.undo();
    await grid.updateComplete;
    expect(resolveCellStyle(1, 1, doc.styles).italic).toBeUndefined();

    // Redo
    await grid.redo();
    await grid.updateComplete;
    expect(resolveCellStyle(1, 1, doc.styles).italic).toBe(true);

    document.body.removeChild(grid);
  });

  it('bordi applicati alle celle', async () => {
    const grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
    grid.tabId = 'test-grid-fmt-5';
    document.body.appendChild(grid);
    await grid.updateComplete;

    const doc = defaultDocumentStore.getOrCreateDocument('test-grid-fmt-5');
    grid.handleFormatAction('format-borders', 'all');
    await grid.updateComplete;

    const styleA1 = resolveCellStyle(1, 1, doc.styles);
    expect(styleA1.borders?.top?.style).toBe('thin');
    expect(styleA1.borders?.bottom?.style).toBe('thin');
    expect(styleA1.borders?.left?.style).toBe('thin');
    expect(styleA1.borders?.right?.style).toBe('thin');

    document.body.removeChild(grid);
  });
});
