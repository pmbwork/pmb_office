import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { daInputUtente, perInputUtente } from '../../src/sheet/input-locale';
import { impostaLocaleNumeri, localizzaBooleano } from '../../src/sheet/locale-numeri';
import { formatDisplayValue } from '../../src/sheet/format-display';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

afterEach(() => { impostaLocaleNumeri('en'); });

describe('T318: VERO e FALSO secondo la lingua', () => {
  it('in inglese TRUE e FALSE, in italiano VERO e FALSO', () => {
    impostaLocaleNumeri('en');
    expect([localizzaBooleano(true), localizzaBooleano(false)]).toEqual(['TRUE', 'FALSE']);
    impostaLocaleNumeri('it');
    expect([localizzaBooleano(true), localizzaBooleano(false)]).toEqual(['VERO', 'FALSO']);
  });

  it('nelle celle: centrati, nella lingua scelta', () => {
    impostaLocaleNumeri('en');
    expect(formatDisplayValue({ kind: 'boolean', value: true })).toEqual({ text: 'TRUE', align: 'center' });
    expect(formatDisplayValue({ kind: 'boolean', value: false })).toEqual({ text: 'FALSE', align: 'center' });
    impostaLocaleNumeri('it');
    expect(formatDisplayValue({ kind: 'boolean', value: true })).toEqual({ text: 'VERO', align: 'center' });
    expect(formatDisplayValue({ kind: 'boolean', value: false })).toEqual({ text: 'FALSO', align: 'center' });
  });

  it('il testo non cambia per questo', () => {
    impostaLocaleNumeri('it');
    expect(formatDisplayValue({ kind: 'text', value: 'TRUE' }).text).toBe('TRUE');
    expect(formatDisplayValue({ kind: 'text', value: 'vero' }).text).toBe('vero');
  });
});

describe('T318: scrivere e rileggere VERO e FALSO', () => {
  it.each([['VERO', 'TRUE'], ['vero', 'TRUE'], ['Vero', 'TRUE'], ['  vero ', 'TRUE'], ['FALSO', 'FALSE'], ['falso', 'FALSE'], [' Falso', 'FALSE']])('%j → %j', (entra, esce) => {
    expect(daInputUtente(entra)).toBe(esce);
  });

  it.each(['TRUE', 'FALSE', 'true', 'veri', 'verità', 'falsone', "'VERO", 'VERO!', 'vero vero', 'non VERO', ''])('resta così: %j', (testo) => {
    expect(daInputUtente(testo)).toBe(testo);
  });

  it.each([['TRUE', 'VERO'], ['FALSE', 'FALSO']])('da mostrare: %j → %j', (raw, mostrato) => {
    expect(perInputUtente(raw)).toBe(mostrato);
  });

  it.each(['true', 'false', 'True', "'TRUE", 'TRUE ', ' TRUE', 'TRUEE', 'VERO', ''])('da mostrare: %j resta così', (raw) => {
    expect(perInputUtente(raw)).toBe(raw);
  });

  it('andata e ritorno: quello che si mostra, riscritto, dà la forma interna', () => {
    for (const raw of ['TRUE', 'FALSE', 'true', "'TRUE", '=TRUE', '=IF(A1,TRUE,FALSE)']) expect(daInputUtente(perInputUtente(raw)), raw).toBe(raw);
  });

  it('le formule con VERO e FALSO si traducono come prima', () => {
    expect(daInputUtente('=SE(A1;VERO;FALSO)')).toBe('=IF(A1,TRUE,FALSE)');
    expect(perInputUtente('=IF(A1,TRUE,FALSE)')).toBe('=SE(A1;VERO;FALSO)');
  });
});

describe('T318: nella griglia', () => {
  type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
  type Griglia = HTMLElement & { getDoc: () => SheetDocument; startEditing: (r?: boolean, c?: string) => Promise<void>; commitEdit: () => Promise<void>; updateComplete: Promise<unknown>; editValue: string };
  let g: Griglia;
  let app: App;
  let doc: SheetDocument;

  beforeEach(async () => {
    document.body.innerHTML = '';
    defaultDocumentStore.clear();
    app = document.createElement('free-app') as App;
    document.body.appendChild(app);
    await app.updateComplete;
    g = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
    await g.updateComplete;
    doc = g.getDoc();
  });

  async function scrivi(riga: number, col: number, testo: string) {
    doc.selection = { anchor: { row: riga, col }, active: { row: riga, col }, range: { startRow: riga, endRow: riga, startCol: col, endCol: col } } as SheetDocument['selection'];
    await g.startEditing(true, '');
    g.editValue = testo;
    await g.commitEdit();
  }
  const raw = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).raw;
  const valore = async (r: number, c: number) => (await doc.client.getCell(doc.activeSheetName, r, c)).value;
  /** il testo della tabella che va in stampa: nella griglia i booleani sono caselle da spuntare, in stampa si leggono */
  async function testoStampato(): Promise<string[][]> {
    let visto: string[][] = [];
    vi.spyOn(window, 'print').mockImplementation(() => {
      const t = (app.renderRoot as ShadowRoot).querySelector('.stampa table');
      visto = t ? Array.from(t.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim())) : [];
    });
    await (app as unknown as { stampa(): Promise<void> }).stampa();
    return visto;
  }

  it('scrivere vero e falso dà due booleani, che in stampa si leggono VERO e FALSO', async () => {
    await scrivi(1, 1, 'vero');
    await scrivi(2, 1, 'FALSO');
    expect(await raw(1, 1)).toBe('TRUE');
    expect(await raw(2, 1)).toBe('FALSE');
    expect(await valore(1, 1)).toMatchObject({ kind: 'boolean', value: true });
    expect(await valore(2, 1)).toMatchObject({ kind: 'boolean', value: false });
    expect(await testoStampato()).toEqual([['VERO'], ['FALSO']]);
  });

  it('il risultato di una formula booleana in stampa si legge VERO o FALSO', async () => {
    await scrivi(1, 1, '5');
    await scrivi(1, 2, '=A1>3');
    await scrivi(1, 3, '=A1>30');
    expect(await testoStampato()).toEqual([['5', 'VERO', 'FALSO']]);
  });

  it('riaprendo la cella per modificarla si rivede VERO', async () => {
    await scrivi(1, 1, 'vero');
    doc.selection = { anchor: { row: 1, col: 1 }, active: { row: 1, col: 1 }, range: { startRow: 1, endRow: 1, startCol: 1, endCol: 1 } } as SheetDocument['selection'];
    await g.startEditing(false);
    expect(g.editValue).toBe('VERO');
    await g.commitEdit();
    expect(await raw(1, 1)).toBe('TRUE');
  });

  it('il testo che comincia con vero resta testo', async () => {
    await scrivi(1, 1, 'vero amico');
    expect(await raw(1, 1)).toBe('vero amico');
    expect(await valore(1, 1)).toMatchObject({ kind: 'text' });
  });
});
