import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

DIALOGO = "APP.shadowRoot.querySelector('free-dialogo-regole')"
nel_dialogo = lambda sel: f"({DIALOGO} ? {DIALOGO}.shadowRoot.querySelector('{sel}') : null)"
aperto = lambda b: b.js("() => !!" + DIALOGO)
stato = lambda b: b.js("() => APP.statusMessage")
col = lambda b, c, n=5: [b.cella(r, c)['raw'] for r in range(1, n + 1)]
descrizioni = lambda b: b.js("() => { const d = " + DIALOGO + "; return d ? Array.from(d.shadowRoot.querySelectorAll('[data-elenco] .descr')).map(x => x.textContent) : null; }")

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

def apri(b, r1, c1, r2, c2):
    b.seleziona_os(r1, c1, r2, c2)
    b.menu('Dati', 'Convalida dei dati...'); b.attendi(600)
    return aperto(b)

def fine(b): return clic_su(b, nel_dialogo('button[data-azione="fine"]'), lambda: not aperto(b))

def trascina_maniglia(b, r_fino, c):
    fh = b.js("() => { const r = GR.renderRoot.querySelector('.fill-handle').getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; }")
    t = b.rect(r_fino, c)
    ox, oy, dpr = L._origine_pagina(b)
    u = L._u
    pos = lambda x, y: (int(ox + x * dpr), int(oy + y * dpr))
    u.SetCursorPos(*pos(fh['x'], fh['y'])); time.sleep(0.1); u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.05)
    for k in range(1, 8):
        u.SetCursorPos(*pos(fh['x'], fh['y'] + (t['y'] + t['h'] / 2 - fh['y']) * k / 7)); time.sleep(0.05)
    u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.6)

with Banco(9632, '37 Convalida: incolla, riempimento e elenco delle regole') as b:
    b.primo_piano()
    for r, v in enumerate(['a', 'x', 'b'], start=1):
        b.imposta(r, 1, v)
    b.imposta(1, 4, 'x')
    b.aggiorna()

    def crea():
        b.ok('apro Convalida dei dati su B1:B5', apri(b, 1, 2, 5, 2))
        imposta_campo(b, 'tipo', 'elenco'); imposta_campo(b, 'voci', 'a, b')
        b.ok('Fine crea la convalida "a, b" (rifiuta)', fine(b))
        b.ok('riapro il dialogo su D2:D3', apri(b, 2, 4, 3, 4))
        b.ok('l\'elenco mostra la convalida già scritta', descrizioni(b) == ['Elenco: a, b · rifiuta'], descrizioni(b))
        imposta_campo(b, 'tipo', 'elenco'); imposta_campo(b, 'voci', 'a, b')
        b.ok('Fine crea la stessa convalida su D2:D3', fine(b))
    prova(b, 'Creo due convalide', crea)

    def incolla():
        b.seleziona_os(1, 1, 3, 1)
        b.os_tasto('C', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 2); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        v = col(b, 2, 3)
        b.ok('Ctrl+V: "a" e "b" entrano, "x" no (B2 resta vuota)', v == ['a', '', 'b'], v)
        b.ok('la barra di stato lo dice', 'Incolla: 1 cella non scritta' in (stato(b) or ''), stato(b))
    prova(b, 'Incolla su celle con convalida', incolla)

    def riempi():
        b.clic_cella_os(1, 4); b.attendi(300)
        trascina_maniglia(b, 3, 4)
        v = col(b, 4, 3)
        b.ok('trascinando la maniglia da D1 ("x") le celle con convalida restano vuote', v == ['x', '', ''], v)
        b.ok('la barra di stato lo dice', 'Riempimento: 2 celle non scritte' in (stato(b) or ''), stato(b))
    prova(b, 'Riempimento col mouse', riempi)

    def modifica():
        b.ok('riapro il dialogo', apri(b, 10, 10, 10, 10))
        b.ok('l\'elenco ha una voce sola: la stessa regola su B1:B5 e D2:D3', descrizioni(b) == ['Elenco: a, b · rifiuta'], descrizioni(b))
        b.ok('un clic su ✎ carica la regola nel modulo con le due aree', clic_su(b, nel_dialogo('[data-elenco] li [data-azione="modifica"]'), lambda: valore_campo(b, 'intervallo') == 'B1:B5, D2:D3'), valore_campo(b, 'intervallo'))
        b.ok('le voci sono quelle salvate', valore_campo(b, 'voci') == 'a, b', valore_campo(b, 'voci'))
        imposta_campo(b, 'voci', 'a, b, x')
        b.ok('Fine sostituisce la regola', fine(b))
        b.ok('la barra di stato dice "Convalida modificata: 7 celle"', stato(b) == 'Convalida modificata: 7 celle', stato(b))
        b.clic_cella_os(1, 2); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        v = col(b, 2, 3)
        b.ok('ora "x" è ammesso e Ctrl+V lo scrive in B2', v == ['a', 'x', 'b'], v)
    prova(b, 'Modifico la convalida dall\'elenco', modifica)

    def elimina():
        b.ok('riapro il dialogo', apri(b, 10, 10, 10, 10))
        b.ok('un clic su ✕ elimina la regola e l\'elenco si svuota', clic_su(b, nel_dialogo('[data-elenco] li [data-azione="elimina"]'), lambda: descrizioni(b) == []), descrizioni(b))
        b.ok('Annulla chiude il dialogo', clic_su(b, nel_dialogo('button[data-azione="annulla"]'), lambda: not aperto(b)))
        n = b.js("() => GR.getDoc().dataValidations.size")
        b.ok('non ci sono più convalide', n == 0, n)
        b.clic_cella_os(20, 11); b.attendi(200)
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        n = b.js("() => GR.getDoc().dataValidations.size")
        b.ok('Ctrl+Z le rimette (7 celle)', n == 7, n)
    prova(b, 'Elimino e annullo', elimina)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
