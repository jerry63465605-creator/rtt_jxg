/*
 * 二级拦截（2026-10-29）：意大利 16701 -> 英国 15352 -> 意大利 16700
 *
 * C1 意大利【反制】16700：15352 无效（代价照付）、16701 照常结算
 * C2 意大利【放弃反制】：15352 生效、16701 无效
 * C3 链结束后状态干净（窗口/队列/深度标记都归零，下一张还能正常问）
 *
 * 用法：node tools/_sim_16701_counter.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const view = (g, role) => R.view(g, role)
const inHand = (g, n, c) => (g.hands[n] || []).indexOf(c) >= 0
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const deckLen = (g, n) => ((g.decks && g.decks[n]) || []).length
const wins = g => (g.armed_offers || []).map(w => w.when + '@' + w.nation +
	'[' + (w.cards || []).map(c => c.card_id) + ']')

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
	g.pending_armed_use = null
	g.__echo_chain_depth = 0
	delete g.__skip_echo_intercept
	I.refresh && I.refresh(g)
	return g
}

console.log('\n=== C1｜意大利【反制】16700（损耗 1 张） ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '16701#1' })          /* 意大利打 16701 */
	R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#7'] })  /* 英国拦 */
	ok('英国打 15352 时给意大利开了反制窗', wins(g).some(x => x.indexOf('意大利[16700#2]') >= 0),
		JSON.stringify(wins(g)))
	ok('15352 尚未结算（仍在中转状态）', !inDisc(g, '英国', '15352#1'))
	const itDeck0 = deckLen(g, '意大利')
	const ukHand0 = (g.hands['英国'] || []).length

	R.action(g, 'Axis', 'use_armed_offer', { card: '16700#2' })    /* 意大利反制 */
	console.log('  log: ' + (g.log || []).slice(-5).join(' | '))
	console.log('  英国手牌=' + JSON.stringify(g.hands['英国']) +
		' 弃牌=' + JSON.stringify(g.discard['英国'] || []) +
		' 意大利弃牌=' + JSON.stringify(g.discard['意大利'] || []))
	ok('意大利损耗 1 张（16700 代价）', deckLen(g, '意大利') === itDeck0 - 1,
		itDeck0 + ' -> ' + deckLen(g, '意大利'))
	ok('16700 进意大利弃牌堆', inDisc(g, '意大利', '16700#2'))
	ok('15352 被反制进弃牌堆', inDisc(g, '英国', '15352#1'))
	ok('★ 15352 的代价照付（英国再弃 1 张手牌）',
		(g.hands['英国'] || []).length === ukHand0 - 2,
		ukHand0 + ' -> ' + (g.hands['英国'] || []).length)
	ok('★ 被 15352 压住的 16701 照常结算（it_viva=true）', g.it_viva === true, 'it_viva=' + g.it_viva)
	ok('16701 进意大利弃牌堆', inDisc(g, '意大利', '16701#1'))
	ok('窗口全清', (g.armed_offers || []).length === 0, JSON.stringify(wins(g)))
	ok('队列/深度/挂起都归零', (g.echo_intercept_queue || []).length === 0 &&
		(g.__echo_chain_depth || 0) === 0 && !g.pending_armed_use,
		'queue=' + JSON.stringify(g.echo_intercept_queue) + ' depth=' + g.__echo_chain_depth)
	ok('操作权归还意大利', g.active === 'Axis', 'active=' + g.active)
}

console.log('\n=== C2｜意大利【放弃反制】 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '16701#1' })
	R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#7'] })
	const itDeck0 = deckLen(g, '意大利')
	R.action(g, 'Axis', 'skip_armed_offer', {})                    /* 意大利放弃反制 */
	console.log('  log: ' + (g.log || []).slice(-4).join(' | '))
	ok('15352 生效：进英国弃牌堆', inDisc(g, '英国', '15352#1'))
	ok('英国付代价（手牌 -2）', (g.hands['英国'] || []).length === 1,
		JSON.stringify(g.hands['英国']))
	ok('16701 被 15352 无效（it_viva 未置位）', !g.it_viva, 'it_viva=' + g.it_viva)
	ok('16701 进意大利弃牌堆', inDisc(g, '意大利', '16701#1'))
	ok('意大利没付代价（没反制）', deckLen(g, '意大利') === itDeck0)
	ok('16700 仍在意大利手里', inHand(g, '意大利', '16700#2'))
	ok('窗口/队列/深度/挂起都归零', (g.armed_offers || []).length === 0 &&
		(g.echo_intercept_queue || []).length === 0 &&
		(g.__echo_chain_depth || 0) === 0 && !g.pending_armed_use,
		JSON.stringify(wins(g)) + ' depth=' + g.__echo_chain_depth)
	ok('操作权归还意大利', g.active === 'Axis', 'active=' + g.active)
}

console.log('\n=== C3｜第一次就放弃（15352 未消耗），下一张卡仍会被询问 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '16701#1' })
	R.action(g, 'Allies', 'skip_armed_offer', {})
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '意大利', card: '15341#20' })
	const w = (g.armed_offers || [])[0]
	ok('下一张卡会重新开窗（按实例记忆，不粘）', !!w && w.cards[0].card_id === '15352#1',
		JSON.stringify((w || {}).cards))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
