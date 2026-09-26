/*
 * 把卡组雪碧图按网格切片，输出单张卡面图片。
 * 用 Windows 自带 System.Drawing 通过 PowerShell 切片，避免安装原生模块。
 */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const SLICE_DIR = path.join(OUT_DIR, "cards_sliced");

fs.mkdirSync(SLICE_DIR, { recursive: true });

/* 读 cards_review.csv */
const csvText = fs.readFileSync(path.join(OUT_DIR, "cards_review.csv"), "utf8").replace(/^\uFEFF/, "");
const lines = csvText.split("\n").slice(1).filter(Boolean);

function parseLine(line) {
	const out = [];
	let cur = "", inQ = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQ) {
			if (ch === '"') {
				if (line[i + 1] === '"') { cur += '"'; i++; }
				else inQ = false;
			} else cur += ch;
		} else {
			if (ch === '"') inQ = true;
			else if (ch === ",") { out.push(cur); cur = ""; }
			else cur += ch;
		}
	}
	out.push(cur);
	return out;
}

/* sheet_num + file -> 网格 */
const sheets = new Map();
for (const line of lines) {
	const f = parseLine(line);
	const sheet_num = f[3], grid = f[6], face_img_file = f[12];
	if (!face_img_file) continue;
	const key = sheet_num + "|" + face_img_file;
	if (!sheets.has(key)) {
		const [nw, nh] = grid.split("x").map(Number);
		sheets.set(key, { sheet_num, file: face_img_file, nw, nh });
	}
}

console.log("雪碧图: " + sheets.size);

/* 生成 PowerShell 脚本：位置用显式整数计算，避免 New-Object 参数解析问题 */
const psLines = [
	"Add-Type -AssemblyName System.Drawing",
	"$ErrorActionPreference = 'Stop'",
	"$outdir = '" + SLICE_DIR.replace(/'/g, "''") + "'",
];

for (const s of sheets.values()) {
	const srcPath = path.join(IMAGES_DIR, s.file).replace(/'/g, "''");
	psLines.push("");
	psLines.push("$img = [System.Drawing.Image]::FromFile('" + srcPath + "')");
	psLines.push("$cw = [int]($img.Width / " + s.nw + ")");
	psLines.push("$ch = [int]($img.Height / " + s.nh + ")");
	for (let r = 0; r < s.nh; r++) {
		for (let c = 0; c < s.nw; c++) {
			const outFile = path.join(SLICE_DIR, "sheet" + s.sheet_num + "_r" + r + "_c" + c + ".png").replace(/'/g, "''");
			psLines.push("$bx = " + (c * 1) + " * $cw; $by = " + (r * 1) + " * $ch");
			psLines.push("$rect = New-Object System.Drawing.Rectangle -ArgumentList @([int]$bx, [int]$by, [int]$cw, [int]$ch)");
			psLines.push("$dst = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, [int]$cw, [int]$ch)");
			psLines.push("$bmp = New-Object System.Drawing.Bitmap -ArgumentList @([int]$cw, [int]$ch)");
			psLines.push("$g = [System.Drawing.Graphics]::FromImage($bmp)");
			psLines.push("$g.DrawImage($img, $dst, $rect, [System.Drawing.GraphicsUnit]::Pixel)");
			psLines.push("$bmp.Save('" + outFile + "', [System.Drawing.Imaging.ImageFormat]::Png)");
			psLines.push("$g.Dispose(); $bmp.Dispose()");
		}
	}
	psLines.push("$img.Dispose()");
}
psLines.push("Write-Output 'SLICE_DONE'");

const psScript = path.join(OUT_DIR, "_slice.ps1");
fs.writeFileSync(psScript, psLines.join("\n"), "utf8");
console.log("切片总数: " + [...sheets.values()].reduce((a, s) => a + s.nw * s.nh, 0));
console.log("脚本: " + psScript);
