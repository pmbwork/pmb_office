<#
.SYNOPSIS
    Smoke test portatile per verificare l'integrità dell'eseguibile standalone di pmb_office.
.DESCRIPTION
    Ricava dinamicamente il percorso di Program_Portable\NodeJS\node.exe risalendo dalla
    posizione dello script, senza alcuna lettera di unità hardcoded.
    Usa l'ambiente Node.js portatile integrato nella periferica con 'chrome-remote-interface'
    per interrogare la finestra reale via Chrome DevTools Protocol.
.PARAMETER ExePath
    Percorso dell'eseguibile da testare.
.PARAMETER Scenario
    Scenario di test:
    - 'app': smoke test di base (URL custom-protocol, presenza menubar, cambio tema)
    - 'sheet': smoke test completo Fogli (CDP input reali, formule, ricalcolo, undo, incolla, switch tab, 3 screenshot)
.PARAMETER SimulateFailure
    Parametro per test negativi:
    - 'url': simula un URL errato (es. localhost:1420)
    - 'dom': simula l'assenza del componente free-menubar nel DOM
    - 'sheet-calc': altera il valore atteso della formula in cella A3
    - 'sheet-tab': simula la perdita dei dati al cambio scheda
    - 'layout': simula rottura layout griglia
    - 'csp': simula violazione Content Security Policy tramite setAttribute('style')
#>
param(
    [string]$ExePath,
    [ValidateSet('app', 'sheet', 'format', 'structure', 'data', 'toolbar', 'advanced')]
    [string]$Scenario = 'app',
    [ValidateSet('', 'url', 'dom', 'sheet-calc', 'sheet-tab', 'layout', 'csp', 'format', 'structure-calc', 'data-sort', 'toolbar', 'advanced-calc')]
    [string]$SimulateFailure = ''
)

$ErrorActionPreference = "Stop"

# 1. Risalita dinamica per trovare la radice della periferica contenente Program_Portable
$searchDir = $PSScriptRoot
$portableRoot = $null
while ($searchDir) {
    if (Test-Path (Join-Path $searchDir "Program_Portable")) {
        $portableRoot = $searchDir
        break
    }
    $parent = Split-Path $searchDir -Parent
    if ($parent -eq $searchDir -or -not $parent) { break }
    $searchDir = $parent
}

if (-not $portableRoot) {
    $portableRoot = (Get-Item $PSScriptRoot).Root.FullName
}

$nodeExe = Join-Path $portableRoot "Program_Portable\NodeJS\node.exe"
if (-not (Test-Path $nodeExe)) {
    Write-Error "[PORTABILITA' COMPROMESSA] Node.js portatile non trovato in: $nodeExe"
    exit 1
}

# 2. Individuazione percorsi
$appDir = Split-Path $PSScriptRoot -Parent
$helperScript = if ($Scenario -eq 'sheet') {
    Join-Path $PSScriptRoot "smoke_sheet_helper.mjs"
} elseif ($Scenario -eq 'format') {
    Join-Path $PSScriptRoot "smoke_format_helper.mjs"
} elseif ($Scenario -eq 'structure') {
    Join-Path $PSScriptRoot "smoke_structure_helper.mjs"
} elseif ($Scenario -eq 'data') {
    Join-Path $PSScriptRoot "smoke_data_helper.mjs"
} elseif ($Scenario -eq 'toolbar') {
    Join-Path $PSScriptRoot "smoke_toolbar_helper.mjs"
} elseif ($Scenario -eq 'advanced') {
    Join-Path $PSScriptRoot "smoke_advanced_helper.mjs"
} else {
    Join-Path $PSScriptRoot "smoke_helper.mjs"
}

if (-not $ExePath) {
    $ExePath = Join-Path $appDir "src-tauri\target\release\free-office-shell.exe"
}

if (-not (Test-Path $ExePath)) {
    Write-Error "[SMOKE-TEST FALLITO] Eseguibile non trovato in: $ExePath"
    exit 1
}

$exeItem = Get-Item $ExePath
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " PMB_OFFICE SMOKE TEST PORTATILE" -ForegroundColor Cyan
Write-Host " Scenario:       $Scenario"
Write-Host " Node portatile: $nodeExe"
Write-Host " Target testato: $($exeItem.FullName)"
Write-Host " Dimensione:     $($exeItem.Length) bytes ($([math]::Round($exeItem.Length / 1MB, 2)) MB)"
Write-Host " Ultima mod.:    $($exeItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"
if ($SimulateFailure) {
    Write-Host " MODALITA' TEST NEGATIVO: simulazione errore '$SimulateFailure'" -ForegroundColor Magenta
}
Write-Host "============================================================" -ForegroundColor Cyan

# 3. Creazione cartella temporanea isolata fuori da progetti/
$testDir = Join-Path $env:TEMP "pmb_smoke_$([System.IO.Path]::GetRandomFileName())"
New-Item -ItemType Directory -Path $testDir -Force | Out-Null
$testExe = Join-Path $testDir "free-office-shell.exe"
Copy-Item $ExePath -Destination $testExe

# 4. Avvio del processo di test isolato con porta CDP aperta
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
$proc = Start-Process -FilePath $testExe -WorkingDirectory $testDir -PassThru
Start-Sleep -Seconds 3

$settingsFile = Join-Path $testDir "data\impostazioni.json"
$beforeContent = if (Test-Path $settingsFile) { Get-Content $settingsFile -Raw } else { "{}" }

# 5. Esecuzione dell'helper Node.js portatile posizionandosi nella cartella app/
$oldLocation = Get-Location
Set-Location $appDir
try {
    $argTarget = if ($Scenario -eq 'sheet' -or $Scenario -eq 'format' -or $Scenario -eq 'structure' -or $Scenario -eq 'data' -or $Scenario -eq 'toolbar' -or $Scenario -eq 'advanced') { $appDir } else { $testDir }
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    if ($Scenario -eq 'toolbar') {
        if (-not ([System.Management.Automation.PSTypeName]'Win32WindowTools').Type) {
            Add-Type -TypeDefinition @"
            using System;
            using System.Runtime.InteropServices;
            using System.Text;

            public class Win32WindowTools {
                [DllImport("user32.dll")]
                public static extern bool SetProcessDPIAware();

                [DllImport("user32.dll", SetLastError = true)]
                public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

                public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

                [DllImport("user32.dll")]
                public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

                [DllImport("user32.dll", SetLastError = true)]
                public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

                [DllImport("user32.dll")]
                public static extern bool IsWindowVisible(IntPtr hWnd);

                [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
                public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
            }
"@
        }

        [Win32WindowTools]::SetProcessDPIAware() | Out-Null

        # Individua l'HWND della finestra principale associata al processo o ai suoi child
        $allPids = @($proc.Id)
        Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $proc.Id } | ForEach-Object { $allPids += $_.ProcessId }
        
        $script:foundHwnd = [IntPtr]::Zero
        [Win32WindowTools]::EnumWindows({
            param($h, $l)
            [uint32]$wPid = 0
            [Win32WindowTools]::GetWindowThreadProcessId($h, [ref]$wPid)
            if ($allPids -contains $wPid -and [Win32WindowTools]::IsWindowVisible($h)) {
                $sb = New-Object System.Text.StringBuilder 256
                [Win32WindowTools]::GetWindowText($h, $sb, 256) | Out-Null
                $title = $sb.ToString()
                if ($title.Length -gt 0) {
                    $script:foundHwnd = $h
                    return $false
                }
            }
            return $true
        }, [IntPtr]::Zero) | Out-Null

        $hWnd = $script:foundHwnd
        Write-Host "[TOOLBAR_SMOKE] HWND finestra rilevato: $hWnd" -ForegroundColor Cyan

        $smokeOutput = @()
        $smokeExit = 0

        # Loop sulle 4 larghezze richieste: 800, 1000, 1200, 1600 px
        foreach ($w in @(800, 1000, 1200, 1600)) {
            if ($hWnd -ne [IntPtr]::Zero) {
                # SWP_NOZORDER (0x0004) | SWP_NOACTIVATE (0x0010)
                [Win32WindowTools]::SetWindowPos($hWnd, [IntPtr]::Zero, 50, 50, $w, 850, 0x0014) | Out-Null
                Start-Sleep -Milliseconds 600
            }

            Write-Host "`n>>> Testando finestra ridimensionata a ${w}px con SetWindowPos..." -ForegroundColor Yellow
            $out = & $nodeExe $helperScript $appDir $w $SimulateFailure 2>&1
            $smokeOutput += $out
            if ($LASTEXITCODE -ne 0) {
                $smokeExit = $LASTEXITCODE
                break
            }
        }

        # Test contrasto WCAG se non siamo in simulazione errore
        if ($smokeExit -eq 0 -and $SimulateFailure -ne 'toolbar') {
            Write-Host "`n>>> Testando colore automatico del testo e contrasto WCAG su riempimenti..." -ForegroundColor Yellow
            $out = & $nodeExe $helperScript $appDir contrast $SimulateFailure 2>&1
            $smokeOutput += $out
            if ($LASTEXITCODE -ne 0) {
                $smokeExit = $LASTEXITCODE
            }
        }
    } else {
        $smokeOutput = & $nodeExe $helperScript $argTarget $SimulateFailure 2>&1
        $smokeExit = $LASTEXITCODE
    }
    $ErrorActionPreference = $oldEap
} finally {
    Set-Location $oldLocation
}

# 6. Chiusura del processo
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $proc.Id } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

$afterContent = if (Test-Path $settingsFile) { Get-Content $settingsFile -Raw } else { "{}" }

# 7. Pulizia cartella temporanea
Remove-Item -Path $testDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n--- Risultati Smoke Test ---" -ForegroundColor Yellow
$smokeOutput | ForEach-Object { Write-Host "  $_" }

if ($Scenario -eq 'format') {
    $shotNum = Join-Path $appDir "verifica\formati-numerici.png"
    $shotBold = Join-Path $appDir "verifica\grassetto-riempimento.png"
    $shotBord = Join-Path $appDir "verifica\bordi.png"
    $shotDark = Join-Path $appDir "verifica\tema-scuro-formati.png"

    $hasShots = (Test-Path $shotNum) -and (Test-Path $shotBold) -and (Test-Path $shotBord) -and (Test-Path $shotDark)
    if ($smokeExit -eq 0 -and $hasShots) {
        Write-Host "`nScreenshot catturati con successo in pmb_sheets/verifica/:" -ForegroundColor Green
        Write-Host "  - formati-numerici.png:     $((Get-Item $shotNum).Length) bytes"
        Write-Host "  - grassetto-riempimento.png: $((Get-Item $shotBold).Length) bytes"
        Write-Host "  - bordi.png:                 $((Get-Item $shotBord).Length) bytes"
        Write-Host "  - tema-scuro-formati.png:    $((Get-Item $shotDark).Length) bytes"
        Write-Host "`n>>> [SMOKE-TEST FORMAT SUPERATO AL 100%] Eseguibile idoneo e conforme! (ExitCode: 0) <<<`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n>>> [SMOKE-TEST FORMAT FALLITO] (ExitCode: $smokeExit, screenshot completi: $hasShots) <<<`n" -ForegroundColor Red
        exit 1
    }
} elseif ($Scenario -eq 'structure') {
    $shotInsert = Join-Path $appDir "verifica\struttura-inserisci-riga.png"
    $shotTabs = Join-Path $appDir "verifica\struttura-schede-multiple.png"
    $shotFill = Join-Path $appDir "verifica\struttura-riempimento.png"

    $hasShots = (Test-Path $shotInsert) -and (Test-Path $shotTabs) -and (Test-Path $shotFill)
    if ($smokeExit -eq 0 -and $hasShots) {
        Write-Host "`nScreenshot catturati con successo in pmb_sheets/verifica/:" -ForegroundColor Green
        Write-Host "  - struttura-inserisci-riga.png:  $((Get-Item $shotInsert).Length) bytes"
        Write-Host "  - struttura-schede-multiple.png: $((Get-Item $shotTabs).Length) bytes"
        Write-Host "  - struttura-riempimento.png:     $((Get-Item $shotFill).Length) bytes"
        Write-Host "`n>>> [SMOKE-TEST STRUCTURE SUPERATO AL 100%] Eseguibile idoneo e conforme! (ExitCode: 0) <<<`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n>>> [SMOKE-TEST STRUCTURE FALLITO] (ExitCode: $smokeExit, screenshot completi: $hasShots) <<<`n" -ForegroundColor Red
        exit 1
    }
} elseif ($Scenario -eq 'data') {
    $shotSort = Join-Path $appDir "verifica\dati-ordinamento.png"
    $shotFilter = Join-Path $appDir "verifica\dati-filtro-attivo.png"
    $shotMerge = Join-Path $appDir "verifica\dati-convalida-unione.png"

    $hasShots = (Test-Path $shotSort) -and (Test-Path $shotFilter) -and (Test-Path $shotMerge)
    if ($smokeExit -eq 0 -and $hasShots) {
        Write-Host "`nScreenshot catturati con successo in pmb_sheets/verifica/:" -ForegroundColor Green
        Write-Host "  - dati-ordinamento.png:       $((Get-Item $shotSort).Length) bytes"
        Write-Host "  - dati-filtro-attivo.png:     $((Get-Item $shotFilter).Length) bytes"
        Write-Host "  - dati-convalida-unione.png:  $((Get-Item $shotMerge).Length) bytes"
        Write-Host "`n>>> [SMOKE-TEST DATA SUPERATO AL 100%] Eseguibile idoneo e conforme! (ExitCode: 0) <<<`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n>>> [SMOKE-TEST DATA FALLITO] (ExitCode: $smokeExit, screenshot completi: $hasShots) <<<`n" -ForegroundColor Red
        exit 1
    }
} elseif ($Scenario -eq 'sheet') {
    $shotDati = Join-Path $appDir "verifica\sheet-dati.png"
    $shotMod = Join-Path $appDir "verifica\sheet-modifica.png"
    $shotStats = Join-Path $appDir "verifica\sheet-selezione-statusbar.png"

    $hasShots = (Test-Path $shotDati) -and (Test-Path $shotMod) -and (Test-Path $shotStats)
    if ($smokeExit -eq 0 -and $hasShots) {
        Write-Host "`nScreenshot catturati con successo in pmb_sheets/verifica/:" -ForegroundColor Green
        Write-Host "  - sheet-dati.png:               $((Get-Item $shotDati).Length) bytes"
        Write-Host "  - sheet-modifica.png:           $((Get-Item $shotMod).Length) bytes"
        Write-Host "  - sheet-selezione-statusbar.png: $((Get-Item $shotStats).Length) bytes"
        Write-Host "`n>>> [SMOKE-TEST SHEET SUPERATO AL 100%] Eseguibile idoneo e conforme! (ExitCode: 0) <<<`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n>>> [SMOKE-TEST SHEET FALLITO] (ExitCode: $smokeExit) <<<`n" -ForegroundColor Red
        exit 1
    }
} elseif ($Scenario -eq 'toolbar') {
    $shot800F = Join-Path $appDir "verifica\toolbar-fogli-800.png"
    $shot1000F = Join-Path $appDir "verifica\toolbar-fogli-1000.png"
    $shot1200F = Join-Path $appDir "verifica\toolbar-fogli-1200.png"
    $shot1600F = Join-Path $appDir "verifica\toolbar-fogli-1600.png"
    $shot800D = Join-Path $appDir "verifica\toolbar-doc-800.png"
    $shot1000D = Join-Path $appDir "verifica\toolbar-doc-1000.png"
    $shot1200D = Join-Path $appDir "verifica\toolbar-doc-1200.png"
    $shot1600D = Join-Path $appDir "verifica\toolbar-doc-1600.png"
    $shotContr = Join-Path $appDir "verifica\contrasto-wcag-riempimento.png"

    $hasShots = (Test-Path $shot800F) -and (Test-Path $shot1000F) -and (Test-Path $shot1200F) -and (Test-Path $shot1600F) -and (Test-Path $shot800D) -and (Test-Path $shot1000D) -and (Test-Path $shot1200D) -and (Test-Path $shot1600D) -and (Test-Path $shotContr)
    if ($smokeExit -eq 0 -and $hasShots) {
        Write-Host "`nScreenshot toolbar e contrasto catturati con successo in pmb_sheets/verifica/:" -ForegroundColor Green
        Write-Host "  - toolbar-fogli-800.png:           $((Get-Item $shot800F).Length) bytes"
        Write-Host "  - toolbar-fogli-1000.png:          $((Get-Item $shot1000F).Length) bytes"
        Write-Host "  - toolbar-fogli-1200.png:          $((Get-Item $shot1200F).Length) bytes"
        Write-Host "  - toolbar-fogli-1600.png:          $((Get-Item $shot1600F).Length) bytes"
        Write-Host "  - toolbar-doc-800.png:             $((Get-Item $shot800D).Length) bytes"
        Write-Host "  - toolbar-doc-1000.png:            $((Get-Item $shot1000D).Length) bytes"
        Write-Host "  - toolbar-doc-1200.png:            $((Get-Item $shot1200D).Length) bytes"
        Write-Host "  - toolbar-doc-1600.png:            $((Get-Item $shot1600D).Length) bytes"
        Write-Host "  - contrasto-wcag-riempimento.png:  $((Get-Item $shotContr).Length) bytes"
        Write-Host "`n>>> [SMOKE-TEST TOOLBAR SUPERATO AL 100%] Eseguibile idoneo e conforme! (ExitCode: 0) <<<`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n>>> [SMOKE-TEST TOOLBAR FALLITO] (ExitCode: $smokeExit, screenshot completi: $hasShots) <<<`n" -ForegroundColor Red
        exit 1
    }
} elseif ($Scenario -eq 'advanced') {
    $shotSpill = Join-Path $appDir "verifica\array-dinamici-spill.png"
    $shotChart = Join-Path $appDir "verifica\grafici-svg.png"
    $shotPivot = Join-Path $appDir "verifica\tabelle-pivot.png"

    $hasShots = (Test-Path $shotSpill) -and (Test-Path $shotChart) -and (Test-Path $shotPivot)
    if ($smokeExit -eq 0 -and $hasShots) {
        Write-Host "`nScreenshot avanzati (spill, grafici SVG, pivot) catturati con successo in pmb_sheets/verifica/:" -ForegroundColor Green
        Write-Host "  - array-dinamici-spill.png: $((Get-Item $shotSpill).Length) bytes"
        Write-Host "  - grafici-svg.png:           $((Get-Item $shotChart).Length) bytes"
        Write-Host "  - tabelle-pivot.png:         $((Get-Item $shotPivot).Length) bytes"
        Write-Host "`n>>> [SMOKE-TEST ADVANCED SUPERATO AL 100%] Eseguibile idoneo e conforme! (ExitCode: 0) <<<`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n>>> [SMOKE-TEST ADVANCED FALLITO] (ExitCode: $smokeExit, screenshot completi: $hasShots) <<<`n" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n--- Persistenza Rust data/impostazioni.json ---" -ForegroundColor Yellow
    Write-Host "  Prima: $($beforeContent.Trim())"
    Write-Host "  Dopo:  $($afterContent.Trim())"

    if ($smokeExit -eq 0 -and $afterContent -match '"theme":\s*"dark"') {
        Write-Host "`n>>> [SMOKE-TEST SUPERATO AL 100%] Eseguibile idoneo e conforme! (ExitCode: 0) <<<`n" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "`n>>> [SMOKE-TEST FALLITO] Errore riscontrato (ExitCode: $smokeExit) <<<`n" -ForegroundColor Red
        exit 1
    }
}

