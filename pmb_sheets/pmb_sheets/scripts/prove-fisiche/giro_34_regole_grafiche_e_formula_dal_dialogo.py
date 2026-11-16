import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def chiudi_dialogo_con(b, azione):
    b.js("(a) => { const d = Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName.startsWith('FREE-DIALOGO')); const bt = d.shadowRoot.querySelector(`[data-azione=${a}]`); bt && bt.click(); }", azione); b.attendi(500)

def imposta_campo(b, campo, valore):
    b.js("([c, v]) => { const d = Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName.startsWith('FREE-DIALOGO')); const el = d.shadowRoot.querySelector(`[data-campo=${c}]`); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); }", [campo, valore]); b.attendi(250)

def visibile(b, riga):
    return b.js("(n) => { const d = Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName.startsWith('FREE-DIALOGO')); const el = d.shadowRoot.querySelector(`[data-riga=${n}]`); return !!el && !el.classList.contains('nascosto'); }", riga)

def sfondo(b, r, c):
    return b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); return t ? getComputedStyle(t).backgroundColor : null; }", [r, c])

def icona(b, r, c):
    return b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"] .icona-condizionale`); return t ? t.textContent : null; }", [r, c])

def immagine(b, r, c):
    return b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); return t ? t.style.backgroundImage : null; }", [r, c])

def apri_dialogo(b, r1, c1, r2, c2):
    b.seleziona_os(r1, c1, r2, c2)
    b.menu('Dati', 'Formattazione condizionale...'); b.attendi(600)
    return 'free-dialogo-regole' in dialoghi_aperti(b)

def togli_regole(b):
    b.js("() => { GR.getDoc().conditionalFormats.length = 0; GR.requestUpdate(); }"); b.attendi(300)

with Banco(9632, '34 Regole grafiche (scale, barre, icone) e a formula create dal dialogo') as b:
    b.primo_piano()
    for r in range(1, 6):
        b.imposta(r, 2, str(r * 25))   # B: 25..125
        b.imposta(r, 4, str(r * 10))   # D: 10..50
    b.aggiorna()
    far = lambda: (b.clic_cella_os(20, 11), b.attendi(300))

    def formula():
        b.ok('apro il dialogo su D1:D5', apri_dialogo(b, 1, 4, 5, 4))
        imposta_campo(b, 'condizione', 'formula')
        b.ok('con "La formula è vera" compare il campo della formula', visibile(b, 'valore1'))
        imposta_campo(b, 'valore1', '=D1>25')
        chiudi_dialogo_con(b, 'fine'); far()
        z = b.js("() => GR.getDoc().conditionalFormats.map(r => [r.type, r.value1])")
        b.ok('la regola è di tipo formula', ['formula', '=D1>25'] in z, z)
        rosso = lambda s: s is not None and s.replace(' ', '') == 'rgb(183,225,205)'   # il verde chiaro che propone il dialogo
        b.ok('D4 (40) è colorata e D2 (20) no', rosso(sfondo(b, 4, 4)) and not rosso(sfondo(b, 2, 4)), [sfondo(b, 4, 4), sfondo(b, 2, 4)])
    prova(b, 'Regola con formula dal dialogo', formula)
    togli_regole(b)

    def scala():
        b.ok('apro il dialogo su B1:B5', apri_dialogo(b, 1, 2, 5, 2))
        imposta_campo(b, 'condizione', 'scala-3')
        b.ok('compaiono i tre colori e spariscono i valori e lo sfondo', visibile(b, 'colore-min') and visibile(b, 'colore-mid') and visibile(b, 'colore-max') and not visibile(b, 'valore1'))
        chiudi_dialogo_con(b, 'fine'); far()
        z = b.js("() => GR.getDoc().conditionalFormats.map(r => r.type)")
        b.ok('la regola è una scala di colore', z == ['color_scale'], z)
        c1, c3, c5 = sfondo(b, 1, 2), sfondo(b, 3, 2), sfondo(b, 5, 2)
        b.ok('minimo, centro e massimo hanno colori diversi', len({c1, c3, c5}) == 3, [c1, c3, c5])
    prova(b, 'Scala di colore a tre toni', scala)
    togli_regole(b)

    def barre():
        b.ok('apro il dialogo su B1:B5', apri_dialogo(b, 1, 2, 5, 2))
        imposta_campo(b, 'condizione', 'barre')
        chiudi_dialogo_con(b, 'fine'); far()
        i5, i1 = immagine(b, 5, 2), immagine(b, 1, 2)
        b.ok('il massimo ha la barra piena e il minimo vuota', '100%' in i5 and '0%' in i1 and i5 != i1, [i5, i1])
        i3 = immagine(b, 3, 2)
        b.ok('la barra del centro è a metà (50%)', '50%' in i3, i3)
    prova(b, 'Barre dati', barre)
    togli_regole(b)

    def icone():
        b.ok('apro il dialogo su B1:B5', apri_dialogo(b, 1, 2, 5, 2))
        imposta_campo(b, 'condizione', 'frecce')
        chiudi_dialogo_con(b, 'fine'); far()
        b.ok('freccia su sul massimo, giù sul minimo', icona(b, 5, 2) == '▲' and icona(b, 1, 2) == '▼', [icona(b, 5, 2), icona(b, 1, 2)])
        # annulla: la regola sparisce
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        b.ok('Annulla toglie la regola e le icone', b.js("() => GR.getDoc().conditionalFormats.length") == 0 and icona(b, 5, 2) is None)
    prova(b, 'Icone con le frecce', icone)
    togli_regole(b)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
