/*
 * 检查"被切碎的区域"：找出所有 R 的包围盒，看哪些在空间上紧邻且应属同一地区。
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));

/* 读邻接对 */
const adjText = fs.readFileSync(path.join(OUT_DIR, "adjacency_v2.md"), "utf8");
const adjPairs = [];
for (const line of adjText.split("\n")) {
	const m = line.match(/^\|\s*R(\d+)\s*\|\s*R(\d+)\s*\|\s*(\d+)\s*\|/);
	if (m) adjPairs.push({ a: Number(m[1]), b: Number(m[2]), n: Number(m[3]) });
}
console.log("邻接对: " + adjPairs.length);

const byId = new Map(regions.map(r => [r.id, r]));

/* 找出"面积小但邻接少"的碎片 */
console.log("");
console.log("=== 所有区域（按面积升序，小的是候选碎片）===");
const sorted = regions.slice().sort((a, b) => a.pixels - b.pixels);
for (const r of sorted.slice(0, 20)) {
	const neighbors = adjPairs.filter(p => p.a === r.id || p.b === r.id)
		.map(p => (p.a === r.id ? p.b : p.a) + "(" + p.n + ")");
	console.log("  R" + String(r.id).padEnd(4) + " " + String(r.pixels).padStart(8) + "px  中心(" + Math.round(r.cx) + "," + Math.round(r.cy) + ")  邻接 " + neighbors.length + " 个: " + neighbors.join(" "));
}

/* 输出全部区域的邻接，供人工判断 */
let out = ["# 区域邻接全表", ""];
for (const r of regions.slice().sort((a, b) => a.id - b.id)) {
	const neighbors = adjPairs.filter(p => p.a === r.id || p.b === r.id)
		.map(p => "R" + (p.a === r.id ? p.b : p.a) + "(" + p.n + ")");
	out.push("R" + r.id + "  " + r.pixels + "px  中心(" + Math.round(r.cx) + "," + Math.round(r.cy) + ")");
	out.push("    邻接: " + (neighbors.length ? neighbors.join(" ") : "(无)"));
}
fs.writeFileSync(path.join(OUT_DIR, "adjacency_full.md"), out.join("\n"), "utf8");
console.log("");
console.log("输出: out/adjacency_full.md");
