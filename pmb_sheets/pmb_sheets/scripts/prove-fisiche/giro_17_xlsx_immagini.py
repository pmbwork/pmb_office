import sys, os, io, time, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import openpyxl
from openpyxl.drawing.image import Image as XlImage
from PIL import Image, ImageDraw

CART = tempfile.mkdtemp(prefix='giro17_')

def png_bytes(w, h, colore=(230, 60, 60)):
    im = Image.new('RGB', (w, h), colore); d = ImageDraw.Draw(im); d.rectangle([w // 4, h // 4, w * 3 // 4, h * 3 // 4], fill=(30, 100, 220))
    buf = io.BytesIO(); im.save(buf, 'PNG'); return buf.getvalue()

LISTA = "() => Array.from(GR.getDoc().immagini).map(i => ({x: i.x, y: i.y, w: i.width, h: i.height, f: i.sheetName, n: i.nome}))"

with Banco(9621, '17 Immagini in .xlsx (verifica con openpyxl)') as b:
    b.primo_piano()
    b.imposta(1, 1, 'dati'); b.aggiorna()

    def scrivi():
        b.js("(x) => { window.__aprire = {nome: 'prova.png', bytes: x}; }", list(png_bytes(300, 200)))
        b.menu('Inserisci', 'Immagine'); b.attendi(1500)
        n0 = len(b.salvati())
        b.menu('File', 'Scarica come cartella di lavoro (.xlsx)'); b.attendi(2000)
        s = b.salvati()
        b.ok('il salvataggio in .xlsx riesce', len(s) == n0 + 1, s)
        msg = b.js("() => APP.statusMessage")
        b.ok("il messaggio di esportazione non dice più che le immagini si perdono", 'immagini' not in msg.lower(), msg)
        dati = bytes(b.js("(i) => window.__salvati[i].bytes", len(s) - 1))
        percorso = os.path.join(CART, 'dall_app.xlsx'); open(percorso, 'wb').write(dati)
        wb = openpyxl.load_workbook(percorso)
        ws = wb.active
        n = len(ws._images)
        b.ok('openpyxl vede 1 immagine nel foglio', n == 1, n)
        if n:
            im = ws._images[0]
            b.ok('e la legge come PNG 300x200', (im.width, im.height) == (300, 200), (im.width, im.height))
            a = im.anchor
            b.nota('tipo di ancora e posizione secondo openpyxl', [type(a).__name__, getattr(getattr(a, 'pos', None), 'x', None), getattr(getattr(a, 'pos', None), 'y', None)])
            dec = Image.open(io.BytesIO(im._data())); dec.load()
            b.ok('i byte dentro il file sono un PNG valido di 300x200', dec.size == (300, 200), dec.size)
    prova(b, 'Dall\'app a openpyxl', scrivi)

    def leggi():
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Dati'; ws['A1'] = 'ciao'
        p1 = os.path.join(CART, 'a.png'); open(p1, 'wb').write(png_bytes(120, 80))
        p2 = os.path.join(CART, 'b.png'); open(p2, 'wb').write(png_bytes(64, 64, (60, 200, 90)))
        ws.add_image(XlImage(p1), 'C5')
        ws.add_image(XlImage(p2), 'F10')
        percorso = os.path.join(CART, 'da_openpyxl.xlsx'); wb.save(percorso)
        dati = list(open(percorso, 'rb').read())
        b.menu('File', 'Nuovo foglio di calcolo'); b.attendi(600)
        if 'free-dialogo-conferma' in dialoghi_aperti(b):
            b.js("() => { const c = APP.shadowRoot.querySelector('free-dialogo-conferma'); Array.from(c.shadowRoot.querySelectorAll('button')).find(x => /non salvare/i.test(x.textContent)).click(); }"); b.attendi(800)
        b.js("(x) => { window.__aprire = {nome: 'da_openpyxl.xlsx', bytes: x}; }", dati)
        b.menu('File', 'Apri...'); b.attendi(3000)
        lista = b.js(LISTA); msg = b.js("() => APP.statusMessage")
        b.ok('il file di openpyxl con due immagini si apre con due immagini', len(lista) == 2, lista)
        b.ok('senza avvisi su grafici o disegni', 'Grafici' not in msg and 'immagin' not in msg.lower(), msg)
        if len(lista) == 2:
            l = sorted(lista, key=lambda i: i['y'])
            b.ok('misure 120x80 e 64x64', [(i['w'], i['h']) for i in l] == [(120, 80), (64, 64)], l)
            # C5 = 2 colonne e 4 righe prima: con colonne da 90 e righe da 22 (e poi le intestazioni)
            b.ok('la prima sta dove era C5 (x=2*90+44, y=4*22+24)', abs(l[0]['x'] - (2 * 90 + 44)) <= 2 and abs(l[0]['y'] - (4 * 22 + 24)) <= 2, l[0])
            b.ok('la seconda dove era F10 (x=5*90+44, y=9*22+24)', abs(l[1]['x'] - (5 * 90 + 44)) <= 2 and abs(l[1]['y'] - (9 * 22 + 24)) <= 2, l[1])
        vista = b.js("() => Array.from(GR.renderRoot.querySelectorAll('free-immagine-overlay')).map(o => { const i = o.shadowRoot.querySelector('img'); return [i.complete, i.naturalWidth, i.naturalHeight]; })")
        b.ok('e si vedono davvero (decodificate)', sorted(vista, key=lambda v: -v[1]) == [[True, 120, 80], [True, 64, 64]], vista)
    prova(b, 'Da openpyxl all\'app', leggi)

    def giro_completo():
        # app -> .xlsx -> app: l'immagine torna uguale
        b.menu('File', 'Nuovo foglio di calcolo'); b.attendi(600)
        if 'free-dialogo-conferma' in dialoghi_aperti(b):
            b.js("() => { const c = APP.shadowRoot.querySelector('free-dialogo-conferma'); Array.from(c.shadowRoot.querySelectorAll('button')).find(x => /non salvare/i.test(x.textContent)).click(); }"); b.attendi(800)
        b.js("(x) => { window.__aprire = {nome: 'g.png', bytes: x}; }", list(png_bytes(200, 100, (90, 90, 200))))
        b.menu('Inserisci', 'Immagine'); b.attendi(1500)
        prima = b.js(LISTA)
        n0 = len(b.salvati()); b.menu('File', 'Scarica come cartella di lavoro (.xlsx)'); b.attendi(2000)
        dati = b.js("(i) => window.__salvati[i].bytes", len(b.salvati()) - 1)
        b.menu('File', 'Nuovo foglio di calcolo'); b.attendi(600)
        if 'free-dialogo-conferma' in dialoghi_aperti(b):
            b.js("() => { const c = APP.shadowRoot.querySelector('free-dialogo-conferma'); Array.from(c.shadowRoot.querySelectorAll('button')).find(x => /non salvare/i.test(x.textContent)).click(); }"); b.attendi(800)
        b.js("(x) => { window.__aprire = {nome: 'g.xlsx', bytes: x}; }", dati)
        b.menu('File', 'Apri...'); b.attendi(3000)
        dopo = b.js(LISTA)
        b.ok("l'immagine fa il giro app → .xlsx → app con le stesse posizione e misure", len(dopo) == 1 and (dopo[0]['x'], dopo[0]['y'], dopo[0]['w'], dopo[0]['h']) == (prima[0]['x'], prima[0]['y'], prima[0]['w'], prima[0]['h']), [prima, dopo])
    prova(b, 'Giro completo', giro_completo)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
