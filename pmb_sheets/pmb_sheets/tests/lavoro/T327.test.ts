import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { statusMessage: string; activeTabId: string }
type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; startEditing: (r?: boolean, c?: string) => Promise<void>; commitEdit: () => Promise<void>; editValue: string };

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
const dialogo = (): any => app.renderRoot.querySelector('free-dialogo-regole');
const seleziona = (doc: SheetDocument, r1: number, c1: number, r2: number, c2: number) => {
  doc.selection = { anchor: { row: r1, col: c1 }, active: { row: r2, col: c2 }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 } } as SheetDocument['selection'];
};
async function apri(azione: string, r1 = 1, c1 = 1, r2 = r1, c2 = c1): Promise<{ g: Griglia; d: any }> {
  const g = await griglia();
  seleziona(g.getDoc(), r1, c1, r2, c2);
  menu(azione);
  await app.updateComplete;
  const d = dialogo();
  if (d) await d.updateComplete;
  return { g, d };
}
const campo = (d: any, nome: string): any => d.shadowRoot.querySelector(`[data-campo="${nome}"]`);
async function scrivi(d: any, nome: string, valore: string): Promise<void> { campo(d, nome).value = valore; campo(d, nome).dispatchEvent(new Event('input', { bubbles: true })); await d.updateComplete; }
async function scegli(d: any, nome: string, valore: string): Promise<void> { campo(d, nome).value = valore; campo(d, nome).dispatchEvent(new Event('change', { bubbles: true })); await d.updateComplete; }
const fine = (d: any) => (d.shadowRoot.querySelector('button[data-azione="fine"]') as HTMLButtonElement).click();

describe('T327: apertura delle finestre dal menu', () => {
  it('Dati › Formattazione condizionale apre la finestra con la selezione come intervallo', async () => {
    const { d } = await apri('conditional-format', 2, 2, 5, 3);
    expect(d).not.toBeNull();
    expect(d.modo).toBe('condizionale');
    expect(campo(d, 'intervallo').value).toBe('B2:C5');
  });

  it('Dati › Convalida dei dati apre la finestra della convalida; una cella sola si scrive senza i due punti', async () => {
    const { d } = await apri('data-validation', 4, 3);
    expect(d.modo).toBe('convalida');
    expect(campo(d, 'intervallo').value).toBe('C4');
  });

  it('Annulla, Esc e il clic fuori chiudono la finestra senza cambiare niente', async () => {
    const { g, d } = await apri('conditional-format');
    (d.shadowRoot.querySelector('button[data-azione="annulla"]') as HTMLButtonElement).click();
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    const { d: d2 } = await apri('data-validation');
    campo(d2, 'intervallo').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    expect(g.getDoc().conditionalFormats).toHaveLength(0);
    expect(g.getDoc().dataValidations.size).toBe(0);
  });

  it('una finestra aperta con dati sbagliati resta aperta e dice perché', async () => {
    const { d } = await apri('conditional-format');
    fine(d);
    await d.updateComplete;
    expect(dialogo()).not.toBeNull();
    expect((d.shadowRoot.querySelector('.errore')?.textContent ?? '').trim()).toContain('numero');
  });
});

describe('T327: formattazione condizionale applicata', () => {
  it('la regola entra nel foglio, la finestra si chiude e la barra di stato lo dice', async () => {
    const { g, d } = await apri('conditional-format', 1, 1, 3, 1);
    await scrivi(d, 'valore1', '5');
    fine(d);
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    const regole = g.getDoc().conditionalFormats;
    expect(regole).toHaveLength(1);
    expect(regole[0]).toMatchObject({ type: 'cell_value', operator: 'greater_than', value1: 5, range: { startRow: 1, endRow: 3, startCol: 1, endCol: 1 } });
    expect(dentro.statusMessage).toBe('Regola di formattazione condizionale aggiunta');
  });

  it('la cella che soddisfa la regola si colora, le altre no', async () => {
    const { g, d } = await apri('conditional-format', 1, 1, 2, 1);
    const doc = g.getDoc();
    await doc.client.setCell('Foglio1', 1, 1, '7');
    await doc.client.setCell('Foglio1', 2, 1, '3');
    await scrivi(d, 'valore1', '5');
    await scrivi(d, 'sfondo', '#ffff00');
    fine(d);
    await app.updateComplete;
    seleziona(doc, 10, 10, 10, 10);
    (g as any).requestUpdate();
    await g.updateComplete;
    await vi.waitFor(() => {
      const celle = Array.from(g.shadowRoot!.querySelectorAll('td.sheet-cell')) as HTMLElement[];
      const a1 = celle.find((c) => (c as any).dataset.row === '1' && (c as any).dataset.col === '1')!;
      const a2 = celle.find((c) => (c as any).dataset.row === '2' && (c as any).dataset.col === '1')!;
      expect(a1.style.backgroundColor).not.toBe('');
      expect(a2.style.backgroundColor).toBe('');
    });
  });

  it('in italiano un numero con la virgola decimale conta come numero', async () => {
    impostaLocaleNumeri('it');
    const { g, d } = await apri('conditional-format', 1, 1, 1, 1);
    const doc = g.getDoc();
    await doc.client.setCell('Foglio1', 1, 1, '7.5');
    await scrivi(d, 'valore1', '5');
    fine(d);
    await app.updateComplete;
    seleziona(doc, 10, 10, 10, 10);
    (g as any).requestUpdate();
    await g.updateComplete;
    await vi.waitFor(() => {
      const a1 = (Array.from(g.shadowRoot!.querySelectorAll('td.sheet-cell')) as HTMLElement[]).find((c) => (c as any).dataset.row === '1' && (c as any).dataset.col === '1')!;
      expect(a1.textContent).toContain('7,5');
      expect(a1.style.backgroundColor).not.toBe('');
    });
  });

  it('più regole si sommano nell\'elenco', async () => {
    const { g, d } = await apri('conditional-format');
    await scrivi(d, 'valore1', '1');
    fine(d);
    await app.updateComplete;
    const { d: d2 } = await apri('conditional-format');
    await scegli(d2, 'condizione', 'contiene');
    await scrivi(d2, 'valore1', 'ok');
    fine(d2);
    await app.updateComplete;
    expect(g.getDoc().conditionalFormats.map((r) => r.type)).toEqual(['cell_value', 'text']);
  });
});

describe('T327: convalida dei dati applicata', () => {
  it('la regola va su ogni cella dell\'intervallo, con la sua chiave', async () => {
    const { g, d } = await apri('data-validation', 2, 2, 3, 3);
    await scrivi(d, 'voci', 'rosso, verde');
    fine(d);
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    const mappa = g.getDoc().dataValidations;
    expect(Array.from(mappa.keys()).sort()).toEqual(['2:2', '2:3', '3:2', '3:3']);
    expect(mappa.get('3:2')).toMatchObject({ id: 'val-3:2', type: 'list', listItems: ['rosso', 'verde'], action: 'reject' });
    expect(dentro.statusMessage).toBe('Convalida applicata a 4 celle');
  });

  it('con la convalida un valore non ammesso viene rifiutato dalla cella', async () => {
    const { g, d } = await apri('data-validation', 1, 1);
    await scrivi(d, 'voci', 'si, no');
    fine(d);
    await app.updateComplete;
    const doc = g.getDoc();
    seleziona(doc, 1, 1, 1, 1);
    await g.startEditing(true, '');
    g.editValue = 'forse';
    await g.commitEdit();
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('');
    seleziona(doc, 1, 1, 1, 1);
    await g.startEditing(true, '');
    g.editValue = 'si';
    await g.commitEdit();
    expect((await doc.client.getCell('Foglio1', 1, 1)).raw).toBe('si');
  });

  it('un intervallo troppo grande è rifiutato nella finestra e il foglio non cambia', async () => {
    const { g, d } = await apri('data-validation', 1, 1);
    await scrivi(d, 'intervallo', 'A1:A20000');
    await scrivi(d, 'voci', 'a');
    fine(d);
    await d.updateComplete;
    expect(dialogo()).not.toBeNull();
    expect(g.getDoc().dataValidations.size).toBe(0);
  });
});
