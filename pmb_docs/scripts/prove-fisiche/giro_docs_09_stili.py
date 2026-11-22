"""Prova fisica degli stili personali nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE):
Formato › Stili paragrafo › Crea o gestisci stili…, nome scritto con la tastiera e «Crea dal paragrafo»; lo stile si vede (corpo, colore,
grassetto, allineamento) e compare nel menu e nella casella della barra; applicato a un altro paragrafo dal menu; aggiornato; rinominato;
Esc chiude la finestra; Ctrl+S scrive lo stile nel .docx come Word e Scarica in .odt come LibreOffice. Uso: python giro_docs_09_stili.py"""
import io, json, os, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9769
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro09_{int(time.time())}')
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
def voce_stili(voce):
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Stili paragrafo")'))
    v.hover(); pg.wait_for_timeout(350)
    f = v.locator('.sottopannello .figlio').filter(has=pg.locator(f'.etichetta:text-is("{voce}")'))
    try: f.click(timeout=2500)
    except Exception:
        pg.keyboard.press('Escape'); barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
        v.hover(); pg.wait_for_timeout(350); f.evaluate('e => e.click()')
    pg.wait_for_timeout(600)
def voci_stili():
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Stili paragrafo")'))
    v.hover(); pg.wait_for_timeout(350)
    r = [[x.locator('.etichetta').text_content().strip(), x.get_attribute('aria-checked')] for x in v.locator('.sottopannello .figlio').all()]
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    return r
doc = lambda: json.loads(js("() => JSON.stringify(G.shadowRoot.querySelector('docs-editor').stato.doc)"))
par_dom = lambda i: pg.locator(f'docs-editor p[data-p="{i}"]')
aspetto = lambda i: js(f"() => {{ const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const p = r.querySelector('p[data-p=\"{i}\"]'); const s = getComputedStyle(p); return [s.fontSize, s.color, s.fontWeight, s.textAlign]; }}")
dialogo = lambda: pg.locator('docs-stili')

try:
    js("""() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = (t) => [{ t, g: false, c: false, s: false }];
      ed.impostaStato({ doc: { paragrafi: [{ runs: r('Primo paragrafo da trasformare in avviso') }, { runs: r('Testo normale in mezzo') }, { runs: r('Secondo avviso') }] },
        sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); ed.focalizza(); }""")
    pg.wait_for_timeout(600)
    # formato del primo paragrafo con la tastiera e la barra: tutto selezionato, grassetto, al centro, corpo 18 e colore dalla barra (via azioni)
    par_dom(0).click(); pg.keyboard.press('Home'); pg.keyboard.press('Shift+End'); pg.keyboard.press('Control+b')
    js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.applicaAzione({ tipo: 'allinea', valore: 'ce' }); ed.applicaAzione({ tipo: 'attributo', chiave: 'z', valore: 18 }); ed.applicaAzione({ tipo: 'attributo', chiave: 'k', valore: '#c00000' }); }")
    pg.keyboard.press('End'); pg.wait_for_timeout(300)
    voce_stili('Crea o gestisci stili…')
    esito('Crea o gestisci stili… apre la finestra degli stili', dialogo().count() == 1 and dialogo().is_visible())
    dialogo().locator('input.nuovo').fill(''); dialogo().locator('input.nuovo').type('Avviso importante', delay=20)
    dialogo().locator('button.crea').click(); pg.wait_for_timeout(500)
    d = doc()
    esito('Crea dal paragrafo: lo stile nasce dal paragrafo del cursore e gli si applica', (d.get('stili') or [{}])[0].get('nome') == 'Avviso importante' and d['paragrafi'][0].get('su') == d['stili'][0]['id'], d.get('stili'))
    esito('lo stile ha corpo 18, rosso, grassetto, al centro', d['stili'][0].get('z') == 18 and d['stili'][0].get('k') == '#c00000' and d['stili'][0].get('g') is True and d['stili'][0].get('al') == 'ce', d['stili'][0])
    righe = dialogo().locator('li').all_text_contents()
    esito('la finestra elenca lo stile con «1 paragrafo»', len(righe) == 1 and 'Avviso importante' in righe[0] and '1 paragrafo' in righe[0], righe)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    esito('Esc chiude la finestra', dialogo().count() == 0)
    # applicato dal menu al terzo paragrafo
    par_dom(2).click(); pg.wait_for_timeout(200)
    voce_stili('Avviso importante')
    a = aspetto(2)
    esito('applicato dal menu al terzo paragrafo: si vede 18 pt (24px), rosso, grassetto, al centro', a == ['24px', 'rgb(192, 0, 0)', '700', 'center'], a)
    vs = voci_stili()
    esito('nel menu lo stile è spuntato e c\'è «Aggiorna «Avviso importante» come questo paragrafo»', ['Avviso importante', 'true'] in vs and any(x[0] == 'Aggiorna «Avviso importante» come questo paragrafo' for x in vs), vs)
    casella = js("() => G.shadowRoot.querySelector('docs-toolbar').shadowRoot.querySelector('[data-id=\"stile-paragrafo\"]')?.textContent?.trim()")
    esito('la casella dello stile nella barra mostra il nome', casella is not None and casella.startswith('Avviso impo'), casella)
    # aggiornato: il terzo paragrafo in corsivo, poi «Aggiorna» dal menu: anche il primo diventa corsivo
    par_dom(2).click(); pg.wait_for_timeout(200)
    pg.keyboard.press('Home'); pg.keyboard.press('Shift+End'); pg.keyboard.press('Control+i'); pg.keyboard.press('End'); pg.wait_for_timeout(200)
    voce_stili('Aggiorna «Avviso importante» come questo paragrafo')
    stile0 = js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; return getComputedStyle(r.querySelector('p[data-p=\"0\"]')).fontStyle; }")
    esito('Aggiorna dal paragrafo: lo stile diventa corsivo anche nel primo paragrafo', doc()['stili'][0].get('c') is True and stile0 == 'italic', [doc()['stili'][0], stile0])
    # rinomina dalla finestra
    voce_stili('Crea o gestisci stili…')
    dialogo().locator('button.rinomina-voce').click(); pg.wait_for_timeout(300)
    campo = dialogo().locator('input.rinomina'); campo.press('Control+a'); campo.type('Nota rossa', delay=20); campo.press('Enter'); pg.wait_for_timeout(400)
    esito('Rinomina dalla finestra', doc()['stili'][0]['nome'] == 'Nota rossa', doc()['stili'][0]['nome'])
    dialogo().locator('input.nuovo').type('Titolo 1', delay=20); dialogo().locator('button.crea').click(); pg.wait_for_timeout(400)
    err = dialogo().locator('.errore').text_content() if dialogo().locator('.errore').count() else ''
    esito('un nome già usato dagli stili di serie si rifiuta con un messaggio', 'già uno stile' in (err or ''), err)
    dialogo().locator('button.chiudi').click(); pg.wait_for_timeout(300)
    # salvataggio
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        z = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte"))))
        st = z.read('word/styles.xml').decode('utf-8'); dx = z.read('word/document.xml').decode('utf-8')
        sid = doc()['stili'][0]['id']
        esito('[docx] stile personale con nome, basato su Normal, grassetto, corsivo, rosso, 18 pt; i paragrafi lo usano', f'w:customStyle="1" w:styleId="{sid}"><w:name w:val="Nota rossa"/><w:basedOn w:val="Normal"/>' in st and '<w:b/>' in st and '<w:i/>' in st and 'C00000' in st and '<w:sz w:val="36"/>' in st and dx.count(f'<w:pStyle w:val="{sid}"/>') == 2)
    else: esito('Ctrl+S scrive un file', False)
    js("() => { window.__salvati = []; }"); js("() => G.scarica('odt')"); pg.wait_for_timeout(1200)
    if js("() => window.__salvati.length"):
        z = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[0].byte"))))
        st = z.read('styles.xml').decode('utf-8')
        esito('[odt] stile con nome «Nota rossa» in styles.xml, con le pagine maestre (LibreOffice collega il genitore)', 'style:display-name="Nota rossa"' in st and 'style:parent-style-name="Standard"' in st and '<office:master-styles>' in st)
    else: esito('Scarica come .odt scrive un file', False)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    p.kill(); subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f"== giro_docs_09: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
