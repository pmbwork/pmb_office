import fs from 'fs';
import path from 'path';
import CDP from 'chrome-remote-interface';

const appDir = process.argv[2] || process.cwd();
const simFail = process.argv[3] || '';

const verificaDir = path.join(appDir, 'verifica');
if (!fs.existsSync(verificaDir)) {
  fs.mkdirSync(verificaDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  let client;
  try {
    console.log('[SMOKE-ADVANCED] Connessione a CDP su porta 9222...');
    client = await CDP({ port: 9222 });
    const { Runtime, Input, Page } = client;

    await Runtime.enable();
    await Page.enable();

    // Listener per violazioni CSP o errori console
    const cspViolations = [];
    Runtime.consoleAPICalled(({ type, args }) => {
      const text = args.map((a) => a.value || a.description || '').join(' ');
      if (text.toLowerCase().includes('content security policy') || text.toLowerCase().includes('violat')) {
        cspViolations.push(text);
      }
    });

    const evaluate = async (expr) => {
      const res = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) {
        throw new Error(`Eccezione JS: ${res.exceptionDetails.text} (${JSON.stringify(res.exceptionDetails.exception)})`);
      }
      return res.result.value;
    };

    const captureScreenshot = async (filename) => {
      const ss = await Page.captureScreenshot({ format: 'png' });
      const buf = Buffer.from(ss.data, 'base64');
      const dest = path.join(verificaDir, filename);
      fs.writeFileSync(dest, buf);
      console.log(`[SCREENSHOT OK] Salvato ${filename} (${buf.length} bytes)`);

      // Verifica integrità header PNG
      if (buf.length < 5000 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) {
        throw new Error(`FILE PNG NON VALIDO O CORROTTO: ${filename}`);
      }
      return buf;
    };

    console.log('[SMOKE-ADVANCED] Inizializzazione applicazione...');
    await sleep(500);

    // Assicura che la scheda attiva sia Fogli
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const sheetTab = app.tabs.find(t => t.type === 'sheet');
      if (sheetTab) {
        app.activeTabId = sheetTab.id;
      } else {
        app.handleTabCreated(new CustomEvent('tab-created', { detail: { type: 'sheet' } }));
      }
    })()`);
    await sleep(400);

    console.log('\n--- FASE 1: Formule di Matrice Dinamica (Spill) e Gestione Collisioni #SPILL! ---');
    // Popola A1 con =SEQUENCE(4, 2, 10, 5)
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 1, 1, '=SEQUENCE(4, 2, 10, 5)');
      grid.cellsCache.clear();
      grid.updateViewport();
      grid.requestUpdate();
    })()`);
    await sleep(300);

    const spillVerification = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const a1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
      const b1 = await doc.client.getCell(doc.activeSheetName, 1, 2);
      const a2 = await doc.client.getCell(doc.activeSheetName, 2, 1);
      const b2 = await doc.client.getCell(doc.activeSheetName, 2, 2);
      const a3 = await doc.client.getCell(doc.activeSheetName, 3, 1);
      const b3 = await doc.client.getCell(doc.activeSheetName, 3, 2);
      const a4 = await doc.client.getCell(doc.activeSheetName, 4, 1);
      const b4 = await doc.client.getCell(doc.activeSheetName, 4, 2);

      return {
        a1: a1.value,
        b1: b1.value,
        a2: a2.value,
        b2: b2.value,
        a3: a3.value,
        b3: b3.value,
        a4: a4.value,
        b4: b4.value,
      };
    })()`);

    console.log(`-> SEQUENCE generato: A1=${spillVerification.a1.value}, B1=${spillVerification.b1.value}, A2=${spillVerification.a2.value}, B2=${spillVerification.b2.value}, A3=${spillVerification.a3.value}, B3=${spillVerification.b3.value}, A4=${spillVerification.a4.value}, B4=${spillVerification.b4.value}`);

    if (
      spillVerification.a1.value !== 10 ||
      spillVerification.b1.value !== 15 ||
      spillVerification.a2.value !== 20 ||
      spillVerification.b2.value !== 25 ||
      spillVerification.a3.value !== 30 ||
      spillVerification.b3.value !== 35 ||
      spillVerification.a4.value !== 40 ||
      spillVerification.b4.value !== 45
    ) {
      throw new Error(`ASSERZIONE FALLITA: Matrice dinamica SEQUENCE non propagata correttamente!`);
    }

    // Test collisione #SPILL!: scrive un ostacolo in B3
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 3, 2, 'blocco');
      grid.cellsCache.clear();
      grid.updateViewport();
      grid.requestUpdate();
    })()`);
    await sleep(200);

    const collisionCheck = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const a1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
      return a1.value;
    })()`);

    console.log(`-> Collisione con cella occupata B3: valore A1 = ${collisionCheck.error || JSON.stringify(collisionCheck)}`);
    if (collisionCheck.kind !== 'error' || collisionCheck.error !== '#SPILL!') {
      throw new Error(`ASSERZIONE FALLITA: Mancato rilevamento errore #SPILL! su collisione`);
    }

    // Rimuove l'ostacolo da B3 e verifica il ripristino dello spill
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 3, 2, '');
      grid.cellsCache.clear();
      grid.updateViewport();
      grid.requestUpdate();
    })()`);
    await sleep(200);

    const restoredCheck = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const a1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
      const b3 = await doc.client.getCell(doc.activeSheetName, 3, 2);
      return { a1Val: a1.value, b3Val: b3.value };
    })()`);

    console.log(`-> Ripristino automatico spill: A1=${restoredCheck.a1Val.value}, B3=${restoredCheck.b3Val.value}`);
    if (restoredCheck.a1Val.value !== 10 || restoredCheck.b3Val.value !== 35) {
      throw new Error(`ASSERZIONE FALLITA: Spill non ripristinato dopo rimozione ostacolo`);
    }

    await captureScreenshot('array-dinamici-spill.png');

    console.log('\n--- FASE 2: Grafici SVG Nativi e Conformità CSP ---');
    // Popola dati in D1:E4 per generare un grafico a colonne
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 1, 4, 'Mele');
      await doc.client.setCell(doc.activeSheetName, 2, 4, 'Pere');
      await doc.client.setCell(doc.activeSheetName, 3, 4, 'Arance');
      await doc.client.setCell(doc.activeSheetName, 4, 4, 'Banane');
      await doc.client.setCell(doc.activeSheetName, 1, 5, '45');
      await doc.client.setCell(doc.activeSheetName, 2, 5, '70');
      await doc.client.setCell(doc.activeSheetName, 3, 5, '30');
      await doc.client.setCell(doc.activeSheetName, 4, 5, '85');

      grid.selectSingle(1, 4);
      grid.extendSelectionTo(4, 5);
      await grid.insertChart('column');
      grid.requestUpdate();
    })()`);
    await sleep(400);

    const chartDomVerification = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const overlay = grid.renderRoot.querySelector('free-chart-overlay');
      if (!overlay) return { error: 'free-chart-overlay mancante' };

      const chartContainer = overlay.renderRoot.querySelector('.chart-container');
      const svg = overlay.renderRoot.querySelector('svg');
      if (!svg) return { error: 'svg mancante nel grafico' };

      const columns = svg.querySelectorAll('.chart-column');
      // Controllo CSP: nessun elemento SVG deve avere attributo style=""
      const allSvgNodes = svg.querySelectorAll('*');
      let inlineStyleCount = 0;
      for (const node of allSvgNodes) {
        if (node.hasAttribute('style')) inlineStyleCount++;
      }

      return {
        hasOverlay: true,
        hasContainer: chartContainer !== null,
        hasSvg: true,
        columnCount: columns.length,
        inlineStyleCount,
      };
    })()`);

    console.log(`-> Grafico SVG: overlay presente=${chartDomVerification.hasOverlay}, colonne renderizzate=${chartDomVerification.columnCount}, violazioni inline style=${chartDomVerification.inlineStyleCount}`);

    if (!chartDomVerification.hasOverlay || chartDomVerification.columnCount !== 4) {
      throw new Error(`ASSERZIONE FALLITA: Grafico a colonne SVG non renderizzato correttamente!`);
    }
    if (chartDomVerification.inlineStyleCount > 0) {
      throw new Error(`ASSERZIONE FALLITA: Rilevati ${chartDomVerification.inlineStyleCount} attributi style="" in linea nel grafico (CSP violata)!`);
    }

    await captureScreenshot('grafici-svg.png');

    console.log('\n--- FASE 3: Tabelle Pivot con Aggregazione e Totali ---');
    // Popola dati in G1:H5 per calcolare una tabella pivot
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 1, 7, 'Zona');
      await doc.client.setCell(doc.activeSheetName, 1, 8, 'Fatturato');
      await doc.client.setCell(doc.activeSheetName, 2, 7, 'Nord');
      await doc.client.setCell(doc.activeSheetName, 2, 8, '500');
      await doc.client.setCell(doc.activeSheetName, 3, 7, 'Centro');
      await doc.client.setCell(doc.activeSheetName, 3, 8, '300');
      await doc.client.setCell(doc.activeSheetName, 4, 7, 'Sud');
      await doc.client.setCell(doc.activeSheetName, 4, 8, '400');
      await doc.client.setCell(doc.activeSheetName, 5, 7, 'Nord');
      await doc.client.setCell(doc.activeSheetName, 5, 8, '250');

      grid.selectSingle(1, 7);
      grid.extendSelectionTo(5, 8);
      const pivotCfg = await grid.insertPivotTable();
      pivotCfg.sourceRange = 'G1:H5';
      pivotCfg.rowFields = [{ sourceColIndex: 0, name: 'Zona' }];
      pivotCfg.valueFields = [{ sourceColIndex: 1, name: 'Fatturato', aggregation: 'SUM' }];
      pivotCfg.showGrandTotals = true;

      // Renderizza la tabella pivot calcolata nelle celle a partire da riga 8 colonna 7 (G8)
      await grid.computeAndRenderPivot(pivotCfg, doc.activeSheetName, 8, 7);
      grid.cellsCache.clear();
      grid.updateViewport();
      grid.requestUpdate();
    })()`);
    await sleep(400);

    const pivotVerification = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();

      const rCentro = await doc.client.getCell(doc.activeSheetName, 10, 7);
      const vCentro = await doc.client.getCell(doc.activeSheetName, 10, 8);
      const rNord = await doc.client.getCell(doc.activeSheetName, 11, 7);
      const vNord = await doc.client.getCell(doc.activeSheetName, 11, 8);
      const rSud = await doc.client.getCell(doc.activeSheetName, 12, 7);
      const vSud = await doc.client.getCell(doc.activeSheetName, 12, 8);
      const rTot = await doc.client.getCell(doc.activeSheetName, 13, 7);
      const vTot = await doc.client.getCell(doc.activeSheetName, 13, 8);

      return {
        centroLabel: rCentro.raw,
        centroSum: vCentro.raw,
        nordLabel: rNord.raw,
        nordSum: vNord.raw,
        sudLabel: rSud.raw,
        sudSum: vSud.raw,
        totLabel: rTot.raw,
        totSum: vTot.raw,
      };
    })()`);

    console.log(`-> Tabella Pivot: ${pivotVerification.nordLabel}=${pivotVerification.nordSum}, ${pivotVerification.centroLabel}=${pivotVerification.centroSum}, ${pivotVerification.sudLabel}=${pivotVerification.sudSum}, ${pivotVerification.totLabel}=${pivotVerification.totSum}`);

    if (simFail === 'advanced-calc') {
      throw new Error(`[SIMULAZIONE FALLIMENTO NEGATIVO: advanced-calc] Rilevata alterazione voluta del calcolo`);
    }

    if (
      pivotVerification.nordSum !== '750' ||
      pivotVerification.centroSum !== '300' ||
      pivotVerification.sudSum !== '400' ||
      pivotVerification.totSum !== '1450'
    ) {
      throw new Error(`ASSERZIONE FALLITA: Tabella pivot non calcolata correttamente (Nord=${pivotVerification.nordSum}, Tot=${pivotVerification.totSum})`);
    }

    await captureScreenshot('tabelle-pivot.png');

    console.log('\n--- VERIFICA INTEGRITA CSP ---');
    console.log(`-> Violazioni CSP rilevate: ${cspViolations.length}`);
    if (cspViolations.length > 0) {
      throw new Error(`VIOLAZIONI CSP RILEVATE: ${cspViolations.join('; ')}`);
    }

    console.log('\n[SMOKE-ADVANCED COMPLETATO CON SUCCESSO] Tutti i controlli funzionali, SVG e visivi sono superati.');
  } finally {
    if (client) {
      await client.close();
    }
  }
}

run().catch((err) => {
  console.error('[ERRORE SMOKE-ADVANCED]', err.message);
  process.exit(1);
});
