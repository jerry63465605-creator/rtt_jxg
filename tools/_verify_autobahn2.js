const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log("  ✗ " + msg); } }

const g = rules.setup(20260922, "Standard", {});
g.options = {};
g.current_nation = "德国";
g.active = "Axis";
g.turn_phase = "play";
g.location = {}; g.piece_nation = {}; g.piece_type = {};
g.play_done = {};
function place(id, n, t, sp) { g.location[id] = SPACE[sp]; g.piece_nation[id] = n; g.piece_type[id] = t; }
const validSp = ["德国", "西欧", "东欧", "巴尔干"].map(n => SPACE[n]); // 44/6/5/12
place("a1", "德国", "army", "德国");
place("a2", "德国", "army", "西欧");
place("a3", "德国", "army", "东欧");
place("a4", "德国", "army", "巴尔干");
place("su", "苏联", "army", "莫斯科");
g.hands["德国"] = ["15228"];

const before = 4;
/* 与 de_army_spaces 同款口径：location 非空才算在场 */
function deArmyCount() {
	let c = 0;
	for (const id in g.piece_nation)
		if (g.piece_nation[id] === "德国" && g.piece_type[id] === "army" && g.location[id] != null) c++;
	return c;
}

console.log("== 打 15228 ==");
rules.action(g, "Axis", "play_card", { card: "15228" });

ok(g.pending_autobahn, "进入高速公路交互（pending 存在）");
ok(g.pending_autobahn && g.pending_autobahn.remaining === before, "剩余次数 = 移除的陆军数 " + before);
ok(g.hands["德国"].indexOf("15228") < 0, "卡已离开手牌");
ok(g.discard["德国"] && g.discard["德国"].some(c => c.indexOf("15228") === 0), "卡进入弃牌堆");
// 【修复点1】出牌即占名额
ok(g.play_done && g.play_done["德国"] === true, "【修复】打出即占出牌名额（play_done=true）");
ok(deArmyCount() === 0, "收回全部德军陆军（在场 0 支，实际 " + deArmyCount() + "）");

// 【修复点3】build_actions 必须放行 resolve_autobahn，否则客户端 send_action
// 会因 view.actions 无此 key 而静默 return false（高亮可见但点不动）。
const v = rules.view(g, "Axis");
ok(v.actions && v.actions.resolve_autobahn === 1,
	"【修复】view.actions 含 resolve_autobahn=1（客户端 send_action 才能发出）");

// 【修复点2】高亮复用建设逻辑（autobahn_targets 内部即 step_space_candidates，
// 与建设陆军同款 can_build_at 判定）。返回非空且每个目标是合法 space id。
const tgt = rules.query(g, "Axis", "autobahn_targets", {});
ok(tgt.spaces.length > 0, "autobahn_targets 返回可建地区（复用 can_build_at）");
ok(tgt.spaces.every(s => typeof s.id === "number" && data.spaces[s.id]), "返回目标是合法 space id");
// （目标位的"可合法建成"由下方重建循环逐次验证）

// 非法位置（非数字）应被拒
rules.action(g, "Axis", "resolve_autobahn", { space: "xyz" });
ok(g.pending_autobahn.remaining === before, "非法位置被拒绝（剩余次数不变）");

// 逐次选合法位重建
let guard = 0, built = 0;
while (g.pending_autobahn && g.pending_autobahn.remaining > 0 && guard++ < before + 5) {
	const q = rules.query(g, "Axis", "autobahn_targets", {});
	if (!q.spaces.length) { console.log("  (提示) 补给受限，无更多合法建设位置，剩余 " + g.pending_autobahn.remaining); break; }
	const pick = q.spaces[0].id;
	const beforeCnt = deArmyCount();
	rules.action(g, "Axis", "resolve_autobahn", { space: pick });
	if (deArmyCount() === beforeCnt + 1) built++;
}
ok(built > 0, "至少完成一次合法建设（实际 " + built + " 次）");
ok(deArmyCount() === built, "重建的德军陆军数 = 合法建设次数（" + deArmyCount() + " = " + built + "）");

// 苏联敌军未受影响
ok(g.piece_nation["su"] === "苏联" && g.piece_type["su"] === "army" && g.location["su"] != null, "苏联敌军未受影响");

console.log("\n通过 " + pass + " / 失败 " + fail);
process.exit(fail ? 1 : 0);
