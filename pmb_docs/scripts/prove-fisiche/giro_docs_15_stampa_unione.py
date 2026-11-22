"""Prova fisica della stampa unione nel pmb_docs installato (di serie C:\Program Files\pmb_office\pmb_docs; altrimenti PMB_DOCS_EXE), con
mouse e tastiera: Strumenti › Stampa unione, «Scegli l'elenco…» (l'elenco di Excel di tests/file-prova/unione; la finestra di scelta del
file è sostituita), clic sui campi «Nome» e «Città» che entrano nel testo al cursore, «Crea il documento unito» che apre una scheda con
tre copie separate da salti di pagina; Ctrl+S del modello scrive i MERGEFIELD come Word. Uso: python giro_docs_15_stampa_unione.py"""
import io, os, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9775
ELENCO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests', 'file-prova', 'unione', 'elenco_excel.xlsx'))
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro15_{int(time.time())}')
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
js("(b) => { window.__salvati = []; G.salva = async (nome, bytes) => { window.__salvati.push({ nome, byte: Array.from(new Uint8Array(bytes)) }); return null; }; G.scegliElenco = async () => new File([new Uint8Array(b)], 'elenco_excel.xlsx'); }", list(open(ELENCO, 'rb').read()))
barra = pg.locator('docs-menubar')
def voce(menu, v):
    barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(250)
    barra.locator('.pannello > .voce').filter(has=pg.locator(f':scope > .etichetta:text-is("{v}")')).click(); pg.wait_for_timeout(600)
testi = lambda: js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.map((p) => p.runs.map((r) => r.cu ? '«' + r.cu + '»' : r.t).join(''))")
avviso = lambda: js("() => G.avviso") or ''
try:
    js("() => { const e = G.shadowRoot.querySelector('docs-editor'); e.impostaStato({ doc: { paragrafi: [{ runs: [] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); e.focalizza(); }")
    pg.wait_for_timeout(300)
    pg.locator('docs-editor p[data-p="0"]').click(); pg.keyboard.type('Gentile ', delay=25)
    voce('strumenti', 'Stampa unione')
    esito('Strumenti › Stampa unione apre la finestra', pg.locator('docs-stampa-unione').count() == 1)
    pg.locator('docs-stampa-unione button.scegli').click(); pg.wait_for_timeout(1000)
    campi = js("() => [...G.shadowRoot.querySelector('docs-stampa-unione').shadowRoot.querySelectorAll('button.campo')].map((b) => b.dataset.campo)")
    esito('l\'elenco di Excel: le colonne diventano campi, 3 righe', campi == ['Nome', 'Città', 'Importo', 'Data'] and '3 righe' in js("() => G.shadowRoot.querySelector('docs-stampa-unione').shadowRoot.textContent"), campi)
    pg.locator('docs-stampa-unione button.campo[data-campo="Nome"]').click(); pg.wait_for_timeout(400)
    pg.locator('docs-stampa-unione button.chiudi').click(); pg.wait_for_timeout(300)
    pg.keyboard.press('End'); pg.keyboard.type(', di ', delay=25)
    voce('strumenti', 'Stampa unione')
    pg.locator('docs-stampa-unione button.campo[data-campo="Città"]').click(); pg.wait_for_timeout(400)
    esito('i campi entrano nel testo al cursore', testi() == ['Gentile «Nome», di «Città»'], testi())
    esito('nel testo il campo si vede come «Nome»', js("() => getComputedStyle(G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('.campo-unione'), '::before').content") == '"«" attr(data-campo) "»"'
          or 'Nome' in js("() => getComputedStyle(G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelector('.campo-unione'), '::before').content"))
    pg.locator('docs-stampa-unione button.unisci').click(); pg.wait_for_timeout(1000)
    esito('Crea il documento unito: tre copie in una scheda nuova', testi() == ['Gentile Anna Rossi, di Milano', 'Gentile Bruno Verdi, di Roma', 'Gentile Carla Neri, di Torino']
          and js("() => G.schede.length") == 2 and '3 copie' in avviso(), [testi(), avviso()])
    esito('tra una copia e l\'altra un salto di pagina', js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.map((p) => !!p.sp)") == [False, True, True])
    js("() => G.cambiaScheda(0)"); pg.wait_for_timeout(500)
    esito('il modello resta com\'era nella sua scheda', testi() == ['Gentile «Nome», di «Città»'], testi())
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        x = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte")))).read('word/document.xml').decode('utf-8')
        esito('[docx] i campi come i MERGEFIELD di Word', 'MERGEFIELD Nome' in x and 'MERGEFIELD Città' in x, [m for m in x.split('w:instr=')[1:3]])
    else: esito('Ctrl+S scrive un file', False)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    print(f"== giro_docs_15 stampa unione: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
