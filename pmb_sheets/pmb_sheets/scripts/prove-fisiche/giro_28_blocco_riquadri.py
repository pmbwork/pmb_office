import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

with Banco(9632, '28 il blocco dei riquadri segue righe e colonne') as b:
    b.primo_piano()
    for r in range(1, 9):
        b.imposta(r, 1, f'r{r}')
        b.imposta(r, 2, f'c{r}')
    b.aggiorna()

    voci = lambda: b.js("() => Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).map(x => x.textContent.trim())")
    def clic_voce(pred):
        r = b.js("(p) => { const e = Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).find(x => { const t = x.textContent.trim(); return p.every(k => t.includes(k)); }); if (!e) return null; const x = e.getBoundingClientRect(); return {x: x.left + 20, y: x.top + x.height/2}; }", pred)
        if r is None: raise RuntimeError('voce non trovata: ' + str(pred) + ' tra ' + str(voci()))
        b.clic_os(r['x'], r['y']); b.attendi(500)
    blocco = lambda: b.js("() => [GR.getDoc().freezeRows, GR.getDoc().freezeCols]")
    def riga_dalla_testata(i):
        return b.js("(i) => { const h = GR.renderRoot.querySelectorAll('th.row-header')[i].getBoundingClientRect(); return [h.left + 15, h.top + 8]; }", i)
    def col_dalla_testata(i):
        return b.js("(i) => { const h = GR.renderRoot.querySelectorAll('th.col-header')[i].getBoundingClientRect(); return [h.left + 20, h.top + 10]; }", i)
    def ctrl(k):
        # un clic su una cella lontana dà il fuoco alla griglia, poi il tasto
        b.clic_cella_os(14, 7); b.attendi(200)
        b.os_tasto(k, 'Ctrl'); b.attendi(1200)

    def parte():
        b.menu('Visualizza', 'Blocca', '2 righe'); b.attendi(400)
        b.menu('Visualizza', 'Blocca', '1 colonna'); b.attendi(400)
        b.ok('blocco di partenza: 2 righe e 1 colonna', blocco() == [2, 1], blocco())
    prova(b, 'Punto di partenza', parte)

    def inserisci_dentro():
        # tasto destro sulla riga 2 (dentro la zona bloccata)
        x, y = riga_dalla_testata(1)
        b.clic_os(x, y, tasto='right'); b.attendi(300)
        clic_voce(['Inserisci', 'sopra'])
        b.ok('inserire una riga dentro la zona bloccata la allarga a 3', blocco()[0] == 3, blocco())
        b.ok('la riga che era la 2 è ora la 3, ancora bloccata', b.cella(3, 1)['raw'] == 'r2', b.cella(3, 1))
        sotto = b.js("() => { const r = GR.renderRoot.querySelectorAll('td.sheet-cell.congela-fondo'); return r.length; }")
        b.ok('il filo di separazione è disegnato sotto la terza riga', sotto > 0, sotto)
        ctrl('Z')
        b.ok('annullando il blocco torna a 2 righe', blocco()[0] == 2, blocco())
        ctrl('Y')
        b.ok('ripetendo torna a 3', blocco()[0] == 3, blocco())
        ctrl('Z')
    prova(b, 'Inserire dentro la zona', inserisci_dentro)

    def inserisci_sotto():
        x, y = riga_dalla_testata(4)
        b.clic_os(x, y, tasto='right'); b.attendi(300)
        clic_voce(['Inserisci', 'sopra'])
        b.ok('inserire una riga sotto la zona bloccata non cambia il blocco', blocco()[0] == 2, blocco())
        ctrl('Z')
    prova(b, 'Inserire sotto la zona', inserisci_sotto)

    def elimina_bloccata():
        x, y = riga_dalla_testata(1)
        b.clic_os(x, y, tasto='right'); b.attendi(300)
        clic_voce(['Elimina', 'riga'])
        b.ok('eliminare una riga bloccata restringe a 1', blocco()[0] == 1, blocco())
        b.ok('la riga 3 è salita al posto della 2', b.cella(2, 1)['raw'] == 'r3', b.cella(2, 1))
        ctrl('Z')
        b.ok('annullando il blocco torna a 2 e la riga è di nuovo lì', blocco()[0] == 2 and b.cella(2, 1)['raw'] == 'r2', [blocco(), b.cella(2, 1)])
    prova(b, 'Eliminare una riga bloccata', elimina_bloccata)

    def colonne():
        x, y = col_dalla_testata(0)
        b.clic_os(x, y, tasto='right'); b.attendi(300)
        clic_voce(['Inserisci', 'sinistra'])
        b.ok('inserire una colonna dentro la zona bloccata la allarga a 2', blocco()[1] == 2, blocco())
        ctrl('Z')
        b.ok('annullando torna a 1', blocco()[1] == 1, blocco())
        x, y = col_dalla_testata(3)
        b.clic_os(x, y, tasto='right'); b.attendi(300)
        clic_voce(['Inserisci', 'sinistra'])
        b.ok('inserire una colonna a destra della zona non cambia il blocco', blocco()[1] == 1, blocco())
        ctrl('Z')
        x, y = col_dalla_testata(0)
        b.clic_os(x, y, tasto='right'); b.attendi(300)
        clic_voce(['Elimina', 'colonna'])
        b.ok('eliminare la colonna bloccata toglie il blocco delle colonne', blocco()[1] == 0, blocco())
        ctrl('Z')
        b.ok('annullando il blocco delle colonne torna a 1', blocco()[1] == 1, blocco())
    prova(b, 'Colonne', colonne)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
