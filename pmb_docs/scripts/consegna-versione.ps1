# Consegna una versione finita di pmb_docs: la COPIA da RILASCI/pmb_docs/<versione> nella cartella condivisa pmb_office di Proton Drive (l'originale resta in RILASCI).
# Uso (dalla cartella pmb_docs, quando la versione è finita: compilata, provata, con installer, .pmbup e MSI bilingue in RILASCI):
#   powershell -ExecutionPolicy Bypass -File scripts\consegna-versione.ps1 [-Versione 0.4.3] [-Destinazione <cartella>]
# Copia i file e controlla che ognuno sia identico all'originale (SHA-256); non cancella mai niente in RILASCI. Se un file non coincide, lo segnala e
# lascia la copia parziale dov'è, da rifare. Non sovrascrive una versione già consegnata.
# Risultato: <Destinazione>\pmb_docs\<versione>\...  (la sottocartella pmb_docs tiene separati i programmi della suite, es. pmb_sheets).
param([string]$Versione = '', [string]$Destinazione = (Join-Path $PSScriptRoot '..\..\..\..\..\..\pmb_office'))
$ErrorActionPreference = 'Stop'
$radice = (Get-Location).Path
if (-not $Versione) { $Versione = (Get-Content (Join-Path $radice 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json).version }
if ($Versione -notmatch '^\d{1,6}(\.\d{1,6}){0,3}$') { throw "Versione non valida: $Versione" }
$origine = Join-Path $radice "..\RILASCI\pmb_docs\$Versione"
if (-not (Test-Path $origine)) { throw "Non trovo la versione da consegnare: $origine" }
$origine = (Resolve-Path $origine).Path
if (-not (Test-Path $Destinazione)) { throw "Non trovo la cartella di destinazione: $Destinazione" }
$finale = Join-Path $Destinazione "pmb_docs\$Versione"
if (Test-Path $finale) { throw "Esiste già ${finale}: non sovrascrivo una versione già consegnata." }

# una versione finita ha tutti e tre i file
$attesi = @("pmb_docs_${Versione}_x64-setup.exe", "pmb_docs-aggiornamento-${Versione}.pmbup", "pmb_docs_${Versione}_x64.msi")
$mancanti = $attesi | Where-Object { -not (Test-Path (Join-Path $origine $_)) }
if ($mancanti) { throw "La versione $Versione non è completa, mancano: $($mancanti -join ', ')" }

New-Item -ItemType Directory -Force -Path $finale | Out-Null
$file = Get-ChildItem $origine -File -Recurse
foreach ($f in $file) {
  $rel = $f.FullName.Substring($origine.Length).TrimStart('\')
  $dest = Join-Path $finale $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Copy-Item $f.FullName $dest
}
$diversi = @()
foreach ($f in $file) {
  $rel = $f.FullName.Substring($origine.Length).TrimStart('\')
  $a = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
  $b = (Get-FileHash (Join-Path $finale $rel) -Algorithm SHA256).Hash
  if ($a -ne $b) { $diversi += $rel }
}
if ($diversi) { throw "Copia non identica per: $($diversi -join ', '). Copia parziale in ${finale}: cancellala e rilancia lo script" }

Write-Host "Versione $Versione copiata in $finale ($($file.Count) file, tutti verificati; l'originale resta in RILASCI)"
$file | ForEach-Object { '  {0}  {1:N2} MB' -f $_.Name, ($_.Length / 1MB) }
