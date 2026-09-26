/*
 * 写入最终的区域 -> 地名映射
 * 数据来源：人工逐块读取 out/numbered_zoom/z1..z8.png（2026-09-21）
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));

/* 从编号放大图读出的映射：regionId -> [name, terrain, supply, home_base] */
const MAP = {
	// ===== 陆地 =====
	R16: ["冰岛", "land", "", ""],
	R2: ["不列颠", "land", "TRUE", "英国"],
	R107: ["西欧", "land", "TRUE", "法国"],
	R89: ["德国", "land", "TRUE", "德国"],
	R24: ["北欧", "land", "", ""],
	R105: ["东欧", "land", "", ""],
	R102: ["莫斯科", "land", "TRUE", "苏联"],
	R132: ["乌克兰", "land", "TRUE", ""],
	R310: ["巴尔干", "land", "", ""],
	R151: ["意大利", "land", "TRUE", "意大利"],
	R22: ["非洲北部", "land", "TRUE", ""],
	R258: ["中东", "land", "TRUE", ""],
	R3: ["罗斯", "land", "", ""],
	R5: ["西伯利亚", "land", "", ""],
	R7: ["西伯利亚", "land", "", ""],
	R8: ["中亚", "land", "", ""],
	R133: ["蒙古", "land", "", ""],
	R128: ["中国东北", "land", "", ""],
	R227: ["中国东北", "land", "", ""],
	R10: ["海参崴", "land", "", ""],
	R12: ["阿拉斯加", "land", "", ""],
	R13: ["加拿大", "land", "TRUE", ""],
	R110: ["美国", "land", "TRUE", "美国"],
	R261: ["拉丁美洲", "land", "", ""],
	R176: ["中国西部", "land", "TRUE", ""],
	R279: ["中国东部", "land", "TRUE", "中国"],
	R25: ["日本", "land", "TRUE", "日本"],
	R290: ["印度", "land", "TRUE", ""],
	R367: ["东南亚", "land", "TRUE", ""],
	R387: ["南海", "sea", "", ""],
	R511: ["印度尼西亚", "land", "", ""],
	R495: ["新几内亚", "land", "", ""],
	R513: ["澳大利亚", "land", "TRUE", ""],
	R310: ["非洲南部", "land", "TRUE", ""],
	R378: ["非洲东部", "land", "", ""],
	R549: ["马达加斯加", "land", "", ""],
	// ===== 海域 =====
	R1: ["北海", "sea", "", ""],
	R79: ["波罗的海", "sea", "", ""],
	R21: ["地中海", "sea", "", ""],
	R144: ["黑海", "sea", "", ""],
	R41: ["亚速尔", "sea", "", ""],
	R14: ["北大西洋", "sea", "", ""],
	R15: ["北大西洋", "sea", "", ""],
	R11: ["北太平洋", "sea", "", ""],
	R336: ["中太平洋", "sea", "", ""],
	R509: ["南太平洋", "sea", "", ""],
	R276: ["南大西洋", "sea", "", ""],
	R332: ["阿拉伯海", "sea", "", ""],
	R382: ["印度洋", "sea", "", ""],
};

/* 已知补充（从图里读出但需再确认） */
const EXTRA = {
	R495: ["新几内亚", "land", "", ""],
	R509: ["南太平洋", "sea", "", ""],
	R41: ["亚速尔", "sea", "", ""],
	R144: ["黑海", "sea", "", ""],
	R79: ["波罗的海", "sea", "", ""],
	R367: ["东南亚", "land", "TRUE", ""],
	R290: ["印度", "land", "TRUE", ""],
	R387: ["南海", "sea", "", ""],
	R511: ["印度尼西亚", "land", "", ""],
	R513: ["澳大利亚", "land", "TRUE", ""],
	R549: ["马达加斯加", "land", "", ""],
};

/* 合并（EXTRA 覆盖 MAP 中可能不准的项） */
const FINAL = { ...MAP, ...EXTRA };

let lines = ["region_id,pixels,cx,cy,name_CN,terrain,supply,home_base,note"];
const sorted = regions.slice().sort((a, b) => b.pixels - a.pixels);
const missing = [];
for (const r of sorted) {
	const m = FINAL["R" + r.id];
	if (!m) {
		missing.push(r);
		lines.push(["R" + r.id, r.pixels, Math.round(r.cx), Math.round(r.cy), "", "", "", "", "待识别"].join(","));
	} else {
		lines.push(["R" + r.id, r.pixels, Math.round(r.cx), Math.round(r.cy), m[0], m[1], m[2], m[3], ""].join(","));
	}
}
fs.writeFileSync(path.join(OUT_DIR, "region_names.csv"), "\uFEFF" + lines.join("\n"), "utf8");

console.log("区域总数: " + sorted.length + "  已映射: " + (sorted.length - missing.length) + "  待识别: " + missing.length);
if (missing.length) {
	console.log("");
	console.log("待识别:");
	for (const r of missing) console.log("  R" + r.id + "  " + r.pixels + "px  中心(" + Math.round(r.cx) + "," + Math.round(r.cy) + ")");
}

/* 检查重名（一个陆地区域被两个不同 R 占用） */
const nameUse = new Map();
for (const r of sorted) {
	const m = FINAL["R" + r.id];
	if (!m) continue;
	if (!nameUse.has(m[0])) nameUse.set(m[0], []);
	nameUse.get(m[0]).push("R" + r.id);
}
console.log("");
console.log("重名检查:");
for (const [n, ids] of nameUse) {
	if (ids.length > 1) console.log("  " + n + " -> " + ids.join(", ") + "  (需区分，如 A/B 两侧)");
}
