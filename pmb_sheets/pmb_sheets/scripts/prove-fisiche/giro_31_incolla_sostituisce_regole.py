import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

with Banco(9632, '31 Incolla sostituisce le formattazioni condizionali sotto l\'area incollata') as b:
    b.primo_piano()
    for r in range(1, 6):
        b.imposta(r, 1, str(r * 10))   # A: sorgente con regola rossa (> 25)
        b.imposta(r, 4, str(r * 10))   # D: destinazione con regola blu (> 5)
        b.imposta(r, 8, str(r * 10))   # H: seconda sorgente, senza regole
    b.js("""() => { GR.addConditionalFormatRule({ id: 'rossa', type: 'cell_value', operator: 'greater_than', value1: 25, style: { backgroundColor: '#ff0000' }, range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 } });
                    GR.addConditionalFormatRule({ id: 'blu', type: 'cell_value', operator: 'greater_than', value1: 5, style: { backgroundColor: '#0000ff' }, range: { startRow: 1, endRow: 5, startCol: 4, endCol: 4 } }); }""")
    b.aggiorna()
    zone = lambda: b.js("() => GR.getDoc().conditionalFormats.map(r => [r.range.startRow, r.range.endRow, r.range.startCol, r.range.endCol, r.style.backgroundColor])")
    sfondo = lambda r, c: b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); return t ? getComputedStyle(t).backgroundColor : null; }", [r, c])
    colore = lambda s, rgb: s is not None and s.replace(' ', '') == rgb
    ROSSO, BLU = 'rgb(255,0,0)', 'rgb(0,0,255)'
    def ctrl(k):
        b.clic_cella_os(14, 11); b.attendi(200)
        b.os_tasto(k, 'Ctrl'); b.attendi(1200)

    b.ok('prima: D1 è blu (10 > 5)', colore(sfondo(1, 4), BLU), sfondo(1, 4))

    def sostituisce():
        b.clic_cella_os(1, 1); b.attendi(200)
        for _ in range(4): b.os_tasto('Giu', 'Maiusc')
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 4); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        z = zone()
        b.ok('la regola blu sotto D1:D5 è sparita', not any(x[4] == '#0000ff' for x in z), z)
        b.ok('la regola rossa è su D1:D5', [1, 5, 4, 4, '#ff0000'] in z, z)
        b.ok('a video D3 (30) è rosso, D1 (10) non è né rosso né blu', colore(sfondo(3, 4), ROSSO) and not colore(sfondo(1, 4), ROSSO) and not colore(sfondo(1, 4), BLU), [sfondo(3, 4), sfondo(1, 4)])
        ctrl('Z')
        z = zone()
        b.ok('Annulla rimette la regola blu e toglie la rossa da D', any(x[4] == '#0000ff' and x[2] == 4 for x in z) and [1, 5, 4, 4, '#ff0000'] not in z, z)
        b.ok('a video D1 torna blu', colore(sfondo(1, 4), BLU), sfondo(1, 4))
        ctrl('Y')
        b.ok('Ripeti rimette la sostituzione', [1, 5, 4, 4, '#ff0000'] in zone() and not any(x[4] == '#0000ff' for x in zone()), zone())
    prova(b, 'incolla con regole sostituisce quelle della destinazione', sostituisce)

    def sorgente_senza_regole():
        # si riparte: sulla D c'è ora la regola rossa; incollo H1:H2 (senza regole) su D1:D2
        b.clic_cella_os(1, 8); b.attendi(200)
        b.os_tasto('Giu', 'Maiusc')
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 4); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        z = zone()
        b.ok('la regola su D resta solo su D3:D5', [3, 5, 4, 4, '#ff0000'] in z and not any(x[2] == 4 and x[0] <= 2 for x in z), z)
        b.ok('la regola di A non è toccata', [1, 5, 1, 1, '#ff0000'] in z, z)
        b.ok('a video D4 (40) è ancora rosso', colore(sfondo(4, 4), ROSSO), sfondo(4, 4))
    prova(b, 'sorgente senza regole libera la zona incollata', sorgente_senza_regole)

    def solo_valori():
        b.clic_cella_os(1, 1); b.attendi(200)
        for _ in range(4): b.os_tasto('Giu', 'Maiusc')
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 6); b.attendi(200)
        prima = zone()
        b.menu('Modifica', 'Incolla speciale', 'Solo valori'); b.attendi(900)
        b.ok('Solo valori non cambia le regole', zone() == prima, [prima, zone()])
    prova(b, 'Solo valori non tocca le regole', solo_valori)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
