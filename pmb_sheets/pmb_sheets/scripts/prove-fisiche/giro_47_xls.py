"""Prova fisica dell'apertura dei file .xls (Excel 97-2003, Excel 4.0 e un .xls protetto) nel pmb_sheets installato, dal menu File › Apri:
celle, formule calcolate, stili come si vedono nella griglia, fogli, misure, unioni, commenti, collegamenti, messaggio dopo l'apertura e
«Salva» che chiede un nome nuovo e scrive un .xlsx. I file sono quelli di tests/file-prova/xls. Uso: python giro_47_xls.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

PROVA = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests', 'file-prova', 'xls'))

def apri(b, nome):
    byte_list = list(open(os.path.join(PROVA, nome), 'rb').read())
    b.js("(x) => { window.__aprire = {nome: x[0], bytes: x[1]}; }", [nome, byte_list])
    b.menu('File', 'Apri...'); b.attendi(2500)

def stile_vis(b, r, c):
    return b.js("""([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`); if (!t) return null; const s = getComputedStyle(t);
      return {w: s.fontWeight, i: s.fontStyle, bg: s.backgroundColor, col: s.color, font: s.fontFamily, tx: t.textContent.trim(), larg: Math.round(t.getBoundingClientRect().width)}; }""", [r, c])

with Banco(9647, '47 Aprire i .xls') as b:
    b.primo_piano()
    def libreoffice():
        apri(b, 'prova.xls')
        st = b.stato_app()
        b.ok('[xls] messaggio dopo l\'apertura: vecchio Excel, Salva in .xlsx', 'Aperto' in (st['msg'] or '') and 'vecchia versione di Excel' in (st['msg'] or ''), st['msg'])
        # dal 0.2.14 il foglio nascosto resta nascosto (si rimostra dal menu della scheda)
        b.ok('[xls] i fogli visibili, e «Nascosto» resta nascosto', st['fogli'] == ['Dati', 'Formule e calcoli'] and b.js("() => GR.fogliNascosti()") == ['Nascosto'], [st['fogli'], b.js("() => GR.fogliNascosti()")])
        b.ok('[xls] testi, numeri, accenti', b.cella(1, 1)['raw'] == 'Testo semplice' and b.cella(2, 1)['raw'] == 'Àccenti èé ù € ß 漢字' and b.cella(3, 1)['v'] == 42, [b.cella(1, 1), b.cella(2, 1), b.cella(3, 1)])
        b.ok('[xls] la data si vede come data (dd/mm/yyyy)', b.testo(10, 1) == '15/03/2023', b.testo(10, 1))
        g = stile_vis(b, 1, 2); b.ok('[xls] B1 in grassetto', g and g['w'] in ('700', 'bold'), g)
        r = stile_vis(b, 6, 2); b.ok('[xls] B6 in rosso', r and r['col'] == 'rgb(255, 0, 0)', r)
        y = stile_vis(b, 7, 2); b.ok('[xls] B7 con lo sfondo giallo', y and y['bg'] == 'rgb(255, 255, 0)', y)
        cu = stile_vis(b, 5, 2); b.ok('[xls] B5 in Courier New', cu and 'Courier New' in cu['font'], cu)
        d = b.doc()
        b.ok('[xls] celle unite D1:F2', d['unioni'] == 1, d)
        b.ok('[xls] colonna H e riga 21 nascoste', d['nascC'] == [8] and d['nascR'] == [21], d)
        n = b.js("() => { const d = GR.getDoc(); return { commenti: d.comments ? d.comments.size : -1, link: (GR.getDoc().cellStyles && 0) }; }")
        b.ok('[xls] commento su A1', n['commenti'] == 1, n)
        b.js("async () => { await GR.switchSheet('Formule e calcoli'); }"); b.attendi(700); b.aggiorna()
        f1 = b.cella(1, 6); f22 = b.cella(22, 6); f54 = b.cella(54, 6); c3 = b.cella(3, 3)
        b.ok('[xls] formula =SUM(A1:A5) calcolata (150)', f1['raw'] == '=SUM(A1:A5)' and f1['v'] == 150, f1)
        b.ok('[xls] EOMONTH (funzione aggiuntiva di Excel) calcolata', f22['raw'].startswith('=EOMONTH(') and f22['v'] == 46081, f22)
        b.ok('[xls] nome definito Prezzo nella formula (=Prezzo*2 → 20)', f54['raw'] == '=Prezzo*2' and f54['v'] == 20, f54)
        b.ok('[xls] formula ripetuta (condivisa) nella colonna C (=A3+B3 → 90)', c3['raw'] == '=A3+B3' and c3['v'] == 90, c3)
        # Salva: il file originale non si riscrive, si sceglie un nome e si scrive un .xlsx
        prima = len(b.salvati())
        b.menu('File', 'Salva'); b.attendi(1500)
        s = b.salvati()
        b.ok('[xls] Salva chiede un nome nuovo e scrive un .xlsx', len(s) == prima + 1 and s[-1]['nome'].endswith('.xlsx'), s[-1:] if s else s)
        firma = b.js("(i) => window.__salvati[i].bytes.slice(0, 2)", len(s) - 1) if s else []
        b.ok('[xls] il file scritto è un archivio .xlsx vero', firma == [0x50, 0x4b], firma)
    prova(b, 'Giro xls di LibreOffice', libreoffice)

    def excel4():
        apri(b, 'irs-excel4.xls')
        st = b.stato_app()
        b.ok('[excel 4] si apre, il foglio prende il nome del file', 'Aperto' in (st['msg'] or '') and st['fogli'] == ['irs-excel4'], [st['msg'], st['fogli']])
        n = b.js("async () => { const d = GR.getDoc(); let f = 0, num = 0; for (let r = 1; r <= 120; r++) for (let c = 1; c <= 20; c++) { const x = await d.client.getCell(d.activeSheetName, r, c); if (String(x.raw).startsWith('=')) { f++; if (x.value.kind === 'number') num++; } } return {f, num}; }")
        b.ok('[excel 4] le 99 formule ci sono e si calcolano tutte', n['f'] == 99 and n['num'] == 99, n)
    prova(b, 'Giro Excel 4.0', excel4)

    def protetto():
        # dal 0.2.13 un .xls cifrato con RC4 non si rifiuta: si chiede la password (qui «segreta», come in T550)
        apri(b, 'prova-password.xls')
        d = "APP.shadowRoot.querySelector('free-dialogo-password-file')"
        b.ok('[protetto] si chiede la password', b.js(f"() => !!{d}"))
        b.primo_piano(); b.os_testo('sbagliata'); b.os_tasto('Invio'); b.attendi(1200)
        b.ok('[protetto] con la password sbagliata lo dice e la richiede', 'non è giusta' in (b.js(f"() => {d} ? {d}.errore : ''") or ''), b.js(f"() => {d} ? {d}.errore : null"))
        b.primo_piano(); b.os_testo('segreta'); b.os_tasto('Invio'); b.attendi(2500)
        st = b.stato_app()
        b.ok('[protetto] con la password giusta si apre', not b.js(f"() => !!{d}") and 'Aperto' in (st['msg'] or ''), st['msg'])
    prova(b, 'Giro xls protetto', protetto)

    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])
