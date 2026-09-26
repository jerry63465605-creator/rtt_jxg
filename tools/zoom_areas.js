/*
 * 放大关键区域：海峡与岛屿，用于精确判断邻接关系
 */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const ZOOM_DIR = path.join(OUT_DIR, "zoom");
fs.mkdirSync(ZOOM_DIR, { recursive: true });

const mapFile = "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png";
const src = path.join(IMAGES_DIR, mapFile);

/* 需要放大的区域: [名称, x, y, w, h, 放大倍数] */
const areas = [
	["straitA_northsea_baltic", 700, 0, 500, 400, 2.5],
	["straitB_azores", 0, 500, 700, 600, 2.0],
	["straitC_gibraltar", 200, 350, 600, 500, 2.2],
	["straitD_suez", 850, 400, 600, 500, 2.2],
	["straitE_panama", 100, 750, 700, 500, 2.2],
	["iceland_britain", 0, 0, 700, 500, 2.2],
	["mediterranean_all", 300, 350, 900, 450, 2.0],
	["seasia_indonesia", 2200, 550, 900, 600, 2.0],
	["japan_seaofjapan", 2700, 0, 700, 600, 2.0],
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
	ps.push("Write-Output ('" + name + " -> " + ow + "x" + oh + "')");
}
ps.push("$img.Dispose()");

fs.writeFileSync(path.join(OUT_DIR, "_zoom.ps1"), ps.join("\n"), "utf8");
console.log("生成 " + areas.length + " 个放大区域");
