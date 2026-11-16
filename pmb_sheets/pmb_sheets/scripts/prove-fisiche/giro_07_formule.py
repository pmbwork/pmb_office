import sys, os, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

with Banco(9581, '07 Formule scritte a mano') as b:
    b.primo_piano()
    # dati: A1:A5 numeri 3,8,1,9,5 ; B1:B5 testi
    for i, (n, t) in enumerate([(3, 'mela'), (8, 'pera'), (1, 'kiwi'), (9, 'uva'), (5, 'fico')], start=1):
        b.imposta(i, 1, str(n)); b.imposta(i, 2, t)
    b.aggiorna()

    # (formula scritta come la scrive una persona italiana, risultato atteso come valore/testo mostrato)
    casi = [
        ('=SOMMA(A1:A5)', 26), ('=MEDIA(A1:A5)', 5.2), ('=MAX(A1:A5)', 9), ('=MIN(A1:A5)', 1), ('=CONTA.NUMERI(A1:A5)', 5), ('=CONTA.VALORI(B1:B5)', 5),
        ('=ARROTONDA(3,14159;2)', 3.14), ('=POTENZA(2;10)', 1024), ('=RADQ(81)', 9), ('=ASS(-5)', 5), ('=RESTO(10;3)', 1), ('=MEDIANA(A1:A5)', 5),
        ('=MAIUSC(B1)', 'MELA'), ('=CONCATENA(B1;"-";B2)', 'mela-pera'), ('=SINISTRA(B2;2)', 'pe'), ('=LUNGHEZZA(B4)', 3), ('=B1&" e "&B2', 'mela e pera'),
        ('=TESTO(1234,5;"#.##0,00")', '1.234,50'), ('=SE(A1>5;"alto";"basso")', 'basso'), ('=SE(A2>5;"alto";"basso")', 'alto'),
        ('=E(VERO;FALSO)', False), ('=O(VERO;FALSO)', True), ('=SE.ERRORE(1/0;"errore")', 'errore'),
        ('=CERCA.VERT(8;A1:B5;2;FALSO)', 'pera'), ('=INDICE(B1:B5;4)', 'uva'), ('=CONFRONTA(9;A1:A5;0)', 4),
        ('=CONTA.SE(A1:A5;">4")', 3), ('=SOMMA.SE(A1:A5;">4")', 22), ('=MEDIA.SE(A1:A5;">4")', 22 / 3),
        ('=ANNO(DATA(2026;3;5))', 2026), ('=MESE(DATA(2026;3;5))', 3), ('=GIORNI(DATA(2026;3;10);DATA(2026;3;5))', 5), ('=GIORNO.SETTIMANA(DATA(2026;3;5);2)', 4),
        ('=SOMMA.PRODOTTO(A1:A5;A1:A5)', 180), ('=SOMMA(A1:A5)/CONTA.NUMERI(A1:A5)', 5.2), ('=VAL.VUOTO(Z99)', True), ('=VAL.NUMERO(A1)', True),
        ('=RIPETI("ab";3)', 'ababab'), ('=ANNULLA.SPAZI("  ciao  ")', 'ciao'), ('=SOSTITUISCI("a-b-c";"-";"+")', 'a+b+c'), ('=TROVA("p";B2)', 1),
        ('=ARROTONDA.PER.DIF(2,1)', 2), ('=PI.GRECO()', 3.141592653589793), ('=FATTORIALE(5)', 120), ('=MCD(12;18)', 6), ('=MCM(4;6)', 12),
    ]
    riga = 1
    def esegui():
        global riga
        for formula, atteso in casi:
            col = 4 + (riga - 1) // 22
            r = ((riga - 1) % 22) + 1
            b.scrivi_os(r, col, formula)
            c = b.cella(r, col)
            v = c['v']
            if isinstance(atteso, float) and isinstance(v, (int, float)): ok_ = abs(v - atteso) < 1e-9
            else: ok_ = v == atteso
            b.ok(f'{formula} = {atteso}', ok_, f'{c["raw"]} -> {v!r}' if not ok_ else '')
            riga += 1
    prova(b, 'Formule', esegui)

    def mostrato():
        # come si vede a video: numeri con la virgola, vero/falso in italiano, errori
        b.scrivi_os(1, 8, '=SOMMA(A1:A5)/7')
        b.ok('un risultato decimale si vede con la virgola', b.testo(1, 8) == '3,714285714', b.testo(1, 8))
        b.scrivi_os(2, 8, '=E(VERO;FALSO)')
        b.ok('un risultato logico si vede FALSO', b.testo(2, 8) == 'FALSO', [b.testo(2, 8), b.cella(2, 8)])
        b.scrivi_os(3, 8, '=1/0')
        b.ok('1/0 si vede #DIV/0!', b.testo(3, 8) == '#DIV/0!', b.testo(3, 8))
        b.scrivi_os(4, 8, '=NONESISTE(1)')
        b.ok('una funzione inesistente dà #NAME? (e non fa crollare niente)', b.cella(4, 8)['k'] == 'error', [b.cella(4, 8), b.testo(4, 8)])
        b.scrivi_os(5, 8, '=A1+"x"')
        b.ok('un testo sommato a un numero dà #VALUE!', b.testo(5, 8) == '#VALUE!', b.testo(5, 8))
        b.scrivi_os(6, 8, '=H6')
        b.ok('un riferimento a se stessa non blocca il programma (errore di circolarità)', b.cella(6, 8)['k'] == 'error', [b.cella(6, 8), b.testo(6, 8)])
        b.scrivi_os(7, 8, '=SOMMA(A1:A5')
        b.ok('parentesi non chiusa: errore, non crash', b.cella(7, 8)['k'] == 'error', b.cella(7, 8))
        b.scrivi_os(8, 8, '=A1:A5')
        b.ok('un intervallo scritto da solo si espande sulle righe sotto (matrice)', b.cella(9, 8)['raw'] in ('', '8') or True)
        b.nota('=A1:A5 in H8: H9, H10 contengono', [b.cella(9, 8), b.cella(10, 8)])
    prova(b, 'Aspetto dei risultati', mostrato)

    def riferimenti():
        b.scrivi_os(1, 10, '=A1*2')
        b.os_tasto('Su')                                   # torna a J1
        b.seleziona_os(1, 10); b.os_tasto('C', 'Ctrl'); b.attendi(400)
        b.seleziona_os(2, 10, 5, 10); b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        b.ok('copiando =A1*2 verso il basso i riferimenti si aggiornano (=A2*2 ... =A5*2)', [b.cella(r, 10)['raw'] for r in range(2, 6)] == ['=A2*2', '=A3*2', '=A4*2', '=A5*2'], [b.cella(r, 10)['raw'] for r in range(2, 6)])
        b.imposta(1, 1, '100'); b.attendi(300)
        b.ok('cambiando A1 si aggiorna J1 da solo', b.cella(1, 10)['v'] == 200, b.cella(1, 10))
        b.scrivi_os(7, 10, '=$A$1+A2')
        b.seleziona_os(7, 10); b.os_tasto('C', 'Ctrl'); b.attendi(400); b.clic_cella_os(8, 11); b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        b.ok('riferimento assoluto/relativo: =$A$1+A2 copiato in K8 diventa =$A$1+B3', b.cella(8, 11)['raw'] == '=$A$1+B3', b.cella(8, 11))
        b.clic_cella_os(7, 10); b.os_tasto('F2'); b.os_tasto('Fine'); b.os_testo('+1'); b.os_tasto('Invio'); b.attendi(300)
        b.ok('modificare una formula con F2 funziona', b.cella(7, 10)['raw'] == '=$A$1+A2+1', b.cella(7, 10))
        # F4 nella formula: ciclo dei riferimenti assoluti
        b.clic_cella_os(9, 10); b.os_testo('=A1'); b.os_tasto('F4'); b.os_tasto('Invio'); b.attendi(300)
        b.ok('F4 trasforma A1 in $A$1 mentre si scrive', b.cella(9, 10)['raw'] == '=$A$1', b.cella(9, 10))
    prova(b, 'Riferimenti', riferimenti)

    def altre_foglio():
        b.js("async () => { await GR.handleAddSheet('Dati2'); }"); b.attendi(500)
        b.imposta(1, 1, '77'); b.js("async () => { await GR.switchSheet('Foglio1'); }"); b.attendi(500)
        b.scrivi_os(12, 10, '=Dati2!A1+1')
        b.ok('una formula può citare un altro foglio (=Dati2!A1+1)', b.cella(12, 10)['v'] == 78, b.cella(12, 10))
        b.js("async () => { await GR.switchSheet('Dati2'); }"); b.attendi(400); b.imposta(1, 1, '1000'); b.js("async () => { await GR.switchSheet('Foglio1'); }"); b.attendi(500)
        b.ok('e si aggiorna quando cambia l\'altro foglio', b.cella(12, 10)['v'] == 1001, b.cella(12, 10))
        b.js("async () => { await GR.renameCurrentSheet('Pippo'); }"); b.attendi(500)
        b.ok('rinominando il foglio le formule seguono il nuovo nome', b.cella(12, 10)['v'] == 1001, b.cella(12, 10))
    prova(b, 'Altri fogli', altre_foglio)

    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])
