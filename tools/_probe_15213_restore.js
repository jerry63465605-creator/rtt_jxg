/*
 * 探查：15213《云雾》把防守方空军原地移除后，用 15330《防御姿态》/ 15311《马奇诺防线》救陆军时，
 * 空军会不会被"顺带复原"（用户疑问）。
 *
 * 用法：node tools/_probe_15213_restore.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const W = d.id_of('西欧')

function setup(extraCards) {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_def', nation: '英国', type: 'army', space: W })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_air', nation: '英国', type: 'air', space: W })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_navy', nation: '英国', type: 'navy', space: d.id_of('北海') })
	R.action(g, 'Axis', 'debug_add_card', { face: '15213', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
	for (const f of (extraCards || []))
		R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const cl = (g.hands['德国'] || []).find(x => faceOf(x) === '15213')
	R.action(g, 'Axis', 'play_card', { card: cl })
	return g
}

function attack(g) {
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15201')
	const atk = Object.keys(g.location).find(p =>
		g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === d.id_of('德国'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card, space: W, piece: 'uk_def', from: atk })
	return logSince(g, n0)
}

function dump(g, label) {
	console.log('  [' + label + '] 陆军=', String(g.location['uk_def']), ' 空军=', String(g.location['uk_air']),
		' pending_battle=', JSON.stringify(g.pending_battle && g.pending_battle.stage),
		' pending_trigger=', JSON.stringify((g.pending_trigger || g.response_stack || [])
			.map(f => (f.name || f.card_id || '') + (f.candidates ? '(c' + f.candidates.length + ')' : ''))))
}

console.log('=== 场景 1：手里有 15330《防御姿态》 ===')
{
	const g = setup(['15330'])
	attack(g)
	dump(g, '挂起战斗')
	let n0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	console.log('  decline log: ' + logSince(g, n0))
	dump(g, 'decline 后')
	const v = R.view(g, 'Allies')
	console.log('  view.pending_trigger=', JSON.stringify(v.pending_trigger && {
		on: v.pending_trigger.on, pre: v.pending_trigger.pre,
		cands: (v.pending_trigger.candidates || []).map(c => c.name),
	}))
	console.log('  view.response_choice=', JSON.stringify(v.response_choice && {
		card: v.response_choice.card_id, cands: v.response_choice.candidates,
	}))
	console.log('  英国手牌=', JSON.stringify((g.hands['英国'] || []).map(faceOf)))
}

console.log('\n=== 场景 2：手里有 15311《马奇诺防线》 ===')
{
	const g = setup(['15311', '15300', '15301', '15302', '15303'])
	attack(g)
	dump(g, '挂起战斗')
	let n0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	console.log('  decline log: ' + logSince(g, n0))
	dump(g, 'decline 后')
	const v = R.view(g, 'Allies')
	console.log('  view.pending_trigger=', JSON.stringify(v.pending_trigger && {
		on: v.pending_trigger.on, cands: (v.pending_trigger.candidates || []).map(c => c.name),
	}))
}
