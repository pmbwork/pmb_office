"""Prova fisica delle immagini nel pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE):
clic sull'immagine, Formato › Immagine › Ruota a destra di 90° (l'immagine vera ruota, le misure si scambiano), Capovolgi, Ritaglia…
(finestra con l'anteprima, 25% da sinistra), Testo intorno a sinistra e a destra (il testo scorre accanto), di nuovo in linea, Ctrl+Z;
Ctrl+S in .docx (wp:anchor) e Scarica in .odt (l'immagine in Pictures/ e la cornice). Uso: python giro_docs_10_immagini.py"""
import base64, io, json, os, struct, subprocess, time, zipfile, zlib
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9770
n = {'OK': 0, 'FAIL': 0}
def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

def png(w, h):
    # metà sinistra rossa, metà destra blu: si vede da che parte è dopo rotazioni e capovolgimenti
    riga = b'\x00' + b''.join(bytes((220, 30, 30) if x < w // 2 else (30, 30, 220)) for x in range(w))
    blocco = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + blocco(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + blocco(b'IDAT', zlib.compress(riga * h)) + blocco(b'IEND', b'')
SRC = 'data:image/png;base64,' + base64.b64encode(png(160, 80)).decode()

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro10_{int(time.time())}')
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
def voce_immagine(voce):
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Immagine")'))
    v.hover(); pg.wait_for_timeout(350)
    f = v.locator('.sottopannello .figlio').filter(has=pg.locator(f'.etichetta:text-is("{voce}")'))
    try: f.click(timeout=2500)
    except Exception:
        pg.keyboard.press('Escape'); barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
        v.hover(); pg.wait_for_timeout(350); f.evaluate('e => e.click()')
    pg.wait_for_timeout(900)
im = lambda: json.loads(js("() => JSON.stringify(G.shadowRoot.querySelector('docs-editor').stato.doc.paragrafi[0].runs.find((r) => r.im)?.im ?? null)"))
# il colore del primo punto in alto a sinistra dell'immagine vera (rosso o blu)
COLORE = """() => new Promise((ok) => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const i = r.querySelector('.immagine img');
  const x = new Image(); x.onload = () => { const c = document.createElement('canvas'); c.width = x.naturalWidth; c.height = x.naturalHeight; const g = c.getContext('2d'); g.drawImage(x, 0, 0);
  const d = g.getImageData(1, 1, 1, 1).data; ok([x.naturalWidth, x.naturalHeight, d[0] > d[2] ? 'rosso' : 'blu']); }; x.src = i.src; })"""
seleziona = lambda: js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.impostaStato({ ...ed.stato, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 1 } } }); }")

try:
    testo = 'Questo testo deve scorrere accanto all\'immagine quando il testo è intorno. ' * 6
    js("""([src, testo]) => { const ed = G.shadowRoot.querySelector('docs-editor');
      ed.impostaStato({ doc: { paragrafi: [{ runs: [{ t: '\\uFFFC', g: false, c: false, s: false, im: { s: src, w: 160, h: 80 } }, { t: testo, g: false, c: false, s: false }] }, { runs: [] }] },
        sel: { ancora: { p: 1, o: 0 }, fuoco: { p: 1, o: 0 } }, pendenti: null }); ed.focalizza(); }""", [SRC, testo])
    pg.wait_for_timeout(700)
    pg.locator('docs-editor .immagine img').click(); pg.wait_for_timeout(400)
    sel = js("() => G.shadowRoot.querySelector('docs-editor').stato.sel")
    esito('un clic sull\'immagine la seleziona', sel['ancora']['o'] in (0, 1) and abs(sel['fuoco']['o'] - sel['ancora']['o']) == 1, sel)
    if abs(sel['fuoco']['o'] - sel['ancora']['o']) != 1: seleziona()
    voce_immagine('Ruota a destra di 90°')
    c = js(COLORE); m = im()
    esito('Ruota a destra: l\'immagine vera diventa 80×160 e il rosso (prima a sinistra) va in alto', c == [80, 160, 'rosso'] and [m['w'], m['h']] == [80, 160], [c, m and [m['w'], m['h']]])
    voce_immagine('Capovolgi in verticale')
    c = js(COLORE)
    esito('Capovolgi in verticale: ora in alto c\'è il blu', c == [80, 160, 'blu'], c)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(500); pg.keyboard.press('Control+z'); pg.wait_for_timeout(500)
    esito('due Ctrl+Z riportano l\'immagine com\'era', js(COLORE) == [160, 80, 'rosso'] and [im()['w'], im()['h']] == [160, 80], js(COLORE))
    seleziona(); pg.wait_for_timeout(200)
    voce_immagine('Ritaglia…')
    d = pg.locator('docs-ritaglio')
    esito('Ritaglia… apre la finestra con l\'anteprima', d.count() == 1 and d.locator('img').count() == 1)
    d.locator('input.lato-sx').fill('50'); pg.wait_for_timeout(200)
    vela = js("() => getComputedStyle(G.shadowRoot.querySelector('docs-ritaglio').shadowRoot.querySelector('.velo')).width")
    d.locator('input.lato-sx').fill('25'); pg.wait_for_timeout(200)
    esito('nell\'anteprima la parte tolta è velata (il 50% si ferma al 45%)', vela not in (None, '0px'), vela)
    d.locator('button.ritaglia').click(); pg.wait_for_timeout(900)
    c = js(COLORE); m = im()
    esito('Ritaglia 25% da sinistra: 120×80 nel file, 120 px nel foglio', c[:2] == [120, 80] and m['w'] == 120 and m['h'] == 80, [c, m and [m['w'], m['h']]])
    seleziona(); voce_immagine('Testo intorno, immagine a sinistra')
    geo = js("""() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; const i = r.querySelector('.immagine'); const p = r.querySelector('p[data-p="0"]');
      const t = [...p.childNodes].find((n) => n.nodeType === 1 && !n.classList.contains('immagine')); const rg = document.createRange(); rg.setStart(t.firstChild, 0); rg.setEnd(t.firstChild, 1);
      const a = i.getBoundingClientRect(); const b = rg.getBoundingClientRect(); return { float: getComputedStyle(i).cssFloat, imgDx: Math.round(a.right), testoSx: Math.round(b.left), stessaRiga: b.top < a.bottom }; }""")
    esito('Testo intorno a sinistra: l\'immagine galleggia a sinistra e la prima riga del testo le sta accanto', geo['float'] == 'left' and geo['testoSx'] >= geo['imgDx'] and geo['stessaRiga'], geo)
    pg.screenshot(path=os.path.join(os.environ['TEMP'], 'giro_docs_10_intorno.png'))
    seleziona(); voce_immagine('Testo intorno, immagine a destra')
    esito('Testo intorno a destra', js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; return getComputedStyle(r.querySelector('.immagine')).cssFloat; }") == 'right' and im()['a'] == 'dx')
    seleziona(); pg.wait_for_timeout(200)
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(250)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Immagine")')); v.hover(); pg.wait_for_timeout(350)
    spunte = [x.strip() for x in v.locator('.sottopannello .figlio[aria-checked="true"] .etichetta').all_text_contents()]
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    esito('nel menu è spuntato «Testo intorno, immagine a destra»', spunte == ['Testo intorno, immagine a destra'], spunte)
    pg.keyboard.press('Control+s'); pg.wait_for_timeout(1500)
    if js("() => window.__salvati.length"):
        x = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[window.__salvati.length - 1].byte")))).read('word/document.xml').decode('utf-8')
        esito('[docx] immagine ancorata a destra con il testo a riquadro (come Word)', '<wp:anchor ' in x and '<wp:align>right</wp:align>' in x and '<wp:wrapSquare wrapText="bothSides"/>' in x)
    else: esito('Ctrl+S scrive un file', False)
    js("() => { window.__salvati = []; }"); js("() => G.scarica('odt')"); pg.wait_for_timeout(1200)
    if js("() => window.__salvati.length"):
        z = zipfile.ZipFile(io.BytesIO(bytes(js("() => window.__salvati[0].byte"))))
        c = z.read('content.xml').decode('utf-8')
        figure = [k for k in z.namelist() if k.startswith('Pictures/')]
        esito('[odt] l\'immagine nel file (Pictures/) e la cornice a destra con il testo intorno (come LibreOffice)', len(figure) == 1 and 'draw:frame' in c and 'style:horizontal-pos="right"' in c and 'style:wrap="parallel"' in c, figure)
    else: esito('Scarica come .odt scrive un file', False)
    seleziona(); voce_immagine('In linea con il testo')
    esito('In linea con il testo: l\'immagine torna nel testo', im().get('a') is None and js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const r = ed.shadowRoot || ed; return getComputedStyle(r.querySelector('.immagine')).cssFloat; }") == 'none')
    esito('nessun errore nella pagina', len(errori) == 0, errori[:3])
finally:
    try: pw.stop()
    except Exception: pass
    p.kill(); subprocess.run(['taskkill', '/F', '/IM', 'pmb-docs-shell.exe'], capture_output=True)
print(f"== giro_docs_10: OK {n['OK']}  FAIL {n['FAIL']}", flush=True)
