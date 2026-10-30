/*
 * 精确定位：战区移动建海军后，17550 的 status_instant 是在哪一步被武装的？
 *   A. build_piece 之后（同一 action 内）
 *   B. refresh 之后
 *   C. 第一次 view 之后
 *
 * 用法：node tools/_probe_theater_arm_timing.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))
const si = g => JSON.stringify((g.status_instant || []).map(x => x.card_id + ':' + x.window + '@' + NM(x.space)))

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.neutral = {}
	g.hands['美国'] = ['17532#1', '15345#9']
	g.decks['美国'] = ['15345#1', '15345#2', '15345#3']
	g.table = g.table || {}
	g.table['美国'] = ['17550#1']
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.location['us_a'] = d.id_of('夏威夷'); g.piece_nation['us_a'] = '美国'; g.piece_type['us_a'] = 'army'
	g.location['us_b'] = d.id_of('美国'); g.piece_nation['us_b'] = '美国'; g.piece_type['us_b'] = 'army'
	I.refresh(g)
	return g
}

const g = setup()
const sea = (function () {
	for (let i = 1; i < d.spaces.length; i++) {
		if (d.spaces[i] && d.spaces[i].terrain === 'sea' && I.can_build_at(g, '美国', i, 'navy').ok) return i
	}
	return null
})()

R.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 0 })
console.log('打完 17532：stage=' + g.pending_theater.stage + ' status_instant=' + si(g))

R.action(g, 'Allies', 'resolve_theater', { piece: 'us_b' })
console.log('移除后：stage=' + g.pending_theater.stage + ' status_instant=' + si(g))

console.log('\n--- 建海军（' + NM(sea) + '）---')
const n0 = (g.log || []).length
R.action(g, 'Allies', 'resolve_theater', { space: sea })
;(g.log || []).slice(n0).forEach(l => console.log('  log| ' + l))
console.log('  动作刚结束: stage=' + g.pending_theater.stage +
	'  last_built=' + JSON.stringify(g.last_built) + '  status_instant=' + si(g))

I.refresh(g)
console.log('  手动 refresh 后: last_built=' + JSON.stringify(g.last_built) + '  status_instant=' + si(g))

const v = R.view(g, 'Allies')
console.log('  首次 view 后: status_instant=' + si(g))
console.log('  view.table_status(17550)=' + JSON.stringify(
	(v.table_status || []).filter(x => String(x.card_id).indexOf('17550') === 0)
		.map(x => ({ ready: x.ready, reason: x.reason, window: x.window }))))

console.log('\n--- 若再点"下一步"建陆军，窗口是否还在 ---')
const n1 = (g.log || []).length
const army = (function () {
	for (let i = 1; i < d.spaces.length; i++) {
		if (d.spaces[i] && I.can_build_at(g, '美国', i, 'army').ok && I.unit_slot_free(g, '美国', 'army', i).ok) return i
	}
	return null
})()
console.log('  可建陆军地区=' + NM(army))
if (army) {
	R.action(g, 'Allies', 'resolve_theater', { space: army })
	;(g.log || []).slice(n1).forEach(l => console.log('  log| ' + l))
	console.log('  建陆军后: pending_theater=' + JSON.stringify(g.pending_theater) +
		'  status_instant=' + si(g))
}
