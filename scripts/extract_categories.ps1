$xmllerDir = Join-Path $PSScriptRoot "..\docs\xmller"
$lustrinPath = "$xmllerDir\lustrin.com.tr.xml"
$etikaPath = "$xmllerDir\ETIKA_XML.xml"
$janesPath = "$xmllerDir\janestoptanxmltr.xml"

$categories = [System.Collections.Generic.HashSet[string]]::new()

Write-Host "Parsing Lustrin..."
if (Test-Path $lustrinPath) {
    Get-Content $lustrinPath -Encoding utf8 -ReadCount 2000 | ForEach-Object {
        foreach ($line in $_) {
            if ($line -match "<KategoriTree>(.*?)</KategoriTree>") {
                $val = $Matches[1].Trim()
                $val = $val -replace "&gt;", ">" -replace "&amp;", "&"
                $parts = $val.Split('/') | ForEach-Object { $_.Trim() }
                $unified = $parts -join " > "
                [void]$categories.Add("Lustrin > $unified")
            }
        }
    }
}

Write-Host "Parsing Etika..."
if (Test-Path $etikaPath) {
    Get-Content $etikaPath -Encoding utf8 -ReadCount 2000 | ForEach-Object {
        foreach ($line in $_) {
            if ($line -match "<categoryPath>(.*?)</categoryPath>") {
                $val = $Matches[1].Trim()
                $val = $val -replace "&gt;", ">" -replace "&amp;", "&"
                $parts = $val.Split('>') | ForEach-Object { $_.Trim() }
                $unified = $parts -join " > "
                [void]$categories.Add("Etika > $unified")
            }
        }
    }
}

Write-Host "Parsing Jane's..."
if (Test-Path $janesPath) {
    Get-Content $janesPath -Encoding utf8 -ReadCount 2000 | ForEach-Object {
        foreach ($line in $_) {
            if ($line -match "<KategoriTree>(.*?)</KategoriTree>") {
                $val = $Matches[1].Trim()
                $val = $val -replace "&gt;", ">" -replace "&amp;", "&"
                $parts = $val.Split('/') | ForEach-Object { $_.Trim() }
                $unified = $parts -join " > "
                [void]$categories.Add("Jane's > $unified")
            }
        }
    }
}

[void]$categories.Add("Black Fashion > Uncategorized")

$sortedPaths = $categories | Sort-Object

# Build the tree
$tree = @{}

foreach ($path in $sortedPaths) {
    $parts = $path -split " > "
    $current = $tree
    foreach ($part in $parts) {
        if (-not $current.ContainsKey($part)) {
            $current[$part] = @{}
        }
        $current = $current[$part]
    }
}

function Format-Tree($node, $depth = 0) {
    $output = ""
    $keys = $node.Keys | Sort-Object
    foreach ($key in $keys) {
        $indent = "  " * $depth
        $prefix = if ($depth -eq 0) { "+ " } else { "  - " }
        $output += "$indent$prefix$key`r`n"
        $output += Format-Tree $node[$key] ($depth + 1)
    }
    return $output
}

$formattedTree = "TOPTAN TEKSTIL KATEGORI AGACI`r`n=========================================`r`n`r`n"
$formattedTree += Format-Tree $tree

$formattedTree | Out-File -FilePath (Join-Path $PSScriptRoot "..\docs\kategoriler.txt") -Encoding utf8
Write-Host "Categories saved successfully to docs/kategoriler.txt"
