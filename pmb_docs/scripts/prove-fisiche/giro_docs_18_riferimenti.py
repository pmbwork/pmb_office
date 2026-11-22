"""Prova fisica dei riferimenti incrociati (0.4.19) nel pmb_docs installato: un titolo e una didascalia; Inserisci › Riferimento
incrociato… al titolo e alla didascalia («Figura 1»), che si vedono nella pagina; il titolo corretto cambia il rimando; una didascalia
inserita prima fa diventare il rimando «Figura 2»; Ctrl+Z; il .docx con i campi REF come Word.
Uso: python giro_docs_18_riferimenti.py"""
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
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro18_{int(time.time())}')
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
    v.click(); pg.wait_for_timeout(600)
rimandi = lambda: js("() => [...G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelectorAll('.riferimento')].map((s) => getComputedStyle(s, '::before').content)")
def riferimento(tipo, indice, modo=None):
    voce('inserisci', 'Riferimento incrociato')
    pg.locator('docs-riferimento select.tipo').select_option(tipo); pg.wait_for_timeout(200)
    pg.locator('docs-riferimento select.elenco').select_option(index=indice); pg.wait_for_timeout(200)
    if modo: pg.locator('docs-riferimento select.modo').select_option(modo)
    pg.locator('docs-riferimento button.applica').click(); pg.wait_for_timeout(500)
try:
    js("""() => { const e = G.shadowRoot.querySelector('docs-editor'); const r = (t) => ({ t, g: false, c: false, s: false });
      e.impostaStato({ doc: { paragrafi: [{ runs: [r('Capitolo')], st: '1' }, { runs: [r('immagine')] }, { runs: [r('Vedi ')] }] }, sel: { ancora: { p: 1, o: 0 }, fuoco: { p: 1, o: 0 } }, pendenti: null }); e.focalizza(); }""")
    pg.wait_for_timeout(300)
    pg.locator('docs-editor p[data-p="1"]').click()
    voce('inserisci', 'Didascalia')
    pg.locator('docs-didascalia input[type=text]').click(); pg.keyboard.type('Gatto', delay=20)
    pg.locator('docs-didascalia button.applica').click(); pg.wait_for_timeout(500)
    pg.locator('docs-editor p[data-p="3"]').click(); pg.keyboard.press('End')
    riferimento('titolo', 0)
    pg.keyboard.type(' e ', delay=20)
    riferimento('didascalia', 0, 'e')
    rr = rimandi()
    esito('due rimandi: il testo del titolo e «Figura 1»', rr == ['"Capitolo"', '"Figura 1"'], rr)
    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.press('End'); pg.keyboard.type(' primo', delay=20); pg.wait_for_timeout(300)
    rr = rimandi()
    esito('il titolo corretto: il rimando si aggiorna da solo', rr[0] == '"Capitolo primo"', rr)
    pg.locator('docs-editor p[data-p="0"]').click()
    voce('inserisci', 'Didascalia')
    pg.locator('docs-didascalia input[type=text]').click(); pg.keyboard.type('Cane', delay=20)
    pg.locator('docs-didascalia button.applica').click(); pg.wait_for_timeout(500)
    rr = rimandi()
    esito('una didascalia prima: il rimando diventa «Figura 2»', rr == ['"Capitolo primo"', '"Figura 2"'], rr)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(400)
    esito('Ctrl+Z: torna «Figura 1»', rimandi() == ['"Capitolo primo"', '"Figura 1"'], rimandi())
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        x = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte")))).read('word/document.xml').decode('utf-8')
        esito('[docx] due campi REF come Word, con il testo «Capitolo primo» e «Figura 1»', x.count(' REF ') == 2 and 'Capitolo primo</w:t></w:r></w:fldSimple>' in x and 'Figura 1</w:t></w:r></w:fldSimple>' in x, x[:200])
    else: esito('Ctrl+S scrive un file', False)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    print(f"== giro_docs_18 riferimenti: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
