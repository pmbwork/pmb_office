import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { impostaLocaleNumeri, localeNumeri, localizzaNumero } from '../../src/sheet/locale-numeri';
import { formatCellValue } from '../../src/sheet/number-format';
import { formatDisplayNumber, formatDisplayValue } from '../../src/sheet/format-display';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';

afterEach(() => { impostaLocaleNumeri('en'); });

const num = (value: number) => ({ kind: 'number' as const, value });

describe('T312: la lingua dei numeri', () => {
  it('di partenza è l\'inglese e non cambia niente', () => {
    expect(localeNumeri()).toBe('en');
    expect(localizzaNumero('1,234.5')).toBe('1,234.5');
    expect(formatDisplayNumber(1234.5)).toBe('1234.5');
    expect(formatCellValue(1234.5, '#,##0.00')).toBe('1,234.50');
  });

  it('impostaLocaleNumeri cambia e si può rimettere', () => {
    impostaLocaleNumeri('it');
    expect(localeNumeri()).toBe('it');
    impostaLocaleNumeri('en');
    expect(localeNumeri()).toBe('en');
  });

  it('in italiano scambia punto e virgola, ovunque compaiano', () => {
    impostaLocaleNumeri('it');
    expect(localizzaNumero('1,234.5')).toBe('1.234,5');
    expect(localizzaNumero('1,234,567.89')).toBe('1.234.567,89');
    expect(localizzaNumero('€1,234.50')).toBe('€1.234,50');
    expect(localizzaNumero('-0.5')).toBe('-0,5');
    expect(localizzaNumero('12')).toBe('12');
    expect(localizzaNumero('')).toBe('');
  });
});

describe('T312: numeri del foglio in italiano', () => {
  beforeEach(() => { impostaLocaleNumeri('it'); });

  it.each([
    [1.5, '1,5'], [-0.25, '-0,25'], [1234.5, '1234,5'], [100, '100'], [0, '0'], [1 / 3, '0,3333333333'], [0.1 + 0.2, '0,3'],
  ])('automatico: %s → %s', (n, atteso) => { expect(formatDisplayNumber(n)).toBe(atteso); });

  it('i numeri fuori scala e quelli non finiti', () => {
    expect(formatDisplayNumber(1.5e16)).toBe('1,5e+16');
    expect(formatDisplayNumber(1.5e12)).toBe('1500000000000'); // un intero fino a 15 cifre si vede per intero (T477)
    expect(formatDisplayNumber(12345678901234)).toBe('12345678901234'); // codice a barre EAN
    expect(formatDisplayNumber(Infinity)).toBe('#NUM!');
    expect(formatDisplayNumber(NaN)).toBe('#NUM!');
  });

  it('formatDisplayValue mostra i numeri all\'italiana e i booleani come VERO e FALSO, il testo no', () => {
    expect(formatDisplayValue(num(2.5)).text).toBe('2,5');
    expect(formatDisplayValue({ kind: 'text', value: '2.5, due' }).text).toBe('2.5, due');
    expect(formatDisplayValue({ kind: 'boolean', value: true }).text).toBe('VERO');
    expect(formatDisplayValue({ kind: 'boolean', value: false }).text).toBe('FALSO');
  });

  it.each([
    [1.5, undefined, '1,5'],
    [1.5, '', '1,5'],
    [1234.5, '0.00', '1234,50'],
    [1234.5, '#,##0.00', '1.234,50'],
    [1234567, '#,##0', '1.234.567'],
    [3.14159, '0.000', '3,142'],
    [1234.5, '€#,##0.00', '€1.234,50'],
    [-1234.5, '€#,##0.00', '-€1.234,50'],
    [1234.5, '€#,##0', '€1.235'],
    [0.125, '0%', '13%'],
    [0.125, '0.0%', '12,5%'],
    [0.12345, '0.00%', '12,35%'],
    [12345, '0.00E+00', '1,23E+04'],
    [2.5, '@', '2,5'],
  ])('formato: %s con %j → %s', (n, codice, atteso) => { expect(formatCellValue(n, codice)).toBe(atteso); });

  it('anche il valore del motore ({kind: number}) segue la lingua', () => {
    expect(formatCellValue(num(1234.5), '#,##0.00')).toBe('1.234,50');
    expect(formatCellValue(num(2.5))).toBe('2,5');
  });

  it('date e ore non cambiano', () => {
    expect(formatCellValue(45351, 'dd/mm/yyyy')).toBe('29/02/2024');
    expect(formatCellValue(45351, 'd/m/yyyy')).toBe('29/2/2024'); // come in Excel: il giorno e il mese senza zero davanti
    expect(formatCellValue(0.5, 'hh:mm:ss')).toBe('12:00:00');
    expect(formatCellValue(0.5, 'h:mm:ss')).toBe('12:00:00');
    expect(formatCellValue(45351.5, 'dd/mm/yyyy hh:mm:ss')).toBe('29/02/2024 12:00:00');
    expect(formatCellValue(45351.5, 'yyyy-mm-dd hh:mm:ss')).toBe('2024-02-29 12:00:00'); // il formato dice anno-mese-giorno
  });

  it('testo, booleani ed errori passano senza toccare virgole e punti', () => {
    expect(formatCellValue('1,5 e 2.5', '0.00')).toBe('1,5 e 2.5');
    expect(formatCellValue({ kind: 'text', value: 'a.b,c' }, '0.00')).toBe('a.b,c');
    expect(formatCellValue(true)).toBe('VERO');
    expect(formatCellValue({ kind: 'error', message: '#DIV/0!' } as unknown)).toBe('#DIV/0!');
    expect(formatCellValue(null)).toBe('');
    expect(formatCellValue(undefined)).toBe('');
    expect(formatCellValue({ kind: 'empty' })).toBe('');
  });

  it('un numero non finito resta com\'è anche in italiano', () => {
    expect(formatCellValue(Infinity, '0.00')).toBe('Infinity');
    expect(formatCellValue(NaN)).toBe('NaN');
  });
});

describe('T312: nella finestra', () => {
  type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
  type Griglia = HTMLElement & { getDoc: () => SheetDocument; startEditing: (r?: boolean, c?: string) => Promise<void>; commitEdit: () => Promise<void>; updateComplete: Promise<unknown>; editValue: string };

  async function avvia() {
    document.body.innerHTML = '';
    defaultDocumentStore.clear();
    const app = document.createElement('free-app') as App;
    document.body.appendChild(app);
    await app.updateComplete;
    const g = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
    await g.updateComplete;
    return { app, g, doc: g.getDoc() };
  }
  async function scrivi(g: Griglia, doc: SheetDocument, riga: number, col: number, testo: string) {
    doc.selection = { anchor: { row: riga, col }, active: { row: riga, col }, range: { startRow: riga, endRow: riga, startCol: col, endCol: col } } as SheetDocument['selection'];
    await g.startEditing(true, '');
    g.editValue = testo;
    await g.commitEdit();
  }
  const testiCelle = (g: Griglia): string[] => Array.from((g.shadowRoot as ShadowRoot).querySelectorAll('td.sheet-cell')).map((c) => (c.textContent ?? '').trim());

  it('aprendo l\'app i numeri si mostrano all\'italiana', async () => {
    expect(localeNumeri()).toBe('en');
    await avvia();
    expect(localeNumeri()).toBe('it');
  });

  it('si scrive 1,5 e 2,25 e la griglia mostra 1,5 e 2,25 e la somma 3,75', async () => {
    const { g, doc } = await avvia();
    await scrivi(g, doc, 2, 2, '1,5');
    await scrivi(g, doc, 3, 2, '2,25');
    await scrivi(g, doc, 4, 2, '=SOMMA(B2;B3)');
    await vi.waitFor(() => expect(testiCelle(g)).toContain('3,75'));
    const testi = testiCelle(g);
    expect(testi).toContain('1,5');
    expect(testi).toContain('2,25');
    expect(testi).not.toContain('1.5');
    expect(testi).not.toContain('3.75');
  });

  it('un numero con la virgola e molte cifre si legge come è stato scritto', async () => {
    const { g, doc } = await avvia();
    await scrivi(g, doc, 1, 1, '1234567,891');
    await vi.waitFor(() => expect(testiCelle(g)).toContain('1234567,891'));
  });
});
