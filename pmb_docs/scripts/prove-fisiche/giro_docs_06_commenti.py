"""Prova fisica di commenti e modifiche registrate nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti
PMB_DOCS_EXE): apre dal menu File › Apri il documento fatto da Word (tests/file-prova/revisioni/word-commenti.docx), controlla nella pagina il
testo commentato evidenziato e le modifiche (inserito sottolineato, cancellato barrato), apre il pannello «Commenti e modifiche» dal menu,
accetta tutte le modifiche e annulla, aggiunge un commento con Ctrl+Alt+M scritto con la tastiera, risponde, accende la registrazione dal
menu Strumenti › Revisioni, scrive e cancella, e salva in .docx (controllo dentro il file: comments.xml, w:ins e w:del con il nome
dell'autore). La finestra di scelta del file è sostituita (le finestre vere di Windows le prova giro_docs_03). Uso: python giro_docs_06_commenti.py"""
import io, json, os, re, subprocess, time, zipfile
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9766
FILE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests', 'file-prova', 'revisioni', 'word-commenti.docx'))
AUTORE = 'Prova Fisica'
n = {'OK': 0, 'FAIL': 0}

def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro06_{int(time.time())}')
p = subprocess.Popen([EXE], env=env)
pw = sync_playwright().start()
for _ in range(80):
    try: browser = pw.chromium.connect_over_cdp(f'http://127.0.0.1:{PORTA}'); break
    except Exception: time.sleep(0.5)
pg = browser.contexts[0].pages[0]; pg.set_default_timeout(6000)
pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
pg.evaluate("(a) => localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it', tema: 'chiaro', temaScelto: true, autore: a }))", AUTORE)
pg.reload(); pg.wait_for_selector('docs-guscio'); pg.wait_for_timeout(1500)
errori = []
pg.on('pageerror', lambda e: errori.append(str(e)[:200]))
pg.on('console', lambda m: errori.append('console: ' + m.text[:200]) if m.type == 'error' else None)
pg.evaluate("() => Object.defineProperty(window, 'G', { get: () => document.querySelector('docs-guscio'), configurable: true })")
js = lambda s, a=None: pg.evaluate(s, a)
js("""() => { const g = G; window.__salvati = []; window.__aprire = null;
  g.salva = async (nome, bytes, mime) => { window.__salvati.push({ nome, mime, byte: Array.from(new Uint8Array(bytes)) }); return null; };
  g.scegli = async () => window.__aprire ? new File([new Uint8Array(window.__aprire.byte)], window.__aprire.nome) : null; }""")
barra = pg.locator('docs-menubar')

def voce_menu(menu, voce, figlio=None):
    barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(f':scope > .etichetta:text-is("{voce}")'))
    if figlio is None: v.click()
    else:
        v.hover(); pg.wait_for_timeout(300)
        barra.locator('.sottopannello .figlio').filter(has=pg.locator(f'.etichetta:text-is("{figlio}")')).first.click()
    pg.wait_for_timeout(600)

DOC = "() => JSON.stringify(G.shadowRoot.querySelector('docs-editor').stato.doc)"
doc = lambda: json.loads(js(DOC))
def testo(d=None):
    d = d or doc()
    return '\n'.join(''.join(r['t'] for r in par['runs']) for par in d['paragrafi'])
def tratti(f):
    return [r['t'] for par in doc()['paragrafi'] for r in par['runs'] if f(r)]
STILE = """(sel) => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const s = r.querySelector(sel); if (!s) return null;
  const c = getComputedStyle(s); return { testo: s.textContent, deco: c.textDecorationLine, sfondo: c.backgroundColor, colore: c.color, titolo: s.title }; }"""
PANNELLO = "() => { const p = G.shadowRoot.querySelector('docs-commenti'); if (!p) return null; const r = p.shadowRoot; return { schede: r.querySelectorAll('.scheda:not(.nuovo-commento)').length, modifiche: r.querySelectorAll('.modifica').length, registra: r.querySelector('.stato-reg')?.textContent.trim(), larghezza: Math.round(p.getBoundingClientRect().width) }; }"

try:
    # ---- apertura del documento di Word
    js("(x) => { window.__aprire = { nome: x[0], byte: x[1] }; }", ['word-commenti.docx', list(open(FILE, 'rb').read())])
    voce_menu('file', 'Apri'); pg.wait_for_timeout(1500)
    d = doc()
    esito('[docx di Word] due commenti, uno con risposta e uno risolto', [(c['a'], c['t'], c.get('ok', False), len(c.get('r', []))) for c in d.get('commenti', [])] == [('Anna Rossi', 'Questa frase va bene?', False, 1), ('Anna Rossi', 'Già sistemato.', True, 0)], d.get('commenti'))
    esito('[docx di Word] le modifiche: «da rivedere » cancellato, « e attenzione» inserito, registrazione accesa', tratti(lambda r: r.get('rv', {}).get('t') == 'd') == ['da rivedere '] and tratti(lambda r: r.get('rv', {}).get('t') == 'i') == [' e attenzione'] and d.get('revisioni') is True, [tratti(lambda r: 'rv' in r), d.get('revisioni')])
    cm = js(STILE, '.cm'); ins = js(STILE, '.rv-i'); de = js(STILE, '.rv-d')
    esito('[pagina] il testo commentato è evidenziato in giallo', cm and cm['testo'] == 'parola commentata' and cm['sfondo'] not in ('rgba(0, 0, 0, 0)', 'transparent'), cm)
    esito('[pagina] l\'inserito è sottolineato e colorato, con l\'autore nel suggerimento', ins and 'underline' in ins['deco'] and ins['colore'] != 'rgb(0, 0, 0)' and 'Bruno Verdi' in ins['titolo'], ins)
    esito('[pagina] il cancellato è barrato', de and 'line-through' in de['deco'] and de['testo'] == 'da rivedere ', de)
    # ---- pannello dal menu Visualizza
    voce_menu('visualizza', 'Mostra commenti e modifiche')
    pa = js(PANNELLO)
    esito('[pannello] si apre dal menu: 1 commento aperto (il risolto è nascosto), 2 modifiche, registrazione accesa', pa and pa['schede'] == 1 and pa['modifiche'] == 2 and pa['registra'] == 'Registrazione accesa' and pa['larghezza'] >= 300, pa)
    pann = pg.locator('docs-commenti')
    pann.locator('button.accetta-tutte').click(); pg.wait_for_timeout(600)
    esito('[pannello] «Accetta tutte»: niente più modifiche, il testo è quello finale', tratti(lambda r: 'rv' in r) == [] and 'Secondo paragrafo con calma e attenzione.' in testo(), testo())
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(500)
    esito('Ctrl+Z rimette le modifiche', len(tratti(lambda r: 'rv' in r)) == 2, tratti(lambda r: 'rv' in r))
    # ---- registrazione spenta, poi un commento nuovo con Ctrl+Alt+M e la tastiera
    pann.locator('button.registra').click(); pg.wait_for_timeout(400)
    esito('[pannello] «Spegni» spegne la registrazione', doc().get('revisioni') is not True, doc().get('revisioni'))
    js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const s = ed.stato; ed.impostaStato({ ...s, sel: { ancora: { p: 2, o: 6 }, fuoco: { p: 2, o: 15 } } }); ed.focalizza(); }")
    pg.keyboard.press('Control+Alt+m'); pg.wait_for_timeout(700)
    fuoco = js("() => { const p = G.shadowRoot.querySelector('docs-commenti'); return p && p.shadowRoot.activeElement ? p.shadowRoot.activeElement.className : null; }")
    esito('Ctrl+Alt+M apre la casella del commento nuovo, con il fuoco dentro', fuoco == 'nuovo', fuoco)
    pg.keyboard.type('Da controllare', delay=25); pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(600)
    nuovi = [c for c in doc().get('commenti', []) if c['t'] == 'Da controllare']
    esito('il commento scritto con la tastiera c\'è, con il nome delle preferenze, su «paragrafo»', len(nuovi) == 1 and nuovi[0]['a'] == AUTORE and tratti(lambda r: r.get('cm') == nuovi[0]['id']) == ['paragrafo'], nuovi)
    scheda = pann.locator(f'.scheda[data-id="{nuovi[0]["id"]}"]') if nuovi else None
    if scheda:
        scheda.locator('textarea.rispondi').click(); pg.keyboard.type('Fatto', delay=25)
        scheda.locator('button.primario').click(); pg.wait_for_timeout(500)
        r = [c for c in doc().get('commenti', []) if c['t'] == 'Da controllare']
        esito('risposta al commento dal pannello', r and r[0].get('r', [{}])[0].get('t') == 'Fatto' and r[0]['r'][0]['a'] == AUTORE, r)
        scheda.locator('button.risolvi').click(); pg.wait_for_timeout(400)
        esito('«Risolvi» lo segna risolto', any(c['t'] == 'Da controllare' and c.get('ok') for c in doc().get('commenti', [])))
    # ---- registrazione dal menu Strumenti › Revisioni, poi scrittura e cancellazione con la tastiera
    voce_menu('strumenti', 'Revisioni', 'Registra modifiche')
    esito('Strumenti › Revisioni › Registra modifiche la accende', doc().get('revisioni') is True)
    js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const s = ed.stato; const f = s.doc.paragrafi[0].runs.map((r) => r.t).join('').length; ed.impostaStato({ ...s, sel: { ancora: { p: 0, o: f }, fuoco: { p: 0, o: f } } }); ed.focalizza(); }")
    pg.keyboard.type(' Nuovo', delay=25); pg.wait_for_timeout(300)
    esito('il testo scritto è segnato come inserito, a nome dell\'autore', tratti(lambda r: r.get('rv', {}).get('a') == AUTORE and r['rv']['t'] == 'i') == [' Nuovo'], tratti(lambda r: 'rv' in r))
    js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const s = ed.stato; ed.impostaStato({ ...s, sel: { ancora: { p: 0, o: 5 }, fuoco: { p: 0, o: 5 } } }); ed.focalizza(); }")
    pg.keyboard.press('Control+Backspace'); pg.wait_for_timeout(300)
    esito('Ctrl+Backspace su testo vecchio lo segna come cancellato (non sparisce)', tratti(lambda r: r.get('rv', {}).get('a') == AUTORE and r['rv']['t'] == 'd') == ['Primo'] and testo().startswith('Primo paragrafo'), tratti(lambda r: 'rv' in r))
    voce_menu('strumenti', 'Revisioni', 'Modifica successiva')
    sel = js("() => G.shadowRoot.querySelector('docs-editor').stato.sel")
    esito('Strumenti › Revisioni › Modifica successiva seleziona una modifica', sel['ancora'] != sel['fuoco'], sel)
    # ---- salvataggio in .docx
    prima = js("() => window.__salvati.length")
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    s = js("() => window.__salvati.map(x => x.nome)")
    if len(s) == prima + 1:
        dati = bytes(js("(i) => window.__salvati[i].byte", len(s) - 1))
        z = zipfile.ZipFile(io.BytesIO(dati))
        com = z.read('word/comments.xml').decode('utf-8') if 'word/comments.xml' in z.namelist() else ''
        docx = z.read('word/document.xml').decode('utf-8')
        esito('[docx salvato] i commenti e le risposte ci sono (Anna Rossi, Bruno Verdi, Prova Fisica)', all(x in com for x in ['Questa frase va bene?', 'Sì, va bene così.', 'Da controllare', 'Fatto', 'w:author="Prova Fisica"']), com[:200])
        esito('[docx salvato] inserito e cancellato di Prova Fisica come w:ins e w:del, registrazione accesa', re.search(r'<w:ins [^>]*w:author="Prova Fisica"', docx) is not None and re.search(r'<w:del [^>]*w:author="Prova Fisica"', docx) is not None and 'w:trackRevisions' in z.read('word/settings.xml').decode('utf-8'))
        esito('[docx salvato] risolti in commentsExtended', 'w15:done="1"' in z.read('word/commentsExtended.xml').decode('utf-8'))
        open(os.path.join(os.environ['TEMP'], 'giro_docs_06.docx'), 'wb').write(dati)
    else:
        esito('Ctrl+S scrive un file', False, s)
    voce_menu('visualizza', 'Mostra commenti e modifiche')
    esito('il pannello si chiude dallo stesso menu', js(PANNELLO) is None)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f"== giro_docs_06: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
