/*
 * 连通性编译：out/spaces_calibrated.json  ->  out/adjacency.json
 *
 * 作用：把"点位 + 连线"这种便于人工编辑的格式，编译成 rules.js 直接可用的
 *      邻接表，并且把阵营私有的连通（有限连通 / 海峡动态）预先展开。
 *
 * 用法: node tools/build_adjacency.js
 *
 * 输出结构：
 * {
 *   meta:      { map, updated, source, counts },
 *   spaces:    { <名称>: { terrain, supply, home, strait, strait_default } },
 *   adjacency: { axis: { <名称>: [邻居...] }, allies: { ... } },
 *   straits:   [ { space, default, a, b, connected } ],   // 海峡动态开关
 *   limited:   [ { a, b, side, note } ],                   // 有限连通（非海峡）
 *   warnings:  [ ... ]
 * }
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "out", "spaces_calibrated.json");
const DST = path.join(__dirname, "..", "out", "adjacency.json");

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const points = raw.points || [];
const links = raw.links || [];
const byName = new Map(points.map(p => [p.name, p]));

const warnings = [];

/* ---------- 1. 校验 ---------- */
const nameCount = {};
for (const p of points) nameCount[p.name] = (nameCount[p.name] || 0) + 1;
for (const [n, c] of Object.entries(nameCount)) {
	if (c > 1) warnings.push("重名格位 " + n + " x" + c + "（连线按名字索引会歧义）");
}

for (const l of links) {
	if (!byName.has(l.a)) warnings.push("连线引用了不存在的格位: " + l.a);
	if (!byName.has(l.b)) warnings.push("连线引用了不存在的格位: " + l.b);
	if (l.type === "limited" && !l.side) warnings.push("有限连通缺少 side: " + l.a + "—" + l.b);
	if (l.type === "strait") {
		if (!l.note) warnings.push("海峡连线缺少 note(所属陆地): " + l.a + "—" + l.b);
		else if (!byName.has(l.note)) warnings.push("海峡连线的 note 不是有效格位: " + l.note);
		const pa = byName.get(l.a), pb = byName.get(l.b);
		if (pa && pb && (pa.terrain !== "sea" || pb.terrain !== "sea"))
			warnings.push("海峡连线必须连两片海域: " + l.a + "—" + l.b);
	}
}

/* 海峡覆盖检查 */
const straitSpaces = points.filter(p => p.strait);
const straitLinks = links.filter(l => l.type === "strait");
for (const p of straitSpaces) {
	const n = straitLinks.filter(l => l.note === p.name).length;
	if (n === 0) warnings.push("海峡陆地「" + p.name + "」尚未连线");
	if (n > 1) warnings.push("海峡陆地「" + p.name + "」有多条海峡线(" + n + ")");
}

/* ---------- 2. 单条边对某阵营是否可用 ---------- */
function straitDefaultOf(spaceName) {
	const sp = byName.get(spaceName);
	return (sp && sp.strait_default) ? sp.strait_default : "allies";
}

function linkUsable(l, side) {
	if (l.type === "normal") return true;
	if (l.type === "limited") return l.side === side;
	if (l.type === "strait") return straitDefaultOf(l.note) === side;
	return false;
}

/* ---------- 3. 生成两阵营邻接表 ---------- */
function buildAdj(side) {
	const adj = {};
	for (const p of points) adj[p.name] = [];
	for (const l of links) {
		if (!linkUsable(l, side)) continue;
		if (!adj[l.a] || !adj[l.b]) continue;
		adj[l.a].push(l.b);
		adj[l.b].push(l.a);
	}
	/* 去重 + 排序，保证输出确定性 */
	for (const k of Object.keys(adj)) {
		adj[k] = [...new Set(adj[k])].sort((x, y) => x.localeCompare(y, "zh"));
	}
	return adj;
}

const adjacency = { axis: buildAdj("axis"), allies: buildAdj("allies") };

/* ---------- 4. 海峡动态表 ---------- */
const straits = straitSpaces.map(p => {
	const l = straitLinks.find(x => x.note === p.name);
	return {
		space: p.name,
		default: straitDefaultOf(p.name),
		a: l ? l.a : null,
		b: l ? l.b : null,
		connected: !!l,
	};
});

/* ---------- 5. 有限连通明细（非海峡） ---------- */
const limited = links
	.filter(l => l.type === "limited")
	.map(l => ({ a: l.a, b: l.b, side: l.side, note: l.note || "" }));

/* ---------- 6. 统计 & 连通块 ---------- */
function components(adj, filterFn) {
	const seen = new Set(), out = [];
	for (const name of Object.keys(adj)) {
		const p = byName.get(name);
		if (!p || !filterFn(p) || seen.has(name)) continue;
		const stack = [name], grp = [];
		seen.add(name);
		while (stack.length) {
			const cur = stack.pop(); grp.push(cur);
			for (const n of adj[cur] || []) {
				const np = byName.get(n);
				if (np && filterFn(np) && !seen.has(n)) { seen.add(n); stack.push(n); }
			}
		}
		out.push(grp.sort((a, b) => a.localeCompare(b, "zh")));
	}
	return out.sort((a, b) => b.length - a.length);
}

const stats = {
	points: points.length,
	land: points.filter(p => p.terrain === "land").length,
	sea: points.filter(p => p.terrain === "sea").length,
	links: links.length,
	normal: links.filter(l => l.type === "normal").length,
	limited: limited.length,
	strait: straitLinks.length,
	straitSpaces: straitSpaces.length,
	straitCovered: straits.filter(s => s.connected).length,
};

const out = {
	meta: {
		map: raw.map || "quartermaster-sub-wars",
		source: "out/spaces_calibrated.json",
		width: raw.width, height: raw.height,
		updated: new Date().toISOString(),
		counts: stats,
	},
	spaces: Object.fromEntries(points.map(p => [p.name, {
		terrain: p.terrain,
		supply: !!p.supply,
		home: !!p.home,
		strait: !!p.strait,
		strait_default: p.strait ? straitDefaultOf(p.name) : null,
		x: p.x, y: p.y,
	}])),
	adjacency,
	straits,
	limited,
	components: {
		land: components(adjacency.allies, p => p.terrain === "land"),
		sea_axis: components(adjacency.axis, p => p.terrain === "sea"),
		sea_allies: components(adjacency.allies, p => p.terrain === "sea"),
	},
	warnings,
};

fs.writeFileSync(DST, JSON.stringify(out, null, 1), "utf8");

/* ---------- 7. 控制台报告 ---------- */
console.log("已生成 " + DST);
console.log("");
console.log("格位 " + stats.points + " (陆 " + stats.land + " / 海 " + stats.sea + ")");
console.log("连线 " + stats.links + "  普通 " + stats.normal + " / 有限 " + stats.limited + " / 海峡 " + stats.strait);
console.log("海峡陆地 " + stats.straitCovered + "/" + stats.straitSpaces + " 已连");
console.log("");
for (const side of ["axis", "allies"]) {
	const n = out.components["sea_" + side].length;
	console.log("[" + (side === "axis" ? "轴心" : "同盟") + "] 海域 " + n + " 块: " +
		out.components["sea_" + side].map(g => g.length).join(" + "));
}
console.log("");
if (warnings.length) {
	console.log("警告 " + warnings.length + " 条:");
	warnings.forEach(w => console.log("  ! " + w));
} else {
	console.log("无警告");
}
