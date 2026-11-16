# AUDIT DI CONFORMITÀ LEGALE E STANZA PULITA — pmb_office

Data dell'audit: 2026-11-02
Oggetto: Verifica conformità delle licenze software, font, icone e assenza di codice/marchi proprietari terzi nella suite **pmb_office** (`pmb_sheets`, `pmb_docs`, `comune`).

---

## 1. Principi di Sviluppo in Stanza Pulita (Cleanroom)
- **Codice sorgente**: Scritto interamente da zero in TypeScript, Rust e Lit, senza alcuna decompilazione, reverse engineering né inclusione di file proprietari.
- **Marchi registrati**: La suite utilizza l'identità autonoma `pmb_office` (`pmb_sheets` e `pmb_docs`). Nessun riferimento a marchi registrati o denominazioni commerciali terze (es. Google Docs™, Google Sheets™, Microsoft Word™, Microsoft Excel™) è utilizzato in modo improprio o suggestivo.
- **Formati di file**: I parser e writer (.docx, .xlsx, .odt, .ods, .csv, .pdf) sono implementati rigorosamente secondo le specifiche e standard pubblici aperti:
  - ISO/IEC 29500 / ECMA-376 (Office Open XML - WordprocessingML e SpreadsheetML)
  - ISO/IEC 26300 (OpenDocument Format OASIS)
  - RFC 4180 (Comma-Separated Values)
  - ISO 32000-1 (Portable Document Format 1.4 vettoriale)

---

## 2. Inventario Risorse e Licenze

| Risorsa / Componente | Tipologia | Licenza Applicata | Conformità Verificata | Note |
|---|---|---|:---:|---|
| **Inter** | Famiglia di Font | SIL Open Font License 1.1 (OFL) | **CONFORME** | Font primario UI |
| **Roboto** | Famiglia di Font | Apache License, Version 2.0 | **CONFORME** | Font secondario/corpo |
| **Material Symbols** | Icone vettoriali SVG | Apache License, Version 2.0 | **CONFORME** | Inlined come SVG puro CSP-safe |
| **Lit 3** | Libreria Web Components | BSD 3-Clause License | **CONFORME** | Runtime dichiarativo |
| **Tauri 2** | Shell nativa desktop | MIT License / Apache 2.0 | **CONFORME** | Wrapper nativo WebView2 |
| **Rust Crates** (serde, serde_json) | Serializzazione | MIT License / Apache 2.0 | **CONFORME** | Dipendenze stabili |
| **Rust Crate `windows`** (Microsoft) | Accesso alle API di Windows (correttore ortografico) | MIT License / Apache 2.0 | **CONFORME** | Già presente come dipendenza indiretta di Tauri; dal 2026-11-04 dichiarata anche in modo diretto (`Win32_Globalization`, `Win32_System_Com`) |
| **Correttore ortografico di Windows** | API di sistema (Spell Checking API) | Parte di Windows | **CONFORME** | Nessun dizionario di terzi è incluso o copiato nel programma (non si usano i dizionari Hunspell di Adobe o Chrome presenti sul PC): usa quelli già installati dall'utente in Windows |

---

## 3. Conformità di Sicurezza e Riservatezza Locale (Zero Cloud Leakage)
1. **Ambiente 100% Offline**: Nessuna telemetria, nessun tracciamento di rete, nessuna richiesta verso API esterne.
2. **Politica CSP Rigorosa**: Zero script o stili inline non approvati.
3. **Persistenza e Cifratura**: Tutti i salvataggi, WAL e snapshot risiedono esclusivamente nel filesystem locale del dispositivo, con supporto per cifratura AES-256-GCM.
