# Installer della suite pmb_office

Un solo file da scaricare per chi vuole pmb_docs, pmb_sheets o tutti e due: finestre in italiano o inglese, due caselle (entrambe spuntate), una sola cartella (`Programmi\pmb_office`, con dentro `pmb_docs` e `pmb_sheets`), una sola richiesta di permessi.

## Come funziona
- Dentro ci sono gli **installer NSIS di sempre** dei due programmi, presi da `RILASCI/pmb_docs/<v>` e `RILASCI/pmb_sheets/<v>`, lanciati in silenzio con `/S /D=<cartella>\<programma>`.
- I programmi restano **separati**: ognuno ha la sua versione, il suo aggiornamento (per pmb_docs il file `.pmbup`) e la sua voce in "App installate" per disinstallarlo. La suite non ha un disinstallatore suo.
- Prima di ogni programma la suite toglie una sua eventuale installazione fatta con l'**MSI** (`msiexec /x`): in silenzio l'installer di Tauri non lo fa e resterebbero due voci. La cartella `data` del programma (impostazioni) non è un file dell'MSI e resta.
- Si installa anche senza finestre: `pmb_office_<versione>_x64-setup.exe /S /D=C:\percorso\pmb_office` (installa tutti e due).

## Come si rilascia
1. Si rilasciano i programmi come sempre (versione, compilazione `--bundles nsis,msi`, per pmb_docs anche `.pmbup` e MSI bilingue) in `RILASCI`.
2. `powershell -ExecutionPolicy Bypass -File suite\crea-suite.ps1` → `RILASCI/pmb_office/<AAAA.M.G>/` con la suite e `CONTENUTO.txt` (versioni e impronte SHA-256).
3. Si pubblica su GitHub con `repo-pubblico\pubblica-release.ps1 -Windows <versione> -Mac <versione>` (unico canale di condivisione dal 2026-11-16; la cartella condivisa di Proton Drive non si usa più).

La versione della suite è la data; i numeri dei programmi dentro si leggono dai loro `tauri.conf.json`. La grafica (icona e due immagini) sta in `suite/media` (vedi `media/LEGGIMI.md`), ricavata dai loghi in `media/logo`.

## Provato (2026-11-14)
Su questo PC, installazione silenziosa in `C:\AI_system\pmb_office`: pmb_sheets prima installato da MSI → tolto e rimesso dall'installer NSIS, una sola voce per programma in "App installate", impostazioni intatte, tutti e due i programmi si avviano; prova fisica `giro_45_inglese` 16/16 sul pmb_sheets installato dalla suite.
Non provato: le finestre della suite cliccate a mano (pagina di benvenuto, caselle, scelta della cartella), un PC senza nessun programma installato.
