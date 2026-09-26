/*
 * 最终版地图映射：直接依据 out/numbered_zoom/z1..z8.png 上标注的 R 号。
 * 我在图上看到的「R号 + 地名」配对如下（这是唯一依据，不用坐标猜）。
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));

/* ===== 从编号放大图（numbered_zoom）读到的配对 ===== */
const R2N = {
	/* z1_europe（欧洲，含北非西部/中东） */
	R16: "冰岛",
	R2: "不列颠",
	R107: "西欧",
	R180: "西欧",        // 西欧的第二块（文字切割）
	R1: "北海",
	R79: "波罗的海",
	R89: "德国",
	R24: "北欧",
	R4: "东欧",
	R105: "东欧",
	R102: "莫斯科",
	R132: "乌克兰",
	R130: "乌克兰",      // 乌克兰的第二块
	R310: "巴尔干",
	R151: "意大利",
	R147: "地中海",
	R21: "地中海",
	R144: "黑海",
	R269: "非洲北部",
	R22: "非洲北部",
	R41: "亚速尔",
	R258: "中东",
	R3: "罗斯",
	R5: "罗斯",
	/* z2_ussr_china（苏联/中国） */
	R7: "西伯利亚",
	R8: "中亚",
	R133: "蒙古",
	R128: "中国东北",
	R227: "中国东北",
	R25: "日本",
	R10: "海参崴",
	R176: "中国西部",
	R279: "中国东部",
	/* z3_pacific / z7_aus_pacific */
	R12: "阿拉斯加",
	R11: "北太平洋",
	R336: "中太平洋",
	R509: "南太平洋",
	R278: "南太平洋",
	R513: "澳大利亚",
	R495: "新几内亚",
	/* z4_america / z8_samerica */
	R13: "加拿大",
	R110: "美国",
	R14: "北大西洋",
	R15: "北大西洋",
	R261: "拉丁美洲",
	R17: "冰岛",
	/* z5_africa */
	R276: "南大西洋",
	R378: "非洲东部",
	R549: "马达加斯加",
	R332: "阿拉伯海",
	/* z6_india_ocean */
	R290: "印度",
	R382: "印度洋",
	R367: "东南亚",
	R387: "南海",
	R511: "印度尼西亚",
	R272: "中国西部",
	R6: "非洲南部",
};

/* 补：R310 的实际归属需定；按 z5 图，非洲南部在 (683,1081) 附近 */
const EXTRA_FIX = {
	R310: "非洲南部",
};

const FINAL = { ...R2N, ...EXTRA_FIX };

/* 未映射检查 */
const missing = regions.filter(r => !FINAL["R" + r.id]);
console.log("已映射 " + (regions.length - missing.length) + " / " + regions.length);
if (missing.length) {
	console.log("未映射:");
	for (const r of missing) console.log("  R" + r.id + "  " + r.pixels + "px  (" + Math.round(r.cx) + "," + Math.round(r.cy) + ")");
}

/* 合并同名区域 */
const byName = new Map();
for (const r of regions) {
	const n = FINAL["R" + r.id];
	if (!n) continue;
	if (!byName.has(n)) byName.set(n, { name: n, ids: [], pixels: 0, sx: 0, sy: 0 });
	const g = byName.get(n);
	g.ids.push(r.id);
	g.pixels += r.pixels;
	g.sx += r.cx * r.pixels;
	g.sy += r.cy * r.pixels;
}

const spaces = [];
for (const g of byName.values()) {
	spaces.push({ name: g.name, ids: g.ids, pixels: g.pixels, cx: Math.round(g.sx / g.pixels), cy: Math.round(g.sy / g.pixels) });
}
spaces.sort((a, b) => b.pixels - a.pixels);

/* 邻接 */
const adjPairs = [];
for (const line of fs.readFileSync(path.join(OUT_DIR, "adjacency_v2.md"), "utf8").split("\n")) {
	const m = line.match(/^\|\s*R(\d+)\s*\|\s*R(\d+)\s*\|\s*(\d+)\s*\|/);
	if (m) adjPairs.push({ a: Number(m[1]), b: Number(m[2]), n: Number(m[3]) });
}

const adjSet = new Map();
for (const p of adjPairs) {
	const na = FINAL["R" + p.a], nb = FINAL["R" + p.b];
	if (!na || !nb || na === nb) continue;
	const k = na < nb ? na + "|" + nb : nb + "|" + na;
	adjSet.set(k, (adjSet.get(k) || 0) + p.n);
}
const adjList = [...adjSet.entries()].map(([k, n]) => { const [a, b] = k.split("|"); return { a, b, n }; }).sort((x, y) => y.n - x.n);

/* 输出 */
let out = ["# 地图最终数据", "", "## 格位: " + spaces.length + " 个", "", "| 地名 | 像素 | 中心 | 合并区域 |", "|---|---|---|---|"];
for (const s of spaces) out.push("| " + s.name + " | " + s.pixels + " | (" + s.cx + "," + s.cy + ") | " + s.ids.map(i => "R" + i).join(" ") + " |");
out.push("", "## 邻接: " + adjList.length + " 对", "", "| A | B | 共享像素 |", "|---|---|---|");
for (const a of adjList) out.push("| " + a.a + " | " + a.b + " | " + a.n + " |");
fs.writeFileSync(path.join(OUT_DIR, "map_final.md"), out.join("\n"), "utf8");

fs.writeFileSync(path.join(OUT_DIR, "map_spaces.json"), JSON.stringify(spaces, null, 1), "utf8");
fs.writeFileSync(path.join(OUT_DIR, "map_adjacency.json"), JSON.stringify(adjList, null, 1), "utf8");

console.log("");
console.log("格位数: " + spaces.length);
console.log("邻接对数: " + adjList.length);
console.log("");
for (const s of spaces) console.log("  " + s.name.padEnd(8) + " (" + String(s.cx).padStart(4) + "," + String(s.cy).padStart(4) + ")  " + s.pixels + "px");
