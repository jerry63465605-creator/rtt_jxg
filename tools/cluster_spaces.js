/*
 * 把 229 个 SnapPoints 聚类成"地区"。
 *
 * 发现的结构规律：
 *   同一地区的槽位 x 相同或相近（间距 1.2），z 分层（陆-29.2 / 海-28 / 空-26.7）
 *   地区与地区之间间距约 3.5
 *
 * 聚类策略：按 z 分层先把 SnapPoints 分成若干"横带"，再在横带内按 x 邻近分簇。
 * 由于地图上下对称（z 正负成对），需分别处理。
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const OUT_DIR = path.join(__dirname, "..", "out");

const mod = JSON.parse(fs.readFileSync(MOD_DIR + "/3763225217.json", "utf8"));
const snaps = (mod.SnapPoints || []).map((s, i) => ({
	id: i + 1,
	x: Math.round(s.Position.x * 100) / 100,
	y: Math.round(s.Position.y * 100) / 100,
	z: Math.round(s.Position.z * 100) / 100,
}));

let out = [];
function log(s) { out.push(String(s)); }

/* 步骤 1: 按 z 值分组（相同 z 的 SnapPoint 在同一横带） */
const byZ = new Map();
for (const s of snaps) {
	if (!byZ.has(s.z)) byZ.set(s.z, []);
	byZ.get(s.z).push(s);
}

log("=== z 值分布（横带） ===");
const zs = [...byZ.keys()].sort((a, b) => a - b);
for (const z of zs) {
	const list = byZ.get(z).sort((a, b) => a.x - b.x);
	const xs = list.map(s => s.x);
	log("z=" + String(z).padStart(7) + "  n=" + String(list.length).padStart(3) + "  x范围 " + Math.min(...xs) + " .. " + Math.max(...xs));
}

/* 步骤 2: 在每个横带内，按 x 间距分簇（间距 > 2.2 视为不同地区） */
const GAP = 2.2;
log("");
log("=== 横带内按 x 分簇 (gap > " + GAP + ") ===");

const clusters = [];
for (const z of zs) {
	const list = byZ.get(z).sort((a, b) => a.x - b.x);
	let cur = [list[0]];
	for (let i = 1; i < list.length; i++) {
		if (list[i].x - list[i - 1].x > GAP) {
			clusters.push({ z, members: cur });
			cur = [list[i]];
		} else {
			cur.push(list[i]);
		}
	}
	clusters.push({ z, members: cur });
}

let i = 0;
for (const c of clusters) {
	i++;
	const xs = c.members.map(m => m.x);
	log("  簇" + String(i).padStart(3) + "  z=" + String(c.z).padStart(7) + "  x=" + Math.min(...xs) + ".." + Math.max(...xs) + "  n=" + c.members.length + "  ids=[" + c.members.map(m => m.id).join(",") + "]");
}

/* 步骤 3: 按 (x, z) 邻近把簇合并成"地区"（z 相差 < 3.5 且 x 重叠） */
log("");
log("=== 合并成地区 (z 相差 < 3.5 且 x 重叠) ===");

function overlap(a, b) {
	const ax1 = Math.min(...a.members.map(m => m.x)), ax2 = Math.max(...a.members.map(m => m.x));
	const bx1 = Math.min(...b.members.map(m => m.x)), bx2 = Math.max(...b.members.map(m => m.x));
	return Math.min(ax2, bx2) - Math.max(ax1, bx1) > -1.0;
}

const used = new Array(clusters.length).fill(false);
const regions = [];
for (let a = 0; a < clusters.length; a++) {
	if (used[a]) continue;
	const group = [clusters[a]];
	used[a] = true;
	let changed = true;
	while (changed) {
		changed = false;
		for (let b = 0; b < clusters.length; b++) {
			if (used[b]) continue;
			const near = group.some(g => Math.abs(g.z - clusters[b].z) < 3.5 && overlap(g, clusters[b]));
			if (near) { group.push(clusters[b]); used[b] = true; changed = true; }
		}
	}
	regions.push(group);
}

log("共 " + regions.length + " 个地区");
log("");
let ri = 0;
const regionRows = [];
for (const g of regions) {
	ri++;
	const all = g.flatMap(c => c.members);
	const xs = all.map(m => m.x), zz = all.map(m => m.z);
	const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2 * 10) / 10;
	const cz = Math.round((Math.min(...zz) + Math.max(...zz)) / 2 * 10) / 10;
	log("地区" + String(ri).padStart(3) + "  中心(" + cx + "," + cz + ")  槽位 " + all.length + "  z层=[" + [...new Set(zz)].sort((a, b) => a - b).join(",") + "]  ids=[" + all.map(m => m.id).sort((a, b) => a - b).join(",") + "]");
	regionRows.push({ region: ri, cx, cz, slots: all.length, ids: all.map(m => m.id).sort((a, b) => a - b), xrange: [Math.min(...xs), Math.max(...xs)], zrange: [Math.min(...zz), Math.max(...zz)] });
}

/* 写 CSV 供人工填地区名 */
function csv(v) { v = String(v ?? ""); return /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
const lines = ["region_id,center_x,center_z,slots,snap_ids,x_min,x_max,z_min,z_max,name_CN,nation,terrain,supply,home_base,neighbors"];
for (const r of regionRows) {
	lines.push([r.region, r.cx, r.cz, r.slots, r.ids.join(" "), r.xrange[0], r.xrange[1], r.zrange[0], r.zrange[1], "", "", "", "", "", ""].map(csv).join(","));
}
fs.writeFileSync(path.join(OUT_DIR, "regions_raw.csv"), "\uFEFF" + lines.join("\n"), "utf8");

fs.writeFileSync(path.join(OUT_DIR, "regions_analysis.md"), out.join("\n"), "utf8");
console.log(out.join("\n").slice(0, 6000));
console.log("");
console.log("输出: out/regions_raw.csv (" + regionRows.length + " 个地区)");
