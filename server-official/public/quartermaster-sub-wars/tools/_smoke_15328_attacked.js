"use strict"
/*
 * 【2026-10-17】15328《破译恩尼格码》触发口径回归测试
 *
 * 用户口径：
 *   1) 德国被攻击、其状态卡因 react(when:'attacked') 发动后，统一触发一次 15328，
 *      让英国从【刚才发动的德国状态卡】里选 1 张弃置（单卡也弹窗选 1 张）。
 *   2) 德国【主动打出】状态卡（play_card）不再触发 15328（仅"状态卡发效果"时触发）。
 *
 * 覆盖：
 *   T1  fire_trigger 监听正确：play_card 不触发 / status_attacked 触发
 *   T2  do_battle 端到端：<德国>被攻击且 15250+15252 同时发动 → 15328 进队列 → 选 15250#1 弃
 *   T3  do_battle 端到端：仅 15252 发动 → 也进入选卡窗口（单卡弹窗）
 *   T4  request_responses 隔离：直接派发 status_attacked，多卡候选 + 选 1 张弃
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

const GER = 44 // data.js: "德国": 44 —— <德国> 的 space id

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

function baseGame() {
	const g = rules.setup(12345, 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '英国'
	g.turn_phase = 'play'
	g.turn = 1
	g.table = g.table || {}
	g.table_responses = g.table_responses || []
	return g
}

function placeGermanArmy(g, space) {
	g.location['gp1'] = space
	g.piece_nation['gp1'] = '德国'
	g.piece_type['gp1'] = 'army'
}

function findBritishLaunch(g, target) {
	for (const nb of I.get_connections(g, target, 'allies')) {
		g.location['bp1'] = nb
		g.piece_nation['bp1'] = '英国'
		g.piece_type['bp1'] = 'army'
		I.grant_supply(g, 'bp1', g.turn)
		I.compute_supply(g)
		if (I.piece_in_supply(g, 'bp1')) return nb
	}
	return null
}

// ---- T1：触发监听正确性 ----
;(function () {
	const g = baseGame()
	g.table_responses = [{ card_id: '15328#1', owner_side: 'allies', nation: '英国' }]
	const noPlay = I.fire_trigger(g, 'play_card', { nation: '德国', card: '15250#1', card_obj: { type: 'STATUS' } })
	check('T1 15328 不再监听 play_card（德国打出状态卡不触发）',
		!noPlay.some(c => c.card_face === '15328'), noPlay.map(c => c.card_face))
	const yesAtt = I.fire_trigger(g, 'status_attacked', { nation: '德国', cards: ['15250#1', '15252#1'] })
	check('T1 15328 监听 status_attacked（被攻击发动触发）',
		yesAtt.some(c => c.card_face === '15328'), yesAtt.map(c => c.card_face))
})()

// ---- T2：do_battle 端到端，多卡同时发动 → 选 1 张弃 ----
;(function () {
	const g = baseGame()
	g.table['德国'] = ['15250#1', '15252#1']
	g.table_responses = [{ card_id: '15328#1', owner_side: 'allies', nation: '英国' }]
	placeGermanArmy(g, GER)
	const nb = findBritishLaunch(g, GER)
	check('T2 找到英军可发起攻击的相邻格', !!nb, 'nb=' + nb)
	if (!nb) return
	const r = I.do_battle(g, '英国', GER, 'gp1', 'land', { from: 'bp1' })
	check('T2 do_battle 成功', r.ok, r.reason)
	const queued = (g.response_queue || []).some(x => (x.candidates || []).some(c => c.card_face === '15328'))
	check('T2 15328 进入响应队列', queued)
	const g2 = rules.action(g, 'Allies', 'trigger_response', {})
	const pc = (g2.response_stack || []).slice(-1)[0] || null
	check('T2 15328 进入选卡窗口（kind=card）', !!(pc && pc.kind === 'card'), pc && pc.kind)
	const ids = (pc && pc.candidates || []).map(c => c.id)
	check('T2 候选含 15250#1 与 15252#1', ids.indexOf('15250#1') >= 0 && ids.indexOf('15252#1') >= 0, ids)
	const g3 = rules.action(g2, 'Allies', 'resolve_response_choice', { choice: '15250#1' })
	const left = (g3.table && g3.table['德国']) || []
	check('T2 15250#1 被弃置（移出桌面）', left.indexOf('15250#1') < 0, left)
	check('T2 15252#1 仍保留在桌面', left.indexOf('15252#1') >= 0, left)
	/* 【2026-10-18】拦截捕获：验证被弃置(被拦截)的德国状态卡唯一标识已落盘 */
	check('T2 拦截捕获：intercept_log 含 15250#1', (g3.intercept_log || []).some(e => e.target_card === '15250#1'), g3.intercept_log)
	const ic28 = (g3.intercept_log || []).slice(-1)[0]
	check('T2 捕获 拦截方=15328#1', ic28 && ic28.interceptor_card === '15328#1', ic28)
	check('T2 捕获 被拦截方面id=15250', ic28 && ic28.target_face === '15250', ic28)
	check('T2 捕获 by_nation=英国 / victim_nation=德国', ic28 && ic28.by_nation === '英国' && ic28.victim_nation === '德国', ic28)
})()

// ---- T3：do_battle 端到端，仅单卡发动 → 仍弹窗选 1 张 ----
;(function () {
	const g = baseGame()
	g.table['德国'] = ['15252#1']
	g.table_responses = [{ card_id: '15328#1', owner_side: 'allies', nation: '英国' }]
	placeGermanArmy(g, GER)
	const nb = findBritishLaunch(g, GER)
	check('T3 找到相邻格', !!nb, 'nb=' + nb)
	if (!nb) return
	const r = I.do_battle(g, '英国', GER, 'gp1', 'land', { from: 'bp1' })
	check('T3 do_battle 成功', r.ok, r.reason)
	const g2 = rules.action(g, 'Allies', 'trigger_response', {})
	const pc = (g2.response_stack || []).slice(-1)[0] || null
	check('T3 单卡也进入选卡窗口', !!(pc && pc.kind === 'card'), pc && pc.kind)
	const ids = (pc && pc.candidates || []).map(c => c.id)
	check('T3 候选仅 15252#1', ids.length === 1 && ids[0] === '15252#1', ids)
	const g3 = rules.action(g2, 'Allies', 'resolve_response_choice', { choice: '15252#1' })
	const left = (g3.table && g3.table['德国']) || []
	check('T3 15252#1 被弃置', left.indexOf('15252#1') < 0, left)
})()

// ---- T4：request_responses 隔离派发，多卡候选 + 选 1 张弃 ----
;(function () {
	const g = baseGame()
	g.table['德国'] = ['15250#1', '15252#1']
	g.table_responses = [{ card_id: '15328#1', owner_side: 'allies', nation: '英国' }]
	I.request_responses(g, 'status_attacked', { nation: '德国', cards: ['15250#1', '15252#1'] }, false)
	const queued = (g.response_queue || []).some(x => (x.candidates || []).some(c => c.card_face === '15328'))
	check('T4 直接派发 status_attacked → 15328 进队列', queued)
	const g2 = rules.action(g, 'Allies', 'trigger_response', {})
	const pc = (g2.response_stack || []).slice(-1)[0] || null
	check('T4 进入选卡窗口', !!(pc && pc.kind === 'card'), pc && pc.kind)
	const ids = (pc && pc.candidates || []).map(c => c.id)
	check('T4 候选含两张', ids.indexOf('15250#1') >= 0 && ids.indexOf('15252#1') >= 0, ids)
	const g3 = rules.action(g2, 'Allies', 'resolve_response_choice', { choice: '15252#1' })
	const left = (g3.table && g3.table['德国']) || []
	check('T4 选 15252#1 → 其被弃置', left.indexOf('15252#1') < 0, left)
	check('T4 15250#1 保留', left.indexOf('15250#1') >= 0, left)
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
