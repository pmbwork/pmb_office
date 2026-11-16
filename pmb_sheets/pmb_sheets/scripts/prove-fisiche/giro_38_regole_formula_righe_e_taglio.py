import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

DIALOGO = "Array.from(APP.shadowRoot.querySelectorAll('*')).find(e => e.tagName === 'FREE-DIALOGO-REGOLE')"
VERDE = 'rgb(183,225,205)'   # il verde chiaro che propone il dialogo

def imposta_campo(b, campo, valore):
    b.js("([c, v]) => { const d = " + DIALOGO + "; const el = d.shadowRoot.querySelector(`[data-campo=${c}]`); el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); }", [campo, valore]); b.attendi(250)

formula = lambda b: b.js("() => { const r = GR.getDoc().conditionalFormats[0]; return r ? [r.value1, r.range.startRow, r.range.endRow] : null; }")
def colorata(b, r, c=3):
    s = b.js("([r, c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); return t ? getComputedStyle(t).backgroundColor : null; }", [r, c])
    return s is not None and s.replace(' ', '') == VERDE
def lontano(b): b.clic_cella_os(20, 11); b.attendi(300)

with Banco(9632, '38 Regole con formula: inserire ed eliminare righe, tagliare') as b:
    b.primo_piano()
    for r in range(1, 6): b.imposta(r, 1, str(r * 10))   # A1:A5 = 10..50
    b.aggiorna()

    def crea():
        b.seleziona_os(1, 3, 5, 3)
        b.menu('Dati', 'Formattazione condizionale...'); b.attendi(600)
        imposta_campo(b, 'intervallo', 'C1:C5')   # scritto nel campo: non dipende dal trascinamento
        imposta_campo(b, 'condizione', 'formula'); imposta_campo(b, 'valore1', '=A1>25')
        b.js("() => { const d = " + DIALOGO + "; d.shadowRoot.querySelector('[data-azione=fine]').click(); }"); b.attendi(500)
        lontano(b)
        b.ok('la regola =A1>25 è su C1:C5', formula(b) == ['=A1>25', 1, 5], formula(b))
        b.ok('C3 (A3 = 30) è colorata, C2 (A2 = 20) no', colorata(b, 3) and not colorata(b, 2))
    prova(b, 'Regola con formula', crea)

    def inserisci():
        b.clic_cella_os(1, 1); b.attendi(200)
        b.menu('Inserisci', 'Riga sopra'); b.attendi(800)
        lontano(b)
        b.ok('Inserisci > Riga sopra: la regola scende su C2:C6 e diventa =A2>25', formula(b) == ['=A2>25', 2, 6], formula(b))
        b.ok('il 30 ora è in A4: C4 colorata, C3 (20) no', colorata(b, 4) and not colorata(b, 3))
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        b.ok('Ctrl+Z la rimette =A1>25 su C1:C5', formula(b) == ['=A1>25', 1, 5], formula(b))
    prova(b, 'Inserisco una riga', inserisci)

    def elimina():
        b.clic_cella_os(1, 1); b.attendi(200)
        b.menu('Modifica', 'Elimina riga'); b.attendi(800)
        lontano(b)
        b.ok('Modifica > Elimina riga 1: la regola è su C1:C4 e resta =A1>25 (non #REF!)', formula(b) == ['=A1>25', 1, 4], formula(b))
        b.ok('il 30 ora è in A2: C2 colorata, C1 (20) no', colorata(b, 2) and not colorata(b, 1))
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        b.ok('Ctrl+Z rimette la riga e la regola su C1:C5', formula(b) == ['=A1>25', 1, 5], formula(b))
    prova(b, 'Elimino la prima riga', elimina)

    def taglia():
        b.seleziona_os(1, 1, 5, 1)
        b.os_tasto('X', 'Ctrl'); b.attendi(600)
        b.clic_cella_os(1, 5); b.attendi(200)
        b.os_tasto('V', 'Ctrl'); b.attendi(1200)
        lontano(b)
        b.ok('tagliati A1:A5 e incollati in E1: la regola segue i dati (=E1>25)', formula(b) == ['=E1>25', 1, 5], formula(b))
        b.ok('e colora ancora C3, non C2', colorata(b, 3) and not colorata(b, 2))
        b.os_tasto('Z', 'Ctrl'); b.attendi(1200)
        b.ok('Ctrl+Z la rimette =A1>25', formula(b) == ['=A1>25', 1, 5], formula(b))
    prova(b, 'Taglio i dati', taglia)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
