param()
# ASCII-only source; zip path / prefix / outdir come from env vars
$Zip = $env:ZIPPATH
$Prefix = $env:ZIPPREFIX
$Out = $env:ZIPOUT
if (-not $Zip -or -not $Out) { Write-Output "NO ZIPPATH/ZIPOUT"; exit 1 }
if (-not (Test-Path -LiteralPath $Out)) { New-Item -ItemType Directory -Path $Out -Force | Out-Null }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [IO.Compression.ZipFile]::OpenRead($Zip)
$n = 0
foreach ($e in $z.Entries) {
  if ($Prefix -ne '' -and -not $e.FullName.StartsWith($Prefix)) { continue }
  if ($e.FullName.EndsWith('/')) { continue }
  $dest = Join-Path $Out $e.FullName.Replace('/', '\')
  $dir = Split-Path -Parent $dest
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  try {
    [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
    $n++
  } catch { Write-Output ("FAIL " + $e.FullName + " : " + $_.Exception.Message) }
}
$z.Dispose()
Write-Output ("extracted " + $n + " files -> " + $Out)
