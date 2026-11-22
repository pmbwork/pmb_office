"""Prova fisica delle funzioni di Excel aggiunte nella 0.2.10, nel pmb_sheets installato: formule scritte in italiano con la tastiera vera
(nomi di Excel in italiano: DISTRIB.BINOM.N, TESTO.PRECEDENTE, AMMORT…), risultati come in Excel (gli stessi numeri di
tests/file-prova/excel-oracolo), vecchi nomi di Excel 2007, e i nomi giusti dentro i file: _xlfn. nel .xlsx (senza, Excel dà #NOME?) e
COM.MICROSOFT. / LEGACY. nel .ods (senza, LibreOffice dà #NAME?). Uso: python giro_48_funzioni_excel.py"""
import sys, os, io, re, zipfile, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

# formula scritta in italiano → risultato di Excel installato (2026-11-20)
FORMULE = [
    ('=DISTRIB.BINOM.N(3;10;0,3;VERO)', 0.6496107184),
    ('=DISTRIB.BINOM(3;10;0,3;VERO)', 0.6496107184),            # vecchio nome di Excel 2007
    ('=DISTRIB.CHI.QUAD.DS(18,307;10)', 0.05000058909139811),
    ('=DISTRIB.CHI(18,307;10)', 0.05000058909139811),           # vecchio nome: stesso risultato della riga sopra
    ('=INV.CHI.QUAD(0,05;10)', 3.9402991361190596),
    ('=DISTRIBF(1,5;3;7;VERO)', 0.7041910807035623),
    ('=DISTRIB.GAMMA.N(10,00001131;9;2;VERO)', 0.06809400386978734),
    ('=TESTO.PRECEDENTE("Mario Rossi, via Roma 1";",")', 'Mario Rossi'),
    ('=TESTO.SUCCESSIVO("a-b-c-d";"-";-1)', 'd'),
    ('=AMMORT(1000;100;5;1)', 400),                             # in Excel AMMORT è DDB
    ('=AMMORT.VAR(2400;300;10;3,5;7,25)', 624.6236160000001),
    ('=SE.NON.DISP.(CONFRONTA(9;A1:A2;0);"no")', 'no'),
    ('=FUNZ.ERRORE(0,745)', 0.7079289200957377),
    ('=VALUTA.DEC(1,02;16)', 1.125),
    ('=COMP.SOMMA("3+4i";"1-2i")', '4+2i'),               # numeri complessi (0.2.11)
    ('=BESSEL.J(1,5;1)', 0.5579365079100996),
    ('=CODIFICA.URL("a b")', 'a%20b'),
    ('=VAL.RIF(A1)', True),
]

with Banco(9648, '48 Funzioni di Excel in più') as b:
    b.primo_piano()

    def scritte():
        for i, (f, atteso) in enumerate(FORMULE, start=1):
            b.scrivi_os(i, 1, f)
        b.aggiorna()
        for i, (f, atteso) in enumerate(FORMULE, start=1):
            c = b.cella(i, 1)
            if isinstance(atteso, str): ok = c['v'] == atteso
            else: ok = isinstance(c['v'], (int, float)) and abs(c['v'] - atteso) <= 1e-9 * max(1, abs(atteso))
            b.ok(f'{f} → {atteso}', ok, c)
        a, v = b.cella(3, 1), b.cella(4, 1)
        b.ok('il vecchio DISTRIB.CHI dà lo stesso numero di DISTRIB.CHI.QUAD.DS', isinstance(a['v'], float) and a['v'] == v['v'], [a, v])
        b.clic_cella_os(10, 1); b.attendi(300)
        mostrata = b.js("() => GR.renderRoot.querySelector('.formula-input').value")
        b.ok('la barra della formula mostra il nome italiano di Excel (AMMORT, cioè DDB)', mostrata == '=AMMORT(1000;100;5;1)', mostrata)
        b.ok('dentro, la formula è salvata col nome inglese DDB', b.cella(10, 1)['raw'] == '=DDB(1000,100,5,1)', b.cella(10, 1))
    prova(b, 'Formule scritte in italiano', scritte)

    def file_salvati():
        for voce, est in [('Scarica come cartella di lavoro (.xlsx)', 'xlsx'), ('Scarica come OpenDocument (.ods)', 'ods')]:
            prima = len(b.salvati())
            b.menu('File', voce); b.attendi(1500)
            s = b.salvati()
            if len(s) != prima + 1: b.esito('FAIL', f'[{est}] nessun file scritto', s); continue
            dati = bytes(b.js("(i) => window.__salvati[i].bytes", len(s) - 1))
            z = zipfile.ZipFile(io.BytesIO(dati))
            if est == 'xlsx':
                xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
                b.ok('[xlsx] BINOM.DIST con _xlfn. (come lo scrive Excel)', '_xlfn.BINOM.DIST(' in xml, re.findall(r'<f>[^<]{0,40}', xml)[:3])
                b.ok('[xlsx] il vecchio BINOMDIST senza prefisso', re.search(r'<f>BINOMDIST\(', xml) is not None, re.findall(r'<f>[^<]{0,30}', xml)[1:2])
                b.ok('[xlsx] TEXTBEFORE e IFNA con _xlfn.', '_xlfn.TEXTBEFORE(' in xml and '_xlfn.IFNA(' in xml)
                b.ok('[xlsx] DDB (AMMORT) e VDB senza prefisso', '<f>DDB(' in xml and '<f>VDB(' in xml)
            else:
                xml = z.read('content.xml').decode('utf-8')
                b.ok('[ods] BINOM.DIST come COM.MICROSOFT.BINOM.DIST', 'COM.MICROSOFT.BINOM.DIST(' in xml)
                b.ok('[ods] il vecchio CHIDIST come LEGACY.CHIDIST', 'LEGACY.CHIDIST(' in xml)
                b.ok('[ods] F.DIST come FDIST dello standard', 'of:=FDIST(' in xml)
                b.ok('[ods] TEXTBEFORE come COM.MICROSOFT.TEXTBEFORE', 'COM.MICROSOFT.TEXTBEFORE(' in xml)
            p = os.path.join(tempfile.gettempdir(), f'giro48.{est}')
            open(p, 'wb').write(dati)
            b.nota(f'[{est}] file salvato per controllo', p)
    prova(b, 'Nomi dentro i file', file_salvati)

    b.ok('nessun errore nella pagina', len(b.errori_pagina()) == 0)
