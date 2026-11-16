import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
with Banco(9613, '13 Avviso copia troppo grande') as b:
    b.primo_piano()
    b.attendi(4000)   # il primo controllo fissa il riferimento del foglio vuoto
    b.js("""async () => { const d = GR.getDoc(); const ops = []; for (let r = 1; r <= 20000; r++) { ops.push({type:'set', sheet: d.activeSheetName, row: r, col: 1, raw: String((r * 7919) % 10007)}); ops.push({type:'set', sheet: d.activeSheetName, row: r, col: 2, raw: 'voce ' + r}); ops.push({type:'set', sheet: d.activeSheetName, row: r, col: 3, raw: '=A' + r + '*2'}); } await d.client.applyBatch(ops); GR.cellsCache.clear(); GR.updateViewport(); GR.requestUpdate(); }""")
    b.attendi(9000)
    msg = b.js("() => APP.statusMessage")
    esito = b.js("() => APP.recupero.esito")
    b.nota('esito della copia', esito)
    b.ok('con 20.000 righe la barra di stato avvisa che la copia automatica non c\'è', 'salva spesso' in (msg or '') or esito == 'scritto', [esito, msg])
    b.nota('messaggio', msg)
