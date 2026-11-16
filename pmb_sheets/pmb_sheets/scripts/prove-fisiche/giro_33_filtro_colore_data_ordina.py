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
        b.attendi(250)
        if verifica(): return True
    return False

freccia = lambda col: f"GR.renderRoot.querySelector('th.col-header[aria-colindex=\"{col + 1}\"] .col-filter-btn')"
dentro = lambda sel: f"{POPUP}.shadowRoot.querySelector('{sel}')"
bottone = lambda nome: dentro(f"button[data-azione=\"{nome}\"]")
popup_aperto = lambda b: b.js("() => !!" + POPUP)
spuntata = lambda b, sel: b.js("() => { const c = " + dentro(sel) + "; return c ? c.checked : null; }")

def apri(b, col): return clic_su(b, freccia(col), lambda: popup_aperto(b))
def togli(b, sel): return clic_su(b, dentro(sel), lambda: spuntata(b, sel) is False)
def valori_col(b, c): return [b.cella(r, c)['raw'] for r in range(2, 8)]

def serial(a, m, g):
    import datetime
    return str((datetime.date(a, m, g) - datetime.date(1899, 12, 30)).days)

NOMI = ['Nome', 'a', 'b', 'c', 'd', 'e', 'f']
NUM = ['Numero', '5', '12', '7', '30', '1', '18']
DATE = ['Data', serial(2026, 11, 3), serial(2026, 12, 20), serial(2027, 1, 5), 'testo', '', serial(2026, 11, 28)]

with Banco(9632, '33 Filtro per colore e per data, ordinamento dalla finestra') as b:
    b.primo_piano()
    for i in range(7):
        b.imposta(i + 1, 1, NOMI[i]); b.imposta(i + 1, 2, NUM[i]); b.imposta(i + 1, 3, DATE[i])
    b.js("""() => { const d = GR.getDoc(); const m = (r, c, p) => { const k = r + ',' + c; d.styles.cellStyles.set(k, d.styles.registry.merge(d.styles.cellStyles.get(k) || 0, p)); };
                    m(2, 1, {fill: '#ff0000'}); m(4, 1, {fill: '#ff0000'}); m(3, 1, {fill: '#00ff00'});
                    for (const r of [2, 3, 4, 7]) m(r, 3, {numFmt: 'dd/mm/yyyy'}); }""")
    b.aggiorna()
    b.menu('Dati', 'Crea un filtro'); b.attendi(600)

    def colore():
        b.ok('un clic sulla freccia della colonna A apre la finestrella', apri(b, 1))
        sfondi = b.js("() => Array.from(" + POPUP + ".shadowRoot.querySelectorAll('[data-campo=\"colori-sfondo\"] input')).map(i => i.dataset.colore).sort()")
        b.ok('c\'è la lista dei colori di sfondo (nessuno, verde, rosso)', sfondi == ['', '#00ff00', '#ff0000'], sfondi)
        b.ok('tolgo "Nessun colore"', togli(b, 'input[data-colore=""]'))
        b.ok('tolgo il verde', togli(b, 'input[data-colore="#00ff00"]'))
        b.ok('Applica chiude la finestrella', clic_su(b, bottone('applica'), lambda: not popup_aperto(b)))
        h = b.js(NASCOSTE)
        b.ok('restano solo le righe rosse (2 e 4): nascoste 3, 5, 6, 7', h == [3, 5, 6, 7], h)
    prova(b, 'Filtro per colore di sfondo', colore)

    def toglie_colore():
        b.ok('riapro la finestrella', apri(b, 1))
        b.ok('"Rimuovi filtro" toglie il filtro', clic_su(b, bottone('rimuovi'), lambda: not popup_aperto(b)))
        b.ok('le righe tornano visibili', b.js(NASCOSTE) == [], b.js(NASCOSTE))
    prova(b, 'Rimuovere il filtro per colore', toglie_colore)

    def data():
        b.ok('apro la finestrella della colonna C', apri(b, 3))
        anni = b.js("() => Array.from(" + POPUP + ".shadowRoot.querySelectorAll('[data-campo=\"mesi\"] input[data-anno]')).map(i => i.dataset.anno)")
        b.ok('l\'elenco delle date è raggruppato per anno (2026, 2027)', anni == ['2026', '2027'], anni)
        b.ok('tolgo dicembre 2026', togli(b, 'input[data-mese="2026-12"]'))
        b.ok('Applica', clic_su(b, bottone('applica'), lambda: not popup_aperto(b)))
        h = b.js(NASCOSTE)
        b.ok('si nasconde solo la riga di dicembre (3); testo e cella vuota restano', h == [3], h)
        b.ok('apro di nuovo e rimuovo', apri(b, 3) and clic_su(b, bottone('rimuovi'), lambda: not popup_aperto(b)))
    prova(b, 'Filtro per data (anno e mese)', data)

    def ordina():
        b.ok('apro la finestrella della colonna B', apri(b, 2))
        b.ok('"Ordina Z → A" chiude la finestrella', clic_su(b, bottone('ordina-za'), lambda: not popup_aperto(b)))
        b.attendi(500)
        v = valori_col(b, 2)
        b.ok('i numeri sono in ordine decrescente', v == ['30', '18', '12', '7', '5', '1'], v)
        b.ok('l\'intestazione non si è mossa', b.cella(1, 2)['raw'] == 'Numero', b.cella(1, 2))
        nomi = valori_col(b, 1)
        b.ok('le altre colonne seguono (nomi: d, f, b, c, a, e)', nomi == ['d', 'f', 'b', 'c', 'a', 'e'], nomi)
        rosso = b.js("""() => { const t = GR.renderRoot.querySelector('td[data-row="6"][data-col="1"]'); return t ? getComputedStyle(t).backgroundColor : null; }""")
        b.ok('il rosso di "a" è andato con la riga (A6)', rosso is not None and rosso.replace(' ', '') == 'rgb(255,0,0)', rosso)
        b.clic_cella_os(20, 11); b.attendi(200)
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        v = valori_col(b, 2)
        b.ok('Annulla rimette l\'ordine di prima', v == NUM[1:], v)
        b.ok('e il rosso torna in A2', (lambda s: s is not None and s.replace(' ', '') == 'rgb(255,0,0)')(b.js("""() => { const t = GR.renderRoot.querySelector('td[data-row="2"][data-col="1"]'); return t ? getComputedStyle(t).backgroundColor : null; }""")))
    prova(b, 'Ordinare dalla finestrella', ordina)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
