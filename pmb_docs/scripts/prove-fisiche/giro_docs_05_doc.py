"""Prova fisica dell'apertura dei documenti .doc (Word 97-2003) nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs;
altrimenti PMB_DOCS_EXE), dal menu File › Apri cliccato con il mouse: il documento di prova di LibreOffice (tests/file-prova/doc/prova.doc)
si vede nella pagina con titoli, grassetto, colori, elenchi, tabella, link, immagine, nota, intestazione e piè di pagina; il .doc protetto e un
.xls danno un messaggio chiaro; «Salva» chiede un nome nuovo e scrive un .docx. La finestra di scelta del file è sostituita (le finestre vere di
Windows le prova giro_docs_03). Uso: python giro_docs_05_doc.py"""
import json, os, subprocess, time
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9765
PROVA = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests', 'file-prova', 'doc'))
XLS = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'pmb_sheets', 'pmb_sheets', 'tests', 'file-prova', 'xls', 'prova.xls'))
n = {'OK': 0, 'FAIL': 0}

def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro05_{int(time.time())}')
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
js("""() => { const g = G; window.__salvati = []; window.__aprire = null;
  g.salva = async (nome, bytes, mime) => { const b = new Uint8Array(bytes); window.__salvati.push({ nome, mime, n: b.length, inizio: Array.from(b.slice(0, 4)) }); return null; };
  g.scegli = async () => window.__aprire ? new File([new Uint8Array(window.__aprire.byte)], window.__aprire.nome) : null; }""")

def apri_dal_menu(percorso, nome):
    js("(x) => { window.__aprire = { nome: x[0], byte: x[1] }; }", [nome, list(open(percorso, 'rb').read())])
    barra = pg.locator('docs-menubar')
    barra.locator('button.titolo-menu[data-menu="file"]').click(); pg.wait_for_timeout(300)
    voci = barra.locator('.pannello > .voce')
    etichette = voci.evaluate_all("els => els.map(e => e.querySelector('.etichetta').textContent.trim())")
    voci.nth(next(i for i, e in enumerate(etichette) if e.startswith('Apri'))).click(); pg.wait_for_timeout(2500)

def avviso():
    return js("() => { const a = G.shadowRoot.querySelector('.avviso'); return a ? a.textContent.trim() : ''; }")

PAGINA = """() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const tutto = r.textContent;
  const el = (sel) => [...r.querySelectorAll(sel)];
  const stile = (testo) => { const s = el('span, strong, em, a, p, h1, h2, h3, li, td').find((x) => x.childElementCount === 0 && x.textContent.trim() === testo); if (!s) return null; const c = getComputedStyle(s); return { w: c.fontWeight, col: c.color, bg: c.backgroundColor, font: c.fontFamily, size: c.fontSize, deco: c.textDecorationLine }; };
  return { testo: tutto.replace(/\\s+/g, ' ').slice(0, 4000), titoli: el('h1, h2, h3, [data-st]').length, celle: el('td').length,
    immagini: el('img').map((i) => [i.naturalWidth, Math.round(i.getBoundingClientRect().width)]), link: el('.link').map((a) => a.getAttribute('data-u')),
    grassetto: stile('grassetto'), rosso: stile('rosso'), evidenziato: stile('evidenziato'), courier: stile('Courier 14'),
    stato: (() => { const s = ed.stato; return s ? { paragrafi: s.doc.paragrafi.length, el: s.doc.paragrafi.filter((p) => p.el).map((p) => p.el), st: s.doc.paragrafi.filter((p) => p.st).map((p) => p.st), intest: (s.doc.intestazione || []).map((p) => p.runs.map((x) => x.t).join('')), piede: (s.doc.piede || []).map((p) => p.runs.map((x) => x.t).join('')) } : null; })() }; }"""

try:
    apri_dal_menu(os.path.join(PROVA, 'prova.doc'), 'prova.doc')
    a = avviso()
    esito('[doc] messaggio dopo l\'apertura: vecchio Word 97-2003, Salva in .docx', 'Word 97-2003' in a, a)
    v = js(PAGINA)
    esito('[doc] il testo si vede nella pagina', 'Titolo del documento' in v['testo'] and 'Testo normale' in v['testo'] and 'città àèìòù €' in v['testo'], v['testo'][:300])
    st = v['stato'] or {}
    PARAGRAFI_PROVA = st.get("paragrafi")
    esito('[doc] titolo, capitolo, sottocapitoli (Titolo, Titolo 1-3)', st.get('st') == ['t', '1', '2', '3'], st.get('st'))
    esito('[doc] elenco puntato e numerato', st.get('el') == ['p', 'p', 'n', 'n'], st.get('el'))
    esito('[doc] «grassetto» in grassetto nella pagina', v['grassetto'] and v['grassetto']['w'] in ('700', 'bold'), v['grassetto'])
    esito('[doc] «rosso» in rosso (#c00000)', v['rosso'] and v['rosso']['col'] == 'rgb(192, 0, 0)', v['rosso'])
    esito('[doc] «evidenziato» con lo sfondo giallo', v['evidenziato'] and v['evidenziato']['bg'] == 'rgb(255, 255, 0)', v['evidenziato'])
    esito('[doc] «Courier 14» in Courier New', v['courier'] and 'Courier New' in v['courier']['font'], v['courier'])
    esito('[doc] la tabella 3×3', v['celle'] == 9, v['celle'])
    esito('[doc] il link verso example.com', 'https://www.example.com/' in v['link'], v['link'])
    esito('[doc] l\'immagine (40×30 pixel, larga 80 nella pagina)', len(v['immagini']) == 1 and v['immagini'][0][0] == 40, v['immagini'])
    esito('[doc] la nota in fondo al documento', '1. Testo della nota' in v['testo'], v['testo'][-200:])
    esito('[doc] intestazione e piè di pagina con il numero di pagina', st.get('intest') == ['Intestazione del documento'] and st.get('piede') == ['Pagina \ue000'], [st.get('intest'), st.get('piede')])
    # Salva: il file originale non si riscrive, si sceglie un nome e si scrive un .docx
    prima = js("() => window.__salvati.length")
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    s = js("() => window.__salvati")
    esito('[doc] Salva scrive un .docx con un nome nuovo', len(s) == prima + 1 and s[-1]['nome'].endswith('.docx') and s[-1]['inizio'][:2] == [0x50, 0x4b], s[-1:] if s else s)

    # dal 0.4.15 un .doc cifrato con RC4 non si rifiuta: si chiede la password (qui «segreta», come in T551)
    apri_dal_menu(os.path.join(PROVA, 'prova-password.doc'), 'prova-password.doc')
    esito('[doc protetto] si chiede la password', js("() => !!G.shadowRoot.querySelector('docs-password-file')"))
    pg.keyboard.type('segreta'); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    par = js("() => G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi.length")
    esito('[doc protetto] con la password giusta si apre (stesso documento di prova.doc)', not js("() => !!G.shadowRoot.querySelector('docs-password-file')") and par == PARAGRAFI_PROVA, [par, PARAGRAFI_PROVA, avviso()])
    apri_dal_menu(XLS, 'tabella.xls')
    a = avviso()
    esito('[xls in pmb_docs] messaggio: è un foglio di Excel, si apre con pmb_sheets', 'si apre con pmb_sheets' in a, a)
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    p.kill()
    subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f"== giro_docs_05: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
