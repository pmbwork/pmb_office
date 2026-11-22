# Installer della suite pmb_office

Un solo file da scaricare per chi vuole pmb_docs, pmb_sheets o tutti e due: finestre in italiano o inglese, due licenze da accettare, le caselle dei programmi e dei collegamenti (tutte spuntate), una sola cartella (`Programmi\pmb_office`, con dentro `pmb_docs` e `pmb_sheets`), una sola richiesta di permessi.

## Le pagine
Lingua → benvenuto → **licenza di pmb_office** (GPL-3.0, file `repo-github/LICENSE`, con una nota in italiano e in inglese) → **componenti di terze parti** (elenco e testi delle licenze dei due programmi, presi dai loro `licenze-terze.ts`) → **scelte**: pmb_docs, pmb_sheets e il gruppo **Collegamenti** (Sul Desktop, Nel menu Start) → cartella → installazione → fine. Le due pagine delle licenze hanno la casella «Accetto»: senza, Avanti resta spento.
I testi delle licenze li prepara `genera-testi-licenze.mjs` (lo lancia `crea-suite.ps1`, in UTF-16 per la pagina di NSIS). La suite per Mac (`mac/crea-suite-mac.sh`) usa gli stessi testi in UTF-8, uno sotto l'altro nella sua unica pagina della licenza (da accettare, come sempre negli installatori del Mac); sul Mac non ci sono collegamenti da scegliere (i programmi vanno in Applicazioni). Non ancora provata su un Mac: si vede al prossimo `build-mac`.
I collegamenti: l'installer di ogni programma, lanciato in silenzio, li crea sempre tutti e due (per tutti gli utenti, con l'identità del programma per la barra delle applicazioni); la suite poi toglie quelli non scelti. Così restano proprio i collegamenti del programma e la sua disinstallazione li toglie; gli aggiornamenti dei programmi (`/UPDATE`) non li ricreano.

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
Non provato: un PC senza nessun programma installato.

## Provato (2026-11-19)
Finestre comandate come una persona (prova `suite/prove/prova_suite.py`, con i permessi di amministratore come la suite), in italiano e in inglese: le due pagine delle licenze con Avanti spento finché non si spunta «Accetto»; le scelte senza Desktop, senza menu Start e con tutti e due → collegamenti in `C:\Users\Public\Desktop` e `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\pmb_office` proprio come scelto (senza menu Start la cartella pmb_office del menu non resta vuota); suite finita con codice 0 e programmi installati ogni volta. Trovato e corretto: la pagina di benvenuto mostrava il testo standard di NSIS invece del nostro (il testo era definito dopo la pagina).
