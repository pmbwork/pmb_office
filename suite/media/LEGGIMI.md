# Grafica dell'installer della suite pmb_office

`crea-suite.ps1` usa questi file se ci sono (stessi nomi esatti). Senza `pmb_office.ico` usa l'icona di pmb_docs; senza le due immagini usa quelle standard di Windows.

| File | Che cos'è | Formato |
|---|---|---|
| `pmb_office.ico` | icona dell'installer (Esplora risorse, barra delle applicazioni, finestra) | ICO con dentro 16, 24, 32, 48, 64, 128 e 256 px |
| `laterale.bmp` | immagine a sinistra nella prima e nell'ultima pagina | BMP 24 bit, 164 × 314 px (328 × 628 per schermi ad alta densità; NSIS la adatta) |
| `testata.bmp` | piccola immagine in alto a destra nelle pagine intermedie | BMP 24 bit, 150 × 57 px |

Il logo sorgente (SVG) resta dove lo tieni per gli altri usi; qui vanno solo i file già convertiti nelle misure sopra.
