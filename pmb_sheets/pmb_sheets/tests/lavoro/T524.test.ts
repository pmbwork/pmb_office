import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { formulaRegolaDopoStruttura } from '../../src/sheet/sposta-struttura';
import { regolaDopoSpostamento, type Spostamento } from '../../src/sheet/sposta-con-celle';
import type { ConditionalFormatRule } from '../../src/sheet/conditional-format';

const R = (r1: number, r2: number, c1: number, c2: number) => ({ startRow: r1, endRow: r2, startCol: c1, endCol: c2 });

describe('T524: formule delle regole dopo inserire ed eliminare (parte pura)', () => {
  const f = (formula: string, range = R(1, 5, 3, 3), op: { tipo: 'insert_rows' | 'delete_rows' | 'insert_cols' | 'delete_cols'; indice: number; conta: number }, foglioRegola = 'F', foglioOp = 'F') =>
    formulaRegolaDopoStruttura(formula, range, foglioRegola, foglioOp, op);
  it('righe inserite sopra: i riferimenti scendono', () => {
    expect(f('=A1>25', R(1, 5, 3, 3), { tipo: 'insert_rows', indice: 1, conta: 2 })).toBe('=A3>25');
    expect(f('=$A$1>25', R(1, 5, 3, 3), { tipo: 'insert_rows', indice: 1, conta: 1 })).toBe('=$A$2>25');
  });
  it('righe inserite dentro o sotto: si sposta solo ciò che sta dopo', () => {
    expect(f('=A1+$B$10>0', R(1, 5, 3, 3), { tipo: 'insert_rows', indice: 5, conta: 1 })).toBe('=A1+$B$11>0');
  });
  it('eliminando la prima riga dell\'intervallo la formula si legge dalla nuova prima cella (non diventa #REF!)', () => {
    // C2 guardava A2: dopo l'eliminazione è C1 e guarda A1
    expect(f('=A1>25', R(1, 5, 3, 3), { tipo: 'delete_rows', indice: 1, conta: 1 })).toBe('=A1>25');
    expect(f('=A1>A$1', R(1, 5, 3, 3), { tipo: 'delete_rows', indice: 1, conta: 1 })).toContain('#REF!');
  });
  it('un riferimento assoluto a una riga eliminata diventa #REF!', () => {
    expect(f('=$A$3>1', R(1, 5, 3, 3), { tipo: 'delete_rows', indice: 3, conta: 1 })).toContain('#REF!');
  });
  it('colonne', () => {
    expect(f('=A1>25', R(1, 5, 3, 3), { tipo: 'insert_cols', indice: 1, conta: 1 })).toBe('=B1>25');
    expect(f('=$B1>25', R(1, 5, 3, 3), { tipo: 'delete_cols', indice: 1, conta: 1 })).toBe('=$A1>25');
  });
  it('una regola di un altro foglio che cita il foglio cambiato: solo quei riferimenti', () => {
    expect(f('=Foglio1!A3+A3>1', R(1, 5, 1, 1), { tipo: 'insert_rows', indice: 1, conta: 1 }, 'Foglio2', 'Foglio1')).toBe('=Foglio1!A4+A3>1');
  });
});

describe('T524: formule delle regole dopo taglia e incolla (parte pura)', () => {
  const s: Spostamento = { area: R(1, 5, 1, 1), foglioOrigine: 'F', foglioDestinazione: 'F', deltaRighe: 0, deltaColonne: 4 };
  const regola = (v: string): ConditionalFormatRule => ({ id: 'r', type: 'formula', value1: v, range: R(1, 5, 3, 3), style: { backgroundColor: '#ff0000' } });
  it('una regola che cita le celle spostate le segue; quelle fuori restano', () => {
    expect(regolaDopoSpostamento(regola('=A1+B1>1'), 'F', s, false).value1).toBe('=E1+B1>1');
    expect(regolaDopoSpostamento(regola('=$A$1:$A$5>1'), 'F', s, false).value1).toBe('=$E$1:$E$5>1');
  });
  it('la regola spostata tiene i riferimenti fuori dal blocco, quelli dentro seguono', () => {
    expect(regolaDopoSpostamento(regola('=B1>0'), 'F', s, true).value1).toBe('=B1>0');
    expect(regolaDopoSpostamento(regola('=A1>0'), 'F', s, true).value1).toBe('=E1>0');
  });
  it('le regole senza formula non cambiano (stesso oggetto)', () => {
    const r: ConditionalFormatRule = { id: 'v', type: 'cell_value', operator: 'greater_than', value1: 3, range: R(1, 1, 1, 1), style: {} };
    expect(regolaDopoSpostamento(r, 'F', s, false)).toBe(r);
  });
});

// ---- nella griglia ----
type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot;
  insertRowsAbove: () => Promise<void>; deleteSelectedRows: () => Promise<void>; insertColsLeft: () => Promise<void>;
  cut: () => Promise<void>; paste: (t?: string) => Promise<void>; undo: () => Promise<void>; redo: () => Promise<void>;
  handleAddSheet: (n?: string) => Promise<void>; switchSheet: (n: string) => Promise<void>; requestUpdate: () => void;
};
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
  for (let r = 1; r <= 5; r++) await doc.client.setCell(doc.activeSheetName, r, 1, String(r * 10));   // A1:A5 = 10..50
  doc.conditionalFormats.push({ id: 'f', type: 'formula', value1: '=A1>25', range: R(1, 5, 3, 3), style: { backgroundColor: '#ff0000' } });
});

const sel = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc.selection = { anchor: { row: r1, col: c1 }, active: { row: r2, col: c2 }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 } }; };
const regola = () => doc.conditionalFormats[0];
const rosso = async (r: number, c: number) => {
  griglia.requestUpdate(); await griglia.updateComplete;
  const t = griglia.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement | null;
  return !!t && /255,\s*0,\s*0|#ff0000/i.test(t.style.backgroundColor);
};

describe('T524: nella griglia', () => {
  it('inserire due righe sopra: la regola scende con la formula e continua a colorare le righe giuste; Annulla la rimette', async () => {
    expect([await rosso(2, 3), await rosso(3, 3)]).toEqual([false, true]);
    sel(1, 1, 2, 1);
    await griglia.insertRowsAbove();
    expect(regola().range).toEqual(R(3, 7, 3, 3));
    expect(regola().value1).toBe('=A3>25');
    sel(20, 20);
    expect([await rosso(4, 3), await rosso(5, 3)]).toEqual([false, true]);   // 20 e 30, prima nelle righe 2 e 3
    await griglia.undo();
    expect(regola().value1).toBe('=A1>25');
    expect(regola().range).toEqual(R(1, 5, 3, 3));
  });
  it('eliminare la prima riga: la formula resta giusta per le righe rimaste; Annulla la rimette', async () => {
    sel(1, 1);
    await griglia.deleteSelectedRows();
    expect(regola().range).toEqual(R(1, 4, 3, 3));
    expect(regola().value1).toBe('=A1>25');
    sel(20, 20);
    expect([await rosso(1, 3), await rosso(2, 3)]).toEqual([false, true]);   // 20 e 30
    await griglia.undo();
    expect(regola().range).toEqual(R(1, 5, 3, 3));
  });
  it('una regola di un altro foglio che cita questo si aggiorna, e Annulla dell\'eliminazione la rimette', async () => {
    const primo = doc.activeSheetName;
    await griglia.handleAddSheet('Altro');
    await griglia.switchSheet('Altro');
    doc.conditionalFormats.push({ id: 'g', type: 'formula', value1: `=${primo}!$A$5>1`, range: R(1, 1, 1, 1), style: { bold: true } });
    await griglia.switchSheet(primo);
    sel(1, 1);
    await griglia.deleteSelectedRows();
    expect(doc.sheetStates.get('Altro')!.conditionalFormats[0].value1).toBe(`=${primo}!$A$4>1`);
    await griglia.undo();
    expect(doc.sheetStates.get('Altro')!.conditionalFormats[0].value1).toBe(`=${primo}!$A$5>1`);
  });
  it('tagliare A1:A5 e incollarli in E1: la regola su C segue i dati; Annulla la rimette', async () => {
    sel(1, 1, 5, 1);
    await griglia.cut();
    sel(1, 5);
    await griglia.paste('');
    expect(regola().value1).toBe('=E1>25');
    expect(regola().range).toEqual(R(1, 5, 3, 3));
    sel(20, 20);
    expect([await rosso(2, 3), await rosso(3, 3)]).toEqual([false, true]);
    await griglia.undo();
    expect(regola().value1).toBe('=A1>25');
  });
  it('tagliare la colonna della regola (C1:C5) insieme ai dati: la regola viaggia e guarda ancora i suoi dati', async () => {
    sel(1, 1, 5, 3);
    await griglia.cut();
    sel(1, 6);
    await griglia.paste('');
    expect(regola().range).toEqual(R(1, 5, 8, 8));
    expect(regola().value1).toBe('=F1>25');
  });
});
