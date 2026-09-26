/*
 * 放大所有"疑似岛屿"区域，用于人工确认岛屿格位
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const src = path.join(OUT_DIR, "map_half.png");   // 4835/2 x 1612/2 = 2417 x 806
const ZDIR = path.join(OUT_DIR, "island_zoom");
fs.mkdirSync(ZDIR, { recursive: true });

/* 岛屿候选（原图坐标 /2 转成 map_half 坐标） */
const spots = [
	["hawaii", 3354, 287],
	["iwo_jima", 3228, 437],
	["iwo_jima2", 3095, 1357],
	["iceland_E", 4715, 37],
	["iceland_W", 91, 37],
	["azores", 352, 339],
	["madagascar", 1167, 1390],
	["new_guinea", 2838, 1156],
	["indonesia", 2437, 1244],
	["new_zealand", 3038, 1384],
	["philippines", 2561, 830],
	["philippines2", 2413, 1140],
	["midway", 2187, 1105],
	["alaska_isl", 3482, 58],
	["philippines3", 4459, 1074],
];

const R = 200;   // 裁剪半径（map_half 坐标）
const ps = [
	"Add-Type -AssemblyName System.Drawing",
	"$ErrorActionPreference = 'Stop'",
	"$img = [System.Drawing.Image]::FromFile('" + src.replace(/'/g, "''") + "')",
	"Write-Output (\"IMG \" + $img.Width + \"x\" + $img.Height)",
];

for (const [name, ox, oy] of spots) {
	const x = Math.max(0, Math.round(ox / 2) - R);
	const y = Math.max(0, Math.round(oy / 2) - R);
	const w = R * 2, h = R * 2;
	const SC = 3;
	const ow = w * SC, oh = h * SC;
	const dst = path.join(ZDIR, name + ".png").replace(/'/g, "''");
	ps.push("$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]" + ow + ", [int]" + oh + ")");
	ps.push("$g = [System.Drawing.Graphics]::FromImage($bmp)");
	ps.push("$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor");
	ps.push("$srcRect = New-Object System.Drawing.Rectangle -ArgumentList @([int]" + x + ", [int]" + y + ", [int]" + w + ", [int]" + h + ")");
	ps.push("$dstRect = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]" + ow + ", [int]" + oh + ")");
	ps.push("$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)");
	ps.push("$g.Dispose()");
	ps.push("$bmp.Save('" + dst + "', [System.Drawing.Imaging.ImageFormat]::Png)");
	ps.push("$bmp.Dispose()");
	ps.push("Write-Output ('" + name + " ok')");
}
ps.push("$img.Dispose()");
fs.writeFileSync(path.join(OUT_DIR, "_isl.ps1"), ps.join("\n"), "utf8");
console.log("生成 " + spots.length + " 个岛屿放大图");
