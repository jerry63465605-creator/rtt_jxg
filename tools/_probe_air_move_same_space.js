/*
 * 回归：空军允许【原地调度】以触发 after_deploy_air 类增强/响应卡
 *   A. air_options 把"本国空军所在格"也列为候选（targets + targets_by_air）
 *   B. air_support（target == 原地）：成功、弃 1 张手牌、air_done、日志写"原地"
 *   C. 原地调度仍上报 after_deploy_air（德国 15205 JU-87 窗口出现）
 *   D. 候选按空军逐支给出：已有别的本国空军的格，对"别的空军"不可点（执行端也拒）
 *   E. 目标格没有补给中的本国陆/海军时不在候选里（与执行端同源）
 *
 * 用法：node tools/_probe_air_move_same_space.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

const DE = d.id_of('德国')
const DE2 = (d.spaces[DE].connections || []).map(Number)[0]

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'airforce'
	g.air_done = {}
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.neutral = { '美国': true, '苏联': true }
	g.hands['德国'] = ['15341#60', '15205#1', '15342#61']
	g.decks['德国'] = ['15345#70', '15345#71']
	g.location['de_army'] = DE
	g.piece_nation['de_army'] = '德国'
	g.piece_type['de_army'] = 'army'
	g.location['de_air'] = DE
	g.piece_nation['de_air'] = '德国'
	g.piece_type['de_air'] = 'air'
	I.refresh && I.refresh(g)
	return g
}

console.log('\n=== A：air_options 候选 ===')
{
	const g = fresh()
	const r = R.query(g, 'Axis', 'air_options', {})
	console.log('  union = ' + JSON.stringify((r.targets || []).map(t => t.name)))
	console.log('  by_air = ' + JSON.stringify(r.targets_by_air))
	ok('union 含空军自己所在格', (r.targets || []).some(t => Number(t.id) === DE))
	ok('targets_by_air[de_air] 含自身格',
		((r.targets_by_air || {})['de_air'] || []).some(x => Number(x) === DE),
		JSON.stringify((r.targets_by_air || {})['de_air']))
}

console.log('\n=== B/C：原地调度 ===')
{
	const g = fresh()
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'air_support', { air: 'de_air', target: DE, card: '15341#60' })
	console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
	console.log('  armed=' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation)))
	ok('空军仍在原格', Number(g.location['de_air']) === DE, 'loc=' + g.location['de_air'])
	ok('弃 1 张手牌', (g.hands['德国'] || []).indexOf('15341#60') < 0 &&
		(g.discard['德国'] || []).indexOf('15341#60') >= 0)
	ok('air_done 已置位', !!(g.air_done || {})['德国'])
	ok('日志为"在原地…（不移动）"', (g.log || []).slice(n0).join(' ').indexOf('在原地') >= 0)
	ok('★ 上报 after_deploy_air（15205 窗口）',
		(g.armed_offers || []).some(w => w.when === 'after_deploy_air' && w.nation === '德国'),
		JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation)))
}

console.log('\n=== D：候选按空军逐支给出 ===')
{
	const g = fresh()
	g.location['de_army2'] = DE2; g.piece_nation['de_army2'] = '德国'; g.piece_type['de_army2'] = 'army'
	g.location['de_air2'] = DE2; g.piece_nation['de_air2'] = '德国'; g.piece_type['de_air2'] = 'air'
	I.refresh(g)
	const q = R.query(g, 'Axis', 'air_options', {})
	const a1 = ((q.targets_by_air || {})['de_air'] || []).map(Number)
	const a2 = ((q.targets_by_air || {})['de_air2'] || []).map(Number)
	console.log('  de_air 可去=' + JSON.stringify(a1) + '  de_air2 可去=' + JSON.stringify(a2))
	ok('de_air 不能去 de_air2 所在格', a1.indexOf(DE2) < 0, JSON.stringify(a1))
	ok('de_air2 可原地调度', a2.indexOf(DE2) >= 0, JSON.stringify(a2))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'air_support', { air: 'de_air', target: DE2, card: '15341#60' })
	const lg = (g.log || []).slice(n0).join(' | ')
	ok('执行端也拒绝（已有 1 支德国空军）', lg.indexOf('已有 1 支') >= 0, lg)
	ok('被拒时不扣代价', (g.hands['德国'] || []).indexOf('15341#60') >= 0)
}

console.log('\n=== E：没有补给中的本国陆/海军 → 不进候选 ===')
{
	const g = fresh()
	delete g.location['de_army']
	delete g.piece_nation['de_army']
	delete g.piece_type['de_army']
	I.refresh(g)
	const q = R.query(g, 'Axis', 'air_options', {})
	ok('无载体的格不在候选', !(q.targets || []).some(t => Number(t.id) === DE),
		JSON.stringify((q.targets || []).map(t => t.name)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
