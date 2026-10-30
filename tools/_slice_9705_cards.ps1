# Cut the 6 nation-skill banners out of the sheet at full resolution.
param(
    [string]$Src = "c:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards_tts\sheet_9705892066924990912.png",
    [string]$Out = "c:\Users\24968\Desktop\rtt\out\zoom_9705892066924990912"
)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($Src)
$names = @("de", "uk", "jp", "su", "it", "us")
$w = [int]($bmp.Width / 6)
for ($i = 0; $i -lt 6; $i++) {
    $rect = New-Object System.Drawing.Rectangle ($i * $w), 0, $w, $bmp.Height
    $t = $bmp.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppRgb)
    $name = "card_" + $names[$i] + ".png"
    $t.Save((Join-Path $Out $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $t.Dispose()
    Write-Output ("saved " + $name + " " + $w + " x " + $bmp.Height)
}
$bmp.Dispose()
