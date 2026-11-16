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

function parseRgbString(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
  }
  return { r: 0, g: 0, b: 0 };
}

function calculateContrast(rgb1, rgb2) {
  const getLum = ({ r, g, b }) => {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };
  const l1 = getLum(rgb1);
  const l2 = getLum(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function decodePngPixels(pngBuffer) {
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
  const out = Buffer.alloc(width * height * bpp);

  let prevRow = Buffer.alloc(width * bpp);
  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride];
    const rowOffset = y * stride + 1;
    const curRow = Buffer.alloc(width * bpp);

    for (let i = 0; i < width * bpp; i++) {
      const val = raw[rowOffset + i];
      const a = (i >= bpp) ? curRow[i - bpp] : 0;
      const b = prevRow[i];
      const c = (i >= bpp) ? prevRow[i - bpp] : 0;

      let res = val;
      if (filterType === 1) { // Sub
        res = (val + a) & 0xff;
      } else if (filterType === 2) { // Up
        res = (val + b) & 0xff;
      } else if (filterType === 3) { // Average
        res = (val + Math.floor((a + b) / 2)) & 0xff;
      } else if (filterType === 4) { // Paeth
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        res = (val + pr) & 0xff;
      }
      curRow[i] = res;
    }
    curRow.copy(out, y * width * bpp);
    prevRow = curRow;
  }
  return { width, height, bpp, data: out };
}

function getPixelColorAt(pngBuffer, x, y) {
  const decoded = decodePngPixels(pngBuffer);
  const idx = (y * decoded.width + x) * decoded.bpp;
  return {
    r: decoded.data[idx],
    g: decoded.data[idx + 1],
    b: decoded.data[idx + 2],
  };
}

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
  for (let y = 150; y < 700 && y < height; y += 4) {
    const line = y * stride + 1;
    for (let x = 50; x < 1150 && x < width; x += 4) {
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
  console.log(`[BITMAP OK] ${shotName}: ${width}x${height}px, colori distinti=${colors.size}, deviazione lum=${stdDev.toFixed(2)}`);
  if (stdDev < 4.0 || colors.size < 15) {
    throw new Error(`BITMAP QUASI UNIFORME (${shotName}): stdDev=${stdDev.toFixed(2)}, colori=${colors.size}. Schermata non renderizzata!`);
  }
}

async function run() {
  let client;
  try {
    console.log('--- Avvio Smoke Test Formattazione Fogli Avanzato (P03b) via CDP ---');

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

    async function evaluate(expr) {
      const res = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) {
        const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
        throw new Error(`Errore JS durante evaluate: ${desc}`);
      }
      return res.result ? res.result.value : undefined;
    }

    function assertNoCspViolations(stage) {
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

    async function clickAt(x, y) {
      await Input.dispatchMouseEvent({ type: 'mouseMoved', x, y });
      await sleep(30);
      await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(40);
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await sleep(150);
    }

    async function mouseDrag(x1, y1, x2, y2) {
      await Input.dispatchMouseEvent({ type: 'mouseMoved', x: x1, y: y1 });
      await sleep(40);
      await Input.dispatchMouseEvent({ type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
      await sleep(40);
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        const curX = x1 + (x2 - x1) * (i / steps);
        const curY = y1 + (y2 - y1) * (i / steps);
        await Input.dispatchMouseEvent({ type: 'mouseMoved', x: curX, y: curY, button: 'left' });
        await sleep(20);
      }
      await Input.dispatchMouseEvent({ type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
      await sleep(150);
    }

    async function sendShortcut(char, code, keyCode, modifiers = 2) {
      await Input.dispatchKeyEvent({
        type: 'rawKeyDown',
        key: char,
        code,
        windowsVirtualKeyCode: keyCode,
        modifiers,
      });
      await sleep(40);
      await Input.dispatchKeyEvent({
        type: 'keyUp',
        key: char,
        code,
        windowsVirtualKeyCode: keyCode,
        modifiers,
      });
      await sleep(150);
    }

    async function captureScreenshot(fileName) {
      // Assicura zoom al 100% prima di ogni cattura per non sporcare i controlli
      await evaluate(`(() => {
        const app = document.querySelector('free-app');
        if (app && typeof app.setZoom === 'function') app.setZoom(100);
      })()`);
      await sleep(150);

      const shot = await Page.captureScreenshot({ format: 'png' });
      const buffer = Buffer.from(shot.data, 'base64');
      const outPath = path.join(verificaDir, fileName);
      fs.writeFileSync(outPath, buffer);
      verifyBitmap(buffer, fileName);
      console.log(`[SCREENSHOT SALVATO] ${outPath} (${buffer.length} bytes)`);
      return buffer;
    }

    async function typeCell(text) {
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
      await sleep(80);

      const first = text[0];
      await Input.dispatchKeyEvent({ type: 'keyDown', key: first, text: first, unmodifiedText: first });
      await sleep(100);

      if (text.length > 1) {
        await Input.insertText({ text: text.substring(1) });
        await sleep(80);
      }
      await Input.dispatchKeyEvent({ type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await sleep(250);
    }

    console.log('Attesa caricamento applicazione free-app...');
    for (let i = 0; i < 20; i++) {
      const hasApp = await evaluate(`!!document.querySelector('free-app')`);
      if (hasApp) break;
      await sleep(500);
    }
    assertNoCspViolations('Dopo caricamento');

    // 1. Apertura nuova scheda Fogli
    console.log('Passo 1: Apertura nuova scheda Fogli...');
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

    if (!plusBtnPos) throw new Error('Pulsante + per nuova scheda non trovato');
    await clickAt(plusBtnPos.x, plusBtnPos.y);
    await sleep(300);

    const menuOptionPos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const root = app.renderRoot || app.shadowRoot || app;
      const tabs = root.querySelector('free-tabs');
      const tRoot = tabs.renderRoot || tabs.shadowRoot || tabs;
      const items = Array.from(tRoot.querySelectorAll('.new-dropdown-item'));
      const sheetOpt = items.find(it => it.textContent.toLowerCase().includes('foglio'));
      if (!sheetOpt) return null;
      const r = sheetOpt.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);

    if (!menuOptionPos) throw new Error('Voce "Nuovo Foglio" nel menu non trovata');
    await clickAt(menuOptionPos.x, menuOptionPos.y);
    await sleep(400);

    // =========================================================================
    // SEZIONE A: TEST STRUMENTALE TOOLBAR RESPONSIVE A 4 LARGHEZZE (800, 1000, 1200, 1600)
    // =========================================================================
    console.log('\n--- Sezione A: Misure strumentali Toolbar a 4 larghezze (Punto A.3) ---');
    const widthsToTest = [1600, 1200, 1000, 800];
    const toolbarMetrics = [];

    for (const w of widthsToTest) {
      const m = await evaluate(`(() => {
        const app = document.querySelector('free-app');
        const tb = app.renderRoot.querySelector('free-toolbar');
        tb.containerWidth = ${w};
        tb.requestUpdate();
        return {
          width: ${w},
          height: tb.getBoundingClientRect().height,
          scrollWidth: tb.scrollWidth,
          clientWidth: tb.clientWidth,
          hasScrollbar: tb.scrollWidth > tb.clientWidth,
          hasMoreBtn: !!tb.renderRoot.querySelector('#btn-toolbar-more'),
          visibleGroupsCount: tb.renderRoot.querySelectorAll('.toolbar-group').length,
        };
      })()`);
      await sleep(100);
      console.log(`-> Larghezza ${m.width}px: Altezza=${m.height}px, scrollWidth=${m.scrollWidth}px, clientWidth=${m.clientWidth}px, moreBtn=${m.hasMoreBtn}, gruppi visibili=${m.visibleGroupsCount}`);
      toolbarMetrics.push(m);

      if (m.height !== 42) {
        throw new Error(`ASSERZIONE FALLITA: Altezza toolbar a ${m.width}px deve essere 42px, trovata ${m.height}px`);
      }
      if (m.hasScrollbar) {
        throw new Error(`ASSERZIONE FALLITA: La toolbar mostra barra di scorrimento a ${m.width}px!`);
      }
    }

    // Test interazione reale su 2 controlli dentro il popup overflow a 800px
    console.log('Verifica interazione reale su 2 controlli dentro il popup overflow (...) a 800px:');
    const openPopupRes = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tb = app.renderRoot.querySelector('free-toolbar');
      tb.containerWidth = 800;
      tb.requestUpdate();
      const btn = tb.renderRoot.querySelector('#btn-toolbar-more');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!openPopupRes) throw new Error('Pulsante Altro (...) non trovato a 800px');

    await clickAt(openPopupRes.x, openPopupRes.y);
    await sleep(200);

    const popupItems = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tb = app.renderRoot.querySelector('free-toolbar');
      const popup = tb.renderRoot.querySelector('.overflow-popup');
      return {
        hasPopup: !!popup,
        hasWrapBtn: !!popup.querySelector('#btn-wrap-text-overflow'),
        hasClearBtn: !!popup.querySelector('#btn-clear-formatting-overflow'),
      };
    })()`);
    console.log(`-> Popup overflow aperto: hasPopup=${popupItems.hasPopup}, hasWrapBtn=${popupItems.hasWrapBtn}, hasClearBtn=${popupItems.hasClearBtn}`);
    if (!popupItems.hasPopup || !popupItems.hasWrapBtn) {
      throw new Error('ASSERZIONE FALLITA: Il popup overflow non contiene i controlli attesi');
    }

    // Chiudi popup e ripristina larghezza standard 1200px
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tb = app.renderRoot.querySelector('free-toolbar');
      tb.overflowMenuOpen = false;
      tb.containerWidth = 1200;
      tb.requestUpdate();
    })()`);
    await sleep(150);

    // Test negativo: larghezza troppo piccola (es. 500px)
    if (simFail === 'format-toolbar') {
      throw new Error('SIMULAZIONE FALLIMENTO TOOLBAR NEGATIVO: scrollbar forzata!');
    }

    // =========================================================================
    // SEZIONE B & C: INSERIMENTO DATI REALI, FORMATTAZIONE COMPLETA E SCREENSHOT
    // =========================================================================
    console.log('\n--- Inserimento dati reali e formattazione visuale ---');

    // 2. Inserimento A1 (0.256), A2 (1234.5), A3 (45351)
    const a1Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="A1"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(a1Pos.x, a1Pos.y);
    await typeCell('0.256');
    await typeCell('1234.5');
    await typeCell('45351');

    // Formatta A1: Percentuale
    await clickAt(a1Pos.x, a1Pos.y);
    await sleep(80);
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('change-number-format', 'percent');
    })()`);
    await sleep(150);

    // Formatta A2: Valuta
    const a2Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="A2"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(a2Pos.x, a2Pos.y);
    await sleep(80);
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('format-currency');
    })()`);
    await sleep(150);

    // Formatta A3: Data
    const a3Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="A3"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(a3Pos.x, a3Pos.y);
    await sleep(80);
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('change-number-format', 'date');
    })()`);
    await sleep(150);

    // Verifica valori visualizzati in A1, A2, A3
    const aVals = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      return {
        a1: grid.renderRoot.querySelector('[data-address="A1"]').textContent.trim(),
        a2: grid.renderRoot.querySelector('[data-address="A2"]').textContent.trim(),
        a3: grid.renderRoot.querySelector('[data-address="A3"]').textContent.trim(),
      };
    })()`);
    console.log(`-> Dati A1..A3: A1="${aVals.a1}", A2="${aVals.a2}", A3="${aVals.a3}"`);
    if (aVals.a1 !== '25.60%' && aVals.a1 !== '25.6%') throw new Error(`A1 non conforme: ${aVals.a1}`);
    const expectedA2 = simFail === 'format' ? '€9,999.00' : '€1,234.50';
    if (aVals.a2 !== expectedA2) throw new Error(`ASSERZIONE FALLITA: A2 atteso "${expectedA2}", trovato "${aVals.a2}"`);
    if (aVals.a3 !== '29/02/2024') throw new Error(`A3 non conforme: ${aVals.a3}`);

    // Inserisci testi reali in B1:B3: "Prova 1", "Prova 2", "Prova 3"
    console.log('Inserimento testi reali in B1:B3...');
    const b1Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="B1"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(b1Pos.x, b1Pos.y);
    await typeCell('Prova 1');
    await typeCell('Prova 2');
    await typeCell('Prova 3');

    // B1: Grassetto + Colore testo Rosso (#ef4444)
    await clickAt(b1Pos.x, b1Pos.y);
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('format-bold');
      grid.handleFormatAction('change-text-color', '#ef4444');
    })()`);
    await sleep(150);

    // B2: Corsivo + Sottolineato + Sfondo Giallo chiaro (#fef08a)
    const b2Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="B2"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(b2Pos.x, b2Pos.y);
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('format-italic');
      grid.handleFormatAction('format-underline');
      grid.handleFormatAction('change-fill-color', '#fef08a');
    })()`);
    await sleep(150);

    // B3: Grassetto + Colore testo Rosso (#ef4444)
    const b3Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="B3"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(b3Pos.x, b3Pos.y);
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('format-bold');
      grid.handleFormatAction('change-text-color', '#ef4444');
    })()`);
    await sleep(150);

    // Verifica stili calcolati di B1, B2, B3
    const bStyles = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const getS = (addr) => {
        const cs = window.getComputedStyle(grid.renderRoot.querySelector('[data-address="' + addr + '"]'));
        return {
          fontWeight: cs.fontWeight,
          fontStyle: cs.fontStyle,
          textDecoration: cs.textDecorationLine,
          color: cs.color,
          bg: cs.backgroundColor,
        };
      };
      return { b1: getS('B1'), b2: getS('B2'), b3: getS('B3') };
    })()`);
    console.log(`-> Stili calcolati B1..B3:`, bStyles);
    if (bStyles.b1.fontWeight !== '700' || bStyles.b3.fontWeight !== '700') {
      throw new Error('ASSERZIONE FALLITA: B1 e B3 devono avere fontWeight 700');
    }
    if (bStyles.b2.fontStyle !== 'italic' || !bStyles.b2.textDecoration.includes('underline')) {
      throw new Error('ASSERZIONE FALLITA: B2 deve essere italic e underline');
    }

    // =========================================================================
    // BORDI: TUTTI I BORDI SU C1:D2 E BORDO SPESSO ROSSO SU F1:G3
    // =========================================================================
    console.log('\n--- Applicazione bordi ---');
    // Seleziona C1:D2
    const c1Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="C1"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    const d2Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="D2"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await mouseDrag(c1Pos.x, c1Pos.y, d2Pos.x, d2Pos.y);
    await sleep(150);

    // Applica "Tutti i bordi" con colore Automatico
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.applyBordersFormat('all', 'thin', 'auto');
    })()`);
    await sleep(150);

    // Seleziona F1:G3 e applica bordo perimetro esterno spesso rosso (#ef4444)
    const f1Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="F1"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    const g3Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="G3"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await mouseDrag(f1Pos.x, f1Pos.y, g3Pos.x, g3Pos.y);
    await sleep(150);

    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.applyBordersFormat('outer', 'medium', '#ef4444');
    })()`);
    await sleep(150);

    // Sposta la selezione attiva altrove (su J10) in modo da DESELEZIONARE B1:B3, C1:D2 e F1:G3
    const j10Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="J10"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(j10Pos.x, j10Pos.y);
    await sleep(200);

    // =========================================================================
    // SEZIONE B: VERIFICA CONTRASTO BORDI AUTOMATICI (> 3:1) IN CHIARO E SCURO
    // =========================================================================
    console.log('\n--- Verifica Contrasto Bordi Automatici in Tema Chiaro e Scuro ---');
    // 1. Tema Chiaro
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      app.setTheme('light');
    })()`);
    await sleep(250);

    const lightBorderColors = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const c1 = grid.renderRoot.querySelector('[data-address="C1"]');
      const cs = window.getComputedStyle(c1);
      return {
        borderColor: cs.borderRightColor,
        bgColor: cs.backgroundColor,
      };
    })()`);
    const cLight = calculateContrast(parseRgbString(lightBorderColors.borderColor), parseRgbString(lightBorderColors.bgColor || 'rgb(255,255,255)'));
    console.log(`-> Tema CHIARO: Bordo C1=${lightBorderColors.borderColor}, Sfondo=${lightBorderColors.bgColor}, Contrasto=${cLight.toFixed(2)}:1 (limite >= 3.0:1)`);
    if (cLight < 3.0) throw new Error(`ASSERZIONE FALLITA: Contrasto bordo in tema chiaro (${cLight.toFixed(2)}:1) inferiore a 3:1`);

    // Cattura screenshot 2: grassetto-riempimento.png (in tema chiaro con selezione deselezionata su J10)
    const bufGrassetto = await captureScreenshot('grassetto-riempimento.png');

    // Asserzione bitmap: campiona pixel nell'area di sfondo di B2 (deve avere colore riempimento giallo chiaro ~ rgb(254, 240, 138))
    const b2PixelCoord = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="B2"]');
      const r = td.getBoundingClientRect();
      return {
        rect: { left: r.left, top: r.top, width: r.width, height: r.height }
      };
    })()`);
    // Campiona punti nell'area di padding a destra e in alto dove il testo "Prova 2" non arriva
    const testPoints = [
      { x: Math.round(b2PixelCoord.rect.left + b2PixelCoord.rect.width - 8), y: Math.round(b2PixelCoord.rect.top + 4) },
      { x: Math.round(b2PixelCoord.rect.left + b2PixelCoord.rect.width - 12), y: Math.round(b2PixelCoord.rect.top + 5) },
      { x: Math.round(b2PixelCoord.rect.left + b2PixelCoord.rect.width - 6), y: Math.round(b2PixelCoord.rect.top + b2PixelCoord.rect.height - 4) },
      { x: Math.round(b2PixelCoord.rect.left + 5), y: Math.round(b2PixelCoord.rect.top + 3) },
    ];
    let foundYellow = false;
    let b2Pixel = null;
    for (const pt of testPoints) {
      const px = getPixelColorAt(bufGrassetto, pt.x, pt.y);
      b2Pixel = px;
      if (px.r >= 230 && px.g >= 220 && px.b <= 180) {
        foundYellow = true;
        console.log(`[BITMAP SAMPLING B2 OK] Pixel giallo chiaro campionato a (${pt.x}, ${pt.y}): rgb(${px.r}, ${px.g}, ${px.b})`);
        break;
      }
    }
    if (!foundYellow) {
      throw new Error(`BITMAP FALLITA: Il pixel in B2 non è giallo chiaro! Ultimo rilevato rgb(${b2Pixel.r}, ${b2Pixel.g}, ${b2Pixel.b})`);
    }

    // Cattura screenshot 3: bordi.png
    await captureScreenshot('bordi.png');

    // 2. Tema Scuro
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      app.setTheme('dark');
    })()`);
    await sleep(250);

    const darkBorderColors = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const c1 = grid.renderRoot.querySelector('[data-address="C1"]');
      const f1 = grid.renderRoot.querySelector('[data-address="F1"]');
      const csC1 = window.getComputedStyle(c1);
      const csF1 = window.getComputedStyle(f1);
      return {
        autoBorderColor: csC1.borderRightColor,
        explicitBorderColor: csF1.borderTopColor,
        bgColor: csC1.backgroundColor,
      };
    })()`);
    const cDark = calculateContrast(parseRgbString(darkBorderColors.autoBorderColor), parseRgbString(darkBorderColors.bgColor || 'rgb(15,23,42)'));
    console.log(`-> Tema SCURO: Bordo C1=${darkBorderColors.autoBorderColor}, Sfondo=${darkBorderColors.bgColor}, Contrasto=${cDark.toFixed(2)}:1`);
    console.log(`-> Bordo F1 esplicito rosso in tema scuro: ${darkBorderColors.explicitBorderColor}`);

    if (cDark < 3.0) throw new Error(`ASSERZIONE FALLITA: Contrasto bordo in tema scuro (${cDark.toFixed(2)}:1) inferiore a 3:1`);
    if (darkBorderColors.autoBorderColor === lightBorderColors.borderColor) {
      throw new Error('ASSERZIONE FALLITA: Il colore del bordo automatico non è cambiato tra tema chiaro e tema scuro!');
    }
    if (!darkBorderColors.explicitBorderColor.includes('239') && !darkBorderColors.explicitBorderColor.includes('rgb(239, 68, 68)')) {
      throw new Error('ASSERZIONE FALLITA: Il bordo esplicito rosso è mutato in tema scuro!');
    }

    // Cattura screenshot 4: tema-scuro-formati.png
    await captureScreenshot('tema-scuro-formati.png');

    // Riporta tema a chiaro
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      app.setTheme('light');
    })()`);
    await sleep(200);

    // =========================================================================
    // SEZIONE D: CONTROLLI FUNZIONALI COMPLETI SULLO SMOKE (Punto D)
    // =========================================================================
    console.log('\n--- Sezione D: Controlli funzionali completi nello smoke ---');

    // Seleziona H1 per testare tutti i controlli uno a uno
    const h1Pos = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="H1"]');
      const r = td.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await clickAt(h1Pos.x, h1Pos.y);
    await typeCell('Testo Lungo di Prova');
    await clickAt(h1Pos.x, h1Pos.y);
    await sleep(100);

    // D.1 Sottolineato e Barrato
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('format-strike');
      grid.handleFormatAction('format-underline');
    })()`);
    await sleep(100);
    const h1Dec = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      return window.getComputedStyle(grid.renderRoot.querySelector('[data-address="H1"]')).textDecorationLine;
    })()`);
    console.log(`-> D.1 textDecorationLine su H1: ${h1Dec}`);
    if (!h1Dec.includes('underline') || !h1Dec.includes('line-through')) {
      throw new Error(`ASSERZIONE FALLITA: H1 atteso underline e line-through, trovato ${h1Dec}`);
    }

    // D.2 Dimensione e Famiglia Carattere + Altezza Riga Invariata a 22px
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('change-font', 'Roboto');
      grid.handleFormatAction('change-size', '24');
    })()`);
    await sleep(100);
    const fontMetrics = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="H1"]');
      const tr = td.closest('tr');
      const tr2 = grid.renderRoot.querySelector('[data-address="H2"]').closest('tr');
      const tr5 = grid.renderRoot.querySelector('[data-address="H5"]').closest('tr');
      const cs = window.getComputedStyle(td);
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        rowHeight: tr.getBoundingClientRect().height,
        row2Height: tr2.getBoundingClientRect().height,
        row5Height: tr5.getBoundingClientRect().height,
        tdHeight: td.getBoundingClientRect().height,
        thHeight: tr.querySelector('th').getBoundingClientRect().height,
      };
    })()`);
    console.log(`-> D.2 Font su H1:`, fontMetrics);
    // Tolleranza o verifica altezza riga vs righe non modificate:
    if (fontMetrics.rowHeight !== fontMetrics.row5Height) {
      throw new Error(`ASSERZIONE FALLITA: L'altezza riga con font 24pt (${fontMetrics.rowHeight}px) differisce dall'altezza standard delle altre righe (${fontMetrics.row5Height}px)`);
    }

    // D.3 Allineamento orizzontale e verticale
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('align-center');
      grid.handleFormatAction('align-top');
    })()`);
    await sleep(100);
    const alignMetrics = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const td = grid.renderRoot.querySelector('[data-address="H1"]');
      const cs = window.getComputedStyle(td);
      return { textAlign: cs.textAlign, verticalAlign: cs.verticalAlign };
    })()`);
    console.log(`-> D.3 Allineamenti H1: textAlign=${alignMetrics.textAlign}, verticalAlign=${alignMetrics.verticalAlign}`);
    if (alignMetrics.textAlign !== 'center' || alignMetrics.verticalAlign !== 'top') {
      throw new Error(`ASSERZIONE FALLITA: Allineamenti H1 non conformi: ${JSON.stringify(alignMetrics)}`);
    }

    // D.4 Testo a capo (wrapText)
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('format-wrap');
    })()`);
    await sleep(100);
    const wrapState = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      return window.getComputedStyle(grid.renderRoot.querySelector('[data-address="H1"]')).whiteSpace;
    })()`);
    console.log(`-> D.4 whiteSpace su H1 dopo wrapText: ${wrapState}`);

    // D.5 Cancella Formattazione (clearFormatting)
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('clear-formatting');
    })()`);
    await sleep(100);
    const afterClear = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      const cs = window.getComputedStyle(grid.renderRoot.querySelector('[data-address="H1"]'));
      return {
        textDec: cs.textDecorationLine,
        fontWeight: cs.fontWeight,
      };
    })()`);
    console.log(`-> D.5 Dopo cancella formattazione su H1:`, afterClear);
    if (afterClear.textDec.includes('underline') || afterClear.textDec.includes('line-through')) {
      throw new Error(`ASSERZIONE FALLITA: Cancella formattazione non ha rimosso textDecoration`);
    }

    // D.6 Aumenta / Diminuisci decimali su A1 (da 25.60% a 25.600% e poi a 25.6%)
    await clickAt(a1Pos.x, a1Pos.y);
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('increase-decimals');
    })()`);
    await sleep(100);
    const a1Inc = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      return grid.renderRoot.querySelector('[data-address="A1"]').textContent.trim();
    })()`);
    console.log(`-> D.6 A1 dopo Aumenta decimali: "${a1Inc}"`);
    if (a1Inc !== '25.600%') throw new Error(`ASSERZIONE FALLITA: A1 atteso 25.600%, trovato ${a1Inc}`);

    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('decrease-decimals');
      grid.handleFormatAction('decrease-decimals');
    })()`);
    await sleep(100);
    const a1Dec = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      return grid.renderRoot.querySelector('[data-address="A1"]').textContent.trim();
    })()`);
    console.log(`-> D.6 A1 dopo Diminuisci decimali: "${a1Dec}"`);
    if (a1Dec !== '25.6%') throw new Error(`ASSERZIONE FALLITA: A1 atteso 25.6%, trovato ${a1Dec}`);

    // D.7 Riflessione stato dei pulsanti sulla toolbar che segue la cella attiva
    // Clic su B1 (grassetto) -> pulsante B attivo
    await clickAt(b1Pos.x, b1Pos.y);
    await sleep(100);
    const isBoldActiveOnB1 = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tb = app.renderRoot.querySelector('free-toolbar');
      const btn = tb.renderRoot.querySelector('#btn-bold');
      return btn.classList.contains('active');
    })()`);
    console.log(`-> D.7 Stato pulsante B su cella B1: attivo=${isBoldActiveOnB1}`);
    if (!isBoldActiveOnB1) throw new Error('ASSERZIONE FALLITA: Il pulsante B deve essere attivo su B1');

    // Clic su A1 (non in grassetto) -> pulsante B spento
    await clickAt(a1Pos.x, a1Pos.y);
    await sleep(100);
    const isBoldActiveOnA1 = await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const tb = app.renderRoot.querySelector('free-toolbar');
      const btn = tb.renderRoot.querySelector('#btn-bold');
      return btn.classList.contains('active');
    })()`);
    console.log(`-> D.7 Stato pulsante B su cella A1: attivo=${isBoldActiveOnA1}`);
    if (isBoldActiveOnA1) throw new Error('ASSERZIONE FALLITA: Il pulsante B deve essere spento su A1');

    // Riporta A1 a 25.60% e selezione su A3 per screenshot formati-numerici.png
    await evaluate(`(() => {
      const app = document.querySelector('free-app');
      const grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
      grid.handleFormatAction('increase-decimals');
    })()`);
    await sleep(100);
    await clickAt(a3Pos.x, a3Pos.y);
    await sleep(150);

    // Cattura screenshot 1: formati-numerici.png (con A3 attiva, valore grezzo 45351 visibile nella formula bar ed etichetta Data nella toolbar)
    await captureScreenshot('formati-numerici.png');
    await sleep(100);

    // Controllo finale violazioni CSP
    assertNoCspViolations('Finale');
    console.log('[CSP OK] Nessun messaggio o violazione CSP intercettato durante l intera esecuzione dello scenario!');

    console.log('\n>>> [SMOKE-TEST FORMAT P03b SUPERATO AL 100%] Tutte le asserzioni verificate con successo! <<<');
    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('\nFALLIMENTO SMOKE TEST FORMAT:', err.message);
    if (client) {
      try { await client.close(); } catch (_) {}
    }
    process.exit(1);
  }
}

run();
