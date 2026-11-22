"""Prova fisica delle novità 0.4.15 nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE), con
mouse e tastiera: Formato › Testo › MAIUSCOLO / Iniziali Maiuscole e Maiusc+F3 (giro), Ctrl+Z; Strumenti › Leggi ad alta voce (parte e si
ferma con Esc); Inserisci › Codice QR (immagine nel documento, Ctrl+Z la toglie); Formato › Filigrana (si vede sulla pagina, nel .docx come
la filigrana di Word, Ctrl+Z la toglie). Uso: python giro_docs_13_novita_0_4_15.py"""
import io, os, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9773
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro13_{int(time.time())}')
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
    v.hover(); pg.wait_for_timeout(300)
    figli = barra.locator('.sottopannello .figlio .etichetta').evaluate_all('els => els.map(e => e.textContent.trim())')
    barra.locator('.sottopannello .figlio').nth(figli.index(percorso[1])).click(); pg.wait_for_timeout(600)
testo = lambda: js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.map((p) => p.runs.map((r) => r.t).join('')).join('|')")
avviso = lambda: js("() => G.avviso") or ''
immagini = lambda: js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.flatMap((p) => p.runs.filter((r) => r.im)).length")
try:
    js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.impostaStato({ doc: { paragrafi: [{ runs: [{ t: 'ciao bel mondo', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); ed.focalizza(); }")
    pg.wait_for_timeout(400)
    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.press('Home'); pg.keyboard.press('Shift+End'); pg.wait_for_timeout(200)
    voce('formato', 'Testo', 'MAIUSCOLO')
    esito('Formato › Testo › MAIUSCOLO', testo() == 'CIAO BEL MONDO', testo())
    voce('formato', 'Testo', 'Iniziali Maiuscole')
    esito('Iniziali Maiuscole', testo() == 'Ciao Bel Mondo', testo())
    pg.keyboard.press('Shift+F3'); pg.wait_for_timeout(300)
    t1 = testo()
    esito('Maiusc+F3 cambia il modo (giro)', t1 != 'Ciao Bel Mondo' and t1.lower() == 'ciao bel mondo', t1)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
    esito('Ctrl+Z torna indietro di un passo', testo() == 'Ciao Bel Mondo', testo())

    voce('strumenti', 'Leggi ad alta voce'); pg.wait_for_timeout(600)
    esito("Leggi ad alta voce parte subito (anche se le voci di Windows arrivano dopo l'avvio)", 'Lettura ad alta voce' in avviso() and js("() => speechSynthesis.speaking || speechSynthesis.pending"), avviso())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    esito('Esc ferma la lettura', js("() => !window.speechSynthesis || !window.speechSynthesis.speaking"))

    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.press('End')
    prima = immagini()
    voce('inserisci', 'Codice QR'); pg.wait_for_timeout(400)
    pg.locator('docs-qr textarea').click(); pg.keyboard.type('https://esempio.it', delay=10)
    pg.locator('docs-qr button[data-azione="inserisci"]').click(); pg.wait_for_timeout(800)
    esito('Inserisci › Codice QR mette un\'immagine nel documento', immagini() == prima + 1 and js("() => !!G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('img')"), [immagini(), prima])
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(400)
    esito('Ctrl+Z toglie il codice QR', immagini() == prima, immagini())

    voce('formato', 'Filigrana'); pg.wait_for_timeout(400)
    pg.locator('docs-filigrana button.proposta').first.click(); pg.wait_for_timeout(200)
    pg.locator('docs-filigrana button.applica').click(); pg.wait_for_timeout(600)
    esito('Formato › Filigrana «BOZZA» si vede sulla pagina', js("() => { const f = G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('.foglio .filigrana'); return f ? f.textContent.trim() : null; }") == 'BOZZA')
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        z = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte"))))
        intest = ''.join(z.read(n).decode('utf-8') for n in z.namelist() if n.startswith('word/header'))
        esito('[docx] la filigrana come quella di Word (PowerPlusWaterMarkObject, «BOZZA»)', 'PowerPlusWaterMarkObject' in intest and 'string="BOZZA"' in intest)
    else: esito('Ctrl+S scrive un file', False)
    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.press('Control+z'); pg.wait_for_timeout(400)
    esito('Ctrl+Z toglie la filigrana', js("() => !G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('.foglio .filigrana')"))
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    print(f"== giro_docs_13 novità 0.4.15: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
