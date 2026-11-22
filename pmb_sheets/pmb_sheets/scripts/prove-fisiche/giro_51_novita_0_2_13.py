"""Prova fisica delle novità 0.2.13 nel pmb_sheets installato, con il mouse e la tastiera veri: Dati › Raggruppa e struttura (Alt+Maiusc+→ e ←,
gruppi annidati, segno e pulsante +/− nelle intestazioni, Comprimi/Espandi, Ctrl+Z, .xlsx con outlineLevel e .ods con table-row-group come
Excel e LibreOffice), Formato › Maiuscole e minuscole, Strumenti › Valuta formula..., Strumenti › Finestra controllo, Inserisci › Codice QR...
Uso: python giro_51_novita_0_2_13.py"""
import sys, os, io, zipfile, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def gruppi(b):
    return b.js("() => { const g = GR.getDoc().gruppi; return g ? { righe: g.righe, colonne: g.colonne } : null; }")

with Banco(9651, '51 Novità 0.2.13') as b:
    b.primo_piano()

    def struttura():
        for r in range(1, 9): b.imposta(r, 1, f'r{r}')
        b.aggiorna()
        b.seleziona_os(2, 1, 6, 1); b.primo_piano(); b.os_tasto('Destra', 'Alt', 'Maiusc'); b.attendi(500)
        b.ok('Alt+Maiusc+→ raggruppa le righe 2-6', gruppi(b) == {'righe': {'2': 1, '3': 1, '4': 1, '5': 1, '6': 1}, 'colonne': {}}, gruppi(b))
        b.seleziona_os(3, 1, 4, 1); b.menu('Dati', 'Raggruppa e struttura', 'Raggruppa'); b.attendi(500)
        b.ok('dal menu: righe 3-4 al livello 2', gruppi(b)['righe'] == {'2': 1, '3': 2, '4': 2, '5': 1, '6': 1}, gruppi(b))
        segni = b.js("() => [...GR.shadowRoot.querySelectorAll('th.row-header')].filter((th) => th.querySelector('.segno-gruppo')).map((th) => th.firstChild && th.textContent.trim().match(/^\\d+/)[0])")
        b.ok('le intestazioni delle righe 2-6 hanno il segno del gruppo', segni == ['2', '3', '4', '5', '6'], segni)
        pulsanti = b.js("() => [...GR.shadowRoot.querySelectorAll('th.row-header .pulsante-gruppo')].map((p) => [p.parentElement.textContent.trim().match(/^\\d+/)[0], p.textContent])")
        b.ok('pulsanti − sulle righe 5 e 7 (dopo i gruppi)', pulsanti == [['5', '−'], ['7', '−']], pulsanti)
        b.pg.locator('free-sheet-grid th.row-header .pulsante-gruppo').first.click(); b.attendi(500)
        b.ok('clic sul pulsante: righe 3-4 compresse', sorted(b.doc()['nascR']) == [3, 4], b.doc()['nascR'])
        b.ok('il pulsante diventa +', b.js("() => GR.shadowRoot.querySelector('th.row-header .pulsante-gruppo').textContent") == '+')
        b.primo_piano(); b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        b.ok('Ctrl+Z riespande', b.doc()['nascR'] == [], b.doc()['nascR'])
        b.clic_cella_os(2, 1); b.menu('Dati', 'Raggruppa e struttura', 'Comprimi il gruppo'); b.attendi(500)
        b.ok('Comprimi il gruppo da A2: righe 2-6 nascoste', sorted(b.doc()['nascR']) == [2, 3, 4, 5, 6], b.doc()['nascR'])
        b.clic_cella_os(7, 1); b.menu('Dati', 'Raggruppa e struttura', 'Espandi il gruppo'); b.attendi(500)
        b.ok('Espandi il gruppo dalla riga 7 (riepilogo)', b.doc()['nascR'] == [], b.doc()['nascR'])
        b.pg.locator('free-sheet-grid th.row-header .pulsante-gruppo').first.click(); b.attendi(400)
        # colonne B e C intere: clic sull'intestazione B e Maiusc+clic su C, con il mouse
        b.pg.locator('free-sheet-grid th.col-header').nth(1).click(); b.attendi(200)
        b.pg.locator('free-sheet-grid th.col-header').nth(2).click(modifiers=['Shift']); b.attendi(300)
        b.primo_piano(); b.os_tasto('Destra', 'Alt', 'Maiusc'); b.attendi(500)
        b.ok('con le colonne B-C intere selezionate raggruppa le colonne', gruppi(b)['colonne'] == {'2': 1, '3': 1}, gruppi(b))

        for voce, est in [('Scarica come cartella di lavoro (.xlsx)', 'xlsx'), ('Scarica come OpenDocument (.ods)', 'ods')]:
            prima = len(b.salvati())
            b.menu('File', voce); b.attendi(1500)
            s = b.salvati()
            if len(s) != prima + 1: b.esito('FAIL', f'[{est}] nessun file scritto', s); continue
            dati = bytes(b.js("(i) => window.__salvati[i].bytes", len(s) - 1))
            z = zipfile.ZipFile(io.BytesIO(dati))
            if est == 'xlsx':
                f = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
                b.ok('[xlsx] outlineLevel="2" e hidden sulle righe 3-4, outlineLevelRow="2" come Excel', '<sheetFormatPr defaultRowHeight="15" outlineLevelRow="2" outlineLevelCol="1"/>' in f
                     and '<row r="3" hidden="1" outlineLevel="2"' in f and 'outlineLevel="1"' in f, f[:600])
            else:
                c = z.read('content.xml').decode('utf-8')
                b.ok('[ods] table-row-group annidati, quello compresso con table:display="false", e table-column-group', '<table:table-row-group table:display="false">' in c and '<table:table-column-group>' in c)
            p = os.path.join(tempfile.gettempdir(), f'giro51.{est}'); open(p, 'wb').write(dati); b.nota(f'[{est}] file salvato per controllo', p)

        b.pg.locator('free-sheet-grid th.row-header .pulsante-gruppo').first.click(); b.attendi(500)
        b.ok('il pulsante + riespande le righe 3-4', b.doc()['nascR'] == [], b.doc()['nascR'])
        b.seleziona_os(3, 1, 4, 1)
        b.nota('prima di separare', [gruppi(b), b.js("() => { const s = GR.getDoc().selection; return [s.isFullRow, s.isFullCol, JSON.stringify(s.range)]; }")])
        b.primo_piano(); b.os_tasto('Sinistra', 'Alt', 'Maiusc'); b.attendi(500)
        b.nota('dopo', [gruppi(b), b.stato_app()['msg']])
        b.ok('Alt+Maiusc+← separa: righe 3-4 tornano al livello 1', gruppi(b)['righe'] == {'2': 1, '3': 1, '4': 1, '5': 1, '6': 1}, gruppi(b))
        b.menu('Dati', 'Raggruppa e struttura', 'Cancella la struttura'); b.attendi(500)
        b.ok('Cancella la struttura: niente gruppi, righe visibili', gruppi(b) is None and b.doc()['nascR'] == [], [gruppi(b), b.doc()['nascR']])
    prova(b, 'Raggruppa e struttura', struttura)

    def maiuscole():
        b.imposta(1, 5, 'ciao mondo'); b.aggiorna()
        b.clic_cella_os(1, 5); b.menu('Formato', 'Maiuscole e minuscole', 'MAIUSCOLO'); b.attendi(500)
        b.ok('MAIUSCOLO', b.cella(1, 5)['raw'] == 'CIAO MONDO', b.cella(1, 5))
        b.menu('Formato', 'Maiuscole e minuscole', 'Iniziali Maiuscole'); b.attendi(500)
        b.ok('Iniziali Maiuscole', b.cella(1, 5)['raw'] == 'Ciao Mondo', b.cella(1, 5))
        b.primo_piano(); b.os_tasto('Z', 'Ctrl'); b.attendi(400)
        b.ok('Ctrl+Z', b.cella(1, 5)['raw'] == 'CIAO MONDO', b.cella(1, 5))
    prova(b, 'Maiuscole e minuscole', maiuscole)

    def leggi():
        b.clic_cella_os(1, 5); b.menu('Strumenti', 'Leggi le celle ad alta voce'); b.attendi(800)
        b.ok("Leggi le celle ad alta voce parte subito (anche se le voci di Windows arrivano dopo l'avvio)", b.js("() => speechSynthesis.speaking || speechSynthesis.pending"), b.stato_app()['msg'])
        b.primo_piano(); b.os_tasto('Esc'); b.attendi(500)
        b.ok('Esc ferma la lettura', not b.js("() => speechSynthesis.speaking"), b.stato_app()['msg'])
    prova(b, 'Leggi ad alta voce', leggi)

    def valuta():
        b.imposta(10, 6, '3'); b.imposta(11, 6, '4'); b.aggiorna()
        b.scrivi_os(1, 7, '=SUM(F10:F11)*2'); b.aggiorna()
        b.clic_cella_os(1, 7); b.menu('Strumenti', 'Valuta formula...'); b.attendi(800)
        passi = b.js("() => APP.shadowRoot.querySelector('free-dialogo-valuta').passi")
        b.ok('i passi (in italiano): SOMMA(F10:F11) = 7, poi 14', any(p['testo'] == 'SOMMA(F10:F11)' and p['valore'] == '7' for p in passi) and passi[-1]['valore'] == '14', passi)
        b.primo_piano(); b.os_tasto('Esc'); b.attendi(400)
        b.ok('Esc chiude la finestra', not b.js("() => !!APP.shadowRoot.querySelector('free-dialogo-valuta')"))
    prova(b, 'Valuta formula', valuta)

    def controllo():
        b.clic_cella_os(1, 7); b.menu('Strumenti', 'Finestra controllo'); b.attendi(600)
        b.pg.locator('free-pannello-controllo button.aggiungi').click(); b.attendi(1500)
        celle = b.js("() => APP.shadowRoot.querySelector('free-pannello-controllo').celle")
        b.ok('la finestra controllo mostra G1 = 14 con la formula (in italiano)', len(celle) == 1 and celle[0]['cella'] == 'G1' and celle[0]['valore'] == '14' and celle[0]['formula'] == '=SOMMA(F10:F11)*2', celle)
        b.scrivi_os(10, 6, '10'); b.attendi(1800)
        celle = b.js("() => APP.shadowRoot.querySelector('free-pannello-controllo').celle")
        b.ok('cambiando F10 il valore si aggiorna da solo (28)', celle and celle[0]['valore'] == '28', celle)
        b.pg.locator('free-pannello-controllo button.chiudi').click(); b.attendi(400)
        b.ok('Chiudi', not b.js("() => !!APP.shadowRoot.querySelector('free-pannello-controllo')"))
    prova(b, 'Finestra controllo', controllo)

    def qr():
        prima = b.js("() => GR.getDoc().immagini.length")
        b.clic_cella_os(3, 3); b.menu('Inserisci', 'Codice QR...'); b.attendi(500)
        b.pg.locator('free-dialogo-qr textarea').click(); b.primo_piano(); b.os_testo('https://esempio.it'); b.attendi(300)
        b.pg.locator('free-dialogo-qr button[data-azione="inserisci"]').click(); b.attendi(1200)
        b.ok('il codice QR entra come immagine', b.js("() => GR.getDoc().immagini.length") == prima + 1, b.js("() => GR.getDoc().immagini.length"))
        b.primo_piano(); b.os_tasto('Z', 'Ctrl'); b.attendi(500)
        b.ok('Ctrl+Z lo toglie', b.js("() => GR.getDoc().immagini.length") == prima)
    prova(b, 'Codice QR', qr)

    b.ok('nessun errore nella pagina', len(b.errori_pagina()) == 0, b.errori_pagina()[:3])
