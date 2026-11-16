import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import '../../src/components/filtro-colonna';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { extractDocumentData, serializeSheetDocumentData, deserializeSheetDocumentData } from '../../src/sheet/document-data';
import { CONDIZIONI_FILTRO, condizioneCompleta, filtroDaScelta, isRowVisible, valoriDellaCondizione, type ColumnFilter } from '../../src/sheet/filter';

describe('T501: condizioni del filtro', () => {
  it('ogni condizione chiede il numero giusto di valori', () => {
    expect(valoriDellaCondizione('none')).toBe(0);
    expect(valoriDellaCondizione('not_empty')).toBe(0);
    expect(valoriDellaCondizione('text_contains')).toBe(1);
    expect(valoriDellaCondizione('greater_than')).toBe(1);
    expect(valoriDellaCondizione('between')).toBe(2);
    expect(CONDIZIONI_FILTRO.map((c) => c.operator)).toHaveLength(new Set(CONDIZIONI_FILTRO.map((c) => c.operator)).size);
  });
  it('una condizione è completa solo con tutti i valori (numeri per i confronti numerici)', () => {
    expect(condizioneCompleta(undefined)).toBe(false);
    expect(condizioneCompleta({ operator: 'none' })).toBe(false);
    expect(condizioneCompleta({ operator: 'empty' })).toBe(true);
    expect(condizioneCompleta({ operator: 'text_contains' })).toBe(false);
    expect(condizioneCompleta({ operator: 'text_contains', value1: '  ' })).toBe(false);
    expect(condizioneCompleta({ operator: 'text_contains', value1: 'ab' })).toBe(true);
    expect(condizioneCompleta({ operator: 'greater_than', value1: 'abc' })).toBe(false);
    expect(condizioneCompleta({ operator: 'greater_than', value1: 10 })).toBe(true);
    expect(condizioneCompleta({ operator: 'between', value1: 1 })).toBe(false);
    expect(condizioneCompleta({ operator: 'between', value1: 1, value2: 5 })).toBe(true);
    expect(condizioneCompleta({ operator: 'equal_to', value1: 'testo' })).toBe(true);
  });
});

describe('T501: dalla scelta al filtro', () => {
  const tutti = ['a', 'b', 'c', ''];
  it('con tutto spuntato e senza condizione non serve un filtro', () => {
    expect(filtroDaScelta(2, tutti, new Set(tutti))).toBeNull();
    expect(filtroDaScelta(2, tutti, new Set(tutti), { operator: 'none' })).toBeNull();
    expect(filtroDaScelta(2, tutti, new Set(tutti), { operator: 'text_contains', value1: '' })).toBeNull();
  });
  it('con valori tolti il filtro tiene solo gli spuntati', () => {
    const f = filtroDaScelta(2, tutti, new Set(['a', '']))!;
    expect(f.col).toBe(2);
    expect([...f.selectedValues!]).toEqual(['a', '']);
    expect(f.condition).toBeUndefined();
  });
  it('con una condizione completa il filtro la porta, anche con tutti i valori spuntati', () => {
    const f = filtroDaScelta(1, tutti, new Set(tutti), { operator: 'greater_than', value1: 10 })!;
    expect(f.selectedValues).toBeUndefined();
    expect(f.condition).toEqual({ operator: 'greater_than', value1: 10 });
  });
  it('valori e condizione insieme: valgono entrambi (e)', () => {
    const f = filtroDaScelta(1, ['5', '12', '30'], new Set(['12', '30']), { operator: 'less_than', value1: 20 })!;
    const valore = (r: number) => ['x', '5', '12', '30'][r];
    const filtri = new Map<number, ColumnFilter>([[1, f]]);
    expect([1, 2, 3].map((r) => isRowVisible(r, filtri, (rr) => valore(rr)))).toEqual([false, true, false]);
  });
  it('una condizione con un solo valore non porta il secondo', () => {
    const f = filtroDaScelta(1, tutti, new Set(tutti), { operator: 'text_contains', value1: 'x', value2: 'y' })!;
    expect(f.condition).toEqual({ operator: 'text_contains', value1: 'x' });
  });
});

type Griglia = HTMLElement & { getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot; toggleFilter: () => void; undo: () => Promise<void>; redo: () => Promise<void> };
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Popup = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };
let griglia: Griglia;
let doc: SheetDocument;

// A: frutta, B: numeri; la riga 1 è l'intestazione
const DATI: Array<[string, string]> = [['Frutta', 'Numero'], ['mela', '5'], ['pera', '12'], ['mela', '7'], ['kiwi', '30'], ['', '1'], ['pera', '18']];

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  const app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
  for (let i = 0; i < DATI.length; i++) { await doc.client.setCell(doc.activeSheetName, i + 1, 1, DATI[i][0]); await doc.client.setCell(doc.activeSheetName, i + 1, 2, DATI[i][1]); }
  (griglia as unknown as { cellsCache: Map<string, unknown> }).cellsCache.clear();
  griglia.toggleFilter();
  await griglia.updateComplete;
});

const pausa = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const freccia = (col: number) => griglia.renderRoot.querySelector(`th.col-header[aria-colindex="${col + 1}"] .col-filter-btn`) as HTMLElement;
const popup = () => griglia.renderRoot.querySelector('free-filtro-colonna') as Popup | null;
async function apri(col: number): Promise<Popup> {
  freccia(col).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await griglia.updateComplete;
  const p = popup()!;
  await p.updateComplete;
  return p;
}
const valoriElencati = (p: Popup) => Array.from(p.shadowRoot.querySelectorAll('input[type="checkbox"]')).map((c) => (c as HTMLInputElement).dataset.valore);
const spunta = async (p: Popup, valore: string, su: boolean) => {
  const c = p.shadowRoot.querySelector(`input[type="checkbox"][data-valore="${valore}"]`) as HTMLInputElement;
  c.checked = su;
  c.dispatchEvent(new Event('change', { bubbles: true }));
  await p.updateComplete;
};
const azione = async (p: Popup, nome: string) => { (p.shadowRoot.querySelector(`button[data-azione="${nome}"]`) as HTMLButtonElement).click(); await pausa(); await griglia.updateComplete; };
const nascoste = () => [...doc.hiddenRows].sort((a, b) => a - b);
const scrivi = async (p: Popup, campo: string, v: string) => { const i = p.shadowRoot.querySelector(`[data-campo="${campo}"]`) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); await p.updateComplete; };
const scegliCondizione = async (p: Popup, op: string) => { const s = p.shadowRoot.querySelector('select[data-campo="condizione"]') as HTMLSelectElement; s.value = op; s.dispatchEvent(new Event('change', { bubbles: true })); await p.updateComplete; };

describe('T501: la finestrella del filtro nella griglia', () => {
  it('la freccia ▼ apre l\'elenco dei valori distinti della colonna, senza l\'intestazione, con le vuote in fondo', async () => {
    const p = await apri(1);
    expect(valoriElencati(p)).toEqual(['kiwi', 'mela', 'pera', '']);
    expect(p.shadowRoot.querySelector('[data-campo="conteggio"]')!.textContent).toContain('4 di 4');
    expect(Array.from(p.shadowRoot.querySelectorAll('input[type="checkbox"]')).every((c) => (c as HTMLInputElement).checked)).toBe(true);
  });

  it('togliendo due valori e premendo Applica si nascondono le loro righe', async () => {
    const p = await apri(1);
    await spunta(p, 'mela', false);
    await spunta(p, 'kiwi', false);
    await azione(p, 'applica');
    expect(nascoste()).toEqual([2, 4, 5]);          // mela (2, 4) e kiwi (5)
    expect([...doc.activeFilters.get(1)!.selectedValues!].sort()).toEqual(['', 'pera']);
    expect(popup()).toBeNull();
  });

  it('Annulla, Esc e il clic fuori chiudono senza cambiare niente', async () => {
    let p = await apri(1);
    await spunta(p, 'mela', false);
    await azione(p, 'chiudi');
    expect(popup()).toBeNull();
    expect(doc.activeFilters.size).toBe(0);
    p = await apri(1);
    p.shadowRoot.querySelector('.pannello')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await griglia.updateComplete;
    expect(popup()).toBeNull();
    p = await apri(1);
    p.shadowRoot.querySelector('.velo')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
    await griglia.updateComplete;
    expect(popup()).toBeNull();
    expect(nascoste()).toEqual([]);
  });

  it('tutto si annulla in un passo e si ripete', async () => {
    const p = await apri(1);
    await spunta(p, 'pera', false);
    await azione(p, 'applica');
    expect(nascoste()).toEqual([3, 7]);
    await griglia.undo();
    expect(nascoste()).toEqual([]);
    expect(doc.activeFilters.size).toBe(0);
    await griglia.redo();
    expect(nascoste()).toEqual([3, 7]);
  });

  it('riaprendo la finestrella si vede com\'è il filtro adesso, e "Rimuovi filtro" lo toglie', async () => {
    let p = await apri(1);
    await spunta(p, 'pera', false);
    await azione(p, 'applica');
    p = await apri(1);
    expect(p.shadowRoot.querySelector('button[data-azione="rimuovi"]')).not.toBeNull();
    const spuntati = Array.from(p.shadowRoot.querySelectorAll('input[type="checkbox"]')).filter((c) => (c as HTMLInputElement).checked).map((c) => (c as HTMLInputElement).dataset.valore);
    expect(spuntati).toEqual(['kiwi', 'mela', '']);
    await azione(p, 'rimuovi');
    expect(doc.activeFilters.size).toBe(0);
    expect(nascoste()).toEqual([]);
  });

  it('spuntare di nuovo tutti i valori toglie il filtro della colonna', async () => {
    let p = await apri(1);
    await spunta(p, 'pera', false);
    await azione(p, 'applica');
    p = await apri(1);
    await azione(p, 'tutti');
    await azione(p, 'applica');
    expect(doc.activeFilters.has(1)).toBe(false);
    expect(nascoste()).toEqual([]);
  });

  it('la ricerca restringe l\'elenco e "Seleziona tutto" e "Nessuno" valgono solo per i valori trovati', async () => {
    const p = await apri(1);
    await scrivi(p, 'ricerca', 'a');                 // mela, pera (kiwi e le vuote no)
    expect(valoriElencati(p)).toEqual(['mela', 'pera']);
    await azione(p, 'nessuno');                      // toglie solo mela e pera
    await scrivi(p, 'ricerca', '');
    const spuntati = Array.from(p.shadowRoot.querySelectorAll('input[type="checkbox"]')).filter((c) => (c as HTMLInputElement).checked).map((c) => (c as HTMLInputElement).dataset.valore);
    expect(spuntati).toEqual(['kiwi', '']);
    await azione(p, 'applica');
    expect(nascoste()).toEqual([2, 3, 4, 7]);
  });

  it('una condizione sui numeri ("Maggiore di 10") nasconde le altre righe', async () => {
    const p = await apri(2);
    await scegliCondizione(p, 'greater_than');
    await scrivi(p, 'valore1', '10');
    await azione(p, 'applica');
    expect(nascoste()).toEqual([2, 4, 6]);            // 5, 7 e 1 sono ≤ 10
    expect(doc.activeFilters.get(2)!.condition).toEqual({ operator: 'greater_than', value1: 10 });
  });

  it('una condizione incompleta non si applica e dice cosa manca', async () => {
    const p = await apri(2);
    await scegliCondizione(p, 'between');
    await scrivi(p, 'valore1', '5');
    await azione(p, 'applica');
    expect(popup()).not.toBeNull();
    expect(p.shadowRoot.querySelector('[data-campo="errore"]')!.textContent).toMatch(/Completa la condizione/);
    expect(doc.activeFilters.size).toBe(0);
    await scrivi(p, 'valore2', '12');
    await azione(p, 'applica');
    expect(nascoste()).toEqual([5, 6, 7]);            // restano 5, 12 e 7 (tra 5 e 12); 30, 1 e 18 sono fuori
  });

  it('filtri su colonne diverse valgono insieme (e)', async () => {
    let p = await apri(1);
    await spunta(p, 'kiwi', false);
    await spunta(p, 'pera', false);
    await spunta(p, '', false);
    await azione(p, 'applica');                       // restano solo le mele: righe 2 e 4
    expect(nascoste()).toEqual([3, 5, 6, 7]);
    p = await apri(2);
    await scegliCondizione(p, 'greater_than');
    await scrivi(p, 'valore1', '6');
    await azione(p, 'applica');                       // delle mele (5 e 7) resta il 7
    expect(nascoste()).toEqual([2, 3, 5, 6, 7]);
  });

  it('la freccia di una colonna con il filtro è evidenziata', async () => {
    const p = await apri(1);
    await spunta(p, 'pera', false);
    await azione(p, 'applica');
    expect(freccia(1).classList.contains('active')).toBe(true);
    expect(freccia(2).classList.contains('active')).toBe(false);
  });

  it('valori e condizione del filtro sopravvivono al salvataggio nel file nativo', async () => {
    let p = await apri(1);
    await spunta(p, 'pera', false);
    await azione(p, 'applica');
    p = await apri(2);
    await scegliCondizione(p, 'between');
    await scrivi(p, 'valore1', '1');
    await scrivi(p, 'valore2', '20');
    await azione(p, 'applica');
    const dati = deserializeSheetDocumentData(serializeSheetDocumentData(await extractDocumentData(doc, doc.styles)));
    const colonne = dati.filters!.columns;
    expect(colonne.map((c) => c.col)).toEqual([1, 2]);
    expect(colonne[0].selectedValues!.sort()).toEqual(['', 'kiwi', 'mela']);
    expect(colonne[1].condition).toEqual({ operator: 'between', value1: 1, value2: 20 });
    expect(dati.filters!.active).toBe(true);
  });
});
