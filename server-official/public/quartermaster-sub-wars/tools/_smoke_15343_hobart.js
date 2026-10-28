/*
 * 15343《霍巴特滑稽坦克》只应在【英国回合】压制敌方状态卡。
 *
 * 回归背景（2026-10-25）：原实现只要卡在桌面就永久压制，
 * 导致意大利回合《海王》17741 有 1 支海军却计 0 分（线上 game 5728）。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const data = I.data

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra ? '  | ' + extra : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* 造局：英国桌面 15343 + 意大利桌面海王 + 场上 1 支意大利海军 */
function make() {
	const g = rules.setup(9901, rules.default_scenario, {})
	g.opening = null
	g.turn_phase = 'scoring'
	g.table['英国'] = ['15343#1']
	g.table['意大利'] = ['17741#1']
	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] === '意大利') delete g.location[p]
	}
	const sea = data.spaces.find(s => s && s.terrain === 'sea')
	g.location['pN1'] = sea.id
	g.piece_nation['pN1'] = '意大利'
	g.piece_type['pN1'] = 'navy'
	I.compute_supply(g)
	return g
}

section('A 英国回合：应当压制')
{
	const g = make()
	g.current_nation = '英国'
	g.active = 'allies'
	ok('A1 敌方海王被压制', I.status_active(g, '17741#1', '意大利') === false,
		'status_active=' + I.status_active(g, '17741#1', '意大利'))
	ok('A2 同阵营（英国自己的）状态卡不受影响', I.status_active(g, '17741#1', '英国') === true)
}

section('B 意大利回合：不应当压制')
{
	const g = make()
	g.current_nation = '意大利'
	g.active = 'axis'
	ok('B1 海王恢复生效', I.status_active(g, '17741#1', '意大利') === true,
		'status_active=' + I.status_active(g, '17741#1', '意大利'))
}

section('C 意大利回合计分：海王应加 1 分')
{
	const g = make()
	g.current_nation = '意大利'
	g.active = 'axis'
	const r = I.phase_scoring(g, '意大利')
	const hit = (r.results || []).some(x => (x.items || []).some(i => String(i.card).indexOf('17741') === 0))
	ok('C1 计分明细里有《海王》', hit, JSON.stringify(r.results))
	ok('C2 加分 >= 1（1 支海军）', r.gained >= 1, 'gained=' + r.gained)
}

section('D 英国回合计分：海王不应计分')
{
	const g = make()
	g.current_nation = '英国'
	g.active = 'allies'
	const r = I.phase_scoring(g, '英国')
	const hit = (r.results || []).some(x => (x.items || []).some(i => String(i.card).indexOf('17741') === 0))
	ok('D1 计分明细里没有《海王》', !hit, JSON.stringify(r.results))
}

section('E 德国回合：轴心状态卡生效')
{
	const g = make()
	g.current_nation = '德国'
	g.active = 'axis'
	ok('E1 海王生效', I.status_active(g, '17741#1', '意大利') === true)
}

section('F 没有 15343 时：一直生效')
{
	const g = make()
	g.table['英国'] = []
	g.current_nation = '英国'
	ok('F1 无 15343 -> 不压制', I.status_active(g, '17741#1', '意大利') === true)
}

console.log('\n' + '='.repeat(46))
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) {
	console.log('失败项：' + fails.join(', '))
	process.exit(1)
}
console.log('ALL PASS')
