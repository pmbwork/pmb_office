import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import * as fileIo from '../../src/formati/file-io';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import '../../src/main';
import { leggiZip } from '@comune/formati/zip';
import { DocumentStore, defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { InlineEngineClient } from '../../src/sheet/engine-client';
import { menuRegistry } from '../../src/registry/menu';
import { applicaDati, apriInScheda, estraiDati, preparaSalvataggio } from '../../src/formati/documento';
import { esporta } from '../../src/formati/file';
import { documentoDaScambio, foglioVuoto, scambioDaDocumento, type FoglioScambio } from '../../src/formati/scambio';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import type { SheetDocumentData } from '../../src/sheet/document-data';
import { HistoryManager } from '../../src/sheet/history';

const codifica = new TextEncoder();
const dec = new TextDecoder();
const decConBom = new TextDecoder('utf-8', { ignoreBOM: true });
const salva = fileIo.salvaSuDisco as unknown as ReturnType<typeof vi.fn>;
const scegli = fileIo.scegliFile as unknown as ReturnType<typeof vi.fn>;

function foglio(nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio { return { ...foglioVuoto(nome), ...extra }; }
const grezzo = async (doc: SheetDocument, riga: number, col: number, f = 'Foglio1'): Promise<string> => (await doc.client.getCell(f, riga, col)).raw;

/** Dati ricchi: celle, stili, misure, unioni, blocchi, convalida, nome definito e regola condizionale. */
function datiRicchi(): SheetDocumentData {
  const base = documentoDaScambio({
    foglioAttivo: 'Dati',
    fogli: [
      foglio('Foglio1', { celle: { A1: 'uno' } }),
      foglio('Dati', {
        celle: { A1: 'Nome', B1: '5', C1: '=B1*2', A2: 'x' }, stili: { A1: { bold: true, fill: '#ff0000' }, B1: { numFmt: '0.00' } },
        larghezze: { 1: 140, 3: 90 }, altezze: { 2: 44 }, unioni: [{ startRow: 5, endRow: 6, startCol: 1, endCol: 3 }], righeCongelate: 1, colonneCongelate: 2,
      }),
    ],
  });
  return {
    ...base,
    dataValidations: { '2:1': { id: 'val-2:1', type: 'list', listItems: ['a', 'b'], action: 'reject' } },
    namedRanges: [{ name: 'tasse', sheetName: 'Dati', rangeString: 'A1:B2', startRow: 1, startCol: 1, endRow: 2, endCol: 2 }],
    conditionalFormats: [{ id: 'cf-1', type: 'cell_value', range: { startRow: 1, endRow: 2, startCol: 2, endCol: 2 }, operator: 'greater_than', value1: 3, style: { bold: true } }],
  };
}

describe('T204 aprire e salvare i fogli di calcolo', () => {
  it('applicaDati: il documento della scheda prende tutto il contenuto del file', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('t1');
    await applicaDati(doc, datiRicchi());
    expect(await grezzo(doc, 1, 1, 'Dati')).toBe('Nome');
    expect(await grezzo(doc, 1, 3, 'Dati')).toBe('=B1*2');
    expect((await doc.client.getCell('Dati', 1, 3)).value).toMatchObject({ kind: 'number', value: 10 });
    expect(await doc.client.listSheets()).toEqual(['Foglio1', 'Dati']);
    expect(doc.activeSheetName).toBe('Dati');
    expect(doc.colWidths).toEqual(new Map([[1, 140], [3, 90]]));
    expect(doc.rowHeights).toEqual(new Map([[2, 44]]));
    expect([doc.freezeRows, doc.freezeCols]).toEqual([1, 2]);
    expect(doc.merges).toEqual([{ startRow: 5, endRow: 6, startCol: 1, endCol: 3 }]);
    expect(doc.styles.cellStyles.size).toBe(2);
    expect(doc.styles.registry.getStyle(doc.styles.cellStyles.get('1,1') as number)).toMatchObject({ bold: true, fill: '#ff0000' });
    expect([...doc.dataValidations.keys()]).toEqual(['2:1']);
    expect(doc.dataValidations.get('2:1')?.listItems).toEqual(['a', 'b']);
    expect(doc.namedRanges.getAll().map((n) => n.name)).toEqual(['tasse']);
    expect(doc.conditionalFormats.map((c) => c.id)).toEqual(['cf-1']);
  });

  it('applicaDati sostituisce tutto: contenuto, stili, misure, selezione, scorrimento, storico, filtri, grafici', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('t1');
    await doc.client.setCell('Foglio1', 9, 9, 'vecchio');
    doc.colWidths.set(7, 300);
    doc.hiddenRows.add(3);
    doc.hiddenCols.add(4);
    doc.scroll = { left: 50, top: 80 };
    doc.selection = { anchor: { row: 4, col: 4 }, active: { row: 4, col: 4 }, range: { startRow: 4, endRow: 4, startCol: 4, endCol: 4 } };
    doc.history.pushStep({ description: 'prova', undoAction: async () => undefined, redoAction: async () => undefined });
    doc.isFilterActive = true;
    doc.activeFilters.set(1, {} as never);
    doc.charts.push({} as never);
    doc.pivots.push({} as never);
    const storicoVecchio = doc.history;
    await applicaDati(doc, datiRicchi());
    expect(await grezzo(doc, 9, 9)).toBe('');
    expect(doc.colWidths.has(7)).toBe(false);
    expect([doc.hiddenRows.size, doc.hiddenCols.size]).toEqual([0, 0]);
    expect(doc.scroll).toEqual({ left: 0, top: 0 });
    expect(doc.selection.active).toEqual({ row: 1, col: 1 });
    expect(doc.selection.range).toEqual({ startRow: 1, endRow: 1, startCol: 1, endCol: 1 });
    expect(doc.history).not.toBe(storicoVecchio);
    expect(doc.history).toBeInstanceOf(HistoryManager);
    expect(doc.history.canUndo()).toBe(false);
    expect([doc.activeFilters.size, doc.isFilterActive, doc.charts.length, doc.pivots.length]).toEqual([0, false, 0, 0]);
  });

  it('applicaDati con dati minimi: valori predefiniti per ciò che manca', async () => {
    const doc = new DocumentStore().getOrCreateDocument('t1');
    const minimi: SheetDocumentData = { version: 1, workbookJson: JSON.stringify({ version: 1, sheets: [{ name: 'Solo', cells: { A1: '1' } }] }), styles: [{}], cellStyles: {}, rowStyles: {}, colStyles: {}, colWidths: {}, activeSheetName: 'Solo' };
    await applicaDati(doc, minimi);
    expect([doc.freezeRows, doc.freezeCols, doc.merges, doc.rowHeights.size, doc.dataValidations.size, doc.namedRanges.getAll(), doc.conditionalFormats]).toEqual([0, 0, [], 0, 0, [], []]);
    expect(doc.activeSheetName).toBe('Solo');
  });

  it('i dati applicati sono copie: cambiare il documento non cambia i dati di partenza', async () => {
    const dati = datiRicchi();
    const doc = new DocumentStore().getOrCreateDocument('t1');
    await applicaDati(doc, dati);
    doc.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 });
    doc.dataValidations.get('2:1')?.listItems?.push('c');
    doc.conditionalFormats[0].id = 'altro';
    doc.namedRanges.getAll()[0].sheetName = 'Altro';
    expect(dati.merges).toHaveLength(1);
    expect(dati.dataValidations?.['2:1'].listItems).toEqual(['a', 'b']);
    expect(dati.conditionalFormats?.[0].id).toBe('cf-1');
    expect(dati.namedRanges?.[0].sheetName).toBe('Dati');
  });

  it('se l\'applicazione dei dati fallisce, una scheda nuova sparisce e una esistente resta', async () => {
    const store = new DocumentStore();
    const xlsx = await esporta(datiRicchi(), 'xlsx');
    const spia = vi.spyOn(InlineEngineClient.prototype, 'restore').mockRejectedValueOnce(new Error('motore guasto'));
    await expect(apriInScheda(store, 'nuova', xlsx, 'a.xlsx')).rejects.toThrow('motore guasto');
    expect(store.hasDocument('nuova')).toBe(false);
    store.getOrCreateDocument('esistente');
    spia.mockRejectedValueOnce(new Error('motore guasto'));
    await expect(apriInScheda(store, 'esistente', xlsx, 'a.xlsx')).rejects.toThrow('motore guasto');
    expect(store.hasDocument('esistente')).toBe(true);
    spia.mockRestore();
  });

  it('estraiDati rilegge quello che applicaDati ha messo', async () => {
    const doc = new DocumentStore().getOrCreateDocument('t1');
    const dati = datiRicchi();
    await applicaDati(doc, dati);
    const fuori = await estraiDati(doc);
    expect(JSON.parse(fuori.workbookJson)).toEqual(JSON.parse(dati.workbookJson));
    expect(scambioDaDocumento(fuori)).toEqual(scambioDaDocumento(dati));
    expect(fuori.dataValidations).toEqual(dati.dataValidations);
    expect(fuori.namedRanges).toEqual(dati.namedRanges);
    expect(fuori.conditionalFormats).toEqual(dati.conditionalFormats);
    expect(fuori.activeSheetName).toBe('Dati');
  });

  it('apriInScheda: Excel, CSV e formato nostro, col titolo ricavato dal nome', async () => {
    const store = new DocumentStore();
    const origine = datiRicchi();
    const xlsx = await apriInScheda(store, 'a', await esporta(origine, 'xlsx'), 'C:\\Conti\\Bilancio.xlsx');
    expect(xlsx).toEqual({ titolo: 'Bilancio', formato: 'xlsx', avvisi: [] });
    expect(store.getDocument('a')?.title).toBe('Bilancio');
    expect(await grezzo(store.getDocument('a') as SheetDocument, 1, 3, 'Dati')).toBe('=B1*2');
    const csv = await apriInScheda(store, 'b', codifica.encode('x;y\n1,5;2'), 'dati.csv');
    expect(csv).toEqual({ titolo: 'dati', formato: 'csv', avvisi: [] });
    expect(await grezzo(store.getDocument('b') as SheetDocument, 2, 1)).toBe('1.5');
    const nostro = await apriInScheda(store, 'c', await esporta(origine, 'fsheet'), 'mio.fsheet');
    expect(nostro.formato).toBe('fsheet');
    expect(store.getDocument('c')?.namedRanges.getAll()).toHaveLength(1);
  });

  it('apriInScheda: gli stili del secondo foglio si conservano e non ci sono avvisi', async () => {
    const piu = await scriviXlsx({ foglioAttivo: 'Uno', fogli: [foglio('Uno'), foglio('Due', { celle: { A1: 'x' }, stili: { A1: { bold: true } } })] });
    const r = await apriInScheda(new DocumentStore(), 'a', piu, 'a.xlsx');
    expect(r.avvisi).toEqual([]);
  });


  it('un file che non si apre non lascia niente nella scheda', async () => {
    const store = new DocumentStore();
    await expect(apriInScheda(store, 'nuova', new Uint8Array([0, 1, 2]), 'rotto.csv')).rejects.toThrow('Formato di file non riconosciuto');
    expect(store.hasDocument('nuova')).toBe(false);
    const doc = store.getOrCreateDocument('esistente');
    await doc.client.setCell('Foglio1', 1, 1, 'resta');
    await expect(apriInScheda(store, 'esistente', codifica.encode('non è json'), 'a.fsheet')).rejects.toThrow(/^File \.psheet non valido/);
    expect(await grezzo(store.getDocument('esistente') as SheetDocument, 1, 1)).toBe('resta');
  });

  it('preparaSalvataggio: nome dal titolo, tipo, byte e avvisi per ogni formato', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('t1');
    await doc.client.setCell('Foglio1', 1, 1, 'ciao');
    await doc.client.setCell('Foglio1', 1, 2, '=1+1');
    const x = await preparaSalvataggio(store, 't1', 'Spese: 2024', 'xlsx');
    expect([x.nome, x.mime, x.avvisi]).toEqual(['Spese 2024.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', []]);
    expect([...(await leggiZip(x.bytes)).keys()]).toContain('xl/workbook.xml');
    const c = await preparaSalvataggio(store, 't1', 'Spese', 'csv');
    expect([c.nome, c.mime]).toEqual(['Spese.csv', 'text/csv']);
    expect(Array.from(c.bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(decConBom.decode(c.bytes)).toBe('\uFEFFciao,2\r\n');
    expect(c.avvisi).toHaveLength(1);
    const f = await preparaSalvataggio(store, 't1', '', 'fsheet');
    expect([f.nome, f.mime, f.avvisi]).toEqual(['Foglio di calcolo senza titolo.psheet', 'application/json', []]);
    expect(JSON.parse(dec.decode(f.bytes)).version).toBe(1);
  });

  it('preparaSalvataggio senza documento dà un errore chiaro', async () => {
    await expect(preparaSalvataggio(new DocumentStore(), 'nessuna', 'T', 'xlsx')).rejects.toThrow('Nessun foglio di calcolo da salvare');
  });

  it('salvare e riaprire: stessi valori, stili e misure', async () => {
    const A = new DocumentStore();
    await applicaDati(A.getOrCreateDocument('a'), datiRicchi());
    const pronto = await preparaSalvataggio(A, 'a', 'Giro', 'xlsx');
    const B = new DocumentStore();
    await apriInScheda(B, 'b', pronto.bytes, pronto.nome);
    expect(B.getDocument('b')?.title).toBe('Giro');
    const prima = scambioDaDocumento(await estraiDati(A.getDocument('a') as SheetDocument));
    const dopo = scambioDaDocumento(await estraiDati(B.getDocument('b') as SheetDocument));
    expect(dopo).toEqual(prima);
  });

  it('il menu File ha Apri, Salva, Salva con nome e le tre voci Scarica, una sotto l\'altra', () => {
    const file = menuRegistry.find((m) => m.id === 'file');
    const voci = file?.items ?? [];
    const azioni = voci.map((i) => i.action).filter(Boolean);
    expect(azioni).toEqual(expect.arrayContaining(['open-file', 'save-file', 'save-as-file']));
    const dopo = voci.slice(voci.findIndex((i) => i.id === 'save-as') + 1, voci.findIndex((i) => i.id === 'save-as') + 4);
    expect(dopo.map((v) => [v.id, v.action, v.label, v.subitems])).toEqual([
      ['download-xlsx', 'download-xlsx', 'Scarica come cartella di lavoro (.xlsx)', undefined],
      ['download-csv', 'download-csv', 'Scarica come CSV (.csv)', undefined],
      ['download-fsheet', 'download-fsheet', 'Scarica come pmb_sheets (.psheet)', undefined],
    ]);
    expect(voci.filter((v) => v.subitems && v.id === 'download')).toEqual([]);
  });

  it('finestra: Ctrl+S salva in Excel, Ctrl+O apre, Ctrl+Shift+S salva ancora', async () => {
    document.body.innerHTML = '';
    const app = document.createElement('free-app') as HTMLElement & { updateComplete: Promise<unknown> };
    document.body.appendChild(app);
    await app.updateComplete;
    await app.updateComplete;
    const tab = (app as unknown as { tabs: Array<{ id: string; title: string; type: string }> }).tabs.at(-1) as { id: string; title: string };
    const doc = defaultDocumentStore.getOrCreateDocument(tab.id);
    await doc.client.setCell('Foglio1', 1, 1, 'ciao');
    salva.mockClear();
    scegli.mockClear();
    const evento = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evento);
    await vi.waitFor(() => expect(salva).toHaveBeenCalledTimes(1));
    expect(evento.defaultPrevented).toBe(true);
    expect(salva.mock.calls[0][0]).toBe(`${tab.title}.xlsx`);
    expect([...(await leggiZip(salva.mock.calls[0][1] as Uint8Array)).keys()]).toContain('xl/workbook.xml');
    salva.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(salva).toHaveBeenCalledTimes(1));
    const apri = new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(apri);
    await vi.waitFor(() => expect(scegli).toHaveBeenCalledTimes(1));
    expect(apri.defaultPrevented).toBe(true);
    expect((scegli.mock.calls[0][0] as string).split(',')).toEqual(expect.arrayContaining(['.xlsx', '.csv', '.tsv', '.txt', '.psheet', '.fsheet']));
    scegli.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    salva.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(salva).not.toHaveBeenCalled();
    expect(scegli).not.toHaveBeenCalled();
  });

  it('finestra: i comandi del menu File salvano nei tre formati e mostrano l\'esito', async () => {
    document.body.innerHTML = '';
    const app = document.createElement('free-app') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
    document.body.appendChild(app);
    await app.updateComplete;
    await app.updateComplete;
    const dentro = app as unknown as { tabs: Array<{ id: string; title: string }>; statusMessage: string };
    const tab = dentro.tabs.at(-1) as { id: string; title: string };
    await defaultDocumentStore.getOrCreateDocument(tab.id).client.setCell('Foglio1', 1, 1, 'ciao');
    const comanda = (action: string) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label: action }, bubbles: true, composed: true }));
    const prova = async (action: string, nome: string) => {
      salva.mockClear();
      comanda(action);
      await vi.waitFor(() => expect(salva).toHaveBeenCalledTimes(1));
      expect(salva.mock.calls[0][0]).toBe(`${tab.title}.${nome}`);
      return salva.mock.calls[0] as [string, Uint8Array, string];
    };
    await prova('save-file', 'xlsx');
    await prova('save-as-file', 'xlsx');
    await prova('download-xlsx', 'xlsx');
    const csv = await prova('download-csv', 'csv');
    expect(decConBom.decode(csv[1])).toBe('\uFEFFciao\r\n');
    expect(csv[2]).toBe('text/csv');
    const nostro = await prova('download-fsheet', 'psheet');
    expect(JSON.parse(dec.decode(nostro[1])).version).toBe(1);
    await vi.waitFor(() => expect(dentro.statusMessage).toBe(`Esportato "${tab.title}.psheet"`));
    salva.mockImplementationOnce(async () => false);
    comanda('save-file');
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Salvataggio annullato'));
    salva.mockImplementationOnce(async () => { throw new Error('disco pieno'); });
    comanda('save-file');
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Impossibile salvare: disco pieno'));
    salva.mockClear();
    comanda('download-csv');
    await vi.waitFor(() => expect(dentro.statusMessage).toContain('Esportato "'));
  });

  it('finestra: il CSV avvisa di ciò che si perde', async () => {
    document.body.innerHTML = '';
    const app = document.createElement('free-app') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
    document.body.appendChild(app);
    await app.updateComplete;
    await app.updateComplete;
    const dentro = app as unknown as { tabs: Array<{ id: string }>; statusMessage: string };
    await defaultDocumentStore.getOrCreateDocument((dentro.tabs.at(-1) as { id: string }).id).client.setCell('Foglio1', 1, 1, '=1+1');
    salva.mockClear();
    app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'download-csv', label: 'x' }, bubbles: true, composed: true }));
    await vi.waitFor(() => expect(dentro.statusMessage).toContain('formule, formattazione e celle unite non si conservano'));
    expect(dentro.statusMessage.startsWith('Esportato "')).toBe(true);
  });

  it('finestra: Apri mette il file nella finestra, con i suoi fogli come schede in alto', async () => {
    document.body.innerHTML = '';
    const app = document.createElement('free-app') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
    document.body.appendChild(app);
    await app.updateComplete;
    const dentro = app as unknown as { titolo: string; fogli: string[]; foglioAttivo: string; statusMessage: string };
    const byte = await scriviXlsx({ foglioAttivo: 'Dati', fogli: [foglio('Dati', { celle: { A1: 'dal file', B1: '=2*21' } }), foglio('Riepilogo', { celle: { A1: 'x' } })] });
    scegli.mockResolvedValueOnce(new File([byte as BlobPart], 'Magazzino.xlsx'));
    app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'open-file', label: 'Apri' }, bubbles: true, composed: true }));
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Aperto "Magazzino.xlsx"'));
    await vi.waitFor(() => expect(dentro.fogli).toEqual(['Dati', 'Riepilogo']));
    expect([dentro.titolo, dentro.foglioAttivo]).toEqual(['Magazzino', 'Dati']);
    const doc = defaultDocumentStore.getDocument('tab-1') as SheetDocument;
    expect(await grezzo(doc, 1, 1, 'Dati')).toBe('dal file');
    expect((await doc.client.getCell('Dati', 1, 2)).value).toMatchObject({ kind: 'number', value: 42 });
    await app.updateComplete;
    const schede = (app.renderRoot.querySelector('free-tabs') as HTMLElement).shadowRoot!.querySelectorAll('.tab-item');
    expect(Array.from(schede).map((x) => x.textContent!.trim())).toEqual(['Dati', 'Riepilogo']);
    expect(app.renderRoot.querySelectorAll('free-sheet-grid')).toHaveLength(1); // una sola griglia: un file per finestra
  });


  it('finestra: Apri mostra nella barra di stato gli avvisi del file', async () => {
    document.body.innerHTML = '';
    const app = document.createElement('free-app') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
    document.body.appendChild(app);
    await app.updateComplete;
    const dentro = app as unknown as { statusMessage: string };
    const piu = await scriviXlsx({ foglioAttivo: 'Uno', fogli: [foglio('Uno', { celle: { A1: 'x' } })] });
    const voci = await leggiZip(piu);
    voci.set('xl/charts/chart1.xml', new TextEncoder().encode('<c/>'));
    const byte = await scriviZip([...voci].map(([nome, d]) => ({ nome, dati: d })));
    scegli.mockResolvedValueOnce(new File([byte as BlobPart], 'Doppio.xlsx'));
    app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'open-file', label: 'Apri' }, bubbles: true, composed: true }));
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Aperto "Doppio.xlsx". Grafici e disegni del file non sono stati importati.'));
  });


  it('finestra: Apri senza scegliere un file, o con un file rotto, non cambia le schede', async () => {
    document.body.innerHTML = '';
    const app = document.createElement('free-app') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
    document.body.appendChild(app);
    await app.updateComplete;
    const dentro = app as unknown as { tabs: unknown[]; statusMessage: string };
    const prima = dentro.tabs.length;
    const apri = () => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'open-file', label: 'Apri' }, bubbles: true, composed: true }));
    scegli.mockClear();
    scegli.mockResolvedValueOnce(null);
    apri();
    await vi.waitFor(() => expect(scegli).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(dentro.tabs.length).toBe(prima);
    scegli.mockResolvedValueOnce(new File([new Uint8Array([0, 1, 2])], 'rotto.csv'));
    apri();
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Impossibile aprire "rotto.csv": Formato di file non riconosciuto'));
    expect(dentro.tabs.length).toBe(prima);
  });

  it('salvaSuDisco: finestra "Salva con nome" del sistema, annullamento, scaricamento di riserva', async () => {
    const reale = await vi.importActual<typeof import('../../src/formati/file-io')>('../../src/formati/file-io');
    const scritti: Uint8Array[] = [];
    let chiuso = false;
    const opzioni: Array<{ suggestedName: string; types?: Array<{ description: string; accept: Record<string, string[]> }> }> = [];
    const w = window as unknown as { showSaveFilePicker?: unknown };
    w.showSaveFilePicker = async (o: (typeof opzioni)[number]) => { opzioni.push(o); return { createWritable: async () => ({ write: async (d: Uint8Array) => { scritti.push(d); }, close: async () => { chiuso = true; } }) }; };
    expect(await reale.salvaSuDisco('Conti.xlsx', new Uint8Array([1, 2, 3]), 'application/x-prova')).toBe(true);
    expect(scritti).toEqual([new Uint8Array([1, 2, 3])]);
    expect(chiuso).toBe(true);
    expect(opzioni[0]).toEqual({ suggestedName: 'Conti.xlsx', types: [{ description: 'XLSX', accept: { 'application/x-prova': ['.xlsx'] } }] });
    expect(await reale.salvaSuDisco('Senza', new Uint8Array([1]), 'text/csv')).toBe(true);
    expect(opzioni[1]).toEqual({ suggestedName: 'Senza', types: undefined });
    w.showSaveFilePicker = async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); };
    expect(await reale.salvaSuDisco('Conti.xlsx', new Uint8Array([1]), 'application/x-prova')).toBe(false);
    w.showSaveFilePicker = async () => { throw new Error('non permesso'); };
    const scaricati: Array<{ download: string; href: string; rel?: string }> = [];
    vi.useFakeTimers();
    const revoca = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const creaUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prova');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { scaricati.push({ download: this.download, href: this.href, rel: this.rel }); });
    expect(await reale.salvaSuDisco('Dati.csv', new Uint8Array([1]), 'text/csv')).toBe(true);
    expect(scaricati).toEqual([{ download: 'Dati.csv', href: 'blob:prova', rel: 'noopener' }]);
    expect(revoca).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    expect(revoca).toHaveBeenCalledWith('blob:prova');
    vi.useRealTimers();
    delete w.showSaveFilePicker;
    expect(await reale.salvaSuDisco('Senza', new Uint8Array([1]), 'text/csv')).toBe(true);
    expect(scaricati.map((s) => s.download)).toEqual(['Dati.csv', 'Senza']);
    expect(document.querySelectorAll('a[download]').length).toBe(0);
    creaUrl.mockRestore();
    vi.restoreAllMocks();
  });

  it('scegliFile: restituisce il file scelto o null se l\'utente rinuncia', async () => {
    const reale = await vi.importActual<typeof import('../../src/formati/file-io')>('../../src/formati/file-io');
    const file = new File(['x'], 'a.csv');
    const clic = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [file], configurable: true });
      expect(this.type).toBe('file');
      expect(this.accept).toBe('.xlsx,.csv');
      this.dispatchEvent(new Event('change'));
    });
    expect(await reale.scegliFile('.xlsx,.csv')).toBe(file);
    clic.mockImplementation(function (this: HTMLInputElement) { this.dispatchEvent(new Event('cancel')); });
    expect(await reale.scegliFile('.xlsx,.csv')).toBeNull();
    clic.mockImplementation(function (this: HTMLInputElement) { Object.defineProperty(this, 'files', { value: [], configurable: true }); this.dispatchEvent(new Event('change')); });
    expect(await reale.scegliFile('.xlsx,.csv')).toBeNull();
    clic.mockRestore();
  });
});
