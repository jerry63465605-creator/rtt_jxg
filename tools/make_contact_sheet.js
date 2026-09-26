/*
 * 把每张雪碧图的第一行拼成一张"联系表"(contact sheet)，
 * 便于快速浏览每张雪碧图讲的是哪个国家/哪类卡。
 */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const SHEET_DIR = path.join(OUT_DIR, "contact_sheets");

fs.mkdirSync(SHEET_DIR, { recursive: true });

/* 读 cards_review.csv 获得 sheet -> file/grid */
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
	const [nw, nh] = grid.split("x").map(Number);
	sheets.set(sheet_num, { sheet_num, file, nw, nh });
}

/* 生成 PS：每张雪碧图取前 2 行 x 全部列，缩放后横向拼接 */
const ps = [
	"Add-Type -AssemblyName System.Drawing",
	"$ErrorActionPreference = 'Stop'",
	"$outdir = '" + SHEET_DIR.replace(/'/g, "''") + "'",
];
for (const s of [...sheets.values()]) {
	const src = path.join(IMAGES_DIR, s.file).replace(/'/g, "''");
	const rows = Math.min(3, s.nh);
	const dst = path.join(SHEET_DIR, "sheet" + s.sheet_num + "_strip.png").replace(/'/g, "''");
	ps.push("");
	ps.push("$img = [System.Drawing.Image]::FromFile('" + src + "')");
	ps.push("$cw = [int]($img.Width / " + s.nw + "); $ch = [int]($img.Height / " + s.nh + ")");
	ps.push("$sw = [int]($cw / 3); $sh = [int]($ch / 3)");
	ps.push("$outw = $sw * " + s.nw + "; $outh = $sh * " + rows);
	ps.push("$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]$outw, [int]$outh)");
	ps.push("$g = [System.Drawing.Graphics]::FromImage($bmp)");
	ps.push("$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic");
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < s.nw; c++) {
			ps.push("$srcRect = New-Object System.Drawing.Rectangle -ArgumentList @([int](" + c + " * $cw), [int](" + r + " * $ch), [int]$cw, [int]$ch)");
			ps.push("$dstRect = New-Object System.Drawing.Rectangle -ArgumentList @([int](" + c + " * $sw), [int](" + r + " * $sh), [int]$sw, [int]$sh)");
			ps.push("$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)");
		}
	}
	ps.push("$g.Dispose()");
	ps.push("$bmp.Save('" + dst + "', [System.Drawing.Imaging.ImageFormat]::Png)");
	ps.push("$bmp.Dispose(); $img.Dispose()");
}
ps.push("Write-Output 'STRIPS_DONE'");

fs.writeFileSync(path.join(OUT_DIR, "_strips.ps1"), ps.join("\n"), "utf8");
console.log("雪碧图数: " + sheets.size);
console.log("已生成 _strips.ps1");
