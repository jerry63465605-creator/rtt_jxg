$imgDir='C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images'
$src = Get-ChildItem $imgDir -Filter '*ugc9877167445660033428*' | Select-Object -First 1
if(-not $src){Write-Output 'SRC_NOT_FOUND'; exit}
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($src.FullName)
$W=$img.Width; $H=$img.Height
$NW=10
$NH=10  # 图像 4032/384=10.5 ≈ 10 行；72 张卡占前 8 行，底 2 行为空边；NH=10 才对到真实卡面
$cellW=[int]($W/$NW); $cellH=[int]($H/$NH)
Write-Output "SRC=$($src.Name) IMG=${W}x${H} cell=${cellW}x${cellH} NH=$NH"
$dst='c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/cards_tts'
$cards=@{15349=@(6,8); 15350=@(6,9); 15351=@(7,0); 15352=@(7,1)}
$bmp=[System.Drawing.Bitmap]$img
foreach($id in $cards.Keys){
  $r=$cards[$id][0]; $c=$cards[$id][1]
  $x=$c*$cellW; $y=$r*$cellH
  $crop=New-Object System.Drawing.Rectangle($x,$y,$cellW,$cellH)
  $out=$bmp.Clone($crop,$bmp.PixelFormat)
  $outname=Join-Path $dst ($id.ToString()+'.png')
  $out.Save($outname,'png')
  Write-Output ("saved "+$id+" r"+$r+"c"+$c+" -> "+$outname+" ("+(Get-Item $outname).Length+"B)")
  $out.Dispose()
}
$bmp.Dispose(); $img.Dispose()
