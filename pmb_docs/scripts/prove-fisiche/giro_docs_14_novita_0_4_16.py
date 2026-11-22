"""Prova fisica delle novità 0.4.16 nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE), con
mouse e tastiera: Formato › Colonne (si salvano nel documento, Ctrl+Z), Ctrl+Maiusc+Invio (interruzione di colonna), Ctrl+Maiusc+Spazio,
Ctrl+Maiusc+- e Ctrl+- (spazio e trattino non divisibili, trattino facoltativo), il .docx con w:cols, w:br column, w:noBreakHyphen e
w:softHyphen come Word; Strumenti › Controlla accessibilità (immagine senza testo alternativo, Vai, Ricontrolla) e Formato › Immagine ›
Testo alternativo… Uso: python giro_docs_14_novita_0_4_16.py"""
import io, os, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9774
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro14_{int(time.time())}')
p = subprocess.Popen([EXE], env=env)
pw = sync_playwright().start()
for _ in range(80):
    try: browser = pw.chromium.connect_over_cdp(f'http://127.0.0.1:{PORTA}'); break
    except Exception: time.sleep(0.5)
pg = browser.contexts[0].pages[0]; pg.set_default_timeout(6000)
pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
pg.evaluate("() => localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it', tema: 'chiaro', temaScelto: true }))")
pg.reload(); pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
errori = []
pg.on('pageerror', lambda e: errori.append(str(e)[:200]))
pg.on('console', lambda m: errori.append('console: ' + m.text[:200]) if m.type == 'error' else None)
pg.evaluate("() => Object.defineProperty(window, 'G', { get: () => document.querySelector('docs-guscio'), configurable: true })")
js = lambda s, a=None: pg.evaluate(s, a)
js("() => { window.__salvati = []; G.salva = async (nome, bytes) => { window.__salvati.push({ nome, byte: Array.from(new Uint8Array(bytes)) }); return null; }; }")
barra = pg.locator('docs-menubar')
def voce(menu, *percorso):
    barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(f':scope > .etichetta:text-is("{percorso[0]}")'))
    if len(percorso) == 1: v.click(); pg.wait_for_timeout(600); return
    v.hover(); pg.wait_for_timeout(350)
    f = v.locator('.sottopannello .figlio').filter(has=pg.locator(f'.etichetta:text-is("{percorso[1]}")'))
    try: f.click(timeout=2500)
    except Exception:
        pg.keyboard.press('Escape'); barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(250)
        v.hover(); pg.wait_for_timeout(350); f.evaluate('e => e.click()')
    pg.wait_for_timeout(700)
testi = lambda: js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.map((p) => p.runs.map((r) => r.t).join(''))")
ed = lambda s: js(f"() => G.shadowRoot.querySelector('docs-editor').{s}")
PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
try:
    js("() => { const e = G.shadowRoot.querySelector('docs-editor'); e.impostaStato({ doc: { paragrafi: [{ runs: [{ t: 'uno', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 3 }, fuoco: { p: 0, o: 3 } }, pendenti: null }); e.focalizza(); }")
    pg.wait_for_timeout(400)
    voce('formato', 'Colonne', '2 colonne')
    esito('Formato › Colonne › 2 colonne: il testo è su 2 colonne e il documento lo ricorda', ed('colonne') == 2 and ed('stato.doc.colonne') == 2, [ed('colonne'), ed('stato.doc.colonne')])
    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.press('End')
    pg.keyboard.press('Control+Shift+Enter'); pg.keyboard.type('due', delay=25); pg.wait_for_timeout(300)
    esito('Ctrl+Maiusc+Invio: «due» comincia nella colonna dopo (con la maiuscola automatica)', testi() == ['uno', 'Due'] and ed('stato.doc.paragrafi[1].sc') is True
          and js("() => G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('p[data-p=\"1\"]').classList.contains('salto-colonna')"), testi())
    pg.keyboard.type(' art.', delay=25); pg.keyboard.press('Control+Shift+Space'); pg.keyboard.type('5 e', delay=25)
    pg.keyboard.press('Control+Shift+Minus'); pg.keyboard.type('mail para', delay=25); pg.keyboard.press('Control+Minus'); pg.keyboard.type('grafo', delay=25); pg.wait_for_timeout(300)
    esito('Ctrl+Maiusc+Spazio, Ctrl+Maiusc+- e Ctrl+-: spazio e trattino non divisibili, trattino facoltativo', testi()[1] == 'Due art.\u00a05 e\u2011mail para\u00adgrafo', [testi()[1]])
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        x = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte")))).read('word/document.xml').decode('utf-8')
        esito('[docx] come Word: w:cols num=2, w:br column, w:noBreakHyphen, w:softHyphen', 'w:cols w:num="2"' in x and 'w:br w:type="column"' in x and '<w:noBreakHyphen/>' in x and '<w:softHyphen/>' in x, x[-300:])
    else: esito('Ctrl+S scrive un file', False)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    for _ in range(12): pg.keyboard.press('Control+z'); pg.wait_for_timeout(60)
    esito('Ctrl+Z ripetuto torna anche a 1 colonna', ed('colonne') == 1, ed('colonne'))

    # accessibilità: un'immagine senza testo alternativo
    js(f"() => {{ const e = G.shadowRoot.querySelector('docs-editor'); e.impostaStato({{ doc: {{ paragrafi: [{{ st: '1', runs: [{{ t: 'Titolo', g: false, c: false, s: false }}] }}, {{ runs: [{{ t: '\\uFFFC', g: false, c: false, s: false, im: {{ s: '{PNG}', w: 60, h: 40 }} }}] }}] }}, sel: {{ ancora: {{ p: 0, o: 0 }}, fuoco: {{ p: 0, o: 0 }} }}, pendenti: null }}); e.focalizza(); }}")
    pg.wait_for_timeout(400)
    voce('strumenti', 'Controlla accessibilità')
    tipi = js("() => [...G.shadowRoot.querySelector('docs-accessibilita').shadowRoot.querySelectorAll('li')].map((l) => l.dataset.tipo)")
    esito('Controlla accessibilità: l\'immagine senza testo alternativo', tipi == ['immagine-senza-alt'], tipi)
    pg.locator('docs-accessibilita button.vai').first.click(); pg.wait_for_timeout(500)
    esito('«Vai» seleziona l\'immagine', ed('immagineSelezionata()') is True)
    voce('formato', 'Immagine', 'Testo alternativo…')
    pg.locator('docs-testo-alternativo textarea').click(); pg.keyboard.type('Quadratino rosso', delay=20)
    pg.locator('docs-testo-alternativo button.applica').click(); pg.wait_for_timeout(500)
    esito('Formato › Immagine › Testo alternativo…: l\'immagine ha la descrizione (anche nell\'alt dell\'img)', ed('immagineCorrente().d') == 'Quadratino rosso'
          and js("() => G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('img').getAttribute('alt')") == 'Quadratino rosso')
    voce('strumenti', 'Controlla accessibilità')
    esito('ricontrollando non ci sono più problemi', js("() => G.shadowRoot.querySelector('docs-accessibilita').shadowRoot.querySelectorAll('li').length") == 0
          and 'Nessun problema' in js("() => G.shadowRoot.querySelector('docs-accessibilita').shadowRoot.textContent"))
    pg.locator('docs-accessibilita button.chiudi').click(); pg.wait_for_timeout(300)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    print(f"== giro_docs_14 novità 0.4.16: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
