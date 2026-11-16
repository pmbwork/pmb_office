import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import '../../src/components/dialogo-link';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { normalizzaLink, urlAmmesso } from '../../src/sheet/link';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { foglioVuoto } from '../../src/formati/scambio';

describe('T495: indirizzi dei link', () => {
  it.each([
    ['https://esempio.it', 'https://esempio.it'],
    ['  http://esempio.it/a?b=1#c ', 'http://esempio.it/a?b=1#c'],
    ['esempio.it', 'https://esempio.it'],
    ['www.esempio.it/pagina', 'https://www.esempio.it/pagina'],
    ['mario@esempio.it', 'mailto:mario@esempio.it'],
    ['mailto:mario@esempio.it', 'mailto:mario@esempio.it'],
  ])('%s → %s', (dentro, fuori) => { expect(normalizzaLink(dentro)).toBe(fuori); });

  it.each(['', '   ', 'javascript:alert(1)', 'file:///c:/x', 'ftp://esempio.it', 'https://', 'https://.it', 'https://a@b.it', 'una frase', 'https://esempio.it/a b', 'mailto:@x.it', 'data:text/html,x', 'c:\\file'])('rifiuta "%s"', (x) => {
    expect(normalizzaLink(x)).toBeNull();
  });

  it('urlAmmesso segue le regole della shell', () => {
    expect(urlAmmesso('https://esempio.it')).toBe(true);
    expect(urlAmmesso('javascript:alert(1)')).toBe(false);
    expect(urlAmmesso('https://esempio.it\\x')).toBe(false);
    expect(urlAmmesso('x'.repeat(2001))).toBe(false);
  });
});

describe('T495: link in un file .xlsx', () => {
  it('andata e ritorno: il link resta sulla sua cella e si vede blu e sottolineato in Excel', async () => {
    const f = foglioVuoto('Foglio1');
    f.celle.A1 = 'Il sito';
    f.celle.B2 = 'Scrivimi';
    f.stili.A1 = { link: 'https://esempio.it/a?x=1&y=2' };
    f.stili.B2 = { link: 'mailto:mario@esempio.it', bold: true };
    const byte = await scriviXlsx({ fogli: [f], foglioAttivo: 'Foglio1' });
    const testoFile = new TextDecoder('latin1').decode(byte);
    expect(testoFile.length).toBeGreaterThan(0);
    const letto = await leggiXlsx(byte);
    const fg = letto.scambio.fogli[0];
    expect(fg.stili.A1?.link).toBe('https://esempio.it/a?x=1&y=2');
    expect(fg.stili.B2?.link).toBe('mailto:mario@esempio.it');
    expect(fg.celle.A1).toBe('Il sito');
    expect(letto.avvisi.join(' ')).not.toMatch(/collegamenti/i);
  });

  it('un link con indirizzo non ammesso non viene scritto', async () => {
    const f = foglioVuoto('Foglio1');
    f.celle.A1 = 'x';
    f.stili.A1 = { link: 'javascript:alert(1)' };
    const letto = await leggiXlsx(await scriviXlsx({ fogli: [f], foglioAttivo: 'Foglio1' }));
    expect(letto.scambio.fogli[0].stili.A1?.link).toBeUndefined();
  });

  it('i link convivono con i commenti nello stesso foglio', async () => {
    const f = foglioVuoto('Foglio1');
    f.celle.A1 = 'x';
    f.stili.A1 = { link: 'https://esempio.it' };
    f.commenti = [{ riga: 1, colonna: 1, testo: 'nota' }];
    const letto = await leggiXlsx(await scriviXlsx({ fogli: [f], foglioAttivo: 'Foglio1' }));
    expect(letto.scambio.fogli[0].stili.A1?.link).toBe('https://esempio.it');
    expect(letto.scambio.fogli[0].commenti?.[0].testo).toBe('nota');
  });
});

type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot; setLink: (r: number, c: number, url: string | undefined, t?: string) => Promise<void>; undo: () => Promise<void>; getActiveCellLink: () => { url: string; testo: string; cella: string } };
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
let griglia: Griglia;
let doc: SheetDocument;
let app: App;

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
});

const ridisegna = async () => { (griglia as unknown as { cellsCache: Map<string, unknown> }).cellsCache.clear(); (griglia as unknown as { updateViewport: () => void }).updateViewport(); await new Promise((r) => setTimeout(r, 150)); griglia.requestUpdate(); await griglia.updateComplete; };
const td = (r: number, c: number) => griglia.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement;

describe('T495: link nella griglia', () => {
  it('setLink mette il link, scrive il testo, si vede blu e sottolineato, e si annulla in un passo', async () => {
    await griglia.setLink(2, 2, 'https://esempio.it', 'Il sito');
    await ridisegna();
    expect(doc.styles.cellStyles.get('2,2')).toBeDefined();
    expect(td(2, 2).textContent!.trim()).toBe('Il sito');
    expect(td(2, 2).style.color.toLowerCase()).toMatch(/#0563c1|rgb\(5, 99, 193\)/);
    expect(td(2, 2).style.textDecoration).toContain('underline');
    expect(td(2, 2).getAttribute('title')).toContain('https://esempio.it');
    await griglia.undo();
    await ridisegna();
    expect(doc.styles.cellStyles.get('2,2')).toBeUndefined();
    expect(td(2, 2).textContent!.trim()).toBe('');
  });

  it('con la cella vuota e nessun testo, il testo è l\'indirizzo; togliere il link lascia il testo', async () => {
    await griglia.setLink(3, 1, 'https://esempio.it', '');
    expect((await doc.client.getCell(doc.activeSheetName, 3, 1)).raw).toBe('https://esempio.it');
    await griglia.setLink(3, 1, undefined);
    expect(doc.styles.cellStyles.get('3,1')).toBeUndefined();
    expect((await doc.client.getCell(doc.activeSheetName, 3, 1)).raw).toBe('https://esempio.it');
  });

  it('Alt+clic sulla cella con il link manda la richiesta di apertura; senza Alt no', async () => {
    await griglia.setLink(1, 1, 'https://esempio.it', 'x');
    await ridisegna();
    const aperti: string[] = [];
    griglia.addEventListener('apri-link', (e) => aperti.push((e as CustomEvent<{ url: string }>).detail.url));
    td(1, 1).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(aperti).toEqual([]);
    td(1, 1).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0, altKey: true }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(aperti).toEqual(['https://esempio.it']);
  });

  it('il link segue la cella quando si inserisce una riga sopra', async () => {
    await griglia.setLink(2, 1, 'https://esempio.it', 'x');
    doc.selection = { anchor: { row: 1, col: 1 }, active: { row: 1, col: 1 }, range: { startRow: 1, endRow: 1, startCol: 1, endCol: 1 } };
    await (griglia as unknown as { insertRowsAbove: () => Promise<void> }).insertRowsAbove();
    expect(doc.styles.cellStyles.get('3,1')).toBeDefined();
    expect(doc.styles.cellStyles.get('2,1')).toBeUndefined();
  });

  it('Ctrl+K apre la finestra con l\'indirizzo della cella; Salva scrive il link', async () => {
    doc.selection = { anchor: { row: 4, col: 2 }, active: { row: 4, col: 2 }, range: { startRow: 4, endRow: 4, startCol: 2, endCol: 2 } };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await app.updateComplete;
    const dialogo = app.renderRoot.querySelector('free-dialogo-link') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ShadowRoot };
    expect(dialogo).not.toBeNull();
    await dialogo.updateComplete;
    expect(dialogo.renderRoot.querySelector('h2')!.textContent).toContain('B4');
    const url = dialogo.renderRoot.querySelector('input[data-campo="url"]') as HTMLInputElement;
    url.value = 'frase non valida';
    (dialogo.renderRoot.querySelector('button[data-azione="salva"]') as HTMLButtonElement).click();
    await dialogo.updateComplete;
    expect(dialogo.renderRoot.querySelector('[data-campo="errore"]')!.textContent).toMatch(/indirizzo valido/);
    expect(doc.styles.cellStyles.get('4,2')).toBeUndefined();
    url.value = 'esempio.it';
    (dialogo.renderRoot.querySelector('button[data-azione="salva"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 100));
    await app.updateComplete;
    expect(doc.styles.cellStyles.get('4,2')).toBeDefined();
    expect(app.renderRoot.querySelector('free-dialogo-link')).toBeNull();
    expect(griglia.getActiveCellLink().url).toBe('https://esempio.it');
  });
});
