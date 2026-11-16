import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *
import giro_lib as L

def clic_giusto(b, r, c, tentativi=15):
    for _ in range(tentativi):
        b.clic_cella_os(r, c)
        if b.js("() => { const s = GR.getDoc().selection; return [s.anchor.row, s.anchor.col, s.range.endRow - s.range.startRow, s.range.endCol - s.range.startCol]; }") == [r, c, 0, 0]: return True
    return False

def colore(b, r, c):
    return b.js("([r, c]) => getComputedStyle(GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`)).color", [r, c])

def selettore(b):
    return b.js("() => { const t = APP.shadowRoot.querySelector('free-toolbar').shadowRoot.querySelector('select[id^=\"tool-select-number-format-select\"]'); return t ? t.value : null; }")

def codice(b, r, c):
    return b.js("([r, c]) => GR.getDoc().styles && (function(){ const s = GR.getDoc(); return null; })()", [r, c])

def num_fmt(b, r, c):
    return b.js("([r, c]) => { const d = GR.getDoc(); const x = GR.getActiveCellFormat ? null : null; return null; }", [r, c])

def formato_attivo(b):
    return b.js("() => GR.getActiveCellFormat().codice")

def dialogo(b, js):
    return b.js("() => { const d = APP.shadowRoot.querySelector('free-dialogo-formato'); if (!d) return null; const r = d.shadowRoot; " + js + " }")

with Banco(9629, '24 Formati numerici: contabilità, durata, frazione, colori e formato personalizzato') as b:
    b.primo_piano()
    valori = {1: '1234.5', 2: '-1234.5', 3: '0', 4: '1.5', 5: '0.75', 6: '5', 7: '1234.5'}
    for r, v in valori.items(): b.imposta(r, 1, v)
    b.aggiorna()

    def pronti():
        b.ok('clic su A1', clic_giusto(b, 1, 1)); b.menu('Formato', 'Numero', 'Contabilità'); b.attendi(500)
        t = b.testo(1, 1)
        # dal 2026-11-13 il simbolo sta a sinistra e il numero a destra (riempimento *): nel testo della cella non c'è più lo spazio fisso tra i due
        senza_spazi = lambda s: s.replace(' ', '').replace(' ', '')
        b.ok('contabilità: 1234,5 → "€ 1.234,50"', '€1.234,50' in senza_spazi(t), repr(t))
        clic_giusto(b, 2, 1); b.menu('Formato', 'Numero', 'Contabilità'); b.attendi(500)
        t = b.testo(2, 1)
        b.ok('contabilità: −1234,5 → "€ (1.234,50)"', '€(1.234,50)' in senza_spazi(t), repr(t))
        clic_giusto(b, 3, 1); b.menu('Formato', 'Numero', 'Contabilità'); b.attendi(500)
        t = b.testo(3, 1)
        b.ok('contabilità: zero → trattino, nessuna cifra (non più "00")', '€' in t and '-' in t and not any(ch.isdigit() for ch in t), repr(t))
        b.ok('il menu a tendina della barra mostra Contabilità', selettore(b) == 'accounting', selettore(b))

        clic_giusto(b, 4, 1); b.menu('Formato', 'Numero', 'Durata'); b.attendi(500)
        b.ok('durata: 1,5 giorni → 36:00:00', b.testo(4, 1).strip() == '36:00:00', b.testo(4, 1))
        clic_giusto(b, 5, 1); b.menu('Formato', 'Numero', 'Frazione'); b.attendi(500)
        b.ok('frazione: 0,75 → 3/4', b.testo(5, 1).strip() == '3/4', b.testo(5, 1))
        clic_giusto(b, 7, 1); b.menu('Formato', 'Numero', 'Valuta arrotondata'); b.attendi(500)
        b.ok('valuta arrotondata: 1234,5 → €1.235', b.testo(7, 1).strip() == '€1.235', b.testo(7, 1))
        b.ok('il menu a tendina mostra Valuta arrotondata', selettore(b) == 'currency-round', selettore(b))
    prova(b, 'Formati pronti', pronti)

    def rosso():
        clic_giusto(b, 2, 1); b.menu('Formato', 'Numero', 'Negativi in rosso'); b.attendi(500)
        c_neg = colore(b, 2, 1)
        clic_giusto(b, 6, 1); b.menu('Formato', 'Numero', 'Negativi in rosso'); b.attendi(500)
        clic_giusto(b, 9, 3)   # via dalla selezione: la cella selezionata non mostra i suoi colori
        c_pos = colore(b, 6, 1); c_neg = colore(b, 2, 1)
        b.ok('il numero negativo è rosso (208, 0, 0)', c_neg == 'rgb(208, 0, 0)', c_neg)
        b.ok('il positivo ha il colore normale', c_pos != 'rgb(208, 0, 0)', c_pos)
        b.ok('il testo del negativo ha il meno', b.testo(2, 1).strip() == '-1.234,50', b.testo(2, 1))
        b.ok('il valore della cella resta un numero', b.cella(2, 1)['v'] == -1234.5, b.cella(2, 1))
    prova(b, 'Colore del formato', rosso)

    def personalizzato():
        clic_giusto(b, 1, 1)
        b.menu('Formato', 'Numero', 'Altri formati…'); b.attendi(700)
        aperta = dialogo(b, "return true;")
        b.ok('si apre la finestra del formato personalizzato', aperta is True, aperta)
        cod = dialogo(b, "return r.querySelector('input[data-campo=\"codice\"]').value;")
        b.ok('il campo mostra il formato della cella (contabilità)', cod is not None and cod.startswith('_(€*'), cod)
        # il campo ha il fuoco con tutto selezionato: si scrive sopra
        b.pg.keyboard.insert_text('[>=1000]"alto";"basso"'); b.attendi(500)
        anteprima = dialogo(b, "return Array.from(r.querySelectorAll('.anteprima .riga')).map(x => [x.querySelector('.etichetta').textContent, x.querySelector('.risultato').textContent]);")
        b.ok('l\'anteprima mostra alto per 1234,5 e basso per lo zero', anteprima is not None and ['Positivo', 'alto'] in anteprima and ['Zero', 'basso'] in anteprima, anteprima)
        b.ok('l\'anteprima include la cella attiva', anteprima is not None and anteprima[0][0] == 'Cella attiva', anteprima)
        b.pg.keyboard.press('Enter'); b.attendi(800)
        b.ok('la finestra si chiude', dialogo(b, "return true;") is None)
        clic_giusto(b, 9, 3)
        b.ok('A1 mostra "alto"', b.testo(1, 1).strip() == 'alto', b.testo(1, 1))
        b.ok('il formato è quello scritto', (clic_giusto(b, 1, 1) and formato_attivo(b)) == '[>=1000]"alto";"basso"', formato_attivo(b))
        b.ok('il menu a tendina mostra "Altri formati…" per un formato scritto a mano', selettore(b) == 'custom', selettore(b))
        b.os_tasto('Z', 'Ctrl'); b.attendi(800)
        clic_giusto(b, 9, 3)
        b.ok('Ctrl+Z torna alla contabilità', '€1.234,50' in b.testo(1, 1).replace(' ', '').replace(' ', ''), b.testo(1, 1))
        b.os_tasto('Y', 'Ctrl'); b.attendi(800)
        clic_giusto(b, 9, 3)
        b.ok('Ctrl+Y lo rifà', b.testo(1, 1).strip() == 'alto', b.testo(1, 1))
    prova(b, 'Formato personalizzato', personalizzato)

    def non_valido():
        clic_giusto(b, 6, 1)
        b.menu('Formato', 'Numero', 'Altri formati…'); b.attendi(700)
        b.pg.keyboard.insert_text('"non chiusa'); b.attendi(500)
        err = dialogo(b, "return r.querySelector('[data-campo=\"errore\"]').textContent;")
        dis = dialogo(b, "return r.querySelector('button[data-azione=\"applica\"]').disabled;")
        b.ok('un formato con virgolette non chiuse dà un errore', err is not None and 'non valido' in err, err)
        b.ok('il pulsante Applica è disattivato', dis is True, dis)
        prima = b.testo(6, 1)
        b.pg.keyboard.press('Enter'); b.attendi(500)
        b.ok('Invio non applica un formato non valido: la finestra resta aperta', dialogo(b, "return true;") is True)
        b.pg.keyboard.press('Escape'); b.attendi(600)
        b.ok('Esc chiude senza cambiare niente', dialogo(b, "return true;") is None and b.testo(6, 1) == prima, (prima, b.testo(6, 1)))
    prova(b, 'Formato non valido', non_valido)

    def scelte():
        clic_giusto(b, 6, 1)
        b.menu('Formato', 'Numero', 'Altri formati…'); b.attendi(700)
        dialogo(b, "r.querySelector('button[data-formato=\"duration\"]').click(); return true;"); b.attendi(400)
        cod = dialogo(b, "return r.querySelector('input[data-campo=\"codice\"]').value;")
        b.ok('un clic su "Durata" mette il suo codice nel campo', cod == '[h]:mm:ss', cod)
        dialogo(b, "r.querySelector('button[data-azione=\"applica\"]').click(); return true;"); b.attendi(600)
        clic_giusto(b, 9, 3)
        b.ok('applicato: 5 giorni = 120:00:00', b.testo(6, 1).strip() == '120:00:00', b.testo(6, 1))
    prova(b, 'Formati pronti nella finestra', scelte)

    e = b.errori_pagina()
    b.ok('nessun errore nella console', len(e) == 0, e[:3])
