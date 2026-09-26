/*
 * 校验地形：在地图上采样每个地名点周围的主导底色，判断是陆地还是海域。
 *
 * 陆地色: 绿色系 (g 最大且 > 60) / 深蓝美国 / 红棕色大本营
 * 海域色: 蓝色系 (b 最大且较亮)
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const W = 4835, H = 1612;

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

const img = readPNG(path.join(IMAGES_DIR, "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png"));
const BPP = img.bpp;

/* 地名点（原图坐标） */
const SPACES = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "spaces_pts.json"), "utf8"));

/* 在点周围 N 像素外圈采样（避开文字本身），统计陆地/海域色占比 */
function classify(cx, cy) {
	let land = 0, sea = 0, other = 0;
	const R = 90;
	for (let dy = -R; dy <= R; dy += 3) {
		for (let dx = -R; dx <= R; dx += 3) {
			const d = Math.hypot(dx, dy);
			if (d < 45 || d > R) continue;   // 避开中心（文字）和太远
			const x = Math.round(cx + dx), y = Math.round(cy + dy);
			if (x < 0 || y < 0 || x >= W || y >= H) continue;
			const i = y * W * BPP + x * BPP;
			const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
			if (g > r && g > b && g > 55) land++;
			else if (b > r + 15 && b > 90) sea++;
			else if (r > 100 && g < 95 && b < 130) land++;   // 红/棕（大本营）
			else if (b > g && b > r && b < 155 && r < 105) land++;  // 深蓝美国
			else other++;
		}
	}
	const total = land + sea + other;
	return { land, sea, other, total, landPct: total ? land / total : 0, seaPct: total ? sea / total : 0, verdict: land > sea ? "land" : "sea" };
}

let out = ["# 地形校验（地图底色采样）", "", "| 地名 | 点坐标 | 声明 | 采样判定 | 陆地% | 海域% | 其他% |", "|---|---|---|---|---|---|---|"];
const issues = [];
for (const [name, v] of Object.entries(SPACES)) {
	const [cx, cy, declared] = v;
	const r = classify(cx, cy);
	const ok = r.verdict === declared;
	if (!ok) issues.push({ name, cx, cy, declared, verdict: r.verdict, landPct: r.landPct, seaPct: r.seaPct });
	out.push("| " + name + " | (" + cx + "," + cy + ") | " + declared + " | **" + r.verdict + "** | " + (r.landPct * 100).toFixed(1) + " | " + (r.seaPct * 100).toFixed(1) + " | " + (r.other * 100 / Math.max(1, r.total)).toFixed(1) + " |");
}
fs.writeFileSync(path.join(OUT_DIR, "terrain_check.md"), out.join("\n"), "utf8");

console.log("=== 地形不符的点 (" + issues.length + ") ===");
for (const i of issues) {
	console.log("  " + i.name.padEnd(8) + " (" + i.cx + "," + i.cy + ")  声明=" + i.declared + "  实测=" + i.verdict + "  陆" + (i.landPct * 100).toFixed(0) + "% 海" + (i.seaPct * 100).toFixed(0) + "%");
}
console.log("");
console.log("输出: out/terrain_check.md");
