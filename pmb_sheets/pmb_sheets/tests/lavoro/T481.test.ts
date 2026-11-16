import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { cambiaRiferimento } from '../../src/sheet/riferimenti-assoluti';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { resolveCellStyle } from '../../src/sheet/styles';

describe('T481: F4 sui riferimenti', () => {
  it('il ciclo è A1 → $A$1 → A$1 → $A1 → A1', () => {
    let f = '=SUM(A1)';
    const visti: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = cambiaRiferimento(f, 6)!;
      f = r.formula;
      visti.push(f);
    }
    expect(visti).toEqual(['=SUM($A$1)', '=SUM(A$1)', '=SUM($A1)', '=SUM(A1)']);
  });

  it('cambia solo il riferimento sotto il cursore, e il cursore va alla sua fine', () => {
    const r = cambiaRiferimento('=A1+B2*C3', 6)!; // dentro B2
    expect(r.formula).toBe('=A1+$B$2*C3');
    expect(r.cursore).toBe(8);
    expect(cambiaRiferimento('=A1+B2', 3)!.formula).toBe('=$A$1+B2'); // subito dopo A1
    expect(cambiaRiferimento('=A1:B2', 5)!.formula).toBe('=A1:$B$2'); // negli intervalli, solo l'estremo sotto il cursore
  });

  it('funziona con righe e colonne grandi e con le minuscole', () => {
    expect(cambiaRiferimento('=sum(ab123)', 8)!.formula).toBe('=sum($ab$123)');
  });

  it('non tocca testi tra virgolette, funzioni come LOG10, numeri o testo che non è una formula', () => {
    expect(cambiaRiferimento('="A1"', 3)).toBeNull();
    expect(cambiaRiferimento('=LOG10(5)', 4)).toBeNull();
    expect(cambiaRiferimento('=1+2', 2)).toBeNull();
    expect(cambiaRiferimento('A1', 1)).toBeNull();
    expect(cambiaRiferimento('=SUM(A1)', 0)).toBeNull(); // cursore fuori da ogni riferimento
  });
});

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ParentNode; startEditing: (r?: boolean, c?: string) => Promise<void>;
  editValue: string; isEditing: boolean; undo: () => Promise<void>; inserisciDataOra: (t: 'data' | 'ora', d?: Date) => Promise<void>;
};
let griglia: Griglia;
let doc: SheetDocument;
const contenitore = () => griglia.renderRoot.querySelector('.grid-container') as HTMLElement;
const tasto = async (opzioni: KeyboardEventInit & { key: string }) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opzioni });
  contenitore().dispatchEvent(e);
  await new Promise((r) => setTimeout(r, 30));
  await griglia.updateComplete;
  return e;
};
async function seleziona(r: number, c: number, r2 = r, c2 = c): Promise<void> {
  doc.selection = { anchor: { row: r, col: c }, active: { row: r, col: c }, range: { startRow: r, endRow: r2, startCol: c, endCol: c2 } } as SheetDocument['selection'];
  griglia.requestUpdate?.call(griglia);
  await griglia.updateComplete;
}
const raw = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw;

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

describe('T481: scorciatoie nella griglia', () => {
  it('Ctrl+A seleziona tutto', async () => {
    await seleziona(2, 2);
    await tasto({ key: 'a', code: 'KeyA', ctrlKey: true });
    expect(doc.selection.isAll).toBe(true);
  });

  it('Ctrl+Spazio seleziona la colonna, Maiusc+Spazio la riga della cella attiva', async () => {
    await seleziona(4, 3);
    await tasto({ key: ' ', code: 'Space', ctrlKey: true });
    expect(doc.selection.isFullCol).toBe(true);
    expect(doc.selection.range.startCol).toBe(3);
    await seleziona(4, 3);
    await tasto({ key: ' ', code: 'Space', shiftKey: true });
    expect(doc.selection.isFullRow).toBe(true);
    expect(doc.selection.range.startRow).toBe(4);
  });

  it('Ctrl+; scrive la data di oggi con il formato data, e si annulla', async () => {
    await seleziona(2, 2);
    await griglia.inserisciDataOra('data', new Date(2026, 2, 5, 14, 30, 0));
    expect(await raw(2, 2)).toBe('46086');
    expect(resolveCellStyle(2, 2, doc.styles).numFmt).toBe('dd/mm/yyyy');
    await griglia.undo();
    expect(await raw(2, 2)).toBe('');
    expect(resolveCellStyle(2, 2, doc.styles).numFmt || '').toBe('');
  });

  it('Ctrl+Maiusc+; scrive l\'ora attuale; il tasto vero li richiama', async () => {
    await seleziona(3, 3);
    await griglia.inserisciDataOra('ora', new Date(2026, 2, 5, 18, 30, 0));
    expect(await raw(3, 3)).toBe('0.770833333333333');
    expect(resolveCellStyle(3, 3, doc.styles).numFmt).toBe('hh:mm:ss');
    await seleziona(5, 5);
    await tasto({ key: ';', code: 'Semicolon', ctrlKey: true });
    expect(Number(await raw(5, 5))).toBeGreaterThan(46000);
    expect(resolveCellStyle(5, 5, doc.styles).numFmt).toBe('dd/mm/yyyy');
  });

  it('Ctrl+Maiusc+X applica il barrato e non taglia', async () => {
    await doc.client.setCell(doc.activeSheetName, 2, 2, 'ciao');
    await seleziona(2, 2);
    await tasto({ key: 'X', code: 'KeyX', ctrlKey: true, shiftKey: true });
    expect(resolveCellStyle(2, 2, doc.styles).strike).toBe(true);
    expect(await raw(2, 2)).toBe('ciao');
  });

  it('Ctrl+Maiusc+V incolla solo i valori', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, '5');
    await doc.client.setCell(doc.activeSheetName, 1, 2, '=A1*2');
    await seleziona(1, 2);
    (griglia as unknown as { applyFormat: (p: object) => void }).applyFormat({ bold: true });
    await tasto({ key: 'c', code: 'KeyC', ctrlKey: true });
    await seleziona(4, 1);
    await tasto({ key: 'V', code: 'KeyV', ctrlKey: true, shiftKey: true });
    expect(await raw(4, 1)).toBe('10');
    expect(resolveCellStyle(4, 1, doc.styles).bold).toBeFalsy();
  });

  it('i caratteri con AltGr (@ [ ] { } #) iniziano la digitazione', async () => {
    await seleziona(2, 2);
    const e = await tasto({ key: '@', code: 'Semicolon', ctrlKey: true, altKey: true });
    expect(e.defaultPrevented).toBe(true);
    expect(griglia.isEditing).toBe(true);
    expect(griglia.editValue).toBe('@');
  });

  it('F4 nell\'editor cambia il riferimento sotto il cursore', async () => {
    await seleziona(2, 2);
    await griglia.startEditing(true, '=');
    griglia.editValue = '=A1+B2';
    griglia.requestUpdate?.call(griglia);
    await griglia.updateComplete;
    const campo = griglia.renderRoot.querySelector('.cell-editor-overlay') as HTMLInputElement;
    campo.value = '=A1+B2';
    campo.setSelectionRange(3, 3);
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'F4', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(griglia.editValue).toBe('=$A$1+B2');
    expect(campo.value).toBe('=$A$1+B2');
  });
});
