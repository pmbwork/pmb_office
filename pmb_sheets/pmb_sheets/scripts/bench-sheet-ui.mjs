/**
 * Benchmark UI e Operazioni su Griglia di Fogli (pmb_office).
 * Misura:
 * 1. Tempo medio di rendering dell'aggiornamento di 200 celle visibili e conteggio nodi cella (< 1.500).
 * 2. Operazioni su 50.000 celle (500 righe x 100 colonne): Canc, Annulla, Incolla (< 1.000 ms ciascuna).
 */

import { Window } from 'happy-dom';
import { performance } from 'perf_hooks';

// Configura ambiente DOM
const window = new Window({ url: 'http://localhost/' });
globalThis.window = window;
globalThis.document = window.document;
globalThis.customElements = window.customElements;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.MouseEvent = window.MouseEvent;

const { FreeSheetGrid } = await import('../src/components/sheet-grid.ts');
const { defaultDocumentStore, computePasteOperations } = await import('../src/sheet/index.ts');

function computeMedian(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

console.log('============================================================');
console.log(' BENCHMARK UI E OPERAZIONI GRIGLIA FOGLI (PMB_OFFICE)');
console.log('============================================================\n');

async function runUIBenchmark() {
  const tabId = 'bench-tab-ui';
  defaultDocumentStore.removeDocument(tabId);
  const grid = document.createElement('free-sheet-grid');
  grid.tabId = tabId;
  document.body.appendChild(grid);
  await grid.updateComplete;

  const doc = defaultDocumentStore.getDocument(tabId);

  // ---------------------------------------------------------------------------
  // Misura 1: Nodi DOM della griglia dopo scroll e posizione estrema
  // Soglia: < 1.500 nodi cella nel DOM
  // ---------------------------------------------------------------------------
  console.log('--- Misura 1: Conteggio nodi cella nel DOM e Limite Virtualizzazione ---');
  const renderedCellsInitial = grid.renderRoot.querySelectorAll('td.sheet-cell').length;
  console.log(`Nodi cella visualizzati (stato iniziale): ${renderedCellsInitial}`);

  // Simula scroll alla riga 1.048.576 e colonna 16.384
  const container = grid.renderRoot.querySelector('.grid-container');
  container.scrollTop = 1048500 * 22;
  container.scrollLeft = 16300 * 90;
  container.dispatchEvent(new Event('scroll'));
  await grid.updateComplete;

  const renderedCellsScrolled = grid.renderRoot.querySelectorAll('td.sheet-cell').length;
  console.log(`Nodi cella visualizzati (scroll estremo a riga 1.048.576 / col XFD): ${renderedCellsScrolled}`);
  const passDomNodes = renderedCellsScrolled < 1500;
  console.log(`-> Verifica soglia (< 1.500 celle): ${passDomNodes ? 'SUPERATO [CONFORME]' : 'FALLITO'}\n`);

  // ---------------------------------------------------------------------------
  // Misura 2: Tempo medio di aggiornamento di 200 celle visibili
  // ---------------------------------------------------------------------------
  console.log('--- Misura 2: Tempo di aggiornamento di 200 celle visibili ---');
  // Torna in cima
  container.scrollTop = 0;
  container.scrollLeft = 0;
  container.dispatchEvent(new Event('scroll'));
  await grid.updateComplete;

  const updateSamples = [];
  for (let iter = 1; iter <= 5; iter++) {
    const batch = [];
    for (let r = 1; r <= 20; r++) {
      for (let c = 1; c <= 10; c++) {
        batch.push({
          type: 'set',
          sheet: 'Foglio1',
          row: r,
          col: c,
          raw: `${iter * 100 + r * c}`,
        });
      }
    }
    const t0 = performance.now();
    await doc.client.applyBatch(batch);
    await grid.updateComplete;
    const elapsed = performance.now() - t0;
    updateSamples.push(elapsed);
    console.log(`  Iterazione ${iter} (200 celle): ${elapsed.toFixed(2)} ms`);
  }
  const medianUpdate = computeMedian(updateSamples);
  console.log(`-> Tempo mediano aggiornamento 200 celle: ${medianUpdate.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // Misura 3: Operazioni su 50.000 celle (Incolla, Cancella, Annulla)
  // Requisito: intervallo di 50.000 celle senza bloccare per più di 1 s (< 1.000 ms)
  // ---------------------------------------------------------------------------
  console.log('--- Misura 3: Intervallo di 50.000 celle (500 righe x 100 colonne) ---');
  const ROWS = 500;
  const COLS = 100;
  const TOTAL_CELLS = ROWS * COLS; // 50.000

  // 3a. Incolla / Popolamento 50.000 celle
  console.log(`Avvio Incolla di ${TOTAL_CELLS.toLocaleString()} celle...`);
  const rawMatrix = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push(`=A1 + ${r + c}`);
    }
    rawMatrix.push(row);
  }

  const pasteOps = computePasteOperations(rawMatrix, {
    startRow: 1,
    startCol: 1,
    endRow: ROWS,
    endCol: COLS,
  });

  const t0Paste = performance.now();
  const pasteBatch = pasteOps.map((op) => ({
    type: 'set',
    sheet: 'Foglio1',
    row: op.row,
    col: op.col,
    raw: op.raw,
  }));
  doc.history.pushStep({
    description: `Incolla ${TOTAL_CELLS} celle`,
    changes: pasteOps.map((op) => ({
      sheet: 'Foglio1',
      row: op.row,
      col: op.col,
      oldRaw: '',
      newRaw: op.raw,
    })),
  });
  await doc.client.applyBatch(pasteBatch);
  const timePaste = performance.now() - t0Paste;
  console.log(`Tempo Incolla 50.000 celle: ${timePaste.toFixed(2)} ms`);
  const passPaste = timePaste < 1000;
  console.log(`-> Verifica soglia (< 1.000 ms): ${passPaste ? 'SUPERATO [CONFORME]' : 'FALLITO'}`);

  // 3b. Cancella (Canc) 50.000 celle
  console.log(`\nAvvio Cancella (Delete) di ${TOTAL_CELLS.toLocaleString()} celle...`);
  const t0Clear = performance.now();
  const clearBatch = [];
  const clearChanges = [];
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      clearBatch.push({ type: 'clear', sheet: 'Foglio1', row: r, col: c });
      clearChanges.push({ sheet: 'Foglio1', row: r, col: c, oldRaw: `=A1 + ${r + c - 2}`, newRaw: '' });
    }
  }
  doc.history.pushStep({
    description: `Cancella ${TOTAL_CELLS} celle`,
    changes: clearChanges,
  });
  await doc.client.applyBatch(clearBatch);
  const timeClear = performance.now() - t0Clear;
  console.log(`Tempo Cancella 50.000 celle: ${timeClear.toFixed(2)} ms`);
  const passClear = timeClear < 1000;
  console.log(`-> Verifica soglia (< 1.000 ms): ${passClear ? 'SUPERATO [CONFORME]' : 'FALLITO'}`);

  // 3c. Annulla (Undo) 50.000 celle
  console.log(`\nAvvio Annulla (Undo) di ${TOTAL_CELLS.toLocaleString()} celle...`);
  const t0Undo = performance.now();
  const step = doc.history.popUndo();
  if (step) {
    const undoBatch = step.changes.map((ch) => ({
      type: ch.oldRaw === '' ? 'clear' : 'set',
      sheet: ch.sheet,
      row: ch.row,
      col: ch.col,
      raw: ch.oldRaw,
    }));
    await doc.client.applyBatch(undoBatch);
  }
  const timeUndo = performance.now() - t0Undo;
  console.log(`Tempo Annulla 50.000 celle: ${timeUndo.toFixed(2)} ms`);
  const passUndo = timeUndo < 1000;
  console.log(`-> Verifica soglia (< 1.000 ms): ${passUndo ? 'SUPERATO [CONFORME]' : 'FALLITO'}\n`);

  console.log('============================================================');
  console.log(' RIEPILOGO CRITERI BENCHMARK UI (P02)');
  console.log('============================================================');
  console.log(`1. Nodi DOM massimi dopo scroll: ${renderedCellsScrolled} (< 1.500) -> ${passDomNodes ? 'OK' : 'KO'}`);
  console.log(`2. Aggiornamento 200 celle visibili: ${medianUpdate.toFixed(2)} ms`);
  console.log(`3. Incolla 50.000 celle: ${timePaste.toFixed(2)} ms (< 1.000 ms) -> ${passPaste ? 'OK' : 'KO'}`);
  console.log(`4. Cancella 50.000 celle: ${timeClear.toFixed(2)} ms (< 1.000 ms) -> ${passClear ? 'OK' : 'KO'}`);
  console.log(`5. Annulla 50.000 celle: ${timeUndo.toFixed(2)} ms (< 1.000 ms) -> ${passUndo ? 'OK' : 'KO'}`);
  console.log('============================================================\n');

  grid.remove();
  defaultDocumentStore.removeDocument(tabId);

  if (!passDomNodes || !passPaste || !passClear || !passUndo) {
    process.exit(1);
  }
}

runUIBenchmark().catch((err) => {
  console.error('Errore durante benchmark UI:', err);
  process.exit(1);
});
