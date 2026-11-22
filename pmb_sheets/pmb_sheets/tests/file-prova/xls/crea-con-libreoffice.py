"""Rigenera i file di prova di questa cartella (prova.xls, prova-password.xls, prova.xlsx, risultati-libreoffice.json) con LibreOffice installato.
Si lancia con il Python di LibreOffice:  "<LibreOffice>/program/python.exe" crea-con-libreoffice.py <cartella di uscita>
LibreOffice si usa solo dall'esterno, come produttore di file di confronto: il lettore dei .xls di pmb_sheets non usa il suo codice."""
import subprocess, time, sys, os, tempfile, shutil
import uno
from com.sun.star.connection import NoConnectException
from com.sun.star.beans import PropertyValue
from com.sun.star.table import BorderLine2, CellAddress

OUT = os.path.abspath(sys.argv[1])
os.makedirs(OUT, exist_ok=True)
SOFFICE = os.path.join(os.path.dirname(sys.executable), 'soffice.exe' if os.name == 'nt' else 'soffice')
PROFILO = tempfile.mkdtemp(prefix='lo_profilo_prova_')
p = subprocess.Popen([SOFFICE, '--headless', '--norestore', '--nologo',
                      '-env:UserInstallation=' + uno.systemPathToFileUrl(PROFILO),
                      '--accept=socket,host=127.0.0.1,port=2084;urp;'])
locale = uno.getComponentContext()
risolutore = locale.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', locale)
for _ in range(60):
    try:
        ctx = risolutore.resolve('uno:socket,host=127.0.0.1,port=2084;urp;StarOffice.ComponentContext'); break
    except NoConnectException:
        time.sleep(1)
smgr = ctx.ServiceManager
desktop = smgr.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)

def prop(n, v):
    x = PropertyValue(); x.Name = n; x.Value = v; return x

doc = desktop.loadComponentFromURL('private:factory/scalc', '_blank', 0, (prop('Hidden', True),))
fogli = doc.Sheets
fogli.getByIndex(0).Name = 'Dati'
fogli.insertNewByName('Formule e calcoli', 1)
fogli.insertNewByName('Nascosto', 2)
dati = fogli.getByName('Dati')
form = fogli.getByName('Formule e calcoli')
nasc = fogli.getByName('Nascosto')

formati = doc.NumberFormats
from com.sun.star.lang import Locale
loc = Locale('en', 'US', '')
def formato(codice):
    k = formati.queryKey(codice, loc, False)
    if k == -1:
        k = formati.addNew(codice, loc)
    return k

def c(f, a):
    return f.getCellRangeByName(a)

# valori
c(dati, 'A1').String = 'Testo semplice'
c(dati, 'A2').String = 'Àccenti èé ù € ß 漢字'
c(dati, 'A3').Value = 42
c(dati, 'A4').Value = -3.25
c(dati, 'A5').Value = 1234567.891
c(dati, 'A6').Value = 0.1
c(dati, 'A7').Formula = '=TRUE()'
c(dati, 'A8').String = '00123'
c(dati, 'A9').String = '=non formula'
c(dati, 'A10').Value = 45000; c(dati, 'A10').NumberFormat = formato('DD/MM/YYYY')
c(dati, 'A11').Value = 45000.75; c(dati, 'A11').NumberFormat = formato('DD/MM/YYYY HH:MM')
c(dati, 'A12').Value = 0.125; c(dati, 'A12').NumberFormat = formato('0.00%')
c(dati, 'A13').Value = 1500.5; c(dati, 'A13').NumberFormat = formato('#,##0.00 [$€-410]')
c(dati, 'A14').Value = 7; c(dati, 'A14').NumberFormat = formato('000')
c(dati, 'A15').String = 'Riga lunga ' * 30
c(dati, 'A16').Value = 1e-10
c(dati, 'A17').Value = 123456789012345

# stili
b = c(dati, 'B1'); b.String = 'Grassetto'; b.CharWeight = 150
b = c(dati, 'B2'); b.String = 'Corsivo'; b.CharPosture = uno.Enum('com.sun.star.awt.FontSlant', 'ITALIC')
b = c(dati, 'B3'); b.String = 'Sottolineato'; b.CharUnderline = 1
b = c(dati, 'B4'); b.String = 'Barrato'; b.CharStrikeout = 1
b = c(dati, 'B5'); b.String = 'Carattere'; b.CharFontName = 'Courier New'; b.CharHeight = 14
b = c(dati, 'B6'); b.String = 'Rosso'; b.CharColor = 0xFF0000
b = c(dati, 'B7'); b.String = 'Sfondo giallo'; b.CellBackColor = 0xFFFF00
b = c(dati, 'B8'); b.String = 'Sfondo personalizzato'; b.CellBackColor = 0x12A4B6
linea = BorderLine2(); linea.OuterLineWidth = 26; linea.LineWidth = 26; linea.Color = 0x0000FF; linea.LineStyle = 0
spessa = BorderLine2(); spessa.OuterLineWidth = 88; spessa.LineWidth = 88; spessa.Color = 0x000000; spessa.LineStyle = 0
tratt = BorderLine2(); tratt.OuterLineWidth = 26; tratt.LineWidth = 26; tratt.Color = 0x008000; tratt.LineStyle = 2
b = c(dati, 'B9'); b.String = 'Bordi'; b.TopBorder = linea; b.BottomBorder = spessa; b.LeftBorder = tratt; b.RightBorder = linea
b = c(dati, 'B10'); b.String = 'Destra'; b.HoriJustify = uno.Enum('com.sun.star.table.CellHoriJustify', 'RIGHT')
b = c(dati, 'B11'); b.String = 'Centro'; b.HoriJustify = uno.Enum('com.sun.star.table.CellHoriJustify', 'CENTER'); b.VertJustify = 2
b = c(dati, 'B12'); b.String = 'Testo a capo automatico lungo lungo'; b.IsTextWrapped = True; b.VertJustify = 1
b = c(dati, 'B13'); b.CellBackColor = 0xC0C0C0  # cella vuota con stile

# celle unite, larghezze, altezze, nascoste
c(dati, 'D1').String = 'Unite'; c(dati, 'D1:F2').merge(True)
dati.Columns.getByIndex(0).Width = 5000
dati.Columns.getByIndex(1).Width = 3000
dati.Columns.getByIndex(7).IsVisible = False
dati.Rows.getByIndex(19).Height = 1200
dati.Rows.getByIndex(20).IsVisible = False
c(dati, 'H1').String = 'colonna nascosta'
c(dati, 'A21').String = 'riga nascosta'
dati.TabColor = 0x3366FF

# commento e collegamento
dati.Annotations.insertNew(c(dati, 'A1').CellAddress, 'Un commento\nsu due righe')
cella = c(dati, 'C1')
testo = cella.Text
campo = doc.createInstance('com.sun.star.text.TextField.URL')
campo.URL = 'https://www.example.com/pagina?a=1'
campo.Representation = 'Sito di esempio'
testo.insertTextContent(testo.createTextCursor(), campo, False)

# formule
f = form
valori = [10, 20, 30, 40, 50]
for i, v in enumerate(valori):
    c(f, 'A%d' % (i + 1)).Value = v
    c(f, 'B%d' % (i + 1)).Value = v * 2
    c(f, 'C%d' % (i + 1)).Formula = '=A%d+B%d' % (i + 1, i + 1)   # formula ripetuta (condivisa)
c(f, 'D1').String = 'mela'; c(f, 'D2').String = 'pera'; c(f, 'D3').String = 'uva'
formule = [
    '=SUM(A1:A5)', '=AVERAGE(A1:A5)', '=(A1+A2)*A3', '=A1+A2*A3', '=-A1^2', '=A1%', '=A1&" e "&B1', '="con ""virgolette"""',
    '=IF(A1>5;"alto";"basso")', '=IF(A1<>10;1;IF(A2>=20;2;3))', '=VLOOKUP(20;A1:B5;2;0)', '=INDEX(A1:B5;MATCH(30;A1:A5;0);2)',
    '=CONCATENATE("a";"b";"c")', '=TEXT(A1;"0.00")', '=DATE(2026;11;19)', '=ROUND(PI();4)', '=AND(TRUE();NOT(FALSE()))', '=OR(A1=1;A2=20)',
    '=COUNTIF(A1:A5;">20")', '=SUMIF(A1:A5;">20";B1:B5)', '=IFERROR(1/0;"errore")', '=EOMONTH(DATE(2026;1;15);1)', '=NETWORKDAYS(DATE(2026;1;1);DATE(2026;1;31))',
    '=SUMIFS(B1:B5;A1:A5;">10";A1:A5;"<50")', '=SUM({1;2;3})', '=SUM({1.5\\2\\3})', "=Dati.A3*2", "=SUM($Dati.A3:A5)", '=SUM(A:A)', '=$A$1+A$2+$A3',
    '=1/0', '=NA()', '=ISERROR(A1)', '=LEN(D1)', '=UPPER(D2)&LOWER("X")', '=MAX(A1:A5;B1:B5;100)', '=MIN(A1:A5)', '=COUNT(A1:D5)', '=COUNTA(A1:D5)',
    '=SUMPRODUCT(A1:A5;B1:B5)', '=NOW()-NOW()', '=TODAY()-TODAY()', '=ABS(-5)', '=MOD(10;3)', '=POWER(2;10)', '=SQRT(16)', '=INT(7.8)', '=TRUNC(7.8)',
    '=LEFT(D1;2)&RIGHT(D1;2)&MID(D1;2;2)', '=SUBSTITUTE(D1;"m";"M")', '=TRIM("  a  ")', '=VALUE("12")', '=CHOOSE(2;"a";"b";"c")', '=Prezzo*2', '=SUM(Totali)',
    '=HLOOKUP(10;A1:B5;1;0)', '=NORMDIST(1;0;1;1)', '=STDEV(A1:A5)', '=MEDIAN(A1:A5)', '=RANK(30;A1:A5)', '=PMT(0.05/12;60;10000)', '=A1:A3 A2:A4',
    '=SUM((A1:A2;A4:A5))', '=WEEKDAY(DATE(2026;11;19))', '=YEAR(DATE(2026;11;19))', '=ROUNDUP(2.1;0)', '=ROWS(A1:B5)', '=OFFSET(A1;1;1)', '=INDIRECT("A1")',
]
for i, fx in enumerate(formule):
    c(f, 'F%d' % (i + 1)).Formula = fx
doc.NamedRanges.addNewByName('Prezzo', '$\'Formule e calcoli\'.$A$1', CellAddress(1, 0, 0), 0)
doc.NamedRanges.addNewByName('Totali', '$\'Formule e calcoli\'.$B$1:$B$5', CellAddress(1, 0, 0), 0)
c(nasc, 'A1').String = 'foglio nascosto'
nasc.IsVisible = False

# righe e colonne bloccate sul primo foglio
ctrl = doc.CurrentController
ctrl.setActiveSheet(dati)
ctrl.freezeAtPosition(1, 2)

doc.calculateAll()
import json
risultati = {}
for i, fx in enumerate(formule):
    cella = c(f, 'F%d' % (i + 1))
    risultati['F%d' % (i + 1)] = {'formula': fx, 'valore': cella.Value, 'testo': cella.String, 'errore': cella.getError(), 'tipo': cella.FormulaResultType2}
json.dump(risultati, open(os.path.join(OUT, 'risultati-libreoffice.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

def salva(nome, filtro):
    url = uno.systemPathToFileUrl(os.path.join(OUT, nome))
    doc.storeToURL(url, (prop('FilterName', filtro), prop('Overwrite', True)))
salva('prova.xls', 'MS Excel 97')
salva('prova.xlsx', 'Calc MS Excel 2007 XML')
# lo stesso file protetto con la password «segreta» (per provare la decifratura)
doc.storeToURL(uno.systemPathToFileUrl(os.path.join(OUT, 'prova-password.xls')), (prop('FilterName', 'MS Excel 97'), prop('Overwrite', True), prop('Password', 'segreta')))
doc.close(True)
try:
    desktop.terminate()
except Exception:
    pass
time.sleep(2); p.kill()
shutil.rmtree(PROFILO, ignore_errors=True)
print('ok')
