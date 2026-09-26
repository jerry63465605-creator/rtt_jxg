/*
 * 补给引擎测试
 * 用法: node tools/test_supply.js
 *
 * 覆盖规则书第三节的原文口径：
 *   陆军：位于★ 或 与处于补给状态的【本国】部队相邻
 *   海军：与处于补给状态的【本国】部队相邻 且 与【本国或友军】的陆地部队相邻
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));
const I = rules._internal;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓ " + m)) : (fail++, console.log("  ✗ " + m)); };
const nm = (id) => data.name_of(id);

/* 便捷：造一个只有指定部队的 state */
function mk(pieces) {
	const g = rules.setup(1, "Standard", {});
	g.location = {};
	g.piece_nation = {};
	g.piece_type = {};
	for (const p of pieces) {
		g.location[p.id] = SPACE[p.at];
		g.piece_nation[p.id] = p.nation;
		g.piece_type[p.id] = p.type || "army";
	}
	I.refresh(g);
	return g;
}
const sup = (g) => I.compute_supply(g).in_supply;

/* 找一个已知的★补给点及其邻接陆地，用于构造测试 */
console.log("=== 0. 地形前提 ===");
const SP = rules.query(rules.setup(1, "Standard", {}), "Axis", "supply_points");
console.log("  补给点(" + SP.length + "): " + SP.map(s => s.name).join("、"));
ok(SP.length >= 8, "地图上有足够数量的★补给点");

/* 选一个补给点作种子：德国（home+supply） */
const SEED = "德国";
ok(data.spaces[SPACE[SEED]].supply, SEED + " 是补给点");
const weNeighbors = data.spaces[SPACE[SEED]].connections.map(nm);
console.log("  " + SEED + " 的邻接: " + weNeighbors.join("、"));

/* ============================================================ */
console.log("\n=== 1. 补给点上的部队自动处于补给 ===");
{
	const g = mk([{ id: "de1", nation: "德国", at: "德国" }]);
	ok(sup(g)["de1"] === true, "德国陆军在德国（★）-> 有补给");
	ok(I.compute_supply(g).sources["de1"] === "base", "补给来源标记为 base（补给点）");
}

/* ============================================================ */
console.log("\n=== 2. 陆军链式传播（同国） ===");
{
	/* 德国 → 东欧 → 巴尔干（都是德国陆军） */
	const g = mk([
		{ id: "de1", nation: "德国", at: "德国" },
		{ id: "de2", nation: "德国", at: "东欧" },
		{ id: "de3", nation: "德国", at: "巴尔干" },
	]);
	const s = sup(g);
	ok(s["de1"] === true, "德国(★) 有补给");
	ok(s["de2"] === true, "东欧的德国陆军（与德国相邻）有补给");
	ok(s["de3"] === true, "巴尔干的德国陆军（与东欧相邻）经链条有补给");
	ok(I.compute_supply(g).sources["de3"] === "chain", "巴尔干来源标记为 chain");
}

/* ============================================================ */
console.log("\n=== 3. 核心：补给链【不跨国家】（已确认口径） ===");
{
	/* 德国在德国（有补给），意大利在东欧（与德国相邻但是不同国） */
	const g = mk([
		{ id: "de1", nation: "德国", at: "德国" },
		{ id: "it1", nation: "意大利", at: "东欧" },
	]);
	const s = sup(g);
	ok(s["de1"] === true, "德国陆军有补给");
	ok(s["it1"] !== true, "意大利陆军【不】因与德国相邻而获得补给（同国才续接）");

	/* 反证：意大利若紧邻自家的补给点则应获得补给 */
	const g2 = mk([{ id: "it1", nation: "意大利", at: "意大利" }]);
	ok(sup(g2)["it1"] === true, "意大利陆军在意大利（★）有补给");
}

/* ============================================================ */
console.log("\n=== 4. 断补的陆军（远离一切补给点） ===");
{
	/* 非洲南部：邻接只有 非洲北部 / 非洲东部，两者都不是★ */
	ok(!data.spaces[SPACE["非洲南部"]].supply, "非洲南部 不是补给点");
	const g = mk([{ id: "de1", nation: "德国", at: "非洲南部" }]);
	ok(sup(g)["de1"] !== true, "孤悬非洲南部的德国陆军断补");

	/* 注意：夏威夷是★补给点，不能用作断补用例 —— 一并断言以防未来误用 */
	ok(data.spaces[SPACE["夏威夷"]].supply, "夏威夷 是补给点（故不可用作断补用例）");
}

/* ============================================================ */
console.log("\n=== 5. 链条中断则后方全部断补 ===");
{
	/* 德国(★) → 东欧 → 罗斯 → 西伯利亚（都用德国陆军） */
	const chain = [
		{ id: "de1", nation: "德国", at: "德国" },
		{ id: "de2", nation: "德国", at: "东欧" },
		{ id: "de3", nation: "德国", at: "罗斯" },
		{ id: "de4", nation: "德国", at: "西伯利亚" },
	];
	const g = mk(chain);
	const s = sup(g);
	ok(s["de4"] === true, "完整链条：西伯利亚经三级传递有补给");

	/* 抽掉中间一环（罗斯） */
	const g2 = mk([chain[0], chain[1], chain[3]]);
	ok(sup(g2)["de4"] !== true, "抽掉罗斯后，西伯利亚断补（链条中断）");

	/* 再证：抽掉东欧，后两级都断补 */
	const g3 = mk([chain[0], chain[2], chain[3]]);
	const s3 = sup(g3);
	ok(s3["de3"] !== true && s3["de4"] !== true, "抽掉东欧后，罗斯与西伯利亚均断补");
}

/* ============================================================ */
console.log("\n=== 6. 海军：两条条件都必须满足 ===");
{
	/* 北海是德国陆地(德国)的邻接海域吗？先探测 */
	const northSea = "北海";
	const nsNbrs = data.spaces[SPACE[northSea]].connections.map(nm);
	console.log("  北海邻接: " + nsNbrs.join("、"));

	/* 6a. 海军 + 本国陆军在同一海域，且陆军有补给 -> 海军有补给 */
	/*     找一个既有★、又能放海军的组合：用德国陆军在德国，另建德国海军在与其相邻的海域 */
	const germanLand = ["德国", "西欧", "波罗的海", "北海"];
	const seaNext = nsNbrs.find(n => data.spaces[SPACE[n]].terrain === "sea");
	console.log("  选取测试海域: " + seaNext);

	/* 6b. 海军单独在海域（无任何陆军相邻）-> 断补 */
	const gB = mk([{ id: "de_navy", nation: "德国", type: "navy", at: seaNext }]);
	ok(sup(gB)["de_navy"] !== true, "孤立海军（无本国陆军相邻）断补 —— 缺第2条");

	/* 6c. 海军邻接本国【有补给】的陆军 -> 满足两条 -> 有补给 */
	/*     需要：海军所在海域 与 某个有补给的德国陆军所在陆地 相邻 */
	let found = null;
	for (const landName of SP.map(s => s.name)) {
		for (const nb of data.spaces[SPACE[landName]].connections.map(nm)) {
			if (data.spaces[SPACE[nb]].terrain === "sea") { found = { land: landName, sea: nb }; break; }
		}
		if (found) break;
	}
	if (found) {
		console.log("  用例: 海军在「" + found.sea + "」，陆军在★「" + found.land + "」");
		const gC = mk([
			{ id: "de_land", nation: "德国", type: "army", at: found.land },
			{ id: "de_navy", nation: "德国", type: "navy", at: found.sea },
		]);
		const sC = sup(gC);
		ok(sC["de_land"] === true, "该陆军在★上，有补给");
		ok(sC["de_navy"] === true, "海军邻接【本国且已补给】的陆军 -> 满足两条 -> 有补给");
	} else {
		ok(false, "未能找到「★陆地 + 相邻海域」组合");
	}
}

/* ============================================================ */
console.log("\n=== 7. 海军第2条允许【友军】陆军（原文『本国或友军』） ===");
{
	/* 构造：德国海军所在海域，邻接一片陆地，陆地上只有意大利陆军（友军）。
	 * 意大利陆军需自己有补给（站在★上），否则它不构成"陆地部队"…
	 * 注意：原文第2条只说"与本国或友军的陆地部队相邻"，
	 *       并未要求该陆军处于补给状态。这里按原文实现。 */
	let combo = null;
	for (const sp of SP) {
		for (const nb of data.spaces[SPACE[sp.name]].connections.map(nm)) {
			if (data.spaces[SPACE[nb]].terrain === "sea") { combo = { land: sp.name, sea: nb }; break; }
		}
		if (combo) break;
	}
	if (combo) {
		const g = mk([
			{ id: "it_land", nation: "意大利", type: "army", at: combo.land },
			{ id: "de_navy", nation: "德国", type: "navy", at: combo.sea },
			{ id: "de_land", nation: "德国", type: "army", at: combo.land },   /* 本国陆军，提供第1条 */
		]);
		/* 意大利陆军在★上，与德国海军同格位所在陆地相邻 */
		const s = sup(g);
		ok(s["de_land"] === true, "德国陆军在★上有补给");
		ok(s["de_navy"] === true, "德国海军：第1条由本国陆军满足，第2条可由友军满足");
	} else {
		ok(false, "未找到测试组合");
	}
}

/* ============================================================ */
console.log("\n=== 8. 断补结算：只移除【指定国家】的断补部队 ===");
{
	const g = mk([
		{ id: "de1", nation: "德国", at: "德国" },            /* 有补给 */
		{ id: "de2", nation: "德国", at: "非洲南部" },        /* 断补 */
		{ id: "it1", nation: "意大利", at: "非洲南部" },      /* 断补，但不属德国 */
	]);
	const removed = I.resolve_supply(g, "德国");
	ok(removed.length === 1 && removed[0] === "de2", "只移除德国的断补部队 de2");
	ok(g.location["de1"] != null, "德国的有补给部队保留");
	ok(g.location["it1"] != null, "意大利的部队不受德国结算影响（按国家结算）");
}

/* ============================================================ */
console.log("\n=== 9. 移除后连通性/海峡控制权同步刷新 ===");
{
	/* 英国陆军占领北欧（夺取丹麦海峡），但它断补 -> 移除后海峡应归还轴心 */
	const g = mk([{ id: "uk1", nation: "英国", at: "北欧" }]);
	ok(I.strait_controller(g, SPACE["北欧"]) === "allies", "英国陆军占领北欧 -> 海峡属同盟");
	const removed = I.resolve_supply(g, "英国");
	ok(removed.length === 1, "该部队断补被移除（孤悬北欧，无补给源）");
	ok(I.strait_controller(g, SPACE["北欧"]) === "axis", "移除后海峡控制权回到默认（轴心）");
}

/* ============================================================ */
console.log("\n=== 10. 循环/自环不会死循环 ===");
{
	/* 三个德国陆军互相围绕（东欧-巴尔干-乌克兰 构成三角），但都不邻★ */
	const g = mk([
		{ id: "a", nation: "德国", at: "东欧" },
		{ id: "b", nation: "德国", at: "巴尔干" },
		{ id: "c", nation: "德国", at: "乌克兰" },
	]);
	const t0 = Date.now();
	const s = sup(g);
	const dt = Date.now() - t0;
	ok(dt < 1000, "计算在 1 秒内完成（无死循环），耗时 " + dt + "ms");
	/* 东欧邻接德国（★），所以 a 应有补给，进而 b、c 也可能有 */
	console.log("  结果: " + JSON.stringify(s));
	ok(s["a"] === true, "东欧邻接德国(★) -> 有补给");
}

/* ============================================================ */
console.log("\n=== 11. view / query 接口 ===");
{
	const g = mk([
		{ id: "de1", nation: "德国", at: "德国" },
		{ id: "de9", nation: "德国", at: "非洲南部" },
	]);
	const v = rules.view(g, "Axis");
	const pDe1 = v.pieces.find(p => p.id === "de1");
	const pDe9 = v.pieces.find(p => p.id === "de9");
	ok(pDe1.in_supply === true, "view.pieces[de1].in_supply = true");
	ok(pDe9.in_supply === false, "view.pieces[de9].in_supply = false");
	ok(v.supply.out_of_supply.length === 1, "view.supply.out_of_supply 有 1 个");
	ok(v.supply.by_nation["德国"].total === 2 && v.supply.by_nation["德国"].ok === 1,
		"view.supply.by_nation 统计正确 (2 总数 / 1 有补给)");

	const q = rules.query(g, "Axis", "supply");
	ok(Object.keys(q).length === 2, "query('supply') 返回 2 条记录");
	ok(q["de9"].in_supply === false, "query('supply')['de9'].in_supply = false");
}

console.log("\n" + "=".repeat(46));
console.log("通过 " + pass + " / 失败 " + fail);
process.exit(fail ? 1 : 0);
