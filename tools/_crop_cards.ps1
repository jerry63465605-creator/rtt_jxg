
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path 'C:\Users\24968\Desktop\rtt\out\crops' | Out-Null
$items = @(
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.2957ad97f7.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_15349.png'; dw=365; cx=178; cy=164; w=310; h=300; a=-4.5 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.f4021c117a.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_15350.png'; dw=1068; cx=885; cy=255; w=282; h=312; a=-6.5 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.f4021c117a.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_15351.png'; dw=1068; cx=334; cy=240; w=292; h=290; a=-6 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.f4021c117a.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_15352.png'; dw=1068; cx=604; cy=250; w=235; h=300; a=-4 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.f4021c117a.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_15353.png'; dw=1068; cx=225; cy=612; w=326; h=385; a=-6 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.f4021c117a.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_15354.png'; dw=1068; cx=575; cy=612; w=334; h=400; a=-4 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.d8877c4ac9.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_17851.png'; dw=1068; cx=310; cy=180; w=228; h=308; a=-4.4 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.d8877c4ac9.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_17852.png'; dw=1068; cx=605; cy=168; w=225; h=270; a=-3 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.d8877c4ac9.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_17853.png'; dw=1068; cx=900; cy=172; w=315; h=265; a=-7 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.d8877c4ac9.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_17854.png'; dw=1068; cx=238; cy=578; w=352; h=470; a=-5 }
	@{ src='C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/image.d8877c4ac9.png'; out='C:\Users\24968\Desktop\rtt\out\crops\crop_17855.png'; dw=1068; cx=634; cy=568; w=444; h=445; a=-6.5 }
)
foreach($it in $items){
	$img = [System.Drawing.Image]::FromFile($it.src)
	$scale = $img.Width / $it.dw
	$cx = $it.cx * $scale; $cy = $it.cy * $scale
	$w = [int]($it.w * $scale); $h = [int]($it.h * $scale)
	$bmp = New-Object System.Drawing.Bitmap($w, $h)
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
	$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$g.Clear([System.Drawing.Color]::FromArgb(255, 34, 26, 20))
	$g.TranslateTransform($w/2, $h/2)
	$g.RotateTransform([float]$it.a)
	$g.DrawImage($img, [float](-$cx), [float](-$cy), [float]$img.Width, [float]$img.Height)
	$bmp.Save($it.out, [System.Drawing.Imaging.ImageFormat]::Png)
	$g.Dispose(); $bmp.Dispose(); $img.Dispose()
	Write-Host ('OK ' + $it.out)
}
Write-Host 'ALL DONE'
