import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

CART = os.path.join(TMP, 'giro_file8'); os.makedirs(CART, exist_ok=True)

def costruisci(b):
    """Un documento con un po' di tutto, costruito con i comandi del programma."""
    for i, (a, n) in enumerate([('Prodotto', 'Prezzo'), ('caffè', '12.5'), ('tè', '8'), ('latte', '3.25'), ('pane', '2')], start=1):
        b.imposta(i, 1, a); b.imposta(i, 2, n)
    b.imposta(6, 2, '=SUM(B2:B5)'); b.imposta(1, 4, '=B6*2'); b.imposta(2, 4, '=TEXT(B2,"0.00")')
    b.aggiorna()
    b.js("""async () => {
      const d = GR.getDoc();
      const sel = (r1, c1, r2, c2) => { d.selection = {anchor:{row:r1,col:c1},active:{row:r2,col:c2},range:{startRow:r1,endRow:r2,startCol:c1,endCol:c2}}; };
      sel(1, 1, 1, 2); GR.applyFormat({bold: true, fill: '#ffcc00'});
      sel(2, 2, 5, 2); GR.applyFormat({numFmt: '€#,##0.00'});
      sel(6, 2, 6, 2); GR.applyFormat({bold: true, color: '#d93025'});
      d.colWidths.set(1, 140); d.rowHeights.set(3, 40);
      GR.hideRow(8); GR.hideCol(6);
      GR.setFreezePanes(1, 1);
      sel(10, 1, 10, 3); GR.mergeSelection('all');
      sel(2, 5, 4, 5); GR.applicaConvalida({startRow:2,endRow:4,startCol:5,endCol:5}, {type:'list', listItems:['sì','no'], action:'reject', allowEmpty:true});
      GR.addConditionalFormatRule({id:'cf1', type:'cell_value', range:{startRow:2,endRow:5,startCol:2,endCol:2}, operator:'greater_than', value1:5, style:{backgroundColor:'#b7e1cd', bold:true}});
      GR.setComment(3, 1, 'è il tè verde');
      d.namedRanges.add({name:'Prezzi', sheetName:d.activeSheetName, rangeString:'B2:B5', startRow:2, startCol:2, endRow:5, endCol:2});
      await d.client.setNamedRanges(Array.from(d.namedRanges.getAll()).map(n => ({name: n.name, ref: n.sheetName + '!' + n.rangeString})));
      await GR.handleAddSheet('Secondo'); await d.client.setCell('Secondo', 1, 1, 'foglio due'); GR.impostaColoreSchedaFoglio('Secondo', '#22c55e');
      await GR.switchSheet('Foglio1');
    }""")
    b.attendi(800); b.aggiorna()

def istantanea(b):
    return b.js("""async () => {
      const d = GR.getDoc(); const out = {};
      out.fogli = await d.client.listSheets(); out.attivo = d.activeSheetName;
      const c = async (r, k) => { const x = await d.client.getCell(d.activeSheetName, r, k); return x.raw; };
      out.valori = [await c(1,1), await c(2,1), await c(3,2), await c(6,2), await c(1,4), await c(2,4)];
      out.calcolati = [(await d.client.getCell(d.activeSheetName, 6, 2)).value.value, (await d.client.getCell(d.activeSheetName, 1, 4)).value.value];
      d.selection = {anchor:{row:30,col:8},active:{row:30,col:8},range:{startRow:30,endRow:30,startCol:8,endCol:8}}; await new Promise(r => setTimeout(r, 300)); GR.requestUpdate(); await GR.updateComplete;
      const stile = (r, k) => { const t = GR.renderRoot.querySelector(`td[data-row="${r}"][data-col="${k}"]`); if (!t) return null; const s = getComputedStyle(t); return {w: s.fontWeight, bg: s.backgroundColor, col: s.color, h: Math.round(t.getBoundingClientRect().height), wd: Math.round(t.getBoundingClientRect().width), tx: t.textContent.trim()}; };
      out.stili = {intest: stile(1, 1), prezzo: stile(2, 2), totale: stile(6, 2), alta: stile(3, 1)};
      out.nascR = [...d.hiddenRows]; out.nascC = [...d.hiddenCols]; out.blocco = [d.freezeRows, d.freezeCols];
      out.unioni = d.merges.length; out.convalide = d.dataValidations.size; out.condizionali = d.conditionalFormats.length;
      out.commenti = d.comments ? d.comments.size : -1; out.nomi = d.namedRanges.getAll().map(n => n.name + '=' + n.rangeString);
      out.colori = {}; for (const f of out.fogli) { const t = Array.from(APP.shadowRoot.querySelector('free-tabs').shadowRoot.querySelectorAll('.tab-item')).find(x => x.textContent.trim() === f); out.colori[f] = t ? t.style.borderBottom : null; }
      out.larg = d.colWidths.get(1); out.alt = d.rowHeights.get(3);
      return out; }""")

def apri_con(b, nome, byte_list):
    b.js("(x) => { window.__aprire = {nome: x[0], bytes: x[1]}; }", [nome, byte_list])
    b.menu('File', 'Apri...'); b.attendi(2500)

def nuovo_senza_salvare(b):
    b.menu('File', 'Nuovo foglio di calcolo'); b.attendi(500)
    if 'free-dialogo-conferma' in dialoghi_aperti(b):
        b.js("() => { const c = APP.shadowRoot.querySelector('free-dialogo-conferma'); Array.from(c.shadowRoot.querySelectorAll('button')).find(x => /non salvare/i.test(x.textContent)).click(); }"); b.attendi(800)

def confronta(b, formato, prima, dopo, attesi_persi):
    def eq(chiave, f=lambda x: x): return f(prima[chiave]) == f(dopo[chiave])
    b.ok(f'[{formato}] fogli e foglio attivo', prima['fogli'] == dopo['fogli'] and prima['attivo'] == dopo['attivo'], [prima['fogli'], dopo['fogli']])
    b.ok(f'[{formato}] valori e formule delle celle', [str(x).replace('SUM', 'SUM') for x in prima['valori']] == [str(x) for x in dopo['valori']] or prima['valori'] == dopo['valori'], [prima['valori'], dopo['valori']])
    b.ok(f'[{formato}] risultati calcolati (somma 25,75 e doppio 51,5)', dopo['calcolati'] == [25.75, 51.5], dopo['calcolati'])
    b.ok(f'[{formato}] intestazione in grassetto con sfondo giallo', dopo['stili']['intest'] and dopo['stili']['intest']['w'] in ('700', 'bold') and dopo['stili']['intest']['bg'] == 'rgb(255, 204, 0)', dopo['stili']['intest'])
    b.ok(f'[{formato}] formato valuta sui prezzi (€12,50)', dopo['stili']['prezzo'] and dopo['stili']['prezzo']['tx'] == '€12,50', dopo['stili']['prezzo'])
    b.ok(f'[{formato}] totale in grassetto e rosso', dopo['stili']['totale'] and dopo['stili']['totale']['w'] in ('700', 'bold') and dopo['stili']['totale']['col'] == 'rgb(217, 48, 37)', dopo['stili']['totale'])
    b.ok(f'[{formato}] larghezza colonna A (140) e altezza riga 3 (40)', dopo['larg'] == 140 and dopo['alt'] == 40, [dopo['larg'], dopo['alt']])
    b.ok(f'[{formato}] riga 8 e colonna F nascoste', dopo['nascR'] == [8] and dopo['nascC'] == [6], [dopo['nascR'], dopo['nascC']])
    b.ok(f'[{formato}] blocco di 1 riga e 1 colonna', dopo['blocco'] == [1, 1], dopo['blocco'])
    b.ok(f'[{formato}] cella unita A10:C10', dopo['unioni'] == 1, dopo['unioni'])
    if 'convalide' in attesi_persi: b.manca(f'[{formato}] le convalide dei dati non si conservano', dopo['convalide'])
    else: b.ok(f'[{formato}] convalide dei dati (3 celle)', dopo['convalide'] == 3, dopo['convalide'])
    if 'condizionali' in attesi_persi: b.manca(f'[{formato}] la formattazione condizionale non si conserva', dopo['condizionali'])
    else: b.ok(f'[{formato}] formattazione condizionale (1 regola)', dopo['condizionali'] == 1, dopo['condizionali'])
    b.ok(f'[{formato}] commento sulla cella A3', dopo['commenti'] == 1, dopo['commenti'])
    b.ok(f'[{formato}] nome definito Prezzi', any(n.startswith('Prezzi=') for n in dopo['nomi']), dopo['nomi'])
    if 'colori' in attesi_persi: b.manca(f'[{formato}] il colore della scheda non si conserva', dopo['colori'])
    else: b.ok(f'[{formato}] colore verde della scheda "Secondo"', '3px' in (dopo['colori'].get('Secondo') or ''), dopo['colori'])

with Banco(9591, '08 Salvare e riaprire') as b:
    b.primo_piano()
    def giro_formati():
        costruisci(b)
        prima = istantanea(b)
        b.nota('documento costruito', {k: prima[k] for k in ('fogli', 'valori', 'nascR', 'nascC', 'blocco', 'unioni', 'convalide', 'condizionali', 'commenti', 'nomi')})
        for voce, est, nome, persi in [('Scarica come pmb_sheets (.psheet)', '.psheet', 'psheet', []), ('Scarica come cartella di lavoro (.xlsx)', '.xlsx', 'xlsx', []),
                                       # dalla 0.2.8 anche OpenDocument conserva formattazione condizionale e colore della scheda (T548)
                                       ('Scarica come OpenDocument (.ods)', '.ods', 'ods', [])]:
            def f(voce=voce, est=est, nome=nome, persi=persi):
                prima_n = len(b.salvati())
                b.menu('File', voce); b.attendi(1200)
                s = b.salvati()
                if len(s) != prima_n + 1: b.esito('FAIL', f'{voce}: nessun file scritto', s); return
                byte_list = b.js("(i) => window.__salvati[i].bytes", len(s) - 1)
                b.scarica_salvato(len(s) - 1, os.path.join(CART, 'giro' + est))
                nuovo_senza_salvare(b)
                b.ok(f'[{nome}] dopo "Nuovo" il foglio è vuoto', b.cella(1, 1)['raw'] == '' and len(b.stato_app()['fogli']) == 1, b.stato_app()['fogli'])
                apri_con(b, 'giro' + est, byte_list)
                dopo = istantanea(b)
                st = b.stato_app()
                b.ok(f'[{nome}] il messaggio dopo l\'apertura', 'Aperto' in (st['msg'] or ''), st['msg'])
                confronta(b, nome, prima, dopo, persi)
                b.nota(f'[{nome}] messaggio completo (avvisi su cosa non si conserva)', st['msg'])
                # si torna al documento originale per il formato dopo
                nuovo_senza_salvare(b); costruisci(b)
            prova(b, f'Giro {nome}', f)
    prova(b, 'Giro dei formati', giro_formati)
    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])

# ---- CSV: giro e apertura da file esterno
with Banco(9592, '08b CSV e file esterni') as b:
    b.primo_piano()
    def csv_():
        csv = 'Nome;Importo;Data\r\nAnna;1.234,50;05/03/2026\r\nBruno;99;06/03/2026\r\n"Carla; la grande";12,5;07/03/2026\r\n'.encode('utf-8-sig')
        apri_con(b, 'esterno.csv', list(csv))
        b.ok('un CSV con punto e virgola e virgolette si apre in colonne', b.cella(1, 2)['raw'] == 'Importo' and b.cella(4, 1)['raw'] == 'Carla; la grande', [b.cella(1, 2), b.cella(4, 1)])
        b.ok('i numeri all\'italiana diventano numeri (1.234,50 → 1234,5)', b.cella(2, 2)['v'] == 1234.5 and b.cella(4, 2)['v'] == 12.5, [b.cella(2, 2), b.cella(4, 2)])
        b.nota('la data del CSV resta testo o diventa data?', [b.cella(2, 3), b.testo(2, 3)])
        csv2 = b'Codice,Q\n00123,5\n=1+1,6\n8001234567890123,7\n'
        nuovo_senza_salvare(b); apri_con(b, 'codici.csv', list(csv2))
        b.ok('gli zeri iniziali (00123) restano', b.testo(2, 1) == '00123', b.testo(2, 1))
        b.ok('una formula scritta in un CSV non viene eseguita', b.cella(3, 1)['k'] == 'text', b.cella(3, 1))
        b.ok('un numero di 16 cifre resta intero (testo)', b.testo(4, 1) == '8001234567890123', b.testo(4, 1))
    prova(b, 'CSV', csv_)

    def file_rotto():
        apri_con(b, 'rotto.xlsx', list(b'questo non e un file excel'))
        st = b.stato_app()
        b.ok('un file rotto non rompe il programma: messaggio di errore comprensibile', 'Impossibile' in (st['msg'] or '') or 'non' in (st['msg'] or '').lower(), st['msg'])
        b.ok('e il foglio che c\'era resta com\'è', b.p.poll() is None and b.js("() => !!GR.getDoc()"))
        apri_con(b, 'vuoto.xlsx', [])
        b.nota('file vuoto: messaggio', b.stato_app()['msg'])
        big = bytes(range(256)) * 400
        apri_con(b, 'binario.ods', list(big))
        b.nota('file binario casuale come .ods: messaggio', b.stato_app()['msg'])
        b.ok('il programma è ancora vivo dopo i tre file rotti', b.p.poll() is None)
    prova(b, 'File rotti', file_rotto)
    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])

# ---- molti dati
with Banco(9593, '08c Molti dati') as b:
    b.primo_piano()
    def grande():
        t0 = time.time()
        b.js("""async () => { const d = GR.getDoc(); const ops = []; for (let r = 1; r <= 20000; r++) { ops.push({type:'set', sheet: d.activeSheetName, row: r, col: 1, raw: String((r * 7919) % 10007)}); ops.push({type:'set', sheet: d.activeSheetName, row: r, col: 2, raw: 'voce ' + r}); ops.push({type:'set', sheet: d.activeSheetName, row: r, col: 3, raw: '=A' + r + '*2'}); } await d.client.applyBatch(ops); GR.cellsCache.clear(); GR.updateViewport(); GR.requestUpdate(); }""")
        b.nota('caricamento di 20.000 righe × 3 colonne (60.000 celle, 20.000 formule)', f'{time.time() - t0:.1f} s')
        b.attendi(800)
        b.ok('la griglia mostra le prime righe con i risultati', b.testo(1, 3) == '15838' and b.testo(2, 2) == 'voce 2', [b.testo(1, 3), b.testo(2, 2)])
        # scorrimento fino in fondo
        t0 = time.time()
        b.js("() => { const c = GR.renderRoot.querySelector('.grid-container'); c.scrollTop = 22 * 19980; }"); b.attendi(900)
        tr = b.js("() => Number(GR.renderRoot.querySelectorAll('tbody tr')[3].getAttribute('aria-rowindex')) - 1")
        b.ok('scorrendo alla riga ~19.980 le righe nuove sono disegnate', 19900 < tr < 20001 and b.testo(tr, 2) == f'voce {tr}', [tr, b.testo(tr, 2)])
        nodi = b.js("() => GR.renderRoot.querySelectorAll('td').length")
        b.ok('le celle nel documento restano poche (griglia virtuale)', nodi < 3000, nodi)
        # ordina
        b.js("() => { const c = GR.renderRoot.querySelector('.grid-container'); c.scrollTop = 0; }"); b.attendi(500)
        b.seleziona_os(1, 1, 3, 3) if False else None
        b.js("""() => { const d = GR.getDoc(); d.selection = {anchor:{row:1,col:1},active:{row:20000,col:3},range:{startRow:1,endRow:20000,startCol:1,endCol:3}}; GR.requestUpdate(); }"""); b.attendi(300)
        t0 = time.time()
        b.menu('Dati', 'Ordina intervallo per colonna A -> Z'); b.attendi(500)
        for _ in range(60):
            if b.cella(1, 1)['raw'] == '0': break
            time.sleep(0.5)
        t_ord = time.time() - t0
        b.nota('ordinamento di 20.000 righe', f'{t_ord:.1f} s')
        b.aggiorna()
        b.ok('ordinato: la prima riga è la più piccola e la B segue la A', b.cella(1, 1)['raw'] == '0' and b.cella(1, 2)['raw'].startswith('voce'), [b.cella(1, 1), b.cella(1, 2), b.cella(1, 3)])
        # salvataggio xlsx di tanti dati
        t0 = time.time(); n0 = len(b.salvati())
        print('dialoghi', dialoghi_aperti(b), flush=True); b.os_tasto('Esc'); b.attendi(300)
        b.pg.locator('free-menubar .menu-btn').first.click(); b.attendi(500)
        print('CLIC', b.js("() => { const m = APP.shadowRoot.querySelector('free-menubar').shadowRoot; const e = Array.from(m.querySelectorAll('.dropdown-item')).find(x => /cartella di lavoro \(\.xlsx\)/.test(x.textContent)); if (!e) return 'non trovato'; e.click(); return 'cliccato'; }"), flush=True); b.attendi(350)
        for _ in range(60):
            if len(b.salvati()) > n0: break
            time.sleep(0.5)
        b.nota('salvataggio in .xlsx di 60.000 celle', f'{time.time() - t0:.1f} s, {b.salvati()[-1]["n"] // 1024 if len(b.salvati()) > n0 else "?"} KB')
        b.ok('il salvataggio di 20.000 righe riesce', len(b.salvati()) > n0)
        # Ctrl+Fine
        b.clic_cella_os(2, 1); b.os_tasto('Fine', 'Ctrl'); b.attendi(700)
        b.ok('Ctrl+Fine va all\'ultima riga (20.000)', b.doc()['sel'][0] == 20000, b.doc()['sel'])
        b.os_tasto('A', 'Ctrl'); b.attendi(500)
        t0 = time.time(); b.js("() => 1");
        b.ok('la pagina risponde ancora dopo Seleziona tutto', time.time() - t0 < 2)
    prova(b, 'Molti dati', grande)
    e = b.errori_pagina()
    b.ok('nessun errore nella console durante la sezione', len(e) == 0, e[:3])
