"""54 Formattazioni condizionali di Excel aperte nel programma installato (0.2.15): scadenze «questo mese» e «mese prossimo» (timePeriod)
su due colonne, «tra $C$2 e $E$2» (confronto con altre celle), regola con formula su due colonne. Il file .xlsx si costruisce qui come lo
scrive Excel (stesse regole e formule), così la prova non dipende da file di altri. Prima nessuna di queste regole si importava."""
import sys, os, io, zipfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from giro_lib import *

def xlsx_con_regole():
    foglio = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="2"><c r="C2"><v>10</v></c><c r="E2"><v>20</v></c></row>
<row r="5"><c r="C5"><v>15</v></c></row><row r="6"><c r="C6"><v>25</v></c></row>
<row r="10"><c r="B10" t="inlineStr"><is><t>pieno</t></is></c><c r="J10"><f>TODAY()</f></c><c r="O10"><f>EDATE(TODAY(),1)</f></c></row>
<row r="11"><c r="J11"><f>EDATE(TODAY(),1)</f></c><c r="O11"><f>TODAY()</f></c></row>
</sheetData>
<conditionalFormatting sqref="O10:O20 J10:J20">
<cfRule type="timePeriod" dxfId="0" priority="1" timePeriod="thisMonth"><formula>AND(MONTH(J10)=MONTH(TODAY()),YEAR(J10)=YEAR(TODAY()))</formula></cfRule>
<cfRule type="timePeriod" dxfId="1" priority="2" timePeriod="nextMonth"><formula>AND(MONTH(J10)=MONTH(EDATE(TODAY(),0+1)),YEAR(J10)=YEAR(EDATE(TODAY(),0+1)))</formula></cfRule>
</conditionalFormatting>
<conditionalFormatting sqref="C5:C20"><cfRule type="cellIs" dxfId="0" priority="3" operator="between"><formula>$C$2</formula><formula>$E$2</formula></cfRule></conditionalFormatting>
<conditionalFormatting sqref="L10:L20 B10:B20"><cfRule type="expression" dxfId="1" priority="4"><formula>LEN(TRIM(B10))=0</formula></cfRule></conditionalFormatting>
</worksheet>"""
    stili = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf/></cellXfs>
<dxfs count="2"><dxf><fill><patternFill><bgColor rgb="FFFF0000"/></patternFill></fill></dxf><dxf><fill><patternFill><bgColor rgb="FF0000FF"/></patternFill></fill></dxf></dxfs>
</styleSheet>"""
    parti = {
        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Foglio1" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml': foglio, 'xl/styles.xml': stili,
    }
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, t in parti.items(): z.writestr(n, t)
    return buf.getvalue()

with Banco(9654, '54 Formattazioni condizionali di Excel (scadenze, confronti con celle, più colonne)') as b:
    b.primo_piano()
    b.js("(x) => { window.__aprire = {nome: 'scadenze.xlsx', bytes: x}; }", list(xlsx_con_regole()))
    b.menu('File', 'Apri...'); b.attendi(2500)
    sfondo = lambda r, c: b.js("([r,c]) => { const t = GR.renderRoot.querySelector(`td[data-row=\"${r}\"][data-col=\"${c}\"]`); return t ? getComputedStyle(t).backgroundColor.replace(/ /g, '') : null; }", [r, c])
    ROSSO, BLU = 'rgb(255,0,0)', 'rgb(0,0,255)'
    def regole():
        avvisi = b.js("() => document.body.innerText")
        b.ok('nessun avviso di formattazioni condizionali non importate', 'formattazion' not in avvisi.lower() or 'non sono state importate' not in avvisi, '')
        b.ok('J10 (oggi) rossa: scadenza questo mese', sfondo(10, 10) == ROSSO, sfondo(10, 10))
        b.ok('J11 (tra un mese) blu: scadenza mese prossimo', sfondo(11, 10) == BLU, sfondo(11, 10))
        b.ok('O11 (oggi) rossa: la regola guarda la colonna O, non la J', sfondo(11, 15) == ROSSO, sfondo(11, 15))
        b.ok('O10 (tra un mese) blu', sfondo(10, 15) == BLU, sfondo(10, 15))
        b.ok('C5 (15, tra 10 e 20) rossa; C6 (25) no', sfondo(5, 3) == ROSSO and sfondo(6, 3) != ROSSO, [sfondo(5, 3), sfondo(6, 3)])
        b.ok('regola «vuota» su B e L: L10 (vuota) blu, B10 (piena) no', sfondo(10, 12) == BLU and sfondo(10, 2) != BLU, [sfondo(10, 12), sfondo(10, 2)])
        b.imposta(2, 5, '30'); b.aggiorna(); b.attendi(400)
        b.ok('cambiando E2 a 30 anche C6 (25) diventa rossa', sfondo(6, 3) == ROSSO, sfondo(6, 3))
    prova(b, 'regole di Excel importate e disegnate', regole)
    b.ok('nessun errore nella pagina', len(b.errori_pagina()) == 0, b.errori_pagina()[:3])
