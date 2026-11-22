"""55 Controlli modulo, pulsanti con macro sicure e link a file locali (0.2.16), nel programma installato.
Il file tests/file-prova/controlli/controlli_macro.xlsm si copia in una cartella temporanea accanto a una cartella CLIENTI_PROVA e si apre
all'avvio (come un doppio clic: il programma conosce la cartella del file). Si controlla: la casella combinata diventata tendina con la voce
scelta, i quattro pulsanti visibili, «DATI» che porta al foglio dati, «Pulisci» che non esegue la macro non ammessa e dice perché,
«SOCIETA'» che seleziona N1 e chiede conferma prima di aprire un file che non c'è (errore chiaro), «cartella» che dopo la conferma apre
davvero la cartella in Esplora risorse (la finestra aperta dalla prova si chiude da sola)."""
import sys, os, shutil, time, ctypes
from ctypes import wintypes
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

QUI = os.path.dirname(os.path.abspath(__file__))
ORIGINE = os.path.normpath(os.path.join(QUI, '..', '..', 'tests', 'file-prova', 'controlli', 'controlli_macro.xlsm'))
CARTELLA = os.path.join(TMP, f'pmb_giro55_{int(time.time())}')
os.makedirs(os.path.join(CARTELLA, 'CLIENTI_PROVA'))
FILE = os.path.join(CARTELLA, 'controlli_macro.xlsm')
shutil.copyfile(ORIGINE, FILE)

u32 = ctypes.windll.user32
def finestre_esplora(titolo):
    trovate = []
    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def ogni(h, _):
        cls = ctypes.create_unicode_buffer(64); u32.GetClassNameW(h, cls, 64)
        if cls.value == 'CabinetWClass' and u32.IsWindowVisible(h):
            t = ctypes.create_unicode_buffer(512); u32.GetWindowTextW(h, t, 512)
            if t.value == titolo or t.value.startswith(titolo + ' '): trovate.append(h)
        return True
    u32.EnumWindows(ogni, 0)
    return trovate

with Banco(9655, '55 Controlli modulo, pulsanti con macro sicure e link locali', [FILE]) as b:
    b.primo_piano()
    b.attendi(2500)
    pulsante = lambda testo: b.pg.locator('button.pulsante-modulo', has_text=testo)
    conferma = lambda: b.js("() => { const d = APP.shadowRoot && APP.shadowRoot.querySelector('free-dialogo-conferma'); return d ? (d.shadowRoot || d).textContent.replace(/\\s+/g, ' ').trim() : ''; }")
    def scegli(id_):
        b.js("(id) => { const d = APP.shadowRoot.querySelector('free-dialogo-conferma'); (d.shadowRoot || d).querySelector(`button[data-scelta=\"${id}\"]`).click(); }", id_); b.attendi(1200)

    def apertura():
        msg = b.stato_app()['msg'] or ''
        b.ok('il file si apre con gli avvisi sui controlli', 'casella combinata' in msg and 'pulsanti con macro' in msg, msg[:220])
        b.ok('la casella combinata è la tendina di I10 con la voce scelta «patente»', b.testo(10, 9) == 'patente' and b.js("() => GR.getDoc().dataValidations.has('10:9')"), [b.testo(10, 9)])
        testi = b.js("() => [...GR.renderRoot.querySelectorAll('button.pulsante-modulo')].map((x) => x.textContent.trim().replace(/\\s+/g, ' '))")
        b.ok('i quattro pulsanti si vedono con il loro testo', sorted(testi) == sorted(["SOCIETA'", 'Pulisci tutto', 'DATI', 'cartella']), testi)
        colore = b.js("() => getComputedStyle([...GR.renderRoot.querySelectorAll('button.pulsante-modulo')].find((x) => x.textContent.includes('SOCIETA'))).color.replace(/ /g, '')")
        b.ok("«SOCIETA'» è rosso come nel file", colore == 'rgb(255,0,0)', colore)
    prova(b, 'apertura del file con i controlli', apertura)

    def vai_al_foglio():
        pulsante('DATI').click(); b.attendi(800)
        b.ok('«DATI» porta al foglio dati', b.doc()['foglio'] == 'dati', b.doc()['foglio'])
        b.js("async () => { await GR.switchSheet('riepilogo'); }"); b.attendi(800)
    prova(b, 'pulsante «vai al foglio»', vai_al_foglio)

    def macro_non_ammessa():
        pulsante('Pulisci').click(); b.attendi(600)
        msg = b.stato_app()['msg'] or ''
        b.ok('«Pulisci» non esegue la macro e dice perché (Shell)', 'non si può usare' in msg and 'Shell' in msg and b.doc()['foglio'] == 'riepilogo', msg[:200])
    prova(b, 'macro con istruzioni non ammesse', macro_non_ammessa)

    def link_file_mancante():
        pulsante("SOCIETA'").click(); b.attendi(800)
        b.ok('«SOCIETA\'» seleziona N1', b.doc()['sel'] == [1, 14], b.doc()['sel'])
        testo = conferma()
        b.ok('chiede conferma mostrando il percorso del file', 'Aprire il file?' in testo and 'MODULI' in testo and CARTELLA in testo, testo[:220])
        scegli('apri')
        msg = b.stato_app()['msg'] or ''
        b.ok('il file non c\'è: errore chiaro, niente aperto', 'Non è stato possibile aprire' in msg and 'non esiste' in msg, msg[:200])
    prova(b, 'link a un file che non c\'è', link_file_mancante)

    def annulla():
        pulsante('cartella').click(); b.attendi(800)
        scegli('annulla')
        b.ok('Annulla: nessuna finestra aperta', finestre_esplora('CLIENTI_PROVA') == [], finestre_esplora('CLIENTI_PROVA'))
    prova(b, 'conferma annullata', annulla)

    def apre_cartella():
        pulsante('cartella').click(); b.attendi(800)
        scegli('apri')
        msg = b.stato_app()['msg'] or ''
        trovate = []
        for _ in range(40):
            trovate = finestre_esplora('CLIENTI_PROVA')
            if trovate: break
            time.sleep(0.25)
        b.ok('dopo la conferma la cartella si apre davvero in Esplora risorse', 'Aperto' in msg and len(trovate) >= 1, [msg[:160], len(trovate)])
        for h in trovate: u32.PostMessageW(h, 0x0010, 0, 0)   # WM_CLOSE solo alle finestre aperte dalla prova
        b.primo_piano()
    prova(b, 'link a una cartella', apre_cartella)
    b.ok('nessun errore nella pagina', len(b.errori_pagina()) == 0, b.errori_pagina()[:3])

shutil.rmtree(CARTELLA, ignore_errors=True)
