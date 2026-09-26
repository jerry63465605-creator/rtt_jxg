/*
 * 手动测试场景：德国（GE）回合，每张基本卡 ×2 = 10 张手牌
 *
 * 阶段直接设为【出牌阶段】（play），原因：
 *   ① 出牌阶段已无行动点概念，每回合只能三选一做一次；
 *   ② 每打一张牌点一次「下一阶段」，从 resource 转到 play 即可继续，
 *      手牌 10 张正好够连续测试 10 次。
 *
 * 用法（必须在 server-official 目录下跑，才能解析 better-sqlite3）：
 *   cd server-official; node ..\tools\setup_manual_test.js
 *
 * 注意：本文件在 tools/ 下，Node 解析裸模块名会找不到 server-official/node_modules，
 * 故这里显式用绝对路径 require better-sqlite3。
 */
const path = require("path");
const SERVER = path.join(__dirname, "..", "server-official");
const db = require(path.join(SERVER, "node_modules", "better-sqlite3"))(path.join(SERVER, "db"));
const DIR = path.join(SERVER, "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { CARDS } = require(path.join(DIR, "cards.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));

const GAME = 2;
const state = rules.setup(20260922, "Standard", {});
state.options = {};

/* ---- 手牌：5 种基本卡各 2 张 = 10 张 ---- */
const basics = CARDS.filter(c => c.type === "BASIC").map(c => c.id);
const hand = [];
for (const id of basics) hand.push(id, id);      /* 每种 ×2 */
state.hands["德国"] = hand;

/* 阶段 = play（出牌阶段，三选一，无行动点） */
state.current_nation = "德国";
state.turn_phase = "play";
rules._internal.run_phase_entry(state, "play", "德国");

/* ---- 地图布置 ---- */
state.location = {}; state.piece_nation = {}; state.piece_type = {};
function place(id, nation, type, space) {
	state.location[id] = SPACE[space];
	state.piece_nation[id] = nation;
	state.piece_type[id] = type;
}

/*
 * 布局目的（让 5 张卡都有合法目标可测）：
 *   德国(★, 大本营)：德陆军 + 德空军
 *   西欧(★补给点)：德陆军  -> 邻接北海，使北海的德海军获得补给
 *                           （海军补给需邻接本国/友军陆军）
 *   东欧：苏陆军(敌)          -> 陆战目标（与德国相邻）
 *   北海：德海军              -> 发起海战的发起单位（需处于补给状态）
 *   南大西洋：英海军(敌)      -> 海战目标（与北海相邻）
 *   波罗的海：空              -> 建设海军目标（邻接德国，德国有陆军）
 *   巴尔干：空                -> 建设陆军目标（邻接德国的补给部队）
 */
place("de_army", "德国", "army", "德国");        /* ★ 大本营，有补给 */
place("de_army2", "德国", "army", "西欧");       /* ★ 补给点，给北海海军供补给 */
place("su_army", "苏联", "army", "东欧");        /* 敌，陆战目标 */
place("de_navy", "德国", "navy", "北海");        /* 我方海军，海战发起单位 */
place("uk_navy", "英国", "navy", "南大西洋");    /* 敌，海战目标 */
place("de_air", "德国", "air", "德国");          /* 我方空军，供空军力量测试 */

rules.action(state, "Axis", "log", "（手动测试场景：德国，基本卡各×2）");

/* 先取内部函数，供下面的校验输出使用 */
const I = rules._internal;

const json = JSON.stringify(state);
db.prepare("delete from game_replay where game_id = ?").run(GAME);
db.prepare("delete from game_snap where game_id = ?").run(GAME);
db.prepare("delete from game_state where game_id = ?").run(GAME);
db.prepare("insert into game_replay (game_id, replay_id, role, action, arguments) values (?,?,?,?,?)")
	.run(GAME, 1, null, ".setup", JSON.stringify([20260922, "Standard", {}]));
db.prepare("insert into game_state (game_id, state) values (?, ?)").run(GAME, json);
const snap = JSON.parse(json);
const len = snap.log.length;
snap.log = len;
db.prepare("insert into game_snap (game_id, snap_id, replay_id, log_length, log_hash, state) values (?,?,?,?,?,?)")
	.run(GAME, 1, 1, len, 0, JSON.stringify(snap));
db.prepare("update games set status = 1, active = ?, moves = 0 where game_id = ?")
	.run(rules.roles[0], GAME);

console.log("=== 手动测试场景已建立 ===");
console.log("");
console.log("  行动方: 德国   阶段: 出牌阶段（三选一：打出 / 弃置 / 减 1 分）");
console.log("  手牌(" + hand.length + "张):");
for (const id of basics) {
	const c = CARDS.find(x => x.id === id);
	const n = hand.filter(x => x === id).length;
	console.log("    " + c.name + " ×" + n + "   (" + c.text + ")");
}
console.log("");
console.log("  地图:");
console.log("    德国(★大本营)  德国陆军 + 德国空军");
console.log("    西欧(★补给点)  德国陆军      <- 给北海海军供补给");
console.log("    东欧           苏联陆军(敌)  <- 陆战目标");
console.log("    北海           德国海军      <- 海战发起单位");
console.log("    南大西洋       英国海军(敌)  <- 海战目标");
console.log("    波罗的海       (空)          <- 建海军目标");
console.log("    巴尔干         (空)          <- 建陆军目标");

const sup = I.compute_supply(state);
console.log("");
console.log("  补给状态:");
for (const pid of Object.keys(state.location))
	console.log("    " + state.piece_nation[pid] + "/" + state.piece_type[pid] +
		"@" + data.name_of(state.location[pid]) + " = " + !!sup.in_supply[pid]);

/* 打印各卡的合法目标，方便对照 */
console.log("");
console.log("=== 各卡当前合法目标（供对照） ===");
for (const id of basics) {
	const c = CARDS.find(x => x.id === id);
	const t = rules.query(state, "Axis", "basic_targets", c.name);
	const names = (t && t.spaces ? t.spaces : []).map(s => s.name);
	console.log("  " + c.name + " -> " + (names.length ? names.join("、") : "（无）"));
}
if (I && I.can_build_at) {
	console.log("");
	console.log("=== 建设相邻校验（北海已有德海军） ===");
	console.log("  北海建海军: " + JSON.stringify(I.can_build_at(state, "德国", SPACE["北海"], "navy")));
	console.log("  波罗的海建海军: " + JSON.stringify(I.can_build_at(state, "德国", SPACE["波罗的海"], "navy")));
}
