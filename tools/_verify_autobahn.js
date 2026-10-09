/*
 * 验证 15228 高速公路（交互式）：先移除全部德军陆军，再让玩家逐一选择建设位置。
 * 每次 resolve_autobahn 必须合法（处于补给中的德国可建陆军地区）。
 * 用法：cd server-official; node ..\tools\_verify_autobahn.js
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));

let pass = 0, fail = 0;
function ok(c, name, extra) {
	if (c) { pass++; }
	else { fail++; console.log("  ✗", name, extra != null ? extra : ""); }
}

const g = rules.setup(20260922, "Standard", {});
g.options = {};
g.current_nation = "德国";
g.active = "Axis";
g.turn_phase = "play";

g.location = {}; g.piece_nation = {}; g.piece_type = {};
function place(id, nation, type, sp) {
	g.location[id] = SPACE[sp]; g.piece_nation[id] = nation; g.piece_type[id] = type;
}
/* 德国(大本营★) / 西欧(★补给) / 东欧 / 巴尔干 构成一条补给链 */
place("a1", "德国", "army", "德国");
place("a2", "德国", "army", "西欧");
place("a3", "德国", "army", "东欧");
place("a4", "德国", "army", "巴尔干");
place("su", "苏联", "army", "波兰");

const before = Object.keys(g.location).filter(p => g.piece_nation[p] === "德国" && g.piece_type[p] === "army").length;
console.log("初始德军陆军:", before, "支");

g.hands["德国"] = ["15228"];

/* ① 打出 15228 -> 移除全部 + 进入交互 */
rules.action(g, "Axis", "play_card", { card: "15228" });
ok(g.pending_autobahn != null, "打出后进入交互（pending_autobahn 已设置）");
ok(g.pending_autobahn && g.pending_autobahn.remaining === before, "pending 次数 = 移除的陆军数 (" + before + ")");
const inHand = g.hands["德国"].indexOf("15228");
ok(inHand < 0, "卡牌已离手（从手牌移除）");
ok(g.discard["德国"].indexOf("15228") >= 0, "卡牌进入弃牌堆");
const afterRemove = Object.keys(g.location).filter(p => g.piece_nation[p] === "德国" && g.piece_type[p] === "army").length;
ok(afterRemove === 0, "移除后场上无德军陆军", "实际 " + afterRemove);

/* ② 非法位置应被拒绝（不动状态） */
const illegal = rules.action(g, "Axis", "resolve_autobahn", { space: SPACE["波兰"] });
ok(g.pending_autobahn.remaining === before, "非法位置被拒绝（剩余次数不变）");
ok(illegal.log.slice(-1)[0].indexOf("不能") >= 0 || illegal.log.slice(-1)[0].indexOf("失败") >= 0, "非法位置给出拒绝日志");

/* ③ 逐一合法选择，直到完成 */
let guard = 0;
while (g.pending_autobahn && guard++ < before + 5) {
	const tg = rules.query(g, "Axis", "autobahn_targets", {});
	ok(tg.spaces && tg.spaces.length > 0, "第 " + guard + " 次有合法建设目标可选", JSON.stringify(tg.spaces.map(s=>s.name)));
	const pick = tg.spaces[0].id;
	rules.action(g, "Axis", "resolve_autobahn", { space: pick });
}
ok(g.pending_autobahn == null, "全部建设完成后 pending 清空");
const after = Object.keys(g.location).filter(p => g.piece_nation[p] === "德国" && g.piece_type[p] === "army").length;
ok(after === before, "重建回 " + before + " 支德军陆军", "实际 " + after);
ok(g.last_built && g.last_built.nation === "德国", "最后一次建设写入 game.last_built（打开 after_build_army 时点）");
ok(g.play_done && g.play_done["德国"], "出牌名额已消耗（mark_play_done）");
ok(Object.keys(g.location).filter(p => g.piece_nation[p] === "苏联").length === 1, "苏联敌军未受影响");

console.log("");
console.log("=== 结果: " + pass + " 通过 / " + fail + " 失败 ===");
process.exit(fail ? 1 : 0);
