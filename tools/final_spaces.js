/*
 * 最终格位清点：
 * 结合 (1) 彩色小岛色块  (2) ★星标位置  (3) 地名文字
 * 输出完整格位清单
 *
 * 已知:
 *   - 41 个主要格位（由 49 个区域合并而来）
 *   - 岛屿格位：夏威夷、硫磺岛（有实体小岛 + ★）
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "out");
const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));

/* 主格位映射（41 个，来自 map_v3.js 的验证结果） */
const MAIN = {
	"北太平洋": { cx: 3536, cy: 862, terrain: "sea" },
	"南太平洋": { cx: 4071, cy: 1316, terrain: "sea" },
	"印度洋": { cx: 1877, cy: 1365, terrain: "sea" },
	"南大西洋": { cx: 353, cy: 1248, terrain: "sea" },
	"西伯利亚": { cx: 1992, cy: 198, terrain: "land" },
	"北大西洋": { cx: 4490, cy: 488, terrain: "sea" },
	"不列颠": { cx: 431, cy: 257, terrain: "land", supply: 1, home: "英国" },
	"非洲南部": { cx: 683, cy: 1081, terrain: "land", supply: 1 },
	"中太平洋": { cx: 3058, cy: 946, terrain: "sea" },
	"阿拉伯海": { cx: 1397, cy: 1073, terrain: "sea" },
	"加拿大": { cx: 4090, cy: 169, terrain: "land", supply: 1 },
	"拉丁美洲": { cx: 4199, cy: 1054, terrain: "land" },
	"日本": { cx: 2706, cy: 602, terrain: "land", supply: 1, home: "日本" },
	"美国": { cx: 4015, cy: 442, terrain: "land", supply: 1, home: "美国" },
	"中国西部": { cx: 2123, cy: 682, terrain: "land", supply: 1 },
	"南海": { cx: 2494, cy: 1163, terrain: "sea" },
	"乌克兰": { cx: 1558, cy: 494, terrain: "land", supply: 1 },
	"海参崴": { cx: 2739, cy: 215, terrain: "land" },
	"非洲北部": { cx: 761, cy: 732, terrain: "land", supply: 1 },
	"中东": { cx: 1366, cy: 731, terrain: "land", supply: 1 },
	"非洲东部": { cx: 1058, cy: 1060, terrain: "land" },
	"北海": { cx: 55, cy: 408, terrain: "sea" },
	"印度": { cx: 1807, cy: 817, terrain: "land", supply: 1 },
	"澳大利亚": { cx: 2756, cy: 1394, terrain: "land", supply: 1 },
	"意大利": { cx: 829, cy: 586, terrain: "land", supply: 1, home: "意大利" },
	"中国东北": { cx: 2286, cy: 512, terrain: "land" },
	"阿拉斯加": { cx: 3482, cy: 58, terrain: "land" },
	"东欧": { cx: 1247, cy: 176, terrain: "land" },
	"罗斯": { cx: 1057, cy: 94, terrain: "land" },
	"西欧": { cx: 697, cy: 440, terrain: "land", supply: 1, home: "法国" },
	"蒙古": { cx: 2495, cy: 449, terrain: "land" },
	"东南亚": { cx: 2174, cy: 927, terrain: "land", supply: 1 },
	"黑海": { cx: 1299, cy: 527, terrain: "sea" },
	"地中海": { cx: 963, cy: 498, terrain: "sea" },
	"德国": { cx: 1046, cy: 312, terrain: "land", supply: 1, home: "德国" },
	"波罗的海": { cx: 904, cy: 231, terrain: "sea" },
	"冰岛": { cx: 91, cy: 37, terrain: "land" },
	"莫斯科": { cx: 1278, cy: 290, terrain: "land", supply: 1, home: "苏联" },
	"马达加斯加": { cx: 1167, cy: 1390, terrain: "land" },
	"新几内亚": { cx: 2839, cy: 1156, terrain: "land" },
	"印度尼西亚": { cx: 2436, cy: 1244, terrain: "land" },
};

/* 岛屿格位（本次新增，含实体地块 + ★） */
const ISLANDS = {
	"夏威夷": { cx: 3354, cy: 287, terrain: "land", supply: 1 },
	"硫磺岛": { cx: 3095, cy: 1357, terrain: "land", supply: 1 },
	"亚速尔": { cx: 190, cy: 355, terrain: "land" },
	"新西兰": { cx: 3038, cy: 1384, terrain: "land" },
	"菲律宾": { cx: 2561, cy: 830, terrain: "land" },
};

const ALL = { ...MAIN, ...ISLANDS };

let out = ["# 最终格位清单", ""];
out.push("| 地名 | 中心 | 地形 | 补给点 | 大本营 |");
out.push("|---|---|---|---|---|");
const names = Object.keys(ALL).sort((a, b) => ALL[b].cx - ALL[a].cx);
for (const n of names) {
	const s = ALL[n];
	out.push("| " + n + " | (" + s.cx + "," + s.cy + ") | " + s.terrain + " | " + (s.supply ? "★" : "") + " | " + (s.home || "") + " |");
}
fs.writeFileSync(path.join(OUT_DIR, "spaces_final.md"), out.join("\n"), "utf8");
fs.writeFileSync(path.join(OUT_DIR, "spaces_final.json"), JSON.stringify(ALL, null, 1), "utf8");

const landCount = Object.values(ALL).filter(s => s.terrain === "land").length;
const seaCount = Object.values(ALL).filter(s => s.terrain === "sea").length;
console.log("格位总数: " + Object.keys(ALL).length + "  (陆地 " + landCount + " / 海域 " + seaCount + ")");
console.log("补给点: " + Object.values(ALL).filter(s => s.supply).length);
console.log("");
console.log("输出: out/spaces_final.md, out/spaces_final.json");
