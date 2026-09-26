# Annotate the 10x7 Taranto sprite sheet with grid lines + r{r}c{c} labels,
# then downscale for a single-shot visual locate by the vision model.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$SRC = 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images/httpssteamusercontentaakamaihdnetugc98771674456600334280021BFB65ED27DC09B2776CCEBCEAAC560C6DC1E.png'
$OUTDIR = 'C:/Users/24968/Desktop/rtt/out/probe_15349'
$OUT = Join-Path $OUTDIR 'annotated_small.png'
$NW = 10; $NH = 7
$TARGET_W = 1600

$src = [System.Drawing.Image]::FromFile($SRC)
$scale = $TARGET_W / $src.Width
$tw = [int]($src.Width * $scale)
$th = [int]($src.Height * $scale)
$cw = [int]($tw / $NW)
$ch = [int]($th / $NH)

$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]$tw, [int]$th)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, $tw, $th)

$pen = New-Object System.Drawing.Pen -ArgumentList @([System.Drawing.Color]::Red, 2)
for ($r = 0; $r -le $NH; $r++) {
    $g.DrawLine($pen, 0, ($r * $ch), $tw, ($r * $ch))
}
for ($c = 0; $c -le $NW; $c++) {
    $g.DrawLine($pen, ($c * $cw), 0, ($c * $cw), $th)
}

$font = New-Object System.Drawing.Font -ArgumentList @('Arial', 16, [System.Drawing.FontStyle]::Bold)
$fill = [System.Drawing.Brushes]::Yellow
$back = New-Object System.Drawing.SolidBrush -ArgumentList @([System.Drawing.Color]::FromArgb(160, 0, 0, 0))
for ($r = 0; $r -lt $NH; $r++) {
    for ($c = 0; $c -lt $NW; $c++) {
        $label = "r${r}c${c}"
        $x = $c * $cw + 4
        $y = $r * $ch + 4
        $sz = $g.MeasureString($label, $font)
        $g.FillRectangle($back, $x, $y, ([int]$sz.Width + 6), ([int]$sz.Height + 2))
        $g.DrawString($label, $font, $fill, $x, $y)
    }
}
$g.Dispose()
$bmp.Save($OUT, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$src.Dispose()
Write-Host ("annotated: " + $OUT + "  (" + $tw + " x " + $th + ")")
Write-Host 'DONE'
