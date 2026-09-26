/*
 * 找出地图上的"岛屿格位"：这些是小面积的陆地区域。
 * 通过"底色是陆地绿/棕/特殊色" 且 面积较小 且 被海域包围 来判定。
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const W = 4835, H = 1612;
const mapFile = "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png";

function readPNG(file) {
	const buf = fs.readFileSync(file);
	let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
	const idat = []; let palette = null;
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const type = buf.toString("ascii", pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
		else if (type === "PLTE") palette = data;
		else if (type === "IDAT") idat.push(data);
		else if (type === "IEND") break;
		pos += 12 + len;
	}
	const raw = zlib.inflateSync(Buffer.concat(idat));
	const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
	const bpp = channels * (bitDepth / 8);
	const stride = width * bpp;
	const out = Buffer.alloc(height * stride);
	let rp = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[rp++];
		const line = raw.subarray(rp, rp + stride); rp += stride;
		const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
		const cur = out.subarray(y * stride, (y + 1) * stride);
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? cur[x - bpp] : 0;
			const b = prev ? prev[x] : 0;
			const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
			let v = line[x];
			switch (filter) {
				case 1: v = (v + a) & 0xff; break;
				case 2: v = (v + b) & 0xff; break;
				case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
				case 4: { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 0xff; break; }
			}
			cur[x] = v;
		}
	}
	return { width, height, channels, bpp, data: out, palette, bitDepth, colorType };
}

const img = readPNG(path.join(IMAGES_DIR, mapFile));
const BPP = img.bpp;

/* 判定"陆地色"：绿色系（g 最大）/ 特殊色（深蓝美国、红、棕） */
function isLandColor(r, g, b) {
	if (g > r && g > b && g > 60) return true;             // 绿
	if (b > g && b > r && b < 150 && r < 100) return true; // 深蓝（美国）
	if (r > 120 && g < 90 && b < 120) return true;         // 红（大本营）
	return false;
}

/* 用连通域找陆地区域 */
const isLand = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const i = y * W * BPP + x * BPP;
		isLand[y * W + x] = isLandColor(img.data[i], img.data[i + 1], img.data[i + 2]) ? 1 : 0;
	}
}

const label = new Int32Array(W * H).fill(0);
let nl = 0;
const areas = [];
const stack = [];
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const idx = y * W + x;
		if (!isLand[idx] || label[idx]) continue;
		nl++;
		stack.length = 0; stack.push(idx); label[idx] = nl;
		let n = 0, minX = x, maxX = x, minY = y, maxY = y, sx = 0, sy = 0;
		while (stack.length) {
			const p = stack.pop();
			const py = (p / W) | 0, px = p - py * W;
			n++; sx += px; sy += py;
			if (px < minX) minX = px; if (px > maxX) maxX = px;
			if (py < minY) minY = py; if (py > maxY) maxY = py;
			for (let d = -1; d <= 1; d++) {
				for (let e = -1; e <= 1; e++) {
					if (!d && !e) continue;
					const nx = px + e, ny = py + d;
					if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
					const ni = ny * W + nx;
					if (isLand[ni] && !label[ni]) { label[ni] = nl; stack.push(ni); }
				}
			}
		}
		areas.push({ id: nl, pixels: n, minX, maxX, minY, maxY, cx: sx / n, cy: sy / n });
	}
}

/* 所有陆地区域，按面积排序 */
areas.sort((a, b) => b.pixels - a.pixels);
let out = ["# 陆地区域（连通域，含岛屿）: " + areas.length + " 个", "", "| # | 像素 | 中心 | 包围盒 | 宽x高 |", "|---|---|---|---|---|"];
areas.forEach((a, i) => {
	out.push("| " + (i + 1) + " | " + a.pixels + " | (" + a.cx.toFixed(0) + "," + a.cy.toFixed(0) + ") | (" + a.minX + "," + a.minY + ")~(" + a.maxX + "," + a.maxY + ") | " + (a.maxX - a.minX + 1) + "x" + (a.maxY - a.minY + 1) + " |");
});
fs.writeFileSync(path.join(OUT_DIR, "land_areas_all.md"), out.join("\n"), "utf8");

console.log("陆地区域总数: " + areas.length);
console.log("");
console.log("=== 前 60 个（按面积） ===");
areas.slice(0, 60).forEach((a, i) => {
	console.log("  #" + String(i + 1).padStart(3) + "  " + String(a.pixels).padStart(9) + "px  中心(" + String(Math.round(a.cx)).padStart(4) + "," + String(Math.round(a.cy)).padStart(4) + ")  " + (a.maxX - a.minX + 1) + "x" + (a.maxY - a.minY + 1));
});
