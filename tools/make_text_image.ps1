# Render text-on-solid-color images (easy_rule style) from a UTF-8 JSON config.
# ASCII-only script body: all Chinese text lives in the JSON file (read as UTF-8).
param(
    [string]$Config = "c:\Users\24968\Desktop\rtt\tools\national_skills_config.json"
)
# mode: "single" (one image per item) or "grid" (all items in one image, cols x rows)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$cfgText = [System.IO.File]::ReadAllText($Config, [System.Text.Encoding]::UTF8)
$cfg = $cfgText | ConvertFrom-Json

function Convert-HexColor([string]$hex) {
    $hex = $hex.TrimStart('#')
    return [System.Drawing.Color]::FromArgb(
        [Convert]::ToInt32($hex.Substring(0, 2), 16),
        [Convert]::ToInt32($hex.Substring(2, 2), 16),
        [Convert]::ToInt32($hex.Substring(4, 2), 16))
}

$bg = Convert-HexColor $cfg.bg
$fg = Convert-HexColor $cfg.fg
$accent = Convert-HexColor $cfg.accent

New-Item -ItemType Directory -Force -Path $cfg.outDir | Out-Null

$fontFamily = New-Object System.Drawing.FontFamily $cfg.font

if ($cfg.mode -eq 'sections') {
    # Full-width sections stacked vertically; optional per-item icon on the left.
    $titleFont = New-Object System.Drawing.Font $fontFamily, 30, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $subFont = New-Object System.Drawing.Font $fontFamily, 17, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $secFont = New-Object System.Drawing.Font $fontFamily, 23, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = New-Object System.Drawing.Font $fontFamily, 19, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $footFont = New-Object System.Drawing.Font $fontFamily, 15, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)

    $m = 44
    $textW = [int]$cfg.width - 2 * $m
    $iconS = 54

    # ---- measure ----
    $mbmp = New-Object System.Drawing.Bitmap 10, 10
    $mg = [System.Drawing.Graphics]::FromImage($mbmp)
    $heights = @()
    foreach ($it in $cfg.items) {
        $hasIcon = ($null -ne $it.icon -and $it.icon -ne '')
        $indent = 0
        if ($hasIcon) { $indent = $iconS + 20 }
        $h = 36
        foreach ($l in $it.lines) {
            $sz = $mg.MeasureString(([char]0x2022 + ' ' + $l), $bodyFont, ($textW - $indent))
            $h += [int]$sz.Height + 10
        }
        if ($hasIcon -and $h -lt ($iconS + 8)) { $h = $iconS + 8 }
        $heights += ($h + 18)
    }
    $mg.Dispose(); $mbmp.Dispose()

    $total = 0
    foreach ($h in $heights) { $total += $h }
    $H = 128 + [int]$total + 58
    if ($cfg.height -and ([int]$cfg.height -gt $H)) { $H = [int]$cfg.height }
    $W = [int]$cfg.width

    # ---- draw ----
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear($bg)

    $g.DrawString($cfg.pageTitle, $titleFont, [System.Drawing.Brushes]::Black, $m, 34)
    $g.DrawString($cfg.pageSubtitle, $subFont,
        (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 0, 0))), $m, 80)
    $penT = New-Object System.Drawing.Pen $accent, 4
    $g.DrawLine($penT, $m, 110, ($W - $m), 110)
    $penT.Dispose()

    $y = 128
    for ($i = 0; $i -lt $cfg.items.Count; $i++) {
        $it = $cfg.items[$i]
        $hasIcon = ($null -ne $it.icon -and $it.icon -ne '')
        $indent = 0
        if ($hasIcon) {
            $indent = $iconS + 20
            $p = Join-Path $cfg.iconDir $it.icon
            if (Test-Path $p) {
                $img = [System.Drawing.Image]::FromFile($p)
                $g.DrawImage($img, (New-Object System.Drawing.Rectangle $m, ($y + 4), $iconS, $iconS))
                $img.Dispose()
            }
        }
        # accent bar + section title
        $barC = Convert-HexColor $it.accent
        $barB = New-Object System.Drawing.SolidBrush $barC
        $g.FillRectangle($barB, ($m + $indent), ($y + 4), 10, 24)
        $barB.Dispose()
        $g.DrawString($it.title, $secFont, [System.Drawing.Brushes]::Black, ($m + $indent + 18), $y)
        $by = $y + 36
        foreach ($l in $it.lines) {
            $text = [char]0x2022 + ' ' + $l
            $sz = $g.MeasureString($text, $bodyFont, ($textW - $indent))
            $g.DrawString($text, $bodyFont, [System.Drawing.Brushes]::Black,
                (New-Object System.Drawing.RectangleF ($m + $indent), $by, ($textW - $indent), ($sz.Height + 6)))
            $by += [int]$sz.Height + 10
        }
        $y += $heights[$i]
        if ($i -lt ($cfg.items.Count - 1)) {
            $sep = (New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 0, 0, 0)), 1)
            $g.DrawLine($sep, $m, $y, ($W - $m), $y)
            $sep.Dispose()
        }
    }

    if ($cfg.footnote) {
        $g.DrawString($cfg.footnote, $footFont,
            (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 0, 0))), $m, ($H - 40))
    }
    $g.Dispose()
    $out = Join-Path $cfg.outDir $cfg.fileName
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("saved " + $out)
    exit 0
}

if ($cfg.mode -eq 'iconTable') {
    # ---------- fonts ----------
    $titleFont = New-Object System.Drawing.Font $fontFamily, 30, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $subFont = New-Object System.Drawing.Font $fontFamily, 17, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $headerFont = New-Object System.Drawing.Font $fontFamily, 20, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $nameFont = New-Object System.Drawing.Font $fontFamily, 20, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = New-Object System.Drawing.Font $fontFamily, 17, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $footFont = New-Object System.Drawing.Font $fontFamily, 15, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)

    # ---------- column geometry ----------
    $m = 34
    $iconX = $m; $iconW = 86
    $nameX = $iconX + $iconW + 10; $nameW = 190
    $playX = $nameX + $nameW + 10; $playW = 330
    $effX = $playX + $playW + 12; $effW = $cfg.width - $effX - $m - 6
    $iconSize = 60
    $lineH = 23

    # ---------- pass 1: measure row heights ----------
    $mbmp = New-Object System.Drawing.Bitmap 10, 10
    $mg = [System.Drawing.Graphics]::FromImage($mbmp)
    $rowHeights = @()
    foreach ($row in $cfg.rows) {
        $h = $iconSize + 16
        foreach ($t in @($row.play, $row.effect)) {
            $sz = $mg.MeasureString($t, $bodyFont, $playW)
            $need = ([int][Math]::Ceiling($sz.Height / $lineH)) * $lineH + 16
            if ($need -gt $h) { $h = $need }
        }
        $rowHeights += $h
    }
    $mg.Dispose(); $mbmp.Dispose()

    $headY = 128
    $headH = 42
    $tableH = 0
    foreach ($h in $rowHeights) { $tableH += $h }
    $H = [int]($headY + $headH + $tableH + 62)
    $W = [int]$cfg.width

    # ---------- pass 2: draw ----------
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear($bg)

    $g.DrawString($cfg.pageTitle, $titleFont, [System.Drawing.Brushes]::Black, $m, 36)
    $g.DrawString($cfg.pageSubtitle, $subFont,
        (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 0, 0))), $m, 82)
    $penT = New-Object System.Drawing.Pen $accent, 4
    $g.DrawLine($penT, $m, 112, ($W - $m), 112)
    $penT.Dispose()

    # header band
    $bandBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
    $g.FillRectangle($bandBrush, $m, $headY, ($W - 2 * $m), $headH)
    $bandBrush.Dispose()
    $hx = @($iconX, $nameX, $playX, $effX)
    for ($i = 0; $i -lt 4; $i++) {
        $g.DrawString($cfg.headers[$i], $headerFont, [System.Drawing.Brushes]::Black,
            (New-Object System.Drawing.RectangleF $hx[$i], ($headY + 8), ($hx[$i + 1] - $hx[$i] - 10), 30))
    }

    # rows
    $y = $headY + $headH
    for ($i = 0; $i -lt $cfg.rows.Count; $i++) {
        $row = $cfg.rows[$i]
        $rh = $rowHeights[$i]
        if ($i % 2 -eq 1) {
            $alt = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(26, 0, 0, 0))
            $g.FillRectangle($alt, $m, $y, ($W - 2 * $m), $rh)
            $alt.Dispose()
        }
        # icon
        $iconPath = Join-Path $cfg.iconDir $row.icon
        if (Test-Path $iconPath) {
            $icon = [System.Drawing.Image]::FromFile($iconPath)
            $g.DrawImage($icon, (New-Object System.Drawing.Rectangle ($iconX + 10), ($y + [int](($rh - $iconSize) / 2)), $iconSize, $iconSize))
            $icon.Dispose()
        }
        # name
        $g.DrawString($row.name, $nameFont, [System.Drawing.Brushes]::Black,
            (New-Object System.Drawing.RectangleF $nameX, ($y + 12), $nameW, 60))
        # play / effect
        $sp = $g.MeasureString($row.play, $bodyFont, $playW)
        $g.DrawString($row.play, $bodyFont, [System.Drawing.Brushes]::Black,
            (New-Object System.Drawing.RectangleF $playX, ($y + [int](($rh - $sp.Height) / 2)), $playW, ($sp.Height + 6)))
        $se = $g.MeasureString($row.effect, $bodyFont, $effW)
        $g.DrawString($row.effect, $bodyFont, [System.Drawing.Brushes]::Black,
            (New-Object System.Drawing.RectangleF $effX, ($y + [int](($rh - $se.Height) / 2)), $effW, ($se.Height + 6)))
        # separator
        $sep = (New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 0, 0, 0)), 1)
        $g.DrawLine($sep, $m, ($y + $rh), ($W - $m), ($y + $rh))
        $sep.Dispose()
        $y += $rh
    }

    # footnote
    $g.DrawString($cfg.footnote, $footFont,
        (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 0, 0))), $m, ($H - 40))
    $g.Dispose()
    $out = Join-Path $cfg.outDir $cfg.fileName
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("saved " + $out)
    exit 0
}

if ($cfg.mode -eq 'grid') {
    $bmp = New-Object System.Drawing.Bitmap ([int]$cfg.width), ([int]$cfg.height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear($bg)

    $top = 40
    $titleFont2 = New-Object System.Drawing.Font $fontFamily, 32, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $subFont2 = New-Object System.Drawing.Font $fontFamily, 18, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString($cfg.pageTitle, $titleFont2, [System.Drawing.Brushes]::Black, 48, $top)
    $g.DrawString($cfg.pageSubtitle, $subFont2,
        (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 0, 0, 0))), 48, ($top + 44))
    $penTop = New-Object System.Drawing.Pen $accent, 4
    $g.DrawLine($penTop, 48, ($top + 78), ($cfg.width - 48), ($top + 78))
    $penTop.Dispose()

    $cellTitleFont = New-Object System.Drawing.Font $fontFamily, 24, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $cellBodyFont = New-Object System.Drawing.Font $fontFamily, 19, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $gridPen = (New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 0, 0, 0)), 2)

    $x0 = 40
    $y0 = $top + 100
    $cellW = [int]$cfg.cellW
    $cellH = [int]$cfg.cellH
    $cols = [int]$cfg.cols
    for ($i = 0; $i -lt $cfg.items.Count; $i++) {
        $it = $cfg.items[$i]
        $col = $i % $cols
        $row = [Math]::Floor($i / $cols)
        $cx = $x0 + $col * $cellW
        $cy = $y0 + $row * $cellH
        # cell frame
        $g.DrawRectangle($gridPen, $cx, $cy, ($cellW - 16), ($cellH - 16))
        # nation color bar + title
        $barColor = Convert-HexColor $it.accent
        $barBrush = New-Object System.Drawing.SolidBrush $barColor
        $g.FillRectangle($barBrush, ($cx + 18), ($cy + 20), 12, 26)
        $barBrush.Dispose()
        $g.DrawString($it.title, $cellTitleFont, [System.Drawing.Brushes]::Black, ($cx + 38), ($cy + 18))
        # bullets
        $by = $cy + 58
        $bw = $cellW - 16 - 36
        foreach ($line in $it.lines) {
            $text = [char]0x2022 + ' ' + $line
            $size = $g.MeasureString($text, $cellBodyFont, $bw)
            $g.DrawString($text, $cellBodyFont, [System.Drawing.Brushes]::Black,
                (New-Object System.Drawing.RectangleF ($cx + 18), $by, $bw, ($size.Height + 6)))
            $by += [int]($size.Height) + 12
        }
    }
    $gridPen.Dispose()
    $g.Dispose()
    $allOut = Join-Path $cfg.outDir $cfg.fileName
    $bmp.Save($allOut, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("saved " + $allOut)
    exit 0
}

foreach ($item in $cfg.items) {
    $bmp = New-Object System.Drawing.Bitmap ([int]$cfg.width), ([int]$cfg.height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear($bg)

    $margin = 48
    $titleFont = New-Object System.Drawing.Font $fontFamily, 30, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = New-Object System.Drawing.Font $fontFamily, 26, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)

    # title
    $g.DrawString($item.title, $titleFont, [System.Drawing.Brushes]::Black, $margin, 40)

    # accent underline
    $pen = New-Object System.Drawing.Pen $accent, 4
    $g.DrawLine($pen, $margin, 96, ($cfg.width - $margin), 96)
    $pen.Dispose()

    # body bullets with word wrap
    $y = 130
    $wrapWidth = $cfg.width - 2 * $margin
    foreach ($line in $item.lines) {
        $text = [char]0x2022 + ' ' + $line
        $size = $g.MeasureString($text, $bodyFont, $wrapWidth)
        $g.DrawString($text, $bodyFont, [System.Drawing.Brushes]::Black,
            (New-Object System.Drawing.RectangleF $margin, $y, $wrapWidth, ($size.Height + 8)))
        $y += [int]($size.Height) + 18
    }

    # bottom-right footnote
    $footFont = New-Object System.Drawing.Font $fontFamily, 16, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Far
    $g.DrawString('quartermaster-sub-wars', $footFont,
        (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(140, 0, 0, 0))),
        (New-Object System.Drawing.RectangleF $margin, ($cfg.height - 44), $wrapWidth, 30), $fmt)
    $fmt.Dispose()

    $g.Dispose()
    $outFile = Join-Path $cfg.outDir $item.file
    $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output ("saved " + $outFile)
}
