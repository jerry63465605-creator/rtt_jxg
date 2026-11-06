/*
 * 17811 排查②：抵消成立后（pending_battle.stage='after_air_loss'），
 * 用【不同方式】补机，观察 resume 的后续行为与日志。
 *
 *  B1 用 17811 原地补机（真实路径）
 *  B2 用 debug_place 硬塞一支苏联空军（同样会触发 resume）
 *  B3 什么都不补、直接跳掉 17811（预期：陆军被移除）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const faceOf = x => String(x).split('#')[0]
const EAST = () => d.id_of('东欧'), GER = () => d.id_of('德国')
const dump = (g, n, label) => {
	console.log('  --- ' + label + ' log ---')
	for (const l of (g.log || []).slice(n)) console.log('    ' + l)
	console.log('    东欧=' + JSON.stringify(I.pieces_on(g, EAST()).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')')))
	console.log('    pending_battle=' + JSON.stringify(g.pending_battle && { stage: g.pending_battle.stage, used: g.pending_battle.air_used }))
	console.log('    offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when + '×' + (w.cards || []).map(c => faceOf(c.card_id)))))
}

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	for (const [p, sp] of [['su_m', '莫斯科'], ['su_r', '罗斯'], ['su_u', '乌克兰'], ['su_e', '东欧']])
		R.action(g, 'Allies', 'debug_place', { piece: p, nation: '苏联', type: 'army', space: d.id_of(sp) })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: EAST() })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_army', nation: '德国', type: 'army', space: GER() })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: GER() })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	/* 抵消成立 */
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	return g
}
const off17811 = g => {
	for (const w of (g.armed_offers || []))
		for (const c of (w.cards || [])) if (faceOf(c.card_id) === '17811') return { w, card: c.card_id }
	return null
}

console.log('=== B1: 用 17811 原地补机 ===')
{
	const g = setup()
	const off = off17811(g)
	console.log('  抵消后 pending=' + JSON.stringify(g.pending_battle && g.pending_battle.stage) + '  窗口=' + !!off)
	R.action(g, 'Allies', 'use_armed_offer', { card: off.card })
	let n = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: off.card, space: EAST() })
	dump(g, n, 'B1 补机')
}

console.log('\n=== B2: debug_place 硬塞一支苏联空军（也会触发 resume）===')
{
	const g = setup()
	console.log('  抵消后 pending=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
	let n = (g.log || []).length
	R.action(g, 'Allies', 'debug_place', { piece: 'su_x', nation: '苏联', type: 'air', space: EAST() })
	dump(g, n, 'B2 硬塞空军')
}

console.log('\n=== B3: 什么都不补，跳掉 17811（预期陆军被移除）===')
{
	const g = setup()
	const off = off17811(g)
	let n = (g.log || []).length
	R.action(g, 'Allies', 'skip_armed_offer', {})
	dump(g, n, 'B3 跳过')
}

console.log('\n=== B4: 手动 do_battle 重放（带 defend_air，模拟 resume 内部调用）===')
{
	const g = setup()
	/* 手动补一支空军并清除挂起，模仿 resume 的调用参数 */
	R.action(g, 'Allies', 'debug_place', { piece: 'su_y', nation: '苏联', type: 'air', space: EAST() })
	I.refresh(g)
	console.log('  补机后 pending=' + JSON.stringify(g.pending_battle && g.pending_battle.stage) +
		'  东欧=' + JSON.stringify(I.pieces_on(g, EAST())))
	const n = (g.log || []).length
	const r = I.do_battle(g, '德国', EAST(), 'su_e', 'land', {
		from: 'de_army', defend_air: 'su_y', _air_used: ['su_air', 'de_air', 'su_y'],
	})
	console.log('  do_battle 返回 = ' + JSON.stringify(r && { ok: r.ok, pending: r.pending, reason: r.reason, desc: r.desc }))
	dump(g, n, 'B4 手动重放')
}
