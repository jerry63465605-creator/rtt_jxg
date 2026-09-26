# Analyze the top-right icon region of each card image.
# Output per image: size + a coarse 6x8 grid of white-pixel density,
# which is enough to tell ?, !, up-arrow, double-chevron apart.
Add-Type -AssemblyName System.Drawing

$dir = "c:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards"
$files = Get-ChildItem $dir -Filter *.png | Sort-Object Name

foreach ($f in $files) {
	$img = [System.Drawing.Bitmap]::FromFile($f.FullName)
	try {
		$w = $img.Width; $h = $img.Height
		# icon zone: right-top. For a ~384x512 card, take x in [0.72w, 0.97w], y in [0.02h, 0.20h]
		$x0 = [int]($w * 0.72); $x1 = [int]($w * 0.97)
		$y0 = [int]($h * 0.02); $y1 = [int]($h * 0.20)
		$gw = 6; $gh = 8
		$cw = [math]::Ceiling(($x1 - $x0) / $gw)
		$ch = [math]::Ceiling(($y1 - $y0) / $gh)
		$rows = @()
		for ($gy = 0; $gy -lt $gh; $gy++) {
			$line = ""
			for ($gx = 0; $gx -lt $gw; $gx++) {
				$white = 0; $total = 0
				for ($x = $x0 + $gx * $cw; $x -lt [math]::Min($x0 + ($gx + 1) * $cw, $x1); $x += 2) {
					for ($y = $y0 + $gy * $ch; $y -lt [math]::Min($y0 + ($gy + 1) * $ch, $y1); $y += 2) {
						$p = $img.GetPixel($x, $y)
						$total++
						if (($p.R + $p.G + $p.B) / 3 -gt 200) { $white++ }
					}
				}
				if ($total -eq 0) { $line += "." }
				else {
					$r = $white / $total
					if ($r -gt 0.55) { $line += "#" }
					elseif ($r -gt 0.25) { $line += "+" }
					elseif ($r -gt 0.08) { $line += "-" }
					else { $line += "." }
				}
			}
			$rows += $line
		}
		Write-Output ("== " + $f.Name + " (" + $w + "x" + $h + ")")
		$rows | ForEach-Object { Write-Output ("   " + $_) }
	} finally {
		$img.Dispose()
	}
}
