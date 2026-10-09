<# 输出图标区域逐行白像素宽度 profile，用于确认 ↑/⇈ 形状特征 #>
param([string[]]$Files)
Add-Type -AssemblyName System.Drawing
$dir = "c:/Users/24968/Desktop/rtt/out/cards_sliced"
if (-not $Files -or $Files.Count -eq 0) {
	$Files = @("sheet153_r1_c5.png","sheet153_r3_c8.png","sheet152_r4_c6.png","sheet177_r4_c0.png")
}
foreach ($f in $Files) {
	$bmp = [System.Drawing.Bitmap]::FromFile((Join-Path $dir $f))
	try {
		$w = $bmp.Width; $h = $bmp.Height
		Write-Output ("--- {0}  size={1}x{2}" -f $f, $w, $h)
		$x0 = [int]($w * 0.64); $x1 = [int]($w * 0.99) - 1
		$y0 = [int]($h * 0.01); $y1 = [int]($h * 0.22) - 1
		for ($y = $y0; $y -le $y1; $y++) {
			$cnt = 0
			for ($x = $x0; $x -le $x1; $x++) {
				$c = $bmp.GetPixel($x, $y)
				if ($c.R -gt 210 -and $c.G -gt 210 -and $c.B -gt 210) { $cnt++ }
			}
			if ($cnt -gt 0) { Write-Output ("y={0} w={1}" -f $y, $cnt) }
		}
	} finally { $bmp.Dispose() }
}
