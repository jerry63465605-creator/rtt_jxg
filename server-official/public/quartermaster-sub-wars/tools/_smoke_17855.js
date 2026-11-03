"use strict"
/*
 * 【2026-10-18】17855《间谍机构》回归测试
 * 德/日/意 摸牌阶段结束 → 向苏联挂起询问是否打出；
 * 打出后看该轴心国手牌、选 1 张弃置、该国摸 1 张。
 * 复用 _smoke_15352.js 的初始化与断言范式。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

function baseGame(target) {
	const g = rules.setup('t-17855-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	const nat = target || '德国'
	g.current_nation = nat
	g.active = 'axis'
	g.turn_phase = 'play'
	g.turn = 1
	g.hands = g.hands || {}
	g.hands['苏联'] = ['17855#1']
	g.hands[nat] = ['15205#1', '15206#1']
	g.discard = g.discard || {}
	g.armed_offers = g.armed_offers || []
	return g
}

// T1 配置正确性
;(function () {
	const cfg = I.ECHO_EFFECTS['17855']
	check('T1 17855 配置存在', !!cfg)
	check('T1 armed.when = draw_phase_end', cfg && cfg.armed && cfg.armed.when === 'draw_phase_end')
	check('T1 armed.actor = 苏联', cfg && cfg.armed && cfg.armed.actor === '苏联')
	check('T1 armed.watch = true', cfg && cfg.armed && cfg.armed.watch === true)
})()

// T2 派发：德国摸牌结束 → 窗口含 17855
;(function () {
	const g = baseGame('德国')
	I.offer_armed_effects(g, 'draw_phase_end', { nation: '德国' })
	const win = (g.armed_offers || []).find(w => w.when === 'draw_phase_end')
	check('T2 窗口出现', !!win)
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T2 窗口含 17855#1', ids.indexOf('17855#1') >= 0, ids)
})()

// T3 ready 预检：目标无手牌则不弹窗
;(function () {
	const g = baseGame('德国')
	g.hands['德国'] = []
	I.offer_armed_effects(g, 'draw_phase_end', { nation: '德国' })
	const win = (g.armed_offers || []).find(w => w.when === 'draw_phase_end')
	check('T3 目标无手牌不弹窗', !win)
})()

// T4 日本/意大利同样触发
;(function () {
	for (const nat of ['日本', '意大利']) {
		const g = baseGame(nat)
		I.offer_armed_effects(g, 'draw_phase_end', { nation: nat })
		const win = (g.armed_offers || []).find(w => w.when === 'draw_phase_end')
		const ids = (win && win.cards || []).map(c => c.card_id)
		check('T4 ' + nat + ' 触发 17855', ids.indexOf('17855#1') >= 0, ids)
	}
})()

// T5 run 第一步：需要选牌（need:'card'），候选=目标国手牌
;(function () {
	const g = baseGame('德国')
	const r = I.ECHO_EFFECTS['17855'].armed.run(g, { nation: '德国', card: '17855#1' }, {})
	check('T5 run 返回 need=card', r && r.need === 'card', r)
	check('T5 候选数=2', r && r.candidates && r.candidates.length === 2, r && r.candidates && r.candidates.length)
	check('T5 候选含 revealNation=德国', r && r.revealNation === '德国', r)
	check('T5 候选对象带 id/name/type', !!(r && r.candidates[0] && r.candidates[0].id && r.candidates[0].name), r && r.candidates[0])
})()

// T6 端到端 use_armed_offer：第一步 return need，第二步弃+摸
;(function () {
	const g = baseGame('德国')
	g.active = 'allies'
	I.offer_armed_effects(g, 'draw_phase_end', { nation: '德国' })
	const beforeHand = (g.hands['德国'] || []).slice()
	const g2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17855#1' })
	const win2 = (g2.armed_offers || []).find(w => w.when === 'draw_phase_end')
	check('T6 第一步后窗口 pending.need=card', win2 && win2.pending && win2.pending.need === 'card', win2 && win2.pending)
	check('T6 第一步后 pending 含 revealNation', win2 && win2.pending && win2.pending.revealNation === '德国', win2 && win2.pending)
	const pick = beforeHand[0]
	const g3 = rules.action(g2, 'Allies', 'use_armed_offer', { card: '17855#1', pick: pick })
	check('T6 选中的牌进入德国弃牌堆', (g3.discard['德国'] || []).indexOf(pick) >= 0, g3.discard['德国'])
	check('T6 选中的牌离开德国手牌', (g3.hands['德国'] || []).indexOf(pick) < 0, g3.hands['德国'])
	check('T6 德国手牌数不变（弃1+摸1）', (g3.hands['德国'] || []).length === beforeHand.length, g3.hands['德国'])
	check('T6 结算后窗口清除', !((g3.armed_offers || []).find(w => w.when === 'draw_phase_end')))
})()

// T7 阵营守卫：非苏联侧（轴心）不能打出
;(function () {
	const g = baseGame('德国')
	g.active = 'axis'
	I.offer_armed_effects(g, 'draw_phase_end', { nation: '德国' })
	const g2 = rules.action(g, 'Axis', 'use_armed_offer', { card: '17855#1' })
	const win = (g2.armed_offers || []).find(w => w.when === 'draw_phase_end')
	check('T7 轴心侧不能打出（窗口仍在）', !!win, win)
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
