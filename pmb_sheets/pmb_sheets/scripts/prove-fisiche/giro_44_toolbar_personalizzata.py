import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

with Banco(9632, '44 Barra strumenti personalizzabile, frecce filtro e bottone verde') as b:
    b.primo_piano()

    # 1. Verifica colore verde chiaro bottone Segnalazione bug
    def prova_bottone_verde():
        colore = b.js("() => { const btn = APP.shadowRoot.querySelector('free-menubar').shadowRoot.querySelector('.bottone-segnala'); return window.getComputedStyle(btn).color; }")
        b.ok('il bottone Segnalazione bug è verde chiaro (rgb(34, 197, 94))', '34, 197, 94' in str(colore), colore)
    prova(b, 'Bottone verde chiaro', prova_bottone_verde)

    # 2. Verifica menu Visualizza > Personalizza barra degli strumenti...
    def prova_menu_personalizza():
        voce_esiste = b.js("() => { const mb = APP.shadowRoot.querySelector('free-menubar'); return !!mb; }")
        b.ok('la barra dei menu è presente', voce_esiste)

        # Apri il dialogo personalizza barra tramite menu Action
        b.js("() => APP.handleMenuAction(new CustomEvent('menu-action', { detail: { action: 'personalizza-barra' } }))")
        b.attendi(400)
        dialogo_aperto = b.js("() => !!APP.shadowRoot.querySelector('free-dialogo-personalizza-barra')")
        b.ok('Visualizza > Personalizza barra degli strumenti apre il dialogo', dialogo_aperto)

        if dialogo_aperto:
            ha_catalogo = b.js("() => { const d = APP.shadowRoot.querySelector('free-dialogo-personalizza-barra'); return d.shadowRoot.querySelectorAll('.catalogo .riga').length > 10; }")
            b.ok('il catalogo contiene le funzioni disponibili', ha_catalogo)

            # Clicca sul pulsante Fatto chiamando il suo gestore di chiusura
            b.js("() => { const d = APP.shadowRoot.querySelector('free-dialogo-personalizza-barra'); d.chiudi(); }")
            b.attendi(400)
            chiuso = b.js("() => !APP.shadowRoot.querySelector('free-dialogo-personalizza-barra')")
            b.ok('il pulsante Fatto chiude il dialogo di personalizzazione', chiuso)
    prova(b, 'Dialogo personalizzazione barra', prova_menu_personalizza)

    # 3. Verifica click destro sulla toolbar per menu contestuale
    def prova_click_destro_toolbar():
        b.js("() => { const tb = APP.shadowRoot.querySelector('free-toolbar'); tb.suContesto({ preventDefault: () => {}, clientX: 200, clientY: 150, composedPath: () => [tb.shadowRoot.querySelector('#btn-bold')] }); }")
        b.attendi(300)
        menu_contesto = b.js("() => !!APP.shadowRoot.querySelector('free-toolbar').shadowRoot.querySelector('.menu-contesto')")
        b.ok('il click destro sulla toolbar apre il menu contestuale con Personalizza', menu_contesto)

        # Chiudi cliccando altrove
        b.js("() => { const tb = APP.shadowRoot.querySelector('free-toolbar'); tb.contesto = null; }")
        b.attendi(200)
    prova(b, 'Menu contestuale toolbar', prova_click_destro_toolbar)

    # 4. Verifica freccia del filtro dentro la cella d'intestazione reale
    def prova_filtro_in_cella():
        b.imposta(1, 1, 'Prodotto')
        b.imposta(1, 2, 'Prezzo')
        b.imposta(2, 1, 'Penna')
        b.imposta(2, 2, '2')
        b.aggiorna()
        b.attendi(200)

        # Attiva il filtro tramite menu
        b.menu('Dati', 'Crea un filtro')
        b.attendi(600)

        ha_frecce = b.js("() => { const f = GR.renderRoot.querySelectorAll('.cell-filter-btn'); return f.length > 0; }")
        b.ok('il filtro sulla tabella mostra i pulsanti .cell-filter-btn dentro le celle d\'intestazione', ha_frecce)

        # Rimuovi filtro per pulizia
        b.menu('Dati', 'Rimuovi filtri')
        b.attendi(300)
    prova(b, 'Frecce filtro nella cella', prova_filtro_in_cella)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
