"""Prova fisica della protezione del documento nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE):
Strumenti › Proteggi documento con la password scritta due volte con la tastiera; scrivere, Canc e Ctrl+B non cambiano il testo e c'è
l'avviso; le frecce si muovono; Ctrl+S scrive documentProtection come Word; password sbagliata rifiutata, giusta toglie la protezione e
si torna a scrivere. Uso: python giro_docs_11_protezione.py"""
import io, os, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9771
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro11_{int(time.time())}')
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
def voce(menu, v):
    barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(250)
    barra.locator('.pannello > .voce').filter(has=pg.locator(f':scope > .etichetta:text-is("{v}")')).click(); pg.wait_for_timeout(600)
testo = lambda: js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.map((p) => p.runs.map((r) => r.t).join('')).join('|')")
avviso = lambda: js("() => G.avviso") or ''
ed = lambda s: js(f"() => G.shadowRoot.querySelector('docs-editor').{s}")
try:
    js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.impostaStato({ doc: { paragrafi: [{ runs: [{ t: 'Testo da non cambiare', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); ed.focalizza(); }")
    pg.wait_for_timeout(500)
    voce('strumenti', 'Proteggi documento')
    d = pg.locator('docs-protezione')
    esito('Strumenti › Proteggi documento apre la finestra', d.count() == 1)
    d.locator('input.password').click(); pg.keyboard.type('Prova123', delay=20); pg.keyboard.press('Tab'); pg.keyboard.type('Prova123', delay=20); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    esito('il documento è protetto con la password', ed('protettoConPassword()') is True and pg.locator('docs-protezione').count() == 0)
    pg.locator('docs-editor p[data-p="0"]').click(); pg.wait_for_timeout(200)
    pg.keyboard.press('Home'); pg.keyboard.type('XYZ', delay=30); pg.keyboard.press('Delete'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    esito('scrivere, Canc e Invio non cambiano il testo', testo() == 'Testo da non cambiare', testo())
    esito('e c\'è l\'avviso della sola lettura', 'sola lettura' in avviso(), avviso())
    pg.keyboard.press('Shift+End'); pg.keyboard.press('Control+b'); pg.wait_for_timeout(300)
    esito('Ctrl+B non mette il grassetto', js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi[0].runs.some((r) => r.g)") is False)
    pg.keyboard.press('Home'); pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(200)
    esito('le frecce si muovono', ed('stato.sel.fuoco.o') == 2)
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        s = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte")))).read('word/settings.xml').decode('utf-8')
        esito('[docx] documentProtection in sola lettura con l\'impronta come Word', 'w:documentProtection w:edit="readOnly" w:enforcement="1"' in s and 'w:cryptAlgorithmSid="14"' in s)
    else: esito('Ctrl+S scrive un file', False)
    voce('strumenti', 'Proteggi documento')
    d = pg.locator('docs-protezione')
    d.locator('input.password').click(); pg.keyboard.type('sbagliata', delay=20); pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    esito('password sbagliata: la finestra resta e lo dice', d.count() == 1 and 'non è giusta' in (d.locator('.errore').text_content() or ''))
    d.locator('input.password').fill(''); d.locator('input.password').type('Prova123', delay=20); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    esito('con la password giusta la protezione si toglie', ed('protetto()') is False)
    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.press('End'); pg.keyboard.type('!', delay=30); pg.wait_for_timeout(300)
    esito('e si torna a scrivere', testo() == 'Testo da non cambiare!', testo())
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    p.kill(); subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f"== giro_docs_11: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
