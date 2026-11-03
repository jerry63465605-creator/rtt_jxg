"use strict"
/*
 * 【2026-10-18】15329《反潜战术》拦截捕获验证
 *
 * 卡面：经济战被打出时，英国令其无效（RESPONSE_PRE_CANCEL 拦截类）。
 * 本测试验证：拦截结算（trigger_response cancel 分支）时，被拦截的 ECON 卡
 * 唯一标识（实例 id + 面 id）被正确捕获进 game.intercept_log / game.last_intercept。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

// ---- 德国打出 ECON 15314，英国桌上有 15329 响应卡 ----
;(function () {
	const g = rules.setup(12345, 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = 1
	g.hands = g.hands || {}
	g.hands['德国'] = ['15314#1']
	g.hands['英国'] = []
	g.table_responses = [{ card_id: '15329#1', owner_side: 'allies', nation: '英国' }]
	g.discard = g.discard || {}
	g.play_done = g.play_done || {}

	// 德国打出 ECON -> 应被 15329 拦截挂起
	const r1 = rules.action(g, 'Axis', 'play_card', { card: '15314#1' })
	const q = (r1.response_queue || []).filter(x => (x.candidates || []).some(c => c.card_face === '15329'))
	check('15329 拦截挂起：response_queue 含 15329', q.length > 0, r1.response_queue)
	check('15329 拦截挂起：intercept_card = 15314#1',
		q[0] && q[0].intercept_card === '15314#1', q[0] && q[0].intercept_card)

	// 客户端先确认结算顺序（play_card 手动挂起的响应项未置 ordered，需先 confirm）
	const r1b = rules.action(r1, 'Allies', 'response_confirm', {})
	// 英国发动拦截(cancel) -> 被拦截牌进弃牌堆 + 捕获
	const r2 = rules.action(r1b, 'Allies', 'trigger_response', {})
	const discarded = (r2.discard['德国'] || []).indexOf('15314#1') >= 0
	check('15329 结算：被拦截的 ECON 进弃牌堆', discarded, r2.discard['德国'])

	check('15329 捕获：intercept_log 非空', (r2.intercept_log || []).length > 0, r2.intercept_log)
	const ic = (r2.intercept_log || []).slice(-1)[0]
	check('15329 捕获 被拦截实例id=15314#1', ic && ic.target_card === '15314#1', ic)
	check('15329 捕获 被拦截方面id=15314', ic && ic.target_face === '15314', ic)
	check('15329 捕获 拦截方实例id=15329#1', ic && ic.interceptor_card === '15329#1', ic)
	check('15329 捕获 拦截方面id=15329', ic && ic.interceptor_face === '15329', ic)
	check('15329 捕获 victim_nation=德国', ic && ic.victim_nation === '德国', ic)
	check('15329 捕获 by_nation=英国', ic && ic.by_nation === '英国', ic)
	check('15329 last_intercept 同步', r2.last_intercept && r2.last_intercept.target_card === '15314#1', r2.last_intercept)
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
