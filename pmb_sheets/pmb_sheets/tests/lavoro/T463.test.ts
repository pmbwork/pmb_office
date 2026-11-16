import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** il file noto al momento di ogni chiamata a salvaSuDisco (la destinazione poi viene riempita dalla finta finestra) */
const viste = vi.hoisted(() => [] as unknown[]);

vi.mock('../../src/formati/file-io', () => ({
  // come la vera: con un file già noto scrive lì, altrimenti "chiede" il nome e lascia nella destinazione il file scelto
  salvaSuDisco: vi.fn(async (_nome: string, _bytes: Uint8Array, _mime: string, d?: { maniglia?: unknown }) => {
    viste.push(d ? d.maniglia ?? null : 'nessuna-destinazione');
    if (d && !d.maniglia) d.maniglia = { createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
    return true;
  }),
  scegliFile: vi.fn(async () => null),
}));

import * as fileIo from '../../src/formati/file-io';
import '../../src/main';
import { Recupero, type Archivio } from '../../src/formati/recupero';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { applicaDati, estraiDati } from '../../src/formati/documento';

const salva = fileIo.salvaSuDisco as unknown as ReturnType<typeof vi.fn>;
const scegli = fileIo.scegliFile as unknown as ReturnType<typeof vi.fn>;

function archivioFinto(): Archivio {
  let contenuto: string | null = null;
  return { leggi: () => contenuto, scrivi: (t) => { contenuto = t; return true; }, cancella: () => { contenuto = null; } };
}

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode; recupero: Recupero; controllaRecupero(): Promise<void>; richiediChiusuraApp(): Promise<void> };
interface Dentro { tabs: Array<{ id: string; title: string }>; statusMessage: string; activeTabId: string }

const invoke = vi.fn(async (_cmd: string, _args?: unknown) => null);

async function avvia() {
  const app = document.createElement('free-app') as App;
  app.recupero = new Recupero(archivioFinto(), { ora: () => 5000 });
  document.body.appendChild(app);
  await app.updateComplete;
  return { app, dentro: app as unknown as Dentro };
}
async function nuovoFoglio(app: App, dentro: Dentro): Promise<SheetDocument> {
  await app.updateComplete;
  const doc = defaultDocumentStore.getOrCreateDocument(dentro.tabs.at(-1)!.id);
  await app.controllaRecupero(); // fissa com'è adesso: da qui in poi ogni cambiamento è una modifica
  return doc;
}
const modifica = (doc: SheetDocument) => doc.client.setCell('Foglio1', 1, 1, 'x');
const nuovo = (app: App) => comanda(app, 'new-sheet');
const comanda = (app: App, action: string) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label: action }, bubbles: true, composed: true }));
const dialogo = (app: App) => app.renderRoot.querySelector('free-dialogo-conferma') as (HTMLElement & { titolo: string; messaggio: string }) | null;
const scegliNelDialogo = (app: App, id: string) => (dialogo(app)!.shadowRoot!.querySelector(`button[data-scelta="${id}"]`) as HTMLButtonElement).click();
const chiamate = (cmd: string) => invoke.mock.calls.filter((c) => c[0] === cmd);

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  salva.mockClear();
  viste.length = 0;
  scegli.mockReset();
  scegli.mockImplementation(async () => null);
  invoke.mockClear();
  (window as unknown as { __TAURI__: unknown }).__TAURI__ = { core: { invoke }, event: { listen: vi.fn() } };
});
afterEach(() => { delete (window as unknown as { __TAURI__?: unknown }).__TAURI__; vi.restoreAllMocks(); localStorage.clear(); });

describe('T463: sostituire il file aperto (File > Nuovo) con modifiche non salvate', () => {
  it('un foglio non modificato viene sostituito subito, senza domande', async () => {
    const { app, dentro } = await avvia();
    await nuovoFoglio(app, dentro);
    nuovo(app);
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Nuovo foglio di calcolo'));
    expect(dialogo(app)).toBeNull();
  });

  it('un foglio modificato chiede cosa fare; Annulla lo lascia com\'è', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    nuovo(app);
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    expect(dialogo(app)!.titolo).toBe(`Salvare «${dentro.tabs[0].title}»?`);
    scegliNelDialogo(app, 'annulla');
    await app.updateComplete;
    expect(dialogo(app)).toBeNull();
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('x');
  });

  it('Esc equivale ad Annulla', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    nuovo(app);
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    dialogo(app)!.shadowRoot!.querySelector('.velo')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await app.updateComplete;
    expect(dialogo(app)).toBeNull();
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('x');
  });

  it('Non salvare sostituisce il foglio con uno vuoto', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    nuovo(app);
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    scegliNelDialogo(app, 'scarta');
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Nuovo foglio di calcolo'));
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('');
    expect(salva).not.toHaveBeenCalled();
  });

  it('Salva scrive il file e poi sostituisce; se il salvataggio viene annullato il foglio resta', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    salva.mockImplementationOnce(async () => false);
    nuovo(app);
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    scegliNelDialogo(app, 'salva');
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Salvataggio annullato'));
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('x');
    nuovo(app);
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    scegliNelDialogo(app, 'salva');
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Nuovo foglio di calcolo'));
    expect(salva).toHaveBeenCalledTimes(2);
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('');
  });

  it('dopo aver salvato il foglio non conta più come modificato', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    comanda(app, 'save-file');
    await vi.waitFor(() => expect(dentro.statusMessage).toContain('Salvato "'));
    nuovo(app);
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Nuovo foglio di calcolo'));
    expect(dialogo(app)).toBeNull();
  });

  it('Apri su un foglio modificato chiede conferma prima di sostituirlo', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    scegli.mockImplementationOnce(async () => new File(['a;b\n1;2'], 'conti.csv', { type: 'text/csv' }));
    comanda(app, 'open-file');
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    scegliNelDialogo(app, 'annulla');
    await app.updateComplete;
    expect(dentro.statusMessage).not.toContain('Aperto');
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('x');
  });
});

describe('T463: le schede in alto sono i fogli del file', () => {
  const schede = (app: App) => Array.from((app.renderRoot.querySelector('free-tabs') as HTMLElement).shadowRoot!.querySelectorAll('.tab-item')).map((x) => x.textContent!.trim());
  const sulleSchede = (app: App, tipo: string, detail: unknown) => app.renderRoot.querySelector('free-tabs')!.dispatchEvent(new CustomEvent(tipo, { detail, bubbles: true, composed: true }));

  it('mostrano i fogli del file; "+" ne aggiunge uno; il clic cambia foglio', async () => {
    const { app, dentro } = await avvia();
    await vi.waitFor(() => expect(schede(app)).toEqual(['Foglio1']));
    sulleSchede(app, 'tab-created', undefined);
    await vi.waitFor(async () => { await app.updateComplete; expect(schede(app)).toEqual(['Foglio1', 'Foglio2']); });
    sulleSchede(app, 'tab-selected', { id: 'Foglio1' });
    await vi.waitFor(() => expect((dentro as unknown as { foglioAttivo: string }).foglioAttivo).toBe('Foglio1'));
    expect(dentro.tabs).toHaveLength(1); // un solo file
  });

  it('la X elimina il foglio: con dati chiede conferma', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    sulleSchede(app, 'tab-created', undefined);
    await vi.waitFor(() => expect((dentro as unknown as { fogli: string[] }).fogli).toEqual(['Foglio1', 'Foglio2']));
    await doc.client.setCell('Foglio2', 1, 1, 'dati');
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(false);
    sulleSchede(app, 'tab-closed', { id: 'Foglio2' });
    await vi.waitFor(() => expect(conferma).toHaveBeenCalledTimes(1));
    expect((dentro as unknown as { fogli: string[] }).fogli).toEqual(['Foglio1', 'Foglio2']);
    conferma.mockReturnValue(true);
    sulleSchede(app, 'tab-closed', { id: 'Foglio2' });
    await vi.waitFor(() => expect((dentro as unknown as { fogli: string[] }).fogli).toEqual(['Foglio1']));
  });

  it('il doppio clic rinomina il foglio e il trascinamento ne cambia l\'ordine', async () => {
    const { app, dentro } = await avvia();
    await nuovoFoglio(app, dentro);
    sulleSchede(app, 'tab-created', undefined);
    await vi.waitFor(() => expect((dentro as unknown as { fogli: string[] }).fogli).toEqual(['Foglio1', 'Foglio2']));
    vi.spyOn(window, 'prompt').mockReturnValue('Vendite');
    sulleSchede(app, 'tab-rename', { id: 'Foglio2' });
    await vi.waitFor(() => expect((dentro as unknown as { fogli: string[] }).fogli).toEqual(['Foglio1', 'Vendite']));
    sulleSchede(app, 'tab-moved', { da: 1, a: 0 });
    await vi.waitFor(() => expect((dentro as unknown as { fogli: string[] }).fogli).toEqual(['Vendite', 'Foglio1']));
  });
});

describe('T463: Salva riscrive il file aperto', () => {
  const apriCsv = async (app: App, dentro: Dentro, maniglia: unknown) => {
    const file = Object.assign(new File(['a;b\n1;2'], 'conti.csv', { type: 'text/csv' }), { maniglia });
    scegli.mockImplementationOnce(async () => file);
    comanda(app, 'open-file');
    await vi.waitFor(() => expect(dentro.statusMessage).toContain('Aperto "conti.csv"'));
  };

  it('un file aperto si risalva nello stesso file e nello stesso formato, senza chiedere il nome', async () => {
    const { app, dentro } = await avvia();
    const maniglia = { createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
    await apriCsv(app, dentro, maniglia);
    comanda(app, 'save-file');
    await vi.waitFor(() => expect(salva).toHaveBeenCalledTimes(1));
    const [nome, , mime, destinazione] = salva.mock.calls[0];
    expect(nome).toBe('conti.csv');
    expect(mime).toBe('text/csv');
    expect(destinazione.maniglia).toBe(maniglia);
  });

  it('Salva con nome chiede sempre il nome e poi ricorda il nuovo file', async () => {
    const { app, dentro } = await avvia();
    const maniglia = { createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
    await apriCsv(app, dentro, maniglia);
    comanda(app, 'save-as-file');
    await vi.waitFor(() => expect(salva).toHaveBeenCalledTimes(1));
    expect(viste[0]).toBeNull(); // nessun file noto: apre la finestra "Salva con nome"
  });

  it('un foglio nuovo: la prima volta chiede il nome (Excel), la seconda riscrive lo stesso file', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    comanda(app, 'save-file');
    await vi.waitFor(() => expect(salva).toHaveBeenCalledTimes(1));
    expect(salva.mock.calls[0][0]).toMatch(/\.xlsx$/);
    const maniglia = salva.mock.calls[0][3].maniglia; // lasciata dalla finestra "Salva con nome"
    expect(maniglia).toBeTruthy();
    await vi.waitFor(() => expect(dentro.statusMessage).toContain('Salvato "'));
    await doc.client.setCell('Foglio1', 2, 1, 'y');
    comanda(app, 'save-file');
    await vi.waitFor(() => expect(salva).toHaveBeenCalledTimes(2));
    expect(salva.mock.calls[1][3].maniglia).toBe(maniglia);
    expect(salva.mock.calls[1][0]).toMatch(/\.xlsx$/);
  });

  it('Scarica come… esporta una copia e non cambia il file del foglio né lo segna come salvato', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    comanda(app, 'download-csv');
    await vi.waitFor(() => expect(dentro.statusMessage).toContain('Esportato "'));
    expect(salva.mock.calls[0]).toHaveLength(3); // nessuna destinazione: è solo una copia
    nuovo(app);
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull()); // è ancora non salvato
    scegliNelDialogo(app, 'annulla');
  });
});

describe('T463: chiudere la finestra', () => {
  it('senza modifiche chiude subito', async () => {
    const { app } = await avvia();
    await app.controllaRecupero();
    await app.richiediChiusuraApp();
    expect(dialogo(app)).toBeNull();
    expect(chiamate('destroy_window')).toHaveLength(1);
  });

  it('con modifiche non salvate elenca i fogli; Annulla non chiude, Esci senza salvare chiude', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    const titolo = dentro.tabs.at(-1)!.title;
    const richiesta = app.richiediChiusuraApp();
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    expect(dialogo(app)!.messaggio).toContain(`«${titolo}»`);
    scegliNelDialogo(app, 'annulla');
    await richiesta;
    expect(chiamate('destroy_window')).toHaveLength(0);

    const seconda = app.richiediChiusuraApp();
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    scegliNelDialogo(app, 'esci');
    await seconda;
    expect(chiamate('destroy_window')).toHaveLength(1);
  });

  it('all\'avvio chiede alla shell di lasciare la decisione alla pagina, e l\'evento "chiusura-richiesta" è ascoltato', async () => {
    await avvia();
    expect(chiamate('proteggi_chiusura')[0][1]).toEqual({ attiva: true });
    window.dispatchEvent(new CustomEvent('chiusura-richiesta')); // la shell lo manda quando la finestra viene chiusa dal sistema
    await vi.waitFor(() => expect(chiamate('destroy_window')).toHaveLength(1));
  });

  it('la X della barra del titolo e File > Esci passano dallo stesso controllo', async () => {
    const { app, dentro } = await avvia();
    const doc = await nuovoFoglio(app, dentro);
    await modifica(doc);
    comanda(app, 'exit-app');
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    scegliNelDialogo(app, 'annulla');
    await app.updateComplete;
    app.renderRoot.querySelector('free-titlebar')?.dispatchEvent(new CustomEvent('window-close', { bubbles: true, composed: true }));
    await vi.waitFor(() => expect(dialogo(app)).not.toBeNull());
    expect(chiamate('destroy_window')).toHaveLength(0);
    expect(chiamate('close_window')).toHaveLength(0);
  });
});

describe('T463: il file nativo conserva righe e colonne nascoste, filtri, grafici e pivot', () => {
  it('estratti e rimessi in un altro documento tornano uguali', async () => {
    const origine = defaultDocumentStore.getOrCreateDocument('T463-origine');
    origine.hiddenRows = new Set([4, 2]);
    origine.hiddenCols = new Set([3]);
    origine.isFilterActive = true;
    origine.activeFilters = new Map([[1, { col: 1, selectedValues: new Set(['a', 'b']) }]]);
    origine.charts = [{ id: 'g1', title: 'G', type: 'bar', sheetName: 'Foglio1', dataRange: 'A1:B3', x: 1, y: 2, width: 3, height: 4, showLegend: true, showLabels: false, categories: [], series: [] }] as never;
    origine.pivots = [{ id: 'p1', name: 'P', sourceSheet: 'Foglio1', sourceRange: 'A1:B3', rowFields: [], colFields: [], valueFields: [], filters: [], showGrandTotals: true, showSubtotals: false }] as never;
    const dati = await estraiDati(origine);
    expect(dati.hiddenRows).toEqual([2, 4]);
    expect(dati.hiddenCols).toEqual([3]);

    const copia = defaultDocumentStore.getOrCreateDocument('T463-copia');
    await applicaDati(copia, JSON.parse(JSON.stringify(dati)));
    expect([...copia.hiddenRows]).toEqual([2, 4]);
    expect([...copia.hiddenCols]).toEqual([3]);
    expect(copia.isFilterActive).toBe(true);
    expect([...copia.activeFilters.get(1)!.selectedValues!]).toEqual(['a', 'b']);
    expect(copia.charts.map((c) => c.id)).toEqual(['g1']);
    expect(copia.pivots.map((p) => p.id)).toEqual(['p1']);
  });

  it('un file nativo vecchio, senza questi campi, si apre come prima', async () => {
    const vuoto = await estraiDati(defaultDocumentStore.getOrCreateDocument('T463-vuoto'));
    const vecchio = { ...vuoto } as Record<string, unknown>;
    for (const k of ['hiddenRows', 'hiddenCols', 'filters', 'charts', 'pivots']) delete vecchio[k];
    const doc = defaultDocumentStore.getOrCreateDocument('T463-vecchio');
    await applicaDati(doc, vecchio as never);
    expect(doc.hiddenRows.size).toBe(0);
    expect(doc.isFilterActive).toBe(false);
    expect(doc.charts).toEqual([]);
  });
});
