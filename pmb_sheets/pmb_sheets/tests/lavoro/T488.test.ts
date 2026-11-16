import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { setInternalClipboard } from '../../src/sheet/clipboard';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ParentNode; startEditing: (r?: boolean, c?: string) => Promise<void>; isEditing: boolean;
  paste: (t?: string) => Promise<void>;
};
let griglia: Griglia;
let doc: SheetDocument;
const raw = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw;
const contenitore = () => griglia.renderRoot.querySelector('.grid-container') as HTMLElement;
const evtAppunti = (tipo: 'paste' | 'copy' | 'cut', testo = '') => Object.assign(new Event(tipo, { bubbles: true, cancelable: true, composed: true }), { clipboardData: { getData: () => testo, setData: () => undefined } });

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  setInternalClipboard(null);
  const app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
});

describe('T488: appunti', () => {
  it('l\'evento di incolla con il testo del browser incolla subito, senza leggere gli appunti di sistema', async () => {
    const lettura = vi.fn(() => new Promise<string>(() => { /* non risponde mai: come gli appunti bloccati */ }));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: lettura, writeText: async () => undefined } });
    const t0 = Date.now();
    contenitore().dispatchEvent(evtAppunti('paste', 'a\tb\nc\td'));
    await new Promise((r) => setTimeout(r, 60));
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(await raw(1, 1)).toBe('a');
    expect(await raw(1, 2)).toBe('b');
    expect(await raw(2, 1)).toBe('c');
    expect(await raw(2, 2)).toBe('d');
    expect(lettura).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('Ctrl+V non blocca l\'evento di incolla del browser (la griglia aspetta quello, con una rete di sicurezza)', async () => {
    const e = new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', ctrlKey: true, bubbles: true, cancelable: true });
    contenitore().dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('se l\'evento di incolla non arriva, dopo un attimo si incolla leggendo gli appunti', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: async () => 'x\ty', writeText: async () => undefined } });
    contenitore().dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', ctrlKey: true, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 700));
    expect(await raw(1, 1)).toBe('x');
    expect(await raw(1, 2)).toBe('y');
    vi.unstubAllGlobals();
  });

  it('se l\'evento di incolla arriva, la rete di sicurezza non incolla una seconda volta', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: async () => 'zzz', writeText: async () => undefined } });
    contenitore().dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', ctrlKey: true, bubbles: true, cancelable: true }));
    contenitore().dispatchEvent(evtAppunti('paste', 'uno'));
    await new Promise((r) => setTimeout(r, 700));
    expect(await raw(1, 1)).toBe('uno');
    vi.unstubAllGlobals();
  });

  it('copiare, tagliare o incollare dentro l\'editor della cella è roba dell\'editor: la griglia non interviene', async () => {
    await doc.client.setCell(doc.activeSheetName, 3, 3, 'cella');
    doc.selection = { anchor: { row: 3, col: 3 }, active: { row: 3, col: 3 }, range: { startRow: 3, endRow: 3, startCol: 3, endCol: 3 } } as SheetDocument['selection'];
    griglia.requestUpdate?.call(griglia);
    await griglia.updateComplete;
    await griglia.startEditing(false);
    const editor = griglia.renderRoot.querySelector('.cell-editor-overlay') as HTMLInputElement;
    for (const tipo of ['copy', 'cut', 'paste'] as const) {
      const e = evtAppunti(tipo, 'testo incollato');
      editor.dispatchEvent(e);
      expect(e.defaultPrevented, tipo).toBe(false);
    }
    await new Promise((r) => setTimeout(r, 100));
    expect(await raw(3, 3)).toBe('cella'); // né tagliata né sovrascritta
    expect(await raw(1, 1)).toBe('');
    expect(griglia.isEditing).toBe(true);
  });
});
