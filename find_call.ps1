$content = [System.IO.File]::ReadAllText('C:\Users\DELL\.vscode\appElectrisim\appElectrisim\src\main\webapp\js\electrisim\loadFlow.js')

# processNetworkData is both defined and called inline. Find where it's invoked with arguments
# It's defined as: async function processNetworkData(e,t,n,r)
# and called right after with the payload. Search for the invocation.
$searchStr = 'processNetworkData('
$idx = $content.IndexOf($searchStr)
# Skip the definition, find the actual call
$idx = $content.IndexOf($searchStr, $idx + 20)
if($idx -ge 0){
    $start = [Math]::Max(0, $idx - 300)
    $len = [Math]::Min(800, $content.Length - $start)
    Write-Output "=== processNetworkData invocation ==="
    Write-Output $content.Substring($start, $len)
    Write-Output ""
}

# Find where q (the payload) is created
$searchStr2 = 'const q='
$idx2 = $content.IndexOf($searchStr2)
if($idx2 -ge 0){
    $start = [Math]::Max(0, $idx2 - 100)
    $len = [Math]::Min(600, $content.Length - $start)
    Write-Output "=== payload q creation ==="
    Write-Output $content.Substring($start, $len)
    Write-Output ""
}

# Find m object which holds all the component data
$searchStr3 = 'const m='
$idx3 = $content.IndexOf($searchStr3)
if($idx3 -ge 0){
    $len = [Math]::Min(500, $content.Length - $idx3)
    Write-Output "=== m object definition ==="
    Write-Output $content.Substring($idx3, $len)
}
