"""Prova fisica di Inserisci › Riferimento incrociato… con la TASTIERA VERA (SendInput di Windows, non i tasti simulati di Playwright):
il dialogo si apre con il cursore nell'elenco; Freccia giù sceglie il secondo titolo e Invio lo inserisce; Maiusc+Tab, frecce e Tab cambiano
tipo (Didascalie) e modo (Tutta la didascalia); Esc chiude senza inserire e il cursore torna nel testo; Ctrl+Z annulla.
Solo l'apertura del menu e il posizionamento del cursore si fanno con il mouse simulato (il menu non ha la navigazione da tastiera).
Uso: python giro_docs_19_riferimenti_tastiera.py   (non toccare mouse e tastiera durante la prova)"""
import ctypes, ctypes.wintypes as W, os, subprocess, time
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9778
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

u32 = ctypes.windll.user32
class KEYBDINPUT(ctypes.Structure):
    _fields_ = [('wVk', W.WORD), ('wScan', W.WORD), ('dwFlags', W.DWORD), ('time', W.DWORD), ('dwExtraInfo', ctypes.POINTER(ctypes.c_ulong))]
class _U(ctypes.Union):
    _fields_ = [('ki', KEYBDINPUT), ('pad', ctypes.c_byte * 32)]
class INPUT(ctypes.Structure):
    _fields_ = [('type', W.DWORD), ('u', _U)]
def _invia(vk=0, scan=0, flags=0):
    i = INPUT(type=1); i.u.ki = KEYBDINPUT(vk, scan, flags, 0, None)
    u32.SendInput(1, ctypes.byref(i), ctypes.sizeof(INPUT))
ESTESO = {0x25, 0x26, 0x27, 0x28}            # le frecce sono tasti «estesi»
def tasto(vk, *modificatori):
    for m in modificatori: _invia(vk=m)
    f = 0x0001 if vk in ESTESO else 0
    _invia(vk=vk, flags=f); _invia(vk=vk, flags=f | 0x0002)
    for m in reversed(modificatori): _invia(vk=m, flags=0x0002)
    time.sleep(0.25)
def scrivi(testo):
    for ch in testo:
        _invia(scan=ord(ch), flags=0x0004); _invia(scan=ord(ch), flags=0x0004 | 0x0002); time.sleep(0.03)
    time.sleep(0.2)
GIU, SU, TAB, MAIUSC, INVIO, ESC, CTRL = 0x28, 0x26, 0x09, 0x10, 0x0D, 0x1B, 0x11

def finestra_principale(pid):
    trovate = []
    @ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
    def ogni(h, _):
        p = W.DWORD(); u32.GetWindowThreadProcessId(h, ctypes.byref(p))
        if p.value == pid and u32.IsWindowVisible(h) and u32.GetWindowTextLengthW(h) > 0: trovate.append(h)
        return True
    u32.EnumWindows(ogni, 0)
    return trovate[0] if trovate else None
def in_primo_piano(pid):
    h = finestra_principale(pid)
    if not h: return False
    if u32.GetForegroundWindow() == h: return True
    # un tasto inviato da qui «sblocca» SetForegroundWindow. NON Alt: Alt premuto e rilasciato da solo mette la finestra principale in
    # «modalità menu» di Windows e la pagina smette di rispondere ai comandi della prova (visto il 22/11). Maiusc non fa nulla.
    _invia(vk=0x10); _invia(vk=0x10, flags=0x0002)
    u32.SetForegroundWindow(h); time.sleep(0.4)
    return u32.GetForegroundWindow() == h

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro19_{int(time.time())}')
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
barra = pg.locator('docs-menubar')
def voce(menu, etichetta):
    barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(250)
    barra.locator('.pannello > .voce').filter(has=pg.locator(f':scope > .etichetta:text-is("{etichetta}")')).click(); pg.wait_for_timeout(600)
rimandi = lambda: js("() => [...G.shadowRoot.querySelector('docs-editor').shadowRoot.querySelectorAll('.riferimento')].map((s) => getComputedStyle(s, '::before').content)")
dialogo_aperto = lambda: js("() => !!G.shadowRoot.querySelector('docs-riferimento')")
attivo = lambda: js("() => { const d = G.shadowRoot.querySelector('docs-riferimento'); const a = d && d.shadowRoot.activeElement; return a ? a.className : null; }")
testo_p = lambda k: js(f"() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi[{k}].runs.map((r) => r.xr ? '[RIF]' : r.t).join('')")
try:
    js("""() => { const e = G.shadowRoot.querySelector('docs-editor'); const r = (t) => ({ t, g: false, c: false, s: false });
      e.impostaStato({ doc: { paragrafi: [{ runs: [r('Capitolo')], st: '1' }, { runs: [r('Sezione')], st: '2' }, { runs: [r('immagine')] }, { runs: [r('Vedi ')] }] },
        sel: { ancora: { p: 2, o: 0 }, fuoco: { p: 2, o: 0 } }, pendenti: null }); e.focalizza(); }""")
    pg.wait_for_timeout(300)
    pg.locator('docs-editor p[data-p="2"]').click()
    voce('inserisci', 'Didascalia')
    pg.locator('docs-didascalia input[type=text]').click(); pg.keyboard.type('Gatto', delay=20)
    pg.locator('docs-didascalia button.applica').click(); pg.wait_for_timeout(500)
    esito('la finestra del programma è in primo piano (serve alla tastiera vera)', in_primo_piano(p.pid))

    # 1) Freccia giù + Invio: il secondo titolo
    pg.locator('docs-editor p[data-p="4"]').click(); in_primo_piano(p.pid); tasto(0x23)        # Fine
    voce('inserisci', 'Riferimento incrociato'); in_primo_piano(p.pid)
    esito('all\'apertura il cursore è nell\'elenco', (attivo() or '').startswith('elenco'), attivo())
    tasto(GIU); tasto(INVIO); pg.wait_for_timeout(400)
    esito('Freccia giù e Invio: rimando al secondo titolo «Sezione», dialogo chiuso', rimandi() == ['"Sezione"'] and not dialogo_aperto(), [rimandi(), dialogo_aperto()])

    # 2) dopo l'inserimento il cursore è nel testo: si continua a scrivere
    scrivi(' e ')
    esito('dopo Invio si scrive subito nel testo', testo_p(4) == 'Vedi [RIF] e ', testo_p(4))

    # 3) Maiusc+Tab al tipo, due volte giù (Didascalie), Tab all'elenco, Tab al modo, giù (Tutta la didascalia), Invio
    voce('inserisci', 'Riferimento incrociato'); in_primo_piano(p.pid)
    tasto(TAB, MAIUSC); esito('Maiusc+Tab porta al tipo', attivo() == 'tipo', attivo())
    tasto(GIU); tasto(GIU)
    tipo = js("() => G.shadowRoot.querySelector('docs-riferimento').shadowRoot.querySelector('select.tipo').value")
    esito('due volte Freccia giù: tipo Didascalie, compare la scelta del modo', tipo == 'didascalia' and js("() => !!G.shadowRoot.querySelector('docs-riferimento').shadowRoot.querySelector('select.modo')"), tipo)
    tasto(TAB); tasto(TAB); esito('due Tab portano al modo', attivo() == 'modo', attivo())
    tasto(GIU); tasto(INVIO); pg.wait_for_timeout(400)
    rr = rimandi()
    esito('Invio dal modo: rimando a tutta la didascalia («Figura 1» e «Gatto»)', len(rr) == 2 and 'Figura 1' in rr[1] and 'Gatto' in rr[1] and not dialogo_aperto(), rr)

    # 4) Esc chiude senza inserire e il cursore torna nel testo
    voce('inserisci', 'Riferimento incrociato'); in_primo_piano(p.pid)
    tasto(ESC); pg.wait_for_timeout(300)
    esito('Esc chiude il dialogo senza inserire nulla', not dialogo_aperto() and len(rimandi()) == 2, [dialogo_aperto(), rimandi()])
    scrivi('X')
    esito('dopo Esc si scrive nel testo, dopo il rimando', testo_p(4) == 'Vedi [RIF] e [RIF]X', testo_p(4))

    # 5) Ctrl+Z vero: toglie la X, poi il secondo rimando
    tasto(0x5A, CTRL); pg.wait_for_timeout(300)
    esito('Ctrl+Z toglie la X', testo_p(4) == 'Vedi [RIF] e [RIF]', testo_p(4))
    tasto(0x5A, CTRL); pg.wait_for_timeout(300)
    esito('Ctrl+Z di nuovo toglie il rimando alla didascalia', len(rimandi()) == 1, rimandi())
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    print(f"== giro_docs_19 riferimenti con la tastiera vera: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
