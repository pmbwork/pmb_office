import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

IMG_TITOLO = "APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('img.logo-pmb')"
IMG_INFO = "(() => { const d = APP.shadowRoot.querySelector('free-dialogo-informazioni'); return d ? d.shadowRoot.querySelector('.marchio img') : null; })()"

def stato_img(b, js_el):
    return b.js("() => { const i = " + js_el + "; if (!i) return null; const r = i.getBoundingClientRect(); return {completa: i.complete, larghezzaNaturale: i.naturalWidth, w: Math.round(r.width), h: Math.round(r.height), svg: i.src.startsWith('data:image/svg+xml;base64,')}; }")

with Banco(9632, '40 Il nuovo logo nella barra del titolo e nella finestra Informazioni') as b:
    b.primo_piano()

    def titolo():
        s = stato_img(b, IMG_TITOLO)
        b.ok('nella barra del titolo c\'è il logo orizzontale (SVG) e si è caricato', s and s['svg'] and s['completa'] and s['larghezzaNaturale'] == 300, s)
        # viewBox 76 76 1042 252: alto 100 pixel, largo 100 x 1042 / 252 = 413,5; il motto (22 unità su 252) viene di circa 9 pixel
        b.ok('alto 100 pixel, largo circa 413 (il motto si legge)', s and s['h'] == 100 and abs(s['w'] - 413.5) <= 1.5, s)
        bottoni = b.js("() => Array.from(APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelectorAll('.control-btn')).map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; })")
        b.ok('i bottoni della finestra restano alti 38 pixel, in alto', bottoni == [[0, 38]] * 3, bottoni)
        badge = b.js("() => !!APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.app-badge')")
        testo = b.js("() => APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.left-section').innerText")
        b.ok('la scritta pmb_sheets non c\'è più (il nome è nel logo)', not badge and 'pmb_sheets' not in (testo or ''), [badge, testo])
        fondo = b.js("() => getComputedStyle(APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.marchio')).backgroundColor")
        b.ok('il logo sta su un pannello bianco (si legge anche nel tema scuro)', (fondo or '').replace(' ', '') == 'rgb(255,255,255)', fondo)
    prova(b, 'Barra del titolo', titolo)

    def informazioni():
        b.menu('Informazioni', 'Informazioni su pmb_sheets'); b.attendi(700)
        s = stato_img(b, IMG_INFO)
        b.ok('la finestra Informazioni mostra il logo orizzontale, caricato', s and s['svg'] and s['completa'] and s['larghezzaNaturale'] > 0, s)
        # il logo è inquadrato sul disegno (viewBox 76 76 1042 252): alto 88 pixel, largo 88 x 1042 / 252 = 364 circa
        b.ok('alto 88 pixel con le proporzioni del disegno (circa 364 di larghezza)', s and s['h'] == 88 and abs(s['w'] - 364) <= 2, s)
        b.chiudi_dialoghi(); b.attendi(300)
    prova(b, 'Finestra Informazioni', informazioni)

    e = b.errori_pagina()
    b.ok('nessun errore nella console (la CSP non blocca i loghi)', len(e) == 0, e[:3])
