"use strict"
/*
 * 【2026-10-18】15352《丘吉尔之怒》拦截机制回归测试
 *
 * 设计（镜像 16700 一日之狮）：
 *   敌方（非同盟）打出[增强卡]时，英国弃置 1 张手牌：使其无效。
 *   机制 = play_card 在 resolve_event_card 之前挂起 enemy_echo_played 窗口；
 *   15352 的 run 把敌方那张增强卡从对方手牌直接丢进弃牌堆（效果因未执行而不发生）。
 *
 * 覆盖：
 *   T1 配置正确性（when/actor/watch/cost）
 *   T2 敌方(非同盟)打出增强 → 窗口出现且含 15352、代价标注 discard=1
 *   T3 run 机制：敌方卡进弃牌堆、离手、__skip_echo_intercept 置位
 *   T4 阵营守卫：同盟国打出增强 → 15352 不触发
 *   T5 代价守卫：英国无可弃之手牌（仅 15352 自身）→ 不触发
 *   T6 端到端 use_armed_offer：敌方卡弃置 + 15352 自身弃置 + 弃牌代价牌弃置
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

function baseGame() {
	const g = rules.setup('t-15352-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '德国'
	g.active = 'axis'
	g.turn_phase = 'play'
	g.turn = 1
	g.hands = g.hands || {}
	g.hands['德国'] = ['15205#1']            // 德国 EFFECT（JU-87），作为"敌方打出的增强卡"
	g.hands['英国'] = ['15352#1', 'dummy#1'] // 15352 + 1 张可弃手牌
	g.discard = g.discard || {}
	g.armed_offers = g.armed_offers || []
	return g
}

// ---- T1：配置正确性 ----
;(function () {
	const cfg = I.ECHO_EFFECTS['15352']
	check('T1 15352 配置存在', !!cfg)
	check('T1 armed.when = enemy_echo_played', cfg && cfg.armed && cfg.armed.when === 'enemy_echo_played')
	check('T1 armed.actor = 英国', cfg && cfg.armed && cfg.armed.actor === '英国')
	check('T1 armed.watch = true', cfg && cfg.armed && cfg.armed.watch === true)
	check('T1 armed.cost.discard = 1', cfg && cfg.armed && cfg.armed.cost && cfg.armed.cost.discard === 1)
})()

// ---- T2：敌方(非同盟)打出增强 → 窗口出现含 15352 ----
;(function () {
	const g = baseGame()
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '德国', card: '15205#1', space: null })
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_echo_played')
	check('T2 窗口出现', !!win)
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T2 窗口含 15352#1', ids.indexOf('15352#1') >= 0, ids)
	/* cost 挂在每张候选卡的 entry.cost 上（offer_armed_effects L11462） */
	const cost = win && win.cards && win.cards[0] && win.cards[0].cost
	check('T2 代价标注 discard=1', cost && cost.discard === 1, cost)
})()

// ---- T3：run 机制 — 敌方卡进弃牌堆、离手、标记置位 ----
;(function () {
	const g = baseGame()
	const r = I.ECHO_EFFECTS['15352'].armed.run(g, { nation: '德国', card: '15205#1' }, {})
	check('T3 run 返回 ok', r && r.ok === true, r)
	check('T3 敌方卡从手牌移除', (g.hands['德国'] || []).indexOf('15205#1') < 0, g.hands['德国'])
	check('T3 敌方卡进入弃牌堆', (g.discard['德国'] || []).indexOf('15205#1') >= 0, g.discard['德国'])
	check('T3 __skip_echo_intercept 置位', g.__skip_echo_intercept === true)
})()

// ---- T4：阵营守卫 — 同盟国打出增强 → 15352 不触发 ----
;(function () {
	const g = baseGame()
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '英国', card: '15305#1', space: null })
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_echo_played')
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T4 同盟国打出不触发 15352', ids.indexOf('15352#1') < 0, ids)
})()

// ---- T5：代价守卫 — 英国无可弃之手牌 → 不触发 ----
;(function () {
	const g = baseGame()
	g.hands['英国'] = ['15352#1'] // 仅 15352 自身，无其它可弃手牌
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '德国', card: '15205#1', space: null })
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_echo_played')
	const ids = (win && win.cards || []).map(c => c.card_id)
	check('T5 英国无可弃手牌时不触发 15352', ids.indexOf('15352#1') < 0, ids)
})()

// ---- T6：端到端 use_armed_offer ----
;(function () {
	const g = baseGame()
	g.active = 'allies'
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '德国', card: '15205#1', space: null })
	const g2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['dummy#1'] })
	check('T6 敌方卡进入弃牌堆', (g2.discard['德国'] || []).indexOf('15205#1') >= 0, g2.discard['德国'])
	check('T6 15352 自身进入弃牌堆', (g2.discard['英国'] || []).indexOf('15352#1') >= 0, g2.discard['英国'])
	check('T6 弃牌代价牌进入弃牌堆', (g2.discard['英国'] || []).indexOf('dummy#1') >= 0, g2.discard['英国'])
	check('T6 15352 离手', (g2.hands['英国'] || []).indexOf('15352#1') < 0, g2.hands['英国'])
	check('T6 敌方卡离手', (g2.hands['德国'] || []).indexOf('15205#1') < 0, g2.hands['德国'])
	/* 【2026-10-18】拦截捕获：验证被拦截目标卡的唯一标识已落盘 */
	check('T6 拦截捕获：intercept_log 含 15205#1', (g2.intercept_log || []).some(e => e.target_card === '15205#1'), g2.intercept_log)
	const ic52 = (g2.intercept_log || []).slice(-1)[0]
	check('T6 捕获 拦截方=15352#1', ic52 && ic52.interceptor_card === '15352#1', ic52)
	check('T6 捕获 被拦截方面id=15205', ic52 && ic52.target_face === '15205', ic52)
	check('T6 捕获 by_nation=英国 / victim_nation=德国', ic52 && ic52.by_nation === '英国' && ic52.victim_nation === '德国', ic52)
	check('T6 last_intercept 同步', g2.last_intercept && g2.last_intercept.target_card === '15205#1', g2.last_intercept)
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
