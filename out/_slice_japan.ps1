$imgDir='C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images'
$src=Get-ChildItem $imgDir -Filter '*ugc17875124258557834658*' | Select-Object -First 1
$ids=Get-Content 'c:/Users/24968/Desktop/rtt/out/japan_ids.json' | ConvertFrom-Json
$dst='c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/cards_tts/japan'
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Add-Type -AssemblyName System.Drawing
$img=[System.Drawing.Image]::FromFile($src.FullName)
$W=$img.Width; $H=$img.Height
$NW=10; $NH=7
$cw=[int]($W/$NW); $ch=[int]($H/$NH)
Write-Output "SRC=$($src.Name) ${W}x${H} cell=${cw}x${ch}"
$bmp=[System.Drawing.Bitmap]$img
for($i=0;$i -lt $ids.Count;$i++){
  $id=$ids[$i]
  $r=[math]::Floor($i/$NW); $c=$i%$NW
  $x=$c*$cw; $y=$r*$ch
  $crop=New-Object System.Drawing.Rectangle($x,$y,$cw,$ch)
  $out=$bmp.Clone($crop,$bmp.PixelFormat)
  $name=Join-Path $dst ("jp_i{0}_id{1}.png" -f $i,$id)
  $out.Save($name,'png')
  $out.Dispose()
}
$bmp.Dispose(); $img.Dispose()
Write-Output "已切 $($ids.Count) 张到 $dst"
Get-ChildItem $dst | Measure-Object | ForEach-Object { Write-Output ("文件数: "+$_.Count) }
