import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

# A: frutta, B: numeri; la riga 1 è l'intestazione. Totale dei numeri = 73
DATI = [['Frutta', 'Numero'], ['mela', '5'], ['pera', '12'], ['mela', '7'], ['kiwi', '30'], ['', '1'], ['pera', '18']]
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

def freccia(col): return f"GR.renderRoot.querySelector('th.col-header[aria-colindex=\"{col + 1}\"] .col-filter-btn')"
def casella(valore): return f"{POPUP}.shadowRoot.querySelector('input[type=checkbox][data-valore=\"{valore}\"]')"
def bottone(nome): return f"{POPUP}.shadowRoot.querySelector('button[data-azione=\"{nome}\"]')"
def spuntata(b, valore): return b.js("() => { const c = " + casella(valore) + "; return c ? c.checked : null; }")
def popup_aperto(b): return b.js("() => !!" + POPUP)

def intestazione_riga(r):
    return f"Array.from(GR.renderRoot.querySelectorAll('th.row-header')).find(h => h.textContent.trim() === '{r}')"

def nascondi_riga(b, r, tentativi=6):
    """Tasto destro sul numero di riga e voce 'Nascondi riga' (con il mouse vero)."""
    for _ in range(tentativi):
        p = rett(b, intestazione_riga(r))
        if p is None: return False
        L._clic_os(b, p[0] + 15, p[1] + p[3] / 2, tasto='right'); b.attendi(400)
        v = b.js("() => { const e = Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).find(x => x.textContent.trim() === 'Nascondi riga'); if (!e) return null; const x = e.getBoundingClientRect(); return [x.left + 20, x.top + x.height / 2]; }")
        if v is None: continue
        L._clic_os(b, v[0], v[1]); b.attendi(700)
        if r in b.js(NASCOSTE): return True
    return False

def clic_giusto(b, r, c, tentativi=15):
    for _ in range(tentativi):
        b.clic_cella_os(r, c)
        if b.js("() => { const s = GR.getDoc().selection; return [s.anchor.row, s.anchor.col, s.range.endRow - s.range.startRow, s.range.endCol - s.range.startCol]; }") == [r, c, 0, 0]: return True
    return False

def annulla(b):
    """Un clic su una cella lontana dà il fuoco alla griglia, poi Ctrl+Z."""
    clic_giusto(b, 12, 6)
    b.os_tasto('Z', 'Ctrl'); b.attendi(1500)

with Banco(9631, '26 SUBTOTALE e AGGREGA ignorano le righe nascoste') as b:
    b.primo_piano()
    for i, (a, n) in enumerate(DATI, start=1):
        b.imposta(i, 1, a); b.imposta(i, 2, n)
    b.aggiorna()
    b.scrivi_os(1, 4, '=SUBTOTALE(9;B2:B7)')
    b.scrivi_os(2, 4, '=SUBTOTALE(109;B2:B7)')
    b.scrivi_os(3, 4, '=SOMMA(B2:B7)')
    b.scrivi_os(4, 4, '=AGGREGA(9;5;B2:B7)')
    b.scrivi_os(5, 4, '=SUBTOTALE(103;B2:B7)')
    v = lambda r: b.cella(r, 4)['v']

    def senza_nascoste():
        b.ok('senza righe nascoste: 73, 73, 73, 73 e 6 conteggiati', [v(1), v(2), v(3), v(4), v(5)] == [73, 73, 73, 73, 6], [v(r) for r in range(1, 6)])
        b.ok('a video il primo risultato è 73', b.testo(1, 4) == '73', b.testo(1, 4))
    prova(b, 'Punto di partenza', senza_nascoste)

    def a_mano():
        b.ok('"Nascondi riga" sulla riga 4 (valore 7) con il tasto destro', nascondi_riga(b, 4), b.js(NASCOSTE))
        b.attendi(1200)
        r = [v(1), v(2), v(3), v(4), v(5)]
        b.ok('riga nascosta a mano: SUBTOTALE(9) la conta ancora (73)', r[0] == 73, r)
        b.ok('SUBTOTALE(109) la salta (66), AGGREGA(9;5) pure (66), SOMMA no (73)', r[1] == 66 and r[3] == 66 and r[2] == 73, r)
        b.ok('SUBTOTALE(103) conta 5 numeri invece di 6', r[4] == 5, r)
        b.ok('a video il risultato è 66', b.testo(2, 4) == '66', b.testo(2, 4))
        annulla(b)
        r = [v(1), v(2), v(4), v(5)]
        b.ok('Ctrl+Z: la riga torna e tutto torna a 73 (e 6)', b.js(NASCOSTE) == [] and r == [73, 73, 73, 6], (b.js(NASCOSTE), r))
    prova(b, 'Righe nascoste a mano', a_mano)

    def da_filtro():
        b.menu('Dati', 'Crea un filtro'); b.attendi(700)
        b.ok('si apre la finestrella della colonna Frutta', clic_su(b, freccia(1), lambda: popup_aperto(b)))
        b.ok('si toglie la spunta a "mela"', clic_su(b, casella('mela'), lambda: spuntata(b, 'mela') is False))
        b.ok('e a "kiwi"', clic_su(b, casella('kiwi'), lambda: spuntata(b, 'kiwi') is False))
        b.ok('"Applica"', clic_su(b, bottone('applica'), lambda: not popup_aperto(b)))
        b.attendi(1500)
        b.ok('il filtro nasconde le righe 2, 4 e 5', b.js(NASCOSTE) == [2, 4, 5], b.js(NASCOSTE))
        r = [v(1), v(2), v(3), v(4), v(5)]
        b.ok('SUBTOTALE(9) salta le righe del filtro: 12 + 1 + 18 = 31 (anche 109 e AGGREGA)', r[0] == 31 and r[1] == 31 and r[3] == 31, r)
        b.ok('SOMMA ignora il filtro (73) e SUBTOTALE(103) conta 3', r[2] == 73 and r[4] == 3, r)
    prova(b, 'Righe nascoste da un filtro', da_filtro)

    def insieme():
        b.ok('con il filtro acceso, si nasconde a mano anche la riga 3 (valore 12)', nascondi_riga(b, 3), b.js(NASCOSTE))
        b.attendi(1500)
        r = [v(1), v(2), v(4)]
        b.ok('SUBTOTALE(9) conta la riga nascosta a mano ma non quelle del filtro: 31', r[0] == 31, r)
        b.ok('SUBTOTALE(109) e AGGREGA saltano tutte: 31 − 12 = 19', r[1] == 19 and r[2] == 19, r)
        annulla(b)
        r = [v(1), v(2)]
        b.ok('Ctrl+Z della riga nascosta a mano: 109 torna a 31', r == [31, 31], r)
        annulla(b)
        r = [v(1), v(2), v(3)]
        b.ok('Ctrl+Z del filtro: tutto a 73', b.js(NASCOSTE) == [] and r == [73, 73, 73], (b.js(NASCOSTE), r))
    prova(b, 'A mano e da filtro insieme', insieme)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
