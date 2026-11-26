"""Guardia delle prove fisiche (2026-11-26): i tasti e i clic veri di Windows (SendInput, mouse_event) partono solo verso il programma in
prova. Un tasto premuto parte solo se la finestra in primo piano è del programma (o di una sua finestra di dialogo); un clic solo se sotto
il puntatore c'è una sua finestra. Altrimenti la prova si ferma con InputFuori invece di scrivere o cliccare nelle finestre dell'utente
(il 21/11 e il 26/11 una prova ha scritto nella finestra della chat). I rilasci passano sempre (niente tasti o pulsanti rimasti premuti),
e così Maiusc da solo, che le prove usano per sbloccare il primo piano e non scrive niente.
Uso: import guardia_prove_fisiche as G; G.proteggi(pid_del_programma)  — vale per tutto il processo (ctypes.windll.user32 è uno solo)."""
import ctypes
import time
from ctypes import wintypes

_u = ctypes.windll.user32
_stato = {'pid': None}
_originale_send = _u.SendInput
_originale_mouse = _u.mouse_event


class InputFuori(RuntimeError):
    """Un tasto o un clic sarebbe andato fuori dal programma in prova: non è stato inviato."""


class _PUNTO(ctypes.Structure):
    _fields_ = [('x', wintypes.LONG), ('y', wintypes.LONG)]


def proteggi(pid):
    _stato['pid'] = pid


def _pid_di(h):
    p = wintypes.DWORD()
    _u.GetWindowThreadProcessId(h, ctypes.byref(p))
    return p.value


def _del_programma(h):
    if not h:
        return False
    radice = _u.GetAncestor(h, 2) or h   # GA_ROOT: la pagina sta in una finestra figlia di WebView2, di un altro processo
    return _pid_di(radice) == _stato['pid'] or _pid_di(_u.GetWindow(radice, 4) or radice) == _stato['pid']   # GW_OWNER: dialoghi


def _primo_piano_ok(attesa=1.0):
    fine = time.time() + attesa
    while True:
        if _del_programma(_u.GetForegroundWindow()):
            return True
        if time.time() >= fine:
            return False
        time.sleep(0.1)


def _send(n, dati, misura):
    if _stato['pid'] is not None:
        voce = getattr(dati, '_obj', None)
        if voce is not None and getattr(voce, 'type', 1) == 1:
            ki = voce.u.ki
            flags = getattr(ki, 'dwFlags', 0)
            vk = getattr(ki, 'wVk', 0)
            rilascio = bool(flags & 0x0002)
            maiusc = vk in (0x10, 0xA0, 0xA1) and not flags & 0x0004
            if not rilascio and not maiusc and not _primo_piano_ok():
                raise InputFuori('tasto NON inviato: la finestra in primo piano non è quella del programma in prova')
    return _originale_send(n, dati, misura)


def _mouse(flags, dx, dy, dati, extra):
    if _stato['pid'] is not None and flags & (0x0002 | 0x0008 | 0x0020 | 0x0800):   # pressioni dei tasti e rotella
        p = _PUNTO()
        _u.GetCursorPos(ctypes.byref(p))
        if not _del_programma(_u.WindowFromPoint(p)):
            raise InputFuori(f'clic NON inviato: in ({p.x}, {p.y}) non c\'è la finestra del programma in prova')
    return _originale_mouse(flags, dx, dy, dati, extra)


_u.SendInput = _send
_u.mouse_event = _mouse
