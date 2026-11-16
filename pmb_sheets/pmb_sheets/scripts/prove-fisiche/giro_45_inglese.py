"""Giro 45: l'interfaccia in inglese. Dalla finestra Preferenze (mouse vero) si passa all'inglese: menu, barra, barra del titolo e messaggi cambiano subito,
le voci di menu in inglese funzionano, la scelta finisce in impostazioni.json; poi si torna all'italiano. Il banco rimette le impostazioni dell'utente alla fine."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

TITOLI = "() => Array.from(APP.shadowRoot.querySelector('free-menubar').shadowRoot.querySelectorAll('.menu-btn')).map(b => b.textContent.replace(/\\s+/g, '')).slice(0, 9)"

def scegli_lingua(b, lingua):
    """Clic vero sul pulsante della lingua nella finestra Preferenze già aperta."""
    for _ in range(3):
        r = b.js("(l) => { const d = APP.shadowRoot.querySelector('free-dialogo-preferenze'); const e = d && d.shadowRoot.querySelector(`input[data-lingua=\"${l}\"]`); if (!e) return null; const x = e.getBoundingClientRect(); return [x.left + x.width / 2, x.top + x.height / 2]; }", lingua)
        if r is None: return False
        # il clic vero va alla finestra che sta sopra quel punto: se un'altra finestra (notifica, sincronizzazione, editor) è passata
        # in primo piano, il clic andrebbe a lei e la prova fallirebbe senza colpa del programma. Prima si riporta pmb_sheets in primo piano.
        b.primo_piano(); b.attendi(200)
        L._clic_os(b, r[0], r[1]); b.attendi(500)
        if b.js("(l) => APP.shadowRoot.querySelector('free-dialogo-preferenze').shadowRoot.querySelector(`input[data-lingua=\"${l}\"]`).checked", lingua): return True
    return False

with Banco(9645, '45 Interfaccia in inglese') as b:
    b.primo_piano()

    def partenza():
        b.ok('si parte in italiano (messo dal banco solo per la prova)', b.js(TITOLI)[:3] == ['File', 'Modifica', 'Visualizza'], b.js(TITOLI))
    prova(b, 'Partenza', partenza)

    def in_inglese():
        b.menu('Strumenti', 'Preferenze'); b.attendi(400)
        b.ok('la finestra Preferenze ha la scelta della lingua', b.js("() => APP.shadowRoot.querySelector('free-dialogo-preferenze').shadowRoot.querySelectorAll('input[name=lingua]').length") == 3)
        b.ok('clic vero su English', scegli_lingua(b, 'en'))
        b.attendi(500)
        titoli = b.js(TITOLI)
        b.ok('i menu sono in inglese subito, senza riavviare', titoli[:8] == ['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Help'], titoli)
        b.ok('la finestra stessa è in inglese', b.js("() => APP.shadowRoot.querySelector('free-dialogo-preferenze').shadowRoot.querySelector('h2').textContent.trim()") == 'Preferences')
        b.chiudi_dialoghi(); b.attendi(300)
        titolo = b.js("() => APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.doc-title').textContent.trim()")
        b.ok('il nome predefinito è «Untitled spreadsheet»', titolo == 'Untitled spreadsheet', titolo)
        badge = b.js("() => APP.shadowRoot.querySelector('free-titlebar').shadowRoot.querySelector('.status-badge').textContent.replace(/\\s+/g, ' ').trim()")
        b.ok('il badge del salvataggio è in inglese', badge == 'Not saved to disk (Ctrl+S)', badge)
        tip = b.js("() => APP.shadowRoot.querySelector('free-toolbar').shadowRoot.querySelector('#btn-bold').getAttribute('title')")
        b.ok('i suggerimenti della barra sono in inglese', tip == 'Bold (Ctrl+B)', tip)
        try:
            imp = json.load(open(L.IMPOSTAZIONI, encoding='utf-8'))
            b.ok('la scelta è salvata in impostazioni.json', imp.get('language') == 'en', imp)
        except OSError as e:
            b.manca('impostazioni.json leggibile', str(e))
    prova(b, 'Passaggio all inglese', in_inglese)

    def voci_inglesi():
        b.digita(1, 1, '0,5')
        b.clic_cella(1, 1)
        b.menu('Format', 'Number', 'Percent'); b.attendi(400)
        t = b.testo(1, 1)
        b.ok('Format › Number › Percent funziona (la voce in inglese esegue il comando)', t.replace(' ', ' ') in ('50,00%', '50%', '50,0%'), t)
        stato = b.js("() => APP.shadowRoot.querySelector('free-statusbar').shadowRoot.textContent.replace(/\\s+/g, ' ')")
        b.ok('il messaggio nella barra di stato è in inglese', 'Number format' in stato or 'Percent' in stato or 'Ready' in stato, stato[:160])
        b.menu('Edit', 'Undo'); b.attendi(300)
        b.ok('Edit › Undo toglie il formato', b.testo(1, 1).replace(' ', ' ') in ('0,5', '0.5'), b.testo(1, 1))
        # menu contestuale in inglese (tasto destro vero)
        L._clic_cella_os(b, 3, 3, tasto='right'); b.attendi(400)
        voci = b.js("() => Array.from(GR.shadowRoot.querySelectorAll('.sheet-context-menu .sheet-menu-item')).map(e => e.textContent.trim())")
        b.ok('il menu del tasto destro è in inglese', 'Cut' in voci and 'Insert 1 row above' in voci, voci[:6])
        b.chiudi_dialoghi(); b.attendi(200)
    prova(b, 'Voci in inglese', voci_inglesi)

    def di_nuovo_italiano():
        b.menu('Tools', 'Preferences'); b.attendi(400)
        b.ok('clic vero su Italiano', scegli_lingua(b, 'it'))
        b.attendi(400)
        b.chiudi_dialoghi(); b.attendi(300)
        b.ok('i menu tornano in italiano', b.js(TITOLI)[:3] == ['File', 'Modifica', 'Visualizza'], b.js(TITOLI))
    prova(b, 'Ritorno all italiano', di_nuovo_italiano)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
