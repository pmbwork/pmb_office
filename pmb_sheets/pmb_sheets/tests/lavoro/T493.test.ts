import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot };
let griglia: Griglia;

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  const app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
});

const mouse = (el: Element, tipo: string, init: MouseEventInit = {}) => el.dispatchEvent(new MouseEvent(tipo, { bubbles: true, composed: true, button: 0, ...init }));

describe('T493: trascinare sulle intestazioni', () => {
  it('da C a F seleziona le colonne C:F', async () => {
    const th = (c: number) => griglia.renderRoot.querySelector(`th.col-header[aria-colindex="${c + 1}"]`) as HTMLElement;
    mouse(th(2), 'mousedown');
    mouse(th(5), 'mouseenter', { bubbles: false });
    window.dispatchEvent(new MouseEvent('mouseup'));
    const sel = griglia.getDoc().selection;
    expect(sel.isFullCol).toBe(true);
    expect([sel.range.startCol, sel.range.endCol]).toEqual([2, 5]);
  });

  it('da riga 3 a riga 6 seleziona le righe 3:6, e il trascinamento finisce al rilascio', async () => {
    const th = (r: number) => griglia.renderRoot.querySelector(`th.row-header[aria-rowindex="${r + 1}"], tr[aria-rowindex="${r + 1}"] th.row-header`) as HTMLElement;
    mouse(th(3), 'mousedown');
    mouse(th(6), 'mouseenter', { bubbles: false });
    window.dispatchEvent(new MouseEvent('mouseup'));
    mouse(th(9), 'mouseenter', { bubbles: false });
    const sel = griglia.getDoc().selection;
    expect(sel.isFullRow).toBe(true);
    expect([sel.range.startRow, sel.range.endRow]).toEqual([3, 6]);
  });
});
