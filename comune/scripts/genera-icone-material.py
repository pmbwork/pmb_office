"""Genera comune/src/icone-material.ts dalle icone Material Icons «piene» UFFICIALI di Google (licenza Apache 2.0),
scaricate da github.com/google/material-design-icons (src/<categoria>/<nome>/materialicons/24px.svg) nella cartella indicata.
Non si disegna niente a mano (regola di comune/src/icone.ts): si prende il tracciato del file ufficiale e si toglie solo il riquadro vuoto
di ingombro (<path d="M0 0h24v24H0z" fill="none"/>).
Uso:  python comune/scripts/genera-icone-material.py <cartella-con-i-file-svg> nome1 nome2 ...
"""
import os, re, sys

cartella, nomi = sys.argv[1], sorted(set(sys.argv[2:]))
qui = os.path.dirname(os.path.abspath(__file__))
uscita = os.path.join(qui, '..', 'src', 'icone-material.ts')
righe = [
    '// GENERATO da comune/scripts/genera-icone-material.py: non modificare a mano.',
    '// Icone Material Icons «piene» ufficiali di Google (github.com/google/material-design-icons, cartelle materialicons, licenza Apache 2.0),',
    '// usate per le funzioni dei menu messe nella barra degli strumenti (comune/src/icone-funzioni.ts). Uguali in pmb_docs e pmb_sheets.',
    '',
    'export const ICONE_MATERIAL: Record<string, string> = {',
]
for n in nomi:
    f = os.path.join(cartella, f'{n}_materialicons.svg')
    svg = open(f, encoding='utf-8').read()
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
    corpo = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', svg.strip(), flags=re.S)
    corpo = re.sub(r'<path d="M0 0h24v24H0[zV]0?z?" fill="none"/>|<path d="M0 0h24v24H0z" fill="none"/>|<rect fill="none" height="24" width="24"/>|<g><rect fill="none" height="24" width="24"/></g>', '', corpo)
    corpo = corpo.replace('`', '').strip()
    righe.append(f"  '{n}': `<svg viewBox=\"{vb}\" width=\"18\" height=\"18\" fill=\"currentColor\">{corpo}</svg>`,")
righe.append('};')
open(uscita, 'w', encoding='utf-8', newline='\n').write('\n'.join(righe) + '\n')
print('scritto', os.path.normpath(uscita), len(nomi), 'icone')
