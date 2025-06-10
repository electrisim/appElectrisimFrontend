# PowerShell script to fix External Grid connection points in app.min.js

$appMinJsPath = "js\app.min.js"
$backupPath = "js\app.min.js.backup"

# Create backup if it doesn't exist
if (-not (Test-Path $backupPath)) {
    Write-Host "Creating backup of app.min.js..."
    Copy-Item $appMinJsPath $backupPath
}

# Read the file content
Write-Host "Reading app.min.js..."
$content = Get-Content $appMinJsPath -Raw

# Replace the External Grid palette entry to use a custom shape instead of voltage_regulator
$oldPattern = 'voltage_regulator;points=\[\[0\.5,1\]\];shapeELXXX=External Grid'
$newPattern = 'shape=externalGridCustom;shapeELXXX=External Grid'

Write-Host "Replacing External Grid palette definition..."
$newContent = $content -replace $oldPattern, $newPattern

# Check if replacement was made
if ($newContent -eq $content) {
    Write-Host "Pattern not found, trying original voltage_regulator pattern..."
    $oldPattern2 = 'voltage_regulator;shapeELXXX=External Grid'
    $newPattern2 = 'shape=externalGridCustom;shapeELXXX=External Grid'
    $newContent = $content -replace $oldPattern2, $newPattern2
    
    if ($newContent -eq $content) {
        Write-Host "No replacement made - checking current content..."
        $currentExtGridLine = $content | Select-String -Pattern "External Grid"
        Write-Host "Current External Grid line: $currentExtGridLine"
    } else {
        Write-Host "Replacement made with original pattern"
    }
} else {
    Write-Host "Replacement made with points pattern"
}

# Write the modified content back
Write-Host "Writing modified app.min.js..."
Set-Content $appMinJsPath $newContent -NoNewline

Write-Host "External Grid fix applied successfully!"
Write-Host "The External Grid will now use a custom shape with only one connection point at the bottom." 