import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { areaDestinazione, nomiUguali, spostaCommenti, spostaDatiSopraLeCelle, spostaNomi, type DatiSopraLeCelle, type Spostamento } from '../../src/sheet/sposta-con-celle';
import { chiaveCommento, type Commento } from '../../src/sheet/commenti';
import type { DataValidationRule } from '../../src/sheet/data-validation';
import type { NamedRange } from '../../src/sheet/named-ranges';
import { commentoDi } from '../../src/sheet/commenti';

const regola = (id = 'v'): DataValidationRule => ({ id, type: 'list', listItems: ['a', 'b'], action: 'reject' });
const dati = (): DatiSopraLeCelle => ({ merges: [], dataValidations: new Map(), conditionalFormats: [] });
const sp = (area: [number, number, number, number], dr: number, dc: number, da = 'F1', a = 'F1'): Spostamento => ({ area: { startRow: area[0], endRow: area[1], startCol: area[2], endCol: area[3] }, foglioOrigine: da, foglioDestinazione: a, deltaRighe: dr, deltaColonne: dc });

describe('T502: area di destinazione', () => {
  it('è l\'area spostata di quante righe e colonne serve', () => {
    expect(areaDestinazione(sp([1, 2, 1, 3], 4, 5))).toEqual({ startRow: 5, endRow: 6, startCol: 6, endCol: 8 });
    expect(areaDestinazione(sp([5, 5, 5, 5], -2, -1))).toEqual({ startRow: 3, endRow: 3, startCol: 4, endCol: 4 });
  });
});

describe('T502: convalide dei dati', () => {
  it('quelle dell\'area passano alla destinazione e la sorgente le perde; fuori dall\'area non cambia niente', () => {
    const d = dati();
    d.dataValidations.set('1:1', regola('a')); d.dataValidations.set('2:2', regola('b')); d.dataValidations.set('9:9', regola('fuori'));
    spostaDatiSopraLeCelle(d, d, sp([1, 2, 1, 2], 10, 10));
    expect([...d.dataValidations.keys()].sort()).toEqual(['11:11', '12:12', '9:9']);
    expect(d.dataValidations.get('11:11')!.id).toBe('a');
    expect(d.dataValidations.get('9:9')!.id).toBe('fuori');
  });
  it('la destinazione perde le sue convalide sotto l\'area coperta (anche se le celle tagliate non ne avevano)', () => {
    const d = dati();
    d.dataValidations.set('1:1', regola('a')); d.dataValidations.set('11:11', regola('vecchia')); d.dataValidations.set('11:12', regola('vecchia2'));
    spostaDatiSopraLeCelle(d, d, sp([1, 1, 1, 2], 10, 10));    // A1:B1 -> K11:L11
    expect(d.dataValidations.get('11:11')!.id).toBe('a');
    expect(d.dataValidations.has('11:12')).toBe(false);          // sotto L11 non c'era niente da portare: la vecchia sparisce
  });
  it('uno spostamento che si sovrappone riesce (A1:B2 → B2:C3)', () => {
    const d = dati();
    d.dataValidations.set('1:1', regola('a')); d.dataValidations.set('2:2', regola('b'));
    spostaDatiSopraLeCelle(d, d, sp([1, 2, 1, 2], 1, 1));
    expect([...d.dataValidations.entries()].map(([k, v]) => `${k}=${v.id}`).sort()).toEqual(['2:2=a', '3:3=b']);
  });
  it('tra due fogli: passano da uno all\'altro', () => {
    const da = dati(); const a = dati();
    da.dataValidations.set('1:1', regola('a')); a.dataValidations.set('5:5', regola('resta'));
    spostaDatiSopraLeCelle(da, a, sp([1, 1, 1, 1], 4, 4, 'F1', 'F2'));
    expect(da.dataValidations.size).toBe(0);
    expect([...a.dataValidations.keys()].sort()).toEqual(['5:5']);
    expect(a.dataValidations.get('5:5')!.id).toBe('a');
  });
});

describe('T502: celle unite', () => {
  it('quelle interamente nell\'area si spostano; quelle che escono dall\'area restano dove sono', () => {
    const d = dati();
    d.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }, { startRow: 2, endRow: 3, startCol: 2, endCol: 4 }, { startRow: 20, endRow: 21, startCol: 1, endCol: 1 });
    spostaDatiSopraLeCelle(d, d, sp([1, 2, 1, 2], 10, 0));       // area A1:B2: contiene solo la prima
    expect(d.merges).toContainEqual({ startRow: 11, endRow: 11, startCol: 1, endCol: 2 });
    expect(d.merges).toContainEqual({ startRow: 2, endRow: 3, startCol: 2, endCol: 4 });
    expect(d.merges).toContainEqual({ startRow: 20, endRow: 21, startCol: 1, endCol: 1 });
    expect(d.merges).toHaveLength(3);
  });
  it('la destinazione perde le celle unite che tocca', () => {
    const d = dati();
    d.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }, { startRow: 11, endRow: 12, startCol: 2, endCol: 3 });
    spostaDatiSopraLeCelle(d, d, sp([1, 1, 1, 2], 10, 0));       // A1:B1 -> A11:B11, tocca la unione B11:C12
    expect(d.merges).toEqual([{ startRow: 11, endRow: 11, startCol: 1, endCol: 2 }]);
  });
  it('tra due fogli: l\'unione lascia il primo e compare nel secondo', () => {
    const da = dati(); const a = dati();
    da.merges.push({ startRow: 1, endRow: 2, startCol: 1, endCol: 1 });
    a.merges.push({ startRow: 50, endRow: 50, startCol: 1, endCol: 3 });
    spostaDatiSopraLeCelle(da, a, sp([1, 2, 1, 1], 4, 1, 'F1', 'F2'));
    expect(da.merges).toEqual([]);
    expect(a.merges).toContainEqual({ startRow: 5, endRow: 6, startCol: 2, endCol: 2 });
    expect(a.merges).toContainEqual({ startRow: 50, endRow: 50, startCol: 1, endCol: 3 });
  });
});

describe('T502: formattazioni condizionali', () => {
  const regolaCf = (id: string, r: [number, number, number, number]) => ({ id, type: 'cell_value' as const, range: { startRow: r[0], endRow: r[1], startCol: r[2], endCol: r[3] }, operator: 'greater_than', value1: 5, style: { bold: true } });
  it('passano le regole che stanno tutte nell\'area; le altre restano', () => {
    const d = dati();
    d.conditionalFormats.push(regolaCf('dentro', [1, 2, 1, 1]), regolaCf('a-cavallo', [2, 5, 1, 1]), regolaCf('fuori', [30, 31, 3, 3]));
    spostaDatiSopraLeCelle(d, d, sp([1, 3, 1, 2], 10, 5));
    const per = (id: string) => d.conditionalFormats.find((r) => r.id === id)!.range;
    expect(per('dentro')).toEqual({ startRow: 11, endRow: 12, startCol: 6, endCol: 6 });
    expect(per('a-cavallo')).toEqual({ startRow: 2, endRow: 5, startCol: 1, endCol: 1 });
    expect(per('fuori')).toEqual({ startRow: 30, endRow: 31, startCol: 3, endCol: 3 });
  });
  it('tra due fogli passano da un elenco all\'altro', () => {
    const da = dati(); const a = dati();
    da.conditionalFormats.push(regolaCf('x', [1, 1, 1, 1]));
    spostaDatiSopraLeCelle(da, a, sp([1, 1, 1, 1], 2, 2, 'F1', 'F2'));
    expect(da.conditionalFormats).toHaveLength(0);
    expect(a.conditionalFormats[0].range).toEqual({ startRow: 3, endRow: 3, startCol: 3, endCol: 3 });
  });
});

describe('T502: commenti', () => {
  const c = (t: string): Commento => ({ testo: t, data: '2026-11-08T10:00:00.000Z' });
  it('quelli dell\'area passano alla destinazione; quelli sotto la destinazione vengono sostituiti; gli altri restano', () => {
    const m = new Map<string, Commento>([[chiaveCommento('F1', 1, 1), c('uno')], [chiaveCommento('F1', 2, 2), c('due')], [chiaveCommento('F1', 11, 11), c('vecchio')], [chiaveCommento('F1', 30, 30), c('altrove')], [chiaveCommento('F2', 1, 1), c('altro foglio')]]);
    spostaCommenti(m, sp([1, 2, 1, 2], 10, 10));
    expect(m.get(chiaveCommento('F1', 11, 11))!.testo).toBe('uno');
    expect(m.get(chiaveCommento('F1', 12, 12))!.testo).toBe('due');
    expect(m.has(chiaveCommento('F1', 1, 1))).toBe(false);
    expect(m.get(chiaveCommento('F1', 30, 30))!.testo).toBe('altrove');
    expect(m.get(chiaveCommento('F2', 1, 1))!.testo).toBe('altro foglio');
    expect(m.size).toBe(4);
  });
  it('tra due fogli il commento cambia foglio e resta la data', () => {
    const m = new Map<string, Commento>([[chiaveCommento('F1', 1, 1), c('nota')]]);
    spostaCommenti(m, sp([1, 1, 1, 1], 3, 4, 'F1', 'F2'));
    expect(m.has(chiaveCommento('F1', 1, 1))).toBe(false);
    expect(m.get(chiaveCommento('F2', 4, 5))).toEqual(c('nota'));
  });
  it('uno spostamento che si sovrappone riesce', () => {
    const m = new Map<string, Commento>([[chiaveCommento('F1', 1, 1), c('a')], [chiaveCommento('F1', 2, 2), c('b')]]);
    spostaCommenti(m, sp([1, 2, 1, 2], 1, 1));
    expect([...m.entries()].map(([k, v]) => `${k}=${v.testo}`).sort()).toEqual([`${chiaveCommento('F1', 2, 2)}=a`, `${chiaveCommento('F1', 3, 3)}=b`]);
  });
});

describe('T502: intervalli denominati', () => {
  it('quelli tutti nell\'area seguono le celle, anche con il nome del foglio tra apici', () => {
    const lista = [
      { name: 'Zona', sheetName: 'F1', rangeString: 'A1:B2', startRow: 1, endRow: 2, startCol: 1, endCol: 2 },
      { name: 'Con foglio', sheetName: 'Foglio uno', rangeString: 'Foglio uno!A1', startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
      { name: 'Fuori', sheetName: 'F1', rangeString: 'D9:E9', startRow: 9, endRow: 9, startCol: 4, endCol: 5 },
      { name: 'Cavallo', sheetName: 'F1', rangeString: 'B2:C3', startRow: 2, endRow: 3, startCol: 2, endCol: 3 },
      { name: 'AltroFoglio', sheetName: 'F2', rangeString: 'A1:B2', startRow: 1, endRow: 2, startCol: 1, endCol: 2 },
    ] satisfies NamedRange[];
    const r = spostaNomi(lista, sp([1, 2, 1, 2], 10, 3));
    const per = (n: string) => r.find((x) => x.name === n)!;
    expect(per('Zona')).toMatchObject({ rangeString: 'D11:E12', startRow: 11, endRow: 12, startCol: 4, endCol: 5, sheetName: 'F1' });
    expect(per('Fuori').rangeString).toBe('D9:E9');
    expect(per('Cavallo').rangeString).toBe('B2:C3');
    expect(per('AltroFoglio').rangeString).toBe('A1:B2');
    expect(per('Con foglio').sheetName).toBe('Foglio uno');                 // il foglio F1 non è quello del nome: resta
  });
  it('tra due fogli il nome cambia foglio e, se aveva il foglio nel riferimento, lo riscrive (apici se servono)', () => {
    const lista: NamedRange[] = [
      { name: 'A', sheetName: 'F1', rangeString: 'A1:B2', startRow: 1, endRow: 2, startCol: 1, endCol: 2 },
      { name: 'B', sheetName: 'F1', rangeString: 'F1!A1', startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
    ];
    const r = spostaNomi(lista, sp([1, 2, 1, 2], 4, 4, 'F1', 'Il mio foglio'));
    expect(r[0]).toMatchObject({ sheetName: 'Il mio foglio', rangeString: 'E5:F6' });
    expect(r[1]).toMatchObject({ sheetName: 'Il mio foglio', rangeString: "'Il mio foglio'!E5" });
  });
  it('non modifica l\'elenco di partenza e si può confrontare', () => {
    const lista: NamedRange[] = [{ name: 'A', sheetName: 'F1', rangeString: 'A1', startRow: 1, endRow: 1, startCol: 1, endCol: 1 }];
    const copia = JSON.parse(JSON.stringify(lista));
    const r = spostaNomi(lista, sp([1, 1, 1, 1], 1, 1));
    expect(lista).toEqual(copia);
    expect(nomiUguali(lista, r)).toBe(false);
    expect(nomiUguali(lista, spostaNomi(lista, sp([5, 6, 5, 6], 1, 1)))).toBe(true);
  });
});

type Griglia = HTMLElement & {
  getDoc: () => SheetDocument; updateComplete: Promise<unknown>; renderRoot: ShadowRoot;
  cut: () => Promise<void>; paste: (t?: string) => Promise<void>; undo: () => Promise<void>; redo: () => Promise<void>;
  setComment: (r: number, c: number, t: string) => boolean; handleAddSheet: (n?: string) => Promise<void>; switchSheet: (n: string) => Promise<void>;
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
});

const sel = (r1: number, c1: number, r2 = r1, c2 = c1) => { doc.selection = { anchor: { row: r1, col: c1 }, active: { row: r2, col: c2 }, range: { startRow: r1, endRow: r2, startCol: c1, endCol: c2 } }; };
const raw = async (r: number, c: number, foglio?: string) => (await doc.client.getCell(foglio ?? doc.activeSheetName, r, c)).raw;
const nomeDi = (n: string) => doc.namedRanges.get(n);

async function preparaBlocco() {
  await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
  await doc.client.setCell(doc.activeSheetName, 1, 2, 'y');
  await doc.client.setCell(doc.activeSheetName, 2, 1, '1');
  await doc.client.setCell(doc.activeSheetName, 2, 2, '=A2*2');
  griglia.setComment(1, 1, 'una nota');
  doc.dataValidations.set('2:2', regola('v2'));
  doc.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 });
  doc.namedRanges.add({ name: 'Zona', sheetName: doc.activeSheetName, rangeString: 'A1:B2', startRow: 1, endRow: 2, startCol: 1, endCol: 2 });
  await doc.client.setNamedRanges([{ name: 'Zona', ref: `${doc.activeSheetName}!A1:B2` }]);
}

describe('T502: taglia e incolla nella griglia', () => {
  it('commenti, convalide, celle unite e nomi vanno con le celle', async () => {
    await preparaBlocco();
    sel(1, 1, 2, 2);
    await griglia.cut();
    sel(5, 4);
    await griglia.paste('');
    // le celle
    expect([await raw(5, 4), await raw(5, 5), await raw(6, 4)]).toEqual(['x', 'y', '1']);
    expect(await raw(1, 1)).toBe('');
    // ciò che stava sopra le celle
    expect(commentoDi(doc.comments, doc.activeSheetName, 5, 4)?.testo).toBe('una nota');
    expect(commentoDi(doc.comments, doc.activeSheetName, 1, 1)).toBeUndefined();
    expect([...doc.dataValidations.keys()]).toEqual(['6:5']);
    expect(doc.merges).toEqual([{ startRow: 5, endRow: 5, startCol: 4, endCol: 5 }]);
    expect(nomeDi('Zona')).toMatchObject({ rangeString: 'D5:E6', startRow: 5, endRow: 6, startCol: 4, endCol: 5 });
  });

  it('un solo Annulla rimette tutto com\'era, e Ripeti lo rifa', async () => {
    await preparaBlocco();
    sel(1, 1, 2, 2);
    await griglia.cut();
    sel(5, 4);
    await griglia.paste('');
    await griglia.undo();
    expect(await raw(1, 1)).toBe('x');
    expect(await raw(5, 4)).toBe('');
    expect(commentoDi(doc.comments, doc.activeSheetName, 1, 1)?.testo).toBe('una nota');
    expect(commentoDi(doc.comments, doc.activeSheetName, 5, 4)).toBeUndefined();
    expect([...doc.dataValidations.keys()]).toEqual(['2:2']);
    expect(doc.merges).toEqual([{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }]);
    expect(nomeDi('Zona')).toMatchObject({ rangeString: 'A1:B2', startRow: 1, endRow: 2 });
    await griglia.redo();
    expect(await raw(5, 4)).toBe('x');
    expect(commentoDi(doc.comments, doc.activeSheetName, 5, 4)?.testo).toBe('una nota');
    expect([...doc.dataValidations.keys()]).toEqual(['6:5']);
    expect(doc.merges).toEqual([{ startRow: 5, endRow: 5, startCol: 4, endCol: 5 }]);
    expect(nomeDi('Zona')).toMatchObject({ rangeString: 'D5:E6' });
  });

  it('copia e incolla (senza tagliare) lascia tutto alla sorgente, non muove il nome e porta solo una copia dei commenti e delle convalide', async () => {
    await preparaBlocco();
    sel(1, 1, 2, 2);
    await (griglia as unknown as { copy: () => Promise<void> }).copy();
    sel(5, 4);
    await griglia.paste('');
    expect(await raw(1, 1)).toBe('x');
    expect(commentoDi(doc.comments, doc.activeSheetName, 1, 1)?.testo).toBe('una nota');
    expect([...doc.dataValidations.keys()].sort()).toEqual(['2:2', '6:5']);   // la sorgente tiene la sua; la copia ne porta una alla destinazione (T503)
    expect(nomeDi('Zona')).toMatchObject({ rangeString: 'A1:B2' });             // i nomi non si copiano
  });

  it('tagliando solo una parte del nome, il nome non si muove', async () => {
    await preparaBlocco();
    sel(1, 1, 1, 1);                       // solo A1: il nome Zona è A1:B2, non sta tutto nell'area
    await griglia.cut();
    sel(8, 8);
    await griglia.paste('');
    expect(await raw(8, 8)).toBe('x');
    expect(nomeDi('Zona')).toMatchObject({ rangeString: 'A1:B2' });
    expect(commentoDi(doc.comments, doc.activeSheetName, 8, 8)?.testo).toBe('una nota');   // il commento invece sta nella cella tagliata
  });

  it('da un foglio all\'altro: commento, convalida, unione e nome cambiano foglio', async () => {
    await preparaBlocco();
    const primo = doc.activeSheetName;
    sel(1, 1, 2, 2);
    await griglia.cut();
    await griglia.handleAddSheet('Altro');
    await griglia.switchSheet('Altro');
    expect(doc.activeSheetName).toBe('Altro');
    sel(3, 3);
    await griglia.paste('');
    expect(await raw(3, 3, 'Altro')).toBe('x');
    expect(await raw(1, 1, primo)).toBe('');
    expect(commentoDi(doc.comments, 'Altro', 3, 3)?.testo).toBe('una nota');
    expect(commentoDi(doc.comments, primo, 1, 1)).toBeUndefined();
    expect([...doc.dataValidations.keys()]).toEqual(['4:4']);                       // il foglio attivo è Altro
    expect(doc.merges).toEqual([{ startRow: 3, endRow: 3, startCol: 3, endCol: 4 }]);
    expect(nomeDi('Zona')).toMatchObject({ sheetName: 'Altro', rangeString: 'C3:D4' });
    await griglia.undo();
    expect(commentoDi(doc.comments, primo, 1, 1)?.testo).toBe('una nota');
    expect(commentoDi(doc.comments, 'Altro', 3, 3)).toBeUndefined();
    expect(nomeDi('Zona')).toMatchObject({ sheetName: primo, rangeString: 'A1:B2' });
  });
});
