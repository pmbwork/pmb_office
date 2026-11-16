# Installa pmb_sheets da C:\AI_system\build-cache\pmb_sheets\target\release\bundle\msi in C:\AI_system\pmb_office\pmb_sheets.
# Va lanciato con permessi di amministratore (lo fa costruisci-installa-e-prova.ps1 con -Verb RunAs).
# Disinstalla prima la versione già installata, poi installa il file .msi più recente.
$ErrorActionPreference = 'Stop'
$cartellaMsi = 'C:\AI_system\build-cache\pmb_sheets\target\release\bundle\msi'
$destinazione = 'C:\AI_system\pmb_office\pmb_sheets'
New-Item -ItemType Directory -Force -Path 'C:\AI_system\logs' | Out-Null
$log = 'C:\AI_system\logs\pmb_sheets_install_fase1.log'
Start-Transcript -Path $log -Force | Out-Null
$msi = Get-ChildItem "$cartellaMsi\*.msi" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $msi) { Write-Output "ERRORE: nessun .msi in $cartellaMsi"; Stop-Transcript | Out-Null; exit 1 }
Write-Output "Installo $($msi.FullName) ($($msi.LastWriteTime))"
$chiavi = Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
  ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.DisplayName -eq 'pmb_sheets' }
foreach ($k in $chiavi) {
  $guid = $k.PSChildName
  Write-Output "Disinstallo $guid"
  $p = Start-Process msiexec.exe -ArgumentList "/x $guid /qn /norestart" -Wait -PassThru
  Write-Output "uninstall exit=$($p.ExitCode)"
}
$p = Start-Process msiexec.exe -ArgumentList "/i `"$($msi.FullName)`" /qn /norestart INSTALLDIR=`"$destinazione`"" -Wait -PassThru
Write-Output "install exit=$($p.ExitCode)"
Get-ChildItem $destinazione | Select-Object Name, Length, LastWriteTime | Format-Table | Out-String | Write-Output
Stop-Transcript | Out-Null
