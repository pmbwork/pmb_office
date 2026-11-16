import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot };
let griglia: Griglia;
let doc: SheetDocument;

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  const app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
});

const ridisegna = async () => { (griglia as unknown as { cellsCache: Map<string, unknown> }).cellsCache.clear(); (griglia as unknown as { updateViewport: () => void }).updateViewport(); await new Promise((r) => setTimeout(r, 150)); griglia.requestUpdate(); await griglia.updateComplete; };
const td = (r: number, c: number) => griglia.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement;

describe('T492: VERO/FALSO nelle celle', () => {
  it('il risultato di una formula si legge come testo (FALSO), senza casella che sovrascriverebbe la formula', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, '=AND(TRUE,FALSE)');
    await doc.client.setCell(doc.activeSheetName, 2, 1, '=OR(TRUE,FALSE)');
    await ridisegna();
    expect(td(1, 1).querySelector('.sheet-checkbox')).toBeNull();
    expect(td(1, 1).textContent!.trim()).toBe('FALSO');
    expect(td(2, 1).textContent!.trim()).toBe('VERO');
  });

  it('un VERO/FALSO scritto a mano resta una casella, come una casella di controllo inserita', async () => {
    await doc.client.setCell(doc.activeSheetName, 3, 1, 'TRUE');
    await ridisegna();
    expect(td(3, 1).querySelector('.sheet-checkbox')).not.toBeNull();
  });
});
