/*
 * 最终地图数据生成：
 *   - 区域 -> 地名映射（含碎块合并）
 *   - 邻接表（含碎块合并、东西环绕处理）
 *   - 输出 RTT 模块用的 data.js / spaces 数据
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));
const byId = new Map(regions.map(r => [r.id, r]));

/* 读邻接对 */
const adjPairs = [];
for (const line of fs.readFileSync(path.join(OUT_DIR, "adjacency_v2.md"), "utf8").split("\n")) {
	const m = line.match(/^\|\s*R(\d+)\s*\|\s*R(\d+)\s*\|\s*(\d+)\s*\|/);
	if (m) adjPairs.push({ a: Number(m[1]), b: Number(m[2]), n: Number(m[3]) });
}

/* 人工映射：regionId -> 地名（基于 numbered_zoom 逐块读图） */
const NAME = {
	R16: "冰岛", R17: "冰岛",
	R2: "不列颠",
	R107: "西欧", R180: "西欧",
	R89: "德国",
	R24: "北欧", R79: "波罗的海", R3: "罗斯", R5: "西伯利亚",
	R102: "莫斯科", R4: "东欧", R105: "东欧",
	R132: "乌克兰", R144: "黑海",
	R147: "地中海", R151: "意大利", R21: "地中海",
	R310: "巴尔干", R269: "非洲北部", R22: "非洲北部",
	R258: "中东",
	R130: "乌克兰/罗斯",
	R133: "蒙古", R128: "中国东北", R227: "中国东北",
	R176: "中国西部", R272: "中国西部",
	R279: "中国东部", R10: "海参崴", R25: "日本",
	R7: "西伯利亚", R8: "中亚",
	R12: "阿拉斯加", R13: "加拿大", R110: "美国", R261: "拉丁美洲",
	R290: "印度", R367: "东南亚", R387: "南海", R511: "印度尼西亚",
	R495: "新几内亚", R513: "澳大利亚", R549: "马达加斯加",
	R378: "非洲东部",
	R1: "北海", R14: "北大西洋", R15: "北大西洋", R11: "北太平洋",
	R336: "中太平洋", R509: "南太平洋", R276: "南大西洋",
	R332: "阿拉伯海", R382: "印度洋", R41: "亚速尔",
};

/* 需要确认的补充 */
const EXTRA = {
	R269: "非洲北部",
	R147: "地中海",
	R180: "西欧",
	R130: "乌克兰",
	R4: "东欧",
	R272: "中国西部",
	R17: "冰岛",
	R278: "南太平洋",
	R310: "非洲南部",
	R21: "地中海",
};

const FINAL = { ...NAME, ...EXTRA };

/* 碎块合并：同一地名的多个 R 合并为一个格位 */
const byName = new Map();
for (const r of regions) {
	const n = FINAL["R" + r.id];
	if (!n) continue;
	if (!byName.has(n)) byName.set(n, []);
	byName.get(n).push(r);
}

/* 生成格位 */
const spaces = [];
for (const [name, list] of byName) {
	const total = list.reduce((a, r) => a + r.pixels, 0);
	const cx = list.reduce((a, r) => a + r.cx * r.pixels, 0) / total;
	const cy = list.reduce((a, r) => a + r.cy * r.pixels, 0) / total;
	spaces.push({ name, ids: list.map(r => r.id), pixels: total, cx: Math.round(cx), cy: Math.round(cy) });
}
spaces.sort((a, b) => b.pixels - a.pixels);

/* 生成邻接（把 R 映射到地名后去重） */
const adjSet = new Map();
for (const p of adjPairs) {
	const na = FINAL["R" + p.a], nb = FINAL["R" + p.b];
	if (!na || !nb || na === nb) continue;
	const k = na < nb ? na + "|" + nb : nb + "|" + na;
	adjSet.set(k, (adjSet.get(k) || 0) + p.n);
}

let out = ["# 最终地图数据", ""];
out.push("## 格位（含碎块合并）: " + spaces.length + " 个");
out.push("");
out.push("| 地名 | 像素 | 中心 | 合并的区域ID |");
out.push("|---|---|---|---|");
for (const s of spaces) {
	out.push("| " + s.name + " | " + s.pixels + " | (" + s.cx + "," + s.cy + ") | " + s.ids.map(i => "R" + i).join(" ") + " |");
}

out.push("");
out.push("## 邻接对: " + adjSet.size + " 个");
out.push("");
out.push("| A | B | 共享像素 |");
out.push("|---|---|---|");
const adjList = [...adjSet.entries()].map(([k, n]) => { const [a, b] = k.split("|"); return { a, b, n }; }).sort((x, y) => y.n - x.n);
for (const a of adjList) out.push("| " + a.a + " | " + a.b + " | " + a.n + " |");

fs.writeFileSync(path.join(OUT_DIR, "map_final.md"), out.join("\n"), "utf8");

/* 输出 JSON */
fs.writeFileSync(path.join(OUT_DIR, "map_spaces.json"), JSON.stringify(spaces, null, 1), "utf8");
fs.writeFileSync(path.join(OUT_DIR, "map_adjacency.json"), JSON.stringify(adjList, null, 1), "utf8");

console.log("格位数: " + spaces.length);
console.log("邻接对数: " + adjList.length);
console.log("");
console.log("格位清单:");
for (const s of spaces) console.log("  " + s.name.padEnd(10) + " (" + s.cx + "," + s.cy + ")  " + s.pixels + "px");
console.log("");
const unassigned = regions.filter(r => !FINAL["R" + r.id]);
console.log("未映射区域: " + unassigned.length);
for (const r of unassigned) console.log("  R" + r.id + " " + r.pixels + "px (" + Math.round(r.cx) + "," + Math.round(r.cy) + ")");
