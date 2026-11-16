import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/index';
import { cellKey } from '../../src/sheet/styles';
import { dividiPerRiempimento, formattaNumero } from '../../src/engine/format-testo';

const CONTABILITA = '_(€* #,##0.00_);_(€* (#,##0.00);_(€* "-"??_);_(@_)';

describe('T529: contabilità, il simbolo a sinistra e il numero a destra (parte pura)', () => {
  it('positivo, negativo e zero si dividono nel punto del riempimento', () => {
    expect(dividiPerRiempimento(1234.5, CONTABILITA, 'en')).toEqual([' €', '1,234.50 ']);
    expect(dividiPerRiempimento(-7, CONTABILITA, 'en')).toEqual([' €', '(7.00)']);
    expect(dividiPerRiempimento(0, CONTABILITA, 'en')).toEqual([' €', '-   ']);
  });
  it('nella lingua italiana', () => {
    expect(dividiPerRiempimento(1234.5, CONTABILITA, 'it')).toEqual([' €', '1.234,50 ']);
  });
  it('un formato senza «* » non si divide, e il testo normale non cambia', () => {
    expect(dividiPerRiempimento(5, '0.00', 'en')).toBeNull();
    expect(dividiPerRiempimento(5, '#,##0.00 "€"', 'en')).toBeNull();
    expect(formattaNumero(1234.5, CONTABILITA, 'en')).toBe(' € 1,234.50 ');
  });
  it('dopo la divisione il testo normale è ancora quello di prima (il segnaposto non resta)', () => {
    dividiPerRiempimento(1, CONTABILITA, 'en');
    expect(formattaNumero(2, CONTABILITA, 'en')).not.toContain('\u0001');
  });
});

describe('T529: nella griglia', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  beforeEach(async () => {
    const tabId = `test-T529-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
    const doc = grid['getDoc']();
    await doc.client.applyBatch([{ type: 'set' as const, sheet: doc.activeSheetName, row: 2, col: 2, raw: '1234.5' }, { type: 'set' as const, sheet: doc.activeSheetName, row: 3, col: 2, raw: '99' }]);
    doc.styles.cellStyles.set(cellKey(2, 2), doc.styles.registry.merge(0, { numFmt: CONTABILITA }));
    grid.requestUpdate();
    await grid.updateComplete;
  });
  const td = (r: number, c: number) => grid.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement;
  it('la cella in contabilità ha due parti, il simbolo e il numero; le altre no', () => {
    const parti = Array.from(td(2, 2).querySelectorAll('.riempimento > span')).map((x) => x.textContent);
    expect(parti).toHaveLength(2);
    expect(parti[0]!.trim()).toBe('€');
    expect(parti[1]!.trim()).toMatch(/1[.,]234[.,]50/);
    expect(td(3, 2).querySelector('.riempimento')).toBeNull();
  });
});
