import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

with Banco(9501, '01 Scrittura e tastiera') as b:
    b.ok('la finestra del programma passa in primo piano (serve per la tastiera vera)', b.primo_piano())
    sel = lambda: b.doc()['sel']

    # --- scrittura con la tastiera vera
    b.scrivi_os(1, 1, 'ciao')
    c = b.cella(1, 1)
    b.ok('scrivere "ciao" e premere Invio mette il testo nella cella', c['raw'] == 'ciao', c)
    b.ok('dopo Invio la cella attiva è quella sotto (A2)', sel() == [2, 1], sel())

    b.scrivi_os(2, 1, '12,5')
    b.ok('"12,5" diventa il numero 12,5 e si vede con la virgola', b.cella(2, 1)['raw'] == '12.5' and b.testo(2, 1) == '12,5', [b.cella(2, 1), b.testo(2, 1)])
    b.scrivi_os(3, 1, '1.234,5')
    b.ok('"1.234,5" diventa 1234,5', b.cella(3, 1)['raw'] == '1234.5' and b.testo(3, 1) == '1234,5', [b.cella(3, 1), b.testo(3, 1)])

    b.scrivi_os(1, 3, '3'); b.scrivi_os(2, 3, '4')
    b.scrivi_os(3, 3, '=SOMMA(C1;C2)')
    r = b.cella(3, 3)
    b.ok('la formula =SOMMA(C1;C2) calcola 7', r['v'] == 7 and r['raw'] == '=SUM(C1,C2)', r)
    b.ok('la formula si vede come risultato (7)', b.testo(3, 3) == '7', b.testo(3, 3))
    b.scrivi_os(4, 3, '=SOMMA(')
    b.ok('una formula sbagliata mostra un errore, non rompe il foglio', b.cella(4, 3)['k'] == 'error', b.cella(4, 3))

    b.scrivi_os(5, 1, '05/03/2026')
    b.ok('una data scritta a mano diventa una data (05/03/2026)', b.testo(5, 1) == '05/03/2026' and b.cella(5, 1)['raw'] == '46086', [b.testo(5, 1), b.cella(5, 1)])
    b.scrivi_os(6, 1, '10%')
    b.ok('"10%" si vede 10%', b.testo(6, 1) == '10%', b.testo(6, 1))
    b.scrivi_os(7, 1, '€ 1.234,50')
    b.ok('"€ 1.234,50" si vede €1.234,50', b.testo(7, 1) == '€1.234,50', b.testo(7, 1))
    b.scrivi_os(8, 1, "'00123")
    b.ok('un apostrofo davanti forza il testo ("00123")', b.testo(8, 1) == '00123' and b.cella(8, 1)['k'] == 'text', [b.testo(8, 1), b.cella(8, 1)])

    b.clic_cella_os(9, 1); b.os_testo('@ [ ] { } #'); b.os_tasto('Invio'); b.attendi(300)
    b.ok('i caratteri @ [ ] { } # si scrivono (tastiera italiana)', b.cella(9, 1)['raw'] == '@ [ ] { } #', b.cella(9, 1))

    # --- Tab, Maiusc+Invio, Esc
    b.clic_cella_os(11, 1); b.os_testo('uno'); b.os_tasto('Tab'); b.attendi(300)
    b.ok('Tab conferma e va a destra', b.cella(11, 1)['raw'] == 'uno' and sel() == [11, 2], [b.cella(11, 1), sel()])
    b.os_testo('due'); b.os_tasto('Invio', 'Maiusc'); b.attendi(300)
    b.ok('Maiusc+Invio conferma e va su', b.cella(11, 2)['raw'] == 'due' and sel() == [10, 2], [b.cella(11, 2), sel()])
    b.clic_cella_os(12, 1); b.os_testo('da annullare'); b.os_tasto('Esc'); b.attendi(300)
    b.ok('Esc annulla la scrittura', b.cella(12, 1)['raw'] == '', b.cella(12, 1))

    # --- F2, Canc
    b.clic_cella_os(1, 1); b.os_tasto('F2'); b.os_testo('!'); b.os_tasto('Invio'); b.attendi(300)
    b.ok('F2 modifica il testo esistente (ciao → ciao!)', b.cella(1, 1)['raw'] == 'ciao!', b.cella(1, 1))
    b.clic_cella_os(1, 1); b.os_tasto('Canc'); b.attendi(300)
    b.ok('Canc svuota la cella', b.cella(1, 1)['raw'] == '', b.cella(1, 1))

    # --- annulla e ripeti da tastiera
    b.os_tasto('Z', 'Ctrl'); b.attendi(400)
    b.ok('Ctrl+Z rimette "ciao!"', b.cella(1, 1)['raw'] == 'ciao!', b.cella(1, 1))
    b.os_tasto('Y', 'Ctrl'); b.attendi(400)
    b.ok('Ctrl+Y ripete la cancellazione', b.cella(1, 1)['raw'] == '', b.cella(1, 1))

    # --- frecce
    b.clic_cella_os(2, 2)
    b.os_tasto('Giu'); b.os_tasto('Giu'); b.os_tasto('Destra')
    b.ok('le frecce spostano la cella attiva (B2 → C4)', sel() == [4, 3], sel())
    b.os_tasto('Sinistra', 'Maiusc'); b.os_tasto('Su', 'Maiusc')
    d = b.js("() => { const r = GR.getDoc().selection.range; return [r.startRow, r.endRow, r.startCol, r.endCol]; }")
    b.ok('Maiusc+frecce estendono la selezione', d == [3, 4, 2, 3], d)
    b.clic_cella_os(1, 3); b.os_tasto('Giu', 'Ctrl')
    b.ok("Ctrl+Giù va al fondo del blocco di dati (C4)", sel() == [4, 3], sel())
    b.os_tasto('Home', 'Ctrl'); b.ok('Ctrl+Home va ad A1', sel() == [1, 1], sel())
    b.os_tasto('Fine', 'Ctrl'); b.ok('Ctrl+Fine va all\'ultima cella usata', sel()[0] >= 11, sel())
    b.clic_cella_os(3, 1); b.os_tasto('PagGiu'); b.ok('Pag.Giù scende di una pagina', sel()[0] > 15, sel())
    b.os_tasto('PagSu'); b.ok('Pag.Su risale', sel()[0] <= 5, sel())

    # --- scorciatoie di formato dalla tastiera vera
    b.clic_cella_os(2, 1); b.os_tasto('B', 'Ctrl')
    w = b.js("""() => getComputedStyle(GR.renderRoot.querySelector('td[data-row="2"][data-col="1"]')).fontWeight""")
    b.ok('Ctrl+B mette in grassetto', w in ('700', 'bold'), w)
    b.os_tasto('I', 'Ctrl'); i = b.js("""() => getComputedStyle(GR.renderRoot.querySelector('td[data-row="2"][data-col="1"]')).fontStyle""")
    b.ok('Ctrl+I mette in corsivo', i == 'italic', i)
    b.os_tasto('U', 'Ctrl'); u = b.js("""() => getComputedStyle(GR.renderRoot.querySelector('td[data-row="2"][data-col="1"]')).textDecorationLine""")
    b.ok('Ctrl+U sottolinea', 'underline' in u, u)

    # --- copia e incolla con la tastiera vera
    b.seleziona_os(1, 3, 2, 3); b.os_tasto('C', 'Ctrl'); b.attendi(300)
    b.clic_cella_os(6, 5); b.os_tasto('V', 'Ctrl'); b.attendi(600)
    b.ok('Ctrl+C e Ctrl+V copiano C1:C2 in E6:E7', b.cella(6, 5)['raw'] == '3' and b.cella(7, 5)['raw'] == '4', [b.cella(6, 5), b.cella(7, 5)])
    b.seleziona_os(1, 3, 2, 3); b.os_tasto('X', 'Ctrl'); b.attendi(300)
    b.clic_cella_os(10, 6); b.os_tasto('V', 'Ctrl'); b.attendi(600)
    b.ok('Ctrl+X e Ctrl+V spostano C1:C2 in F10:F11 e lasciano C1:C2 vuote', b.cella(10, 6)['raw'] == '3' and b.cella(1, 3)['raw'] == '', [b.cella(10, 6), b.cella(1, 3)])

    # --- barra della formula
    b.clic_cella_os(14, 1)
    fb = b.js("() => { const r = GR.renderRoot.querySelector('.formula-input').getBoundingClientRect(); return {x: r.left + 40, y: r.top + r.height/2}; }"); b.clic_os(fb['x'], fb['y'])
    b.os_testo('da barra'); b.os_tasto('Invio'); b.attendi(300)
    b.ok('si può scrivere nella barra della formula e confermare con Invio', b.cella(14, 1)['raw'] == 'da barra', b.cella(14, 1))
    b.clic_cella_os(14, 1)
    fb = b.js("() => GR.renderRoot.querySelector('.formula-input').value")
    b.ok('la barra della formula mostra il contenuto della cella attiva', fb == 'da barra', fb)
    b.clic_cella_os(3, 3)
    fb = b.js("() => GR.renderRoot.querySelector('.formula-input').value")
    # C1:C2 sono state tagliate e incollate in F10:F11 (più sopra): la formula di C3 le ha seguite, come in Excel e Google Fogli
    b.ok('per una formula la barra mostra la formula in italiano (che ha seguito le celle tagliate)', fb == '=SOMMA(F10;F11)', fb)
    nb = b.js("() => GR.renderRoot.querySelector('.cell-name-box').value")
    b.ok('la casella del nome mostra C3', nb == 'C3', nb)
    # casella del nome: vai a una cella scrivendo l'indirizzo
    nb2 = b.js("() => { const r = GR.renderRoot.querySelector('.cell-name-box').getBoundingClientRect(); return {x: r.left + 20, y: r.top + r.height/2}; }"); b.clic_os(nb2['x'], nb2['y']); b.os_tasto('A', 'Ctrl'); b.os_testo('D20'); b.os_tasto('Invio'); b.attendi(400)
    b.ok('scrivendo D20 nella casella del nome si va a D20', sel() == [20, 4], sel())

    e = b.errori_pagina()
    b.ok('nessun errore nella console della pagina durante la sezione', len(e) == 0, e[:3])
