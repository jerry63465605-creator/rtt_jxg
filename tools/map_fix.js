/*
 * 用"区域中心坐标"匹配到编号图上读到的 (R号, 地名) 对。
 *
 * 我从 out/numbered_zoom/z1..z8.png 逐块读到的 R 号与地名如下（已核对）：
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));

/* 从编号放大图读到的 (R号 -> 地名)。这是最终依据。 */
const R2N = {
	// z1_europe
	R16: "冰岛",
	R2: "不列颠",
	R107: "西欧",
	R1: "北海",
	R79: "波罗的海",
	R89: "德国",
	R24: "北欧",
	R105: "东欧",
	R102: "莫斯科",
	R132: "乌克兰",
	R310: "巴尔干",
	R151: "意大利",
	R21: "地中海",
	R22: "非洲北部",
	R144: "黑海",
	R41: "亚速尔",
	R258: "中东",
	R3: "罗斯",
	R5: "罗斯",
	// z2_ussr_china
	R7: "西伯利亚",
	R8: "中亚",
	R133: "蒙古",
	R128: "中国东北",
	R227: "中国东北",
	R25: "东海",
	R10: "海参崴",
	R176: "中国西部",
	R279: "中国东部",
	// z3_pacific
	R12: "阿拉斯加",
	R11: "北太平洋",
	R336: "中太平洋",
	R509: "南太平洋",
	// z4_america
	R13: "加拿大",
	R110: "美国",
	R14: "北大西洋",
	R15: "北大西洋",
	R261: "拉丁美洲",
	R17: "冰岛",
	// z5_africa
	R276: "南大西洋",
	R310: "非洲南部",
	R378: "非洲东部",
	R549: "马达加斯加",
	R332: "阿拉伯海",
	// z6_india_ocean
	R290: "印度",
	R382: "印度洋",
	R367: "东南亚",
	R387: "南海",
	R511: "印度尼西亚",
	R495: "新几内亚",
	R513: "澳大利亚",
};

/* 修正：R310 在 z1 里是"巴尔干"，在 z5 里是"非洲南部" —— 说明我看错了其中一个。
 * 用坐标判断：R310 中心 (683,1081)，y=1081 是下半图（非洲），所以是"非洲南部"。
 * 巴尔干应该是另一个 R。 */
delete R2N.R310;

/* 从坐标推断正确的 R 号：检查每个区域中心与阅读到地名的位置是否一致 */
const byId = new Map(regions.map(r => [r.id, r]));
let out = ["# 区域坐标与地名核对", ""];
out.push("| R | 像素 | 中心 | 图上读到的地名 |");
out.push("|---|---|---|---|");
for (const r of regions.slice().sort((a, b) => a.id - b.id)) {
	const n = R2N["R" + r.id] || "(未映射)";
	out.push("| R" + r.id + " | " + r.pixels + " | (" + Math.round(r.cx) + "," + Math.round(r.cy) + ") | " + n + " |");
}
fs.writeFileSync(path.join(OUT_DIR, "region_check.md"), out.join("\n"), "utf8");

/* 统计 */
const mapped = regions.filter(r => R2N["R" + r.id]);
console.log("区域总数 " + regions.length + "  已映射 " + mapped.length);
console.log("");
console.log("未映射的区域:");
for (const r of regions) {
	if (!R2N["R" + r.id]) console.log("  R" + r.id + "  " + r.pixels + "px  中心(" + Math.round(r.cx) + "," + Math.round(r.cy) + ")");
}

/* 重名检查 */
const use = new Map();
for (const r of regions) {
	const n = R2N["R" + r.id];
	if (!n) continue;
	if (!use.has(n)) use.set(n, []);
	use.get(n).push({ id: r.id, cx: Math.round(r.cx), cy: Math.round(r.cy), pixels: r.pixels });
}
console.log("");
console.log("同名区域（需合并或区分）:");
for (const [n, list] of use) {
	if (list.length > 1) console.log("  " + n + ": " + list.map(x => "R" + x.id + "(" + x.cx + "," + x.cy + ")").join(" "));
}
