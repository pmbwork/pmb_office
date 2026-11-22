# Costruisce l'installer della suite pmb_office (pmb_docs + pmb_sheets, con le due caselle) a partire dagli installer NSIS già in RILASCI.
# Uso (da qualsiasi cartella), dopo aver rilasciato le versioni dei due programmi in RILASCI\pmb_docs\<v> e RILASCI\pmb_sheets\<v>:
#   powershell -ExecutionPolicy Bypass -File suite\crea-suite.ps1                 # costruisce in RILASCI\pmb_office\<data>
# Le versioni dei programmi si leggono dai loro tauri.conf.json; la versione della suite è la data (AAAA.M.G).
# Icona e immagini: suite\media (vedi suite\media\LEGGIMI.md); senza il logo della suite si usa l'icona di pmb_docs.
param([string]$Versione = '')
$ErrorActionPreference = 'Stop'
$qui = $PSScriptRoot
$radice = (Resolve-Path (Join-Path $qui '..')).Path              # progetti\pmb_office
$rilasci = Join-Path $radice 'RILASCI'

function VersioneDi($conf) { (Get-Content $conf -Raw | ConvertFrom-Json).version }
$vDocs = VersioneDi (Join-Path $radice 'pmb_docs\src-tauri\tauri.conf.json')
$vSheets = VersioneDi (Join-Path $radice 'pmb_sheets\pmb_sheets\src-tauri\tauri.conf.json')
$setupDocs = Join-Path $rilasci "pmb_docs\$vDocs\pmb_docs_${vDocs}_x64-setup.exe"
$setupSheets = Join-Path $rilasci "pmb_sheets\$vSheets\pmb_sheets_${vSheets}_x64-setup.exe"
foreach ($f in $setupDocs, $setupSheets) { if (-not (Test-Path $f)) { throw "Manca l'installer $f : prima si rilascia quella versione del programma" } }

$oggi = Get-Date
if (-not $Versione) { $Versione = '{0}.{1}.{2}' -f $oggi.Year, $oggi.Month, $oggi.Day }
# A.B.C (la data) oppure A.B.C.D per un secondo rilascio nello stesso giorno (2026.11.14.2)
if ($Versione -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') { throw "Versione non valida: $Versione (serve A.B.C o A.B.C.D)" }
$numerica = if ($Versione -match '^\d+\.\d+\.\d+$') { "$Versione.0" } else { $Versione }

$media = Join-Path $qui 'media'
$icona = Join-Path $media 'pmb_office.ico'
if (-not (Test-Path $icona)) { $icona = Join-Path $radice 'pmb_docs\src-tauri\icons\icon.ico'; Write-Host "(logo della suite non ancora in suite\media: uso l'icona di pmb_docs)" }
$makensis = Join-Path $env:LOCALAPPDATA 'tauri\NSIS\makensis.exe'
if (-not (Test-Path $makensis)) { throw "Non trovo makensis.exe in $makensis (si installa con la prima compilazione Tauri)" }

# i testi delle licenze da accettare prima di installare (licenza di pmb_office e componenti di terze parti dei due programmi)
$testi = Join-Path ([System.IO.Path]::GetTempPath()) "pmb_office-suite-licenze-$PID"
& node (Join-Path $qui 'genera-testi-licenze.mjs') $testi
if ($LASTEXITCODE -ne 0) { throw 'genera-testi-licenze.mjs non ha preparato i testi delle licenze' }
$licenza = Join-Path $testi 'licenza-pmb_office.txt'
$licenzeTerzi = Join-Path $testi 'licenze-terze-parti.txt'

$cartella = Join-Path $rilasci "pmb_office\$Versione"
New-Item -ItemType Directory -Force -Path $cartella | Out-Null
$uscita = Join-Path $cartella "pmb_office_${Versione}_x64-setup.exe"
$argomenti = @('/V2', '/INPUTCHARSET', 'UTF8',
  "/DVERSIONE_SUITE=$Versione", "/DVERSIONE_SUITE_NUMERICA=$numerica", "/DVERSIONE_DOCS=$vDocs", "/DVERSIONE_SHEETS=$vSheets",
  "/DSETUP_DOCS=$setupDocs", "/DSETUP_SHEETS=$setupSheets", "/DICONA=$icona", "/DUSCITA=$uscita", "/DLICENZA=$licenza", "/DLICENZE_TERZI=$licenzeTerzi")
$laterale = Join-Path $media 'laterale.bmp'; if (Test-Path $laterale) { $argomenti += "/DIMMAGINE_LATERALE=$laterale" }
$testata = Join-Path $media 'testata.bmp'; if (Test-Path $testata) { $argomenti += "/DIMMAGINE_TESTATA=$testata" }
$argomenti += (Join-Path $qui 'pmb_office-suite.nsi')
& $makensis @argomenti
$esito = $LASTEXITCODE
Remove-Item -Recurse -Force $testi -ErrorAction SilentlyContinue
if ($esito -ne 0 -or -not (Test-Path $uscita)) { throw 'makensis non ha creato la suite' }

# che cosa c'è dentro, con le impronte: serve a chi scarica e a chi controlla
$righe = @("pmb_office $Versione ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))", '',
  "pmb_docs   $vDocs   $(Split-Path $setupDocs -Leaf)   SHA-256 $((Get-FileHash $setupDocs -Algorithm SHA256).Hash)",
  "pmb_sheets $vSheets   $(Split-Path $setupSheets -Leaf)   SHA-256 $((Get-FileHash $setupSheets -Algorithm SHA256).Hash)", '',
  "$(Split-Path $uscita -Leaf)   SHA-256 $((Get-FileHash $uscita -Algorithm SHA256).Hash)")
Set-Content -Path (Join-Path $cartella 'CONTENUTO.txt') -Value $righe -Encoding utf8
Write-Host ("Suite: {0} ({1:N2} MB) con pmb_docs {2} e pmb_sheets {3}" -f $uscita, ((Get-Item $uscita).Length / 1MB), $vDocs, $vSheets)
# Si pubblica su GitHub con repo-pubblico\pubblica-release.ps1 (unico canale dal 2026-11-16: la cartella condivisa non si usa più).
