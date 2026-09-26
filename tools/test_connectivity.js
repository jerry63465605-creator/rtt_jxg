/*
 * 连通性引擎测试：验证普通/有限/海峡动态连通
 * 用法: node tools/test_connectivity.js
 */
const path = require("path");
const MOD = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars", "rules.js");
const rules = require(MOD);
const { data, SPACE } = require(path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars", "data.js"));
const I = rules._internal;

let pass = 0, fail = 0;
function ok(cond, msg) {
	if (cond) { pass++; console.log("  ✓ " + msg); }
	else { fail++; console.log("  ✗ " + msg); }
}
function nm(id) { return data.name_of(id); }

console.log("=== 1. 模块契约 ===");
ok(Array.isArray(rules.roles) && rules.roles.length === 2, "roles = " + JSON.stringify(rules.roles));
ok(typeof rules.setup === "function", "setup 存在");
ok(typeof rules.view === "function", "view 存在");
ok(typeof rules.action === "function", "action 存在");
ok(typeof rules.query === "function", "query 存在");

console.log("\n=== 2. setup / 初始状态 ===");
let game = rules.setup(12345, "Standard", {});
ok(game.turn === 1, "turn = 1");
ok(game.active === "Axis", "先手 = Axis");
ok(Object.keys(game.location).length === 0, "开局无部队");

console.log("\n=== 3. 海峡默认归属（无部队时） ===");
const expectDef = { "北欧": "axis", "非洲北部": "allies", "中东": "allies", "拉丁美洲": "allies" };
for (const [name, def] of Object.entries(expectDef)) {
	const c = I.strait_controller(game, SPACE[name]);
	ok(c === def, name + " 默认控制者 = " + c + " (期望 " + def + ")");
}

console.log("\n=== 4. 北海的连通（基线：无部队） ===");
const NORTH_SEA = SPACE["北海"], BALTIC = SPACE["波罗的海"], MED = SPACE["地中海"];
const base = {
	neutral: I.get_connections(game, NORTH_SEA, null).map(nm).sort(),
	axis: I.get_connections(game, NORTH_SEA, "axis").map(nm).sort(),
	allies: I.get_connections(game, NORTH_SEA, "allies").map(nm).sort(),
};
console.log("  普通: " + base.neutral.join(", "));
console.log("  轴心: " + base.axis.join(", "));
console.log("  同盟: " + base.allies.join(", "));
ok(!base.neutral.includes("波罗的海"), "普通视角：北海 不邻 波罗的海");
ok(!base.neutral.includes("地中海"), "普通视角：北海 不邻 地中海");
ok(base.axis.includes("波罗的海"), "轴心视角：北海 邻 波罗的海（北欧=轴心默认）");
ok(!base.axis.includes("地中海"), "轴心视角：北海 不邻 地中海");
ok(base.allies.includes("地中海"), "同盟视角：北海 邻 地中海（非洲北部=同盟默认）");
ok(!base.allies.includes("波罗的海"), "同盟视角：北海 不邻 波罗的海");

console.log("\n=== 5. 海峡动态：同盟占领北欧，夺取丹麦海峡 ===");
rules.action(game, "Allies", "debug_place", {
	piece: "p_uk_1", nation: "英国", type: "army", space: SPACE["北欧"],
});
ok(I.strait_controller(game, SPACE["北欧"]) === "allies", "占领北欧后，控制者变为 allies");
const after = I.get_connections(game, NORTH_SEA, "allies").map(nm);
const afterAxis = I.get_connections(game, NORTH_SEA, "axis").map(nm);
console.log("  同盟: " + after.join(", "));
console.log("  轴心: " + afterAxis.join(", "));
ok(after.includes("波罗的海"), "同盟视角：北海 现在邻 波罗的海");
ok(!afterAxis.includes("波罗的海"), "轴心视角：北海 不再邻 波罗的海");

console.log("\n=== 6. 动态性：撤走部队，恢复默认 ===");
rules.action(game, "Allies", "debug_remove", { piece: "p_uk_1" });
ok(I.strait_controller(game, SPACE["北欧"]) === "axis", "撤走后，控制者恢复为 axis");
const back = I.get_connections(game, NORTH_SEA, "axis").map(nm);
ok(back.includes("波罗的海"), "轴心视角：北海 重新邻 波罗的海");

console.log("\n=== 7. 有限连通（非海峡）：西欧-非洲北部 仅轴心 ===");
const WE = SPACE["西欧"], NA = SPACE["非洲北部"];
ok(!I.get_connections(game, WE, null).map(nm).includes("非洲北部"), "普通视角：西欧 不邻 非洲北部");
ok(I.get_connections(game, WE, "axis").map(nm).includes("非洲北部"), "轴心视角：西欧 邻 非洲北部");
ok(!I.get_connections(game, WE, "allies").map(nm).includes("非洲北部"), "同盟视角：西欧 不邻 非洲北部");

console.log("\n=== 8. 邻接对称性（每方视角） ===");
let asym = 0;
for (const side of ["axis", "allies"]) {
	for (let i = 1; i < data.spaces.length; i++)
		for (const nb of I.get_connections(game, i, side))
			if (!I.get_connections(game, nb, side).includes(i)) asym++;
}
ok(asym === 0, "全部对称（不对称 " + asym + " 处）");

console.log("\n=== 9. 所有海峡逐一验证 ===");
for (const s of data.straits) {
	const ctrl = I.strait_controller(game, s.id);
	const sideA = I.get_connections(game, s.a, ctrl).map(nm);
	const other = ctrl === "axis" ? "allies" : "axis";
	const sideB = I.get_connections(game, s.a, other).map(nm);
	const a = nm(s.a), b = nm(s.b);
	if (a === b) { ok(false, s.name + " 海峡两端同名"); continue; }
	ok(sideA.includes(b), s.name + "：控制方(" + ctrl + ") 视角 " + a + " 邻 " + b);
	ok(!sideB.includes(b), s.name + "：非控制方(" + other + ") 视角 " + a + " 不邻 " + b);
}

console.log("\n=== 10. view / query ===");
const v = rules.view(game, "Axis");
ok(v.side === "axis", "view.side = axis");
ok(v.spaces && v.spaces.length === 54, "view.spaces 长度 54（含占位）");
ok(v.adjacency && Object.keys(v.adjacency).length === 53, "view.adjacency 53 项");
ok(v.strait_control["北欧"] === "axis", "view.strait_control.北欧 = axis");
const qr = rules.query(game, "Axis", "straits");
ok(Array.isArray(qr) && qr.length === 4, "query('straits') 返回 4 个海峡");
const v2 = rules.view(game, "Allies");
ok(v2.adjacency[NORTH_SEA].includes(MED), "同盟视角 view.adjacency[北海] 含地中海");
ok(!v.adjacency[NORTH_SEA].includes(MED), "轴心视角 view.adjacency[北海] 不含地中海");

console.log("\n=== 11. 序列化（RTT 需要 state 可 JSON 往返） ===");
const json = JSON.stringify(game);
const restored = JSON.parse(json);
const c1 = I.strait_controller(game, SPACE["北欧"]);
const c2 = I.strait_controller(restored, SPACE["北欧"]);
ok(c1 === c2, "JSON 往返后控制权一致 (" + c1 + ")");
rules.action(restored, "Axis", "debug_place", { piece: "p_de_1", nation: "德国", type: "army", space: SPACE["北欧"] });
ok(I.strait_controller(restored, SPACE["北欧"]) === "axis", "往返后可继续操作并生效");

console.log("\n=== 12. RTT 契约关键点 ===");
const g2 = rules.setup(1, "Standard", {});
const ret = rules.action(g2, "Axis", "debug_place", { piece: "x1", nation: "德国", type: "army", space: SPACE["德国"] });
ok(ret !== undefined && ret !== null, "action 返回 state（不可返回 undefined，否则服务器读 $pie 崩溃）");
ok(ret === g2, "返回的是同一个 state 对象");
ok(Array.isArray(ret.log), "返回的 state 含 log 数组");

/* view 必须只读 */
const snapBefore = JSON.stringify(g2.limited_connections);
rules.view(g2, "Axis");
rules.view(g2, "Allies");
const snapAfter = JSON.stringify(g2.limited_connections);
ok(snapBefore === snapAfter, "view 不修改 state.limited_connections（只读）");

/* view.actions 必须是对象（RTT 用 view_actions[verb] 查表） */
const v3 = rules.view(g2, "Axis");
ok(v3.actions !== null && typeof v3.actions === "object" && !Array.isArray(v3.actions),
	"view.actions 是对象（非数组）");
ok(v3.actions.debug_place === 1, "view.actions.debug_place = 1");
const v4 = rules.view(g2, "Allies");
ok(v4.actions === null, "非本方回合 actions = null");

console.log("\n" + "=".repeat(46));
console.log("通过 " + pass + " / 失败 " + fail);
process.exit(fail ? 1 : 0);
