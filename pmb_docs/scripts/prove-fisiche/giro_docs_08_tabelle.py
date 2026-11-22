"""Prova fisica delle tabelle nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE):
celle unite con il mouse (clic e Maiusc+clic, poi Formato › Tabella › Unisci celle) in verticale e in orizzontale, Dividi cella,
Ripeti come riga di intestazione (spuntata nel menu; in una tabella lunga la riga si ripete in cima al foglio dopo), Tab che salta
le celle coperte, Ordina righe dalla Z alla A, avvisi quando l'operazione non si può fare, salvataggio .docx e .odt con le unioni e
l'intestazione. Uso: python giro_docs_08_tabelle.py   (non muovere il mouse durante la prova)"""
import io, json, os, re, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9768
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro08_{int(time.time())}')
p = subprocess.Popen([EXE], env=env)
pw = sync_playwright().start()
for _ in range(80):
    try: browser = pw.chromium.connect_over_cdp(f'http://127.0.0.1:{PORTA}'); break
    except Exception: time.sleep(0.5)
pg = browser.contexts[0].pages[0]; pg.set_default_timeout(6000)
pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
pg.evaluate("() => localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it', tema: 'chiaro', temaScelto: true }))")
pg.reload(); pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
errori = []
pg.on('pageerror', lambda e: errori.append(str(e)[:200]))
pg.on('console', lambda m: errori.append('console: ' + m.text[:200]) if m.type == 'error' else None)
pg.evaluate("() => Object.defineProperty(window, 'G', { get: () => document.querySelector('docs-guscio'), configurable: true })")
js = lambda s, a=None: pg.evaluate(s, a)
js("() => { window.__salvati = []; G.salva = async (nome, bytes) => { window.__salvati.push({ nome, byte: Array.from(new Uint8Array(bytes)) }); return null; }; }")
barra = pg.locator('docs-menubar')
def voce_tabella(voce):
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Tabella")'))
    v.hover(); pg.wait_for_timeout(350)
    f = v.locator('.sottopannello .figlio').filter(has=pg.locator(f'.etichetta:text-is("{voce}")'))
    try: f.click(timeout=2500)
    except Exception:
        # il puntatore che va verso il sottomenu può chiuderlo: si riapre e si clicca l'elemento direttamente (come giro_docs_01)
        pg.keyboard.press('Escape'); barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
        v.hover(); pg.wait_for_timeout(350); f.evaluate('e => e.click()')
    pg.wait_for_timeout(600)
def spuntata(voce):
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Tabella")'))
    v.hover(); pg.wait_for_timeout(350)
    s = [x.strip() for x in v.locator('.sottopannello .figlio[aria-checked="true"] .etichetta').all_text_contents()]
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    return voce in s, s
doc = lambda: json.loads(js("() => JSON.stringify(G.shadowRoot.querySelector('docs-editor').stato.doc)"))
cursore = lambda: js("() => G.shadowRoot.querySelector('docs-editor').stato.sel.fuoco")
avviso = lambda: js("() => G.avviso")
td = lambda t, r, c: pg.locator(f'docs-editor table.tabella >> nth={t}').locator(f'td[data-r="{r}"][data-c="{c}"]').first
CELLE = "(t) => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const tab = r.querySelectorAll('table.tabella')[t]; return [...tab.querySelectorAll('tr:not(.salto-riga)')].map((tr) => [...tr.cells].map((c) => (c.classList.contains('coperta') ? '·' : c.textContent + (c.colSpan > 1 || c.rowSpan > 1 ? `[${c.rowSpan}x${c.colSpan}]` : '')))); }"

try:
    # documento: un titolo, una tabella 4×3 come quella di Word (word_tabelle.py), un paragrafo, poi una tabella lunga 1+45 righe
    js("""() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = (t) => (t === '' ? [] : [{ t, g: false, c: false, s: false }]);
      const V = [['Nome', 'Ruolo', 'Note'], ['Anna', 'Analista', 'Unita in verticale'], ['Bruno', 'Tecnico', ''], ['Unita in orizzontale', '', 'Fine']];
      const piccola = V.flatMap((riga, ri) => riga.map((v, ci) => ({ runs: r(v), tb: { i: 0, r: ri, c: ci } })));
      const lunga = [{ runs: r('Codice'), tb: { i: 1, r: 0, c: 0 } }, { runs: r('Descrizione'), tb: { i: 1, r: 0, c: 1 } }];
      for (let k = 1; k <= 45; k++) { lunga.push({ runs: r(`R${String(k).padStart(2, '0')}`), tb: { i: 1, r: k, c: 0 } }, { runs: r(`Riga numero ${k} della tabella lunga`), tb: { i: 1, r: k, c: 1 } }); }
      ed.impostaStato({ doc: { paragrafi: [{ runs: r('Tabelle di prova') }, ...piccola, { runs: r('Tra le tabelle') }, ...lunga, { runs: [] }] },
        sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); ed.focalizza(); }""")
    pg.wait_for_timeout(900)
    # unione verticale: clic in «Unita in verticale», Maiusc+clic nella cella sotto (vuota)
    td(0, 1, 2).click(); pg.wait_for_timeout(200)
    td(0, 2, 2).click(modifiers=['Shift']); pg.wait_for_timeout(300)
    voce_tabella('Unisci celle')
    c = js(CELLE, 0)
    esito('Maiusc+clic su due celle e Unisci celle: unite in verticale (rowspan 2), la cella sotto nascosta', c[1][2] == 'Unita in verticale[2x1]' and c[2][2] == '·', c)
    # unione orizzontale
    td(0, 3, 0).click(); pg.wait_for_timeout(200)
    td(0, 3, 1).click(modifiers=['Shift']); pg.wait_for_timeout(300)
    voce_tabella('Unisci celle')
    c = js(CELLE, 0)
    esito('Unisci celle in orizzontale (colspan 2)', c[3][:2] == ['Unita in orizzontale[1x2]', '·'], c)
    w = js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const t = r.querySelector('table.tabella'); const a = t.querySelector('td[data-r=\"3\"][data-c=\"0\"]').getBoundingClientRect().width; const b = t.querySelector('td[data-r=\"2\"][data-c=\"0\"]').getBoundingClientRect().width + t.querySelector('td[data-r=\"2\"][data-c=\"1\"]').getBoundingClientRect().width; return [Math.round(a), Math.round(b)]; }")
    esito('la cella unita è larga come le due celle sopra', abs(w[0] - w[1]) <= 2, w)
    # Tab da «Tecnico» salta la cella coperta e va in «Unita in orizzontale»
    td(0, 2, 1).click(); pg.wait_for_timeout(200)
    pg.keyboard.press('End'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300)
    d = doc(); cur = cursore()
    esito('Tab salta la cella coperta', d['paragrafi'][cur['p']].get('tb', {}).get('r') == 3 and d['paragrafi'][cur['p']]['tb']['c'] == 0, d['paragrafi'][cur['p']].get('tb'))
    pg.keyboard.type('!', delay=30); pg.wait_for_timeout(300)
    esito('e si scrive nella cella giusta', js(CELLE, 0)[3][0] == 'Unita in orizzontale!' or js(CELLE, 0)[3][0].startswith('!'), js(CELLE, 0)[3])
    # Dividi cella senza unione: avviso; poi riga di intestazione
    td(0, 0, 0).click(); pg.wait_for_timeout(200)
    voce_tabella('Dividi cella')
    esito('Dividi cella su una cella normale: avviso', avviso() == 'La cella del cursore non è una cella unita', avviso())
    voce_tabella('Unisci celle')
    esito('Unisci celle con il solo cursore: avviso', avviso() == 'Seleziona due o più celle della stessa tabella da unire', avviso())
    voce_tabella('Ripeti come riga di intestazione')
    esito('Ripeti come riga di intestazione: la prima riga è di intestazione', all(x.get('tb', {}).get('h') for x in doc()['paragrafi'][1:4]), doc()['paragrafi'][1].get('tb'))
    sp = spuntata('Ripeti come riga di intestazione')
    esito('e nel menu la voce è spuntata', sp[0], sp[1])
    # tabella lunga: intestazione ripetuta nel foglio dopo
    td(1, 0, 0).click(); pg.wait_for_timeout(200)
    voce_tabella('Ripeti come riga di intestazione')
    pg.wait_for_timeout(600)
    rip = js("""() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const t = r.querySelectorAll('table.tabella')[1];
      return [...t.querySelectorAll('tr.intestazione-ripetuta')].map((x) => [x.textContent, x.querySelectorAll('[data-p]').length]); }""")
    esito('in una tabella su due fogli la riga di intestazione si ripete in cima al foglio dopo (copia senza paragrafi del documento)', len(rip) >= 1 and rip[0][0] == 'CodiceDescrizione' and rip[0][1] == 0, rip)
    fogli = js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const t = r.querySelectorAll('table.tabella')[1]; const x = t.querySelector('tr.intestazione-ripetuta'); const s = x ? x.previousElementSibling : null; return x && s ? [Math.round(s.getBoundingClientRect().height), s.className] : null; }")
    esito('la copia sta subito dopo lo spazio del salto di pagina', fogli is not None and fogli[1] == 'salto-riga' and fogli[0] > 50, fogli)
    pg.screenshot(path=os.path.join(os.environ['TEMP'], 'giro_docs_08_intestazione.png'))
    # ordinare la tabella lunga dalla Z alla A per la prima colonna: R45 in cima, l'intestazione resta
    td(1, 5, 0).click(); pg.wait_for_timeout(200)
    voce_tabella('Ordina righe dalla Z alla A')
    c = js(CELLE, 1)
    esito('Ordina righe dalla Z alla A: intestazione ferma, poi R45, R44, …', c[0] == ['Codice', 'Descrizione'] and c[1][0] == 'R45' and c[45][0] == 'R01' and c[1][1] == 'Riga numero 45 della tabella lunga', [c[0], c[1], c[45]])
    voce_tabella('Ordina righe dalla Z alla A')
    esito('ordinata di nuovo: avviso che è già in ordine', avviso() == 'Le righe sono già in ordine', avviso())
    td(0, 1, 0).click(); pg.wait_for_timeout(200)
    voce_tabella('Ordina righe dalla A alla Z')
    esito('con celle unite in verticale non si ordina: avviso', avviso() == 'Non si possono ordinare righe con celle unite in verticale', avviso())
    # salvataggio .docx (Ctrl+S) e .odt
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        dati = bytes(js("() => window.__salvati[window.__salvati.length - 1].byte"))
        x = zipfile.ZipFile(io.BytesIO(dati)).read('word/document.xml').decode('utf-8')
        esito('[docx] tblHeader, gridSpan e vMerge come li scrive Word', x.count('<w:tblHeader/>') == 2 and '<w:gridSpan w:val="2"/>' in x and '<w:vMerge w:val="restart"/>' in x and '<w:vMerge/>' in x)
        open(os.path.join(os.environ['TEMP'], 'giro_docs_08.docx'), 'wb').write(dati)
    else: esito('Ctrl+S scrive un file', False)
    js("() => { window.__salvati = []; }"); js("() => G.scarica('odt')"); pg.wait_for_timeout(1200)
    if js("() => window.__salvati.length"):
        dati = bytes(js("() => window.__salvati[0].byte"))
        x = zipfile.ZipFile(io.BytesIO(dati)).read('content.xml').decode('utf-8')
        esito('[odt] table-header-rows, number-rows/columns-spanned e covered-table-cell come li scrive LibreOffice', x.count('<table:table-header-rows>') == 2 and 'table:number-rows-spanned="2"' in x and 'table:number-columns-spanned="2"' in x and x.count('<table:covered-table-cell/>') == 2)
        open(os.path.join(os.environ['TEMP'], 'giro_docs_08.odt'), 'wb').write(dati)
    else: esito('Scarica come .odt scrive un file', False)
    # dividere la cella unita in verticale
    td(0, 1, 2).click(); pg.wait_for_timeout(200)
    voce_tabella('Dividi cella')
    c = js(CELLE, 0)
    esito('Dividi cella riporta le due celle', c[1][2] == 'Unita in verticale' and c[2][2] == '', c)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(400)
    esito('Ctrl+Z la riunisce', js(CELLE, 0)[1][2] == 'Unita in verticale[2x1]', js(CELLE, 0)[1])
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    p.kill(); subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f"== giro_docs_08: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
