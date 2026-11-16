import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

with Banco(9632, '32 Regole con formula (a video, copiate) e Incolla speciale > Trasposto') as b:
    b.primo_piano()
    for r in range(1, 6):
        b.imposta(r, 1, str(r * 10))   # A: 10..50
        b.imposta(r, 4, str(r * 10))   # D: 10..50
    b.js("""() => { GR.addConditionalFormatRule({ id: 'f1', type: 'formula', value1: '=A1>25', style: { backgroundColor: '#ff0000' }, range: { startRow: 1, endRow: 5, startCol: 3, endCol: 3 } });
                    GR.addConditionalFormatRule({ id: 'v1', type: 'cell_value', operator: 'greater_than', value1: 25, style: { backgroundColor: '#ff0000' }, range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 } }); }""")
    b.aggiorna()
    zone = lambda: b.js("() => GR.getDoc().conditionalFormats.map(r => [r.range.startRow, r.range.endRow, r.range.startCol, r.range.endCol, r.type, r.value1])")
    sfondo = lambda r, c: b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); return t ? getComputedStyle(t).backgroundColor : null; }", [r, c])
    rosso = lambda s: s is not None and s.replace(' ', '') == 'rgb(255,0,0)'
    def ctrl(k):
        b.clic_cella_os(20, 11); b.attendi(200)
        b.os_tasto(k, 'Ctrl'); b.attendi(1200)

    def a_video():
        b.ok('la formula =A1>25 colora C3 (A3 = 30) ma non C1 (A1 = 10)', rosso(sfondo(3, 3)) and not rosso(sfondo(1, 3)), [sfondo(3, 3), sfondo(1, 3)])
        b.imposta(1, 1, '99'); b.aggiorna(); b.attendi(300)
        b.ok('cambiando A1 a 99 si colora anche C1', rosso(sfondo(1, 3)), sfondo(1, 3))
        b.imposta(1, 1, '10'); b.aggiorna(); b.attendi(300)
    prova(b, 'regola con formula a video', a_video)

    def copia_formula():
        b.clic_cella_os(1, 3); b.attendi(200)
        for _ in range(4): b.os_tasto('Giu', 'Maiusc')
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 6); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        z = zone()
        b.ok('la regola copiata su F1:F5 cita D1', [1, 5, 6, 6, 'formula', '=D1>25'] in z, z)
        b.ok('a video F3 è rosso (D3 = 30), F1 no (D1 = 10)', rosso(sfondo(3, 6)) and not rosso(sfondo(1, 6)), [sfondo(3, 6), sfondo(1, 6)])
    prova(b, 'copia sposta i riferimenti della formula', copia_formula)

    def trasposto():
        b.clic_cella_os(1, 1); b.attendi(200)
        for _ in range(4): b.os_tasto('Giu', 'Maiusc')
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(10, 8); b.attendi(200)
        b.menu('Modifica', 'Incolla speciale', 'Trasposto'); b.attendi(900)
        z = zone()
        b.ok('la regola di A1:A5 diventa la riga H10:L10', [10, 10, 8, 12, 'cell_value', 25] in z, z)
        b.ok('a video J10 (30) è rosso e H10 (10) no', rosso(sfondo(10, 10)) and not rosso(sfondo(10, 8)), [sfondo(10, 10), sfondo(10, 8)])
        ctrl('Z')
        b.ok('Annulla toglie la regola trasposta', not any(x[0] == 10 for x in zone()), zone())
    prova(b, 'Trasposto porta le regole', trasposto)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
