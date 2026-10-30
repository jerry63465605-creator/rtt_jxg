# Slice the toolbar screenshot into 6 icons (3x zoom) for the guide image.
param(
    [string]$Src = "C:\Users\24968\AppData\Local\CodeBuddyExtension\Data\24f303d3-eb71-49fb-8bf2-cfa15a7486c5\CodeBuddyIDE\24f303d3-eb71-49fb-8bf2-cfa15a7486c5\history\221579c440ffd2effd2072fa22597ef5\24d0b84a4c86495380f843f211122905\assets\image.f650bf9c13.png",
    [string]$Out = "c:\Users\24968\Desktop\rtt\out\toolbar_icons",
    [int]$Count = 6,
    [int]$Zoom = 3
)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$bmp = [System.Drawing.Bitmap]::FromFile($Src)
Write-Output ("strip " + $bmp.Width + " x " + $bmp.Height)
$w = [int]($bmp.Width / $Count)
for ($i = 0; $i -lt $Count; $i++) {
    $rect = New-Object System.Drawing.Rectangle ($i * $w), 0, $w, $bmp.Height
    $t = $bmp.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppRgb)
    $z = New-Object System.Drawing.Bitmap ($w * $Zoom), ($bmp.Height * $Zoom)
    $g = [System.Drawing.Graphics]::FromImage($z)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.DrawImage($t, 0, 0, ($w * $Zoom), ($bmp.Height * $Zoom))
    $g.Dispose()
    $z.Save((Join-Path $Out ("icon_" + $i + ".png")), [System.Drawing.Imaging.ImageFormat]::Png)
    $z.Dispose(); $t.Dispose()
}
$bmp.Dispose()
Write-Output ("done -> " + $Out)
