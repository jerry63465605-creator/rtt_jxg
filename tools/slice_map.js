/*
 * 把地图底图切成若干块，便于逐块识别地名文字。
 */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const TILE_DIR = path.join(OUT_DIR, "map_tiles");
fs.mkdirSync(TILE_DIR, { recursive: true });

const mapFile = "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png";
const src = path.join(IMAGES_DIR, mapFile);

/* 4835 x 1612, 切成 4x2 = 8 块，每块带 10% 重叠 */
const COLS = 4, ROWS = 2;
const OVERLAP = 0.08;

const ps = [
	"Add-Type -AssemblyName System.Drawing",
	"$ErrorActionPreference = 'Stop'",
	"$img = [System.Drawing.Image]::FromFile('" + src.replace(/'/g, "''") + "')",
	"$W = $img.Width; $H = $img.Height",
	"Write-Output (\"MAP $W x $H\")",
];

const tw = Math.floor(4835 / COLS);
const th = Math.floor(1612 / ROWS);
const ox = Math.floor(tw * OVERLAP);
const oy = Math.floor(th * OVERLAP);

for (let r = 0; r < ROWS; r++) {
	for (let c = 0; c < COLS; c++) {
		const x = Math.max(0, c * tw - ox);
		const y = Math.max(0, r * th - oy);
		const w = Math.min(4835 - x, tw + ox * 2);
		const h = Math.min(1612 - y, th + oy * 2);
		// 放大 1.6 倍便于看清文字
		const SC = 1.6;
		const ow = Math.round(w * SC), oh = Math.round(h * SC);
		const dst = path.join(TILE_DIR, `tile_r${r}_c${c}.png`).replace(/'/g, "''");
		ps.push("$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]" + ow + ", [int]" + oh + ")");
		ps.push("$g = [System.Drawing.Graphics]::FromImage($bmp)");
		ps.push("$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic");
		ps.push("$srcRect = New-Object System.Drawing.Rectangle -ArgumentList @([int]" + x + ", [int]" + y + ", [int]" + w + ", [int]" + h + ")");
		ps.push("$dstRect = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]" + ow + ", [int]" + oh + ")");
		ps.push("$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)");
		ps.push("$g.Dispose()");
		ps.push("$bmp.Save('" + dst + "', [System.Drawing.Imaging.ImageFormat]::Png)");
		ps.push("$bmp.Dispose()");
		ps.push("Write-Output ('tile_r" + r + "_c" + c + " src=" + x + "," + y + " size=" + w + "x" + h + "')");
	}
}
ps.push("$img.Dispose()");
ps.push("Write-Output 'TILES_DONE'");

fs.writeFileSync(path.join(OUT_DIR, "_map_tiles.ps1"), ps.join("\n"), "utf8");
console.log("切片: " + ROWS + "x" + COLS + " = " + (ROWS * COLS) + " 块, 每块 " + tw + "x" + th + " (含重叠)");
