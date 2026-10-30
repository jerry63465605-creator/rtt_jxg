const path = require("path");
const sqlite3 = require(path.join(__dirname, "..", "server-official", "node_modules", "better-sqlite3"));
const rules = require(path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars", "rules.js"));
const I = rules._internal;
const db = new sqlite3(path.join(__dirname, "..", "server-official", "db"));

let game = JSON.parse(db.prepare("select state from game_state where game_id=?").pluck().get(19));

// 英国陆军 p4 在 space 44。把 44 设为同盟国补给点，使 p4 处于补给，从而建设陆军有合法落点。
I.set_supply_point(game, 44, "allies", true);

// 调试：打印 44 的补给判定与连通
console.log("supply_override[44]:", JSON.stringify((game.supply_override || {})[44]));
// 在 44 显式放一支英国陆军（44 已被设为同盟国补给点），这样建设陆军应能在 44 的相邻陆地建点
const NEW = "zz_brit_army";
game.location[NEW] = 44;
game.piece_nation[NEW] = "英国";
game.piece_type[NEW] = "army";
try {
	const sup = I.compute_supply(game);
	console.log("NEW in_supply:", !!(sup.in_supply && sup.in_supply[NEW]));
} catch (e) { console.log("compute_supply err:", e.message); }

// 手动搭好"美国委托英国打牌"的挂起（与 resolve_us_lend_lease_select 等价）
game.us_lend_lease = {
	nation: "英国", done: false, return_nation: "美国",
	return_active: "Allies", card_id: "17535", step: "pick"
};
// 注入一张英国基本卡《建设陆军》到英国手牌
game.hands["英国"].push("15300#1");

console.log("=== 英国手牌 ===", JSON.stringify(game.hands["英国"]));

// 取《建设陆军》的合法建设点位（basic_targets 返回 { spaces:[...], pieces:[...] }）
const tg = I.basic_targets(game, "英国", "建设陆军");
const cands = (tg && tg.spaces) || [];
console.log("建设陆军候选点位:", cands.length, JSON.stringify(cands.slice(0, 4)));
if (!cands.length) { console.log("❌ 仍无建设点位，无法验证 build 执行"); process.exit(0); }

const space = cands[0];
console.log("\n选中建设 space:", space.id, space.name);

const locBefore = JSON.stringify(game.location || {});
const natBefore = Object.keys(game.piece_nation || {}).length;
const handBefore = (game.hands["英国"] || []).length;

console.log("\n>>> resolve_us_lend_lease_play({nation:'英国', card:'15300#1', space:" + space.id + "})");
const g2 = rules.action(game, "Allies", "resolve_us_lend_lease_play", { nation: "英国", card: "15300#1", space: space.id });
game = g2 || game;

console.log("\n=== after ===");
console.log("current_nation:", game.current_nation, "(期望 美国)");
console.log("active:", game.active, "(期望 Allies)");
console.log("us_lend_lease:", JSON.stringify(game.us_lend_lease), "(期望 null)");
console.log("natSkill:", game.national_skill_offer ? JSON.stringify(game.national_skill_offer) : "-", "(期望美国窗口)");
console.log("英国 hand 张数:", handBefore, "->", (game.hands["英国"] || []).length, "(期望 不变：-1+摸1)");
const natAfter = Object.keys(game.piece_nation || {}).length;
console.log("piece_nation 数:", natBefore, "->", natAfter, "(期望 +1：新建了一支陆军)");
// 诊断：直接问美国★卡技能在当前状态是否可用
try {
	const usable = I.national_skill_usable ? I.national_skill_usable(game, "美国", "17535") : "fn?";
	console.log("美国技能(17535)可用?:", JSON.stringify(usable));
	// 再直接跑一次 after_card_resolved 看是否给 offer
	const g3 = I.after_card_resolved ? I.after_card_resolved(JSON.parse(JSON.stringify(game)), "美国", "17535") : null;
	console.log("直接 after_card_resolved 后 national_skill_offer:", g3 && g3.national_skill_offer ? JSON.stringify(g3.national_skill_offer) : "-");
} catch (e) { console.log("诊断异常:", e.message); }
const placed = Object.entries(game.location || {}).filter(([k, x]) => x === space.id || x === String(space.id));
console.log("落点 space", space.id, "上的棋子 location 项:", JSON.stringify(placed));

// ===== 战斗分支测试（发起陆战 15301，验证 resume_after_battle + pending_battle）=====
console.log("\n===== 战斗分支测试 =====");
game.us_lend_lease = {
	nation: "英国", done: false, return_nation: "美国",
	return_active: "Allies", card_id: "17535", step: "pick"
};
game.hands["英国"].push("15301#1");  // 发起陆战
const bt = I.basic_targets(game, "英国", "发起陆战");
const bcands = (bt && bt.spaces) || [];
console.log("发起陆战候选:", bcands.length, JSON.stringify(bcands.slice(0, 3)));
if (bcands.length) {
	/* 优先选有敌军的格子，才能触发 pending_battle + resume_after_battle 钩子 */
	const enemyCand = bcands.find(s => /敌/.test(s.reason)) || bcands[0];
	const bspace = enemyCand.id;
	console.log(">>> resolve_us_lend_lease_play({nation:'英国', card:'15301#1', space:" + bspace + "}) reason=" + enemyCand.reason);
	const g4 = rules.action(game, "Allies", "resolve_us_lend_lease_play", { nation: "英国", card: "15301#1", space: bspace });
	game = g4 || game;
	console.log("after 战斗发起: pending_battle?", !!game.pending_battle, "| us_lend_lease:", JSON.stringify(game.us_lend_lease), "(有敌时应 resume_after_battle:true)");
} else {
	console.log("无战斗目标，跳过战斗分支实测（逻辑已照 play_card 实现 + battle_reconcile_active 钩子）");
}
db.close();
