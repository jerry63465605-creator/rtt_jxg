/*
 * 单位共存与攻击限制规则测试（2026-09-22 确认）
 *
 * 三条规则：
 *   1. 同格位不能有敌方部队（不同阵营）
 *   2. 每格位容量：同阵营的【每个不同国家】各 1 个单位（陆/海军）+ 各 1 个飞机
 *   3. 陆战/海战不能选择有我方阵营单位的地区（目标须纯敌方）
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));
const I = rules._internal;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓ " + m)) : (fail++, console.log("  ✗ " + m)); };
const nm = (id) => data.name_of(id);

function mkGame() {
	const g = rules.setup(1, "Standard", {});
	g.current_nation = "德国";
	g.active = "Axis";
	g.location = {}; g.piece_nation = {}; g.piece_type = {};
	g.hands["德国"] = [];
	I.refresh(g);
	return g;
}
function put(g, id, nation, type, spaceName) {
	g.location[id] = SPACE[spaceName];
	g.piece_nation[id] = nation;
	g.piece_type[id] = type;
	I.refresh(g);
}

/* ============================================================ */
console.log("=== 1. 同格位不能有敌方部队 ===");
{
	const g = mkGame();
	put(g, "de1", "德国", "army", "德国");

	/* 英国（敌方）想在同一格位建设 -> 被拒 */
	const chk = I.can_build_at(g, "英国", SPACE["德国"], "army");
	ok(chk.ok === false, "英国不能在德军所在的格位建设：" + chk.reason);

	/* 意大利（同阵营）可以 */
	g.hands["意大利"] = [];
	put(g, "de1", "德国", "army", "德国");
	I.init_nation_deck(g, "意大利");
	const chkIt = I.can_build_at(g, "意大利", SPACE["德国"], "army");
	console.log("  意大利在德国格位建设: " + chkIt.ok + " — " + chkIt.reason);
	ok(chkIt.ok === true || chkIt.reason.indexOf("敌方") < 0,
		"意大利（同阵营）不被'有敌方部队'拒绝");
}

/* ============================================================ */
console.log("\n=== 2. 每格位容量：每国 1 单位 + 1 飞机 ===");
{
	const g = mkGame();

	/* 德国海军放进北海 */
	put(g, "de_navy", "德国", "navy", "北海");

	/* 德国再建海军 -> 被拒（每国每格限 1 个单位） */
	const s1 = I.unit_slot_free(g, "德国", "navy", SPACE["北海"]);
	ok(s1.ok === false, "德国已有海军 -> 不能再建海军：" + s1.reason);

	/* 德国建空军 -> 允许（飞机是独立槽位） */
	const s2 = I.unit_slot_free(g, "德国", "air", SPACE["北海"]);
	ok(s2.ok === true, "德国已有海军 -> 仍可建空军（独立槽位）");

	/* 意大利（同阵营不同国）建海军 -> 允许 */
	const s3 = I.unit_slot_free(g, "意大利", "navy", SPACE["北海"]);
	ok(s3.ok === true, "意大利（同阵营不同国）可再建 1 支海军");

	/* 德国已有空军后再建空军 -> 被拒 */
	put(g, "de_air", "德国", "air", "北海");
	const s4 = I.unit_slot_free(g, "德国", "air", SPACE["北海"]);
	ok(s4.ok === false, "德国已有空军 -> 不能再建空军：" + s4.reason);

	/* 实际建设路径验证 */
	put(g, "de_navy2", "德国", "navy", "北海");  /* 放第二支德海军 */
	const before = Object.keys(g.location).length;
	I.build_piece(g, "德国", "navy", SPACE["北海"]);
	ok(Object.keys(g.location).length === before, "build_piece 也拒绝第 3 支德海军");
}

/* ============================================================ */
console.log("\n=== 3. 战斗目标必须纯敌方 ===");
{
	const g = mkGame();
	/*
	 * 场景：德国陆军在【西欧】，敌方英军在【不列颠】
	 *       若北海有我方（德国）单位 -> 北海不能作为海战目标
	 */
	put(g, "de_army", "德国", "army", "西欧");
	put(g, "uk_army", "英国", "army", "不列颠");

	/* 目标有不列颠（敌方）但无我方 -> 陆战可行 */
	const seaNbr = data.spaces[SPACE["西欧"]].connections
		.find(x => data.spaces[x].terrain === "sea");

	/* 先在目标海域放我方（德国）单位 */
	put(g, "de_navy_here", "德国", "navy", nm(seaNbr));
	/* 敌方海军也放进去？不行 —— 同格位不能有敌方。故只放我方 */
	const r1 = I.do_battle(g, "德国", seaNbr, null, "sea");
	ok(r1.ok === false, "目标海域有我方单位 -> 不能攻击：" + r1.reason);

	/* 换一个只有敌方的海域 */
	const g2 = mkGame();
	put(g2, "de_army", "德国", "army", "西欧");       /* 我方在西欧 */
	put(g2, "de_navy", "德国", "navy", "北海");       /* 我方海军在北海 */
	/* 敌方在另一个与北海相邻的海域 */
	const otherSea = data.spaces[SPACE["北海"]].connections
		.find(x => data.spaces[x].terrain === "sea");
	put(g2, "uk_navy", "英国", "navy", nm(otherSea));
	const r2 = I.do_battle(g2, "德国", otherSea, null, "sea");
	ok(r2.ok === true, "目标海域只有敌方 -> 海战可行：" + r2.desc);
	ok(g2.location["uk_navy"] == null, "敌方海军被移除");
}

/* ============================================================ */
console.log("\n=== 4. 发起单位必须在相邻格位（不能在目标格） ===");
{
	const g = mkGame();
	/*
	 * 把德军直接放在目标格位（模拟非法局面），
	 * 按新规则应被"目标有我方单位"拒绝。
	 */
	put(g, "de_army", "德国", "army", "不列颠");
	put(g, "uk_army", "英国", "army", "不列颠");   /* 强行制造同格敌我 */
	const r = I.do_battle(g, "德国", SPACE["不列颠"], null, "land");
	ok(r.ok === false, "目标格有我方单位 -> 拒绝（即使同格也有敌军）：" + r.reason);
}

/* ============================================================ */
console.log("\n=== 5. basic_targets 排除有我方单位的地区 ===");
{
	const g = mkGame();
	put(g, "de_army", "德国", "army", "西欧");
	put(g, "de_navy", "德国", "navy", "北海");
	put(g, "uk_navy", "英国", "navy", "地中海");    /* 敌方在别处 */

	g.current_nation = "德国";
	const t = rules.query(g, "Axis", "basic_targets", "发起海战");
	const names = (t && t.spaces ? t.spaces : []).map(s => s.name);
	console.log("  可选海战目标: " + names.join("、"));

	/* 北海有我方海军 -> 不应出现在目标列表 */
	ok(names.indexOf("北海") < 0, "北海（有我方海军）不在海战目标中");
}

/* ============================================================ */
console.log("\n=== 6. 友军共存：同阵营多国可同格 ===");
{
	const g = mkGame();
	/* 德国 + 意大利 同在北海（不同国家、同阵营、各 1 个） */
	put(g, "de_navy", "德国", "navy", "北海");
	put(g, "it_navy", "意大利", "navy", "北海");
	put(g, "de_air", "德国", "air", "北海");
	put(g, "it_air", "意大利", "air", "北海");

	const cnt = Object.keys(g.location).length;
	ok(cnt === 4, "北海容纳 4 支单位（德/意 各 1 海军 + 各 1 空军）");

	/*
	 * 补给的两条口径在这里正好分工验证：
	 *   第 1 条（补给链）严格【本国】—— 意大利不能借德国的补给链
	 *   第 2 条（临海）  允许【友军】—— 但第 1 条不满足则整体仍断补
	 * 故：德国海军有补给，意大利海军【断补】（除非意大利自己有补给链）
	 */
	put(g, "de_army", "德国", "army", "西欧");
	const sup = I.compute_supply(g);
	console.log("  补给: " + JSON.stringify(Object.keys(g.location).map(p =>
		game_label(g, p) + "=" + !!sup.in_supply[p])));
	ok(!!sup.in_supply["de_navy"], "德国海军有补给（邻接本国陆军，第1条满足）");
	ok(!sup.in_supply["it_navy"],
		"意大利海军【断补】—— 补给链不跨国家（第1条要求本国，友军不算）");

	/* 给意大利自己的补给链：意大利陆军在其大本营（★），海军邻接它 */
	const g2 = mkGame();
	put(g2, "it_army", "意大利", "army", "意大利");
	const itSea = data.spaces[SPACE["意大利"]].connections
		.find(x => data.spaces[x].terrain === "sea");
	put(g2, "it_navy", "意大利", "navy", nm(itSea));
	const sup2 = I.compute_supply(g2);
	ok(!!sup2.in_supply["it_navy"],
		"意大利海军邻接【本国】有补给的陆军 -> 有补给（" + nm(itSea) + "）");
}

function game_label(g, p) {
	return g.piece_nation[p] + "/" + g.piece_type[p];
}

/* ============================================================ */
console.log("\n=== 7. 敌方单位使格位不可建设 ===");
{
	const g = mkGame();
	put(g, "uk_navy", "英国", "navy", "北海");
	const chk = I.can_build_at(g, "德国", SPACE["北海"], "navy");
	ok(chk.ok === false && chk.reason.indexOf("敌方") >= 0,
		"德国不能在英军所在的北海建海军：" + chk.reason);
}

console.log("\n" + "=".repeat(46));
console.log("通过 " + pass + " / 失败 " + fail);
process.exit(fail ? 1 : 0);
