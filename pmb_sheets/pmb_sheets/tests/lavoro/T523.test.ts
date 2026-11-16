import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import '../../src/components/dialogo-regole';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import type { DataValidationRule } from '../../src/sheet/data-validation';
import {
  creaRegolaConvalida, datiDaConvalida, descriviConvalida, elencaConvalide, firmaConvalida, leggiIntervalli, type DatiConvalida,
} from '../../src/sheet/regole-dialogo';

const elenco = (azione: 'reject' | 'warn' = 'reject', id = 'v'): DataValidationRule => ({ id, type: 'list', listItems: ['a', 'b'], action: azione, allowEmpty: true });
const A = (r1: number, r2: number, c1: number, c2: number) => ({ startRow: r1, endRow: r2, startCol: c1, endCol: c2 });

describe('T523: aree e regole della convalida (parte pura)', () => {
  it('più aree separate da virgola o punto e virgola', () => {
    expect(leggiIntervalli('A1:A5, C1:C5;D2')).toEqual([A(1, 5, 1, 1), A(1, 5, 3, 3), A(2, 2, 4, 4)]);
    expect(leggiIntervalli('A1:A5, zz')).toBeNull();
    expect(leggiIntervalli(' ')).toBeNull();
  });
  it('creaRegolaConvalida dà tutte le aree e conta le celle di tutte per il limite', () => {
    const base: DatiConvalida = { intervallo: 'A1:A2, C1', tipo: 'elenco', voci: 'a, b', operatore: 'between', valore1: '', valore2: '', azione: 'rifiuta', messaggio: '', ammettiVuote: true };
    const e = creaRegolaConvalida(base, 'x');
    expect(e.ok && e.valore.aree).toEqual([A(1, 2, 1, 1), A(1, 1, 3, 3)]);
    expect(e.ok && e.valore.intervallo).toEqual(A(1, 2, 1, 1));
    expect(creaRegolaConvalida({ ...base, intervallo: 'A1:A6000, B1:B6000' }, 'x').ok).toBe(false);
  });
  it('la firma non guarda l\'id né l\'ordine dei campi', () => {
    expect(firmaConvalida({ id: 'a', type: 'list', listItems: ['x'], action: 'reject' })).toBe(firmaConvalida({ action: 'reject', listItems: ['x'], type: 'list', id: 'b' }));
    expect(firmaConvalida(elenco('reject'))).not.toBe(firmaConvalida(elenco('warn')));
  });
  it('le celle si raggruppano per regola e si ricompongono in rettangoli', () => {
    const m = new Map<string, DataValidationRule>();
    // regola 1: un rettangolo B2:C3 e una cella isolata E5; regola 2: A1
    for (const k of ['2:2', '2:3', '3:2', '3:3', '5:5']) m.set(k, elenco('reject', `val-${k}`));
    m.set('1:1', { id: 'n', type: 'number', operator: 'between', value1: 1, value2: 9, action: 'warn' });
    const l = elencaConvalide(m);
    expect(l.map((x) => x.aree)).toEqual([[A(1, 1, 1, 1)], [A(2, 3, 2, 3), A(5, 5, 5, 5)]]);
    // a forma di L: due rettangoli
    const L = new Map<string, DataValidationRule>(['1:1', '2:1', '3:1', '3:2'].map((k) => [k, elenco()] as const));
    expect(elencaConvalide(L)[0].aree).toEqual([A(1, 3, 1, 1), A(3, 3, 2, 2)]);   // prima la colonna più lunga, poi il resto
  });
  it('dalla regola ai dati della finestra e ritorno', () => {
    const regole: DataValidationRule[] = [
      { ...elenco('warn'), helpText: 'solo a o b' },
      { id: 'v', type: 'number', operator: 'between', value1: 1, value2: 9, action: 'reject', allowEmpty: false },
      { id: 'v', type: 'text_length', operator: 'less_than', value1: 5, action: 'reject', allowEmpty: true },
      { id: 'v', type: 'checkbox', action: 'reject', allowEmpty: true },
    ];
    for (const r of regole) {
      const d = datiDaConvalida(r, [A(1, 2, 1, 1), A(4, 4, 3, 3)])!;
      expect(d.intervallo).toBe('A1:A2, C4');
      const e = creaRegolaConvalida(d, 'v');
      expect(e.ok && firmaConvalida(e.valore.regola)).toBe(firmaConvalida(r));
    }
    expect(datiDaConvalida({ id: 'v', type: 'date', action: 'reject' }, [A(1, 1, 1, 1)])).toBeNull();
  });
  it('la descrizione nell\'elenco', () => {
    expect(descriviConvalida(elenco())).toBe('Elenco: a, b · rifiuta');
    expect(descriviConvalida({ id: 'v', type: 'number', operator: 'between', value1: 1, value2: 9, action: 'warn' })).toBe('Numero compreso tra 1 e 9 · avvisa');
    expect(descriviConvalida({ id: 'v', type: 'text_length', operator: 'less_than', value1: 5, action: 'reject' })).toBe('Lunghezza del testo minore di 5 · rifiuta');
    expect(descriviConvalida({ id: 'v', type: 'custom', action: 'reject' })).toBe('Formula (dal file) · rifiuta');
  });
});

// ---- nella griglia ----
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>;
  copy: () => Promise<void>; paste: (t?: string) => Promise<void>; pasteSpecial: (t: string) => Promise<void>;
  fillDown: () => Promise<void>; fillRight: () => Promise<void>; replaceAllAction: () => Promise<void>; replaceCurrent: () => Promise<void>; clearSelection: () => Promise<void>;
  undo: () => Promise<void>;
  sostituisciConvalida: (f: string | null, aree: ReturnType<typeof A>[], r: DataValidationRule) => void; eliminaConvalida: (f: string) => void;
  elencoConvalide: () => ReturnType<typeof elencaConvalide>;
};
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode; statusMessage: string };
let app: App;
let griglia: Griglia;
let doc: SheetDocument;
let messaggi: string[];

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
  doc = griglia.getDoc();
  messaggi = [];
  griglia.addEventListener('status-message', (e) => messaggi.push((e as CustomEvent<{ message: string }>).detail.message));
});

const sel = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc.selection = { anchor: { row: r1, col: c1 }, active: { row: r2, col: c2 }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 } }; };
const raw = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw;
const conRegola = (r1: number, r2: number, c: number, regola: DataValidationRule) => { for (let r = r1; r <= r2; r++) doc.dataValidations.set(`${r}:${c}`, { ...regola, id: `val-${r}:${c}` }); };

describe('T523: la convalida vale anche incollando e riempiendo', () => {
  it('Incolla da fuori: con «Rifiuta» la cella sbagliata non si scrive, le altre sì; lo dice; Annulla torna indietro', async () => {
    conRegola(1, 3, 2, elenco());
    sel(1, 2);
    await griglia.paste('a\nx\nb');
    expect([await raw(1, 2), await raw(2, 2), await raw(3, 2)]).toEqual(['a', '', 'b']);
    expect(messaggi.some((m) => m.startsWith('Incolla: 1 cella non scritta'))).toBe(true);
    // le statistiche della selezione (l'area incollata) arrivano dopo e non devono coprire l'avviso con "Pronto"
    await new Promise((r) => setTimeout(r, 80)); await app.updateComplete;
    expect(app.statusMessage).toContain('Incolla: 1 cella non scritta');
    await griglia.undo();
    expect([await raw(1, 2), await raw(3, 2)]).toEqual(['', '']);
  });
  it('con «Mostra un avviso» si scrive ma si segnala', async () => {
    conRegola(1, 3, 2, elenco('warn'));
    sel(1, 2);
    await griglia.paste('a\nx\nb');
    expect(await raw(2, 2)).toBe('x');
    expect(messaggi.some((m) => m.includes('avviso: 1 cella con un valore che non rispetta la convalida'))).toBe(true);
  });
  it('le celle senza convalida non si toccano; svuotare resta possibile', async () => {
    conRegola(1, 1, 2, { ...elenco(), allowEmpty: false });
    await doc.client.setCell(doc.activeSheetName, 1, 2, 'a');
    sel(1, 1);
    await griglia.paste('x\tx');
    expect([await raw(1, 1), await raw(1, 2)]).toEqual(['x', 'a']);
    sel(1, 2);
    await griglia.clearSelection();
    expect(await raw(1, 2)).toBe('');
  });
  it('copiare una cella con la sua convalida resta una copia fedele (la regola arriva con il valore)', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    doc.dataValidations.set('1:1', elenco());   // dato vecchio che non rispetta la regola, scritto prima della regola
    sel(1, 1);
    await griglia.copy();
    sel(5, 5);
    await griglia.paste('');
    expect(await raw(5, 5)).toBe('x');
  });
  it('ma incollare su una cella che ha già la sua convalida la controlla', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    conRegola(5, 5, 5, elenco());
    sel(1, 1);
    await griglia.copy();
    sel(5, 5);
    await griglia.paste('');
    expect(await raw(5, 5)).toBe('');
  });
  it('Incolla speciale > Solo valori controlla', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    conRegola(5, 5, 5, elenco());
    sel(1, 1);
    await griglia.copy();
    sel(5, 5);
    await griglia.pasteSpecial('values_only');
    expect(await raw(5, 5)).toBe('');
  });
  it('Ctrl+D e Ctrl+R controllano', async () => {
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    conRegola(2, 3, 1, elenco());
    sel(1, 1, 3, 1);
    await griglia.fillDown();
    expect([await raw(2, 1), await raw(3, 1)]).toEqual(['', '']);
    expect(messaggi.some((m) => m.startsWith('Ctrl+D: 2 celle non scritte'))).toBe(true);
    conRegola(1, 1, 2, elenco());
    sel(1, 1, 1, 2);
    await griglia.fillRight();
    expect(await raw(1, 2)).toBe('');
  });
  it('Sostituisci e Sostituisci tutto controllano', async () => {
    conRegola(1, 2, 1, elenco());
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'a');
    await doc.client.setCell(doc.activeSheetName, 2, 1, 'a');
    (griglia as unknown as { findQuery: string; replaceQuery: string }).findQuery = 'a';
    (griglia as unknown as { findQuery: string; replaceQuery: string }).replaceQuery = 'z';
    sel(1, 1);
    await griglia.replaceCurrent();
    expect(await raw(1, 1)).toBe('a');
    await griglia.replaceAllAction();
    expect([await raw(1, 1), await raw(2, 1)]).toEqual(['a', 'a']);
    (griglia as unknown as { replaceQuery: string }).replaceQuery = 'b';
    await griglia.replaceAllAction();
    expect([await raw(1, 1), await raw(2, 1)]).toEqual(['b', 'b']);
  });
});

describe('T523: l\'elenco delle convalide nella griglia', () => {
  it('sostituisce su tutte le aree della regola vecchia, elimina, e Annulla rimette', async () => {
    conRegola(1, 2, 1, elenco());
    conRegola(5, 5, 3, elenco());
    const [v] = griglia.elencoConvalide();
    expect(v.aree).toEqual([A(1, 2, 1, 1), A(5, 5, 3, 3)]);
    griglia.sostituisciConvalida(v.firma, [A(1, 3, 2, 2)], elenco('warn'));
    expect([...doc.dataValidations.keys()].sort()).toEqual(['1:2', '2:2', '3:2']);
    expect(doc.dataValidations.get('2:2')!.action).toBe('warn');
    await griglia.undo();
    expect([...doc.dataValidations.keys()].sort()).toEqual(['1:1', '2:1', '5:3']);
    griglia.eliminaConvalida(griglia.elencoConvalide()[0].firma);
    expect(doc.dataValidations.size).toBe(0);
    await griglia.undo();
    expect(doc.dataValidations.size).toBe(3);
  });
});

describe('T523: la finestra Convalida dei dati con l\'elenco', () => {
  const dialogo = () => app.renderRoot.querySelector('free-dialogo-regole') as (HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }) | null;
  const apri = async () => {
    (app as unknown as { handleMenuAction: (e: CustomEvent) => void }).handleMenuAction(new CustomEvent('menu-action', { detail: { action: 'data-validation', label: '' } }));
    await app.updateComplete;
    const d = dialogo()!;
    await d.updateComplete;
    return d;
  };
  const campo = (d: { shadowRoot: ShadowRoot }, n: string) => d.shadowRoot.querySelector(`[data-campo="${n}"]`) as HTMLInputElement;
  it('elenca le convalide; Modifica carica i dati e Fine la sostituisce su tutte le aree; Elimina la toglie e l\'elenco si aggiorna', async () => {
    conRegola(1, 2, 1, { ...elenco(), helpText: 'solo a o b' });
    conRegola(5, 5, 3, { ...elenco(), helpText: 'solo a o b' });
    conRegola(1, 1, 4, { id: 'n', type: 'number', operator: 'between', value1: 1, value2: 9, action: 'warn' });
    let d = await apri();
    const descr = () => Array.from(d.shadowRoot.querySelectorAll('[data-elenco] .descr')).map((x) => x.textContent);
    expect(descr()).toEqual(['Elenco: a, b · rifiuta', 'Numero compreso tra 1 e 9 · avvisa']);
    expect(d.shadowRoot.querySelector('[data-elenco] .dove')!.textContent).toBe('A1:A2 +1');
    (d.shadowRoot.querySelector('[data-elenco] li [data-azione="modifica"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0)); await d.updateComplete;
    expect(campo(d, 'tipo').value).toBe('elenco');
    expect(campo(d, 'intervallo').value).toBe('A1:A2, C5');
    expect(campo(d, 'voci').value).toBe('a, b');
    expect(campo(d, 'messaggio').value).toBe('solo a o b');
    campo(d, 'voci').value = 'a, b, c';
    (d.shadowRoot.querySelector('button[data-azione="fine"]') as HTMLButtonElement).click();
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    expect(doc.dataValidations.get('5:3')!.listItems).toEqual(['a', 'b', 'c']);
    expect(doc.dataValidations.get('2:1')!.listItems).toEqual(['a', 'b', 'c']);
    expect(app.statusMessage).toBe('Convalida modificata: 3 celle');

    d = await apri();
    (d.shadowRoot.querySelectorAll('[data-elenco] li [data-azione="elimina"]')[1] as HTMLButtonElement).click();
    await app.updateComplete; await d.updateComplete;
    expect(descr()).toEqual(['Elenco: a, b, c · rifiuta']);
    expect(doc.dataValidations.has('1:4')).toBe(false);
  });
});
