"""Prova fisica della protezione (0.2.12) nel pmb_sheets installato, con il mouse e la tastiera veri:
B2 sbloccata da Formato › Protezione celle; Strumenti › Proteggi foglio... con la password scritta due volte; scrivere in A1 (bloccata)
non comincia e avvisa, in B2 si scrive; Canc su A1 non cancella; Grassetto (Ctrl+B) si annulla da solo e avvisa; la formula nascosta
non si vede nella barra; la struttura protetta impedisce di aggiungere un foglio; togliere la protezione con la password sbagliata
non va, con quella giusta sì; i file .xlsx e .ods scritti hanno la protezione come Excel e LibreOffice. Uso: python giro_49_protezione.py"""
import sys, os, io, re, zipfile, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def dialogo(b):
    return b.js("() => !!APP.shadowRoot.querySelector('free-dialogo-protezione')")
def password(b, pw, ripeti=True):
    """Scrive la password nella finestra (con la tastiera vera) e conferma con Invio."""
    b.js("() => APP.shadowRoot.querySelector('free-dialogo-protezione').shadowRoot.querySelector('input[data-campo=\"password\"]').focus()")
    b.primo_piano(); b.os_testo(pw)
    if ripeti:
        b.os_tasto('Tab'); b.os_testo(pw)
    b.os_tasto('Invio'); b.attendi(1500)

with Banco(9649, '49 Protezione') as b:
    b.primo_piano()

    def foglio():
        b.imposta(1, 1, 'bloccata'); b.imposta(3, 1, '=1+2'); b.aggiorna()
        b.clic_cella_os(2, 2); b.menu('Formato', 'Protezione celle', 'Sblocca le celle (si scrivono con il foglio protetto)'); b.attendi(300)
        b.clic_cella_os(3, 1); b.menu('Formato', 'Protezione celle', 'Nascondi la formula'); b.attendi(300)
        b.menu('Strumenti', 'Proteggi foglio...'); b.attendi(500)
        b.ok('Strumenti › Proteggi foglio... apre la finestra', dialogo(b))
        password(b, 'Prova123')
        b.ok('il foglio è protetto (con la password)', b.js("() => GR.statoProtezione()") .get('foglioConPassword') is True, b.js("() => GR.statoProtezione()"))
        b.clic_cella_os(1, 1); b.primo_piano(); b.os_testo('x'); b.attendi(400)
        b.ok('in A1 (bloccata) scrivere non comincia: niente modifica e un avviso', b.cella(1, 1)['raw'] == 'bloccata' and 'protetta' in (b.stato_app()['msg'] or ''), [b.cella(1, 1), b.stato_app()['msg']])
        b.os_tasto('Esc')
        b.os_tasto('Canc'); b.attendi(400)
        b.ok('Canc su A1 non cancella', b.cella(1, 1)['raw'] == 'bloccata', b.cella(1, 1))
        b.scrivi_os(2, 2, 'scritto'); b.aggiorna()
        b.ok('in B2 (sbloccata) si scrive', b.cella(2, 2)['raw'] == 'scritto', b.cella(2, 2))
        b.clic_cella_os(2, 2); b.primo_piano(); b.os_tasto('B', 'Ctrl'); b.attendi(800)
        grassetto = b.js("() => !!GR.getDoc().styles.registry.getStyle(GR.getDoc().styles.cellStyles.get('2,2') ?? 0).bold")
        b.ok('Ctrl+B anche su una cella sbloccata si annulla da solo (il formato è protetto) e avvisa', not grassetto and 'protetto' in (b.stato_app()['msg'] or ''), [grassetto, b.stato_app()['msg']])
        b.clic_cella_os(3, 1); b.attendi(400)
        barra = b.js("() => GR.renderRoot.querySelector('.formula-input').value")
        b.ok('la formula nascosta di A3 non si vede nella barra', barra == '', barra)
        b.ok('ma il risultato sì', b.cella(3, 1)['v'] == 3, b.cella(3, 1))
    prova(b, 'Foglio protetto', foglio)

    def cartella():
        b.menu('Strumenti', 'Proteggi la struttura della cartella...'); b.attendi(500)
        password(b, 'Libro1')
        prima = len(b.stato_app()['fogli'] or [])
        b.js("() => GR.handleAddSheet()"); b.attendi(700)
        b.ok('con la struttura protetta non si aggiunge un foglio', len(b.stato_app()['fogli'] or []) == prima and 'struttura' in (b.stato_app()['msg'] or ''), b.stato_app())
    prova(b, 'Struttura della cartella', cartella)

    def file_salvati():
        for voce, est in [('Scarica come cartella di lavoro (.xlsx)', 'xlsx'), ('Scarica come OpenDocument (.ods)', 'ods')]:
            prima = len(b.salvati())
            b.menu('File', voce); b.attendi(1500)
            s = b.salvati()
            if len(s) != prima + 1: b.esito('FAIL', f'[{est}] nessun file scritto', s); continue
            dati = bytes(b.js("(i) => window.__salvati[i].bytes", len(s) - 1))
            z = zipfile.ZipFile(io.BytesIO(dati))
            if est == 'xlsx':
                f = z.read('xl/worksheets/sheet1.xml').decode('utf-8'); w = z.read('xl/workbook.xml').decode('utf-8'); st = z.read('xl/styles.xml').decode('utf-8')
                b.ok('[xlsx] sheetProtection SHA-512 e workbookProtection lockStructure come Excel', 'sheetProtection algorithmName="SHA-512"' in f and 'lockStructure="1"' in w and 'workbookAlgorithmName="SHA-512"' in w)
                b.ok('[xlsx] B2 con locked="0", A3 con hidden="1"', '<protection locked="0"/>' in st and '<protection hidden="1"/>' in st)
            else:
                c = z.read('content.xml').decode('utf-8')
                b.ok('[ods] table:protected con la chiave SHA-256 e struttura protetta come LibreOffice', 'table:protected="true"' in c and 'xmldsig#sha256' in c and 'table:structure-protected="true"' in c)
            p = os.path.join(tempfile.gettempdir(), f'giro49.{est}'); open(p, 'wb').write(dati); b.nota(f'[{est}] file salvato per controllo', p)
    prova(b, 'File', file_salvati)

    def togli():
        b.menu('Strumenti', 'Proteggi foglio...'); b.attendi(500)
        password(b, 'sbagliata', ripeti=False)
        errore = b.js("() => APP.shadowRoot.querySelector('free-dialogo-protezione')?.errore ?? null")
        b.ok('password sbagliata: la finestra resta e lo dice', errore == 'La password non è giusta', errore)
        b.js("() => { const i = APP.shadowRoot.querySelector('free-dialogo-protezione').shadowRoot.querySelector('input[data-campo=\"password\"]'); i.value = ''; }")
        password(b, 'Prova123', ripeti=False)
        b.ok('con la password giusta il foglio non è più protetto', b.js("() => GR.statoProtezione().foglio") is False and not dialogo(b))
        b.scrivi_os(1, 1, 'libera'); b.aggiorna()
        b.ok('ora A1 si scrive', b.cella(1, 1)['raw'] == 'libera', b.cella(1, 1))
    prova(b, 'Togliere la protezione', togli)

    b.ok('nessun errore nella pagina', len(b.errori_pagina()) == 0, b.errori_pagina()[:3])
