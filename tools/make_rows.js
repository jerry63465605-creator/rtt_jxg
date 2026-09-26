/*
 * 把指定雪碧图按行切成长条图，用于批量识别。
 * 用法: node tools/make_rows.js 153 125
 */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const ROW_DIR = path.join(OUT_DIR, "rows");
fs.mkdirSync(ROW_DIR, { recursive: true });

const sheetNums = process.argv.slice(2);
if (sheetNums.length === 0) {
	console.error("用法: node tools/make_rows.js <sheetNum> [sheetNum...]");
	process.exit(1);
}

/* 从 cards_review.csv 找出 sheet -> file/grid */
const csvText = fs.readFileSync(path.join(OUT_DIR, "cards_review.csv"), "utf8").replace(/^\uFEFF/, "");
const lines = csvText.split("\n").slice(1).filter(Boolean);
function parseLine(line) {
	const out = []; let cur = "", inQ = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQ) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
		else { if (ch === '"') inQ = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; }
	}
	out.push(cur); return out;
}

const sheets = new Map();
for (const line of lines) {
	const f = parseLine(line);
	const sheet_num = f[3], grid = f[6], file = f[12];
	if (!file) continue;
	if (!sheetNums.includes(sheet_num)) continue;
	const [nw, nh] = grid.split("x").map(Number);
	sheets.set(sheet_num, { sheet_num, file, nw, nh });
}

console.log("目标雪碧图: " + sheets.size);

const ps = [
	"Add-Type -AssemblyName System.Drawing",
	"$ErrorActionPreference = 'Stop'",
	"$outdir = '" + ROW_DIR.replace(/'/g, "''") + "'",
];

for (const s of sheets.values()) {
	const src = path.join(IMAGES_DIR, s.file).replace(/'/g, "''");
	ps.push("");
	ps.push("$img = [System.Drawing.Image]::FromFile('" + src + "')");
	ps.push("$cw = [int]($img.Width / " + s.nw + "); $ch = [int]($img.Height / " + s.nh + ")");
	ps.push("$ow = [int]($img.Width); $oh = [int]$ch");
	for (let r = 0; r < s.nh; r++) {
		const dst = path.join(ROW_DIR, "sheet" + s.sheet_num + "_row" + r + ".png").replace(/'/g, "''");
		ps.push("$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]$ow, [int]$oh)");
		ps.push("$g = [System.Drawing.Graphics]::FromImage($bmp)");
		ps.push("$srcRect = New-Object System.Drawing.Rectangle -ArgumentList @(0, [int](" + r + " * $ch), [int]$ow, [int]$ch)");
		ps.push("$dstRect = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]$ow, [int]$ch)");
		ps.push("$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)");
		ps.push("$g.Dispose()");
		ps.push("$bmp.Save('" + dst + "', [System.Drawing.Imaging.ImageFormat]::Png)");
		ps.push("$bmp.Dispose()");
	}
	ps.push("$img.Dispose()");
}
ps.push("Write-Output 'ROWS_DONE'");

fs.writeFileSync(path.join(OUT_DIR, "_rows.ps1"), ps.join("\n"), "utf8");
console.log("已生成 _rows.ps1, 条数: " + [...sheets.values()].reduce((a, s) => a + s.nh, 0));
