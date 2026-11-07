/* 6601 控制判据 & 14503 候选为空 的内部原因 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

/* ---------- 6601 ---------- */
console.log('=== 6601：apply_marker_ops 的 require 到底看什么 ===')
{
	const g = R.setup(20261107)
	g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	for (const [p, sp] of [['de_w', '西欧'], ['de_h', '德国'], ['de_e', '东欧']])
		R.action(g, 'Axis', 'debug_place', { piece: p, nation: '德国', type: 'army', space: d.id_of(sp) })
	I.refresh(g)
	for (const p of ['de_w', 'de_h', 'de_e']) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	console.log('  各处德国陆军 = ' + JSON.stringify(['西欧', '德国', '东欧'].map(n =>
		[n, I.pieces_on(g, d.id_of(n)).filter(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'army').length])))
	console.log('  补给状态 = ' + JSON.stringify(['de_w', 'de_h', 'de_e'].map(p => [p, !!(I.compute_supply(g).in_supply || {})[p]])))
	/* 直接调执行器看返回 */
	let ml = null
	try {
		ml = I.apply_marker_ops(g, [{ space: d.id_of('德国'), delta: 1, require: ['西欧', '德国', '东欧'], require_nation: '德国' }])
	} catch (e) { ml = 'ERR ' + e.message }
	console.log('  apply_marker_ops = ' + JSON.stringify(ml))
	console.log('  markers[德国] = ' + JSON.stringify((g.markers || {})[d.id_of('德国')]))
}

/* ---------- 14503 ---------- */
console.log('\n=== 14503：pending_script 的 stage / step_kind / 候选 ===')
{
	const g = R.setup(20261107)
	g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_script = null
	for (const face of ['15330', '15334']) {
		R.action(g, 'Allies', 'debug_add_card', { face, nation: '英国', dest: 'hand' })
		I.refresh(g)
		R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
		I.refresh(g)
		const c = (g.hands['英国'] || []).find(x => faceOf(x) === face)
		if (c) R.action(g, 'Allies', 'play_card', { card: c })
		I.refresh(g)
	}
	console.log('  table_responses = ' + JSON.stringify((g.table_responses || []).map(x => ({ id: x.card_id, side: x.owner_side, nation: x.nation, hasId: x.id != null }))))
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '14503', nation: '德国', dest: 'hand' })
	I.refresh(g)
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '14503')
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	const ps = g.pending_script || {}
	console.log('  ps = ' + JSON.stringify({ kind: ps.kind, stage: ps.stage, step: ps.step, answer_nation: ps.answer_nation, target_nation: ps.target_nation, actor: ps.actor, source: ps.source_name }))
	const fn = I.script_step_kind || null
	console.log('  script_step_kind = ' + (fn ? JSON.stringify(fn(ps)) : '(未导出)'))
	const rc = I.script_raw_candidates || null
	console.log('  raw_candidates = ' + (rc ? JSON.stringify(rc(g, ps)) : '(未导出)'))
	const v = R.view(g, 'Allies')
	console.log('  view.pending_script = ' + JSON.stringify(v.pending_script).slice(0, 300))
}
