import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

def tasto(giu, vk): L._u.keybd_event(vk, 0, 0 if giu else 2, 0); time.sleep(0.08)

def clic_giusto(b, r, c, tentativi=15):
    for _ in range(tentativi):
        b.clic_cella_os(r, c)
        a = b.js("() => { const s = GR.getDoc().selection.anchor; return [s.row, s.col]; }")
        if a == [r, c]: return True
    return False

STILE = "([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); const s = getComputedStyle(t); return {col: s.color, dec: s.textDecorationLine || s.textDecoration, tit: t.getAttribute('title'), tx: t.textContent.trim()}; }"
DIALOGO = "() => { const d = APP.shadowRoot.querySelector('free-dialogo-link'); return d ? {titolo: d.shadowRoot.querySelector('h2').textContent.trim(), url: d.shadowRoot.querySelector('input[data-campo=url]').value, focus: !!d.shadowRoot.activeElement} : null; }"

with Banco(9594, '11 Link nelle celle') as b:
    b.primo_piano()
    b.imposta(2, 2, 'Il mio sito'); b.imposta(4, 2, 'altro'); b.aggiorna()
    # niente browser vero durante la prova: si intercetta la richiesta di apertura
    b.js("() => { window.__aperti = []; window.addEventListener('apri-link', (e) => { window.__aperti.push(e.detail.url); e.stopPropagation(); }, true); }")
    def inserisci():
        ok = clic_giusto(b, 2, 2); b.ok('cella B2 selezionata col mouse', ok)
        b.os_tasto('K', 'Ctrl'); b.attendi(500)
        d = b.js(DIALOGO)
        b.ok('Ctrl+K apre la finestra del link sulla cella B2', d is not None and 'B2' in d['titolo'], d)
        b.ok('il campo dell\'indirizzo ha già il cursore', d is not None and d['focus'], d)
        b.os_testo('esempio.it'); b.os_tasto('Invio'); b.attendi(700)
        b.ok('Invio salva e chiude la finestra', b.js(DIALOGO) is None)
        s = b.js(STILE, [2, 2])
        b.ok('la cella si vede blu e sottolineata', s['col'] == 'rgb(5, 99, 193)' and 'underline' in s['dec'], s)
        b.ok('il suggerimento mostra l\'indirizzo completo', 'https://esempio.it' in (s['tit'] or ''), s)
        b.ok('il testo della cella resta "Il mio sito"', s['tx'] == 'Il mio sito', s)
    prova(b, 'Inserire un link', inserisci)
    def apri():
        tasto(True, 0x12)               # Alt
        ok = clic_giusto(b, 2, 2)
        tasto(False, 0x12)
        time.sleep(0.4)
        ap = b.js("() => window.__aperti")
        b.ok('Alt+clic chiede di aprire https://esempio.it', 'https://esempio.it' in ap, ap)
        n0 = len(ap)
        clic_giusto(b, 4, 2); clic_giusto(b, 2, 2); time.sleep(0.3)
        b.ok('un clic semplice non apre niente', len(b.js("() => window.__aperti")) == n0)
    prova(b, 'Aprire con Alt+clic', apri)
    def menu():
        clic_giusto(b, 2, 2)
        r = b.rect(2, 2)
        L._clic_os(b, r['x'] + 12, r['y'] + r['h'] / 2, tasto='right'); b.attendi(500)
        voci = b.js("() => Array.from(GR.renderRoot.querySelectorAll('.sheet-menu-item')).map(e => e.textContent.trim())")
        b.ok('il menu del tasto destro ha Link, Apri link e Rimuovi link', all(any(x.startswith(v) for x in voci) for v in ['Link…', 'Apri link', 'Rimuovi link']), voci)
        b.js("() => { Array.from(GR.renderRoot.querySelectorAll('.sheet-menu-item')).find(e => e.textContent.trim() === 'Rimuovi link').click(); }"); b.attendi(600)
        s = b.js(STILE, [2, 2])
        b.ok('Rimuovi link: la cella torna normale e il testo resta', s['col'] != 'rgb(5, 99, 193)' and s['tx'] == 'Il mio sito' and not s['tit'], s)
        b.os_tasto('Z', 'Ctrl'); b.attendi(600)
        s = b.js(STILE, [2, 2])
        b.ok('Ctrl+Z rimette il link', s['col'] == 'rgb(5, 99, 193)', s)
    prova(b, 'Menu e annulla', menu)
    def sbagliato():
        clic_giusto(b, 4, 2)
        b.os_tasto('K', 'Ctrl'); b.attendi(500)
        b.os_testo('questa non e una frase valida'); b.os_tasto('Invio'); b.attendi(500)
        err = b.js("() => { const d = APP.shadowRoot.querySelector('free-dialogo-link'); return d ? d.shadowRoot.querySelector('[data-campo=errore]').textContent.trim() : null; }")
        b.ok('un indirizzo non valido resta nella finestra con un messaggio', bool(err), err)
        b.os_tasto('Esc'); b.attendi(400)
        b.ok('Esc chiude la finestra senza salvare', b.js(DIALOGO) is None and b.js(STILE, [4, 2])['col'] != 'rgb(5, 99, 193)')
    prova(b, 'Indirizzo non valido', sbagliato)
    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
