# Installa pmb_sheets appena compilato in C:\Program Files\pmb_office\pmb_sheets, come lo installa la suite (installer NSIS, in silenzio).
# Va lanciato con permessi di amministratore (lo fa costruisci-installa-e-prova.ps1 con -Verb RunAs).
# Dal 2026-11-21 non si installa più in C:\AI_system\pmb_office (cartella tolta: era una copia vecchia che le prove aprivano per sbaglio).
$ErrorActionPreference = 'Stop'
$cartella = 'C:\AI_system\build-cache\pmb_sheets\target\release\bundle\nsis'
$destinazione = 'C:\Program Files\pmb_office\pmb_sheets'
New-Item -ItemType Directory -Force -Path 'C:\AI_system\logs' | Out-Null
$log = 'C:\AI_system\logs\pmb_sheets_install_fase1.log'
Start-Transcript -Path $log -Force | Out-Null
$setup = Get-ChildItem "$cartella\*-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) { Write-Output "ERRORE: nessun installer in $cartella"; Stop-Transcript | Out-Null; exit 1 }
Write-Output "Installo $($setup.FullName) ($($setup.LastWriteTime))"
Get-Process pmb-sheets-shell -ErrorAction SilentlyContinue | Stop-Process -Force
$p = Start-Process $setup.FullName -ArgumentList '/S', "/D=$destinazione" -Wait -PassThru
Write-Output "install exit=$($p.ExitCode)"
Get-ChildItem $destinazione | Select-Object Name, Length, LastWriteTime | Format-Table | Out-String | Write-Output
Stop-Transcript | Out-Null
