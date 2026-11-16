import sys, os, time, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
from PIL import Image

def clic_giusto(b, r, c, tentativi=15):
    for _ in range(tentativi):
        b.clic_cella_os(r, c)
        if b.js("() => { const s = GR.getDoc().selection.anchor; return [s.row, s.col]; }") == [r, c]: return True
    return False

def rossi(b, selettore):
    r = b.js("(s) => { const e = GR.renderRoot.querySelector(s); const x = e.getBoundingClientRect(); return {x: x.left, y: x.top, w: x.width, h: x.height}; }", selettore)
    png = b.pg.screenshot(clip={'x': max(0, r['x']), 'y': max(0, r['y']), 'width': max(10, r['w']), 'height': max(10, r['h'])})
    im = Image.open(io.BytesIO(png)).convert('RGB')
    n = 0
    for px in im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata():
        if px[0] > 170 and px[1] < 90 and px[2] < 90: n += 1
    return n

with Banco(9615, '15 Controllo ortografico') as b:
    b.primo_piano()
    def prova_ort():
        lingua = b.js("() => { const i = GR.renderRoot.querySelector('input.formula-input'); return [i.getAttribute('lang'), i.getAttribute('spellcheck'), navigator.languages]; }")
        b.nota('lingua del programma, correttore, lingue di Windows', lingua)
        b.os_tasto('F7'); b.attendi(600)
        msg = b.js("() => APP.statusMessage")
        b.nota('messaggio dopo F7 (caso reale di questo PC)', msg)
        spento = b.js("() => GR.renderRoot.querySelector('input.formula-input').getAttribute('spellcheck')")
        if lingua[0] == 'it' and not any(str(l).lower().startswith('it') for l in lingua[2]):
            b.ok('senza dizionario italiano F7 non accende e spiega come aggiungerlo', 'dizionario italiano' in msg and 'Impostazioni' in msg and spento == 'false', [msg, spento])
        # si simula Windows con l'italiano: il correttore del sistema qui conosce solo l'inglese, ma si vede che le sottolineature compaiono nel campo della cella
        b.js("() => { Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'en-GB', 'en'], configurable: true }); }")
        b.os_tasto('F7'); b.attendi(600)
        msg = b.js("() => APP.statusMessage")
        b.ok("con l'italiano disponibile F7 accende", 'acceso' in msg, msg)
        clic_giusto(b, 2, 2)
        b.os_testo('wrold helllo teh xxyy '); b.attendi(500)
        sp = b.js("() => GR.renderRoot.querySelector('.cell-editor-overlay').getAttribute('spellcheck')")
        b.ok('il campo di scrittura ha spellcheck acceso', sp == 'true', sp)
        b.js("() => { const x = GR.renderRoot.querySelector('.cell-editor-overlay'); x.style.width = '400px'; x.style.fontSize = '16px'; x.style.height = '30px'; }")
        n_on = 0; t0 = time.time()
        while time.time() - t0 < 12:
            n_on = rossi(b, '.cell-editor-overlay')
            if n_on > 15: break
            b.attendi(1000)
        b.nota('pixel rossi nel campo della cella con il correttore acceso (e dopo quanti secondi)', [n_on, round(time.time() - t0, 1)])
        b.os_tasto('Esc'); b.attendi(400)
        # una formula non viene controllata
        clic_giusto(b, 3, 2)
        b.os_testo('=SOMMA(A1:A3)+perrche'); b.attendi(2500)
        sp2 = b.js("() => GR.renderRoot.querySelector('.cell-editor-overlay').getAttribute('spellcheck')")
        b.ok('scrivendo una formula il correttore resta spento', sp2 == 'false', sp2)
        b.os_tasto('Esc'); b.attendi(300)
        b.os_tasto('F7'); b.attendi(500)
        msg = b.js("() => APP.statusMessage")
        b.ok('secondo F7: "spento"', 'spento' in msg, msg)
        clic_giusto(b, 4, 2)
        b.os_testo('wrold helllo teh xxyy '); b.attendi(500)
        b.js("() => { const x = GR.renderRoot.querySelector('.cell-editor-overlay'); x.style.width = '400px'; x.style.fontSize = '16px'; x.style.height = '30px'; }"); b.attendi(7000)
        n_off = rossi(b, '.cell-editor-overlay')
        b.os_tasto('Esc'); b.attendi(300)
        b.nota('pixel rossi con il correttore spento', n_off)
        b.ok('le sottolineature rosse compaiono solo con il correttore acceso', n_on > n_off + 15, [n_on, n_off])
    prova(b, 'Ortografia', prova_ort)
    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
