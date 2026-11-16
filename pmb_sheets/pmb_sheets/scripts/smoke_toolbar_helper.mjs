import fs from 'fs';
import path from 'path';
import CDP from 'chrome-remote-interface';

const appDir = process.argv[2] || process.cwd();
const widthOrMode = process.argv[3] || 'all';
const simFail = process.argv[4] || '';

const verificaDir = path.join(appDir, 'verifica');
if (!fs.existsSync(verificaDir)) {
  fs.mkdirSync(verificaDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function calculateWcagContrast(color1, color2) {
  function toRgb(color) {
    if (typeof color === 'string') {
      const hex = color.replace('#', '').trim();
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16)
        };
      }
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
      }
    }
    return { r: 0, g: 0, b: 0 };
  }

  function getLuminance(rgb) {
    const a = [rgb.r, rgb.g, rgb.b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  const l1 = getLuminance(toRgb(color1));
  const l2 = getLuminance(toRgb(color2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function main() {
  console.log(`[TOOLBAR_SMOKE] Connessione a WebView2 su porta 9222... (mode=${widthOrMode}, simFail=${simFail})`);
  let client;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      client = await CDP({ port: 9222 });
      break;
    } catch {
      await sleep(1000);
    }
  }

  if (!client) {
    console.error('ERRORE_CDP: Impossibile connettersi a WebView2 su porta 9222');
    process.exit(1);
  }

  const { Runtime, Page } = client;
  await Runtime.enable();
  await Page.enable();

  async function evalJs(expr) {
    const res = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.text} (${JSON.stringify(res.exceptionDetails)})`);
    }
    return res.result ? res.result.value : undefined;
  }

  // Assicuriamoci che esistano sia la scheda Fogli sia la scheda Documenti
  await evalJs(`
    (async () => {
      const app = document.querySelector('free-app');
      if (!app) return;
      const hasSheet = app.tabs && app.tabs.some(t => t.type === 'sheet');
      if (!hasSheet) {
        app.handleTabCreated(new CustomEvent('tab-created', { detail: { type: 'sheet' } }));
        await app.updateComplete;
      }
      const hasDoc = app.tabs && app.tabs.some(t => t.type === 'doc');
      if (!hasDoc) {
        app.handleTabCreated(new CustomEvent('tab-created', { detail: { type: 'doc' } }));
        await app.updateComplete;
      }
    })()
  `);
  await sleep(400);

  // ---------------------------------------------------------------------------
  // MODALITA' CONTRASTO: verifica getComputedStyle del testo su riempimenti e WCAG >= 4.5:1
  // ---------------------------------------------------------------------------
  if (widthOrMode === 'contrast') {
    console.log('[TOOLBAR_SMOKE] Esecuzione verifica colore automatico del testo e contrasto WCAG (Punto 3)...');

    // Seleziona scheda Fogli
    await evalJs(`
      (async () => {
        const app = document.querySelector('free-app');
        const sheetTab = app.tabs.find(t => t.type === 'sheet');
        if (sheetTab) {
          app.activeTabId = sheetTab.id;
          app.handleTabSelected(new CustomEvent('tab-selected', { detail: { id: sheetTab.id, tabId: sheetTab.id } }));
          app.requestUpdate();
          await app.updateComplete;
        }
      })()
    `);
    await sleep(400);

    const contrastResults = await evalJs(`
      (async () => {
        const app = document.querySelector('free-app');
        let grid = app.renderRoot.querySelector('free-sheet-grid[data-tab-id="' + app.activeTabId + '"]');
        if (!grid) {
          grid = app.renderRoot.querySelector('free-sheet-grid:not([hidden])') || app.renderRoot.querySelector('free-sheet-grid');
        }
        if (!grid) throw new Error('free-sheet-grid attivo non trovato');
        await grid.updateComplete;

        const testFills = [
          { name: 'giallo chiaro', bg: '#fef08a', row: 1, col: 1, userColor: undefined },
          { name: 'blu scuro', bg: '#1e3a8a', row: 2, col: 1, userColor: undefined },
          { name: 'rosso', bg: '#ef4444', row: 3, col: 1, userColor: undefined },
          { name: 'grigio medio', bg: '#64748b', row: 4, col: 1, userColor: undefined },
          { name: 'colore scelto utente (verde)', bg: '#fef08a', row: 5, col: 1, userColor: '#15803d' }
        ];

        const doc = grid.getDoc();
        const batchOps = [];
        for (const tc of testFills) {
          batchOps.push({
            type: 'set',
            sheet: doc.activeSheetName,
            row: tc.row,
            col: tc.col,
            raw: 'TEST ' + tc.name.toUpperCase()
          });
        }
        await doc.client.applyBatch(batchOps);

        for (const tc of testFills) {
          const k = tc.row + ',' + tc.col;
          const oldId = doc.styles.cellStyles.get(k) ?? 0;
          const patch = { fill: tc.bg };
          if (tc.userColor) {
            patch.color = tc.userColor;
          }
          const newId = doc.styles.registry.merge(oldId, patch);
          doc.styles.cellStyles.set(k, newId);
        }

        // Seleziona la cella A10 in modo che nessuna delle celle di test A1..A5 sia nello stato 'selected'
        grid.selectSingle(10, 1);
        grid.requestUpdate();
        await grid.updateComplete;
        await new Promise(r => setTimeout(r, 200));

        const readDomStyles = (theme) => {
          const out = [];
          for (const tc of testFills) {
            const td = grid.renderRoot.querySelector('td.sheet-cell[data-row="' + tc.row + '"][data-col="' + tc.col + '"]');
            if (!td) throw new Error('Cella td non trovata nel DOM per riga ' + tc.row);
            const cs = window.getComputedStyle(td);
            out.push({
              theme,
              name: tc.name,
              bgReq: tc.bg,
              userColorReq: tc.userColor,
              computedColor: cs.color,
              computedBg: cs.backgroundColor
            });
          }
          return out;
        };

        // 1. Lettura con Tema Chiaro
        app.setTheme('light');
        await app.updateComplete;
        await new Promise(r => setTimeout(r, 250));
        const lightResults = readDomStyles('light');

        // 2. Lettura con Tema Scuro
        app.setTheme('dark');
        await app.updateComplete;
        await new Promise(r => setTimeout(r, 250));
        const darkResults = readDomStyles('dark');

        // Ripristina tema chiaro
        app.setTheme('light');
        await app.updateComplete;
        await new Promise(r => setTimeout(r, 150));

        return [...lightResults, ...darkResults];
      })()
    `);

    console.log('[TOOLBAR_SMOKE] Risultati misurati via getComputedStyle sul DOM reale:', JSON.stringify(contrastResults, null, 2));

    for (const item of contrastResults) {
      const cr = calculateWcagContrast(item.computedColor, item.computedBg);
      console.log(`  - [${item.theme.toUpperCase()}] "${item.name}": bg=${item.computedBg}, testo=${item.computedColor} => CR=${cr.toFixed(2)}:1`);

      if (item.userColorReq) {
        // Colore scelto dall'utente: deve restare quello (#15803d -> rgb(21, 128, 61))
        if (!item.computedColor.includes('21, 128, 61') && !item.computedColor.includes('#15803d')) {
          throw new Error(`[PRESERVAZIONE COLORE UTENTE FALLITA] Il colore scelto dall'utente non e rimasto invariato: ${item.computedColor}`);
        }
        console.log(`    -> OK: Colore scelto dall'utente preservato invariato (${item.computedColor})`);
      } else {
        // Colore automatico: contrasto WCAG obbligatorio >= 4.5:1
        if (cr < 4.5) {
          throw new Error(`[CONTRASTO WCAG FALLITO] Contrasto insufficiente per "${item.name}" (${item.bgReq}) in tema ${item.theme}: ${cr.toFixed(2)}:1 < 4.5:1`);
        }
        // Verifiche specifiche
        if (item.bgReq === '#fef08a' && !item.computedColor.includes('0, 0, 0')) {
          throw new Error(`Su giallo chiaro atteso testo nero rgb(0, 0, 0), trovato ${item.computedColor}`);
        }
        if (item.bgReq === '#1e3a8a' && !item.computedColor.includes('255, 255, 255')) {
          throw new Error(`Su blu scuro atteso testo bianco rgb(255, 255, 255), trovato ${item.computedColor}`);
        }
      }
    }

    // Salva screenshot contrasto
    const shot = await Page.captureScreenshot({ format: 'png' });
    const shotPath = path.join(verificaDir, 'contrasto-wcag-riempimento.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`[TOOLBAR_SMOKE] Screenshot contrasto salvato: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);

    console.log('[TOOLBAR_SMOKE] Verifica contrasto e colore automatico superata al 100%!');
    await client.close();
    return;
  }

  // ---------------------------------------------------------------------------
  // MODALITA' LARGHEZZA: verifica geometrica toolbar a 800, 1000, 1200, 1600 px
  // ---------------------------------------------------------------------------
  const targetWidth = parseInt(widthOrMode, 10);
  if (isNaN(targetWidth)) {
    throw new Error(`Larghezza o modalita non valida: ${widthOrMode}`);
  }

  console.log(`\n============================================================`);
  console.log(`[TOOLBAR_SMOKE] VERIFICA LARGHEZZA ${targetWidth}px (simFail='${simFail}')`);
  console.log(`============================================================`);

  const docTypes = ['sheet', 'doc'];
  for (const docType of docTypes) {
    console.log(`\n--- Testando toolbar per scheda: ${docType.toUpperCase()} a ${targetWidth}px ---`);

    // Switch scheda
    await evalJs(`
      (async () => {
        const app = document.querySelector('free-app');
        const targetTab = app.tabs.find(t => t.type === '${docType}');
        if (targetTab) {
          app.activeTabId = targetTab.id;
          app.handleTabSelected(new CustomEvent('tab-selected', { detail: { id: targetTab.id, tabId: targetTab.id } }));
          app.requestUpdate();
          await app.updateComplete;
        }
      })()
    `);
    await sleep(400);

    const checkResult = await evalJs(`
      (async () => {
        const app = document.querySelector('free-app');
        const tb = app.renderRoot.querySelector('free-toolbar');
        if (!tb) throw new Error('free-toolbar non trovato');

        // Assicuriamo ricalcolo con la nuova larghezza finestra
        tb.recalculate();
        await tb.updateComplete;
        await new Promise(r => setTimeout(r, 200));

        const tbRect = tb.getBoundingClientRect();
        const wrapper = tb.shadowRoot.querySelector('.toolbar-wrapper');
        if (!wrapper) throw new Error('.toolbar-wrapper non trovato');

        const wrapperRect = wrapper.getBoundingClientRect();
        const scrollWidth = wrapper.scrollWidth;
        const clientWidth = wrapper.clientWidth;

        // Simulazione errore negativo se richiesto
        if ('${simFail}' === 'toolbar') {
          const btn = tb.shadowRoot.querySelector('.toolbar-group button');
          if (btn) {
            btn.style.setProperty('position', 'relative', 'important');
            btn.style.setProperty('left', '3000px', 'important');
            btn.style.setProperty('width', '500px', 'important');
            btn.style.setProperty('display', 'inline-block', 'important');
          }
        }

        // Misura ogni controllo visibile dentro i gruppi toolbar
        const visibleGroups = Array.from(wrapper.querySelectorAll('.toolbar-group')).filter(g => {
          return g.style.display !== 'none' && !g.hidden && g.offsetParent !== null;
        });

        const overflowedItems = [];
        const controlsMeasured = [];

        for (const grp of visibleGroups) {
          const controls = Array.from(grp.querySelectorAll('button, select, input, .tool-btn, .tool-select'));
          for (const ctrl of controls) {
            const r = ctrl.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              const itemInfo = {
                id: ctrl.id || ctrl.getAttribute('aria-label') || ctrl.title || 'ctrl',
                left: Math.round(r.left),
                right: Math.round(r.right),
                top: Math.round(r.top),
                bottom: Math.round(r.bottom),
                width: Math.round(r.width),
                height: Math.round(r.height)
              };
              controlsMeasured.push(itemInfo);

              // Nessun controllo deve oltrepassare il bordo destro della barra (+2px tolleranza sub-pixel)
              if (r.right > wrapperRect.right + 2) {
                overflowedItems.push({
                  ...itemInfo,
                  wrapperRight: Math.round(wrapperRect.right),
                  excess: Math.round(r.right - wrapperRect.right)
                });
              }
            }
          }
        }

        if ('${simFail}' === 'toolbar' && overflowedItems.length === 0) {
          overflowedItems.push({ id: 'simulated-failure-control', right: 3500, wrapperRight: 1000, excess: 2500 });
        }

        const moreBtn = tb.shadowRoot.querySelector('#btn-toolbar-more');
        const isMoreBtnVisible = Boolean(moreBtn && !moreBtn.hidden && moreBtn.offsetParent !== null && window.getComputedStyle(moreBtn).display !== 'none');

        // Conta totale gruppi definiti nel registro
        const allGroupsCount = tb.shadowRoot.querySelectorAll('.measure-group').length;
        const visibleGroupCount = tb.visibleGroupCount ?? allGroupsCount;
        const hasHiddenGroups = visibleGroupCount < allGroupsCount;

        return {
          docType: '${docType}',
          innerWidth: window.innerWidth,
          toolbarHeight: Math.round(tbRect.height * 10) / 10,
          toolbarRect: {
            left: Math.round(tbRect.left),
            right: Math.round(tbRect.right),
            top: Math.round(tbRect.top),
            bottom: Math.round(tbRect.bottom),
            width: Math.round(tbRect.width),
            height: Math.round(tbRect.height)
          },
          scrollWidth,
          clientWidth,
          controlsCount: controlsMeasured.length,
          overflowedItems,
          allGroupsCount,
          visibleGroupCount,
          hasHiddenGroups,
          isMoreBtnVisible
        };
      })()
    `);

    console.log('[TOOLBAR_SMOKE] Metriche geometriche rilevate:', JSON.stringify(checkResult, null, 2));

    // ASSERZIONI
    if (checkResult.overflowedItems.length > 0) {
      throw new Error(`[ERRORE OVERFLOW] Rilevati ${checkResult.overflowedItems.length} controlli oltre il bordo destro della barra: ${JSON.stringify(checkResult.overflowedItems)}`);
    }

    if (checkResult.scrollWidth > checkResult.clientWidth + 2) {
      throw new Error(`[ERRORE SCROLLWIDTH] scrollWidth (${checkResult.scrollWidth}) > clientWidth (${checkResult.clientWidth})`);
    }

    if (Math.abs(checkResult.toolbarHeight - 42) > 1.5) {
      throw new Error(`[ERRORE ALTEZZA] Altezza toolbar ${checkResult.toolbarHeight}px non conforme ai 42px richiesti!`);
    }

    if (checkResult.hasHiddenGroups !== checkResult.isMoreBtnVisible) {
      throw new Error(`[ERRORE PULSANTE MORE] Incongruenza: hasHiddenGroups=${checkResult.hasHiddenGroups} ma isMoreBtnVisible=${checkResult.isMoreBtnVisible}`);
    }

    // Se ci sono gruppi nascosti, verifichiamo il popup overflow e un clic reale su un controllo
    if (checkResult.isMoreBtnVisible) {
      console.log('[TOOLBAR_SMOKE] Gruppi in overflow rilevati. Apertura popup "⋯" e test clic reale...');

      const popupTestResult = await evalJs(`
        (async () => {
          const app = document.querySelector('free-app');
          const tb = app.renderRoot.querySelector('free-toolbar');
          const moreBtn = tb.shadowRoot.querySelector('#btn-toolbar-more');
          if (!moreBtn) throw new Error('#btn-toolbar-more non presente nel shadow DOM');

          // Clic per aprire il menu popup
          moreBtn.click();
          await tb.updateComplete;
          await new Promise(r => setTimeout(r, 100));

          const popup = tb.shadowRoot.querySelector('.overflow-popup');
          if (!popup) throw new Error('.overflow-popup non renderizzato dopo il clic su #btn-toolbar-more');

          // Elenca i controlli del popup
          const popupButtons = Array.from(popup.querySelectorAll('button.tool-btn, button'));
          const popupSelects = Array.from(popup.querySelectorAll('select.tool-select, select'));
          const popupItemsDesc = [
            ...popupButtons.map(b => ({ type: 'button', id: b.id, label: b.getAttribute('aria-label') || b.title || b.textContent.trim() })),
            ...popupSelects.map(s => ({ type: 'select', id: s.id, label: s.getAttribute('aria-label') || s.title || 'select' }))
          ];

          // Trova un pulsante cliccabile nel popup
          const testBtn = popupButtons.find(b => b.id && !b.id.includes('color')) || popupButtons[0];
          if (!testBtn) throw new Error('Nessun pulsante cliccabile trovato dentro .overflow-popup');

          let eventFired = null;
          const onAction = (e) => {
            eventFired = {
              action: e.detail?.action,
              label: e.detail?.label
            };
          };
          tb.addEventListener('toolbar-action', onAction, { once: true });

          // Clic reale sul controllo del popup
          testBtn.click();
          await tb.updateComplete;
          await new Promise(r => setTimeout(r, 100));

          // Chiudi menu se ancora aperto
          if (tb.overflowMenuOpen) {
            moreBtn.click();
            await tb.updateComplete;
          }

          return {
            popupItemsDesc,
            clickedBtnId: testBtn.id || testBtn.title,
            eventFired
          };
        })()
      `);

      console.log('[TOOLBAR_SMOKE] Contenuto del popup overflow:', JSON.stringify(popupTestResult.popupItemsDesc, null, 2));
      console.log('[TOOLBAR_SMOKE] Risultato clic reale su controllo del popup:', JSON.stringify(popupTestResult.eventFired, null, 2));

      if (!popupTestResult.eventFired || !popupTestResult.eventFired.action) {
        throw new Error(`[ERRORE EVENTO POPUP] Il clic su ${popupTestResult.clickedBtnId} nel popup non ha emesso l'evento toolbar-action atteso!`);
      }
    }

    // Scatto screenshot per questa larghezza e tipo scheda
    const shot = await Page.captureScreenshot({ format: 'png' });
    const shotFileName = docType === 'sheet' ? `toolbar-fogli-${targetWidth}.png` : `toolbar-doc-${targetWidth}.png`;
    const shotPath = path.join(verificaDir, shotFileName);
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`[TOOLBAR_SMOKE] Screenshot salvato: ${shotFileName} (${fs.statSync(shotPath).size} bytes)`);
  }

  console.log(`[TOOLBAR_SMOKE] Larghezza ${targetWidth}px superata con successo per entrambe le schede!`);
  await client.close();
}

main().catch((err) => {
  console.error(`[TOOLBAR_SMOKE_FAIL] ${err.message}`);
  process.exit(1);
});
