import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';
import { creaNomeIntervallo, riferimentoNome } from '../../src/sheet/nomi-dialogo';
import { applicaDati, estraiDati } from '../../src/formati/documento';

describe('T461: controllo di nome e intervallo', () => {
  const base = { nome: 'Totale', intervallo: 'A1:B10', foglio: 'Foglio1', esistenti: [] as string[] };

  it('un nome e un intervallo buoni diventano un intervallo denominato', () => {
    const e = creaNomeIntervallo(base);
    expect(e).toEqual({ ok: true, valore: { name: 'Totale', sheetName: 'Foglio1', rangeString: 'A1:B10', startRow: 1, startCol: 1, endRow: 10, endCol: 2 } });
  });

  it('una cella sola si scrive come cella', () => {
    const e = creaNomeIntervallo({ ...base, intervallo: 'd1' });
    expect(e.ok && e.valore.rangeString).toBe('D1');
  });

  it.each([
    ['', 'Scrivi un nome.'],
    ['due parole', 'Il nome non è valido'],
    ['A1', 'Il nome non è valido'],
    ['1abc', 'Il nome non è valido'],
    ['VERO', 'Il nome non è valido'],
  ])('il nome "%s" è rifiutato', (nome, messaggio) => {
    const e = creaNomeIntervallo({ ...base, nome });
    expect(e.ok).toBe(false);
    expect(!e.ok && e.errore).toContain(messaggio);
  });

  it('due nomi uguali, anche con maiuscole diverse, non sono ammessi', () => {
    const e = creaNomeIntervallo({ ...base, nome: 'TOTALE', esistenti: ['Totale'] });
    expect(!e.ok && e.errore).toBe('Esiste già un intervallo con questo nome.');
  });

  it.each(['', 'A1:', 'pippo', 'A1:B2:C3', 'A0'])('l\'intervallo "%s" è rifiutato', (intervallo) => {
    const e = creaNomeIntervallo({ ...base, intervallo });
    expect(!e.ok && e.errore).toContain('Scrivi l\'intervallo');
  });

  it('il riferimento per il motore mette gli apici ai fogli con spazi', () => {
    const n = (creaNomeIntervallo({ ...base, foglio: 'Dati 2' }) as { ok: true; valore: Parameters<typeof riferimentoNome>[0] }).valore;
    expect(riferimentoNome(n)).toBe("'Dati 2'!A1:B10");
    const m = (creaNomeIntervallo(base) as { ok: true; valore: Parameters<typeof riferimentoNome>[0] }).valore;
    expect(riferimentoNome(m)).toBe('Foglio1!A1:B10');
  });
});

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { statusMessage: string; activeTabId: string }
type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown> };

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
const dialogo = (): any => app.renderRoot.querySelector('free-dialogo-nomi');
const campo = (d: any, nome: string): any => d.shadowRoot.querySelector(`[data-campo="${nome}"]`);
const valore = async (doc: SheetDocument, r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).value;

async function apri(): Promise<any> {
  menu('named-ranges', 'Intervalli denominati');
  await app.updateComplete;
  const d = dialogo();
  await d.updateComplete;
  return d;
}
async function aggiungi(d: any, nome: string, intervallo: string): Promise<void> {
  campo(d, 'nome').value = nome;
  campo(d, 'intervallo').value = intervallo;
  d.shadowRoot.querySelector('button[data-azione="aggiungi"]').click();
  await vi.waitFor(async () => { await app.updateComplete; await d.updateComplete; });
}

describe('T461: Dati > Intervalli denominati', () => {
  it('apre la finestra, vuota, con la selezione proposta come intervallo', async () => {
    const g = await griglia();
    g.getDoc().selection = { anchor: { row: 2, col: 1 }, active: { row: 4, col: 1 }, range: { startRow: 2, endRow: 4, startCol: 1, endCol: 1 } } as SheetDocument['selection'];
    const d = await apri();
    expect(campo(d, 'intervallo').value).toBe('A2:A4');
    expect(d.shadowRoot.querySelector('[data-elenco="vuoto"]')).not.toBeNull();
  });

  it('aggiungere un nome lo mostra nell\'elenco e lo fa usare nelle formule', async () => {
    const g = await griglia();
    const doc = g.getDoc();
    await doc.client.setCell('Foglio1', 1, 1, '10');
    await doc.client.setCell('Foglio1', 2, 1, '20');
    await doc.client.setCell('Foglio1', 3, 1, '30');
    const d = await apri();
    await aggiungi(d, 'Vendite', 'A1:A3');
    await vi.waitFor(() => expect(d.nomi.map((n: { name: string }) => n.name)).toEqual(['Vendite']));
    await d.updateComplete;
    expect(d.shadowRoot.querySelector('tr[data-nome="Vendite"]')?.textContent).toContain('Foglio1!A1:A3');

    await doc.client.setCell('Foglio1', 1, 3, '=SOMMA(Vendite)');
    expect(await valore(doc, 1, 3)).toMatchObject({ kind: 'number', value: 60 });
  });

  it('un nome non valido o doppio mostra l\'errore e non cambia niente', async () => {
    const g = await griglia();
    const d = await apri();
    await aggiungi(d, 'due parole', 'A1');
    expect(campo(d, 'errore').textContent).toContain('Il nome non è valido');
    expect(g.getDoc().namedRanges.getAll()).toEqual([]);
    await aggiungi(d, 'Uno', 'A1');
    await aggiungi(d, 'uno', 'B2');
    await d.updateComplete;
    expect(campo(d, 'errore').textContent).toContain('Esiste già');
    expect(g.getDoc().namedRanges.getAll().map((n) => n.name)).toEqual(['Uno']);
  });

  it('eliminare un nome lo toglie e le formule che lo usavano vanno in errore', async () => {
    const g = await griglia();
    const doc = g.getDoc();
    await doc.client.setCell('Foglio1', 1, 1, '5');
    const d = await apri();
    await aggiungi(d, 'Cinque', 'A1');
    await doc.client.setCell('Foglio1', 1, 2, '=Cinque*2');
    expect(await valore(doc, 1, 2)).toMatchObject({ value: 10 });

    await vi.waitFor(() => expect(d.shadowRoot.querySelector('tr[data-nome="Cinque"]')).not.toBeNull());
    (d.shadowRoot.querySelector('tr[data-nome="Cinque"] button[data-azione="elimina"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(doc.namedRanges.getAll()).toEqual([]));
    expect(await valore(doc, 1, 2)).toMatchObject({ kind: 'error' });
  });

  it('Chiudi e Esc tolgono la finestra', async () => {
    let d = await apri();
    d.shadowRoot.querySelector('button[data-azione="chiudi"]').click();
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    d = await apri();
    d.shadowRoot.querySelector('.velo').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await app.updateComplete;
    expect(dialogo()).toBeNull();
  });
});

describe('T461: i nomi nel file salvato', () => {
  it('estrai e riapplica: i nomi tornano e le formule che li usano si calcolano', async () => {
    const g = await griglia();
    const doc = g.getDoc();
    await doc.client.setCell('Foglio1', 1, 1, '7');
    await g.addNamedRange({ name: 'Sette', sheetName: 'Foglio1', rangeString: 'A1', startRow: 1, startCol: 1, endRow: 1, endCol: 1 });
    await doc.client.setCell('Foglio1', 1, 2, '=Sette+1');
    expect(await valore(doc, 1, 2)).toMatchObject({ value: 8 });

    const dati = await estraiDati(doc);
    const altro = defaultDocumentStore.getOrCreateDocument('altra-scheda');
    await applicaDati(altro, dati);
    expect(altro.namedRanges.getAll().map((n) => n.name)).toEqual(['Sette']);
    expect(await valore(altro, 1, 2)).toMatchObject({ kind: 'number', value: 8 });
  });
});
