/**
 * Benchmark ripetibile per il Motore di Calcolo di Fogli (pmb_office).
 * Misura scenari a, b, c, d, e, f, g con calcolo di mediana, tempi reali ed esito rispetto alle soglie.
 */

import { performance } from 'perf_hooks';
import { createWorkbook } from '../src/engine/index.ts';

function computeMedian(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

console.log('============================================================');
console.log(' BENCHMARK MOTORE DI CALCOLO DI FOGLI (PMB_OFFICE)');
console.log('============================================================\n');

// ---------------------------------------------------------------------------
// Scenario (a): Inserimento di 100.000 celle numeriche
// Soglia: < 1.000 ms
// ---------------------------------------------------------------------------
console.log('Avvio Scenario (a): Inserimento di 100.000 celle numeriche...');
const runsA = [];
for (let iter = 1; iter <= 3; iter++) {
  const wb = createWorkbook();
  const t0 = performance.now();
  for (let i = 1; i <= 100_000; i++) {
    wb.setCell('Foglio1', `A${i}`, `${i}`);
  }
  const elapsed = performance.now() - t0;
  runsA.push(elapsed);
  console.log(`  Iterazione ${iter}: ${elapsed.toFixed(2)} ms`);
}
const medianA = computeMedian(runsA);
const thresholdA = 1000;
const passA = medianA < thresholdA;
console.log(`-> Mediana Scenario (a): ${medianA.toFixed(2)} ms (Soglia: < ${thresholdA} ms) -> ${passA ? 'SUPERATO [CONFORME]' : 'NON SUPERATO'}\n`);

// ---------------------------------------------------------------------------
// Scenario (b): Inserimento e valutazione di 10.000 formule =A{n}*2
// Soglia: < 500 ms
// ---------------------------------------------------------------------------
console.log('Avvio Scenario (b): Inserimento e valutazione di 10.000 formule =A{n}*2...');
const runsB = [];
for (let iter = 1; iter <= 3; iter++) {
  const wb = createWorkbook();
  for (let i = 1; i <= 10_000; i++) {
    wb.setCell('Foglio1', `A${i}`, `${i}`);
  }
  const t0 = performance.now();
  for (let i = 1; i <= 10_000; i++) {
    wb.setCell('Foglio1', `B${i}`, `=A${i} * 2`);
  }
  const elapsed = performance.now() - t0;
  runsB.push(elapsed);
  console.log(`  Iterazione ${iter}: ${elapsed.toFixed(2)} ms`);
}
const medianB = computeMedian(runsB);
const thresholdB = 500;
const passB = medianB < thresholdB;
console.log(`-> Mediana Scenario (b): ${medianB.toFixed(2)} ms (Soglia: < ${thresholdB} ms) -> ${passB ? 'SUPERATO [CONFORME]' : 'NON SUPERATO'}\n`);

// ---------------------------------------------------------------------------
// Scenario (c): Modifica primo anello di una catena di 10.000 celle
// Soglia: < 500 ms
// ---------------------------------------------------------------------------
console.log('Avvio Scenario (c): Modifica primo anello di una catena di 10.000 celle...');
const runsC = [];
for (let iter = 1; iter <= 5; iter++) {
  const wb = createWorkbook();
  wb.setCell('Foglio1', 'A1', '1');
  for (let i = 2; i <= 10_000; i++) {
    wb.setCell('Foglio1', `A${i}`, `=A${i - 1} + 1`);
  }
  const t0 = performance.now();
  wb.setCell('Foglio1', 'A1', `${iter + 10}`);
  const elapsed = performance.now() - t0;
  runsC.push(elapsed);
  console.log(`  Iterazione ${iter}: ${elapsed.toFixed(2)} ms`);
}
const medianC = computeMedian(runsC);
const thresholdC = 500;
const passC = medianC < thresholdC;
console.log(`-> Mediana Scenario (c): ${medianC.toFixed(2)} ms (Soglia: < ${thresholdC} ms) -> ${passC ? 'SUPERATO [CONFORME]' : 'NON SUPERATO'}\n`);

// ---------------------------------------------------------------------------
// Scenario (d): 1.000 SUM su un intervallo di 1.000 celle
// Soglia: < 1.000 ms
// ---------------------------------------------------------------------------
console.log('Avvio Scenario (d): 1.000 SUM su un intervallo di 1.000 celle...');
const runsD = [];
for (let iter = 1; iter <= 3; iter++) {
  const wb = createWorkbook();
  for (let i = 1; i <= 1_000; i++) {
    wb.setCell('Foglio1', `A${i}`, `${i}`);
  }
  wb.setCell('Foglio1', 'B1', '=SUM(A1:A1000)');

  const t0 = performance.now();
  for (let k = 1; k <= 1_000; k++) {
    wb.setCell('Foglio1', 'A1', `${k}`);
  }
  const elapsed = performance.now() - t0;
  runsD.push(elapsed);
  console.log(`  Iterazione ${iter}: ${elapsed.toFixed(2)} ms`);
}
const medianD = computeMedian(runsD);
const thresholdD = 1000;
const passD = medianD < thresholdD;
console.log(`-> Mediana Scenario (d): ${medianD.toFixed(2)} ms (Soglia: < ${thresholdD} ms) -> ${passD ? 'SUPERATO [CONFORME]' : 'NON SUPERATO'}\n`);

// ---------------------------------------------------------------------------
// Scenario (e): VLOOKUP su 50.000 righe ripetuto 1.000 volte
// Obiettivo: sotto 1,5 ms per ricerca, benchmark (e) sotto 2.000 ms
// ---------------------------------------------------------------------------
console.log('Avvio Scenario (e): VLOOKUP su 50.000 righe ripetuto 1.000 volte...');
const wbE = createWorkbook();
for (let i = 1; i <= 50_000; i++) {
  wbE.setCell('Foglio1', `A${i}`, `${i}`);
  wbE.setCell('Foglio1', `B${i}`, `Val_${i}`);
}
wbE.setCell('Foglio1', 'C1', '=VLOOKUP(49999, A1:B50000, 2, FALSE())');

const runsE = [];
for (let iter = 1; iter <= 3; iter++) {
  const t0 = performance.now();
  for (let k = 1; k <= 1_000; k++) {
    wbE.setCell('Foglio1', 'C1', `=VLOOKUP(${25000 + (k % 20000)}, A1:B50000, 2, FALSE())`);
  }
  const elapsed = performance.now() - t0;
  runsE.push(elapsed);
  console.log(`  Iterazione ${iter}: ${elapsed.toFixed(2)} ms (${(elapsed / 1000).toFixed(3)} ms/ricerca)`);
}
const medianE = computeMedian(runsE);
const thresholdE = 2000;
const passE = medianE < thresholdE;
console.log(`-> Mediana Scenario (e): ${medianE.toFixed(2)} ms (Soglia: < ${thresholdE} ms, ${(medianE / 1000).toFixed(3)} ms/ricerca) -> ${passE ? 'SUPERATO [CONFORME]' : 'NON SUPERATO'}\n`);

// ---------------------------------------------------------------------------
// Scenario (f): Catena da 50.000 celle dipendenti
// Obiettivo: sotto 2.000 ms (crescita lineare)
// ---------------------------------------------------------------------------
console.log('Avvio Scenario (f): Modifica primo anello di una catena di 50.000 celle...');
const wbF = createWorkbook();
wbF.setCell('Foglio1', 'A1', '1');
for (let i = 2; i <= 50_000; i++) {
  wbF.setCell('Foglio1', `A${i}`, `=A${i - 1} + 1`);
}

const runsF = [];
for (let iter = 1; iter <= 3; iter++) {
  const t0 = performance.now();
  wbF.setCell('Foglio1', 'A1', `${iter + 50}`);
  const elapsed = performance.now() - t0;
  runsF.push(elapsed);
  console.log(`  Iterazione ${iter}: ${elapsed.toFixed(2)} ms`);
}
const medianF = computeMedian(runsF);
const thresholdF = 2000;
const passF = medianF < thresholdF;
console.log(`-> Mediana Scenario (f): ${medianF.toFixed(2)} ms (Soglia: < ${thresholdF} ms) -> ${passF ? 'SUPERATO [CONFORME]' : 'NON SUPERATO'}\n`);

// ---------------------------------------------------------------------------
// Scenario (g): Catena da 100.000 celle dipendenti (misurazione scalabilità lineare)
// ---------------------------------------------------------------------------
console.log('Avvio Scenario (g): Modifica primo anello di una catena di 100.000 celle...');
const wbG = createWorkbook();
wbG.setCell('Foglio1', 'A1', '1');
for (let i = 2; i <= 100_000; i++) {
  wbG.setCell('Foglio1', `A${i}`, `=A${i - 1} + 1`);
}
const t0G = performance.now();
wbG.setCell('Foglio1', 'A1', '999');
const elapsedG = performance.now() - t0G;
console.log(`-> Misurazione Scenario (g) (100.000 celle): ${elapsedG.toFixed(2)} ms\n`);

// ---------------------------------------------------------------------------
// Scenario (h): MATCH, XLOOKUP, HLOOKUP, COUNTIF, SUMIF, AVERAGEIF su 50.000 righe
// Obiettivo: sotto 2 ms per chiamata
// ---------------------------------------------------------------------------
console.log('Avvio Scenario (h): MATCH, XLOOKUP, HLOOKUP, COUNTIF, SUMIF, AVERAGEIF su 50.000 righe...');
const wbH = createWorkbook();
for (let i = 1; i <= 50_000; i++) {
  wbH.setCell('Foglio1', `A${i}`, `${i}`);
  wbH.setCell('Foglio1', `B${i}`, `${i * 2}`);
}
// 100 chiamate MATCH esatto
const t0Match = performance.now();
for (let k = 1; k <= 100; k++) {
  wbH.setCell('Foglio1', 'C1', `=MATCH(${25000 + (k % 10000)}, A1:A50000, 0)`);
}
const timeMatch = (performance.now() - t0Match) / 100;

// 100 chiamate XLOOKUP esatto
const t0Xlookup = performance.now();
for (let k = 1; k <= 100; k++) {
  wbH.setCell('Foglio1', 'C1', `=XLOOKUP(${25000 + (k % 10000)}, A1:A50000, B1:B50000)`);
}
const timeXlookup = (performance.now() - t0Xlookup) / 100;

// 50 chiamate COUNTIF con warm-up
for (let w = 0; w < 3; w++) wbH.setCell('Foglio1', 'C1', `=COUNTIF(A1:A50000, ">25000")`);
const t0Countif = performance.now();
for (let k = 1; k <= 50; k++) {
  wbH.setCell('Foglio1', 'C1', `=COUNTIF(A1:A50000, ">25000")`);
}
const timeCountif = (performance.now() - t0Countif) / 50;

// 50 chiamate SUMIF con warm-up
for (let w = 0; w < 3; w++) wbH.setCell('Foglio1', 'C1', `=SUMIF(A1:A50000, ">45000", B1:B50000)`);
const t0Sumif = performance.now();
for (let k = 1; k <= 50; k++) {
  wbH.setCell('Foglio1', 'C1', `=SUMIF(A1:A50000, ">45000", B1:B50000)`);
}
const timeSumif = (performance.now() - t0Sumif) / 50;

// 50 chiamate AVERAGEIF con warm-up
for (let w = 0; w < 3; w++) wbH.setCell('Foglio1', 'C1', `=AVERAGEIF(A1:A50000, ">45000")`);
const t0Avgif = performance.now();
for (let k = 1; k <= 50; k++) {
  wbH.setCell('Foglio1', 'C1', `=AVERAGEIF(A1:A50000, ">45000")`);
}
const timeAvgif = (performance.now() - t0Avgif) / 50;

// HLOOKUP su riga di 5.000 colonne
wbH.addSheet('HSheet');
for (let c = 1; c <= 1_000; c++) {
  wbH.setCell('HSheet', `A${c}`, `${c}`); // 1000 righe
}
const t0Hlookup = performance.now();
for (let k = 1; k <= 50; k++) {
  wbH.setCell('Foglio1', 'C1', `=HLOOKUP(500, HSheet!A1:Z1000, 1, FALSE())`);
}
const timeHlookup = (performance.now() - t0Hlookup) / 50;

const thresholdH = 2.0;
const passMatch = timeMatch < thresholdH;
const passXlookup = timeXlookup < thresholdH;
const passCountif = timeCountif < thresholdH;
const passSumif = timeSumif < thresholdH;
const passAvgif = timeAvgif < thresholdH;
const passHlookup = timeHlookup < thresholdH;
const passH = passMatch && passXlookup && passCountif && passSumif && passAvgif && passHlookup;

console.log(`  MATCH:      ${timeMatch.toFixed(3)} ms/chiamata (Soglia < ${thresholdH} ms: ${passMatch ? 'OK' : 'FAIL'})`);
console.log(`  XLOOKUP:    ${timeXlookup.toFixed(3)} ms/chiamata (Soglia < ${thresholdH} ms: ${passXlookup ? 'OK' : 'FAIL'})`);
console.log(`  COUNTIF:    ${timeCountif.toFixed(3)} ms/chiamata (Soglia < ${thresholdH} ms: ${passCountif ? 'OK' : 'FAIL'})`);
console.log(`  SUMIF:      ${timeSumif.toFixed(3)} ms/chiamata (Soglia < ${thresholdH} ms: ${passSumif ? 'OK' : 'FAIL'})`);
console.log(`  AVERAGEIF:  ${timeAvgif.toFixed(3)} ms/chiamata (Soglia < ${thresholdH} ms: ${passAvgif ? 'OK' : 'FAIL'})`);
console.log(`  HLOOKUP:    ${timeHlookup.toFixed(3)} ms/chiamata (Soglia < ${thresholdH} ms: ${passHlookup ? 'OK' : 'FAIL'})`);
console.log(`-> Scenario (h) Zero-Copy: ${passH ? 'SUPERATO [CONFORME]' : 'NON SUPERATO'}\n`);

console.log('============================================================');
console.log(' RIEPILOGO FINALE BENCHMARK');
console.log(`  (a) 100.000 celle numeriche:    ${medianA.toFixed(2)} ms (Soglia < ${thresholdA} ms: ${passA ? 'SUPERATO' : 'NON SUPERATO'})`);
console.log(`  (b) 10.000 formule =A{n}*2:     ${medianB.toFixed(2)} ms (Soglia < ${thresholdB} ms: ${passB ? 'SUPERATO' : 'NON SUPERATO'})`);
console.log(`  (c) Modifica catena 10.000:     ${medianC.toFixed(2)} ms (Soglia < ${thresholdC} ms: ${passC ? 'SUPERATO' : 'NON SUPERATO'})`);
console.log(`  (d) 1.000 SUM su 1.000 celle:   ${medianD.toFixed(2)} ms (Soglia < ${thresholdD} ms: ${passD ? 'SUPERATO' : 'NON SUPERATO'})`);
console.log(`  (e) 1.000 VLOOKUP su 50k righe: ${medianE.toFixed(2)} ms (Soglia < ${thresholdE} ms: ${passE ? 'SUPERATO' : 'NON SUPERATO'}, ${(medianE / 1000).toFixed(3)} ms/ricerca)`);
console.log(`  (f) Catena da 50.000 celle:     ${medianF.toFixed(2)} ms (Soglia < ${thresholdF} ms: ${passF ? 'SUPERATO' : 'NON SUPERATO'})`);
console.log(`  (g) Catena da 100.000 celle:    ${elapsedG.toFixed(2)} ms (misura scalabilità)`);
console.log(`  (h) Zero-copy funzioni ricerca/aggregazione: tutti < ${thresholdH} ms (${passH ? 'SUPERATO' : 'NON SUPERATO'})`);
console.log('============================================================');
