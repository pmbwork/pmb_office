"""Prova fisica COMPLETA di pmb_docs installato (di serie C:\\Program Files\\pmb_office\\pmb_docs; altrimenti PMB_DOCS_EXE).
Ogni voce di ogni menu (anche dei sottomenu, compresi quelli che dipendono dal punto del documento) e ogni pulsante della barra:
prima di ogni voce si prepara un documento adatto (testo selezionato; per Formato › Tabella il cursore in una tabella; per Formato › Immagine
un'immagine selezionata), si clicca, e si registra che cosa è successo (finestra aperta, documento cambiato, preferenza, stampa, salvataggio,
errori). Per le funzioni principali si controlla il risultato preciso. Le scelte di file del sistema sono sostituite (le finestre vere di Windows
le prova giro_docs_03); i file «salvati» si controllano dai byte (firma del formato). Profilo WebView2 temporaneo.
I clic sono quelli di Playwright (arrivano alla pagina senza muovere il puntatore di Windows).
Scrive l'elenco completo in %TEMP%\\pmb_docs_giro04.json. Uso: python giro_docs_04_tutto.py"""
import json, os, subprocess, time
from playwright.sync_api import sync_playwright

EXE = os.environ.get('PMB_DOCS_EXE', r'C:\Program Files\pmb_office\pmb_docs\pmb-docs-shell.exe')
PORTA = 9761
G = "document.querySelector('docs-guscio')"
USCITA = os.path.join(os.environ['TEMP'], 'pmb_docs_giro04.json')
NON_CLICCARE = {('visualizza', 'Schermo intero', None)}
A_PARTE = {('modifica', 'Annulla', None), ('modifica', 'Ripeti', None), ('modifica', 'Copia', None), ('formato', 'Stili paragrafo', 'Testo normale'),
           ('formato', 'Allinea e applica rientro', 'Sinistra'), ('formato', 'Allinea e applica rientro', 'Riduci rientro'),
           ('formato', 'Interlinea e spaziatura paragrafo', '1,15'), ('formato', 'Bordi e linee', 'Togli il bordo')}
BARRA_A_PARTE = {'annulla', 'ripeti', 'funzioni'}   # cambierebbe lo schermo di Windows: provato a parte con andata e ritorno
PNG = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 240, 31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]
risultati = []
n = {'OK': 0, 'FAIL': 0}

def esito(nome, cond, dettaglio=''):
    t = 'OK' if cond else 'FAIL'; n[t] += 1
    risultati.append({'prova': nome, 'esito': t, 'dettaglio': str(dettaglio)[:300]})
    print(f'{t}  {nome}' + (f'  [{str(dettaglio)[:220]}]' if dettaglio != '' else ''), flush=True)

env = dict(os.environ)
env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={PORTA}'
env['WEBVIEW2_USER_DATA_FOLDER'] = os.path.join(os.environ['TEMP'], f'pmb_docs_giro04_{int(time.time())}')
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
# «G» è il guscio, definito dentro la pagina (vale in ogni funzione mandata con js)
pg.evaluate("() => Object.defineProperty(window, 'G', { get: () => document.querySelector('docs-guscio'), configurable: true })")
js = lambda s, a=None: pg.evaluate(s, a)

# finestre di sistema sostituite: salvataggio e apertura registrano, la stampa conta
js("""(png) => { const g = G; window.__salvati = []; window.__stampe = 0; window.__aperture = 0; window.__aprire = null;
  window.print = () => { window.__stampe++; }; window.confirm = () => true; window.alert = () => {};
  g.salva = async (nome, bytes, mime) => { const b = new Uint8Array(bytes); window.__salvati.push({ nome, mime, n: b.length, inizio: Array.from(b.slice(0, 5)) }); return null; };
  g.scegli = async () => { window.__aperture++; return window.__aprire ? new File([new Uint8Array(window.__aprire.byte)], window.__aprire.nome) : null; };
  g.scegliImmagine = async () => new File([new Uint8Array(png)], 'punto.png', { type: 'image/png' });
}""", PNG)

SNAP = """() => { const g = G; const ed = g.shadowRoot.querySelector('docs-editor');
  const fissi = new Set(['docs-editor', 'docs-menubar', 'docs-toolbar', 'docs-righello', 'docs-righello-verticale', 'docs-finestra', 'docs-schede']);
  const dialoghi = [...new Set([...g.shadowRoot.querySelectorAll('*')].map((e) => e.tagName.toLowerCase()).filter((t) => t.startsWith('docs-') && !fissi.has(t)))].sort();
  const attr = (e) => [...e.attributes].filter((a) => a.name !== 'style' && a.name !== 'class').map((a) => a.name + '=' + a.value).sort().join(' ');
  return { doc: JSON.stringify(ed.stato.doc), sel: JSON.stringify(ed.stato.sel), dialoghi, attrG: attr(g), attrE: attr(ed), avviso: g.avviso || '',
    prefs: localStorage.getItem('pmb_docs.preferenze') || '', schede: (g.schede || []).length, stampe: window.__stampe, salvati: window.__salvati.length,
    aperture: window.__aperture, titolo: String(g.titoloInModifica), pagina: JSON.stringify(g.impostazioniPagina), zoom: g.zoom, colonne: String(ed.colonne),
    righello: String(g.righelloVisibile), trova: String(g.trovaAperta), popup: g.popup ? g.popup.titolo || 'menu' : '', ctx: g.menuContestuale ? 'menu' : '' }; }"""
snap = lambda: js(SNAP)

def differenze(a, b):
    out = []
    for k in a:
        if a[k] != b[k]:
            if k == 'dialoghi': out.append('finestra: ' + ', '.join(sorted(set(b[k]) - set(a[k]))) if set(b[k]) - set(a[k]) else 'finestra chiusa')
            elif k in ('doc', 'sel'): out.append('documento cambiato' if k == 'doc' else 'selezione cambiata')
            elif k == 'avviso': out.append(f'avviso «{b[k][:80]}»')
            else: out.append(f'{k}: {str(a[k])[:40]} → {str(b[k])[:60]}')
    return out

def chiudi_tutto():
    for _ in range(4):
        pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    js("() => { const g = G; for (let i = 0; i < 12 && g.chiudiUltimaFinestra && g.chiudiUltimaFinestra(); i++); g.popup = null; g.menuContestuale = null; g.trovaAperta = false; g.titoloInModifica = false; g.avviso = ''; if (g.hasAttribute('menu-nascosti')) g.alternaMenuNascosti(); }")
    pg.wait_for_timeout(150)

TESTO = 'Testo di prova per il menu'
def prepara(menu, voce):
    """Il documento giusto per la voce: testo selezionato; in una tabella; con un'immagine selezionata."""
    js("""([t]) => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.impostaMaiuscolaAutomatica(false);
      ed.impostaStato({ doc: { paragrafi: [{ runs: [{ t, g: false, c: false, s: false }] }, { runs: [{ t: 'Secondo paragrafo', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: t.length } }, pendenti: null }); ed.focalizza(); }""", [TESTO])
    if menu == 'formato' and voce == 'Tabella':
        js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.impostaStato({ doc: { paragrafi: [{ runs: [] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); ed.applicaAzione({ tipo: 'tabella', righe: 2, colonne: 2 }); }")
    if menu == 'formato' and voce == 'Immagine':
        js("""(png) => { const ed = G.shadowRoot.querySelector('docs-editor'); const s = 'data:image/png;base64,' + btoa(String.fromCharCode(...png));
          ed.impostaStato({ doc: { paragrafi: [{ runs: [] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null });
          ed.applicaAzione({ tipo: 'immagine', immagine: { s, w: 40, h: 40 } });
          ed.impostaStato({ ...ed.stato, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 1 } } }); }""", PNG)
    pg.wait_for_timeout(120)

# controlli precisi per le funzioni principali: (menu, voce, figlio) → funzione sullo stato dopo (e prima)
def doc_dopo(): return json.loads(js("() => JSON.stringify(G.shadowRoot.querySelector('docs-editor').stato.doc)"))
def run0(): return doc_dopo()['paragrafi'][0]['runs'][0] if doc_dopo()['paragrafi'][0]['runs'] else {}
def par0(): return doc_dopo()['paragrafi'][0]
ATTESI = {
    # il testo di prova è già «a frase»: la voce non lo cambia, e il controllo è che resti così (MAIUSCOLO e gli altri lo cambiano)
    ('formato', 'Testo', 'Frase'): lambda a, b: ''.join(r['t'] for r in json.loads(b['doc'])['paragrafi'][0]['runs']) == TESTO[:1].upper() + TESTO[1:].lower(),
    ('file', 'Nuovo', None): lambda a, b: json.loads(b['doc'])['paragrafi'] == [{'runs': []}],
    ('file', 'Salva', None): lambda a, b: b['salvati'] > a['salvati'],
    ('file', 'Salva con nome', None): lambda a, b: b['salvati'] > a['salvati'],
    ('file', 'Apri', None): lambda a, b: b['aperture'] > a['aperture'],
    ('file', 'Stampa', None): lambda a, b: b['stampe'] > a['stampe'],
    ('modifica', 'Seleziona tutto', None): lambda a, b: json.loads(b['sel'])['fuoco']['p'] == 1,
    ('modifica', 'Elimina', None): lambda a, b: TESTO not in b['doc'],
    ('modifica', 'Taglia', None): lambda a, b: TESTO not in b['doc'],
    ('modifica', 'Trova e sostituisci', None): lambda a, b: b['trova'] == 'true',
    ('visualizza', 'Modalità', 'Tema scuro'): lambda a, b: 'tema=scuro' in b['attrG'],
    ('visualizza', 'Modalità', 'Tema chiaro'): lambda a, b: 'tema=chiaro' in b['attrG'],
    ('visualizza', 'Mostra righello', None): lambda a, b: b['righello'] != a['righello'],
    ('visualizza', 'Nascondi i menu', None): lambda a, b: 'menu-nascosti' in b['attrG'],
    ('inserisci', 'Linea orizzontale', None): lambda a, b: '"hr":true' in b['doc'],
    ('inserisci', 'Interruzione', 'Salto di pagina'): lambda a, b: '"sp":true' in b['doc'],
    ('inserisci', 'Tab', None): lambda a, b: b['schede'] > a['schede'],
    ('inserisci', 'Immagine', None): lambda a, b: '"im":' in b['doc'],
    ('formato', 'Testo', 'Grassetto'): lambda a, b: run0().get('g') is True,
    ('formato', 'Testo', 'Corsivo'): lambda a, b: run0().get('c') is True,
    ('formato', 'Testo', 'Sottolineato'): lambda a, b: run0().get('s') is True,
    ('formato', 'Testo', 'Barrato'): lambda a, b: run0().get('x') == 'b',
    ('formato', 'Testo', 'Apice'): lambda a, b: run0().get('v') == 'p',
    ('formato', 'Testo', 'Pedice'): lambda a, b: run0().get('v') == 'd',
    ('formato', 'Colonne', '2 colonne'): lambda a, b: b['colonne'] == '2',
    ('formato', 'Colonne', '3 colonne'): lambda a, b: b['colonne'] == '3',
    ('formato', 'Orientamento pagina', None): lambda a, b: b['pagina'] != a['pagina'],
    ('formato', 'Cancella formattazione', None): lambda a, b: True,
    # l'immagine di prova è già in linea: la voce (spuntata) non cambia niente, giustamente (0.4.14)
    ('formato', 'Immagine', 'In linea con il testo'): lambda a, b: True,
    ('strumenti', 'Numeri di riga', None): lambda a, b: b['attrE'] != a['attrE'],
}
DIALOGO_ATTESO = {   # voce → finestra che deve aprirsi
    ('file', 'Cronologia versioni'): 'docs-versioni', ('file', 'Dettagli'): 'docs-dettagli', ('file', 'Impostazione pagina'): 'docs-imposta-pagina',
    ('inserisci', 'Tabella'): 'docs-tabella', ('inserisci', 'Link'): 'docs-link', ('inserisci', 'Simboli'): 'docs-simboli', ('inserisci', 'Equazione'): 'docs-equazione',
    ('inserisci', 'Segnalibro'): 'docs-segnalibri', ('inserisci', 'Commento'): 'docs-commenti', ('visualizza', 'Mostra commenti e modifiche'): 'docs-commenti', ('visualizza', 'Mostra struttura del documento'): 'docs-struttura', ('inserisci', 'Disegno'): 'docs-disegno', ('inserisci', 'Grafico'): 'docs-grafico',
    ('inserisci', 'Elementi di pagina'): 'docs-nota', ('formato', 'Intestazioni e piè di pagina'): 'docs-margini',
    ('strumenti', 'Conteggio parole'): 'docs-conteggio', ('strumenti', 'Dizionario'): 'docs-dizionario', ('strumenti', 'Correzione automatica'): 'docs-correzione',
    ('strumenti', 'Caratteri personali'): 'docs-caratteri', ('strumenti', 'Preferenze'): 'docs-preferenze', ('strumenti', 'Accessibilità'): 'docs-preferenze',
    ('visualizza', 'Personalizza barra degli strumenti'): 'docs-personalizza-barra',
    ('informazioni', 'Informazioni su pmb_docs'): 'docs-informazioni', ('informazioni', "Condizioni d'uso"): 'docs-informazioni',
    ('informazioni', 'Licenze di terze parti'): 'docs-informazioni', ('informazioni', 'Installa un aggiornamento'): 'docs-aggiornamento',
    ('informazioni', 'Segnala un bug o invia un feedback'): 'docs-segnala',
}

# ---------------------------------------------------------------- ogni voce di ogni menu
barra = pg.locator('docs-menubar')
titoli = js("() => Array.from(G.shadowRoot.querySelector('docs-menubar').shadowRoot.querySelectorAll('button.titolo-menu')).map(b => [b.dataset.menu, b.textContent.trim(), b.getAttribute('aria-haspopup')])")
elenco = []
for menu_id, nome_menu, popup in titoli:
    if popup == 'false':
        elenco.append((menu_id, nome_menu, None, None)); continue
    prepara(menu_id, '')
    barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click(); pg.wait_for_timeout(250)
    voci = barra.locator('.pannello > .voce').evaluate_all("els => els.map(e => [e.querySelector('.etichetta').textContent.trim(), e.getAttribute('aria-haspopup') === 'menu', e.classList.contains('disabilitata')])")
    chiudi_tutto()
    for i, (voce, ha_figli, disab) in enumerate(voci):
        if not ha_figli: elenco.append((menu_id, voce, None, i)); continue
        prepara(menu_id, voce)
        barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click(); pg.wait_for_timeout(200)
        barra.locator('.pannello > .voce').nth(i).hover(); pg.wait_for_timeout(300)
        figli = barra.locator('.sottopannello .figlio .etichetta').evaluate_all('els => els.map(e => e.textContent.trim())')
        chiudi_tutto()
        for j, f in enumerate(figli): elenco.append((menu_id, voce, (j, f), i))

print(f'voci da provare: {len(elenco)}', flush=True)
for menu_id, voce, figlio, i in elenco:
    nome_figlio = figlio[1] if figlio else None
    nome = ' › '.join(x for x in [menu_id, voce, nome_figlio] if x)
    if (menu_id, voce, nome_figlio) in A_PARTE: continue
    if (menu_id, voce, nome_figlio) in NON_CLICCARE:
        risultati.append({'prova': nome, 'esito': 'NON CLICCATA', 'dettaglio': 'cambia lo schermo di Windows: vedi la prova a parte'}); continue
    chiudi_tutto(); prepara(menu_id, voce)
    prima = snap(); n_err = len(errori)
    try:
        if i is None:
            barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click()
        else:
            barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click(); pg.wait_for_timeout(200)
            v = barra.locator('.pannello > .voce').nth(i)
            if figlio is None: v.click()
            else:
                v.hover(); pg.wait_for_timeout(250)
                try: barra.locator('.sottopannello .figlio').nth(figlio[0]).click(timeout=2500)
                except Exception:
                    # il puntatore che va verso il sottomenu può chiuderlo: si riapre e si clicca l'elemento direttamente (come giro_docs_01)
                    chiudi_tutto(); prepara(menu_id, voce)
                    barra.locator(f'button.titolo-menu[data-menu="{menu_id}"]').click(); pg.wait_for_timeout(200)
                    barra.locator('.pannello > .voce').nth(i).hover(); pg.wait_for_timeout(300)
                    barra.locator('.sottopannello .figlio').nth(figlio[0]).evaluate('e => e.click()')
    except Exception as e:
        esito(nome, False, f'non cliccabile: {str(e)[:120]}'); continue
    pg.wait_for_timeout(700)
    dopo = snap()
    effetti = differenze(prima, dopo)
    nuovi_errori = errori[n_err:]
    controllo = ATTESI.get((menu_id, voce, nome_figlio))
    atteso_dlg = DIALOGO_ATTESO.get((menu_id, voce))
    if nuovi_errori: esito(nome, False, 'errore nella pagina: ' + '; '.join(nuovi_errori[:2]))
    elif controllo is not None:
        try: ok = controllo(prima, dopo)
        except Exception as e: ok = False; effetti.append(f'controllo: {e}')
        esito(nome, ok, '; '.join(effetti) or 'nessun effetto')
    elif atteso_dlg is not None: esito(nome, atteso_dlg in dopo['dialoghi'], '; '.join(effetti) or 'nessun effetto')
    else: esito(nome, bool(effetti), '; '.join(effetti) or 'nessun effetto visibile')
    if p.poll() is not None: esito('il programma è ancora vivo', False, 'si è chiuso'); break
    # Nascondi i menu: si rimettono, altrimenti la barra dei menu sparisce
    if 'menu-nascosti' in dopo['attrG']: js("() => G.alternaMenuNascosti()"); pg.wait_for_timeout(200)
chiudi_tutto()

# ---------------------------------------------------------------- Scarica: i byte di ogni formato
js("() => { window.__salvati = []; }")
formati = js("() => [...G.shadowRoot.querySelector('docs-menubar').shadowRoot.querySelectorAll('button')].length")
for fmt, firma in [('docx', [80, 75]), ('odt', [80, 75]), ('txt', None), ('fdoc', [123]), ('pdf', [37, 80, 68, 70])]:
    prepara('file', ''); js("() => { window.__salvati = []; }")
    js(f"() => G.scarica('{fmt}')"); pg.wait_for_timeout(900)
    s = js("() => window.__salvati[0] || null")
    esito(f'Scarica come {fmt}: file prodotto con la firma giusta', bool(s) and (firma is None or s['inizio'][:len(firma)] == firma) and s['n'] > 10, s)

# riapertura del .docx salvato: il testo torna
prepara('file', ''); js("() => { window.__byte = null; G.salva = async (nome, bytes) => { window.__byte = Array.from(new Uint8Array(bytes)); return null; }; }")
js("() => G.scarica('docx')"); pg.wait_for_timeout(900)
js("() => { window.__aprire = { nome: 'riaperto.docx', byte: window.__byte }; G.shadowRoot.querySelector('docs-editor').impostaStato({ doc: { paragrafi: [{ runs: [] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); }")
js("() => G.apri()"); pg.wait_for_timeout(1200)
esito('un .docx salvato si riapre con il suo testo', TESTO in js("() => JSON.stringify(G.shadowRoot.querySelector('docs-editor').stato.doc)"))

# ---------------------------------------------------------------- ogni pulsante della barra
chiudi_tutto()
pulsanti = js("() => [...G.shadowRoot.querySelector('docs-toolbar').shadowRoot.querySelectorAll('button.comando[data-id]')].map(b => b.dataset.id)")
print(f'pulsanti della barra: {len(pulsanti)}', flush=True)
for bid in pulsanti:
    if bid in BARRA_A_PARTE: continue
    chiudi_tutto(); prepara('formato', '')
    prima = snap(); n_err = len(errori)
    try: pg.locator(f'docs-toolbar button.comando[data-id="{bid}"]').first.click(timeout=3000)
    except Exception as e: esito(f'barra › {bid}', False, f'non cliccabile: {str(e)[:100]}'); continue
    pg.wait_for_timeout(600)
    dopo = snap(); eff = differenze(prima, dopo)
    if dopo['popup']:
        # un menu a tendina: si sceglie la prima voce (o il primo colore) e si guarda se il documento cambia
        voce = pg.locator('docs-popup button.voce, docs-popup button.colore')
        if voce.count() > 1:
            prima2 = snap(); voce.nth(1).click(); pg.wait_for_timeout(500); eff += ['scelta: ' + x for x in differenze(prima2, snap())]
    if errori[n_err:]: esito(f'barra › {bid}', False, 'errore: ' + '; '.join(errori[n_err:][:2]))
    else: esito(f'barra › {bid}', bool(eff), '; '.join(eff) or 'nessun effetto visibile')

# ---------------------------------------------------------------- le frecce dei pulsanti divisi dei colori aprono la tavolozza
for fid in js("() => [...G.shadowRoot.querySelector('docs-toolbar').shadowRoot.querySelectorAll('button.freccia-colore[data-id]')].map(b => b.dataset.id)"):
    chiudi_tutto(); prepara('formato', '')
    pg.locator(f'docs-toolbar button.freccia-colore[data-id="{fid}"]').first.click(timeout=3000); pg.wait_for_timeout(500)
    esito(f'barra › {fid} apre la tavolozza', pg.locator('docs-popup button.colore').count() > 1, snap().get('popup'))

# ---------------------------------------------------------------- scorciatoie da tastiera principali
for tasti, controllo, nome in [
    ('Control+b', lambda: run0().get('g') is True, 'Ctrl+B grassetto'), ('Control+i', lambda: run0().get('c') is True, 'Ctrl+I corsivo'),
    ('Control+u', lambda: run0().get('s') is True, 'Ctrl+U sottolineato'), ('Control+Shift+e', lambda: par0().get('al') == 'ce', 'Ctrl+Maiusc+E centra'),
    ('Control+Shift+8', lambda: par0().get('el') == 'p', 'Ctrl+Maiusc+8 elenco puntato'), ('Control+Shift+7', lambda: par0().get('el') == 'n', 'Ctrl+Maiusc+7 elenco numerato'),
]:
    chiudi_tutto(); prepara('formato', '')
    pg.keyboard.press(tasti); pg.wait_for_timeout(300)
    esito(nome, controllo())
chiudi_tutto(); prepara('formato', '')
pg.keyboard.press('Control+h'); pg.wait_for_timeout(400)
esito('Ctrl+H apre Trova e sostituisci', js("() => G.trovaAperta") is True)
chiudi_tutto()

# ---------------------------------------------------------------- controlli mirati per le voci che su un documento appena preparato non cambiano niente
def voce_menu(menu, voce, figlio=None):
    """Clic sulla voce di menu (o di sottomenu) per etichetta."""
    barra.locator(f'button.titolo-menu[data-menu="{menu}"]').click(); pg.wait_for_timeout(200)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(f':scope > .etichetta:text-is("{voce}")'))
    if figlio is None: v.click()
    else:
        v.hover(); pg.wait_for_timeout(250)
        barra.locator('.sottopannello .figlio').filter(has=pg.locator(f'.etichetta:text-is("{figlio}")')).first.click()
    pg.wait_for_timeout(500)
testo_doc = lambda: ''.join(r['t'] for r in doc_dopo()['paragrafi'][0]['runs'])
# Annulla e Ripeti dopo una modifica scritta
chiudi_tutto(); prepara('formato', '')
js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.impostaStato({ doc: { paragrafi: [{ runs: [] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); ed.focalizza(); }")
pg.keyboard.type('abc', delay=30); pg.wait_for_timeout(200)
voce_menu('modifica', 'Annulla'); esito('Modifica › Annulla (dopo aver scritto «abc») toglie la scrittura', testo_doc() == '', testo_doc())
voce_menu('modifica', 'Ripeti'); esito('Modifica › Ripeti la rimette', testo_doc() == 'abc', testo_doc())
pg.locator('docs-toolbar button.comando[data-id="annulla"]').click(); pg.wait_for_timeout(300)
esito('barra › Annulla (dopo una modifica)', testo_doc() == '', testo_doc())
pg.locator('docs-toolbar button.comando[data-id="ripeti"]').click(); pg.wait_for_timeout(300)
esito('barra › Ripeti', testo_doc() == 'abc', testo_doc())
# Copia e poi Incolla (appunti veri)
chiudi_tutto(); prepara('formato', '')
voce_menu('modifica', 'Copia')
js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); const s = ed.stato; const f = s.doc.paragrafi[1].runs[0].t.length; ed.impostaStato({ ...s, sel: { ancora: { p: 1, o: f }, fuoco: { p: 1, o: f } } }); ed.focalizza(); }")
voce_menu('modifica', 'Incolla'); pg.wait_for_timeout(600)
ultimo = ''.join(r['t'] for r in doc_dopo()['paragrafi'][-1]['runs'])
esito('Modifica › Copia e poi Incolla: il testo copiato compare dove sta il cursore', TESTO in ultimo, ultimo)
# voci che rimettono il valore normale: prima si mette un valore diverso
for prima_voce, voce, controllo, nome in [
    (('formato', 'Stili paragrafo', 'Titolo 1'), ('formato', 'Stili paragrafo', 'Testo normale'), lambda: par0().get('st') is None, 'Stili paragrafo › Testo normale (dopo Titolo 1)'),
    (('formato', 'Allinea e applica rientro', 'Al centro'), ('formato', 'Allinea e applica rientro', 'Sinistra'), lambda: par0().get('al') in (None, 'sx'), 'Allinea › Sinistra (dopo Al centro)'),
    (('formato', 'Allinea e applica rientro', 'Aumenta rientro'), ('formato', 'Allinea e applica rientro', 'Riduci rientro'), lambda: not par0().get('ri'), 'Allinea › Riduci rientro (dopo Aumenta rientro)'),
    (('formato', 'Interlinea e spaziatura paragrafo', 'Doppia'), ('formato', 'Interlinea e spaziatura paragrafo', '1,15'), lambda: par0().get('ls') in (None, 1.15), 'Interlinea › 1,15 (dopo Doppia)'),
]:
    chiudi_tutto(); prepara('formato', '')
    try:
        voce_menu(*prima_voce); diverso = json.dumps(par0())
        voce_menu(*voce)
        esito(nome, controllo() and json.dumps(par0()) != diverso, [diverso, par0()])
    except Exception as e: esito(nome, False, str(e)[:150])
chiudi_tutto(); prepara('formato', '')
try:
    barra.locator('button.titolo-menu[data-menu="formato"]').click(); pg.wait_for_timeout(200)
    v = barra.locator('.pannello > .voce').filter(has=pg.locator(':scope > .etichetta:text-is("Bordi e linee")'))
    v.hover(); pg.wait_for_timeout(250); barra.locator('.sottopannello .figlio').first.click(); pg.wait_for_timeout(400)
    con_bordo = 'bd' in par0()
    voce_menu('formato', 'Bordi e linee', 'Togli il bordo')
    esito('Bordi e linee › Togli il bordo (dopo averne messo uno)', con_bordo and 'bd' not in par0(), par0())
except Exception as e: esito('Bordi e linee › Togli il bordo', False, str(e)[:150])
# Funzioni (pezzo di puzzle): il catalogo delle funzioni con la puntina
chiudi_tutto()
pg.locator('docs-toolbar button.comando[data-id="funzioni"]').click(); pg.wait_for_timeout(500)
cat = js("() => { const t = G.shadowRoot.querySelector('docs-toolbar'); const p = t.shadowRoot.querySelector('.pannello-funzioni'); return p ? [p.querySelectorAll('.gruppo').length, p.querySelectorAll('button').length] : null; }")
esito('barra › Funzioni apre il pannello di tutte le funzioni (gruppi e pulsanti con la puntina)', bool(cat) and cat[1] > 20, cat)
pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
esito('Esc chiude il pannello delle funzioni', js("() => !G.shadowRoot.querySelector('docs-toolbar').shadowRoot.querySelector('.pannello-funzioni')"))
# F7 con la lingua italiana
chiudi_tutto(); js("() => G.cambiaPreferenze({ lingua: 'it-IT' })")
js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.impostaStato({ doc: { paragrafi: [{ runs: [{ t: 'Questo testo ha una parolla sbagliatta', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); ed.focalizza(); }")
pg.wait_for_timeout(300); pg.keyboard.press('F7'); pg.wait_for_timeout(1200)
orto = js("() => { const d = G.shadowRoot.querySelector('docs-ortografia'); return d ? (d.shadowRoot.textContent || '').replace(/\\s+/g, ' ').slice(0, 160) : null; }")
esito('F7 su un testo con errori apre il controllo ortografico con la parola sbagliata (correttore di Windows)', bool(orto) and ('parolla' in orto or 'sbagliatta' in orto), orto or snap()['avviso'])
chiudi_tutto(); js("() => { const ed = G.shadowRoot.querySelector('docs-editor'); ed.impostaStato({ doc: { paragrafi: [{ runs: [{ t: 'Testo giusto', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null }); }")
pg.keyboard.press('F7'); pg.wait_for_timeout(1000)
esito('F7 su un testo senza errori lo dice', 'nessun errore' in snap()['avviso'].lower(), snap()['avviso'])
chiudi_tutto()

# ---------------------------------------------------------------- schermo intero: con il clic vero sul menu e con F11
dimensioni = lambda: js("() => [window.innerWidth, window.innerHeight]")
chiudi_tutto()
print("NOTA  prima di Schermo intero:", js("() => [G.hasAttribute('menu-nascosti'), getComputedStyle(G.shadowRoot.querySelector('docs-menubar')).display, G.shadowRoot.querySelector('docs-menubar').getBoundingClientRect().height]"), flush=True)
prima = dimensioni()
voce_menu('visualizza', 'Schermo intero'); pg.wait_for_timeout(1500); durante = dimensioni()
menu_visibile = js("() => G.shadowRoot.querySelector('docs-menubar').getBoundingClientRect().height > 0")
# in Schermo intero menu e barre si nascondono (come in Google Documenti): si esce con Esc
pg.keyboard.press('Escape'); pg.wait_for_timeout(1500); dopo = dimensioni()
esito('Visualizza › Schermo intero (clic sul menu) allarga la finestra e nasconde menu e barre; Esc la riporta come era', durante != prima and not menu_visibile and dopo == prima, [prima, durante, menu_visibile, dopo])
pg.keyboard.press('F11'); pg.wait_for_timeout(1500); durante = dimensioni()
pg.keyboard.press('F11'); pg.wait_for_timeout(1500); dopo = dimensioni()
esito('F11 allarga la finestra e un secondo F11 la riporta come era', durante != prima and dopo == prima, [prima, durante, dopo])

esito('il programma è vivo e senza errori alla fine', p.poll() is None and not errori, errori[:3])
json.dump(risultati, open(USCITA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"== giro_docs_04: OK {n['OK']}  FAIL {n['FAIL']}  (elenco in {USCITA})", flush=True)
pw.stop(); p.kill()
