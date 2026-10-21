/*
 * 回归测试：打出是否占用出牌名额（EVENT / STATUS / RESPONSE / ECON）
 *
 * 玩家 2026-10-22：百团大战（17828，多步 EVENT：中国征召 → 中国发起陆战）应占苏联出牌名额。
 * 根因：多步卡在 stepPause/armedPause 停机时 play_card 未 mark，最后一步是战斗预算时
 *       event_finish 也不 mark，整张卡不占名额；且 event_finish 用 discard_card 会吞卡。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_play_quota.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { CARDS } = require(path.join(MOD, 'cards.js'))

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}
function base(nation, role) {
	let g = rules.setup(1)
	g.opening = null
	g.current_nation = nation
	g.active = role
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.hands[nation] = g.hands[nation] || []
	return g
}
function handHas(g, n, id) { return (g.hands[n] || []).indexOf(id) >= 0 }
function discardHas(g, n, id) { return (g.discard[n] || []).indexOf(id) >= 0 }

console.log('=== A. EVENT 多步 17828 百团大战：打出即占名额 + 收尾入弃牌堆 ===')
{
	let g = base('苏联', 'Allies')
	g.hands['苏联'].push('17828#1')
	g = rules.action(g, 'Allies', 'play_card', { card: '17828#1', spaces: [19] })
	ok('17828 打出后 play_done[苏联]=true', !!(g.play_done && g.play_done['苏联']),
		'play_done=' + JSON.stringify(g.play_done))
	ok('停在分步边界（pending_event_step）', !!g.pending_event_step,
		JSON.stringify(g.pending_event_step && { step: g.pending_event_step.step }))

	g = rules.action(g, 'Allies', 'event_step_next', {})
	ok('推进后建立战斗预算', !!g.event_budget,
		JSON.stringify(g.event_budget && { remaining: g.event_budget.remaining }))
	ok('推进后名额保持', !!(g.play_done && g.play_done['苏联']))

	g = rules.action(g, 'Allies', 'event_finish', {})
	ok('结束预算后名额保持（未被重复消耗/清空）', !!(g.play_done && g.play_done['苏联']),
		'play_done=' + JSON.stringify(g.play_done))
	ok('17828 已进苏联弃牌堆（不再吞卡）', discardHas(g, '苏联', '17828#1'),
		'discard=' + JSON.stringify((g.discard['苏联'] || []).slice(-3)))
}

console.log('\n=== B. STATUS：打出占名额 ===')
{
	const st = CARDS.find(c => c.nation === '苏联' && c.type === 'STATUS' && I.status_config_of(c.id))
	ok('找到苏联 STATUS 样本', !!st, st && (st.id + ' ' + st.name))
	let g = base('苏联', 'Allies')
	const inst = String(st.id) + '#1'
	g.hands['苏联'].push(inst)
	g = rules.action(g, 'Allies', 'play_card', { card: inst })
	ok('STATUS 打出后 play_done[苏联]=true', !!(g.play_done && g.play_done['苏联']),
		'play_done=' + JSON.stringify(g.play_done))
	ok('STATUS 已置桌面', (g.table['苏联'] || []).indexOf(inst) >= 0)
}

console.log('\n=== C. RESPONSE：打出占名额 ===')
{
	const rp = CARDS.find(c => c.nation === '苏联' && c.type === 'RESPONSE')
	ok('找到苏联 RESPONSE 样本', !!rp, rp && (rp.id + ' ' + rp.name))
	let g = base('苏联', 'Allies')
	const inst = String(rp.id) + '#1'
	g.hands['苏联'].push(inst)
	g = rules.action(g, 'Allies', 'play_card', { card: inst })
	ok('RESPONSE 打出后 play_done[苏联]=true', !!(g.play_done && g.play_done['苏联']),
		'play_done=' + JSON.stringify(g.play_done))
	ok('RESPONSE 已暗置桌面', (g.table_responses || []).some(x => x.card_id === inst))
}

console.log('\n=== D. ECON：打出占名额 ===')
{
	let g = base('德国', 'Axis')
	g.hands['德国'].push('15217#1')          /* 德国 ECON[潜艇行动]，targets 含英国 */
	g = rules.action(g, 'Axis', 'play_card', { card: '15217#1', target: '英国' })
	ok('ECON 打出后 play_done[德国]=true', !!(g.play_done && g.play_done['德国']),
		'play_done=' + JSON.stringify(g.play_done) + ' log=' + JSON.stringify((g.log || []).slice(-2)))
}

console.log('\n=== E. 额外打出（extra）不应占名额 ===')
{
	/* 直接用 17828 走 extra_play 通道：不占名额（stepPause 的 !extra 守卫） */
	const st = CARDS.find(c => c.nation === '苏联' && c.type === 'EVENT')
	let g = base('苏联', 'Allies')
	g.hands['苏联'].push('17828#1')
	g.extra_play = {
		nation: '苏联', source: 'test', source_name: '测试额外打出',
		filter: 'hand', count: 1, turn: g.turn, phase: 'play',
	}
	g = rules.action(g, 'Allies', 'play_card', { card: '17828#1', spaces: [19] })
	ok('额外打出 17828 后 play_done 未置位（不占名额）',
		!(g.play_done && g.play_done['苏联']), 'play_done=' + JSON.stringify(g.play_done))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
