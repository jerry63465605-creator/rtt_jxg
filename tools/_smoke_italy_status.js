/*
 * 意大利状态牌（STATUS 17739-17749）冒烟测试
 * Group 1（纯 auto 计分）：17739 / 17740 / 17741 / 17743 / 17745 / 17748
 *
 * 玩家口径（2026-10-08 确认）：
 *   · 17743/17748「被友方控制」= 轴心任意国（德/意/日）
 *   · 17741「场上海军」= 全场所有地区，无地区限制
 *   · 17745「无人控制」= 无任何部队；「仅被德国控制」= 有德国部队且无其它国部队
 *   · 17739 是布尔判定（有则 +1，不按棋子数累加）
 *   · 17748 按【地区数】计（每地区最多 +1）
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let fails = 0
function ok(name, cond, extra) {
	if (cond) { console.log('  PASS ' + name) }
	else { fails++; console.log('  FAIL ' + name + (extra ? ' | ' + extra : '')) }
}

/* 构造最小局面 */
function newGame() {
	const g = {
		turn: 1, current_nation: '意大利', active: 'Axis', turn_phase: 'play',
		location: {}, piece_nation: {}, piece_type: {},
		score: { axis: 0, allies: 0 }, markers: {}, table: {}, hands: {},
		discard: {}, decks: {}, status_used: {}, log: [],
	}
	return g
}

let pid = 0
function put(g, nation, type, space) {
	const id = 'p' + (++pid)
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	return id
}

const S = I.STATUS_EFFECTS
const idOf = I.space_id_of

/* 直接调用 auto.run / score_per_unit 计分 */
function runAuto(g, cardId) {
	const cfg = S[cardId]
	if (!cfg || !cfg.auto) return null
	const a = cfg.auto
	if (a.kind === 'run') return a.run(g)
	if (a.kind === 'score_per_unit') {
		let n = 0
		for (const nm of (a.spaces || [])) {
			const sp = idOf(nm)
			if (sp == null) continue
			for (const p of Object.keys(g.location)) {
				if (g.location[p] !== sp) continue
				if (g.piece_nation[p] === a.nation && a.types.indexOf(g.piece_type[p]) >= 0) n++
			}
		}
		return n * (a.per || 1)
	}
	return null
}

console.log('=== 17739 巴尔干资源：<巴尔干>有意大利陆军 +1（布尔）===')
{
	const g = newGame()
	const balk = idOf('巴尔干')
	ok('巴尔干地区可解析', balk != null)
	ok('无意大利陆军时 0', runAuto(g, '17739') === 0)
	put(g, '意大利', 'army', balk)
	ok('有 1 支意大利陆军 +1', runAuto(g, '17739') === 1)
	put(g, '意大利', 'army', balk)
	ok('2 支仍只 +1（布尔，不累加）', runAuto(g, '17739') === 1)
	const g2 = newGame()
	put(g2, '德国', 'army', balk)
	ok('仅德国陆军时 0', runAuto(g2, '17739') === 0)
}

console.log('\n=== 17740 反共情绪：<乌克兰><罗斯>每有1支意大利陆军 +1 ===')
{
	const g = newGame()
	const uk = idOf('乌克兰'), ru = idOf('罗斯')
	ok('乌克兰/罗斯可解析', uk != null && ru != null)
	ok('空场 0', runAuto(g, '17740') === 0)
	put(g, '意大利', 'army', uk)
	ok('乌克兰 1 支 → 1', runAuto(g, '17740') === 1)
	put(g, '意大利', 'army', uk)
	put(g, '意大利', 'army', ru)
	ok('乌克兰2 + 罗斯1 → 3', runAuto(g, '17740') === 3)
	put(g, '德国', 'army', ru)
	ok('德国陆军不计入 → 仍 3', runAuto(g, '17740') === 3)
	put(g, '意大利', 'navy', uk)
	ok('海军不计入（只算 army）→ 仍 3', runAuto(g, '17740') === 3)
}

console.log('\n=== 17741 海王：场上每有1支意大利海军 +1（全场）===')
{
	const g = newGame()
	ok('空场 0', runAuto(g, '17741') === 0)
	put(g, '意大利', 'navy', idOf('地中海'))
	ok('1 支海军 → 1', runAuto(g, '17741') === 1)
	put(g, '意大利', 'navy', idOf('黑海'))
	put(g, '意大利', 'navy', idOf('拉丁美洲'))
	ok('3 支海军（跨不同地区）→ 3', runAuto(g, '17741') === 3)
	put(g, '德国', 'navy', idOf('地中海'))
	ok('德国海军不计入 → 仍 3', runAuto(g, '17741') === 3)
	put(g, '意大利', 'army', idOf('地中海'))
	ok('意大利陆军不计入 → 仍 3', runAuto(g, '17741') === 3)
}

console.log('\n=== 17743 尚未收复的意大利：<西欧>被轴心国控制 +1 ===')
{
	const g = newGame()
	const we = idOf('西欧')
	ok('西欧可解析', we != null)
	ok('空场 0', runAuto(g, '17743') === 0)
	put(g, '英国', 'army', we)
	ok('仅英国 → 0', runAuto(g, '17743') === 0)
	const g2 = newGame(); put(g2, '意大利', 'army', we)
	ok('意大利控制 → 1', runAuto(g2, '17743') === 1)
	const g3 = newGame(); put(g3, '德国', 'army', we)
	ok('德国（轴心）控制 → 1', runAuto(g3, '17743') === 1)
	const g4 = newGame(); put(g4, '日本', 'army', we)
	ok('日本（轴心）控制 → 1', runAuto(g4, '17743') === 1)
}

console.log('\n=== 17745 维希法国：<西欧>无人控制 +2；仅被德国控制 +1 ===')
{
	const g = newGame()
	const we = idOf('西欧')
	ok('无人控制 → 2', runAuto(g, '17745') === 2)
	put(g, '德国', 'army', we)
	ok('仅德国控制 → 1', runAuto(g, '17745') === 1)
	put(g, '德国', 'army', we)
	ok('德国多支部队仍 → 1', runAuto(g, '17745') === 1)
	const g2 = newGame(); put(g2, '意大利', 'army', we)
	ok('仅意大利控制 → 0（卡面要求德国）', runAuto(g2, '17745') === 0)
	const g3 = newGame(); put(g3, '德国', 'army', we); put(g3, '意大利', 'army', we)
	ok('德国+意大利混驻 → 0（非"仅"德国）', runAuto(g3, '17745') === 0)
	const g4 = newGame(); put(g4, '英国', 'army', we)
	ok('仅英国 → 0', runAuto(g4, '17745') === 0)
}

console.log('\n=== 17748 意大利殖民地帝国：<中东><非洲>每有1个地区被轴心国控制 +1 ===')
{
	const g = newGame()
	ok('空场 0', runAuto(g, '17748') === 0)
	const mid = idOf('中东'), na = idOf('非洲北部'), sa = idOf('非洲南部'), ea = idOf('非洲东部')
	ok('中东/非洲三段可解析', [mid, na, sa, ea].every(x => x != null))
	put(g, '意大利', 'army', mid)
	ok('中东被控 → 1', runAuto(g, '17748') === 1)
	put(g, '意大利', 'army', mid)
	ok('中东多支部队仍只 +1（按地区数）', runAuto(g, '17748') === 1)
	put(g, '德国', 'army', na)
	ok('+非洲北部 → 2', runAuto(g, '17748') === 2)
	put(g, '日本', 'army', sa)
	put(g, '意大利', 'army', ea)
	ok('+非洲南部+东部 → 4', runAuto(g, '17748') === 4)
	const g2 = newGame()
	put(g2, '英国', 'army', mid)
	put(g2, '英国', 'army', na)
	ok('全被同盟国控制 → 0', runAuto(g2, '17748') === 0)
}

/* ==================== Group 2/3/4 ==================== */
console.log('\n=== 17742 拉丁世界：补给点（永久）+ 放弃建设征召 ===')
{
	const cfg = S['17742']
	ok('17742 ongoing kind = supply_point_and_markers',
		cfg.ongoing && cfg.ongoing.kind === 'supply_point_and_markers')
	ok('17742 补给点地区 = 拉丁美洲', cfg.ongoing.space === '拉丁美洲')
	ok('17742 仅对意大利', cfg.ongoing.only === '意大利')
	ok('17742 卡面无标记 -> 不写 markers', !cfg.ongoing.markers)
	ok('17742 trigger window = build_army', cfg.trigger && cfg.trigger.window === 'build_army')
	ok('17742 代价 = forgo_build_army', cfg.trigger.cost && cfg.trigger.cost.forgo_build_army === true)
	ok('17742 效果 = 征召意大利陆军到拉丁美洲',
		cfg.trigger.effect && cfg.trigger.effect.kind === 'recruit' &&
		cfg.trigger.effect.nation === '意大利' && cfg.trigger.effect.type === 'army' &&
		cfg.trigger.effect.space === '拉丁美洲')
}

console.log('\n=== 17744 土耳其开放海峡：永久成对邻接 + 无敌方海军计分 ===')
{
	const cfg = S['17744']
	ok('17744 ongoing kind = pair_adjacency', cfg.ongoing && cfg.ongoing.kind === 'pair_adjacency')
	ok('17744 两对邻接', cfg.ongoing.pairs && cfg.ongoing.pairs.length === 2)
	ok('17744 仅对轴心', cfg.ongoing.only === 'axis')

	/* 成对邻接生效测试 */
	const g = newGame()
	const bs = idOf('黑海'), ms = idOf('地中海')
	ok('黑海/地中海可解析', bs != null && ms != null)
	const before = I.get_connections(g, bs, 'axis').indexOf(ms) >= 0
	/* 手动模拟 apply_status_ongoing 的 pair_adjacency 分支 */
	g.status_connections = [{ a: bs, b: ms, side: 'axis' }]
	const afterAxis = I.get_connections(g, bs, 'axis').indexOf(ms) >= 0
	const afterAllies = I.get_connections(g, bs, 'allies').indexOf(ms) >= 0
	ok('轴心国视角：黑海-地中海 相邻', afterAxis === true)
	ok('同盟国视角：不相邻（仅对友方）', afterAllies === (before ? before : false))
	ok('成对邻接对轴心生效（若原本不相邻则现在是新增边）', afterAxis)

	/* 计分：中东及相邻无敌方海军 -> 1 */
	const g2 = newGame()
	ok('17744 空场（无敌方海军）-> 1', runAuto(g2, '17744') === 1)
	const g3 = newGame()
	put(g3, '英国', 'navy', idOf('地中海'))
	/* 地中海需与中东相邻才影响；用中东本地放海军更直接 */
	const g4 = newGame()
	put(g4, '英国', 'navy', idOf('中东'))
	ok('17744 中东有敌方海军 -> 0', runAuto(g4, '17744') === 0)
}

console.log('\n=== 17747 西班牙控制直布罗陀：成对邻接 + 无敌方陆军计分 ===')
{
	const cfg = S['17747']
	ok('17747 ongoing kind = pair_adjacency', cfg.ongoing && cfg.ongoing.kind === 'pair_adjacency')
	const pairs = cfg.ongoing.pairs || []
	ok('17747 含 [北海,地中海]',
		pairs.some(p => p[0] === '北海' && p[1] === '地中海'))
	ok('17747 含 [非洲北部,西欧]',
		pairs.some(p => p[0] === '非洲北部' && p[1] === '西欧'))

	const g = newGame()
	ok('17747 空场（无敌方陆军）-> 1', runAuto(g, '17747') === 1)
	const na = idOf('非洲北部')
	put(g, '英国', 'army', na)
	ok('17747 非洲北部有敌方陆军 -> 0', runAuto(g, '17747') === 0)
	const g2 = newGame()
	put(g2, '意大利', 'army', na)
	ok('17747 仅意大利陆军（非敌方）-> 1', runAuto(g2, '17747') === 1)
}

console.log('\n=== 17746 耀武：跳过出牌 + 损耗2 -> 发起陆战 ===')
{
	const cfg = S['17746']
	ok('17746 window = play_start', cfg.trigger && cfg.trigger.window === 'play_start')
	ok('17746 cost.skip_play', cfg.trigger.cost && cfg.trigger.cost.skip_play === true)
	ok('17746 cost.attrition = 2', cfg.trigger.cost && cfg.trigger.cost.attrition === 2)
	ok('17746 effect = battle land',
		cfg.trigger.effect && cfg.trigger.effect.kind === 'battle' &&
		cfg.trigger.effect.battle === 'land')
}

console.log('\n=== 17749 轴心协定：敌方部队在大本营/相邻被攻击 -> +1（一回合一次）===')
{
	const fn = I.status_on_axis_pact
	ok('钩子 status_on_axis_pact 已导出', typeof fn === 'function')

	const g = newGame()
	const sovHb = I.effective_home_base ? I.effective_home_base(g, '苏联') : null
	ok('苏联大本营可解析', sovHb != null)

	/* 大本营上放苏联陆军，意大利发起攻击 */
	const sovId = put(g, '苏联', 'army', sovHb)
	g.table['意大利'] = ['17749#1']
	g.status_active_all = true
	fn(g, '意大利', sovHb, [sovId])
	ok('轴心攻击大本营上的敌方部队 -> axis +1', g.score.axis === 1)

	/* 同回合再攻击 -> 不再加分（一回合一次） */
	const sovId2 = put(g, '苏联', 'army', sovHb)
	fn(g, '意大利', sovHb, [sovId2])
	ok('一回合一次：同回合第二次不加分', g.score.axis === 1)

	/* 换回合 -> 可再加分 */
	g.turn = 2
	fn(g, '意大利', sovHb, [sovId2])
	ok('跨回合后可再次加分', g.score.axis === 2)

	/* 空打（无敌人）不加分 */
	const g2 = newGame()
	g2.table['意大利'] = ['17749#1']
	fn(g2, '意大利', sovHb, [])
	ok('空打（enemies 为空）不加分', g2.score.axis === 0)

	/* 同盟国攻击不加分 */
	const g3 = newGame()
	const s3 = put(g3, '苏联', 'army', sovHb)
	g3.table['意大利'] = ['17749#1']
	fn(g3, '英国', sovHb, [s3])
	ok('同盟国发起的攻击不加分', g3.score.axis === 0)

	/* 桌上没有 17749 时不加分 */
	const g4 = newGame()
	const s4 = put(g4, '苏联', 'army', sovHb)
	g4.table['意大利'] = []
	fn(g4, '意大利', sovHb, [s4])
	ok('桌上无 17749 时不加分', g4.score.axis === 0)
}

/* ==================== 补给点「仅对某国」语义 + 17742 端到端 ==================== */
console.log('\n=== 补给点「仅对某国」实现机制（15345/15347/17742/15443 同款）===')
{
	/* 机制：set_supply_point -> game.supply_override[space][阵营] = true
	 * is_supply_point 读 override[阵营]，未定义则【回落地图默认★】。
	 * 因此"仅对"成立的前提：该地区地图默认【不是】补给点（两侧都 false）。 */
	const cases = [
		['15345', '非洲南部', '法国', 'allies'],
		['15347', '东欧', '英国', 'allies'],
		['17742', '拉丁美洲', '意大利', 'axis'],
	]
	/* 【2026-10-08 玩家口径】补给点"仅对某国"必须是【国家】粒度：
	 * add_supply_point 传【国家名】 -> 写入 ov.nations，
	 * 同阵营他国（如意大利的德国/日本）【不得】享受。 */
	for (const [cardId, space, nation, fac] of cases) {
		const sp = idOf(space)
		const g = newGame()
		const baseA = I.is_supply_point(g, sp, 'axis')
		const baseL = I.is_supply_point(g, sp, 'allies')
		ok(cardId + ' <' + space + '> 地图默认非补给点（两侧 false）',
			baseA === false && baseL === false,
			'axis=' + baseA + ' allies=' + baseL)

		I.add_supply_point(g, sp, nation)   /* 传国家名，不是阵营 */
		ok(cardId + ' override 写入 ov.nations[' + nation + ']',
			g.supply_override[sp] && g.supply_override[sp].nations &&
			g.supply_override[sp].nations[nation] === true,
			JSON.stringify(g.supply_override[sp]))

		/* 目标国：是补给点 */
		ok(cardId + ' 仅对【' + nation + '】生效',
			I.is_supply_point(g, sp, fac, nation) === true)

		/* 同阵营他国：不是补给点（国家粒度的核心断言） */
		const others = fac === 'axis' ? ['德国', '日本'] : ['英国', '美国', '苏联']
		for (const o of others) {
			if (o === nation) continue
			ok(cardId + ' 同阵营他国【' + o + '】不享受（国家粒度）',
				I.is_supply_point(g, sp, I.faction_of_nation(o), o) === false)
		}
	}

	/* 回归：阵营维度的设置不受本次改造影响 */
	{
		const sp = idOf('东欧')
		const g = newGame()
		I.add_supply_point(g, sp, 'axis')
		ok('回归：阵营维度 add_supply_point(axis) 仍写 ov.axis',
			g.supply_override[sp].axis === true)
		ok('回归：阵营维度轴心国生效',
			I.is_supply_point(g, sp, 'axis', '德国') === true)
		ok('回归：阵营维度同盟国不生效',
			I.is_supply_point(g, sp, 'allies', '英国') === false)
	}

	/* 回归：无 override 时回落地图默认（大本营★） */
	{
		const g = newGame()
		const hb = I.effective_home_base ? I.effective_home_base(g, '意大利') : null
		ok('回归：无 override 回落地图默认（意大利大本营★ = true）',
			hb != null && I.is_supply_point(g, hb, 'axis', '意大利') === true)
	}

	/* 标记：已是国家维度（marker_applies_to 按 mk.owner 过滤） */
	{
		const sp = idOf('拉丁美洲')
		const g = newGame()
		I.add_marker(g, sp, 2, '意大利', 'axis')
		ok('标记 owner=意大利 -> 意大利计分',
			I.marker_applies_to(g.markers[sp][0], '意大利') === true)
		ok('标记 owner=意大利 -> 德国不计分（国家粒度）',
			I.marker_applies_to(g.markers[sp][0], '德国') === false)
	}
}

console.log('\n=== 17742 端到端：activate_status(from_status) 放弃建设 -> 拉丁美洲征召 ===')
{
	const g = newGame()
	const la = idOf('拉丁美洲')
	const itHb = I.effective_home_base ? I.effective_home_base(g, '意大利') : null
	/* 意大利大本营放 1 支陆军，让"建设陆军"有合法位置可被打断 */
	if (itHb != null) put(g, '意大利', 'army', itHb)
	g.table['意大利'] = ['17742#1']
	g.hands['意大利'] = ['BUILDARMY#1']
	g.inst_ok = true
	const before = Object.keys(g.location).filter(p =>
		g.piece_nation[p] === '意大利' && g.piece_type[p] === 'army').length
	/* 服务端：from_status 走"替换建设"分支，跳过窗口判定 */
	rules.action(g, 'Axis', 'activate_status',
		{ card: '17742#1', from_status: true, build_card: 'BUILDARMY#1' })
	const after = Object.keys(g.location).filter(p =>
		g.piece_nation[p] === '意大利' && g.piece_type[p] === 'army').length
	ok('拉丁美洲可解析', la != null)
	ok('发动后在<拉丁美洲>新增意大利陆军',
		g.location && Object.keys(g.location).some(p =>
			g.location[p] === la && g.piece_nation[p] === '意大利' &&
			g.piece_type[p] === 'army'),
		'before=' + before + ' after=' + after)
	ok('被放弃的《建设陆军》已打出（进弃牌堆）',
		(g.discard['意大利'] || []).indexOf('BUILDARMY#1') >= 0,
		JSON.stringify(g.discard['意大利'] || []))
}

console.log('\n' + (fails === 0 ? 'ALL PASS' : (fails + ' FAIL')))
process.exit(fails === 0 ? 0 : 1)
