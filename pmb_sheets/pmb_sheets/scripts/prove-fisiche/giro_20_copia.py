import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

STATO = """() => { const d = GR.getDoc();
  return { commenti: Array.from(d.comments.keys()).sort(), convalide: Array.from(d.dataValidations.keys()).sort(), unioni: d.merges.map(m => [m.startRow, m.endRow, m.startCol, m.endCol]) }; }"""

def clic_giusto(b, r, c, tentativi=15):
    for _ in range(tentativi):
        b.clic_cella_os(r, c)
        if b.js("() => { const s = GR.getDoc().selection.anchor; return [s.row, s.col]; }") == [r, c]: return True
    return False

def seleziona_giusto(b, r1, c1, r2, c2, tentativi=8):
    for _ in range(tentativi):
        b.seleziona_os(r1, c1, r2, c2)
        if b.js("() => { const r = GR.getDoc().selection.range; return [r.startRow, r.startCol, r.endRow, r.endCol]; }") == [r1, c1, r2, c2]: return True
    return False

with Banco(9625, '20 Copia e incolla con commenti, convalide e unioni') as b:
    b.primo_piano()
    b.js("""async () => { const d = GR.getDoc(); const f = d.activeSheetName;
      await d.client.setCell(f, 1, 1, 'x'); await d.client.setCell(f, 1, 2, 'y'); await d.client.setCell(f, 2, 1, '1'); await d.client.setCell(f, 2, 2, '2');
      GR.setComment(1, 1, 'una nota');
      d.dataValidations.set('2:2', { id: 'v', type: 'list', listItems: ['a', 'b'], action: 'reject' });
      d.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 });
      GR.cellsCache.clear(); GR.updateViewport(); GR.requestUpdate(); }""")
    b.attendi(600)
    prima = b.js(STATO)
    foglio = b.js("() => GR.getDoc().activeSheetName")

    def copia():
        b.ok('selezione A1:B2 col mouse', seleziona_giusto(b, 1, 1, 2, 2))
        b.os_tasto('C', 'Ctrl'); b.attendi(500)
        b.ok('clic su D5', clic_giusto(b, 5, 4))
        b.os_tasto('V', 'Ctrl'); b.attendi(1500)
        celle = [b.cella(5, 4)['raw'], b.cella(5, 5)['raw'], b.cella(6, 4)['raw'], b.cella(6, 5)['raw']]
        b.ok('le celle sono state copiate in D5:E6', celle == ['x', 'y', '1', '2'], celle)
        s = b.js(STATO)
        b.ok('il commento è anche in D5 e resta in A1', s['commenti'] == sorted([f'1:1!{foglio}', f'5:4!{foglio}']), s['commenti'])
        b.ok('la convalida è anche in E6 e resta in B2', s['convalide'] == ['2:2', '6:5'], s['convalide'])
        b.ok('la cella unita è anche in D5:E5 e resta in A1:B1', sorted(s['unioni']) == [[1, 1, 1, 2], [5, 5, 4, 5]], s['unioni'])
        b.js("() => { GR.cellsCache.clear(); GR.updateViewport(); GR.requestUpdate(); }"); b.attendi(500)
        v = b.js("() => { const q = (r, c) => GR.renderRoot.querySelector('td[data-row=\"' + r + '\"][data-col=\"' + c + '\"]'); const a = q(5, 4), s = q(1, 1); return { nuovaColspan: a ? a.getAttribute('colspan') : null, nuovaCommento: a ? a.classList.contains('has-comment') : null, vecchiaColspan: s ? s.getAttribute('colspan') : null, vecchiaCommento: s ? s.classList.contains('has-comment') : null }; }")
        b.ok('a video: D5 larga due colonne con l\'indicatore del commento, e A1 ancora com\'era', v['nuovaColspan'] == '2' and v['nuovaCommento'] is True and v['vecchiaColspan'] == '2' and v['vecchiaCommento'] is True, v)
        b.os_tasto('Z', 'Ctrl'); b.attendi(900)
        d = b.js(STATO)
        b.ok('Ctrl+Z toglie solo ciò che l\'incolla ha portato: A1:B2 resta intatta', d == prima, d)
        b.os_tasto('Y', 'Ctrl'); b.attendi(900)
        d = b.js(STATO)
        b.ok('Ctrl+Y lo rimette', d['commenti'] == sorted([f'1:1!{foglio}', f'5:4!{foglio}']) and d['convalide'] == ['2:2', '6:5'] and len(d['unioni']) == 2, d)
    prova(b, 'Copiare e incollare', copia)

    def solo_valori():
        b.os_tasto('Z', 'Ctrl'); b.attendi(600)
        b.ok('selezione A1:B2', seleziona_giusto(b, 1, 1, 2, 2))
        b.os_tasto('C', 'Ctrl'); b.attendi(500)
        b.ok('clic su G9', clic_giusto(b, 9, 7))
        b.menu('Modifica', 'Incolla speciale', 'Solo valori'); b.attendi(1200)
        s = b.js(STATO)
        b.ok('"Incolla solo valori" porta il testo ma non commenti, convalide e unioni', b.cella(9, 7)['raw'] == 'x' and f'9:7!{foglio}' not in s['commenti'] and '10:8' not in s['convalide'] and len(s['unioni']) == 1, [b.cella(9, 7)['raw'], s])
    prova(b, 'Incolla solo valori', solo_valori)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
