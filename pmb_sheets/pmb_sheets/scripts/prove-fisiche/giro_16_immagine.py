import sys, os, time, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L
from PIL import Image, ImageDraw

def png(w, h):
    im = Image.new('RGB', (w, h), (230, 60, 60)); d = ImageDraw.Draw(im); d.rectangle([w // 4, h // 4, w * 3 // 4, h * 3 // 4], fill=(30, 100, 220))
    buf = io.BytesIO(); im.save(buf, 'PNG'); return list(buf.getvalue())

LISTA = "() => Array.from(GR.getDoc().immagini).map(i => ({id: i.id, x: i.x, y: i.y, w: i.width, h: i.height, f: i.sheetName, n: i.nome}))"
def imgs(b): return b.js(LISTA)

def trascina(b, x1, y1, x2, y2):
    ox, oy, dpr = L._origine_pagina(b)
    pos = lambda x, y: (int(ox + x * dpr), int(oy + y * dpr))
    L._u.SetCursorPos(*pos(x1, y1)); time.sleep(0.1)
    L._u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.08)
    for k in range(1, 9):
        L._u.SetCursorPos(*pos(x1 + (x2 - x1) * k / 8, y1 + (y2 - y1) * k / 8)); time.sleep(0.05)
    L._u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.4)

def centro(b):
    return b.js("() => { const e = GR.renderRoot.querySelector('free-immagine-overlay'); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.right - 5, r.bottom - 5, r.left, r.top, r.width, r.height]; }")

def apri_con(b, nome, byte_list):
    b.js("(x) => { window.__aprire = {nome: x[0], bytes: x[1]}; }", [nome, byte_list])
    b.menu('File', 'Apri...'); b.attendi(2500)

with Banco(9620, '16 Immagini') as b:
    b.primo_piano()
    b.imposta(1, 1, 'dati'); b.aggiorna()

    def inserisci():
        b.js("(x) => { window.__aprire = {nome: 'prova.png', bytes: x}; }", png(300, 200))
        b.menu('Inserisci', 'Immagine'); b.attendi(1500)
        msg = b.js("() => APP.statusMessage"); lista = imgs(b)
        b.ok("Inserisci > Immagine mette l'immagine sul foglio e lo dice", len(lista) == 1 and 'prova.png' in msg, [msg[:80], lista])
        b.ok('300x200 entra a misura naturale', bool(lista) and lista[0]['w'] == 300 and lista[0]['h'] == 200, lista)
        vista = b.js("() => { const o = GR.renderRoot.querySelector('free-immagine-overlay'); const i = o.shadowRoot.querySelector('img'); return {sel: o.hasAttribute('selected'), nat: [i.naturalWidth, i.naturalHeight], ok: i.complete, src: i.src.slice(0, 22)}; }")
        b.ok('si vede davvero (immagine decodificata 300x200) ed è selezionata', vista['sel'] and vista['nat'] == [300, 200] and vista['ok'] and vista['src'] == 'data:image/png;base64,', vista)
        r = centro(b)
        b.ok('sta sopra le celle, in vista', 0 < r[4] < 1500 and 0 < r[5] < 900, r)
    prova(b, 'Inserire', inserisci)

    def muovi():
        p0 = p1 = None
        for _ in range(6):
            p0 = imgs(b)[0]; r = centro(b)
            trascina(b, r[0], r[1], r[0] + 90, r[1] + 50)
            p1 = imgs(b)[0]
            if abs((p1['x'] - p0['x']) - 90) <= 3 and abs((p1['y'] - p0['y']) - 50) <= 3: break
            b.js("() => { const d = GR.getDoc(); }")
        b.ok('trascinandola col mouse si sposta di 90 e 50 pixel', abs((p1['x'] - p0['x']) - 90) <= 3 and abs((p1['y'] - p0['y']) - 50) <= 3, [p0, p1])
        q0 = q1 = None
        for _ in range(6):
            q0 = imgs(b)[0]; r = centro(b)
            trascina(b, r[2], r[3], r[2] + 60, r[3] + 30)
            q1 = imgs(b)[0]
            if abs((q1['w'] - q0['w']) - 60) <= 3 and abs((q1['h'] - q0['h']) - 30) <= 3: break
        b.ok("trascinando l'angolo si ridimensiona di 60 e 30 pixel", abs((q1['w'] - q0['w']) - 60) <= 3 and abs((q1['h'] - q0['h']) - 30) <= 3, [q0, q1])
        b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        a = imgs(b)[0]
        b.ok('Ctrl+Z annulla il ridimensionamento', a['w'] == q0['w'] and a['h'] == q0['h'], [a, q0])
        b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        a = imgs(b)[0]
        b.ok('un altro Ctrl+Z annulla lo spostamento', a['x'] == p0['x'] and a['y'] == p0['y'], [a, p0])
    prova(b, 'Spostare e ridimensionare', muovi)

    def elimina():
        for _ in range(6):
            r = centro(b); L._clic_os(b, r[0], r[1])
            if b.js("() => GR.renderRoot.querySelector('free-immagine-overlay').hasAttribute('selected')"): break
        b.os_tasto('Canc'); b.attendi(500)
        b.ok("Canc con l'immagine selezionata la elimina", len(imgs(b)) == 0, imgs(b))
        b.ok('la cella con il testo resta', b.cella(1, 1)['raw'] == 'dati', b.cella(1, 1))
        b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        b.ok('Ctrl+Z la riporta', len(imgs(b)) == 1, imgs(b))
    prova(b, 'Eliminare', elimina)

    def salva_e_apri():
        n0 = len(b.salvati()); b.menu('File', 'Scarica come pmb_sheets (.psheet)'); b.attendi(1500)
        s = b.salvati()
        b.ok('il salvataggio in .psheet riesce', len(s) == n0 + 1, s)
        byte_list = b.js("(i) => window.__salvati[i].bytes", len(s) - 1)
        b.menu('File', 'Nuovo foglio di calcolo'); b.attendi(600)
        if 'free-dialogo-conferma' in dialoghi_aperti(b):
            b.js("() => { const c = APP.shadowRoot.querySelector('free-dialogo-conferma'); Array.from(c.shadowRoot.querySelectorAll('button')).find(x => /non salvare/i.test(x.textContent)).click(); }"); b.attendi(800)
        b.ok('dopo "Nuovo" non ci sono immagini', len(imgs(b)) == 0, imgs(b))
        apri_con(b, 'giro.psheet', byte_list)
        lista = imgs(b)
        b.ok("riaprendo il file l'immagine torna, con nome e misure", len(lista) == 1 and lista[0]['n'] == 'prova.png' and lista[0]['w'] >= 300, lista)
        vista = b.js("() => { const o = GR.renderRoot.querySelector('free-immagine-overlay'); if (!o) return null; const i = o.shadowRoot.querySelector('img'); return [i.complete, i.naturalWidth, i.naturalHeight]; }")
        b.ok('e si vede ancora (decodificata 300x200)', vista == [True, 300, 200], vista)
    prova(b, 'Salvare e riaprire', salva_e_apri)

    def non_immagine():
        n_prima = len(imgs(b))
        b.js("() => { window.__aprire = {nome: 'finta.png', bytes: Array.from(new TextEncoder().encode('<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>'))}; }")
        b.menu('Inserisci', 'Immagine'); b.attendi(1200)
        msg = b.js("() => APP.statusMessage")
        b.ok("un file che finge di essere .png (in realtà SVG con script) viene rifiutato", len(imgs(b)) == n_prima and "non è un'immagine" in msg, [msg, len(imgs(b))])
    prova(b, 'File non valido', non_immagine)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
