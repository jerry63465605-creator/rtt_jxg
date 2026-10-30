/*
 * 复现：15352《丘吉尔之怒》「即使不打出，依然阻止对方增强卡结算」
 *
 * 场景（德国回合，德国打出增强卡 15213《云雾》，效果=本回合空军无法防御战斗）
 *   ① 15352 暗置在桌面（table_responses）
 *   ② 15352 只在英国手牌里（enemy_echo_played 的 armed 扫描只认 hands）
 *   ③ 英国放弃（skip_armed_offer）后，德国那张增强卡是否照常结算
 *
 * 用法：node tools/_repro_15352_block.js
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

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.hands = g.hands || {}
	g.hands['德国'] = ['15213#1']
	g.hands['英国'] = ['15341#7', '15342#8']
	g.table_responses = []
	I.refresh && I.refresh(g)
	return g
}
const handOf = (g, n) => (g.hands[n] || [])
const discOf = (g, n) => (g.discard[n] || [])
const logTail = (g, from) => (g.log || []).slice(from)

console.log('\n=== ① 15352【暗置在桌面】，德国打增强卡 ===')
{
	const g = fresh()
	g.hands['英国'] = ['15341#7', '15342#8']          /* 15352 不在手牌 */
	g.table_responses = [{ card_id: '15352#1', owner_side: 'allies', nation: '英国', id: '15352#1' }]
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('    log: ' + logTail(g, n0).join(' | '))
	console.log('    armed_offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('暗置的 15352 不该产生 armed 窗口', (g.armed_offers || []).length === 0,
		JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('增强卡 15213 已进弃牌堆（正常结算）', discOf(g, '德国').indexOf('15213#1') >= 0,
		'hand=' + JSON.stringify(handOf(g, '德国')) + ' discard=' + JSON.stringify(discOf(g, '德国')))
	ok('德国的空军防御禁用标记已生效', !!g.no_air_defense || !!g.air_cannot_defend ||
		/云雾|空军无法防御/.test(logTail(g, n0).join(' ')),
		'keys=' + Object.keys(g).filter(k => /air|defend/i.test(k)).join(','))
}

console.log('\n=== ② 15352【在手里】未暗置，德国打增强卡 ===')
{
	const g = fresh()
	g.hands['英国'] = ['15352#1', '15341#7']
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	console.log('    log: ' + logTail(g, n0).join(' | '))
	const win = (g.armed_offers || [])
	console.log('    armed_offers=' + JSON.stringify(win.map(w => ({ when: w.when, nation: w.nation }))))
	ok('手里握着 15352 会开 enemy_echo_played 窗口（符合"敌方打增强卡时"）',
		win.some(w => w.when === 'enemy_echo_played'))
	ok('增强卡此刻尚未结算（还留手牌）',
		handOf(g, '德国').indexOf('15213#1') >= 0)
	ok('操作权已交给英国', g.active === 'Allies', 'active=' + g.active)

	/* —— 英国点【放弃】 —— */
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'skip_armed_offer', {})
	const lg = logTail(g, n1)
	console.log('    放弃后 log: ' + lg.join(' | '))
	console.log('    active=' + g.active + ' armed=' + JSON.stringify((g.armed_offers || []).map(w => w.when)))
	console.log('    德国 hand=' + JSON.stringify(handOf(g, '德国')) + ' discard=' + JSON.stringify(discOf(g, '德国')))
	ok('放弃后窗口关闭', (g.armed_offers || []).length === 0,
		JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('放弃后增强卡照常结算（进弃牌堆）', discOf(g, '德国').indexOf('15213#1') >= 0,
		'hand=' + JSON.stringify(handOf(g, '德国')) + ' discard=' + JSON.stringify(discOf(g, '德国')))
	ok('放弃后未把增强卡当成被拦截', !/无效/.test(lg.join(' ')), lg.join(' | '))
	ok('操作权归还德国', g.active === 'Axis', 'active=' + g.active)
}

console.log('\n=== ③ 15352【打出并弃 1 张手牌】拦截 ===')
{
	const g = fresh()
	g.hands['英国'] = ['15352#1', '15341#7']
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#7'] })
	const lg = logTail(g, n1)
	console.log('    拦截后 log: ' + lg.join(' | '))
	ok('增强卡被丢进弃牌堆', discOf(g, '德国').indexOf('15213#1') >= 0)
	ok('效果不生效（日志含"无效"）', /无效/.test(lg.join(' ')), lg.join(' | '))
	ok('15352 已消耗进英国弃牌堆', discOf(g, '英国').indexOf('15352#1') >= 0,
		JSON.stringify(discOf(g, '英国')))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
