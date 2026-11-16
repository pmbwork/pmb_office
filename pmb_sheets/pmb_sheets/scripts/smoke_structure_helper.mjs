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
    console.log('[SMOKE-STRUCTURE] Connessione a CDP su porta 9222...');
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

    console.log('[SMOKE-STRUCTURE] Inizializzazione applicazione...');
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

    console.log('\n--- FASE 1: Scrittura formule e inserimento riga con riscrittura ---');
    // Scrive in A1=10, A2=20, A3==A1+A2
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 1, 1, '10');
      await doc.client.setCell(doc.activeSheetName, 2, 1, '20');
      await doc.client.setCell(doc.activeSheetName, 3, 1, '=A1+A2');
      grid.cellsCache.clear();
      grid.requestUpdate();
    })()`);
    await sleep(200);

    const a3Initial = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const cell = await doc.client.getCell(doc.activeSheetName, 3, 1);
      return cell.value.kind === 'number' ? cell.value.value : cell.value;
    })()`);
    console.log(`-> Valore iniziale A3 (atteso 30): ${a3Initial}`);
    if (a3Initial !== 30) throw new Error(`ASSERZIONE FALLITA: A3 atteso 30, trovato ${a3Initial}`);

    // Inserisce una riga sopra la riga 2
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      doc.selection = {
        anchor: { row: 2, col: 1 },
        active: { row: 2, col: 1 },
        range: { startRow: 2, endRow: 2, startCol: 1, endCol: 1 },
        isFullRow: true,
        isFullCol: false,
        isAll: false,
      };
      await grid.insertRowsAbove();
    })()`);
    await sleep(250);

    // Verifica lo spostamento e l'adattamento delle formule
    const stateAfterInsert = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const c1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
      const c2 = await doc.client.getCell(doc.activeSheetName, 2, 1);
      const c3 = await doc.client.getCell(doc.activeSheetName, 3, 1);
      const c4 = await doc.client.getCell(doc.activeSheetName, 4, 1);
      return {
        a1: c1.raw,
        a2: c2.raw,
        a3: c3.raw,
        a4Raw: c4.raw,
        a4Val: c4.value.kind === 'number' ? c4.value.value : c4.value,
      };
    })()`);

    console.log(`-> Stato dopo inserimento riga: A1=${stateAfterInsert.a1}, A2(nuova)=${stateAfterInsert.a2}, A3(traslata)=${stateAfterInsert.a3}, A4(formula)=${stateAfterInsert.a4Raw}, Val=${stateAfterInsert.a4Val}`);

    if (simFail === 'structure-calc') {
      throw new Error('[SIMULATED FAILURE] Simulazione fallimento calcolo formula dopo inserimento riga');
    }

    if (stateAfterInsert.a1 !== '10') throw new Error(`ASSERZIONE FALLITA: A1 atteso '10', trovato ${stateAfterInsert.a1}`);
    if (stateAfterInsert.a2 !== '') throw new Error(`ASSERZIONE FALLITA: A2 (nuova riga inserita) attesa vuota, trovato '${stateAfterInsert.a2}'`);
    if (stateAfterInsert.a3 !== '20') throw new Error(`ASSERZIONE FALLITA: A3 atteso '20', trovato ${stateAfterInsert.a3}`);
    if (stateAfterInsert.a4Val !== 30) throw new Error(`ASSERZIONE FALLITA: A4 calcolato atteso 30, trovato ${stateAfterInsert.a4Val}`);

    await captureScreenshot('struttura-inserisci-riga.png');

    console.log('\n--- FASE 2: Annullamento (Undo) ---');
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      await grid.undo();
    })()`);
    await sleep(200);

    const stateAfterUndo = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const c1 = await doc.client.getCell(doc.activeSheetName, 1, 1);
      const c2 = await doc.client.getCell(doc.activeSheetName, 2, 1);
      const c3 = await doc.client.getCell(doc.activeSheetName, 3, 1);
      return {
        a1: c1.raw,
        a2: c2.raw,
        a3Raw: c3.raw,
        a3Val: c3.value.kind === 'number' ? c3.value.value : c3.value,
      };
    })()`);

    console.log(`-> Stato dopo Undo: A1=${stateAfterUndo.a1}, A2=${stateAfterUndo.a2}, A3=${stateAfterUndo.a3Raw}, Val=${stateAfterUndo.a3Val}`);
    if (stateAfterUndo.a1 !== '10' || stateAfterUndo.a2 !== '20' || stateAfterUndo.a3Val !== 30) {
      throw new Error(`ASSERZIONE FALLITA: Undo non ha ripristinato i dati originali (A1=${stateAfterUndo.a1}, A2=${stateAfterUndo.a2}, A3Val=${stateAfterUndo.a3Val})`);
    }

    console.log('\n--- FASE 3: Gestione Schede Multiple (Foglio1 / Foglio2) ---');
    // Clic sul pulsante '+' nella barra schede in basso
    const addBtnPos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const btn = grid.renderRoot.querySelector('.sheet-tab-add');
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(addBtnPos.x, addBtnPos.y);
    await sleep(300);

    const tabsState = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const tabs = Array.from(grid.renderRoot.querySelectorAll('.sheet-tab-item')).map(el => el.textContent.trim());
      return {
        activeSheet: doc.activeSheetName,
        tabTitles: tabs,
      };
    })()`);

    console.log(`-> Schede presenti: [${tabsState.tabTitles.join(', ')}], Scheda attiva: "${tabsState.activeSheet}"`);
    if (!tabsState.tabTitles.includes('Foglio2') || tabsState.activeSheet !== 'Foglio2') {
      throw new Error(`ASSERZIONE FALLITA: Nuova scheda Foglio2 non creata o non attiva`);
    }

    // Scrive in Foglio2 A1: 999
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      await doc.client.setCell(doc.activeSheetName, 1, 1, '999');
      grid.cellsCache.clear();
      grid.requestUpdate();
    })()`);
    await sleep(150);

    // Switch di nuovo su Foglio1 tramite clic sulla scheda
    const tab1Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const tab = grid.renderRoot.querySelectorAll('.sheet-tab-item')[0];
      const r = tab.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(tab1Pos.x, tab1Pos.y);
    await sleep(250);

    // Verifica che in Foglio1 A1 sia rimasto '10'
    const foglio1Val = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const c = await doc.client.getCell(doc.activeSheetName, 1, 1);
      return { sheet: doc.activeSheetName, raw: c.raw };
    })()`);
    console.log(`-> Scheda attiva: ${foglio1Val.sheet}, Cella A1: "${foglio1Val.raw}"`);
    if (foglio1Val.sheet !== 'Foglio1' || foglio1Val.raw !== '10') {
      throw new Error(`ASSERZIONE FALLITA: Errore nello switch su Foglio1 o dati alterati (raw=${foglio1Val.raw})`);
    }

    // Switch su Foglio2 e verifica isolamento (A1 è '999')
    const tab2Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const tab = grid.renderRoot.querySelectorAll('.sheet-tab-item')[1];
      const r = tab.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(tab2Pos.x, tab2Pos.y);
    await sleep(250);

    const foglio2Val = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const c = await doc.client.getCell(doc.activeSheetName, 1, 1);
      return { sheet: doc.activeSheetName, raw: c.raw };
    })()`);
    console.log(`-> Scheda attiva: ${foglio2Val.sheet}, Cella A1: "${foglio2Val.raw}"`);
    if (foglio2Val.sheet !== 'Foglio2' || foglio2Val.raw !== '999') {
      throw new Error(`ASSERZIONE FALLITA: Isolamento Foglio2 non rispettato (raw=${foglio2Val.raw})`);
    }

    await captureScreenshot('struttura-schede-multiple.png');

    console.log('\n--- FASE 4: Riempimento verso il basso (Ctrl+D) e formule ---');
    // Torna su Foglio1
    await clickAt(tab1Pos.x, tab1Pos.y);
    await sleep(200);

    // Seleziona intervallo A1:A5 (A1 contiene '10') ed esegue fillDown
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      doc.selection = {
        anchor: { row: 1, col: 1 },
        active: { row: 5, col: 1 },
        range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
        isFullRow: false,
        isFullCol: false,
        isAll: false,
      };
      await grid.fillDown();
    })()`);
    await sleep(200);

    const fillDownValues = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const vals = [];
      for (let r = 1; r <= 5; r++) {
        const c = await doc.client.getCell(doc.activeSheetName, r, 1);
        vals.push(c.raw);
      }
      return vals;
    })()`);

    console.log(`-> Valori colonna A dopo fillDown (A1:A5): [${fillDownValues.join(', ')}]`);
    if (fillDownValues.some(v => v !== '10')) {
      throw new Error(`ASSERZIONE FALLITA: fillDown non ha propagato il valore su tutte le celle (trovato [${fillDownValues.join(', ')}])`);
    }

    await captureScreenshot('struttura-riempimento.png');

    console.log('\n--- FASE 5: Incolla Speciale (Solo Valori) ---');
    await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      // Scrive formula in B1: =A1*7 (calcola 70)
      await doc.client.setCell(doc.activeSheetName, 1, 2, '=A1*7');
      doc.selection = {
        anchor: { row: 1, col: 2 },
        active: { row: 1, col: 2 },
        range: { startRow: 1, endRow: 1, startCol: 2, endCol: 2 },
        isFullRow: false,
        isFullCol: false,
        isAll: false,
      };
      await grid.copy();
      // Seleziona C1
      doc.selection = {
        anchor: { row: 1, col: 3 },
        active: { row: 1, col: 3 },
        range: { startRow: 1, endRow: 1, startCol: 3, endCol: 3 },
        isFullRow: false,
        isFullCol: false,
        isAll: false,
      };
      await grid.pasteSpecial('values_only');
    })()`);
    await sleep(200);

    const pasteSpecialVal = await evaluate(`(async () => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const doc = grid.getDoc();
      const c = await doc.client.getCell(doc.activeSheetName, 1, 3);
      return { raw: c.raw, val: c.value };
    })()`);

    console.log(`-> C1 dopo Incolla Speciale (solo valori): raw="${pasteSpecialVal.raw}", kind="${pasteSpecialVal.val.kind}"`);
    if (pasteSpecialVal.raw !== '70' || pasteSpecialVal.raw.startsWith('=')) {
      throw new Error(`ASSERZIONE FALLITA: Incolla speciale valori ha incollato formula o valore errato: "${pasteSpecialVal.raw}"`);
    }

    // Controllo finale CSP
    if (cspViolations.length > 0) {
      throw new Error(`VIOLAZIONE CSP RILEVATA: ${cspViolations.join('; ')}`);
    }
    console.log('[CSP OK] Nessuna violazione Content Security Policy rilevata!');

    console.log('\n>>> [SMOKE TEST STRUCTURE SUPERATO CON SUCCESSO 100%] <<<');
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('\nFALLIMENTO SMOKE TEST STRUCTURE:', err.message);
    if (client) {
      try { await client.close(); } catch (_) {}
    }
    process.exit(1);
  }
}

run();
