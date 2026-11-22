"""Prova fisica degli strumenti (0.2.12) nel pmb_sheets installato, con il mouse e la tastiera veri: Visualizza › Mostra formule (e Ctrl+`),
Dati › Ricerca obiettivo... (finestra compilata con la tastiera: A1^3-2*A1 = 5 come Excel, poi Ctrl+Z), Strumenti › Mostra precedenti e
Mostra dipendenti (bordi colorati e messaggio), Dati › Subtotali... sulla tabella di Excel (excel_subtotali.py: stesse righe e formule),
poi Ctrl+Z. Uso: python giro_50_strumenti.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def evidenziate(b):
    return b.js("() => GR.formulaRefHighlights.map((h) => [h.r1, h.c1, h.r2, h.c2, h.color])")

with Banco(9650, '50 Strumenti') as b:
    b.primo_piano()

    def formule():
        b.scrivi_os(1, 1, '1'); b.scrivi_os(1, 2, '=A1^3-2*A1'); b.aggiorna()
        b.menu('Visualizza', 'Mostra formule'); b.attendi(500)
        b.ok('Mostra formule: in B1 si vede la formula', b.testo(1, 2) == '=A1^3-2*A1', b.testo(1, 2))
        b.js("() => GR.alternaMostraFormule()"); b.attendi(400)
        b.ok('di nuovo: si vede il risultato', b.testo(1, 2) == '-1', b.testo(1, 2))
    prova(b, 'Mostra formule', formule)

    def obiettivo():
        b.clic_cella_os(1, 2); b.menu('Dati', 'Ricerca obiettivo...'); b.attendi(500)
        d = "APP.shadowRoot.querySelector('free-dialogo-obiettivo').shadowRoot"
        b.ok('la finestra propone B1 come cella con la formula', b.js(f"() => {d}.querySelector('input[data-campo=\"obiettivo\"]').value") == 'B1')
        b.primo_piano(); b.os_testo('5'); b.os_tasto('Tab'); b.os_testo('A1'); b.os_tasto('Invio'); b.attendi(1500)
        a1 = b.cella(1, 1)
        b.ok('A1 trovato come Excel (2,0945…) e B1 vale 5', isinstance(a1['v'], (int, float)) and abs(a1['v'] - 2.094548592299497) < 0.001 and abs(b.cella(1, 2)['v'] - 5) <= 0.001, [a1, b.cella(1, 2)])
        b.ok('il messaggio dice il risultato', 'Ricerca obiettivo' in (b.stato_app()['msg'] or ''), b.stato_app()['msg'])
        b.primo_piano(); b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        b.ok('Ctrl+Z rimette A1 = 1', b.cella(1, 1)['raw'] == '1', b.cella(1, 1))
    prova(b, 'Ricerca obiettivo', obiettivo)

    def tracce():
        b.scrivi_os(2, 1, '=SUM(A1:B1)'); b.aggiorna()
        b.clic_cella_os(2, 1); b.menu('Strumenti', 'Mostra precedenti'); b.attendi(500)
        b.ok('Mostra precedenti di A2: A1:B1 in blu', evidenziate(b) == [[1, 1, 1, 2, '#2563eb']], evidenziate(b))
        b.clic_cella_os(1, 1); b.menu('Strumenti', 'Mostra dipendenti'); b.attendi(800)
        ev = sorted(evidenziate(b))
        b.ok('Mostra dipendenti di A1: B1 e A2 in rosso', ev == [[1, 2, 1, 2, '#dc2626'], [2, 1, 2, 1, '#dc2626']], ev)
        b.ok('il messaggio elenca le celle', 'Dipendenti di A1' in (b.stato_app()['msg'] or ''), b.stato_app()['msg'])
        b.menu('Strumenti', 'Togli le evidenziazioni'); b.attendi(300)
        b.ok('Togli le evidenziazioni', evidenziate(b) == [])
    prova(b, 'Precedenti e dipendenti', tracce)

    def subtotali():
        dati = [['Zona', 'Venditore', 'Importo'], ['Nord', 'Anna', '10'], ['Nord', 'Bruno', '20'], ['Sud', 'Carla', '5'], ['Sud', 'Dario', '7'], ['Sud', 'Elena', '1'], ['Est', 'Fabio', '100']]
        for r, riga in enumerate(dati, start=1):
            for c, v in enumerate(riga, start=1): b.imposta(r, 4 + c, v)
        b.aggiorna()
        b.seleziona_os(1, 5, 7, 7); b.menu('Dati', 'Subtotali...'); b.attendi(500)
        b.ok('la finestra dei subtotali elenca le colonne della tabella', b.js("() => APP.shadowRoot.querySelector('free-dialogo-subtotali').colonne.map((c) => c.nome)") == ['Zona', 'Venditore', 'Importo'])
        b.js("() => APP.shadowRoot.querySelector('free-dialogo-subtotali').shadowRoot.querySelector('button[data-azione=\"applica\"]').click()"); b.attendi(1500)
        attese = {(4, 5): 'Nord Totale', (4, 7): '=SUBTOTAL(9,G2:G3)', (8, 5): 'Sud Totale', (8, 7): '=SUBTOTAL(9,G5:G7)', (10, 5): 'Est Totale', (10, 7): '=SUBTOTAL(9,G9:G9)', (11, 5): 'Totale complessivo', (11, 7): '=SUBTOTAL(9,G2:G9)'}
        trovate = {k: b.cella(*k)['raw'] for k in attese}
        b.ok('le righe dei subtotali come Excel (Range.Subtotal)', trovate == attese, trovate)
        b.ok('i totali: 30, 13, 100, 143', [b.cella(r, 7)['v'] for r in (4, 8, 10, 11)] == [30, 13, 100, 143], [b.cella(r, 7)['v'] for r in (4, 8, 10, 11)])
        b.primo_piano(); b.os_tasto('Z', 'Ctrl'); b.attendi(800)
        b.ok('Ctrl+Z toglie tutte le righe dei subtotali', b.cella(4, 5)['raw'] == 'Sud' and b.cella(8, 5)['raw'] == '', [b.cella(4, 5), b.cella(8, 5)])
    prova(b, 'Subtotali', subtotali)

    b.ok('nessun errore nella pagina', len(b.errori_pagina()) == 0, b.errori_pagina()[:3])
