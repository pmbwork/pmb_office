import fs from 'fs';
import path from 'path';
import CDP from 'chrome-remote-interface';

const testDir = process.argv[2];
const simFail = process.argv[3] || '';

async function run() {
  let client;
  try {
    for (let i = 0; i < 12; i++) {
      try {
        client = await CDP({ port: 9222 });
        if (client) break;
      } catch (_) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!client) {
      console.error('ERRORE_CDP: Impossibile connettersi alla porta 9222 di WebView2');
      process.exit(4);
    }

    const { Runtime } = client;
    await Runtime.enable();

    // 1. Verifica location.href (B.1)
    const urlEval = await Runtime.evaluate({ expression: 'window.location.href' });
    let realUrl = urlEval.result ? urlEval.result.value : '';
    if (simFail === 'url') {
      realUrl = 'http://localhost:1420/';
    }
    console.log('URL: ' + realUrl);

    if (!realUrl || realUrl.includes('localhost:1420')) {
      console.error('ERRORE_URL: l\'eseguibile sta caricando localhost:1420 invece che custom-protocol!');
      await client.close();
      process.exit(2);
    }

    // 2. Verifica document.title e componenti nel DOM (B.2)
    const titleEval = await Runtime.evaluate({ expression: 'document.title' });
    console.log('TITOLO: ' + (titleEval.result ? titleEval.result.value : ''));

    const domEval = await Runtime.evaluate({
      expression: `(() => {
        const app = document.querySelector('free-app');
        if (!app) return false;
        const root = app.renderRoot || app.shadowRoot || app;
        return !!root.querySelector('free-menubar');
      })()`
    });

    let hasMenubar = domEval.result ? domEval.result.value : false;
    if (simFail === 'dom') {
      hasMenubar = false;
    }
    console.log('MENUBAR_PRESENTE: ' + hasMenubar);

    if (!hasMenubar) {
      console.error('ERRORE_DOM: free-menubar non trovato nel DOM reale!');
      await client.close();
      process.exit(3);
    }

    // 3. Invio azione cambio tema per testare persistenza Rust (B.5)
    await Runtime.evaluate({
      expression: `(() => {
        const app = document.querySelector('free-app');
        const root = app.renderRoot || app.shadowRoot || app;
        const menubar = root.querySelector('free-menubar');
        if (menubar) {
          menubar.dispatchEvent(new CustomEvent('menu-action', {
            detail: { action: 'set-theme-dark', label: 'Tema Scuro' },
            bubbles: true,
            composed: true
          }));
        }
      })()`
    });

    await new Promise((r) => setTimeout(r, 1500));
    await client.close();
    console.log('SMOKE_HELPER_COMPLETATO_CON_SUCCESSO');
    process.exit(0);
  } catch (err) {
    console.error('ERRORE_CDP: ' + err.message);
    if (client) await client.close();
    process.exit(5);
  }
}

run();
