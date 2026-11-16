import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';
import { applicaDati, estraiDati } from '../../src/formati/documento';
import { avvisiEsportazione } from '../../src/formati/file';
import { deserializeSheetDocumentData, serializeSheetDocumentData } from '../../src/sheet/document-data';
import {
  chiaveCommento, commentiDaDati, commentoDi, copiaCommentiFoglio, elencaCommenti, impostaCommento,
  LUNGHEZZA_MASSIMA_COMMENTO, rinominaFoglioCommenti, togliCommentiFoglio, type Commento,
} from '../../src/sheet/commenti';

const ADESSO = new Date('2026-11-05T15:00:00.000Z');

describe('T462: commenti, parte pura', () => {
  it('scrivere un commento lo salva con testo e data', () => {
    const m = new Map<string, Commento>();
    expect(impostaCommento(m, 'Foglio1', 2, 3, '  controllare il totale  ', ADESSO)).toBe(true);
    expect(commentoDi(m, 'Foglio1', 2, 3)).toEqual({ testo: 'controllare il totale', data: '2026-11-05T15:00:00.000Z' });
  });

  it('lo stesso testo non cambia niente, un testo nuovo aggiorna anche la data', () => {
    const m = new Map<string, Commento>();
    impostaCommento(m, 'Foglio1', 1, 1, 'uno', ADESSO);
    expect(impostaCommento(m, 'Foglio1', 1, 1, 'uno', new Date('2026-12-01T00:00:00Z'))).toBe(false);
    expect(commentoDi(m, 'Foglio1', 1, 1)!.data).toBe('2026-11-05T15:00:00.000Z');
    expect(impostaCommento(m, 'Foglio1', 1, 1, 'due', new Date('2026-12-01T00:00:00Z'))).toBe(true);
    expect(commentoDi(m, 'Foglio1', 1, 1)).toEqual({ testo: 'due', data: '2026-12-01T00:00:00.000Z' });
  });

  it('un testo vuoto o di soli spazi toglie il commento; se non c\'era non succede niente', () => {
    const m = new Map<string, Commento>();
    expect(impostaCommento(m, 'Foglio1', 1, 1, '   ', ADESSO)).toBe(false);
    impostaCommento(m, 'Foglio1', 1, 1, 'ciao', ADESSO);
    expect(impostaCommento(m, 'Foglio1', 1, 1, '', ADESSO)).toBe(true);
    expect(m.size).toBe(0);
  });

  it('un commento troppo lungo si taglia', () => {
    const m = new Map<string, Commento>();
    impostaCommento(m, 'F', 1, 1, 'x'.repeat(LUNGHEZZA_MASSIMA_COMMENTO + 50), ADESSO);
    expect(commentoDi(m, 'F', 1, 1)!.testo.length).toBe(LUNGHEZZA_MASSIMA_COMMENTO);
  });

  it('l\'elenco è in ordine di foglio, riga e colonna, e si può chiedere un foglio solo', () => {
    const m = new Map<string, Commento>();
    impostaCommento(m, 'B', 1, 1, 'b11', ADESSO);
    impostaCommento(m, 'A', 5, 2, 'a52', ADESSO);
    impostaCommento(m, 'A', 5, 1, 'a51', ADESSO);
    impostaCommento(m, 'A', 2, 9, 'a29', ADESSO);
    expect(elencaCommenti(m).map((c) => c.testo)).toEqual(['a29', 'a51', 'a52', 'b11']);
    expect(elencaCommenti(m, 'A').map((c) => c.testo)).toEqual(['a29', 'a51', 'a52']);
    expect(elencaCommenti(m, 'Nessuno')).toEqual([]);
  });

  it('un nome di foglio con segni strani funziona lo stesso', () => {
    const m = new Map<string, Commento>();
    impostaCommento(m, "Dati 2: l'anno!", 3, 4, 'ok', ADESSO);
    expect(elencaCommenti(m)).toEqual([{ foglio: "Dati 2: l'anno!", riga: 3, colonna: 4, testo: 'ok', data: ADESSO.toISOString() }]);
  });

  it('dal file: le voci rovinate si scartano, quelle buone restano', () => {
    const m = commentiDaDati([
      { foglio: 'F', riga: 1, colonna: 2, testo: 'buono', data: 'd' },
      { foglio: 'F', riga: 0, colonna: 2, testo: 'riga zero' },
      { foglio: 'F', riga: 1.5, colonna: 2, testo: 'riga con la virgola' },
      { foglio: 3, riga: 1, colonna: 1, testo: 'foglio non testo' },
      { foglio: 'F', riga: 1, colonna: 1, testo: '   ' },
      { foglio: 'F', riga: 2, colonna: 2, testo: 'senza data' },
      null, 'testo', 7,
    ]);
    expect(elencaCommenti(m).map((c) => c.testo)).toEqual(['buono', 'senza data']);
    expect(commentiDaDati(undefined).size).toBe(0);
    expect(commentiDaDati({}).size).toBe(0);
  });

  it('rinominare, togliere e copiare un foglio muovono i suoi commenti', () => {
    const m = new Map<string, Commento>();
    impostaCommento(m, 'Vecchio', 1, 1, 'uno', ADESSO);
    impostaCommento(m, 'Altro', 2, 2, 'due', ADESSO);
    rinominaFoglioCommenti(m, 'Vecchio', 'Nuovo');
    expect(elencaCommenti(m, 'Vecchio')).toEqual([]);
    expect(elencaCommenti(m, 'Nuovo').map((c) => c.testo)).toEqual(['uno']);
    copiaCommentiFoglio(m, 'Nuovo', 'Copia di Nuovo');
    expect(elencaCommenti(m, 'Copia di Nuovo').map((c) => c.testo)).toEqual(['uno']);
    togliCommentiFoglio(m, 'Nuovo');
    expect(elencaCommenti(m).map((c) => c.foglio).sort()).toEqual(['Altro', 'Copia di Nuovo']);
    expect(m.has(chiaveCommento('Altro', 2, 2))).toBe(true);
  });
});

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { statusMessage: string; activeTabId: string }
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>;
  setComment: (r: number, c: number, t: string) => boolean;
  renameCurrentSheet: (n: string) => Promise<void>;
};

let app: App;
let dentro: Dentro;

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  dentro = app as unknown as Dentro;
});
afterEach(() => { impostaLocaleNumeri('en'); });

const menu = (action: string, label = action) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label }, bubbles: true, composed: true }));
const griglia = async (): Promise<Griglia> => {
  const g = app.renderRoot.querySelector(`free-sheet-grid[data-tab-id="${dentro.activeTabId}"]`) as Griglia;
  await g.updateComplete;
  return g;
};
const dialogo = (): any => app.renderRoot.querySelector('free-dialogo-commento');
const seleziona = (doc: SheetDocument, r: number, c: number) => {
  doc.selection = { anchor: { row: r, col: c }, active: { row: r, col: c }, range: { startRow: r, endRow: r, startCol: c, endCol: c } } as SheetDocument['selection'];
};
async function apriSu(r: number, c: number): Promise<any> {
  const g = await griglia();
  seleziona(g.getDoc(), r, c);
  menu('insert-comment', 'Commento');
  await app.updateComplete;
  const d = dialogo();
  await d.updateComplete;
  return d;
}
async function scrivi(d: any, testo: string): Promise<void> {
  d.shadowRoot.querySelector('textarea[data-campo="testo"]').value = testo;
  d.shadowRoot.querySelector('button[data-azione="salva"]').click();
  await app.updateComplete;
}
const cella = (g: Griglia, indirizzo: string) => g.shadowRoot!.querySelector(`td[data-address="${indirizzo}"]`) as HTMLElement | null;

describe('T462: Inserisci > Commento', () => {
  it('apre la finestra sulla cella attiva, vuota e senza il pulsante Elimina', async () => {
    const d = await apriSu(3, 2);
    expect(d.cella).toBe('B3');
    expect(d.shadowRoot.querySelector('textarea').value).toBe('');
    expect(d.shadowRoot.querySelector('button[data-azione="elimina"]')).toBeNull();
  });

  it('Ctrl+Alt+M fa la stessa cosa', async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    await app.updateComplete;
    expect(dialogo()).not.toBeNull();
  });

  it('salvare scrive il commento: la cella ha l\'indicatore e il testo come suggerimento', async () => {
    const g = await griglia();
    const d = await apriSu(2, 1);
    await scrivi(d, 'verificare con il fornitore');
    expect(dialogo()).toBeNull();
    expect(dentro.statusMessage).toBe('Commento di A2 salvato');
    expect(commentoDi(g.getDoc().comments, 'Foglio1', 2, 1)!.testo).toBe('verificare con il fornitore');
    await g.updateComplete;
    const td = cella(g, 'A2')!;
    expect(td.classList.contains('has-comment')).toBe(true);
    expect(td.getAttribute('title')).toBe('verificare con il fornitore');
    expect(cella(g, 'A3')!.classList.contains('has-comment')).toBe(false);
  });

  it('riaprendo la finestra c\'è il testo di prima, con la data e il pulsante Elimina', async () => {
    const g = await griglia();
    await scrivi(await apriSu(1, 1), 'primo');
    const d = await apriSu(1, 1);
    expect(d.shadowRoot.querySelector('textarea').value).toBe('primo');
    expect(d.shadowRoot.querySelector('[data-campo="data"]').textContent).toContain('Scritto il');
    expect(d.shadowRoot.querySelector('button[data-azione="elimina"]')).not.toBeNull();
    expect(g.getDoc().comments.size).toBe(1);
  });

  it('Elimina toglie il commento e l\'indicatore', async () => {
    const g = await griglia();
    await scrivi(await apriSu(1, 1), 'da togliere');
    const d = await apriSu(1, 1);
    d.shadowRoot.querySelector('button[data-azione="elimina"]').click();
    await app.updateComplete;
    expect(g.getDoc().comments.size).toBe(0);
    expect(dentro.statusMessage).toBe('Commento di A1 eliminato');
    await g.updateComplete;
    expect(cella(g, 'A1')!.classList.contains('has-comment')).toBe(false);
  });

  it('Chiudi e Esc non cambiano niente', async () => {
    const g = await griglia();
    let d = await apriSu(1, 1);
    d.shadowRoot.querySelector('textarea').value = 'non salvato';
    d.shadowRoot.querySelector('button[data-azione="chiudi"]').click();
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    d = await apriSu(1, 1);
    d.shadowRoot.querySelector('.velo').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    expect(g.getDoc().comments.size).toBe(0);
  });

  it('Annulla e Ripeti tolgono e rimettono il commento', async () => {
    const g = await griglia();
    await scrivi(await apriSu(1, 1), 'provvisorio');
    menu('undo', 'Annulla');
    await vi.waitFor(() => expect(g.getDoc().comments.size).toBe(0));
    menu('redo', 'Ripeti');
    await vi.waitFor(() => expect(g.getDoc().comments.size).toBe(1));
    expect(commentoDi(g.getDoc().comments, 'Foglio1', 1, 1)!.testo).toBe('provvisorio');
  });

  it('rinominare il foglio sposta i commenti sul nuovo nome', async () => {
    const g = await griglia();
    await scrivi(await apriSu(2, 2), 'resta');
    await g.renameCurrentSheet('Conti');
    expect(elencaCommenti(g.getDoc().comments).map((c) => [c.foglio, c.testo])).toEqual([['Conti', 'resta']]);
    await g.updateComplete;
    expect(cella(g, 'B2')!.classList.contains('has-comment')).toBe(true);
  });
});

describe('T462: pannello laterale dei commenti', () => {
  const sidebar = (): any => app.renderRoot.querySelector('free-sidebar');

  it('senza commenti dice che non ce ne sono', async () => {
    menu('toggle-sidebar');
    await app.updateComplete;
    const s = sidebar();
    await s.updateComplete;
    expect(s.shadowRoot.querySelector('[data-elenco="vuoto"]')).not.toBeNull();
  });

  it('elenca i commenti in ordine e un clic porta alla cella', async () => {
    const g = await griglia();
    await scrivi(await apriSu(5, 2), 'secondo');
    await scrivi(await apriSu(1, 1), 'primo');
    menu('toggle-sidebar');
    await app.updateComplete;
    const s = sidebar();
    await s.updateComplete;
    const voci = Array.from(s.shadowRoot.querySelectorAll('button.commento-voce')) as HTMLElement[];
    expect(voci.map((v) => v.querySelector('.commento-cella')!.textContent)).toEqual(['A1', 'B5']);
    expect(voci.map((v) => v.querySelector('.commento-testo')!.textContent)).toEqual(['primo', 'secondo']);
    voci[1].click();
    await app.updateComplete;
    expect(g.getDoc().selection.active).toMatchObject({ row: 5, col: 2 });
  });

  it('un commento nuovo compare nell\'elenco senza chiudere il pannello', async () => {
    menu('toggle-sidebar');
    await app.updateComplete;
    await scrivi(await apriSu(2, 2), 'appena scritto');
    await app.updateComplete;
    const s = sidebar();
    await s.updateComplete;
    expect(s.shadowRoot.querySelectorAll('button.commento-voce').length).toBe(1);
  });
});

describe('T462: commenti nel file', () => {
  it('estrai e riapplica: i commenti tornano', async () => {
    const g = await griglia();
    await scrivi(await apriSu(4, 3), 'da salvare');
    const dati = await estraiDati(g.getDoc());
    expect(dati.comments).toEqual([expect.objectContaining({ foglio: 'Foglio1', riga: 4, colonna: 3, testo: 'da salvare' })]);

    const testo = serializeSheetDocumentData(dati);
    const altro = defaultDocumentStore.getOrCreateDocument('altra-scheda');
    await applicaDati(altro, deserializeSheetDocumentData(testo));
    expect(commentoDi(altro.comments, 'Foglio1', 4, 3)!.testo).toBe('da salvare');
  });

  it('un file vecchio senza commenti si apre senza commenti', async () => {
    const g = await griglia();
    const dati = await estraiDati(g.getDoc());
    const vecchio = JSON.parse(serializeSheetDocumentData(dati));
    delete vecchio.comments;
    const altro = defaultDocumentStore.getOrCreateDocument('vecchia-scheda');
    await applicaDati(altro, deserializeSheetDocumentData(JSON.stringify(vecchio)));
    expect(altro.comments.size).toBe(0);
  });

  it('esportare in Excel, OpenDocument o CSV avvisa che i commenti non si conservano; il formato nativo no', async () => {
    const g = await griglia();
    const senza = await estraiDati(g.getDoc());
    for (const f of ['xlsx', 'ods', 'csv'] as const) expect(avvisiEsportazione(senza, f).join(' ')).not.toContain('commenti');
    await scrivi(await apriSu(1, 1), 'nota');
    const con = await estraiDati(g.getDoc());
    // il formato Excel conserva i commenti: avvisano gli altri
    expect(avvisiEsportazione(con, 'xlsx').join(' ')).not.toContain('i commenti sulle celle');
    // anche OpenDocument conserva i commenti
    expect(avvisiEsportazione(con, 'ods').join(' ')).not.toContain('i commenti sulle celle');
    expect(avvisiEsportazione(con, 'csv').join(' ')).toContain('i commenti sulle celle');
    expect(avvisiEsportazione(con, 'fsheet')).toEqual([]);
  });
});
