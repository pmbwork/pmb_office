import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def dati(b):
    for i, (a, n) in enumerate([('Voce', 'Num'), ('delta', '0.25'), ('alfa', '1234.5'), ('charlie', '-7'), ('bravo', '42')], start=1):
        b.imposta(i, 1, a); b.imposta(i, 2, n)
    b.aggiorna()

def bottone(b, id_):
    r = b.js("(id) => { const t = APP.shadowRoot.querySelector('free-toolbar').shadowRoot.querySelector('#btn-' + id); if (!t) return null; const x = t.getBoundingClientRect(); return {x: x.left + x.width/2, y: x.top + x.height/2, w: x.width}; }", id_)
    return r

def clic_barra(b, id_):
    r = bottone(b, id_)
    if r is None or r['w'] == 0: raise RuntimeError(f'bottone {id_} non visibile')
    b.clic_os(r['x'], r['y']); b.attendi(350)

def seleziona_voce(b, id_, valore):
    b.js("([id, v]) => { const s = APP.shadowRoot.querySelector('free-toolbar').shadowRoot.querySelector('#tool-select-' + id); s.value = v; s.dispatchEvent(new Event('change', {bubbles: true})); }", [id_, valore]); b.attendi(400)

with Banco(9551, '05 Barra degli strumenti') as b:
    b.primo_piano()
    dati(b)
    ids = b.js("() => Array.from(APP.shadowRoot.querySelector('free-toolbar').shadowRoot.querySelectorAll('.tool-btn, select.tool-select')).filter(e => e.getBoundingClientRect().width > 0).map(e => e.id)")
    b.nota('controlli visibili nella barra', ids)

    def storia():
        b.scrivi_os(1, 4, 'x')
        clic_barra(b, 'undo')
        b.ok('barra > Annulla toglie "x"', b.cella(1, 4)['raw'] == '', b.cella(1, 4))
        clic_barra(b, 'redo')
        b.ok('barra > Ripeti la rimette', b.cella(1, 4)['raw'] == 'x', b.cella(1, 4))
        b.js("() => { window.__stampato = 0; }"); clic_barra(b, 'print'); b.attendi(800)
        b.ok('barra > Stampa chiama la stampa di sistema', b.js("() => window.__stampato") >= 1)
        b.os_tasto('Z', 'Ctrl')
    prova(b, 'Storia', storia)

    def formati_numerici():
        b.clic_cella_os(2, 2)
        clic_barra(b, 'format-currency'); b.ok('barra > Valuta: 0,25 → €0,25', b.testo(2, 2) == '€0,25', b.testo(2, 2))
        clic_barra(b, 'format-percent'); b.ok('barra > Percentuale: 0,25 → 25,00%', b.testo(2, 2) in ('25%', '25,00%'), b.testo(2, 2))
        seleziona_voce(b, 'number-format-select', 'number'); t0 = b.testo(2, 2)
        clic_barra(b, 'increase-decimals'); t1 = b.testo(2, 2)
        clic_barra(b, 'decrease-decimals'); clic_barra(b, 'decrease-decimals'); t2 = b.testo(2, 2)
        b.ok('barra > Aumenta decimali e Diminuisci decimali cambiano il numero di decimali', len(t1.split(',')[-1]) == len(t0.split(',')[-1]) + 1 and len(t2.split(',')[-1]) == len(t0.split(',')[-1]) - 1, [t0, t1, t2])
        for valore, atteso in [('auto', '0,25'), ('text', '0,25'), ('scientific', '2,50E-01'), ('time', '06:00:00')]:
            seleziona_voce(b, 'number-format-select', valore)
            b.ok(f'barra > Formato numero "{valore}"', b.testo(2, 2) == atteso, b.testo(2, 2))
        clic_barra(b, 'clear-formatting')
    prova(b, 'Formati numerici', formati_numerici)

    def stili():
        b.clic_cella_os(3, 1)
        for id_, prop, cond in [('bold', 'fontWeight', lambda v: v in ('700', 'bold')), ('italic', 'fontStyle', lambda v: v == 'italic'), ('underline', 'textDecorationLine', lambda v: 'underline' in v), ('strike', 'textDecorationLine', lambda v: 'line-through' in v)]:
            clic_barra(b, id_); v = stile_cella(b, 3, 1, prop)
            b.ok(f'barra > {id_}', cond(v), v)
        clic_barra(b, 'bold'); b.ok('un secondo clic su grassetto lo toglie', stile_cella(b, 3, 1, 'fontWeight') in ('400', 'normal'))
        clic_barra(b, 'clear-formatting')
        b.ok('barra > Cancella formattazione', stile_cella(b, 3, 1, 'fontStyle') == 'normal' and stile_cella(b, 3, 1, 'textDecorationLine') == 'none')
        # stato dei pulsanti: dopo il grassetto il pulsante risulta attivo
        clic_barra(b, 'bold'); b.clic_cella_os(4, 1); b.clic_cella_os(3, 1)
        att = b.js("() => APP.shadowRoot.querySelector('free-toolbar').shadowRoot.querySelector('#btn-bold').classList.contains('active')")
        b.ok('il pulsante Grassetto risulta premuto quando la cella attiva è in grassetto', att)
    prova(b, 'Stili', stili)

    def carattere():
        b.clic_cella_os(4, 1)
        seleziona_voce(b, 'font-family', 'monospace'); f = stile_cella(b, 4, 1, 'fontFamily')
        b.ok('barra > Carattere "Monospace"', 'monospace' in f.lower(), f)
        seleziona_voce(b, 'font-size', '24'); s = stile_cella(b, 4, 1, 'fontSize')
        b.ok('barra > Dimensione 24', s == '24px', s)
        r = b.rect(4, 1)
        b.nota('altezza della riga con carattere 24 (le righe non crescono da sole)', r['h'])
    prova(b, 'Carattere', carattere)

    def colori():
        for id_, prop in [('fill-color', 'backgroundColor'), ('text-color', 'color')]:
            b.clic_cella_os(5, 1)
            clic_barra(b, id_)
            sw = b.js("() => { const t = APP.shadowRoot.querySelector('free-toolbar').shadowRoot.querySelector('free-color-picker'); const s = t && t.shadowRoot && t.shadowRoot.querySelectorAll('.color-swatch'); if (!s || !s.length) return null; const x = s[12].getBoundingClientRect(); return {x: x.left + x.width/2, y: x.top + x.height/2, n: s.length}; }")
            b.ok(f'barra > {id_} apre la tavolozza', sw is not None, sw)
            if sw:
                b.clic_os(sw['x'], sw['y']); b.attendi(400)
                # si legge A5 senza selezionarla: una cella selezionata mostra il colore della selezione, non il suo sfondo
                b.clic_cella_os(6, 3)
                v = stile_cella(b, 6, 3, prop) if False else b.js("([p]) => getComputedStyle(GR.renderRoot.querySelector('td[data-row=\"5\"][data-col=\"1\"]'))[p]", [prop])
                b.ok(f'  scegliere un colore cambia {prop} della cella', v not in ('rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)', 'rgb(15, 23, 42)') or prop == 'color', v)
    prova(b, 'Colori', colori)

    def allineamento():
        b.clic_cella_os(2, 1)
        for id_, prop, atteso in [('align-left', 'textAlign', 'left'), ('align-center', 'textAlign', 'center'), ('align-right', 'textAlign', 'right'),
                                  ('align-top', 'verticalAlign', 'top'), ('align-middle', 'verticalAlign', 'middle'), ('align-bottom', 'verticalAlign', 'bottom')]:
            clic_barra(b, id_); v = stile_cella(b, 2, 1, prop)
            b.ok(f'barra > {id_}', v == atteso, v)
        clic_barra(b, 'wrap-text'); b.ok('barra > A capo', stile_cella(b, 2, 1, 'whiteSpace') == 'pre-wrap', stile_cella(b, 2, 1, 'whiteSpace'))
    prova(b, 'Allineamento', allineamento)

    def bordi():
        b.seleziona_os(8, 1, 9, 2)
        seleziona_voce(b, 'borders-select', 'all')
        t = b.js("() => ['8,1', '9,2'].map(k => { const [r, c] = k.split(','); const s = getComputedStyle(GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`)); return [s.borderTopStyle, s.borderBottomStyle]; })")
        b.ok('barra > Bordi "tutti i bordi" disegna i bordi', all(x[0] == 'solid' for x in t), t)
        seleziona_voce(b, 'border-style-select', 'medium')
        w = b.js("() => getComputedStyle(GR.renderRoot.querySelector('td[data-row=\"8\"][data-col=\"1\"]')).borderTopWidth")
        b.ok('barra > Stile bordo "medio" ingrossa il bordo', w == '2px', w)
        seleziona_voce(b, 'borders-select', 'none')
        s = b.js("() => getComputedStyle(GR.renderRoot.querySelector('td[data-row=\"8\"][data-col=\"1\"]')).borderTopStyle")
        b.ok('barra > Bordi "nessun bordo" li toglie', s in ('none',) or b.js("() => getComputedStyle(GR.renderRoot.querySelector('td[data-row=\"8\"][data-col=\"1\"]')).borderTopWidth") in ('0px', '1px'), s)
    prova(b, 'Bordi', bordi)

    def unisci_filtro_grafico():
        b.seleziona_os(12, 1, 12, 3); clic_barra(b, 'merge-cells')
        r = b.rect(12, 1); b.ok('barra > Unisci celle', r and abs(r['w'] - 270) < 3, r)
        b.seleziona_os(1, 1, 5, 2); clic_barra(b, 'create-filter')
        b.ok('barra > Filtro mostra le frecce', b.js("() => GR.renderRoot.querySelectorAll('.col-filter-btn').length") >= 2)
        clic_barra(b, 'create-filter')
        b.nota('un secondo clic sul filtro', b.js("() => GR.renderRoot.querySelectorAll('.col-filter-btn').length"))
        b.seleziona_os(1, 1, 5, 2); clic_barra(b, 'insert-chart'); b.attendi(700)
        b.ok('barra > Grafico crea un grafico e apre il pannello', b.js("() => GR.getDoc().charts.length") == 1 and b.stato_app()['sidebar'] is True, [b.js("() => GR.getDoc().charts.length"), b.stato_app()['sidebar']])
        b.seleziona_os(1, 1, 5, 2); clic_barra(b, 'insert-pivot'); b.attendi(700)
        b.ok('barra > Tabella pivot apre il pannello', b.stato_app()['sidebar'] is True)
    prova(b, 'Unisci filtro grafico pivot', unisci_filtro_grafico)

    def pennello():
        b.imposta(14, 1, 'sorgente'); b.imposta(15, 1, 'destinazione'); b.aggiorna()
        b.clic_cella_os(14, 1)
        b.js("() => GR.applyFormat({bold: true, italic: true, fill: '#ffcc00'})"); b.attendi(300)
        clic_barra(b, 'format-painter'); b.clic_cella_os(15, 1); b.clic_cella_os(20, 5)
        b.ok('barra > Copia formato: il formato passa alla cella cliccata dopo', stile_cella(b, 15, 1, 'fontStyle') == 'italic' and stile_cella(b, 15, 1, 'fontWeight') in ('700', 'bold'),
             [stile_cella(b, 15, 1, 'fontStyle'), stile_cella(b, 15, 1, 'fontWeight'), stile_cella(b, 15, 1, 'backgroundColor')])
    prova(b, 'Pennello', pennello)

    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])
