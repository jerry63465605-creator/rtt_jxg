/*
 * 从 15349（奇袭塔兰托）专用的 10x7 雪碧图中切出正确卡图。
 *
 * 背景：cards_review.csv 里 15349 行记录的是
 *   grid=10x7, row=4, col=8, face_img_file=httpssteam...0021BFB....png
 * 而 slice_cards.js 是按「第一个碰到的 grid」给整个 sheet153 切的（10x6），
 * 于是 uk_cards.csv 里写的 sheet153_r5_c4.png 实际是 10x6 网格越界的空白图（2KB）。
 *
 * 本脚本按 15349 自己的 10x7 网格重新切：
 *   输出1：out/cards_sliced/taranto_10x7_r4_c8.png   （原始切片，供追溯）
 *   输出2：模块 cards/sheet153_r5_c4.png             （覆盖空白图，cards.js 引用立即生效）
 */
const fs = require('fs')
const path = require('path')

const SRC = 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images/' +
	'httpssteamusercontentaakamaihdnetugc98771674456600334280021BFB65ED27DC09B2776CCEBCEAAC560C6DC1E.png'
const OUT_RAW = path.join(__dirname, '..', 'out', 'cards_sliced', 'taranto_10x7_r4_c8.png')
const OUT_MOD = path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'cards', 'sheet153_r5_c4.png')

const ROW = 4, COL = 8, NW = 10, NH = 7

const ps = `
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$img = [System.Drawing.Image]::FromFile('${SRC.replace(/'/g, "''")}')
Write-Host ("source size: " + $img.Width + " x " + $img.Height)
$cw = [int]($img.Width / ${NW})
$ch = [int]($img.Height / ${NH})
Write-Host ("cell size: " + $cw + " x " + $ch)
$bx = ${COL} * $cw
$by = ${ROW} * $ch
$rect = New-Object System.Drawing.Rectangle -ArgumentList @([int]$bx, [int]$by, [int]$cw, [int]$ch)
$dst  = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]$cw, [int]$ch)
$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]$cw, [int]$ch)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, $dst, $rect, [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save('${OUT_RAW.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save('${OUT_MOD.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Write-Host 'DONE'
`
const psFile = path.join(__dirname, '_slice_taranto.ps1')
fs.writeFileSync(psFile, ps, 'utf8')
console.log('written: ' + psFile)
