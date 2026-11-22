import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

def vicino(a, b, rel=1e-8): return isinstance(a, (int, float)) and abs(a - b) <= max(abs(b) * rel, 1e-12)

with Banco(9626, '21 LAMBDA, MAP, REDUCE, T.TEST scritte a mano') as b:
    b.primo_piano()
    for i, v in enumerate(['1', '2', '3'], start=1): b.imposta(i, 1, v)
    A = [3.2, 4.1, 5.0, 6.3, 7.7, 5.5, 4.9, 6.1]; B = [2.9, 3.8, 5.5, 5.1, 6.9, 4.2, 4.4, 5.8]
    for i in range(8): b.imposta(i + 1, 10, str(A[i])); b.imposta(i + 1, 11, str(B[i]))
    b.aggiorna()

    def lambda_():
        b.scrivi_os(1, 3, '=MAP(A1:A3;LAMBDA(x;x*x))')
        v = [b.cella(r, 3)['v'] for r in (1, 2, 3)]
        b.ok('=MAP(A1:A3;LAMBDA(x;x*x)) si espande in C1:C3 con 1, 4, 9', v == [1, 4, 9], v)
        raw = b.cella(1, 3)['raw']
        b.ok('la formula si conserva con i nomi in inglese e le virgole', raw == '=MAP(A1:A3,LAMBDA(x,x*x))', raw)
        b.scrivi_os(1, 5, '=LET(f;LAMBDA(x;x*2);f(5))')
        b.ok('LET con una LAMBDA richiamata per nome = 10', b.cella(1, 5)['v'] == 10, b.cella(1, 5))
        b.scrivi_os(2, 5, '=LAMBDA(x;x+1)(4)')
        b.ok('LAMBDA chiamata subito = 5', b.cella(2, 5)['v'] == 5, b.cella(2, 5))
        b.scrivi_os(3, 5, '=REDUCE(0;A1:A3;LAMBDA(a;x;a+x))')
        b.ok('REDUCE = 6', b.cella(3, 5)['v'] == 6, b.cella(3, 5))
        b.scrivi_os(1, 7, '=MAKEARRAY(2;2;LAMBDA(r;c;r*10+c))')
        m = [[b.cella(r, c)['v'] for c in (7, 8)] for r in (1, 2)]
        b.ok('MAKEARRAY(2;2;...) riempie G1:H2 con 11, 12, 21, 22', m == [[11, 12], [21, 22]], m)
        b.scrivi_os(1, 9, '=SCAN(0;A1:A3;LAMBDA(a;x;a+x))')
        s = [b.cella(r, 9)['v'] for r in (1, 2, 3)]
        b.ok('SCAN su una colonna dà una colonna: I1:I3 = 1, 3, 6', s == [1, 3, 6], s)
        b.scrivi_os(6, 5, '=SOMMA(MAP(A1:A3;LAMBDA(x;x*10)))')
        b.ok('=SOMMA(MAP(...)) con nomi italiani misti = 60', b.cella(6, 5)['v'] == 60, b.cella(6, 5))
        b.imposta(2, 1, '20'); b.attendi(500)
        v = [b.cella(r, 3)['v'] for r in (1, 2, 3)]
        b.ok('cambiando A2 il risultato di MAP si aggiorna (1, 400, 9)', v == [1, 400, 9], v)
        b.ok('a video la prima cella mostra 1', b.testo(1, 3) == '1', b.testo(1, 3))
    prova(b, 'Funzioni LAMBDA', lambda_)

    def errori():
        b.scrivi_os(10, 5, '=LAMBDA(x;x)')
        b.ok('una LAMBDA sola dà #VALUE! a video', b.testo(10, 5) == '#VALUE!', b.testo(10, 5))
        b.scrivi_os(11, 5, '=LET(f;LAMBDA(x;x);f(1;2))')
        b.ok('troppi argomenti dà #VALUE!', b.testo(11, 5) == '#VALUE!', b.testo(11, 5))
        b.scrivi_os(12, 5, '=LET(f;LAMBDA(g;x;g(g;x));f(f;1))')
        b.ok("una funzione che richiama se stessa all'infinito si ferma con #NUM!", b.testo(12, 5) == '#NUM!', b.testo(12, 5))
    prova(b, 'Errori', errori)

    def ttest():
        b.scrivi_os(1, 13, '=TESTT(J1:J8;K1:K8;2;1)')   # TESTT è T.TEST in Excel italiano (TEST.T è il vecchio TTEST)
        v = b.cella(1, 13)['v']
        b.ok('=TESTT(...; 2; 1) (a coppie) = 0,036951 come scipy', vicino(v, 0.03695147680230186, 1e-7), v)
        b.scrivi_os(2, 13, '=DISTRIB.T.N(1,5;10;VERO)')
        v = b.cella(2, 13)['v']
        b.ok('=DISTRIB.T.N(1,5;10;VERO) = 0,917746', vicino(v, 0.9177463367772799), v)
        b.scrivi_os(3, 13, '=INV.T.2T(0,05;10)')
        v = b.cella(3, 13)['v']
        b.ok('=INV.T.2T(0,05;10) = 2,228138', vicino(v, 2.2281388519862744), v)
        raw = b.cella(1, 13)['raw']
        b.ok('la formula si conserva con il nome inglese', raw == '=T.TEST(J1:J8,K1:K8,2,1)', raw)
        b.ok('a video il risultato ha la virgola', b.testo(2, 13).startswith('0,9177'), b.testo(2, 13))
    prova(b, 'T.TEST e distribuzione t', ttest)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
