# Fix import paths in DataHub directory
# The issue: imports need correct number of ../ based on file depth

$rootPath = "C:\Users\simin\Desktop\github\AntiGravity\TitanGold"
$dataHubPath = Join-Path $rootPath "components\ai\AIManager\tabs\DataHub"

# Get all .tsx files recursively
$files = Get-ChildItem -Path $dataHubPath -Recurse -Filter "*.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $relativePath = $file.FullName.Replace($rootPath + "\", "").Replace("\", "/")
    
    # Calculate depth (number of / in path)
    $depth = ($relativePath -split "/").Count - 1
    
    # Build the correct relative path to root
    $pathToRoot = "../" * $depth
    
    Write-Host "File: $relativePath (depth: $depth)"
    
    # Fix imports - remove .ts/.tsx extensions first
    $newContent = $content -replace 'from\s+([''"])(.+?)\.tsx?\1', 'from $1$2$1'
    
    # Note: We're only removing extensions, not changing path depths
    # because different files are at different depths
    
    if ($content -ne $newContent) {
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        Write-Host "  Fixed extensions in: $($file.Name)"
    }
}

Write-Host "`nDone! All .ts/.tsx extensions removed from imports."
