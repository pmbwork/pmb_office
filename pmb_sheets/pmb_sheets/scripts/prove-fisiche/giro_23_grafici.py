import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag']
RIC = [10, 20, 30, 40, 50]
COS = [1, 2, 3, 4, 5]

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

with Banco(9628, '23 Grafici e pivot che seguono i dati') as b:
    b.primo_piano()
    for i in range(5):
        b.imposta(i + 1, 1, MESI[i]); b.imposta(i + 1, 2, str(RIC[i])); b.imposta(i + 1, 3, str(COS[i]))
    b.aggiorna()

    grafici = lambda: b.js("() => GR.getDoc().charts.map(c => ({r: c.dataRange, f: c.sheetName, cat: c.categories, s: c.series.map(x => ({n: x.name, d: x.data}))}))")
    pivots = lambda: b.js("() => GR.getDoc().pivots.map(p => ({r: p.sourceRange, f: p.sourceSheet, row: p.rowFields.map(x => x.sourceColIndex), val: p.valueFields.map(x => x.sourceColIndex)}))")

    def creazione():
        b.seleziona(1, 1, 5, 3)
        b.menu('Inserisci', 'Grafico...'); b.attendi(800)
        g = grafici()
        b.ok('un grafico con intervallo A1:C5', len(g) == 1 and g[0]['r'] == 'A1:C5', g)
        b.ok('categorie = mesi, due serie', g[0]['cat'] == MESI and len(g[0]['s']) == 2, g[0])
        b.ok('prima serie = Ricavi 10..50', g[0]['s'][0]['d'] == RIC, g[0]['s'][0])
    prova(b, 'Creazione', creazione)

    def vivo():
        b.imposta(2, 2, '999'); b.aggiorna(); b.attendi(900)
        g = grafici()
        b.ok('cambiando B2 la serie del grafico si aggiorna da sola (999)', g[0]['s'][0]['d'] == [10, 999, 30, 40, 50], g[0]['s'][0])
        b.imposta(3, 1, 'Marzo'); b.aggiorna(); b.attendi(900)
        b.ok('cambiando A3 la categoria si aggiorna', grafici()[0]['cat'][2] == 'Marzo', grafici()[0]['cat'])
        b.imposta(3, 1, 'Mar'); b.imposta(2, 2, '20'); b.aggiorna(); b.attendi(700)
    prova(b, 'Il grafico è vivo', vivo)

    def taglio():
        # il grafico copre le celle e bloccherebbe il trascinamento: lo si sposta in basso a destra
        b.js("() => { const d = GR.getDoc(); d.charts = d.charts.map((c) => ({...c, x: 1100, y: 450})); GR.requestUpdate(); }"); b.attendi(700)
        ok_sel = seleziona_giusto(b, 1, 1, 5, 3)
        if not ok_sel:   # il trascinamento non è arrivato: si seleziona dal codice e si dà il fuoco alla griglia
            info = b.js("() => { const d = GR.getDoc(); const r = d.selection.range; const c = d.charts[0]; return {sel: [r.startRow, r.startCol, r.endRow, r.endCol], chart: [c.x, c.y, c.width, c.height]}; }")
            b.nota('trascinamento non riuscito, seleziono dal codice', info)
            b.seleziona(1, 1, 5, 3); b.js("() => GR.focus()"); b.attendi(300)
        sel = b.js("() => { const r = GR.getDoc().selection.range; return [r.startRow, r.startCol, r.endRow, r.endCol]; }")
        b.ok('selezione A1:C5', sel == [1, 1, 5, 3], sel)
        b.os_tasto('X', 'Ctrl'); b.attendi(500)
        b.ok('clic su J1', clic_giusto(b, 1, 10))
        b.os_tasto('V', 'Ctrl'); b.attendi(2000)
        g = grafici()
        b.ok('tagliando tutti i dati e incollando in J1 il grafico segue: J1:L5', g[0]['r'] == 'J1:L5', g[0]['r'])
        b.ok('i valori del grafico sono gli stessi', g[0]['cat'] == MESI and g[0]['s'][0]['d'] == RIC, g[0])
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        g = grafici()
        b.ok('Ctrl+Z riporta il grafico su A1:C5', g[0]['r'] == 'A1:C5' and g[0]['s'][0]['d'] == RIC, g[0])
        b.os_tasto('Y', 'Ctrl'); b.attendi(1200)
        g = grafici()
        b.ok('Ctrl+Y lo rimette su J1:L5 con gli stessi dati', g[0]['r'] == 'J1:L5' and g[0]['s'][0]['d'] == RIC, g[0])
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        b.ok('Ctrl+Z di nuovo: A1:C5', grafici()[0]['r'] == 'A1:C5', grafici()[0]['r'])
    prova(b, 'Taglia e incolla', taglio)

    def righe():
        clic_giusto(b, 1, 1); b.menu('Inserisci', 'Riga sopra'); b.attendi(900)
        g = grafici()
        b.ok('una riga sopra: l\'intervallo scende a A2:C6 e i dati restano', g[0]['r'] == 'A2:C6' and g[0]['cat'] == MESI, g[0])
        clic_giusto(b, 4, 1); b.menu('Inserisci', 'Riga sopra'); b.attendi(900)
        g = grafici()
        b.ok('una riga dentro i dati: si allarga a A2:C7 con una categoria vuota', g[0]['r'] == 'A2:C7' and len(g[0]['cat']) == 6, g[0])
        b.ok('la serie ha uno zero al posto della riga nuova', 0 in g[0]['s'][0]['d'] and len(g[0]['s'][0]['d']) == 6, g[0]['s'][0])
        b.menu('Modifica', 'Annulla'); b.attendi(900)
        b.ok('Annulla: di nuovo A2:C6', grafici()[0]['r'] == 'A2:C6', grafici()[0]['r'])
        b.menu('Modifica', 'Annulla'); b.attendi(900)
        b.ok('Annulla ancora: A1:C5', grafici()[0]['r'] == 'A1:C5', grafici()[0]['r'])
        clic_giusto(b, 2, 1); b.menu('Modifica', 'Elimina riga'); b.attendi(900)
        g = grafici()
        b.ok('eliminata la riga 2: A1:C4 con Feb tolto', g[0]['r'] == 'A1:C4' and g[0]['cat'] == ['Gen', 'Mar', 'Apr', 'Mag'], g[0])
        b.menu('Modifica', 'Annulla'); b.attendi(1200)
        g = grafici()
        b.ok('Annulla restituisce la riga e il grafico com\'era', g[0]['r'] == 'A1:C5' and g[0]['cat'] == MESI and g[0]['s'][0]['d'] == RIC, g[0])
    prova(b, 'Righe', righe)

    def colonne():
        clic_giusto(b, 1, 3); b.menu('Modifica', 'Elimina colonna'); b.attendi(900)
        g = grafici()
        b.ok('eliminata la colonna C: A1:B5 e una sola serie', g[0]['r'] == 'A1:B5' and len(g[0]['s']) == 1, g[0])
        b.menu('Modifica', 'Annulla'); b.attendi(1200)
        g = grafici()
        b.ok('Annulla: A1:C5 con due serie', g[0]['r'] == 'A1:C5' and len(g[0]['s']) == 2, g[0])
        clic_giusto(b, 1, 1); b.menu('Inserisci', 'Colonna a sinistra'); b.attendi(900)
        g = grafici()
        b.ok('colonna a sinistra: B1:D5, la serie si chiama ora Serie C e Serie D', g[0]['r'] == 'B1:D5' and [x['n'] for x in g[0]['s']] == ['Serie C', 'Serie D'], g[0])
        b.menu('Modifica', 'Annulla'); b.attendi(900)
        b.ok('Annulla: A1:C5', grafici()[0]['r'] == 'A1:C5', grafici()[0]['r'])
    prova(b, 'Colonne', colonne)

    def pivot():
        # una tabella con intestazione in F1:H6 (Reparto, Agente, Vendite)
        dati = [('Reparto', 'Agente', 'Vendite'), ('Nord', 'Anna', 100), ('Sud', 'Bruno', 50), ('Nord', 'Carla', 200), ('Est', 'Dino', 30), ('Sud', 'Elena', 70)]
        for i, riga in enumerate(dati):
            for j, v in enumerate(riga): b.imposta(i + 1, 6 + j, str(v))
        b.aggiorna()
        b.seleziona(1, 6, 6, 8)
        p = b.js("async () => { const p = await GR.insertPivotTable(); p.valueFields[0].sourceColIndex = 2; p.valueFields[0].name = 'Vendite'; await GR.computeAndRenderPivot(p); return {id: p.id, name: p.name}; }")
        b.attendi(1500)
        b.js("async () => { await GR.switchSheet('Foglio1'); }"); b.attendi(700)
        elenco = b.js("() => GR.getDoc().pivots.map(p => p.sourceRange)")
        b.ok('c\'è una pivot su F1:H6', elenco == ['F1:H6'], elenco)
        fogli = b.js("async () => await GR.getDoc().client.listSheets()")
        nome = [f for f in fogli if f != 'Foglio1'][0]
        def nord():
            for r in range(1, 12):
                if b.cella(r, 1, nome)['v'] == 'Nord': return b.cella(r, 2, nome)['v']
        b.ok('la pivot mostra Nord = 300', nord() == 300, nord())
        clic_giusto(b, 1, 1); b.menu('Inserisci', 'Colonna a sinistra'); b.attendi(1500)
        p = pivots()
        b.ok('inserita una colonna a sinistra: la pivot passa a G1:I6, campi invariati', p == [{'r': 'G1:I6', 'f': 'Foglio1', 'row': [0], 'val': [2]}], p)
        b.ok('il risultato è stato ricalcolato e dà sempre Nord = 300', nord() == 300, nord())
        clic_giusto(b, 2, 1); b.menu('Modifica', 'Elimina riga'); b.attendi(1500)
        p = pivots()
        b.ok('eliminata una riga di dati: G1:I5', p and p[0]['r'] == 'G1:I5', p)
        b.ok('il risultato è ricalcolato: Nord ora vale 200', nord() == 200, nord())
        b.menu('Modifica', 'Annulla'); b.attendi(1500)
        p = pivots()
        b.ok('Annulla: G1:I6 e Nord torna 300', p and p[0]['r'] == 'G1:I6' and nord() == 300, (p, nord()))
    prova(b, 'Pivot', pivot)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
