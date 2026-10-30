/*
 * 排查：英国用 15352 拦截 16701 时，意大利的 16700 有没有被询问？
 *   —— 15352 本身也是【增强卡】，按 16700 卡面"敌方打出增强卡时"应当可以再拦。
 *
 * 用法：node tools/_probe_16700_chain.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['意大利'] = ['16701#1', '16700#2', '15341#20']
	g.hands['英国'] = ['15352#1', '15341#7', '15342#8']
	g.decks['意大利'] = ['15345#80', '15345#81', '15345#82']
	g.table_responses = []
	g.armed_offers = []
	g.echo_intercept_queue = []
	g.echo_intercept_skipped = {}
	delete g.__skip_echo_intercept
	I.refresh && I.refresh(g)
	return g
}
const wins = g => (g.armed_offers || []).map(w => w.when + '@' + w.nation +
	'[' + (w.cards || []).map(c => c.card_id) + ']')

const g = fresh()

console.log('=== ① 16700 的 ready 是否认"英国打出 15352"这件事 ===')
const cfg16700 = I.ECHO_EFFECTS['16700']
console.log('  ready(ctx{英国,15352#1}) = ' +
	cfg16700.armed.ready(g, { nation: '英国', card: '15352#1' }))
console.log('  意大利牌库 = ' + (g.decks['意大利'] || []).length + ' 张（够损耗 1）')

console.log('\n=== ② 意大利打出 16701 -> 英国 15352 窗口 ===')
R.action(g, 'Axis', 'play_card', { card: '16701#1' })
console.log('  窗口=' + JSON.stringify(wins(g)) + '  active=' + g.active)

console.log('\n=== ③ 英国【发动】15352（弃 1 张手牌） ===')
const n0 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#7'] })
console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
console.log('  结算后窗口=' + JSON.stringify(wins(g)) + '  active=' + g.active)
console.log('  意大利 16700 手牌状态=' +
	((g.hands['意大利'] || []).indexOf('16700#2') >= 0 ? '仍在手（没被问过）' : '已使用'))
console.log('  意大利牌库=' + (g.decks['意大利'] || []).length + ' 张（没被损耗）')
console.log('  it_viva=' + g.it_viva + '（16701 已被无效）')

console.log('\n=== ④ 结论 ===')
console.log('  15352 已进英国弃牌堆=' + ((g.discard['英国'] || []).indexOf('15352#1') >= 0))
console.log('  上述"结算后窗口"若为空 => use_armed_offer 打出增强卡时【没有派发 enemy_echo_played】')
