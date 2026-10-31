/*
 * 探查 v3：15311《马奇诺防线》（<西欧>法国陆军不会被移除）在云雾下救陆军时，
 * 法国空军会不会被顺带复原（期望：不会）。
 *
 * 15311 是 EFFECT + armed when='piece_removed'（watch）—— 留在手里即可，事件发生时自动询问，
 * 代价 = 弃 4 张手牌（arg.drop）。
 *
 * 用法：node tools/_probe_15213_restore3.js [withClouds]
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const W = d.id_of('西欧')
const withClouds = (process.argv[2] || '1') !== '0'

const g = R.setup(7)
g.opening = null
I.refresh(g)

/* 布阵：法国陆军 + 法国空军 @西欧；英国海军@北海（给空军载体/撤退位）；英国手里 15311 + 4 张代价牌 */
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
R.action(g, 'Allies', 'debug_place', { piece: 'fr_def', nation: '法国', type: 'army', space: W })
R.action(g, 'Allies', 'debug_place', { piece: 'fr_air', nation: '法国', type: 'air', space: W })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_navy', nation: '英国', type: 'navy', space: d.id_of('北海') })
R.action(g, 'Allies', 'debug_add_card', { face: '15311', nation: '英国', dest: 'hand' })
for (const f of ['15300', '15301', '15302', '15303'])
	R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
if (withClouds) R.action(g, 'Axis', 'debug_add_card', { face: '15213', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)

if (withClouds) {
	const cl = (g.hands['德国'] || []).find(x => faceOf(x) === '15213')
	R.action(g, 'Axis', 'play_card', { card: cl })
	console.log('云雾: ' + logSince(g, 0).slice(-80))
}

/* 发起陆战：受害者 = 法国陆军@西欧 */
{
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15201')
	const atk = Object.keys(g.location).find(p =>
		g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === d.id_of('德国'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card, space: W, piece: 'fr_def', from: atk })
	console.log('attack: ' + logSince(g, n0))
	const pb = g.pending_battle || {}
	console.log('  挂起: airs=' + JSON.stringify(pb.airs) + ' retreats=' +
		JSON.stringify((pb.retreats || []).map(r => r && r.name)) + ' air_no_retreat=' + pb.air_no_retreat)
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	console.log('decline: ' + logSince(g, n1))
}

console.log('  decline 后: 法国陆军=' + String(g.location['fr_def']) +
	' 法国空军=' + String(g.location['fr_air']))

/* 看 15311 窗口 */
const v = R.view(g, 'Allies')
console.log('  armed_offer=' + JSON.stringify(v.armed_offer && {
	when: v.armed_offer.when, cards: (v.armed_offer.cards || []).map(c => c.name),
	cost: v.armed_offer.cards && v.armed_offer.cards[0] && v.armed_offer.cards[0].cost,
}))
console.log('  pending_trigger=' + JSON.stringify(v.pending_trigger && {
	on: v.pending_trigger.on, cands: (v.pending_trigger.candidates || []).map(c => c.name),
}))

if (v.armed_offer && (v.armed_offer.cards || []).length) {
	const cd = v.armed_offer.cards[0]
	const pay = (g.hands['英国'] || []).filter(x => faceOf(x) !== '15311').slice(0, 4)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cd.card, drop: pay })
	console.log('  15311 use: ' + logSince(g, n0))
	console.log('  => 法国陆军=' + String(g.location['fr_def']) + ' 法国空军=' + String(g.location['fr_air']))
} else {
	console.log('  ⚠ 没有 15311 窗口')
}
