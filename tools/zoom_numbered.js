/*
 * 把带编号的地图分区放大，便于读清每个区域编号对应的地名
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const src = path.join(OUT_DIR, "map_numbered.png");
const ZDIR = path.join(OUT_DIR, "numbered_zoom");
fs.mkdirSync(ZDIR, { recursive: true });

/* map_numbered.png 是 2417x806 */
const areas = [
	["z1_europe", 0, 0, 700, 450, 2.6],
	["z2_ussr_china", 600, 0, 800, 400, 2.4],
	["z3_pacific", 1300, 0, 700, 550, 2.4],
	["z4_america", 1700, 0, 720, 550, 2.4],
	["z5_africa", 0, 400, 800, 406, 2.4],
	["z6_india_ocean", 700, 350, 800, 456, 2.4],
	["z7_aus_pacific", 1400, 350, 700, 456, 2.4],
	["z8_samerica", 1700, 350, 720, 456, 2.4],
];

const ps = [
	"Add-Type -AssemblyName System.Drawing",
	"$ErrorActionPreference = 'Stop'",
	"$img = [System.Drawing.Image]::FromFile('" + src.replace(/'/g, "''") + "')",
];

for (const [name, x, y, w, h, sc] of areas) {
	const ow = Math.round(w * sc), oh = Math.round(h * sc);
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
	ps.push("Write-Output ('" + name + " " + ow + "x" + oh + "')");
}
ps.push("$img.Dispose()");
fs.writeFileSync(path.join(OUT_DIR, "_nzoom.ps1"), ps.join("\n"), "utf8");
console.log("生成 " + areas.length + " 个编号放大区");
