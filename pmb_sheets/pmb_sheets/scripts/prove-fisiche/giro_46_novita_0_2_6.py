"""Prova fisica delle novità di pmb_sheets 0.2.6 sul programma INSTALLATO (di serie C:\\Program Files\\pmb_office\\pmb_sheets; altrimenti PMB_SHEETS_EXE).
Guardato con Playwright collegato a WebView2; le finestre di Windows (Apri, Salva con nome) si comandano con la tastiera vera (SendInput) e la
chiusura della finestra è quella vera (WM_CLOSE, come la X o Alt+F4), che passa dalla parte nativa.
1. Dati › Rimuovi duplicati e Dati › Testo in colonne dalle loro finestre;
2. File › Imposta pagina (orizzontale), Anteprima di stampa, Stampa (regola @page e numero di pagine), Scarica come PDF con la finestra di Windows;
3. Apri con la finestra di Windows, poi Salva: il file .xlsx sul disco cambia (riletto con openpyxl) e nessuna finestra «Salva con nome» si apre;
4. avvio con un file («Apri con»): Salva lo riscrive sul posto;
5. chiusura con modifiche: la domanda (Salva / Non salvare / Annulla), Annulla resta, una seconda X subito dopo chiede di nuovo, Non salvare chiude.
Profilo WebView2 temporaneo; i file di prova stanno in %TEMP%. Uso: python giro_46_novita_0_2_6.py   (non muovere il mouse né usare la tastiera)"""
import ctypes, ctypes.wintypes as W, os, subprocess, time
import openpyxl
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_SHEETS_EXE', r'C:\Program Files\pmb_office\pmb_sheets\pmb-sheets-shell.exe')
APP = "document.querySelector('free-app')"
GR = APP + ".shadowRoot.querySelector('free-sheet-grid')"
CARTELLA = os.path.join(os.environ['TEMP'], 'pmb_sheets_giro_46')
os.makedirs(CARTELLA, exist_ok=True)
n = {'OK': 0, 'FAIL': 0}

def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:260]}]' if not cond and dettaglio != '' else ''), flush=True)

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
def finestre(pid, dialogo=True):
    trovate = []
    @ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
    def ogni(h, _):
        p = W.DWORD(); u32.GetWindowThreadProcessId(h, ctypes.byref(p))
        cls = ctypes.create_unicode_buffer(64); u32.GetClassNameW(h, cls, 64)
        if p.value == pid and u32.IsWindowVisible(h) and ((cls.value == '#32770') == dialogo):
            tt = ctypes.create_unicode_buffer(256); u32.GetWindowTextW(h, tt, 256); trovate.append((h, tt.value))
        return True
    u32.EnumWindows(ogni, 0)
    return trovate
def aspetta_dialogo(pid, secondi=8):
    for _ in range(int(secondi * 10)):
        d = finestre(pid)
        if d: return d[0]
        time.sleep(0.1)
    return None
def scegli_nel_dialogo(pid, percorso):
    d = aspetta_dialogo(pid)
    if not d: return None
    # prima di battere i tasti la finestra «Salva con nome» deve essere davvero in primo piano: altrimenti i tasti (con Invio)
    # finirebbero nella finestra di un'altra persona o programma (è successo il 2026-11-21: il percorso è arrivato in una chat)
    for _ in range(6):
        if u32.GetForegroundWindow() == d[0]: break
        _invia(vk=0x12); _invia(vk=0x12, flags=0x0002)  # un Alt permette a SetForegroundWindow di funzionare
        u32.SetForegroundWindow(d[0]); time.sleep(0.5)
    if u32.GetForegroundWindow() != d[0]:
        print('NOTA  la finestra «Salva con nome» non è in primo piano: non si scrive niente', flush=True)
        return None
    # nel campo del nome del file: si cancella ciò che c'è e si scrive il percorso completo
    _invia(vk=0x11); tasto_vero(0x41); _invia(vk=0x11, flags=0x0002); tasto_vero(0x2E)
    scrivi_vero(percorso); time.sleep(0.3); tasto_vero(0x0D); time.sleep(1.5)
    # «Il file esiste già: sostituirlo?» (Salva con nome sopra un file esistente)
    altra = finestre(pid)
    if altra: u32.SetForegroundWindow(altra[0][0]); time.sleep(0.3); tasto_vero(0x59); time.sleep(1.0)
    return d

class Programma:
    def __init__(self, porta, argomenti=()):
        self.porta = porta; self.argomenti = list(argomenti)
    def __enter__(self):
        env = dict(os.environ)
        env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={self.porta}'
        env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_sheets_giro46_{self.porta}_{int(time.time())}')
        self.p = subprocess.Popen([EXE, *self.argomenti], env=env)
        self.pw = sync_playwright().start()
        for _ in range(80):
            try: self.b = self.pw.chromium.connect_over_cdp(f'http://127.0.0.1:{self.porta}'); break
            except Exception: time.sleep(0.5)
        self.pg = self.b.contexts[0].pages[0]; self.pg.set_default_timeout(8000)
        self.pg.wait_for_selector('free-sheet-grid'); self.pg.wait_for_timeout(1500)
        # le prove leggono i testi italiani: solo per questa sessione, senza salvarlo
        self.pg.evaluate("() => { const a = document.querySelector('free-app'); if (a && typeof a.applicaLingua === 'function') return a.applicaLingua('it', false); }")
        self.pg.wait_for_timeout(300)
        self.errori = []
        self.pg.on('pageerror', lambda e: self.errori.append(str(e)[:200]))
        return self
    def js(self, s, a=None): return self.pg.evaluate(s.replace('GR.', GR + '.').replace('APP.', APP + '.'), a)
    def menu(self, azione):
        self.js("(a) => APP.shadowRoot.querySelector('free-menubar').dispatchEvent(new CustomEvent('menu-action', { detail: { action: a, label: a }, bubbles: true, composed: true }))", azione)
        self.pg.wait_for_timeout(500)
    def metti(self, righe):
        self.js("async (righe) => { const d = GR.getDoc(); for (let r = 0; r < righe.length; r++) for (let c = 0; c < righe[r].length; c++) await d.client.setCell(d.activeSheetName, r + 1, c + 1, righe[r][c]); GR.cellsCache?.clear?.(); GR.updateViewport?.(); GR.requestUpdate(); }", righe)
        self.pg.wait_for_timeout(300)
    def cella(self, r, c): return self.js("async ([r, c]) => { const d = GR.getDoc(); return (await d.client.getCell(d.activeSheetName, r, c)).raw; }", [r, c])
    def seleziona(self, r1, c1, r2, c2): self.js("([a, b, c, d]) => { GR.selectSingle(a, b); GR.extendSelectionTo(c, d); }", [r1, c1, r2, c2])
    def ombra(self, sel, dentro): return self.js(f"() => {{ const d = APP.shadowRoot.querySelector('{sel}'); if (!d) return null; const x = d.shadowRoot.querySelector('{dentro}'); if (x) x.click(); return !!x; }}")
    def __exit__(self, *a):
        try: self.pw.stop()
        except Exception: pass
        try: self.p.kill()
        except Exception: pass
        return False

# ---------------------------------------------------------------- 1, 2, 5: un foglio nuovo
with Programma(9741) as pr:
    pg = pr.pg
    pr.metti([['Nome', 'Città'], ['Rossi', 'Roma'], ['Bianchi', 'Milano'], ['rossi', 'roma'], ['Verdi', 'Napoli']])
    pr.seleziona(1, 1, 1, 1)
    pr.menu('remove-duplicates')
    esito('Dati › Rimuovi duplicati apre la finestra', pr.js("() => !!APP.shadowRoot.querySelector('free-dialogo-duplicati')"))
    pr.ombra('free-dialogo-duplicati', 'button[data-azione=\"rimuovi\"]'); pg.wait_for_timeout(800)
    colonna = [pr.cella(r, 1) for r in range(1, 6)]
    esito('la riga duplicata («rossi, roma») è tolta e le altre salgono', colonna == ['Nome', 'Rossi', 'Bianchi', 'Verdi', ''], colonna)
    stato = pr.js("() => APP.statusMessage")
    esito('la barra di stato dice quante righe ha tolto', 'rimosse: 1' in stato.lower(), stato)
    pr.metti([[''] * 2] * 9 + [['Rossi;Mario;1,5'], ['Bianchi;Anna;2']])
    pr.seleziona(10, 1, 11, 1)
    pr.menu('split-text')
    esito('Dati › Testo in colonne apre la finestra con l’anteprima', pr.js("() => { const d = APP.shadowRoot.querySelector('free-dialogo-testo-colonne'); return !!d && d.shadowRoot.querySelectorAll('.anteprima tr').length === 2; }"))
    pr.ombra('free-dialogo-testo-colonne', 'button[data-azione=\"dividi\"]'); pg.wait_for_timeout(800)
    riga = [pr.cella(10, c) for c in range(1, 4)]
    esito('il testo è diviso in tre colonne e «1,5» diventa un numero', riga == ['Rossi', 'Mario', '1.5'], riga)

    # 2. pagina, anteprima, stampa
    pr.menu('page-setup')
    pr.ombra('free-dialogo-imposta-pagina', 'input[data-campo=\"orizzontale\"]'); pg.wait_for_timeout(200)
    pr.ombra('free-dialogo-imposta-pagina', 'button[data-azione=\"ok\"]'); pg.wait_for_timeout(500)
    esito('Imposta pagina: OK salva l’orientamento orizzontale', pr.js("() => GR.paginaAttiva().orientamento") == 'orizzontale')
    pr.menu('print-preview'); pg.wait_for_timeout(500)
    ant = pr.js("() => { const a = APP.shadowRoot.querySelector('.anteprima'); return a ? [a.querySelectorAll('.stampa-pagina').length, a.querySelector('[data-campo=\"conta-pagine\"]').textContent] : null; }")
    esito('Anteprima di stampa mostra le pagine', bool(ant) and ant[0] >= 1, ant)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pr.js("() => { window.__stampa = null; window.print = () => { window.__stampa = [document.getElementById('pmb-sheets-pagina-stampa')?.textContent || '', APP.shadowRoot.querySelectorAll('.stampa .stampa-pagina').length]; }; }")
    pr.menu('print'); pg.wait_for_timeout(800)
    st = pr.js("() => window.__stampa")
    esito('Stampa: la pagina è A4 orizzontale e ci sono le pagine', bool(st) and '297mm 210mm' in st[0] and st[1] >= 1, st)
    pdf = os.path.join(CARTELLA, 'foglio stampa.pdf')
    if os.path.exists(pdf): os.remove(pdf)
    pr.menu('download-pdf')
    d = scegli_nel_dialogo(pr.p.pid, pdf)
    esito('Scarica come PDF usa la finestra «Salva con nome» di Windows', d is not None, d)
    time.sleep(1.0)
    contenuto = open(pdf, 'rb').read() if os.path.exists(pdf) else b''
    esito('il PDF è scritto, orizzontale, con i valori', contenuto.startswith(b'%PDF-1.4') and b'841.89 595.28' in contenuto and b'(Rossi) Tj' in contenuto, len(contenuto))

    # 5. chiusura vera (WM_CLOSE)
    principale = finestre(pr.p.pid, dialogo=False)
    domanda = lambda: pr.js("() => { const d = APP.shadowRoot.querySelector('free-dialogo-conferma'); return d ? Array.from(d.shadowRoot.querySelectorAll('button[data-scelta]')).map(b => b.dataset.scelta) : null; }")
    esito('trovata la finestra del programma', bool(principale), principale)
    if principale:
        u32.PostMessageW(principale[0][0], 0x0010, 0, 0); pg.wait_for_timeout(1200)
        scelte = domanda()
        esito('chiudendo con modifiche chiede Salva / Non salvare / Annulla', scelte == ['salva', 'esci', 'annulla'], scelte)
        pr.ombra('free-dialogo-conferma', 'button[data-scelta=\"annulla\"]'); pg.wait_for_timeout(500)
        esito('Annulla: il programma resta aperto', pr.p.poll() is None and domanda() is None)
        u32.PostMessageW(principale[0][0], 0x0010, 0, 0); pg.wait_for_timeout(1200)
        esito('una seconda X subito dopo chiede di nuovo (non chiude senza domande)', pr.p.poll() is None and domanda() is not None)
        try: pr.ombra('free-dialogo-conferma', 'button[data-scelta=\"esci\"]')
        except Exception: pass
        time.sleep(2.5)
        esito('Non salvare chiude il programma', pr.p.poll() is not None)
    esito('nessun errore nella pagina', not pr.errori, pr.errori[:3])

# ---------------------------------------------------------------- 3: Apri con la finestra di Windows, poi Salva sul posto
xlsx = os.path.join(CARTELLA, 'conti à.xlsx')
wb = openpyxl.Workbook(); wb.active['A1'] = 'dal file'; wb.active['B1'] = 7; wb.save(xlsx)
with Programma(9742) as pr:
    pg = pr.pg
    pr.menu('open-file')
    d = scegli_nel_dialogo(pr.p.pid, xlsx)
    esito('File › Apri mostra la finestra di Windows', d is not None, d)
    pg.wait_for_timeout(800)
    esito('il file scelto si apre', pr.cella(1, 1) == 'dal file', pr.cella(1, 1))
    pr.metti([['cambiato', '8']])
    prima = os.path.getmtime(xlsx)
    pr.menu('save-file'); time.sleep(2.0)
    esito('Salva non apre nessuna finestra «Salva con nome»', not finestre(pr.p.pid), finestre(pr.p.pid))
    letto = openpyxl.load_workbook(xlsx).active
    esito('Salva ha riscritto il file .xlsx sul disco', os.path.getmtime(xlsx) > prima and letto['A1'].value == 'cambiato' and letto['B1'].value == 8, (letto['A1'].value, letto['B1'].value))
    esito('nessun file temporaneo lasciato accanto', not any(f.endswith('.pmb-salvataggio') for f in os.listdir(CARTELLA)), os.listdir(CARTELLA))
    esito('nessun errore nella pagina', not pr.errori, pr.errori[:3])

# ---------------------------------------------------------------- 4: avvio con un file, poi Salva sul posto
avvio = os.path.join(CARTELLA, 'avvio.xlsx')
wb = openpyxl.Workbook(); wb.active['A1'] = 'avvio'; wb.save(avvio)
with Programma(9743, [avvio]) as pr:
    pg = pr.pg; pg.wait_for_timeout(1500)
    esito('un file passato all’avvio si apre', pr.cella(1, 1) == 'avvio', pr.cella(1, 1))
    pr.metti([['avvio salvato']])
    pr.menu('save-file'); time.sleep(2.0)
    esito('Salva sul file di avvio non apre finestre', not finestre(pr.p.pid), finestre(pr.p.pid))
    esito('Salva ha riscritto il file di avvio sul posto', openpyxl.load_workbook(avvio).active['A1'].value == 'avvio salvato')

print(f"== giro_46: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
