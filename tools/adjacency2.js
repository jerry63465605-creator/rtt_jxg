/*
 * 邻接提取 v2：利用上一轮已生成的 label.bin（区域标记）与像素分类，
 * 检测"边界线两侧分别是什么区域"，从而得到邻接。
 *
 * 原理：
 *   对每个被标记为墙（边界线）的像素，向上下左右各方向探索，
 *   找到最近的非墙区域的 label；若两侧 label 不同，则它们是邻接的。
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const W = 4835, H = 1612;

const labelBuf = fs.readFileSync(path.join(OUT_DIR, "_label.bin"));
const label = new Int32Array(labelBuf.buffer, labelBuf.byteOffset, W * H);

/* 需要重新计算 isWall（从 label==0 推断） */
const isWall = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) isWall[i] = label[i] === 0 ? 1 : 0;

/* 区域尺寸统计 */
const sizes = new Map();
for (let i = 0; i < W * H; i++) {
	const l = label[i];
	if (l) sizes.set(l, (sizes.get(l) || 0) + 1);
}

const bigIds = new Set();
for (const [id, n] of sizes) if (n > 4000) bigIds.add(id);
console.log("大区域数: " + bigIds.size);

/* 对每个墙像素，找左右/上下的最近区域 */
const adjCount = new Map();
const MAXD = 14;   // 最多探索 14 像素（边界线一般 5-8 px）

function addAdj(a, b) {
	if (!a || !b || a === b) return;
	if (!bigIds.has(a) || !bigIds.has(b)) return;
	const k = a < b ? a + ":" + b : b + ":" + a;
	adjCount.set(k, (adjCount.get(k) || 0) + 1);
}

for (let y = 1; y < H - 1; y++) {
	for (let x = 1; x < W - 1; x++) {
		if (!isWall[y * W + x]) continue;

		/* 水平方向：向左、向右找最近区域 */
		let left = 0, right = 0;
		for (let d = 1; d <= MAXD; d++) {
			const nx = x - d;
			if (nx < 0) break;
			const l = label[y * W + nx];
			if (l) { left = l; break; }
		}
		for (let d = 1; d <= MAXD; d++) {
			const nx = x + d;
			if (nx >= W) break;
			const l = label[y * W + nx];
			if (l) { right = l; break; }
		}
		if (left && right && left !== right) addAdj(left, right);

		/* 垂直方向 */
		let up = 0, down = 0;
		for (let d = 1; d <= MAXD; d++) {
			const ny = y - d;
			if (ny < 0) break;
			const l = label[ny * W + x];
			if (l) { up = l; break; }
		}
		for (let d = 1; d <= MAXD; d++) {
			const ny = y + d;
			if (ny >= H) break;
			const l = label[ny * W + x];
			if (l) { down = l; break; }
		}
		if (up && down && up !== down) addAdj(up, down);
	}
}

/* 汇总 */
const pairs = [...adjCount.entries()]
	.map(([k, n]) => { const [a, b] = k.split(":").map(Number); return { a, b, n }; })
	.filter(p => p.n > 100)
	.sort((x, y) => y.n - x.n);

console.log("有效邻接对 (>100 像素): " + pairs.length);

/* 区域信息 */
const regions = [];
for (const id of bigIds) {
	let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			if (label[y * W + x] === id) {
				if (x < minX) minX = x; if (x > maxX) maxX = x;
				if (y < minY) minY = y; if (y > maxY) maxY = y;
			}
		}
	}
	regions.push({ id, pixels: sizes.get(id), minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
}
regions.sort((a, b) => b.pixels - a.pixels);

let out = ["# 地图邻接提取 v2", "", "## 大区域 (" + regions.length + ")", "", "| ID | 像素 | 中心 | 包围盒 |", "|---|---|---|---|"];
for (const r of regions) {
	out.push("| R" + r.id + " | " + r.pixels + " | (" + r.cx.toFixed(0) + "," + r.cy.toFixed(0) + ") | (" + r.minX + "," + r.minY + ")~(" + r.maxX + "," + r.maxY + ") |");
}
out.push("", "## 邻接对 (" + pairs.length + ")", "", "| A | B | 共享像素 |", "|---|---|---|");
for (const p of pairs) out.push("| R" + p.a + " | R" + p.b + " | " + p.n + " |");

fs.writeFileSync(path.join(OUT_DIR, "adjacency_v2.md"), out.join("\n"), "utf8");

/* 输出区域可视化 HTML */
const parts = ['<!DOCTYPE html><html><head><meta charset="utf-8"><title>区域</title><style>body{margin:0;background:#111;color:#eee;font:12px sans-serif}.r{display:inline-block;width:14px;height:14px;margin:2px}</style></head><body><div style="padding:10px">'];
for (const r of regions.slice(0, 60)) {
	const hue = (r.id * 137) % 360;
	parts.push('<span class="r" style="background:hsl(' + hue + ',70%,50%)" title="R' + r.id + ' ' + r.pixels + 'px (' + r.cx.toFixed(0) + ',' + r.cy.toFixed(0) + ')"></span>');
	parts.push('R' + r.id + '&nbsp;&nbsp;');
}
parts.push('</div></body></html>');
fs.writeFileSync(path.join(OUT_DIR, "regions_vis.html"), parts.join(""), "utf8");

console.log("");
console.log(out.join("\n"));
