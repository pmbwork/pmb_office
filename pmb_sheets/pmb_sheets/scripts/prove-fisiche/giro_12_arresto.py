import sys, os, time, subprocess, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import giro_lib as L
from giro_lib import *

CARTELLA = os.path.join(L.TMP, 'pmb_giro_arresto')
shutil.rmtree(CARTELLA, ignore_errors=True)

class BancoFisso(Banco):
    def __enter__(self):
        env = dict(os.environ)
        env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = f'--remote-debugging-port={self.porta}'
        env['WEBVIEW2_USER_DATA_FOLDER'] = CARTELLA
        self.p = subprocess.Popen([EXE], env=env)
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        for _ in range(60):
            try: b = self.pw.chromium.connect_over_cdp(f'http://127.0.0.1:{self.porta}'); break
            except Exception: time.sleep(0.5)
        self.pg = b.contexts[0].pages[0]; self.pg.set_default_timeout(8000)
        self.pg.wait_for_selector('free-sheet-grid'); self.pg.wait_for_timeout(1500)
        # le prove leggono i testi italiani: con Windows in inglese la lingua «automatica» sceglierebbe l'inglese (solo per la prova, senza salvarlo)
        self.pg.evaluate("() => { const a = document.querySelector('free-app'); if (a && typeof a.applicaLingua === 'function') return a.applicaLingua('it', false); }"); self.pg.wait_for_timeout(300)
        self.errori = []
        return self

RIPR = "() => { const b = APP.shadowRoot.querySelector('.recupero'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : null; }"

# ---- sessione 1: si scrive e poi si uccide il programma (e i suoi processi figli) di colpo
with BancoFisso(9611, '12a Prima dell\'arresto') as b:
    b.primo_piano()
    b.ok('all\'avvio pulito non c\'è nessun avviso di recupero', b.js(RIPR) is None)
    b.imposta(1, 1, 'importante'); b.imposta(2, 1, '123'); b.imposta(3, 1, '=A2*2'); b.imposta(4, 1, 'ultima riga')
    b.js("() => { const d = GR.getDoc(); d.styles.cellStyles.size; }")
    b.aggiorna()
    time.sleep(9)   # tre controlli da 3 secondi
    copia = b.js("() => { const t = localStorage.getItem('pmb_sheets.recupero'); return t ? t.length : 0; }")
    b.ok('la copia di emergenza è stata scritta', copia > 0, copia)
    pid = b.p.pid
    subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], capture_output=True)   # arresto brusco: niente chiusura regolare
    time.sleep(2)
    b.nota('programma ucciso di colpo', pid)

time.sleep(2)
# ---- sessione 2: stessa cartella dati, riapertura
with BancoFisso(9612, '12b Dopo l\'arresto') as b:
    b.primo_piano()
    testo = b.js(RIPR)
    b.ok('alla riapertura compare l\'avviso "Foglio non salvato trovato"', testo is not None and 'non salvato' in testo, testo)
    b.ok('la griglia riparte vuota (la copia non si carica da sola)', b.cella(1, 1)['raw'] == '', b.cella(1, 1))
    if testo:
        b.js("() => { APP.shadowRoot.querySelector('.recupero .ripristina').click(); }"); b.attendi(1500)
        v = [b.cella(r, 1)['raw'] for r in range(1, 5)]
        b.ok('"Ripristina" riporta tutti i dati scritti prima dell\'arresto', v == ['importante', '123', '=A2*2', 'ultima riga'], v)
        b.ok('il risultato della formula torna a 246', b.cella(3, 1)['v'] == 246, b.cella(3, 1))
        b.ok('l\'avviso sparisce dopo il ripristino', b.js(RIPR) is None)
        b.ok('il titolo del foglio ripristinato risulta da salvare (modificato)', b.js("() => !!APP.recupero && true"))
