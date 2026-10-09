/*
 * 5 张基本卡测试
 * 用法: node tools/test_basic_cards.js
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));
const { CARDS, CARD_BY_ID } = require(path.join(DIR, "cards.js"));
const I = rules._internal;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓ " + m)) : (fail++, console.log("  ✗ " + m)); };
const nm = (id) => data.name_of(id);

const BASIC = CARDS.filter(c => c.type === "BASIC");
const ID = {};
for (const c of BASIC) ID[c.name] = c.id;

/* 把英国设为当前行动国（唯一有卡组的国家 + USE_TEST_DECKS 兜底） */
function mkGame(seed) {
	const g = rules.setup(seed || 333, "Standard", {});
	g.current_nation = "英国";
	g.active = "Allies";
	g.location = {}; g.piece_nation = {}; g.piece_type = {};
	/* 默认处在【出牌阶段】，才能验证"每回合三选一"（play_done） */
	g.turn_phase = "play";
	/* 把手牌换成指定的基本卡，便于测试 */
	return g;
}

/* 模拟进入下一个出牌阶段："三选一"重新可用 */
function new_play_phase(g, nation) {
	I.run_phase_entry(g, "play", nation || "英国");
}

/*
 * 单元测试里我们常用固定的 role 驱动不属于它的国家流程
 * （例如以 "Allies" 驱动"德国"的回合），所以打开测试开关，
 * 跳过"只有当前行动方能提交"的归属校验。
 * 生产环境的服务器不会打开它。
 */
I.set_skip_turn_guard(true);

/* ============================================================ */
console.log("=== 0. 5 张基本卡清单 ===");
console.log("  共 " + BASIC.length + " 张:");
for (const c of BASIC) console.log("    id=" + c.id + " 《" + c.name + "》 " + c.text);
/*
 * 【2026-09-28】原先写死 BASIC.length === 5，但录入六国卡组后
 * 基本卡是【每个国家各 5 张】（英/德/日/苏/意/美 = 30 张），
 * 断言恒失败。改为按国家分组、每组各 5 张。
 */
const basicByNation = {}
for (const c of BASIC)
	(basicByNation[c.nation] = basicByNation[c.nation] || []).push(c)
const basicNations = Object.keys(basicByNation)
ok(basicNations.length > 0 && basicNations.every(n => basicByNation[n].length === 5),
	"每个国家各有 5 张基本卡（共 " + BASIC.length + " 张 / " + basicNations.length + " 国）");
ok(!!ID["建设陆军"] && !!ID["建设海军"] && !!ID["发起陆战"] && !!ID["发起海战"] && !!ID["空军力量"],
	"5 张卡的名称齐全（建设陆军/建设海军/发起陆战/发起海战/空军力量）");

/* ============================================================ */
console.log("\n=== 1. 建设条件判定 ===");
{
	const g = mkGame();
	/* 大本营可建设 */
	const r1 = I.can_build_at(g, "英国", SPACE["不列颠"]);
	ok(r1.ok === true, "不列颠（英国大本营）可建设：" + r1.reason);

	/* 孤立地区不可建设 */
	const r2 = I.can_build_at(g, "英国", SPACE["西伯利亚"]);
	ok(r2.ok === false, "西伯利亚（无补给部队相邻）不可建设：" + r2.reason);

	/*
	 * 注意：不列颠是岛国，只邻接北海（无相邻陆地）。
	 * 故陆军测试改用【西欧】（英国本土之一，邻接陆地），
	 * 海军测试仍可用不列颠周边的海域。
	 */
	g.location["uk1"] = SPACE["西欧"];
	g.piece_nation["uk1"] = "英国";
	g.piece_type["uk1"] = "army";
	I.refresh(g);
	const nbrs = data.spaces[SPACE["西欧"]].connections.map(nm);
	console.log("  西欧邻接: " + nbrs.join("、"));

	/* 陆军：需陆地格位，且邻接处于补给状态的同国部队 */
	const someLandNbr = data.spaces[SPACE["西欧"]].connections
		.find(x => data.spaces[x].terrain === "land");
	ok(!!someLandNbr, "西欧邻接陆地：" + (someLandNbr ? nm(someLandNbr) : "无"));
	if (someLandNbr) {
		const r3 = I.can_build_at(g, "英国", someLandNbr, "army");
		ok(r3.ok === true, nm(someLandNbr) + "（邻接补给中的英军）可建陆军：" + r3.reason);
	}

	/*
	 * 海军：必须建在【海域】，且该海域邻接本国【陆军】
	 * （2026-09-22 确认的简化口径，不跑完整补给链）。
	 * 西欧上有英军陆军，故其相邻海域可建海军。
	 */
	const someSeaNbr = data.spaces[SPACE["西欧"]].connections
		.find(x => data.spaces[x].terrain === "sea");
	ok(!!someSeaNbr, "西欧邻接海域：" + (someSeaNbr ? nm(someSeaNbr) : "无"));
	if (someSeaNbr) {
		const r3b = I.can_build_at(g, "英国", someSeaNbr, "navy");
		ok(r3b.ok === true, nm(someSeaNbr) + "（邻接本国陆军）可建海军：" + r3b.reason);
	}

	/* 远离任何本国陆军的海域不可建海军 */
	if (someSeaNbr) {
		const hasUkArmyAt = (cellId) => Object.keys(g.location).some(p =>
			g.location[p] === cellId && g.piece_nation[p] === "英国" && g.piece_type[p] === "army")

		const farSea = data.spaces.findIndex((s, i) => i > 0 && s && s.terrain === "sea" &&
			i !== someSeaNbr &&
			s.connections.every(nb => !hasUkArmyAt(nb)))
		if (farSea > 0) {
			const rFar = I.can_build_at(g, "英国", farSea, "navy");
			ok(rFar.ok === false, nm(farSea) + "（不邻接本国陆军）不可建海军：" + rFar.reason);
		}
	}

	/* 陆军不能建在海域 */
	if (someSeaNbr) {
		const rBad = I.can_build_at(g, "英国", someSeaNbr, "army");
		ok(rBad.ok === false, "陆军不能建在海域：" + rBad.reason);
	}

	/* 有敌方部队的地区不可建设 */
	g.location["de1"] = SPACE["德国"];
	g.piece_nation["de1"] = "德国";
	g.piece_type["de1"] = "army";
	I.refresh(g);
	const r4 = I.can_build_at(g, "英国", SPACE["德国"], "army");
	ok(r4.ok === false, "德国（有德国部队）不可建设：" + r4.reason);
}

/* ============================================================ */
console.log("\n=== 2. 《建设陆军》 ===");
{
	const g = mkGame();
	g.hands["英国"] = [ID["建设陆军"]];

	rules.action(g, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] });
	ok(Object.keys(g.location).length === 1, "建设出 1 支部队");
	const pid = Object.keys(g.location)[0];
	ok(g.piece_type[pid] === "army", "类型 = 陆军");
	ok(g.piece_nation[pid] === "英国", "国家 = 英国");
	ok(g.location[pid] === SPACE["不列颠"], "位置 = 不列颠");
	ok((g.play_done || {})["英国"] === true, "出牌阶段记为已行动（每回合三选一）");
	ok(g.hands["英国"].indexOf(ID["建设陆军"]) < 0, "该卡离开手牌");

	/* 非法地区不生效、不扣点 */
	const g2 = mkGame();
	g2.hands["英国"] = [ID["建设陆军"]];
	rules.action(g2, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["西伯利亚"] });
	ok(Object.keys(g2.location).length === 0, "非法地区：未建设");
	ok(!(g2.play_done || {})["英国"], "非法地区：未消耗出牌动作");
	ok(g2.hands["英国"].indexOf(ID["建设陆军"]) >= 0, "非法地区：卡牌留在手中");
}

/* ============================================================ */
console.log("\n=== 3. 《建设海军》（建在【海域】） ===");
{
	const g = mkGame();
	g.hands["英国"] = [ID["建设海军"]];

	/* 先在不列颠（★）放英军，使其相邻海域成为合法建设点 */
	g.location["uk0"] = SPACE["不列颠"];
	g.piece_nation["uk0"] = "英国";
	g.piece_type["uk0"] = "army";
	I.refresh(g);

	const seaNbr = data.spaces[SPACE["不列颠"]].connections
		.find(x => data.spaces[x].terrain === "sea");

	rules.action(g, "Allies", "play_card", { card: ID["建设海军"], space: seaNbr });
	const navyId = Object.keys(g.location).find(k => k !== "uk0");
	ok(navyId && g.piece_type[navyId] === "navy", "建设出海军");
	ok(navyId && g.location[navyId] === seaNbr,
		"海军位于海域 " + nm(seaNbr) + "（不是陆地）");
	ok(navyId && data.spaces[g.location[navyId]].terrain === "sea",
		"海军所在格位地形 = sea");

	/* 内陆地区应被拒 */
	const g2 = mkGame();
	g2.hands["英国"] = [ID["建设海军"]];
	const inland = SPACE["西伯利亚"];
	const coastalInland = data.spaces[inland].connections.some(x => data.spaces[x].terrain === "sea");
	if (!coastalInland) {
		g2.location["uk1"] = inland; g2.piece_nation["uk1"] = "英国"; g2.piece_type["uk1"] = "army";
		I.refresh(g2);
		rules.action(g2, "Allies", "play_card", { card: ID["建设海军"], space: inland });
		ok(Object.keys(g2.location).length === 1, "内陆地区：未能建设海军");
		ok(!(g2.play_done || {})["英国"], "内陆地区：未扣行动点");
	} else {
		ok(true, "西伯利亚靠海，跳过内陆测试");
	}

	/*
	 * 新口径（2026-09-22 easy_rule 第五章）：
	 *   建设海军 ⇔ 置于该海域的新海军将处于补给状态
	 *   = ①邻接处于补给状态的本国部队（陆/海均可） ②邻接本国或友军的陆地部队
	 */
	/* N1: 邻接【断补】本国陆军 -> 拒（旧口径"邻接本国陆军"会误允许） */
	const gN1 = mkGame();
	gN1.location["uk_az"] = SPACE["亚速尔"]; gN1.piece_nation["uk_az"] = "英国"; gN1.piece_type["uk_az"] = "army";
	I.refresh(gN1);
	const rN1 = I.can_build_at(gN1, "英国", SPACE["南大西洋"], "navy");
	ok(rN1.ok === false, "海军建在邻接【断补】本国陆军的海域 -> 拒：" + rN1.reason);

	/* N2: 邻接【有补给的本国海军】+【友军陆军】-> 允许（无本国陆军也行） */
	const gN2 = mkGame();
	gN2.location["uk_br"] = SPACE["不列颠"]; gN2.piece_nation["uk_br"] = "英国"; gN2.piece_type["uk_br"] = "army";
	gN2.location["uk_nv"] = SPACE["北海"]; gN2.piece_nation["uk_nv"] = "英国"; gN2.piece_type["uk_nv"] = "navy";
	gN2.location["su_la"] = SPACE["拉丁美洲"]; gN2.piece_nation["su_la"] = "苏联"; gN2.piece_type["su_la"] = "army";
	I.refresh(gN2);
	const rN2 = I.can_build_at(gN2, "英国", SPACE["北大西洋"], "navy");
	ok(rN2.ok === true, "海军建在邻接【补给中本国海军+友军陆军】的海域 -> 许：" + rN2.reason);
}

/* ============================================================ */
console.log("\n=== 4. 《发起陆战》 ===");
{
	const g = mkGame();
	g.hands["英国"] = [ID["发起陆战"]];
	/* 英国陆军在德国隔壁（西欧），德军在德国 */
	g.location["uk1"] = SPACE["西欧"]; g.piece_nation["uk1"] = "英国"; g.piece_type["uk1"] = "army";
	g.location["de1"] = SPACE["德国"]; g.piece_nation["de1"] = "德国"; g.piece_type["de1"] = "army";
	g.location["de2"] = SPACE["德国"]; g.piece_nation["de2"] = "德国"; g.piece_type["de2"] = "air";
	I.refresh(g);

	/* 不指定目标 -> 自动选第一支【可攻击的】部队（空军本身不算目标） */
	rules.action(g, "Allies", "play_card", { card: ID["发起陆战"], space: SPACE["德国"] });
	ok((g.play_done || {})["英国"] === true, "消耗 1 个出牌阶段名额");
	/*
	 * 该地区有德国空军，可以代受 -> 战斗会挂起等防守方决定，
	 * 因此此刻双方都还没被移除（目标锁定的是德国陆军，不是空军）。
	 */
	ok(!!g.pending_battle, "目标地区有德国空军 -> 战斗挂起等防守方");
	ok(g.pending_battle.victim === "de1",
		"  受创目标锁定的是德国【陆军】（空军不能被选为目标）");
	ok(g.location["de1"] != null && g.location["de2"] != null,
		"  挂起期间双方都还在");

	/* 防守方选择不代受 -> 陆军被移除，空军按撤离规则离开 */
	rules.action(g, "Axis", "resolve_battle", { declined: true });
	ok(g.location["de1"] == null, "不代受后：德国陆军被移除");
	ok(g.location["de2"] == null || g.location["de2"] !== SPACE["德国"],
		"同地区空军按撤离规则离开德国（不是被当作攻击目标）");

	/*
	 * 指定目标：只能指定【陆/海军】（2026-09-22 玩家明确：空军不可攻击）。
	 * 指定空军会被拒绝。
	 */
	const g2 = mkGame();
	g2.hands["英国"] = [ID["发起陆战"]];
	g2.location["uk1"] = SPACE["西欧"]; g2.piece_nation["uk1"] = "英国"; g2.piece_type["uk1"] = "army";
	g2.location["de1"] = SPACE["德国"]; g2.piece_nation["de1"] = "德国"; g2.piece_type["de1"] = "army";
	g2.location["de2"] = SPACE["德国"]; g2.piece_nation["de2"] = "德国"; g2.piece_type["de2"] = "air";
	I.refresh(g2);
	rules.action(g2, "Allies", "play_card", { card: ID["发起陆战"], space: SPACE["德国"], piece: "de2" });
	ok(g2.location["de2"] != null, "指定敌方空军作为目标 -> 被拒（空军不可攻击）");
	ok(g2.location["de1"] != null, "  战斗未发生，陆军也未受影响");
	ok(g2.hands["英国"].length === 1, "  被拒时卡牌留在手中");

	/* 无相邻陆军 -> 拒绝 */
	const g3 = mkGame();
	g3.hands["英国"] = [ID["发起陆战"]];
	g3.location["uk1"] = SPACE["不列颠"]; g3.piece_nation["uk1"] = "英国"; g3.piece_type["uk1"] = "army";
	g3.location["de1"] = SPACE["德国"]; g3.piece_nation["de1"] = "德国"; g3.piece_type["de1"] = "army";
	I.refresh(g3);
	rules.action(g3, "Allies", "play_card", { card: ID["发起陆战"], space: SPACE["德国"] });
	ok(g3.location["de1"] != null, "无相邻陆军：战斗未发生");
	ok(!(g3.play_done || {})["英国"], "无相邻陆军：未扣行动点");

	/*
	 * 目标地区是【无人占领的空地】-> 允许"空打"(2026-09-22 规则确认)
	 *   效果：不移除任何单位，仅消耗 1 行动点（用于触发其他卡牌效果）
	 */
	const g4 = mkGame();
	g4.hands["英国"] = [ID["发起陆战"]];
	g4.location["uk1"] = SPACE["西欧"]; g4.piece_nation["uk1"] = "英国"; g4.piece_type["uk1"] = "army";
	I.refresh(g4);
	const before4 = Object.keys(g4.location).length;
	rules.action(g4, "Allies", "play_card", { card: ID["发起陆战"], space: SPACE["德国"] });
	ok((g4.play_done || {})["英国"] === true, "空打（德国无守军）：合法且消耗 1 行动点");
	ok(Object.keys(g4.location).length === before4, "空打：没有任何单位被移除");
	ok(g4.hands["英国"].length === 0, "空打：卡牌已打出（离开手牌）");

	/* 空打时指定 piece -> 拒绝（没有可移除的目标） */
	const g5 = mkGame();
	g5.hands["英国"] = [ID["发起陆战"]];
	g5.location["uk1"] = SPACE["西欧"]; g5.piece_nation["uk1"] = "英国"; g5.piece_type["uk1"] = "army";
	I.refresh(g5);
	rules.action(g5, "Allies", "play_card",
		{ card: ID["发起陆战"], space: SPACE["德国"], piece: "uk1" });
	ok(!(g5.play_done || {})["英国"], "空打指定移除目标 -> 拒绝且不扣点");

	/* 空打仍受地形限制：陆战不能打【海域】空地 */
	const g6 = mkGame();
	g6.hands["英国"] = [ID["发起陆战"]];
	g6.location["uk1"] = SPACE["不列颠"]; g6.piece_nation["uk1"] = "英国"; g6.piece_type["uk1"] = "army";
	I.refresh(g6);
	const seaNbr0 = data.spaces[SPACE["不列颠"]].connections
		.find(x => data.spaces[x].terrain === "sea");
	rules.action(g6, "Allies", "play_card", { card: ID["发起陆战"], space: seaNbr0 });
	ok(!(g6.play_done || {})["英国"],
		"陆战不能打海域空地（" + nm(seaNbr0) + "）：拒绝且不扣点");

	/* 空打仍需相邻的本国补给部队 */
	const g7 = mkGame();
	g7.hands["英国"] = [ID["发起陆战"]];
	g7.location["uk1"] = SPACE["不列颠"]; g7.piece_nation["uk1"] = "英国"; g7.piece_type["uk1"] = "army";
	I.refresh(g7);
	rules.action(g7, "Allies", "play_card", { card: ID["发起陆战"], space: SPACE["德国"] });
	ok(!(g7.play_done || {})["英国"], "空打仍需相邻本国补给部队（不列颠不邻德国）");

	/* 空地出现在 basic_targets 中 */
	const g8 = mkGame();
	g8.location["uk1"] = SPACE["西欧"]; g8.piece_nation["uk1"] = "英国"; g8.piece_type["uk1"] = "army";
	I.refresh(g8);
	const tg = rules.query(g8, "Allies", "basic_targets", "发起陆战");
	ok(tg.spaces.some(s => s.id === SPACE["德国"] && /空地/.test(s.reason || "")),
		"basic_targets：无守军的德国作为空地目标列出（reason 标注空地）");
}

/* ============================================================ */
console.log("\n=== 5. 《发起海战》（目标是海域） ===");
{
	const g = mkGame();
	g.hands["英国"] = [ID["发起海战"]];

	/*
	 * 规则（2026-09-22 玩家修正版）：
	 *   发起海战：选择 1 支处于补给状态的本国【陆军或海军】，目标是任意【海域】
	 *   且目标地区必须是【纯敌方】（不能有任何我方阵营单位）
	 *
	 * 用例：英国海军在北海，德国海军在【相邻】海域（南大西洋）
	 *       英国发起海战攻击南大西洋（该海域只有德军）
	 * 注意：不能把敌我放在同一格位（同格位不能有敌方部队）
	 */
	const seaNbr = data.spaces[SPACE["不列颠"]].connections
		.find(x => data.spaces[x].terrain === "sea");
	/* 英军陆军在不列颠（★）保证海军有补给 */
	g.location["uk_army"] = SPACE["不列颠"]; g.piece_nation["uk_army"] = "英国"; g.piece_type["uk_army"] = "army";
	g.location["uk_navy"] = seaNbr; g.piece_nation["uk_navy"] = "英国"; g.piece_type["uk_navy"] = "navy";

	/* 敌方海军放在与北海相邻的【另一个】海域 */
	const adjSea = data.spaces[seaNbr].connections
		.find(x => data.spaces[x].terrain === "sea");
	g.location["de_navy"] = adjSea; g.piece_nation["de_navy"] = "德国"; g.piece_type["de_navy"] = "navy";
	I.refresh(g);
	console.log("  英国海军在 " + nm(seaNbr) + "，德国海军在相邻的 " + nm(adjSea));

	rules.action(g, "Allies", "play_card", { card: ID["发起海战"], space: adjSea });
	ok(g.location["de_navy"] == null, "海战：移除敌方海军");
	ok((g.play_done || {})["英国"] === true, "海战：消耗 1 行动点");

	/* 我方单位所在海域不能作为目标 */
	const gSelf = mkGame();
	gSelf.hands["英国"] = [ID["发起海战"]];
	gSelf.location["uk_army"] = SPACE["不列颠"]; gSelf.piece_nation["uk_army"] = "英国"; gSelf.piece_type["uk_army"] = "army";
	gSelf.location["uk_navy"] = seaNbr; gSelf.piece_nation["uk_navy"] = "英国"; gSelf.piece_type["uk_navy"] = "navy";
	I.refresh(gSelf);
	rules.action(gSelf, "Allies", "play_card", { card: ID["发起海战"], space: seaNbr });
	ok(gSelf.location["uk_navy"] != null, "我方海军所在海域（" + nm(seaNbr) + "）不能作为海战目标");
	ok(!(gSelf.play_done || {})["英国"], "被拒时未扣行动点");

	/*
	 * 空打海域（2026-09-22）：目标海域无人占领也合法，
	 * 不移除单位，仅消耗 1 行动点。
	 */
	const gE = mkGame();
	gE.hands["英国"] = [ID["发起海战"]];
	gE.location["uk_army"] = SPACE["不列颠"]; gE.piece_nation["uk_army"] = "英国"; gE.piece_type["uk_army"] = "army";
	I.refresh(gE);
	const emptySea = data.spaces[SPACE["不列颠"]].connections
		.find(x => data.spaces[x].terrain === "sea" && !gE.location[x]);
	const cntE = Object.keys(gE.location).length;
	rules.action(gE, "Allies", "play_card", { card: ID["发起海战"], space: emptySea });
	ok((gE.play_done || {})["英国"] === true,
		"海战空打（" + nm(emptySea) + " 无守军）：合法且消耗 1 行动点");
	ok(Object.keys(gE.location).length === cntE, "海战空打：没有任何单位被移除");

	/* 海战空打仍受地形限制：不能打陆地空地 */
	const gE2 = mkGame();
	gE2.hands["英国"] = [ID["发起海战"]];
	gE2.location["uk_army"] = SPACE["不列颠"]; gE2.piece_nation["uk_army"] = "英国"; gE2.piece_type["uk_army"] = "army";
	I.refresh(gE2);
	rules.action(gE2, "Allies", "play_card", { card: ID["发起海战"], space: SPACE["德国"] });
	ok(!(gE2.play_done || {})["英国"], "海战不能打陆地空地（德国）");

	/* 目标是【陆地】-> 海战被拒（陆战才能打陆地） */
	const g2 = mkGame();
	g2.hands["英国"] = [ID["发起海战"]];
	g2.location["uk_navy"] = seaNbr; g2.piece_nation["uk_navy"] = "英国"; g2.piece_type["uk_navy"] = "navy";
	const landNbr = data.spaces[seaNbr].connections.find(x => data.spaces[x].terrain === "land");
	g2.location["de9"] = landNbr; g2.piece_nation["de9"] = "德国"; g2.piece_type["de9"] = "army";
	I.refresh(g2);
	rules.action(g2, "Allies", "play_card", { card: ID["发起海战"], space: landNbr });
	ok(g2.location["de9"] != null, "海战不能打陆地（" + nm(landNbr) + "）");
	ok(!(g2.play_done || {})["英国"], "被拒时未扣行动点");
}

/* ============================================================ */
console.log("\n=== 5b. 兵种对称性：陆/海军都能发起两种战斗 ===");
{
	/*
	 * 陆战目标 = 陆地；海战目标 = 海域。
	 * 陆军的"岸防"：陆军打相邻海域的敌军。
	 */
	/*
	 * 岸防炮击：英国【陆军】在不列颠（★，有补给），
	 *           德国海军在相邻的北海（该海域无英国单位）
	 *           -> 陆军发起海战可打相邻海域
	 */
	const g = mkGame();
	g.hands["英国"] = [ID["发起海战"]];
	const land = SPACE["不列颠"];
	const adjSea = data.spaces[land].connections.find(x => data.spaces[x].terrain === "sea");
	/* 只放英国陆军在该陆地（不放英国海军，否则目标不纯） */
	g.location["uk_army"] = land; g.piece_nation["uk_army"] = "英国"; g.piece_type["uk_army"] = "army";
	g.location["de_navy"] = adjSea; g.piece_nation["de_navy"] = "德国"; g.piece_type["de_navy"] = "navy";
	I.refresh(g);
	console.log("  英国陆军在 " + nm(land) + "，德国海军在 " + nm(adjSea));

	rules.action(g, "Allies", "play_card", { card: ID["发起海战"], space: adjSea });
	ok(g.location["de_navy"] == null && (g.play_done || {})["英国"] === true,
		"陆军发起海战（岸防炮击）：可打相邻海域的敌海军");
}

/* ============================================================ */
console.log("\n=== 6. 《空军力量》三选一（均在空军阶段） ===");
{
	/* 6a. 部署（空军须与本国补给中的陆/海军同格，2026-09-22） */
	const g = mkGame();
	g.turn_phase = "airforce";
	g.hands["英国"] = [ID["空军力量"]];
	g.location["uk_army"] = SPACE["不列颠"]; g.piece_nation["uk_army"] = "英国"; g.piece_type["uk_army"] = "army";
	I.refresh(g);
	I.run_phase_entry(g, "airforce", "英国");
	rules.action(g, "Allies", "play_card", { card: ID["空军力量"], mode: "deploy", space: SPACE["不列颠"] });
	{
		const pid = Object.keys(g.location).find(p => g.piece_type[p] === "air");
		ok(pid && g.location[pid] === SPACE["不列颠"], "mode=deploy：在有本国陆军的地区部署空军");
		ok(g.air_done["英国"] === true, "mode=deploy：占掉空军阶段名额");
	}

	/*
	 * 6b. 《空军力量》的 move 模式
	 *
	 * 2026-09-22 口径：空军阶段的调度走侧栏【调度空军…】按钮
	 * （代价是弃 1 张手牌），不通过《空军力量》卡；
	 * 因此空军阶段打《空军力量》只认 deploy / seize，
	 * move 会被白名单拒绝。
	 */
	const g2 = mkGame();
	g2.turn_phase = "airforce";
	g2.hands["英国"] = [ID["空军力量"]];
	g2.location["uk_army"] = SPACE["不列颠"]; g2.piece_nation["uk_army"] = "英国"; g2.piece_type["uk_army"] = "army";
	g2.location["uk_air"] = SPACE["北海"]; g2.piece_nation["uk_air"] = "英国"; g2.piece_type["uk_air"] = "air";
	I.refresh(g2);
	I.run_phase_entry(g2, "airforce", "英国");
	rules.action(g2, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "move", piece: "uk_air", space: SPACE["不列颠"] });
	ok(g2.location["uk_air"] === SPACE["北海"],
		"空军阶段：《空军力量》的 move 模式被拒（调度改走【调度空军…】按钮）");
	ok(g2.air_done["英国"] === false, "被拒时不占空军阶段名额");

	/* 6c. 夺取制空权（目标地区须有本国陆/海军作载体） */
	const g3 = mkGame();
	g3.turn_phase = "airforce";
	g3.hands["英国"] = [ID["空军力量"]];
	g3.location["uk_air"] = SPACE["不列颠"]; g3.piece_nation["uk_air"] = "英国"; g3.piece_type["uk_air"] = "air";
	g3.location["uk_army"] = SPACE["北海"]; g3.piece_nation["uk_army"] = "英国"; g3.piece_type["uk_army"] = "army";
	g3.location["de_air"] = SPACE["北海"]; g3.piece_nation["de_air"] = "德国"; g3.piece_type["de_air"] = "air";
	I.refresh(g3);
	I.run_phase_entry(g3, "airforce", "英国");
	rules.action(g3, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "seize", from: "uk_air", space: SPACE["北海"] });
	ok(g3.location["de_air"] == null, "mode=seize：敌方空军被移除");
	/* seize 设计：仅移除敌方飞机，本国发起飞机留在原地（与陆战发起单位一致，见 seize_air） */
	ok(g3.location["uk_air"] === SPACE["不列颠"], "mode=seize：本国发起空军留原地（进驻由 move 模式完成）");

	/* 6d. 未指定 mode -> 拒绝 */
	const g4 = mkGame();
	g4.turn_phase = "airforce";
	g4.hands["英国"] = [ID["空军力量"]];
	g4.location["uk_army"] = SPACE["不列颠"]; g4.piece_nation["uk_army"] = "英国"; g4.piece_type["uk_army"] = "army";
	I.refresh(g4);
	I.run_phase_entry(g4, "airforce", "英国");
	rules.action(g4, "Allies", "play_card", { card: ID["空军力量"], space: SPACE["不列颠"] });
	ok(!g4.air_done["英国"], "未指定 mode：拒绝且不占空军阶段名额");
}

/* ============================================================ */
console.log("\n=== 7. 空军阶段直接调度（代价：弃 1 张手牌） ===");
{
	/*
	 * 规则（2026-09-22 玩家修正版）：
	 *   调度空军【不需要】《空军力量》卡，而是【弃 1 张手牌】。
	 */
	function mkAirGame() {
		const g = mkGame();
		g.location["uk_army"] = SPACE["不列颠"]; g.piece_nation["uk_army"] = "英国"; g.piece_type["uk_army"] = "army";
		g.location["uk_air"] = SPACE["北海"]; g.piece_nation["uk_air"] = "英国"; g.piece_type["uk_air"] = "air";
		I.refresh(g);
		g.turn_phase = "airforce";
		return g;
	}

	/* 7a. 正常调度：弃 1 张手牌，行动点不变 */
	const g = mkAirGame();
	const handBefore = g.hands["英国"].length;
	const discardBefore = g.discard["英国"].length;

	rules.action(g, "Allies", "air_support", { air: "uk_air", target: SPACE["不列颠"] });
	ok(g.location["uk_air"] === SPACE["不列颠"], "调度成功");
	ok(g.hands["英国"].length === handBefore - 1,
		"弃 1 张手牌（" + handBefore + " -> " + g.hands["英国"].length + "）");
	ok(g.discard["英国"].length === discardBefore + 1, "弃牌堆 +1");
	ok(!(g.play_done || {})["英国"], "空军阶段调度【不】消耗出牌阶段的动作");

	/* 7b. 手牌为空 -> 拒绝调度 */
	const g3 = mkAirGame();
	g3.hands["英国"] = [];
	rules.action(g3, "Allies", "air_support", { air: "uk_air", target: SPACE["不列颠"] });
	ok(g3.location["uk_air"] !== SPACE["不列颠"], "手牌为空：拒绝调度（需弃 1 张）");

	/* 7c. 非空军阶段 -> 拒绝 */
	const g2 = mkAirGame();
	g2.turn_phase = "supply";
	const hand2 = g2.hands["英国"].length;
	rules.action(g2, "Allies", "air_support", { air: "uk_air", target: SPACE["不列颠"] });
	ok(g2.location["uk_air"] !== SPACE["不列颠"], "非空军阶段：拒绝调度");
	ok(g2.hands["英国"].length === hand2, "非空军阶段：未弃牌");

	/* 7d. 目标地区无本国陆/海军 -> 拒绝 */
	const g4 = mkAirGame();
	g4.location["uk_army"] = SPACE["北海"];   /* 把陆军挪走 */
	I.refresh(g4);
	const hand4 = g4.hands["英国"].length;
	rules.action(g4, "Allies", "air_support", { air: "uk_air", target: SPACE["不列颠"] });
	ok(g4.location["uk_air"] !== SPACE["不列颠"], "目标无本国陆/海军：拒绝调度");
	ok(g4.hands["英国"].length === hand4, "被拒时未弃牌");
}

/* ============================================================ */
console.log("\n=== 8. 同地区限制 ===");
{
	/* 同地区不能有 2 支同国同类型部队 */
	const g = mkGame();
	g.hands["英国"] = [ID["建设陆军"], ID["建设陆军"]];
	/* 造两张同名卡（复制 id 到牌堆以模拟） */
	g.hands["英国"] = [ID["建设陆军"]];
	rules.action(g, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] });
	const n1 = Object.keys(g.location).length;
	ok(n1 === 1, "第一支陆军建设成功");

	/* 再建一次（同地区）：先进入新的出牌阶段，让三选一重新可用 */
	g.hands["英国"] = [ID["建设陆军"]];
	new_play_phase(g);
	rules.action(g, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] });
	ok(Object.keys(g.location).length === 1, "同地区不能有第 2 支同国陆军");
	ok(!(g.play_done || {})["英国"], "被拒时未消耗出牌动作");
}

/* ============================================================ */
console.log("\n=== 9. 出牌阶段每回合只能三选一 ===");
{
	const g = mkGame();
	g.hands["英国"] = [ID["建设陆军"], ID["建设海军"]];

	/* ① 打出 1 张手牌 */
	rules.action(g, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] });
	ok(Object.keys(g.location).length === 1, "① 打出《建设陆军》成功");
	ok((g.play_done || {})["英国"] === true, "打出后记为已行动");

	/* 同一出牌阶段内再打一张 -> 拒绝 */
	rules.action(g, "Allies", "play_card", { card: ID["建设海军"], space: SPACE["北海"] });
	ok(Object.keys(g.location).length === 1, "已行动后：第 2 张牌被拒绝");
	ok(g.hands["英国"].length === 1, "已行动后：第 2 张牌仍在手中");

	/* 同一出牌阶段内弃牌 / 减分也不可再用 */
	const scoreBefore = g.score.allies;
	rules.action(g, "Allies", "discard_one", { card: ID["建设海军"] });
	ok(g.hands["英国"].length === 1, "已行动后：弃 1 张手牌被拒绝");
	rules.action(g, "Allies", "minus_score", {});
	ok(g.score.allies === scoreBefore, "已行动后：减 1 分被拒绝");

	/* 进入下一个出牌阶段 -> 三选一重新可用 */
	new_play_phase(g);
	ok((g.play_done || {})["英国"] === false, "新出牌阶段重置为未行动");
	rules.action(g, "Allies", "discard_one", { card: ID["建设海军"] });
	ok(g.hands["英国"].length === 0, "② 弃 1 张手牌成功");
	ok(g.discard["英国"].indexOf(ID["建设海军"]) >= 0, "弃的那张牌进了弃牌堆");

	/* ③ 减 1 分（手牌为空时只剩这一项） */
	new_play_phase(g);
	rules.action(g, "Allies", "minus_score", {});
	ok(g.score.allies === scoreBefore - 1, "③ 减 1 分成功（-1）");
}

/* ============================================================ */
console.log("\n=== 9b. 资源再分配：弃 3 张手牌挑 1 张基本卡 ===");
{
	const g = mkGame();
	g.turn_phase = "resource";
	/* 保证手牌足够 */
	while (g.hands["英国"].length < 3) {
		if (!g.decks["英国"].length) break;
		g.hands["英国"].push(g.decks["英国"].shift());
	}
	const handBefore = g.hands["英国"].length;
	const basics = I.deck_basics(g, "英国");
	ok(basics.length > 0, "牌堆中有基本卡可供挑选（" + basics.length + " 张）");

	const take = basics[0].id;
	const drop = g.hands["英国"].slice(0, 3);
	const r = I.resource_swap(g, "英国", { discard: drop, take: take });
	ok(r.ok === true, "弃 3 张换 1 张基本卡：" + (r.ok ? r.desc : r.reason));
	ok(g.hands["英国"].length === handBefore - 3 + 1, "手牌 = 原 -3 +1");
	ok(g.hands["英国"].indexOf(take) >= 0, "挑的基本卡进入手牌");
	ok(g.decks["英国"].indexOf(take) < 0, "该基本卡已从牌堆移除");

	/* 代价必须是 3 张 */
	const g2 = mkGame();
	g2.turn_phase = "resource";
	const r2 = I.resource_swap(g2, "英国", { discard: drop.slice(0, 2), take: take });
	ok(r2.ok === false, "代价不是 3 张 -> 拒绝：" + r2.reason);

	/* 只能挑基本卡（take 用的是牌堆中的实体牌 id） */
	const nonBasic = (g2.decks["英国"] || []).find(x => {
		const c = I.inst_card(x)
		return c && c.type !== "BASIC"
	});
	const r3 = I.resource_swap(g2, "英国", { discard: drop, take: nonBasic });
	ok(r3.ok === false, "只能挑选【基本卡】：" + r3.reason);

	/*
	 * 身份口径（2026-09-22 玩家明确）：
	 *   · 同一个实体牌不能重复充当多张代价
	 *   · 3 张【同名】的不同实体牌可以
	 */
	const g3 = mkGame();
	g3.turn_phase = "resource";
	while (g3.hands["英国"].length < 8) {
		if (!g3.decks["英国"].length) break;
		g3.hands["英国"].push(g3.decks["英国"].shift());
	}
	const dup = g3.hands["英国"][0];
	const r4 = I.resource_swap(g3, "英国", {
		discard: [dup, dup, dup], take: I.deck_basics(g3, "英国")[0].id,
	});
	ok(r4.ok === false, "同一个实体牌重复 3 次 -> 拒绝：" + r4.reason);

	/* 3 张同名牌（3 个不同实例）-> 允许 */
	const g3b = mkGame();
	g3b.turn_phase = "resource";
	while (g3b.hands["英国"].length < 8) {
		if (!g3b.decks["英国"].length) break;
		g3b.hands["英国"].push(g3b.decks["英国"].shift());
	}
	/* 造两张同名实体牌塞进手牌 */
	const sameCardId = I.inst_card_id(g3b.hands["英国"][0]);
	g3b.hands["英国"].push(sameCardId + "#9", sameCardId + "#10");
	I.refresh(g3b);
	const trio = [g3b.hands["英国"][0], sameCardId + "#9", sameCardId + "#10"];
	const r4b = I.resource_swap(g3b, "英国", {
		discard: trio, take: I.deck_basics(g3b, "英国")[0].id,
	});
	ok(r4b.ok === true, "3 张同名（不同实例）作为代价 -> 允许：" + (r4b.ok ? r4b.desc : r4b.reason));

	/*
	 * 每回合【只能执行一次】（2026-09-22 玩家修正）
	 */
	const g4 = mkGame();
	g4.turn_phase = "resource";
	while (g4.hands["英国"].length < 10) {
		if (!g4.decks["英国"].length) break;
		g4.hands["英国"].push(g4.decks["英国"].shift());
	}
	const t1 = I.deck_basics(g4, "英国")[0];
	rules.action(g4, "Allies", "resource_swap", {
		discard: g4.hands["英国"].slice(0, 3), take: t1.id,
	});
	ok(g4.resource_swaps["英国"] === 1, "第 1 次资源再分配成功");

	const handAfter = g4.hands["英国"].length;
	const t2 = I.deck_basics(g4, "英国")[0];
	const r5 = rules.action(g4, "Allies", "resource_swap", {
		discard: g4.hands["英国"].slice(0, 3), take: t2.id,
	});
	ok(g4.resource_swaps["英国"] === 1, "第 2 次被拒（本回合只能用一次）");
	ok(g4.hands["英国"].length === handAfter, "被拒后手牌数量不变");
	ok(r5 !== undefined, "被拒时 action 仍返回 state");

	/*
	 * 进入下一个资源再分配阶段 -> 计数重置，可以再用一次
	 * （"每个回合各一次"）
	 */
	g4.current_nation = "英国";
	I.run_phase_entry(g4, "resource", "英国");
	ok(g4.resource_swaps["英国"] === 0, "新的资源阶段：计数被重置为 0");
	const t3 = I.deck_basics(g4, "英国")[0];
	const rNew = rules.action(g4, "Allies", "resource_swap", {
		discard: g4.hands["英国"].slice(0, 3), take: t3.id,
	});
	ok(g4.resource_swaps["英国"] === 1, "新回合：资源再分配重新可用");
	ok(rNew !== undefined, "新回合的 action 返回 state");

	/* 同一回合内第二次仍然被拒 */
	const t4 = I.deck_basics(g4, "英国")[0];
	rules.action(g4, "Allies", "resource_swap", {
		discard: g4.hands["英国"].slice(0, 3), take: t4.id,
	});
	ok(g4.resource_swaps["英国"] === 1, "同一回合内第 2 次仍被拒");

	/* view.can_resource_swap 与计数一致 */
	ok(rules.view(g4, "Allies").can_resource_swap === false,
		"view.can_resource_swap 在本回合已用后为 false");

	/* 手牌不足 3 张 -> 拒绝 */
	const g5 = mkGame();
	g5.turn_phase = "resource";
	while (g5.hands["英国"].length > 2) I.discard_card(g5, "英国", g5.hands["英国"][0]);
	const r6 = I.resource_swap(g5, "英国", {
		discard: g5.hands["英国"].concat(["x"]), take: I.deck_basics(g5, "英国")[0].id,
	});
	ok(r6.ok === false, "手牌不足 3 张 -> 拒绝：" + r6.reason);
}

/* ============================================================ */
console.log("\n=== 10. query 接口 ===");
{
	const g = mkGame();
	g.hands["英国"] = [ID["建设陆军"]];
	I.refresh(g);

	const q1 = rules.query(g, "Allies", "buildable");
	ok(Array.isArray(q1) && q1.length > 0, "query('buildable') 返回可建设地区 " + q1.length + " 个");
	ok(q1.some(x => x.name === "不列颠"), "其中含不列颠（大本营）");

	/* 注意：query 的第 4 个参数 params 用于传查询参数（RTT 约定） */
	const q2 = rules.query(g, "Allies", "basic_targets", "建设陆军");
	ok(q2 && Array.isArray(q2.spaces) && q2.spaces.length > 0,
		"query('basic_targets', '建设陆军') 返回 " + q2.spaces.length + " 个目标");

	/*
	 * 轴心视角：现在返回【轴心的代表国（德国）】的可建设地区，
	 * 而不是 null。
	 *
	 * 2026-09-22 修正：原先 nation_of_player 在"非本方回合"返回 null，
	 * 导致防守方在整个对方回合里没有身份，接不到 pending_battle、
	 * 也提交不了 resolve_battle（空军代受询问不出现）。
	 * 现在身份与本方阵营解耦，故这里应有结果。
	 */
	const q3 = rules.query(g, "Axis", "buildable");
	ok(Array.isArray(q3), "非本方回合：轴心仍拿到本方代表国的数据（不再返回 null）");
	ok(q3.some(x => x.name === "德国"), "  轴心的代表国是德国（含德国大本营）");
	/* 但它看到的是【德国】的建设范围，不是英国的手牌 */
	const q3hand = rules.query(g, "Axis", "hand");
	ok(!q3hand || q3hand.nation === "德国", "  轴心看的是德国手牌，不是英国手牌");

	/* 战斗目标 */
	const g2 = mkGame();
	g2.location["uk1"] = SPACE["西欧"]; g2.piece_nation["uk1"] = "英国"; g2.piece_type["uk1"] = "army";
	g2.location["de1"] = SPACE["德国"]; g2.piece_nation["de1"] = "德国"; g2.piece_type["de1"] = "army";
	I.refresh(g2);
	const q4 = rules.query(g2, "Allies", "basic_targets", "发起陆战");
	ok(q4.spaces.some(x => x.name === "德国"), "发起陆战目标含德国");
	ok(q4.pieces.some(p => p.id === "de1"), "可指定的敌方部队含 de1");

	/* 空军选项 */
	const g3 = mkGame();
	g3.location["uk_army"] = SPACE["不列颠"]; g3.piece_nation["uk_army"] = "英国"; g3.piece_type["uk_army"] = "army";
	g3.location["uk_air"] = SPACE["北海"]; g3.piece_nation["uk_air"] = "英国"; g3.piece_type["uk_air"] = "air";
	I.refresh(g3);
	const q5 = rules.query(g3, "Allies", "air_options");
	ok(q5.airs.indexOf("uk_air") >= 0, "air_options.airs 含 uk_air");
	ok(q5.targets.some(t => t.name === "不列颠"), "air_options.targets 含不列颠");

	/*
	 * 战斗目标要带上"可代受的同国空军"，供 UI 询问使用。
	 * 布局：德军+德国空军在德国；英军在相邻的西欧。
	 */
	const g6 = mkGame();
	g6.location["uk1"] = SPACE["西欧"]; g6.piece_nation["uk1"] = "英国"; g6.piece_type["uk1"] = "army";
	g6.location["de1"] = SPACE["德国"]; g6.piece_nation["de1"] = "德国"; g6.piece_type["de1"] = "army";
	g6.location["de_air"] = SPACE["德国"]; g6.piece_nation["de_air"] = "德国"; g6.piece_type["de_air"] = "air";
	I.refresh(g6);
	const bt = rules.query(g6, "Allies", "basic_targets", "发起陆战");
	const de1info = bt.pieces.find(p => p.id === "de1");
	ok(de1info && de1info.airs && de1info.airs.indexOf("de_air") >= 0,
		"受创目标 de1 标注了可代受的德国空军 de_air");
	/* 不代受时这些空军要撤往的候选地区也要一并给出 */
	ok(de1info && Array.isArray(de1info.retreats),
		"受创目标同时标注 retreats（撤离候选）");
}

/* ============================================================ */
console.log("\n=== 10b. view.pieces_by_id 可按 id 查算子（防守方代受用） ===");
{
	const g = mkGame();
	g.location["de1"] = SPACE["德国"];
	g.piece_nation["de1"] = "德国";
	g.piece_type["de1"] = "army";
	I.refresh(g);

	const v = rules.view(g, "Allies");
	/* pieces 是【数组】（曾经误当字典用 view.pieces[id] -> undefined） */
	ok(Array.isArray(v.pieces), "view.pieces 是数组");
	/* pieces_by_id 才是按 id 索引的字典 */
	ok(v.pieces_by_id && typeof v.pieces_by_id === "object" && !Array.isArray(v.pieces_by_id),
		"view.pieces_by_id 是字典（非数组）");
	const info = v.pieces_by_id["de1"];
	ok(!!info, "pieces_by_id['de1'] 能查到该算子");
	ok(info && info.type === "army", "  带 type 字段");
	ok(info && info.type_zh === "陆军", "  带中文名 type_zh");
	ok(info && info.space_name === "德国", "  带所在地名 space_name");
	ok(info && info.loc === SPACE["德国"], "  带所在地 id loc");
	/* 对手的算子也在里面（防守方需要它来核对代受对象） */
	ok(!!v.pieces_by_id["de1"], "  含【对方】算子（防守方需要）");
}

/* ============================================================ */
console.log("\n=== 11. action 返回 state ===");
{
	const g = mkGame();
	g.hands["英国"] = [ID["建设陆军"], ID["空军力量"]];
	g.turn_phase = "airforce";
	for (const [a, arg] of [
		["play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] }],
		["air_support", { air: "x", target: 1 }],
		["discard_one", { card: ID["空军力量"] }],
		["minus_score", {}],
		["toggle_ask_remove", { value: true }],
		["remove_piece", { piece: "x" }],
		["clear_ask", {}],
	]) {
		const r = rules.action(g, "Allies", a, arg);
		ok(r !== undefined && r !== null, "action('" + a + "') 返回 state");
	}
}

/* ============================================================ */
console.log("\n=== 12. 空军代替受创 + 发起方抵消（easy_rule 七） ===");
{
	/* 布局：英军在西欧（邻近德国）；德国陆军 + 德国空军在德国 */
	function mkBattle() {
		const g = mkGame();
		g.hands["英国"] = [ID["发起陆战"]];
		g.location["uk1"] = SPACE["西欧"]; g.piece_nation["uk1"] = "英国"; g.piece_type["uk1"] = "army";
		g.location["de1"] = SPACE["德国"]; g.piece_nation["de1"] = "德国"; g.piece_type["de1"] = "army";
		g.location["de_air"] = SPACE["德国"]; g.piece_nation["de_air"] = "德国"; g.piece_type["de_air"] = "air";
		I.refresh(g);
		return g;
	}

	/*
	 * 12a. 发起方提交战斗 -> 【挂起】，等待防守方决定
	 * （2026-09-22：询问只发给防守方，避免发起方替它决定）
	 */
	const g2 = mkBattle();
	rules.action(g2, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1",
	});
	ok(!!g2.pending_battle, "有可代受空军：战斗被挂起（pending_battle 非空）");
	ok(g2.pending_battle.defender_nation === "德国", "  防守方是德国");
	ok(g2.pending_battle.kind === "land", "  记录战斗类型 land");
	ok(g2.location["de1"] != null && g2.location["de_air"] != null,
		"  挂起期间双方部队都还在（尚未结算）");

	/*
	 * 发起方（同盟）提交代受 -> 被拒（只有防守方能决定）。
	 * 这里临时【关闭】测试开关，让归属校验真正生效。
	 */
	I.set_skip_turn_guard(false);
	rules.action(g2, "Allies", "resolve_battle", { use_air: "de_air" });
	I.set_skip_turn_guard(true);
	ok(g2.pending_battle != null, "发起方替防守方决定 -> 被拒（仍然挂起）");
	ok(g2.location["de_air"] != null, "  空军未被移除");
	ok(/只有【德国】可以决定/.test(g2.log[g2.log.length - 1]),
		"  理由说明只有防守方能决定：" + g2.log[g2.log.length - 1]);

	/*
	 * 12b. 防守方【代受】-> 空军被移除，原目标部队保住
	 */
	rules.action(g2, "Axis", "resolve_battle", { use_air: "de_air" });
	ok(g2.pending_battle == null, "防守方表态后：挂起解除");
	ok(g2.location["de_air"] == null, "代受：德国空军被移除");
	ok(g2.location["de1"] != null, "代受：原目标（德国陆军）保住");

	/*
	 * 12c. 防守方【不代受】-> 原目标被移除，空军撤往相邻合法位置
	 * 在德国相邻的东欧放一支德国陆军，给空军留出退路。
	 */
	const g = mkBattle();
	g.location["de_home"] = SPACE["东欧"];
	g.piece_nation["de_home"] = "德国";
	g.piece_type["de_home"] = "army";
	I.refresh(g);
	rules.action(g, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1",
	});
	ok(!!g.pending_battle, "再次挂起等待防守方");

	rules.action(g, "Axis", "resolve_battle", { declined: true });
	ok(g.pending_battle == null, "不代受：挂起解除");
	ok(g.location["de1"] == null, "不代受：原目标部队被移除");
	ok(g.location["de_air"] === SPACE["东欧"],
		"不代受：空军撤往相邻的合法位置（东欧）");

	/* 无处可撤时（相邻地区都没有本国陆/海军载体）-> 空军被移除 */
	const gNo = mkBattle();
	I.refresh(gNo);
	rules.action(gNo, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1",
	});
	rules.action(gNo, "Axis", "resolve_battle", { declined: true });
	ok(gNo.location["de1"] == null, "无处可撤：原目标部队被移除");
	ok(gNo.location["de_air"] == null, "无处可撤：空军被移除（没有合法落点）");

	/* 12d. 不代受 + 显式指定撤离目标 */
	const g3 = mkBattle();
	g3.location["de_home"] = SPACE["东欧"];
	g3.piece_nation["de_home"] = "德国";
	g3.piece_type["de_home"] = "army";
	I.refresh(g3);
	rules.action(g3, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1",
	});
	const pb = g3.pending_battle;
	ok(Array.isArray(pb.retreats) && pb.retreats.length > 0,
		"pending_battle 带 retreats（空军撤离候选）");
	rules.action(g3, "Axis", "resolve_battle",
		{ declined: true, retreat: pb.retreats[0].id });
	ok(g3.location["de1"] == null, "不代受+指定撤离：原目标被移除");
	ok(g3.location["de_air"] === pb.retreats[0].id,
		"不代受+指定撤离：空军撤到 " + pb.retreats[0].name);

	/* 12e. 非法参数 -> 拒绝且仍然挂起 */
	const g4 = mkBattle();
	rules.action(g4, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1",
	});
	rules.action(g4, "Axis", "resolve_battle", { use_air: "uk1" });   /* 我方算子 */
	ok(g4.pending_battle != null, "用非本国空军代受 -> 被拒且仍然挂起");
	ok(g4.location["de1"] != null && g4.location["uk1"] != null, "  双方部队都未变动");

	/* 指定不相邻的撤离目标 -> 拒绝 */
	rules.action(g4, "Axis", "resolve_battle",
		{ declined: true, retreat: SPACE["不列颠"] });
	ok(g4.pending_battle != null, "撤离目标与受攻击地区不相邻 -> 被拒且仍然挂起");

	/* 没有挂起战斗时的表态 -> 拒绝 */
	const g5 = mkBattle();
	rules.action(g5, "Axis", "resolve_battle", { declined: true });
	ok(/没有等待结算的战斗/.test(g5.log[g5.log.length - 1]),
		"没有挂起战斗时表态 -> 提示无待结算战斗");

	/*
	 * 12f. 挂起期间【进攻方一切动作都被拦】
	 * （2026-09-22：避免进攻方在防守方决定前继续推进，把战斗悬空）
	 */
	const gHold = mkBattle();
	gHold.hands["英国"] = [ID["建设陆军"], ID["发起陆战"]];
	I.refresh(gHold);
	rules.action(gHold, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1", from: "uk1",
	});
	ok(!!gHold.pending_battle, "挂起成立（德国有空军可代受）");

	const handBefore = gHold.hands["英国"].length;
	const phaseBefore = gHold.turn_phase;

	/* 再打一张牌 */
	rules.action(gHold, "Allies", "play_card",
		{ card: ID["建设陆军"], space: SPACE["不列颠"] });
	ok(gHold.hands["英国"].length === handBefore, "挂起期间：进攻方不能继续打牌");
	ok(/战斗结算中/.test(gHold.log[gHold.log.length - 1]),
		"  提示战斗结算中：" + gHold.log[gHold.log.length - 1]);

	/* 推进阶段 */
	rules.action(gHold, "Allies", "next_phase", {});
	ok(gHold.turn_phase === phaseBefore, "挂起期间：进攻方不能推进阶段");

	/* 弃牌 / 减分 也一并被拦 */
	rules.action(gHold, "Allies", "discard_one", { card: gHold.hands["英国"][0] });
	ok(gHold.hands["英国"].length === handBefore, "挂起期间：不能弃牌");
	const scoreBefore = gHold.score.allies;
	rules.action(gHold, "Allies", "minus_score", {});
	ok(gHold.score.allies === scoreBefore, "挂起期间：不能减分（分数未变）");

	/* 防守方表态后恢复 */
	rules.action(gHold, "Axis", "resolve_battle", { declined: true });
	ok(gHold.pending_battle == null, "防守方表态后：挂起解除");
	rules.action(gHold, "Allies", "next_phase", {});
	ok(gHold.turn_phase !== phaseBefore, "解除后：进攻方可以继续推进阶段");
}

/* ============================================================ */
console.log("\n=== 12j. 代表团映射：法国=英国、中国=美国 ===");
{
	/* 谓词口径 */
	ok(I.delegate_of_nation("法国") === "英国", "法国 的代表国是 英国");
	ok(I.delegate_of_nation("中国") === "美国", "中国 的代表国是 美国");
	ok(I.delegate_of_nation("苏联") === "苏联", "苏联 没有代表团，就是自己");
	ok(I.delegate_of_nation("德国") === "德国", "德国 就是自己");
	ok(I.faction_of_nation("法国") === "allies", "法国 属于同盟");
	ok(I.faction_of_nation("中国") === "allies", "中国 属于同盟");

	/*
	 * 被攻击的是【法国部队】-> 决策身份应为【英国】，
	 * 即同盟一侧能收到 pending_battle 并提交 resolve_battle。
	 */
	const g = mkGame();
	g.current_nation = "德国";
	g.active = "Axis";
	g.turn_phase = "play";
	g.hands["德国"] = [ID["发起陆战"]];
	/* 德国陆军在西欧（邻德国大本营，补给）；法国陆军+法国空军在德国相邻地区 */
	g.location = {};
	g.piece_nation = {};
	g.piece_type = {};
	g.location["de_army"] = SPACE["德国"];
	g.piece_nation["de_army"] = "德国";
	g.piece_type["de_army"] = "army";
	g.location["fr_army"] = SPACE["西欧"];
	g.piece_nation["fr_army"] = "法国";
	g.piece_type["fr_army"] = "army";
	g.location["fr_air"] = SPACE["西欧"];
	g.piece_nation["fr_air"] = "法国";
	g.piece_type["fr_air"] = "air";
	I.refresh(g);

	rules.action(g, "Axis", "play_card", {
		card: ID["发起陆战"], space: SPACE["西欧"],
		piece: "fr_army", from: "de_army",
	});
	const pb = g.pending_battle;
	ok(!!pb, "攻击法国部队：战斗挂起");
	ok(pb.victim_nation === "法国", "  victim_nation 记录真实所属国 = 法国");
	ok(pb.defender_nation === "英国",
		"  决策身份是【英国】（法国的代表国），实际 = " + (pb && pb.defender_nation));
	ok(pb.air_nation === "法国", "  代受空军仍须是法国空军");

	/* 同盟视角能看到并决定 */
	const vAllies = rules.view(g, "Allies");
	ok(!!vAllies.pending_battle, "同盟视角能看到该待决事项");
	ok(!!(vAllies.actions && vAllies.actions.resolve_battle),
		"同盟拿到 resolve_battle 动作");

	/* 轴心（进攻方）看不到 */
	const vAxis = rules.view(g, "Axis");
	ok(!vAxis.pending_battle, "轴心（进攻方）看不到该待决事项");

	/* 同盟用【法国空军】代受（不能改用英国空军） */
	rules.action(g, "Allies", "resolve_battle", { use_air: "uk_air_fake" });
	ok(g.pending_battle != null, "用不存在的空军代受 -> 被拒且仍挂起");

	rules.action(g, "Allies", "resolve_battle", { use_air: "fr_air" });
	ok(g.pending_battle == null, "用法国空军代受：挂起解除");
	ok(g.location["fr_air"] == null, "  法国空军被移除");
	ok(g.location["fr_army"] != null, "  法国陆军保住");

	/* 日志里点明"由英国代表" */
	ok(/法国/.test(g.log[g.log.length - 1]),
		"  日志提到法国：" + g.log[g.log.length - 1]);
}

/* ============================================================ */
console.log("\n=== 12i. 空军不能作为攻击目标 ===");
{
	const AIR = ID["发起陆战"];

	/*
	 * 目标地区【只有敌方空军】-> 没有可攻击的敌军，
	 * 只能选择攻击地块本身（空打）。
	 */
	const g = mkGame();
	g.hands["英国"] = [AIR];
	g.location["uk1"] = SPACE["西欧"]; g.piece_nation["uk1"] = "英国"; g.piece_type["uk1"] = "army";
	g.location["de_air"] = SPACE["德国"]; g.piece_nation["de_air"] = "德国"; g.piece_type["de_air"] = "air";
	I.refresh(g);

	/* 指定空军为目标 -> 拒绝（它不在可攻击列表中） */
	const n0 = g.hands["英国"].length;
	rules.action(g, "Allies", "play_card", {
		card: AIR, space: SPACE["德国"], piece: "de_air", from: "uk1",
	});
	ok(g.hands["英国"].length === n0, "指定敌方空军作为攻击目标 -> 拒绝");
	ok(g.location["de_air"] != null, "  敌方空军未被移除");
	ok(/不可攻击|没有可攻击的敌方部队/.test(g.log[g.log.length - 1]),
		"  理由说明空军不可攻击：" + g.log[g.log.length - 1]);

	/* 该地区只有敌方空军 -> 视为"无敌军"，可空打地块本身 */
	const g2 = mkGame();
	g2.hands["英国"] = [AIR];
	g2.location["uk1"] = SPACE["西欧"]; g2.piece_nation["uk1"] = "英国"; g2.piece_type["uk1"] = "army";
	g2.location["de_air"] = SPACE["德国"]; g2.piece_nation["de_air"] = "德国"; g2.piece_type["de_air"] = "air";
	I.refresh(g2);
	rules.action(g2, "Allies", "play_card", {
		card: AIR, space: SPACE["德国"], from: "uk1",
	});
	ok(g2.hands["英国"].length === 0, "只有敌方空军的地区：可以空打地块本身");
	ok(g2.location["de_air"] != null, "  空打不移除任何单位（空军仍在）");

	/* basic_targets：空军不出现在可攻击 pieces 列表里 */
	const g3 = mkGame();
	g3.location["uk1"] = SPACE["西欧"]; g3.piece_nation["uk1"] = "英国"; g3.piece_type["uk1"] = "army";
	g3.location["de_army"] = SPACE["德国"]; g3.piece_nation["de_army"] = "德国"; g3.piece_type["de_army"] = "army";
	g3.location["de_air"] = SPACE["德国"]; g3.piece_nation["de_air"] = "德国"; g3.piece_type["de_air"] = "air";
	I.refresh(g3);
	const tg = rules.query(g3, "Allies", "basic_targets", "发起陆战");
	const dePieces = tg.pieces.filter(p => p.space === SPACE["德国"]);
	ok(dePieces.some(p => p.id === "de_army"), "basic_targets: 德国陆军在可攻击列表中");
	ok(!dePieces.some(p => p.id === "de_air"), "basic_targets: 德国空军【不在】可攻击列表中");

	/* 有敌军时，该地区同样出现在可点地区列表中（但需点具体部队） */
	ok(tg.spaces.some(s => s.id === SPACE["德国"]), "有敌军的地区仍列出（供定位）");
	ok(tg.spaces.find(s => s.id === SPACE["德国"]).reason.indexOf("敌") >= 0,
		"  该地区的说明标注了敌军数量");
}

/* ============================================================ */
console.log("\n=== 12h. 发起战斗必须选发起单位，且不能选空军 ===");
{
	const AIR_INIT = "uk_air";

	/* 本地：英军在西欧（相邻德国），德国有陆军 */
	function mkInit() {
		const g = mkGame();
		g.hands["英国"] = [ID["发起陆战"]];
		g.location["uk1"] = SPACE["西欧"]; g.piece_nation["uk1"] = "英国"; g.piece_type["uk1"] = "army";
		g.location["uk_air"] = SPACE["西欧"]; g.piece_nation["uk_air"] = "英国"; g.piece_type["uk_air"] = "air";
		g.location["de1"] = SPACE["德国"]; g.piece_nation["de1"] = "德国"; g.piece_type["de1"] = "army";
		I.refresh(g);
		return g;
	}

	/* battle_initiators 只列陆/海军，不含空军 */
	const g = mkInit();
	const list = rules.query(g, "Allies", "battle_initiators", { space: SPACE["德国"] });
	ok(list.some(u => u.id === "uk1"), "battle_initiators 含本国陆军 uk1");
	ok(!list.some(u => u.id === "uk_air"), "battle_initiators 【不含】空军 uk_air");
	ok(list.every(u => u.type === "army" || u.type === "navy"),
		"battle_initiators 全部是陆军或海军");

	/* 用空军作为发起单位 -> 拒绝 */
	const g2 = mkInit();
	const n2 = g2.hands["英国"].length;
	rules.action(g2, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1", from: AIR_INIT,
	});
	ok(g2.hands["英国"].length === n2, "指定空军发起 -> 拒绝");
	ok(/空军不能作为发起战斗的单位/.test(g2.log[g2.log.length - 1]),
		"  理由说明空军不能发起：" + g2.log[g2.log.length - 1]);

	/* 指定的发起单位不与目标相邻 -> 拒绝 */
	const g3 = mkInit();
	g3.location["uk2"] = SPACE["不列颠"];
	g3.piece_nation["uk2"] = "英国";
	g3.piece_type["uk2"] = "army";
	I.refresh(g3);
	rules.action(g3, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1", from: "uk2",
	});
	ok(g3.hands["英国"].length === 1, "发起单位不与目标相邻 -> 拒绝");
	ok(/不相邻/.test(g3.log[g3.log.length - 1]),
		"  理由说明不相邻：" + g3.log[g3.log.length - 1]);

	/* 显式指定合法发起单位 -> 通过并正常结算 */
	const g4 = mkInit();
	rules.action(g4, "Allies", "play_card", {
		card: ID["发起陆战"], space: SPACE["德国"], piece: "de1", from: "uk1",
	});
	ok(g4.hands["英国"].length === 0, "指定合法发起单位：卡牌成功打出");
	ok(g4.location["de1"] == null, "  并正常移除目标部队");
}

/* ============================================================ */
console.log("\n=== 12b. 空军阶段：可打出《空军力量》（跨阶段配额不误伤） ===");
{
	/*
	 * 场景：出牌阶段已经用掉三选一（play_done = true），
	 * 随后进入空军阶段 —— 此时打《空军力量》必须仍然合法。
	 * （曾经的 bug：客户端无条件看 my_play_done，把它挡死了）
	 */
	/* mkGame() 把行动国固定成英国，这里继续用英国即可 */
	const g = mkGame();
	g.hands["英国"] = [ID["空军力量"]];
	g.location["uk_army"] = SPACE["不列颠"];
	g.piece_nation["uk_army"] = "英国";
	g.piece_type["uk_army"] = "army";
	I.refresh(g);

	/* 模拟"出牌阶段已行动过" */
	g.play_done = { "英国": true };
	g.turn_phase = "airforce";
	I.run_phase_entry(g, "airforce", "英国");
	ok(g.air_done["英国"] === false, "空军阶段入口：air_done 重置为 false");

	const handBefore = g.hands["英国"].length;
	rules.action(g, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "deploy", space: SPACE["不列颠"] });
	ok(g.hands["英国"].length === handBefore - 1,
		"出牌阶段已行动过，空军阶段仍可打出《空军力量》");
	ok(g.air_done["英国"] === true, "打出后 air_done = true（空军阶段名额已用）");
	ok(g.play_done["英国"] === true, "play_done 不受影响（跨阶段不互相改写）");

	/* 空军阶段再打第二张 -> 拒绝 */
	g.hands["英国"] = [ID["空军力量"]];
	I.refresh(g);
	const h2 = g.hands["英国"].length;
	rules.action(g, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "deploy", space: SPACE["不列颠"] });
	ok(g.hands["英国"].length === h2, "空军阶段已行动 -> 第 2 张《空军力量》被拒");
}

/* ============================================================ */
console.log("\n=== 12d. 空军阶段白名单：只能打《空军力量》/时机卡/空军阶段卡 ===");
{
	const g = mkGame();
	g.turn_phase = "airforce";
	g.hands["英国"] = [ID["建设陆军"], ID["发起陆战"], ID["空军力量"]];
	g.location["uk_army"] = SPACE["不列颠"];
	g.piece_nation["uk_army"] = "英国";
	g.piece_type["uk_army"] = "army";
	I.refresh(g);
	I.run_phase_entry(g, "airforce", "英国");

	/* 建设陆军：空军阶段不允许 */
	const n0 = g.hands["英国"].length;
	rules.action(g, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] });
	ok(g.hands["英国"].length === n0, "空军阶段：建设陆军被拒");
	ok(/空军阶段/.test(g.log[g.log.length - 1]), "  理由提到空军阶段：" + g.log[g.log.length - 1]);

	/* 发起陆战：空军阶段不允许 */
	rules.action(g, "Allies", "play_card", { card: ID["发起陆战"], space: SPACE["西欧"] });
	ok(g.hands["英国"].length === n0, "空军阶段：发起陆战被拒");

	/* 空军力量的 move 模式：不允许（调度走独立按钮） */
	rules.action(g, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "move", space: SPACE["不列颠"] });
	ok(g.hands["英国"].length === n0, "空军阶段：《空军力量》的 move 模式被拒");

	/* 空军力量的非法 mode */
	rules.action(g, "Allies", "play_card", { card: ID["空军力量"], mode: "xxx" });
	ok(g.hands["英国"].length === n0, "空军阶段：《空军力量》的未知 mode 被拒");

	/* 部署：允许 */
	rules.action(g, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "deploy", space: SPACE["不列颠"] });
	ok(g.hands["英国"].length === n0 - 1, "空军阶段：deploy 模式允许打出");
	ok(g.air_done["英国"] === true, "deploy 后 air_done = true");

	/* 白名单谓词口径 */
	ok(I.can_play_in_airforce({ name: "空军力量" }, "deploy") === true, "白名单: 空军力量+deploy");
	ok(I.can_play_in_airforce({ name: "空军力量" }, "seize") === true, "白名单: 空军力量+seize");
	ok(I.can_play_in_airforce({ name: "空军力量" }, "move") === false, "白名单: 空军力量+move 拒");
	ok(I.can_play_in_airforce({ name: "建设陆军", type: "BASIC" }) === false, "白名单: 建设陆军 拒");
	/* 只有增强卡不受阶段限制；状态/应答卡要看卡面说明（2026-09-22 最终口径） */
	ok(I.can_play_in_airforce({ name: "X", type: "EFFECT" }) === true, "白名单: 增强卡 许（不受阶段限制）");
	ok(I.can_play_in_airforce({ name: "X", type: "STATUS" }) === false,
		"白名单: 状态卡无说明 拒（不再无条件放行）");
	ok(I.can_play_in_airforce({ name: "X", type: "RESPONSE" }) === false,
		"白名单: 应答卡无说明 拒（不再无条件放行）");
	ok(I.can_play_in_airforce({ name: "X", type: "EVENT", text: "在空军阶段打出" }) === true,
		"白名单: 卡面写明空军阶段的事件卡 许");
	ok(I.can_play_in_airforce({ name: "X", type: "STATUS", text: "可在空军阶段打出" }) === true,
		"白名单: 卡面写明空军阶段的状态卡 许");
	ok(I.can_play_in_airforce({ name: "X", type: "EVENT", text: "随便写点别的" }) === false,
		"白名单: 普通事件卡 拒");
}

/* ============================================================ */
console.log("\n=== 12d2. 《空军力量》只能在空军阶段打出 ===");
{
	/* 出牌阶段打《空军力量》-> 拒绝 */
	const g = mkGame();   /* mkGame 默认 turn_phase = 'play' */
	g.hands["英国"] = [ID["空军力量"]];
	g.location["uk_army"] = SPACE["不列颠"];
	g.piece_nation["uk_army"] = "英国";
	g.piece_type["uk_army"] = "army";
	I.refresh(g);
	const n0 = g.hands["英国"].length;

	rules.action(g, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "deploy", space: SPACE["不列颠"] });
	ok(g.hands["英国"].length === n0, "出牌阶段：打《空军力量》被拒");
	ok(/只能.*空军阶段打出/.test(g.log[g.log.length - 1]),
		"  理由说明只能在空军阶段打出：" + g.log[g.log.length - 1]);
	ok(!(g.play_done || {})["英国"], "被拒时不占出牌阶段名额");

	/* 资源阶段同样拒绝 */
	const g2 = mkGame();
	g2.turn_phase = "resource";
	g2.hands["英国"] = [ID["空军力量"]];
	g2.location["uk_army"] = SPACE["不列颠"];
	g2.piece_nation["uk_army"] = "英国";
	g2.piece_type["uk_army"] = "army";
	I.refresh(g2);
	rules.action(g2, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "deploy", space: SPACE["不列颠"] });
	ok(g2.hands["英国"].length === 1, "资源阶段：打《空军力量》被拒");

	/* 空军阶段 -> 允许（前置条件已由 12b 覆盖） */
	const g3 = mkGame();
	g3.turn_phase = "airforce";
	g3.hands["英国"] = [ID["空军力量"]];
	g3.location["uk_army"] = SPACE["不列颠"];
	g3.piece_nation["uk_army"] = "英国";
	g3.piece_type["uk_army"] = "army";
	I.refresh(g3);
	I.run_phase_entry(g3, "airforce", "英国");
	rules.action(g3, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "deploy", space: SPACE["不列颠"] });
	ok(g3.hands["英国"].length === 0, "空军阶段：打《空军力量》允许");

	/* 谓词口径 */
	ok(I.is_airforce_only({ name: "空军力量" }) === true, "is_airforce_only: 空军力量 = true");
	ok(I.is_airforce_only({ name: "建设陆军" }) === false, "is_airforce_only: 建设陆军 = false");
	ok(I.can_play_in_play_phase({ name: "空军力量" }) === false,
		"can_play_in_play_phase: 空军力量 = false");
	ok(I.can_play_in_play_phase({ name: "建设陆军" }) === true,
		"can_play_in_play_phase: 建设陆军 = true");
	ok(I.can_play_in_play_phase({ name: "X", type: "STATUS" }) === true,
		"can_play_in_play_phase: 时机卡 = true");
}

/* ============================================================ */
console.log("\n=== 12e. 空军不能独立存在（须与本国补给中的陆/海军同格） ===");
{
	const g = mkGame();
	g.turn_phase = "airforce";
	g.hands["英国"] = [ID["空军力量"]];
	g.location["uk_army"] = SPACE["不列颠"];
	g.piece_nation["uk_army"] = "英国";
	g.piece_type["uk_army"] = "army";
	I.refresh(g);
	I.run_phase_entry(g, "airforce", "英国");

	/* 有本国陆军的地方 -> 可部署 */
	rules.action(g, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "deploy", space: SPACE["不列颠"] });
	ok(g.hands["英国"].length === 0, "有本国陆军的地区可部署空军");
	const airPiece = Object.keys(g.location).find(p => g.piece_type[p] === "air");
	ok(!!airPiece, "空军已落在该地区");

	/* 没有本国陆/海军的地区 -> 拒绝 */
	const g2 = mkGame();
	g2.turn_phase = "airforce";
	g2.hands["英国"] = [ID["空军力量"]];
	/* 东欧无任何单位 */
	I.refresh(g2);
	I.run_phase_entry(g2, "airforce", "英国");
	const n2 = g2.hands["英国"].length;
	rules.action(g2, "Allies", "play_card",
		{ card: ID["空军力量"], mode: "deploy", space: SPACE["东欧"] });
	ok(g2.hands["英国"].length === n2, "无本国陆/海军的地区：不能部署空军");
	ok(/没有可以部署空军的地区|本国陆军|本国海军|空军不能独立存在/.test(g2.log[g2.log.length - 1]),
		"  理由说明空军不能独立存在：" + g2.log[g2.log.length - 1]);

	/* 调度也必须落在有本国陆/海军的地方 */
	const g3 = mkGame();
	g3.turn_phase = "airforce";
	g3.hands["英国"] = ["x-card"];   /* 弃 1 张作为代价 */
	g3.location["uk_air"] = SPACE["不列颠"];
	g3.piece_nation["uk_air"] = "英国";
	g3.piece_type["uk_air"] = "air";
	g3.location["uk_army"] = SPACE["西欧"];
	g3.piece_nation["uk_army"] = "英国";
	g3.piece_type["uk_army"] = "army";
	I.refresh(g3);
	I.run_phase_entry(g3, "airforce", "英国");

	/* 东欧没有本国陆/海军 -> 调度被拒 */
	rules.action(g3, "Allies", "air_support",
		{ air: "uk_air", target: SPACE["东欧"], card: "x-card" });
	ok(g3.location["uk_air"] === SPACE["不列颠"], "调度到无本国陆/海军处：被拒");

	/* 西欧有本国陆军（且补给中）-> 允许 */
	rules.action(g3, "Allies", "air_support",
		{ air: "uk_air", target: SPACE["西欧"], card: "x-card" });
	ok(g3.location["uk_air"] === SPACE["西欧"], "调度到有本国补给陆军的地区：允许");

	/* air_host_check 谓词 */
	ok(I.air_host_check(g3, "英国", SPACE["西欧"]).ok === true, "air_host_check: 有载体 许");
	ok(I.air_host_check(g3, "英国", SPACE["东欧"]).ok === false, "air_host_check: 无载体 拒");
}

/* ============================================================ */
console.log("\n=== 12c. 出牌阶段每回合只能打 1 张（增强卡除外） ===");
{
	const g = mkGame();   /* 默认 play 阶段 */
	g.hands["英国"] = [ID["建设陆军"], ID["建设海军"]];
	I.refresh(g);

	/* 第 1 张：允许 */
	rules.action(g, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] });
	ok((g.play_done || {})["英国"] === true, "出牌阶段：打出 1 张后记为已行动");

	/* 第 2 张：拒绝 */
	rules.action(g, "Allies", "play_card", { card: ID["建设海军"], space: SPACE["北海"] });
	ok(g.hands["英国"].length === 1, "出牌阶段：同回合第 2 张被拒（每回合 1 张）");

	/*
	 * 增强卡(EFFECT)：配额用尽后【仍可】打出，且【不占】出牌阶段名额。
	 *
	 * 【2026-09-25 语义变更】增强卡不再是"任何阶段都能打"，
	 * 而是按【时点】打出（见 CARD_TRIGGERS）：
	 *   · kind='self'    -> 自己回合的对应阶段（如摸牌/计分/空军阶段）
	 *   · kind='anytime' -> 任何时机（如《马奇诺防线》）
	 *
	 * 所以用【anytime】的 15311 来验证"不受配额与阶段限制"，
	 * 再用一张【有阶段】的卡验证"错阶段会被拒"。
	 */
	const maginot = CARDS.find(c => String(c.id) === "15311");
	if (maginot) {
		/* 15311 是 anytime，任何阶段都能打；需弃 4 张 */
		g.hands["英国"] = ["15311", "a", "b", "c", "d"];
		I.refresh(g);
		rules.action(g, "Allies", "play_card", { card: "15311" });
		ok(g.hands["英国"].indexOf("15311") < 0, "增强卡(anytime)在配额用尽后仍可打出");
		ok(g.play_done["英国"] === true, "打增强卡【不】改写 play_done");
		ok(I.is_protected != null, "马奇诺防线：protect 修正器接口可用");
	} else {
		ok(true, "卡组无 15311，跳过 anytime 增强卡用例");
	}

	/* 有阶段的增强卡：错阶段会被拒（新语义） */
	const warsaw = CARDS.find(c => String(c.id) === "15312");   /* 计分阶段 */
	if (warsaw) {
		g.turn_phase = "play";                 /* 出牌阶段，不是计分阶段 */
		g.current_nation = "英国";
		g.active = "Allies";
		g.hands["英国"] = ["15312", "a", "b"];
		I.refresh(g);
		rules.action(g, "Allies", "play_card", { card: "15312", space: SPACE["东欧"] });
		ok(g.hands["英国"].indexOf("15312") >= 0,
			"增强卡(有阶段)在错误阶段被拒");

		/* 切到计分阶段就能打 */
		g.turn_phase = "scoring";
		I.refresh(g);
		rules.action(g, "Allies", "play_card", { card: "15312", space: SPACE["东欧"] });
		ok(g.hands["英国"].indexOf("15312") < 0, "增强卡在正确阶段可打出");
		ok(g.play_done["英国"] === true, "有阶段的增强卡同样不占名额");

		/*
		 * 【必须还原阶段】后面的用例（状态卡配额校验）依赖"出牌阶段"，
		 * 这里改成了 scoring 会影响它们 —— 踩坑：测试里改了共享状态要还原。
		 */
		g.turn_phase = "play";
	} else {
		ok(true, "卡组无 15312，跳过阶段增强卡用例");
	}

	/* 状态卡/应答卡：没有卡面说明时，配额用尽后【不能】再打 */
	g.hands["英国"] = CARDS.filter(c => c.type === "STATUS").map(c => c.id);
	if (g.hands["英国"].length) {
		const n0 = g.hands["英国"].length;
		I.refresh(g);
		rules.action(g, "Allies", "play_card", { card: g.hands["英国"][0] });
		ok(g.hands["英国"].length === n0,
			"状态卡（无阶段说明）在配额用尽后同样被拒");
	} else {
		ok(true, "卡组暂无状态卡，跳过该用例");
	}
}

/* ============================================================ */
console.log("\n=== 12d3. 《空军力量》必须有合法目标才能打出 ===");
{
	const AIR = ID["空军力量"];

	/* --- seize：本国一支空军都没有 -> 拒绝 --- */
	const g = mkGame();
	g.turn_phase = "airforce";
	g.hands["英国"] = [AIR];
	/* 敌方有空军，但本国没有 */
	g.location["de_air"] = SPACE["北海"];
	g.piece_nation["de_air"] = "德国";
	g.piece_type["de_air"] = "air";
	I.refresh(g);
	I.run_phase_entry(g, "airforce", "英国");
	rules.action(g, "Allies", "play_card",
		{ card: AIR, mode: "seize", space: SPACE["北海"] });
	ok(g.hands["英国"].length === 1, "seize：本国无空军 -> 拒绝");
	ok(/本国没有空军/.test(g.log[g.log.length - 1]),
		"  理由说明本国没有空军：" + g.log[g.log.length - 1]);
	ok(g.air_done["英国"] === false, "被拒时不占空军阶段名额");

	/* --- deploy：全图没有任何"可承载空军的地区" -> 拒绝 --- */
	const g2 = mkGame();
	g2.turn_phase = "airforce";
	g2.hands["英国"] = [AIR];
	g2.location = {};
	g2.piece_nation = {};
	g2.piece_type = {};
	I.refresh(g2);
	I.run_phase_entry(g2, "airforce", "英国");
	rules.action(g2, "Allies", "play_card",
		{ card: AIR, mode: "deploy", space: SPACE["不列颠"] });
	ok(g2.hands["英国"].length === 1, "deploy：没有任何可承载空军的地区 -> 拒绝");
	ok(/没有可以部署空军的地区/.test(g2.log[g2.log.length - 1]),
		"  理由说明没有可部署的地区：" + g2.log[g2.log.length - 1]);
	ok(g2.air_done["英国"] === false, "被拒时不占空军阶段名额");

	/* --- seize：没有敌方空军 -> 拒绝 --- */
	const g3 = mkGame();
	g3.turn_phase = "airforce";
	g3.hands["英国"] = [AIR];
	g3.location["uk_air"] = SPACE["不列颠"];
	g3.piece_nation["uk_air"] = "英国";
	g3.piece_type["uk_air"] = "air";
	g3.location["uk_army"] = SPACE["西欧"];
	g3.piece_nation["uk_army"] = "英国";
	g3.piece_type["uk_army"] = "army";
	I.refresh(g3);
	I.run_phase_entry(g3, "airforce", "英国");
	rules.action(g3, "Allies", "play_card",
		{ card: AIR, mode: "seize", space: SPACE["西欧"] });
	ok(g3.hands["英国"].length === 1, "seize：目标地区无敌方空军 -> 拒绝");

	/* --- move：本国无空军 -> 拒绝 --- */
	const g4 = mkGame();
	g4.turn_phase = "airforce";
	g4.hands["英国"] = [AIR];
	g4.location["uk_army"] = SPACE["不列颠"];
	g4.piece_nation["uk_army"] = "英国";
	g4.piece_type["uk_army"] = "army";
	I.refresh(g4);
	I.run_phase_entry(g4, "airforce", "英国");
	rules.action(g4, "Allies", "play_card",
		{ card: AIR, mode: "move", space: SPACE["不列颠"] });
	ok(g4.hands["英国"].length === 1, "move：本国无空军 -> 拒绝");

	/*
	 * --- 合法目标存在时正常打出（回归保护） ---
	 * deploy：有本国补给陆军作载体
	 */
	const g5 = mkGame();
	g5.turn_phase = "airforce";
	g5.hands["英国"] = [AIR];
	g5.location["uk_army"] = SPACE["不列颠"];
	g5.piece_nation["uk_army"] = "英国";
	g5.piece_type["uk_army"] = "army";
	I.refresh(g5);
	I.run_phase_entry(g5, "airforce", "英国");
	rules.action(g5, "Allies", "play_card",
		{ card: AIR, mode: "deploy", space: SPACE["不列颠"] });
	ok(g5.hands["英国"].length === 0, "deploy：有合法载体时正常打出");
	ok(g5.air_done["英国"] === true, "deploy 成功时占掉名额");

	/*
	 * --- 部署空军可与【海军】同格（海域）---
	 * 2026-09-22 玩家明确：空军不受地形限制，
	 * 可与本国陆军同格（陆地），也可与本国海军同格（海域）。
	 */
	const gSea = mkGame();
	gSea.turn_phase = "airforce";
	gSea.hands["英国"] = [AIR];
	/* 英国海军在北海（海域，且邻接不列颠从而处于补给） */
	gSea.location["uk_br"] = SPACE["不列颠"];
	gSea.piece_nation["uk_br"] = "英国";
	gSea.piece_type["uk_br"] = "army";
	gSea.location["uk_navy"] = SPACE["北海"];
	gSea.piece_nation["uk_navy"] = "英国";
	gSea.piece_type["uk_navy"] = "navy";
	I.refresh(gSea);
	I.run_phase_entry(gSea, "airforce", "英国");
	rules.action(gSea, "Allies", "play_card",
		{ card: AIR, mode: "deploy", space: SPACE["北海"] });
	{
		const air = Object.keys(gSea.location).find(p =>
			gSea.piece_type[p] === "air");
		ok(gSea.hands["英国"].length === 0, "部署空军到有本国海军的海域：允许（不与海军抢槽位）");
		ok(air && gSea.location[air] === SPACE["北海"], "  空军已落在北海");
	}

	/* basic_targets：海域（有本国海军）也应在 deploy 目标列表中 */
	const gSea2 = mkGame();
	gSea2.location["uk_br"] = SPACE["不列颠"];
	gSea2.piece_nation["uk_br"] = "英国";
	gSea2.piece_type["uk_br"] = "army";
	gSea2.location["uk_navy"] = SPACE["北海"];
	gSea2.piece_nation["uk_navy"] = "英国";
	gSea2.piece_type["uk_navy"] = "navy";
	I.refresh(gSea2);
	const tgSea = rules.query(gSea2, "Allies", "basic_targets", "空军力量:deploy");
	ok(tgSea.spaces.some(s => s.id === SPACE["北海"]),
		"basic_targets: 有本国海军的海域（北海）出现在 deploy 目标中");
	ok(tgSea.spaces.some(s => s.id === SPACE["不列颠"]),
		"basic_targets: 有本国陆军的陆地（不列颠）同样出现");

	/* can_build_at：空军不再被"只能建在陆地"误拒 */
	ok(I.can_build_at(gSea2, "英国", SPACE["北海"], "air").ok === true,
		"can_build_at: 海域建空军不再被地形误拒");

	/* --- has_legal_target 谓词口径 --- */
	ok(I.has_legal_target(g5, "英国", CARDS.find(x => x.name === "建设陆军"), {})
		.ok === true, "has_legal_target: 非空军力量卡恒为 true");
	const airCard = CARDS.find(x => x.name === "空军力量");
	/*
	 * 注意 g5 已经打完 deploy（该地区已被本国空军占位），
	 * 所以这里另建一个干净局面来验证 deploy 有载体的情形。
	 */
	const g6 = mkGame();
	g6.turn_phase = "airforce";
	g6.location["uk_army"] = SPACE["不列颠"];
	g6.piece_nation["uk_army"] = "英国";
	g6.piece_type["uk_army"] = "army";
	I.refresh(g6);
	ok(I.has_legal_target(g6, "英国", airCard, { mode: "deploy" }).ok === true,
		"has_legal_target: deploy 有载体 = true");
	ok(I.has_legal_target(g4, "英国", airCard, { mode: "move" }).ok === false,
		"has_legal_target: move 无空军 = false");
	ok(I.has_legal_target(g, "英国", airCard, { mode: "seize" }).ok === false,
		"has_legal_target: seize 无本国空军 = false");
	/* g5 已部署过 => 该地区空军槽已占，deploy 不再有合法目标 */
	ok(I.has_legal_target(g5, "英国", airCard, { mode: "deploy" }).ok === false,
		"has_legal_target: deploy 已占位后无合法目标 = false");

	/* --- seize_air 的健壮性：传 null / 不存在的空军不崩 --- */
	ok(I.seize_air(g5, "英国", null, SPACE["不列颠"]).ok === false,
		"seize_air(null) 安全返回 false");
	ok(I.seize_air(g5, "英国", "no-such-piece", SPACE["不列颠"]).ok === false,
		"seize_air(不存在的算子) 安全返回 false");
	ok(I.seize_air(g5, "英国", "uk_army", SPACE["不列颠"]).ok === false,
		"seize_air(非空军算子) 安全返回 false");
}

/* ============================================================ */
console.log("\n=== 12f. 非出牌阶段：只允许卡面有特殊说明的卡 ===");
{
	/* 补给阶段：无说明的基本卡被拒 */
	const g = mkGame();
	g.turn_phase = "supply";
	g.hands["英国"] = [ID["建设陆军"]];
	I.refresh(g);
	rules.action(g, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] });
	ok(g.hands["英国"].length === 1, "补给阶段：无说明的建设陆军被拒");
	/*
	 * 【2026-09-28】文案已改为"只有卡面有<当前阶段>特殊说明的卡牌才能在此阶段打出"
	 * （见 rules.js check_phase_for_card ④：原先不指定阶段，只要卡面出现任意
	 *   阶段名就放行，会让"跳过出牌阶段行动：…"这类状态卡在任何阶段都可打出）。
	 * 行为没变（仍然是拒绝），这里只放宽正则以兼容更精确的新文案。
	 */
	/*
	 * 【2026-09-28】文案又变了（阶段限制总纲改为"卡面声明"判据）：
	 * 现在是「《建设陆军》只能在出牌阶段打出（当前是补给阶段，…）」。
	 * 行为始终是【拒绝】，这里只匹配稳定的中文片段"只能在出牌阶段打出"。
	 */
	ok(/只能在出牌阶段打出/.test(g.log[g.log.length - 1]),
		"  理由说明只收卡面带说明的牌：" + g.log[g.log.length - 1]);

	/* 弃牌阶段：同样不能打牌（弃牌要走专门的 action） */
	const g2 = mkGame();
	g2.turn_phase = "discard";
	g2.hands["英国"] = [ID["建设陆军"]];
	I.refresh(g2);
	rules.action(g2, "Allies", "play_card", { card: ID["建设陆军"], space: SPACE["不列颠"] });
	ok(g2.hands["英国"].length === 1, "弃牌阶段：不能通过 play_card 打牌");

	/* has_phase_note 谓词 */
	ok(I.has_phase_note({ text: "只能在空军阶段打出" }, "空军阶段") === true,
		"has_phase_note: 提到对应阶段 = true");
	ok(I.has_phase_note({ text: "只能在空军阶段打出" }, "补给阶段") === false,
		"has_phase_note: 阶段不匹配 = false");
	ok(I.has_phase_note({ text: "随便写点别的" }) === false,
		"has_phase_note: 未提阶段名 = false");
	ok(I.has_phase_note({ text: "可在出牌阶段使用" }) === true,
		"has_phase_note: 未指定阶段但有阶段名 = true");
	ok(I.has_phase_note({}) === false, "has_phase_note: 无文本 = false");
}

/* ============================================================ */
console.log("\n=== 12g. 弃牌阶段：可主动弃任意数量手牌 ===");
{
	const g = mkGame();
	g.turn_phase = "discard";
	I.refresh(g);
	/* 先保证至少有 4 张手牌（摸牌阶段补到 7 的前提） */
	while (g.hands["英国"].length < 4) {
		if (!g.decks["英国"].length) break;
		g.hands["英国"].push(g.decks["英国"].shift());
	}
	I.run_phase_entry(g, "discard", "英国");
	const start = g.hands["英国"].length;
	ok(start >= 4, "弃牌阶段起始手牌 " + start + " 张");

	/* 单张弃（{card}） */
	rules.action(g, "Allies", "discard_in_discard_phase", { card: g.hands["英国"][0] });
	ok(g.hands["英国"].length === start - 1, "单张弃置：手牌 -1");
	ok(g.discard_phase_count["英国"] === 1, "单张弃置：计数 = 1");

	/* 多张一次确认（{cards}，UI 的【确认弃牌】按钮用法） */
	const batch = g.hands["英国"].slice(0, 2);
	rules.action(g, "Allies", "discard_in_discard_phase", { cards: batch });
	ok(g.hands["英国"].length === start - 3,
		"一次确认弃 2 张（" + start + " -> " + g.hands["英国"].length + "）");
	ok(g.discard_phase_count["英国"] === 3, "多张弃置：累计计数 = 3");

	/* 空列表 -> 拒绝 */
	const before0 = g.hands["英国"].length;
	rules.action(g, "Allies", "discard_in_discard_phase", { cards: [] });
	ok(g.hands["英国"].length === before0, "空选择：拒绝弃牌");

	/* 列表里含不存在的牌 -> 整批拒绝（不做半途弃置） */
	const mixed = [g.hands["英国"][0], "not-a-card"];
	rules.action(g, "Allies", "discard_in_discard_phase", { cards: mixed });
	ok(g.hands["英国"].length === before0, "含非法牌：整批拒绝，不弃任何一张");

	/* 同一张牌重复出现 -> 拒绝 */
	rules.action(g, "Allies", "discard_in_discard_phase",
		{ cards: [g.hands["英国"][0], g.hands["英国"][0]] });
	ok(g.hands["英国"].length === before0, "重复同一张牌：整批拒绝");

	/* 非弃牌阶段 -> 拒绝 */
	g.turn_phase = "play";
	const before = g.hands["英国"].length;
	rules.action(g, "Allies", "discard_in_discard_phase", { card: g.hands["英国"][0] });
	ok(g.hands["英国"].length === before, "非弃牌阶段：主动弃牌被拒");

	/* view 暴露可弃牌状态 */
	g.turn_phase = "discard";
	const v = rules.view(g, "Allies");
	ok(v.can_discard_freely === true, "view.can_discard_freely = true（弃牌阶段且有手牌）");
	ok(v.my_discard_count === 3, "view.my_discard_count = 3");
}

/* ============================================================ */
console.log("\n=== 13. 收回本国部队（easy_rule 五.1） ===");
{
	const g = mkGame();
	g.location["uk1"] = SPACE["西欧"]; g.piece_nation["uk1"] = "英国"; g.piece_type["uk1"] = "army";
	g.location["de1"] = SPACE["德国"]; g.piece_nation["de1"] = "德国"; g.piece_type["de1"] = "army";
	I.refresh(g);

	/* 本国回合内任意时刻：收回本国部队 */
	rules.action(g, "Allies", "remove_piece", { piece: "uk1" });
	ok(g.location["uk1"] == null, "本国回合内：收回本国陆军");

	/* 不能收回他国部队 */
	rules.action(g, "Allies", "remove_piece", { piece: "de1" });
	ok(g.location["de1"] != null, "不能收回他国部队");

	/*
	 * 友方出牌回合开始的询问：默认关闭 -> 不挂起（跳过）
	 */
	const g2 = mkGame();
	g2.location["uk1"] = SPACE["西欧"]; g2.piece_nation["uk1"] = "英国"; g2.piece_type["uk1"] = "army";
	I.refresh(g2);
	const ask1 = I.prepare_remove_ask(g2, "英国");
	ok(ask1 === null && g2.pending_ask === null, "默认关闭：询问时点被跳过");

	/* 打开开关后再进入出牌阶段 -> 挂起询问 */
	rules.action(g2, "Allies", "toggle_ask_remove", { value: true });
	ok(g2.ask_remove.allies === true, "开关：询问已开启（按阵营）");
	const ask2 = I.prepare_remove_ask(g2, "英国");
	ok(ask2 && ask2.nation === "英国" && ask2.pieces.length === 1,
		"开启后：出牌回合开始挂起询问（列出 1 支部队）");

	/* 跳过询问 */
	rules.action(g2, "Allies", "clear_ask", {});
	ok(g2.pending_ask === null, "可以跳过询问");

	/* 从询问里点掉部队后，询问自动消失 */
	const ask3 = I.prepare_remove_ask(g2, "英国");
	ok(ask3 && ask3.pieces.length === 1, "再次挂起询问");
	rules.action(g2, "Allies", "remove_piece", { piece: "uk1" });
	ok(g2.location["uk1"] == null, "从询问中收回部队");
	ok(g2.pending_ask === null, "没有剩余部队后询问自动消失");
}

console.log("\n" + "=".repeat(46));
console.log("通过 " + pass + " / 失败 " + fail);
process.exit(fail ? 1 : 0);
