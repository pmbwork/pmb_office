import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

DIALOGO = "Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName === 'FREE-DIALOGO-REGOLE')"

def nel_dialogo(sel):
    return f"(() => {{ const d = {DIALOGO}; return d ? d.shadowRoot.querySelector('{sel}') : null; }})()"

def rett(b, js_el):
    return b.js("() => { const e = " + js_el + "; if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")

def clic_su(b, js_el, verifica, tentativi=6):
    for _ in range(tentativi):
        r = rett(b, js_el)
        if r is None: return False
        L._clic_os(b, r[0] + r[2] / 2, r[1] + r[3] / 2)
        b.attendi(300)
        if verifica(): return True
    return False

def imposta_campo(b, campo, valore):
    b.js("([c, v]) => { const d = " + DIALOGO + "; const el = d.shadowRoot.querySelector(`[data-campo=${c}]`); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); }", [campo, valore]); b.attendi(250)

def valore_campo(b, campo):
    return b.js("(c) => { const d = " + DIALOGO + "; const el = d && d.shadowRoot.querySelector(`[data-campo=${c}]`); return el ? el.value : null; }", campo)

aperto = lambda b: b.js("() => !!" + DIALOGO)
regole = lambda b: b.js("() => GR.getDoc().conditionalFormats.map(r => r.type)")
descrizioni = lambda b: b.js("() => { const d = " + DIALOGO + "; return d ? Array.from(d.shadowRoot.querySelectorAll('[data-elenco] .descr')).map(x => x.textContent) : null; }")
barra = lambda b, r: b.js("(r) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"2\"]`); return t ? t.style.backgroundImage : null; }", r)

def apri(b):
    b.seleziona_os(1, 2, 5, 2)
    b.menu('Dati', 'Formattazione condizionale...'); b.attendi(600)
    return aperto(b)

def fine(b):
    return clic_su(b, nel_dialogo('button[data-azione="fine"]'), lambda: not aperto(b))

with Banco(9632, '35 Elenco delle regole (modifica, priorità, elimina) e soglie') as b:
    b.primo_piano()
    for r in range(1, 6):
        b.imposta(r, 2, str(r * 25))   # B: 25..125
    b.aggiorna()
    far = lambda: (b.clic_cella_os(20, 11), b.attendi(300))

    def crea():
        b.ok('apro il dialogo su B1:B5', apri(b))
        b.ok('senza regole l\'elenco non c\'è', descrizioni(b) == [], descrizioni(b))
        imposta_campo(b, 'condizione', 'maggiore'); imposta_campo(b, 'valore1', '50')
        b.ok('Fine aggiunge "Maggiore di 50"', fine(b))
        b.ok('riapro il dialogo', apri(b))
        imposta_campo(b, 'condizione', 'barre')
        imposta_campo(b, 'soglia-max-tipo', 'numero'); imposta_campo(b, 'soglia-max-valore', '250')
        b.ok('Fine aggiunge le barre con il massimo fissato a 250', fine(b))
        far()
        b.ok('ci sono due regole', regole(b) == ['cell_value', 'data_bar'], regole(b))
        # il minimo resta il valore più basso (25): (125 - 25) / (250 - 25) = 44 %
        b.ok('la barra di B5 (125) è al 44 % (massimo 250, minimo il valore più basso, 25)', '44%' in (barra(b, 5) or ''), barra(b, 5))
        sf = b.js("() => getComputedStyle(GR.renderRoot.querySelector('td[data-row=\"5\"][data-col=\"2\"]')).backgroundColor")
        b.ok('B5 ha insieme lo sfondo della prima regola e la barra della seconda', sf and sf.replace(' ', '') == 'rgb(183,225,205)', sf)
    prova(b, 'Creo due regole, una con soglia', crea)

    def priorita():
        b.ok('riapro il dialogo', apri(b))
        b.ok('l\'elenco mostra le due regole in ordine', descrizioni(b) == ['Maggiore di 50', 'Barre dati'], descrizioni(b))
        b.ok('un clic su ↓ della prima la sposta giù', clic_su(b, nel_dialogo('li[data-indice="0"] [data-azione="giu"]'), lambda: regole(b) == ['data_bar', 'cell_value']), regole(b))
        b.ok('il dialogo resta aperto e l\'elenco si aggiorna', aperto(b) and descrizioni(b) == ['Barre dati', 'Maggiore di 50'], descrizioni(b))
    prova(b, 'Cambio la priorità', priorita)

    def modifica():
        b.ok('un clic su ✎ delle barre le carica nel modulo', clic_su(b, nel_dialogo('li[data-indice="0"] [data-azione="modifica"]'), lambda: valore_campo(b, 'condizione') == 'barre'))
        b.ok('la soglia del massimo è quella salvata (numero 250)', valore_campo(b, 'soglia-max-tipo') == 'numero' and valore_campo(b, 'soglia-max-valore') == '250', [valore_campo(b, 'soglia-max-tipo'), valore_campo(b, 'soglia-max-valore')])
        imposta_campo(b, 'soglia-max-valore', '500')
        b.ok('Fine sostituisce la regola', fine(b))
        far()
        b.ok('sempre due regole, nello stesso ordine', regole(b) == ['data_bar', 'cell_value'], regole(b))
        b.ok('la barra di B5 (125) ora è al 21 % ((125 - 25) / (500 - 25))', '21%' in (barra(b, 5) or ''), barra(b, 5))
    prova(b, 'Modifico una regola', modifica)

    def elimina():
        b.ok('riapro il dialogo', apri(b))
        b.ok('un clic su ✕ della prima la elimina', clic_su(b, nel_dialogo('li[data-indice="0"] [data-azione="elimina"]'), lambda: regole(b) == ['cell_value']), regole(b))
        b.ok('l\'elenco ha una sola regola', descrizioni(b) == ['Maggiore di 50'], descrizioni(b))
        b.ok('Annulla chiude il dialogo', clic_su(b, nel_dialogo('button[data-azione="annulla"]'), lambda: not aperto(b)))
        far()
        b.ok('le barre sono sparite dalla griglia', not barra(b, 5), barra(b, 5))
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        b.ok('Ctrl+Z rimette la regola eliminata', regole(b) == ['data_bar', 'cell_value'], regole(b))
        b.ok('e la barra torna', '21%' in (barra(b, 5) or ''), barra(b, 5))
    prova(b, 'Elimino e annullo', elimina)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
