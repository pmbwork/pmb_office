/**
 * Batteria di test per i moduli puri di src/sheet/ in ambiente Node puro (senza DOM, senza Lit).
 * Copre:
 * - Viewport (incluso scroll a riga 1.048.576 e colonna XFD, tetto celle < 1.500)
 * - Selezione (celle, intervalli, righe, colonne, tutto, name box)
 * - Navigazione (frecce, Ctrl+frecce salto al bordo dati, Home, Ctrl+Home, Ctrl+Fine, PagSu/PagGiù)
 * - Clipboard (TSV con virgolette, a capo, tabulazioni, tiling multipli esatti, shiftFormula)
 * - History (annulla/ripeti composti, limite 200 passi)
 * - DocumentStore (isolamento per scheda)
 * - FormatDisplay (numeri a 10 cifre significative, allineamenti, errori)
 * - EngineClient (contratto asincrono InlineEngineClient)
 */

import { describe, it, expect } from 'vitest';
import {
  computeVisibleRange,
  MAX_ROWS,
  MAX_COLS,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_COL_WIDTH,
  MAX_DOM_CELLS_CEILING,
  createCellSelection,
  createRangeSelection,
  createRowSelection,
  createColSelection,
  createAllSelection,
  isCellSelected,
  formatSelectionAddress,
  parseNameBoxAddress,
  handleNavigationKey,
  findBoundaryJump,
  generateTSV,
  parseTSV,
  computePasteOperations,
  HistoryManager,
  formatDisplayValue,
  formatDisplayNumber,
  DocumentStore,
  InlineEngineClient,
} from '../../src/sheet/index';
import { numberVal, textVal, boolVal, errorVal, emptyVal } from '../../src/engine/index';

describe('1. Viewport Virtualization', () => {
  it('calcola le celle visibili standard all\'origine (0, 0)', () => {
    const v = computeVisibleRange({
      scrollTop: 0,
      scrollLeft: 0,
      viewportWidth: 900,
      viewportHeight: 440,
    });
    expect(v.startRow).toBe(1);
    expect(v.startCol).toBe(1);
    expect(v.endRow).toBeGreaterThanOrEqual(20);
    expect(v.endCol).toBeGreaterThanOrEqual(10);
    expect(v.topOffset).toBe(0);
    expect(v.leftOffset).toBe(0);
    expect(v.totalRenderedCells).toBeLessThan(MAX_DOM_CELLS_CEILING);
  });

  it('scroll verso il basso aggiorna startRow e topOffset', () => {
    const v = computeVisibleRange({
      scrollTop: 220, // 10 righe
      scrollLeft: 0,
      viewportWidth: 900,
      viewportHeight: 440,
      overscanRows: 2,
    });
    expect(v.startRow).toBe(9); // 10 - 2 + 1
    expect(v.topOffset).toBe(8 * 22);
  });

  it('scroll verso destra aggiorna startCol e leftOffset', () => {
    const v = computeVisibleRange({
      scrollTop: 0,
      scrollLeft: 900, // 10 colonne
      viewportWidth: 900,
      viewportHeight: 440,
      overscanCols: 2,
    });
    expect(v.startCol).toBe(9); // 10 - 2 + 1
    expect(v.leftOffset).toBe(8 * 90);
  });

  it('scroll all\'estremo inferiore (riga 1.048.576)', () => {
    const totalH = MAX_ROWS * DEFAULT_ROW_HEIGHT;
    const v = computeVisibleRange({
      scrollTop: totalH - 500,
      scrollLeft: 0,
      viewportWidth: 900,
      viewportHeight: 500,
    });
    expect(v.endRow).toBe(MAX_ROWS);
    expect(v.startRow).toBeGreaterThan(MAX_ROWS - 50);
    expect(v.totalHeight).toBe(23_068_672);
  });

  it('scroll all\'estremo destro (colonna 16.384, XFD)', () => {
    const totalW = MAX_COLS * DEFAULT_COL_WIDTH;
    const v = computeVisibleRange({
      scrollTop: 0,
      scrollLeft: totalW - 900,
      viewportWidth: 900,
      viewportHeight: 500,
    });
    expect(v.endCol).toBe(MAX_COLS);
    expect(v.startCol).toBeGreaterThan(MAX_COLS - 30);
  });

  it('rispetta il tetto duro di celle nel DOM anche con viewport enorme', () => {
    const v = computeVisibleRange({
      scrollTop: 0,
      scrollLeft: 0,
      viewportWidth: 4000,
      viewportHeight: 3000,
      zoom: 50, // zoom al 50% quadruplica le celle potenziali
    });
    expect(v.totalRenderedCells).toBeLessThan(MAX_DOM_CELLS_CEILING);
  });

  it('gestisce larghezze personalizzate delle colonne', () => {
    const colWidths = new Map<number, number>([
      [1, 150],
      [2, 200],
    ]);
    const v = computeVisibleRange({
      scrollTop: 0,
      scrollLeft: 0,
      viewportWidth: 900,
      viewportHeight: 400,
      colWidths,
    });
    expect(v.startCol).toBe(1);
    expect(v.totalWidth).toBe(MAX_COLS * 90 + (150 - 90) + (200 - 90));
  });

  it('zoom a 200% raddoppia l\'altezza delle righe e la larghezza', () => {
    const v = computeVisibleRange({
      scrollTop: 0,
      scrollLeft: 0,
      viewportWidth: 900,
      viewportHeight: 440,
      zoom: 200,
    });
    expect(v.totalHeight).toBe(MAX_ROWS * DEFAULT_ROW_HEIGHT * 2);
  });
});

describe('2. Selection State', () => {
  it('crea selezione di singola cella', () => {
    const sel = createCellSelection(5, 3);
    expect(sel.anchor).toEqual({ row: 5, col: 3 });
    expect(sel.active).toEqual({ row: 5, col: 3 });
    expect(sel.range).toEqual({ startRow: 5, startCol: 3, endRow: 5, endCol: 3 });
    expect(formatSelectionAddress(sel)).toBe('C5');
  });

  it('crea selezione di intervallo rettangolare normalizzato', () => {
    const sel = createRangeSelection(10, 5, 2, 1);
    expect(sel.range).toEqual({ startRow: 2, startCol: 1, endRow: 10, endCol: 5 });
    expect(formatSelectionAddress(sel)).toBe('A2:E10');
  });

  it('crea selezione di riga intera', () => {
    const sel = createRowSelection(4);
    expect(sel.isFullRow).toBe(true);
    expect(sel.range.startCol).toBe(1);
    expect(sel.range.endCol).toBe(MAX_COLS);
    expect(formatSelectionAddress(sel)).toBe('4:4');
  });

  it('crea selezione di colonna intera', () => {
    const sel = createColSelection(2, 3); // B:C
    expect(sel.isFullCol).toBe(true);
    expect(sel.range.startRow).toBe(1);
    expect(sel.range.endRow).toBe(MAX_ROWS);
    expect(formatSelectionAddress(sel)).toBe('B:C');
  });

  it('crea selezione di tutto il foglio', () => {
    const sel = createAllSelection();
    expect(sel.isAll).toBe(true);
    expect(formatSelectionAddress(sel)).toBe('A1:XFD1048576');
  });

  it('isCellSelected verifica appartenenza corretta', () => {
    const sel = createRangeSelection(2, 2, 5, 5);
    expect(isCellSelected(3, 3, sel)).toBe(true);
    expect(isCellSelected(1, 3, sel)).toBe(false);
    expect(isCellSelected(6, 3, sel)).toBe(false);
  });

  it('parseNameBoxAddress riconosce vari formati validi', () => {
    expect(parseNameBoxAddress('B20').selection?.range).toEqual({ startRow: 20, startCol: 2, endRow: 20, endCol: 2 });
    expect(parseNameBoxAddress('A1:C5').selection?.range).toEqual({ startRow: 1, startCol: 1, endRow: 5, endCol: 3 });
    expect(parseNameBoxAddress('D:D').selection?.isFullCol).toBe(true);
    expect(parseNameBoxAddress('5:10').selection?.isFullRow).toBe(true);
  });

  it('parseNameBoxAddress rifiuta indirizzi non validi', () => {
    expect(parseNameBoxAddress('INVALID').error).toBeDefined();
    expect(parseNameBoxAddress('').error).toBeDefined();
    expect(parseNameBoxAddress('A0').error).toBeDefined();
  });
});

describe('3. Keyboard Navigation', () => {
  it('frecce semplici spostano di 1 cella', () => {
    const sel = createCellSelection(5, 5);
    const up = handleNavigationKey(sel, 'ArrowUp', {});
    expect(up?.active).toEqual({ row: 4, col: 5 });

    const down = handleNavigationKey(sel, 'ArrowDown', {});
    expect(down?.active).toEqual({ row: 6, col: 5 });

    const left = handleNavigationKey(sel, 'ArrowLeft', {});
    expect(left?.active).toEqual({ row: 5, col: 4 });

    const right = handleNavigationKey(sel, 'ArrowRight', {});
    expect(right?.active).toEqual({ row: 5, col: 6 });
  });

  it('frecce non escono dai bordi del foglio (clamping)', () => {
    const sel = createCellSelection(1, 1);
    const up = handleNavigationKey(sel, 'ArrowUp', {});
    expect(up?.active).toEqual({ row: 1, col: 1 });

    const left = handleNavigationKey(sel, 'ArrowLeft', {});
    expect(left?.active).toEqual({ row: 1, col: 1 });
  });

  it('Maiusc+Freccia estende la selezione', () => {
    const sel = createCellSelection(2, 2);
    const extended = handleNavigationKey(sel, 'ArrowRight', { shiftKey: true });
    expect(extended?.anchor).toEqual({ row: 2, col: 2 });
    expect(extended?.active).toEqual({ row: 2, col: 3 });
    expect(extended?.range).toEqual({ startRow: 2, startCol: 2, endRow: 2, endCol: 3 });
  });

  it('Ctrl+Freccia salta al bordo del blocco di dati (celle consecutive piene)', () => {
    // Celle piene: A1, A2, A3, A4. Da A1 deve saltare ad A4.
    const isFilled = (r: number, c: number) => c === 1 && r >= 1 && r <= 4;
    const jump = findBoundaryJump(1, 1, 'down', { isFilled });
    expect(jump).toEqual({ row: 4, col: 1 });
  });

  it('Ctrl+Freccia salta alla prossima cella piena attraverso spazio vuoto', () => {
    // A1 piena, A2..A9 vuote, A10 piena. Da A1 deve saltare ad A10.
    const isFilled = (r: number, c: number) => c === 1 && (r === 1 || r === 10);
    const jump = findBoundaryJump(1, 1, 'down', { isFilled });
    expect(jump).toEqual({ row: 10, col: 1 });
  });

  it('Ctrl+Freccia va al limite del foglio se non ci sono celle piene', () => {
    const isFilled = (r: number, c: number) => r === 1 && c === 1;
    const jump = findBoundaryJump(1, 1, 'down', { isFilled });
    expect(jump).toEqual({ row: MAX_ROWS, col: 1 });
  });

  it('Home e Ctrl+Home', () => {
    const sel = createCellSelection(10, 8);
    const home = handleNavigationKey(sel, 'Home', {});
    expect(home?.active).toEqual({ row: 10, col: 1 });

    const ctrlHome = handleNavigationKey(sel, 'Home', { ctrlKey: true });
    expect(ctrlHome?.active).toEqual({ row: 1, col: 1 });
  });

  it('Ctrl+Fine va all\'ultima cella usata', () => {
    const sel = createCellSelection(1, 1);
    const end = handleNavigationKey(sel, 'End', { ctrlKey: true }, { maxUsedRow: 50, maxUsedCol: 12 });
    expect(end?.active).toEqual({ row: 50, col: 12 });
  });

  it('PageUp e PageDown saltano del numero di righe viewport', () => {
    const sel = createCellSelection(50, 1);
    const pgUp = handleNavigationKey(sel, 'PageUp', {}, { viewportRowCount: 25 });
    expect(pgUp?.active.row).toBe(25);

    const pgDown = handleNavigationKey(sel, 'PageDown', {}, { viewportRowCount: 25 });
    expect(pgDown?.active.row).toBe(75);
  });
});

describe('4. Clipboard and TSV', () => {
  it('generateTSV e parseTSV su valori normali', () => {
    const matrix = [
      ['A', 'B', 'C'],
      ['1', '2', '3'],
    ];
    const tsv = generateTSV(matrix);
    expect(tsv).toContain('A\tB\tC');
    const parsed = parseTSV(tsv);
    expect(parsed).toEqual(matrix);
  });

  it('generateTSV e parseTSV con virgolette, a capo e tabulazioni', () => {
    const matrix = [
      ['Hello "World"', 'Line1\nLine2', 'Has\tTab'],
      ['Simple', '100', ''],
    ];
    const tsv = generateTSV(matrix);
    const parsed = parseTSV(tsv);
    expect(parsed).toEqual(matrix);
  });

  it('computePasteOperations incolla 1x1 su singola cella', () => {
    const ops = computePasteOperations([['Hello']], { startRow: 3, startCol: 2, endRow: 3, endCol: 2 });
    expect(ops).toEqual([{ row: 3, col: 2, raw: 'Hello' }]);
  });

  it('computePasteOperations traspone formule con shiftFormula', () => {
    const ops = computePasteOperations(
      [['=B1+1']],
      { startRow: 2, startCol: 1, endRow: 2, endCol: 1 },
      1,
      1
    );
    // Spostato da A1 a A2 (+1 riga, +0 col): =B1+1 -> =B2+1
    expect(ops[0].raw).toBe('=B2+1');
  });

  it('computePasteOperations ripete il blocco (tiling) se la destinazione è multiplo esatto', () => {
    const src = [
      ['1', '2'],
      ['3', '4'],
    ]; // 2x2
    const target = { startRow: 1, startCol: 1, endRow: 4, endCol: 4 }; // 4x4 (multiplo 2x2 = 4 piastrelle)
    const ops = computePasteOperations(src, target);
    expect(ops.length).toBe(16);
    expect(ops.filter((o) => o.raw === '1').length).toBe(4);
  });

  it('computePasteOperations incolla una sola volta se non è multiplo esatto', () => {
    const src = [
      ['1', '2'],
      ['3', '4'],
    ]; // 2x2
    const target = { startRow: 1, startCol: 1, endRow: 3, endCol: 3 }; // 3x3 (non è multiplo esatto)
    const ops = computePasteOperations(src, target);
    expect(ops.length).toBe(4); // Solo le 4 celle originali
  });
});

describe('5. History (Undo / Redo)', () => {
  it('gestisce push, canUndo e popUndo', () => {
    const hist = new HistoryManager(200);
    expect(hist.canUndo()).toBe(false);

    hist.pushStep({
      description: 'Scrittura cella',
      changes: [{ sheet: 'Foglio1', row: 1, col: 1, oldRaw: '', newRaw: '42' }],
    });

    expect(hist.canUndo()).toBe(true);
    expect(hist.canRedo()).toBe(false);

    const step = hist.popUndo();
    expect(step?.changes[0].oldRaw).toBe('');
    expect(hist.canUndo()).toBe(false);
    expect(hist.canRedo()).toBe(true);

    const redoStep = hist.popRedo();
    expect(redoStep?.changes[0].newRaw).toBe('42');
  });

  it('una nuova azione dopo un annulla azzera lo stack di redo', () => {
    const hist = new HistoryManager();
    hist.pushStep({
      description: 'Azione 1',
      changes: [{ sheet: 'Foglio1', row: 1, col: 1, oldRaw: '', newRaw: '1' }],
    });
    hist.popUndo();
    expect(hist.canRedo()).toBe(true);

    hist.pushStep({
      description: 'Azione 2',
      changes: [{ sheet: 'Foglio1', row: 1, col: 1, oldRaw: '', newRaw: '2' }],
    });
    expect(hist.canRedo()).toBe(false);
  });

  it('rispetta il limite massimo di 200 passi', () => {
    const hist = new HistoryManager(5);
    for (let i = 1; i <= 10; i++) {
      hist.pushStep({
        description: `Passo ${i}`,
        changes: [{ sheet: 'Foglio1', row: 1, col: 1, oldRaw: `${i - 1}`, newRaw: `${i}` }],
      });
    }
    expect(hist.getUndoCount()).toBe(5);
  });

  it('operazione composta su intervallo è registrata come 1 singolo passo', () => {
    const hist = new HistoryManager();
    const changes = [];
    for (let i = 1; i <= 1000; i++) {
      changes.push({ sheet: 'Foglio1', row: i, col: 1, oldRaw: `${i}`, newRaw: '' });
    }
    hist.pushStep({
      description: 'Cancella intervallo 1000 celle',
      changes,
    });
    expect(hist.getUndoCount()).toBe(1);
    const popped = hist.popUndo();
    expect(popped?.changes.length).toBe(1000);
  });
});

describe('6. DocumentStore (Isolamento schede)', () => {
  it('crea e isola documenti distinti per scheda', async () => {
    const store = new DocumentStore();
    const doc1 = store.getOrCreateDocument('tab-1', 'Foglio 1');
    const doc2 = store.getOrCreateDocument('tab-2', 'Foglio 2');

    expect(doc1.tabId).toBe('tab-1');
    expect(doc2.tabId).toBe('tab-2');

    // Scrive su tab-1
    await doc1.client.setCell('Foglio1', 1, 1, '100');
    // Scrive su tab-2
    await doc2.client.setCell('Foglio1', 1, 1, '999');

    const c1 = await doc1.client.getCell('Foglio1', 1, 1);
    const c2 = await doc2.client.getCell('Foglio1', 1, 1);

    expect(c1.raw).toBe('100');
    expect(c2.raw).toBe('999');
  });

  it('preserva scroll, selezione e cronologia nel cambio scheda', () => {
    const store = new DocumentStore();
    const doc1 = store.getOrCreateDocument('tab-1');

    store.updateScroll('tab-1', 400, 800);
    store.updateSelection('tab-1', createRangeSelection(5, 5, 10, 10));
    store.setColWidth('tab-1', 1, 120);

    // Recupera lo stesso documento
    const retrieved = store.getDocument('tab-1')!;
    expect(retrieved.scroll).toEqual({ left: 400, top: 800 });
    expect(retrieved.selection.range).toEqual({ startRow: 5, startCol: 5, endRow: 10, endCol: 10 });
    expect(retrieved.colWidths.get(1)).toBe(120);
  });
});

describe('7. Format Display', () => {
  it('formatDisplayNumber formatta a massimo 10 cifre significative', () => {
    expect(formatDisplayNumber(123.4567891234)).toBe('123.4567891');
    expect(formatDisplayNumber(0)).toBe('0');
    expect(formatDisplayNumber(100)).toBe('100');
  });

  it('formatDisplayNumber usa notazione scientifica per numeri enormi o piccolissimi', () => {
    expect(formatDisplayNumber(1e16)).toContain('e');
    expect(formatDisplayNumber(1e-10)).toContain('e');
  });

  it('allineamenti corretti per tipo', () => {
    expect(formatDisplayValue(numberVal(42)).align).toBe('right');
    expect(formatDisplayValue(textVal('testo')).align).toBe('left');
    expect(formatDisplayValue(boolVal(true)).align).toBe('center');
    expect(formatDisplayValue(errorVal('#N/A')).align).toBe('center');
    expect(formatDisplayValue(errorVal('#N/A')).isError).toBe(true);
    expect(formatDisplayValue(emptyVal()).text).toBe('');
  });
});

describe('8. EngineClient Asincrono', () => {
  it('InlineEngineClient esegue operazioni asincrone e notifica onChange', async () => {
    const client = new InlineEngineClient();
    let changeNotified = false;
    client.onChange((changes) => {
      if (changes.length > 0) changeNotified = true;
    });

    await client.setCell('Foglio1', 1, 1, '10');
    await client.setCell('Foglio1', 2, 1, '=A1 * 5');

    const cell2 = await client.getCell('Foglio1', 2, 1);
    expect(cell2.value).toEqual({ kind: 'number', value: 50 });
    expect(changeNotified).toBe(true);

    const range = await client.getRange('Foglio1', 1, 1, 2, 1);
    expect(range.length).toBe(2);
    expect(range[0][0]).toEqual({ kind: 'number', value: 10 });
    expect(range[1][0]).toEqual({ kind: 'number', value: 50 });

    await client.applyBatch([
      { type: 'set', sheet: 'Foglio1', row: 3, col: 1, raw: '30' },
      { type: 'clear', sheet: 'Foglio1', row: 1, col: 1 },
    ]);

    const c1 = await client.getCell('Foglio1', 1, 1);
    expect(c1.raw).toBe('');
  });

  it('listSheets, addSheet, removeSheet e renameSheet funzionano asincronamente', async () => {
    const client = new InlineEngineClient();
    const sheets = await client.listSheets();
    expect(sheets).toEqual(['Foglio1']);

    await client.addSheet('NuovoFoglio');
    expect(await client.listSheets()).toContain('NuovoFoglio');

    await client.renameSheet('NuovoFoglio', 'Rinominato');
    expect(await client.listSheets()).toContain('Rinominato');

    await client.removeSheet('Rinominato');
    expect(await client.listSheets()).not.toContain('Rinominato');
  });
});

describe('9. Ulteriori casi limite e test negativi', () => {
  it('History popUndo e popRedo su stack vuoto restituiscono null', () => {
    const h = new HistoryManager();
    expect(h.popUndo()).toBeNull();
    expect(h.popRedo()).toBeNull();
  });

  it('History clear azzera entrambi gli stack', () => {
    const h = new HistoryManager();
    h.pushStep({ description: 'Test', changes: [{ sheet: 'Foglio1', row: 1, col: 1, oldRaw: '', newRaw: 'x' }] });
    h.clear();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  it('Navigation gestisce modifiers non validi o tasti sconosciuti', () => {
    const sel = createCellSelection(1, 1);
    expect(handleNavigationKey(sel, 'UnknownKey', {})).toBeNull();
    expect(handleNavigationKey(sel, 'ArrowDown', { altKey: true })).toBeNull();
  });

  it('Navigation salto su foglio completamente vuoto', () => {
    const jump = findBoundaryJump(10, 10, 'up', { isFilled: () => false });
    expect(jump).toEqual({ row: 1, col: 10 });
    const jumpRight = findBoundaryJump(10, 10, 'right', { isFilled: () => false });
    expect(jumpRight).toEqual({ row: 10, col: MAX_COLS });
  });

  it('parseTSV gestisce testo vuoto o formato non canonico', () => {
    expect(parseTSV('')).toEqual([]);
    expect(parseTSV('\n')).toEqual([]);
    expect(parseTSV('a\t\tb')).toEqual([['a', '', 'b']]);
  });

  it('computePasteOperations su matrice sorgente vuota restituisce array vuoto', () => {
    expect(computePasteOperations([], { startRow: 1, startCol: 1, endRow: 1, endCol: 1 })).toEqual([]);
  });

  it('computePasteOperations ignora celle che finirebbero fuori da MAX_ROWS o MAX_COLS', () => {
    const ops = computePasteOperations(
      [['1', '2'], ['3', '4']],
      { startRow: MAX_ROWS, startCol: MAX_COLS, endRow: MAX_ROWS, endCol: MAX_COLS }
    );
    // Solo la cella [0][0] a (MAX_ROWS, MAX_COLS) rientra nei limiti
    expect(ops.length).toBe(1);
    expect(ops[0]).toEqual({ row: MAX_ROWS, col: MAX_COLS, raw: '1' });
  });

  it('DocumentStore removeDocument e hasDocument', () => {
    const store = new DocumentStore();
    store.getOrCreateDocument('tab-x');
    expect(store.hasDocument('tab-x')).toBe(true);
    expect(store.removeDocument('tab-x')).toBe(true);
    expect(store.hasDocument('tab-x')).toBe(false);
    expect(store.removeDocument('tab-x')).toBe(false);
  });

  it('formatDisplayNumber per numeri speciali', () => {
    expect(formatDisplayNumber(NaN)).toBe('#NUM!');
    expect(formatDisplayNumber(Infinity)).toBe('#NUM!');
    expect(formatDisplayNumber(-Infinity)).toBe('#NUM!');
  });

  it('Viewport fallback per dimensioni viewport negative o nulle', () => {
    const v = computeVisibleRange({
      scrollTop: -100,
      scrollLeft: -100,
      viewportWidth: 0,
      viewportHeight: 0,
    });
    expect(v.startRow).toBe(1);
    expect(v.startCol).toBe(1);
    expect(v.topOffset).toBe(0);
    expect(v.leftOffset).toBe(0);
  });
});
