# Installatore comune di pmb_office

pmb_docs e pmb_sheets fanno parte della suite pmb_office: le finestre di installazione e di disinstallazione devono essere uguali.
Per questo usano gli stessi file (indicati nei loro `src-tauri/tauri.conf.json`):

| File | Che cosa fa |
|---|---|
| `installer.nsi` | modello dell'installer NSIS (quello di Tauri) con la cartella `Programmi\pmb_office\<programma>` |
| `wix/main.wxs`, `wix/it-IT.wxl`, `wix/en-US.wxl` | modello dell'MSI e i suoi testi in italiano e in inglese |
| `../../suite/media/laterale.bmp`, `testata.bmp` | immagini della suite (laterale nelle pagine di benvenuto e fine, testata nelle altre e nella disinstallazione) |
| `../scripts/crea-msi-bilingue.ps1` | unisce i due MSI (italiano e inglese) in uno solo |

Ogni programma tiene la sua icona e i suoi ganci (`src-tauri/nsis/hooks.nsh`): pmb_docs aggiunge le voci «Apri con» per .docx .odt .txt .md.
Alla disinstallazione tutti e due tolgono la cartella `pmb_office` se resta vuota.
