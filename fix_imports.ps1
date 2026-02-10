$files = Get-ChildItem -Path "components/ai/AIManager/tabs/DataHub" -Recurse -Filter "*.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Remove .ts and .tsx extensions from imports
    $newContent = $content -replace "from\s+(['""])(.+?)\.tsx?\1", 'from $1$2$1'
    
    if ($content -ne $newContent) {
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        Write-Host "Fixed: $($file.FullName)"
    }
}

Write-Host "Done! All import extensions removed."
