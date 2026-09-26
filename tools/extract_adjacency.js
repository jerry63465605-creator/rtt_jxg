/*
 * 从地图提取地区邻接关系。
 *
 * 方法：
 *   1. 分类每个像素：海洋 / 陆地 / 边界线 / 文字
 *   2. 用边界线（棕色/深色）+ 海洋 作为"墙"，对陆地做连通域标记 → 得到各个陆地区域
 *   3. 对每个陆地区域，检查它在"跨越细分隔线"后是否与另一个区域接触
 *      （因分隔线很细，把线膨胀 2px 抹掉后，相邻区域会连成一片，再数接触边界）
 *   4. 对海域同理
 *
 * 输出：region_pixels.csv（每个区域的像素数与包围盒）、adjacency.csv（邻接对）
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const mapFile = "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png";

function readPNG(file) {
	const buf = fs.readFileSync(file);
	let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
	const idat = [];
	let palette = null;
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
const W = img.width, H = img.height, BPP = img.bpp;

function px(x, y) {
	const i = y * W * BPP + x * BPP;
	if (img.channels >= 3) return [img.data[i], img.data[i + 1], img.data[i + 2]];
	const pi = img.data[i] * 3;
	return [img.palette[pi], img.palette[pi + 1], img.palette[pi + 2]];
}

/* 分类：0=其他 1=海洋 2=陆地 3=深色线/文字 */
const cls = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const [r, g, b] = px(x, y);
		let c = 0;
		// 海洋：蓝主导（b 明显大于 r，且整体偏亮）
		if (b > r + 25 && b > 100) c = 1;
		// 陆地：绿主导
		else if (g > r && g > b && g > 60) c = 2;
		// 深蓝（美国）：b 主导但整体暗
		else if (b > g && b > r && b < 140) c = 2;
		// 深色（边界线/文字描边）
		else if (r < 80 && g < 80 && b < 80) c = 3;
		// 亮色（白色文字）
		else if (r > 180 && g > 180 && b > 180) c = 4;
		cls[y * W + x] = c;
	}
}

/* 统计 */
const counts = {};
for (let i = 0; i < cls.length; i++) counts[cls[i]] = (counts[cls[i]] || 0) + 1;
console.log("像素分类: 其他=" + (counts[0] || 0) + " 海洋=" + (counts[1] || 0) + " 陆地=" + (counts[2] || 0) + " 深线=" + (counts[3] || 0) + " 亮字=" + (counts[4] || 0));

/* 连通域标记（陆地）—— 8 邻接 */
const label = new Int32Array(W * H).fill(0);
let nextLabel = 0;
const regions = [];

const stack = [];
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const idx = y * W + x;
		if (cls[idx] !== 2 || label[idx] !== 0) continue;
		nextLabel++;
		stack.length = 0;
		stack.push(idx);
		label[idx] = nextLabel;
		let n = 0, minX = x, maxX = x, minY = y, maxY = y;
		while (stack.length) {
			const p = stack.pop();
			const py = (p / W) | 0, pxx = p - py * W;
			n++;
			if (pxx < minX) minX = pxx; if (pxx > maxX) maxX = pxx;
			if (py < minY) minY = py; if (py > maxY) maxY = py;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if (!dx && !dy) continue;
					const nx = pxx + dx, ny = py + dy;
					if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
					const ni = ny * W + nx;
					if (cls[ni] === 2 && label[ni] === 0) { label[ni] = nextLabel; stack.push(ni); }
				}
			}
		}
		regions.push({ id: nextLabel, pixels: n, minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
	}
}

/* 只保留足够大的区域（面积 > 3000 像素） */
const big = regions.filter(r => r.pixels > 3000 && (r.maxX - r.minX) > 40 && (r.maxY - r.minY) > 40);
big.sort((a, b) => b.pixels - a.pixels);

console.log("");
console.log("陆地连通域总数: " + regions.length + "  其中较大 (>3000px): " + big.length);
console.log("");
console.log("=== 较大陆地区域（按面积） ===");
let out = ["# 地图陆地区域（连通域分析）", "", "| 序号 | 像素数 | 包围盒 | 中心 |", "|---|---|---|---|"];
big.forEach((r, i) => {
	console.log("  #" + (i + 1) + "  " + r.pixels + "px  盒(" + r.minX + "," + r.minY + ")-(" + r.maxX + "," + r.maxY + ")  中心(" + r.cx.toFixed(0) + "," + r.cy.toFixed(0) + ")");
	out.push("| " + (i + 1) + " | " + r.pixels + " | (" + r.minX + "," + r.minY + ")-(" + r.maxX + "," + r.maxY + ") | (" + r.cx.toFixed(0) + "," + r.cy.toFixed(0) + ") |");
});

fs.writeFileSync(path.join(OUT_DIR, "land_regions.md"), out.join("\n"), "utf8");
fs.writeFileSync(path.join(OUT_DIR, "_cls.bin"), Buffer.from(cls));
console.log("");
console.log("输出: out/land_regions.md, out/_cls.bin (像素分类缓存)");
