import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import '../../src/components/filtro-colonna';
import '../../src/components/dialogo-viste-filtro';
import { descriviVista } from '../../src/components/dialogo-viste-filtro';
import { defaultDocumentStore, DocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { cellKey } from '../../src/sheet/styles';
import { copiaFiltro, filtriDaJson, filtroDaJson, filtroInJson, ordinePerColore, vistePulite, isRowVisible, type ColumnFilter } from '../../src/sheet/filter';
import { datiAStato, statoADati, statoVuoto } from '../../src/sheet/stato-fogli';
import { applicaDati, estraiDati } from '../../src/formati/documento';
import { esporta, importa } from '../../src/formati/file';

const pieno: ColumnFilter = {
  col: 2, selectedValues: new Set(['a', 'b']), condition: { operator: 'greater_than', value1: 3 },
  fillColors: new Set(['#ff0000', '']), textColors: new Set(['#0000ff']), months: new Set(['2026-11']),
};

describe('T522: filtri in JSON (il difetto: i colori e i mesi si perdevano salvando)', () => {
  it('andata e ritorno con tutti gli insiemi, anche passando da una stringa JSON', () => {
    const j = JSON.parse(JSON.stringify(filtroInJson(pieno)));
    expect(j.fillColors).toEqual(['#ff0000', '']);
    expect(j.months).toEqual(['2026-11']);
    const f = filtroDaJson(j)!;
    expect(f).toEqual(pieno);
    expect(f.fillColors).toBeInstanceOf(Set);
  });
  it('un file scritto male non rompe niente: un insieme che non è un elenco si ignora, una colonna non valida si scarta', () => {
    const f = filtroDaJson({ col: 1, fillColors: {}, selectedValues: ['x', 3] })!;
    expect(f.fillColors).toBeUndefined();
    expect([...f.selectedValues!]).toEqual(['x']);
    expect(isRowVisible(2, new Map([[1, f]]), () => 'x', { getFill: () => '' })).toBe(true);
    expect(filtroDaJson({ col: 0 })).toBeNull();
    expect(filtroDaJson('x')).toBeNull();
    expect([...filtriDaJson([{ col: 3 }, null, { col: 'a' }]).keys()]).toEqual([3]);
  });
  it('copiaFiltro dà insiemi nuovi', () => {
    const c = copiaFiltro(pieno);
    expect(c).toEqual(pieno);
    expect(c.fillColors).not.toBe(pieno.fillColors);
  });
  it('lo stato di un foglio non attivo conserva i colori del filtro e le viste', () => {
    const s = statoVuoto();
    s.activeFilters.set(2, pieno);
    s.isFilterActive = true;
    s.visteFiltro = [{ id: 'v1', nome: 'Rossi', filtri: [filtroInJson(pieno)] }];
    const dopo = datiAStato(JSON.parse(JSON.stringify(statoADati(s))));
    expect(dopo.activeFilters.get(2)).toEqual(pieno);
    expect(dopo.visteFiltro).toEqual(s.visteFiltro);
  });
  it('vistePulite tiene solo le viste ben formate', () => {
    expect(vistePulite([{ id: 'a', nome: ' X ', filtri: [{ col: 1 }] }, { nome: '', filtri: [{ col: 1 }] }, { nome: 'senza filtri', filtri: [] }, 5]))
      .toEqual([{ id: 'a', nome: 'X', filtri: [{ col: 1 }] }]);
    expect(vistePulite(undefined)).toEqual([]);
  });
});

describe('T522: salvare e riaprire un .psheet con un filtro per colore e una vista', () => {
  it('il filtro per colore e le viste tornano uguali', async () => {
    const A = new DocumentStore();
    const doc = A.getOrCreateDocument('a');
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    doc.activeFilters.set(2, pieno);
    doc.isFilterActive = true;
    doc.visteFiltro = [{ id: 'v1', nome: 'Rossi', filtri: [filtroInJson(pieno)] }];
    const bytes = await esporta(await estraiDati(doc), 'fsheet');
    const { dati } = await importa(bytes, 'prova.psheet');
    const B = new DocumentStore();
    const doc2 = B.getOrCreateDocument('b');
    await applicaDati(doc2, dati);
    expect(doc2.activeFilters.get(2)).toEqual(pieno);
    expect(doc2.visteFiltro).toEqual(doc.visteFiltro);
  });
});

describe('T522: ordine per colore (parte pura)', () => {
  it('le righe col colore vanno in cima, il resto segue, l\'ordine dentro i gruppi resta', () => {
    const rosse = new Set([3, 5]);
    expect(ordinePerColore(2, 6, (r) => rosse.has(r))).toEqual([
      { fromRow: 3, toRow: 2 }, { fromRow: 5, toRow: 3 }, { fromRow: 2, toRow: 4 }, { fromRow: 4, toRow: 5 }, { fromRow: 6, toRow: 6 },
    ]);
  });
});

// ---- nella griglia vera ----
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot; toggleFilter: () => void; undo: () => Promise<void>;
  applicaFiltroColonna: (col: number, spuntati: readonly string[], condizione?: unknown, colori?: { sfondo?: readonly string[] }) => void;
  salvaVistaFiltro: (nome: string) => string | null; applicaVistaFiltro: (id: string) => boolean; eliminaVistaFiltro: (id: string) => void;
  visteFiltro: () => Array<{ id: string; nome: string; filtri: unknown[] }>; clearFilters: () => void;
};
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Popup = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };
let app: App;
let griglia: Griglia;
let doc: SheetDocument;
const pausa = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const nascoste = () => [...doc.hiddenRows].sort((a, b) => a - b);
const colora = (r: number, c: number, fill: string) => { const k = cellKey(r, c); doc.styles.cellStyles.set(k, doc.styles.registry.merge(doc.styles.cellStyles.get(k) || 0, { fill })); };
const valori = (c: number) => Promise.all([2, 3, 4, 5, 6].map(async (r) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw));
const NOMI = ['Nome', 'a', 'b', 'c', 'd', 'e'];
const NUM = ['Numero', '1', '2', '3', '4', '5'];

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
  for (let i = 0; i < NOMI.length; i++) { await doc.client.setCell(doc.activeSheetName, i + 1, 1, NOMI[i]); await doc.client.setCell(doc.activeSheetName, i + 1, 2, NUM[i]); }
  colora(3, 1, '#ff0000'); colora(5, 1, '#ff0000'); colora(4, 1, '#00ff00');   // b e d rossi, c verde
  (griglia as unknown as { cellsCache: Map<string, unknown> }).cellsCache.clear();
  griglia.toggleFilter();
  await griglia.updateComplete;
});

async function apri(col: number): Promise<Popup> {
  (griglia.renderRoot.querySelector(`th.col-header[aria-colindex="${col + 1}"] .col-filter-btn`) as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await griglia.updateComplete;
  const p = griglia.renderRoot.querySelector('free-filtro-colonna') as Popup;
  await p.updateComplete;
  return p;
}

describe('T522: Ordina per colore dalla finestra del filtro', () => {
  it('i bottoni ci sono solo se la colonna ha più colori; un clic porta in cima le righe rosse e i formati seguono; Annulla rimette tutto', async () => {
    let p = await apri(2);
    expect(p.shadowRoot.querySelector('[data-campo="ordina-colore"]')).toBeNull();
    (p.shadowRoot.querySelector('button[data-azione="chiudi"]') as HTMLButtonElement).click();
    await griglia.updateComplete;
    p = await apri(1);
    const bottoni = Array.from(p.shadowRoot.querySelectorAll('button[data-azione="ordina-colore"]')) as HTMLButtonElement[];
    expect(bottoni.map((b) => b.dataset.colore).sort()).toEqual(['#00ff00', '#ff0000']);
    bottoni.find((b) => b.dataset.colore === '#ff0000')!.click();
    await pausa(80); await griglia.updateComplete;
    expect(griglia.renderRoot.querySelector('free-filtro-colonna')).toBeNull();
    expect(await valori(1)).toEqual(['b', 'd', 'a', 'c', 'e']);
    expect(await valori(2)).toEqual(['2', '4', '1', '3', '5']);
    expect((await doc.client.getCell(doc.activeSheetName, 1, 1)).raw).toBe('Nome');
    const fill = (r: number) => doc.styles.registry.getStyle(doc.styles.cellStyles.get(cellKey(r, 1)) ?? 0)?.fill;
    expect([2, 3, 4, 5, 6].map(fill)).toEqual(['#ff0000', '#ff0000', undefined, '#00ff00', undefined]);
    await griglia.undo();
    expect(await valori(1)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(fill(3)).toBe('#ff0000');
  });
});

describe('T522: viste filtro nella griglia', () => {
  it('senza filtri o senza nome non si salva', () => {
    expect(griglia.salvaVistaFiltro('X')).toContain('Non ci sono filtri attivi');
    griglia.applicaFiltroColonna(1, NOMI.slice(1), undefined, { sfondo: ['#ff0000'] });
    expect(griglia.salvaVistaFiltro('   ')).toContain('nome');
    expect(griglia.salvaVistaFiltro('x'.repeat(61))).toContain('60');
    expect(griglia.visteFiltro()).toEqual([]);
  });
  it('salvo, tolgo i filtri, applico la vista: tornano le stesse righe nascoste; lo stesso nome aggiorna; elimina e Annulla', async () => {
    griglia.applicaFiltroColonna(1, NOMI.slice(1), undefined, { sfondo: ['#ff0000'] });
    expect(nascoste()).toEqual([2, 4, 6]);
    expect(griglia.salvaVistaFiltro('Rossi')).toBeNull();
    const [v] = griglia.visteFiltro();
    expect(v.nome).toBe('Rossi');
    griglia.clearFilters();
    expect(nascoste()).toEqual([]);
    expect(griglia.applicaVistaFiltro(v.id)).toBe(true);
    expect(doc.isFilterActive).toBe(true);
    expect(nascoste()).toEqual([2, 4, 6]);
    // lo stesso nome (anche con maiuscole diverse) aggiorna la vista, non ne crea un'altra
    griglia.applicaFiltroColonna(1, NOMI.slice(1), undefined, { sfondo: ['#00ff00'] });
    expect(griglia.salvaVistaFiltro('rossi')).toBeNull();
    expect(griglia.visteFiltro()).toHaveLength(1);
    expect(griglia.visteFiltro()[0].id).toBe(v.id);
    griglia.eliminaVistaFiltro(v.id);
    expect(griglia.visteFiltro()).toEqual([]);
    await griglia.undo();
    expect(griglia.visteFiltro()).toHaveLength(1);
    expect(griglia.applicaVistaFiltro('non-esiste')).toBe(false);
  });
});

describe('T522: finestra Viste filtro', () => {
  it('Dati > Viste filtro... apre la finestra; Salva, Applica ed Elimina passano per la griglia', async () => {
    const dialogo = () => app.renderRoot.querySelector('free-dialogo-viste-filtro') as (HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }) | null;
    const azione = (a: string) => { (app as unknown as { handleMenuAction: (e: CustomEvent) => void }).handleMenuAction(new CustomEvent('menu-action', { detail: { action: a, label: '' } })); };
    azione('filter-views');
    await app.updateComplete;
    let d = dialogo()!;
    await d.updateComplete;
    expect(d.shadowRoot.querySelector('[data-vuoto]')).not.toBeNull();
    expect((d.shadowRoot.querySelector('button[data-azione="salva"]') as HTMLButtonElement).disabled).toBe(true);
    (d.shadowRoot.querySelector('button[data-azione="chiudi"]') as HTMLButtonElement).click();
    await app.updateComplete;
    expect(dialogo()).toBeNull();

    griglia.applicaFiltroColonna(1, NOMI.slice(1), undefined, { sfondo: ['#ff0000'] });
    azione('filter-views');
    await app.updateComplete;
    d = dialogo()!;
    await d.updateComplete;
    (d.shadowRoot.querySelector('[data-campo="nome"]') as HTMLInputElement).value = 'Rossi';
    (d.shadowRoot.querySelector('button[data-azione="salva"]') as HTMLButtonElement).click();
    await app.updateComplete; await d.updateComplete;
    expect(Array.from(d.shadowRoot.querySelectorAll('[data-elenco] .nome')).map((x) => x.textContent)).toEqual(['Rossi']);
    expect(d.shadowRoot.querySelector('[data-elenco] .dove')!.textContent).toBe('Colonna A');
    expect((d.shadowRoot.querySelector('[data-campo="nome"]') as HTMLInputElement).value).toBe('');

    griglia.clearFilters();
    (d.shadowRoot.querySelector('button[data-azione="applica"]') as HTMLButtonElement).click();
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    expect(nascoste()).toEqual([2, 4, 6]);

    azione('filter-views');
    await app.updateComplete;
    d = dialogo()!;
    await d.updateComplete;
    (d.shadowRoot.querySelector('button[data-azione="elimina"]') as HTMLButtonElement).click();
    await app.updateComplete; await d.updateComplete;
    expect(d.shadowRoot.querySelector('[data-vuoto]')).not.toBeNull();
  });
  it('descriviVista', () => {
    expect(descriviVista({ id: 'a', nome: 'x', filtri: [{ col: 2 }] })).toBe('Colonna B');
    expect(descriviVista({ id: 'a', nome: 'x', filtri: [{ col: 1 }, { col: 3 }, { col: 27 }] })).toBe('Colonne A, C e AA');
  });
});
