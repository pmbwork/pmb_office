"""Prova fisica delle finestre della suite: licenze da accettare, scelta dei collegamenti. Va lanciato con i permessi di amministratore
(la suite li chiede e Windows non lascia comandare una finestra con più permessi). Uso: python prova_suite.py <setup.exe> <scenario> <log>
scenario: senza_desktop | senza_start | tutti"""
import ctypes, ctypes.wintypes as W, subprocess, sys, time, os, json
from PIL import ImageGrab

SETUP, SCENARIO, LOG = sys.argv[1], sys.argv[2], sys.argv[3]
FOTO = os.path.join(os.path.dirname(LOG), f'suite_{SCENARIO}'); os.makedirs(FOTO, exist_ok=True)
u32 = ctypes.windll.user32
u32.SendMessageW.argtypes = [W.HWND, W.UINT, W.WPARAM, W.LPARAM]; u32.SendMessageW.restype = ctypes.c_ssize_t
u32.PostMessageW.argtypes = [W.HWND, W.UINT, W.WPARAM, W.LPARAM]
risultati = []
def scrivi(*a):
    with open(LOG, 'a', encoding='utf-8') as f: f.write(' '.join(str(x) for x in a) + '\n')
def esito(nome, ok, det=''):
    risultati.append((nome, 'OK' if ok else 'FAIL')); scrivi('OK   ' if ok else 'FAIL ', nome, f'[{det}]' if det != '' else '')

def testo(h):
    n = u32.GetWindowTextLengthW(h); b = ctypes.create_unicode_buffer(n + 1); u32.GetWindowTextW(h, b, n + 1); return b.value
def classe(h):
    b = ctypes.create_unicode_buffer(64); u32.GetClassNameW(h, b, 64); return b.value
def finestre_processo(pid):
    out = []
    @ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
    def cb(h, _):
        p = W.DWORD(); u32.GetWindowThreadProcessId(h, ctypes.byref(p))
        if p.value == pid and u32.IsWindowVisible(h): out.append(h)
        return True
    u32.EnumWindows(cb, 0); return out
def figli(h):
    out = []
    @ctypes.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
    def cb(c, _): out.append(c); return True
    u32.EnumChildWindows(h, cb, 0); return out
def visibili(h): return [c for c in figli(h) if u32.IsWindowVisible(c)]
def foto(h, nome):
    r = W.RECT(); u32.GetWindowRect(h, ctypes.byref(r)); time.sleep(0.3)
    ImageGrab.grab((r.left, r.top, r.right, r.bottom), all_screens=True).save(os.path.join(FOTO, nome + '.png'))
BM_CLICK, BM_GETCHECK = 0x00F5, 0x00F0
def pulsante(h, id_): return u32.GetDlgItem(h, id_)
def clic(h): u32.SendMessageW(h, BM_CLICK, 0, 0)

class INPUT(ctypes.Structure):
    class _U(ctypes.Union):
        class KI(ctypes.Structure): _fields_ = [('wVk', W.WORD), ('wScan', W.WORD), ('dwFlags', W.DWORD), ('time', W.DWORD), ('extra', ctypes.c_size_t)]
        class MI(ctypes.Structure): _fields_ = [('dx', W.LONG), ('dy', W.LONG), ('data', W.DWORD), ('dwFlags', W.DWORD), ('time', W.DWORD), ('extra', ctypes.c_size_t)]
        _fields_ = [('ki', KI), ('mi', MI)]
    _anonymous_ = ('u',); _fields_ = [('type', W.DWORD), ('u', _U)]
def tasto(vk):
    for fl in (0, 2):
        i = INPUT(type=1); i.ki.wVk = vk; i.ki.dwFlags = fl; u32.SendInput(1, ctypes.byref(i), ctypes.sizeof(INPUT)); time.sleep(0.05)
def clic_mouse(x, y):
    u32.SetCursorPos(x, y); time.sleep(0.1)
    for fl in (2, 4):
        i = INPUT(type=0); i.mi.dwFlags = fl; u32.SendInput(1, ctypes.byref(i), ctypes.sizeof(INPUT)); time.sleep(0.05)
def in_fondo(edit, nome):
    # fuoco sul testo e Ctrl+Fine con la tastiera vera: si vede l'ultima riga del testo
    io = ctypes.windll.kernel32.GetCurrentThreadId(); lui = u32.GetWindowThreadProcessId(main, None)
    u32.AttachThreadInput(io, lui, True); u32.SetForegroundWindow(main); u32.SetFocus(edit); u32.AttachThreadInput(io, lui, False); time.sleep(0.3)
    i = INPUT(type=1); i.ki.wVk = 0x11; u32.SendInput(1, ctypes.byref(i), ctypes.sizeof(INPUT))
    tasto(0x23)
    i = INPUT(type=1); i.ki.wVk = 0x11; i.ki.dwFlags = 2; u32.SendInput(1, ctypes.byref(i), ctypes.sizeof(INPUT)); time.sleep(0.6)
    foto(main, nome)
p = subprocess.Popen([SETUP])
# 1. la lingua
for _ in range(60):
    w = finestre_processo(p.pid)
    if w: break
    time.sleep(0.5)
lingua = w[0]; scrivi('finestra lingua:', testo(lingua))
if os.environ.get('LINGUA_SUITE') == 'it' or SCENARIO == 'tutti':
    combo = [c for c in figli(lingua) if classe(c) == 'ComboBox'][0]
    for i in range(4):
        u32.SendMessageW(combo, 0x014E, i, 0); time.sleep(0.2)  # CB_SETCURSEL
        if 'Ital' in testo(combo): break
    scrivi('lingua scelta:', testo(combo))
foto(lingua, '0_lingua')
clic(pulsante(lingua, 1)); time.sleep(3)
w = finestre_processo(p.pid); main = w[0]; scrivi('finestra:', testo(main))
avanti = pulsante(main, 1)
def pagina():
    return [(classe(c), testo(c)[:90]) for c in visibili(main) if testo(c).strip()]
def vai(nome):
    prima = pagina()
    for _ in range(5):
        clic(avanti); time.sleep(1.2)
        if pagina() != prima: break
    foto(main, nome); scrivi(nome, pagina())
foto(main, '1_benvenuto'); scrivi('benvenuto', pagina())
# 2. licenza di pmb_office
vai('2_licenza')
casella = [c for c in visibili(main) if classe(c) == 'Button' and (testo(c).startswith('Accetto') or testo(c).startswith('I accept'))]
testo_lic = [c for c in visibili(main) if classe(c).startswith('RichEdit')]
esito('licenza: pagina con il testo e la casella «Accetto»', len(casella) == 1 and len(testo_lic) == 1, pagina())
esito('licenza: Avanti spento finché non si accetta', not u32.IsWindowEnabled(avanti))
in_fondo(testo_lic[0], '2b_licenza_in_fondo')
clic(casella[0]); time.sleep(0.4)
esito('licenza: con la casella spuntata Avanti si accende', bool(u32.IsWindowEnabled(avanti)))
# 3. componenti di terze parti
vai('3_terzi')
casella = [c for c in visibili(main) if classe(c) == 'Button' and (testo(c).startswith('Accetto') or testo(c).startswith('I accept'))]
testo_lic = [c for c in visibili(main) if classe(c).startswith('RichEdit')]
esito('terzi: pagina con il testo e la casella', len(casella) == 1 and len(testo_lic) == 1)
in_fondo(testo_lic[0], '3b_terzi_in_fondo')
esito('terzi: Avanti spento finché non si accetta', not u32.IsWindowEnabled(avanti))
# indietro e avanti: la casella della pagina prima resta spuntata
clic(casella[0]); time.sleep(0.4)
esito('terzi: con la casella spuntata Avanti si accende', bool(u32.IsWindowEnabled(avanti)))
# 4. componenti e collegamenti
vai('4_scelte')
albero = [c for c in visibili(main) if classe(c) == 'SysTreeView32'][0]
TVM_GETNEXTITEM, TVM_SELECTITEM = 0x110A, 0x110B
TVGN_ROOT, TVGN_NEXT, TVGN_CHILD, TVGN_CARET = 0, 1, 4, 9
radici = []; x = u32.SendMessageW(albero, TVM_GETNEXTITEM, TVGN_ROOT, 0)
while x: radici.append(x); x = u32.SendMessageW(albero, TVM_GETNEXTITEM, TVGN_NEXT, x)
gruppo = radici[2]
desktop = u32.SendMessageW(albero, TVM_GETNEXTITEM, TVGN_CHILD, gruppo)
start = u32.SendMessageW(albero, TVM_GETNEXTITEM, TVGN_NEXT, desktop)
esito('scelte: due programmi e il gruppo Collegamenti con Desktop e menu Start', len(radici) == 3 and desktop and start, len(radici))
RIGA = {}
def togli(item):
    # clic vero sul nome della voce (la seleziona e dà il fuoco all'albero), poi Spazio come farebbe una persona
    r = W.RECT(); u32.GetWindowRect(albero, ctypes.byref(r)); h = u32.SendMessageW(albero, 0x111C, 0, 0)  # TVM_GETITEMHEIGHT
    u32.SetForegroundWindow(main); time.sleep(0.3)
    # si sceglie la voce, si mette il fuoco sull'elenco e si preme Spazio con la tastiera vera, come farebbe una persona
    # (il mouse non è affidabile qui: su questo PC lo schermo con la finestra ha un'altra scala)
    u32.SendMessageW(albero, TVM_SELECTITEM, TVGN_CARET, item); time.sleep(0.2)
    io = ctypes.windll.kernel32.GetCurrentThreadId(); lui = u32.GetWindowThreadProcessId(main, None)
    u32.AttachThreadInput(io, lui, True); u32.SetFocus(albero); u32.AttachThreadInput(io, lui, False); time.sleep(0.3)
    scrivi('fuoco sull elenco:', u32.SendMessageW(albero, TVM_GETNEXTITEM, TVGN_CARET, 0) == item)
    prima = u32.SendMessageW(albero, 0x1127, item, 0xF000) >> 12
    for _ in range(3):
        tasto(0x20); time.sleep(0.8)
        if (u32.SendMessageW(albero, 0x1127, item, 0xF000) >> 12) != prima: break
        u32.AttachThreadInput(io, lui, True); u32.SetForegroundWindow(main); u32.SetFocus(albero); u32.AttachThreadInput(io, lui, False); time.sleep(0.4)
RIGA[0] = 0
RIGA[desktop] = 3; RIGA[start] = 4
if SCENARIO == 'senza_desktop': togli(desktop)
if SCENARIO == 'senza_start': togli(start)
foto(main, '4b_scelte_fatte')
stato = lambda it: (u32.SendMessageW(albero, 0x1127, it, 0xF000) >> 12)  # TVM_GETITEMSTATE: 1 = senza spunta, 2 = con spunta
scrivi('spunte Desktop/Start:', stato(desktop), stato(start))
# 5. cartella e installazione
vai('5_cartella')
clic(avanti); scrivi('installazione...')
for _ in range(400):
    time.sleep(1)
    if not u32.IsWindow(main) or p.poll() is not None: break
    if u32.IsWindowEnabled(avanti) and testo(avanti).replace('&', '') in ('Fine', 'Finish', 'Termina', 'Chiudi'): break
foto(main, '6_fine'); scrivi('fine', pagina())
clic(pulsante(main, 1)); p.wait(30)
esito('la suite finisce con codice 0', p.returncode == 0, p.returncode)

DESK = r'C:\Users\Public\Desktop'; START = r'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\pmb_office'
for prog in ('pmb_docs', 'pmb_sheets'):
    d = os.path.exists(os.path.join(DESK, prog + '.lnk')); s = os.path.exists(os.path.join(START, prog + '.lnk'))
    esito(f'{prog}: collegamento sul Desktop {"sì" if SCENARIO != "senza_desktop" else "no"}', d == (SCENARIO != 'senza_desktop'), d)
    esito(f'{prog}: collegamento nel menu Start {"sì" if SCENARIO != "senza_start" else "no"}', s == (SCENARIO != 'senza_start'), s)
    esito(f'{prog}: programma installato', os.path.exists(rf'C:\Program Files\pmb_office\{prog}\{prog.replace("_", "-")}-shell.exe'))
if SCENARIO == 'senza_start': esito('senza menu Start: la cartella pmb_office del menu non resta vuota', not os.path.exists(START))
scrivi('\n=== RIEPILOGO', SCENARIO)
for r in risultati: scrivi(f'  {r[1]:5} {r[0]}')
