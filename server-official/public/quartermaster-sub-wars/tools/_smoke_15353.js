"use strict"
/*
 * 【2026-10-18】15353《保持冷静·继续前进》拦截机制回归测试
 *
 * 卡面：敌方国家发动[状态卡]效果时，弃置1张手牌：使其在本回合中无效。
 *
 * 机制：activate_status 在「窗口就绪」后、付代价前派发 enemy_status_effect 窗口；
 *   英国打出 15353 -> run 置 status_suppressed_this_turn[status]=freq_key（本国家回合无效）；
 *   英国跳过 -> skip_armed_offer 置 status_intercept_skipped[status]=freq_key（本回合放行）；
 *   两者均锚定 current_nation（armed 让权不改 current_nation，故全程稳定），
 *   与 status_used 同源，符合 rtt-turn-system「本回合=国家回合」口径。
 *
 * 覆盖：
 *   T1 配置正确性（when/actor/watch/cost）
 *   T2 敌方(非同盟)发动状态 -> 窗口出现且含 15353、代价标注 discard=1
 *   T3 run 机制：置 status_suppressed_this_turn[status]=freq_key(game)
 *   T4 阵营守卫：同盟国发动状态 -> 15353 不触发
 *   T5 代价守卫：英国无可弃之手牌（仅 15353 自身）-> 不触发
 *   T6 端到端 skip：激活派发窗口 -> 跳过 -> 重发不再弹窗（照常执行、无死循环）
 *   T7 端到端 use ：激活派发窗口 -> 打出15353弃牌 -> 重发被压制（效果本回合不发生）
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}
function fk(g) { return g.turn + ':' + g.current_nation }

function baseGame() {
	const g = rules.setup('t-15353-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '德国'
	g.active = 'axis'
	g.turn_phase = 'play'
	g.turn = 1
	g.hands = g.hands || {}
	g.hands['德国'] = ['15205#1']
	g.hands['英国'] = ['15353#1', 'dummy#1']
	g.discard = g.discard || {}
	g.table = g.table || {}
	g.armed_offers = g.armed_offers || []
	return g
}
function withTable(statusId, gerHand) {
	const g = baseGame()
	g.table['德国'] = [statusId]
	g.hands['德国'] = gerHand || ['15205#1', '15200#1', '15201#1']
	return g
}

// ---- T1：配置正确性 ----
;(function () {
	const cfg = I.ECHO_EFFECTS['15353']
	check('T1 15353 配置存在', !!cfg)
	check('T1 armed.when = enemy_status_effect', cfg && cfg.armed && cfg.armed.when === 'enemy_status_effect')
	check('T1 armed.actor = 英国', cfg && cfg.armed && cfg.armed.actor === '英国')
	check('T1 armed.watch = true', cfg && cfg.armed && cfg.armed.watch === true)
	check('T1 armed.cost.discard = 1', cfg && cfg.armed && cfg.armed.cost && cfg.armed.cost.discard === 1)
})()

// ---- T2：敌方(非同盟)发动状态 -> 窗口出现含 15353 ----
;(function () {
	const g = baseGame()
	I.offer_armed_effects(g, 'enemy_status_effect', { nation: '德国', card: '15338#1', space: null })
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	check('T2 窗口出现', !!win)
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T2 窗口含 15353#1', ids.indexOf('15353#1') >= 0, ids)
	const cost = win && win.cards && win.cards[0] && win.cards[0].cost
	check('T2 代价标注 discard=1', cost && cost.discard === 1, cost)
})()

// ---- T3：run 机制 — 置 status_suppressed_this_turn[status]=freq_key ----
;(function () {
	const g = baseGame()
	const r = I.ECHO_EFFECTS['15353'].armed.run(g, { nation: '德国', card: '15338#1' }, {})
	check('T3 run 返回 ok', r && r.ok === true, r)
	check('T3 置 status_suppressed_this_turn[15338#1] = freq_key',
		(g.status_suppressed_this_turn || {})['15338#1'] === fk(g), (g.status_suppressed_this_turn || {})['15338#1'])
})()

// ---- T4：阵营守卫 — 同盟国发动状态 -> 15353 不触发 ----
;(function () {
	const g = baseGame()
	I.offer_armed_effects(g, 'enemy_status_effect', { nation: '英国', card: '15338#1', space: null })
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T4 同盟国发动不触发 15353', ids.indexOf('15353#1') < 0, ids)
})()

// ---- T5：代价守卫 — 英国无可弃之手牌 -> 不触发 ----
;(function () {
	const g = baseGame()
	g.hands['英国'] = ['15353#1'] // 仅 15353 自身，无其它可弃手牌
	I.offer_armed_effects(g, 'enemy_status_effect', { nation: '德国', card: '15338#1', space: null })
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T5 英国无可弃手牌时不触发 15353', ids.indexOf('15353#1') < 0, ids)
})()

// ---- T6：端到端 skip —— 激活派发窗口 -> 跳过 -> 重发不再弹窗（照常执行）----
;(function () {
	const g = withTable('15338#1')
	const r1 = rules.action(g, 'Axis', 'activate_status', { card: '15338#1' })
	const w1 = (r1.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	check('T6 首次激活派发拦截窗口', !!w1, r1.armed_offers)
	check('T6 窗口含 15353', w1 && w1.cards.some(c => c.card_id === '15353#1'), w1 && w1.cards)

	const r2 = rules.action(g, 'Allies', 'skip_armed_offer', {})
	check('T6 跳过置 status_intercept_skipped[15338#1] = freq_key',
		(r2.status_intercept_skipped || {})['15338#1'] === fk(g), (r2.status_intercept_skipped || {})['15338#1'])
	check('T6 跳过后窗口清空', (r2.armed_offers || []).filter(w => w.when === 'enemy_status_effect').length === 0, r2.armed_offers)

	const r3 = rules.action(g, 'Axis', 'activate_status', { card: '15338#1' })
	const w3 = (r3.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	check('T6 重发后不再弹拦截窗口（无死循环）', !w3, r3.armed_offers)
	check('T6 重发未被压制（未走压制分支）', !(r3.log || []).some(l => l.indexOf('无法发动') >= 0))
})()

// ---- T7：端到端 use —— 激活派发窗口 -> 打出15353弃牌 -> 重发被压制 ----
;(function () {
	const g = withTable('15338#1')
	g.hands['英国'] = ['15353#1', 'dummy#1']

	const r1 = rules.action(g, 'Axis', 'activate_status', { card: '15338#1' })
	const w1 = (r1.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	check('T7 首次激活派发拦截窗口', !!w1, r1.armed_offers)

	const r2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '15353#1', drop: ['dummy#1'] })
	check('T7 15353 自身进入弃牌堆', (r2.discard['英国'] || []).indexOf('15353#1') >= 0, r2.discard['英国'])
	check('T7 弃牌代价牌进入弃牌堆', (r2.discard['英国'] || []).indexOf('dummy#1') >= 0, r2.discard['英国'])
	check('T7 15353 离手', (r2.hands['英国'] || []).indexOf('15353#1') < 0, r2.hands['英国'])
	check('T7 置 status_suppressed_this_turn[15338#1] = freq_key',
		(r2.status_suppressed_this_turn || {})['15338#1'] === fk(g), (r2.status_suppressed_this_turn || {})['15338#1'])

	const r3 = rules.action(g, 'Axis', 'activate_status', { card: '15338#1' })
	const w3 = (r3.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	check('T7 重发不再弹拦截窗口', !w3, r3.armed_offers)
	check('T7 重发被《保持冷静》压制（效果本回合不发生）',
		(r3.log || []).some(l => l.indexOf('无法发动') >= 0), r3.log && r3.log.slice(-3))
	/* 【2026-10-18】拦截捕获：验证被拦截目标卡的唯一标识已落盘 */
	check('T7 拦截捕获：intercept_log 含 15338#1', (r2.intercept_log || []).some(e => e.target_card === '15338#1'), r2.intercept_log)
	const ic53 = (r2.intercept_log || []).slice(-1)[0]
	check('T7 捕获 拦截方=15353#1', ic53 && ic53.interceptor_card === '15353#1', ic53)
	check('T7 捕获 被拦截方面id=15338', ic53 && ic53.target_face === '15338', ic53)
	check('T7 捕获 by_nation=英国 / victim_nation=德国', ic53 && ic53.by_nation === '英国' && ic53.victim_nation === '德国', ic53)
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
