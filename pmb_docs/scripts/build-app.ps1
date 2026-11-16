$root = (Get-Item $PSScriptRoot).Root.FullName
$rustBin = Join-Path $root 'Program_Portable\rust\Rust\bin'
if (Test-Path $rustBin) {
    $env:PATH = "$rustBin;$env:PATH"
}
npx tauri build
