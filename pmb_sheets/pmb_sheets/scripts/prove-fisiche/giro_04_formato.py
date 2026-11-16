import sys, os, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def dati(b):
    for i, (a, n) in enumerate([('Voce', 'Num'), ('delta', '1234.5'), ('alfa', '0.25'), ('charlie', '-7'), ('bravo', '42')], start=1):
        b.imposta(i, 1, a); b.imposta(i, 2, n)
    b.aggiorna()

def chiudi_dialogo_con(b, azione):
    b.js("(a) => { const d = Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName.startsWith('FREE-DIALOGO')); const bt = d.shadowRoot.querySelector(`[data-azione=${a}]`); bt && bt.click(); }", azione); b.attendi(500)

def imposta_campo(b, campo, valore):
    b.js("([c, v]) => { const d = Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName.startsWith('FREE-DIALOGO')); const el = d.shadowRoot.querySelector(`[data-campo=${c}]`); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); }", [campo, valore]); b.attendi(150)

with Banco(9531, '04 Menu Formato, Dati, Strumenti, Aiuto') as b:
    b.primo_piano()
    dati(b)

    # ---------------- FORMATO ----------------
    def stili():
        b.clic_cella_os(2, 2)
        for voce, prop, cond in [('Grassetto', 'fontWeight', lambda v: v in ('700', 'bold')), ('Corsivo', 'fontStyle', lambda v: v == 'italic'),
                                 ('Sottolineato', 'textDecorationLine', lambda v: 'underline' in v), ('Barrato', 'textDecorationLine', lambda v: 'line-through' in v)]:
            b.menu('Formato', voce); b.attendi(300)
            v = stile_cella(b, 2, 2, prop)
            b.ok(f'Formato > {voce}', cond(v), v)
        b.menu('Formato', 'Cancella formattazione'); b.attendi(300)
        b.ok('Formato > Cancella formattazione toglie grassetto, corsivo, sottolineato e barrato', stile_cella(b, 2, 2, 'fontWeight') in ('400', 'normal') and stile_cella(b, 2, 2, 'fontStyle') == 'normal' and stile_cella(b, 2, 2, 'textDecorationLine') == 'none',
             [stile_cella(b, 2, 2, 'fontWeight'), stile_cella(b, 2, 2, 'fontStyle'), stile_cella(b, 2, 2, 'textDecorationLine')])
    prova(b, 'Stili', stili)

    def allineamento():
        b.clic_cella_os(3, 1)
        for voce, prop, atteso in [('A sinistra', 'textAlign', 'left'), ('Al centro', 'textAlign', 'center'), ('A destra', 'textAlign', 'right'),
                                   ('In alto', 'verticalAlign', 'top'), ('Al centro verticale', 'verticalAlign', 'middle'), ('In basso', 'verticalAlign', 'bottom')]:
            b.menu('Formato', 'Allineamento', voce); b.attendi(300)
            v = stile_cella(b, 3, 1, prop)
            b.ok(f'Formato > Allineamento > {voce}', v == atteso, v)
    prova(b, 'Allineamento', allineamento)

    def numero():
        b.clic_cella_os(2, 2)
        base = datetime.date(1899, 12, 30) + datetime.timedelta(days=1234)
        data = base.strftime('%d/%m/%Y')
        for voce, atteso in [('Automatico', '1234,5'), ('Testo normale', '1234,5'), ('Numero', '1.234,50'), ('Percentuale', '123450,00%'), ('Valuta', '€1.234,50'),
                             ('Scientifico', '1,23E+03'), ('Data', data), ('Ora', '12:00:00'), ('Data e ora', f'{data} 12:00:00')]:
            b.menu('Formato', 'Numero', voce); b.attendi(300)
            t = b.testo(2, 2)
            b.ok(f'Formato > Numero > {voce}: 1234,5 si vede "{atteso}"', t == atteso, t)
        b.menu('Formato', 'Numero', 'Automatico')
    prova(b, 'Numero', numero)

    # ---------------- DATI ----------------
    def ordina():
        b.seleziona_os(2, 1, 5, 2)
        b.menu('Dati', 'Ordina intervallo per colonna A -> Z'); b.attendi(700); b.aggiorna()
        a = [b.cella(r, 1)['raw'] for r in range(2, 6)]
        n = [b.cella(r, 2)['raw'] for r in range(2, 6)]
        b.ok('Dati > Ordina A→Z ordina la colonna A e porta con sé la B', a == ['alfa', 'bravo', 'charlie', 'delta'] and n == ['0.25', '42', '-7', '1234.5'], [a, n])
        b.menu('Dati', 'Ordina intervallo per colonna Z -> A'); b.attendi(700); b.aggiorna()
        a = [b.cella(r, 1)['raw'] for r in range(2, 6)]
        b.ok('Dati > Ordina Z→A', a == ['delta', 'charlie', 'bravo', 'alfa'], a)
    prova(b, 'Ordina', ordina)

    def filtro():
        b.seleziona_os(1, 1, 5, 2)
        b.menu('Dati', 'Crea un filtro'); b.attendi(500)
        n = b.js("() => GR.renderRoot.querySelectorAll('.col-filter-btn').length")
        b.ok('Dati > Crea un filtro mostra la freccia del filtro sulle colonne', n >= 2, n)
        if n:
            b.js("() => GR.renderRoot.querySelectorAll('.col-filter-btn')[0].click()"); b.attendi(400)
            b.nota('clic sul filtro della colonna A (solo "non vuoto"): righe nascoste', b.js("() => [...GR.getDoc().hiddenRows]"))
            # il clic apre la finestrella del filtro, che coprirebbe la barra dei menu: la chiudo prima
            b.js("() => { const p = GR.renderRoot.querySelector('free-filtro-colonna'); const x = p && p.shadowRoot.querySelector('[data-azione=chiudi]'); x && x.click(); }"); b.attendi(300)
        b.menu('Dati', 'Rimuovi filtri'); b.attendi(500)
        b.ok('Dati > Rimuovi filtri toglie le frecce e mostra tutte le righe', b.js("() => GR.renderRoot.querySelectorAll('.col-filter-btn').length") == 0 and b.js("() => GR.getDoc().hiddenRows.size") == 0)
    prova(b, 'Filtro', filtro)

    def convalida():
        b.seleziona_os(2, 4, 4, 4)
        b.menu('Dati', 'Convalida dei dati...'); b.attendi(600)
        b.ok('Dati > Convalida dei dati... apre la finestra', 'free-dialogo-regole' in dialoghi_aperti(b), dialoghi_aperti(b))
        imposta_campo(b, 'tipo', 'elenco'); imposta_campo(b, 'voci', 'rosso, verde, blu')
        chiudi_dialogo_con(b, 'fine')
        b.ok('"Fine" chiude la finestra e applica la regola alle 3 celle selezionate', 'free-dialogo-regole' not in dialoghi_aperti(b) and b.js("() => GR.getDoc().dataValidations.size") == 3, b.js("() => GR.getDoc().dataValidations.size"))
        b.clic_cella_os(3, 4); b.attendi(300)
        freccia = b.js("() => { const f = GR.renderRoot.querySelector('td[data-row=\"3\"][data-col=\"4\"] .freccia-elenco'); if (!f) return null; const r = f.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; }")
        b.ok('la cella con elenco mostra la freccia', freccia is not None)
        if freccia:
            b.clic_os(freccia['x'], freccia['y']); b.attendi(300)
            voci = b.js("() => Array.from(GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).map(x => x.textContent.trim())")
            b.ok('la freccia apre la tendina con rosso, verde, blu', voci == ['rosso', 'verde', 'blu'], voci)
            if voci:
                r = b.js("() => { const x = GR.renderRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')[1].getBoundingClientRect(); return {x: x.left + 20, y: x.top + x.height/2}; }")
                b.clic_os(r['x'], r['y']); b.attendi(400)
                b.ok('scegliere "verde" lo scrive nella cella', b.cella(3, 4)['raw'] == 'verde', b.cella(3, 4))
        # un valore fuori elenco viene rifiutato
        b.scrivi_os(4, 4, 'viola')
        b.ok('scrivere "viola" (fuori elenco) viene rifiutato', b.cella(4, 4)['raw'] == '', [b.cella(4, 4), b.stato_app()['msg']])
        b.seleziona_os(2, 4, 4, 4); b.menu('Dati', 'Rimuovi convalida dei dati'); b.attendi(400)
        b.ok('Dati > Rimuovi convalida dei dati', b.js("() => GR.getDoc().dataValidations.size") == 0)
    prova(b, 'Convalida', convalida)

    def casella():
        b.seleziona_os(2, 6, 3, 6)
        b.menu('Dati', 'Inserisci casella di controllo'); b.attendi(500)
        n = b.js("() => GR.renderRoot.querySelectorAll('.sheet-checkbox').length")
        b.ok('Dati > Inserisci casella di controllo mostra le caselle', n >= 2, n)
        if n:
            c = b.js("() => { const x = GR.renderRoot.querySelector('td[data-row=\"2\"][data-col=\"6\"] .sheet-checkbox').getBoundingClientRect(); return {x: x.left + x.width/2, y: x.top + x.height/2}; }")
            b.clic_os(c['x'], c['y']); b.attendi(400)
            b.ok('un clic sulla casella la spunta (valore VERO)', str(b.cella(2, 6)['raw']).upper() in ('TRUE', 'VERO'), b.cella(2, 6))
    prova(b, 'Casella', casella)

    def nomi():
        b.seleziona_os(2, 2, 5, 2)
        b.menu('Dati', 'Intervalli denominati...'); b.attendi(600)
        b.ok('Dati > Intervalli denominati... apre la finestra', 'free-dialogo-nomi' in dialoghi_aperti(b), dialoghi_aperti(b))
        imposta_campo(b, 'nome', 'Prezzi')
        chiudi_dialogo_con(b, 'aggiungi')
        elenco = b.js("() => GR.getDoc().namedRanges.getAll().map(n => n.name + '=' + n.rangeString)")
        b.ok('"Aggiungi" crea il nome Prezzi sull\'intervallo selezionato', elenco and elenco[0].startswith('Prezzi='), elenco)
        chiudi_dialogo_con(b, 'chiudi')
        b.imposta(8, 2, '=SUM(Prezzi)'); b.aggiorna()
        b.ok('un nome definito si usa nelle formule', b.cella(8, 2)['k'] == 'number', b.cella(8, 2))
    prova(b, 'Nomi', nomi)

    def condizionale():
        b.seleziona_os(2, 2, 5, 2)
        b.menu('Dati', 'Formattazione condizionale...'); b.attendi(600)
        b.ok('Dati > Formattazione condizionale... apre la finestra', 'free-dialogo-regole' in dialoghi_aperti(b), dialoghi_aperti(b))
        imposta_campo(b, 'condizione', 'maggiore'); imposta_campo(b, 'valore1', '10')
        chiudi_dialogo_con(b, 'fine')
        b.clic_cella_os(10, 8); b.attendi(300)
        bgs = [b.js("(r) => getComputedStyle(GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"2\"]`)).backgroundColor", r) for r in range(2, 6)]
        valori = [b.cella(r, 2)['v'] for r in range(2, 6)]
        colorate = [r for r, bg in zip(range(2, 6), bgs) if bg != 'rgb(255, 255, 255)']
        attese = [r for r, v in zip(range(2, 6), valori) if isinstance(v, (int, float)) and v > 10]
        b.ok('la regola "maggiore di 10" colora solo le celle con valori maggiori', colorate == attese and attese, [bgs, valori])
        b.seleziona_os(2, 2, 5, 2); b.menu('Dati', 'Rimuovi formattazione condizionale'); b.attendi(400)
        b.ok('Dati > Rimuovi formattazione condizionale', b.js("() => GR.getDoc().conditionalFormats.length") == 0)
    prova(b, 'Condizionale', condizionale)

    def unione():
        b.seleziona_os(12, 1, 13, 2)
        b.menu('Dati', 'Unisci celle', 'Unisci tutto'); b.attendi(400)
        r = b.rect(12, 1)
        b.ok('Dati > Unisci celle > Unisci tutto: A12:B13 diventa una cella 2x2', r and abs(r['w'] - 180) < 3 and abs(r['h'] - 44) < 4, r)
        b.menu('Dati', 'Unisci celle', 'Annulla unione'); b.attendi(400)
        b.ok('Annulla unione la separa', b.js("() => GR.getDoc().merges.length") == 0)
        b.seleziona_os(15, 1, 15, 3); b.menu('Dati', 'Unisci celle', 'Unisci orizzontalmente'); b.attendi(400)
        r = b.rect(15, 1)
        b.ok('Unisci orizzontalmente: A15:C15 larga 3 colonne', r and abs(r['w'] - 270) < 3, r)
        b.seleziona_os(17, 1, 19, 1); b.menu('Dati', 'Unisci celle', 'Unisci verticalmente'); b.attendi(400)
        r = b.rect(17, 1)
        b.ok('Unisci verticalmente: A17:A19 alta 3 righe', r and abs(r['h'] - 66) < 4, r)
    prova(b, 'Unione', unione)

    # ---------------- STRUMENTI, AIUTO, INFORMAZIONI ----------------
    def ortografia():
        b.clic_cella_os(2, 1)
        prima = b.stato_app()['msg']
        b.menu('Strumenti', 'Controllo ortografico'); b.attendi(500)
        msg = b.stato_app()['msg'] or ''
        if 'non ancora disponibile' in msg: b.manca('Strumenti > Controllo ortografico (F7): la voce c\'è ma non è realizzata', msg)
        else: b.ok('Strumenti > Controllo ortografico fa qualcosa', msg != prima, msg)
        b.os_tasto('F7'); b.attendi(400)
        b.nota('messaggio dopo F7', b.stato_app()['msg'])
    prova(b, 'Ortografia', ortografia)

    def cerca_menu():
        b.menu('Strumenti', 'Cerca nei menu'); b.attendi(500)
        aperto = b.js("() => { const m = APP.shadowRoot.querySelector('free-menu-search'); return !!(m && m.shadowRoot && m.shadowRoot.querySelector('input')); }")
        b.ok('Strumenti > Cerca nei menu apre la ricerca', aperto)
        if aperto:
            r = b.js("() => { const i = APP.shadowRoot.querySelector('free-menu-search').shadowRoot.querySelector('input'); const x = i.getBoundingClientRect(); return {x: x.left + 30, y: x.top + x.height/2}; }")
            b.clic_os(r['x'], r['y']); b.os_testo('grass'); b.attendi(400)
            voci = b.js("() => Array.from(APP.shadowRoot.querySelector('free-menu-search').shadowRoot.querySelectorAll('.result-item')).map(x => x.textContent.trim().replace(/\\s+/g, ' ')).slice(0, 5)")
            b.ok('scrivendo "grass" propone "Grassetto"', any('Grassetto' in v for v in voci), voci)
            b.os_tasto('Esc'); b.attendi(300)
    prova(b, 'Cerca nei menu', cerca_menu)

    def preferenze():
        b.menu('Strumenti', 'Preferenze'); b.attendi(600)
        b.ok('Strumenti > Preferenze apre la finestra', 'free-dialogo-preferenze' in dialoghi_aperti(b), dialoghi_aperti(b))
        testo = b.js("() => { const d = APP.shadowRoot.querySelector('free-dialogo-preferenze'); return d.shadowRoot.textContent.replace(/\\s+/g, ' ').trim().slice(0, 300); }")
        b.nota('contenuto della finestra Preferenze', testo)
        chiudi_dialogo_con(b, 'chiudi')
        b.ok('"Chiudi" la chiude', 'free-dialogo-preferenze' not in dialoghi_aperti(b))
    prova(b, 'Preferenze', preferenze)

    def aiuto():
        b.menu('Aiuto', 'Scorciatoie da tastiera'); b.attendi(400)
        b.ok('Aiuto > Scorciatoie da tastiera mostra l\'elenco nella barra di stato', 'Ctrl+C' in (b.stato_app()['msg'] or ''), b.stato_app()['msg'])
        b.menu('Aiuto', 'Informazioni su pmb_sheets'); b.attendi(400)
        b.ok('Aiuto > Informazioni su pmb_sheets', 'pmb_sheets' in (b.stato_app()['msg'] or ''), b.stato_app()['msg'])
        b.clic_cella_os(2, 1); b.os_tasto('Spazio') if False else None
    prova(b, 'Aiuto', aiuto)

    def informazioni():
        for voce, tag in [('Informazioni su pmb_sheets', 'free-dialogo-informazioni'), ("Condizioni d'uso", 'free-dialogo-informazioni'), ('Licenze di terze parti', 'free-dialogo-informazioni'), ('Segnala un bug o invia un feedback', 'free-dialogo-segnala')]:
            b.menu('Informazioni', voce); b.attendi(600)
            aperti = dialoghi_aperti(b)
            b.ok(f'Informazioni > {voce} apre una finestra', tag in aperti, aperti)
            testo = b.js("() => { const d = Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName.startsWith('FREE-DIALOGO')); return d ? d.shadowRoot.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120) : ''; }")
            b.ok(f'  con del testo dentro ({voce})', len(testo) > 20, testo)
            b.pg.keyboard.press('Escape'); b.attendi(300)
            if dialoghi_aperti(b): b.js("() => { const d = Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName.startsWith('FREE-DIALOGO')); const bt = d.shadowRoot.querySelector('[data-azione=chiudi], [data-azione=annulla]'); bt && bt.click(); }"); b.attendi(300)
            b.ok(f'  e si chiude ({voce})', not dialoghi_aperti(b), dialoghi_aperti(b))
    prova(b, 'Informazioni', informazioni)

    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])
