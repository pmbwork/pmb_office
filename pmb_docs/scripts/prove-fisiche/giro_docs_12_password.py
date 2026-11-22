"""Prova fisica della «password per aprire» nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE):
File › Apri di un .docx cifrato da Word e di un .odt cifrato da LibreOffice (password «Prova-2026!», comune/tests/file-prova/cifratura):
si chiede la password, quella sbagliata si segnala, quella giusta apre il testo; File › Password per aprire imposta una password nuova e
«Scarica» scrive un .docx cifrato (file composto) e un .odt cifrato che si riaprono solo con la password nuova; poi la password si toglie.
La finestra di scelta del file è sostituita come in giro_docs_05. Uso: python giro_docs_12_password.py"""
import os, subprocess, time
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9772
PROVA = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'comune', 'tests', 'file-prova', 'cifratura'))
PASSWORD = 'Prova-2026!'

def manifesto(byte):
    import io, zipfile
    try: return zipfile.ZipFile(io.BytesIO(bytes(byte))).read('META-INF/manifest.xml').decode('utf-8')
    except Exception: return ''
n = {'OK': 0, 'FAIL': 0}

def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro12_{int(time.time())}')
p = subprocess.Popen([EXE], env=env)
pw = sync_playwright().start()
for _ in range(80):
    try: browser = pw.chromium.connect_over_cdp(f'http://127.0.0.1:{PORTA}'); break
    except Exception: time.sleep(0.5)
pg = browser.contexts[0].pages[0]; pg.set_default_timeout(8000)
pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
pg.evaluate("() => localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it', tema: 'chiaro', temaScelto: true }))")
pg.reload(); pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
errori = []
pg.on('pageerror', lambda e: errori.append(str(e)[:200]))
pg.on('console', lambda m: errori.append('console: ' + m.text[:200]) if m.type == 'error' else None)
pg.evaluate("() => Object.defineProperty(window, 'G', { get: () => document.querySelector('docs-guscio'), configurable: true })")
js = lambda s, a=None: pg.evaluate(s, a)
js("""() => { const g = G; window.__salvati = []; window.__aprire = null;
  g.salva = async (nome, bytes, mime) => { window.__salvati.push({ nome, mime, byte: Array.from(new Uint8Array(bytes)) }); return null; };
  g.scegli = async () => window.__aprire ? new File([new Uint8Array(window.__aprire.byte)], window.__aprire.nome) : null; }""")

def voce_menu(menu, *percorso):
    barra = pg.locator('docs-menubar')
    barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(300)
    voci = barra.locator('.pannello > .voce')
    etichette = voci.evaluate_all("els => els.map(e => e.querySelector('.etichetta').textContent.trim())")
    i = next(i for i, e in enumerate(etichette) if e == percorso[0])
    if len(percorso) == 1: voci.nth(i).click(); pg.wait_for_timeout(600); return
    voci.nth(i).hover(); pg.wait_for_timeout(300)
    figli = barra.locator('.sottopannello .figlio .etichetta').evaluate_all('els => els.map(e => e.textContent.trim())')
    barra.locator('.sottopannello .figlio').nth(figli.index(percorso[1])).click(); pg.wait_for_timeout(600)

def apri_byte(nome, byte):
    js("(x) => { window.__aprire = { nome: x[0], byte: x[1] }; }", [nome, byte])
    voce_menu('file', 'Apri'); pg.wait_for_timeout(2500)

def dialogo(): return js("() => { const d = G.shadowRoot.querySelector('docs-password-file'); return d ? { modo: d.modo, errore: d.errore } : null; }")
def testo(): return js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.map((p) => p.runs.map((r) => r.t).join('')).join('\\n')")
def avviso(): return js("() => { const a = G.shadowRoot.querySelector('.avviso'); return a ? a.textContent.trim() : ''; }")

try:
    for nome in ['cifrato_word.docx', 'cifrato_libreoffice.odt']:
        byte = list(open(os.path.join(PROVA, nome), 'rb').read())
        apri_byte(nome, byte)
        esito(f'[{nome}] si chiede la password', (dialogo() or {}).get('modo') == 'apri', dialogo())
        pg.keyboard.type('sbagliata'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1500 if nome.endswith('.docx') else 4000)
        esito(f'[{nome}] la password sbagliata si segnala e si richiede', 'non è giusta' in ((dialogo() or {}).get('errore') or ''), dialogo())
        pg.keyboard.press('Control+A'); pg.keyboard.type(PASSWORD); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500 if nome.endswith('.docx') else 6000)
        esito(f'[{nome}] con la password giusta si apre il testo', dialogo() is None and 'Testo segreto àè' in testo(), [dialogo(), testo()[:80], avviso()])

        # una password nuova per il documento, e il file salvato è cifrato
        voce_menu('file', 'Password per aprire'); pg.wait_for_timeout(500)
        esito(f'[{nome}] File › Password per aprire apre la finestra (con «Togli la password»)', (dialogo() or {}).get('modo') == 'imposta' and js("() => !!G.shadowRoot.querySelector('docs-password-file').shadowRoot.querySelector('button.togli')"))
        pg.keyboard.type('nuova-1'); pg.keyboard.press('Tab'); pg.keyboard.type('nuova-1'); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
        esito(f'[{nome}] password impostata', dialogo() is None and 'impostata' in avviso(), avviso())
        formato = 'OpenDocument (.odt)' if nome.endswith('.odt') else 'Documento (.docx)'
        prima = js("() => window.__salvati.length")
        voce_menu('file', 'Scarica', formato); pg.wait_for_timeout(2500)
        s = js("() => window.__salvati")
        ok = len(s) == prima + 1
        salvato = s[-1]['byte'] if ok else []
        if nome.endswith('.docx'):
            esito('[docx] salvato come file composto cifrato (D0 CF 11 E0)', ok and salvato[:4] == [0xd0, 0xcf, 0x11, 0xe0], salvato[:4])
        else:
            esito('[odt] salvato come zip con il manifesto cifrato', ok and salvato[:2] == [0x50, 0x4b] and 'encryption-data' in manifesto(salvato), salvato[:4])
        apri_byte('riaperto.' + nome.split('.')[-1], salvato)
        esito(f'[{nome}] il file salvato chiede la password', (dialogo() or {}).get('modo') == 'apri', dialogo())
        pg.keyboard.type('nuova-1'); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
        esito(f'[{nome}] e si riapre con la password nuova', dialogo() is None and 'Testo segreto àè' in testo(), [dialogo(), testo()[:80]])
        # togliere la password: il file si salva in chiaro
        voce_menu('file', 'Password per aprire'); pg.wait_for_timeout(500)
        pg.locator('docs-password-file button.togli').click(); pg.wait_for_timeout(600)
        prima = js("() => window.__salvati.length")
        voce_menu('file', 'Scarica', formato); pg.wait_for_timeout(2000)
        s = js("() => window.__salvati")
        esito(f'[{nome}] tolta la password il file si salva in chiaro (zip)', len(s) == prima + 1 and s[-1]['byte'][:2] == [0x50, 0x4b] and 'encryption-data' not in manifesto(s[-1]['byte']), s[-1]['byte'][:4] if s else s)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    print(f"== giro_docs_12 password: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
