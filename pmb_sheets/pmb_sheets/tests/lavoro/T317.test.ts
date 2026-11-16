import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { cellKey } from '../../src/sheet/styles';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode; stampa(): Promise<void> };
interface Dentro { tabs: Array<{ id: string; title: string; type: string }>; statusMessage: string; activeTabId: string; tabellaStampa: unknown }
interface Visto { righe: string[][]; classi: string[][]; stili: Array<Array<{ [k: string]: string }>>; colonne: string[]; scala: string; spans: Array<Array<[number, number]>> }

let app: App;
let dentro: Dentro;
let stampe: Visto[];
let stampaVista: ReturnType<typeof vi.spyOn>;

/** quello che c'è nel DOM della stampa nel momento in cui si chiama window.print */
function fotografiaStampa(): Visto | null {
  const radice = app.renderRoot as ShadowRoot;
  const tabella = radice.querySelector('.stampa table.stampa-tabella');
  if (!tabella) return null;
  const righe = Array.from(tabella.querySelectorAll('tbody tr'));
  return {
    righe: righe.map((r) => Array.from(r.querySelectorAll('td')).map((c) => (c.textContent ?? '').trim())),
    classi: righe.map((r) => Array.from(r.querySelectorAll('td')).map((c) => c.className)),
    stili: righe.map((r) => Array.from(r.querySelectorAll('td')).map((c) => ({
      textAlign: (c as HTMLElement).style.textAlign, fontWeight: (c as HTMLElement).style.fontWeight, backgroundColor: (c as HTMLElement).style.backgroundColor,
      borderBottom: (c as HTMLElement).style.borderBottom,
    }))),
    colonne: Array.from(tabella.querySelectorAll('col')).map((c) => (c as HTMLElement).style.width),
    scala: ((radice.querySelector('.stampa-scala') as HTMLElement).style.zoom || ''),
    spans: righe.map((r) => Array.from(r.querySelectorAll('td')).map((c) => [Number(c.getAttribute('rowspan')), Number(c.getAttribute('colspan'))] as [number, number])),
  };
}

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  stampe = [];
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  dentro = app as unknown as Dentro;
  stampaVista = vi.spyOn(window, 'print').mockImplementation(() => { const v = fotografiaStampa(); if (v) stampe.push(v); });
});
afterEach(() => { vi.restoreAllMocks(); });

const doc = (): SheetDocument => defaultDocumentStore.getOrCreateDocument(dentro.activeTabId);
const imposta = (r: number, c: number, raw: string) => doc().client.setCell(doc().activeSheetName, r, c, raw);
const menu = (action: string, label = action) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label }, bubbles: true, composed: true }));
const barra = (action: string, label = action) => app.renderRoot.querySelector('free-toolbar')?.dispatchEvent(new CustomEvent('toolbar-action', { detail: { action, label }, bubbles: true, composed: true }));
const dopoAfterprint = async () => { window.dispatchEvent(new Event('afterprint')); await app.updateComplete; };

describe('T317: stampare il foglio', () => {
  it('il foglio vuoto non si stampa e lo dice', async () => {
    await app.stampa();
    expect(stampaVista).not.toHaveBeenCalled();
    expect(dentro.statusMessage).toBe('Il foglio è vuoto: niente da stampare');
    expect(dentro.tabellaStampa).toBeNull();
  });

  it('con del contenuto prepara la tabella e chiama la stampa di sistema una volta', async () => {
    await imposta(1, 1, 'Mela');
    await imposta(1, 2, '1.5');
    await imposta(2, 2, '=SUM(B1,B1)');
    await app.stampa();
    expect(stampaVista).toHaveBeenCalledTimes(1);
    expect(stampe[0].righe).toEqual([['Mela', '1,5'], ['', '3']]);
  });

  it('i numeri sono a destra, il testo a sinistra, come nella griglia', async () => {
    await imposta(1, 1, 'Mela');
    await imposta(1, 2, '1.5');
    await app.stampa();
    expect(stampe[0].stili[0].map((s) => s.textAlign)).toEqual(['left', 'right']);
  });

  it('booleani ed errori al centro, celle vuote a sinistra, come nella griglia', async () => {
    await imposta(1, 1, '=1=1');
    await imposta(1, 2, '=1/0');
    await imposta(1, 4, 'x');
    await app.stampa();
    expect(stampe[0].righe[0][0]).toMatch(/TRUE|VERO/);
    expect(stampe[0].righe[0][1]).toMatch(/^#/);
    expect(stampe[0].stili[0].map((s) => s.textAlign)).toEqual(['center', 'center', 'left', 'left']);
  });

  it('si stampa il foglio attivo della cartella, non il primo', async () => {
    await imposta(1, 1, 'primo');
    await doc().client.addSheet('Altro');
    await doc().client.setCell('Altro', 1, 1, 'dal secondo foglio');
    doc().activeSheetName = 'Altro';
    await app.stampa();
    expect(stampe[0].righe).toEqual([['dal secondo foglio']]);
  });

  it('la tabella di stampa è nascosta alle tecnologie di lettura dello schermo', async () => {
    await imposta(1, 1, 'a');
    await app.stampa();
    expect((app.renderRoot as ShadowRoot).querySelector('.stampa')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('un formato di cella si applica alla stampa: valuta con virgola e migliaia', async () => {
    await imposta(1, 1, '1234.5');
    doc().styles.cellStyles.set(cellKey(1, 1), doc().styles.registry.register({ numFmt: '€#,##0.00' }));
    await app.stampa();
    expect(stampe[0].righe).toEqual([['€1.234,50']]);
  });

  it('stile e larghezze: grassetto, sfondo, bordo in basso e larghezza della colonna', async () => {
    await imposta(1, 1, 'Titolo');
    await imposta(1, 2, 'x');
    doc().styles.cellStyles.set(cellKey(1, 1), doc().styles.registry.register({ bold: true, fill: '#ffff00', borders: { bottom: { style: 'thin', color: '#112233' } } }));
    doc().colWidths.set(1, 140);
    await app.stampa();
    expect(stampe[0].stili[0][0].fontWeight).toBe('700');
    expect(stampe[0].stili[0][0].backgroundColor).toBe('#ffff00');
    expect(stampe[0].stili[0][0].borderBottom).toContain('1px solid');
    expect(stampe[0].stili[0][1].fontWeight).toBe('');
    expect(stampe[0].colonne).toEqual(['140px', '90px']);
  });

  it('le celle unite hanno rowspan e colspan e le coperte non ci sono', async () => {
    await imposta(1, 1, 'Unita');
    await imposta(3, 3, 'fine');
    doc().merges = [{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }];
    await app.stampa();
    expect(stampe[0].spans[0][0]).toEqual([2, 2]);
    expect(stampe[0].righe[0]).toEqual(['Unita', '']);
    expect(stampe[0].righe[1]).toEqual(['']);
  });

  it('un foglio più largo di una pagina viene ridotto, uno stretto no', async () => {
    await imposta(1, 1, 'a');
    await app.stampa();
    expect(Number(stampe[0].scala)).toBe(1);
    await dopoAfterprint();
    for (let c = 1; c <= 12; c++) await imposta(1, c, 'x');
    await app.stampa();
    expect(Number(stampe[1].scala)).toBeCloseTo(680 / (12 * 90), 3);
  });

  it('dopo la stampa la tabella sparisce dalla pagina', async () => {
    await imposta(1, 1, 'a');
    await app.stampa();
    expect(dentro.tabellaStampa).not.toBeNull();
    await dopoAfterprint();
    expect(dentro.tabellaStampa).toBeNull();
    expect((app.renderRoot as ShadowRoot).querySelector('.stampa')).toBeNull();
  });

  it('il secondo dopostampa non toglie una tabella messa in seguito', async () => {
    await imposta(1, 1, 'a');
    await app.stampa();
    await dopoAfterprint();
    await app.stampa();
    expect(dentro.tabellaStampa).not.toBeNull();
    await dopoAfterprint();
    expect(dentro.tabellaStampa).toBeNull();
  });

  it('se la stampa di sistema dà errore lo dice e non lascia la tabella', async () => {
    await imposta(1, 1, 'a');
    stampaVista.mockImplementation(() => { throw new Error('nessuna stampante'); });
    await app.stampa();
    expect(dentro.statusMessage).toBe('Impossibile stampare: nessuna stampante');
    expect(dentro.tabellaStampa).toBeNull();
  });

  it('una scheda foglio senza documento (ancora non creato) dice che non c\'è niente da stampare', async () => {
    app.renderRoot.querySelector('free-tabs')?.dispatchEvent(new CustomEvent('tab-created', { detail: { type: 'sheet' }, bubbles: true, composed: true }));
    await app.updateComplete;
    defaultDocumentStore.removeDocument(dentro.activeTabId);
    await app.stampa();
    expect(stampaVista).not.toHaveBeenCalled();
    expect(dentro.statusMessage).toBe('Nessun foglio di calcolo da stampare');
  });
});

describe('T317: da dove si stampa', () => {
  beforeEach(async () => { await imposta(1, 1, 'a'); });

  it('File › Stampa', async () => {
    menu('print', 'Stampa');
    await vi.waitFor(() => expect(stampaVista).toHaveBeenCalledTimes(1));
    expect(dentro.statusMessage).not.toContain('non ancora disponibile');
  });

  it('il pulsante della barra strumenti', async () => {
    barra('print', 'Stampa');
    await vi.waitFor(() => expect(stampaVista).toHaveBeenCalledTimes(1));
    expect(dentro.statusMessage).not.toBe('Azione strumento: Stampa');
  });

  it('Ctrl+P, senza far partire quella del browser', async () => {
    const e = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    // le app create dai test precedenti ascoltano ancora la tastiera della finestra: qui basta che la stampa parta
    await vi.waitFor(() => expect(stampaVista).toHaveBeenCalled());
  });

  it('Ctrl+Maiusc+P, Alt+Ctrl+P e P da sola non stampano', async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));
    expect(stampaVista).not.toHaveBeenCalled();
  });
});

describe('T317: aspetto', () => {
  it('in stampa si vede solo il foglio, a pagina intera, e a schermo la tabella non si vede', () => {
    const css = ((customElements.get('free-app') as unknown as { styles: { cssText: string } }).styles.cssText).replace(/\s+/g, ' ');
    expect(css).toContain('.stampa { display: none; }');
    expect(css).toContain('@media print {');
    expect(css).toContain('.app-theme-wrapper > :not(.stampa) { display: none !important; }');
    expect(css).toContain('.stampa { display: block;');
    expect(css).toContain('.stampa-tabella { border-collapse: collapse; table-layout: fixed; }');
    expect(css).toMatch(/:host \{ height: auto; overflow: visible;/);
  });
});
