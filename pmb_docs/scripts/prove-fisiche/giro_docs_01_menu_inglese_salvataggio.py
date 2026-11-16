"""Prova fisica di pmb_docs installato (C:\\AI_system\\pmb_office\\pmb_docs\\pmb-docs-shell.exe), guardato con Playwright collegato a WebView2.
1. ogni voce di ogni menu (e sottomenu) cliccata con il mouse: nessun errore nella pagina e il programma resta vivo;
2. interfaccia in inglese dalla finestra Preferenze: menu, intestazione, badge del salvataggio, Informazioni e licenze in inglese; ritorno all'italiano;
3. salvataggio: con un documento nuovo il badge dice «Non salvato su disco (Ctrl+S)»; dare un nome apre subito la finestra di salvataggio e poi il badge dice «Salvato su disco».
Le finestre di sistema per aprire e salvare sono sostituite da finte (registrano il nome proposto); la stampa non parte. Profilo WebView2 temporaneo: niente tocca i dati dell'utente.
Uso: python giro_docs_01_menu_inglese_salvataggio.py   (non muovere il mouse durante la prova)"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

EXE = r'C:\AI_system\pmb_office\pmb_docs\pmb-docs-shell.exe'
PORTA = 9701
G = "document.querySelector('docs-guscio')"
# Schermo intero cambierebbe lo schermo di Windows (provato nei test automatici); Nascondi i menu toglie la barra dei menu: si prova a parte qui sotto
NON_CLICCARE = {('visualizza', 'Schermo intero'), ('visualizza', 'Nascondi i menu'), ('visualizza', 'Hide the menus')}
n = {'OK': 0, 'FAIL': 0}

def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio and not cond else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro_{PORTA}_{int(time.time())}')
p = subprocess.Popen([EXE], env=env)
pw = sync_playwright().start()
try:
    for _ in range(60):
        try: browser = pw.chromium.connect_over_cdp(f'http://127.0.0.1:{PORTA}'); break
        except Exception: time.sleep(0.5)
    pg = browser.contexts[0].pages[0]; pg.set_default_timeout(8000)
    pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
    # le prove leggono i testi italiani: con Windows in inglese la lingua «automatica» sceglierebbe l'inglese; nel profilo temporaneo si sceglie l'italiano
    pg.evaluate("() => { let p = {}; try { p = JSON.parse(localStorage.getItem('pmb_docs.preferenze') || '{}'); } catch {} p.interfaccia = 'it'; localStorage.setItem('pmb_docs.preferenze', JSON.stringify(p)); }")
    pg.reload(); pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
    errori = []
    pg.on('pageerror', lambda e: errori.append(str(e)[:200]))
    pg.evaluate("""() => { window.__salvati = []; window.__aperture = 0; window.print = () => { window.__stampe = (window.__stampe || 0) + 1; };
      window.showSaveFilePicker = async (o) => { window.__salvati.push(o.suggestedName); return { name: o.suggestedName, createWritable: async () => ({ write: async () => {}, close: async () => {} }) }; };
      window.showOpenFilePicker = async () => { window.__aperture++; const e = new Error('annullato'); e.name = 'AbortError'; throw e; }; }""")
    js = lambda s, a=None: pg.evaluate(s.replace('!!G', '!!' + G).replace('G.', G + '.'), a)
    chiudi = lambda: [pg.keyboard.press('Escape') or pg.wait_for_timeout(120) for _ in range(3)]

    # ---- 1. ogni voce di menu ----
    titoli = js("() => Array.from(G.shadowRoot.querySelector('docs-menubar').shadowRoot.querySelectorAll('button.titolo-menu')).map(b => [b.dataset.menu, b.textContent.trim(), b.getAttribute('aria-haspopup')])")
    esito('si parte in italiano', [t[1] for t in titoli][:3] == ['File', 'Modifica', 'Visualizza'], titoli)
    provate = 0; con_errore = []; rifatti = []
    for menu_id, _, popup in titoli:
        if popup == 'false': continue  # «Segnalazione bug»: provata sotto
        barra = pg.locator('docs-menubar')
        barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click(); pg.wait_for_timeout(250)
        voci = barra.locator('.pannello > .voce').evaluate_all("els => els.map(e => [e.querySelector('.etichetta').textContent.trim(), e.getAttribute('aria-haspopup') === 'menu', e.classList.contains('disabilitata')])")
        chiudi()
        for i, (voce, ha_figli, disab) in enumerate(voci):
            if disab or (menu_id, voce) in NON_CLICCARE: continue
            figli = [None]
            if ha_figli:
                barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click(); pg.wait_for_timeout(200)
                barra.locator('.pannello > .voce').nth(i).hover(); pg.wait_for_timeout(250)
                figli = barra.locator('.sottopannello .figlio .etichetta').evaluate_all('els => els.map(e => e.textContent.trim())')
                chiudi()
            for j, figlio in enumerate(figli):
                prima = len(errori)
                barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click(); pg.wait_for_timeout(200)
                v = barra.locator('.pannello > .voce').nth(i)
                try:
                    if figlio is None: v.click()
                    else: v.hover(); pg.wait_for_timeout(200); barra.locator('.sottopannello .figlio').nth(j).click(timeout=2500)
                except Exception:
                    # il puntatore che va in diagonale verso il sottomenu può chiuderlo: si riapre e si clicca l'elemento direttamente
                    rifatti.append(f'{menu_id} › {voce} › {figlio}')
                    chiudi(); barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click(); pg.wait_for_timeout(200)
                    barra.locator('.pannello > .voce').nth(i).hover(); pg.wait_for_timeout(250)
                    barra.locator('.sottopannello .figlio').nth(j).evaluate('e => e.click()')
                pg.wait_for_timeout(450); chiudi(); pg.wait_for_timeout(150)
                provate += 1
                if len(errori) > prima: con_errore.append((menu_id, voce, figlio, errori[prima:]))
                if not js("() => !!G"): con_errore.append((menu_id, voce, figlio, 'programma non più visibile')); break
    esito(f'ogni voce di menu cliccata ({provate} voci): nessun errore', not con_errore, con_errore[:4])
    esito('il programma è ancora vivo dopo tutte le voci', p.poll() is None and js("() => !!G"))
    if rifatti: print(f'NOTA  {len(rifatti)} voci di sottomenu cliccate direttamente sull elemento (il puntatore chiudeva il sottomenu): ' + '; '.join(rifatti[:6]), flush=True)
    # Nascondi i menu e Ctrl+Maiusc+F per rimetterli
    pg.locator('docs-menubar button.titolo-menu[data-menu="visualizza"]').click(); pg.wait_for_timeout(200)
    pg.locator('docs-menubar .pannello > .voce', has_text='Nascondi i menu').first.click(); pg.wait_for_timeout(500)
    esito('Visualizza › Nascondi i menu nasconde la barra dei menu', not pg.locator('docs-menubar button.titolo-menu[data-menu="file"]').is_visible())
    pg.keyboard.press('Control+Shift+F'); pg.wait_for_timeout(500)
    esito('Ctrl+Maiusc+F rimette i menu', pg.locator('docs-menubar button.titolo-menu[data-menu="file"]').is_visible())
    js("() => G.shadowRoot.querySelector('docs-menubar').shadowRoot.querySelector('button.titolo-menu[data-menu=\"segnalazione\"]').click()"); pg.wait_for_timeout(500)
    esito('«Segnalazione bug» apre la finestra di segnalazione', js("() => !!G.shadowRoot.querySelector('docs-segnala')"))
    chiudi()

    # ---- 3a. salvataggio: documento nuovo, poi rinomina ----
    js("() => G.nuovo ? G.nuovo() : null"); pg.wait_for_timeout(300)
    pg.locator('docs-menubar button.titolo-menu[data-menu="file"]').click(); pg.wait_for_timeout(200)
    pg.locator('docs-menubar .pannello > .voce', has_text='Nuovo').first.click(); pg.wait_for_timeout(600); chiudi()
    badge = lambda: js("() => G.shadowRoot.querySelector('.stato-salvataggio').textContent.replace(/\\s+/g, ' ').trim()")
    esito('documento nuovo: «Non salvato su disco (Ctrl+S)»', badge() == 'Non salvato su disco (Ctrl+S)', badge())
    salvati_prima = js("() => window.__salvati.length")
    pg.locator('docs-guscio span.titolo-documento').click(); pg.wait_for_timeout(250)
    campo = pg.locator('docs-guscio input.titolo-documento')
    campo.fill('Relazione collaudo'); campo.press('Enter'); pg.wait_for_timeout(1200)
    nomi = js("() => window.__salvati")
    esito('dare un nome apre subito la finestra di salvataggio', len(nomi) == salvati_prima + 1, nomi)
    esito('la finestra propone il nome scelto', bool(nomi) and nomi[-1].startswith('Relazione collaudo'), nomi[-1:] if nomi else nomi)
    esito('dopo il salvataggio: «Salvato su disco»', badge() == 'Salvato su disco', badge())

    # ---- 2. inglese ----
    pg.locator('docs-menubar button.titolo-menu[data-menu="strumenti"]').click(); pg.wait_for_timeout(200)
    pg.locator('docs-menubar .pannello > .voce', has_text='Preferenze').first.click(); pg.wait_for_timeout(500)
    pg.locator('docs-preferenze input[data-lingua="en"]').click(); pg.wait_for_timeout(600)
    titoli_en = js("() => Array.from(G.shadowRoot.querySelector('docs-menubar').shadowRoot.querySelectorAll('button.titolo-menu')).map(b => b.textContent.trim())")
    esito('i menu passano subito all inglese', titoli_en[:7] == ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'About'], titoli_en)
    chiudi()
    esito('il badge è in inglese («Saved to disk»)', badge() == 'Saved to disk', badge())
    pg.locator('docs-menubar button.titolo-menu[data-menu="file"]').click(); pg.wait_for_timeout(200)
    pg.locator('docs-menubar .pannello > .voce', has_text='New').first.click(); pg.wait_for_timeout(600); chiudi()
    esito('documento nuovo in inglese: «Not saved to disk (Ctrl+S)»', badge() == 'Not saved to disk (Ctrl+S)', badge())
    nome_doc = js("() => G.shadowRoot.querySelector('.titolo-documento').textContent.trim()")
    esito('nome predefinito «Untitled document»', nome_doc == 'Untitled document', nome_doc)
    pg.locator('docs-menubar button.titolo-menu[data-menu="informazioni"]').click(); pg.wait_for_timeout(200)
    pg.locator('docs-menubar .pannello > .voce', has_text='Third-party licences').first.click(); pg.wait_for_timeout(700)
    testo_info = js("() => { const d = G.shadowRoot.querySelector('docs-informazioni'); return d ? d.shadowRoot.textContent.replace(/\\s+/g, ' ') : ''; }")
    esito('la finestra delle licenze è in inglese', 'Third-party components' in testo_info and 'i rispettivi titolari' not in testo_info and 'nessun avviso indicato' not in testo_info, testo_info[:200])
    chiudi()
    pg.locator('docs-menubar button.titolo-menu[data-menu="strumenti"]').click(); pg.wait_for_timeout(200)
    pg.locator('docs-menubar .pannello > .voce', has_text='Preferences').first.click(); pg.wait_for_timeout(500)
    pg.locator('docs-preferenze input[data-lingua="it"]').click(); pg.wait_for_timeout(600)
    chiudi()
    titoli_it = js("() => Array.from(G.shadowRoot.querySelector('docs-menubar').shadowRoot.querySelectorAll('button.titolo-menu')).map(b => b.textContent.trim())")
    esito('ritorno all italiano', titoli_it[:3] == ['File', 'Modifica', 'Visualizza'], titoli_it)
    esito('nessun errore nella pagina in tutta la prova', not errori, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f"\nRIEPILOGO pmb_docs: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
sys.exit(1 if n['FAIL'] else 0)
