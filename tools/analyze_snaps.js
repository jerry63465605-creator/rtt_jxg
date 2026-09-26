/*
 * 分析 SnapPoints 结构：
 * 1. 用算子位置反推哪些 SnapPoint 是"地区锚点"
 * 2. 按坐标聚类，识别每个地区的多个摆放位
 * 3. 输出格位拓扑表（含坐标、建议地区名待人工填）
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const OUT_DIR = path.join(__dirname, "..", "out");

const mod = JSON.parse(fs.readFileSync(MOD_DIR + "/3763225217.json", "utf8"));
const snaps = (mod.SnapPoints || []).map((s, i) => ({
	id: i + 1,
	x: Math.round(s.Position.x * 10) / 10,
	z: Math.round(s.Position.z * 10) / 10,
	y: s.Position.y,
}));

let out = [];
function log(s) { out.push(String(s)); }

/* 收集算子位置 */
const pieces = [];
function walk(list) {
	for (const o of list || []) {
		if (o.Name === "Custom_Token" && o.Transform) {
			pieces.push({
				name: o.Nickname || "(无)",
				x: Math.round(o.Transform.posX * 10) / 10,
				z: Math.round(o.Transform.posZ * 10) / 10,
				y: o.Transform.posY,
			});
		}
		if (o.ContainedObjects) walk(o.ContainedObjects);
		if (o.States) for (const k of Object.keys(o.States)) walk(o.States[k]);
	}
}
walk(mod.ObjectStates);

log("=== SnapPoints: " + snaps.length + "   算子: " + pieces.length + " ===");
log("");

/* 找每个算子最近的 SnapPoint */
log("=== 算子 -> 最近 SnapPoint 匹配（前 40） ===");
const usage = new Map();
for (const p of pieces.slice(0, 40)) {
	let best = null, bestD = 1e9;
	for (const s of snaps) {
		const d = Math.hypot(s.x - p.x, s.z - p.z);
		if (d < bestD) { bestD = d; best = s; }
	}
	log("  " + p.name.padEnd(12) + " (" + p.x + "," + p.z + ") -> snap#" + best.id + " (" + best.x + "," + best.z + ") 距离 " + bestD.toFixed(2));
}

/* 统计 SnapPoint 被算子靠近的情况（全部算子） */
for (const p of pieces) {
	let best = null, bestD = 1e9;
	for (const s of snaps) {
		const d = Math.hypot(s.x - p.x, s.z - p.z);
		if (d < bestD) { bestD = d; best = s; }
	}
	if (best && bestD < 3) {
		usage.set(best.id, (usage.get(best.id) || 0) + 1);
	}
}

log("");
log("=== 被算子占用的 SnapPoint (" + usage.size + " 个) ===");
const sorted = [...usage.entries()].sort((a, b) => b[1] - a[1]);
for (const [id, n] of sorted) {
	const s = snaps.find(x => x.id === id);
	log("  snap#" + id + " (" + s.x + "," + s.z + ")  被 " + n + " 个算子占用");
}

/* y 坐标分布：y 越高说明是叠放位置 */
log("");
log("=== SnapPoint y 值分布 ===");
const ys = {};
for (const s of snaps) {
	const k = Math.round(s.y * 100) / 100;
	ys[k] = (ys[k] || 0) + 1;
}
Object.entries(ys).sort((a, b) => a[0] - b[0]).forEach(([y, n]) => log("  y=" + y + " : " + n + " 个"));

/* 按 y 值分组，推测层级 */
log("");
log("=== 按 y 分组的 SnapPoint 数量 ===");
const byY = new Map();
for (const s of snaps) {
	const k = Math.round(s.y * 100) / 100;
	if (!byY.has(k)) byY.set(k, []);
	byY.get(k).push(s);
}
for (const [y, list] of [...byY.entries()].sort((a, b) => a[0] - b[0])) {
	log("  y=" + y + " : " + list.length + " 个");
}

fs.writeFileSync(path.join(OUT_DIR, "snaps_analysis.md"), out.join("\n"), "utf8");
console.log(out.join("\n"));
