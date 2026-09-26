/*
 * 补充放大：找齐 5 个海峡标记
 */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const ZOOM_DIR = path.join(OUT_DIR, "zoom2");
fs.mkdirSync(ZOOM_DIR, { recursive: true });

const src = path.join(IMAGES_DIR, "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png");

const areas = [
	["A_azores_zoom", 0, 400, 500, 450, 3.0],
	["B_caribbean", 0, 600, 600, 400, 2.5],
	["C_baltic_zoom", 780, 80, 350, 300, 3.5],
	["D_med_east", 750, 380, 450, 400, 3.0],
	["E_northsea_full", 400, 0, 600, 500, 2.5],
	["F_latin_america", 300, 800, 700, 500, 2.2],
];

const ps = [
	"Add-Type -AssemblyName System.Drawing",
	"$ErrorActionPreference = 'Stop'",
	"$img = [System.Drawing.Image]::FromFile('" + src.replace(/'/g, "''") + "')",
];

for (const [name, x, y, w, h, scale] of areas) {
	const ow = Math.round(w * scale), oh = Math.round(h * scale);
	const dst = path.join(ZOOM_DIR, name + ".png").replace(/'/g, "''");
	ps.push("$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]" + ow + ", [int]" + oh + ")");
	ps.push("$g = [System.Drawing.Graphics]::FromImage($bmp)");
	ps.push("$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic");
	ps.push("$srcRect = New-Object System.Drawing.Rectangle -ArgumentList @([int]" + x + ", [int]" + y + ", [int]" + w + ", [int]" + h + ")");
	ps.push("$dstRect = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]" + ow + ", [int]" + oh + ")");
	ps.push("$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)");
	ps.push("$g.Dispose()");
	ps.push("$bmp.Save('" + dst + "', [System.Drawing.Imaging.ImageFormat]::Png)");
	ps.push("$bmp.Dispose()");
	ps.push("Write-Output ('" + name + " done')");
}
ps.push("$img.Dispose()");

fs.writeFileSync(path.join(OUT_DIR, "_zoom2.ps1"), ps.join("\n"), "utf8");
console.log("生成 " + areas.length + " 个补充放大区域");
