<# 裁剪图标区放大4x，拼成带文件名标注的网格图，供肉眼终审 #>
param([string[]]$Files)
Add-Type -AssemblyName System.Drawing
$dir = "c:/Users/24968/Desktop/rtt/out/cards_sliced"
$outDir = "c:/Users/24968/Desktop/rtt/out/icon_zoom"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
if (-not $Files -or $Files.Count -eq 0) {
	$Files = @(
		"sheet168_r0_c0.png","sheet168_r0_c1.png","sheet168_r0_c2.png","sheet168_r0_c3.png","sheet168_r0_c4.png"
	)
}
$cell = 300   # 每格 300x220（4x 放大后图标约 140x200）
$labelH = 26
$cols = 5
$rows = [math]::Ceiling($Files.Count / $cols)
$canvas = New-Object System.Drawing.Bitmap ($cell * $cols), ($rows * ($cell * 0.75 + $labelH))
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.Clear([System.Drawing.Color]::FromArgb(40,40,40))
$font = New-Object System.Drawing.Font "Consolas", 11
$brush = [System.Drawing.Brushes]::White
for ($i = 0; $i -lt $Files.Count; $i++) {
	$src = [System.Drawing.Bitmap]::FromFile((Join-Path $dir $Files[$i]))
	try {
		$w = $src.Width; $h = $src.Height
		$x0 = [int]($w * 0.62); $y0 = 0; $cw = [int]($w * 0.38); $ch = [int]($h * 0.24)
		$crop = $src.Clone((New-Object System.Drawing.Rectangle $x0, $y0, $cw, $ch), $src.PixelFormat)
		$scale = 3.2
		$zw = [int]($cw * $scale); $zh = [int]($ch * $scale)
		$zoom = New-Object System.Drawing.Bitmap $zw, $zh
		$gz = [System.Drawing.Graphics]::FromImage($zoom)
		$gz.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
		$gz.DrawImage($crop, 0, 0, $zw, $zh)
		$gz.Dispose()
		$col = $i % $cols; $row = [math]::Floor($i / $cols)
		$px = $col * $cell; $py = $row * ($zh + $labelH)
		$g.DrawImage($zoom, $px, $py, $zw, $zh)
		$g.DrawString($Files[$i], $font, $brush, $px, $py + $zh + 2)
		$zoom.Dispose(); $crop.Dispose()
	} finally { $src.Dispose() }
}
$g.Dispose()
$outFile = Join-Path $outDir "grid.png"
$canvas.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose()
Write-Output "saved: $outFile  ($($Files.Count) cards, ${cols} cols x $rows rows)"
