import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

NASCOSTE = "() => Array.from(GR.getDoc().hiddenRows).sort((a, b) => a - b)"
POPUP = "GR.renderRoot.querySelector('free-filtro-colonna')"

def rett(b, js_el):
    return b.js("() => { const e = " + js_el + "; if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")

def clic_su(b, js_el, verifica, tentativi=8):
    for _ in range(tentativi):
        r = rett(b, js_el)
        if r is None: return False
        L._clic_os(b, r[0] + r[2] / 2, r[1] + r[3] / 2)
        b.attendi(300)
        if verifica(): return True
    return False

freccia = lambda col: f"GR.renderRoot.querySelector('th.col-header[aria-colindex=\"{col + 1}\"] .col-filter-btn')"
dentro = lambda sel: f"({POPUP} ? {POPUP}.shadowRoot.querySelector('{sel}') : null)"
popup_aperto = lambda b: b.js("() => !!" + POPUP)
spuntata = lambda b, sel: b.js("() => { const c = " + dentro(sel) + "; return c ? c.checked : null; }")
def togli(b, valore):
    sel = f'input[type=checkbox][data-valore="{valore}"]'
    return clic_su(b, dentro(sel), lambda: spuntata(b, sel) is False)
area = lambda b: b.js("() => { const a = GR.getDoc().filterArea; return a ? [a.startRow, a.endRow, a.startCol, a.endCol] : null; }")
frecce = lambda b: b.js("() => Array.from(GR.renderRoot.querySelectorAll('th.col-header')).filter(th => th.querySelector('.col-filter-btn')).map(th => Number(th.getAttribute('aria-colindex')) - 1)")

DATI = [(1, 1, 'Spese di novembre'), (4, 2, 'Voce'), (4, 3, 'Importo'),
        (5, 2, 'affitto'), (5, 3, '700'), (6, 2, 'luce'), (6, 3, '60'), (7, 2, 'gas'), (7, 3, '45'),
        (8, 2, 'luce'), (8, 3, '55'), (9, 2, 'acqua'), (9, 3, '20'), (11, 2, 'note')]

with Banco(9632, '39 Filtro su una tabella che non parte dalla riga 1') as b:
    b.primo_piano()
    for r, c, v in DATI: b.imposta(r, c, v)
    b.aggiorna()

    def crea():
        b.clic_cella_os(6, 2); b.attendi(200)
        b.menu('Dati', 'Crea un filtro'); b.attendi(600)
        b.ok('da una cella della tabella il filtro prende B4:C9 (intestazione in riga 4)', area(b) == [4, 9, 2, 3], area(b))
        b.ok('le frecce ▼ sono solo sulle colonne B e C', frecce(b) == [2, 3], frecce(b))
    prova(b, 'Crea un filtro sulla tabella', crea)

    def filtra():
        b.ok('la freccia della colonna B apre la finestrella', clic_su(b, freccia(2), lambda: popup_aperto(b)))
        nomi = b.js("() => { const p = " + POPUP + "; return p ? Array.from(p.shadowRoot.querySelectorAll('input[type=checkbox][data-valore]')).map(i => i.dataset.valore) : null; }")
        b.ok('i valori sono quelli della tabella (non il titolo, l\'intestazione o "note")', sorted(nomi or []) == ['acqua', 'affitto', 'gas', 'luce'], nomi)
        for v in ['acqua', 'affitto', 'gas']:
            b.ok(f'tolgo "{v}"', togli(b, v))
        b.ok('Applica', clic_su(b, dentro('button[data-azione="applica"]'), lambda: not popup_aperto(b)))
        h = b.js(NASCOSTE)
        b.ok('restano le due righe "luce": nascoste 5, 7, 9 (titolo, intestazione e "note" restano)', h == [5, 7, 9], h)
    prova(b, 'Filtro una colonna', filtra)

    def ordina():
        b.ok('riapro la finestrella della colonna C', clic_su(b, freccia(3), lambda: popup_aperto(b)))
        b.ok('"Ordina A → Z" sulla colonna C chiude la finestrella', clic_su(b, dentro('button[data-azione="ordina-az"]'), lambda: not popup_aperto(b)))
        b.attendi(500)
        v = [b.cella(r, 3)['raw'] for r in range(5, 10)]
        b.ok('gli importi della tabella sono in ordine crescente (righe 5-9)', v == ['20', '45', '55', '60', '700'], v)
        fuori = [b.cella(1, 1)['raw'], b.cella(4, 2)['raw'], b.cella(11, 2)['raw']]
        b.ok('titolo, intestazione e "note" non si sono mossi', fuori == ['Spese di novembre', 'Voce', 'note'], fuori)
    prova(b, 'Ordino dalla finestrella', ordina)

    def togli_filtri():
        b.clic_cella_os(20, 11); b.attendi(200)
        b.menu('Dati', 'Rimuovi filtri'); b.attendi(600)
        b.ok('Rimuovi filtri: nessuna riga nascosta, nessuna freccia, nessuna area', b.js(NASCOSTE) == [] and frecce(b) == [] and area(b) is None, [b.js(NASCOSTE), frecce(b), area(b)])
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        b.ok('Ctrl+Z rimette il filtro sulla tabella', area(b) == [4, 9, 2, 3] and frecce(b) == [2, 3], [area(b), frecce(b)])
    prova(b, 'Rimuovo e annullo', togli_filtri)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
