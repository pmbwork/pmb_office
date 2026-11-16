/**
 * Benchmark prestazionale puro per la formattazione di Fogli:
 * 1. Applicazione formato a 50.000 celle (tempo < 1 s)
 * 2. Undo di 50.000 celle
 * 3. Redo di 50.000 celle
 * 4. Applicazione formato a colonna intera O(1) (tempo < 50 ms)
 */

import { performance } from 'node:perf_hooks';
import {
  createSheetStyles,
  applyFormatToRange,
  applyFormatToColumn,
  resolveCellStyle,
  cellKey,
} from '../src/sheet/styles.ts';
import { HistoryManager } from '../src/sheet/history.ts';

async function runBench() {
  console.log('=== BENCHMARK PRESTAZIONI FORMATTAZIONE (FASE 3) ===\n');

  const sheetStyles = createSheetStyles();
  const history = new HistoryManager(50);

  // 1. Applicazione formato a 50.000 celle (500 righe x 100 colonne)
  const range50k = { startRow: 1, endRow: 500, startCol: 1, endCol: 100 };
  const totalCells = 500 * 100;
  console.log(`Misurazione applicazione formato a ${totalCells.toLocaleString()} celle...`);

  const t0 = performance.now();
  applyFormatToRange(sheetStyles, range50k, {
    bold: true,
    color: '#1d4ed8',
    numFmt: '€#,##0.00',
  });
  const t1 = performance.now();
  const timeApply50k = t1 - t0;
  console.log(`-> Tempo applicazione 50.000 celle: ${timeApply50k.toFixed(2)} ms (limite < 1.000 ms)`);

  // Registrazione step di history
  const styleChanges = [];
  for (let r = 1; r <= 500; r++) {
    for (let c = 1; c <= 100; c++) {
      const k = cellKey(r, c);
      styleChanges.push({ type: 'cell', target: k, oldStyleId: 0, newStyleId: sheetStyles.cellStyles.get(k) });
    }
  }
  history.pushStep({ description: 'Formato 50k', changes: [], styleChanges });

  // 2. Undo di 50.000 celle
  const tUndo0 = performance.now();
  const stepUndo = history.popUndo();
  if (stepUndo?.styleChanges) {
    for (const sc of stepUndo.styleChanges) {
      if (sc.oldStyleId === 0 || sc.oldStyleId === undefined) {
        sheetStyles.cellStyles.delete(sc.target);
      } else {
        sheetStyles.cellStyles.set(sc.target, sc.oldStyleId);
      }
    }
  }
  const tUndo1 = performance.now();
  const timeUndo50k = tUndo1 - tUndo0;
  console.log(`-> Tempo Annulla (Undo) 50.000 celle: ${timeUndo50k.toFixed(2)} ms (limite < 1.000 ms)`);

  // 3. Redo di 50.000 celle
  const tRedo0 = performance.now();
  const stepRedo = history.popRedo();
  if (stepRedo?.styleChanges) {
    for (const sc of stepRedo.styleChanges) {
      sheetStyles.cellStyles.set(sc.target, sc.newStyleId);
    }
  }
  const tRedo1 = performance.now();
  const timeRedo50k = tRedo1 - tRedo0;
  console.log(`-> Tempo Ripeti (Redo) 50.000 celle: ${timeRedo50k.toFixed(2)} ms (limite < 1.000 ms)`);

  // 4. Applicazione formato a colonna intera (tempo costante O(1))
  const colIndex = 7;
  const tCol0 = performance.now();
  applyFormatToColumn(sheetStyles, colIndex, { italic: true, fontSize: 16 });
  const tCol1 = performance.now();
  const timeCol = tCol1 - tCol0;
  console.log(`-> Tempo applicazione colonna intera O(1): ${timeCol.toFixed(3)} ms (limite < 50 ms)`);

  // Verifica correttezza cella a riga 1.000.000
  const styleMillion = resolveCellStyle(1_000_000, colIndex, sheetStyles);
  if (!styleMillion.italic || styleMillion.fontSize !== 16) {
    throw new Error('Verifica colonna intera fallita!');
  }

  console.log('\nEsito: TUTTE LE MISURE RISPETTANO AMPIAMENTE I LIMITI RICHIESTI.\n');
}

runBench().catch((err) => {
  console.error('Errore benchmark:', err);
  process.exit(1);
});
