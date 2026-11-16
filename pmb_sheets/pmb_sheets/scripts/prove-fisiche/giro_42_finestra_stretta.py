import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

TB = "APP.shadowRoot.querySelector('free-toolbar').shadowRoot"
cima = lambda b, x, y: b.js("([x, y]) => { let e = document.elementFromPoint(x, y); const c = []; while (e && e.shadowRoot) { c.push(e.tagName); const d = e.shadowRoot.elementFromPoint(x, y); if (!d || d === e) break; e = d; } c.push(e ? e.tagName : null); return c.join(' > '); }", [x, y])

with Banco(9632, '42 Finestra stretta: menu Altri strumenti, tavolozze e bottone Segnalazione bug') as b:
    b.primo_piano()
    b.pg.set_viewport_size({'width': 760, 'height': 760}); b.attendi(900)

    def bottone_segnala():
        h = b.js("() => { const q = APP.shadowRoot.querySelector('free-menubar').shadowRoot.querySelector('.bottone-segnala').getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height)]; }")
        b.ok('il bottone «Segnalazione bug» resta su una riga anche a finestra stretta', h[1] <= 32, h)
    prova(b, 'Bottone', bottone_segnala)

    def altri_strumenti():
        r = b.js("() => { const o = " + TB + ".querySelector('#btn-toolbar-more'); if (!o) return null; const q = o.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }")
        b.ok('a finestra stretta c\'è il pulsante «Altri strumenti»', r is not None, r)
        if not r: return
        for _ in range(3):   # il primo clic dopo l'avvio a volte serve solo ad attivare la finestra
            L._clic_os(b, r[0], r[1]); b.attendi(600)
            if b.js("() => !!" + TB + ".querySelector('.overflow-popup')"): break
        p = b.js("() => { const p = " + TB + ".querySelector('.overflow-popup'); if (!p) return null; const q = p.getBoundingClientRect(); return {l: q.left, t: q.top, w: q.width, h: q.height, pos: getComputedStyle(p).position, vis: getComputedStyle(p).visibility}; }")
        b.ok('il menu si apre, in posizione fissa e visibile', p is not None and p['pos'] == 'fixed' and p['vis'] == 'visible', p)
        if not p: return
        # il centro di ogni punto del riquadro (in alto, a metà, in basso) deve cadere dentro la barra degli strumenti, non sulla griglia o sulle schede sotto
        punti = [cima(b, p['l'] + p['w'] / 2, p['t'] + f * p['h']) for f in (0.08, 0.5, 0.92)]
        b.ok('in tutto il riquadro i clic arrivano al menu (non alle schede o alla griglia che stanno sotto)', all('FREE-TOOLBAR' in x for x in punti), punti)
        b.ok('il riquadro sta dentro la finestra', p['l'] >= 0 and p['l'] + p['w'] <= 760 and p['t'] + p['h'] <= 760, p)
        # una tavolozza aperta da dentro il menu si vede e si usa
        voce = b.js("() => { const p = " + TB + ".querySelector('.overflow-popup'); const x = p.querySelector('#btn-fill-color-overflow, #btn-text-color-overflow'); if (!x) return null; const q = x.getBoundingClientRect(); return [x.id, q.left + q.width / 2, q.top + q.height / 2]; }")
        if voce:
            L._clic_os(b, voce[1], voce[2]); b.attendi(500)
            sw = b.js("() => { const cp = " + TB + ".querySelector('free-color-picker'); const s = cp && cp.shadowRoot && cp.shadowRoot.querySelectorAll('.color-swatch'); if (!s || !s.length) return null; const x = s[12].getBoundingClientRect(); return [x.left + x.width / 2, x.top + x.height / 2]; }")
            b.ok(f'la tavolozza aperta da «{voce[0]}» dentro il menu si vede', sw is not None, sw)
            if sw:
                b.ok('e i suoi colori ricevono i clic (non le celle sotto)', 'FREE-TOOLBAR' in cima(b, sw[0], sw[1]) or 'FREE-COLOR-PICKER' in cima(b, sw[0], sw[1]), cima(b, sw[0], sw[1]))
        else:
            b.nota('nel menu non ci sono i bottoni dei colori a questa larghezza', '')
    prova(b, 'Altri strumenti', altri_strumenti)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
