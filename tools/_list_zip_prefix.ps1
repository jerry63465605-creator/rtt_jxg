param([int]$Limit = 200)
$Zip = $env:ZIPPATH
$Prefix = $env:ZIPPREFIX
if (-not $Zip) { Write-Output "NO ZIPPATH"; exit 1 }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [IO.Compression.ZipFile]::OpenRead($Zip)
$list = $z.Entries | Where-Object { $Prefix -eq '' -or $_.FullName.StartsWith($Prefix) } | Sort-Object FullName
Write-Output ("prefix='" + $Prefix + "'  matched=" + $list.Count)
$list | Select-Object -First $Limit | ForEach-Object {
  Write-Output ("{0,-86} {1,9} KB" -f $_.FullName, [math]::Round($_.Length / 1KB, 1))
}
$z.Dispose()
