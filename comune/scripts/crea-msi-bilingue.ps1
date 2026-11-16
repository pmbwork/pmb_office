# Crea UN SOLO installer MSI di un programma di pmb_office (pmb_docs, pmb_sheets) con le finestre di installazione in italiano e in inglese:
# stessa procedura per i due programmi della suite (le finestre devono essere uguali). Il programma si ricava da src-tauri/tauri.conf.json.
# Uso (dalla cartella del programma, quella con src-tauri, dopo `npx tauri build --bundles nsis,msi`, che produce i due MSI it-IT ed en-US):
#   powershell -ExecutionPolicy Bypass -File scripts\crea-msi-bilingue.ps1
# Come funziona: l'MSI italiano Ã¨ la base; la differenza verso quello inglese diventa una "trasformazione di lingua"
# (torch di WiX) incorporata nell'MSI col nome 1033; il modello dell'MSI dichiara le lingue 1040 (italiano) e 1033 (inglese).
# ATTENZIONE: Windows Installer NON sceglie la lingua da solo. Con un doppio clic l'installazione è in italiano; per le finestre in inglese:
#   msiexec /i <programma>_<versione>_x64.msi TRANSFORMS=:1033
# (un setup.exe che sceglie la lingua da solo, come l'installer NSIS, non fa parte di questo pacchetto).
# Il programma installato Ã¨ identico: ha giÃ  dentro l'italiano e l'inglese (si sceglie in Strumenti â€º Preferenze).
# Scrive pmb_office/RILASCI/<programma>/<versione>/<programma>_<versione>_x64.msi e toglie da lÃ¬ i due MSI di una sola lingua.
param([string]$Versione = '', [string]$CartellaMsi = '')
$ErrorActionPreference = 'Stop'
$radice = (Get-Location).Path
$prog = (Get-Content (Join-Path $radice 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json).productName
if ($prog -notmatch '^pmb_\w+$') { throw "Programma non riconosciuto: $prog (lanciare dalla cartella del programma)" }
if (-not $Versione) { $Versione = (Get-Content (Join-Path $radice 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json).version }
if (-not $CartellaMsi) {
  $target = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { "C:\AI_system\build-cache\$prog\target" }
  $CartellaMsi = Join-Path $target 'release\bundle\msi'
}
$it = Join-Path $CartellaMsi "${prog}_${Versione}_x64_it-IT.msi"
$en = Join-Path $CartellaMsi "${prog}_${Versione}_x64_en-US.msi"
foreach ($f in $it, $en) { if (-not (Test-Path $f)) { throw "Non trovo $f (prima: npx tauri build --bundles nsis,msi)" } }
$torch = Join-Path $env:LOCALAPPDATA 'tauri\WixTools314\torch.exe'
if (-not (Test-Path $torch)) { throw "Non trovo torch.exe di WiX in $torch" }

$lavoro = Join-Path $env:TEMP ("$prog-msi-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $lavoro | Out-Null
$uscita = Join-Path $PSScriptRoot "..\..\RILASCI\$prog\$Versione"
New-Item -ItemType Directory -Force -Path $uscita | Out-Null
$finale = Join-Path (Resolve-Path $uscita) "${prog}_${Versione}_x64.msi"

$installer = New-Object -ComObject WindowsInstaller.Installer
# i valori di PowerShell arrivano "incartati" (PSObject): Windows Installer vuole i valori semplici
function Semplici($a) { if ($null -eq $a) { return $null }; ,@($a | ForEach-Object { if ($_ -is [psobject]) { $_.psobject.BaseObject } else { $_ } }) }
function Chiama($o, $m, $a) { $a = Semplici $a; if ($env:MSI_TRACCIA) { Write-Host "  > $m" }; $o.GetType().InvokeMember($m, 'InvokeMethod', $null, $o, $a) }
function Leggi($o, $p, $a) { $a = Semplici $a; $o.GetType().InvokeMember($p, 'GetProperty', $null, $o, $a) }
function Scrivi($o, $p, $a) { $a = Semplici $a; $o.GetType().InvokeMember($p, 'SetProperty', $null, $o, $a) | Out-Null }
function Proprieta($db, $nome) {
  $v = Chiama $db 'OpenView' @("SELECT ``Value`` FROM ``Property`` WHERE ``Property``='$nome'"); Chiama $v 'Execute' $null | Out-Null
  $r = Chiama $v 'Fetch' $null; $val = if ($r) { Leggi $r 'StringData' @(1) } else { $null }; Chiama $v 'Close' $null | Out-Null; $val
}
function Rilascia { [GC]::Collect(); [GC]::WaitForPendingFinalizers(); [GC]::Collect() }
function Chiudi($o) { if ($o) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($o) } }

# 1. stessa identitÃ  del prodotto: la copia inglese prende il ProductCode di quella italiana (la trasformazione deve cambiare solo testi e lingua)
$dbIt = Chiama $installer 'OpenDatabase' @($it, 0)
$codice = Proprieta $dbIt 'ProductCode'
Chiudi $dbIt
$enCopia = Join-Path $lavoro 'en.msi'
Copy-Item $en $enCopia
$dbEn = Chiama $installer 'OpenDatabase' @($enCopia, 1)
$v = Chiama $dbEn 'OpenView' @("UPDATE ``Property`` SET ``Value``='$codice' WHERE ``Property``='ProductCode'"); Chiama $v 'Execute' $null | Out-Null; Chiama $v 'Close' $null | Out-Null
Chiama $dbEn 'Commit' $null | Out-Null
Chiudi $dbEn
$v = $null; $dbEn = $null; Rilascia  # senza questo il file resta aperto e torch non lo legge

# 2. trasformazione di lingua italiano -> inglese
$mst = Join-Path $lavoro '1033.mst'
& $torch -nologo -t language $it $enCopia -out $mst | Out-Host
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $mst)) { throw 'torch non ha creato la trasformazione' }

$dbP = $null; Rilascia
# 3. che cosa cambia la trasformazione (deve essere solo testo/lingua, non il prodotto)
$prova = Join-Path $lavoro 'prova.msi'
Copy-Item $it $prova
$dbP = Chiama $installer 'OpenDatabase' @($prova, 1)
Chiama $dbP 'ApplyTransform' @($mst, 256) | Out-Null   # 256 = mostra le differenze in _TransformView
$v = Chiama $dbP 'OpenView' @('SELECT `Table`, `Column`, `Row` FROM `_TransformView`'); Chiama $v 'Execute' $null | Out-Null
$tabelle = @{}; $vietate = @()
while ($r = Chiama $v 'Fetch' $null) {
  $t = Leggi $r 'StringData' @(1); $c = Leggi $r 'StringData' @(2); $riga = Leggi $r 'StringData' @(3)
  $tabelle[$t] = 1 + [int]$tabelle[$t]
  if ($t -eq 'Property' -and $riga -in @('ProductCode', 'UpgradeCode', 'ProductVersion')) { $vietate += "$t.$riga" }
  if ($t -in @('File', 'Component', 'Media', 'Directory') -and $c -ne 'CREATE' -and $c -ne 'DROP') { }
}
Chiama $v 'Close' $null | Out-Null; Chiudi $dbP
Write-Host ('La trasformazione inglese cambia: ' + (($tabelle.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name) ($($_.Value))" }) -join ', '))
if ($vietate.Count) { throw "La trasformazione cambia l'identitÃ  del prodotto: $($vietate -join ', ')" }

# 4. MSI unico: base italiana + trasformazione inglese incorporata + lingue dichiarate nel modello
Copy-Item $it $finale -Force
$db = Chiama $installer 'OpenDatabase' @($finale, 1)
$v = Chiama $db 'OpenView' @('SELECT `Name`, `Data` FROM `_Storages`'); Chiama $v 'Execute' $null | Out-Null
$rec = Chiama $installer 'CreateRecord' @(2)
Scrivi $rec 'StringData' @(1, '1033')
Chiama $rec 'SetStream' @(2, $mst) | Out-Null
Chiama $v 'Modify' @(1, $rec) | Out-Null   # 1 = inserisci
Chiama $v 'Close' $null | Out-Null
$si = Leggi $db 'SummaryInformation' @(1)
$modello = Leggi $si 'Property' @(7)
$piattaforma = ($modello -split ';')[0]
Scrivi $si 'Property' @(7, "$piattaforma;1040,1033")
Chiama $si 'Persist' $null | Out-Null
Chiama $db 'Commit' $null | Out-Null
Chiudi $si; Chiudi $db

# 5. ordine in RILASCI: resta solo l'MSI bilingue
foreach ($n in "${prog}_${Versione}_x64_it-IT.msi", "${prog}_${Versione}_x64_en-US.msi") { $p = Join-Path $uscita $n; if (Test-Path $p) { Remove-Item $p } }
Rilascia; Start-Sleep -Milliseconds 300
try { Remove-Item $lavoro -Recurse -Force -ErrorAction Stop } catch { Write-Host "(cartella temporanea non cancellata: $lavoro)" }
$kb = [math]::Round((Get-Item $finale).Length / 1MB, 2)
Write-Host "MSI bilingue: $finale ($kb MB) - modello Â«$piattaforma;1040,1033Â», ProductCode $codice"





