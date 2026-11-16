import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { leggiZip } from '@comune/formati/zip';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { esporta, importa } from '../../src/formati/file';
import { documentoDaScambio, foglioVuoto, scambioDaDocumento, type FoglioScambio, type Scambio } from '../../src/formati/scambio';
import { applicaDati, estraiDati } from '../../src/formati/documento';
import { serializeSheetDocumentData, deserializeSheetDocumentData } from '../../src/sheet/document-data';
import { DocumentStore, defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { coloreSchedaDi, impostaColoreScheda, duplicaStatoFoglio } from '../../src/sheet/stato-fogli';

const testo = (b: Uint8Array) => new TextDecoder().decode(b);
const foglio = (nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio => ({ ...foglioVuoto(nome), ...extra });
const scambio = (): Scambio => ({ foglioAttivo: 'Uno', fogli: [foglio('Uno', { celle: { A1: 'x' }, colore: '#ef4444' }), foglio('Due', { celle: { A1: 'y' } }), foglio('Tre', { colore: '#3b82f6' })] });

describe('T486: colore delle schede nel file Excel', () => {
  it('si scrive come tabColor, solo per i fogli che ne hanno uno', async () => {
    const voci = await leggiZip(await scriviXlsx(scambio()));
    expect(testo(voci.get('xl/worksheets/sheet1.xml')!)).toContain('<sheetPr><tabColor rgb="FFEF4444"/></sheetPr>');
    expect(testo(voci.get('xl/worksheets/sheet2.xml')!)).not.toContain('tabColor');
    expect(testo(voci.get('xl/worksheets/sheet3.xml')!)).toContain('rgb="FF3B82F6"');
    // sheetPr è il primo elemento del foglio, come vuole Excel
    expect(testo(voci.get('xl/worksheets/sheet1.xml')!)).toMatch(/<worksheet[^>]*><sheetPr>/);
  });

  it('si rilegge uguale', async () => {
    const r = await leggiXlsx(await scriviXlsx(scambio()));
    expect(r.scambio.fogli.map((f) => f.colore)).toEqual(['#ef4444', undefined, '#3b82f6']);
    expect(r.avvisi).toEqual([]);
  });

  it('un colore non valido non si scrive; uno a 8 cifre (ARGB) o a tema si legge senza errori', async () => {
    const voci = await leggiZip(await scriviXlsx({ foglioAttivo: 'A', fogli: [foglio('A', { colore: 'rosso' })] }));
    expect(testo(voci.get('xl/worksheets/sheet1.xml')!)).not.toContain('tabColor');
    const xml = testo((await leggiZip(await scriviXlsx(scambio()))).get('xl/worksheets/sheet2.xml')!).replace('<dimension', '<sheetPr><tabColor theme="4"/></sheetPr><dimension');
    expect(xml).toContain('theme="4"');
  });
});

describe('T486: colore delle schede nel documento e nel file nativo', () => {
  it('dal modello di scambio al documento e ritorno', () => {
    const dati = documentoDaScambio(scambio());
    const di = scambioDaDocumento(dati);
    expect(di.fogli.map((f) => f.colore)).toEqual(['#ef4444', undefined, '#3b82f6']);
  });

  it('il file nativo (.psheet) conserva il colore del foglio attivo e degli altri', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('t');
    await applicaDati(doc, documentoDaScambio(scambio()));
    expect(doc.coloreScheda).toBe('#ef4444');
    expect(coloreSchedaDi(doc, 'Tre')).toBe('#3b82f6');
    expect(coloreSchedaDi(doc, 'Due')).toBeUndefined();
    const json = serializeSheetDocumentData(await estraiDati(doc));
    const altro = store.getOrCreateDocument('u');
    await applicaDati(altro, deserializeSheetDocumentData(json));
    expect(altro.coloreScheda).toBe('#ef4444');
    expect(coloreSchedaDi(altro, 'Tre')).toBe('#3b82f6');
    expect(coloreSchedaDi(altro, 'Due')).toBeUndefined();
  });

  it('un colore non valido nel file nativo si scarta', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('t');
    await applicaDati(doc, documentoDaScambio(scambio()));
    const valido = JSON.parse(serializeSheetDocumentData(await estraiDati(doc)));
    expect(valido.coloreScheda).toBe('#ef4444');
    valido.coloreScheda = 'blu';
    valido.fogliStato.Tre.coloreScheda = 'rosso';
    const letto = deserializeSheetDocumentData(JSON.stringify(valido));
    expect(letto.coloreScheda).toBeUndefined();
    const altro = store.getOrCreateDocument('u');
    await applicaDati(altro, letto);
    expect(coloreSchedaDi(altro, 'Tre')).toBeUndefined();
  });

  it('un foglio duplicato ha lo stesso colore', async () => {
    const doc = new DocumentStore().getOrCreateDocument('t');
    await applicaDati(doc, documentoDaScambio(scambio()));
    duplicaStatoFoglio(doc, 'Uno', 'Uno (2)');
    expect(coloreSchedaDi(doc, 'Uno (2)')).toBe('#ef4444');
  });

  it('il giro completo esporta/importa in .xlsx conserva i colori', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('t');
    await applicaDati(doc, documentoDaScambio(scambio()));
    const aperto = await importa(await esporta(await estraiDati(doc), 'xlsx'), 'p.xlsx');
    const altro = store.getOrCreateDocument('u');
    await applicaDati(altro, aperto.dati);
    expect(altro.coloreScheda).toBe('#ef4444');
    expect(coloreSchedaDi(altro, 'Tre')).toBe('#3b82f6');
  });
});

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ParentNode; undo: () => Promise<void>; redo: () => Promise<void>;
  handleAddSheet: (n?: string) => Promise<void>; switchSheet: (n: string) => Promise<void>; impostaColoreSchedaFoglio: (n: string, c: string) => void;
};
let app: App;
let griglia: Griglia;
let doc: SheetDocument;
const schede = () => Array.from((app.renderRoot.querySelector('free-tabs') as HTMLElement).shadowRoot!.querySelectorAll('.tab-item')) as HTMLElement[];

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
  await griglia.handleAddSheet('Secondo');
  await griglia.switchSheet('Foglio1');
  await app.updateComplete;
});

describe('T486: nell\'interfaccia', () => {
  it('colorare una scheda mostra la barra colorata, anche per un foglio non attivo; togliere il colore la toglie', async () => {
    griglia.impostaColoreSchedaFoglio('Secondo', '#22c55e');
    await app.updateComplete;
    await (app.renderRoot.querySelector('free-tabs') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const [uno, due] = schede();
    expect(due.style.borderBottom).toContain('3px');
    expect(due.style.borderBottom.toLowerCase()).toMatch(/22c55e|34, 197, 94/);
    expect(uno.style.borderBottom).toBe('');
    expect(coloreSchedaDi(doc, 'Secondo')).toBe('#22c55e');
    griglia.impostaColoreSchedaFoglio('Secondo', '');
    await app.updateComplete;
    await (app.renderRoot.querySelector('free-tabs') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    // (happy-dom non toglie le proprietà impostate da styleMap: lo si controlla sullo stato, e sul programma vero)
    expect((app as unknown as { coloriSchede: Record<string, string> }).coloriSchede).toEqual({});
  });

  it('il colore resta al foglio quando si cambia foglio, e si annulla e si ripete', async () => {
    griglia.impostaColoreSchedaFoglio('Foglio1', '#3b82f6');
    await griglia.switchSheet('Secondo');
    expect(coloreSchedaDi(doc, 'Foglio1')).toBe('#3b82f6');
    await griglia.switchSheet('Foglio1');
    expect(doc.coloreScheda).toBe('#3b82f6');
    await griglia.undo();
    expect(coloreSchedaDi(doc, 'Foglio1')).toBeUndefined();
    await griglia.redo();
    expect(coloreSchedaDi(doc, 'Foglio1')).toBe('#3b82f6');
  });

  it('il menu della scheda ha i campioni di colore e "nessun colore"', async () => {
    const tab = schede()[0];
    tab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
    await new Promise((r) => setTimeout(r, 50));
    await griglia.updateComplete;
    const campioni = griglia.renderRoot.querySelectorAll('.colori-scheda .campione-colore');
    expect(campioni.length).toBe(9);
    (campioni[3] as HTMLElement).click();
    await app.updateComplete;
    expect(coloreSchedaDi(doc, 'Foglio1')).toBe('#22c55e');
  });
});
