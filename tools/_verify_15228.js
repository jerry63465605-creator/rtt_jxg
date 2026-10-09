/*
 * 验证 15228 高速公路：移除全部德军陆军后，按数量连续建设陆军，
 * 每次走真实 build_piece（写 game.last_built 打开 after_build_army 时点），
 * 并通过从大本营向外的补给级联还原各原地区。
 *
 * 用法：cd server-official; node ..\tools\_verify_15228.js
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { CARDS } = require(path.join(DIR, "cards.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));
const I = rules._internal;

let pass = 0, fail = 0;
function eq(a, b, name, extra) {
	if (JSON.stringify(a) === JSON.stringify(b)) { pass++; /*console.log("  ✓", name)*/ }
	else { fail++; console.log("  ✗", name, "期望", JSON.stringify(b), "实际", JSON.stringify(a), extra != null ? extra : ""); }
}
function ok(c, name, extra) {
	if (c) { pass++; /*console.log("  ✓", name)*/ }
	else { fail++; console.log("  ✗", name, extra != null ? extra : ""); }
}

const g = rules.setup(20260922, "Standard", {});
g.options = {};
g.current_nation = "德国";
g.active = "Axis";
g.turn_phase = "play";

/* 清空棋子，按测试布局放置德军陆军（含一条从大本营向外的补给链） */
g.location = {}; g.piece_nation = {}; g.piece_type = {};
function place(id, nation, type, sp) {
	g.location[id] = SPACE[sp]; g.piece_nation[id] = nation; g.piece_type[id] = type;
}
/* 德国(★大本营) / 西欧(★补给点) / 东欧 / 巴尔干  构成与 德国 相连的供给链 */
place("a1", "德国", "army", "德国");
place("a2", "德国", "army", "西欧");
place("a3", "德国", "army", "东欧");
place("a4", "德国", "army", "巴尔干");
place("su", "苏联", "army", "波兰");   /* 敌方，应不受影响 */

const before = Object.keys(g.location).filter(p => g.piece_nation[p] === "德国" && g.piece_type[p] === "army");
console.log("初始德军陆军:", before.length, "支，位于:", before.map(p => data.name_of(g.location[p])).join("、"));

/* 手牌放一张 15228 以便 play_card 走正常路径 */
g.hands["德国"] = ["15228"];

/* 打 15228（进入交互：收回全部德军陆军，挂起 pending_autobahn） */
const beforeLog = g.log.length;
rules.action(g, "Axis", "play_card", { card: "15228" });
const afterLog = g.log.length;

/* 高速公路是「收回→逐一选位重建」的交互机制：
 * 收回后需走 resolve_autobahn 逐步重建（每次 build_piece 写 last_built 打开时点）。 */
const origSpaces = ["德国", "西欧", "东欧", "巴尔干"];
for (const s of origSpaces)
	rules.action(g, "Axis", "resolve_autobahn", { space: SPACE[s] });

const after = Object.keys(g.location)
	.filter(p => g.piece_nation[p] === "德国" && g.piece_type[p] === "army")
	.map(p => data.name_of(g.location[p]));

console.log("重建后德军陆军:", after.length, "支，位于:", after.join("、"));
console.log("日志:", g.log.slice(beforeLog).join(" | "));

/* 断言 */
eq(after.length, before.length, "15228 重建了全部德军陆军（数量一致）");
ok(after.includes("德国"), "原地区-德国 已重建");
ok(after.includes("西欧"), "原地区-西欧 已重建");
ok(after.includes("东欧"), "原地区-东欧 已重建");
ok(after.includes("巴尔干"), "原地区-巴尔干 已重建");
eq(Object.keys(g.location).filter(p => g.piece_nation[p] === "苏联").length, 1, "苏联敌军未被触碰");

/* 每次 build_piece 都会写 game.last_built，最后一处应被记录 */
ok(g.last_built && g.last_built.nation === "德国", "game.last_built 已被写入（每次建设都是时点）");
console.log("last_built:", JSON.stringify(g.last_built));

/* after_build_army 窗口：需 15247 在【建设发生时】已置于桌面，由 build_actions
 * 武装进 game.status_instant（见 rules.js build_actions 顶部）。本测试在建设后才放卡，
 * 故窗口不会打开——这里仅作信息性检查，不计入成败（窗口机制由 STATUS 套件覆盖）。 */
g.table = g.table || {};
g.table["德国"] = g.table["德国"] || [];
g.table["德国"].push("15247");
const cfg = I.status_config_of ? I.status_config_of("15247") : null;
if (cfg && cfg.trigger) {
	const r = I.status_window_ready(g, "德国", "15247", cfg.trigger);
	console.log("  (信息) 15247 (after_build_army) 窗口:", JSON.stringify(r), "—— 需建设时卡已在桌面方生效");
} else {
	console.log("  (跳过 15247 窗口检查：status_config_of 不可用)");
}

console.log("");
console.log("=== 结果: " + pass + " 通过 / " + fail + " 失败 ===");
process.exit(fail ? 1 : 0);
