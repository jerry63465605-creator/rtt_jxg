/*
 * 从玩家提供的卡面照片中旋转裁剪卡图(2026-10-18 英国/苏联补录批)。
 *
 * 用法: node tools/_crop_cards.js
 * 流程: 按下面 ITEMS 的目测坐标(display 坐标系)生成 ps1 并执行,
 *       输出到 out/crops/ 供目检;确认后再由 _apply_crops.js 拷贝到模块 cards/。
 *
 * 坐标系: dw = 目测时所依据的显示宽度, 脚本内按 scale = 源图宽 / dw 换算。
 * a = 补偿旋转角(度, 顺时针为正): 卡片逆时针倾(顶边右端高)取正。
 */
const fs = require('fs')
const path = require('path')

const ASSETS = 'C:/Users/24968/AppData/Local/CodeBuddyExtension/Data/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/CodeBuddyIDE/24f303d3-eb71-49fb-8bf2-cfa15a7486c5/history/221579c440ffd2effd2072fa22597ef5/24d0b84a4c86495380f843f211122905/assets/'
const IMG_SABINE = ASSETS + 'image.2957ad97f7.png'   // 萨宾行动 单卡
const IMG_UK = ASSETS + 'image.f4021c117a.png'       // 英国 5 张
const IMG_SU = ASSETS + 'image.d8877c4ac9.png'       // 苏联 5 张

const OUT_DIR = path.join(__dirname, '..', 'out', 'crops')

/* [源图, dw, 输出名, cx, cy, w, h, 补偿角]  —— 全部为 display 坐标 */
const ITEMS = [
	[IMG_SABINE, 365, 'crop_15349.png', 178, 164, 310, 300, -4.5],
	[IMG_UK, 1068, 'crop_15350.png', 885, 255, 282, 312, -6.5],
	[IMG_UK, 1068, 'crop_15351.png', 334, 240, 292, 290, -6.0],
	[IMG_UK, 1068, 'crop_15352.png', 604, 250, 235, 300, -4.0],
	[IMG_UK, 1068, 'crop_15353.png', 225, 612, 326, 385, -6.0],
	[IMG_UK, 1068, 'crop_15354.png', 575, 612, 334, 400, -4.0],
	[IMG_SU, 1068, 'crop_17851.png', 310, 180, 228, 308, -4.4],
	[IMG_SU, 1068, 'crop_17852.png', 605, 168, 225, 270, -3.0],
	[IMG_SU, 1068, 'crop_17853.png', 900, 172, 315, 265, -7.0],
	[IMG_SU, 1068, 'crop_17854.png', 238, 578, 352, 470, -5.0],
	[IMG_SU, 1068, 'crop_17855.png', 634, 568, 444, 445, -6.5],
]

const lines = ITEMS.map(it => {
	const [src, dw, out, cx, cy, w, h, a] = it
	return `\t@{ src='${src}'; out='${path.join(OUT_DIR, out).replace(/'/g, "''")}'; dw=${dw}; cx=${cx}; cy=${cy}; w=${w}; h=${h}; a=${a} }`
}).join('\n')

const ps = `
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path '${OUT_DIR.replace(/'/g, "''")}' | Out-Null
$items = @(
${lines}
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
`

const psFile = path.join(__dirname, '_crop_cards.ps1')
fs.writeFileSync(psFile, ps, 'utf8')
console.log('written: ' + psFile)
