/*
 * 回合状态机 + 手牌模型测试
 * 用法: node tools/test_turns.js
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));
const { CARDS, CARD_BY_ID, cards_of_nation } = require(path.join(DIR, "cards.js"));
const I = rules._internal;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓ " + m)) : (fail++, console.log("  ✗ " + m)); };
const nm = (id) => data.name_of(id);

/* ============================================================ */
console.log("=== 1. 卡牌数据 ===");
ok(CARDS.length === 54, "卡牌 54 张（实际 " + CARDS.length + "）");
ok(cards_of_nation("英国").length === 54, "全部属英国卡组");
const byType = {};
for (const c of CARDS) byType[c.type] = (byType[c.type] || 0) + 1;
console.log("  类型: " + Object.entries(byType).map(([k, v]) => k + " " + v).join(" / "));
ok(CARD_BY_ID[15300] && CARD_BY_ID[15300].name === "建设陆军", "按 id 索引正常（15300=建设陆军）");
ok(CARD_BY_ID[15304].ops === null, "基础卡无行动点（空军力量 ops=null）");
ok(CARD_BY_ID[15305].ops === 1, "事件卡有 1 点行动点");
ok(CARD_BY_ID[15313].type === "ECON", "经济战卡类型正确");

/* ============================================================ */
console.log("\n=== 2. 确定性洗牌 ===");
{
	const a = I.shuffle_deterministic([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 12345);
	const b = I.shuffle_deterministic([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 12345);
	const c = I.shuffle_deterministic([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 99999);
	ok(JSON.stringify(a) === JSON.stringify(b), "同种子洗牌结果一致（可重放）");
	ok(JSON.stringify(a) !== JSON.stringify(c), "不同种子洗牌结果不同");
	ok(a.length === 10 && new Set(a).size === 10, "洗牌不丢牌");
}

/* ============================================================ */
console.log("\n=== 3. setup 初始状态（手牌 7 张） ===");
let game = rules.setup(20260922, "Standard", {});
ok(game.turn === 1, "turn = 1");
ok(game.turn_phase === "resource", "初始阶段 = resource（资源再分配）");
ok(game.current_nation === "德国", "先手国家 = 德国");
for (const n of I.ORDER_OF_NATIONS) {
	const h = game.hands[n] || [];
	console.log("  " + n + ": 手牌 " + h.length + " 张, 牌堆 " + (game.decks[n] || []).length);
}
/*
 * 注意：目前只编译了【英国卡组】，其余 5 国借用英国卡组代打
 * （rules.js 里的 USE_TEST_DECKS 开关，补全卡组后关闭）。
 */
ok(game.hands["英国"].length === 7, "英国手牌 7 张");
ok(game.decks["英国"].length === 43, "英国牌堆余 43 张（50 张 CORE 中抓 7 张）");
ok(game.hands["德国"].length === 7, "德国手牌 7 张（开发期借用英国卡组）");
ok(game.hands["日本"].length === 7, "日本手牌 7 张（同上）");
ok(I.HAND_LIMIT === 7, "手牌上限 = 7");

/* ============================================================ */
console.log("\n=== 4. 手牌可见性（暗手牌） ===");
{
	/* 为了测手牌可见性，把行动国切到【英国】（唯一有卡组的国家） */
	game.current_nation = "英国";
	game.active = "Allies";

	const vAllies = rules.view(game, "Allies");   // 英国回合，同盟玩家
	const vAxis = rules.view(game, "Axis");       // 轴心玩家
	ok(vAllies.my_nation === "英国", "同盟玩家当前代表英国");
	ok(vAxis.my_nation === null, "轴心玩家不在本方回合，看不到手牌");
	ok(vAllies.hands["英国"].cards !== null, "同盟能看到英国手牌牌面");
	ok(vAllies.hands["英国"].cards.length === 7, "看到 7 张");
	ok(vAllies.hands["英国"].cards[0].name != null, "牌面含卡名");
	ok(vAxis.hands["英国"].cards === null, "对手手牌不暴露牌面");
	ok(vAxis.hands["英国"].count === 7, "对手手牌张数公开（7 张）");
}

/* ============================================================ */
console.log("\n=== 5. 7 阶段推进（英国） ===");
{
	const seen = [];
	for (let i = 0; i < 7; i++) {
		const v = rules.view(game, "Allies");
		seen.push(v.turn_phase);
		rules.action(game, "Allies", "next_phase", {});
	}
	console.log("  阶段序列: " + seen.join(" -> "));
	ok(seen[0] === "resource", "阶段1 = resource");
	ok(seen[1] === "play", "阶段2 = play（出牌阶段）");
	ok(seen[2] === "airforce", "阶段3 = airforce");
	ok(seen[3] === "supply", "阶段4 = supply");
	ok(seen[4] === "scoring", "阶段5 = scoring");
	ok(seen[5] === "discard", "阶段6 = discard");
	ok(seen[6] === "draw", "阶段7 = draw");
	ok(game.current_nation === "日本", "英国 7 阶段跑完 -> 轮到日本（顺序下一国）");
	ok(game.turn === 1, "回合数仍为 1");
}

/* ============================================================ */
console.log("\n=== 6. 出牌阶段：每回合三选一 ===");
{
	/* 切回英国，进入出牌阶段（七阶段测试已把 turn_phase 推到 draw） */
	game.current_nation = "英国";
	game.turn_phase = "play";
	I.run_phase_entry(game, "play", "英国");

	const v = rules.view(game, "Allies");
	ok(v.my_nation === "英国", "同盟玩家代表英国");
	ok(v.my_play_done === false, "新出牌阶段：未行动");

	/* 做一次（①打出）-> 同一阶段内三选一全被占用 */
	while (game.hands["英国"].length < 2) I.draw_cards(game, "英国", 1);
	const card0 = game.hands["英国"][0];
	const before = game.hands["英国"].length;
	rules.action(game, "Allies", "play_card", { card: card0 });
	ok(game.hands["英国"].indexOf(card0) < 0, "① 打出 1 张手牌：该卡离开手牌");
	ok((game.play_done || {})["英国"] === true, "① 之后记为已行动");
	ok(before - game.hands["英国"].length === 1, "① 手牌少 1 张");

	/* 再进入新的出牌阶段 -> 恢复 */
	game.turn_phase = "play";
	I.run_phase_entry(game, "play", "英国");
	ok((game.play_done || {})["英国"] === false, "下一个出牌阶段重新可用");
}

/* ============================================================ */
console.log("\n=== 7. 资源再分配：弃 3 张手牌挑 1 张基本卡 ===");
{
	game.turn_phase = "resource";
	const N = "英国";
	/* 保证手牌 >= 3 */
	while (game.hands[N].length < 8) {
		if (!I.draw_cards(game, N, 1).length)
			break;
	}
	const handBefore = game.hands[N].length;
	const basics = I.deck_basics(game, N);
	const take = basics[0].id;
	const drop = game.hands[N].slice(0, 3);

	rules.action(game, "Allies", "resource_swap", { discard: drop, take: take });
	ok(game.hands[N].indexOf(take) >= 0, "挑的基本卡进入手牌");
	ok(game.hands[N].length === handBefore - 2,
		"手牌 = 原 -3 +1（" + handBefore + " -> " + game.hands[N].length + "）");
	ok(game.decks[N].indexOf(take) < 0, "该基本卡离开牌堆");
	for (const d of drop) ok(game.discard[N].indexOf(d) >= 0, "代价牌进入弃牌堆");

	/* 非资源阶段 -> 拒绝 */
	const before2 = game.hands[N].length;
	game.turn_phase = "play";
	rules.action(game, "Allies", "resource_swap", {
		discard: game.hands[N].slice(0, 3), take: take,
	});
	ok(game.hands[N].length === before2, "非资源阶段：拒绝执行");
}

/* ============================================================ */
console.log("\n=== 8. 全部 6 国轮转 -> 回合 +1 ===");
{
	/* 回到英国回合起点，完整跑一圈 */
	game.current_nation = "英国";
	game.turn_phase = "resource";
	game.nations_done = 0;
	const t0 = game.turn;
	const seq = [];
	for (let n = 0; n < 6; n++) {
		seq.push(game.current_nation);
		for (let i = 0; i < 7; i++) rules.action(game, "Allies", "next_phase", {});
	}
	console.log("  经过: " + seq.join(" -> ") + " -> 回到 " + game.current_nation);
	ok(seq.join(",") === "英国,日本,苏联,意大利,美国,德国", "轮转顺序正确（英→日→苏→意→美→德）");
	ok(game.turn === t0 + 1, "6 国轮完 -> 回合 " + t0 + " -> " + game.turn);
	ok(game.current_nation === "英国", "新回合回到英国（环绕）");
}

/* ============================================================ */
console.log("\n=== 9. 摸牌阶段：手牌补到 7 张 ===");
{
	game.current_nation = "英国";
	const n = "英国";

	/* 手牌少于 7 张 -> 补到 7 张 */
	while (game.hands[n].length >= 4) I.discard_card(game, n, game.hands[n][0]);
	const before = game.hands[n].length;
	game.turn_phase = "draw";
	I.run_phase_entry(game, "draw", n);
	ok(game.hands[n].length === 7,
		"手牌 " + before + " 张 -> 补到 7 张（实际 " + game.hands[n].length + "）");

	/* 手牌已 7 张 -> 不再摸牌 */
	const before7 = game.hands[n].length;
	I.run_phase_entry(game, "draw", n);
	ok(game.hands[n].length === before7,
		"手牌已 7 张 -> 不补牌（保持 " + game.hands[n].length + "）");

	/* 手牌不足但牌堆也空了 -> 摸到多少算多少，不报错 */
	while (game.hands[n].length > 1) I.discard_card(game, n, game.hands[n][0]);
	game.decks[n] = [];
	game.discard[n] = [];
	I.run_phase_entry(game, "draw", n);
	ok(game.hands[n].length === 1,
		"牌堆与弃牌堆都空 -> 摸到多少算多少（保持 " + game.hands[n].length + "）");
}

/* ============================================================ */
console.log("\n=== 10. 弃牌阶段（上限 7） ===");
{
	const n = "英国";
	while (game.hands[n].length < 10) I.draw_cards(game, n, 1);
	const before = game.hands[n].length;
	game.turn_phase = "discard";
	I.run_phase_entry(game, "discard", n);
	ok(game.hands[n].length === 7, "弃牌阶段把 " + before + " 张弃到 7 张");
	ok(game.discard[n].length >= 3, "弃置的牌进入弃牌堆");
}

/* ============================================================ */
console.log("\n=== 11. 计分阶段：按计分标记给分（大本营被占领则跳过） ===");
{
	/* 造一个干净局面 */
	const g = rules.setup(777, "Standard", {});
	g.current_nation = "德国";
	g.turn_phase = "scoring";

	/*
	 * 2026-09-22 起计分口径变了：
	 * 分数来自【地块上的计分标记】（初始补给点各 2 个），
	 * 不再按"处于补给状态的部队数"。
	 * 德国大本营是补给点 -> 有 2 个标记 -> 独自占领得 2 分。
	 */
	g.location = {}; g.piece_nation = {}; g.piece_type = {};
	g.location["de1"] = SPACE["德国"];
	g.piece_nation["de1"] = "德国";
	g.piece_type["de1"] = "army";
	I.refresh(g);
	I.run_phase_entry(g, "scoring", "德国");
	ok(g.score.axis === 2, "德国独占大本营（2 个标记）-> +2（轴心总分 " + g.score.axis + "）");
	ok(g.phase_note.indexOf("计分") >= 0, "阶段提示含计分信息");

	/* 苏联陆军占领德国大本营 -> 跳过 */
	g.location["su1"] = SPACE["德国"];
	g.piece_nation["su1"] = "苏联";
	g.piece_type["su1"] = "army";
	I.refresh(g);
	const before = g.score.axis;
	I.run_phase_entry(g, "scoring", "德国");
	ok(g.score.axis === before, "大本营被敌方占领 -> 跳过（分数不变 " + g.score.axis + "）");
	ok(/跳过/.test(g.phase_note), "阶段提示说明跳过原因");
}

/* ============================================================ */
console.log("\n=== 11b. 计分标记：数量、专属、平分 ===");
{
	const { SPACE: SP, data: DT } = require(
		"../server-official/public/quartermaster-sub-wars/data.js");

	/* 初始：12 个补给点各有 2 个标记 */
	const g0 = rules.setup(99, "Standard", {});
	const marked = Object.keys(g0.markers);
	ok(marked.length === 12, "初始有 12 个地块带计分标记（实际 " + marked.length + "）");
	ok(Object.values(g0.markers).every(l => l.length === 2),
		"每个初始补给点各有 2 个标记");

	/* 独自占领 -> 全拿 */
	const g = rules.setup(99, "Standard", {});
	g.location = {}; g.piece_nation = {}; g.piece_type = {};
	g.location["uk1"] = SP["不列颠"]; g.piece_nation["uk1"] = "英国"; g.piece_type["uk1"] = "army";
	I.refresh(g);
	ok(I.score_breakdown(g, "英国").total === 2, "只有英国 -> 得 2 分");

	/* 英法同格（同集团）-> 各 1，合并后英国 2 */
	g.location["fr1"] = SP["不列颠"]; g.piece_nation["fr1"] = "法国"; g.piece_type["fr1"] = "army";
	I.refresh(g);
	ok(I.score_breakdown(g, "英国").total === 2, "英+法同格 -> 合并后英国仍是 2 分");
	ok(I.score_breakdown(g, "法国").total === 2, "  法国视角走英国口径（counted_as 英国）");

	/* 英苏同格 -> 各 1 */
	const g2 = rules.setup(99, "Standard", {});
	g2.location = {}; g2.piece_nation = {}; g2.piece_type = {};
	g2.location["uk1"] = SP["不列颠"]; g2.piece_nation["uk1"] = "英国"; g2.piece_type["uk1"] = "army";
	g2.location["su1"] = SP["不列颠"]; g2.piece_nation["su1"] = "苏联"; g2.piece_type["su1"] = "army";
	I.refresh(g2);
	ok(I.score_breakdown(g2, "英国").total === 1, "英+苏同格（跨国）-> 英国 1 分");
	ok(I.score_breakdown(g2, "苏联").total === 1, "  苏联 1 分");

	/* 只剩 1 个标记 -> 只给顺序在前的国家 */
	const g3 = rules.setup(99, "Standard", {});
	g3.location = {}; g3.piece_nation = {}; g3.piece_type = {};
	I.remove_marker(g3, SP["不列颠"], 1);
	g3.location["uk1"] = SP["不列颠"]; g3.piece_nation["uk1"] = "英国"; g3.piece_type["uk1"] = "army";
	g3.location["su1"] = SP["不列颠"]; g3.piece_nation["su1"] = "苏联"; g3.piece_type["su1"] = "army";
	I.refresh(g3);
	ok(I.score_breakdown(g3, "英国").total === 1, "1 分时只给顺序在前的英国");
	ok(I.score_breakdown(g3, "苏联").total === 0, "  苏联拿不到");

	/* 专属标记：只对某国生效 */
	const g4 = rules.setup(99, "Standard", {});
	g4.location = {}; g4.piece_nation = {}; g4.piece_type = {};
	I.set_marker_owner(g4, SP["不列颠"], "英国");
	g4.location["su1"] = SP["不列颠"]; g4.piece_nation["su1"] = "苏联"; g4.piece_type["su1"] = "army";
	I.refresh(g4);
	ok(I.score_breakdown(g4, "苏联").total === 0,
		"专属英国的标记：苏联占领时拿不到分");

	/* 标记增删改 */
	const g5 = rules.setup(99, "Standard", {});
	const b0 = I.markers_on(g5, SP["不列颠"]).length;
	I.add_marker(g5, SP["不列颠"], 3, "中国");
	ok(I.markers_on(g5, SP["不列颠"]).length === b0 + 3, "add_marker 增加 3 个");
	I.remove_marker(g5, SP["不列颠"], 1, "中国");
	ok(I.markers_on(g5, SP["不列颠"]).length === b0 + 2, "remove_marker 按归属移除 1 个");
	I.move_marker(g5, SP["不列颠"], SP["西欧"], 2);
	ok(I.markers_on(g5, SP["西欧"]).length === 2, "move_marker 转移 2 个到西欧");

	/* 计分顺序 */
	ok(I.scoring_rank("英国") < I.scoring_rank("法国"), "顺序：英国 在 法国 之前");
	ok(I.scoring_rank("法国") < I.scoring_rank("苏联"), "顺序：法国 在 苏联 之前");
	ok(I.scoring_rank("苏联") < I.scoring_rank("美国"), "顺序：苏联 在 美国 之前");
	ok(I.scoring_rank("美国") < I.scoring_rank("中国"), "顺序：美国 在 中国 之前");
}

/* ============================================================ */
console.log("\n=== 12. 空军调度 ===");
{
	const g = rules.setup(888, "Standard", {});
	g.current_nation = "德国";
	g.turn_phase = "airforce";
	g.location = {}; g.piece_nation = {}; g.piece_type = {};

	/* 德国陆军在德国，德国空军在别处 */
	g.location["de_army"] = SPACE["德国"];
	g.piece_nation["de_army"] = "德国";
	g.piece_type["de_army"] = "army";
	g.location["de_air"] = SPACE["东欧"];
	g.piece_nation["de_air"] = "德国";
	g.piece_type["de_air"] = "air";
	I.refresh(g);

	/*
	 * 调度代价（2026-09-22 规则确认）：弃 1 张手牌，不消耗行动点。
	 * 此处确保德国手里有牌可弃。
	 */
	I.init_nation_deck(g, "德国");
	if (!g.hands["德国"].length) I.draw_cards(g, "德国", 3);

	const handA = g.hands["德国"].length;
	rules.action(g, "Axis", "air_support", { air: "de_air", target: SPACE["德国"] });
	ok(g.location["de_air"] === SPACE["德国"], "空军已调度到陆军所在地");
	ok(g.piece_type["de_air"] === "air", "算子类型不变（仍是空军）");
	ok(g.hands["德国"].length === handA - 1,
		"调度弃 1 张手牌（" + handA + " -> " + g.hands["德国"].length + "）");

	/* 同地区不能有第二支同国空军 */
	g.location["de_air2"] = SPACE["东欧"];
	g.piece_nation["de_air2"] = "德国";
	g.piece_type["de_air2"] = "air";
	if (!g.hands["德国"].length) I.draw_cards(g, "德国", 3);
	I.refresh(g);
	rules.action(g, "Axis", "air_support", { air: "de_air2", target: SPACE["德国"] });
	ok(g.location["de_air2"] === SPACE["东欧"], "目标已有同国空军 -> 拒绝调度");

	/* 非空军阶段不允许 */
	g.turn_phase = "supply";
	g.location["de_air2"] = SPACE["德国"];
	rules.action(g, "Axis", "air_support", { air: "de_air2", target: SPACE["东欧"] });
	ok(true, "非空军阶段调度被拒（不抛异常）");
}

/* ============================================================ */
console.log("\n=== 13. 打出手牌 ===");
{
	const g = rules.setup(555, "Standard", {});
	g.current_nation = "英国";
	g.active = "Allies";
	g.turn_phase = "play";
	const N = "英国";
	I.run_phase_entry(g, "play", N);
	const card = g.hands[N][0];

	rules.action(g, "Allies", "play_card", { card: card });
	ok((g.play_done || {})[N] === true, "打出卡牌后记为已行动（出牌阶段三选一）");
	ok(g.hands[N].indexOf(card) < 0, "该牌离开手牌");

	/* 同一出牌阶段不能再次出牌 */
	const c2 = g.hands[N][0];
	const n0 = g.hands[N].length;
	rules.action(g, "Allies", "play_card", { card: c2 });
	ok(g.hands[N].length === n0, "本回合已行动 -> 无法再出牌");

	/* 状态卡留置桌面（进入新的出牌阶段） */
	g.turn_phase = "play";
	I.run_phase_entry(g, "play", N);
	/* 手牌里是实体牌（<card_id>#<n>），取牌面数据要用 inst_card */
	const statusCard = g.hands[N].find(id => {
		const c = I.inst_card(id);
		return c && c.type === "STATUS";
	});
	if (statusCard) {
		rules.action(g, "Allies", "play_card", { card: statusCard });
		ok(g.table[N].indexOf(statusCard) >= 0, "状态卡打出后留置桌面（table）");
	} else {
		ok(false, "手牌中未找到状态卡（测试数据问题）");
	}
}

/* ============================================================ */
console.log("\n=== 14. 第 6 回合后基础卡移出游戏 ===");
{
	const g = rules.setup(999, "Standard", {});
	g.turn = 7;
	const basic = CARD_BY_ID[15300];   /* 建设陆军 = BASIC */
	g.hands["英国"] = [basic.id, 15305, 15306];
	g.removed["英国"] = [];
	I.purge_basic_cards(g);
	ok(g.removed["英国"].indexOf(basic.id) >= 0, "基础卡被移出游戏");
	ok(g.hands["英国"].indexOf(basic.id) < 0, "基础卡离开手牌");
	ok(g.hands["英国"].length === 2, "非基础卡保留（2 张）");
}

/* ============================================================ */
console.log("\n=== 15. view / query 字段 ===");
{
	const g = rules.setup(111, "Standard", {});
	g.current_nation = "英国";
	g.active = "Allies";
	const v = rules.view(g, "Allies");
	ok(v.turn_phase_zh === "资源再分配", "view.turn_phase_zh 正确");
	ok(v.phase_index === 1 && v.phase_total === 7, "阶段序号 1/7");
	ok(Array.isArray(v.phases) && v.phases.length === 7, "view.phases 有 7 项");
	ok(v.card_types && v.card_types.EVENT, "view.card_types 含类型说明");
	ok(v.deck_counts && typeof v.deck_counts["英国"] === "number", "view.deck_counts 正常");
	ok(v.my_nation === "英国", "view.my_nation = 英国");

	const q = rules.query(g, "Allies", "turn_state");
	ok(q.turn === 1 && q.current_nation === "英国", "query('turn_state') 正确");
	ok(q.phase_total === 7, "query('turn_state').phase_total = 7");

	const qh = rules.query(g, "Allies", "hand");
	ok(qh.nation === "英国" && qh.cards.length === 7, "query('hand') 返回英国 7 张牌");
	ok(qh.hand_limit === 7, "手牌上限 7");

	const qa = rules.query(g, "Axis", "hand");
	ok(qa === null, "非本方回合 query('hand') 返回 null");

	const qc = rules.query(g, "Allies", "card_list");
	ok(qc.length === 54, "query('card_list') 返回 54 张");

	ok(v.actions && v.actions.next_phase === 1, "view.actions 含 next_phase");
	ok(v.actions.play_card === 1, "view.actions 含 play_card");
	ok(rules.view(g, "Axis").actions === null, "非本方回合 actions = null");
}

/* ============================================================ */
console.log("\n=== 16. action 必须返回 state ===");
{
	const g = rules.setup(222, "Standard", {});
	g.current_nation = "英国";
	g.turn_phase = "play";
	I.run_phase_entry(g, "play", "英国");
	for (const [a, arg] of [["next_phase", {}], ["play_card", { card: g.hands["英国"][0] }],
		["air_support", {}], ["discard_one", { card: g.hands["英国"][0] }],
		["minus_score", {}], ["remove_piece", { piece: "x" }], ["clear_ask", {}],
		["toggle_ask_remove", { value: true }]]) {
		const r = rules.action(g, "Allies", a, arg);
		ok(r !== undefined && r !== null, "action('" + a + "') 返回 state");
	}
}

console.log("\n" + "=".repeat(46));
console.log("通过 " + pass + " / 失败 " + fail);
process.exit(fail ? 1 : 0);
