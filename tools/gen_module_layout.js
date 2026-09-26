/*
 * 生成模块的 layout.js
 * 用法: node tools/gen_module_layout.js
 *
 * 格式（与 PoG 一致）：layout["格位名"] = [x, y, w, h]
 * 坐标为格位标签的左上角；我们从标定得到的中心点反推，并按地形给方块尺寸。
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "out", "adjacency.json");
const DST = path.join(ROOT, "server-official", "public", "quartermaster-sub-wars", "layout.js");

const adj = JSON.parse(fs.readFileSync(SRC, "utf8"));

/* 视觉尺寸：需与底图上的白色地名文字尺度匹配（文字高约 90px） */
const SIZE = {
	land: 118,
	sea: 106,
};

const lines = [];
lines.push("/*");
lines.push(" * 军需官 · 次要战场 —— 格位布局");
lines.push(" * 由 tools/gen_module_layout.js 从 out/adjacency.json 生成，请勿手改。");
lines.push(" * 格式: layout[\"格位名\"] = [x, y, w, h]  (x,y = 左上角)");
lines.push(" */");
lines.push("");
lines.push("const layout = {");

for (const [name, s] of Object.entries(adj.spaces)) {
	const size = SIZE[s.terrain] || 72;
	/* 标定点是中心，转成左上角 */
	const x = Math.round(s.x - size / 2);
	const y = Math.round(s.y - size / 2);
	lines.push("\t" + JSON.stringify(name) + ": [" + x + ", " + y + ", " + size + ", " + size + "],");
}

lines.push("}");
lines.push("");
lines.push("if (typeof module !== 'undefined') module.exports = layout");
lines.push("");

fs.writeFileSync(DST, lines.join("\n"), "utf8");
console.log("已生成 " + DST);
console.log("格位 " + Object.keys(adj.spaces).length + " 个");
console.log("陆地块 " + SIZE.land + "px / 海域块 " + SIZE.sea + "px");
