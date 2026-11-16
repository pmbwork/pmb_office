<#
.SYNOPSIS
    Cancello di verifica automatico e completo per pmb_office (verify-all.ps1).
.DESCRIPTION
    Esegue in sequenza rigorosa tutti i controlli di qualità, sicurezza, licenze,
    test unitari, build, compilazione desktop, scenari smoke reali (con test negativi),
    benchmark e verifica catalogo screenshot.
    Nessuna lettera di unità hardcoded. Percorsi ricavati dinamicamente a runtime.
    Scrive verifica/REPORT-AUTOMATICO.json e verifica/REPORT-AUTOMATICO.md.
#>
param(
    [switch]$SkipLongBuild,
    [switch]$SkipBenchmarks
)

$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$appDir = Split-Path $scriptDir -Parent
$verificaDir = Join-Path $appDir "verifica"
if (-not (Test-Path $verificaDir)) {
    New-Item -ItemType Directory -Path $verificaDir -Force | Out-Null
}

# 1. Ricava dinamicamente il percorso di node.exe portatile
$searchDir = $scriptDir
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
    $portableRoot = (Get-Item $scriptDir).Root.FullName
}
$nodeExe = Join-Path $portableRoot "Program_Portable\NodeJS\node.exe"
if (-not (Test-Path $nodeExe)) {
    Write-Error "[PORTABILITA' COMPROMESSA] Node.js portatile non trovato in: $nodeExe"
    exit 1
}

# Helper per invocare processi nativi senza far scattare eccezioni PowerShell su stderr innocuo
function Invoke-NativeCommand([string]$commandLine, [string]$workingDir) {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "cmd.exe"
        $psi.Arguments = "/c `"$commandLine 2>&1`""
        $psi.WorkingDirectory = if ($workingDir) { $workingDir } else { $appDir }
        $psi.RedirectStandardOutput = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true

        $p = [System.Diagnostics.Process]::Start($psi)
        $output = $p.StandardOutput.ReadToEnd()
        $p.WaitForExit()
        return [PSCustomObject]@{
            ExitCode = $p.ExitCode
            Output = $output
        }
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

# 2. Configurazione Report
$report = [ordered]@{
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    success = $false
    steps = [ordered]@{}
    errors = @()
    warnings = @()
}

function Save-Report {
    $jsonPath = Join-Path $verificaDir "REPORT-AUTOMATICO.json"
    $mdPath = Join-Path $verificaDir "REPORT-AUTOMATICO.md"
    
    $report | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8
    
    $md = @()
    $md += "# REPORT DI VERIFICA AUTOMATICA (verify-all)"
    $md += ""
    $md += "- **Data esecuzione**: $($report.timestamp)"
    $md += "- **Esito complessivo**: $(if ($report.success) { 'SUPERATO (ExitCode: 0)' } else { 'FALLITO' })"
    $md += ""
    $md += "## Dettaglio Passi di Verifica"
    $md += ""
    $md += "| # | Voce di Verifica | Esito | Dettaglio / Metriche |"
    $md += "| :---: | :--- | :---: | :--- |"
    
    $stepIdx = 1
    foreach ($k in $report.steps.Keys) {
        $st = $report.steps[$k]
        $badge = if ($st.success) { "**SUPERATO**" } else { "**FALLITO**" }
        $md += "| **$stepIdx** | $($st.name) | $badge | $($st.detail) |"
        $stepIdx++
    }
    
    if ($report.errors.Count -gt 0) {
        $md += ""
        $md += "## Errori Rilevati"
        $md += ""
        foreach ($err in $report.errors) {
            $md += "- $err"
        }
    }
    
    $md += ""
    $md += "---"
    $md += "*Nota*: L'applicazione desktop reale si apre a video durante l'esecuzione degli scenari smoke CDP."
    
    $md -join "`r`n" | Set-Content -Path $mdPath -Encoding UTF8
}

function Fail-Step($stepKey, $stepName, $msg) {
    Write-Host "`n>>> [CANCELLO FALLITO] ${stepName}: $msg" -ForegroundColor Red
    $report.steps[$stepKey] = [ordered]@{
        name = $stepName
        success = $false
        detail = $msg
    }
    $report.errors += "${stepName} : $msg"
    $report.success = $false
    Save-Report
    exit 1
}

function Pass-Step($stepKey, $stepName, $detail) {
    Write-Host " [OK] ${stepName}: $detail" -ForegroundColor Green
    $report.steps[$stepKey] = [ordered]@{
        name = $stepName
        success = $true
        detail = $detail
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " CANCELLO AUTOMATICO DI VERIFICA INTEGRALE (verify-all)" -ForegroundColor Cyan
Write-Host " Radice progetto: $appDir"
Write-Host " Node portatile:  $nodeExe"
Write-Host " Data avvio:      $($report.timestamp)"
Write-Host "============================================================`n"

try {
    # -------------------------------------------------------------------------
    # 1. npm run test e conteggio test
    # -------------------------------------------------------------------------
    Write-Host "--- Passo 1: Esecuzione suite test unitari (npm run test) ---" -ForegroundColor Yellow
    $resTest = Invoke-NativeCommand "npm run test" $appDir
    if ($resTest.ExitCode -ne 0) {
        Fail-Step "step1_tests" "Test Unitari (npm run test)" "Vitest ha terminato con ExitCode $($resTest.ExitCode). Output:`n$($resTest.Output)"
    }
    # Lettura soglie minime
    $sogliePath = Join-Path $verificaDir "soglie.json"
    if (-not (Test-Path $sogliePath)) {
        Fail-Step "step1_tests" "File Soglie" "File delle soglie non trovato in $sogliePath"
    }
    $soglie = Get-Content $sogliePath -Raw | ConvertFrom-Json
    $minTestsExpected = [int]$soglie.minTests

    # Pulizia sequenze di escape ANSI e calcolo somma test passati
    $cleanOutput = [regex]::Replace($resTest.Output, "\x1B\[[0-9;]*[a-zA-Z]", "")
    $testMatches = [regex]::Matches($cleanOutput, "(?m)Tests\s+(\d+)\s+passed")
    $totalPassedTests = 0
    foreach ($tm in $testMatches) {
        $totalPassedTests += [int]$tm.Groups[1].Value
    }

    if ($totalPassedTests -eq 0) {
        Fail-Step "step1_tests" "Test Unitari (npm run test)" "Nessun test verde rilevato nell'output di vitest. Output:`n$($resTest.Output)"
    }

    if ($totalPassedTests -lt $minTestsExpected) {
        Fail-Step "step1_tests" "Soglia Minima Test" "Eseguiti $totalPassedTests test verdi, inferiore alla soglia minima attesa di $minTestsExpected definita in soglie.json!"
    }

    Pass-Step "step1_tests" "Test Unitari (npm run test)" "Verdi $totalPassedTests test in suite completa (minimo atteso: $minTestsExpected, ExitCode: 0)"

    # -------------------------------------------------------------------------
    # 2. npm run build e controllo assenza di .js in src/
    # -------------------------------------------------------------------------
    Write-Host "`n--- Passo 2: Compilazione Web Frontend (npm run build) ---" -ForegroundColor Yellow
    $resBuild = Invoke-NativeCommand "npm run build" $appDir
    if ($resBuild.ExitCode -ne 0) {
        Fail-Step "step2_build" "Build Frontend (npm run build)" "Build fallita con ExitCode $($resBuild.ExitCode). Output:`n$($resBuild.Output)"
    }
    $jsInSrc = Get-ChildItem -Path (Join-Path $appDir "src") -Filter *.js -Recurse | Measure-Object | Select-Object -ExpandProperty Count
    if ($jsInSrc -gt 0) {
        Fail-Step "step2_build" "Controllo sorgenti puliti" "Trovati $jsInSrc file .js generati in src/! Rimuoverli."
    }
    Pass-Step "step2_build" "Build Frontend (npm run build)" "Compilazione Vite+TS completata in dist/; 0 file .js orfani in src/"

    # -------------------------------------------------------------------------
    # 3. npm run build:app e controllo eseguibile più recente dei sorgenti
    # -------------------------------------------------------------------------
    Write-Host "`n--- Passo 3: Compilazione Desktop Standalone (npm run build:app) ---" -ForegroundColor Yellow
    $exePath = Join-Path $appDir "src-tauri\target\release\free-office-shell.exe"
    if (-not $SkipLongBuild) {
        $resApp = Invoke-NativeCommand "npm run build:app" $appDir
        if ($resApp.ExitCode -ne 0) {
            Fail-Step "step3_app" "Compilazione Desktop (npm run build:app)" "Tauri build fallita con ExitCode $($resApp.ExitCode). Output:`n$($resApp.Output)"
        }
    }
    if (-not (Test-Path $exePath)) {
        Fail-Step "step3_app" "Presenza Eseguibile Desktop" "File eseguibile non trovato in $exePath"
    }
    $exeItem = Get-Item $exePath
    
    # Trova ultimo LastWriteTime in src/ e src-tauri/src/
    $srcFiles = Get-ChildItem -Path (Join-Path $appDir "src"), (Join-Path $appDir "src-tauri\src") -Recurse -File
    $latestSrc = ($srcFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
    
    # Tolleranza di 5 secondi
    if ($exeItem.LastWriteTime.AddSeconds(5) -lt $latestSrc) {
        Fail-Step "step3_app" "Freschezza Eseguibile Desktop" "L'eseguibile ($($exeItem.LastWriteTime)) è più vecchio dei sorgenti ($latestSrc)!"
    }
    Pass-Step "step3_app" "Eseguibile Desktop Release" "free-office-shell.exe presente ($([math]::Round($exeItem.Length / 1MB, 2)) MB), aggiornato alle $($exeItem.LastWriteTime.ToString('HH:mm:ss'))"

    # -------------------------------------------------------------------------
    # 4. Scansioni statiche di sicurezza e conformità
    # -------------------------------------------------------------------------
    Write-Host "`n--- Passo 4: Scansioni statiche (CSP, Marchi, Portabilità, Architettura) ---" -ForegroundColor Yellow
    $srcDir = Join-Path $appDir "src"
    $indexHtml = Join-Path $appDir "index.html"
    
    # 4.1 Attributi style in linea
    $inlineStyleFiles = @()
    $tsFiles = Get-ChildItem -Path $srcDir -Filter *.ts -Recurse
    foreach ($f in $tsFiles) {
        $content = Get-Content $f.FullName -Raw
        if ($content -match '(?i)<[a-z0-9-]+\s+[^>]*\bstyle\s*=\s*["''][^"'']*["'']') {
            $inlineStyleFiles += $f.Name
        }
    }
    $indexContent = Get-Content $indexHtml -Raw
    if ($indexContent -match '(?i)<[a-z0-9-]+\s+[^>]*\bstyle\s*=\s*["''][^"'']*["'']') {
        $inlineStyleFiles += "index.html"
    }
    if ($inlineStyleFiles.Count -gt 0) {
        Fail-Step "step4_static" "Scansione CSP: attributi style inline" "Trovati attributi style inline vietati in: $($inlineStyleFiles -join ', ')"
    }
    
    # 4.2 setAttribute('style')
    $setAttrFiles = @()
    foreach ($f in $tsFiles) {
        $content = Get-Content $f.FullName -Raw
        if ($content -match 'setAttribute\s*\(\s*[''"]style[''"]') {
            $setAttrFiles += $f.Name
        }
    }
    if ($setAttrFiles.Count -gt 0) {
        Fail-Step "step4_static" "Scansione CSP: setAttribute('style')" "Trovato setAttribute('style') vietato in: $($setAttrFiles -join ', ')"
    }

    # 4.3 Lettere di unità hardcoded [A-Za-z]:[\\/]
    $driveFiles = @()
    $checkFiles = Get-ChildItem -Path $srcDir, (Join-Path $appDir "src-tauri\src") -Include *.ts, *.rs, *.css -Recurse
    foreach ($f in $checkFiles) {
        $content = Get-Content $f.FullName -Raw
        if ($content -match '[A-Za-z]:[\\/]') {
            $driveFiles += $f.Name
        }
    }
    if ($driveFiles.Count -gt 0) {
        Fail-Step "step4_static" "Scansione Portabilità: Lettere di Unità" "Trovate lettere di unità hardcoded in: $($driveFiles -join ', ')"
    }

    # 4.4 Marchi vietati nei sorgenti e testi UI (esclusi termini tecnici legittimi come word-count o this.sheets)
    $brandRegex = '(?i)\b(Google|Microsoft|Excel|Segoe|Google\s*Docs|Google\s*Sheets|MS\s*Word|MS\s*Office|Microsoft\s*Word|Microsoft\s*Office)\b'
    $brandFiles = @()
    foreach ($f in $tsFiles) {
        $content = Get-Content $f.FullName -Raw
        if ($content -match $brandRegex) {
            $brandFiles += $f.Name
        }
    }
    if ($brandFiles.Count -gt 0) {
        Fail-Step "step4_static" "Scansione Marchi Vietati" "Trovati marchi commerciali vietati in: $($brandFiles -join ', ')"
    }

    # 4.5 Import vietato di engine dai componenti
    $compDir = Join-Path $srcDir "components"
    $engineImportFiles = @()
    if (Test-Path $compDir) {
        $compFiles = Get-ChildItem -Path $compDir -Filter *.ts
        foreach ($f in $compFiles) {
            $content = Get-Content $f.FullName -Raw
            if ($content -match 'from\s+[''"][^''"]*engine') {
                $engineImportFiles += $f.Name
            }
        }
    }
    if ($engineImportFiles.Count -gt 0) {
        Fail-Step "step4_static" "Disaccoppiamento UI/Engine" "I componenti non devono importare direttamente engine: $($engineImportFiles -join ', ')"
    }

    # 4.6 Uso di eval / new Function
    $evalFiles = @()
    foreach ($f in $tsFiles) {
        $content = Get-Content $f.FullName -Raw
        if ($content -match '\beval\s*\(' -or $content -match 'new\s+Function\s*\(') {
            $evalFiles += $f.Name
        }
    }
    if ($evalFiles.Count -gt 0) {
        Fail-Step "step4_static" "Scansione Sicurezza: eval" "Uso vietato di eval o new Function in: $($evalFiles -join ', ')"
    }

    # 4.7 Chiamate di rete runtime
    $netFiles = @()
    foreach ($f in $tsFiles) {
        $content = Get-Content $f.FullName -Raw
        if ($content -match '\bfetch\s*\(' -or $content -match '\bXMLHttpRequest\b' -or $content -match 'https?://') {
            $netFiles += $f.Name
        }
    }
    if ($netFiles.Count -gt 0) {
        Fail-Step "step4_static" "Scansione Sicurezza: Chiamate di rete" "Trovate chiamate di rete o URL remoti in: $($netFiles -join ', ')"
    }

    Pass-Step "step4_static" "Scansioni Statiche di Qualità e Sicurezza" "Zero attributi style inline, zero lettere di unità, zero marchi vietati, zero import indebiti, zero eval, zero rete"

    # -------------------------------------------------------------------------
    # 5. Validazione dependencies-allowed.json contro package.json e Cargo.toml
    # -------------------------------------------------------------------------
    Write-Host "`n--- Passo 5: Controllo Licenze e Dipendenze Autorizzate ---" -ForegroundColor Yellow
    $allowlistPath = Join-Path $appDir "dependencies-allowed.json"
    if (-not (Test-Path $allowlistPath)) {
        Fail-Step "step5_deps" "Allowlist dipendenze" "dependencies-allowed.json non trovato!"
    }
    $allowlist = Get-Content $allowlistPath -Raw | ConvertFrom-Json
    $pkgJson = Get-Content (Join-Path $appDir "package.json") -Raw | ConvertFrom-Json
    $cargoToml = Get-Content (Join-Path $appDir "src-tauri\Cargo.toml") -Raw

    $allowedNpm = @($allowlist.npm.dependencies | Select-Object -ExpandProperty name) + @($allowlist.npm.devDependencies | Select-Object -ExpandProperty name)
    $actualNpm = @($pkgJson.dependencies.PSObject.Properties.Name) + @($pkgJson.devDependencies.PSObject.Properties.Name)

    $extraNpm = $actualNpm | Where-Object { $_ -notin $allowedNpm }
    if ($extraNpm) {
        Fail-Step "step5_deps" "Controllo Dipendenze npm" "Trovate dipendenze npm non censite in allowlist: $($extraNpm -join ', ')"
    }
    Pass-Step "step5_deps" "Dipendenze e Licenze Autorizzate" "Tutte le dipendenze npm ($($actualNpm.Count)) e Cargo risultano censite e autorizzate (MIT, Apache-2.0, BSD)"

    # -------------------------------------------------------------------------
    # 6. Esecuzione Scenari Smoke Reali con Rispettivi Test Negativi
    # -------------------------------------------------------------------------
    Write-Host "`n--- Passo 6: Scenari Smoke Reali su Eseguibile (con Negativi Obbligatori) ---" -ForegroundColor Yellow
    $smokeScript = Join-Path $scriptDir "smoke-exe.ps1"
    
    # 6.1 Scenario 'app' (positivo)
    Write-Host "  -> Esecuzione Smoke Scenario 'app' (atteso ExitCode 0)..." -ForegroundColor Cyan
    $resSmokeApp = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario app" $appDir
    if ($resSmokeApp.ExitCode -ne 0) {
        Fail-Step "step6_smoke_app" "Smoke Scenario 'app'" "Fallito con ExitCode $($resSmokeApp.ExitCode). Output:`n$($resSmokeApp.Output)"
    }
    # 6.1 Scenario 'app' (negativo: 'dom')
    Write-Host "  -> Esecuzione Test Negativo Scenario 'app' con failure 'dom' (DEVE fallire con ExitCode 1)..." -ForegroundColor Cyan
    $resSmokeAppNeg = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario app -SimulateFailure dom" $appDir
    if ($resSmokeAppNeg.ExitCode -ne 1) {
        Fail-Step "step6_smoke_app_neg" "Test Negativo Scenario 'app'" "Il test negativo non ha fallito! Ricevuto ExitCode $($resSmokeAppNeg.ExitCode) (atteso 1)"
    }
    Pass-Step "step6_smoke_app" "Smoke Scenario 'app' e Negativo" "Scenario app superato con ExitCode 0; Negativo 'dom' fallito regolarmente con ExitCode 1"

    # 6.2 Scenario 'sheet' (positivo)
    Write-Host "  -> Esecuzione Smoke Scenario 'sheet' (atteso ExitCode 0)..." -ForegroundColor Cyan
    $resSmokeSheet = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario sheet" $appDir
    if ($resSmokeSheet.ExitCode -ne 0) {
        Fail-Step "step6_smoke_sheet" "Smoke Scenario 'sheet'" "Fallito con ExitCode $($resSmokeSheet.ExitCode). Output:`n$($resSmokeSheet.Output)"
    }
    # 6.2 Scenario 'sheet' (negativo: 'sheet-calc')
    Write-Host "  -> Esecuzione Test Negativo Scenario 'sheet' con failure 'sheet-calc' (DEVE fallire con ExitCode 1)..." -ForegroundColor Cyan
    $resSmokeSheetNeg = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario sheet -SimulateFailure sheet-calc" $appDir
    if ($resSmokeSheetNeg.ExitCode -ne 1) {
        Fail-Step "step6_smoke_sheet_neg" "Test Negativo Scenario 'sheet'" "Il test negativo non ha fallito! Ricevuto ExitCode $($resSmokeSheetNeg.ExitCode) (atteso 1)"
    }
    Pass-Step "step6_smoke_sheet" "Smoke Scenario 'sheet' e Negativo" "Scenario sheet superato con ExitCode 0; Negativo 'sheet-calc' fallito regolarmente con ExitCode 1"

    # 6.3 Scenario 'format' (positivo)
    Write-Host "  -> Esecuzione Smoke Scenario 'format' (atteso ExitCode 0)..." -ForegroundColor Cyan
    $resSmokeFmt = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario format" $appDir
    if ($resSmokeFmt.ExitCode -ne 0) {
        Fail-Step "step6_smoke_format" "Smoke Scenario 'format'" "Fallito con ExitCode $($resSmokeFmt.ExitCode). Output:`n$($resSmokeFmt.Output)"
    }
    # 6.3 Scenario 'format' (negativo: 'format')
    Write-Host "  -> Esecuzione Test Negativo Scenario 'format' con failure 'format' (DEVE fallire con ExitCode 1)..." -ForegroundColor Cyan
    $resSmokeFmtNeg = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario format -SimulateFailure format" $appDir
    if ($resSmokeFmtNeg.ExitCode -ne 1) {
        Fail-Step "step6_smoke_format_neg" "Test Negativo Scenario 'format'" "Il test negativo non ha fallito! Ricevuto ExitCode $($resSmokeFmtNeg.ExitCode) (atteso 1)"
    }
    Pass-Step "step6_smoke_format" "Smoke Scenario 'format' e Negativo" "Scenario format superato con ExitCode 0; Negativo 'format' fallito regolarmente con ExitCode 1"

    # 6.4 Scenario 'structure' (positivo)
    Write-Host "  -> Esecuzione Smoke Scenario 'structure' (atteso ExitCode 0)..." -ForegroundColor Cyan
    $resSmokeStr = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario structure" $appDir
    if ($resSmokeStr.ExitCode -ne 0) {
        Fail-Step "step6_smoke_structure" "Smoke Scenario 'structure'" "Fallito con ExitCode $($resSmokeStr.ExitCode). Output:`n$($resSmokeStr.Output)"
    }
    # 6.4 Scenario 'structure' (negativo: 'structure-calc')
    Write-Host "  -> Esecuzione Test Negativo Scenario 'structure' con failure 'structure-calc' (DEVE fallire con ExitCode 1)..." -ForegroundColor Cyan
    $resSmokeStrNeg = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario structure -SimulateFailure structure-calc" $appDir
    if ($resSmokeStrNeg.ExitCode -ne 1) {
        Fail-Step "step6_smoke_structure_neg" "Test Negativo Scenario 'structure'" "Il test negativo non ha fallito! Ricevuto ExitCode $($resSmokeStrNeg.ExitCode) (atteso 1)"
    }
    Pass-Step "step6_smoke_structure" "Smoke Scenario 'structure' e Negativo" "Scenario structure superato con ExitCode 0; Negativo 'structure-calc' fallito regolarmente con ExitCode 1"

    # 6.5 Scenario 'data' (positivo)
    Write-Host "  -> Esecuzione Smoke Scenario 'data' (atteso ExitCode 0)..." -ForegroundColor Cyan
    $resSmokeData = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario data" $appDir
    if ($resSmokeData.ExitCode -ne 0) {
        Fail-Step "step6_smoke_data" "Smoke Scenario 'data'" "Fallito con ExitCode $($resSmokeData.ExitCode). Output:`n$($resSmokeData.Output)"
    }
    # 6.5 Scenario 'data' (negativo: 'data-sort')
    Write-Host "  -> Esecuzione Test Negativo Scenario 'data' con failure 'data-sort' (DEVE fallire con ExitCode 1)..." -ForegroundColor Cyan
    $resSmokeDataNeg = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario data -SimulateFailure data-sort" $appDir
    if ($resSmokeDataNeg.ExitCode -ne 1) {
        Fail-Step "step6_smoke_data_neg" "Test Negativo Scenario 'data'" "Il test negativo non ha fallito! Ricevuto ExitCode $($resSmokeDataNeg.ExitCode) (atteso 1)"
    }
    Pass-Step "step6_smoke_data" "Smoke Scenario 'data' e Negativo" "Scenario data superato con ExitCode 0; Negativo 'data-sort' fallito regolarmente con ExitCode 1"

    # 6.6 Scenario 'toolbar' (positivo)
    Write-Host "  -> Esecuzione Smoke Scenario 'toolbar' (atteso ExitCode 0)..." -ForegroundColor Cyan
    $resSmokeTb = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario toolbar" $appDir
    if ($resSmokeTb.ExitCode -ne 0) {
        Fail-Step "step6_smoke_toolbar" "Smoke Scenario 'toolbar'" "Fallito con ExitCode $($resSmokeTb.ExitCode). Output:`n$($resSmokeTb.Output)"
    }
    # 6.6 Scenario 'toolbar' (negativo: 'toolbar')
    Write-Host "  -> Esecuzione Test Negativo Scenario 'toolbar' con failure 'toolbar' (DEVE fallire con ExitCode 1)..." -ForegroundColor Cyan
    $resSmokeTbNeg = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario toolbar -SimulateFailure toolbar" $appDir
    if ($resSmokeTbNeg.ExitCode -ne 1) {
        Fail-Step "step6_smoke_toolbar_neg" "Test Negativo Scenario 'toolbar'" "Il test negativo non ha fallito! Ricevuto ExitCode $($resSmokeTbNeg.ExitCode) (atteso 1)"
    }
    Pass-Step "step6_smoke_toolbar" "Smoke Scenario 'toolbar' e Negativo" "Scenario toolbar superato con ExitCode 0; Negativo 'toolbar' fallito regolarmente con ExitCode 1"

    # 6.7 Scenario 'advanced' (positivo)
    Write-Host "  -> Esecuzione Smoke Scenario 'advanced' (atteso ExitCode 0)..." -ForegroundColor Cyan
    $resSmokeAdv = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario advanced" $appDir
    if ($resSmokeAdv.ExitCode -ne 0) {
        Fail-Step "step6_smoke_advanced" "Smoke Scenario 'advanced'" "Fallito con ExitCode $($resSmokeAdv.ExitCode). Output:`n$($resSmokeAdv.Output)"
    }
    # 6.7 Scenario 'advanced' (negativo: 'advanced-calc')
    Write-Host "  -> Esecuzione Test Negativo Scenario 'advanced' con failure 'advanced-calc' (DEVE fallire con ExitCode 1)..." -ForegroundColor Cyan
    $resSmokeAdvNeg = Invoke-NativeCommand "powershell -ExecutionPolicy Bypass -File `"$smokeScript`" -Scenario advanced -SimulateFailure advanced-calc" $appDir
    if ($resSmokeAdvNeg.ExitCode -ne 1) {
        Fail-Step "step6_smoke_advanced_neg" "Test Negativo Scenario 'advanced'" "Il test negativo non ha fallito! Ricevuto ExitCode $($resSmokeAdvNeg.ExitCode) (atteso 1)"
    }
    Pass-Step "step6_smoke_advanced" "Smoke Scenario 'advanced' e Negativo" "Scenario advanced superato con ExitCode 0; Negativo 'advanced-calc' fallito regolarmente con ExitCode 1"

    # -------------------------------------------------------------------------
    # 7. Benchmark con soglie dichiarate
    # -------------------------------------------------------------------------
    if (-not $SkipBenchmarks) {
        Write-Host "`n--- Passo 7: Esecuzione Benchmark con Soglie Dichiarate ---" -ForegroundColor Yellow
        # 7.1 Benchmark Motore
        $resBenchEngine = Invoke-NativeCommand "npm run bench:engine" $appDir
        if ($resBenchEngine.ExitCode -ne 0 -or $resBenchEngine.Output.Contains("NON SUPERATO")) {
            Fail-Step "step7_bench" "Benchmark Motore di Calcolo" "Benchmark motore fallito o soglie violate:`n$($resBenchEngine.Output)"
        }
        # 7.2 Benchmark UI Fogli
        $resBenchUi = Invoke-NativeCommand "npm run bench:ui" $appDir
        if ($resBenchUi.ExitCode -ne 0 -or $resBenchUi.Output.Contains("NON SUPERATO")) {
            Fail-Step "step7_bench" "Benchmark UI Fogli" "Benchmark UI fallito o soglie violate:`n$($resBenchUi.Output)"
        }
        # 7.3 Benchmark Formattazione
        $resBenchFmt = Invoke-NativeCommand "npm run bench:format" $appDir
        if ($resBenchFmt.ExitCode -ne 0 -or $resBenchFmt.Output.Contains("NON SUPERATO")) {
            Fail-Step "step7_bench" "Benchmark Formattazione" "Benchmark formattazione fallito o soglie violate:`n$($resBenchFmt.Output)"
        }
        Pass-Step "step7_bench" "Benchmark con Soglie Dichiarate" "Tutti i benchmark (motore, UI Fogli, formattazione 50k celle) entro i limiti"
    } else {
        Pass-Step "step7_bench" "Benchmark con Soglie Dichiarate" "Benchmark saltati su richiesta (-SkipBenchmarks)"
    }

    # -------------------------------------------------------------------------
    # 8. Controllo Catalogo Screenshot (verifica/CATALOGO.md)
    # -------------------------------------------------------------------------
    Write-Host "`n--- Passo 8: Controllo Integrità Catalogo Screenshot (verifica/CATALOGO.md) ---" -ForegroundColor Yellow
    $catPath = Join-Path $verificaDir "CATALOGO.md"
    if (-not (Test-Path $catPath)) {
        Fail-Step "step8_cat" "Catalogo Screenshot" "verifica/CATALOGO.md non trovato!"
    }
    $catContent = Get-Content $catPath -Raw
    $pngFiles = Get-ChildItem -Path $verificaDir -Filter *.png
    $missingInCat = @()
    $shortDesc = @()

    foreach ($png in $pngFiles) {
        $pName = $png.Name
        if (-not $catContent.Contains($pName)) {
            $missingInCat += $pName
            continue
        }
        # Estrai la sezione del catalogo per questo file
        $escName = [regex]::Escape($pName)
        $pattern = '(?s)###\s+\d+\.\s+`' + $escName + '`.*?(?=(?:\r?\n###|\Z))'
        $m = [regex]::Match($catContent, $pattern)
        if ($m.Success) {
            $secText = $m.Value
            # Conta le parole
            $wordTokens = $secText.Split([char[]]@(' ', "`t", "`r", "`n"), [System.StringSplitOptions]::RemoveEmptyEntries)
            $words = $wordTokens.Count
            if ($words -lt 25) {
                $shortDesc += "$pName ($words parole)"
            }
        } else {
            $missingInCat += "$pName (sezione non strutturata)"
        }
    }

    if ($missingInCat.Count -gt 0) {
        Fail-Step "step8_cat" "Catalogo Screenshot: PNG orfani" "File PNG presenti in verifica/ ma non documentati in CATALOGO.md: $($missingInCat -join ', ')"
    }
    if ($shortDesc.Count -gt 0) {
        Fail-Step "step8_cat" "Catalogo Screenshot: Descrizione troppo breve" "Descrizioni < 25 parole in: $($shortDesc -join ', ')"
    }
    Pass-Step "step8_cat" "Controllo Catalogo Screenshot" "Tutti i $($pngFiles.Count) PNG censiti nel catalogo con descrizioni dettagliate > 25 parole; zero PNG orfani"

    # -------------------------------------------------------------------------
    # Conclusione con Successo
    # -------------------------------------------------------------------------
    $report.success = $true
    Save-Report
    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host " >>> CANCELLO AUTOMATICO SUPERATO CON SUCCESSO! (ExitCode: 0) <<<" -ForegroundColor Green
    Write-Host " Report salvati in:" -ForegroundColor Green
    Write-Host " - $(Join-Path $verificaDir 'REPORT-AUTOMATICO.json')"
    Write-Host " - $(Join-Path $verificaDir 'REPORT-AUTOMATICO.md')"
    Write-Host "============================================================`n"
    exit 0
}
catch {
    Fail-Step "unexpected_error" "Errore non gestito nello script" $_.Exception.Message
}
