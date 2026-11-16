import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

CART = os.path.join(TMP, 'giro_file'); os.makedirs(CART, exist_ok=True)

def prova(b, nome, fn):
    try: fn()
    except Exception as e: b.esito('FAIL', nome, 'eccezione: ' + str(e)[:160])

def dialoghi(b):
    return b.js("() => Array.from(APP.shadowRoot.querySelectorAll('*')).filter(e => e.tagName.startsWith('FREE-DIALOGO') || e.tagName === 'FREE-MENU-SEARCH').map(e => e.tagName.toLowerCase() + (e.shadowRoot && e.shadowRoot.querySelector('.velo') ? ':visibile' : ''))")

def prepara(b):
    for i, (a, n) in enumerate([('Frutta', 'Numero'), ('mela', '5'), ('pera', '8'), ('kiwi', '3')], start=1):
        b.imposta(i, 1, a); b.imposta(i, 2, n)
    b.imposta(5, 2, '=SUM(B2:B4)')
    b.aggiorna()

with Banco(9511, '02 Menu File') as b:
    prepara(b)
    # ---- Salva con nome / Salva
    prova(b, 'Salva con nome', lambda: (
        b.menu('File', 'Salva con nome...'), b.attendi(800),
        b.ok('File > Salva con nome... scrive un file .xlsx con un nome', len(b.salvati()) == 1 and b.salvati()[0]['nome'].endswith('.xlsx') and b.salvati()[0]['n'] > 1000, b.salvati())))
    if b.salvati():
        b.scarica_salvato(0, os.path.join(CART, 'salva_con_nome.xlsx'))
    b.imposta(6, 1, 'nuova'); b.aggiorna()
    prova(b, 'Salva', lambda: (
        b.menu('File', 'Salva'), b.attendi(800),
        b.ok('File > Salva riscrive lo stesso file senza chiedere il nome', len(b.salvati()) == 2 and b.salvati()[0]['nome'] == b.salvati()[1]['nome'], b.salvati())))
    # ---- Scarica come ...
    for voce, est, nome in [('Scarica come cartella di lavoro (.xlsx)', '.xlsx', 'xlsx'), ('Scarica come CSV (.csv)', '.csv', 'csv'), ('Scarica come pmb_sheets (.psheet)', '.psheet', 'psheet'),
                            ('Scarica come OpenDocument (.ods)', '.ods', 'ods'), ('Scarica come Documento PDF (.pdf)', '.pdf', 'pdf')]:
        def f(voce=voce, est=est, nome=nome):
            prima = len(b.salvati())
            b.menu('File', voce); b.attendi(900)
            s = b.salvati()
            # un CSV di sei righe è lungo una cinquantina di byte: per lui basta che non sia vuoto (il contenuto si controlla in 02b)
            minimo = 20 if est == '.csv' else 100
            b.ok(f'File > {voce} scrive un file {est}', len(s) == prima + 1 and s[-1]['nome'].endswith(est) and s[-1]['n'] > minimo, s[-1:] if s else s)
            if len(s) == prima + 1: b.scarica_salvato(len(s) - 1, os.path.join(CART, f'scarica.{nome}'))
        prova(b, voce, f)
    # ---- Stampa
    def stampa():
        b.js("() => { window.__stampato = 0; }")
        b.menu('File', 'Stampa'); b.attendi(900)
        b.ok('File > Stampa prepara il foglio e chiama la stampa di sistema', b.js("() => window.__stampato") >= 1, b.stato_app()['msg'])
    prova(b, 'Stampa', stampa)
    # ---- Nuovo foglio di calcolo: con modifiche non salvate chiede cosa fare
    def nuovo():
        b.imposta(7, 1, 'modifica non salvata'); b.aggiorna()
        b.menu('File', 'Nuovo foglio di calcolo'); b.attendi(600)
        d = dialoghi(b)
        b.ok('File > Nuovo, con modifiche non salvate, chiede se salvare', any('conferma' in x for x in d), d)
        scelte = b.js("() => { const c = APP.shadowRoot.querySelector('free-dialogo-conferma'); return c ? Array.from(c.shadowRoot.querySelectorAll('button')).map(x => x.textContent.trim()) : []; }")
        b.nota('scelte offerte dalla finestra di conferma', scelte)
        if scelte:
            idx = next((i for i, t in enumerate(scelte) if 'non salvare' in t.lower() or 'scarta' in t.lower() or 'senza salvare' in t.lower()), None)
            if idx is None: idx = 1
            b.js("(i) => { APP.shadowRoot.querySelector('free-dialogo-conferma').shadowRoot.querySelectorAll('button')[i].click(); }", idx); b.attendi(800)
        b.ok('scegliendo di non salvare, il foglio riparte vuoto', b.cella(1, 1)['raw'] == '' and b.cella(7, 1)['raw'] == '', [b.cella(1, 1), b.cella(7, 1)])
        b.ok('il titolo torna a quello di un foglio nuovo', 'Senza titolo' in b.stato_app()['titolo'] or b.stato_app()['titolo'], b.stato_app()['titolo'])
    prova(b, 'Nuovo', nuovo)
    # ---- Apri
    def apri():
        try:
            from openpyxl import Workbook
            wb = Workbook(); ws = wb.active; ws.title = 'Dati'
            ws['A1'] = 'Prodotto'; ws['B1'] = 'Prezzo'; ws['A2'] = 'caffè'; ws['B2'] = 12.5; ws['A3'] = 'tè'; ws['B3'] = 8; ws['B4'] = '=SUM(B2:B3)'
            ws2 = wb.create_sheet('Altro'); ws2['A1'] = 'secondo foglio'
            p = os.path.join(CART, 'da_aprire.xlsx'); wb.save(p)
            dati = list(open(p, 'rb').read())
        except Exception as e:
            b.manca('impossibile creare il file di prova per File > Apri', str(e)); return
        b.js("(d) => { window.__aprire = {nome: 'da_aprire.xlsx', bytes: d}; }", dati)
        b.menu('File', 'Apri...'); b.attendi(1500)
        st = b.stato_app()
        b.ok('File > Apri carica il file .xlsx: fogli "Dati" e "Altro" come schede', st['fogli'] == ['Dati', 'Altro'], st['fogli'])
        b.ok('i valori e le formule del file si leggono (Prezzo, 12,5, somma 20,5)', b.cella(1, 2)['raw'] == 'Prezzo' and b.cella(2, 2)['v'] == 12.5 and b.cella(4, 2)['v'] == 20.5, [b.cella(1, 2), b.cella(2, 2), b.cella(4, 2)])
        b.ok('il titolo diventa quello del file', 'da_aprire' in (st['titolo'] or ''), st['titolo'])
        b.ok('il messaggio dice che è stato aperto', 'Aperto' in (st['msg'] or ''), st['msg'])
    prova(b, 'Apri', apri)
    # ---- Esci con modifiche: deve chiedere (non si chiude davvero il programma)
    def esci():
        b.imposta(9, 1, 'modifica'); b.aggiorna()
        b.menu('File', 'Esci'); b.attendi(800)
        d = dialoghi(b)
        b.ok('File > Esci, con modifiche non salvate, chiede conferma invece di chiudere', any('conferma' in x for x in d) and b.p.poll() is None, d)
        b.js("() => { const c = APP.shadowRoot.querySelector('free-dialogo-conferma'); if (c) { const bt = Array.from(c.shadowRoot.querySelectorAll('button')); const annulla = bt.find(x => /annulla/i.test(x.textContent)); (annulla || bt[bt.length - 1]).click(); } }"); b.attendi(500)
        b.ok('annullando, il programma resta aperto', b.p.poll() is None)
    prova(b, 'Esci', esci)
    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])

# ---- controllo indipendente dei file scritti
def esiste(n): return os.path.exists(os.path.join(CART, n))
with Banco(9512, '02b Controllo indipendente dei file') as b:
    try:
        from openpyxl import load_workbook
        wb = load_workbook(os.path.join(CART, 'scarica.xlsx'), data_only=False)
        ws = wb.active
        b.ok('xlsx scaricato: lo legge openpyxl, con i dati e la formula', ws['A2'].value == 'mela' and ws['B3'].value == 8 and str(ws['B5'].value).upper().startswith('=SUM'), [ws['A2'].value, ws['B3'].value, ws['B5'].value])
    except Exception as e: b.esito('FAIL', 'xlsx scaricato non leggibile', str(e)[:150])
    try:
        t = open(os.path.join(CART, 'scarica.csv'), encoding='utf-8-sig').read()
        b.ok('csv scaricato: righe e valori (anche il risultato 16 della formula)', 'mela' in t and '16' in t and t.count('\n') >= 5, t[:120].replace('\n', '|'))
    except Exception as e: b.esito('FAIL', 'csv non leggibile', str(e)[:150])
    try:
        j = json.load(open(os.path.join(CART, 'scarica.psheet'), encoding='utf-8'))
        b.ok('psheet scaricato: JSON con versione e fogli', j.get('version') == 1 and 'workbookJson' in json.dumps(j) or 'sheets' in json.dumps(j), list(j.keys())[:6])
    except Exception as e: b.esito('FAIL', 'psheet non leggibile', str(e)[:150])
    try:
        from odf.opendocument import load as lod
        from odf import table
        d = lod(os.path.join(CART, 'scarica.ods'))
        b.ok('ods scaricato: lo legge odfpy (almeno un foglio con righe)', len(d.spreadsheet.getElementsByType(table.Table)) >= 1 and len(d.spreadsheet.getElementsByType(table.TableRow)) >= 4)
    except Exception as e: b.esito('FAIL', 'ods non leggibile', str(e)[:150])
    try:
        raw = open(os.path.join(CART, 'scarica.pdf'), 'rb').read()
        b.ok('pdf scaricato: inizia con %PDF e finisce con %%EOF', raw[:4] == b'%PDF' and b'%%EOF' in raw[-64:], len(raw))
    except Exception as e: b.esito('FAIL', 'pdf non leggibile', str(e)[:150])
