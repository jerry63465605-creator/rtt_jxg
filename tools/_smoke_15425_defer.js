/*
 * 15425《海军空降部队》"第二次攻击"框提前弹出卡死 —— 回归测试
 * 复现：第一次陆战触发防守方代受(代死) + 发起方抵消(counter)，
 *     验证在 counter 挂起期间，deferred 的"第二次攻击"帧不会被提前 promote，
 *     只有在战斗全部代受结算完成后才恢复。
 * 用法: node tools/_smoke_15425_defer.js
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data } = require(path.join(DIR, "data.js"));
const I = rules._internal;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓ " + m)) : (fail++, console.log("  ✗ " + m)); };
const rsLen = (g) => (g.response_stack || []).length;

I.set_skip_turn_guard(true);

/* 构造日本(Axis)发起陆战：找一对双向相邻格 A(日本陆军+空军) / B(苏联陆军+苏联空军) */
const g = rules.setup(333, "Standard", {});
g.current_nation = "日本";
g.active = "Axis";
g.turn_phase = "play";
/* 清空手牌与暗置响应卡，避免保护卡(kv2/武士道)与 on:'battle' 响应卡干扰本测试时序 */
g.hands = {};
g.table_responses = [];
g.response_stack = [];
g.deferred_response_stack = [];

let A = null, B = null;
for (let s = 1; s < data.spaces.length && !A; s++) {
	if (!data.spaces[s] || data.spaces[s].terrain !== "land") continue;
	const conns = I.get_connections(g, s, "axis");
	for (const nb of conns) {
		if (!data.spaces[nb] || data.spaces[nb].terrain !== "land") continue;
		const back = I.get_connections(g, nb, "axis");
		if (back.indexOf(s) >= 0) { A = s; B = nb; break; }
	}
}
ok(A && B, "找到一对双向相邻格 A=" + A + " B=" + B);

g.location["jp_army"] = A; g.piece_nation["jp_army"] = "日本"; g.piece_type["jp_army"] = "army";
g.location["jp_air"]  = A; g.piece_nation["jp_air"]  = "日本"; g.piece_type["jp_air"]  = "air";
g.location["su_army"] = B; g.piece_nation["su_army"] = "苏联"; g.piece_type["su_army"] = "army";
g.location["su_air"]  = B; g.piece_nation["su_air"]  = "苏联"; g.piece_type["su_air"]  = "air";
I.refresh(g);
I.grant_supply(g, "jp_army", g.turn);
I.grant_supply(g, "jp_air", g.turn);
I.compute_supply(g);

/* 模拟 15425 的"第二次攻击"续打帧已 defer 进栈 */
g.deferred_response_stack = [{
	card_id: "15425", card_face: "15425", name: "海军空降部队",
	owner_side: "axis", kind: "space", candidates: [],
	prompt: "是否再发起 1 次陆战？", ctx: {}, extra: null,
}];

/* 跳过保护卡阶段，直接验证 代受(defend) → 抵消(counter) 的 promote 时序 */
const skip = { kv2_done: true, su_step_back_done: true, guard_done: true };

/* 第一次 do_battle（无代受 opt）→ 走到 defend 代受挂起 */
const r1 = I.do_battle(g, "日本", B, "su_army", "land", Object.assign({}, skip));
ok(g.pending_battle && g.pending_battle.stage === "defend", "第一次：defend 阶段挂起");
ok(rsLen(g) === 0, "defend 挂起时 response_stack 为空（deferred 未提前 promote）");
ok(g.deferred_response_stack.length === 1, "deferred 帧仍在栈（未被 promote）");
ok(g.battle_in_progress === true, "战斗进行中标记已置位");

/* 第二次 do_battle（代受）→ 走到 counter 抵消挂起 */
const r2 = I.do_battle(g, "日本", B, "su_army", "land", Object.assign({}, skip, { defend_air: "su_air" }));
ok(g.pending_battle && g.pending_battle.stage === "counter", "第二次：counter 阶段挂起");
ok(rsLen(g) === 0, "【关键修复】counter 挂起时 response_stack 仍为空（15425 帧未提前弹出）");
ok(g.deferred_response_stack.length === 1, "counter 挂起时 deferred 帧仍在栈");

/* 第三次：用真实 resolve_battle 走 counter 分支（内部 battle_reconcile_active 触发 promote） */
const r3 = rules.action(g, "Axis", "resolve_battle", { counter_air: "jp_air" });
ok(r3 && !g.pending_battle, "第三次：counter 成立，战斗完成");
ok(g.battle_in_progress === false, "战斗进行中标记已在完成时清除");
ok(g.deferred_response_stack.length === 0, "战斗完成后 deferred 帧已被消费");
ok(rsLen(g) === 1 && g.response_stack[0].card_face === "15425",
	"【关键修复】战斗完成后 15425『第二次攻击』帧才被 promote 到 response_stack");

console.log("\n结果: " + pass + " 通过 / " + fail + " 失败");
process.exit(fail ? 1 : 0);
