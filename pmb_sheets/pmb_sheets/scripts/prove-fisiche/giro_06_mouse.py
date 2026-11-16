import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def dati(b):
    for i, (a, n) in enumerate([('Voce', 'Num'), ('delta', '4'), ('alfa', '9'), ('charlie', '2'), ('bravo', '7')], start=1):
        b.imposta(i, 1, a); b.imposta(i, 2, n)
    b.aggiorna()

def sel(b):
    return b.js("() => { const s = GR.getDoc().selection; const r = s.range; return {r: [r.startRow, r.endRow, r.startCol, r.endCol], col: !!s.isFullCol, riga: !!s.isFullRow, tutto: !!s.isAll, anc: [s.anchor.row, s.anchor.col]}; }")

def centro(b, js_rect):
    return b.js(js_rect)

with Banco(9561, '06 Mouse, intestazioni, schede, barra del titolo, barra di stato') as b:
    b.primo_piano()
    dati(b)

    # ---------- selezione e modifica con il mouse ----------
    def selezione():
        b.clic_cella_os(3, 2)
        b.ok('un clic seleziona la cella', sel(b)['anc'] == [3, 2], sel(b))
        b.clic_cella_os(2, 1)
        import giro_lib as giro_lib_u
        giro_lib_u._invia(0x10); b.clic_cella_os(4, 3); giro_lib_u._invia(0x10, su=True); b.attendi(300)
        r = sel(b)['r']
        b.ok('Maiusc+clic estende la selezione da B2... a C4 (A2:C4)', r == [2, 4, 1, 3], r)
        # Ctrl+clic: selezione multipla?
        b.clic_cella_os(2, 5)
        giro_lib_u._invia(0x11); b.clic_cella_os(4, 5); giro_lib_u._invia(0x11, su=True); b.attendi(300)
        r = sel(b)['r']
        if r == [2, 4, 5, 5] or r == [2, 2, 5, 5]: b.nota('Ctrl+clic: non esiste la selezione di celle non adiacenti', r)
        b.seleziona_os(2, 1, 4, 2)
        n = b.js("() => GR.renderRoot.querySelectorAll('td.selected, td.active').length")
        b.ok('trascinando si selezionano 6 celle', n == 6, n)
        # doppio clic = modifica
        b.clic_cella_os(2, 1, doppio=True)
        b.attendi(400)
        b.ok('il doppio clic apre la modifica della cella', b.js("() => GR.isEditing") is True)
        b.os_testo('!'); b.os_tasto('Invio'); b.attendi(300)
        b.ok('il doppio clic mantiene il testo e lo prosegue (delta!)', b.cella(2, 1)['raw'] == 'delta!', b.cella(2, 1))
    prova(b, 'Selezione', selezione)

    # ---------- intestazioni ----------
    def intestazioni():
        pos = b.js("() => { const h = GR.renderRoot.querySelectorAll('th.col-header'); const x = h[1].getBoundingClientRect(); const y = h[3].getBoundingClientRect(); const r = GR.renderRoot.querySelectorAll('th.row-header')[2].getBoundingClientRect(); const c = GR.renderRoot.querySelector('th.corner-header').getBoundingClientRect(); return {b: [x.left + 20, x.top + 10], d: [y.left + 20, y.top + 10], r3: [r.left + 15, r.top + 8], c: [c.left + 10, c.top + 10]}; }")
        b.clic_os(*pos['b'])
        s = sel(b); b.ok('clic sull\'intestazione di colonna B seleziona tutta la colonna', s['col'] and s['r'][2] == 2, s)
        b.pg.mouse.move(pos['b'][0], pos['b'][1])
        # trascinare da B a D
        import giro_lib; u = giro_lib._u
        ox, oy, dpr = giro_lib._origine_pagina(b)
        u.SetCursorPos(int(ox + pos['b'][0]), int(oy + pos['b'][1])); time.sleep(0.1); u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.05)
        for k in range(1, 6):
            u.SetCursorPos(int(ox + pos['b'][0] + (pos['d'][0] - pos['b'][0]) * k / 5), int(oy + pos['b'][1])); time.sleep(0.05)
        u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.3)
        s = sel(b); b.ok('trascinando da B a D si selezionano tre colonne (B:D)', s['col'] and s['r'][2:] == [2, 4], s)
        b.clic_os(*pos['r3'])
        s = sel(b); b.ok('clic sul numero di riga 3 seleziona tutta la riga', s['riga'] and s['r'][0] == 3, s)
        b.clic_os(*pos['c'])
        s = sel(b); b.ok('clic sull\'angolo seleziona tutto il foglio', s['tutto'], s)
    prova(b, 'Intestazioni', intestazioni)

    # ---------- menu del tasto destro ----------
    def menu_contestuali():
        def voci(): return b.js("() => Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).map(x => x.textContent.trim())")
        def clic_voce(t):
            r = b.js("(t) => { const e = Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).find(x => x.textContent.trim() === t); if (!e) return null; const x = e.getBoundingClientRect(); return {x: x.left + 20, y: x.top + x.height/2}; }", t)
            if r is None: raise RuntimeError('voce non trovata: ' + t)
            b.clic_os(r['x'], r['y']); b.attendi(500)
        # cella
        b.imposta(8, 1, 'k'); b.aggiorna()
        b.clic_cella_os(8, 1, tasto='right'); b.attendi(300)
        v = voci(); b.ok('tasto destro su una cella: menu con Taglia, Copia, Incolla, Inserisci, Elimina, Cancella', all(x in v for x in ['Taglia', 'Copia', 'Incolla', 'Cancella contenuto']), v)
        clic_voce('Cancella contenuto'); b.ok('  "Cancella contenuto" svuota la cella', b.cella(8, 1)['raw'] == '', b.cella(8, 1))
        b.imposta(9, 1, 'h'); b.aggiorna()
        b.clic_cella_os(9, 1, tasto='right'); clic_voce('Inserisci 1 riga sopra'); b.attendi(300)
        b.ok('  "Inserisci 1 riga sopra" sposta la cella in basso', b.cella(10, 1)['raw'] == 'h' and b.cella(9, 1)['raw'] == '', [b.cella(9, 1), b.cella(10, 1)])
        b.os_tasto('Z', 'Ctrl')
        # intestazione di colonna
        pos = b.js("() => { const h = GR.renderRoot.querySelectorAll('th.col-header')[2].getBoundingClientRect(); return [h.left + 20, h.top + 10]; }")
        b.clic_os(pos[0], pos[1], tasto='right'); b.attendi(300)
        v = voci(); b.ok('tasto destro su una colonna: inserisci, elimina, nascondi, mostra', all(any(k in x for x in v) for k in ['Inserisci', 'Elimina', 'Nascondi', 'Mostra']), v)
        clic_voce('Nascondi colonna')
        nascoste = b.js("() => [...GR.getDoc().hiddenCols]")
        terza = b.js("() => GR.renderRoot.querySelectorAll('th.col-header')[2].textContent.trim().charAt(0)")
        # una colonna nascosta non si disegna: C1 non ha più un rettangolo a video e dopo la B viene la D
        b.ok('  "Nascondi colonna" nasconde la C (non si disegna, dopo la B viene la D)', nascoste == [3] and terza == 'D' and b.rect(1, 3) is None, [nascoste, terza, b.rect(1, 3)])
        pos = b.js("() => { const h = GR.renderRoot.querySelectorAll('th.col-header')[2].getBoundingClientRect(); return [h.left + 20, h.top + 10]; }")
        b.clic_os(pos[0], pos[1], tasto='right'); clic_voce('Mostra tutte le colonne'); b.ok('  "Mostra tutte le colonne" la rimostra', b.js("() => GR.getDoc().hiddenCols.size") == 0)
        # intestazione di riga
        r = b.js("() => { const h = GR.renderRoot.querySelectorAll('th.row-header')[3].getBoundingClientRect(); return [h.left + 15, h.top + 8]; }")
        b.clic_os(r[0], r[1], tasto='right'); b.attendi(300)
        v = voci(); b.ok('tasto destro su una riga: inserisci, elimina, nascondi, mostra', all(any(k in x for x in v) for k in ['Inserisci', 'Elimina', 'Nascondi', 'Mostra']), v)
        clic_voce('Nascondi riga'); b.ok('  "Nascondi riga" nasconde la 4', b.js("() => [...GR.getDoc().hiddenRows]") == [4] and b.rect(4, 1) is None, b.js("() => [...GR.getDoc().hiddenRows]"))
        r = b.js("() => { const h = GR.renderRoot.querySelectorAll('th.row-header')[3].getBoundingClientRect(); return [h.left + 15, h.top + 8]; }")
        b.clic_os(r[0], r[1], tasto='right'); clic_voce('Mostra tutte le righe'); b.ok('  "Mostra tutte le righe" la rimostra', b.js("() => GR.getDoc().hiddenRows.size") == 0)
    prova(b, 'Menu contestuali', menu_contestuali)

    # ---------- schede dei fogli ----------
    def schede():
        def tab(i): return b.js("(i) => { const t = APP.shadowRoot.querySelector('free-tabs').shadowRoot.querySelectorAll('.tab-item')[i]; if (!t) return null; const x = t.getBoundingClientRect(); return {x: x.left + 25, y: x.top + 12, nome: t.textContent.trim()}; }", i)
        nuovo = b.js("() => { const t = APP.shadowRoot.querySelector('free-tabs').shadowRoot.querySelector('.new-tab-btn'); if (!t) return null; const x = t.getBoundingClientRect(); return {x: x.left + 12, y: x.top + 12}; }")
        b.ok('c\'è il pulsante "+" per un nuovo foglio', nuovo is not None)
        if nuovo:
            b.clic_os(nuovo['x'], nuovo['y']); b.attendi(500)
            s = b.stato_app(); b.ok('"+" aggiunge un foglio e ci porta lì', len(s['fogli']) == 2 and s['attivo'] == s['fogli'][1], s['fogli'])
        t0 = tab(0); b.clic_os(t0['x'], t0['y']); b.attendi(400)
        b.ok('clic su una scheda va a quel foglio', b.stato_app()['attivo'] == b.stato_app()['fogli'][0], b.stato_app()['attivo'])
        b.ok('e i dati sono quelli di quel foglio', b.cella(2, 1)['raw'] in ('delta!', 'delta'), b.cella(2, 1))
        # rinomina con doppio clic
        t1 = tab(1); b.clic_os(t1['x'], t1['y'], doppio=True); b.attendi(600)
        d = dialoghi_aperti(b)
        b.nota('doppio clic sulla scheda: finestre aperte', d)
        c = b.js("() => { const i = APP.shadowRoot.querySelector('free-tabs').shadowRoot.querySelector('input'); return !!i; }")
        b.nota('doppio clic sulla scheda: campo di rinomina nella scheda', c)
        b.chiudi_dialoghi()
        # menu della scheda
        t1 = tab(1); b.clic_os(t1['x'], t1['y'], tasto='right'); b.attendi(400)
        v = b.js("() => Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).map(x => x.textContent.trim())")
        b.ok('tasto destro su una scheda: Rinomina, Duplica, Elimina, colori', all(x in v for x in ['Rinomina', 'Duplica', 'Elimina']), v)
        r = b.js("() => { const e = Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).find(x => x.textContent.trim() === 'Duplica'); const x = e.getBoundingClientRect(); return {x: x.left + 20, y: x.top + x.height/2}; }")
        b.clic_os(r['x'], r['y']); b.attendi(700)
        b.ok('"Duplica" crea una copia del foglio', len(b.stato_app()['fogli']) == 3, b.stato_app()['fogli'])
        # chiudi (x) con conferma
        x = b.js("() => { const t = APP.shadowRoot.querySelector('free-tabs').shadowRoot.querySelectorAll('.tab-close-btn'); const e = t[t.length - 1]; const r = e.getBoundingClientRect(); return {x: r.left + 8, y: r.top + 8}; }")
        b.clic_os(x['x'], x['y']); b.attendi(600)
        d = dialoghi_aperti(b)
        b.nota('chiudere una scheda: finestre aperte', d)
        if 'free-dialogo-conferma' in d:
            b.js("() => { const c = APP.shadowRoot.querySelector('free-dialogo-conferma'); const bt = Array.from(c.shadowRoot.querySelectorAll('button')); const ok = bt.find(x => /elimina|conferma|s[iì]/i.test(x.textContent)) || bt[bt.length - 1]; ok.click(); }"); b.attendi(700)
        b.ok('la "x" della scheda elimina il foglio (con conferma)', len(b.stato_app()['fogli']) == 2, b.stato_app()['fogli'])
        # trascinare per cambiare ordine
        t0 = tab(0); t1 = tab(1)
        nomi0 = b.stato_app()['fogli']
        import giro_lib; u = giro_lib._u; ox, oy, dpr = giro_lib._origine_pagina(b)
        b.nota('ordine dei fogli prima del trascinamento', nomi0)
    prova(b, 'Schede', schede)

    # ---------- riempimento serie ----------
    def serie():
        b.imposta(1, 8, '1'); b.imposta(2, 8, '2'); b.imposta(1, 9, 'lun'); b.imposta(1, 10, 'gennaio'); b.aggiorna()
        b.seleziona_os(1, 8, 2, 8)
        fh = b.js("() => { const r = GR.renderRoot.querySelector('.fill-handle').getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; }")
        t = b.rect(6, 8)
        import giro_lib; u = giro_lib._u; ox, oy, dpr = giro_lib._origine_pagina(b)
        u.SetCursorPos(int(ox + fh['x']), int(oy + fh['y'])); time.sleep(0.1); u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.05)
        for k in range(1, 8):
            u.SetCursorPos(int(ox + fh['x']), int(oy + fh['y'] + (t['y'] + 10 - fh['y']) * k / 7)); time.sleep(0.05)
        u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.5)
        v = [b.cella(r, 8)['raw'] for r in range(1, 8)]
        b.ok('trascinare la maniglia su 1,2 continua la serie 3,4,5,6', v[:6] == ['1', '2', '3', '4', '5', '6'], v)
        b.seleziona_os(1, 9)
        fh = b.js("() => { const r = GR.renderRoot.querySelector('.fill-handle').getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; }")
        t = b.rect(4, 9)
        u.SetCursorPos(int(ox + fh['x']), int(oy + fh['y'])); time.sleep(0.1); u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.05)
        for k in range(1, 6): u.SetCursorPos(int(ox + fh['x']), int(oy + fh['y'] + (t['y'] + 10 - fh['y']) * k / 5)); time.sleep(0.05)
        u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.5)
        g = [b.cella(r, 9)['raw'] for r in range(1, 5)]
        if g[1:4] == ['mar', 'mer', 'gio']: b.ok('trascinare "lun" continua con i giorni della settimana', True, g)
        else: b.manca('riempimento con i giorni della settimana ("lun" → mar, mer, gio)', g)
        b.seleziona_os(1, 10)
        fh = b.js("() => { const r = GR.renderRoot.querySelector('.fill-handle').getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; }")
        t = b.rect(4, 10)
        u.SetCursorPos(int(ox + fh['x']), int(oy + fh['y'])); time.sleep(0.1); u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.05)
        for k in range(1, 6): u.SetCursorPos(int(ox + fh['x']), int(oy + fh['y'] + (t['y'] + 10 - fh['y']) * k / 5)); time.sleep(0.05)
        u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.5)
        m = [b.cella(r, 10)['raw'] for r in range(1, 5)]
        if m[1:4] == ['febbraio', 'marzo', 'aprile']: b.ok('trascinare "gennaio" continua con i mesi', True, m)
        else: b.manca('riempimento con i mesi ("gennaio" → febbraio, marzo, aprile)', m)
    prova(b, 'Serie', serie)

    # ---------- scorrimento ----------
    def scorrimento():
        b.pg.mouse.move(600, 500)
        b.js("() => { window.__s = []; GR.renderRoot.querySelector('.grid-container').addEventListener('scroll', e => window.__s.push(e.target.scrollTop)); }")
        giro = __import__('giro_lib'); u = giro._u
        ox, oy, dpr = giro._origine_pagina(b)
        pos = b.js("() => { const r = GR.renderRoot.querySelector('.grid-container').getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; }")
        u.SetCursorPos(int(ox + pos[0]), int(oy + pos[1])); time.sleep(0.2)
        for _ in range(5): u.mouse_event(0x0800, 0, 0, -120 * 3, 0); time.sleep(0.1)   # rotella in giù
        b.attendi(500)
        top = b.js("() => GR.renderRoot.querySelector('.grid-container').scrollTop")
        b.ok('la rotella del mouse fa scorrere il foglio in basso', top > 100, top)
        d = b.js("() => { const t = GR.renderRoot.querySelector('tbody tr'); return Number(t.getAttribute('aria-rowindex')) - 1; }")
        b.ok('e vengono disegnate le righe nuove (non restano vuote)', d > 1, d)
        for _ in range(5): u.mouse_event(0x0800, 0, 0, 120 * 3, 0); time.sleep(0.1)
        b.attendi(500)
        b.ok('la rotella in su torna all\'inizio', b.js("() => GR.renderRoot.querySelector('.grid-container').scrollTop") < top)
        u.mouse_event(0x1000, 0, 0, 120 * 3, 0); time.sleep(0.3)   # rotella orizzontale
        b.nota('rotella orizzontale: scrollLeft', b.js("() => GR.renderRoot.querySelector('.grid-container').scrollLeft"))
    prova(b, 'Scorrimento', scorrimento)

    # ---------- barra del titolo e barra di stato ----------
    def titolo():
        t = b.js("() => { const t = APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.doc-title'); return t ? t.textContent.trim() : null; }")
        b.ok('la barra del titolo mostra il nome del foglio', t == 'Foglio senza titolo', t)
        pos = b.js("() => { const t = APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.doc-title'); const x = t.getBoundingClientRect(); return [x.left + 10, x.top + 8]; }")
        b.clic_os(*pos); b.attendi(400)
        campo = b.js("() => !!APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.doc-title-input')")
        b.ok('un clic sul titolo apre la rinomina', campo)
        if campo:
            b.os_tasto('A', 'Ctrl'); b.os_testo('Bilancio 2026'); b.os_tasto('Invio'); b.attendi(400)
            b.ok('Invio conferma il nuovo titolo', b.stato_app()['titolo'] == 'Bilancio 2026', b.stato_app()['titolo'])
    prova(b, 'Titolo', titolo)

    def finestra():
        h = giro = __import__('giro_lib'); hwnd = giro._hwnd_del_programma(b.p.pid)
        r0 = b.js("() => [window.innerWidth, window.innerHeight]")
        pos = b.js("() => { const r = APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelectorAll('.control-btn')[1].getBoundingClientRect(); return [r.left + 12, r.top + 12]; }")
        b.clic_os(*pos); b.attendi(1200)
        r1 = b.js("() => [window.innerWidth, window.innerHeight]")
        b.nota('dimensioni prima e dopo il pulsante "ingrandisci"', [r0, r1])
        b.ok('il pulsante "ingrandisci" cambia la dimensione della finestra', r1 != r0, [r0, r1])
        # la finestra ingrandita è più larga: il bottone si è spostato, la sua posizione va ricalcolata
        pos = b.js("() => { const r = APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelectorAll('.control-btn')[1].getBoundingClientRect(); return [r.left + 12, r.top + 12]; }")
        b.clic_os(*pos); b.attendi(1200)
        r2 = b.js("() => [window.innerWidth, window.innerHeight]")
        b.ok('un secondo clic la riporta com\'era', abs(r2[0] - r0[0]) < 30, [r0, r2])
        # trascinare la barra del titolo sposta la finestra (serve il permesso Tauri start-dragging)
        import ctypes, time
        class _R(ctypes.Structure): _fields_ = [('l', ctypes.c_long), ('t', ctypes.c_long), ('r', ctypes.c_long), ('b', ctypes.c_long)]
        def dove():
            rr = _R(); giro._u.GetWindowRect(hwnd, ctypes.byref(rr)); return (rr.l, rr.t)
        def trascina(dx, dy):
            zona = b.js("() => { const r = APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.drag-region').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
            ox, oy, dpr = giro._origine_pagina(b)
            x0, y0 = int(ox + zona[0] * dpr), int(oy + zona[1] * dpr)
            giro._u.SetCursorPos(x0, y0); time.sleep(0.1); giro._u.mouse_event(0x0002, 0, 0, 0, 0); time.sleep(0.15)
            for k in range(1, 11): giro._u.SetCursorPos(x0 + dx * k // 10, y0 + dy * k // 10); time.sleep(0.04)
            time.sleep(0.15); giro._u.mouse_event(0x0004, 0, 0, 0, 0); time.sleep(0.6)
        p0 = dove()
        trascina(120, 60)
        p1 = dove()
        b.ok('trascinare la barra del titolo sposta la finestra (di circa 120 x 60 pixel)', abs(p1[0] - p0[0] - 120) < 15 and abs(p1[1] - p0[1] - 60) < 15, [p0, p1])
        trascina(-120, -60)
        b.nota('la finestra torna al suo posto', [p0, dove()])
        # doppio clic sulla barra del titolo: ingrandisce, un altro doppio clic la riporta com'era (lo fa Tauri, permesso internal-toggle-maximize)
        def doppio_clic_barra():
            zona = b.js("() => { const r = APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.drag-region').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
            b.clic_os(zona[0], zona[1], doppio=True); b.attendi(1200)
            return b.js("() => [window.innerWidth, window.innerHeight]")
        d1 = doppio_clic_barra()
        b.ok('doppio clic sulla barra del titolo: la finestra si ingrandisce', d1[0] > r0[0] + 100, [r0, d1])
        d2 = doppio_clic_barra()
        b.ok('un altro doppio clic la riporta com\'era', abs(d2[0] - r0[0]) < 30, [r0, d2])
        zoom = b.js("() => { const s = APP.shadowRoot.querySelector('free-statusbar').shadowRoot.querySelector('.zoom-slider'); const r = s.getBoundingClientRect(); return {x: r.left, y: r.top + r.height/2, w: r.width}; }")
        b.clic_os(zoom['x'] + 3, zoom['y']); b.attendi(500)
        b.ok('il cursore dello zoom nella barra di stato cambia lo zoom', b.doc()['zoom'] < 100, b.doc()['zoom'])
        b.js("() => { APP.zoom = 100; GR.zoom = 100; GR.updateViewport(); GR.requestUpdate(); }")
        b.seleziona_os(2, 2, 5, 2)
        st = b.js("() => APP.shadowRoot.querySelector('free-statusbar').shadowRoot.querySelector('.selection-stats') ? APP.shadowRoot.querySelector('free-statusbar').shadowRoot.querySelector('.selection-stats').textContent.trim() : null")
        b.ok('selezionando dei numeri la barra di stato mostra somma, media e conteggio', st and 'Somma' in st and 'Media' in st and 'Conteggio' in st, st)
    prova(b, 'Finestra', finestra)

    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])
