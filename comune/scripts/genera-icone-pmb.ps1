# Genera le icone di pmb_docs (sfondo blu) e pmb_sheets (sfondo verde) dal logo PMB.
# Uso:  powershell -ExecutionPolicy Bypass -File genera-icone-pmb.ps1 [-Sorgente <logo.jpg>] [-Radice <cartella pmb_office>]
# Il logo è nero su bianco: la luminosità diventa la trasparenza, e il monogramma si disegna in BIANCO sul fondo colorato
# (con -LogoNero il monogramma resta nero). Produce, per ciascuna app: icons\icon.ico, icon.png (512), 128x128.png, 32x32.png
# e un PNG 64x64 in base64 (icone\titolo-<app>.b64.txt) per l'icona accanto al titolo.
param(
  [string]$Sorgente = (Join-Path $PSScriptRoot '..\..\LAVORO\logo-sorgente\Logo PMB (personale).jpg'),
  [string]$Radice = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [switch]$LogoNero
)
Add-Type -AssemblyName System.Drawing

$app = @(
  @{ Nome = 'docs';   Cartella = 'pmb_docs';   Colore = '#2457C5' },
  @{ Nome = 'sheets'; Cartella = 'pmb_sheets'; Colore = '#188A4A' }
)

# 1) il monogramma come maschera: sorgente in grigi -> trasparenza, ritagliato attorno alle lettere
$src = New-Object System.Drawing.Bitmap $Sorgente
$w = $src.Width; $h = $src.Height
$minX = $w; $minY = $h; $maxX = 0; $maxY = 0
$alpha = New-Object 'byte[]' ($w * $h)
for ($y = 0; $y -lt $h; $y++) { for ($x = 0; $x -lt $w; $x++) {
  $p = $src.GetPixel($x, $y); $lum = (0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B)
  $a = [byte][Math]::Min(255, [Math]::Max(0, [int]((255 - $lum) * 1.0)))
  $alpha[$y * $w + $x] = $a
  if ($a -gt 100) { if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }; if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y } }
} }
$src.Dispose()
$cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
$mono = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$base = if ($LogoNero) { 0 } else { 255 }
for ($y = 0; $y -lt $ch; $y++) { for ($x = 0; $x -lt $cw; $x++) {
  $a = $alpha[($y + $minY) * $w + ($x + $minX)]
  $mono.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $base, $base, $base))
} }

function Nuova-Icona([int]$lato, [string]$colore, [System.Drawing.Bitmap]$m) {
  $bmp = New-Object System.Drawing.Bitmap $lato, $lato, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $r = [int]($lato * 0.22)  # angoli arrotondati
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($lato - $d - 1, 0, $d, $d, 270, 90)
  $path.AddArc($lato - $d - 1, $lato - $d - 1, $d, $d, 0, 90); $path.AddArc(0, $lato - $d - 1, $d, $d, 90, 90); $path.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($colore))), $path)
  # il monogramma occupa il 66% del lato (largo) e sta al centro
  $maxL = $lato * 0.66
  $scala = [Math]::Min($maxL / $m.Width, $maxL / $m.Height)
  $mw = $m.Width * $scala; $mh = $m.Height * $scala
  $g.DrawImage($m, [single](($lato - $mw) / 2), [single](($lato - $mh) / 2), [single]$mw, [single]$mh)
  $g.Dispose(); $path.Dispose()
  return $bmp
}
function Png-Bytes([System.Drawing.Bitmap]$b) { $ms = New-Object System.IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); return ,$ms.ToArray() }

foreach ($a in $app) {
  $cartella = if (Test-Path (Join-Path $Radice $a.Cartella)) { $a.Cartella } else { $a.Cartella.Replace('pmb_', 'free_') } # prima della rinomina le cartelle si chiamano ancora free_*
  $dir = Join-Path (Join-Path $Radice $cartella) 'src-tauri\icons'
  New-Item -ItemType Directory -Force $dir | Out-Null
  # PNG
  foreach ($par in @(@(512, 'icon.png'), @(128, '128x128.png'), @(32, '32x32.png'))) {
    $b = Nuova-Icona $par[0] $a.Colore $mono; $b.Save((Join-Path $dir $par[1]), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
  }
  # ICO con voci PNG (16, 24, 32, 48, 64, 128, 256)
  $misure = 16, 24, 32, 48, 64, 128, 256
  $voci = foreach ($m in $misure) { $b = Nuova-Icona $m $a.Colore $mono; $by = Png-Bytes $b; $b.Dispose(); [pscustomobject]@{ M = $m; B = $by } }
  $ms = New-Object System.IO.MemoryStream; $bw = New-Object System.IO.BinaryWriter $ms
  $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$voci.Count)
  $off = 6 + 16 * $voci.Count
  foreach ($v in $voci) {
    $bw.Write([byte]($(if ($v.M -ge 256) { 0 } else { $v.M }))); $bw.Write([byte]($(if ($v.M -ge 256) { 0 } else { $v.M })))
    $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([uint16]1); $bw.Write([uint16]32); $bw.Write([uint32]$v.B.Length); $bw.Write([uint32]$off); $off += $v.B.Length
  }
  foreach ($v in $voci) { $bw.Write($v.B) }
  $bw.Flush(); [System.IO.File]::WriteAllBytes((Join-Path $dir 'icon.ico'), $ms.ToArray())
  # icona piccola per il titolo (64x64, PNG in base64)
  $t = Nuova-Icona 64 $a.Colore $mono
  [System.IO.File]::WriteAllText((Join-Path $dir ("titolo-" + $a.Nome + ".b64.txt")), [Convert]::ToBase64String((Png-Bytes $t)))
  $t.Dispose()
  "{0}: icone scritte in {1}" -f $a.Cartella, $dir
}
$mono.Dispose()

