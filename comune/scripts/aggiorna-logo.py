"""Mette in un programma di pmb_office i suoi loghi UFFICIALI (quelli disegnati in <programma>/media/logo), sempre nello stesso modo,
così pmb_docs e pmb_sheets non hanno differenze in nessuna versione (Windows, Mac, pocket).

Uso, dalla cartella pmb_office:   python comune/scripts/aggiorna-logo.py docs     (oppure: sheets)

Che cosa rigenera:
- il file TypeScript con i loghi incorporati (pmb_docs: src/guscio/logo-pmb.ts, pmb_sheets: src/components/logo-pmb.ts):
  LOGO_PMB_<APP> (il quadrato) e LOGO_PMB_<APP>_ORIZZONTALE (il logo orizzontale, nella finestra e in Informazioni).
  Sono gli SVG ufficiali, solo inquadrati sul disegno cambiando il viewBox, incorporati come data: URL (la CSP ammette img-src data:).
- le icone in src-tauri/icons: icon.png (512x512), 128x128.png, 32x32.png e icon.ico (16-256), ottenute riducendo il PNG ufficiale
  512x512 ritagliato sul disegno e centrato. L'icona del Mac (.icns) la ricava da icon.png il workflow build-mac.
Nessun ricalco e nessun cambio di colore: il disegno è quello del file. Serve Pillow (pip install pillow).
"""
import base64
import os
import re
import sys

from PIL import Image

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # pmb_office
PROGRAMMI = {
    'docs': {'nome': 'Docs', 'media': os.path.join(RADICE, 'pmb_docs', 'media', 'logo'), 'progetto': os.path.join(RADICE, 'pmb_docs'), 'ts': os.path.join('src', 'guscio', 'logo-pmb.ts')},
    'sheets': {'nome': 'Sheets', 'media': os.path.join(RADICE, 'pmb_sheets', 'media', 'logo'), 'progetto': os.path.join(RADICE, 'pmb_sheets', 'pmb_sheets'), 'ts': os.path.join('src', 'components', 'logo-pmb.ts')},
}


def riquadro_disegno(png_path):
    """Il quadrato più piccolo, centrato sul disegno, che contiene tutto ciò che non è trasparente (ombra compresa)."""
    im = Image.open(png_path).convert('RGBA')
    x0, y0, x1, y1 = im.getchannel('A').getbbox()
    lato = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return im, (cx - lato / 2, cy - lato / 2, lato)


def svg_inquadrato(svg_path, x, y, lato, altezza=None):
    testo = open(svg_path, encoding='utf-8').read()
    testo, n = re.subn(r'viewBox="[^"]*"', f'viewBox="{x:g} {y:g} {lato:g} {(altezza if altezza is not None else lato):g}"', testo, count=1)
    if n != 1:
        sys.exit(f'viewBox non trovato in {svg_path}')
    testo = re.sub(r'(<svg[^>]*?)\swidth="[^"]*"', r'\1', testo, count=1)
    testo = re.sub(r'(<svg[^>]*?)\sheight="[^"]*"', r'\1', testo, count=1)
    return testo


def data_url_svg(testo):
    return 'data:image/svg+xml;base64,' + base64.b64encode(testo.encode('utf-8')).decode('ascii')


def aggiorna(app):
    p = PROGRAMMI[app]
    nome = p['nome']
    quadrato_svg = os.path.join(p['media'], f'Logo PMB {nome} (512x512).svg')
    quadrato_png = os.path.join(p['media'], f'Logo PMB {nome} (512x512).png')
    orizzontale_svg = os.path.join(p['media'], f'Logo PMB {nome} Orizzontale (1200x400).svg')
    orizzontale_png = os.path.join(p['media'], f'Logo PMB {nome} Orizzontale (1200x400).png')
    for f in (quadrato_svg, quadrato_png, orizzontale_svg, orizzontale_png):
        if not os.path.exists(f):
            sys.exit(f'manca {f}')
    im, (x, y, lato) = riquadro_disegno(quadrato_png)
    # le coordinate del PNG 512x512 coincidono con quelle del viewBox 0 0 512 512 dell'SVG
    quadrato = svg_inquadrato(quadrato_svg, x, y, lato)
    # il logo orizzontale ha ampi margini vuoti: si inquadra sul disegno (con 8 unità di respiro), come il quadrato
    ox0, oy0, ox1, oy1 = Image.open(orizzontale_png).convert('RGBA').getchannel('A').getbbox()
    orizzontale = svg_inquadrato(orizzontale_svg, ox0 - 8, oy0 - 8, ox1 - ox0 + 16, oy1 - oy0 + 16)
    costante = f'LOGO_PMB_{nome.upper()}'
    ts = (
        f"// Il logo di pmb_{app}, incorporato: generato da comune/scripts/aggiorna-logo.py a partire da media/logo (non modificare a mano).\n"
        f"// {costante}: «Logo PMB {nome} (512x512).svg» inquadrato sul disegno.\n"
        f"// {costante}_ORIZZONTALE: «Logo PMB {nome} Orizzontale (1200x400).svg» inquadrato sul disegno (finestra e Informazioni).\n"
        f"export const {costante} = '{data_url_svg(quadrato)}';\n"
        f"export const {costante}_ORIZZONTALE = '{data_url_svg(orizzontale)}';\n"
    )
    destinazione = os.path.join(p['progetto'], p['ts'])
    open(destinazione, 'w', encoding='utf-8', newline='\n').write(ts)

    # icone: ritaglio quadrato centrato sul disegno, poi riduzioni
    icone = os.path.join(p['progetto'], 'src-tauri', 'icons')
    sinistra, alto = round(x), round(y)
    l = round(lato)
    tela = Image.new('RGBA', (l, l), (0, 0, 0, 0))
    tela.paste(im.crop((max(0, sinistra), max(0, alto), min(512, sinistra + l), min(512, alto + l))), (max(0, -sinistra), max(0, -alto)))
    master = tela.resize((512, 512), Image.LANCZOS)
    master.save(os.path.join(icone, 'icon.png'))
    master.resize((128, 128), Image.LANCZOS).save(os.path.join(icone, '128x128.png'))
    master.resize((32, 32), Image.LANCZOS).save(os.path.join(icone, '32x32.png'))
    master.resize((256, 256), Image.LANCZOS).save(os.path.join(icone, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f'pmb_{app}: viewBox quadrato {x:g} {y:g} {lato:g} {lato:g}, orizzontale {ox0 - 8} {oy0 - 8} {ox1 - ox0 + 16} {oy1 - oy0 + 16}')
    print('  scritti:', destinazione, 'e le icone in', icone)


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in PROGRAMMI:
        sys.exit('uso: python comune/scripts/aggiorna-logo.py docs|sheets')
    aggiorna(sys.argv[1])
