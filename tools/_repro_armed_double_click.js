/*
 * 复现：「手里只有 1 张增强卡，点了多次」是否会重复结算 / 重复扣代价 / 卡丢失。
 *
 * 用 17705《波尔多潜艇基地》(armed watch econ_used) 构造：德国打出[潜艇行动]，
 * 意大利手里只有这一张 —— 窗口出现后连续点 use_armed_offer / skip_armed_offer。
 *
 * 用法：node tools/_repro_armed_double_click.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal

let fail = 0
function ok(m, cond, extra) {
	if (cond) console.log('  ✓ ' + m)
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const discCount = (g, n) => ((g.discard[n] || []).length)
function tail(g, n0) { return (g.log || []).slice(n0) }

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.hands['意大利'] = ['17705#1']
	/* 给牌库塞够牌，让损耗有牌可掉 */
	g.decks['英国'] = []
	for (let i = 0; i < 20; i++) g.decks['英国'].push('15345#9' + i)
	I.refresh && I.refresh(g)
	return g
}

console.log('\n=== A：窗口只开一次，连续点【使用】两次 ===')
{
	const g = fresh()
	I.offer_armed_effects(g, 'econ_used', {
		nation: '德国', tag: '潜艇行动', targets: ['英国'], attrited: { '英国': 3 },
	})
	const w0 = (g.armed_offers || []).map(w => w.when + '#' + (w.cards || []).length)
	console.log('  窗口: ' + JSON.stringify(w0))
	const d0 = discCount(g, '英国')
	let n = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: '17705#1' })
	console.log('  使用#1: ' + tail(g, n).join(' | '))
	const d1 = discCount(g, '英国')
	console.log('  英国弃牌 +' + (d1 - d0) + '，意大利手牌=' + JSON.stringify(g.hands['意大利'] || []) +
		' armed=' + JSON.stringify((g.armed_offers || []).length))

	n = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: '17705#1' })
	console.log('  使用#2: ' + tail(g, n).join(' | ') || '（无日志）')
	const d2 = discCount(g, '英国')
	console.log('  英国弃牌 再 +' + (d2 - d1) + '，意大利手牌=' + JSON.stringify(g.hands['意大利'] || []) +
		' armed=' + JSON.stringify((g.armed_offers || []).length))
	ok('第 1 次使用扣了 3 张（17705 的效果）', d1 - d0 === 3, 'delta=' + (d1 - d0))
	ok('第 2 次使用不重复扣牌', d2 === d1, 'delta=' + (d2 - d1))
	ok('卡已进弃牌堆（没有克隆）', (g.discard['意大利'] || []).indexOf('17705#1') >= 0)
}

console.log('\n=== B：窗口开着时连续点【放弃】3 次 ===')
{
	const g = fresh()
	I.offer_armed_effects(g, 'econ_used', { nation: '德国', tag: '潜艇行动', targets: ['英国'] })
	for (let i = 1; i <= 3; i++) {
		const n = (g.log || []).length
		R.action(g, 'Axis', 'skip_armed_offer', {})
		console.log('  放弃#' + i + ': ' + (tail(g, n).join(' | ') || '（无日志）') +
			' armed=' + (g.armed_offers || []).length +
			' 手牌=' + JSON.stringify(g.hands['意大利'] || []))
	}
	ok('放弃后窗口清空', (g.armed_offers || []).length === 0)
	ok('放弃不改动手牌', (g.hands['意大利'] || []).indexOf('17705#1') >= 0)
	ok('放弃不产生弃牌', discCount(g, '意大利') === 0)
}

console.log('\n=== C：同一 when 重复派发 4 次（模拟日志里连刷 4 条「可打出」） ===')
{
	const g = fresh()
	for (let i = 0; i < 4; i++)
		I.offer_armed_effects(g, 'econ_used', { nation: '德国', tag: '潜艇行动', targets: ['英国'] })
	const logs = (g.log || []).filter(l => /可打出/.test(l))
	console.log('  「可打出」日志 ' + logs.length + ' 条，窗口数=' + (g.armed_offers || []).length +
		'，窗口内卡数=' + JSON.stringify((g.armed_offers || []).map(w => (w.cards || []).length)))
	ok('重复派发只建 1 个窗口', (g.armed_offers || []).length === 1)
	ok('窗口里不会出现重复卡', ((g.armed_offers[0] || {}).cards || []).length === 1,
		JSON.stringify(((g.armed_offers[0] || {}).cards || []).map(c => c.card_id)))
	const d0 = discCount(g, '英国')
	R.action(g, 'Axis', 'use_armed_offer', { card: '17705#1' })
	ok('用掉后只结算 1 次（+3 张）', discCount(g, '英国') - d0 === 3,
		'delta=' + (discCount(g, '英国') - d0))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
