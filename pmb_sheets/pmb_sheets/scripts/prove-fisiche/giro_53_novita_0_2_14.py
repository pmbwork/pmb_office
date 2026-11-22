"""Prova fisica delle novità 0.2.14 nel pmb_sheets installato, con il mouse e la tastiera veri: Nascondi e Mostra foglio (menu della scheda,
Ctrl+Z, .xlsx con state="hidden"), Modifica › Riempi serie... (lineare con passo, date per mesi, limite), completamento automatico mentre
si scrive, Inserisci › Minigrafico (disegnato nella cella), Formato › Stili di cella. Uso: python giro_53_novita_0_2_14.py"""
import sys, os, io, zipfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def tab(b, i):
    return b.js("(i) => { const t = APP.shadowRoot.querySelector('free-tabs').shadowRoot.querySelectorAll('.tab-item')[i]; if (!t) return null; const x = t.getBoundingClientRect(); return {x: x.left + 25, y: x.top + 12, nome: t.textContent.trim()}; }", i)
def clic_voce(b, testo):
    r = b.js("(t) => { const e = Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).find(x => x.textContent.trim() === t); if (!e) return null; const x = e.getBoundingClientRect(); return {x: x.left + 20, y: x.top + x.height/2}; }", testo)
    if r is None: raise RuntimeError('voce non trovata: ' + testo)
    b.clic_os(r['x'], r['y']); b.attendi(700)
def voci(b): return b.js("() => Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).map(x => x.textContent.trim())")

with Banco(9653, '53 Novità 0.2.14') as b:
    b.primo_piano()

    def fogli():
        b.js("() => GR.handleAddSheet('Due')"); b.attendi(500)
        b.js("() => GR.handleAddSheet('Tre')"); b.attendi(500)
        b.ok('tre fogli', b.stato_app()['fogli'] == ['Foglio1', 'Due', 'Tre'], b.stato_app()['fogli'])
        t = tab(b, 1); b.clic_os(t['x'], t['y'], tasto='right'); b.attendi(400)
        b.ok('menu della scheda: c\'è «Nascondi»', 'Nascondi' in voci(b), voci(b))
        clic_voce(b, 'Nascondi')
        b.ok('«Due» nascosto: le schede sono Foglio1 e Tre', b.stato_app()['fogli'] == ['Foglio1', 'Tre'], b.stato_app()['fogli'])
        b.primo_piano(); b.os_tasto('Z', 'Ctrl'); b.attendi(600)
        b.ok('Ctrl+Z lo rimostra', b.stato_app()['fogli'] == ['Foglio1', 'Due', 'Tre'], b.stato_app()['fogli'])
        t = tab(b, 1); b.clic_os(t['x'], t['y'], tasto='right'); b.attendi(400); clic_voce(b, 'Nascondi')
        t = tab(b, 0); b.clic_os(t['x'], t['y'], tasto='right'); b.attendi(400)
        b.ok('il menu propone «Mostra «Due»»', 'Mostra «Due»' in voci(b), voci(b))
        b.primo_piano(); b.os_tasto('Esc'); b.attendi(300)
        prima = len(b.salvati())
        b.menu('File', 'Scarica come cartella di lavoro (.xlsx)'); b.attendi(1500)
        s = b.salvati()
        if len(s) == prima + 1:
            w = zipfile.ZipFile(io.BytesIO(bytes(b.js("(i) => window.__salvati[i].bytes", len(s) - 1)))).read('xl/workbook.xml').decode('utf-8')
            b.ok('[xlsx] il foglio Due con state="hidden", come Excel', '<sheet name="Due" sheetId="2" state="hidden"' in w, w[:400])
        else: b.esito('FAIL', '[xlsx] nessun file scritto', s)
        t = tab(b, 0); b.clic_os(t['x'], t['y'], tasto='right'); b.attendi(400); clic_voce(b, 'Mostra «Due»')
        b.ok('«Mostra «Due»» lo rimostra e ci va', b.stato_app()['fogli'] == ['Foglio1', 'Due', 'Tre'] and b.stato_app()['attivo'] == 'Due', b.stato_app())
        t = tab(b, 0); b.clic_os(t['x'], t['y']); b.attendi(500)
    prova(b, 'Nascondi e mostra foglio', fogli)

    def serie():
        b.scrivi_os(1, 1, '1'); b.seleziona_os(1, 1, 6, 1)
        b.menu('Modifica', 'Riempi serie...'); b.attendi(500)
        d = "APP.shadowRoot.querySelector('free-dialogo-serie')"
        b.ok('la finestra propone la serie in colonne', b.js(f"() => {d}.direzione") == 'colonne')
        b.primo_piano(); b.os_tasto('A', 'Ctrl'); b.os_testo('2,5'); b.os_tasto('Invio'); b.attendi(1000)
        v = [b.cella(r, 1)['v'] for r in range(1, 7)]
        b.ok('lineare con passo 2,5: 1; 3,5; 6; 8,5; 11; 13,5', v == [1, 3.5, 6, 8.5, 11, 13.5], v)
        b.primo_piano(); b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        b.ok('Ctrl+Z toglie la serie in un passo', [b.cella(r, 1)['raw'] for r in range(1, 4)] == ['1', '', ''], [b.cella(r, 1) for r in range(1, 4)])
        b.scrivi_os(1, 2, '31/01/2026'); b.seleziona_os(1, 2, 4, 2)
        b.menu('Modifica', 'Riempi serie...'); b.attendi(500)
        b.ok('con una data la finestra propone il tipo Data', b.js(f"() => {d}.shadowRoot.querySelector('input[value=\"data\"]').checked"))
        b.js(f"() => {d}.shadowRoot.querySelector('input[name=\"unita\"][value=\"mese\"]').click()"); b.attendi(200)
        b.js(f"() => {d}.shadowRoot.querySelector('button[data-azione=\"applica\"]').click()"); b.attendi(1000)
        t = [b.testo(r, 2) for r in range(1, 5)]
        b.ok('per mesi dal 31 gennaio: 28/02, 31/03, 30/04 (come Excel), con il formato della data', t[1].startswith('28/02') and t[2].startswith('31/03') and t[3].startswith('30/04'), t)
        b.scrivi_os(1, 3, '0'); b.clic_cella_os(1, 3)
        b.menu('Modifica', 'Riempi serie...'); b.attendi(500)
        b.js(f"() => {d}.shadowRoot.querySelector('input[data-campo=\"limite\"]').value = '5'"); b.js(f"() => {d}.shadowRoot.querySelector('button[data-azione=\"applica\"]').click()"); b.attendi(1000)
        b.ok('da una cella sola con il limite 5: 0..5 e poi niente', [b.cella(r, 3)['v'] for r in range(1, 7)] == [0, 1, 2, 3, 4, 5] and b.cella(7, 3)['raw'] == '', [b.cella(r, 3) for r in range(1, 8)])
    prova(b, 'Riempi serie', serie)

    def completamento():
        for r, v in enumerate(['Milano', 'Torino', 'Roma'], start=10): b.imposta(r, 1, v)
        b.aggiorna()
        b.clic_cella_os(13, 1); b.primo_piano(); b.os_testo('Mi'); b.attendi(600)
        ed = b.js("() => { const i = GR.renderRoot.querySelector('.cell-editor-overlay'); return i ? [i.value, i.selectionStart, i.selectionEnd] : null; }")
        b.ok('scrivendo «Mi» si propone «Milano» con «lano» selezionato', ed == ['Milano', 2, 6], ed)
        b.os_tasto('Invio'); b.attendi(400)
        b.ok('Invio accetta: A13 = Milano', b.cella(13, 1)['raw'] == 'Milano', b.cella(13, 1))
        b.clic_cella_os(14, 1); b.primo_piano(); b.os_testo('R'); b.attendi(500); b.os_tasto('Backspace'); b.attendi(200); b.os_testo('Ri'); b.attendi(500)
        ed = b.js("() => { const i = GR.renderRoot.querySelector('.cell-editor-overlay'); return i ? i.value : null; }")
        b.ok('un testo che non c\'è nella colonna non si completa', ed == 'Ri', ed)
        b.os_tasto('Esc'); b.attendi(300)
    prova(b, 'Completamento automatico', completamento)

    def minigrafico():
        for c, v in enumerate([3, 1, 4, 1, 5], start=5): b.imposta(20, c, str(v))
        b.aggiorna()
        b.seleziona_os(20, 5, 20, 9); b.menu('Inserisci', 'Minigrafico'); b.attendi(800)
        b.ok('scrive =SPARKLINE(E20:I20) nella cella dopo (J20)', b.cella(20, 10)['raw'] == '=SPARKLINE(E20:I20)', b.cella(20, 10))
        svg = b.js("() => { const t = GR.renderRoot.querySelector('td[data-row=\"20\"][data-col=\"10\"] svg.minigrafico polyline'); return t ? t.getAttribute('points').split(' ').length : 0; }")
        b.ok('nella cella si vede il minigrafico (una linea di 5 punti), non il testo', svg == 5 and 'SPARKLINE' not in b.testo(20, 10), [svg, b.testo(20, 10)])
    prova(b, 'Minigrafico', minigrafico)

    def stili():
        b.imposta(22, 1, 'ok'); b.aggiorna(); b.clic_cella_os(22, 1)
        b.menu('Formato', 'Stili di cella', 'Buono'); b.attendi(400)
        b.clic_cella_os(25, 3); b.attendi(300)  # la cella selezionata ha il colore della selezione: si guarda da fuori
        s = {p: stile_cella(b, 22, 1, p) for p in ['backgroundColor', 'color']}
        b.ok('Buono: verde come Excel', s == {'backgroundColor': 'rgb(198, 239, 206)', 'color': 'rgb(0, 97, 0)'}, s)
        b.clic_cella_os(22, 1); b.menu('Formato', 'Stili di cella', 'Normale'); b.attendi(400)
        b.clic_cella_os(25, 3); b.attendi(300)
        s = stile_cella(b, 22, 1, 'backgroundColor')
        b.ok('Normale toglie lo stile (sfondo come una cella senza stile)', s == stile_cella(b, 22, 4, 'backgroundColor'), [s, stile_cella(b, 22, 4, 'backgroundColor')])
        b.primo_piano(); b.os_tasto('Z', 'Ctrl'); b.attendi(400)
        b.ok('Ctrl+Z rimette Buono', stile_cella(b, 22, 1, 'backgroundColor') == 'rgb(198, 239, 206)', stile_cella(b, 22, 1, 'backgroundColor'))
    prova(b, 'Stili di cella', stili)

    b.ok('nessun errore nella pagina', len(b.errori_pagina()) == 0, b.errori_pagina()[:3])
