/*
 * 端到端验证：用 RTT 服务器同样的方式加载 rules.js，
 * 模拟完整的一局流程（建局 -> view -> action -> view）
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓ " + m)) : (fail++, console.log("  ✗ " + m)); };
const nm = (id) => data.name_of(id);

console.log("=== 模块加载（与服务器同路径） ===");
ok(!!rules, "rules.js 可 require");
ok(rules.roles.join("/") === "Axis/Allies", "roles = " + rules.roles.join(" / "));
ok(Array.isArray(rules.scenarios), "scenarios = " + JSON.stringify(rules.scenarios));

console.log("\n=== 模拟建局（服务器调用 setup） ===");
const game = rules.setup(Date.now() % 100000, "Standard", {});
ok(game && typeof game === "object", "setup 返回状态对象");

console.log("\n=== 玩家位视角 view ===");
for (const role of rules.roles) {
	const v = rules.view(game, role);
	ok(!!v, role + " 的 view 可生成");
	console.log("     side=" + v.side + "  turn=" + v.turn +
		"  adjacency=" + Object.keys(v.adjacency).length + " 项");
	if (role === "Axis") {
		const ns = SPACE["北海"];
		const hasBaltic = v.adjacency[ns].includes(SPACE["波罗的海"]);
		const hasMed = v.adjacency[ns].includes(SPACE["地中海"]);
		ok(hasBaltic && !hasMed, "轴心视角：北海 邻波罗的海、不邻地中海");
	} else {
		const ns = SPACE["北海"];
		const hasBaltic = v.adjacency[ns].includes(SPACE["波罗的海"]);
		const hasMed = v.adjacency[ns].includes(SPACE["地中海"]);
		ok(!hasBaltic && hasMed, "同盟视角：北海 不邻波罗的海、邻地中海");
	}
}

console.log("\n=== 模拟一次部队调动并观察连通性变化 ===");
const axisV1 = rules.view(game, "Axis");
ok(axisV1.adjacency[SPACE["北海"]].includes(SPACE["波罗的海"]), "调动前：轴心可用丹麦海峡");

/* 同盟派兵占领北欧 */
rules.action(game, "Allies", "debug_place", {
	piece: "uk_army_1", nation: "英国", type: "army", space: SPACE["北欧"],
});

const axisV2 = rules.view(game, "Axis");
const alliesV2 = rules.view(game, "Allies");
ok(!axisV2.adjacency[SPACE["北海"]].includes(SPACE["波罗的海"]), "调动后：轴心失去丹麦海峡");
ok(alliesV2.adjacency[SPACE["北海"]].includes(SPACE["波罗的海"]), "调动后：同盟获得丹麦海峡");
ok(axisV2.strait_control["北欧"] === "allies", "view.strait_control 已更新为 allies");

console.log("\n=== query 接口 ===");
const st = rules.query(game, "Axis", "straits");
ok(st.length === 4, "4 个海峡");
for (const s of st)
	console.log("     " + s.name + ": " + s.a + " <-> " + s.b + "  控制者=" + s.controller);

console.log("\n=== undo 栈 / dont_snap ===");
ok(typeof rules.dont_snap === "function", "dont_snap 存在");
ok(rules.dont_snap(game) === false, "dont_snap 返回 false（允许快照）");

console.log("\n" + "=".repeat(46));
console.log("通过 " + pass + " / 失败 " + fail);
process.exit(fail ? 1 : 0);
