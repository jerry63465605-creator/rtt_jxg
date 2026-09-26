/*
 * 自动检测地图上的白色文字标签中心点。
 *
 * 原理：
 *   1. 提取白色文字像素（亮色 + 被深色描边包围）
 *   2. 连通域聚类成"文字块"
 *   3. 合并邻近的文字块成"标签"（一行字）
 *   4. 输出每个标签的中心点与包围盒
 *
 * 然后与 52 个已知地名对照（人工读图确认哪个标签是哪个地名）。
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

/* 白色文字像素: 很亮 */
const isText = new Uint8Array(W * H);
let textCount = 0;
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const i = y * W * BPP + x * BPP;
		const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
		if (r > 215 && g > 215 && b > 215) { isText[y * W + x] = 1; textCount++; }
	}
}
console.log("白色文字像素: " + textCount);

/* 连通域 -> 字符块 */
const label = new Int32Array(W * H).fill(0);
let nl = 0;
const glyphs = [];
const stack = [];
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const idx = y * W + x;
		if (!isText[idx] || label[idx]) continue;
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
					if (isText[ni] && !label[ni]) { label[ni] = nl; stack.push(ni); }
				}
			}
		}
		glyphs.push({ id: nl, n, minX, maxX, minY, maxY, cx: sx / n, cy: sy / n });
	}
}
console.log("字符块: " + glyphs.length);

/* 合并邻近字符块成标签（水平距离 < 25, 垂直重叠） */
const used = new Uint8Array(glyphs.length);
const clusters = [];
for (let i = 0; i < glyphs.length; i++) {
	if (used[i]) continue;
	const group = [glyphs[i]];
	used[i] = 1;
	let changed = true;
	while (changed) {
		changed = false;
		for (let j = 0; j < glyphs.length; j++) {
			if (used[j]) continue;
			const g = glyphs[j];
			for (const m of group) {
				const hGap = Math.max(0, Math.max(g.minX - m.maxX, m.minX - g.maxX));
				const vOverlap = Math.min(g.maxY, m.maxY) - Math.max(g.minY, m.minY);
				const hOverlap = Math.min(g.maxX, m.maxX) - Math.max(g.minX, m.minX);
				const vGap = Math.max(0, Math.max(g.minY - m.maxY, m.minY - g.maxY));
				if ((hGap < 12 && vOverlap > 0) || (vGap < 8 && hOverlap > 0)) {
					group.push(g); used[j] = 1; changed = true; break;
				}
			}
		}
	}
	const minX = Math.min(...group.map(g => g.minX));
	const maxX = Math.max(...group.map(g => g.maxX));
	const minY = Math.min(...group.map(g => g.minY));
	const maxY = Math.max(...group.map(g => g.maxY));
	const n = group.reduce((a, g) => a + g.n, 0);
	/* 只要够大的（>=2 个字符块 或 面积够大）*/
	if (group.length >= 2 && (maxX - minX) > 20) {
		clusters.push({ minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, glyphs: group.length, pixels: n });
	}
}
console.log("文字标签: " + clusters.length);

/* 输出 */
clusters.sort((a, b) => a.cx - b.cx);
let out = ["# 地图文字标签检测: " + clusters.length + " 个", "", "| # | 中心 | 包围盒 | 字符块 | 尺寸 |", "|---|---|---|---|---|"];
clusters.forEach((c, i) => {
	out.push("| " + (i + 1) + " | (" + c.cx.toFixed(0) + "," + c.cy.toFixed(0) + ") | (" + c.minX + "," + c.minY + ")~(" + c.maxX + "," + c.maxY + ") | " + c.glyphs + " | " + (c.maxX - c.minX) + "x" + (c.maxY - c.minY) + " |");
});
fs.writeFileSync(path.join(OUT_DIR, "labels_detected.md"), out.join("\n"), "utf8");
fs.writeFileSync(path.join(OUT_DIR, "labels_detected.json"), JSON.stringify(clusters.map(c => ({ cx: Math.round(c.cx), cy: Math.round(c.cy), box: [c.minX, c.minY, c.maxX, c.maxY], glyphs: c.glyphs })), null, 1), "utf8");

console.log("输出: out/labels_detected.md, out/labels_detected.json");
console.log("");
console.log("前 40 个标签:");
clusters.slice(0, 40).forEach((c, i) => console.log("  #" + (i + 1) + " (" + c.cx.toFixed(0) + "," + c.cy.toFixed(0) + ")  " + c.glyphs + "字符  " + (c.maxX - c.minX) + "x" + (c.maxY - c.minY)));
