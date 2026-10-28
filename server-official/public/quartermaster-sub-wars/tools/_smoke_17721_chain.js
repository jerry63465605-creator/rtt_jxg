"use strict"
/*
 * 【2026-10-18】17721 钢铁条约「放弃状态卡打出，归还意大利」白名单修复回归测试。
 * 根因：build_actions 无 chain 模式块，event_delegate_decline 未进白名单，
 *       → 客户端"放弃"按钮点了静默无效（view.actions 无此 key → Invalid action!）。
 * 修复：新增 chain 块，放行 play_card + event_delegate_decline。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

function baseChain() {
	const g = rules.setup('t-17721-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	g.opening = null // 真实对局里 17721 在出牌阶段打出，开局弃牌阶段早已结束
	g.current_nation = '德国'
	g.active = 'axis'
	g.turn_phase = 'play'
	g.turn = 1
	g.hands = g.hands || {}
	/* 意大利手牌含 1 张状态卡（15338），使意大利国家技能（grant=状态/响应）可用 */
	g.hands['意大利'] = ['17721#1', '15338#1']
	g.hands['德国'] = ['15338#1'] // 状态卡占位，仅用于验证 play_card 放行（不实际打出）
	g.discard = g.discard || {}
	g.armed_offers = g.armed_offers || []
	/* 模拟"意大利已打出响应卡、链式委托给德国"的挂起态 */
	g.delegate = { mode: 'chain', delegate: '德国', return_nation: '意大利', return_active: 'axis' }
	g.extra_play = { source: '17721', nation: '德国', filter: 'status', source_name: '钢铁条约' }
	return g
}

// T1: 轴心侧 view.actions 含 event_delegate_decline + play_card（关键回归点）
;(function () {
	const g = baseChain()
	const v = rules.view(g, 'Axis')
	check('T1 轴心侧 event_delegate_decline 在白名单', v.actions && v.actions.event_delegate_decline === 1, v.actions)
	check('T1 轴心侧 play_card 在白名单（防反向锁死打牌）', v.actions && v.actions.play_card === 1, v.actions)
	check('T1 轴心侧 it_delegate 视图下发 chain', !!(v.it_delegate && v.it_delegate.mode === 'chain'), v.it_delegate)
})()

// T2: 同盟侧 view.actions 不含 event_delegate_decline（仅轴心可见，与 german_draw 同口径）
;(function () {
	const g = baseChain()
	const v = rules.view(g, 'Allies')
	check('T2 同盟侧 event_delegate_decline 不在白名单', !v.actions || !v.actions.event_delegate_decline, v.actions)
})()

// T3: 执行 event_delegate_decline → 委托清除 + 控制权归还意大利 + 意国技能窗口弹出
;(function () {
	const g = baseChain()
	const g2 = rules.action(g, 'Axis', 'event_delegate_decline', {})
	check('T3 委托已清除（delegate 为空）', !g2.delegate, g2.delegate)
	check('T3 extra_play 已清除', !g2.extra_play, g2.extra_play)
	const last = (g2.log || []).slice(-3).join(' | ')
	check('T3 日志含"归还意大利"', last.indexOf('归还意大利') >= 0, last)
	check('T3 意大利国家技能窗口弹出', !!(g2.national_skill_offer && g2.national_skill_offer.nation === '意大利'), g2.national_skill_offer)
})()

// T4: 无 delegate 时 event_delegate_decline 是 no-op（不应崩溃）
;(function () {
	const g = rules.setup('t-17721-b-' + Math.random(), 'Standard', {})
	g.active = 'axis'
	const g2 = rules.action(g, 'Axis', 'event_delegate_decline', {})
	check('T4 无 delegate 时不崩溃', !!g2, typeof g2)
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
