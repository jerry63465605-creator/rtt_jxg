# Cut 6 nation-skill cards precisely (card width = sheet_width / 6 - but cards span ~3456px)
# and produce 2x zooms of each card's text zone for OCR.
param(
    [string]$Src = "c:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards_tts\sheet_9705892066924990912.png",
    [string]$Out = "c:\Users\24968\Desktop\rtt\out\zoom_9705892066924990912",
    [int]$CardWidth = 576
)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($Src)
$names = @("de", "uk", "jp", "su", "it", "us")
for ($i = 0; $i -lt 6; $i++) {
    $x0 = $i * $CardWidth
    $w = [Math]::Min($CardWidth, $bmp.Width - $x0)
    if ($w -le 0) { break }
    # find card bottom: scan down from top for the card's rounded rect (content is in top area)
    $h = 420
    $rect = New-Object System.Drawing.Rectangle $x0, 0, $w, $h
    $t = $bmp.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppRgb)
    $t.Save((Join-Path $Out ("c2_" + $names[$i] + ".png")), [System.Drawing.Imaging.ImageFormat]::Png)
    $t.Dispose()
    # 2x zoom of the whole card for OCR
    $z = New-Object System.Drawing.Bitmap ($w * 2), ($h * 2)
    $g = [System.Drawing.Graphics]::FromImage($z)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, 0, ($w * 2), ($h * 2)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $z.Save((Join-Path $Out ("c2_" + $names[$i] + "_2x.png")), [System.Drawing.Imaging.ImageFormat]::Png)
    $z.Dispose()
    Write-Output ("saved c2_" + $names[$i] + "_2x.png")
}
$bmp.Dispose()
