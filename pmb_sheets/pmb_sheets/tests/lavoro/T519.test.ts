import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import '../../src/components/filtro-colonna';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { cellKey } from '../../src/sheet/styles';
import { dateToSerial } from '../../src/sheet/number-format';
import { chiaveMese, filtroDaScelta, isRowVisible, raggruppaMesi, formatoMostraData, type ColumnFilter } from '../../src/sheet/filter';

describe('T519: filtri per colore e per mese (parte pura)', () => {
  it('il mese di una data seriale e i formati data', () => {
    expect(chiaveMese(dateToSerial(new Date(Date.UTC(2026, 10, 11))))).toBe('2026-11');
    expect(chiaveMese(dateToSerial(new Date(Date.UTC(2027, 0, 1))))).toBe('2027-01');
    expect(formatoMostraData('dd/mm/yyyy')).toBe(true);
    expect(formatoMostraData('0.00')).toBe(false);
    expect(formatoMostraData('"giorno"0')).toBe(false);
    expect(formatoMostraData(undefined)).toBe(false);
  });
  it('i mesi si raggruppano per anno in ordine e con i nomi italiani', () => {
    expect(raggruppaMesi(['2027-01', '2026-12', '2026-11', '', 'x'])).toEqual([
      { anno: '2026', mesi: [{ chiave: '2026-11', etichetta: 'novembre' }, { chiave: '2026-12', etichetta: 'dicembre' }] },
      { anno: '2027', mesi: [{ chiave: '2027-01', etichetta: 'gennaio' }] },
    ]);
  });
  it('una riga passa solo se sfondo, testo e mese sono ammessi', () => {
    const f: ColumnFilter = { col: 1, fillColors: new Set(['#ff0000']), months: new Set(['2026-11']) };
    const filtri = new Map([[1, f]]);
    const extra = {
      getFill: (r: number) => (r === 1 || r === 2 ? '#ff0000' : ''),
      getMonthKey: (r: number) => (r === 1 ? '2026-11' : '2026-12'),
    };
    expect([1, 2, 3].map((r) => isRowVisible(r, filtri, () => '', extra))).toEqual([true, false, false]);
  });
  it('filtroDaScelta: i colori tutti spuntati non servono, quelli tolti sì', () => {
    const t = ['', '#ff0000'];
    expect(filtroDaScelta(1, ['a'], new Set(['a']), undefined, { sfondo: { tutti: t, spuntati: new Set(t) } })).toBeNull();
    const f = filtroDaScelta(1, ['a'], new Set(['a']), undefined, { sfondo: { tutti: t, spuntati: new Set(['#ff0000']) } })!;
    expect([...f.fillColors!]).toEqual(['#ff0000']);
    expect(f.selectedValues).toBeUndefined();
  });
});

type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot; toggleFilter: () => void; undo: () => Promise<void>; redo: () => Promise<void> };
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Popup = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };
let griglia: Griglia;
let doc: SheetDocument;

const pausa = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const freccia = (col: number) => griglia.renderRoot.querySelector(`th.col-header[aria-colindex="${col + 1}"] .col-filter-btn`) as HTMLElement;
const popup = () => griglia.renderRoot.querySelector('free-filtro-colonna') as Popup | null;
async function apri(col: number): Promise<Popup> {
  freccia(col).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await griglia.updateComplete;
  const p = popup()!;
  await p.updateComplete;
  return p;
}
const azione = async (p: Popup, nome: string) => { (p.shadowRoot.querySelector(`button[data-azione="${nome}"]`) as HTMLButtonElement).click(); await pausa(60); await griglia.updateComplete; };
const spuntaSel = async (p: Popup, selettore: string, su: boolean) => {
  const c = p.shadowRoot.querySelector(selettore) as HTMLInputElement;
  c.checked = su;
  c.dispatchEvent(new Event('change', { bubbles: true }));
  await p.updateComplete;
};
const nascoste = () => [...doc.hiddenRows].sort((a, b) => a - b);
const colora = (r: number, c: number, patch: { fill?: string; color?: string; numFmt?: string }) => {
  const k = cellKey(r, c);
  doc.styles.cellStyles.set(k, doc.styles.registry.merge(doc.styles.cellStyles.get(k) || 0, patch));
};
const valoreCol = (c: number) => Promise.all([2, 3, 4, 5, 6, 7].map(async (r) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw));

// A: nome, B: numero, C: data; la riga 1 è l'intestazione
const serial = (a: number, m: number, g: number) => String(dateToSerial(new Date(Date.UTC(a, m - 1, g))));
const DATI: Array<[string, string, string]> = [
  ['Nome', 'Numero', 'Data'],
  ['a', '5', serial(2026, 11, 3)], ['b', '12', serial(2026, 12, 20)], ['c', '7', serial(2027, 1, 5)], ['d', '30', 'testo'], ['e', '1', ''], ['f', '18', serial(2026, 11, 28)],
];

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  const app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
  for (let i = 0; i < DATI.length; i++) for (let c = 0; c < 3; c++) await doc.client.setCell(doc.activeSheetName, i + 1, c + 1, DATI[i][c]);
  for (const r of [2, 3, 4, 7]) colora(r, 3, { numFmt: 'dd/mm/yyyy' });
  (griglia as unknown as { cellsCache: Map<string, unknown> }).cellsCache.clear();
  griglia.toggleFilter();
  await griglia.updateComplete;
});

describe('T519: filtro per colore di sfondo', () => {
  it('la lista dei colori compare solo se ce n\'è più di uno e il filtro tiene le righe col colore scelto', async () => {
    let p = await apri(1);
    expect(p.shadowRoot.querySelector('[data-campo="colori-sfondo"]')).toBeNull();
    await azione(p, 'chiudi');
    colora(2, 1, { fill: '#ff0000' }); colora(4, 1, { fill: '#ff0000' }); colora(3, 1, { fill: '#00ff00' });
    p = await apri(1);
    const colori = Array.from(p.shadowRoot.querySelectorAll('[data-campo="colori-sfondo"] input')).map((i) => (i as HTMLInputElement).dataset.colore);
    expect(colori.sort()).toEqual(['', '#00ff00', '#ff0000']);
    await spuntaSel(p, 'input[data-colore=""]', false);
    await spuntaSel(p, 'input[data-colore="#00ff00"]', false);
    await azione(p, 'applica');
    expect(nascoste()).toEqual([3, 5, 6, 7]);
    expect([...doc.activeFilters.get(1)!.fillColors!]).toEqual(['#ff0000']);
    await griglia.undo();
    expect(nascoste()).toEqual([]);
  });
});

describe('T519: ordinamento dalla finestra del filtro', () => {
  it('Z → A ordina i dati senza muovere l\'intestazione, il formato segue la riga e Annulla rimette tutto', async () => {
    colora(2, 1, { fill: '#ff0000' }); // la riga col numero 5
    const p = await apri(2);
    await azione(p, 'ordina-za');
    expect(await valoreCol(2)).toEqual(['30', '18', '12', '7', '5', '1']);
    expect((await doc.client.getCell(doc.activeSheetName, 1, 2)).raw).toBe('Numero');
    expect(doc.styles.cellStyles.get(cellKey(6, 1))).toBeDefined();   // il rosso è andato con la riga del 5 (ora riga 6)
    expect(doc.styles.cellStyles.get(cellKey(2, 1))).toBeUndefined();
    await griglia.undo();
    expect(await valoreCol(2)).toEqual(['5', '12', '7', '30', '1', '18']);
    expect(doc.styles.cellStyles.get(cellKey(2, 1))).toBeDefined();
    expect(doc.styles.cellStyles.get(cellKey(6, 1))).toBeUndefined();
  });
  it('A → Z ordina i numeri in modo crescente', async () => {
    const p = await apri(2);
    await azione(p, 'ordina-az');
    expect(await valoreCol(2)).toEqual(['1', '5', '7', '12', '18', '30']);
  });
});

describe('T519: filtro per data (anno e mese)', () => {
  it('l\'elenco è raggruppato per anno e togliere un mese nasconde le sue righe', async () => {
    const p = await apri(3);
    const anni = Array.from(p.shadowRoot.querySelectorAll('[data-campo="mesi"] input[data-anno]')).map((i) => (i as HTMLInputElement).dataset.anno);
    expect(anni).toEqual(['2026', '2027']);
    const mesi = Array.from(p.shadowRoot.querySelectorAll('[data-campo="mesi"] input[data-mese]')).map((i) => (i as HTMLInputElement).dataset.mese);
    expect(mesi).toEqual(['2026-11', '2026-12', '2027-01', '']);
    await spuntaSel(p, 'input[data-mese="2026-12"]', false);
    await azione(p, 'applica');
    expect(nascoste()).toEqual([3]);   // solo la data di dicembre; testo e cella vuota restano
  });
  it('togliere un anno intero toglie tutti i suoi mesi', async () => {
    const p = await apri(3);
    await spuntaSel(p, 'input[data-anno="2026"]', false);
    await azione(p, 'applica');
    expect(nascoste()).toEqual([2, 3, 7]);
    expect(p.shadowRoot.querySelector('input[data-mese="2026-11"]')).not.toBeNull();
  });
  it('una colonna senza date non offre l\'elenco dei mesi e non si filtra per data', async () => {
    const p = await apri(1);
    expect(p.shadowRoot.querySelector('[data-campo="mesi"]')).toBeNull();
    await azione(p, 'applica');
    expect(nascoste()).toEqual([]);
  });
});
