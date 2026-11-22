"""Prova fisica della «password per aprire» nel pmb_sheets installato, con la tastiera vera: File › Apri... di un .xlsx cifrato da Excel e di
un .ods cifrato da LibreOffice (password «Prova-2026!», comune/tests/file-prova/cifratura): si chiede la password, quella sbagliata si
segnala, quella giusta apre le celle; File › Password per aprire... ne imposta una nuova e il file scaricato è cifrato (file composto per
.xlsx, manifesto cifrato per .ods) e si riapre solo con la password nuova; «Togli la password» lo fa tornare in chiaro.
Uso: python giro_52_password.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

PROVA = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'comune', 'tests', 'file-prova', 'cifratura'))
PASSWORD = 'Prova-2026!'

def manifesto(byte):
    import io, zipfile
    try: return zipfile.ZipFile(io.BytesIO(bytes(byte))).read('META-INF/manifest.xml').decode('utf-8')
    except Exception: return ''
D = "APP.shadowRoot.querySelector('free-dialogo-password-file')"

def apri_byte(b, nome, byte):
    b.js("(x) => { window.__aprire = {nome: x[0], bytes: x[1]}; }", [nome, byte])
    b.menu('File', 'Apri...'); b.attendi(2500)

def dialogo(b): return b.js(f"() => {D} ? {{ modo: {D}.modo, errore: {D}.errore }} : null")

with Banco(9652, '52 Password per aprire') as b:
    b.primo_piano()
    for nome, voce in [('cifrato_excel.xlsx', 'Scarica come cartella di lavoro (.xlsx)'), ('cifrato_libreoffice.ods', 'Scarica come OpenDocument (.ods)')]:
        def giro():
            byte = list(open(os.path.join(PROVA, nome), 'rb').read())
            apri_byte(b, nome, byte)
            b.ok(f'[{nome}] si chiede la password', (dialogo(b) or {}).get('modo') == 'apri', dialogo(b))
            b.primo_piano(); b.os_testo('sbagliata'); b.os_tasto('Invio'); b.attendi(1500 if nome.endswith('.xlsx') else 5000)
            b.ok(f'[{nome}] la password sbagliata si segnala', 'non è giusta' in ((dialogo(b) or {}).get('errore') or ''), dialogo(b))
            b.primo_piano(); b.os_tasto('A', 'Ctrl'); b.os_testo(PASSWORD); b.os_tasto('Invio'); b.attendi(3000 if nome.endswith('.xlsx') else 7000)
            b.ok(f'[{nome}] con la password giusta si apre: A1 e A2', dialogo(b) is None and b.cella(1, 1)['raw'] == 'Dato segreto àè' and b.cella(2, 1)['v'] == 42, [dialogo(b), b.cella(1, 1), b.cella(2, 1), b.stato_app()['msg']])

            b.menu('File', 'Password per aprire...'); b.attendi(500)
            b.ok(f'[{nome}] File › Password per aprire... con «Togli la password»', (dialogo(b) or {}).get('modo') == 'imposta' and b.js(f"() => !!{D}.shadowRoot.querySelector('button[data-azione=\"togli\"]')"))
            b.primo_piano(); b.os_testo('nuova-1'); b.os_tasto('Tab'); b.os_testo('nuova-1'); b.os_tasto('Invio'); b.attendi(600)
            b.ok(f'[{nome}] password impostata', dialogo(b) is None and 'impostata' in (b.stato_app()['msg'] or ''), b.stato_app()['msg'])
            prima = len(b.salvati())
            b.menu('File', voce); b.attendi(3000)
            s = b.salvati()
            dati = list(b.js("(i) => window.__salvati[i].bytes", len(s) - 1)) if len(s) == prima + 1 else []
            if nome.endswith('.xlsx'): b.ok('[xlsx] scaricato come file composto cifrato (D0 CF 11 E0)', dati[:4] == [0xd0, 0xcf, 0x11, 0xe0], dati[:4])
            else: b.ok('[ods] scaricato come zip con il manifesto cifrato', dati[:2] == [0x50, 0x4b] and 'encryption-data' in manifesto(dati), dati[:4])
            apri_byte(b, 'riaperto.' + nome.split('.')[-1], dati)
            b.ok(f'[{nome}] il file scaricato chiede la password', (dialogo(b) or {}).get('modo') == 'apri', dialogo(b))
            b.primo_piano(); b.os_testo('nuova-1'); b.os_tasto('Invio'); b.attendi(3000)
            b.ok(f'[{nome}] e si riapre con la password nuova', dialogo(b) is None and b.cella(1, 1)['raw'] == 'Dato segreto àè', [dialogo(b), b.cella(1, 1)])
            b.menu('File', 'Password per aprire...'); b.attendi(500)
            b.pg.locator('free-dialogo-password-file button[data-azione="togli"]').click(); b.attendi(500)
            prima = len(b.salvati())
            b.menu('File', voce); b.attendi(2500)
            s = b.salvati()
            dati = list(b.js("(i) => window.__salvati[i].bytes", len(s) - 1)) if len(s) == prima + 1 else []
            b.ok(f'[{nome}] tolta la password si scarica in chiaro (zip)', dati[:2] == [0x50, 0x4b] and 'encryption-data' not in manifesto(dati), dati[:4])
        prova(b, nome, giro)
    b.ok('nessun errore nella pagina', len(b.errori_pagina()) == 0, b.errori_pagina()[:3])
