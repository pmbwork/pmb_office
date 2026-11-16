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
    console.log('[SMOKE-DATA] Connessione a CDP su porta 9222...');
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

    const clickAt = async (x, y) => {
      await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(30);
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await sleep(50);
    };

    const captureScreenshot = async (filename) => {
      const ss = await Page.captureScreenshot({ format: 'png' });
      const buf = Buffer.from(ss.data, 'base64');
      const dest = path.join(verificaDir, filename);
      fs.writeFileSync(dest, buf);
      console.log(`[SCREENSHOT OK] Salvato ${filename} (${buf.length} bytes)`);
      return buf;
    };

    console.log('[SMOKE-DATA] Inizializzazione applicazione...');
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

    console.log('\n--- FASE 1: Ordinamento (Sort A→Z) con riscrittura formule ---');
    // Popola A1=30, A2=10, A3=20 e B1==A1*2, B2==A2*2, B3==A3*2
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 1, 1, '30');
      await doc.client.setCell(doc.activeSheetName, 2, 1, '10');
      await doc.client.setCell(doc.activeSheetName, 3, 1, '20');
      await doc.client.setCell(doc.activeSheetName, 1, 2, '=A1*2');
      await doc.client.setCell(doc.activeSheetName, 2, 2, '=A2*2');
      await doc.client.setCell(doc.activeSheetName, 3, 2, '=A3*2');
      grid.selectSingle(1, 1);
      grid.extendSelectionTo(3, 2);
      grid.cellsCache.clear();
      grid.requestUpdate();
    })()`);
    await sleep(200);

    // Esegue ordinamento A→Z
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      await grid.sortAsc();
    })()`);
    await sleep(300);

    if (simFail === 'data-sort') {
      throw new Error('[SIMULATED FAILURE] Errore simulato per test negativo data-sort');
    }

    const sortVerification = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const a1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
      const a2 = await doc.client.getCell(doc.activeSheetName, 2, 1);
      const a3 = await doc.client.getCell(doc.activeSheetName, 3, 1);
      const b1 = await doc.client.getCell(doc.activeSheetName, 1, 2);
      const b2 = await doc.client.getCell(doc.activeSheetName, 2, 2);
      const b3 = await doc.client.getCell(doc.activeSheetName, 3, 2);
      return {
        a1: a1.raw,
        a2: a2.raw,
        a3: a3.raw,
        b1Raw: b1.raw,
        b1Val: b1.value.kind === 'number' ? b1.value.value : b1.value,
        b2Raw: b2.raw,
        b2Val: b2.value.kind === 'number' ? b2.value.value : b2.value,
        b3Raw: b3.raw,
        b3Val: b3.value.kind === 'number' ? b3.value.value : b3.value,
      };
    })()`);

    console.log(`-> Risultati ordinamento colonna A: [${sortVerification.a1}, ${sortVerification.a2}, ${sortVerification.a3}] (atteso [10, 20, 30])`);
    console.log(`-> Risultati formule colonna B: B1=${sortVerification.b1Raw}(${sortVerification.b1Val}), B2=${sortVerification.b2Raw}(${sortVerification.b2Val}), B3=${sortVerification.b3Raw}(${sortVerification.b3Val})`);

    if (sortVerification.a1 !== '10' || sortVerification.a2 !== '20' || sortVerification.a3 !== '30') {
      throw new Error(`ASSERZIONE FALLITA: Ordinamento colonna A errato!`);
    }
    if (sortVerification.b1Val !== 20 || sortVerification.b2Val !== 40 || sortVerification.b3Val !== 60) {
      throw new Error(`ASSERZIONE FALLITA: Ricalcolo formule colonna B dopo sort errato!`);
    }

    await captureScreenshot('dati-ordinamento.png');

    console.log('\n--- FASE 2: Filtri colonna e righe nascoste ---');
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.toggleFilter();
      // Imposta condizione: valore > 15 sulla colonna 1 (nasconde riga 1 dove c'è 10)
      const doc = grid.getDoc();
      doc.activeFilters.set(1, { col: 1, condition: { operator: 'greater_than', value1: 15 } });
      grid.applyActiveFilters();
    })()`);
    await sleep(300);

    const filterVerification = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const hasFilterBtn = grid.renderRoot.querySelector('.col-filter-btn') !== null;
      return {
        isFilterActive: doc.isFilterActive,
        hiddenRowsCount: doc.hiddenRows.size,
        hasFilterBtn,
      };
    })()`);

    console.log(`-> Filtro attivo: ${filterVerification.isFilterActive}, Righe nascoste: ${filterVerification.hiddenRowsCount}, Icona filtro presente: ${filterVerification.hasFilterBtn}`);
    if (!filterVerification.isFilterActive || !filterVerification.hasFilterBtn) {
      throw new Error(`ASSERZIONE FALLITA: Filtro colonna non visualizzato correttamente!`);
    }

    await captureScreenshot('dati-filtro-attivo.png');

    console.log('\n--- FASE 3: Convalida dati, Casella di controllo e Unione celle ---');
    // Rimuove filtri per visualizzare tutte le righe
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.clearFilters();
    })()`);

    // Inserisce casella di controllo in A5 e unisce C1:D2
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.selectSingle(5, 1);
      await grid.insertCheckbox();

      // Unisce intervallo C1:D2 (colonne 3 e 4, righe 1 e 2)
      grid.selectSingle(1, 3);
      grid.extendSelectionTo(2, 4);
      grid.mergeSelection('all');

      // Imposta etichetta nella cella unita C1
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 1, 3, 'Area Unita');
      grid.cellsCache.clear();
      grid.requestUpdate();
    })()`);
    await sleep(300);

    // Toggle della casella di controllo con click
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      await grid.toggleCheckboxAt(5, 1);
    })()`);
    await sleep(200);

    const dataVerification = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const chkCell = await doc.client.getCell(doc.activeSheetName, 5, 1);
      const mergeCount = doc.merges.length;
      const mergeInfo = doc.merges[0];
      const checkboxElem = grid.renderRoot.querySelector('.sheet-checkbox.checked');
      return {
        chkRaw: chkCell.raw,
        hasCheckedSvg: checkboxElem !== null,
        mergeCount,
        mergeInfo,
      };
    })()`);

    console.log(`-> Casella di controllo A5 (atteso TRUE): ${dataVerification.chkRaw}, SVG checked: ${dataVerification.hasCheckedSvg}`);
    console.log(`-> Unioni celle presenti: ${dataVerification.mergeCount}, Intervallo unito: ${JSON.stringify(dataVerification.mergeInfo)}`);

    if (dataVerification.chkRaw !== 'TRUE' || !dataVerification.hasCheckedSvg) {
      throw new Error(`ASSERZIONE FALLITA: Casella di controllo non attivata correttamente!`);
    }
    if (dataVerification.mergeCount !== 1 || dataVerification.mergeInfo.startRow !== 1 || dataVerification.mergeInfo.endCol !== 4) {
      throw new Error(`ASSERZIONE FALLITA: Unione celle C1:D2 non registrata correttamente!`);
    }

    await captureScreenshot('dati-convalida-unione.png');

    console.log('\n--- VERIFICA INTEGRITA CSP ---');
    console.log(`-> Violazioni CSP rilevate: ${cspViolations.length}`);
    if (cspViolations.length > 0) {
      throw new Error(`VIOLAZIONI CSP RILEVATE: ${cspViolations.join('; ')}`);
    }

    console.log('\n[SMOKE-DATA COMPLETATO CON SUCCESSO] Tutti i controlli funzionali e visivi sono superati.');
  } finally {
    if (client) {
      await client.close();
    }
  }
}

run().catch((err) => {
  console.error('[ERRORE SMOKE-DATA]', err.message);
  process.exit(1);
});
