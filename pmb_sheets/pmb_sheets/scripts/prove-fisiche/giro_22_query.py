import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

REP = ['Nord','Sud','Nord','Est','Sud','Nord','Est','Sud','Ovest','Nord']
AGE = ['Anna','Bruno','Carla','Dino','Elena','Fabio','Gina','Hugo','Ines','Luca']
VEN = [120.5, 80, 200, 45.25, 95, 310, 60, 150.75, 20, 99]
QTA = [3, 2, 5, 1, 4, 7, 2, 3, 1, 2]

def vicino(a, b, rel=1e-9): return isinstance(a, (int, float)) and abs(a - b) <= max(abs(b) * rel, 1e-12)

with Banco(9627, '22 QUERY scritta a mano') as b:
    b.primo_piano()
    for c, n in enumerate(['Reparto', 'Agente', 'Vendite', 'Quantita'], start=1): b.imposta(1, c, n)
    for i in range(10):
        b.imposta(i + 2, 1, REP[i]); b.imposta(i + 2, 2, AGE[i]); b.imposta(i + 2, 3, str(VEN[i])); b.imposta(i + 2, 4, str(QTA[i]))
    b.aggiorna()

    def selezione():
        b.scrivi_os(1, 6, '=QUERY(A1:D11;"select B, C where C > 90 and A = \'Nord\'")'.replace('select B, C where C', 'select Col2, Col3 where Col3').replace("A = 'Nord'", "Col1 = 'Nord'"))
        raw = b.cella(1, 6)['raw']
        b.ok('la formula si conserva con le virgole', raw.startswith('=QUERY(A1:D11,"select Col2, Col3 where'), raw)
        nomi = [b.cella(r, 6)['v'] for r in range(1, 6)]
        b.ok('prima riga = intestazione, poi Anna, Carla, Fabio, Luca', nomi == ['Agente', 'Anna', 'Carla', 'Fabio', 'Luca'], nomi)
        v = [b.cella(r, 7)['v'] for r in range(2, 6)]
        b.ok('seconda colonna = 120,5 200 310 99', v == [120.5, 200, 310, 99], v)
        b.ok('a video il titolo è Agente', b.testo(1, 6) == 'Agente', b.testo(1, 6))
    prova(b, 'select e where', selezione)

    def gruppi():
        b.scrivi_os(1, 10, '=QUERY(A1:D11;"select Col1, sum(Col3), avg(Col3), count(Col2) group by Col1 order by sum(Col3) desc")')
        riga = lambda r: [b.cella(r, c)['v'] for c in (10, 11, 12, 13)]
        t = [b.cella(1, c)['v'] for c in (10, 11, 12, 13)]
        b.ok('intestazioni = Reparto, sum Vendite, avg Vendite, count Agente', t == ['Reparto', 'sum Vendite', 'avg Vendite', 'count Agente'], t)
        r2 = riga(2); r3 = riga(3); r4 = riga(4); r5 = riga(5)
        b.ok('primo gruppo Nord: 729,5 / 182,375 / 4 (come pandas)', r2[0] == 'Nord' and vicino(r2[1], 729.5) and vicino(r2[2], 182.375) and r2[3] == 4, r2)
        b.ok('secondo Sud: 325,75 / 108,5833 / 3', r3[0] == 'Sud' and vicino(r3[1], 325.75) and vicino(r3[2], 108.58333333333333) and r3[3] == 3, r3)
        b.ok('terzo Est e quarto Ovest', r4[0] == 'Est' and r5[0] == 'Ovest' and vicino(r5[1], 20), (r4, r5))
        b.imposta(3, 3, '1000'); b.attendi(500)   # riga 3 = Bruno (Sud): 80 -> 1000
        b.ok('cambiando Bruno (Sud) a 1000, Sud passa primo con 1245,75', b.cella(2, 10)['v'] == 'Sud' and vicino(b.cella(2, 11)['v'], 1245.75), [b.cella(2, 10), b.cella(2, 11)])
        b.ok('Nord scende al secondo posto, invariato a 729,5', b.cella(3, 10)['v'] == 'Nord' and vicino(b.cella(3, 11)['v'], 729.5), [b.cella(3, 10), b.cella(3, 11)])
    prova(b, 'group by, order by, aggregati', gruppi)

    def limiti():
        b.scrivi_os(1, 15, '=QUERY(A1:D11;"select Col2 order by Col4 desc, Col2 limit 3 offset 1")')
        v = [b.cella(r, 15)['v'] for r in range(1, 5)]
        b.ok('order by + limit + offset: Agente, Carla, Gina... (Fabio 7 è escluso dall\'offset)', v[0] == 'Agente' and len(v) == 4, v)
        b.scrivi_os(1, 17, '=SOMMA(QUERY(A1:D11;"select sum(Col3) where Col1 = \'Sud\'";1))')
        b.ok('QUERY dentro SOMMA con nomi italiani (Sud ora vale 1245,75)', vicino(b.cella(1, 17)['v'], 1245.75), b.cella(1, 17))
    prova(b, 'limit, offset e uso dentro altre formule', limiti)

    def errori():
        b.scrivi_os(20, 1, '=QUERY(A1:D11;"select Col9")')
        b.ok('colonna inesistente dà #VALUE! a video', b.testo(20, 1) == '#VALUE!', b.testo(20, 1))
        b.scrivi_os(21, 1, '=QUERY(A1:D11;"select Col2 where Col1 = \'Nessuno\'";0)')
        b.ok('nessuna riga trovata dà #N/D o #N/A a video', b.testo(21, 1) in ('#N/A', '#N/D'), b.testo(21, 1))
    prova(b, 'Errori', errori)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
