import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

NASCOSTE = "() => Array.from(GR.getDoc().hiddenRows).sort((a, b) => a - b)"
POPUP = "GR.renderRoot.querySelector('free-filtro-colonna')"
VISTE = "APP.shadowRoot.querySelector('free-dialogo-viste-filtro')"

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
in_viste = lambda sel: f"({VISTE} ? {VISTE}.shadowRoot.querySelector('{sel}') : null)"
popup_aperto = lambda b: b.js("() => !!" + POPUP)
viste_aperte = lambda b: b.js("() => !!" + VISTE)
spuntata = lambda b, sel: b.js("() => { const c = " + dentro(sel) + "; return c ? c.checked : null; }")
valori_col = lambda b, c: [b.cella(r, c)['raw'] for r in range(2, 7)]
nomi_viste = lambda b: b.js("() => { const d = " + VISTE + "; return d ? Array.from(d.shadowRoot.querySelectorAll('[data-elenco] .nome')).map(x => x.textContent) : null; }")
sfondo = lambda b, r: (lambda s: s.replace(' ', '') if s else s)(b.js("(r) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"1\"]`); return t ? getComputedStyle(t).backgroundColor : null; }", r))
ROSSO = 'rgb(255,0,0)'

def apri(b, col): return clic_su(b, freccia(col), lambda: popup_aperto(b))
def togli(b, sel): return clic_su(b, dentro(sel), lambda: spuntata(b, sel) is False)
def apri_viste(b):
    b.clic_cella_os(20, 11); b.attendi(200)
    b.menu('Dati', 'Viste filtro...'); b.attendi(600)
    return viste_aperte(b)

NOMI = ['Nome', 'a', 'b', 'c', 'd', 'e']
NUM = ['Numero', '1', '2', '3', '4', '5']

with Banco(9632, '36 Ordina per colore e viste filtro') as b:
    b.primo_piano()
    for i in range(6):
        b.imposta(i + 1, 1, NOMI[i]); b.imposta(i + 1, 2, NUM[i])
    b.js("""() => { const d = GR.getDoc(); const m = (r, c, p) => { const k = r + ',' + c; d.styles.cellStyles.set(k, d.styles.registry.merge(d.styles.cellStyles.get(k) || 0, p)); };
                    m(3, 1, {fill: '#ff0000'}); m(5, 1, {fill: '#ff0000'}); m(4, 1, {fill: '#00ff00'}); }""")
    b.aggiorna()
    b.menu('Dati', 'Crea un filtro'); b.attendi(600)

    def per_colore():
        b.ok('la freccia della colonna A apre la finestrella', apri(b, 1))
        n = b.js("() => { const p = " + POPUP + "; return p ? p.shadowRoot.querySelectorAll('button[data-azione=\"ordina-colore\"]').length : 0; }")
        b.ok('ci sono i bottoni "Ordina per colore" (rosso e verde)', n == 2, n)
        b.ok('un clic sul rosso chiude la finestrella', clic_su(b, dentro('button[data-azione="ordina-colore"][data-colore="#ff0000"]'), lambda: not popup_aperto(b)))
        b.attendi(500)
        v = valori_col(b, 1)
        b.ok('le righe rosse (b, d) sono in cima, le altre seguono nell\'ordine di prima', v == ['b', 'd', 'a', 'c', 'e'], v)
        b.ok('anche la colonna B segue (2, 4, 1, 3, 5)', valori_col(b, 2) == ['2', '4', '1', '3', '5'], valori_col(b, 2))
        b.ok('il rosso è andato con le righe (A2 e A3 rosse, A4 no)', sfondo(b, 2) == ROSSO and sfondo(b, 3) == ROSSO and sfondo(b, 4) != ROSSO, [sfondo(b, 2), sfondo(b, 3), sfondo(b, 4)])
    prova(b, 'Ordina per colore', per_colore)

    def salva_vista():
        b.ok('riapro la finestrella della colonna A', apri(b, 1))
        b.ok('tolgo "Nessun colore"', togli(b, 'input[data-colore=""]'))
        b.ok('tolgo il verde', togli(b, 'input[data-colore="#00ff00"]'))
        b.ok('Applica', clic_su(b, dentro('button[data-azione="applica"]'), lambda: not popup_aperto(b)))
        h = b.js(NASCOSTE)
        b.ok('restano solo le righe rosse: nascoste 4, 5, 6', h == [4, 5, 6], h)
        b.ok('Dati > Viste filtro... apre la finestra', apri_viste(b))
        b.ok('ancora nessuna vista', nomi_viste(b) == [], nomi_viste(b))
        b.js("() => { const c = " + in_viste('[data-campo="nome"]') + "; c.value = 'Solo rossi'; }")
        b.ok('un clic su Salva aggiunge "Solo rossi" all\'elenco', clic_su(b, in_viste('button[data-azione="salva"]'), lambda: nomi_viste(b) == ['Solo rossi']), nomi_viste(b))
        b.ok('Chiudi', clic_su(b, in_viste('button[data-azione="chiudi"]'), lambda: not viste_aperte(b)))
    prova(b, 'Salvo una vista filtro', salva_vista)

    def applica_vista():
        b.clic_cella_os(20, 11); b.attendi(200)
        b.menu('Dati', 'Rimuovi filtri'); b.attendi(600)
        b.ok('Rimuovi filtri mostra tutte le righe', b.js(NASCOSTE) == [], b.js(NASCOSTE))
        b.ok('riapro le viste', apri_viste(b))
        b.ok('la vista c\'è ancora', nomi_viste(b) == ['Solo rossi'], nomi_viste(b))
        b.ok('un clic su Applica chiude la finestra', clic_su(b, in_viste('button[data-azione="applica"]'), lambda: not viste_aperte(b)))
        b.attendi(400)
        h = b.js(NASCOSTE)
        b.ok('il filtro torna: nascoste 4, 5, 6', h == [4, 5, 6], h)
        b.ok('le frecce del filtro sono di nuovo sulle colonne', b.js("() => GR.renderRoot.querySelectorAll('.col-filter-btn').length") >= 2)
    prova(b, 'Applico la vista', applica_vista)

    def elimina_vista():
        b.ok('riapro le viste', apri_viste(b))
        b.ok('un clic su ✕ elimina la vista', clic_su(b, in_viste('button[data-azione="elimina"]'), lambda: nomi_viste(b) == []), nomi_viste(b))
        b.ok('Chiudi', clic_su(b, in_viste('button[data-azione="chiudi"]'), lambda: not viste_aperte(b)))
        b.clic_cella_os(20, 11); b.attendi(200)
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        n = b.js("() => (GR.getDoc().visteFiltro || []).map(v => v.nome)")
        b.ok('Ctrl+Z rimette la vista eliminata', n == ['Solo rossi'], n)
    prova(b, 'Elimino la vista e annullo', elimina_vista)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
