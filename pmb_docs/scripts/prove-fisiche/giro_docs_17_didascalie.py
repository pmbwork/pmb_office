"""Prova fisica delle didascalie (0.4.18) nel pmb_docs installato: Inserisci › Didascalia… due volte, i numeri «Figura 1» e «Figura 2»
si vedono nella pagina; una didascalia inserita prima fa scalare le altre (2 e 3); Ctrl+Z; il .docx con i campi SEQ come Word.
Uso: python giro_docs_17_didascalie.py"""
import io, os, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9777
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro17_{int(time.time())}')
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
numeri = lambda: js("() => [...G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelectorAll('.sequenza')].map((s) => s.closest('p').textContent.replace(/[\uE003]/g, '') + '=' + s.dataset.n + '=' + getComputedStyle(s, '::before').content)")
def didascalia(testo):
    voce('inserisci', 'Didascalia')
    pg.locator('docs-didascalia input[type=text]').click(); pg.keyboard.type(testo, delay=20)
    pg.locator('docs-didascalia button.applica').click(); pg.wait_for_timeout(500)
try:
    js("() => { const e = G.shadowRoot.querySelector('docs-editor'); e.impostaStato({ doc: { paragrafi: [{ runs: [{ t: 'uno', g: false, c: false, s: false }] }, { runs: [{ t: 'due', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); e.focalizza(); }")
    pg.wait_for_timeout(300)
    pg.locator('docs-editor p[data-p="1"]').click()
    didascalia('Sotto due')
    pg.locator('docs-editor p[data-p="0"]').click()
    didascalia('Sotto uno')
    nn = numeri()
    esito("due didascalie: si vedono i numeri 1 e 2 nell'ordine del testo", [x.split('=')[1] for x in nn] == ['1', '2'] and all(x.split('=')[2] == '"' + x.split('=')[1] + '"' for x in nn), nn)
    pg.locator('docs-editor p[data-p="0"]').click()
    voce('inserisci', 'Didascalia')
    pg.locator('docs-didascalia input[type=text]').click(); pg.keyboard.type('Prima di tutto', delay=20)
    pg.locator('docs-didascalia input[type=radio]').nth(1).click()
    pg.locator('docs-didascalia button.applica').click(); pg.wait_for_timeout(500)
    nn = numeri()
    esito('una didascalia sopra la prima riga: diventa la 1 e le altre scalano (2, 3)', [x.split('=')[1] for x in nn] == ['1', '2', '3'], nn)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(400)
    esito('Ctrl+Z la toglie e i numeri tornano 1 e 2', [x.split('=')[1] for x in numeri()] == ['1', '2'], numeri())
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        x = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte")))).read('word/document.xml').decode('utf-8')
        esito('[docx] i campi SEQ Figura come Word, con i numeri 1 e 2', x.count('SEQ Figura') == 2 and '<w:t>1</w:t>' in x and '<w:t>2</w:t>' in x, x[:200])
    else: esito('Ctrl+S scrive un file', False)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    print(f"== giro_docs_17 didascalie: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
