import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

with Banco(9632, '43 Contabilità: simbolo a sinistra, numero a destra') as b:
    b.primo_piano()
    b.imposta(2, 2, '1234.5'); b.imposta(3, 2, '-7'); b.imposta(4, 2, '0'); b.aggiorna()

    def contabilita():
        b.seleziona(2, 2, 4, 2)   # selezione diretta: un trascinamento col mouse può perdere dei passaggi
        b.ok('selezionate le tre celle A2:A4', b.js("() => { const r = GR.getDoc().selection.range; return [r.startRow, r.endRow, r.startCol, r.endCol]; }") == [2, 4, 2, 2])
        b.menu('Formato', 'Numero', 'Contabilità'); b.attendi(700)
        b.clic_cella_os(20, 11); b.attendi(300)
        info = b.js("""() => [2, 3, 4].map((r) => {
            const td = GR.renderRoot.querySelector(`td[data-row="${r}"][data-col="2"]`);
            const parti = td ? Array.from(td.querySelectorAll('.riempimento > span')) : [];
            if (parti.length !== 2) return null;
            const q = td.getBoundingClientRect(), a = parti[0].getBoundingClientRect(), z = parti[1].getBoundingClientRect();
            return {sx: parti[0].textContent.trim(), dx: parti[1].textContent.trim(), spazioSinistra: Math.round(a.left - q.left), spazioDestra: Math.round(q.right - z.right), distanza: Math.round(z.left - a.right)};
        })""")
        b.ok('le tre celle (positivo, negativo, zero) hanno due parti', all(x is not None for x in info), info)
        if all(x is not None for x in info):
            b.ok('il simbolo è «€» a sinistra in tutte e tre', all(x['sx'] == '€' for x in info), [x['sx'] for x in info])
            b.ok('i numeri sono 1.234,50  (7,00)  -', [x['dx'] for x in info] == ['1.234,50', '(7,00)', '-'], [x['dx'] for x in info])
            b.ok('il simbolo sta contro il bordo sinistro, il numero contro il destro, e lo spazio in mezzo cambia con la lunghezza del numero', all(x['spazioSinistra'] < 20 and x['spazioDestra'] < 20 and x['distanza'] > 0 for x in info) and len({x['distanza'] for x in info}) == 3, info)
        testo = b.cella(2, 2)
        b.ok('il valore della cella resta il numero 1234,5 (cambia solo il disegno)', testo['v'] == 1234.5, testo)
    prova(b, 'Contabilità', contabilita)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
