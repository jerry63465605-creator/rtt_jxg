<# 
  最终版：↑增强卡 / ⇈状态卡 判别
  判据：图标区宽度 profile 中"下降事件"数（降幅>=6 且起点>=20，事件间有稳定/上升分隔）
  =1 -> 单箭头 ↑（增强卡 EFFECT）  >=2 -> 双箭头 ⇈（状态卡 STATUS）
#>
param([string[]]$Targets)
Add-Type -AssemblyName System.Drawing
$dir = "c:/Users/24968/Desktop/rtt/out/cards_sliced"

function Test-Arrow2 {
	param([string]$file)
	$bmp = [System.Drawing.Bitmap]::FromFile($file)
	try {
		$w = $bmp.Width; $h = $bmp.Height
		$x0 = [int]($w * 0.64); $x1 = [int]($w * 0.99) - 1
		$y0 = [int]($h * 0.01); $y1 = [int]($h * 0.22) - 1
		$prof = @()
		for ($y = $y0; $y -le $y1; $y++) {
			$cnt = 0
			for ($x = $x0; $x -le $x1; $x++) {
				$c = $bmp.GetPixel($x, $y)
				if ($c.R -gt 210 -and $c.G -gt 210 -and $c.B -gt 210) { $cnt++ }
			}
			$prof += $cnt
		}
		# 去掉首尾的零，取白色区域
		$first = 0; while ($first -lt $prof.Count -and $prof[$first] -lt 3) { $first++ }
		$last = $prof.Count - 1; while ($last -ge 0 -and $prof[$last] -lt 3) { $last-- }
		if ($last -le $first) { return @{ n = 0; type = "EMPTY" } }
		$seg = $prof[$first..$last]
		# 平滑（3行滑动均值）
		$sm = @()
		for ($i = 0; $i -lt $seg.Count; $i++) {
			$a = $seg[$i]; $b = $seg[$i]; $c = $seg[$i]
			if ($i -gt 0) { $a = $seg[$i-1] }
			if ($i -lt $seg.Count-1) { $c = $seg[$i+1] }
			$sm += [math]::Round(($a + $seg[$i] + $c) / 3)
		}
		# 下降事件计数
		$events = 0; $i = 1; $inEvent = $false
		while ($i -lt $sm.Count) {
			$prev = $sm[$i-1]; $cur = $sm[$i]
			if (-not $inEvent -and $prev -ge 20 -and ($prev - $cur) -ge 2) {
				# 可能是下降事件开始，向后找谷底
				$j = $i; $min = $cur; $start = $prev
				while ($j -lt $sm.Count - 1 -and $sm[$j+1] -le $sm[$j]) { $j++; $min = $sm[$j] }
				if (($start - $min) -ge 6 -and $start -ge 20) {
					$events++
					$inEvent = $true
					$i = $j
				} else { $i = $j }
			} else {
				# 事件结束条件：宽度回升到 >= 起点-2 或 保持低位后再度起点 >=20 由下一轮检测
				if ($cur -ge 20 -and $inEvent) { $inEvent = $false }
				if ($cur -ge 25 -and $inEvent) { $inEvent = $false }
			}
			$i++
		}
		$type = if ($events -ge 2) { "DOUBLE(⇈状态)" } else { "SINGLE(↑增强)" }
		return @{ n = $events; type = $type }
	} finally { $bmp.Dispose() }
}

if (-not $Targets -or $Targets.Count -eq 0) {
	$Targets = @(
		"sheet153_r1_c5.png","sheet153_r1_c6.png","sheet153_r3_c8.png","sheet153_r4_c0.png","sheet152_r4_c6.png",
		# 意大利 177 全部箭头候选
		"sheet177_r0_c5.png","sheet177_r0_c6.png","sheet177_r0_c7.png","sheet177_r0_c8.png","sheet177_r0_c9.png",
		"sheet177_r1_c0.png","sheet177_r1_c1.png","sheet177_r3_c9.png",
		"sheet177_r4_c0.png","sheet177_r4_c1.png","sheet177_r4_c2.png","sheet177_r4_c3.png","sheet177_r4_c4.png",
		"sheet177_r4_c5.png","sheet177_r4_c6.png","sheet177_r4_c7.png","sheet177_r4_c8.png","sheet177_r4_c9.png",
		"sheet167_r0_c0.png","sheet167_r0_c1.png",
		# 苏联 178/179 箭头候选
		"sheet178_r0_c5.png","sheet178_r0_c6.png","sheet178_r0_c7.png","sheet178_r0_c8.png","sheet178_r0_c9.png",
		"sheet178_r1_c0.png","sheet178_r1_c1.png","sheet178_r1_c2.png","sheet178_r1_c3.png","sheet178_r1_c4.png","sheet178_r1_c5.png",
		"sheet178_r3_c8.png","sheet178_r3_c9.png",
		"sheet178_r4_c0.png","sheet178_r4_c1.png","sheet178_r4_c2.png","sheet178_r4_c3.png","sheet178_r4_c4.png",
		"sheet178_r4_c5.png","sheet178_r4_c6.png","sheet178_r4_c7.png","sheet178_r4_c8.png","sheet178_r4_c9.png",
		"sheet179_r0_c0.png","sheet179_r0_c1.png",
		# 日本 154 箭头候选（EFFECT r0c5-c9 + STATUS r3c9 r4c0-c7）
		"sheet154_r0_c5.png","sheet154_r0_c6.png","sheet154_r0_c7.png","sheet154_r0_c8.png","sheet154_r0_c9.png",
		"sheet154_r3_c9.png",
		"sheet154_r4_c0.png","sheet154_r4_c1.png","sheet154_r4_c2.png","sheet154_r4_c3.png","sheet154_r4_c4.png",
		"sheet154_r4_c5.png","sheet154_r4_c6.png","sheet154_r4_c7.png"
	)
}
Write-Output "=== SINGLE=↑增强 / DOUBLE=⇈状态 ==="
foreach ($t in $Targets) {
	$p = Join-Path $dir $t
	if (-not (Test-Path $p)) { Write-Output "$t  MISSING"; continue }
	$r = Test-Arrow2 $p
	Write-Output ("{0}  -> {1}  (events={2})" -f $t, $r.type, $r.n)
}
