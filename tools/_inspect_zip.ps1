param([int]$TopN = 40)

# NOTE: 必须保持纯 ASCII 源码；中文路径通过环境变量 ZIPPATH 传入
# （PowerShell 5.1 以 ANSI 读取 -File 脚本，源码里出现中文会被解析坏）
$Zip = $env:ZIPPATH
if (-not $Zip -or -not (Test-Path -LiteralPath $Zip)) { Write-Output "ZIP NOT FOUND: $Zip"; exit 1 }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [IO.Compression.ZipFile]::OpenRead($Zip)
$entries = $z.Entries

Write-Output "=== BASIC ==="
Write-Output ("zip  = " + $Zip)
Write-Output ("entries = " + $entries.Count)
$total = ($entries | Measure-Object -Property Length -Sum).Sum
Write-Output ("uncompressed = " + [math]::Round($total / 1MB, 2) + " MB")
Write-Output ("compressed   = " + [math]::Round((Get-Item -LiteralPath $Zip).Length / 1MB, 2) + " MB")

Write-Output ""
Write-Output "=== TOP LEVEL ==="
$groups = $entries | Group-Object {
  $p = $_.FullName.TrimStart('/')
  $i = $p.IndexOf('/')
  if ($i -lt 0) { '(root files)' } else { $p.Substring(0, $i) }
} | Sort-Object Count -Descending
foreach ($g in $groups | Select-Object -First $TopN) {
  $sz = ($g.Group | Measure-Object -Property Length -Sum).Sum
  Write-Output ("{0,-44} {1,6} files {2,9} MB" -f $g.Name, $g.Count, [math]::Round($sz / 1MB, 2))
}

Write-Output ""
Write-Output "=== BY EXTENSION ==="
$entries | Group-Object { [IO.Path]::GetExtension($_.FullName).ToLower() } |
  Sort-Object Count -Descending | Select-Object -First 15 |
  ForEach-Object {
    $sz = ($_.Group | Measure-Object -Property Length -Sum).Sum
    $nm = $_.Name; if (-not $nm) { $nm = '(none)' }
    Write-Output ("{0,-12} {1,6} files {2,9} MB" -f $nm, $_.Count, [math]::Round($sz / 1MB, 2))
  }

Write-Output ""
Write-Output "=== KEY FILES ==="
$entries | Where-Object { $_.FullName -match '(rules|cards|play|readme|version|package|index)\.(js|json|html|md|txt)$' } |
  Sort-Object FullName | Select-Object -First 40 |
  ForEach-Object { Write-Output ("{0,-72} {1,9} KB" -f $_.FullName, [math]::Round($_.Length / 1KB, 1)) }

$z.Dispose()
