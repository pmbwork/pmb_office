import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { GeometriaRighe } from '../../src/sheet/geometria';
import { computeVisibleRange } from '../../src/sheet/viewport';
import { menuRegistry } from '../../src/registry/menu';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

describe('T483: geometria delle righe', () => {
  it('senza eccezioni le righe sono tutte alte uguale', () => {
    const g = new GeometriaRighe(22, 1000);
    expect(g.uniforme).toBe(true);
    expect(g.top(1)).toBe(0);
    expect(g.top(11)).toBe(220);
    expect(g.totale()).toBe(22000);
    expect(g.rigaDaY(0)).toBe(1);
    expect(g.rigaDaY(21.9)).toBe(1);
    expect(g.rigaDaY(22)).toBe(2);
  });

  it('una riga nascosta non ha altezza e sposta quelle sotto', () => {
    const g = new GeometriaRighe(20, 100, undefined, [3]);
    expect(g.uniforme).toBe(false);
    expect(g.altezza(3)).toBe(0);
    expect(g.nascosta(3)).toBe(true);
    expect(g.nascosta(4)).toBe(false);
    expect(g.top(3)).toBe(40);
    expect(g.top(4)).toBe(40); // la riga 3 non ha altezza: la 4 comincia dove cominciava la 3
    expect(g.top(5)).toBe(60);
    expect(g.totale()).toBe(99 * 20);
    expect(g.rigaDaY(41)).toBe(4);
    expect(g.rigaDaY(39)).toBe(2);
  });

  it('un\'altezza personalizzata sposta quelle sotto; più eccezioni si sommano', () => {
    const g = new GeometriaRighe(20, 100, new Map([[2, 50], [5, 10]]), [4]);
    expect(g.altezza(2)).toBe(50);
    expect(g.top(3)).toBe(20 + 50);
    expect(g.top(5)).toBe(20 + 50 + 20 + 0);
    expect(g.top(6)).toBe(20 + 50 + 20 + 0 + 10);
    expect(g.top(7)).toBe(g.top(6) + 20);
    // l'altezza uguale a quella normale non è un'eccezione
    expect(new GeometriaRighe(20, 100, new Map([[2, 20]])).uniforme).toBe(true);
  });

  it('rigaDaY è la funzione inversa di top, anche con molte eccezioni', () => {
    const nascoste = Array.from({ length: 5000 }, (_, i) => 100 + i * 2);
    const g = new GeometriaRighe(22, 1_048_576, new Map([[7, 80], [300, 5]]), nascoste);
    for (const r of [1, 7, 8, 99, 101, 102, 300, 301, 20000, 1_048_576]) {
      if (g.nascosta(r)) continue;
      expect(g.rigaDaY(g.top(r) + 0.001), `riga ${r}`).toBe(r);
    }
  });

  it('prossimaVisibile salta un blocco intero di righe nascoste', () => {
    const g = new GeometriaRighe(22, 1_048_576, undefined, [5, 6, 7, 8, 20]);
    expect(g.prossimaVisibile(4)).toBe(4);
    expect(g.prossimaVisibile(5)).toBe(9);
    expect(g.prossimaVisibile(7)).toBe(9);
    expect(g.prossimaVisibile(20)).toBe(21);
    const molte = new GeometriaRighe(22, 1_048_576, undefined, Array.from({ length: 1_000_000 }, (_, i) => i + 10));
    expect(molte.prossimaVisibile(10)).toBe(1_000_010);
    expect(molte.contaNascosteTra(1, 1_048_576)).toBe(1_000_000);
    expect(molte.contaNascosteTra(5, 14)).toBe(5);
  });
});

describe('T483: righe visibili con righe nascoste', () => {
  it('senza geometria il risultato è quello di sempre', () => {
    const a = computeVisibleRange({ scrollTop: 440, scrollLeft: 0, viewportWidth: 800, viewportHeight: 400 });
    const b = computeVisibleRange({ scrollTop: 440, scrollLeft: 0, viewportWidth: 800, viewportHeight: 400, righe: new GeometriaRighe(22, 1_048_576) });
    expect(b).toEqual(a);
  });

  it('con righe nascoste in cima, la finestra comincia dopo e il totale si accorcia', () => {
    const geom = new GeometriaRighe(22, 1_048_576, undefined, Array.from({ length: 100 }, (_, i) => i + 1));
    const v = computeVisibleRange({ scrollTop: 0, scrollLeft: 0, viewportWidth: 800, viewportHeight: 400, righe: geom });
    expect(v.startRow).toBeGreaterThan(90); // la finestra parte dalle righe che si vedono (101) meno il margine, non da 1
    expect(v.startRow).toBeLessThanOrEqual(101);
    expect(v.endRow).toBeGreaterThan(100); // si arriva alle righe che si vedono
    expect(v.rowCount).toBeLessThan(v.endRow - v.startRow + 1); // le nascoste non contano come celle da disegnare
    expect(v.totalHeight).toBeCloseTo((1_048_576 - 100) * 22, 5);
  });

  it('un blocco enorme di righe nascoste non fa disegnare milioni di righe', () => {
    const geom = new GeometriaRighe(22, 1_048_576, undefined, Array.from({ length: 500_000 }, (_, i) => i + 1));
    const v = computeVisibleRange({ scrollTop: 0, scrollLeft: 0, viewportWidth: 800, viewportHeight: 400, righe: geom });
    expect(v.rowCount).toBeLessThan(200);
  });
});

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ParentNode;
  hideRow: (r: number) => void; hideCol: (c: number) => void; unhideRows: () => void; setFreezePanes: (r: number, c: number) => void; undo: () => Promise<void>;
};
let griglia: Griglia;
let doc: SheetDocument;
const td = (r: number, c: number) => griglia.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement | null;
async function ridisegna() { griglia.requestUpdate(); await griglia.updateComplete; }

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

describe('T483: nella griglia', () => {
  it('una riga nascosta non si disegna; con Mostra tutte torna; si annulla', async () => {
    expect(td(3, 1)).not.toBeNull();
    griglia.hideRow(3);
    await ridisegna();
    expect(td(3, 1)).toBeNull();
    expect(td(2, 1)).not.toBeNull();
    expect(td(4, 1)).not.toBeNull();
    griglia.unhideRows();
    await ridisegna();
    expect(td(3, 1)).not.toBeNull();
    await griglia.undo();
    await ridisegna();
    expect(td(3, 1)).toBeNull();
  });

  it('una colonna nascosta non si disegna e non lascia spazio', async () => {
    griglia.hideCol(2);
    await ridisegna();
    expect(td(1, 2)).toBeNull();
    expect(td(1, 3)).not.toBeNull();
    const intestazioni = Array.from(griglia.renderRoot.querySelectorAll('th.col-header')).slice(0, 3).map((x) => x.textContent!.trim().charAt(0));
    expect(intestazioni).toEqual(['A', 'C', 'D']);
  });

  it('l\'altezza di una riga personalizzata si vede, anche nell\'intestazione', async () => {
    doc.rowHeights.set(5, 60);
    await ridisegna();
    expect(td(5, 1)!.style.height).toBe('60px');
    expect((td(5, 1)!.closest('tr') as HTMLElement).style.height).toBe('60px');
    expect(td(6, 1)!.style.height).toBe('22px');
  });

  it('il filtro nasconde davvero le righe', async () => {
    for (let r = 1; r <= 6; r++) await doc.client.setCell(doc.activeSheetName, r, 1, r % 2 === 0 ? 'si' : 'no');
    doc.hiddenRows = new Set([1, 3, 5]);
    await ridisegna();
    expect([1, 2, 3, 4, 5, 6].filter((r) => td(r, 1) !== null)).toEqual([2, 4, 6]);
  });

  it('le righe bloccate restano in cima: le celle sono "sticky" con la distanza giusta', async () => {
    griglia.setFreezePanes(2, 1);
    await ridisegna();
    expect(doc.freezeRows).toBe(2);
    const intestazione = 24;
    expect(td(1, 1)!.style.position).toBe('sticky');
    expect(td(1, 1)!.style.top).toBe(`${intestazione}px`);
    expect(td(2, 1)!.style.top).toBe(`${intestazione + 22}px`);
    expect(td(3, 2)!.style.position).toBe('');
    // le colonne bloccate: a sinistra, dopo l'intestazione di riga (44px); sotto le righe bloccate non hanno una distanza dall'alto
    expect(td(3, 1)!.style.position).toBe('sticky');
    expect(td(3, 1)!.style.top).toBe('');
    expect(td(3, 1)!.style.left).toBe('44px');
    expect(td(5, 1)!.style.position).toBe('sticky');
    expect(td(5, 1)!.style.left).toBe('44px');
    expect(td(5, 2)!.style.position).toBe('');
    expect(td(2, 1)!.style.zIndex).toBe('3');
    expect(td(1, 2)!.classList.contains('congela-fondo')).toBe(false);
    expect(td(2, 2)!.classList.contains('congela-fondo')).toBe(true);
    expect(td(5, 1)!.classList.contains('congela-lato')).toBe(true);
  });

  it('con il foglio scorso in basso le righe bloccate si disegnano comunque, davanti alle altre', async () => {
    griglia.setFreezePanes(2, 0);
    doc.scroll.top = 22 * 500;
    (griglia as unknown as { updateViewport: () => void }).updateViewport();
    await ridisegna();
    const righe = Array.from(griglia.renderRoot.querySelectorAll('tbody tr')).map((x) => Number(x.getAttribute('aria-rowindex')) - 1);
    expect(righe.slice(0, 2)).toEqual([1, 2]);
    expect(righe[2]).toBeGreaterThan(400);
    expect(td(1, 1)!.style.position).toBe('sticky');
  });

  it('il blocco più grande di 200 righe si ferma a 200; zero toglie il blocco; si annulla', async () => {
    griglia.setFreezePanes(5000, 300);
    expect([doc.freezeRows, doc.freezeCols]).toEqual([200, 200]);
    griglia.setFreezePanes(0, 0);
    expect([doc.freezeRows, doc.freezeCols]).toEqual([0, 0]);
    await griglia.undo();
    expect([doc.freezeRows, doc.freezeCols]).toEqual([200, 200]);
  });

  it('il menu Blocca ha le voci "fino alla riga, colonna, cella corrente"', () => {
    const t = JSON.stringify(menuRegistry);
    for (const id of ['freeze-to-row', 'freeze-to-col', 'freeze-to-cell']) expect(t).toContain(id);
  });

  it('le frecce saltano le righe e le colonne nascoste', async () => {
    griglia.hideRow(3);
    griglia.hideCol(3);
    doc.selection = { anchor: { row: 2, col: 2 }, active: { row: 2, col: 2 }, range: { startRow: 2, endRow: 2, startCol: 2, endCol: 2 } } as SheetDocument['selection'];
    await ridisegna();
    const contenitore = griglia.renderRoot.querySelector('.grid-container') as HTMLElement;
    const premi = async (key: string) => { contenitore.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 20)); };
    await premi('ArrowDown');
    expect(doc.selection.active.row).toBe(4);
    await premi('ArrowUp');
    expect(doc.selection.active.row).toBe(2);
    await premi('ArrowRight');
    expect(doc.selection.active.col).toBe(4);
    await premi('ArrowLeft');
    expect(doc.selection.active.col).toBe(2);
  });
});

describe('T483: intestazioni e righe bloccate si agganciano al riquadro che scorre', () => {
  it('il contenitore della tabella ritaglia senza diventare un contenitore che scorre (overflow: clip)', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/components/sheet-grid.ts', 'utf8');
    const blocco = /\.virtual-spacer \{[^}]*\}/.exec(css)![0];
    expect(blocco).toContain('overflow: clip');
    expect(blocco).not.toMatch(/overflow:\s*hidden/);
  });
});
