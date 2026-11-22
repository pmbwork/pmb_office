"""Prova fisica delle novità 0.4.17 nel pmb_docs installato: Ctrl+Maiusc+D (sottolineato doppio) e Ctrl+Maiusc+K (maiuscoletto) sul testo
selezionato, Formato › Testo › Maiuscoletto che lo toglie, il .docx con w:u double e w:smallCaps come Word, Inserisci › Data e ora con la
data di oggi. Uso: python giro_docs_16_novita_0_4_17.py"""
import io, os, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9776
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro16_{int(time.time())}')
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
import datetime
try:
    js("() => { const e = G.shadowRoot.querySelector('docs-editor'); e.impostaStato({ doc: { paragrafi: [{ runs: [{ t: 'doppio piccolo', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); e.focalizza(); }")
    pg.wait_for_timeout(300)
    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.press('Home')
    for _ in range(6): pg.keyboard.press('Shift+ArrowRight')
    pg.keyboard.press('Control+Shift+D'); pg.wait_for_timeout(300)
    r = js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi[0].runs.map((r) => [r.t, r.w ?? null, r.q ?? null])")
    stile = js("() => getComputedStyle(G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('span.sd')).textDecorationStyle")
    esito('Ctrl+Maiusc+D: «doppio» sottolineato doppio (anche a vista)', r[0] == ['doppio', 'd', None] and stile == 'double', [r, stile])
    pg.keyboard.press('End'); pg.keyboard.press('Shift+Control+ArrowLeft'); pg.keyboard.press('Control+Shift+K'); pg.wait_for_timeout(300)
    r = js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi[0].runs.map((r) => [r.t, r.w ?? null, r.q ?? null])")
    variante = js("() => getComputedStyle(G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('span.mc')).fontVariantCaps")
    esito('Ctrl+Maiusc+K: «piccolo» in maiuscoletto', r[-1] == ['piccolo', None, 'm'] and variante == 'small-caps', [r, variante])
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        x = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte")))).read('word/document.xml').decode('utf-8')
        esito('[docx] come Word: w:u double e w:smallCaps', '<w:u w:val="double"/>' in x and '<w:smallCaps/>' in x, x[-300:])
    else: esito('Ctrl+S scrive un file', False)
    voce('formato', 'Testo', 'Maiuscoletto')
    r = js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi[0].runs.map((r) => [r.t, r.w ?? null, r.q ?? null])")
    esito('Formato › Testo › Maiuscoletto sullo stesso testo lo toglie', r[-1][0].strip() == 'piccolo' and r[-1][2] is None, r)
    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.press('End'); pg.keyboard.type(' il ', delay=20)
    oggi = datetime.date.today().strftime('%d/%m/%Y')
    voce('inserisci', 'Data e ora', oggi)
    t = js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi[0].runs.map((r) => r.t).join('')")
    esito('Inserisci › Data e ora: la data di oggi nel testo', t.endswith('il ' + oggi), t)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    print(f"== giro_docs_16 novità 0.4.17: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
