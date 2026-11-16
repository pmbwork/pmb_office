import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

# A: frutta, B: numeri; la riga 1 è l'intestazione
DATI = [['Frutta', 'Numero'], ['mela', '5'], ['pera', '12'], ['mela', '7'], ['kiwi', '30'], ['', '1'], ['pera', '18']]

NASCOSTE = "() => Array.from(GR.getDoc().hiddenRows).sort((a, b) => a - b)"
POPUP = "GR.renderRoot.querySelector('free-filtro-colonna')"

def rett(b, js_el):
    """Rettangolo (in pixel della pagina) di un elemento, dato come espressione JS. None se non c'è."""
    return b.js("() => { const e = " + js_el + "; if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")

def clic_su(b, js_el, verifica, tentativi=8):
    """Clic vero al centro di un elemento; si ripete finché la verifica è vera (il puntatore può essere spostato da fuori)."""
    for _ in range(tentativi):
        r = rett(b, js_el)
        if r is None: return False
        L._clic_os(b, r[0] + r[2] / 2, r[1] + r[3] / 2)
        b.attendi(250)
        if verifica(): return True
    return False

def freccia(col):
    return f"GR.renderRoot.querySelector('th.col-header[aria-colindex=\"{col + 1}\"] .col-filter-btn')"

def casella(valore):
    return f"{POPUP}.shadowRoot.querySelector('input[type=checkbox][data-valore=\"{valore}\"]')"

def bottone(nome):
    return f"{POPUP}.shadowRoot.querySelector('button[data-azione=\"{nome}\"]')"

def spuntata(b, valore):
    return b.js("() => { const c = " + casella(valore) + "; return c ? c.checked : null; }")

def popup_aperto(b):
    return b.js("() => !!" + POPUP)

def apri(b, col):
    return clic_su(b, freccia(col), lambda: popup_aperto(b))

with Banco(9622, '18 Filtro di colonna con più valori') as b:
    b.primo_piano()
    for i, (a, n) in enumerate(DATI, start=1):
        b.imposta(i, 1, a); b.imposta(i, 2, n)
    b.aggiorna()

    def accendi():
        b.menu('Dati', 'Crea un filtro'); b.attendi(600)
        n = b.js("() => GR.renderRoot.querySelectorAll('.col-filter-btn').length")
        b.ok('il filtro mostra le frecce ▼ nelle intestazioni', n >= 2, n)
    prova(b, 'Accendere il filtro', accendi)

    def valori_e_scelta():
        b.ok('un clic sulla freccia ▼ della colonna A apre la finestrella', apri(b, 1))
        elenco = b.js("() => Array.from(" + POPUP + ".shadowRoot.querySelectorAll('input[type=checkbox]')).map(c => c.dataset.valore)")
        b.ok('elenca i valori distinti senza l\'intestazione, con la cella vuota in fondo', elenco == ['kiwi', 'mela', 'pera', ''], elenco)
        r = rett(b, POPUP + ".shadowRoot.querySelector('.pannello')")
        dentro = r[0] >= 0 and r[1] >= 0 and r[0] + r[2] <= b.js("() => innerWidth") and r[1] + r[3] <= b.js("() => innerHeight")
        b.ok('sta dentro la finestra del programma', dentro, r)
        fr = rett(b, freccia(1))
        b.ok('compare vicino alla freccia (non lontano)', abs(r[0] - fr[0]) < 300 and r[1] < fr[1] + 120, [r, fr])
        b.ok('togliendo la spunta a "mela" con un clic', clic_su(b, casella('mela'), lambda: spuntata(b, 'mela') is False))
        b.ok('e a "kiwi"', clic_su(b, casella('kiwi'), lambda: spuntata(b, 'kiwi') is False))
        b.ok('"Applica" chiude la finestrella', clic_su(b, bottone('applica'), lambda: not popup_aperto(b)))
        h = b.js(NASCOSTE)
        b.ok('le righe di mela e kiwi (2, 4, 5) sono nascoste', h == [2, 4, 5], h)
        visibili = b.js("() => [2, 3, 4, 5, 6, 7].filter(r => !!GR.renderRoot.querySelector('td[data-row=\"' + r + '\"][data-col=\"1\"]'))")
        b.ok('e a video restano le righe 3, 6 e 7', visibili == [3, 6, 7], visibili)
        b.ok('la freccia della colonna A è evidenziata', b.js("() => GR.renderRoot.querySelector('th.col-header[aria-colindex=\"2\"] .col-filter-btn').classList.contains('active')"))
        b.os_tasto('Z', 'Ctrl'); b.attendi(600)
        b.ok('Ctrl+Z (la tastiera è già alla griglia) mostra di nuovo tutte le righe', b.js(NASCOSTE) == [], b.js(NASCOSTE))
    prova(b, 'Scegliere i valori', valori_e_scelta)

    def condizione():
        b.ok('apre la finestrella della colonna B', apri(b, 2))
        # la lista a tendina è presa dalla tastiera: ha già il cursore, si scrive il nome della condizione
        b.os_testo('Maggiore di'); b.attendi(400)
        scelta = b.js("() => " + POPUP + ".shadowRoot.querySelector('select').value")
        b.ok('scrivendo "Maggiore di" nella tendina si sceglie quella condizione', scelta == 'greater_than', scelta)
        b.ok('compare il campo del valore', rett(b, POPUP + ".shadowRoot.querySelector('[data-campo=valore1]')") is not None)
        b.ok('si clicca nel campo, si scrive 10 e si preme Invio',
             clic_su(b, POPUP + ".shadowRoot.querySelector('[data-campo=valore1]')", lambda: b.js("() => " + POPUP + ".shadowRoot.activeElement && " + POPUP + ".shadowRoot.activeElement.dataset.campo") == 'valore1'))
        b.os_testo('10'); b.os_tasto('Invio'); b.attendi(600)
        h = b.js(NASCOSTE)
        b.ok('restano visibili 12, 30 e 18: si nascondono le righe 2, 4 e 6', h == [2, 4, 6], h)
        b.ok('la finestrella si è chiusa', not popup_aperto(b))
    prova(b, 'Filtrare per condizione', condizione)

    def combinato_e_ricerca():
        b.ok('riapre la colonna A (c\'è già il filtro sulla B)', apri(b, 1))
        b.ok('clic nel campo di ricerca', clic_su(b, POPUP + ".shadowRoot.querySelector('[data-campo=ricerca]')", lambda: b.js("() => " + POPUP + ".shadowRoot.activeElement && " + POPUP + ".shadowRoot.activeElement.dataset.campo") == 'ricerca'))
        b.os_testo('a'); b.attendi(400)
        elenco = b.js("() => Array.from(" + POPUP + ".shadowRoot.querySelectorAll('input[type=checkbox]')).map(c => c.dataset.valore)")
        b.ok('cercando "a" restano mela e pera', elenco == ['mela', 'pera'], elenco)
        b.ok('"Nessuno" toglie la spunta solo ai valori trovati', clic_su(b, bottone('nessuno'), lambda: spuntata(b, 'mela') is False and spuntata(b, 'pera') is False))
        # dopo il clic sul pulsante il cursore sta sul pulsante: si torna nel campo di ricerca e si cancella la lettera
        b.ok('clic di nuovo nel campo di ricerca', clic_su(b, POPUP + ".shadowRoot.querySelector('[data-campo=ricerca]')", lambda: b.js("() => " + POPUP + ".shadowRoot.activeElement && " + POPUP + ".shadowRoot.activeElement.dataset.campo") == 'ricerca'))
        b.os_tasto('Fine'); b.os_tasto('Backspace'); b.attendi(300)
        elenco = b.js("() => Array.from(" + POPUP + ".shadowRoot.querySelectorAll('input[type=checkbox]')).map(c => c.dataset.valore)")
        b.ok('cancellando la ricerca si rivede tutto l\'elenco', elenco == ['kiwi', 'mela', 'pera', ''], elenco)
        b.ok('kiwi e la cella vuota sono rimasti spuntati', spuntata(b, 'kiwi') is True and spuntata(b, '') is True, [spuntata(b, 'kiwi'), spuntata(b, '')])
        b.ok('"Applica"', clic_su(b, bottone('applica'), lambda: not popup_aperto(b)))
        h = b.js(NASCOSTE)
        b.ok('i due filtri valgono insieme: nascoste 2, 3, 4, 6, 7 (resta solo kiwi con 30)', h == [2, 3, 4, 6, 7], h)
    prova(b, 'Due filtri insieme e ricerca', combinato_e_ricerca)

    def chiusura_e_rimozione():
        b.ok('riapre la colonna B', apri(b, 2))
        b.os_tasto('Esc'); b.attendi(400)
        b.ok('Esc chiude la finestrella senza cambiare i filtri', not popup_aperto(b) and b.js(NASCOSTE) == [2, 3, 4, 6, 7], b.js(NASCOSTE))
        b.ok('riapre la colonna A', apri(b, 1))
        b.ok('"Rimuovi filtro" toglie solo il filtro della colonna A', clic_su(b, bottone('rimuovi'), lambda: not popup_aperto(b)))
        h = b.js(NASCOSTE)
        b.ok('resta il filtro sulla B: nascoste 2, 4, 6', h == [2, 4, 6], h)
        b.menu('Dati', 'Rimuovi filtri'); b.attendi(600)
        b.ok('il menu Dati > Rimuovi filtri li toglie tutti', b.js(NASCOSTE) == [], b.js(NASCOSTE))
    prova(b, 'Chiudere e rimuovere', chiusura_e_rimozione)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
