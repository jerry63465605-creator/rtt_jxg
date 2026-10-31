/*
 * 探查 v2：15330《防御姿态》/ 15311《马奇诺防线》救回陆军时，云雾已被"原地移除"的空军
 * 会不会被顺带复原（正确应为：不还原 —— 云雾下空军是"被消灭"，不是"撤离"）。
 *
 * 关键：响应卡（15330）必须【先暗置到桌面】(table_responses) 才会在 piece_removed 时弹窗；
 *       15311 是 EFFECT kind='any'，同样需要先暗置（走 play_card）。
 *
 * 用法：node tools/_probe_15213_restore2.js [15330|15311]
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const W = d.id_of('西欧')
const which = process.argv[2] || '15330'

const g = R.setup(7)
g.opening = null
I.refresh(g)

/* ① 英国出牌阶段：暗置响应卡/增强卡 */
R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
R.action(g, 'Allies', 'debug_add_card', { face: which, nation: '英国', dest: 'hand' })
I.refresh(g)
{
	const c = (g.hands['英国'] || []).find(x => faceOf(x) === which)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: c })
	console.log('[' + which + '] 暗置 log: ' + logSince(g, n0))
	console.log('  table_responses=', JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id || x))))
	console.log('  table=', JSON.stringify((g.table['英国'] || []).map(faceOf)))
}

/* ② 布阵 + 德国云雾 */
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_def', nation: '英国', type: 'army', space: W })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_air', nation: '英国', type: 'air', space: W })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_navy', nation: '英国', type: 'navy', space: d.id_of('北海') })
R.action(g, 'Axis', 'debug_add_card', { face: '15213', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
{
	const cl = (g.hands['德国'] || []).find(x => faceOf(x) === '15213')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cl })
	console.log('云雾 log: ' + logSince(g, n0))
}

/* ③ 发起陆战 -> 英国不代受（空军原地移除） */
{
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15201')
	const atk = Object.keys(g.location).find(p =>
		g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === d.id_of('德国'))
	let n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card, space: W, piece: 'uk_def', from: atk })
	console.log('attack log: ' + logSince(g, n0))
	n0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	console.log('decline log: ' + logSince(g, n0))
}

/* ④ 看有没有弹 piece_removed 窗口 */
const v = R.view(g, 'Allies')
console.log('  pending_trigger=', JSON.stringify(v.pending_trigger && {
	on: v.pending_trigger.on,
	cands: (v.pending_trigger.candidates || []).map(c => c.name),
}))
console.log('  armed_offer=', JSON.stringify(v.armed_offer && {
	when: v.armed_offer.when,
	cards: (v.armed_offer.cards || []).map(c => c.name),
}))
console.log('  此刻 陆军=', String(g.location['uk_def']), ' 空军=', String(g.location['uk_air']))

/* ⑤ 触发（若有窗口） */
if (v.pending_trigger) {
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'trigger_response', {})
	console.log('  trigger log: ' + logSince(g, n0))
	console.log('  => 陆军=', String(g.location['uk_def']), ' 空军=', String(g.location['uk_air']))
	console.log('  protect=', JSON.stringify(g.protect || g.protected || null))
} else if (v.armed_offer) {
	const n0 = (g.log || []).length
	const cd = (v.armed_offer.cards || [])[0]
	R.action(g, 'Allies', 'use_armed_offer', { card: cd && cd.card, drop: [] })
	console.log('  armed use log: ' + logSince(g, n0))
	console.log('  => 陆军=', String(g.location['uk_def']), ' 空军=', String(g.location['uk_air']))
} else {
	console.log('  ⚠ 没有出现任何窗口（' + which + ' 未被询问）')
}
