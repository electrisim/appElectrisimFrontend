# PowerShell script to restore all backup files
# This will restore files to their state before performance optimization

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESTORING FILES FROM BACKUP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$backupFiles = @(
    "src\main\webapp\js\electrisim\core.js.backup",
    "src\main\webapp\js\electrisim\sw-register.js.backup",
    "src\main\webapp\js\electrisim\performance-metrics.js.backup",
    "src\main\webapp\js\electrisim\third-party-optimizer.js.backup",
    "src\main\webapp\js\electrisim\lazy-loader.js.backup",
    "src\main\webapp\index.html.backup",
    "src\main\webapp\js\electrisim\supportingFunctions.js.backup",
    "src\main\webapp\js\electrisim\safe-performance-optimizer.js.backup",
    "src\main\webapp\js\electrisim\dialogs\ComponentsDataDialog.js.backup",
    "src\main\webapp\js\electrisim\transformerBaseDialog.js.backup",
    "src\main\webapp\js\electrisim\staticGeneratorDialog.js.backup",
    "src\main\webapp\js\electrisim\shuntReactorDialog.js.backup",
    "src\main\webapp\js\electrisim\externalGridDialog.js.backup",
    "src\main\webapp\js\electrisim\capacitorDialog.js.backup",
    "src\main\webapp\js\electrisim\generatorDialog.js.backup",
    "src\main\webapp\js\electrisim\loadDialog.js.backup",
    "src\main\webapp\js\electrisim\lineBaseDialog.js.backup",
    "src\main\webapp\js\electrisim\busDialog.js.backup",
    "src\main\webapp\js\electrisim\loadflowOpenDss.js.backup",
    "src\main\webapp\js\electrisim\loadFlow.js.backup",
    "src\main\webapp\js\electrisim\shortCircuit.js.backup",
    "src\main\webapp\js\electrisim\dialogs\OptimalPowerFlowDialog.js.backup",
    "src\main\webapp\js\electrisim\dialogs\LoadFlowDialog.js.backup",
    "src\main\webapp\js\electrisim\dialogs\EditDataDialog.js.backup",
    "src\main\webapp\js\electrisim\optimalPowerFlow.js.backup",
    "src\main\webapp\js\electrisim\controllerSimulation.js.backup",
    "src\main\webapp\js\electrisim\timeSeriesSimulation.js.backup",
    "src\main\webapp\js\electrisim\transformerLibraryDialog.js.backup",
    "src\main\webapp\js\electrisim\lineLibraryDialog.js.backup",
    "src\main\webapp\js\electrisim\contingencyAnalysis.js.backup",
    "src\main\webapp\js\electrisim\dialogs\ContingencyDialog.js.backup",
    "src\main\webapp\js\electrisim\dialogs\ShortCircuitDialog.js.backup"
)

$restored = 0
$failed = 0
$notFound = 0

foreach ($backupFile in $backupFiles) {
    $fullBackupPath = Join-Path $PSScriptRoot $backupFile
    $originalFile = $backupFile -replace '\.backup$', ''
    $fullOriginalPath = Join-Path $PSScriptRoot $originalFile
    
    Write-Host "Processing: $originalFile" -NoNewline
    
    if (Test-Path $fullBackupPath) {
        try {
            # Copy backup to original (overwrite if exists)
            Copy-Item -Path $fullBackupPath -Destination $fullOriginalPath -Force
            Write-Host " [RESTORED]" -ForegroundColor Green
            $restored++
        }
        catch {
            Write-Host " [FAILED: $($_.Exception.Message)]" -ForegroundColor Red
            $failed++
        }
    }
    else {
        Write-Host " [BACKUP NOT FOUND]" -ForegroundColor Yellow
        $notFound++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESTORATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Restored: $restored files" -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host "❌ Failed: $failed files" -ForegroundColor Red
}
if ($notFound -gt 0) {
    Write-Host "⚠️  Not Found: $notFound files" -ForegroundColor Yellow
}
Write-Host ""

if ($restored -gt 0) {
    Write-Host "🎉 Files have been restored to their pre-optimization state!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Clear browser cache and service worker" -ForegroundColor White
    Write-Host "2. Reload the application" -ForegroundColor White
    Write-Host "3. Test that everything works correctly" -ForegroundColor White
    Write-Host ""
    Write-Host "To clear service worker, visit:" -ForegroundColor White
    Write-Host "http://127.0.0.1:5501/src/main/webapp/clear-sw-cache.html" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

