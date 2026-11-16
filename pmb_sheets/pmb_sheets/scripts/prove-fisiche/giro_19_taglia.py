import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

STATO = """() => { const d = GR.getDoc(); const f = d.activeSheetName;
  const com = Array.from(d.comments.keys()).sort();
  const nome = d.namedRanges.get('Zona');
  return { fogli: f, commenti: com, convalide: Array.from(d.dataValidations.keys()).sort(), unioni: d.merges.map(m => [m.startRow, m.endRow, m.startCol, m.endCol]),
           nome: nome ? [nome.sheetName, nome.rangeString] : null }; }"""

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

with Banco(9624, '19 Taglia e incolla con commenti, convalide, unioni e nomi') as b:
    b.primo_piano()
    b.js("""async () => { const d = GR.getDoc(); const f = d.activeSheetName;
      await d.client.setCell(f, 1, 1, 'x'); await d.client.setCell(f, 1, 2, 'y'); await d.client.setCell(f, 2, 1, '1'); await d.client.setCell(f, 2, 2, '=A2*2');
      GR.setComment(1, 1, 'una nota');
      d.dataValidations.set('2:2', { id: 'v', type: 'list', listItems: ['a', 'b'], action: 'reject' });
      d.merges.push({ startRow: 1, endRow: 1, startCol: 1, endCol: 2 });
      d.namedRanges.add({ name: 'Zona', sheetName: f, rangeString: 'A1:B2', startRow: 1, endRow: 2, startCol: 1, endCol: 2 });
      await d.client.setNamedRanges([{ name: 'Zona', ref: f + '!A1:B2' }]);
      GR.cellsCache.clear(); GR.updateViewport(); GR.requestUpdate(); }""")
    b.attendi(600)
    prima = b.js(STATO)
    b.nota('prima', prima)

    def taglia():
        b.ok('selezione A1:B2 trascinando con il mouse', seleziona_giusto(b, 1, 1, 2, 2))
        b.os_tasto('X', 'Ctrl'); b.attendi(500)
        b.ok('clic su D5', clic_giusto(b, 5, 4))
        b.os_tasto('V', 'Ctrl'); b.attendi(1500)
        celle = [b.cella(5, 4)['raw'], b.cella(5, 5)['raw'], b.cella(6, 4)['raw'], b.cella(6, 5)['raw'], b.cella(1, 1)['raw']]
        b.ok('le celle sono passate da A1:B2 a D5:E6 (e la formula segue la cella che cita: =D6*2)', celle == ['x', 'y', '1', '=D6*2', ''], celle)
        s = b.js(STATO)
        foglio = s['fogli']
        b.ok('il commento è passato a D5 e non è più in A1', s['commenti'] == [f'5:4!{foglio}'], s['commenti'])
        b.ok('la convalida è passata a E6 e non è più in B2', s['convalide'] == ['6:5'], s['convalide'])
        b.ok('la cella unita è passata a D5:E5', s['unioni'] == [[5, 5, 4, 5]], s['unioni'])
        b.ok('il nome "Zona" ora indica D5:E6', s['nome'] is not None and s['nome'][1] == 'D5:E6', s['nome'])
        b.js("() => { GR.cellsCache.clear(); GR.updateViewport(); GR.requestUpdate(); }"); b.attendi(500)
        v = b.js("() => { const t = GR.renderRoot.querySelector('td[data-row=\"5\"][data-col=\"4\"]'); const u = GR.renderRoot.querySelector('td[data-row=\"1\"][data-col=\"1\"]'); return { colspan: t ? t.getAttribute('colspan') : null, commento: t ? t.classList.contains('has-comment') : null, vecchio: u ? u.classList.contains('has-comment') : null, vecchioColspan: u ? u.getAttribute('colspan') : null }; }")
        b.ok('a video: D5 è larga due colonne e ha l\'indicatore del commento, A1 non più', v['colspan'] == '2' and v['commento'] is True and v['vecchio'] is False and v['vecchioColspan'] in ('1', None), v)
        b.os_tasto('Z', 'Ctrl'); b.attendi(900)
        d = b.js(STATO)
        b.ok('Ctrl+Z rimette tutto: commento, convalida, unione e nome tornano in A1:B2', d['commenti'] == prima['commenti'] and d['convalide'] == prima['convalide'] and d['unioni'] == prima['unioni'] and d['nome'] == prima['nome'], d)
        b.ok('e le celle', [b.cella(1, 1)['raw'], b.cella(2, 2)['raw'], b.cella(5, 4)['raw']] == ['x', '=A2*2', ''], [b.cella(1, 1)['raw'], b.cella(2, 2)['raw'], b.cella(5, 4)['raw']])
        b.os_tasto('Y', 'Ctrl'); b.attendi(900)
        d = b.js(STATO)
        b.ok('Ctrl+Y lo rifà', d['commenti'] == [f'5:4!{foglio}'] and d['convalide'] == ['6:5'] and d['unioni'] == [[5, 5, 4, 5]] and d['nome'][1] == 'D5:E6', d)
    prova(b, 'Tagliare e incollare', taglia)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
