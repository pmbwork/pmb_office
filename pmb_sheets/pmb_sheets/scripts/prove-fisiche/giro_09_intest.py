import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

def trascina(b, x1, y1, x2, y2):
    ox, oy, dpr = L._origine_pagina(b)
    pos = lambda x, y: (int(ox + x * dpr), int(oy + y * dpr))
    L._u.SetCursorPos(*pos(x1, y1)); time.sleep(0.1)
    L._u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.06)
    for k in range(1, 9):
        L._u.SetCursorPos(*pos(x1 + (x2 - x1) * k / 8, y1 + (y2 - y1) * k / 8)); time.sleep(0.05)
    L._u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.4)

with Banco(9591, '09 Trascinare sulle intestazioni') as b:
    b.primo_piano()
    for r in range(1, 8):
        for c in range(1, 7): b.imposta(r, c, str(r * c))
    b.aggiorna()
    centro = lambda sel: b.js("(s) => { const e = GR.renderRoot.querySelector(s); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }", sel)
    def colonne():
        a = centro('th.col-header[aria-colindex="3"]'); z = centro('th.col-header[aria-colindex="6"]')
        trascina(b, a[0] - 8, a[1], z[0] - 8, z[1])
        s = b.js("() => { const d = GR.getDoc(); return [d.selection.isFullCol, d.selection.range.startCol, d.selection.range.endCol]; }")
        b.ok('trascinando da C a F si selezionano le colonne C:F', s == [True, 2, 5], s)
        evid = b.js("() => Array.from(GR.renderRoot.querySelectorAll('th.col-header.selected-header')).length")
        b.ok('le 4 intestazioni sono evidenziate', evid == 4, evid)
    prova(b, 'Colonne', colonne)
    def righe():
        a = centro('tr[aria-rowindex="4"] th.row-header'); z = centro('tr[aria-rowindex="7"] th.row-header')
        trascina(b, a[0], a[1], z[0], z[1])
        s = b.js("() => { const d = GR.getDoc(); return [d.selection.isFullRow, d.selection.range.startRow, d.selection.range.endRow]; }")
        b.ok('trascinando dalla riga 3 alla 6 si selezionano le righe 3:6', s == [True, 3, 6], s)
    prova(b, 'Righe', righe)
    def clic():
        a = centro('th.col-header[aria-colindex="2"]')
        L._clic_os(b, a[0] - 8, a[1])
        s = b.js("() => { const d = GR.getDoc(); return [d.selection.range.startCol, d.selection.range.endCol]; }")
        b.ok('un clic semplice seleziona una sola colonna', s == [1, 1], s)
        # il ridimensionamento non deve far partire la selezione
        w0 = b.js("() => GR.getDoc().colWidths.get(1) || 0")
        r = b.js("() => { const e = GR.renderRoot.querySelector('th.col-header[aria-colindex=\"2\"] .col-resizer'); const x = e.getBoundingClientRect(); return [x.left + x.width / 2, x.top + x.height / 2]; }")
        trascina(b, r[0], r[1], r[0] + 40, r[1])
        w1 = b.js("() => GR.getDoc().colWidths.get(1) || 0")
        s2 = b.js("() => { const d = GR.getDoc(); return [d.selection.range.startCol, d.selection.range.endCol]; }")
        b.ok('trascinare il bordo allarga la colonna senza cambiare la selezione', w1 > w0 and s2 == [1, 1], [w0, w1, s2])
    prova(b, 'Clic e bordo', clic)
    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
