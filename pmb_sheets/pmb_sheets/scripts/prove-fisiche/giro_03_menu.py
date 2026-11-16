import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def in_cima(b):
    b.js("() => { const c = GR.renderRoot.querySelector('.grid-container'); c.scrollTop = 0; c.scrollLeft = 0; GR.getDoc().scroll = {left: 0, top: 0}; GR.updateViewport(); GR.requestUpdate(); }"); b.attendi(500)

def prova(b, nome, fn):
    try:
        in_cima(b)
        fn()
    except Exception as e:
        b.esito('FAIL', nome, 'eccezione: ' + str(e)[:170])
        try: b.chiudi_dialoghi()
        except Exception: pass

def prepara(b):
    for i, (a, n) in enumerate([('Frutta', 'Numero'), ('mela', '5'), ('pera', '8'), ('kiwi', '3'), ('uva', '6')], start=1):
        b.imposta(i, 1, a); b.imposta(i, 2, n)
    b.imposta(6, 2, '=SUM(B2:B5)')
    b.aggiorna()

def stato_menu(b):
    return {'msg': b.stato_app()['msg'], 'doc': b.doc()}

with Banco(9521, '03 Menu Modifica, Visualizza, Inserisci') as b:
    b.primo_piano()
    prepara(b)

    # ================= MODIFICA =================
    def annulla_ripeti():
        b.scrivi_os(1, 4, 'prova')
        b.ok('(preparazione) scritto "prova" in D1', b.cella(1, 4)['raw'] == 'prova')
        b.menu('Modifica', 'Annulla'); b.attendi(500)
        b.ok('Modifica > Annulla toglie "prova"', b.cella(1, 4)['raw'] == '', b.cella(1, 4))
        b.menu('Modifica', 'Ripeti'); b.attendi(500)
        b.ok('Modifica > Ripeti la rimette', b.cella(1, 4)['raw'] == 'prova', b.cella(1, 4))
    prova(b, 'Annulla/Ripeti', annulla_ripeti)

    def copia_incolla():
        b.seleziona_os(2, 1, 3, 2)
        b.menu('Modifica', 'Copia'); b.attendi(500)
        b.clic_cella_os(10, 5)
        b.menu('Modifica', 'Incolla'); b.attendi(1500)
        b.ok('Modifica > Copia e Incolla copiano A2:B3 in E10:F11', [b.cella(10, 5)['raw'], b.cella(11, 6)['raw']] == ['mela', '8'], [b.cella(10, 5), b.cella(11, 6)])
        b.seleziona_os(2, 1, 2, 2)
        b.menu('Modifica', 'Taglia'); b.attendi(500)
        b.clic_cella_os(14, 5)
        b.menu('Modifica', 'Incolla'); b.attendi(1500)
        b.ok('Modifica > Taglia e Incolla spostano A2:B2 in E14:F14 e lasciano vuote A2:B2', b.cella(14, 5)['raw'] == 'mela' and b.cella(2, 1)['raw'] == '' and b.cella(2, 2)['raw'] == '', [b.cella(14, 5), b.cella(2, 1), b.cella(2, 2)])
        b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        b.ok('Ctrl+Z subito dopo una voce di menu annulla lo spostamento (A2 torna "mela")', b.cella(2, 1)['raw'] == 'mela' and b.cella(14, 5)['raw'] == '', [b.cella(2, 1), b.cella(14, 5), b.js("() => { const a = GR.renderRoot.activeElement; return a && a.className; }")])
        if b.cella(2, 1)['raw'] != 'mela':
            b.clic_cella_os(3, 3); b.os_tasto('Z', 'Ctrl'); b.attendi(500)
            b.nota('dopo aver cliccato una cella, Ctrl+Z funziona', b.cella(2, 1)['raw'])
    prova(b, 'Copia/Taglia/Incolla', copia_incolla)

    def speciale():
        # B6 ha una formula; la rendo in grassetto, poi copio e incollo in vari modi
        b.js("async () => { const d = GR.getDoc(); d.selection = {anchor:{row:6,col:2},active:{row:6,col:2},range:{startRow:6,endRow:6,startCol:2,endCol:2}}; GR.requestUpdate(); await GR.updateComplete; GR.applyFormat({bold: true}); }")
        b.attendi(300)
        b.seleziona_os(6, 2); b.os_tasto('C', 'Ctrl'); b.attendi(500)
        # il valore di B6 (=SUM(B2:B5)) al momento della copia: 22 se il taglio di A2:B2 di prima è stato annullato (come deve), non un numero fisso
        v6 = b.cella(6, 2)['v']
        atteso = str(int(v6)) if isinstance(v6, (int, float)) and float(v6).is_integer() else str(v6)
        b.clic_cella_os(20, 8); b.menu('Modifica', 'Incolla speciale', 'Solo valori'); b.attendi(1500)
        c = b.cella(20, 8); neg = b.js("() => getComputedStyle(GR.renderRoot.querySelector('td[data-row=\"20\"][data-col=\"8\"]')).fontWeight")
        b.ok(f'Incolla speciale > Solo valori: il numero di B6 ({atteso}) senza formula e senza grassetto', c['raw'] == atteso and neg not in ('700', 'bold'), [c, neg])
        b.clic_cella_os(21, 8); b.menu('Modifica', 'Incolla speciale', 'Solo formato'); b.attendi(1500)
        neg = b.js("() => getComputedStyle(GR.renderRoot.querySelector('td[data-row=\"21\"][data-col=\"8\"]')).fontWeight")
        b.ok('Incolla speciale > Solo formato: grassetto ma cella vuota', neg in ('700', 'bold') and b.cella(21, 8)['raw'] == '', [neg, b.cella(21, 8)])
        b.clic_cella_os(22, 8); b.menu('Modifica', 'Incolla speciale', 'Formule senza formato'); b.attendi(1500)
        neg = b.js("() => getComputedStyle(GR.renderRoot.querySelector('td[data-row=\"22\"][data-col=\"8\"]')).fontWeight")
        b.ok('Incolla speciale > Formule senza formato: formula ma non grassetto', b.cella(22, 8)['raw'].startswith('=SUM') and neg not in ('700', 'bold'), [b.cella(22, 8), neg])
        b.seleziona_os(2, 1, 4, 2); b.os_tasto('C', 'Ctrl'); b.attendi(500)
        b.clic_cella_os(25, 3); b.menu('Modifica', 'Incolla speciale', 'Trasposto'); b.attendi(1500)
        b.ok('Incolla speciale > Trasposto: A2:B4 diventa 2 righe x 3 colonne', [b.cella(25, 3)['raw'], b.cella(26, 3)['raw'], b.cella(25, 4)['raw']] == ['mela', '5', 'pera'], [b.cella(25, 3), b.cella(26, 3), b.cella(25, 4)])
    prova(b, 'Incolla speciale', speciale)

    def elimina():
        before = b.cella(3, 1)['raw']
        b.clic_cella_os(2, 1); b.menu('Modifica', 'Elimina riga'); b.attendi(700)
        b.ok('Modifica > Elimina riga: le righe sotto salgono', b.cella(2, 1)['raw'] == before, [before, b.cella(2, 1)])
        b.clic_cella_os(1, 1); b.menu('Modifica', 'Elimina colonna'); b.attendi(700)
        b.ok('Modifica > Elimina colonna: le colonne a destra si spostano a sinistra', b.cella(1, 1)['raw'] in ('Numero', '8', '3', ''), b.cella(1, 1))
        b.os_tasto('Z', 'Ctrl'); b.os_tasto('Z', 'Ctrl'); b.attendi(500)
    prova(b, 'Elimina', elimina)

    def sel_tutto():
        b.clic_cella_os(3, 3); b.menu('Modifica', 'Seleziona tutto'); b.attendi(300)
        b.ok('Modifica > Seleziona tutto', b.js("() => GR.getDoc().selection.isAll"), '')
    prova(b, 'Seleziona tutto', sel_tutto)

    def trova():
        b.imposta(30, 2, 'cercami'); b.imposta(80, 6, 'cercami'); b.aggiorna()
        b.clic_cella_os(3, 3)
        b.menu('Modifica', 'Trova e sostituisci'); b.attendi(500)
        pannello = b.js("() => !!GR.renderRoot.querySelector('.find-replace-bar')")
        b.ok('Modifica > Trova e sostituisci apre il pannello', pannello)
        if pannello:
            inp = b.js("() => { const r = GR.renderRoot.querySelector('.find-input').getBoundingClientRect(); return {x: r.left + 30, y: r.top + r.height/2}; }")
            b.clic_os(inp['x'], inp['y']); b.os_testo('cercami'); b.attendi(300)
            btn = b.pg.locator('free-sheet-grid .find-replace-btn', has_text='Trova').first; btn.click(); b.attendi(500)
            b.ok('"Trova" conta i risultati (2) e va a uno dei due', b.js("() => GR.findMatchesCount") == 2 and b.doc()['sel'] in ([30, 2], [80, 6]), [b.js("() => GR.findMatchesCount"), b.doc()['sel']])
            primo = b.doc()['sel']; btn.click(); b.attendi(500)
            b.ok('un altro "Trova" va all altro risultato', b.doc()['sel'] in ([30, 2], [80, 6]) and b.doc()['sel'] != primo, [primo, b.doc()['sel']])
            rep = b.js("() => { const r = GR.renderRoot.querySelector('.replace-input'); if (!r) return null; const x = r.getBoundingClientRect(); return {x: x.left + 30, y: x.top + x.height/2}; }")
            if rep is None:
                b.pg.locator('free-sheet-grid .find-replace-btn').filter(has_text='Sostituisci').first.count()
                b.nota('il campo "Sostituisci con" non si vede finché non si apre la modalità sostituzione', 'Trova e sostituisci apre solo "Trova"?')
            else:
                b.clic_os(rep['x'], rep['y']); b.os_testo('trovato'); b.attendi(300)
                b.pg.locator('free-sheet-grid .find-replace-btn', has_text='Tutto').click(); b.attendi(700)
                b.ok('"Tutto" sostituisce in tutte le celle, anche fuori vista', b.cella(30, 2)['raw'] == 'trovato' and b.cella(80, 6)['raw'] == 'trovato', [b.cella(30, 2), b.cella(80, 6)])
            b.pg.locator('free-sheet-grid .find-replace-btn', has_text='✕').click(); b.attendi(300)
            b.ok('✕ chiude il pannello', not b.js("() => !!GR.renderRoot.querySelector('.find-replace-bar')"))
    prova(b, 'Trova e sostituisci', trova)

    def temi():
        for voce, atteso in [('Tema scuro', 'dark'), ('Tema chiaro', 'light')]:
            b.menu('Visualizza', voce); b.attendi(500)
            t = b.stato_app()['tema']
            b.ok(f'Visualizza > {voce} imposta il tema {atteso}', t == atteso, t)
        b.menu('Visualizza', 'Tema di sistema'); b.attendi(500)
        b.ok('Visualizza > Tema di sistema applica un tema (chiaro o scuro)', b.stato_app()['tema'] in ('light', 'dark'), b.stato_app()['tema'])
    prova(b, 'Temi', temi)

    # ================= VISUALIZZA =================
    def blocca():
        b.clic_cella_os(4, 3)
        voci = [('Nessuna riga', (0, None)), ('1 riga', (1, None)), ('2 righe', (2, None)), ('Nessuna colonna', (None, 0)), ('1 colonna', (None, 1)), ('2 colonne', (None, 2)),
                ('Fino alla riga corrente', (4, None)), ('Fino alla colonna corrente', (None, 3)), ('Fino alla cella corrente', (4, 3))]
        for voce, (fr, fc) in voci:
            b.menu('Visualizza', 'Blocca', voce); b.attendi(400)
            d = b.doc()
            ok = (fr is None or d['fr'] == fr) and (fc is None or d['fc'] == fc)
            b.ok(f'Visualizza > Blocca > {voce}', ok, [d['fr'], d['fc']])
        b.menu('Visualizza', 'Blocca', 'Nessuna riga'); b.menu('Visualizza', 'Blocca', 'Nessuna colonna')
    prova(b, 'Blocca', blocca)

    def pannello():
        b.menu('Visualizza', 'Mostra pannello laterale'); b.attendi(500)
        b.ok('Visualizza > Mostra pannello laterale lo apre', b.stato_app()['sidebar'] is True, b.stato_app())
        b.menu('Visualizza', 'Mostra pannello laterale'); b.attendi(500)
        b.ok('lo stesso comando lo richiude', b.stato_app()['sidebar'] is False, b.stato_app())
    prova(b, 'Pannello laterale', pannello)

    def schermo_intero():
        h0 = b.js("() => [window.innerWidth, window.innerHeight]")
        b.menu('Visualizza', 'Schermo intero'); b.attendi(1200)
        h1 = b.js("() => [window.innerWidth, window.innerHeight]")
        b.nota('dimensioni della pagina prima e dopo "Schermo intero"', [h0, h1])
        b.ok('Visualizza > Schermo intero cambia le dimensioni della finestra', h1 != h0, [h0, h1])
        b.menu('Visualizza', 'Schermo intero'); b.attendi(1200)
        h2 = b.js("() => [window.innerWidth, window.innerHeight]")
        b.ok('un secondo comando torna alla dimensione di prima', abs(h2[0] - h0[0]) < 20 and abs(h2[1] - h0[1]) < 40, [h0, h2])
    prova(b, 'Schermo intero', schermo_intero)

    def zoom():
        for voce, z in [('50%', 50), ('75%', 75), ('125%', 125), ('150%', 150), ('100%', 100)]:
            larg0 = b.rect(1, 1)['w']
            b.menu('Visualizza', 'Zoom', voce); b.attendi(500)
            w = b.rect(1, 1)['w']
            b.ok(f'Visualizza > Zoom > {voce}: le celle sono larghe {90 * z / 100:.0f} px', abs(w - 90 * z / 100) < 2.5 and b.doc()['zoom'] == z, [w, b.doc()['zoom']])
    prova(b, 'Zoom', zoom)

    # ================= INSERISCI =================
    def righe_colonne():
        b.clic_cella_os(3, 3); b.imposta(3, 3, 'X'); b.aggiorna()
        b.menu('Inserisci', 'Riga sopra'); b.attendi(600)
        b.ok('Inserisci > Riga sopra: "X" scende di una riga (da C3 a C4)', b.cella(4, 3)['raw'] == 'X' and b.cella(3, 3)['raw'] == '', [b.cella(3, 3), b.cella(4, 3)])
        b.clic_cella_os(4, 3); b.menu('Inserisci', 'Riga sotto'); b.attendi(600)
        b.ok('Inserisci > Riga sotto: "X" resta in C4', b.cella(4, 3)['raw'] == 'X' and b.cella(5, 3)['raw'] == '')
        b.clic_cella_os(4, 3); b.menu('Inserisci', 'Colonna a sinistra'); b.attendi(600)
        b.ok('Inserisci > Colonna a sinistra: "X" va in D4', b.cella(4, 4)['raw'] == 'X', b.cella(4, 4))
        b.clic_cella_os(4, 4); b.menu('Inserisci', 'Colonna a destra'); b.attendi(600)
        b.ok('Inserisci > Colonna a destra: "X" resta in D4', b.cella(4, 4)['raw'] == 'X' and b.cella(4, 5)['raw'] == '')
        for _ in range(4): b.os_tasto('Z', 'Ctrl')
        b.attendi(400)
        b.ok('quattro Ctrl+Z riportano "X" in C3', b.cella(3, 3)['raw'] == 'X', b.cella(3, 3))
    prova(b, 'Righe e colonne', righe_colonne)

    def nuovo_foglio():
        n0 = len(b.stato_app()['fogli'])
        b.menu('Inserisci', 'Nuovo foglio'); b.attendi(700)
        s = b.stato_app()
        b.ok('Inserisci > Nuovo foglio aggiunge una scheda e ci porta lì', len(s['fogli']) == n0 + 1 and s['attivo'] == s['fogli'][-1], s['fogli'])
    prova(b, 'Nuovo foglio', nuovo_foglio)

    def non_fatte():
        for voce in ['Immagine', 'Tabella', 'Link']:
            prima = json.dumps([b.stato_app()['msg'], b.stato_app()['fogli'], b.js("() => GR.getDoc().charts.length")])
            selettori = b.js("() => window.__selettori")
            b.menu('Inserisci', voce); b.attendi(500)
            if voce == 'Immagine':
                # apre la scelta del file (nel banco è finta e risponde "annullato": allora il programma giustamente non fa niente)
                b.ok('Inserisci > Immagine apre la scelta del file', b.js("() => window.__selettori") == selettori + 1, b.js("() => window.__selettori"))
                continue
            dopo = json.dumps([b.stato_app()['msg'], b.stato_app()['fogli'], b.js("() => GR.getDoc().charts.length")])
            dial = b.js("() => Array.from(APP.shadowRoot.querySelectorAll('*')).filter(e => e.tagName.startsWith('FREE-DIALOGO') && e.shadowRoot && e.shadowRoot.querySelector('.velo')).map(e => e.tagName)")
            if prima == dopo and not dial: b.manca(f'Inserisci > {voce}: la voce c\'è nel menu ma non fa niente', 'nessuna finestra, nessun messaggio, nessun cambiamento')
            else: b.ok(f'Inserisci > {voce} fa qualcosa', True, dopo)
            # una finestra lasciata aperta copre la barra dei menu e blocca le sezioni dopo
            b.chiudi_dialoghi(); b.attendi(300)
        # scorciatoia Ctrl+K annunciata per "Link"
        b.clic_cella_os(2, 2); b.os_tasto('K', 'Ctrl'); b.attendi(500)
        dial = b.js("() => Array.from(APP.shadowRoot.querySelectorAll('*')).filter(e => e.tagName.startsWith('FREE-DIALOGO') && e.shadowRoot && e.shadowRoot.querySelector('.velo')).map(e => e.tagName)")
        if not dial: b.manca('Ctrl+K (annunciato nel menu per "Link") non fa niente')
        else: b.ok('Ctrl+K apre la finestra del link', True, dial)
        b.chiudi_dialoghi(); b.attendi(300)
    prova(b, 'Voci senza azione', non_fatte)

    def grafico_pivot():
        b.menu('Visualizza', 'Mostra pannello laterale') if not b.stato_app()['sidebar'] else None
        b.menu('Inserisci', 'Foglio') if False else None
        fogli = b.stato_app()['fogli']
        # torno al primo foglio con i dati
        b.js("async (n) => { await GR.switchSheet(n); }", fogli[0]); b.attendi(400)
        b.seleziona_os(1, 1, 5, 2)
        b.menu('Inserisci', 'Grafico...'); b.attendi(800)
        b.ok('Inserisci > Grafico... crea un grafico sul foglio', b.js("() => GR.getDoc().charts.length") == 1, b.js("() => GR.getDoc().charts.length"))
        b.ok('e apre il pannello laterale del grafico', b.stato_app()['sidebar'] is True, b.stato_app())
        n0 = len(b.stato_app()['fogli'])
        b.seleziona_os(1, 1, 5, 2)
        b.menu('Inserisci', 'Tabella pivot...'); b.attendi(800)
        b.ok('Inserisci > Tabella pivot... apre il pannello della pivot', b.stato_app()['sidebar'] is True)
    prova(b, 'Grafico e pivot', grafico_pivot)

    def commento():
        b.clic_cella_os(2, 1)
        b.menu('Inserisci', 'Commento'); b.attendi(600)
        ta = b.js("() => { const d = APP.shadowRoot.querySelector('free-dialogo-commento'); if (!d || !d.shadowRoot) return null; const t = d.shadowRoot.querySelector('textarea'); if (!t) return null; const r = t.getBoundingClientRect(); return {x: r.left + 20, y: r.top + 20}; }")
        b.ok('Inserisci > Commento apre la finestra del commento', ta is not None)
        if ta:
            b.clic_os(ta['x'], ta['y']); b.os_testo('nota di prova'); b.attendi(300)
            b.js("() => APP.shadowRoot.querySelector('free-dialogo-commento').shadowRoot.querySelector('[data-azione=salva]').click()"); b.attendi(600)
            c = b.js("() => { const t = GR.renderRoot.querySelector('td[data-row=\"2\"][data-col=\"1\"]'); return {cls: t.className, title: t.title}; }")
            b.ok('dopo Salva la cella ha il segno del commento e il testo nel suggerimento', 'has-comment' in c['cls'] and 'nota di prova' in c['title'], c)
    prova(b, 'Commento', commento)

    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])
