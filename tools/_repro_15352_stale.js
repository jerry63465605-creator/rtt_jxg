/*
 * 复现（续）：15352 布莱切利园的 armed 窗口「悬挂 / 残留」导致德国增强卡永远打不出
 *
 *  S1 英国不做任何应答，德国接着打【另一张】增强卡
 *  S2 英国把 15352 自己弃掉/用掉后，窗口是否还在
 *  S3 英国放弃后，德国再打另一张增强卡（应重新询问 → 正常）
 *  S4 英国做了无关动作（放弃窗口）后，德国那张被挂起的卡还能不能打出来
 *
 * 用法：node tools/_repro_15352_stale.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.hands['德国'] = ['15213#1', '15216#2']
	g.hands['英国'] = ['15352#1', '15341#7']
	g.table_responses = []
	I.refresh && I.refresh(g)
	return g
}
const hands = (g, n) => (g.hands[n] || []).slice()
const wins = g => (g.armed_offers || []).map(w => w.when + '@' + w.nation)
const tail = (g, n0) => (g.log || []).slice(n0).join(' | ')

console.log('\n=== S1 英国不应答，德国接着打第二张增强卡 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('  打第一张后: active=' + g.active + ' armed=' + JSON.stringify(wins(g)) +
		' 德国手牌=' + JSON.stringify(hands(g, '德国')))
	const n = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15216#2' })
	console.log('  再打第二张: ' + tail(g, n))
	console.log('  德国手牌=' + JSON.stringify(hands(g, '德国')) + ' discard=' + JSON.stringify(g.discard['德国'] || []))
	console.log('  armed=' + JSON.stringify(wins(g)) + ' active=' + g.active)
}

console.log('\n=== S2 窗口开着时，英国把 15352 弃掉（自己做动作） ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('  窗口: ' + JSON.stringify(wins(g)))
	/* 英国推进阶段（无关动作）——按 action 入口守卫应清掉本国窗口 */
	const n = (g.log || []).length
	R.action(g, 'Allies', 'next_phase', {})
	console.log('  英国 next_phase: ' + tail(g, n))
	console.log('  armed=' + JSON.stringify(wins(g)) + ' active=' + g.active)
	const n2 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('  德国重打第一张: ' + tail(g, n2))
	console.log('  德国手牌=' + JSON.stringify(hands(g, '德国')) + ' discard=' + JSON.stringify(g.discard['德国'] || []))
}

console.log('\n=== S3 英国放弃后，德国再打【另一张】增强卡（应重新询问） ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	R.action(g, 'Allies', 'skip_armed_offer', {})
	console.log('  放弃后 active=' + g.active + ' armed=' + JSON.stringify(wins(g)) +
		' 弃牌=' + JSON.stringify(g.discard['德国'] || []))
	const n = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15216#2' })
	console.log('  再打第二张: ' + tail(g, n))
	console.log('  armed=' + JSON.stringify(wins(g)) + ' active=' + g.active +
		' 德国手牌=' + JSON.stringify(hands(g, '德国')))
}

console.log('\n=== S4 英国手里只剩 1 张（15352 自己）——不满足弃牌代价 ===')
{
	const g = fresh()
	g.hands['英国'] = ['15352#1']
	const n = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('  ' + tail(g, n))
	console.log('  armed=' + JSON.stringify(wins(g)) + ' active=' + g.active +
		' 德国弃牌=' + JSON.stringify(g.discard['德国'] || []))
}
