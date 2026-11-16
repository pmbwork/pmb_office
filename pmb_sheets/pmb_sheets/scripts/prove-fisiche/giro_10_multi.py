import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

def ctrl(giu): L._u.keybd_event(0x11, 0x1D, 0 if giu else 2, 0); time.sleep(0.08)

def clic_ctrl(b, r, c, tentativi=15):
    # il puntatore può essere spostato da fuori durante la prova: si ripete finché il clic cade sulla cella giusta
    for _ in range(tentativi):
        prima = b.js("() => { const s = GR.getDoc().selection; return (s.extra ? s.extra.length : 0); }")
        L._clic_os(b, *(lambda x: (x['x'] + 12, x['y'] + x['h'] / 2))(b.rect(r, c)))
        a = b.js("() => { const s = GR.getDoc().selection; return [s.active.row, s.active.col, s.extra ? s.extra.length : 0]; }")
        if a[0] == r and a[1] == c and a[2] == prima + 1: return True
        # clic fuori bersaglio: si torna alla selezione di prima non è possibile, si annulla l'ultimo extra
        b.js("() => { const d = GR.getDoc(); const s = d.selection; if (s.extra && s.extra.length > %d) { s.extra.splice(%d); } }" % (prima, prima))
    return False

def n_sel(b): return b.js("() => { const d = GR.getDoc(); return [d.selection.extra ? d.selection.extra.length : 0, GR.renderRoot.querySelectorAll('td.selected').length]; }")
def stato(b, r, c): return b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); const s = getComputedStyle(t); return [t.classList.contains('selected'), s.fontWeight]; }", [r, c])

with Banco(9592, '10 Selezione multipla con Ctrl+clic') as b:
    b.primo_piano()
    for r in range(1, 7):
        for c in range(1, 5): b.imposta(r, c, str(r * 10 + c))
    b.aggiorna()
    def prova_multi():
        b.clic_cella_os(1, 1)
        ctrl(True); okk = clic_ctrl(b, 3, 3) and clic_ctrl(b, 5, 2); ctrl(False)
        b.nota('clic andati a segno', okk)
        e, n = n_sel(b)
        b.ok('Ctrl+clic su 3 celle: 3 celle evidenziate', n == 3 and e == 2, [e, n])
        st = b.js("() => { const d = GR.getDoc(); return [d.selection.active.row, d.selection.active.col]; }")
        b.ok('la cella attiva è l\'ultima cliccata (5,2)', st == [5, 2], st)
        # formattazione su tutte
        b.os_tasto('B', 'Ctrl'); b.attendi(500)
        b.aggiorna()
        g = [stato(b, 1, 1)[1], stato(b, 3, 3)[1], stato(b, 5, 2)[1], stato(b, 2, 2)[1]]
        b.ok('Ctrl+B (grassetto) vale su tutte e 3 le celle e non sulle altre', g[:3] == ['700'] * 3 and g[3] != '700', g)
        # somma nella barra di stato
        stats = b.js("() => { const s = APP.shadowRoot.querySelector('free-statusbar'); return s ? (s.shadowRoot ? s.shadowRoot.textContent.replace(/\s+/g,' ') : s.textContent) : ''; }")
        b.nota('barra di stato', str(stats)[:200])
        # Canc
        b.os_tasto('Canc'); b.attendi(500)
        v = [b.cella(1, 1)['raw'], b.cella(3, 3)['raw'], b.cella(5, 2)['raw'], b.cella(2, 2)['raw']]
        b.ok('Canc svuota tutte e 3 le celle e non tocca le altre', v == ['', '', '', '22'], v)
        b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        v = [b.cella(1, 1)['raw'], b.cella(3, 3)['raw'], b.cella(5, 2)['raw']]
        b.ok('Ctrl+Z le riporta tutte', v == ['11', '33', '52'], v)
        # clic semplice azzera
        b.clic_cella_os(2, 2)
        e, n = n_sel(b)
        b.ok('un clic semplice torna a una sola cella', n == 1 and e == 0, [e, n])
    prova(b, 'Ctrl+clic', prova_multi)
    def trascina_multi():
        b.clic_cella_os(1, 1)
        ctrl(True)
        L._seleziona_os(b, 3, 3, 4, 4)
        ctrl(False)
        e, n = n_sel(b)
        b.ok('Ctrl+trascina: prima cella + blocco 2x2 = 5 celle', n == 5 and e == 1, [e, n])
    prova(b, 'Ctrl+trascina', trascina_multi)
    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
