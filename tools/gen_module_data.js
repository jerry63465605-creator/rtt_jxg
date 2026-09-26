/*
 * 把 out/adjacency.json 编译成 RTT 模块的 data.js
 *
 * 继承 PoG 的邻接建模约定：
 *   space.connections          普通连通（双方都通），完整邻居列表
 *   space.limited_connections  阵营私有连通，键为阵营名，值为【完整邻居列表】
 *                              （= 普通连通 + 该阵营额外可用），与 PoG 一致
 *
 * 读取（与 PoG 同构）：
 *   get_connections(s, side) => limited_connections[side] ?? connections
 *
 * 关键：以【边】为单位判定归属，而不是以点为单位算差集，
 *       否则 A->B 与 B->A 会得出不同结论（不对称）。
 *
 * 用法: node tools/gen_module_data.js
 * 输出: server-official/public/quartermaster-sub-wars/data.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "out", "adjacency.json");
const DST_DIR = path.join(ROOT, "server-official", "public", "quartermaster-sub-wars");
const DST = path.join(DST_DIR, "data.js");

const adj = JSON.parse(fs.readFileSync(SRC, "utf8"));
const names = Object.keys(adj.spaces);
const idOf = new Map();
names.forEach((n, i) => idOf.set(n, i + 1));

/* ---------- 1. 以【边】为单位归一化 ---------- */
/* 枚举所有无向边，记录每侧是否连通 */
const edgeMap = new Map();   // "a|b"(名字升序) -> { a, b, inAxis, inAllies }
function edgeKey(x, y) { return x < y ? x + "|" + y : y + "|" + x; }
function getEdge(x, y) {
	const k = edgeKey(x, y);
	if (!edgeMap.has(k)) edgeMap.set(k, { a: x, b: y, inAxis: false, inAllies: false });
	return edgeMap.get(k);
}
for (const [a, nbrs] of Object.entries(adj.adjacency.axis))
	for (const b of nbrs) getEdge(a, b).inAxis = true;
for (const [a, nbrs] of Object.entries(adj.adjacency.allies))
	for (const b of nbrs) getEdge(a, b).inAllies = true;

/* 一致性自检：edgeMap 必须双向覆盖（由 adjacency 的双向性保证） */
for (const e of edgeMap.values()) {
	if (!adj.adjacency.axis[e.a]?.includes(e.b) && !adj.adjacency.allies[e.a]?.includes(e.b))
		console.log("[警告] 边 " + e.a + "-" + e.b + " 未被任一方包含");
}

/* ---------- 2. 按边分配 ---------- */
/* connections     = 双方都通
 * limited[side]   = 该方可用（含普通边），即完整列表 */
const neutralNbrs = new Map(names.map(n => [n, new Set()]));
const sideNbrs = { axis: new Map(names.map(n => [n, new Set()])), allies: new Map(names.map(n => [n, new Set()])) };

for (const e of edgeMap.values()) {
	if (e.inAxis) {
		sideNbrs.axis.get(e.a).add(e.b);
		sideNbrs.axis.get(e.b).add(e.a);
	}
	if (e.inAllies) {
		sideNbrs.allies.get(e.a).add(e.b);
		sideNbrs.allies.get(e.b).add(e.a);
	}
	if (e.inAxis && e.inAllies) {
		neutralNbrs.get(e.a).add(e.b);
		neutralNbrs.get(e.b).add(e.a);
	}
}

/* ---------- 3. 组装 spaces ---------- */
const spaces = [{}];
const privateInfo = [];
for (const n of names) {
	const s = adj.spaces[n];
	const rec = {
		id: idOf.get(n),
		name: n,
		terrain: s.terrain,
		supply: !!s.supply,
		home_base: !!s.home,
		strait: !!s.strait,
		x: s.x,
		y: s.y,
		connections: [...neutralNbrs.get(n)].map(x => idOf.get(x)).sort((a, b) => a - b),
	};

	/* 某一侧的邻居集合与普通连通不同 -> 需要 limited_connections
	 * 存【完整列表】：普通 + 该侧额外（与 PoG 一致） */
	const lim = {};
	for (const side of ["axis", "allies"]) {
		const full = [...sideNbrs[side].get(n)].map(x => idOf.get(x)).sort((a, b) => a - b);
		const neutral = rec.connections;
		if (full.length !== neutral.length) {
			lim[side] = full;
			privateInfo.push(n + "[" + side + "] 多 " + (full.length - neutral.length) + " 个");
		}
	}
	if (Object.keys(lim).length) rec.limited_connections = lim;
	spaces.push(rec);
}

/* ---------- 4. 海峡表 ---------- */
const straits = adj.straits.map(s => ({
	name: s.space,
	id: idOf.get(s.space),
	def: s.default,
	a: s.a ? idOf.get(s.a) : null,
	b: s.b ? idOf.get(s.b) : null,
}));

/* ---------- 5. 生成文件 ---------- */
const L = [];
const q = (x) => JSON.stringify(x);
L.push("/*");
L.push(" * 军需官 · 次要战场（自研变体） —— 地图数据");
L.push(" *");
L.push(" * 由 tools/gen_module_data.js 从 out/adjacency.json 自动生成，请勿手改。");
L.push(" * 人工标定源: out/spaces_calibrated.json");
L.push(" * 生成时间: " + new Date().toISOString());
L.push(" *");
L.push(" * 邻接建模沿用 PoG 约定:");
L.push(" *   space.connections            普通连通（双方都通），完整邻居列表");
L.push(" *   space.limited_connections    阵营私有连通，值为【完整邻居列表】");
L.push(" *   get_connections(s, side) => limited_connections[side] ?? connections");
L.push(" *");
L.push(" * 海峡产生的动态连通已按『默认控制方』预置；运行期由 rules.js 按");
L.push(" * 实际控制者重新生成（见 rebuild_strait_connections）。");
L.push(" */");
L.push("");
L.push("const data = {}");
L.push("");
L.push("data.map = " + JSON.stringify({
	name: adj.meta.map,
	width: adj.meta.width,
	height: adj.meta.height,
	source: adj.meta.source,
	counts: adj.meta.counts,
}, null, 1));
L.push("");
L.push("/* ---------- 格位 id 常量 ---------- */");
L.push("const SPACE = {");
for (const n of names) L.push("\t" + q(n) + ": " + idOf.get(n) + ",");
L.push("}");
L.push("");
L.push("/* ---------- 阵营 ---------- */");
L.push("const AXIS = 'axis'");
L.push("const ALLIES = 'allies'");
L.push("");
L.push("/* ---------- 海峡（陆地格位 -> 打通的两片海域） ---------- */");
L.push("data.straits = [");
for (const s of straits) {
	L.push("\t{ name: " + q(s.name) + ", id: " + s.id + ", def: " + q(s.def) +
		", a: " + s.a + ", b: " + s.b + " },");
}
L.push("]");
L.push("");
L.push("/* ---------- 格位（1-based，索引 0 为空占位） ---------- */");
L.push("data.spaces = " + JSON.stringify(spaces, null, 1));
L.push("");
L.push("/* ---------- 邻接查询（与 PoG 同构） ---------- */");
L.push("data.get_connections = function (s, side) {");
L.push("\tconst sp = data.spaces[s]");
L.push("\tif (!sp) return []");
L.push("\tif (side && sp.limited_connections && sp.limited_connections[side])");
L.push("\t\treturn sp.limited_connections[side]");
L.push("\treturn sp.connections");
L.push("}");
L.push("");
L.push("/* 便利：按名字取 id */");
L.push("data.id_of = function (name) { return SPACE[name] }");
L.push("data.name_of = function (id) { const s = data.spaces[id]; return s ? s.name : null }");
L.push("");
L.push("if (typeof module !== 'undefined') module.exports = { data, SPACE, AXIS, ALLIES }");
L.push("");

fs.mkdirSync(DST_DIR, { recursive: true });
fs.writeFileSync(DST, L.join("\n"), "utf8");

/* ---------- 6. 报告 ---------- */
let withLim = 0, la = 0, lx = 0;
for (const s of spaces.slice(1)) {
	if (s.limited_connections) {
		withLim++;
		if (s.limited_connections.allies) la++;
		if (s.limited_connections.axis) lx++;
	}
}
console.log("已生成 " + DST);
console.log("");
console.log("格位 " + names.length + " (陆 " + adj.meta.counts.land + " / 海 " + adj.meta.counts.sea + ")");
console.log("无向边 " + edgeMap.size);
console.log("海峡 " + straits.length + " 个");
console.log("带阵营私有连通的格位 " + withLim + " 个 (轴心 " + lx + " / 同盟 " + la + ")");
console.log("");
console.log(privateInfo.join("\n"));
