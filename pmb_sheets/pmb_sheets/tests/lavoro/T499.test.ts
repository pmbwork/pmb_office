import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import '../../src/components/immagine-overlay';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { LIMITE_BYTE_IMMAGINE, LIMITE_IMMAGINI, dataUrlDaByte, dataUrlValido, immaginiDaDati, misureIniziali, rilevaTipoImmagine, type ImmagineConfig } from '../../src/sheet/immagini';
import { extractDocumentData, deserializeSheetDocumentData, serializeSheetDocumentData } from '../../src/sheet/document-data';
import { avvisiEsportazione } from '../../src/formati/file';

// un PNG 1x1 vero
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const URL_PNG = dataUrlDaByte(PNG, 'image/png');

describe('T499: riconoscere le immagini dai byte', () => {
  it('PNG, JPEG, GIF e WebP si riconoscono; il resto no', () => {
    expect(rilevaTipoImmagine(PNG)).toBe('image/png');
    expect(rilevaTipoImmagine(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(rilevaTipoImmagine(new TextEncoder().encode('GIF89a....'))).toBe('image/gif');
    expect(rilevaTipoImmagine(new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('image/webp');
  });
  it('l\'SVG e i file di testo non sono immagini ammesse (anche con estensione .png)', () => {
    expect(rilevaTipoImmagine(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(rilevaTipoImmagine(new TextEncoder().encode('<?xml version="1.0"?><svg/>'))).toBeNull();
    expect(rilevaTipoImmagine(new Uint8Array())).toBeNull();
    expect(rilevaTipoImmagine(Uint8Array.from([0x89, 0x50]))).toBeNull();
  });
  it('il data URL si ricostruisce e si accetta; gli altri no', () => {
    expect(URL_PNG.startsWith('data:image/png;base64,')).toBe(true);
    expect(dataUrlValido(URL_PNG)).toBe(true);
    for (const x of ['data:image/svg+xml;base64,AAAA', 'data:text/html;base64,AAAA', 'javascript:alert(1)', 'https://esempio.it/a.png', 'data:image/png;base64,AA AA', 'data:image/png,AAAA', '', 5, null]) expect(dataUrlValido(x)).toBe(false);
    expect(dataUrlValido(`data:image/png;base64,${'A'.repeat(Math.ceil(LIMITE_BYTE_IMMAGINE * 4 / 3) + 100)}`)).toBe(false);
  });
  it('un file grande più di 32 mila byte si converte senza errori', () => {
    const grande = new Uint8Array(100_000).fill(7);
    expect(dataUrlDaByte(grande, 'image/png').length).toBeGreaterThan(130_000);
  });
});

describe('T499: misure di partenza', () => {
  it('le piccole restano com\'erano, le grandi entrano in 480x320 con le proporzioni', () => {
    expect(misureIniziali(100, 50)).toEqual({ width: 100, height: 50 });
    expect(misureIniziali(960, 640)).toEqual({ width: 480, height: 320 });
    expect(misureIniziali(2000, 500)).toEqual({ width: 480, height: 120 });
    expect(misureIniziali(500, 2000)).toEqual({ width: 80, height: 320 });
    expect(misureIniziali(0, NaN)).toEqual({ width: 480, height: 320 });
    expect(misureIniziali(1, 1)).toEqual({ width: 24, height: 24 });
  });
});

const base = (id: string, extra: Partial<ImmagineConfig> = {}): ImmagineConfig => ({ id, sheetName: 'Foglio1', x: 10, y: 20, width: 100, height: 80, dataUrl: URL_PNG, nome: 'a.png', ...extra });

describe('T499: leggere le immagini da un file', () => {
  it('tiene quelle buone e scarta quelle rovinate, doppie o pericolose', () => {
    const letto = immaginiDaDati([
      base('a'), base('a', { x: 99 }), base('b', { dataUrl: 'data:image/svg+xml;base64,AAAA' }), base('c', { width: 5 }), base('d', { x: -1 }),
      base('e', { x: Number.NaN }), { id: 'f' }, null, 'x', base('g', { sheetName: 5 as unknown as string }), base('h'),
    ]);
    expect(letto.map((i) => i.id)).toEqual(['a', 'h']);
    expect(letto[0].x).toBe(10);
  });
  it('non è un elenco: nessuna immagine', () => {
    expect(immaginiDaDati(undefined)).toEqual([]);
    expect(immaginiDaDati({})).toEqual([]);
  });
  it('si fermano al limite', () => {
    const molte = Array.from({ length: LIMITE_IMMAGINI + 5 }, (_, i) => base(`i${i}`));
    expect(immaginiDaDati(molte)).toHaveLength(LIMITE_IMMAGINI);
  });
});

type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot; insertImage: (u: string, n: string, w: number, h: number) => string; deleteImage: (id: string) => void; undo: () => Promise<void>; redo: () => Promise<void>; renameCurrentSheet: (n: string) => Promise<void>; handleAddSheet: (n: string) => Promise<void>; switchSheet: (n: string) => Promise<void> };
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
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

const overlay = () => Array.from(griglia.renderRoot.querySelectorAll('free-immagine-overlay')) as Array<HTMLElement & { config: ImmagineConfig; updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }>;

describe('T499: immagini nella griglia', () => {
  it('insertImage la mette sul foglio, la disegna con il suo data URL e la seleziona', async () => {
    const msg = griglia.insertImage(URL_PNG, 'logo.png', 200, 100);
    await griglia.updateComplete;
    expect(msg).toMatch(/logo\.png/);
    expect(doc.immagini).toHaveLength(1);
    expect(doc.immagini[0]).toMatchObject({ sheetName: 'Foglio1', width: 200, height: 100, nome: 'logo.png' });
    expect(overlay()).toHaveLength(1);
    await overlay()[0].updateComplete;
    expect((overlay()[0].shadowRoot.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe(URL_PNG);
    expect(overlay()[0].hasAttribute('selected')).toBe(true);
  });

  it('non accetta un data URL pericoloso né oltre il limite di numero', async () => {
    expect(griglia.insertImage('data:image/svg+xml;base64,AAAA', 'x.svg', 10, 10)).toMatch(/non valida/);
    expect(doc.immagini).toHaveLength(0);
    for (let i = 0; i < LIMITE_IMMAGINI; i++) griglia.insertImage(URL_PNG, `i${i}.png`, 10, 10);
    expect(griglia.insertImage(URL_PNG, 'una-di-troppo.png', 10, 10)).toMatch(/Troppe immagini/);
    expect(doc.immagini).toHaveLength(LIMITE_IMMAGINI);
  });

  it('inserire ed eliminare si annullano e si ripetono', async () => {
    griglia.insertImage(URL_PNG, 'a.png', 50, 50);
    const id = doc.immagini[0].id;
    await griglia.undo();
    expect(doc.immagini).toHaveLength(0);
    await griglia.redo();
    expect(doc.immagini.map((i) => i.id)).toEqual([id]);
    griglia.deleteImage(id);
    expect(doc.immagini).toHaveLength(0);
    await griglia.undo();
    expect(doc.immagini.map((i) => i.id)).toEqual([id]);
  });

  it('spostare e ridimensionare si annullano', async () => {
    griglia.insertImage(URL_PNG, 'a.png', 100, 100);
    await griglia.updateComplete;
    const { id, x, y, width, height } = doc.immagini[0];
    const o = overlay()[0];
    o.dispatchEvent(new CustomEvent('immagine-change', { detail: { id, prima: { x, y, width, height }, dopo: { x: x + 40, y: y + 10, width, height } }, bubbles: true, composed: true }));
    expect(doc.immagini[0]).toMatchObject({ x: x + 40, y: y + 10 });
    await griglia.undo();
    expect(doc.immagini[0]).toMatchObject({ x, y });
    o.dispatchEvent(new CustomEvent('immagine-change', { detail: { id, prima: { x, y, width, height }, dopo: { x, y, width: 300, height: 200 } }, bubbles: true, composed: true }));
    expect(doc.immagini[0]).toMatchObject({ width: 300, height: 200 });
    await griglia.undo();
    expect(doc.immagini[0]).toMatchObject({ width, height });
  });

  it('con l\'immagine selezionata Canc la elimina, senza toccare le celle', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'resta');
    griglia.insertImage(URL_PNG, 'a.png', 50, 50);
    await griglia.updateComplete;
    const area = griglia.renderRoot.querySelector('.grid-container') as HTMLElement;
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 50));
    expect(doc.immagini).toHaveLength(0);
    expect((await doc.client.getCell(doc.activeSheetName, 1, 1)).raw).toBe('resta');
  });

  it('un clic su una cella toglie la selezione dell\'immagine', async () => {
    griglia.insertImage(URL_PNG, 'a.png', 50, 50);
    await griglia.updateComplete;
    expect(overlay()[0].hasAttribute('selected')).toBe(true);
    (griglia.renderRoot.querySelector('td[data-row="1"][data-col="1"]') as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    await griglia.updateComplete;
    expect(overlay()[0].hasAttribute('selected')).toBe(false);
  });

  it('sta sul suo foglio: cambiando foglio non si vede, rinominando il foglio la segue', async () => {
    griglia.insertImage(URL_PNG, 'a.png', 50, 50);
    await griglia.renameCurrentSheet('Conti');
    expect(doc.immagini[0].sheetName).toBe('Conti');
    await griglia.updateComplete;
    expect(overlay()).toHaveLength(1);
    await griglia.handleAddSheet('Altro');
    await griglia.updateComplete;
    expect(overlay()).toHaveLength(0);
    await griglia.switchSheet('Conti');
    await griglia.updateComplete;
    expect(overlay()).toHaveLength(1);
  });
});

describe('T499: salvare le immagini', () => {
  it('nel formato nativo restano, uguali, e si leggono di nuovo', async () => {
    griglia.insertImage(URL_PNG, 'a.png', 120, 60);
    const dati = await extractDocumentData(doc, doc.styles);
    expect(dati.images).toHaveLength(1);
    const riletto = deserializeSheetDocumentData(serializeSheetDocumentData(dati));
    expect(riletto.images).toEqual(dati.images);
  });
  it('un file con un\'immagine pericolosa la scarta alla lettura', async () => {
    griglia.insertImage(URL_PNG, 'a.png', 120, 60);
    const dati = await extractDocumentData(doc, doc.styles);
    const testo = serializeSheetDocumentData({ ...dati, images: [{ ...dati.images![0], dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }] });
    expect(deserializeSheetDocumentData(testo).images).toEqual([]);
  });
  it('in .xlsx, .ods e .csv non si conservano e l\'avviso lo dice', async () => {
    griglia.insertImage(URL_PNG, 'a.png', 120, 60);
    const dati = await extractDocumentData(doc, doc.styles);
    for (const formato of ['ods', 'csv'] as const) expect(avvisiEsportazione(dati, formato).join(' ')).toMatch(/le immagini/);
    expect(avvisiEsportazione(dati, 'xlsx').join(' ')).not.toMatch(/le immagini/);
    expect(avvisiEsportazione(dati, 'fsheet').join(' ')).not.toMatch(/le immagini/);
  });
});
