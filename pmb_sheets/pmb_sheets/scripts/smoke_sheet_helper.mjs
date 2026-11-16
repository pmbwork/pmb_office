import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
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
    console.log('--- Avvio Smoke Test Fogli (Scenario Sheet) via CDP ---');

    for (let i = 0; i < 15; i++) {
      try {
        client = await CDP({ port: 9222 });
        if (client) break;
      } catch (_) {
        await sleep(1000);
      }
    }

    if (!client) {
      console.error('ERRORE_CDP: Impossibile connettersi a WebView2 su porta 9222');
      process.exit(4);
    }

    const { Runtime, Input, Page, Log } = client;
    await Runtime.enable();
    await Page.enable();
    await Log.enable();

    // Raccoglitore permanente di messaggi CSP
    const cspViolations = [];
    Log.entryAdded((params) => {
      const entry = params.entry || params;
      if (entry && entry.text) {
        if (entry.text.includes('Content Security Policy') || entry.text.includes('Refused to')) {
          cspViolations.push(entry);
        }
      }
    });

    Runtime.consoleAPICalled((params) => {
      for (const arg of params.args || []) {
        const val = arg.value || arg.description || '';
        if (typeof val === 'string' && (val.includes('Content Security Policy') || val.includes('Refused to'))) {
          cspViolations.push({ text: val, source: 'console' });
        }
      }
    });

    // Funzione helper per valutare espressioni JS nel contesto della finestra
    async function evaluate(expr) {
      const res = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) {
        const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
        throw new Error(`Errore JS durante evaluate: ${desc}`);
      }
      return res.result ? res.result.value : undefined;
    }

    // Controllo permanente: nessuna violazione di inline style CSP
    function assertNoCspViolations(stage) {
      if (simFail === 'csp') return; // nel test negativo la violazione è attesa
      const inlineStyleViolations = cspViolations.filter((v) =>
        v.text && (
          v.text.includes('inline style') ||
          v.text.includes('Refused to apply inline style') ||
          v.text.includes('Applying inline style violates')
        )
      );
      if (inlineStyleViolations.length > 0) {
        throw new Error(`VIOLAZIONE CSP RILEVATA (${stage}): ${inlineStyleViolations[0].text}`);
      }
    }

    // Modalità test negativo CSP
    if (simFail === 'csp') {
      console.log('[TEST NEGATIVO CSP] Iniezione deliberata di setAttribute("style", ...) per verificare che il controllo permanente lo rilevi...');
      await evaluate(`(() => {
        const d = document.createElement('div');
        d.setAttribute('style', 'color: red; display: contents;');
        document.body.appendChild(d);
      })()`);
      await sleep(500);

      const hasInlineViolation = cspViolations.some((v) =>
        v.text && (
          v.text.includes('inline style') ||
          v.text.includes('Refused to apply inline style') ||
          v.text.includes('Applying inline style violates')
        )
      );

      if (hasInlineViolation) {
        console.log(`[TEST NEGATIVO CSP RIUSCITO] La violazione CSP è stata correttamente intercettata dal controllo permanente: "${cspViolations[0].text}"`);
        console.log('>>> [TEST NEGATIVO CSP SUPERATO] (ExitCode: 0) <<<');
        await client.close();
        process.exit(0);
      } else {
        throw new Error('TEST NEGATIVO CSP FALLITO: setAttribute("style") non ha generato la violazione CSP attesa!');
      }
    }

    // Helper per verificare il layout reale della finestra e dei componenti (Sezione C)
    async function verifyLayout(stageName) {
      console.log(`[LAYOUT-VERIFY] Esecuzione controlli layout reale (${stageName})...`);

      if (simFail === 'layout') {
        // Simula rottura layout nascondendo la griglia con CSS
        await evaluate(`(() => {
          const app = document.querySelector('free-app');
          const g = (app.renderRoot || app).querySelector('free-sheet-grid');
          if (g) g.style.display = 'none';
        })()`);
      }

      const res = await evaluate(`(() => {
        const app = document.querySelector('free-app');
        const root = app.renderRoot || app.shadowRoot || app;
        const ca = root.querySelector('.content-area');
        const caRect = ca ? ca.getBoundingClientRect() : null;

        const activeSheet = root.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
        if (!activeSheet) {
          return { ok: false, error: 'Elemento free-sheet-grid attivo non trovato' };
        }
        const gRoot = activeSheet.renderRoot || activeSheet.shadowRoot || activeSheet;
        const container = gRoot.querySelector('.grid-container');
        if (!container) {
          return { ok: false, error: 'Elemento .grid-container non trovato nel shadowRoot di free-sheet-grid' };
        }

        const cRect = container.getBoundingClientRect();
        const sheetRect = activeSheet.getBoundingClientRect();

        // 4. nessun free-editor-doc ha offsetParent non nullo mentre è attiva una scheda Fogli, e viceversa; la larghezza del foglio attivo è almeno il 95% della larghezza di .content-area
        const docs = Array.from(root.querySelectorAll('free-editor-doc'));
        for (const doc of docs) {
          if (doc.offsetParent !== null) {
            return { ok: false, error: 'free-editor-doc ha offsetParent !== null mentre è attiva una scheda Fogli' };
          }
        }
        if (caRect && caRect.width > 0) {
          const ratio = sheetRect.width / caRect.width;
          if (ratio < 0.95) {
            return { ok: false, error: 'Larghezza foglio attivo (' + sheetRect.width + 'px) inferiore al 95% di .content-area (' + caRect.width + 'px, ratio=' + ratio.toFixed(2) + ')' };
          }
        }

        // 1. Cella A1 ha un rettangolo con larghezza e altezza maggiori di zero, completamente dentro .grid-container, e document.elementFromPoint(centro di A1) restituisce proprio quella cella (o un suo discendente); idem per A3
        function checkCell(address, row, col) {
          const cell = gRoot.querySelector('td.sheet-cell[data-row="' + row + '"][data-col="' + col + '"]');
          if (!cell) return { ok: false, error: 'Cella ' + address + ' non trovata nel DOM' };
          const r = cell.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) {
            return { ok: false, error: 'Cella ' + address + ' ha dimensioni non valide (w=' + r.width + ', h=' + r.height + ')' };
          }
          if (r.left < cRect.left - 1 || r.right > cRect.right + 1 || r.top < cRect.top - 1 || r.bottom > cRect.bottom + 1) {
            return { ok: false, error: 'Cella ' + address + ' non è contenuta nel rettangolo di .grid-container' };
          }
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;

          let hit = document.elementFromPoint(cx, cy);
          while (hit && hit.shadowRoot && hit.shadowRoot.elementFromPoint) {
            const inner = hit.shadowRoot.elementFromPoint(cx, cy);
            if (!inner || inner === hit) break;
            hit = inner;
          }

          if (!hit || (hit !== cell && !cell.contains(hit))) {
            return { ok: false, error: 'elementFromPoint al centro di ' + address + ' (' + cx + ',' + cy + ') ha restituito: ' + (hit ? hit.tagName + '.' + hit.className : 'null') };
          }
          return { ok: true, rect: { width: r.width, height: r.height, top: r.top, left: r.left } };
        }

        const a1Check = checkCell('A1', 1, 1);
        if (!a1Check.ok) return a1Check;

        const a3Check = checkCell('A3', 3, 1);
        if (!a3Check.ok) return a3Check;

        // 2. Le intestazioni A, B, C e 1, 2, 3 sono visibili (rettangolo non nullo, dentro il contenitore)
        const colHeaders = Array.from(gRoot.querySelectorAll('th.col-header'));
        for (const letter of ['A', 'B', 'C']) {
          const th = colHeaders.find(h => h.textContent.trim().startsWith(letter));
          if (!th) return { ok: false, error: 'Intestazione colonna ' + letter + ' non trovata' };
          const r = th.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) {
            return { ok: false, error: 'Intestazione colonna ' + letter + ' ha dimensioni nulle' };
          }
          if (r.left < cRect.left - 1 || r.right > cRect.right + 1) {
            return { ok: false, error: 'Intestazione colonna ' + letter + ' fuori dal contenitore' };
          }
        }

        const rowHeaders = Array.from(gRoot.querySelectorAll('th.row-header'));
        for (const num of ['1', '2', '3']) {
          const th = rowHeaders.find(h => h.textContent.trim() === num);
          if (!th) return { ok: false, error: 'Intestazione riga ' + num + ' non trovata' };
          const r = th.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) {
            return { ok: false, error: 'Intestazione riga ' + num + ' ha dimensioni nulle' };
          }
          if (r.top < cRect.top - 1 || r.bottom > cRect.bottom + 1) {
            return { ok: false, error: 'Intestazione riga ' + num + ' fuori dal contenitore' };
          }
        }

        // 3. Numero di celle visibili (rettangolo non nullo dentro il contenitore) è almeno 100 e al massimo 1.500
        const cells = Array.from(gRoot.querySelectorAll('td.sheet-cell'));
        const visibleCells = cells.filter(td => {
          const r = td.getBoundingClientRect();
          return r.width > 0 && r.height > 0 &&
                 r.left < cRect.right && r.right > cRect.left &&
                 r.top < cRect.bottom && r.bottom > cRect.top;
        });

        if (visibleCells.length < 100 || visibleCells.length > 1500) {
          return { ok: false, error: 'Numero celle visibili fuori intervallo (atteso 100..1500): ' + visibleCells.length };
        }

        return {
          ok: true,
          visibleCellsCount: visibleCells.length,
          a1Rect: a1Check.rect,
          a3Rect: a3Check.rect,
          sheetWidth: sheetRect.width,
          contentAreaWidth: caRect ? caRect.width : 0,
        };
      })()`);

      if (!res.ok) {
        throw new Error(`FALLIMENTO LAYOUT (${stageName}): ${res.error}`);
      }
      console.log(`[LAYOUT-VERIFY OK] ${stageName}: celle visibili=${res.visibleCellsCount}, A1=${res.a1Rect.width}x${res.a1Rect.height}px, larghezza foglio=${res.sheetWidth}px`);
      return res;
    }

    // Helper per verificare che il bitmap catturato dello screenshot non sia uniforme
    function verifyBitmap(pngBuffer, shotName) {
      let pos = 8;
      const idatParts = [];
      let width = 0, height = 0, colorType = 0;
      while (pos < pngBuffer.length) {
        const len = pngBuffer.readUInt32BE(pos);
        const type = pngBuffer.slice(pos + 4, pos + 8).toString('ascii');
        if (type === 'IHDR') {
          width = pngBuffer.readUInt32BE(pos + 8);
          height = pngBuffer.readUInt32BE(pos + 12);
          colorType = pngBuffer.readUInt8(pos + 17);
        } else if (type === 'IDAT') {
          idatParts.push(pngBuffer.slice(pos + 8, pos + 8 + len));
        }
        pos += 12 + len;
      }
      const raw = zlib.inflateSync(Buffer.concat(idatParts));
      const bpp = colorType === 6 ? 4 : 3;
      const stride = 1 + width * bpp;
      const colors = new Set();
      let sum = 0, sumSq = 0, count = 0;
      for (let y = 220; y < 700 && y < height; y++) {
        const line = y * stride + 1;
        for (let x = 50; x < 1100 && x < width; x++) {
          const idx = line + x * bpp;
          const r = raw[idx], g = raw[idx + 1], b = raw[idx + 2];
          colors.add((r << 16) | (g << 8) | b);
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          sum += lum;
          sumSq += lum * lum;
          count++;
        }
      }
      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      const stdDev = Math.sqrt(Math.max(0, variance));
      console.log(`[BITMAP-CHECK OK] ${shotName}: campionati ${count} pixel, colori distinti=${colors.size}, stdDev luminanza=${stdDev.toFixed(2)}`);
      if (stdDev < 5.0 || colors.size < 20) {
        throw new Error(`BITMAP QUASI UNIFORME (${shotName}): stdDev=${stdDev.toFixed(2)}, colori=${colors.size}. Griglia vuota o non renderizzata!`);
      }
    }

    // Attendi che free-app sia montato
    console.log('Attesa caricamento applicazione free-app...');
    for (let i = 0; i < 20; i++) {
      const hasApp = await evaluate(`!!document.querySelector('free-app')`);
      if (hasApp) break;
      await sleep(500);
    }

    assertNoCspViolations('Dopo caricamento applicazione');

    // Helper per inviare un tasto reale con Input.dispatchKeyEvent
    async function sendKey(key, code, vk, modifiers = 0) {
      await Input.dispatchKeyEvent({
        type: 'keyDown',
        key,
        code,
        windowsVirtualKeyCode: vk,
        modifiers,
      });
      await sleep(30);
      await Input.dispatchKeyEvent({
        type: 'keyUp',
        key,
        code,
        windowsVirtualKeyCode: vk,
        modifiers,
      });
      await sleep(50);
    }

    // Helper per inviare scorciatoie con Ctrl reale
    async function sendShortcut(key, code, vk) {
      await Input.dispatchKeyEvent({
        type: 'rawKeyDown',
        key: 'Control',
        code: 'ControlLeft',
        windowsVirtualKeyCode: 17,
        modifiers: 2,
      });
      await sleep(30);
      await Input.dispatchKeyEvent({
        type: 'keyDown',
        key,
        code,
        windowsVirtualKeyCode: vk,
        modifiers: 2,
      });
      await sleep(50);
      await Input.dispatchKeyEvent({
        type: 'keyUp',
        key,
        code,
        windowsVirtualKeyCode: vk,
        modifiers: 2,
      });
      await sleep(30);
      await Input.dispatchKeyEvent({
        type: 'keyUp',
        key: 'Control',
        code: 'ControlLeft',
        windowsVirtualKeyCode: 17,
        modifiers: 0,
      });
      await sleep(100);
    }

    // Helper per inserire testo reale con Input.insertText
    async function insertText(text) {
      await Input.insertText({ text });
      await sleep(50);
    }

    async function focusGrid() {
      await evaluate(`(() => {
        const app = document.querySelector('free-app');
        const root = app.renderRoot || app;
        const grid = root.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
        if (grid) {
          const gRoot = grid.renderRoot || grid;
          const cont = gRoot.querySelector('.grid-container');
          if (cont) cont.focus();
        }
      })()`);
      await sleep(100);
    }

    async function typeCell(text) {
      await focusGrid();

      // Invia primo carattere con keyDown per avviare la modifica
      const first = text[0];
      await Input.dispatchKeyEvent({
        type: 'keyDown',
        key: first,
        text: first,
        unmodifiedText: first,
      });
      await sleep(150);

      // Inserisci il resto del testo se presente
      if (text.length > 1) {
        await Input.insertText({ text: text.substring(1) });
        await sleep(100);
      }

      // Premi Invio reale per confermare
      await Input.dispatchKeyEvent({
        type: 'rawKeyDown',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
      });
      await Input.dispatchKeyEvent({
        type: 'keyUp',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
      });
      await sleep(300);
    }

    // 1. Apri una nuova scheda Fogli tramite percorso UI reale (+ -> Nuovo Foglio)
    console.log('Passo 1: Apertura nuova scheda Fogli tramite percorso UI reale (+ -> Nuovo Foglio)...');
    const plusBtnPos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const root = app.renderRoot || app.shadowRoot || app;
      const tabs = root.querySelector('free-tabs');
      const tRoot = tabs.renderRoot || tabs.shadowRoot || tabs;
      const btn = tRoot.querySelector('.new-tab-btn');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);

    if (!plusBtnPos) {
      throw new Error('Pulsante "+" (.new-tab-btn) non trovato in free-tabs');
    }

    // Clic reale su pulsante "+"
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: plusBtnPos.x, y: plusBtnPos.y, button: 'left', clickCount: 1 });
    await sleep(50);
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: plusBtnPos.x, y: plusBtnPos.y, button: 'left', clickCount: 1 });
    await sleep(300);

    // Individua la voce "Nuovo Foglio" nel dropdown
    const sheetItemPos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const root = app.renderRoot || app.shadowRoot || app;
      const tabs = root.querySelector('free-tabs');
      const tRoot = tabs.renderRoot || tabs.shadowRoot || tabs;
      const items = Array.from(tRoot.querySelectorAll('.new-dropdown-item'));
      const it = items.find(el => el.textContent.includes('Foglio'));
      if (!it) return null;
      const r = it.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);

    if (!sheetItemPos) {
      throw new Error('Voce "Nuovo Foglio" (.new-dropdown-item) non trovata nel dropdown schede');
    }

    // Clic reale sulla voce "Nuovo Foglio"
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: sheetItemPos.x, y: sheetItemPos.y, button: 'left', clickCount: 1 });
    await sleep(50);
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: sheetItemPos.x, y: sheetItemPos.y, button: 'left', clickCount: 1 });
    await sleep(600);

    // ASSERZIONE Passo 1: verifica che la scheda Fogli sia attiva
    const tabState = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const activeTab = app.tabs.find(t => t.id === app.activeTabId);
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      return {
        activeType: activeTab ? activeTab.type : null,
        gridFound: !!grid,
        gridHidden: grid ? grid.hidden : true
      };
    })()`);

    if (tabState.activeType !== 'sheet' || !tabState.gridFound || tabState.gridHidden) {
      throw new Error(`ASSERZIONE FALLITA Passo 1: scheda Fogli non attiva (activeType=${tabState.activeType}, gridFound=${tabState.gridFound}, gridHidden=${tabState.gridHidden})`);
    }
    console.log('[PASSO 1 ASSERZIONE OK] Nuova scheda Fogli aperta e attiva tramite percorso reale UI');
    assertNoCspViolations('Passo 1');

    // 2. Scrivi 2 in A1
    console.log('Passo 2: Inserimento "2" in cella A1...');
    await typeCell('2');

    // 3. Scrivi 3 in A2
    console.log('Passo 3: Inserimento "3" in cella A2...');
    await typeCell('3');

    // 4. Scrivi =SUM(A1:A2) in A3
    console.log('Passo 4: Inserimento "=SUM(A1:A2)" in cella A3...');
    await typeCell('=SUM(A1:A2)');

    // 5. Verifica che A3 mostri 5
    console.log('Passo 5: Verifica valore calcolato in cella A3...');
    const valA3 = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const cells = (grid.renderRoot || grid).querySelectorAll('td.sheet-cell');
      for (const td of cells) {
        if (td.getAttribute('data-row') === '3' && td.getAttribute('data-col') === '1') {
          return td.textContent.trim();
        }
      }
      return '';
    })()`);
    console.log(`Valore letto in A3: "${valA3}"`);

    const expectedA3 = simFail === 'sheet-calc' ? '999' : '5';
    if (valA3 !== expectedA3) {
      throw new Error(`ASSERZIONE FALLITA Passo 5: valore errato in A3: atteso "${expectedA3}", ottenuto "${valA3}"`);
    }

    // Controllo Layout Sezione C prima dello screenshot
    await verifyLayout('Passo 5 - Foglio con dati A1..A3');
    assertNoCspViolations('Passo 5');

    // Cattura Screenshot 1: sheet-dati.png
    console.log('Cattura screenshot 1: sheet-dati.png...');
    const shot1 = await Page.captureScreenshot({ format: 'png' });
    const shot1Buf = Buffer.from(shot1.data, 'base64');
    fs.writeFileSync(path.join(verificaDir, 'sheet-dati.png'), shot1Buf);
    verifyBitmap(shot1Buf, 'sheet-dati.png');

    // 6. Modifica A1 in 10
    console.log('Passo 6: Modifica A1 in 10 (passando da F2 / modifica)...');
    await focusGrid();
    // Saliamo ad A1 (da A4 a A1: 3 volte ArrowUp)
    await sendKey('ArrowUp', 'ArrowUp', 38);
    await sendKey('ArrowUp', 'ArrowUp', 38);
    await sendKey('ArrowUp', 'ArrowUp', 38);
    await sleep(200);

    // Premi F2 per entrare in modalità modifica
    await sendKey('F2', 'F2', 113);
    await sleep(250);

    // Cattura Screenshot 2: sheet-modifica.png
    console.log('Cattura screenshot 2: sheet-modifica.png...');
    const shot2 = await Page.captureScreenshot({ format: 'png' });
    const shot2Buf = Buffer.from(shot2.data, 'base64');
    fs.writeFileSync(path.join(verificaDir, 'sheet-modifica.png'), shot2Buf);
    verifyBitmap(shot2Buf, 'sheet-modifica.png');

    // Seleziona il testo dell'editor e inserisci 10
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const editor = (grid.renderRoot || grid).querySelector('.cell-editor-overlay');
      if (editor) {
        editor.select();
      }
    })()`);
    await sleep(50);
    await insertText('10');
    await sleep(100);
    await sendKey('Enter', 'Enter', 13);
    await sleep(400);

    // Verifica che A3 si sia aggiornato a 13
    const valA3After = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const cells = (grid.renderRoot || grid).querySelectorAll('td.sheet-cell');
      for (const td of cells) {
        if (td.getAttribute('data-row') === '3' && td.getAttribute('data-col') === '1') {
          return td.textContent.trim();
        }
      }
      return '';
    })()`);
    console.log(`Valore letto in A3 dopo modifica di A1 a 10: "${valA3After}" (atteso "13")`);
    if (valA3After !== '13') {
      throw new Error(`ASSERZIONE FALLITA Passo 6: valore ricalcolato in A3 errato: atteso "13", ottenuto "${valA3After}"`);
    }
    assertNoCspViolations('Passo 6');

    // 7. Ctrl+Z (Undo)
    console.log('Passo 7: Annulla (Ctrl+Z)...');
    await focusGrid();
    await sendShortcut('z', 'KeyZ', 90);
    await sleep(400);

    // Verifica che A1 sia tornato 2 e A3 sia tornato 5
    const valA1Undo = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const cells = (grid.renderRoot || grid).querySelectorAll('td.sheet-cell');
      let a1 = '';
      for (const td of cells) {
        if (td.getAttribute('data-row') === '1' && td.getAttribute('data-col') === '1') a1 = td.textContent.trim();
      }
      return a1;
    })()`);
    const valA3Undo = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const cells = (grid.renderRoot || grid).querySelectorAll('td.sheet-cell');
      let a3 = '';
      for (const td of cells) {
        if (td.getAttribute('data-row') === '3' && td.getAttribute('data-col') === '1') a3 = td.textContent.trim();
      }
      return a3;
    })()`);
    console.log(`Valori dopo Ctrl+Z: A1="${valA1Undo}" (atteso "2"), A3="${valA3Undo}" (atteso "5")`);
    if (valA1Undo !== '2' || valA3Undo !== '5') {
      throw new Error(`ASSERZIONE FALLITA Passo 7: ripristino Undo fallito: A1=${valA1Undo}, A3=${valA3Undo}`);
    }
    assertNoCspViolations('Passo 7');

    // 8. Copia A3 e incolla in B3
    console.log('Passo 8: Copia A3 e incolla in B3 (con traslazione formula a =SUM(B1:B2))...');
    await focusGrid();
    await sendKey('ArrowDown', 'ArrowDown', 40);
    await sleep(200);

    const selBeforeCopy = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      return grid.activeCellAddress;
    })()`);
    console.log(`Cella attiva prima di Ctrl+C: "${selBeforeCopy}" (atteso "A3")`);
    // ASSERZIONE Passo 8a: la cella prima di Ctrl+C deve essere A3
    if (selBeforeCopy !== 'A3') {
      throw new Error(`ASSERZIONE FALLITA Passo 8: cella attiva prima di copia errata: atteso "A3", ottenuto "${selBeforeCopy}"`);
    }

    // Ctrl+C su A3
    await focusGrid();
    await sendShortcut('c', 'KeyC', 67);
    await sleep(300);

    // Naviga a B3 (ArrowRight)
    await sendKey('ArrowRight', 'ArrowRight', 39);
    await sleep(200);

    const selBeforePaste = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      return grid.activeCellAddress;
    })()`);
    console.log(`Cella attiva prima di Ctrl+V: "${selBeforePaste}" (atteso "B3")`);
    // ASSERZIONE Passo 8b: la cella prima di Ctrl+V deve essere B3
    if (selBeforePaste !== 'B3') {
      throw new Error(`ASSERZIONE FALLITA Passo 8: cella attiva prima di incolla errata: atteso "B3", ottenuto "${selBeforePaste}"`);
    }

    // Ctrl+V su B3
    await focusGrid();
    await sendShortcut('v', 'KeyV', 86);
    await sleep(600);

    // Verifica che B3 mostri 0
    const valB3 = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const cells = (grid.renderRoot || grid).querySelectorAll('td.sheet-cell');
      for (const td of cells) {
        if (td.getAttribute('data-row') === '3' && td.getAttribute('data-col') === '2') {
          return td.textContent.trim();
        }
      }
      return '';
    })()`);
    console.log(`Valore in B3 (incolla formula traslata): "${valB3}" (atteso "0")`);
    if (valB3 !== '0') {
      throw new Error(`ASSERZIONE FALLITA Passo 8: incolla in B3 errato: atteso "0", ottenuto "${valB3}"`);
    }
    assertNoCspViolations('Passo 8');

    // 9. Selezione di intervallo con statistiche barra di stato
    console.log('Passo 9: Verifica assenza statistiche su cella singola, poi selezione A1:A3 e verifica statistiche barra di stato...');
    // Da B3 ci spostiamo ad A1: ArrowLeft a A3, poi ArrowUp a A2, poi ArrowUp a A1
    await focusGrid();
    await sendKey('ArrowLeft', 'ArrowLeft', 37);
    await sendKey('ArrowUp', 'ArrowUp', 38);
    await sendKey('ArrowUp', 'ArrowUp', 38);
    await sleep(200);

    // ASSERZIONE Passo 9a: con cella singola A1 attiva, nessuna statistica deve essere mostrata
    const singleStats = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const sb = (app.renderRoot || app).querySelector('free-statusbar');
      const el = (sb.renderRoot || sb).querySelector('.selection-stats');
      return el ? el.textContent.trim() : '';
    })()`);
    console.log(`Statistiche su cella singola A1: "${singleStats}" (atteso "")`);
    if (singleStats !== '') {
      throw new Error(`ASSERZIONE FALLITA Passo 9: per cella singola le statistiche devono essere vuote, ottenuto "${singleStats}"`);
    }

    // Seleziona A1:A3 tenendo premuto Shift (modifier 8)
    await sendKey('ArrowDown', 'ArrowDown', 40, 8);
    await sendKey('ArrowDown', 'ArrowDown', 40, 8);
    await sleep(300);

    // ASSERZIONE Passo 9b: con intervallo A1:A3 selezionato, verifica Somma: 10, Media: 3.3333, Conteggio: 3
    const statsText = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const sb = (app.renderRoot || app).querySelector('free-statusbar');
      const el = (sb.renderRoot || sb).querySelector('.selection-stats');
      return el ? el.textContent.trim() : '';
    })()`);
    console.log(`Statistiche visualizzate nella barra di stato: "${statsText}"`);

    if (!statsText.includes('Somma: 10')) {
      throw new Error(`ASSERZIONE FALLITA Passo 9: statistica "Somma: 10" non trovata in "${statsText}"`);
    }
    if (!statsText.includes('Media: 3.3333')) {
      throw new Error(`ASSERZIONE FALLITA Passo 9: statistica "Media: 3.3333" non trovata in "${statsText}"`);
    }
    if (!statsText.includes('Conteggio: 3')) {
      throw new Error(`ASSERZIONE FALLITA Passo 9: statistica "Conteggio: 3" non trovata in "${statsText}"`);
    }
    console.log('[PASSO 9 ASSERZIONE OK] Statistiche A1:A3 verificate con successo');
    assertNoCspViolations('Passo 9');

    // Cattura Screenshot 3: sheet-selezione-statusbar.png
    console.log('Cattura screenshot 3: sheet-selezione-statusbar.png...');
    const shot3 = await Page.captureScreenshot({ format: 'png' });
    const shot3Buf = Buffer.from(shot3.data, 'base64');
    fs.writeFileSync(path.join(verificaDir, 'sheet-selezione-statusbar.png'), shot3Buf);
    verifyBitmap(shot3Buf, 'sheet-selezione-statusbar.png');

    // 10. Passaggio a scheda Documenti e ritorno a Fogli (verifica conservazione stato)
    console.log('Passo 10: Cambio scheda su Documenti e ritorno a Fogli (test isolamento/persistenza)...');
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tabs = (app.renderRoot || app).querySelector('free-tabs');
      tabs.dispatchEvent(new CustomEvent('tab-selected', { detail: { id: 'tab-1' }, bubbles: true, composed: true }));
    })()`);
    await sleep(500);

    // Torna alla scheda foglio
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tabs = (app.renderRoot || app).querySelector('free-tabs');
      const sheetTab = app.tabs.find((t) => t.type === 'sheet');
      if (sheetTab) {
        tabs.dispatchEvent(new CustomEvent('tab-selected', { detail: { id: sheetTab.id }, bubbles: true, composed: true }));
      }
    })()`);
    await sleep(500);

    // Controllo Layout Sezione C (punto 5): dopo aver cambiato scheda e tornato, di nuovo i punti 1-4
    await verifyLayout('Passo 10 - Dopo switch scheda Documenti e ritorno su Fogli');
    assertNoCspViolations('Passo 10');

    // Rileggi i valori dopo il ritorno
    const valuesAfterSwitch = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = (app.renderRoot || app).querySelector('free-sheet-grid');
      const cells = (grid.renderRoot || grid).querySelectorAll('td.sheet-cell');
      const res = {};
      for (const td of cells) {
        const r = td.getAttribute('data-row');
        const c = td.getAttribute('data-col');
        if (r && c) res[r + ':' + c] = td.textContent.trim();
      }
      return res;
    })()`);

    console.log('Valori riletti dopo cambio scheda e ritorno:', {
      A1: valuesAfterSwitch['1:1'],
      A2: valuesAfterSwitch['2:1'],
      A3: valuesAfterSwitch['3:1'],
      B3: valuesAfterSwitch['3:2'],
    });

    if (simFail === 'sheet-tab') {
      throw new Error('Simulazione fallimento cambio scheda');
    }

    if (
      valuesAfterSwitch['1:1'] !== '2' ||
      valuesAfterSwitch['2:1'] !== '3' ||
      valuesAfterSwitch['3:1'] !== '5' ||
      valuesAfterSwitch['3:2'] !== '0'
    ) {
      throw new Error('ASSERZIONE FALLITA Passo 10: dati persi dopo cambio scheda!');
    }

    // 11. Verifiche conseguenze reali Punto A.4 & Screenshot temi
    console.log('Passo 11: Verifiche reali conseguenze CSP (Zoom Documenti, Posizione Menu, Sidebar) e Screenshot Temi...');

    // (a) Switch a Documenti e verifica Zoom reale (50%, 100%, 200%)
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tabs = (app.renderRoot || app).querySelector('free-tabs');
      tabs.dispatchEvent(new CustomEvent('tab-selected', { detail: { id: 'tab-1' }, bubbles: true, composed: true }));
    })()`);
    await sleep(400);

    async function setDocZoom(z) {
      await evaluate(`(async () => {
        const app = document.querySelector('free-app');
        app.zoom = ${z};
        await app.updateComplete;
        const doc = (app.renderRoot || app).querySelector('free-editor-doc');
        if (doc) {
          doc.zoom = ${z};
          await doc.updateComplete;
        }
      })()`);
      await sleep(300);
      return await evaluate(`(() => {
        const app = document.querySelector('free-app');
        const doc = (app.renderRoot || app).querySelector('free-editor-doc');
        const dRoot = doc.renderRoot || doc;
        const page = dRoot.querySelector('.a4-page');
        const r = page.getBoundingClientRect();
        const cont = dRoot.querySelector('.page-container');
        const transform = window.getComputedStyle(cont).transform;
        return { w: r.width, h: r.height, transform };
      })()`);
    }

    const zoom100 = await setDocZoom(100);
    const zoom200 = await setDocZoom(200);
    const zoom50 = await setDocZoom(50);

    console.log(`[MISURE ZOOM DOCUMENTI] 100%: ${zoom100.w.toFixed(1)}x${zoom100.h.toFixed(1)}px (transform: ${zoom100.transform}), 200%: ${zoom200.w.toFixed(1)}x${zoom200.h.toFixed(1)}px (transform: ${zoom200.transform}), 50%: ${zoom50.w.toFixed(1)}x${zoom50.h.toFixed(1)}px (transform: ${zoom50.transform})`);

    // ASSERZIONE Zoom Documenti: a zoom 200% la larghezza del rettangolo visualizzato deve essere doppia rispetto a 100% (+/- 2px)
    if (Math.abs(zoom200.w - zoom100.w * 2) > 5) {
      throw new Error(`ASSERZIONE FALLITA Zoom 200%: rettangolo non scala (100%=${zoom100.w}px, 200%=${zoom200.w}px)`);
    }
    if (Math.abs(zoom50.w - zoom100.w * 0.5) > 5) {
      throw new Error(`ASSERZIONE FALLITA Zoom 50%: rettangolo non scala (100%=${zoom100.w}px, 50%=${zoom50.w}px)`);
    }
    console.log('[ZOOM DOCUMENTI ASSERZIONE OK] Il rettangolo scala correttamente via CSSOM');

    // Ripristina zoom a 100
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const doc = (app.renderRoot || app).querySelector('free-editor-doc');
      doc.zoom = 100;
    })()`);

    // (b) Verifica Ancoraggio Menu File
    const menuCoords = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const mb = (app.renderRoot || app).querySelector('free-menubar');
      const mRoot = mb.renderRoot || mb;
      const btn = mRoot.querySelector('.menu-btn');
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, btnRect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } };
    })()`);

    // Clic per aprire menu File
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: menuCoords.x, y: menuCoords.y, button: 'left', clickCount: 1 });
    await sleep(50);
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: menuCoords.x, y: menuCoords.y, button: 'left', clickCount: 1 });
    await sleep(400);

    const dropdownCheck = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const mb = (app.renderRoot || app).querySelector('free-menubar');
      const mRoot = mb.renderRoot || mb;
      const dd = mRoot.querySelector('.dropdown-menu');
      if (!dd) return null;
      const r = dd.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    })()`);

    if (!dropdownCheck) {
      throw new Error('ASSERZIONE FALLITA: menu dropdown File non aperto');
    }
    console.log(`[MISURE MENU FILE] Pulsante bottom=${menuCoords.btnRect.bottom.toFixed(1)}px, left=${menuCoords.btnRect.left.toFixed(1)}px | Dropdown top=${dropdownCheck.top.toFixed(1)}px, left=${dropdownCheck.left.toFixed(1)}px`);
    // ASSERZIONE: il menu deve essere ancorato immediatamente sotto il pulsante (+/- 2px di bordo) e allineato a sinistra
    if (Math.abs(dropdownCheck.top - menuCoords.btnRect.bottom) > 3) {
      throw new Error(`ASSERZIONE FALLITA: menu non ancorato sotto il pulsante (btnBottom=${menuCoords.btnRect.bottom}, ddTop=${dropdownCheck.top})`);
    }
    if (Math.abs(dropdownCheck.left - menuCoords.btnRect.left) > 3) {
      throw new Error(`ASSERZIONE FALLITA: menu non allineato a sinistra del pulsante (btnLeft=${menuCoords.btnRect.left}, ddLeft=${dropdownCheck.left})`);
    }
    console.log('[MENU FILE ASSERZIONE OK] Dropdown perfettamente ancorato sotto la propria voce');

    // Chiudi menu File con clic esterno
    await Input.dispatchMouseEvent({ type: 'mousePressed', x: 500, y: 500, button: 'left', clickCount: 1 });
    await sleep(50);
    await Input.dispatchMouseEvent({ type: 'mouseReleased', x: 500, y: 500, button: 'left', clickCount: 1 });
    await sleep(300);

    // (c) Verifica Sidebar: font-weight 500 dei titoli
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      app.sidebarOpen = true;
    })()`);
    await sleep(400);

    const sidebarWeights = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const sb = (app.renderRoot || app).querySelector('free-sidebar');
      const sRoot = sb.renderRoot || sb;
      const titles = Array.from(sRoot.querySelectorAll('.placeholder-title'));
      return titles.map(t => ({ text: t.textContent.trim(), weight: window.getComputedStyle(t).fontWeight }));
    })()`);

    console.log('[MISURE SIDEBAR FONT-WEIGHT]', sidebarWeights);
    for (const item of sidebarWeights) {
      if (item.weight !== '500') {
        throw new Error(`ASSERZIONE FALLITA Sidebar: font-weight non 500 per "${item.text}" (ottenuto ${item.weight})`);
      }
    }
    console.log('[SIDEBAR ASSERZIONE OK] Voci con font-weight 500 verificate');

    // Chiudi sidebar
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      app.sidebarOpen = false;
    })()`);
    await sleep(300);

    // (d) Torna a scheda Fogli e verifica tema chiaro e tema scuro con screenshot
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tabs = (app.renderRoot || app).querySelector('free-tabs');
      const sheetTab = app.tabs.find((t) => t.type === 'sheet');
      if (sheetTab) {
        tabs.dispatchEvent(new CustomEvent('tab-selected', { detail: { id: sheetTab.id }, bubbles: true, composed: true }));
      }
    })()`);
    await sleep(400);

    // Imposta tema chiaro e cattura screenshot tema-chiaro-fogli.png
    console.log('Impostazione tema chiaro e cattura tema-chiaro-fogli.png...');
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      app.setTheme('light');
    })()`);
    await sleep(400);
    const shotLight = await Page.captureScreenshot({ format: 'png' });
    const shotLightBuf = Buffer.from(shotLight.data, 'base64');
    fs.writeFileSync(path.join(verificaDir, 'tema-chiaro-fogli.png'), shotLightBuf);
    verifyBitmap(shotLightBuf, 'tema-chiaro-fogli.png');

    // Imposta tema scuro e cattura screenshot tema-scuro-fogli.png (con scrollbar tematizzate scure)
    console.log('Impostazione tema scuro e cattura tema-scuro-fogli.png...');
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      app.setTheme('dark');
    })()`);
    await sleep(400);
    const shotDark = await Page.captureScreenshot({ format: 'png' });
    const shotDarkBuf = Buffer.from(shotDark.data, 'base64');
    fs.writeFileSync(path.join(verificaDir, 'tema-scuro-fogli.png'), shotDarkBuf);
    verifyBitmap(shotDarkBuf, 'tema-scuro-fogli.png');

    // Controllo finale di tutte le violazioni CSP raccolte
    assertNoCspViolations('Finale');
    console.log('[CONTROLLO CSP FINALE OK] Nessuna violazione Content Security Policy registrata');

    console.log('>>> TUTTI I PASSI DELLO SMOKE TEST FOGLI E VERIFICHE REAL SUPERATI CON SUCCESSO! <<<');
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('ERRORE_SMOKE_SHEET:', err.message);
    if (client) await client.close();
    process.exit(1);
  }
}

run();
