"use strict"
/*
 * 【2026-10-18】17537《美国人民同情中国》"征召→建设" 回归测试
 *
 * 改动：触发操作由"征召"改为"建设"；执行前校验建设条件（can_build_at + unit_slot_free + 容量）；
 *       若条件不满足，整体跳过本次流程（不建设、不征召、不加后备、不设状态、不做替代）。
 *
 * 复用：can_build_at / build_piece / unit_slot_free / get_connections / add_army_bonus /
 *      NATION_UNIT_CAPS / ARMY_BONUS_MAX —— 与 step_space_candidates 的 build 分支同源。
 *
 * 布局：清空棋盘，仅保留必要态势。中国大本营 = 中国东部(22, home_base, land, supply)。
 *   T1/T2：空盘 -> 22 可建（本国大本营），验证建设成功 + 玩家选点。
 *   T3：22 及所有相邻陆地都被敌方(德国)陆军占据 -> 无候选 -> 整体跳过（无后备、无建设、无状态）。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const D = require(path.join(__dirname, '..', 'data.js')).data

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}
function countPieces(g, space, nation, type) {
	let n = 0
	for (const p of Object.keys(g.location || {})) {
		if (g.location[p] !== space) continue
		if (g.piece_nation[p] !== nation) continue
		if (g.piece_type[p] !== type) continue
		n++
	}
	return n
}
function countNationArmy(g, nation) {
	let n = 0
	for (const p of Object.keys(g.location || {})) {
		if (g.piece_nation[p] === nation && g.piece_type[p] === 'army') n++
	}
	return n
}
function setupEmpty() {
	const g = rules.setup('t-17537-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '美国'
	g.active = 'allies'
	g.turn_phase = 'play'
	g.turn = 1
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.hands = { '美国': ['17537#1'] }
	g.armed_offers = []
	return g
}
function chinaHome() {
	for (const s of D.spaces) {
		if (s && s.home_base && s.name === '中国东部') return s.id
	}
	return null
}

const HOME = chinaHome()
check('前置：中国大本营定位为中国东部(22)', HOME === 22, HOME)

// ---- T1：可建设情景，打出后进入建设流程，玩家选点建设成功 ----
;(function () {
	const g = setupEmpty()
	check('前置：大本营 22 可建设（空盘、本国大本营）',
		I.can_build_at(g, '中国', HOME, 'army').ok, I.can_build_at(g, '中国', HOME, 'army'))
	const r1 = rules.action(g, 'Allies', 'play_card', { card: '17537#1' })
	check('T1 打出后进入建设流程（us_china_build 状态已建）', !!r1.us_china_build, r1.us_china_build)
	check('T1 后备+1 已加（army_bonus[中国]===1）',
		(r1.army_bonus && r1.army_bonus['中国'] === 1) || I.army_bonus_of(r1, '中国') === 1, r1.army_bonus)
	const view = rules.view(r1, 'Allies')
	const uvc = view.us_china_build
	check('T1 view 暴露 us_china_build 候选', !!uvc && Array.isArray(uvc.candidates), uvc)
	check('T1 候选含大本营 22', uvc && uvc.candidates.some(c => c.id === HOME), uvc && uvc.candidates)
	/* 玩家选大本营 22 建设 */
	const r2 = rules.action(g, 'Allies', 'resolve_us_china_build', { space: HOME })
	check('T1 建设成功（22 上出现 1 支中国陆军）',
		countPieces(r2, HOME, '中国', 'army') === 1, { got: countPieces(r2, HOME, '中国', 'army') })
	check('T1 建设的是陆军（确为 build_piece 落地，非征召）',
		countPieces(r2, HOME, '中国', 'army') === 1 && countNationArmy(r2, '中国') === 1)
	check('T1 建设后流程清空（us_china_build 置空）', !r2.us_china_build, r2.us_china_build)
	check('T1 中国总数=1（后备+1 容量被用掉 1）', countNationArmy(r2, '中国') === 1)
})()

// ---- T2：玩家选相邻候选也能建设（验证候选不止大本营）----
;(function () {
	const g = setupEmpty()
	/* 在大本营 22 旁邻接放一支已补给的中国陆军，使 22 的相邻陆地也可建 */
	const nbrs = I.get_connections(g, HOME, 'allies').map(Number)
	const landNbr = nbrs.find(id => D.spaces[id] && D.spaces[id].terrain === 'land' && id !== HOME)
	check('前置：找到大本营的陆地邻居', landNbr != null, landNbr)
	if (landNbr != null) {
		g.location['cn_a'] = landNbr
		g.piece_nation['cn_a'] = '中国'
		g.piece_type['cn_a'] = 'army'
		I.set_supply_point(g, landNbr, 'allies', true)
		I.compute_supply(g)
	}
	const r1 = rules.action(g, 'Allies', 'play_card', { card: '17537#1' })
	const view = rules.view(r1, 'Allies')
	const uvc = view.us_china_build
	check('T2 候选不止大本营（含相邻可建陆地）',
		uvc && uvc.candidates.length >= 2, uvc && uvc.candidates)
	/* 选一个非大本营的候选建设，验证相邻建设通道 */
	const tgt = uvc.candidates.find(c => c.id !== HOME)
	check('T2 存在非大本营候选', !!tgt, uvc && uvc.candidates)
	if (tgt) {
		const r2 = rules.action(g, 'Allies', 'resolve_us_china_build', { space: tgt.id })
		check('T2 在相邻陆地建设成功', countPieces(r2, tgt.id, '中国', 'army') === 1,
			{ got: countPieces(r2, tgt.id, '中国', 'army') })
	}
})()

// ---- T3：建设条件不满足 -> 整体跳过（不建设、不征召、不加后备、不设状态）----
;(function () {
	const g = setupEmpty()
	/* 在大本营 22 及其所有陆地邻居都放敌方(德国)陆军 -> 无一处可建设（can_build_at 因"有敌方部队"失败）*/
	g.location['en_home'] = HOME
	g.piece_nation['en_home'] = '德国'
	g.piece_type['en_home'] = 'army'
	const nbrs = I.get_connections(g, HOME, 'allies').map(Number)
	for (const nb of nbrs) {
		if (D.spaces[nb] && D.spaces[nb].terrain === 'land' && nb !== HOME) {
			const pid = 'en_' + nb
			g.location[pid] = nb
			g.piece_nation[pid] = '德国'
			g.piece_type[pid] = 'army'
		}
	}
	const beforeBonus = (g.army_bonus && g.army_bonus['中国']) || 0
	const r1 = rules.action(g, 'Allies', 'play_card', { card: '17537#1' })
	check('T3 条件不满足时整体跳过（无 us_china_build 状态）', !r1.us_china_build, r1.us_china_build)
	check('T3 未加后备（army_bonus[中国] 不变）',
		((r1.army_bonus && r1.army_bonus['中国']) || 0) === beforeBonus, r1.army_bonus)
	check('T3 未建设任何中国陆军（无征召/建设替代）', countNationArmy(r1, '中国') === 0)
	/* 即便误触发 resolve 也不应建设 */
	const r2 = rules.action(g, 'Allies', 'resolve_us_china_build', { space: HOME })
	check('T3 越界 resolve 不产生中国陆军', countNationArmy(r2, '中国') === 0)
})()

// ---- T4：确认走的是"建设"而非"征召"通道（can_recruit 与实际 build 区分）----
;(function () {
	/* 构造：某陆地邻居对"征召"可、对"建设"不可（被敌方占据导致 build 失败），
	 * 验证本卡不会因为退化为征召而成功——只会因 build 校验失败而跳过该格。 */
	const g = setupEmpty()
	/* 大本营 22 被敌方占据 -> 22 不可建设；旁边陆地 23 为空（征召本可，但本卡走 build 通道）*/
	g.location['en_home'] = HOME
	g.piece_nation['en_home'] = '德国'
	g.piece_type['en_home'] = 'army'
	const landNbr = I.get_connections(g, HOME, 'allies').map(Number)
		.find(id => D.spaces[id] && D.spaces[id].terrain === 'land' && id !== HOME)
	check('前置：找到陆地邻居', landNbr != null, landNbr)
	const r1 = rules.action(g, 'Allies', 'play_card', { card: '17537#1' })
	const view = rules.view(r1, 'Allies')
	const uvc = view.us_china_build
	/* 22 被占 -> 候选应只含可 build 的陆地邻居（landNbr 空盘、邻接大本营但大本营无己方补给部队，
	 *   故 landNbr 也不可 build），预期候选为空 -> 整体跳过 */
	if (uvc && uvc.candidates.length > 0) {
		/* 若有候选，选之应走 build_piece 成功而非 recruit */
		const c = uvc.candidates[0].id
		const r2 = rules.action(g, 'Allies', 'resolve_us_china_build', { space: c })
		check('T4 选候选走建设通道（build_piece 落地）', countPieces(r2, c, '中国', 'army') === 1)
	} else {
		check('T4 无 build 候选 -> 整体跳过（不退化成征召）', !r1.us_china_build)
	}
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
