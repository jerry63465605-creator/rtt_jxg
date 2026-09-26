/*
 * 把每个地名点周围切成小图（拼成网格大图），一次看清所有点的地形。
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const src = path.join(OUT_DIR, "map_half.png");   // 2417 x 806
const GRID_DIR = path.join(OUT_DIR, "point_grid");
fs.mkdirSync(GRID_DIR, { recursive: true });

const SPACES = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "spaces_pts.json"), "utf8"));
const names = Object.keys(SPACES);

/* 每个点切 160x110（原图坐标再 /2），每行 6 个 */
const CW = 120, CH = 84;    // map_half 坐标下的裁剪尺寸
const COLS = 6;

const ps = [
	"Add-Type -AssemblyName System.Drawing",
	"$ErrorActionPreference = 'Stop'",
	"$img = [System.Drawing.Image]::FromFile('" + src.replace(/'/g, "''") + "')",
];

let idx = 0;
for (const name of names) {
	const [ox, oy] = SPACES[name];
	const x = Math.max(0, Math.min(2417 - CW, Math.round(ox / 2) - CW / 2));
	const y = Math.max(0, Math.min(806 - CH, Math.round(oy / 2) - CH / 2));
	const row = Math.floor(idx / COLS), col = idx % COLS;
	const dst = path.join(GRID_DIR, String(idx).padStart(2, "0") + "_" + idx + ".png").replace(/'/g, "''");
	ps.push("$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]" + CW + ", [int]" + CH + ")");
	ps.push("$g = [System.Drawing.Graphics]::FromImage($bmp)");
	ps.push("$srcRect = New-Object System.Drawing.Rectangle -ArgumentList @([int]" + x + ", [int]" + y + ", [int]" + CW + ", [int]" + CH + ")");
	ps.push("$dstRect = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]" + CW + ", [int]" + CH + ")");
	ps.push("$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)");
	ps.push("$g.Dispose()");
	ps.push("$bmp.Save('" + dst + "', [System.Drawing.Imaging.ImageFormat]::Png)");
	ps.push("$bmp.Dispose()");
	idx++;
}
ps.push("$img.Dispose()");
fs.writeFileSync(path.join(OUT_DIR, "_crop.ps1"), ps.join("\n"), "utf8");

/* 输出名字与索引的对照 */
const map = names.map((n, i) => i + " = " + n).join("\n");
fs.writeFileSync(path.join(GRID_DIR, "_index.txt"), map, "utf8");

console.log("裁剪 " + names.length + " 个点，每张 " + CW + "x" + CH);
console.log(map);
