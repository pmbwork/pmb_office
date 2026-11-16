import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, DocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { areaFiltroValida, fineAreaFiltro, regioneCorrente, vistePulite } from '../../src/sheet/filter';
import { datiAStato, statoADati, statoVuoto } from '../../src/sheet/stato-fogli';
import { applicaDati, estraiDati } from '../../src/formati/documento';
import { esporta, importa } from '../../src/formati/file';

const A = (r1: number, r2: number, c1: number, c2: number) => ({ startRow: r1, endRow: r2, startCol: c1, endCol: c2 });

describe('T525: la tabella intorno alla cella (parte pura)', () => {
  // celle piene: B4:C6 e D7 (attaccata in diagonale), poi un blocco separato in B10
  const piene = new Set(['4:2', '4:3', '5:2', '5:3', '6:2', '6:3', '7:4', '10:2']);
  const piena = (r: number, c: number) => piene.has(`${r}:${c}`);
  it('si allarga finché sul bordo c\'è una cella piena, anche in diagonale', () => {
    expect(regioneCorrente(5, 2, piena, 10, 4)).toEqual(A(4, 7, 2, 4));
    expect(regioneCorrente(4, 3, piena, 10, 4)).toEqual(A(4, 7, 2, 4));
  });
  it('un blocco separato da una riga vuota resta fuori', () => {
    expect(regioneCorrente(10, 2, piena, 10, 4)).toEqual(A(10, 10, 2, 2));
  });
  it('una cella vuota senza niente intorno: null; una cella vuota accanto alla tabella: la tabella', () => {
    expect(regioneCorrente(1, 1, piena, 10, 4)).toBeNull();
    expect(regioneCorrente(3, 2, piena, 10, 4)).toEqual(A(3, 7, 2, 4));
  });
  it('le righe scritte subito sotto entrano nel filtro, quelle dopo una riga vuota no', () => {
    const p = new Set(['5:2', '6:3', '8:2']);
    expect(fineAreaFiltro(A(1, 4, 2, 3), (r, c) => p.has(`${r}:${c}`), 20)).toBe(6);
  });
  it('un\'area letta da un file si controlla', () => {
    expect(areaFiltroValida({ startRow: 4, endRow: 9, startCol: 2, endCol: 3 })).toEqual(A(4, 9, 2, 3));
    expect(areaFiltroValida({ startRow: 4, endRow: 2, startCol: 2, endCol: 3 })).toBeUndefined();
    expect(areaFiltroValida({ startRow: 0, endRow: 2, startCol: 1, endCol: 1 })).toBeUndefined();
    expect(areaFiltroValida('x')).toBeUndefined();
  });
  it('lo stato di un foglio e le viste conservano l\'area', () => {
    const s = statoVuoto();
    s.filterArea = A(4, 9, 2, 3);
    s.isFilterActive = true;
    expect(datiAStato(JSON.parse(JSON.stringify(statoADati(s)))).filterArea).toEqual(A(4, 9, 2, 3));
    expect(vistePulite([{ id: 'v', nome: 'x', filtri: [{ col: 2 }], area: A(4, 9, 2, 3) }])[0].area).toEqual(A(4, 9, 2, 3));
  });
});

// ---- nella griglia ----
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot;
  toggleFilter: () => void; clearFilters: () => void; undo: () => Promise<void>; insertRowsAbove: () => Promise<void>;
  applicaFiltroColonna: (col: number, spuntati: readonly string[]) => void; ordinaColonnaDelFiltro: (col: number, asc: boolean) => Promise<void>;
  filtraPerValoreDiCella: () => void; salvaVistaFiltro: (n: string) => string | null; applicaVistaFiltro: (id: string) => boolean;
  visteFiltro: () => Array<{ id: string; area?: unknown }>; requestUpdate: () => void;
};
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
let griglia: Griglia;
let doc: SheetDocument;

// riga 1: un titolo; riga 2 vuota; tabella B4:C9 (intestazione in riga 4); riga 10 vuota; un altro blocco in B11
const TABELLA: Array<[number, number, string]> = [
  [1, 1, 'Spese di novembre'],
  [4, 2, 'Voce'], [4, 3, 'Importo'],
  [5, 2, 'affitto'], [5, 3, '700'], [6, 2, 'luce'], [6, 3, '60'], [7, 2, 'gas'], [7, 3, '45'], [8, 2, 'luce'], [8, 3, '55'], [9, 2, 'acqua'], [9, 3, '20'],
  [11, 2, 'note'],
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
  for (const [r, c, v] of TABELLA) await doc.client.setCell(doc.activeSheetName, r, c, v);
});
const sel = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc.selection = { anchor: { row: r1, col: c1 }, active: { row: r2, col: c2 }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 } }; };
const nascoste = () => [...doc.hiddenRows].sort((a, b) => a - b);
const raw = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw;
const frecce = async () => { griglia.requestUpdate(); await griglia.updateComplete; return Array.from(griglia.renderRoot.querySelectorAll('th.col-header')).filter((th) => th.querySelector('.col-filter-btn')).map((th) => Number(th.getAttribute('aria-colindex')) - 1); };

describe('T525: il filtro su una tabella che non parte dalla riga 1', () => {
  it('Crea un filtro da una cella della tabella prende la tabella intorno; le frecce sono solo sulle sue colonne', async () => {
    sel(6, 2);
    griglia.toggleFilter();
    expect(doc.filterArea).toEqual(A(4, 9, 2, 3));
    expect(await frecce()).toEqual([2, 3]);
  });
  it('filtrare nasconde solo righe della tabella: il titolo, l\'intestazione e il blocco sotto restano', async () => {
    sel(6, 2);
    griglia.toggleFilter();
    griglia.applicaFiltroColonna(2, ['luce']);
    expect(nascoste()).toEqual([5, 7, 9]);
  });
  it('ordinare dalla finestra muove solo le righe della tabella sotto l\'intestazione', async () => {
    sel(6, 2);
    griglia.toggleFilter();
    await griglia.ordinaColonnaDelFiltro(2, true);
    expect(await Promise.all([5, 6, 7, 8, 9].map((r) => raw(r, 2)))).toEqual(['acqua', 'affitto', 'gas', 'luce', 'luce']);
    expect([await raw(1, 1), await raw(4, 2), await raw(11, 2)]).toEqual(['Spese di novembre', 'Voce', 'note']);
  });
  it('una riga scritta subito sotto la tabella entra nel filtro', async () => {
    sel(6, 2);
    griglia.toggleFilter();
    await doc.client.setCell(doc.activeSheetName, 10, 2, 'telefono');
    griglia.applicaFiltroColonna(2, ['luce']);
    expect(nascoste()).toEqual([5, 7, 9, 10, 11]);   // la riga 10 ora è attaccata, e con lei la 11 (attaccata alla 10): entrano tutte e due
  });
  it('con un intervallo selezionato il filtro lavora su quello', async () => {
    sel(4, 2, 7, 3);
    griglia.toggleFilter();
    expect(doc.filterArea).toEqual(A(4, 7, 2, 3));
  });
  it('Filtra per il valore della cella accende il filtro sulla tabella intorno', async () => {
    sel(6, 2);
    griglia.filtraPerValoreDiCella();
    expect(doc.filterArea).toEqual(A(4, 9, 2, 3));
    expect(nascoste()).toEqual([5, 7, 9]);
  });
  it('Rimuovi filtri toglie anche l\'area; Annulla la rimette', async () => {
    sel(6, 2);
    griglia.toggleFilter();
    griglia.clearFilters();
    expect(doc.filterArea).toBeUndefined();
    await griglia.undo();
    expect(doc.filterArea).toEqual(A(4, 9, 2, 3));
  });
  it('inserire una riga sopra sposta l\'area', async () => {
    sel(6, 2);
    griglia.toggleFilter();
    sel(1, 1);
    await griglia.insertRowsAbove();
    expect(doc.filterArea).toEqual(A(5, 10, 2, 3));
  });
  it('le viste ricordano l\'area', async () => {
    sel(6, 2);
    griglia.toggleFilter();
    griglia.applicaFiltroColonna(2, ['luce']);
    expect(griglia.salvaVistaFiltro('Luce')).toBeNull();
    expect(griglia.visteFiltro()[0].area).toEqual(A(4, 9, 2, 3));
    griglia.clearFilters();
    griglia.applicaVistaFiltro(griglia.visteFiltro()[0].id);
    expect(doc.filterArea).toEqual(A(4, 9, 2, 3));
    expect(nascoste()).toEqual([5, 7, 9]);
  });
});

describe('T525: salvare e riaprire un .psheet con il filtro su una tabella', () => {
  it('l\'area torna uguale', async () => {
    const S = new DocumentStore();
    const d = S.getOrCreateDocument('a');
    await d.client.setCell(d.activeSheetName, 4, 2, 'x');
    d.isFilterActive = true;
    d.filterArea = A(4, 9, 2, 3);
    const { dati } = await importa(await esporta(await estraiDati(d), 'fsheet'), 'prova.psheet');
    const d2 = new DocumentStore().getOrCreateDocument('b');
    await applicaDati(d2, dati);
    expect(d2.filterArea).toEqual(A(4, 9, 2, 3));
  });
});
