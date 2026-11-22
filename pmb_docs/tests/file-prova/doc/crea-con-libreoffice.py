"""Rigenera i file di prova di questa cartella (prova.doc, prova.docx, prova-password.doc) con LibreOffice installato.
Si lancia con il Python di LibreOffice:  "<LibreOffice>/program/python.exe" crea-con-libreoffice.py <cartella di uscita>
LibreOffice si usa solo dall'esterno, come produttore di file di confronto: il lettore dei .doc di pmb_docs non usa il suo codice."""
import subprocess, time, sys, os, tempfile, shutil, base64, struct, zlib
import uno
from com.sun.star.connection import NoConnectException
from com.sun.star.beans import PropertyValue
from com.sun.star.awt import Size

OUT = os.path.abspath(sys.argv[1])
os.makedirs(OUT, exist_ok=True)
SOFFICE = os.path.join(os.path.dirname(sys.executable), 'soffice.exe' if os.name == 'nt' else 'soffice')
PROFILO = tempfile.mkdtemp(prefix='lo_profilo_prova_')
p = subprocess.Popen([SOFFICE, '--headless', '--norestore', '--nologo', '-env:UserInstallation=' + uno.systemPathToFileUrl(PROFILO),
                      '--accept=socket,host=127.0.0.1,port=2085;urp;'])
locale = uno.getComponentContext()
risolutore = locale.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', locale)
for _ in range(60):
    try:
        ctx = risolutore.resolve('uno:socket,host=127.0.0.1,port=2085;urp;StarOffice.ComponentContext'); break
    except NoConnectException:
        time.sleep(1)
smgr = ctx.ServiceManager
desktop = smgr.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)

def prop(n, v):
    x = PropertyValue(); x.Name = n; x.Value = v; return x

doc = desktop.loadComponentFromURL('private:factory/swriter', '_blank', 0, (prop('Hidden', True),))
testo = doc.Text
c = testo.createTextCursor()
PB = uno.getConstantByName('com.sun.star.text.ControlCharacter.PARAGRAPH_BREAK')

def paragrafo(s, stile=None, **proprieta):
    if stile:
        c.ParaStyleName = stile
    for k, v in proprieta.items():
        c.setPropertyValue(k, v)
    testo.insertString(c, s, False)
    testo.insertControlCharacter(c, PB, False)
    c.setPropertyToDefault('ParaAdjust') if 'ParaAdjust' in proprieta else None
    for k in proprieta:
        try: c.setPropertyToDefault(k)
        except Exception: pass
    c.ParaStyleName = 'Standard'

def tratto(s, **proprieta):
    for k, v in proprieta.items():
        c.setPropertyValue(k, v)
    testo.insertString(c, s, False)
    for k in proprieta:
        c.setPropertyToDefault(k)

paragrafo('Titolo del documento', 'Title')
paragrafo('Capitolo uno', 'Heading 1')
tratto('Testo normale, ')
tratto('grassetto', CharWeight=150.0)
tratto(', ')
tratto('corsivo', CharPosture=uno.Enum('com.sun.star.awt.FontSlant', 'ITALIC'))
tratto(', ')
tratto('sottolineato', CharUnderline=1)
tratto(', ')
tratto('barrato', CharStrikeout=1)
tratto(', H')
tratto('2', CharEscapement=-33, CharEscapementHeight=58)
tratto('O e x')
tratto('2', CharEscapement=33, CharEscapementHeight=58)
tratto(', ')
tratto('rosso', CharColor=0xC00000)
tratto(', ')
tratto('Courier 14', CharFontName='Courier New', CharHeight=14.0)
tratto(', ')
tratto('evidenziato', CharBackColor=0xFFFF00)
tratto(' e città àèìòù €.')
testo.insertControlCharacter(c, PB, False)
paragrafo('Paragrafo centrato', ParaAdjust=uno.Enum('com.sun.star.style.ParagraphAdjust', 'CENTER'))
paragrafo('Paragrafo a destra', ParaAdjust=uno.Enum('com.sun.star.style.ParagraphAdjust', 'RIGHT'))
paragrafo('Paragrafo giustificato con abbastanza testo da andare a capo più volte, così si vede la giustificazione su tutte le righe tranne l\'ultima.', ParaAdjust=uno.Enum('com.sun.star.style.ParagraphAdjust', 'BLOCK'))
paragrafo('Paragrafo rientrato', ParaLeftMargin=1270)
paragrafo('Paragrafo con spazio prima e dopo', ParaTopMargin=423, ParaBottomMargin=423)
paragrafo('Sottocapitolo', 'Heading 2')
paragrafo('Sotto-sottocapitolo', 'Heading 3')
# elenchi
for s in ['primo punto', 'secondo punto']:
    c.NumberingStyleName = 'List 1'
    testo.insertString(c, s, False)
    testo.insertControlCharacter(c, PB, False)
for s in ['primo numero', 'secondo numero']:
    c.NumberingStyleName = 'Numbering 123'
    testo.insertString(c, s, False)
    testo.insertControlCharacter(c, PB, False)
c.NumberingStyleName = ''
c.ParaStyleName = 'Standard'
# link
tratto('Ecco ')
testo.insertString(c, 'un link', False)
c.goLeft(7, True)
c.HyperLinkURL = 'https://www.example.com/'
c.collapseToEnd()
c.setPropertyToDefault('HyperLinkURL')
tratto(' nel testo')
testo.insertControlCharacter(c, PB, False)
# nota a piè di pagina
tratto('Frase con una nota')
nota = doc.createInstance('com.sun.star.text.Footnote')
testo.insertTextContent(c, nota, False)
nota.setString('Testo della nota')
tratto('.')
testo.insertControlCharacter(c, PB, False)
# tabella
tabella = doc.createInstance('com.sun.star.text.TextTable')
tabella.initialize(3, 3)
testo.insertTextContent(c, tabella, False)
for r in range(3):
    for col in range(3):
        tabella.getCellByName('ABC'[col] + str(r + 1)).setString(f'R{r + 1}C{col + 1}')
paragrafo('Dopo la tabella')
# interruzione di pagina
c.BreakType = uno.Enum('com.sun.star.style.BreakType', 'PAGE_BEFORE')
paragrafo('Pagina due')
c.BreakType = uno.Enum('com.sun.star.style.BreakType', 'NONE')
# immagine PNG 4x3 rossa
def png(larghezza, altezza):
    righe = b''.join(b'\x00' + b'\xff\x00\x00' * larghezza for _ in range(altezza))
    def blocco(tipo, dati):
        return struct.pack('>I', len(dati)) + tipo + dati + struct.pack('>I', zlib.crc32(tipo + dati) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + blocco(b'IHDR', struct.pack('>IIBBBBB', larghezza, altezza, 8, 2, 0, 0, 0)) + blocco(b'IDAT', zlib.compress(righe)) + blocco(b'IEND', b'')
percorso = os.path.join(PROFILO, 'rosso.png')
open(percorso, 'wb').write(png(40, 30))
im = doc.createInstance('com.sun.star.text.TextGraphicObject')
provider = smgr.createInstanceWithContext('com.sun.star.graphic.GraphicProvider', ctx)
im.Graphic = provider.queryGraphic((prop('URL', uno.systemPathToFileUrl(percorso)),))
im.AnchorType = uno.Enum('com.sun.star.text.TextContentAnchorType', 'AS_CHARACTER')
im.Size = Size(2117, 1588)
tratto('Immagine: ')
testo.insertTextContent(c, im, False)
testo.insertControlCharacter(c, PB, False)
paragrafo('Ultimo paragrafo')

# intestazione e piè di pagina
stile = doc.StyleFamilies.getByName('PageStyles').getByName('Standard')
stile.HeaderIsOn = True
stile.FooterIsOn = True
stile.HeaderText.setString('Intestazione del documento')
piede = stile.FooterText
pc = piede.createTextCursor()
piede.insertString(pc, 'Pagina ', False)
numero = doc.createInstance('com.sun.star.text.TextField.PageNumber')
numero.NumberingType = 4
numero.SubType = uno.Enum('com.sun.star.text.PageNumberType', 'CURRENT')
piede.insertTextContent(pc, numero, False)

def salva(nome, filtro, *altre):
    doc.storeToURL(uno.systemPathToFileUrl(os.path.join(OUT, nome)), (prop('FilterName', filtro), prop('Overwrite', True)) + altre)
salva('prova.doc', 'MS Word 97')
salva('prova.docx', 'MS Word 2007 XML')
salva('prova-password.doc', 'MS Word 97', prop('Password', 'segreta'))
doc.close(True)
try:
    desktop.terminate()
except Exception:
    pass
time.sleep(2); p.kill()
shutil.rmtree(PROFILO, ignore_errors=True)
print('ok')
