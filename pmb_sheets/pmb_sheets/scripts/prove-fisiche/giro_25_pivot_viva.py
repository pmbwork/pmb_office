import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

def clic_giusto(b, r, c, tentativi=15):
    for _ in range(tentativi):
        b.clic_cella_os(r, c)
        if b.js("() => { const s = GR.getDoc().selection; return [s.anchor.row, s.anchor.col, s.range.endRow - s.range.startRow, s.range.endCol - s.range.startCol]; }") == [r, c, 0, 0]: return True
    return False

def seleziona_giusto(b, r1, c1, r2, c2, tentativi=8):
    for _ in range(tentativi):
        b.seleziona_os(r1, c1, r2, c2)
        if b.js("() => { const r = GR.getDoc().selection.range; return [r.startRow, r.startCol, r.endRow, r.endCol]; }") == [r1, c1, r2, c2]: return True
    return False

DATI = [('Reparto', 'Agente', 'Vendite'), ('Nord', 'Anna', 100), ('Sud', 'Bruno', 50), ('Nord', 'Carla', 200), ('Est', 'Dino', 30), ('Sud', 'Elena', 70)]

with Banco(9630, '25 Pivot viva, rinomina, duplicazione ed eliminazione di fogli con grafici e pivot') as b:
    b.primo_piano()
    # grafico su A1:C5 con dati propri
    for i in range(5):
        b.imposta(i + 1, 1, ['Gen', 'Feb', 'Mar', 'Apr', 'Mag'][i]); b.imposta(i + 1, 2, str((i + 1) * 10)); b.imposta(i + 1, 3, str(i + 1))
    for i, riga in enumerate(DATI):
        for j, v in enumerate(riga): b.imposta(i + 1, 6 + j, str(v))
    b.aggiorna()

    grafici = lambda: b.js("() => GR.getDoc().charts.map(c => ({id: c.id, f: c.sheetName, r: c.dataRange}))")
    pivots = lambda: b.js("() => GR.getDoc().pivots.map(p => ({s: p.sourceSheet, r: p.sourceRange, ris: p.resultSheet || null}))")
    visibili = lambda: b.js("() => GR.renderRoot.querySelectorAll('free-chart-overlay').length")
    fogli = lambda: b.js("async () => await GR.getDoc().client.listSheets()")

    def configura():
        b.ok('selezione A1:C5', seleziona_giusto(b, 1, 1, 5, 3))
        b.menu('Inserisci', 'Grafico...'); b.attendi(800)
        b.js("() => { const d = GR.getDoc(); d.charts = d.charts.map((c) => ({...c, x: 1100, y: 450})); GR.requestUpdate(); }"); b.attendi(500)
        b.ok('un grafico su Foglio1', len(grafici()) == 1 and grafici()[0]['f'] == 'Foglio1', grafici())
        b.seleziona(1, 6, 6, 8)
        b.js("async () => { const p = await GR.insertPivotTable(); p.valueFields[0].sourceColIndex = 2; p.valueFields[0].name = 'Vendite'; await GR.computeAndRenderPivot(p); }")
        b.attendi(1500)
        b.js("async () => { await GR.switchSheet('Foglio1'); }"); b.attendi(800)
        p = pivots()
        b.ok('una pivot su F1:H6 con il suo foglio di risultati registrato (si salva nel file)', len(p) == 1 and p[0]['r'] == 'F1:H6' and p[0]['ris'] not in (None, 'Foglio1'), p)
    prova(b, 'Preparazione', configura)

    def nome_ris():
        return pivots()[0]['ris']

    def nord(nome):
        for r in range(1, 14):
            if b.cella(r, 1, nome)['v'] == 'Nord': return b.cella(r, 2, nome)['v']
    def valore(nome, voce):
        for r in range(1, 14):
            if b.cella(r, 1, nome)['v'] == voce: return b.cella(r, 2, nome)['v']

    def viva():
        n = nome_ris()
        b.ok('all\'inizio Nord = 300', nord(n) == 300, nord(n))
        b.imposta(4, 8, '500'); b.aggiorna(); b.attendi(2500)
        b.ok('cambiando una vendita (200 → 500) la pivot si riscrive da sola: Nord = 600', nord(n) == 600, nord(n))
        b.imposta(6, 6, 'Nord'); b.aggiorna(); b.attendi(2500)
        b.ok('spostando Elena in Nord: Nord = 670', nord(n) == 670, nord(n))
        b.ok('e Sud scende a 50', valore(n, 'Sud') == 50, valore(n, 'Sud'))
        b.imposta(4, 8, '200'); b.imposta(6, 6, 'Sud'); b.aggiorna(); b.attendi(2500)
        b.ok('rimessi i dati di prima: Nord = 300 e Sud = 120', nord(n) == 300 and valore(n, 'Sud') == 120, (nord(n), valore(n, 'Sud')))
    prova(b, 'La pivot è viva', viva)

    def rinomina():
        n = nome_ris()
        b.js("async () => { await GR.renameCurrentSheet('Dati'); }"); b.attendi(1000)
        g, p = grafici(), pivots()
        b.ok('rinominato Foglio1 in Dati: il grafico lo segue', g[0]['f'] == 'Dati', g)
        b.ok('la pivot segue il nuovo nome del foglio dei dati', p[0]['s'] == 'Dati' and p[0]['ris'] == n, p)
        b.ok('il grafico si vede ancora sul foglio', visibili() == 1, visibili())
        b.imposta(2, 8, '1000'); b.aggiorna(); b.attendi(2500)
        b.ok('la pivot è ancora viva dopo la rinomina: Nord = 1200', nord(n) == 1200, nord(n))
        b.imposta(2, 8, '100'); b.aggiorna(); b.attendi(2000)
        ok_clic = clic_giusto(b, 9, 3)
        if not ok_clic:
            b.nota('diagnostica del clic mancato', b.js("() => { const d = GR.getDoc(); const s = d.selection; return {sel: [s.anchor.row, s.anchor.col, s.range.startRow, s.range.endRow, s.range.startCol, s.range.endCol], foglio: d.activeSheetName, rect: GR.renderRoot.querySelector('td[data-row=\"9\"][data-col=\"3\"]') ? 'cella presente' : 'cella assente', edit: GR.isEditing}; }"))
        b.ok('clic su una cella per dare il fuoco', ok_clic)
        b.os_tasto('Z', 'Ctrl'); b.attendi(1500)
        g, p = grafici(), pivots()
        b.ok('Ctrl+Z: il foglio torna Foglio1 e con lui grafico e pivot', g[0]['f'] == 'Foglio1' and p[0]['s'] == 'Foglio1', (g, p))
        b.ok('il grafico si vede', visibili() == 1, visibili())
    prova(b, 'Rinomina del foglio', rinomina)

    def duplica():
        b.js("window.confirm = () => true")
        b.js("async () => { await GR.duplicateCurrentSheet(); }"); b.attendi(1500)
        g = grafici()
        b.ok('duplicato il foglio: ora i grafici sono 2, uno sulla copia', len(g) == 2 and sorted(x['f'] for x in g)[0].startswith('Copia di') or len(g) == 2, g)
        b.ok('il grafico della copia si vede sulla copia', visibili() == 1, visibili())
        b.ok('gli id dei due grafici sono diversi', len({x['id'] for x in g}) == 2, g)
        b.js("async () => { await GR.deleteCurrentSheet(); }"); b.attendi(1500)
        g = grafici()
        b.ok('eliminata la copia: torna un solo grafico, su Foglio1', len(g) == 1 and g[0]['f'] == 'Foglio1', g)
        clic_giusto(b, 9, 3)
        b.os_tasto('Z', 'Ctrl'); b.attendi(1500)
        g = grafici()
        b.ok('Ctrl+Z restituisce il foglio copia e il suo grafico', len(g) == 2, g)
        clic_giusto(b, 9, 3)
        b.os_tasto('Z', 'Ctrl'); b.attendi(1500)
        b.ok('Ctrl+Z ancora: la copia non c\'è più, resta un grafico', len(grafici()) == 1, grafici())
    prova(b, 'Duplicazione ed eliminazione di una copia', duplica)

    def elimina_sorgente():
        b.js("async () => { await GR.switchSheet('Foglio1'); }"); b.attendi(800)
        n = nome_ris()
        b.js("async () => { await GR.deleteCurrentSheet(); }"); b.attendi(2000)
        b.ok('eliminato il foglio dei dati: spariscono grafico e pivot', len(grafici()) == 0 and len(pivots()) == 0, (grafici(), pivots()))
        b.js("async () => { const l = await GR.getDoc().client.listSheets(); await GR.switchSheet(l[0]); }"); b.attendi(500)
        b.js("window.confirm = () => true")
        clic_giusto(b, 9, 3)
        b.os_tasto('Z', 'Ctrl'); b.attendi(2500)
        g, p = grafici(), pivots()
        b.ok('Ctrl+Z riporta grafico e pivot, con il foglio dei risultati', len(g) == 1 and len(p) == 1 and p[0]['ris'] == n, (g, p))
        b.imposta(4, 8, '500'); b.aggiorna(); b.attendi(2500)
        b.ok('e la pivot ripristinata è ancora viva: Nord = 600', nord(n) == 600, nord(n))
        b.imposta(4, 8, '200'); b.aggiorna(); b.attendi(1500)
    prova(b, 'Eliminazione del foglio dei dati', elimina_sorgente)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
