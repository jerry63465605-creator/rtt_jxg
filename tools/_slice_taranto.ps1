
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$img = [System.Drawing.Image]::FromFile('C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images/httpssteamusercontentaakamaihdnetugc98771674456600334280021BFB65ED27DC09B2776CCEBCEAAC560C6DC1E.png')
Write-Host ("source size: " + $img.Width + " x " + $img.Height)
$cw = [int]($img.Width / 10)
$ch = [int]($img.Height / 7)
Write-Host ("cell size: " + $cw + " x " + $ch)
$bx = 8 * $cw
$by = 4 * $ch
$rect = New-Object System.Drawing.Rectangle -ArgumentList @([int]$bx, [int]$by, [int]$cw, [int]$ch)
$dst  = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]$cw, [int]$ch)
$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]$cw, [int]$ch)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, $dst, $rect, [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save('C:\Users\24968\Desktop\rtt\out\cards_sliced\taranto_10x7_r4_c8.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save('C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards\sheet153_r5_c4.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Write-Host 'DONE'
