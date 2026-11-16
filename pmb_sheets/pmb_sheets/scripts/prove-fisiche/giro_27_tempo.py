import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

def secondi_del_giorno(testo):
    h, m, s = [int(x) for x in testo.strip().split(':')]
    return h * 3600 + m * 60 + s

with Banco(9632, '27 ADESSO e OGGI avanzano da soli') as b:
    b.primo_piano()
    b.scrivi_os(1, 1, '=ADESSO()')
    b.scrivi_os(1, 2, '=A1*86400')
    b.scrivi_os(1, 3, '=CASUALE()')
    b.scrivi_os(1, 4, '=OGGI()')
    b.scrivi_os(1, 5, '=ADESSO()-A1')
    b.imposta(3, 1, '5'); b.imposta(3, 2, '=SOMMA(A3:A3)')
    b.aggiorna()
    # la prima cella con il formato Ora, scelto dal menu
    b.clic_cella_os(1, 1)
    b.menu('Formato', 'Numero', 'Ora'); b.attendi(500)
    b.clic_cella_os(9, 3); b.attendi(300)
    snap = lambda: b.js("async () => await GR.getDoc().client.serialize()")
    val = lambda r, c: b.cella(r, c)['v']

    prima = {}
    def avvio():
        prima['ora'] = b.testo(1, 1); prima['v'] = val(1, 1); prima['dip'] = val(1, 2); prima['rand'] = val(1, 3); prima['oggi'] = val(1, 4)
        b.ok('A1 mostra l\'ora come hh:mm:ss', len(prima['ora'].strip().split(':')) == 3, prima['ora'])
        b.ok('B1 = A1 × 86400 (secondi)', abs(prima['dip'] - prima['v'] * 86400) < 1e-3, prima)
        prima['snap'] = snap()
        prima['t'] = time.time()
    prova(b, 'Punto di partenza', avvio)

    def passa_il_tempo():
        # una piccola attesa oltre il minuto: il programma ricalcola ADESSO e OGGI ogni 60 secondi
        resta = 75 - (time.time() - prima['t'])
        if resta > 0: time.sleep(resta)
        b.aggiorna(); b.attendi(500)
        ora_dopo = b.testo(1, 1); v_dopo = val(1, 1)
        # il minuto scatta dall'avvio del programma, non dall'ultima modifica: in 75 secondi c'è almeno un giro, e l'ultimo è avvenuto al massimo 60 secondi fa
        b.ok('senza toccare niente A1 è avanzata (almeno 10 secondi)', (v_dopo - prima['v']) * 86400 >= 10, (v_dopo - prima['v']) * 86400)
        b.ok('e non di più di 100 secondi', (v_dopo - prima['v']) * 86400 <= 100, (v_dopo - prima['v']) * 86400)
        b.ok('a video l\'ora è cambiata', ora_dopo != prima['ora'], (prima['ora'], ora_dopo))
        # B1 = A1 × 86400: deve avanzare (in secondi) quanto A1, non di una soglia fissa (prima: > 50 secondi, mentre A1 può avanzare anche solo di 10)
        avanzata_b1 = val(1, 2) - prima['dip']
        avanzata_a1 = (v_dopo - prima['v']) * 86400
        b.ok('B1 (A1 × 86400) è avanzata con lei, degli stessi secondi', avanzata_b1 >= 10 and abs(avanzata_b1 - avanzata_a1) < 1, (avanzata_a1, avanzata_b1))
        b.ok('E1 (ADESSO() − A1) è dello stesso ordine di grandezza (tutte e due ricalcolate insieme)', abs(val(1, 5) * 86400) < 2, val(1, 5) * 86400)
        b.ok('CASUALE() è rimasto lo stesso numero: un numero a caso non cambia da solo', val(1, 3) == prima['rand'], (prima['rand'], val(1, 3)))
        b.ok('OGGI() è lo stesso giorno (se non è passata la mezzanotte)', val(1, 4) == prima['oggi'] or time.strftime('%H') == '00', (prima['oggi'], val(1, 4)))
        b.ok('il file non risulta modificato: il contenuto salvato è identico', snap() == prima['snap'], 'il testo salvabile è cambiato')
        b.ok('la cella con SOMMA senza ADESSO non si è mossa', val(3, 2) == 5, val(3, 2))
    prova(b, 'Dopo più di un minuto', passa_il_tempo)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
