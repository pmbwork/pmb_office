import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

BOTTONE = "APP.shadowRoot.querySelector('free-menubar').shadowRoot.querySelector('.bottone-segnala')"
aperta = lambda b: b.js("() => !!APP.shadowRoot.querySelector('free-dialogo-segnala')")

with Banco(9632, '41 Il bottone Segnalazione bug dopo il menu Informazioni') as b:
    b.primo_piano()

    def bottone():
        info = b.js("() => { const c = APP.shadowRoot.querySelector('free-menubar').shadowRoot.querySelector('.menu-bar-container'); const f = Array.from(c.children); const ult = f[f.length - 1]; const pen = f[f.length - 2]; return [pen.textContent.replace(/\\s+/g, ' ').trim(), ult.textContent.replace(/\\s+/g, ' ').trim()]; }")
        b.ok('dopo il menu Informazioni c\'è il bottone «Segnalazione bug»', info == ['Informazioni', 'Segnalazione bug'], info)
        ok = False
        for _ in range(3):
            r = b.js("() => { const e = " + BOTTONE + "; const x = e.getBoundingClientRect(); return [x.left + x.width / 2, x.top + x.height / 2]; }")
            L._clic_os(b, r[0], r[1]); b.attendi(600)
            if aperta(b): ok = True; break
        b.ok('un clic vero sul bottone apre la finestra di segnalazione', ok)
        b.chiudi_dialoghi(); b.attendi(300)
    prova(b, 'Bottone', bottone)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
