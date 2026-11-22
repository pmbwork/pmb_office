"""Banco di prova fisico per pmb_sheets: avvia il programma installato, lo comanda con il mouse reale e legge il risultato dal disegno."""
import os, subprocess, time, json, traceback
from playwright.sync_api import sync_playwright

# il programma da provare: di serie quello di costruisci-installa-e-prova.ps1; PMB_SHEETS_EXE per quello installato con la suite (Program Files)
EXE = os.environ.get('PMB_SHEETS_EXE', r'C:\Program Files\pmb_office\pmb_sheets\pmb-sheets-shell.exe')
# le impostazioni del programma installato sono quelle dell'utente (tema, dimensioni della finestra): ogni prova le rimette com'erano
def cartella_dati(exe):
    """La stessa scelta del programma (scegli_cartella_dati in src-tauri/src/lib.rs): «data» accanto all'eseguibile se lì si può
    scrivere (copia portatile, C:\\AI_system...), altrimenti %APPDATA%\\com.pmb.sheets (installazione in Programmi)."""
    accanto = os.path.join(os.path.dirname(exe), 'data')
    try:
        os.makedirs(accanto, exist_ok=True)
        prova = os.path.join(accanto, '.prova-scrittura')
        open(prova, 'wb').close(); os.remove(prova)
        return accanto
    except OSError:
        return os.path.join(os.environ['APPDATA'], 'com.pmb.sheets')
IMPOSTAZIONI = os.path.join(cartella_dati(EXE), 'impostazioni.json')
GR = "document.querySelector('free-app').shadowRoot.querySelector('free-sheet-grid')"
APP = "document.querySelector('free-app')"
TMP = os.environ['TEMP']
RISULTATI = os.path.join(TMP, 'giro_risultati.jsonl')

class Banco:
    def __init__(self, porta, sezione):
        self.porta = porta; self.sezione = sezione; self.p = None; self.pw = None; self.pg = None; self.n = {'OK': 0, 'FAIL': 0, 'MANCA': 0, 'NOTA': 0}
    def __enter__(self):
        try: self._impostazioni = open(IMPOSTAZIONI, 'rb').read()
        except OSError: self._impostazioni = None
        env = dict(os.environ)
        env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={self.porta}'
        # un profilo nuovo a ogni giro: una copia di emergenza lasciata da un giro interrotto fermerebbe i controlli del recupero (giro_13)
        env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(TMP, f'pmb_giro_{self.porta}_{int(time.time())}')
        self.p = subprocess.Popen([EXE], env=env)
        self.pw = sync_playwright().start()
        for _ in range(60):
            try: b = self.pw.chromium.connect_over_cdp(f'http://127.0.0.1:{self.porta}'); break
            except Exception: time.sleep(0.5)
        self.pg = b.contexts[0].pages[0]; self.pg.set_default_timeout(8000)
        self.pg.wait_for_selector('free-sheet-grid'); self.pg.wait_for_timeout(1500)
        _finestra_di_prova(self)
        # le prove guardano i colori del tema chiaro: lo si mette solo per questa sessione, SENZA salvarlo (secondo argomento false),
        # perché il programma installato e la sua cartella dati sono quelli dell'utente (impostazioni.json)
        self.pg.evaluate("() => { const a = document.querySelector('free-app'); if (a && typeof a.setTheme === 'function') return a.setTheme('light', false); }"); self.pg.wait_for_timeout(300)
        # le prove leggono i testi italiani: l'interfaccia si mette in italiano solo per questa sessione, SENZA salvarlo (con Windows in inglese
        # la lingua «automatica» sceglierebbe l'inglese)
        self.pg.evaluate("() => { const a = document.querySelector('free-app'); if (a && typeof a.applicaLingua === 'function') return a.applicaLingua('it', false); }"); self.pg.wait_for_timeout(300)
        self.errori = []
        self.pg.on('pageerror', lambda e: self.errori.append(str(e)[:200]))
        self.pg.on('console', lambda m: self.errori.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        self.pg.evaluate("() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push([e.violatedDirective, (e.sample || '').slice(0, 120), e.sourceFile, e.lineNumber])); }")
        self.pg.evaluate("""() => { window.__salvati = []; window.print = () => { window.__stampato = (window.__stampato||0)+1; };
          window.showSaveFilePicker = async (o) => ({ createWritable: async () => { const parti = []; return { write: async (b) => { parti.push(new Uint8Array(b instanceof Blob ? await b.arrayBuffer() : b)); }, close: async () => { let n = 0; for (const x of parti) n += x.length; const t = new Uint8Array(n); let k = 0; for (const x of parti) { t.set(x, k); k += x.length; } window.__salvati.push({nome: o.suggestedName, bytes: Array.from(t)}); } }; } });
          window.__aprire = null;
          window.__selettori = 0; window.showOpenFilePicker = async () => { window.__selettori++; if (!window.__aprire) { const e = new Error('annullato'); e.name = 'AbortError'; throw e; } const f = new File([new Uint8Array(window.__aprire.bytes)], window.__aprire.nome); return [{ getFile: async () => f, createWritable: async () => ({ write: async () => {}, close: async () => {} }) }]; }; }""")
        return self
    def __exit__(self, *a):
        try:
            if a[0]: traceback.print_exception(*a)
        finally:
            try: self.pw.stop()
            except Exception: pass
            self.p.kill()
            subprocess.run(['taskkill', '/F', '/IM', 'pmb-sheets-shell.exe'], capture_output=True)
            # le prove (per esempio Visualizza > Tema scuro in giro_03) salvano impostazioni: si rimettono quelle dell'utente
            if getattr(self, '_impostazioni', None) is not None:
                time.sleep(0.5)
                try: open(IMPOSTAZIONI, 'wb').write(self._impostazioni)
                except OSError as e: print(f'ATTENZIONE: impostazioni dell utente non rimesse: {e}', flush=True)
        print(f"== {self.sezione}: OK {self.n['OK']}  FAIL {self.n['FAIL']}  MANCA {self.n['MANCA']}  NOTA {self.n['NOTA']}", flush=True)
        return True

    # ---- esiti
    def esito(self, tipo, nome, dettaglio=''):
        self.n[tipo] += 1
        print(f"{tipo:5} {nome}" + (f"  [{str(dettaglio)[:230]}]" if dettaglio != '' else ''), flush=True)
        with open(RISULTATI, 'a', encoding='utf-8') as f:
            f.write(json.dumps({'sezione': self.sezione, 'tipo': tipo, 'nome': nome, 'dettaglio': str(dettaglio)[:300]}, ensure_ascii=False) + '\n')
    def ok(self, nome, cond, dettaglio=''):
        self.esito('OK' if cond else 'FAIL', nome, '' if cond and dettaglio == '' else dettaglio)
        return bool(cond)
    def manca(self, nome, dettaglio=''): self.esito('MANCA', nome, dettaglio)
    def nota(self, nome, dettaglio=''): self.esito('NOTA', nome, dettaglio)

    # ---- accesso alla pagina
    def js(self, s, a=None): return self.pg.evaluate(s.replace('GR', GR).replace('APP', APP), a)
    def attendi(self, ms=300): self.pg.wait_for_timeout(ms)
    def doc(self): return self.js("() => { const d = GR.getDoc(); return {foglio: d.activeSheetName, sel: [d.selection.anchor.row, d.selection.anchor.col], zoom: GR.zoom, fr: d.freezeRows, fc: d.freezeCols, nascR: [...d.hiddenRows], nascC: [...d.hiddenCols], unioni: d.merges.length}; }")
    def cella(self, r, c, foglio=None):
        return self.js("async ([r,c,f]) => { const d = GR.getDoc(); const x = await d.client.getCell(f || d.activeSheetName, r, c); return {raw: x.raw, v: x.value.kind === 'empty' ? '' : (x.value.kind === 'error' ? x.value.error : x.value.value), k: x.value.kind}; }", [r, c, foglio])
    def imposta(self, r, c, v):
        self.js("async ([r,c,v]) => { const d = GR.getDoc(); await d.client.setCell(d.activeSheetName, r, c, v); }", [r, c, v])
    def aggiorna(self):
        self.js("() => { GR.cellsCache.clear(); GR.updateViewport(); GR.requestUpdate(); }"); self.attendi(350)
    def testo(self, r, c):
        return self.js("""([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`); return t ? t.textContent.trim() : null; }""", [r, c])
    def rect(self, r, c):
        return self.js("""([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`); if (!t) return null; const x = t.getBoundingClientRect(); return {x: x.left, y: x.top, w: x.width, h: x.height}; }""", [r, c])
    def stato_app(self):
        return self.js("() => ({msg: APP.statusMessage, titolo: APP.titolo, fogli: APP.fogli, attivo: APP.foglioAttivo, sidebar: APP.sidebarOpen, tema: document.documentElement.getAttribute('data-theme')})")

    # ---- gesti fisici
    def clic_cella(self, r, c, tasto='left', n=1, modificatori=None):
        x = self.rect(r, c)
        if x is None: raise RuntimeError(f'cella {r},{c} non disegnata')
        if modificatori:
            for m in modificatori: self.pg.keyboard.down(m)
        self.pg.mouse.click(x['x'] + 12, x['y'] + x['h'] / 2, button=tasto, click_count=n)
        if modificatori:
            for m in modificatori: self.pg.keyboard.up(m)
        self.attendi(250)
    def seleziona(self, r1, c1, r2=None, c2=None):
        r2 = r1 if r2 is None else r2; c2 = c1 if c2 is None else c2
        a = self.rect(r1, c1); b = self.rect(r2, c2)
        self.pg.mouse.move(a['x'] + 12, a['y'] + a['h'] / 2); self.pg.mouse.down()
        self.pg.mouse.move(b['x'] + 12, b['y'] + b['h'] / 2, steps=5); self.pg.mouse.up(); self.attendi(250)
    def digita(self, r, c, testo):
        """Scrive in una cella come una persona: clic sulla cella, primo tasto, resto del testo; si conferma cliccando una cella lontana."""
        self.clic_cella(r, c)
        self.pg.keyboard.press(testo[0])
        if len(testo) > 1: self.pg.keyboard.insert_text(testo[1:])
        self.attendi(200)
        self.clic_cella(r + 18, c)
    def menu(self, *percorso):
        """Apre un menu e clicca la voce (anche in un sottomenu) con il mouse vero."""
        top = percorso[0]
        btns = self.pg.locator('free-menubar .menu-btn')
        n = btns.count(); trovato = None
        for i in range(n):
            if ' '.join(btns.nth(i).text_content().split()) == top: trovato = btns.nth(i); break
        if trovato is None: raise RuntimeError(f'menu {top} non trovato')
        trovato.hover(); self.attendi(250)
        for _ in range(8):
            if self.js("() => !!APP.shadowRoot.querySelector('free-menubar').shadowRoot.querySelector('.menu-btn.active')"): break
            self.attendi(150)
        attivo = self.js("() => { const b = APP.shadowRoot.querySelector('free-menubar').shadowRoot.querySelector('.menu-btn.active'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : ''; }")
        if attivo != top:   # con un altro menu aperto basta passarci sopra; altrimenti serve il clic
            trovato.click(); self.attendi(250)
        for livello, voce in enumerate(percorso[1:], start=1):
            sel = '.dropdown-item:not(.sub-item)' if livello == 1 else '.sub-item'
            elementi = self.pg.locator(f'free-menubar {sel}')
            etichette = elementi.evaluate_all("els => els.map(e => { const c = e.cloneNode(true); c.querySelectorAll('.shortcut, .chevron, .submenu').forEach(x => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); })")
            if voce not in etichette: raise RuntimeError(f'voce {voce} non trovata in {percorso}: {etichette}')
            idx = etichette.index(voce)
            if livello < len(percorso) - 1:
                elementi.nth(idx).hover(); self.attendi(250)
            else:
                elementi.nth(idx).click(); self.attendi(350)
    def barra(self, id_):
        self.pg.locator(f'free-toolbar #btn-{id_}').first.click(); self.attendi(300)
    def chiudi_dialoghi(self):
        for _ in range(3):
            self.pg.keyboard.press('Escape'); self.attendi(150)
    def salvati(self):
        return self.js("() => window.__salvati.map(s => ({nome: s.nome, n: s.bytes.length}))")
    def scarica_salvato(self, i, percorso):
        dati = self.js("(i) => window.__salvati[i].bytes", i)
        with open(percorso, 'wb') as f: f.write(bytes(dati))
        return len(dati)
    def errori_pagina(self):
        e = list(self.errori); self.errori.clear()
        try: e += ['CSP ' + json.dumps(x, ensure_ascii=False)[:400] for x in self.pg.evaluate('() => window.__csp.splice(0)')]
        except Exception: pass
        return e


# ---- tastiera e mouse del sistema (SendInput): arrivano alla finestra come se li premesse una persona
import ctypes
from ctypes import wintypes
_u = ctypes.windll.user32
_u.SetProcessDPIAware()
ULONG_PTR = ctypes.c_size_t
class _KI(ctypes.Structure): _fields_ = [('wVk', wintypes.WORD), ('wScan', wintypes.WORD), ('dwFlags', wintypes.DWORD), ('time', wintypes.DWORD), ('dwExtraInfo', ULONG_PTR)]
class _MI(ctypes.Structure): _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG), ('mouseData', wintypes.DWORD), ('dwFlags', wintypes.DWORD), ('time', wintypes.DWORD), ('dwExtraInfo', ULONG_PTR)]
class _HI(ctypes.Structure): _fields_ = [('uMsg', wintypes.DWORD), ('wParamL', wintypes.WORD), ('wParamH', wintypes.WORD)]
class _U(ctypes.Union): _fields_ = [('ki', _KI), ('mi', _MI), ('hi', _HI)]
class _IN(ctypes.Structure): _fields_ = [('type', wintypes.DWORD), ('u', _U)]
VK = {'Invio': 0x0D, 'Tab': 0x09, 'Esc': 0x1B, 'Canc': 0x2E, 'Backspace': 0x08, 'Su': 0x26, 'Giu': 0x28, 'Sinistra': 0x25, 'Destra': 0x27, 'F2': 0x71, 'F4': 0x73,
      'F1': 0x70, 'F3': 0x72, 'F5': 0x74, 'F6': 0x75, 'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B, 'Home': 0x24, 'Fine': 0x23, 'PagSu': 0x21, 'PagGiu': 0x22, 'Ctrl': 0x11, 'Maiusc': 0x10, 'Alt': 0x12, 'Spazio': 0x20, 'Menu': 0x5D}

ESTESI = {0x25, 0x26, 0x27, 0x28, 0x21, 0x22, 0x23, 0x24, 0x2E, 0x2D, 0x5D}   # frecce, Pag.Su/Giù, Home/Fine, Canc, Ins, Menu: vanno inviati come tasti "estesi"

def _invia(vk=0, unicode_=None, su=False):
    i = _IN(); i.type = 1
    if unicode_ is not None:
        i.u.ki = _KI(0, ord(unicode_), 0x0004 | (0x0002 if su else 0), 0, 0)
    else:
        i.u.ki = _KI(vk, _u.MapVirtualKeyW(vk, 0), (0x0002 if su else 0) | (0x0001 if vk in ESTESI else 0), 0, 0)
    _u.SendInput(1, ctypes.byref(i), ctypes.sizeof(i))

def _hwnd_del_programma(pid):
    trovati = []
    CB = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(h, l):
        p = wintypes.DWORD(); _u.GetWindowThreadProcessId(h, ctypes.byref(p))
        if p.value == pid and _u.IsWindowVisible(h) and _u.GetWindowTextLengthW(h) > 0: trovati.append(h)
        return True
    _u.EnumWindows(CB(cb), 0)
    return trovati[0] if trovati else None

class _RECT(ctypes.Structure): _fields_ = [('l', wintypes.LONG), ('t', wintypes.LONG), ('r', wintypes.LONG), ('b', wintypes.LONG)]

def _finestra_di_prova(self):
    """Ogni prova parte con la stessa finestra (di serie 2032 x 1006 pixel, al centro dello schermo; PMB_GIRO_FINESTRA=«larghezza x altezza»
    per un'altra misura), qualunque sia la grandezza salvata nelle impostazioni del programma su cui gira. Con la finestra normale da 1200
    pixel metà della barra va nel menu «Altri strumenti» e le prove che cliccano i pulsanti della barra o le celle a destra non li trovano
    (si è visto il 2026-11-19 sul programma installato in Programmi). La finestra stretta la prova giro_42."""
    w, h = (int(x) for x in os.environ.get('PMB_GIRO_FINESTRA', '2032x1006').lower().split('x'))
    hwnd = None
    for _ in range(20):
        hwnd = _hwnd_del_programma(self.p.pid)
        if hwnd: break
        time.sleep(0.25)
    if not hwnd:
        print('ATTENZIONE: finestra del programma non trovata, resta della grandezza salvata', flush=True); return
    if _u.IsZoomed(hwnd) or _u.IsIconic(hwnd): _u.ShowWindow(hwnd, 9)   # SW_RESTORE: una finestra ingrandita non si ridimensiona
    area = _RECT(); _u.SystemParametersInfoW(0x0030, 0, ctypes.byref(area), 0)   # SPI_GETWORKAREA: lo schermo senza la barra di Windows
    w = min(w, area.r - area.l); h = min(h, area.b - area.t)
    prima = self.pg.evaluate('() => [innerWidth, innerHeight]')
    _u.SetWindowPos(hwnd, 0, area.l + (area.r - area.l - w) // 2, area.t + (area.b - area.t - h) // 2, w, h, 0x0004 | 0x0010)   # SWP_NOZORDER | SWP_NOACTIVATE
    for _ in range(20):
        time.sleep(0.15)
        if self.pg.evaluate('() => [innerWidth, innerHeight]') != prima: break
    self.pg.wait_for_timeout(500)

def _porta_in_primo_piano(self):
    h = _hwnd_del_programma(self.p.pid)
    if not h: return False
    for _ in range(6):
        if _u.IsIconic(h): _u.ShowWindow(h, 9)
        fg = _u.GetForegroundWindow()
        t_fg = _u.GetWindowThreadProcessId(fg, None); t_me = ctypes.windll.kernel32.GetCurrentThreadId()
        if t_fg != t_me: _u.AttachThreadInput(t_me, t_fg, True)
        _u.SetWindowPos(h, -1, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040)   # in cima a tutte (HWND_TOPMOST), senza spostare né ridimensionare
        _u.SetForegroundWindow(h); _u.BringWindowToTop(h)
        _u.SetWindowPos(h, -2, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040)   # e poi torna una finestra normale (HWND_NOTOPMOST)
        if t_fg != t_me: _u.AttachThreadInput(t_me, t_fg, False)
        time.sleep(0.5)
        if _u.GetForegroundWindow() == h: return True
    return False

def _os_testo(self, s, pausa=0.03):
    for ch in s:
        _invia(unicode_=ch); _invia(unicode_=ch, su=True); time.sleep(pausa)
    time.sleep(0.15)

def _os_tasto(self, nome, *modificatori):
    for m in modificatori: _invia(VK[m])
    k = VK.get(nome) or ord(nome.upper())
    _invia(k); _invia(k, su=True)
    for m in reversed(modificatori): _invia(VK[m], su=True)
    time.sleep(0.2)

Banco.primo_piano = _porta_in_primo_piano
Banco.os_testo = _os_testo
Banco.os_tasto = _os_tasto

def _scrivi_os(self, r, c, testo, conferma='Invio'):
    """Clic sulla cella (mouse del browser) e poi scrittura con la tastiera del sistema."""
    self.clic_cella(r, c)
    self.primo_piano()
    self.os_testo(testo)
    self.os_tasto(conferma)
    self.attendi(300)
Banco.scrivi_os = _scrivi_os


def _invia_vk_scan(vk, su=False):
    scan = _u.MapVirtualKeyW(vk, 0)
    i = _IN(); i.type = 1
    i.u.ki = _KI(vk, scan, 0x0008 | (0x0002 if su else 0), 0, 0)   # KEYEVENTF_SCANCODE
    _u.SendInput(1, ctypes.byref(i), ctypes.sizeof(i))

def _os_testo_vk(self, s, pausa=0.05):
    """Scrive lettere, cifre e pochi simboli con i tasti veri (codice di tasto + scansione), come una tastiera fisica."""
    for ch in s:
        if ch.isalpha() or ch.isdigit():
            vk = ord(ch.upper()); maius = ch.isupper()
            if maius: _invia_vk_scan(0x10)
            _invia_vk_scan(vk); _invia_vk_scan(vk, su=True)
            if maius: _invia_vk_scan(0x10, su=True)
        elif ch == ' ': _invia_vk_scan(0x20); _invia_vk_scan(0x20, su=True)
        elif ch == ',': _invia_vk_scan(0xBC); _invia_vk_scan(0xBC, su=True)
        elif ch == '.': _invia_vk_scan(0xBE); _invia_vk_scan(0xBE, su=True)
        else:
            _invia(unicode_=ch); _invia(unicode_=ch, su=True)
        time.sleep(pausa)
    time.sleep(0.15)
Banco.os_testo_vk = _os_testo_vk


# ---- mouse del sistema: un clic vero sposta anche il focus di tastiera sulla pagina
class _POINT(ctypes.Structure): _fields_ = [('x', wintypes.LONG), ('y', wintypes.LONG)]

def _origine_pagina(self):
    h = _hwnd_del_programma(self.p.pid)
    pt = _POINT(0, 0); _u.ClientToScreen(h, ctypes.byref(pt))
    dpr = self.pg.evaluate('window.devicePixelRatio')
    return pt.x, pt.y, dpr

def _clic_os(self, x_css, y_css, tasto='left', doppio=False):
    ox, oy, dpr = _origine_pagina(self)
    px, py = int(ox + x_css * dpr), int(oy + y_css * dpr)
    _u.SetCursorPos(px, py); time.sleep(0.08)
    giu, su = (0x0002, 0x0004) if tasto == 'left' else (0x0008, 0x0010)
    for _ in range(2 if doppio else 1):
        _u.mouse_event(giu, 0, 0, 0, 0); time.sleep(0.04); _u.mouse_event(su, 0, 0, 0, 0); time.sleep(0.08)
    time.sleep(0.25)

def _clic_cella_os(self, r, c, tasto='left', doppio=False):
    # un clic semplice deve selezionare la cella: se Windows l'ha usato solo per attivare la finestra (succede col primo clic dopo l'avvio)
    # o se è andato perso, si riprova (al massimo 3 volte). Doppio clic e tasto destro si fanno una volta sola, come prima.
    for _ in range(3):
        x = self.rect(r, c)
        if x is None: raise RuntimeError(f'cella {r},{c} non disegnata')
        _clic_os(self, x['x'] + 12, x['y'] + x['h'] / 2, tasto, doppio)
        if tasto != 'left' or doppio: return
        sel = self.js("() => { const s = GR.getDoc().selection.anchor; return [s.row, s.col]; }")
        if sel == [r, c]: return

def _scrivi_os2(self, r, c, testo, conferma='Invio'):
    """Clic vero del mouse sulla cella, poi tastiera del sistema (caratteri veri), poi il tasto di conferma."""
    _clic_cella_os(self, r, c)
    self.os_testo(testo, pausa=0.04)
    self.os_tasto(conferma)
    self.attendi(300)

Banco.clic_os = _clic_os
Banco.clic_cella_os = _clic_cella_os
Banco.scrivi_os = _scrivi_os2


def _seleziona_os(self, r1, c1, r2=None, c2=None):
    """Selezione trascinando con il mouse del sistema (sposta anche il focus di tastiera)."""
    r2 = r1 if r2 is None else r2; c2 = c1 if c2 is None else c2
    a = self.rect(r1, c1); b2 = self.rect(r2, c2)
    ox, oy, dpr = _origine_pagina(self)
    def pos(x, y): return int(ox + x * dpr), int(oy + y * dpr)
    _u.SetCursorPos(*pos(a['x'] + 12, a['y'] + a['h'] / 2)); time.sleep(0.08)
    _u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.05)
    passi = 6
    for k in range(1, passi + 1):
        x = a['x'] + 12 + (b2['x'] - a['x']) * k / passi; y = a['y'] + a['h'] / 2 + (b2['y'] - a['y']) * k / passi
        _u.SetCursorPos(*pos(x, y)); time.sleep(0.04)
    _u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.3)
Banco.seleziona_os = _seleziona_os


# ---- comodità comuni ai blocchi di prova
def _in_cima(self):
    self.js("() => { const c = GR.renderRoot.querySelector('.grid-container'); c.scrollTop = 0; c.scrollLeft = 0; GR.getDoc().scroll = {left: 0, top: 0}; GR.updateViewport(); GR.requestUpdate(); }"); self.attendi(500)
Banco.in_cima = _in_cima

def prova(b, nome, fn):
    """Esegue un blocco di verifiche: se salta un'eccezione la registra come FAIL e passa al blocco dopo."""
    try:
        b.in_cima(); fn()
    except Exception as e:
        b.esito('FAIL', nome, 'eccezione: ' + str(e)[:170])
        if os.environ.get('PMB_TRACCIA'): traceback.print_exc()
        try: b.chiudi_dialoghi()
        except Exception: pass

def dialoghi_aperti(b):
    return b.js("() => Array.from(APP.shadowRoot.querySelectorAll('*')).filter(e => e.tagName.startsWith('FREE-DIALOGO')).map(e => e.tagName.toLowerCase())")

def stile_cella(b, r, c, proprieta):
    return b.js("([r,c,p]) => getComputedStyle(GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`))[p]", [r, c, proprieta])
