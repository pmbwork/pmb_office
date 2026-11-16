import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

with Banco(9632, '30 Incolla speciale > Solo formato porta le formattazioni condizionali') as b:
    b.primo_piano()
    for r in range(1, 6):
        b.imposta(r, 1, str(r * 10))
        b.imposta(r, 4, str(r * 10))
        b.imposta(r, 6, str(r * 10))        # la destinazione ha già i suoi numeri: "Solo formato" non li tocca
    b.js("""() => GR.addConditionalFormatRule({ id: 'cf1', type: 'cell_value', operator: 'greater_than', value1: 25, style: { backgroundColor: '#ff0000' }, range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 } })""")
    b.aggiorna()
    zone = lambda: b.js("() => GR.getDoc().conditionalFormats.map(r => [r.range.startRow, r.range.endRow, r.range.startCol, r.range.endCol])")
    sfondo = lambda r, c: b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); return t ? getComputedStyle(t).backgroundColor : null; }", [r, c])
    rosso = lambda s: s is not None and s.replace(' ', '') == 'rgb(255,0,0)'
    def ctrl(k):
        b.clic_cella_os(14, 8); b.attendi(200)
        b.os_tasto(k, 'Ctrl'); b.attendi(1200)

    def formato():
        b.clic_cella_os(1, 1); b.attendi(200)
        for _ in range(4): b.os_tasto('Giu', 'Maiusc')
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 6); b.attendi(200)
        b.menu('Modifica', 'Incolla speciale', 'Solo formato'); b.attendi(900)
        b.ok('Solo formato ha portato la regola su F1:F5', [1, 5, 6, 6] in zone() and len(zone()) == 2, zone())
        b.ok('a video F3 (30) è rosso e F1 (10) no', rosso(sfondo(3, 6)) and not rosso(sfondo(1, 6)), [sfondo(3, 6), sfondo(1, 6)])
        b.ok('i valori della destinazione non sono cambiati', b.cella(3, 6)['raw'] == '30' and b.cella(1, 6)['raw'] == '10', [b.cella(3, 6), b.cella(1, 6)])
        ctrl('Z')
        b.ok('Annulla toglie la regola', zone() == [[1, 5, 1, 1]] and not rosso(sfondo(3, 6)), [zone(), sfondo(3, 6)])
        ctrl('Y')
        b.ok('Ripeti la rimette', [1, 5, 6, 6] in zone() and rosso(sfondo(3, 6)), [zone(), sfondo(3, 6)])
    prova(b, 'Solo formato', formato)

    def valori():
        b.clic_cella_os(1, 8); b.attendi(200)
        b.menu('Modifica', 'Incolla speciale', 'Solo valori'); b.attendi(900)
        b.ok('Solo valori non porta la regola su H1:H5', len(zone()) == 2 and [1, 5, 8, 8] not in zone(), zone())
        b.ok('ma i valori sì (H3 = 30)', b.cella(3, 8)['raw'] == '30', b.cella(3, 8))
    prova(b, 'Solo valori', valori)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
