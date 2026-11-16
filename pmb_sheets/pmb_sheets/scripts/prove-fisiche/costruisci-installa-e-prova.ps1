# Compila pmb_sheets, lo installa e lancia una prova a video (o solo la prova).
#   .\costruisci-installa-e-prova.ps1 -Prova giro_16_immagine.py            # compila + installa + prova
#   .\costruisci-installa-e-prova.ps1 -Prova giro_16_immagine.py -SenzaCompilare   # solo la prova sul programma già installato
# Le cartelle pesanti (node_modules, target di Rust) stanno in C:\AI_system\build-cache\pmb_sheets, non nel vault:
# per compilare si crea un collegamento temporaneo node_modules nella cartella del codice e lo si toglie alla fine (con dist).
param(
  [string]$Prova = 'giro_16_immagine.py',
  [switch]$SenzaCompilare
)
# Niente 'Stop': PowerShell 5.1 trasforma in errore ciò che i programmi scrivono su stderr (anche i semplici messaggi informativi di npx).
$ErrorActionPreference = 'Continue'
$qui = $PSScriptRoot
$codice = (Resolve-Path (Join-Path $qui '..\..')).Path          # la cartella con package.json
$cache = 'C:\AI_system\build-cache\pmb_sheets'
$nm = Join-Path $codice 'node_modules'

if (-not $SenzaCompilare) {
  $creato = $false
  if (-not (Test-Path -LiteralPath $nm)) { New-Item -ItemType Junction -Path $nm -Target "$cache\node_modules" | Out-Null; $creato = $true }
  try {
    Set-Location $codice
    $env:PATH = 'C:\AI_system\rust\cargo\bin;' + $env:PATH
    $env:CARGO_HOME = 'C:\AI_system\rust\cargo'
    $env:RUSTUP_HOME = 'C:\AI_system\rust\rustup'
    $env:CARGO_TARGET_DIR = "$cache\target"
    $inizio = Get-Date
    Write-Output '--- compilazione (npx tauri build)'
    cmd /c "npx tauri build 2>&1" | Select-Object -Last 3
    if ($LASTEXITCODE -ne 0) { throw 'La compilazione è fallita' }
    Write-Output '--- installazione (chiede i permessi di amministratore)'
    $log = 'C:\AI_system\logs\pmb_sheets_install_fase1.log'
    if (Test-Path -LiteralPath $log) { Remove-Item -LiteralPath $log -Force }     # altrimenti si leggerebbe il log di un'installazione vecchia
    # il percorso del file ha uno spazio ("Google Drive"): va messo tra virgolette, altrimenti Start-Process lo spezza
    Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$(Join-Path $qui 'installa.ps1')`""
    if (-not (Test-Path -LiteralPath $log)) { throw 'ARRESTO: l''installazione non è partita (nessun log nuovo): controlla i permessi di amministratore' }
    Select-String -Path $log -Pattern 'exit=' | ForEach-Object { $_.Line }
    # prova che l'installato è di questa compilazione: il file dell'eseguibile non può essere più vecchio dell'inizio della compilazione
    $installato = 'C:\AI_system\pmb_office\pmb_sheets\pmb-sheets-shell.exe'
    if ((Get-Item -LiteralPath $installato).LastWriteTime -lt $inizio) { throw 'ARRESTO: il programma installato è più vecchio della compilazione: l''installazione non è andata a buon fine' }
    Write-Output 'verificato: il programma installato è di questa compilazione'
    Start-Sleep -Seconds 5      # subito dopo l'installazione il mouse può non arrivare alla finestra: la prima prova falliva
  } finally {
    if ($creato) { cmd /c rmdir "$nm" | Out-Null }                 # toglie solo il collegamento, non la cartella vera
    if (Test-Path -LiteralPath (Join-Path $codice 'dist')) { Remove-Item -LiteralPath (Join-Path $codice 'dist') -Recurse -Force }
  }
}

Write-Output "--- prova a video: $Prova (non muovere il mouse e non coprire la finestra)"
$env:PYTHONIOENCODING = 'utf-8'
python (Join-Path $qui $Prova)
Stop-Process -Name 'pmb-sheets-shell' -Force -ErrorAction SilentlyContinue
