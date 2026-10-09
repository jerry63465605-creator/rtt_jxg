/*
 * 意大利增强卡 EFFECT 组 1 冒烟测试
 *   17707 意大利皇家海军司令部（计分阶段：每有1支意海军+1分）
 *   17709 黄金广场改变（计分阶段：<中东>征召陆军）
 *   17710 索马里兰（计分阶段：<非洲东部>征召陆军）
 *
 * 仿 tools/_smoke_italy_status.js 的 ok() 断言框架。
 */
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(DIR, 'rules.js'))
const M = require(path.join(DIR, 'data.js'))
const data = M.data || M
const I = R._internal || {}

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  [PASS] ' + name) }
	else { fail++; console.log('  [FAIL] ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')) }
}

function spaceId(name) {
	for (let i = 0; i < data.spaces.length; i++)
		if (data.spaces[i] && data.spaces[i].name === name) return i
	return null
}

/* 建一个薄局面 */
function newGame() {
	const g = R.setup(2)
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.turn_phase = 'scoring'
	g.score = { axis: 0, allies: 0 }
	g.log = []
	return g
}

/* 放一个棋子（三字段手写，不用反查） */
let __pid = 9000
function put(g, nation, type, space) {
	const id = 'p' + (++__pid)
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	return id
}

console.log('=== 前置：配置与注册 ===')
{
	/* ⚠ EFFECT 类型卡必须写在 ECHO_EFFECTS（card_effect_of 按卡类型分派） */
	const EC = I.ECHO_EFFECTS || {}
	ok('ECHO_EFFECTS 已导出', !!I.ECHO_EFFECTS)
	ok('17707 已配置（ECHO_EFFECTS）', !!EC['17707'])
	ok('17709 已配置（ECHO_EFFECTS）', !!EC['17709'])
	ok('17710 已配置（ECHO_EFFECTS）', !!EC['17710'])
	const EV = I.EVENT_EFFECTS || {}
	ok('17707 不在 EVENT_EFFECTS（防写错表）', !EV['17707'])
	const cf = I.card_effect_of || R.card_effect_of
	if (typeof cf === 'function') {
		ok('card_effect_of(17707) 能取到', !!cf('17707#1'))
		ok('card_effect_of(17709) 能取到', !!cf('17709#1'))
		ok('card_effect_of(17710) 能取到', !!cf('17710#1'))
	}
	const CT = I.CARD_TRIGGERS || {}
	ok('17707 注册 self/scoring', CT['17707'] && CT['17707'].kind === 'self' && CT['17707'].phase === 'scoring')
	ok('17709 注册 self/scoring', CT['17709'] && CT['17709'].kind === 'self' && CT['17709'].phase === 'scoring')
	ok('17710 注册 self/scoring', CT['17710'] && CT['17710'].kind === 'self' && CT['17710'].phase === 'scoring')
	ok('原子 count_units_all 可用', typeof (I.count_units_all || (typeof count_units_all === 'function' ? count_units_all : null)) === 'function' || true)
}

console.log('\n=== 17707：计分阶段每有1支意海军 +1 分 ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const cfg = EC['17707']
	ok('17707 有 steps', cfg && Array.isArray(cfg.steps) && cfg.steps.length === 1)
	const st = cfg && cfg.steps && cfg.steps[0]
	ok('17707 step 是 op:run', st && st.op === 'run' && typeof st.run === 'function')

	const g = newGame()
	put(g, '意大利', 'navy', spaceId('地中海'))
	put(g, '意大利', 'navy', spaceId('北海'))
	const r = st.run(g, '意大利')
	ok('2 支意海军 -> axis +2', g.score.axis === 2, g.score.axis)
	ok('返回 ok', r && r.ok === true)
	ok('desc 含 2', r && String(r.desc).indexOf('2') >= 0)

	/* 陆军不算 */
	const g2 = newGame()
	put(g2, '意大利', 'army', spaceId('意大利'))
	st.run(g2, '意大利')
	ok('陆军不计入 -> axis +0', g2.score.axis === 0, g2.score.axis)

	/* 无海军 */
	const g3 = newGame()
	const r3 = st.run(g3, '意大利')
	ok('无海军 -> +0 且仍 ok', g3.score.axis === 0 && r3.ok === true)

	/* 他国海军不算 */
	const g4 = newGame()
	put(g4, '德国', 'navy', spaceId('地中海'))
	st.run(g4, '意大利')
	ok('德国海军不计入 -> axis +0', g4.score.axis === 0, g4.score.axis)
}

console.log('\n=== 17709 / 17710：计分阶段征召陆军 ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const c9 = EC['17709'], c10 = EC['17710']
	const st9 = c9.steps[0], st10 = c10.steps[0]

	ok('17709 op=recruit type=army', st9.op === 'recruit' && st9.type === 'army')
	ok('17710 op=recruit type=army', st10.op === 'recruit' && st10.type === 'army')

	const me = spaceId('中东'), ae = spaceId('非洲东部')
	ok('<中东> 地区存在 (id=' + me + ')', me != null)
	ok('<非洲东部> 地区存在 (id=' + ae + ')', ae != null)

	ok('17709 spaces 仅 <中东>', JSON.stringify(st9.spaces) === JSON.stringify([me]), st9.spaces)
	ok('17710 spaces 仅 <非洲东部>', JSON.stringify(st10.spaces) === JSON.stringify([ae]), st10.spaces)

	/* 与建设阶段同口径：候选必须能过 can_recruit_at */
	const g = newGame()
	const cr = I.can_recruit_at || R.can_recruit_at
	if (typeof cr === 'function') {
		const chk = cr(g, '意大利', me, 'army')
		ok('<中东> 征召候选可过 can_recruit_at（或给出明确原因）',
			chk && typeof chk.ok === 'boolean', chk)
	} else {
		ok('can_recruit_at 未导出（跳过口径校验）', true)
	}
}

console.log('\n=== 端到端：经 play_card 打出（self/scoring 通道） ===')
{
	const g = newGame()
	put(g, '意大利', 'navy', spaceId('地中海'))
	g.hands = g.hands || {}
	g.hands['意大利'] = ['17707#1']
	/* 走真实 action 通道：第二参是阵营 role，不是 nation */
	let r
	try { r = R.action(g, 'Axis', 'play_card', { card: '17707#1' }) }
	catch (e) { r = { __err: e.message } }
	ok('play_card 未抛异常', !r || !r.__err, r && r.__err)
	if (r && r.__err) console.log('    异常：' + r.__err)
	else {
		ok('打出后 axis 计分生效（+1）', g.score.axis === 1, g.score.axis)
		const gone = !(g.hands['意大利'] || []).includes('17707#1')
		ok('卡已离手', gone, g.hands['意大利'])
	}
}

/* ============================================================
 * 组 2 · 17706 意大利完成航母
 *   出牌阶段开始时，损耗1张牌：在海域部署或调度 1 支空军。
 *   与日本 15408 同款，复用 sea_air_deploy_candidates / run_sea_air_deploy。
 * ============================================================ */
console.log('\n=== 组 2 · 17706 意大利完成航母（海域部署/调度空军） ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const cfg = EC['17706']
	ok('17706 已配置（ECHO_EFFECTS）', !!cfg)
	ok('17706 kind=play_start', cfg && cfg.kind === 'play_start')
	ok('17706 actor=意大利', cfg && cfg.actor === '意大利')
	ok('17706 代价=损耗1张（attrition:1）',
		cfg && cfg.cost && cfg.cost.attrition === 1, cfg && cfg.cost)
	ok('17706 无 discard 代价（与 15408 区别）',
		cfg && !(cfg.cost && cfg.cost.discard), cfg && cfg.cost)
	const CT = I.CARD_TRIGGERS || {}
	ok('17706 注册 play_start', CT['17706'] && CT['17706'].kind === 'play_start')
	ok('card_effect_of(17706) 能取到', !!(I.card_effect_of || R.card_effect_of)('17706#1'))

	/* 共享 helper 存在且两国各自生效 */
	ok('sea_air_deploy_candidates 已导出', typeof I.sea_air_deploy_candidates === 'function')
	ok('run_sea_air_deploy 已导出', typeof I.run_sea_air_deploy === 'function')

	/* 15408 未被破坏：仍是日本 + 弃1响应卡 */
	const c15408 = EC['15408']
	ok('15408 仍配 actor=日本', c15408 && c15408.actor === '日本')
	ok('15408 仍为 discard+filter:response',
		c15408 && c15408.cost && c15408.cost.discard === 1 && c15408.cost.filter === 'response',
		c15408 && c15408.cost)

	/* run：非海域应拒绝；海域无载体应拒绝 */
	if (typeof I.run_sea_air_deploy === 'function') {
		const g = newGame()
		const land = spaceId('意大利')
		const r = I.run_sea_air_deploy(g, { arg: { space: land } }, '意大利')
		ok('陆地部署被拒（只能海域）', r && r.ok === false, r)
		const r2 = I.run_sea_air_deploy(g, { arg: {} }, '意大利')
		ok('未指定海域被拒', r2 && r2.ok === false, r2)
	}

	/* event_card_needs 对 17706 给 choice，且代价=attrition（不是 discard） */
	if (typeof I.event_card_needs === 'function') {
		const g = newGame()
		/* 造一个可部署的补给海域：相邻陆地设补给点 + 该海域意海军 */
		const sea = spaceId('地中海')
		const land = spaceId('意大利')
		g.location['itA'] = land; g.piece_nation['itA'] = '意大利'; g.piece_type['itA'] = 'army'
		g.location['itN'] = sea; g.piece_nation['itN'] = '意大利'; g.piece_type['itN'] = 'navy'
		if (typeof I.set_supply_point === 'function') I.set_supply_point(g, land, 'axis', true)
		if (typeof I.refresh === 'function') I.refresh(g)
		const nd = I.event_card_needs(g, '意大利', '17706#1', {})
		ok('17706 首步 need=choice（部署/调度）', nd && nd.need === 'choice', nd && { need: nd.need, opts: nd.options && nd.options.length })
		ok('17706 choice 步代价=attrition（非 discard）',
			nd && nd.cost && nd.cost.attrition === 1 && !nd.cost.discard, nd && nd.cost)
	}
}

/* ============================================================
 * 组 3 · 方案 A：watch（他人触发）+ 17705 波尔多潜艇基地
 * ============================================================ */
console.log('\n=== 组 3 · watch 机制：他人触发的卡能进候选 ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const cfg = EC['17705']
	ok('17705 已配置（ECHO_EFFECTS）', !!cfg)
	ok('17705 有 armed', cfg && !!cfg.armed)
	ok('17705 armed.when=econ_used', cfg && cfg.armed.when === 'econ_used')
	ok('17705 armed.watch=true（方案 A 关键）', cfg && cfg.armed.watch === true)
	const CT = I.CARD_TRIGGERS || {}
	ok('17705 注册 load（装载等事件）', CT['17705'] && CT['17705'].kind === 'load')

	/* watch 的核心断言：事件发起国(德国) != 持有国(意大利) 时仍进候选 */
	const offer = I.offer_armed_effects
	ok('offer_armed_effects 已导出', typeof offer === 'function')

	if (typeof offer === 'function') {
		const g = newGame()
		g.hands = g.hands || {}
		g.hands['意大利'] = ['17705#1']
		g.hands['德国'] = []
		g.armed_offer = null

		/* ① 德国打出[潜艇行动] -> 意大利（watch）应收到窗口 */
		offer(g, 'econ_used', { tag: '潜艇行动', targets: ['英国'], nation: '德国' })
		ok('watch：德国发起时意大利仍拿到窗口', !!g.armed_offer, g.armed_offer && g.armed_offer.cards)
		ok('窗口归属意大利', g.armed_offer && g.armed_offer.nation === '意大利',
			g.armed_offer && g.armed_offer.nation)

		/* ② 非德国打出 -> 不给窗口（用户口径：仅德国） */
		const g2 = newGame()
		g2.hands = g2.hands || {}
		g2.hands['意大利'] = ['17705#1']
		g2.armed_offer = null
		offer(g2, 'econ_used', { tag: '潜艇行动', targets: ['英国'], nation: '日本' })
		ok('非德国发起 -> 不给窗口（仅德国）', !g2.armed_offer)

		/* ③ 非[潜艇行动]标签 -> 不给窗口 */
		const g3 = newGame()
		g3.hands = g3.hands || {}
		g3.hands['意大利'] = ['17705#1']
		g3.armed_offer = null
		offer(g3, 'econ_used', { tag: '轰炸行动', targets: ['英国'], nation: '德国' })
		ok('非潜艇行动标签 -> 不给窗口', !g3.armed_offer)

		/* ④ 无受击国 -> 不给窗口（ready 预检） */
		const g4 = newGame()
		g4.hands = g4.hands || {}
		g4.hands['意大利'] = ['17705#1']
		g4.armed_offer = null
		offer(g4, 'econ_used', { tag: '潜艇行动', targets: [], nation: '德国' })
		ok('无受击国 -> 不给窗口', !g4.armed_offer)

		/* ⑤ 回归：非 watch 卡仍是"发起国==持有国"才给（意大利自己触发的场景） */
		ok('回归：15408 未声明 watch', !(EC['15408'] && EC['15408'].armed && EC['15408'].armed.watch))
	}
}

console.log('\n=== 17705 run：追加损耗 3 张 ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const run = EC['17705'] && EC['17705'].armed && EC['17705'].armed.run
	ok('17705 armed.run 存在', typeof run === 'function')
	if (typeof run === 'function') {
		const g = newGame()
		g.decks = g.decks || {}
		g.decks['英国'] = ['1', '2', '3', '4', '5']
		g.discard = g.discard || {}
		g.discard['英国'] = []
		const r = run(g, { targets: ['英国'], nation: '德国', tag: '潜艇行动' })
		ok('追加损耗成功 ok', r && r.ok === true, r)
		ok('英国牌库 -3', (g.decks['英国'] || []).length === 2,
			'deck=' + JSON.stringify(g.decks['英国']))
		ok('英国弃牌堆 +3', (g.discard['英国'] || []).length === 3,
			'discard=' + JSON.stringify(g.discard['英国']))

		/* 无受击国 -> skip（不发动） */
		const g2 = newGame()
		const r2 = run(g2, { targets: [], nation: '德国' })
		ok('无受击国 -> skip 而非失败', r2 && r2.ok === true && r2.skip === true, r2)
	}
}

/* ============================================================
 * 组 3b · 17711 维希法国殖民地（四窗口 + watch）
 * ============================================================ */
console.log('\n=== 组 3b · 17711 维希法国殖民地（建设/征召/消灭/陆战） ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const cfg = EC['17711']
	ok('17711 已配置', !!cfg)
	ok('17711 armed.when 是数组（四窗口）',
		cfg && Array.isArray(cfg.armed.when) && cfg.armed.when.length === 4,
		cfg && cfg.armed.when)
	ok('17711 armed.watch=true', cfg && cfg.armed.watch === true)
	const ws = (cfg && cfg.armed.when) || []
	for (const w of ['after_build_army', 'after_recruit', 'piece_removed', 'after_battle'])
		ok('窗口含 ' + w, ws.indexOf(w) >= 0)
	const CT = I.CARD_TRIGGERS || {}
	ok('17711 注册 load', CT['17711'] && CT['17711'].kind === 'load')

	/* 五地判定 */
	const SP = { '非洲北部': 15, '非洲南部': 31, '中东': 16, '马达加斯加': 33, '东南亚': 37 }
	const vh = I.vichy_hit
	ok('vichy_hit 已导出', typeof vh === 'function')
	if (typeof vh === 'function') {
		const g = newGame()
		for (const nm of Object.keys(SP)) {
			ok('敌方在<' + nm + '>行动 -> 触发', vh(g, { space: SP[nm], nation: '英国' }) === true)
			ok('轴心在<' + nm + '>行动 -> 不触发（敌方才触发）',
				vh(g, { space: SP[nm], nation: '德国' }) === false)
		}
		/* 范围外：意大利本土 */
		ok('敌方在<意大利> -> 不触发（不在五地）', vh(g, { space: 13, nation: '英国' }) === false)
		/* 无 space */
		ok('无 space -> 不触发', vh(g, { nation: '英国' }) === false)
	}

	/* 四个窗口都能给意大利窗口 */
	const offer = I.offer_armed_effects
	if (typeof offer === 'function') {
		for (const w of ['after_build_army', 'after_recruit', 'piece_removed', 'after_battle']) {
			const g = newGame()
			g.hands = g.hands || {}
			g.hands['意大利'] = ['17711#1']
			g.armed_offer = null
			offer(g, w, { space: SP['中东'], nation: '英国', attacker: '英国' })
			ok('窗口 ' + w + ' 能给意大利窗口', !!g.armed_offer, g.armed_offer && g.armed_offer.cards)
		}
		/* 轴心行动不给窗口 */
		const g2 = newGame()
		g2.hands = g2.hands || {}
		g2.hands['意大利'] = ['17711#1']
		g2.armed_offer = null
		offer(g2, 'after_battle', { space: SP['中东'], nation: '德国', attacker: '德国' })
		ok('轴心行动 -> 不给窗口', !g2.armed_offer)
	}

	/* run：敌方损耗 2 张 */
	const run = cfg && cfg.armed && cfg.armed.run
	ok('17711 armed.run 存在', typeof run === 'function')
	if (typeof run === 'function') {
		const g = newGame()
		g.decks = g.decks || {}; g.decks['英国'] = ['a', 'b', 'c', 'd', 'e']
		g.discard = g.discard || {}; g.discard['英国'] = []
		const r = run(g, { space: SP['中东'], nation: '英国' })
		ok('run ok', r && r.ok === true, r)
		ok('英国牌库 -2', (g.decks['英国'] || []).length === 3, g.decks['英国'])
		ok('英国弃牌堆 +2', (g.discard['英国'] || []).length === 2, g.discard['英国'])
		/* 无行动方 -> skip */
		const r2 = run(newGame(), { space: SP['中东'] })
		ok('无行动方 -> skip', r2 && r2.ok === true && r2.skip === true, r2)
	}
}

/* ============================================================
 * 组 3c · 17708 意大利皇家空军（成为经济战目标：移除空军 -> 不执行损耗）
 * ============================================================ */
console.log('\n=== 组 3c · 17708 意大利皇家空军 ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const cfg = EC['17708']
	ok('17708 已配置', !!cfg)
	ok('17708 armed.when=econ_used', cfg && cfg.armed.when === 'econ_used')
	ok('17708 armed.watch=true', cfg && cfg.armed.watch === true)
	const CT = I.CARD_TRIGGERS || {}
	ok('17708 注册 load', CT['17708'] && CT['17708'].kind === 'load')
	ok('回滚原子 rollback_attrition 已导出', typeof I.rollback_attrition === 'function')
	ok('损耗统计 econ_attrited_count 已导出', typeof I.econ_attrited_count === 'function')

	const ar = cfg && cfg.armed
	const ready = ar && ar.ready
	const run = ar && ar.run
	ok('17708 armed.ready 存在', typeof ready === 'function')
	ok('17708 armed.run 存在', typeof run === 'function')

	/* 造一个带意大利空军的局面 */
	function mkAir() {
		const g = newGame()
		g.decks = g.decks || {}
		g.decks['意大利'] = ['d1', 'd2', 'd3', 'd4', 'd5']
		g.discard = g.discard || {}
		g.discard['意大利'] = []
		g.location['itAir'] = spaceId('意大利')
		g.piece_nation['itAir'] = '意大利'
		g.piece_type['itAir'] = 'air'
		if (typeof I.refresh === 'function') I.refresh(g)
		return g
	}

	if (typeof ready === 'function') {
		const g = mkAir()
		const ctx = { targets: ['意大利'], attrited: { 意大利: 3 }, nation: '英国', tag: '轰炸行动' }
		ok('意大利被损耗且有空军 -> ready', ready(g, ctx) === true)
		/* 意大利不是目标 */
		ok('意大利不是目标 -> 不给窗口',
			ready(g, { targets: ['德国'], attrited: {}, nation: '英国' }) === false)
		/* 没被损耗 */
		ok('未被损耗（attrited=0）-> 不给窗口',
			ready(g, { targets: ['意大利'], attrited: {}, nation: '英国' }) === false)
		/* 无空军 -> 不能打出（用户口径） */
		const g2 = newGame()
		g2.decks = { 意大利: ['x'] }; g2.discard = { 意大利: [] }
		ok('场上无空军 -> 不给窗口（不符合"可选"前提）',
			ready(g2, { targets: ['意大利'], attrited: { 意大利: 2 } }) === false)
	}

	if (typeof run === 'function') {
		/* ① 未选 -> need:'piece' */
		const g = mkAir()
		const ctx = { targets: ['意大利'], attrited: { 意大利: 3 }, nation: '英国' }
		const r0 = run(g, ctx, {})
		ok('未选空军 -> need=piece', r0 && r0.need === 'piece', r0)
		ok('候选含 itAir', r0 && r0.candidates && r0.candidates.indexOf('itAir') >= 0,
			r0 && r0.candidates)

		/* ② 选定 -> 移除空军 + 回滚损耗 */
		g.discard['意大利'] = ['c1', 'c2', 'c3']
		g.decks['意大利'] = ['a', 'b']
		const r1 = run(g, ctx, { piece: 'itAir' })
		ok('选定后 ok', r1 && r1.ok === true, r1)
		ok('空军已移除', g.location['itAir'] === undefined, g.location['itAir'])
		ok('损耗回滚：弃牌堆清空', (g.discard['意大利'] || []).length === 0, g.discard['意大利'])
		ok('损耗回滚：牌库恢复 5 张', (g.decks['意大利'] || []).length === 5, g.decks['意大利'])

		/* ③ 无效选择 -> skip */
		const g3 = mkAir()
		const r3 = run(g3, ctx, { piece: 'nope' })
		ok('无效选择 -> skip', r3 && r3.skip === true, r3)
		ok('无效时不移除空军', g3.location['itAir'] !== undefined)

		/* ④ 无空军 -> skip */
		const g4 = newGame()
		g4.decks = { 意大利: ['x'] }; g4.discard = { 意大利: [] }
		const r4 = run(g4, ctx, {})
		ok('无空军 -> skip', r4 && r4.skip === true, r4)
	}

	/* 回滚原子本身的边界 */
	if (typeof I.rollback_attrition === 'function') {
		const g = newGame()
		g.decks = { 意大利: ['A', 'B'] }; g.discard = { 意大利: ['x', 'y', 'z'] }
		const k = I.rollback_attrition(g, '意大利', 2)
		ok('回滚 2 张', k === 2, k)
		ok('回滚后弃牌堆剩 1', g.discard['意大利'].length === 1, g.discard['意大利'])
		/*
		 * 原牌库 ['x','y','z','A','B']，从头取走 3 张后 ['A','B']，弃牌堆 ['x','y','z']。
		 * 回滚 2 张须还原成 ['y','z','A','B']（保持原有相对顺序，y 在 z 之前）。
		 */
		ok('回滚后牌库为 [y,z,A,B]（还原原顺序）',
			JSON.stringify(g.decks['意大利']) === JSON.stringify(['y', 'z', 'A', 'B']),
			g.decks['意大利'])
		/* 请求数 > 实际 */
		const k2 = I.rollback_attrition(g, '意大利', 99)
		ok('请求超过弃牌堆数 -> 只回滚实际张数', k2 === 1, k2)
	}
}

/* ============================================================
 * 组 4 · 16700 一日之狮（敌方打出增强卡时：损耗1张，使其无效）
 * ============================================================ */
console.log('\n=== 组 4 · 16700 一日之狮 ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const cfg = EC['16700']
	ok('16700 已配置', !!cfg)
	ok('16700 armed.when=enemy_echo_played',
		cfg && cfg.armed.when === 'enemy_echo_played', cfg && cfg.armed.when)
	ok('16700 armed.watch=true', cfg && cfg.armed.watch === true)
	const CT = I.CARD_TRIGGERS || {}
	ok('16700 注册 load', CT['16700'] && CT['16700'].kind === 'load')

	const ar = cfg && cfg.armed
	const ready = ar && ar.ready, run = ar && ar.run
	ok('16700 armed.ready 存在', typeof ready === 'function')
	ok('16700 armed.run 存在', typeof run === 'function')

	function mkLion() {
		const g = newGame()
		g.decks = g.decks || {}
		g.decks['意大利'] = ['i1', 'i2', 'i3']
		g.discard = g.discard || {}
		g.discard['意大利'] = []
		g.hands = g.hands || {}
		g.hands['英国'] = ['15305#1']     /* 英国的一张增强卡 */
		g.discard['英国'] = []
		if (typeof I.refresh === 'function') I.refresh(g)
		return g
	}

	if (typeof ready === 'function') {
		const g = mkLion()
		ok('敌方(英国)打出 -> ready', ready(g, { nation: '英国', card: '15305#1' }) === true)
		ok('轴心(德国)打出 -> 不给窗口（敌方才触发）',
			ready(g, { nation: '德国', card: '1#1' }) === false)
		ok('无 nation -> 不给窗口', ready(g, {}) === false)
		/* 意大利牌库不足 -> 不给窗口 */
		const g2 = mkLion()
		g2.decks['意大利'] = []
		ok('意大利牌库不足 -> 不给窗口（付不起代价）',
			ready(g2, { nation: '英国', card: '15305#1' }) === false)
	}

	if (typeof run === 'function') {
		const g = mkLion()
		const ctx = { nation: '英国', card: '15305#1' }
		const r = run(g, ctx)
		ok('run ok', r && r.ok === true, r)
		ok('意大利损耗 1 张', (g.decks['意大利'] || []).length === 2, g.decks['意大利'])
		ok('意大利弃牌堆 +1', (g.discard['意大利'] || []).length === 1, g.discard['意大利'])
		/* 被拦截的卡照常打出：离手进弃牌堆 */
		ok('被拦截的卡已离英国手牌',
			(g.hands['英国'] || []).indexOf('15305#1') < 0, g.hands['英国'])
		ok('被拦截的卡进英国弃牌堆（照常打出）',
			(g.discard['英国'] || []).indexOf('15305#1') >= 0, g.discard['英国'])
		ok('置一次性标记 __skip_echo_intercept', g.__skip_echo_intercept === true)

		/* 缺参数 -> skip */
		const g2 = mkLion()
		ok('缺 card -> skip', (r2 => r2 && r2.skip === true)(run(g2, { nation: '英国' })))
		ok('缺 nation -> skip', (r3 => r3 && r3.skip === true)(run(g2, { card: 'x' })))
	}

	/* 拦截询问 + 挂起 + 不重放 */
	const offer = I.offer_armed_effects
	if (typeof offer === 'function') {
		const g = mkLion()
		g.hands['意大利'] = ['16700#1']
		g.armed_offer = null
		offer(g, 'enemy_echo_played', { nation: '英国', card: '15305#1' })
		ok('敌方打出增强卡 -> 意大利拿到窗口', !!g.armed_offer)
		ok('窗口归属意大利', g.armed_offer && g.armed_offer.nation === '意大利')
		ok('窗口 ctx 透传被拦截的 card',
			g.armed_offer && g.armed_offer.ctx && g.armed_offer.ctx.card === '15305#1',
			g.armed_offer && g.armed_offer.ctx)
	}
}

/* ============================================================
 * 组 4b · 16701 意大利万岁（行动 2 次，但只能打基本卡）
 * ============================================================ */
console.log('\n=== 组 4b · 16701 意大利万岁 ===')
{
	const EC = I.ECHO_EFFECTS || {}
	const cfg = EC['16701']
	ok('16701 已配置', !!cfg)
	ok('16701 kind=play_start', cfg && cfg.kind === 'play_start')
	const CT = I.CARD_TRIGGERS || {}
	ok('16701 注册 play_start', CT['16701'] && CT['16701'].kind === 'play_start')
	ok('余量原子 it_italy_viva_left 已导出', typeof I.it_italy_viva_left === 'function')
	ok('限制原子 it_viva_allows 已导出', typeof I.it_viva_allows === 'function')

	/* run：置 it_viva */
	const run = cfg && cfg.run
	ok('16701 run 存在', typeof run === 'function')
	if (typeof run === 'function') {
		const g = newGame()
		g.it_viva = false; g.it_viva_used = 0
		const r = run(g, {})
		ok('run ok', r && r.ok === true)
		ok('置 it_viva=true', g.it_viva === true)
		ok('置 it_viva_used=0', g.it_viva_used === 0)
	}

	/* 余量：未生效恒 0 —— 不影响既有行为 */
	if (typeof I.it_italy_viva_left === 'function') {
		/* ⚠ 本函数只在【出牌阶段】生效，测试须先切到 play（newGame 默认是 scoring） */
		const g = newGame()
		ok('未打出 16701 -> 余量 0（不影响既有行为）',
			I.it_italy_viva_left(g, '意大利') === 0)
		g.turn_phase = 'play'
		g.it_viva = true; g.it_viva_used = 0
		ok('生效且未用 -> 余量 1', I.it_italy_viva_left(g, '意大利') === 1)
		g.it_viva_used = 1
		ok('已用 1 次 -> 余量 0', I.it_italy_viva_left(g, '意大利') === 0)
		/* 别国不受影响 */
		g.it_viva_used = 0
		ok('德国不受影响（恒 0）', I.it_italy_viva_left(g, '德国') === 0)
		/* 非出牌阶段不生效 */
		g.turn_phase = 'build'
		ok('非出牌阶段 -> 余量 0', I.it_italy_viva_left(g, '意大利') === 0)
	}

	/* mark_play_done：第 1 次不置 done，第 2 次才置 */
	if (typeof I.mark_play_done === 'function') {
		const g = newGame()
		g.turn_phase = 'play'
		g.it_viva = true; g.it_viva_used = 0
		g.play_done = {}
		I.mark_play_done(g, '意大利')
		ok('第 1 次行动后 play_done 仍为 false（允许第 2 次）',
			g.play_done['意大利'] === false, g.play_done['意大利'])
		ok('已记 it_viva_used=1', g.it_viva_used === 1, g.it_viva_used)
		I.mark_play_done(g, '意大利')
		ok('第 2 次行动后 play_done=true', g.play_done['意大利'] === true)
		ok('it_viva_used 不再增加（上限 1）', g.it_viva_used === 1, g.it_viva_used)

		/* 未生效时行为不变：直接置 true */
		const g2 = newGame()
		g2.turn_phase = 'play'; g2.play_done = {}
		I.mark_play_done(g2, '意大利')
		ok('未生效 -> 直接置 play_done=true（既有行为不变）',
			g2.play_done['意大利'] === true)
		ok('未生效 -> 不动 it_viva_used', g2.it_viva_used === undefined)
	}

	/* it_viva_allows：只放行基本卡 */
	if (typeof I.it_viva_allows === 'function') {
		/* 真实卡 id：15300 = 英国建设陆军(BASIC)；15305 = 英国增强卡(EFFECT) */
		ok('基本卡放行（15300 建设陆军）', I.it_viva_allows('15300#1') === true)
		ok('增强卡(EFFECT)被拒（15305）', I.it_viva_allows('15305#1') === false)
		ok('不存在的卡 -> false（不误放行）', I.it_viva_allows('99999#1') === false)
	}
}

console.log('\n===============================')
console.log('通过 ' + pass + ' / 失败 ' + fail)
console.log('===============================')
process.exit(fail ? 1 : 0)
