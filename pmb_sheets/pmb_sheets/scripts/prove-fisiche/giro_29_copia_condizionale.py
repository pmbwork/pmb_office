import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

with Banco(9632, '29 la copia porta le formattazioni condizionali') as b:
    b.primo_piano()
    for r in range(1, 6):
        b.imposta(r, 1, str(r * 10))        # 10, 20, 30, 40, 50
        b.imposta(r, 4, str(r * 10))        # stesso elenco in D, senza regola
    b.js("""() => GR.addConditionalFormatRule({ id: 'cf1', type: 'cell_value', operator: 'greater_than', value1: 25, style: { backgroundColor: '#ff0000' }, range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 } })""")
    b.aggiorna()

    zone = lambda: b.js("() => GR.getDoc().conditionalFormats.map(r => [r.range.startRow, r.range.endRow, r.range.startCol, r.range.endCol])")
    sfondo = lambda r, c: b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); return t ? getComputedStyle(t).backgroundColor : null; }", [r, c])
    rosso = lambda s: s is not None and s.replace(' ', '') == 'rgb(255,0,0)'
    def ctrl(k):
        # prima un clic su una cella lontana: dà il fuoco alla griglia
        b.clic_cella_os(14, 8); b.attendi(200)
        b.os_tasto(k, 'Ctrl'); b.attendi(1200)
    def seleziona_intervallo(r1, c1, r2, c2):
        # un clic sull'angolo, poi Maiusc + frecce vere del sistema
        b.clic_cella_os(r1, c1); b.attendi(200)
        for _ in range(r2 - r1): b.os_tasto('Giu', 'Maiusc')
        for _ in range(c2 - c1): b.os_tasto('Destra', 'Maiusc')
        b.attendi(150)

    def partenza():
        b.ok('la regola c\'è e colora i valori sopra 25 nella colonna A', zone() == [[1, 5, 1, 1]] and rosso(sfondo(3, 1)) and not rosso(sfondo(1, 1)), [zone(), sfondo(3, 1), sfondo(1, 1)])
        b.ok('la colonna D, senza regola, non è colorata', not rosso(sfondo(4, 4)), sfondo(4, 4))
    prova(b, 'Punto di partenza', partenza)

    def copia_incolla():
        seleziona_intervallo(1, 1, 5, 1)
        s = b.js("() => { const r = GR.getDoc().selection.range; return [r.startRow, r.endRow, r.startCol, r.endCol]; }")
        b.ok('(preparazione) selezionato A1:A5', s == [1, 5, 1, 1], s)
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 6); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        b.clic_cella_os(14, 8); b.attendi(300)
        b.ok('la copia ha portato la regola sulla zona F1:F5', [1, 5, 6, 6] in zone() and len(zone()) == 2, zone())
        b.ok('a video F3 (30) è rosso', rosso(sfondo(3, 6)), sfondo(3, 6))
        b.ok('a video F1 (10) non è rosso', not rosso(sfondo(1, 6)), sfondo(1, 6))
        b.ok('la regola originale è rimasta dov\'era', [1, 5, 1, 1] in zone() and rosso(sfondo(3, 1)), zone())
    prova(b, 'Copia e incolla', copia_incolla)

    def annulla_e_ripeti():
        ctrl('Z')
        b.ok('Annulla toglie la regola nuova e il rosso di F3', zone() == [[1, 5, 1, 1]] and not rosso(sfondo(3, 6)), [zone(), sfondo(3, 6)])
        ctrl('Y')
        b.ok('Ripeti la rimette', [1, 5, 6, 6] in zone() and rosso(sfondo(3, 6)), [zone(), sfondo(3, 6)])
    prova(b, 'Annulla e ripeti', annulla_e_ripeti)

    def incolla_ancora():
        b.clic_cella_os(1, 6); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        b.clic_cella_os(14, 8); b.attendi(300)
        b.ok('incollare di nuovo sulla stessa zona non accumula regole identiche', len(zone()) == 2, zone())
    prova(b, 'Incolla due volte', incolla_ancora)

    def solo_una_parte():
        seleziona_intervallo(2, 1, 3, 1)
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(8, 3); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        b.clic_cella_os(14, 8); b.attendi(300)
        b.ok('copiando due celle la regola nuova copre solo C8:C9', [8, 9, 3, 3] in zone(), zone())
        b.ok('C8 (20) non è rosso e C9 (30) sì', not rosso(sfondo(8, 3)) and rosso(sfondo(9, 3)), [sfondo(8, 3), sfondo(9, 3)])
    prova(b, 'Una parte soltanto', solo_una_parte)

    def senza_regola():
        prima = zone()
        seleziona_intervallo(1, 4, 5, 4)
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 7); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        b.clic_cella_os(14, 8); b.attendi(300)
        b.ok('copiando celle senza regola non si aggiunge niente', zone() == prima, [prima, zone()])
    prova(b, 'Celle senza regola', senza_regola)

    def taglia():
        b.js("() => GR.getDoc().conditionalFormats.splice(0)")
        b.js("""() => GR.addConditionalFormatRule({ id: 'cf2', type: 'cell_value', operator: 'greater_than', value1: 25, style: { backgroundColor: '#ff0000' }, range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 } })""")
        b.aggiorna()
        seleziona_intervallo(1, 1, 5, 1)
        b.os_tasto('X', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 10); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1500)
        b.clic_cella_os(14, 8); b.attendi(300)
        b.ok('il taglio sposta la regola senza lasciarne una copia', zone() == [[1, 5, 10, 10]], zone())
    prova(b, 'Taglia', taglia)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
