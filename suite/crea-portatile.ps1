# pmb_office PORTATILE per un device esterno (AI_PRO): tutto sul device, niente sul PC ospite.
# Costruisce la cartella pmb_office con i due programmi e la "versione fissa" di WebView2 di Microsoft (così non si usa quello del PC):
#   pmb_office\
#     webview2\              WebView2 versione fissa (una sola copia per i due programmi)
#     pmb_docs\pmb_docs.exe  + data\ (impostazioni, file recenti, dati della finestra: si crea al primo avvio)
#     pmb_sheets\pmb_sheets.exe  + data\
#     Avvia-pmb_docs.cmd, Avvia-pmb_sheets.cmd   avvio autolocalizzato (regole dell'ambiente pocket: funziona con qualsiasi lettera e su qualsiasi PC)
#     LEGGIMI.txt, LICENSE.txt
# Con -Device mette anche, nella radice del device, Avvia-pmb_docs.cmd e Avvia-pmb_sheets.cmd che richiamano quelli della cartella
# (come Avvia-Firefox.cmd), e il controllo dei programmi sta in Controllo-PC-nuovo.cmd del device.
# I programmi riconoscono la cartella webview2 e passano da soli in modalità portatile (src-tauri/src/lib.rs, «Modalità portatile»).
# Uso:
#   powershell -ExecutionPolicy Bypass -File suite\crea-portatile.ps1                        # costruisce in C:\AI_system\build-cache\pmb_office_portatile
#   powershell -ExecutionPolicy Bypass -File suite\crea-portatile.ps1 -Device F:\Program_Portable   # e la copia sul device
# Sul device la copia sostituisce i programmi e WebView2 ma NON tocca le cartelle data (i dati dell'utente restano).
# Il pacchetto (circa 700 MB, quasi tutto WebView2) sta fuori dal vault: non va in git né su Proton.
param([string]$Device = '', [switch]$SenzaCompilare)
$ErrorActionPreference = 'Stop'
$qui = $PSScriptRoot
$radice = (Resolve-Path (Join-Path $qui '..')).Path              # progetti\pmb_office
$uscita = 'C:\AI_system\build-cache\pmb_office_portatile\pmb_office'

# WebView2 versione fissa: scaricata una volta dal sito Microsoft (firma controllata) ed estratta
$WV_VERSIONE = '157.0.4341.60'
$WV_URL = 'https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/9d6605ff-c172-41a1-8116-e1bb02b93a01/Microsoft.WebView2.FixedVersionRuntime.157.0.4341.60.x64.cab'
$wvCartella = 'C:\AI_system\build-cache\webview2-fissa'
$wvEstratto = Join-Path $wvCartella "estratto\Microsoft.WebView2.FixedVersionRuntime.$WV_VERSIONE.x64"
if (-not (Test-Path (Join-Path $wvEstratto 'msedgewebview2.exe'))) {
  New-Item -ItemType Directory -Force $wvCartella | Out-Null
  $cab = Join-Path $wvCartella "Microsoft.WebView2.FixedVersionRuntime.$WV_VERSIONE.x64.cab"
  if (-not (Test-Path $cab)) { $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest $WV_URL -OutFile $cab -UseBasicParsing }
  $firma = Get-AuthenticodeSignature $cab
  if ($firma.Status -ne 'Valid' -or $firma.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw "Il file di WebView2 non ha una firma Microsoft valida: $($firma.Status)" }
  New-Item -ItemType Directory -Force (Join-Path $wvCartella 'estratto') | Out-Null
  expand.exe $cab -F:* (Join-Path $wvCartella 'estratto') | Out-Null
}
if ((Get-AuthenticodeSignature (Join-Path $wvEstratto 'msedgewebview2.exe')).Status -ne 'Valid') { throw 'msedgewebview2.exe non ha una firma valida' }

# i due programmi (solo l'eseguibile: dentro c'è già tutto)
$env:PATH = 'C:\AI_system\rust\cargo\bin;' + $env:PATH
$env:CARGO_HOME = 'C:\AI_system\rust\cargo'; $env:RUSTUP_HOME = 'C:\AI_system\rust\rustup'
$programmi = @(
  @{ n = 'pmb_docs'; d = Join-Path $radice 'pmb_docs'; exe = 'pmb-docs-shell.exe' },
  @{ n = 'pmb_sheets'; d = Join-Path $radice 'pmb_sheets\pmb_sheets'; exe = 'pmb-sheets-shell.exe' })
foreach ($p in $programmi) {
  $cache = "C:\AI_system\build-cache\$($p.n)"
  $compilato = "$cache\target\release\$($p.exe)"
  if (-not $SenzaCompilare) {
    $env:CARGO_TARGET_DIR = "$cache\target"
    $nm = Join-Path $p.d 'node_modules'; $creato = $false
    if (-not (Test-Path $nm)) { New-Item -ItemType Junction -Path $nm -Target "$cache\node_modules" | Out-Null; $creato = $true }
    try {
      Push-Location $p.d
      $inizio = Get-Date
      $ErrorActionPreference = 'Continue'
      cmd /c "npx tauri build --no-bundle 2>&1" | Select-Object -Last 1
      $ErrorActionPreference = 'Stop'
      if ((Get-Item $compilato).LastWriteTime -lt $inizio) { throw "$($p.n): l'eseguibile non è stato compilato ora" }
    } finally {
      Pop-Location
      if ($creato) { cmd /c rmdir "$nm" | Out-Null }
      if (Test-Path (Join-Path $p.d 'dist')) { Remove-Item (Join-Path $p.d 'dist') -Recurse -Force }
    }
  }
  $p.versione = (Get-Content (Join-Path $p.d 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json).version
  $p.compilato = $compilato
}

# la cartella pmb_office (si rifà da zero ogni volta)
if (Test-Path $uscita) { Remove-Item $uscita -Recurse -Force }
New-Item -ItemType Directory -Force $uscita | Out-Null
robocopy $wvEstratto (Join-Path $uscita 'webview2') /E /NFL /NDL /NJH /NJS /NP | Out-Null
foreach ($p in $programmi) {
  New-Item -ItemType Directory -Force (Join-Path $uscita $p.n) | Out-Null
  Copy-Item $p.compilato (Join-Path $uscita "$($p.n)\$($p.n).exe")
}
Copy-Item (Join-Path $radice 'repo-github\LICENSE') (Join-Path $uscita 'LICENSE.txt')
$vDocs = $programmi[0].versione; $vSheets = $programmi[1].versione
@"
pmb_office portatile - pmb_docs $vDocs, pmb_sheets $vSheets
==============================================================

Per un device esterno (per esempio AI_PRO): tutto resta sul device, niente si installa o si scrive nel PC ospite.

Avvio:   Avvia-pmb_docs.cmd   oppure   Avvia-pmb_sheets.cmd   (anche dalla radice del device; doppio clic, nessuna installazione,
         nessun permesso di amministratore). Funziona con qualsiasi lettera di unita' e su qualsiasi PC con Windows.

Che cosa c'è:
  webview2\     il motore che disegna le finestre (Microsoft Edge WebView2 $WV_VERSIONE, "versione fissa"),
                usato al posto di quello del PC: i programmi non dipendono da che cosa è installato sul PC ospite
  pmb_docs\     documenti di testo; i dati (impostazioni, file recenti, copie di emergenza) in pmb_docs\data
  pmb_sheets\   fogli di calcolo; i dati in pmb_sheets\data

Aggiornare: si sostituiscono gli eseguibili e la cartella webview2 con quelli della versione nuova, lasciando le cartelle data.
Non spostare un programma fuori da questa cartella: senza webview2 accanto torna a usare il WebView2 del PC.

Serve un PC con Windows 10 o 11 a 64 bit (il sistema operativo e i caratteri li dà il PC).
Il controllo ortografico di pmb_docs usa i dizionari di Windows del PC ospite.

Licenze: pmb_docs e pmb_sheets sono software libero (GNU GPL v3, LICENSE.txt; nome e logo PMB riservati).
WebView2 Runtime è di Microsoft, distribuito come previsto dalle sue condizioni per la "versione fissa".
Licenze di terze parti: nei programmi, menu Informazioni > Licenze di terze parti.

---

pmb_office portable - pmb_docs $vDocs, pmb_sheets $vSheets
For an external device: everything stays on the device, nothing is installed on or written to the host PC.
Start: pmb_docs\pmb_docs.exe or pmb_sheets\pmb_sheets.exe (double click, no installation, no administrator rights).
webview2\ is Microsoft Edge WebView2 $WV_VERSIONE (fixed version), used instead of the host's. Data stays in each program's data folder.
To update, replace the executables and the webview2 folder, keeping the data folders. Requires Windows 10 or 11, 64-bit.
"@ | Set-Content -Path (Join-Path $uscita 'LEGGIMI.txt') -Encoding UTF8

# avvio autolocalizzato dentro la cartella (come Program_Portable\Firefox\Avvia-Firefox.cmd): nessuna lettera fissa, nulla sul PC ospite
foreach ($p in $programmi) {
  $testo = @"
@echo off
REM Avvio portatile di $($p.n) (pmb_office, versione pocket). Si autolocalizza (%~dp0): funziona da qualsiasi lettera,
REM su qualsiasi PC, senza installazione. WebView2 e dati restano sul device (cartelle webview2 e $($p.n)\data).
REM Esempio:  Avvia-$($p.n).cmd "documento da aprire"
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
start "" "%ROOT%\$($p.n)\$($p.n).exe" %*
endlocal
"@
  [IO.File]::WriteAllText((Join-Path $uscita "Avvia-$($p.n).cmd"), ($testo -replace "`r?`n", "`r`n"), [Text.Encoding]::ASCII)
}
$mb = (Get-ChildItem $uscita -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("Pronto: $uscita ({0:N0} MB) - pmb_docs $vDocs, pmb_sheets $vSheets, WebView2 $WV_VERSIONE" -f $mb)

if ($Device) {
  if (-not (Test-Path $Device)) { throw "Non trovo $Device (il device è collegato?)" }
  $dest = Join-Path $Device 'pmb_office'
  # /MIR tiene la copia identica, ma le cartelle data (i dati dell'utente) non si toccano
  robocopy $uscita $dest /MIR /XD (Join-Path $dest 'pmb_docs\data') (Join-Path $dest 'pmb_sheets\data') /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Copia sul device non riuscita (robocopy $LASTEXITCODE)" }
  foreach ($p in $programmi) {
    $a = (Get-FileHash $p.compilato).Hash; $b = (Get-FileHash (Join-Path $dest "$($p.n)\$($p.n).exe")).Hash
    if ($a -ne $b) { throw "Sul device $($p.n).exe non coincide con quello compilato" }
  }
  Write-Host "Copiato e verificato in $dest (cartelle data lasciate com'erano)"
  # punti d'ingresso nella radice del device (come Avvia-Firefox.cmd): richiamano il launcher dentro Program_Portable\pmb_office
  $radiceDevice = Split-Path (Resolve-Path $Device).Path -Parent
  if ((Split-Path $Device -Leaf) -eq 'Program_Portable' -and $radiceDevice) {
    foreach ($p in $programmi) {
      $testo = "@echo off`r`nREM Punto d'ingresso di $($p.n) (pmb_office): richiama il launcher dentro Program_Portable\pmb_office\ (autolocalizzato).`r`nset `"ROOT=%~dp0`"`r`ncall `"%ROOT%Program_Portable\pmb_office\Avvia-$($p.n).cmd`" %*`r`n"
      [IO.File]::WriteAllText((Join-Path $radiceDevice "Avvia-$($p.n).cmd"), $testo, [Text.Encoding]::ASCII)
    }
    Write-Host "Punti d'ingresso nella radice del device: Avvia-pmb_docs.cmd, Avvia-pmb_sheets.cmd"
  }
}
