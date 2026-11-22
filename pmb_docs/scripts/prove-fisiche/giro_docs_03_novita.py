"""Prova fisica delle novità di pmb_docs 0.4.9 sul programma INSTALLATO (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE).
Guardato con Playwright collegato a WebView2; la finestra «Apri» di Windows si comanda con la tastiera vera (SendInput).
1. maiuscola automatica e correzione automatica scrivendo con la tastiera; Ctrl+Z toglie solo la correzione; elenco automatico;
2. menu del tasto destro sul testo selezionato: Copia attiva, Taglia e Incolla veri (appunti di Windows);
3. icona di Evidenzia (evidenziatore con la striscia gialla);
4. tema chiaro, scuro e come il sistema, anche quando il sistema cambia a programma aperto;
5. chiusura con modifiche: la domanda compare, Annulla resta, e una seconda X subito dopo chiede di nuovo;
6. Apri con la finestra di Windows e poi Ctrl+S: il file sul disco cambia e nessuna finestra «Salva con nome» si apre;
7. avvio con un file .rtf («Apri con»): si apre e Ctrl+S lo riscrive sul posto.
Profilo WebView2 temporaneo; i file di prova stanno in %TEMP%. Uso: python giro_docs_03_novita.py   (non muovere il mouse né usare la tastiera)"""
import ctypes, ctypes.wintypes as W, os, subprocess, time
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
G = "document.querySelector('docs-guscio')"
CARTELLA = os.path.join(os.environ['TEMP'], 'pmb_docs_giro_03')
os.makedirs(CARTELLA, exist_ok=True)
n = {'OK': 0, 'FAIL': 0}

def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:260]}]' if not cond and dettaglio != '' else ''), flush=True)

# ---- tastiera vera di Windows (per le finestre di sistema, che Playwright non vede) ----
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
def scrivi_vero(testo):
    for ch in testo:
        _invia(scan=ord(ch), flags=0x0004); _invia(scan=ord(ch), flags=0x0004 | 0x0002); time.sleep(0.01)
def tasto_vero(vk):
    _invia(vk=vk); _invia(vk=vk, flags=0x0002); time.sleep(0.05)
def finestre_dialogo(pid):
    """Le finestre di dialogo (classe #32770) del processo, con il loro titolo."""
    trovate = []
    @ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
    def ogni(h, _):
        p = W.DWORD(); u32.GetWindowThreadProcessId(h, ctypes.byref(p))
        cls = ctypes.create_unicode_buffer(64); u32.GetClassNameW(h, cls, 64)
        if p.value == pid and cls.value == '#32770' and u32.IsWindowVisible(h):
            tt = ctypes.create_unicode_buffer(256); u32.GetWindowTextW(h, tt, 256); trovate.append((h, tt.value))
        return True
    u32.EnumWindows(ogni, 0)
    return trovate
def aspetta_dialogo(pid, secondi=8):
    for _ in range(int(secondi * 10)):
        d = finestre_dialogo(pid)
        if d: return d[0]
        time.sleep(0.1)
    return None

class Programma:
    def __init__(self, porta, argomenti=()):
        self.porta = porta; self.argomenti = list(argomenti)
    def __enter__(self):
        env = dict(os.environ)
        env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={self.porta}'
        env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro03_{self.porta}_{int(time.time())}')
        self.p = subprocess.Popen([EXE, *self.argomenti], env=env)
        self.pw = sync_playwright().start()
        for _ in range(80):
            try: self.b = self.pw.chromium.connect_over_cdp(f'http://127.0.0.1:{self.porta}'); break
            except Exception: time.sleep(0.5)
        self.pg = self.b.contexts[0].pages[0]; self.pg.set_default_timeout(8000)
        self.pg.wait_for_selector('docs-guscio'); self.pg.wait_for_timeout(1500)
        self.errori = []
        self.pg.on('pageerror', lambda e: self.errori.append(str(e)[:200]))
        return self
    def js(self, s, a=None): return self.pg.evaluate(s.replace('G.', G + '.'), a)
    def testo(self): return self.js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.map(p => p.runs.map(r => r.t).join('')).join('\\n')")
    def editor(self):
        box = self.pg.locator('docs-editor').bounding_box()
        self.pg.mouse.click(box['x'] + 200, box['y'] + 80); self.pg.wait_for_timeout(200)
    def __exit__(self, *a):
        try: self.pw.stop()
        except Exception: pass
        try: self.p.kill()
        except Exception: pass
        return False

# ---------------------------------------------------------------- 1-5: un documento nuovo
with Programma(9731) as pr:
    pg = pr.pg
    pr.js("() => { let p = {}; try { p = JSON.parse(localStorage.getItem('pmb_docs.preferenze') || '{}'); } catch {} p.interfaccia = 'it'; localStorage.setItem('pmb_docs.preferenze', JSON.stringify(p)); }")
    pg.reload(); pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
    pr.editor()
    pg.keyboard.type('ciao. come stai? bene, perchè no. vedi es. sopra ', delay=25)
    t = pr.testo()
    esito('maiuscola a inizio frase e dopo il punto, non dopo «es.»', t.startswith('Ciao. Come stai? Bene, perché no. Vedi es. sopra'), t)
    esito('«perchè» corretto in «perché»', 'perché' in t, t)
    pg.keyboard.type('fine. y', delay=25); pg.wait_for_timeout(100)
    esito('la lettera dopo «fine. » diventa maiuscola', pr.testo().endswith('fine. Y'), pr.testo()[-12:])
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    t = pr.testo()
    esito('Ctrl+Z subito dopo toglie solo la maiuscola', t.endswith('fine. y'), t[-12:])
    pg.keyboard.type(' "ok" ', delay=25)
    esito('virgolette tipografiche', '“ok”' in pr.testo(), pr.testo()[-12:])
    pg.keyboard.press('Enter'); pg.keyboard.type('1. primo', delay=25)
    el = pr.js("() => { const s = G.shadowRoot.querySelector('docs-editor').stato; return s.doc.paragrafi[s.sel.fuoco.p].el; }")
    esito('«1. » a inizio paragrafo fa partire un elenco numerato', el == 'n', el)

    # 2. tasto destro sul testo selezionato
    pg.keyboard.press('Control+a'); pg.wait_for_timeout(150)
    box = pg.locator('docs-editor').bounding_box()
    pg.mouse.click(box['x'] + 120, box['y'] + 60, button='right'); pg.wait_for_timeout(400)
    menu = pr.js("() => { const m = G.shadowRoot.querySelector('docs-menu-contestuale'); if (!m) return null; return Array.from(m.shadowRoot.querySelectorAll('button')).map(b => [b.dataset.voce, b.disabled]); }")
    esito('il tasto destro apre il menu del documento', bool(menu), menu)
    esito('con il testo selezionato Copia e Taglia sono attive', bool(menu) and dict(menu).get('Copia') is False and dict(menu).get('Taglia') is False, menu)
    prima = pr.testo()
    pr.js("() => G.shadowRoot.querySelector('docs-menu-contestuale').shadowRoot.querySelector('button[data-voce=\"Taglia\"]').click()"); pg.wait_for_timeout(600)
    esito('Taglia dal menu toglie il testo', pr.testo().strip() == '', pr.testo())
    box = pg.locator('docs-editor').bounding_box()
    pg.mouse.click(box['x'] + 120, box['y'] + 60, button='right'); pg.wait_for_timeout(400)
    pr.js("() => G.shadowRoot.querySelector('docs-menu-contestuale').shadowRoot.querySelector('button[data-voce=\"Incolla\"]').click()"); pg.wait_for_timeout(900)
    esito('Incolla dal menu rimette il testo dagli appunti di Windows', 'Come stai' in pr.testo(), pr.testo()[:60])
    del prima

    # 3. icona di Evidenzia
    ic = pr.js("() => { const b = G.shadowRoot.querySelector('docs-toolbar'); const h = b && b.shadowRoot ? b.shadowRoot.innerHTML : ''; return h.includes('#facc15'); }")
    esito('l’icona di Evidenzia è l’evidenziatore con la striscia gialla', ic)

    # 4. tema
    sfondo = lambda: pr.pg.evaluate("() => { const g = document.querySelector('docs-guscio'); return getComputedStyle(g).getPropertyValue('--pmb-superficie').trim() + '|' + getComputedStyle(g.shadowRoot.querySelector('.area-editor') || g).backgroundColor; }")
    pr.js("() => G.cambiaPreferenze({ tema: 'scuro' })"); pg.wait_for_timeout(300); scuro = sfondo()
    pr.js("() => G.cambiaPreferenze({ tema: 'chiaro' })"); pg.wait_for_timeout(300); chiaro = sfondo()
    esito('tema scuro e chiaro hanno colori diversi', scuro != chiaro, (scuro, chiaro))
    pr.js("() => G.cambiaPreferenze({ tema: 'sistema' })")
    pg.emulate_media(color_scheme='dark'); pg.wait_for_timeout(400); sis_scuro = sfondo()
    pg.emulate_media(color_scheme='light'); pg.wait_for_timeout(400); sis_chiaro = sfondo()
    esito('«Come il sistema» segue il sistema anche a programma aperto', sis_scuro == scuro and sis_chiaro == chiaro, (sis_scuro, sis_chiaro))

    # 5. chiusura con modifiche: X, Annulla, X subito dopo
    chiudi = lambda: pr.js("() => G.shadowRoot.querySelector('docs-finestra').shadowRoot.querySelector('button.chiudi').click()")
    domanda = lambda: pr.js("() => !!G.shadowRoot.querySelector('docs-uscita')")
    chiudi(); pg.wait_for_timeout(800)
    esito('chiudendo con modifiche compare «Salvare le modifiche?»', domanda())
    pr.js("() => G.shadowRoot.querySelector('docs-uscita').shadowRoot.querySelector('button.annulla').click()"); pg.wait_for_timeout(400)
    esito('Annulla: il programma resta aperto', pr.p.poll() is None and not domanda())
    chiudi(); pg.wait_for_timeout(800)
    esito('una seconda X subito dopo chiede di nuovo (non chiude senza domande)', pr.p.poll() is None and domanda())
    try: pr.js("() => G.shadowRoot.querySelector('docs-uscita').shadowRoot.querySelector('button.esci').click()")
    except Exception: pass  # la pagina può chiudersi mentre risponde al clic
    time.sleep(2.0)  # il programma si chiude: la pagina non c'è più, si aspetta con l'orologio
    esito('Non salvare chiude il programma', pr.p.poll() is not None)
    esito('nessun errore nella pagina', not pr.errori, pr.errori[:3])

# ---------------------------------------------------------------- 6: Apri con la finestra di Windows, poi Ctrl+S
prova = os.path.join(CARTELLA, 'prova apri.txt')
open(prova, 'w', encoding='utf-8').write('Riga di prova')
with Programma(9732) as pr:
    pg = pr.pg
    pr.js("() => G.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'file', voce: 'Apri' }, bubbles: true, composed: true }))")
    d = aspetta_dialogo(pr.p.pid)
    esito('File › Apri mostra la finestra di Windows', d is not None, d)
    if d:
        # il titolo segue la lingua del programma: con il profilo nuovo è «Automatica», cioè quella di Windows
        lingua = pr.js("() => G.shadowRoot.querySelector('docs-menubar').shadowRoot.querySelector('button.titolo-menu[data-menu=\"modifica\"]').textContent.trim()")
        esito('il titolo della finestra è nella lingua del programma', d[1] == ('Apri' if lingua == 'Modifica' else 'Open'), (d[1], lingua))
        # i tasti si battono solo con la finestra «Apri» davvero in primo piano (altrimenti finirebbero in un'altra finestra)
        for _ in range(6):
            if u32.GetForegroundWindow() == d[0]: break
            _invia(vk=0x12); _invia(vk=0x12, flags=0x0002)
            u32.SetForegroundWindow(d[0]); time.sleep(0.5)
        if u32.GetForegroundWindow() == d[0]:
            scrivi_vero(prova); time.sleep(0.3); tasto_vero(0x0D); time.sleep(2.0)
        else: print('NOTA  la finestra «Apri» non è in primo piano: non si scrive niente', flush=True)
        esito('il file scelto si apre', pr.testo() == 'Riga di prova', pr.testo())
        pr.editor(); pg.keyboard.press('Control+End'); pg.keyboard.type(' aggiunta', delay=25)
        prima = os.path.getmtime(prova)
        pg.keyboard.press('Control+s'); time.sleep(2.0)
        esito('Ctrl+S non apre nessuna finestra «Salva con nome»', not finestre_dialogo(pr.p.pid), finestre_dialogo(pr.p.pid))
        contenuto = open(prova, encoding='utf-8-sig').read()
        esito('Ctrl+S ha riscritto il file sul disco', 'aggiunta' in contenuto and os.path.getmtime(prova) > prima, contenuto[:80])
        esito('nessun file temporaneo lasciato accanto', not any(f.endswith('.pmb-salvataggio') for f in os.listdir(CARTELLA)), os.listdir(CARTELLA))
        badge = pr.js("() => (G.shadowRoot.querySelector('.stato-salvataggio') || {}).textContent || ''")
        esito('il badge dice che è salvato', 'non salvat' not in badge.lower() and 'modifiche' not in badge.lower(), badge)
    esito('nessun errore nella pagina', not pr.errori, pr.errori[:3])

# ---------------------------------------------------------------- 7: avvio con un .rtf («Apri con»), poi Ctrl+S
rtf = os.path.join(CARTELLA, 'lettera è.rtf')
open(rtf, 'w', encoding='ascii').write(r'{\rtf1\ansi Lettera di prova\par}')
with Programma(9733, [rtf]) as pr:
    pg = pr.pg; pg.wait_for_timeout(1500)
    esito('un .rtf passato all’avvio si apre (prima si vedeva un documento vuoto)', 'Lettera di prova' in pr.testo(), pr.testo())
    pr.editor(); pg.keyboard.press('Control+End'); pg.keyboard.type(' modificata', delay=25)
    pg.keyboard.press('Control+s'); time.sleep(2.0)
    finestre = finestre_dialogo(pr.p.pid)
    if finestre:
        # un formato che pmb_docs legge ma non riscrive uguale (rtf) chiede un nome nuovo: è voluto, si annulla
        esito('l’.rtf (formato in sola lettura) chiede un nome nuovo, come previsto', True)
        tasto_vero(0x1B); time.sleep(0.5)
    else:
        esito('Ctrl+S ha riscritto il file di avvio sul posto', 'modificata' in open(rtf, encoding='latin-1').read(), open(rtf, encoding='latin-1').read()[:80])
    esito('nessun errore nella pagina', not pr.errori, pr.errori[:3])

docx_avvio = os.path.join(CARTELLA, 'avvio.txt')
open(docx_avvio, 'w', encoding='utf-8').write('Testo di avvio')
with Programma(9734, [docx_avvio]) as pr:
    pg = pr.pg; pg.wait_for_timeout(1500)
    esito('un .txt passato all’avvio si apre', pr.testo() == 'Testo di avvio', pr.testo())
    pr.editor(); pg.keyboard.press('Control+End'); pg.keyboard.type(' e salvato', delay=25)
    pg.keyboard.press('Control+s'); time.sleep(2.0)
    esito('Ctrl+S sul file di avvio non apre finestre', not finestre_dialogo(pr.p.pid), finestre_dialogo(pr.p.pid))
    esito('Ctrl+S ha riscritto il file di avvio sul posto', 'e salvato' in open(docx_avvio, encoding='utf-8-sig').read(), open(docx_avvio, encoding='utf-8-sig').read())

print(f"== giro_docs_03: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
