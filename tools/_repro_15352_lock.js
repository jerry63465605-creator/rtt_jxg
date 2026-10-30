/*
 * 复现（关键）：英国手里握着 15352，德国打增强卡被挂起后，
 * 德国这个回合还能不能做别的事？（= "不打出也把对方锁住"）
 *
 *  D1 德国推进阶段
 *  D2 德国打第二张增强卡
 *  D3 德国弃 1 张手牌（出牌阶段三选一）
 *  D4 英国一直不应答 → 德国那张牌是否永远留在手牌
 *
 * 用法：node tools/_repro_15352_lock.js
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
	g.hands['德国'] = ['15213#1', '15216#2', '15211#3']
	g.hands['英国'] = ['15352#1', '15341#7']
	g.table_responses = []
	I.refresh && I.refresh(g)
	return g
}
const wins = g => (g.armed_offers || []).map(w => w.when + '@' + w.nation +
	' ctxCard=' + ((w.ctx || {}).card || '-'))
const tail = (g, n0) => ((g.log || []).slice(n0).join(' | ') || '（无日志）')

console.log('\n=== D1：窗口开着时，德国推进阶段 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('  挂起后 armed=' + JSON.stringify(wins(g)) + ' active=' + g.active +
		' 德国手牌=' + JSON.stringify(g.hands['德国']))
	const n = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	console.log('  德国 next_phase: ' + tail(g, n))
	console.log('  => 阶段=' + g.turn_phase + ' armed=' + JSON.stringify(wins(g)) +
		' active=' + g.active)
}

console.log('\n=== D2：窗口开着时，德国再打第二张增强卡（覆盖测试） ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('  第一张后 ctxCard=' + JSON.stringify(wins(g)))
	const n = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15216#2' })
	console.log('  第二张: ' + tail(g, n))
	console.log('  => armed=' + JSON.stringify(wins(g)) +
		' 德国手牌=' + JSON.stringify(g.hands['德国']) +
		' 德国弃牌=' + JSON.stringify(g.discard['德国'] || []))
	/* 英国放弃后，谁被续跑？ */
	const n2 = (g.log || []).length
	R.action(g, 'Allies', 'skip_armed_offer', {})
	console.log('  英国放弃: ' + tail(g, n2))
	console.log('  => 德国手牌=' + JSON.stringify(g.hands['德国']) +
		' 弃牌=' + JSON.stringify(g.discard['德国'] || []))
}

console.log('\n=== D3：窗口开着时，德国弃 1 张手牌 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	const n = (g.log || []).length
	R.action(g, 'Axis', 'discard_one', { card: '15211#3' })
	console.log('  德国 discard_one: ' + tail(g, n))
	console.log('  => armed=' + JSON.stringify(wins(g)) + ' active=' + g.active +
		' 德国手牌=' + JSON.stringify(g.hands['德国']))
}

console.log('\n=== D4：谁都不应答，德国那张卡会怎样（再打一次同一张） ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	const n = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('  重复点同一张: ' + tail(g, n))
	console.log('  => armed=' + JSON.stringify(wins(g)) +
		' 德国手牌=' + JSON.stringify(g.hands['德国']))
}
