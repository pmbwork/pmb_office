import { describe, it, expect } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/index';

describe('T466: niente barra dei fogli in basso (le schede sono in alto)', () => {
  it('la griglia non disegna più la barra con "+" e i nomi dei fogli', async () => {
    defaultDocumentStore.getOrCreateDocument('test-T466');
    const g = new FreeSheetGrid();
    g.tabId = 'test-T466';
    document.body.appendChild(g);
    await g.updateComplete;
    await g.refreshSheetList();
    const r = g.shadowRoot!;
    expect(r.querySelector('.sheet-tabs-bar')).toBeNull();
    expect(r.querySelector('.sheet-tab-add')).toBeNull();
    expect(r.querySelector('.sheet-tab-item')).toBeNull();
    expect(r.querySelector('.formula-bar')).not.toBeNull(); // il resto della griglia c'è
  });
});
