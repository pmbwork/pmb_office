"""Prova fisica del sommario e della struttura del documento nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs;
altrimenti PMB_DOCS_EXE): documento con titoli su tre pagine, Inserisci › Sommario dal menu, numeri di pagina giusti nella pagina, Ctrl+clic
su una voce porta al titolo, Visualizza › Mostra struttura del documento (un clic porta al titolo, la sezione del cursore è evidenziata),
Inserisci › Aggiorna sommario dopo aver cambiato un titolo, Salva in .docx (campo TOC, stili toc, segnalibri _Toc). Uso: python giro_docs_07_sommario.py"""
import io, json, os, re, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9767
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro07_{int(time.time())}')
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
def voce_menu(menu, voce):
    barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(250)
    barra.locator('.pannello > .voce').filter(has=pg.locator(f':scope > .etichetta:text-is("{voce}")')).click(); pg.wait_for_timeout(700)
doc = lambda: json.loads(js("() => JSON.stringify(G.shadowRoot.querySelector('docs-editor').stato.doc)"))
cursore = lambda: js("() => G.shadowRoot.querySelector('docs-editor').stato.sel.fuoco")
VOCI = "() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; return [...r.querySelectorAll('p.sommario')].map((p) => [p.textContent, p.getAttribute('data-pg')]); }"

try:
    # documento: paragrafo vuoto in cima, poi tre titoli su tre pagine (salti di pagina) e un sottotitolo
    js("""() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = (t) => [{ t, g: false, c: false, s: false }];
      const lungo = (k) => Array.from({ length: 6 }, (_, i) => ({ runs: r(`Paragrafo ${k}.${i + 1} con un po' di testo per riempire la riga del documento.`) }));
      ed.impostaStato({ doc: { paragrafi: [{ runs: [] }, { st: '1', runs: r('Primo capitolo') }, ...lungo(1), { st: '2', runs: r('Una sezione') }, ...lungo(2),
        { st: '1', sp: true, runs: r('Secondo capitolo') }, ...lungo(3), { st: '1', sp: true, runs: r('Terzo capitolo') }, ...lungo(4)] },
        sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); ed.focalizza(); }""")
    pg.wait_for_timeout(800)
    voce_menu('inserisci', 'Sommario'); pg.wait_for_timeout(800)
    v = js(VOCI)
    esito('Inserisci › Sommario: quattro voci con i titoli', [x[0] for x in v] == ['Primo capitolo', 'Una sezione', 'Secondo capitolo', 'Terzo capitolo'], v)
    esito('numeri di pagina giusti (1, 1, 2, 3) calcolati dall\'impaginazione', [x[1] for x in v] == ['1', '1', '2', '3'], v)
    stile = js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const p = r.querySelector('p.sommario.sm-l2'); return p ? getComputedStyle(p).paddingLeft : null; }")
    esito('la voce di Titolo 2 è rientrata', stile not in (None, '0px'), stile)
    # Ctrl+clic sulla voce «Terzo capitolo»
    js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; r.querySelectorAll('p.sommario')[3].scrollIntoView(); }")
    pg.wait_for_timeout(300)
    voce = pg.locator('docs-editor p.sommario').nth(3)
    voce.click(modifiers=['Control']); pg.wait_for_timeout(700)
    d = doc(); c = cursore()
    esito('Ctrl+clic su «Terzo capitolo» porta il cursore al titolo', ''.join(r['t'] for r in d['paragrafi'][c['p']]['runs']) == 'Terzo capitolo' and c['o'] == 0, c)
    # struttura del documento
    voce_menu('visualizza', 'Mostra struttura del documento')
    s = js("() => { const p = G.shadowRoot.querySelector('docs-struttura'); if (!p) return null; const r = p.shadowRoot; return { voci: [...r.querySelectorAll('li')].map((l) => [l.className, l.textContent.trim()]), w: Math.round(p.getBoundingClientRect().width) }; }")
    esito('Visualizza › Mostra struttura del documento: i titoli, la sezione del cursore evidenziata', s and [x[1] for x in s['voci']] == ['Primo capitolo', 'Una sezione', 'Secondo capitolo', 'Terzo capitolo'] and 'corrente' in s['voci'][3][0], s)
    pg.locator('docs-struttura li button').nth(1).click(); pg.wait_for_timeout(600)
    c = cursore(); d = doc()
    esito('un clic su «Una sezione» nel pannello porta lì', ''.join(r['t'] for r in d['paragrafi'][c['p']]['runs']) == 'Una sezione', c)
    # cambio del titolo e aggiornamento
    pg.keyboard.press('End'); pg.keyboard.type(' nuova', delay=25); pg.wait_for_timeout(300)
    voce_menu('inserisci', 'Aggiorna sommario')
    v = js(VOCI)
    esito('Inserisci › Aggiorna sommario prende il titolo cambiato', [x[0] for x in v][1] == 'Una sezione nuova', v)
    s = js("() => [...G.shadowRoot.querySelector('docs-struttura').shadowRoot.querySelectorAll('li')].map((l) => l.textContent.trim())")
    esito('anche la struttura si aggiorna mentre si scrive', 'Una sezione nuova' in s, s)
    # salvataggio .docx
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    sal = js("() => window.__salvati.length")
    if sal:
        dati = bytes(js("() => window.__salvati[window.__salvati.length - 1].byte"))
        z = zipfile.ZipFile(io.BytesIO(dati))
        x = z.read('word/document.xml').decode('utf-8')
        esito('[docx] campo TOC, voci con stile TOC1/TOC2 e PAGEREF ai segnalibri _Toc dei titoli', ' TOC ' in x and 'w:val="TOC2"' in x and re.search(r'PAGEREF _Toc\d+', x) is not None and re.search(r'w:bookmarkStart w:id="\d+" w:name="_Toc\d+"', x) is not None)
        esito('[docx] Word aggiorna i campi all\'apertura', 'w:updateFields' in z.read('word/settings.xml').decode('utf-8'))
        open(os.path.join(os.environ['TEMP'], 'giro_docs_07.docx'), 'wb').write(dati)
    else: esito('Ctrl+S scrive un file', False)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    p.kill(); subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f"== giro_docs_07: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
