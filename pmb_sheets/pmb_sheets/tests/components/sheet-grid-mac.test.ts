// Sul Mac le scorciatoie della griglia si fanno con Cmd: Cmd+B mette il grassetto, Ctrl+B (che sul Mac non è la scorciatoia) no.
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/components/sheet-grid';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { resolveCellStyle } from '../../src/sheet/styles';
import { impostaMacPerProva } from '@comune/piattaforma';

afterEach(() => impostaMacPerProva(null));

async function premi(id: string, tasti: KeyboardEventInit): Promise<boolean | undefined> {
  const grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
  grid.tabId = id;
  document.body.appendChild(grid);
  await grid.updateComplete;
  const doc = defaultDocumentStore.getOrCreateDocument(id);
  const container = grid.renderRoot.querySelector('.grid-container') as HTMLElement;
  container.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...tasti }));
  await grid.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  const bold = resolveCellStyle(1, 1, doc.styles).bold;
  document.body.removeChild(grid);
  return bold;
}

describe('griglia sul Mac', () => {
  it('Cmd+B mette il grassetto', async () => {
    impostaMacPerProva(true);
    expect(await premi('test-mac-1', { key: 'b', code: 'KeyB', metaKey: true })).toBe(true);
  });

  it('Ctrl+B sul Mac non è la scorciatoia del grassetto', async () => {
    impostaMacPerProva(true);
    expect(await premi('test-mac-2', { key: 'b', code: 'KeyB', ctrlKey: true })).not.toBe(true);
  });

  it('su Windows resta Ctrl+B (e Cmd, che lì non c\'è, non fa niente)', async () => {
    expect(await premi('test-mac-3', { key: 'b', code: 'KeyB', ctrlKey: true })).toBe(true);
    expect(await premi('test-mac-4', { key: 'b', code: 'KeyB', metaKey: true })).not.toBe(true);
  });
});
