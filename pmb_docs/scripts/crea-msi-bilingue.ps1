# L'MSI bilingue si crea con lo script comune ai due programmi della suite: comune/scripts/crea-msi-bilingue.ps1
# Uso (dalla cartella pmb_docs): powershell -ExecutionPolicy Bypass -File scripts\crea-msi-bilingue.ps1 [-Versione 0.4.6] [-CartellaMsi <cartella>]
param([string]$Versione = '', [string]$CartellaMsi = '')
& (Join-Path $PSScriptRoot '..\..\comune\scripts\crea-msi-bilingue.ps1') -Versione $Versione -CartellaMsi $CartellaMsi
exit $LASTEXITCODE
