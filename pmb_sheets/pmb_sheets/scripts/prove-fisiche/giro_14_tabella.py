import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def clic_giusto(b, r, c, tentativi=15):
    for _ in range(tentativi):
        b.clic_cella_os(r, c)
        if b.js("() => { const s = GR.getDoc().selection.anchor; return [s.row, s.col]; }") == [r, c]: return True
    return False

STILE = "([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); const s = getComputedStyle(t); return {bg: s.backgroundColor, col: s.color, w: s.fontWeight}; }"

with Banco(9614, '14 Inserisci tabella') as b:
    b.primo_piano()
    dati = [['Voce', 'Prezzo', 'Q.tà'], ['caffè', '1,2', '3'], ['tè', '2', '1'], ['latte', '0,9', '5'], ['pane', '1,5', '2']]
    for i, riga in enumerate(dati, start=2):
        for j, v in enumerate(riga, start=2): b.imposta(i, j, v)
    b.imposta(12, 12, 'fuori'); b.aggiorna()
    def crea():
        clic_giusto(b, 4, 3)
        b.menu('Inserisci', 'Tabella'); b.attendi(700)
        msg = b.js("() => APP.statusMessage")
        b.ok('il messaggio dice la zona (B2:D6), non "non disponibile"', 'B2:D6' in msg, msg)
        sel = b.js("() => { const r = GR.getDoc().selection.range; return [r.startRow, r.endRow, r.startCol, r.endCol]; }")
        b.ok('il blocco resta selezionato', sel == [2, 6, 2, 4], sel)
        clic_giusto(b, 12, 12); b.attendi(300)
        h = b.js(STILE, [2, 3]); s1 = b.js(STILE, [3, 3]); s2 = b.js(STILE, [4, 3]); s3 = b.js(STILE, [5, 3])
        b.ok('intestazione blu con testo bianco in grassetto', h['bg'] == 'rgb(26, 115, 232)' and h['col'] == 'rgb(255, 255, 255)' and h['w'] in ('700', 'bold'), h)
        b.ok('righe dati a strisce: azzurrina, bianca, azzurrina', s1['bg'] == 'rgb(232, 240, 254)' and s2['bg'] != s1['bg'] and s3['bg'] == 'rgb(232, 240, 254)', [s1['bg'], s2['bg'], s3['bg']])
        b.nota('testo sulle strisce chiare (tema)', [s1['col'], b.js("() => document.documentElement.getAttribute('data-theme')")])
        b.ok('il testo sulle strisce chiare è scuro (leggibile)', s1['col'] in ('rgb(0, 0, 0)',) or int(s1['col'][4:].split(',')[0]) < 100, s1['col'])
        fuori = b.js(STILE, [12, 12])
        b.ok('la cella lontana non cambia', fuori['bg'] != 'rgb(26, 115, 232)', fuori)
        clic_giusto(b, 4, 3); b.os_tasto('Z', 'Ctrl'); b.attendi(700); clic_giusto(b, 12, 12); b.attendi(300)
        h2 = b.js(STILE, [2, 3])
        b.ok('Ctrl+Z toglie tutto in un colpo', h2['bg'] != 'rgb(26, 115, 232)', h2)
    prova(b, 'Tabella dal menu', crea)
    def vuota():
        clic_giusto(b, 8, 8)
        b.menu('Inserisci', 'Tabella'); b.attendi(500)
        msg = b.js("() => APP.statusMessage")
        b.ok('su una cella vuota dice di selezionare i dati', 'Seleziona i dati' in msg, msg)
    prova(b, 'Cella vuota', vuota)
    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
