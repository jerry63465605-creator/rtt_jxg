/*
 * 地形校验 v2：用小采样圈（紧邻文字外侧 20-45px），并输出每个点的"最佳地块偏移"
 * 即：在点周围搜索，找到最大的同色连通块，report 其颜色与占比。
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

function rgb(x, y) {
	const i = y * W * BPP + x * BPP;
	return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

/* 颜色分类 */
function kind(r, g, b) {
	if (r > 210 && g > 210 && b > 210) return "text";
	if (r < 90 && g < 90 && b < 90) return "line";
	if (g > r && g > b && g > 55) return "land";           // 绿
	if (b > r + 15 && b > 90) return "sea";                 // 蓝
	if (b > g && b > r && b < 160 && r < 110) return "land"; // 深蓝（美国/特殊）
	if (r > 100 && g < 95 && b < 130) return "land";        // 红棕
	return "other";
}

const SPACES = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "spaces_pts.json"), "utf8"));

/* 在点周围环形采样（半径 0-60，跳过文字/线条/其他） */
function sample(cx, cy) {
	const cnt = { land: 0, sea: 0, other: 0, text: 0, line: 0 };
	for (let dy = -60; dy <= 60; dy++) {
		for (let dx = -60; dx <= 60; dx++) {
			const d = Math.hypot(dx, dy);
			if (d > 60) continue;
			const x = Math.round(cx + dx), y = Math.round(cy + dy);
			if (x < 0 || y < 0 || x >= W || y >= H) continue;
			const [r, g, b] = rgb(x, y);
			cnt[kind(r, g, b)]++;
		}
	}
	const total = cnt.land + cnt.sea;
	return {
		...cnt,
		landPct: total ? cnt.land / total : 0,
		seaPct: total ? cnt.sea / total : 0,
		verdict: cnt.land > cnt.sea ? "land" : "sea",
	};
}

let out = ["# 地形校验 v2（60px 内采样）", "", "| 地名 | 坐标 | 声明 | 判定 | 陆/海 |", "|---|---|---|---|---|"];
const issues = [];
for (const [name, v] of Object.entries(SPACES)) {
	const [cx, cy, declared] = v;
	const r = sample(cx, cy);
	const ok = r.verdict === declared;
	if (!ok) issues.push({ name, cx, cy, declared, verdict: r.verdict, lp: r.landPct, sp: r.seaPct });
	out.push("| " + name + " | (" + cx + "," + cy + ") | " + declared + " | **" + r.verdict + "** | " + (r.landPct * 100).toFixed(0) + "%/" + (r.seaPct * 100).toFixed(0) + "% |");
}
fs.writeFileSync(path.join(OUT_DIR, "terrain_check2.md"), out.join("\n"), "utf8");

console.log("不符点: " + issues.length);
for (const i of issues) console.log("  " + i.name.padEnd(8) + " (" + i.cx + "," + i.cy + ") 声明=" + i.declared + " 实测=" + i.verdict + " " + (i.lp * 100).toFixed(0) + "%/" + (i.sp * 100).toFixed(0) + "%");

/* 输出每个点位周围的地块尺寸（用于判断小岛） */
console.log("");
console.log("=== 各点位周围陆地连通块尺寸（判断是否小岛） ===");
for (const [name, v] of Object.entries(SPACES)) {
	const [cx, cy] = v;
	/* 在 200px 范围内找最大的陆地连通块 */
	const R = 200, S = 4;
	const seen = new Set();
	let best = 0;
	for (let dy = -R; dy <= R; dy += S) {
		for (let dx = -R; dx <= R; dx += S) {
			const x = Math.round(cx + dx), y = Math.round(cy + dy);
			const key = x + "," + y;
			if (seen.has(key)) continue;
			if (x < 0 || y < 0 || x >= W || y >= H) continue;
			const [r, g, b] = rgb(x, y);
			if (kind(r, g, b) !== "land") continue;
			/* BFS 该陆地块 */
			const q = [[x, y]]; const vis = new Set([key]);
			let n = 0;
			while (q.length) {
				const [px, py] = q.pop();
				n++;
				for (const [ex, ey] of [[S, 0], [-S, 0], [0, S], [0, -S]]) {
					const nx = px + ex, ny = py + ey;
					const nk = nx + "," + ny;
					if (vis.has(nk)) continue;
					if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
					if (Math.hypot(nx - cx, ny - cy) > R) continue;
					const [r2, g2, b2] = rgb(nx, ny);
					if (kind(r2, g2, b2) === "land") { vis.add(nk); q.push([nx, ny]); }
				}
				for (const k of vis) seen.add(k);
			}
			if (n > best) best = n;
		}
	}
	console.log("  " + name.padEnd(8) + " 最大陆地块 ≈ " + (best * S * S) + " px²");
}
