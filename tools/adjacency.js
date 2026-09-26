/*
 * 通过"区域边界线"提取地图邻接关系。
 *
 * 原理：
 *   地图上每个区域（陆/海）被深棕色边界线包围。
 *   两个区域相邻 <=> 它们共享一段边界线。
 *
 * 方法：
 *   1. 对区域做 flood fill（以边界线为墙），得到每个像素所属区域 ID
 *   2. 扫描所有像素对（右邻 + 下邻），若属于不同区域且都非边界 => 记录邻接
 *   3. 统计邻接像素数，超过阈值才算真邻接（排除噪声）
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

function rgbAt(x, y) {
	const i = y * W * BPP + x * BPP;
	if (img.channels >= 3) return [img.data[i], img.data[i + 1], img.data[i + 2]];
	const pi = img.data[i] * 3;
	return [img.palette[pi], img.palette[pi + 1], img.palette[pi + 2]];
}

/* 分类: 0=边界线 1=区域内容 */
const isWall = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const [r, g, b] = rgbAt(x, y);
		// 边界线是很深的棕色/黑色: 三通道都低，或棕色调(r略>g>b)且都很暗
		const dark = (r < 95 && g < 95 && b < 95);
		const brownish = (r < 110 && g < 95 && b < 85);
		isWall[y * W + x] = (dark || brownish) ? 1 : 0;
	}
}

/* flood fill 标记区域 */
const label = new Int32Array(W * H).fill(0);
let nextLabel = 0;
const regions = [];
const stack = [];

for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const idx = y * W + x;
		if (isWall[idx] || label[idx] !== 0) continue;
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
			// 4 邻接
			const cand = [p - 1, p + 1, p - W, p + W];
			const cx = [pxx - 1, pxx + 1, pxx, pxx];
			const cy = [py, py, py - 1, py + 1];
			for (let k = 0; k < 4; k++) {
				const nx = cx[k], ny = cy[k];
				if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
				const ni = ny * W + nx;
				if (!isWall[ni] && label[ni] === 0) { label[ni] = nextLabel; stack.push(ni); }
			}
		}
		regions.push({ id: nextLabel, pixels: n, minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
	}
}

console.log("区域总数: " + regions.length);

/* 统计邻接：扫描水平/垂直相邻像素对 */
const adjCount = new Map();
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const a = label[y * W + x];
		if (a === 0) continue;
		// 右邻
		if (x + 1 < W) {
			const b = label[y * W + x + 1];
			if (b !== 0 && b !== a) {
				const k = a < b ? a + ":" + b : b + ":" + a;
				adjCount.set(k, (adjCount.get(k) || 0) + 1);
			}
		}
		// 下邻
		if (y + 1 < H) {
			const b = label[(y + 1) * W + x];
			if (b !== 0 && b !== a) {
				const k = a < b ? a + ":" + b : b + ":" + a;
				adjCount.set(k, (adjCount.get(k) || 0) + 1);
			}
		}
	}
}

/* 只保留大区域之间的邻接 */
const bigIds = new Set(regions.filter(r => r.pixels > 4000).map(r => r.id));
console.log("大区域数 (>4000px): " + bigIds.size);

const pairs = [...adjCount.entries()]
	.map(([k, n]) => { const [a, b] = k.split(":").map(Number); return { a, b, n }; })
	.filter(p => bigIds.has(p.a) && bigIds.has(p.b) && p.n > 30)
	.sort((x, y) => y.n - x.n);

console.log("有效邻接对: " + pairs.length);

/* 输出 */
let out = ["# 地图区域邻接提取", "", "## 大区域清单", "", "| ID | 像素 | 包围盒 | 中心 |", "|---|---|---|---|"];
for (const r of regions.filter(r => r.pixels > 4000).sort((a, b) => b.pixels - a.pixels)) {
	out.push("| R" + r.id + " | " + r.pixels + " | (" + r.minX + "," + r.minY + ")~(" + r.maxX + "," + r.maxY + ") | (" + r.cx.toFixed(0) + "," + r.cy.toFixed(0) + ") |");
}
out.push("", "## 邻接对（共享边界像素数）", "", "| 区域A | 区域B | 共享像素 |", "|---|---|---|");
for (const p of pairs) {
	out.push("| R" + p.a + " | R" + p.b + " | " + p.n + " |");
}
fs.writeFileSync(path.join(OUT_DIR, "adjacency.md"), out.join("\n"), "utf8");

/* 保存 label 用于后续可视化 */
fs.writeFileSync(path.join(OUT_DIR, "_label.bin"), Buffer.from(label.buffer));

console.log("");
console.log("输出: out/adjacency.md");
console.log("");
console.log("前 30 个邻接对:");
for (const p of pairs.slice(0, 30)) console.log("  R" + p.a + " <-> R" + p.b + "  共享 " + p.n + " px");
