/*
 * 复现：意大利【手里只有 1 张增强卡】，计分阶段却反复弹出「可打出 1 张增强卡」，
 *       多次点【放弃】是否会把状态搞乱（窗口残留 / 重复结算 / 卡丢失）。
 *
 * 观察点：每次 offer 的 when、窗口数量、log 条数、手牌是否还在。
 *
 * 用法：node tools/_repro_scoring_armed_repeat.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal

function fresh(cards) {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.turn_phase = 'scoring'
	g.hands = g.hands || {}
	g.hands['意大利'] = cards.slice()
	g.table_status = g.table_status || {}
	I.refresh && I.refresh(g)
	return g
}
const wins = g => (g.armed_offers || []).map(w => w.when + '@' + (w.nation || '?') +
	'#cards=' + ((w.cards || []).length))
const tail = (g, n0) => (g.log || []).slice(n0)

console.log('\n=== A：意大利手里 1 张 armed 增强卡（17711 维希法国殖民地），推进计分阶段 ===')
{
	const g = fresh(['17711#1'])
	let n = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	console.log('  log: ' + tail(g, n).join(' | '))
	console.log('  armed=' + JSON.stringify(wins(g)) + ' active=' + g.active)
	/* 连续点放弃 4 次，看状态是否稳定 */
	for (let i = 1; i <= 4; i++) {
		n = (g.log || []).length
		R.action(g, i % 2 === 1 ? 'Axis' : 'Allies', 'skip_armed_offer', {})
		console.log('  放弃#' + i + ': ' + tail(g, n).join(' | ') +
			'  => armed=' + JSON.stringify(wins(g)) +
			' 手牌=' + JSON.stringify((g.hands['意大利'] || [])) +
			' active=' + g.active)
	}
}

console.log('\n=== B：手里有卡时反复调用同一窗口的派发（模拟重复事件） ===')
{
	const g = fresh(['17711#1'])
	for (let i = 0; i < 4; i++) {
		I.offer_armed_effects(g, 'piece_removed', { nation: '英国', piece: 'x', piece_nation: '英国', piece_type: 'army' })
	}
	console.log('  4 次派发后 armed=' + JSON.stringify(wins(g)))
	const before = (g.log || []).filter(l => /可打出/.test(l)).length
	console.log('  「可打出」日志条数=' + before)
	const n = (g.log || []).length
	R.action(g, 'Allies', 'skip_armed_offer', {})
	console.log('  英国放弃: ' + tail(g, n).join(' | '))
	console.log('  armed=' + JSON.stringify(wins(g)) + ' active=' + g.active +
		' 意大利手牌=' + JSON.stringify(g.hands['意大利'] || []))
}

console.log('\n=== C：手里 1 张卡，先用再放弃（重复点击的极端情况） ===')
{
	const g = fresh(['17711#1'])
	I.offer_armed_effects(g, 'piece_removed', { nation: '英国', piece: 'x', piece_nation: '英国', piece_type: 'army' })
	const n = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: '17711#1' })
	console.log('  使用#' + 1 + ': ' + tail(g, n).join(' | '))
	console.log('  armed=' + JSON.stringify(wins(g)) + ' 手牌=' + JSON.stringify(g.hands['意大利'] || []) +
		' 弃牌=' + JSON.stringify(g.discard['意大利'] || []))
	/* 再点一次（窗口早已关闭） */
	const n2 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: '17711#1' })
	console.log('  再点使用: ' + tail(g, n2).join(' | '))
	console.log('  手牌=' + JSON.stringify(g.hands['意大利'] || []) +
		' 弃牌=' + JSON.stringify(g.discard['意大利'] || []) +
		' armed=' + JSON.stringify(wins(g)))
}
