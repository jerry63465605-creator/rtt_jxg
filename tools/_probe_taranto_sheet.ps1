# Probe every cell of the 10x7 Taranto sprite sheet.
# 1) slice all 70 cells -> out/probe_15349/r{r}c{c}.png
# 2) report file sizes (blank cells are tiny)
# 3) build one contact sheet of non-blank cells with r{r}c{c} labels
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$SRC = 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images/httpssteamusercontentaakamaihdnetugc98771674456600334280021BFB65ED27DC09B2776CCEBCEAAC560C6DC1E.png'
$ROOT = 'C:/Users/24968/Desktop/rtt'
$OUT = Join-Path $ROOT 'out/probe_15349'
$NW = 10; $NH = 7

if (Test-Path $OUT) { Remove-Item $OUT -Recurse -Force }
New-Item -ItemType Directory -Path $OUT | Out-Null

$src = [System.Drawing.Image]::FromFile($SRC)
$cw = [int]($src.Width / $NW)
$ch = [int]($src.Height / $NH)
Write-Host ("source: " + $src.Width + " x " + $src.Height + "  cell: " + $cw + " x " + $ch)

$sizes = @{}
for ($r = 0; $r -lt $NH; $r++) {
    for ($c = 0; $c -lt $NW; $c++) {
        $rect = New-Object System.Drawing.Rectangle -ArgumentList @([int]($c*$cw), [int]($r*$ch), [int]$cw, [int]$ch)
        $dst  = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]$cw, [int]$ch)
        $bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]$cw, [int]$ch)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.DrawImage($src, $dst, $rect, [System.Drawing.GraphicsUnit]::Pixel)
        $g.Dispose()
        $f = Join-Path $OUT ("r" + $r + "c" + $c + ".png")
        $bmp.Save($f, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $sizes["r${r}c${c}"] = (Get-Item $f).Length
    }
}
$src.Dispose()

Write-Host "--- cell sizes (bytes) ---"
foreach ($k in ($sizes.Keys | Sort-Object)) {
    Write-Host ("$k = " + $sizes[$k])
}

# ---- contact sheet: keep cells > 50KB, thumb 190x285, 5 per row, label r{r}c{c} ----
$keep = @()
foreach ($r in 0..($NH-1)) {
    foreach ($c in 0..($NW-1)) {
        $k = "r${r}c${c}"
        if ($sizes[$k] -gt 50000) { $keep += @(@($r, $c)) }
    }
}
Write-Host ("non-blank cells: " + $keep.Count + " / " + ($NW*$NH))

$tw = 190; $th = 285; $labelH = 22; $pad = 6
$cols = [Math]::Min(5, [Math]::Max(1, $keep.Count))
$rows = [Math]::Ceiling($keep.Count / $cols)
$W = $cols * ($tw + $pad) + $pad
$H = $rows * ($th + $labelH + $pad) + $pad
$sheet = New-Object System.Drawing.Bitmap -ArgumentList @([int]$W, [int]$H)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(26,26,26))
$font = New-Object System.Drawing.Font -ArgumentList @('Arial', 12, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Yellow
for ($i = 0; $i -lt $keep.Count; $i++) {
    $r = $keep[$i][0]; $c = $keep[$i][1]
    $px = $pad + ($i % $cols) * ($tw + $pad)
    $py = $pad + [Math]::Floor($i / $cols) * ($th + $labelH + $pad)
    $img = [System.Drawing.Image]::FromFile((Join-Path $OUT ("r" + $r + "c" + $c + ".png")))
    $g.DrawImage($img, $px, ($py + $labelH), $tw, $th)
    $g.DrawString(("r" + $r + "c" + $c), $font, $brush, $px, $py)
    $img.Dispose()
}
$g.Dispose()
$sheetPath = Join-Path $OUT 'contact_sheet.png'
$sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
Write-Host ("contact sheet: " + $sheetPath + "  (" + $W + " x " + $H + ")")
Write-Host 'DONE'
