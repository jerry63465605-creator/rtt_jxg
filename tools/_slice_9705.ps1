# Slice a big sheet into an overview + tiles for OCR / visual reading.
# ASCII-only script (PowerShell 5.1 reads BOM-less .ps1 as GBK -> Chinese breaks).
param(
    [string]$Src = "c:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards_tts\sheet_9705892066924990912.png",
    [string]$Out = "c:\Users\24968\Desktop\rtt\out\zoom_9705892066924990912",
    [int]$Cols = 6,
    [int]$Rows = 3,
    [int]$OverviewWidth = 1600
)

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$bmp = [System.Drawing.Bitmap]::FromFile($Src)
Write-Output ("source " + $bmp.Width + " x " + $bmp.Height)

# 1) overview
$oh = [int]($bmp.Height * $OverviewWidth / $bmp.Width)
$ov = New-Object System.Drawing.Bitmap $OverviewWidth, $oh
$g = [System.Drawing.Graphics]::FromImage($ov)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bmp, 0, 0, $OverviewWidth, $oh)
$g.Dispose()
$ov.Save((Join-Path $Out "overview.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$ov.Dispose()
Write-Output ("overview " + $OverviewWidth + " x " + $oh)

# 2) tiles
$tw = [int]($bmp.Width / $Cols)
$th = [int]($bmp.Height / $Rows)
Write-Output ("tile " + $tw + " x " + $th)
for ($r = 0; $r -lt $Rows; $r++) {
    for ($c = 0; $c -lt $Cols; $c++) {
        $rect = New-Object System.Drawing.Rectangle ($c * $tw), ($r * $th), $tw, $th
        $t = $bmp.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppRgb)
        $name = "tile_r" + $r + "_c" + $c + ".png"
        $t.Save((Join-Path $Out $name), [System.Drawing.Imaging.ImageFormat]::Png)
        $t.Dispose()
    }
}
$bmp.Dispose()
Write-Output ("done -> " + $Out)
