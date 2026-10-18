"use strict"
/*
 * 【2026-10-19】17805《红色管弦乐队》重构回归测试
 * 全转通用 armed 机制：when='nation_turn_start'（苏/德/英 各自回合开始触发）、
 * actor=苏联、watch:true（德/英回合也能让苏联弹窗）、run 先返回 need:'status'
 * 让苏联选德国桌面[状态卡]，选定后挂起德国二选一（pending_red / resolve_red）。
 * 复用 _smoke_17855.js 范式。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

// 德国状态卡（15338 为德国 STATUS）放桌上，苏联持 17805，目标国手牌用于损耗校验
function baseGame(target) {
	const g = rules.setup('t-17805-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	const nat = target || '德国'
	g.current_nation = nat
	g.active = (nat === '苏联') ? 'allies' : 'axis'
	g.turn_phase = 'resource'
	g.turn = 1
	g.hands = g.hands || {}
	g.hands['苏联'] = ['17805#1']
	if (nat !== '苏联') g.hands[nat] = ['15205#1', '15206#1']
	g.discard = g.discard || {}
	g.armed_offers = g.armed_offers || []
	g.table = g.table || {}
	g.table['德国'] = ['15338#1']   // 德国桌面上一张[状态卡]
	return g
}

// T1 配置正确性
;(function () {
	const cfg = I.ECHO_EFFECTS['17805']
	check('T1 17805 配置存在', !!cfg)
	check('T1 armed.when = nation_turn_start', cfg && cfg.armed && cfg.armed.when === 'nation_turn_start')
	check('T1 armed.actor = 苏联', cfg && cfg.armed && cfg.armed.actor === '苏联')
	check('T1 armed.watch = true', cfg && cfg.armed && cfg.armed.watch === true)
	check('T1 armed.ready 是函数', cfg && cfg.armed && typeof cfg.armed.ready === 'function')
	check('T1 armed.run 是函数', cfg && cfg.armed && typeof cfg.armed.run === 'function')
})()

// T2 派发：德国回合开始 → 窗口含 17805（watch:true 跨国触发）
;(function () {
	const g = baseGame('德国')
	I.offer_armed_effects(g, 'nation_turn_start', { nation: '德国' })
	const win = (g.armed_offers || []).find(w => w.when === 'nation_turn_start')
	check('T2 窗口出现', !!win)
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T2 窗口含 17805#1', ids.indexOf('17805#1') >= 0, ids)
})()

// T3 ready 预检：德国桌面无状态卡 → 不弹窗
;(function () {
	const g = baseGame('德国')
	g.table['德国'] = []
	I.offer_armed_effects(g, 'nation_turn_start', { nation: '德国' })
	const win = (g.armed_offers || []).find(w => w.when === 'nation_turn_start')
	check('T3 无德国状态卡不弹窗', !win)
})()

// T4 苏联本国回合也触发
;(function () {
	const g = baseGame('苏联')
	g.active = 'allies'
	I.offer_armed_effects(g, 'nation_turn_start', { nation: '苏联' })
	const win = (g.armed_offers || []).find(w => w.when === 'nation_turn_start')
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T4 苏联回合触发 17805', ids.indexOf('17805#1') >= 0, ids)
})()

// T5 run 第一步：需要选德国状态卡（need:'status'）
;(function () {
	const g = baseGame('德国')
	const r = I.ECHO_EFFECTS['17805'].armed.run(g, { nation: '德国', card: '17805#1' }, {})
	check('T5 run 返回 need=status', r && r.need === 'status', r)
	const ids = (r && r.candidates || []).map(c => c.id)
	check('T5 候选含 15338#1', ids.indexOf('15338#1') >= 0, ids)
	check('T5 候选对象带 id/name/type', !!(r && r.candidates[0] && r.candidates[0].id && r.candidates[0].name), r && r.candidates[0])
})()

// T6 端到端 use_armed_offer：第一步 return need，第二步挂起 pending_red + 消耗卡
;(function () {
	const g = baseGame('德国')
	g.active = 'axis'
	I.offer_armed_effects(g, 'nation_turn_start', { nation: '德国' })
	const g2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17805#1' })
	const win2 = (g2.armed_offers || []).find(w => w.when === 'nation_turn_start')
	check('T6 第一步后窗口 pending.need=status', win2 && win2.pending && win2.pending.need === 'status', win2 && win2.pending)
	const g3 = rules.action(g2, 'Allies', 'use_armed_offer', { card: '17805#1', status: '15338#1' })
	check('T6 pending_red 已挂起', !!g3.pending_red, g3.pending_red)
	check('T6 pending_red.waiting_for=德国', g3.pending_red && g3.pending_red.waiting_for === '德国')
	check('T6 pending_red.target=15338#1', g3.pending_red && g3.pending_red.target === '15338#1')
	check('T6 17805 已消耗(进苏联弃牌堆)', (g3.discard['苏联'] || []).indexOf('17805#1') >= 0, g3.discard['苏联'])
	check('T6 结算后窗口清除', !((g3.armed_offers || []).find(w => w.when === 'nation_turn_start')))
})()

// T7 resolve_red：德国（决策方）二选一
;(function () {
	const g = baseGame('德国')
	g.active = 'axis'
	I.offer_armed_effects(g, 'nation_turn_start', { nation: '德国' })
	const g2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17805#1' })
	const g3 = rules.action(g2, 'Allies', 'use_armed_offer', { card: '17805#1', status: '15338#1' })
	// choice 0：本回合内无效（抑制目标状态卡）
	const g3c = rules.action(g3, 'Axis', 'resolve_red', { choice: 0 })
	check('T7c choice0 抑制目标状态卡', g3c.su_red_suppressed && g3c.su_red_suppressed['15338'] === g3c.turn, g3c.su_red_suppressed)
	check('T7c pending_red 清除', !g3c.pending_red)
	// choice 1：损耗（不报错 + 清除）
	const g3d = rules.action(g3, 'Axis', 'resolve_red', { choice: 1 })
	check('T7d choice1 清除 pending_red', !g3d.pending_red)
})()

// T8 阵营守卫：非德国侧不能 resolve_red
;(function () {
	const g = baseGame('德国')
	g.active = 'axis'
	I.offer_armed_effects(g, 'nation_turn_start', { nation: '德国' })
	const g2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17805#1' })
	const g3 = rules.action(g2, 'Allies', 'use_armed_offer', { card: '17805#1', status: '15338#1' })
	const g3e = rules.action(g3, 'Allies', 'resolve_red', { choice: 0 })
	check('T8 非德国侧不能 resolve_red（仍挂起）', !!g3e.pending_red)
})()

// T9 phase_resource 门控：仅 苏/德/英 触发
;(function () {
	for (const nat of ['苏联', '德国', '英国', '日本', '意大利', '美国']) {
		const g = baseGame(nat)
		g.active = (nat === '苏联') ? 'allies' : 'axis'
		I.phase_resource(g, nat)
		const win = (g.armed_offers || []).find(w => w.when === 'nation_turn_start')
		const ids = win ? win.cards.map(c => c.card_id) : []
		const ok = (nat === '苏联' || nat === '德国' || nat === '英国')
			? ids.indexOf('17805#1') >= 0
			: !win
		check('T9 ' + nat + ' 触发门控正确', ok, { nat, ids })
	}
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
