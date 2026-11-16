"""Prova fisica di pmb_docs installato (C:\\AI_system\\pmb_office\\pmb_docs\\pmb-docs-shell.exe), guardato con Playwright collegato a WebView2.
1. menu Formato: le voci con sotto-voci (Stili paragrafo, Allinea e applica rientro, Interlinea, Elenchi, Tabella, Immagine) hanno la freccia
   e il sottomenu si apre passandoci sopra con il mouse vero, senza clic; la scelta si applica al paragrafo;
2. finestra Preferenze come quella di pmb_sheets (Tema, Lingua del programma, Correttore ortografico) e tema «Come il sistema»;
3. il logo ufficiale nella finestra (tema chiaro e scuro, su riquadro chiaro) e nella finestra Informazioni.
Salva le fotografie in una cartella temporanea (il percorso si stampa alla fine). Profilo WebView2 temporaneo: niente tocca i dati dell'utente.
Uso: python giro_docs_02_sottomenu_preferenze_logo.py   (non muovere il mouse durante la prova)"""
import os, subprocess, tempfile, time
from playwright.sync_api import sync_playwright

EXE = r'C:\AI_system\pmb_office\pmb_docs\pmb-docs-shell.exe'
PORTA = 9702
G = "document.querySelector('docs-guscio')"
FOTO = tempfile.mkdtemp(prefix='pmb_docs_giro02_')
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
    pg.evaluate("() => { localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it', tema: 'chiaro' })); }")
    pg.reload(); pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
    errori = []
    pg.on('pageerror', lambda e: errori.append(str(e)[:200]))
    js = lambda s, a=None: pg.evaluate(s.replace('G.', G + '.'), a)
    barra = pg.locator('docs-menubar')
    chiudi = lambda: [pg.keyboard.press('Escape') or pg.wait_for_timeout(120) for _ in range(3)]
    # un paragrafo di testo con il cursore dentro
    pg.locator('docs-editor').click(); pg.keyboard.type('Paragrafo di prova'); pg.wait_for_timeout(300)

    # ---- 1. sottomenu del menu Formato con il mouse vero ----
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(300)
    for voce in ['Stili paragrafo', 'Allinea e applica rientro', 'Interlinea e spaziatura paragrafo', 'Elenchi puntati e numerati', 'Tabella', 'Immagine']:
        v = barra.locator('.pannello > .voce').filter(has=pg.locator(f':scope > .etichetta:text-is("{voce}")'))
        esito(f'{voce}: ha la freccia', v.locator(':scope > .freccia').count() == 1)
        v.hover(); pg.wait_for_timeout(350)
        sotto = v.locator('.sottopannello')
        esito(f'{voce}: passandoci sopra si apre il sottomenu', sotto.count() == 1 and sotto.is_visible(), sotto.count())
        if voce == 'Allinea e applica rientro': pg.screenshot(path=os.path.join(FOTO, '1_sottomenu_allinea.png'))
    chiudi()
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Allinea e applica rientro")'))
    v.hover(); pg.wait_for_timeout(300)
    v.locator('.sottopannello .figlio').filter(has_text='Al centro').click(); pg.wait_for_timeout(400)
    al = js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi[0].al")
    esito('Allinea › Al centro allinea il paragrafo', al == 'ce', al)
    esito('dopo la scelta il menu è chiuso e non c\'è nessun riquadro a parte', barra.locator('.pannello').count() == 0 and pg.locator('docs-popup').count() == 0)
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
    v.hover(); pg.wait_for_timeout(300)
    spunta = v.locator('.sottopannello .figlio[aria-checked="true"] .etichetta').all_text_contents()
    esito('la spunta sta su «Al centro»', [s.strip() for s in spunta] == ['Al centro'], spunta)
    chiudi()

    # ---- 2. Preferenze ----
    barra.locator('button.titolo-menu[data-menu="strumenti"]').click(); pg.wait_for_timeout(250)
    barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Preferenze")')).click(); pg.wait_for_timeout(500)
    dlg = pg.locator('docs-preferenze')
    legende = [x.strip() for x in dlg.locator('legend').all_text_contents()]
    esito('Preferenze: riquadri Tema, Lingua del programma, Correttore ortografico', legende == ['Tema', 'Lingua del programma', 'Correttore ortografico'], legende)
    pg.screenshot(path=os.path.join(FOTO, '2_preferenze.png'))
    dlg.locator('input[data-tema="sistema"]').click(); pg.wait_for_timeout(400)
    salvato = js("() => JSON.parse(localStorage.getItem('pmb_docs.preferenze')).tema")
    esito('«Come il sistema» si salva', salvato == 'sistema', salvato)
    dlg.locator('input[data-tema="scuro"]').click(); pg.wait_for_timeout(500)
    esito('tema scuro applicato', js("() => G.getAttribute('tema')") == 'scuro')
    chiudi(); pg.wait_for_timeout(300)

    # ---- 3. logo ----
    sfondo = js("() => getComputedStyle(G.shadowRoot.querySelector('.logo-app')).backgroundImage")
    esito('il logo della finestra è l\'SVG ufficiale', 'image/svg+xml' in sfondo, sfondo[:80])
    fondo = js("() => getComputedStyle(G.shadowRoot.querySelector('.logo-app')).backgroundColor")
    esito('nel tema scuro il logo sta su un riquadro bianco', fondo in ('rgb(255, 255, 255)', 'rgba(255, 255, 255, 1)'), fondo)
    pg.screenshot(path=os.path.join(FOTO, '3_logo_tema_scuro.png'), clip={'x': 0, 'y': 0, 'width': 700, 'height': 130})
    js("() => { const p = JSON.parse(localStorage.getItem('pmb_docs.preferenze')); }")
    barra.locator('button.titolo-menu[data-menu="visualizza"]').click(); pg.wait_for_timeout(250)
    m = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Modalità")'))
    m.hover(); pg.wait_for_timeout(300)
    figli = [x.strip() for x in m.locator('.sottopannello .figlio .etichetta').all_text_contents()]
    esito('Visualizza › Modalità ha anche «Tema di sistema»', figli == ['Tema scuro', 'Tema chiaro', 'Tema di sistema'], figli)
    m.locator('.sottopannello .figlio').filter(has_text='Tema chiaro').click(); pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(FOTO, '4_logo_tema_chiaro.png'), clip={'x': 0, 'y': 0, 'width': 700, 'height': 130})
    barra.locator('button.titolo-menu[data-menu="informazioni"]').click(); pg.wait_for_timeout(250)
    barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Informazioni su pmb_docs")')).click(); pg.wait_for_timeout(600)
    img = pg.locator('docs-informazioni .marchio img')
    esito('la finestra Informazioni ha il logo ufficiale', img.count() == 1 and 'image/svg+xml' in (img.get_attribute('src') or ''))
    pg.screenshot(path=os.path.join(FOTO, '5_informazioni.png'))
    chiudi()
    esito('nessun errore nella pagina in tutta la prova', not errori, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f'\nRIEPILOGO pmb_docs giro 02: OK {n["OK"]}  FAIL {n["FAIL"]}\nfotografie in {FOTO}')
