# LICENZE TERZE PARTI — pmb_office

Questo documento elenca le risorse esterne a licenza aperta incorporate in locale nel progetto pmb_office, in conformità al punto 1 delle regole inderogabili (nessun codice proprietario, nessun marchio altrui, solo risorse open source verificate).

---

## 1. Caratteri Tipografici (Font)

### Roboto
- **Licenza**: Apache License, Version 2.0
- **Autore**: Google LLC
- **Origine**: Fontsource (`@fontsource/roboto`), repository ufficiale upstream: https://github.com/googlefonts/roboto
- **File inclusi in locale**:
  - `src/assets/fonts/roboto-latin-400-normal.woff2`
  - `src/assets/fonts/roboto-latin-500-normal.woff2`
  - `src/assets/fonts/roboto-latin-700-normal.woff2`
- **Uso nel progetto**: Font principale per l'interfaccia dell'applicazione e per il documento di testo.

### Inter
- **Licenza**: SIL Open Font License (OFL), Version 1.1
- **Autore**: Rasmus Andersson
- **Origine**: Fontsource (`@fontsource/inter`), repository upstream: https://github.com/rsms/inter
- **File inclusi in locale**:
  - `src/assets/fonts/inter-latin-400-normal.woff2`
  - `src/assets/fonts/inter-latin-500-normal.woff2`
  - `src/assets/fonts/inter-latin-700-normal.woff2`
- **Uso nel progetto**: Font alternativo e per elementi numerici/griglia dei fogli di calcolo.

---

## 2. Icone (Material Symbols)

### Material Symbols (Outlined / Linear)
- **Licenza**: Apache License, Version 2.0
- **Autore**: Google LLC
- **Origine**: https://github.com/google/material-design-icons
- **Modalità di inclusione**: Codice vettoriale SVG matematicamente pulito incorporato in locale nei componenti e registri (`src/assets/icons/`), senza richieste di rete o CDN esterni.
- **Icone incluse**:
  - `undo` (Annulla)
  - `redo` (Ripeti)
  - `print` (Stampa)
  - `zoom_in` (Zoom)
  - `format_bold` (Grassetto)
  - `format_italic` (Corsivo)
  - `format_underlined` (Sottolineato)
  - `format_color_text` (Colore testo)
  - `format_align_left` (Allinea a sinistra)
  - `format_align_center` (Allinea al centro)
  - `format_align_right` (Allinea a destra)
  - `format_align_justify` (Giustifica)
  - `format_list_bulleted` (Elenco puntato)
  - `format_list_numbered` (Elenco numerato)
  - `search` (Cerca menu)
  - `close` (Chiudi)
  - `minimize` (Riduci a icona)
  - `maximize` (Ingrandisci)
  - `add` (Nuovo)
  - `table_chart` (Fogli / Griglia)
  - `description` (Documenti)
  - `check_circle` (Stato salvataggio)
  - `folder_open` (Apri)
  - `save` (Salva)
  - `view_sidebar` (Pannello laterale)
  - `dark_mode` / `light_mode` (Tema chiaro/scuro)
