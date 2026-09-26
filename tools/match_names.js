/*
 * 把 52 个 SnapPoint 地区本体，与 49 个区域做匹配，
 * 再用"区域包围盒 + 地图上的地名位置"建立映射。
 *
 * SnapPoints 的 z=±18 是"地区本体"。
 * TTS 坐标 -> 地图像素坐标的映射需要标定。
 *
 * 标定方法：
 *   已知 SnapPoints x 范围 -49..49, z 范围 -33..33
 *   地图尺寸 4835 x 1612
 *   但 SnapPoints 未必覆盖整图，先看能否正好对应。
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const OUT_DIR = path.join(__dirname, "..", "out");

const mod = JSON.parse(fs.readFileSync(MOD_DIR + "/3763225217.json", "utf8"));
const snaps = (mod.SnapPoints || []).map((s, i) => ({ id: i + 1, x: s.Position.x, z: s.Position.z }));

const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));

/* 试映射：SnapPoints 包围盒 -> 地图全部尺寸 */
const minX = -49, maxX = 49, minZ = -33, maxZ = 33;
const W = 4835, H = 1612;

function toPx(x, z) {
	return {
		px: (x - minX) / (maxX - minX) * W,
		py: (z - minZ) / (maxZ - minZ) * H,
	};
}

/* 对每个区域，找最近的 SnapPoint 地区本体（z≈18 或 -18） */
const regionSnaps = [];
for (const r of regions) {
	let best = null, bestD = 1e9;
	for (const s of snaps) {
		if (Math.abs(Math.abs(s.z) - 18) > 0.5) continue;  // 只要地区本体层
		const p = toPx(s.x, s.z);
		const d = Math.hypot(p.px - r.cx, p.py - r.cy);
		if (d < bestD) { bestD = d; best = { snap: s, px: p.px, py: p.py }; }
	}
	regionSnaps.push({ region: r.id, cx: r.cx, cy: r.cy, pixels: r.pixels, snap: best ? best.snap.id : null, snapX: best ? best.snap.x : null, snapZ: best ? best.snap.z : null, dist: bestD, px: best ? best.px : 0, py: best ? best.py : 0 });
}

let out = ["# 区域 <-> SnapPoint 匹配（验证坐标映射）", ""];
out.push("假设: SnapPoint(x:-49..49, z:-33..33) 线性映射到 地图(0..4835, 0..1612)");
out.push("");
out.push("| 区域 | 像素 | 区域中心(px) | 最近Snap | Snap坐标 | Snap像素 | 距离 |");
out.push("|---|---|---|---|---|---|---|");
regionSnaps.sort((a, b) => b.pixels - a.pixels);
for (const r of regionSnaps) {
	out.push("| R" + r.region + " | " + r.pixels + " | (" + r.cx.toFixed(0) + "," + r.cy.toFixed(0) + ") | #" + r.snap + " | (" + r.snapX + "," + r.snapZ + ") | (" + r.px.toFixed(0) + "," + r.py.toFixed(0) + ") | " + r.dist.toFixed(0) + " |");
}

/* 反推：SnapPoint 在图上是否落在对应区域内部？ */
const inside = regionSnaps.filter(r => r.dist < 120).length;
out.push("");
out.push("距离 < 120px 的匹配数: " + inside + " / " + regionSnaps.length);

fs.writeFileSync(path.join(OUT_DIR, "region_snap_match.md"), out.join("\n"), "utf8");
console.log(out.join("\n"));
