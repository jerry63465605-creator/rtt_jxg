/* 对照：无云雾时，15330 救回陆军应【连空军一起复原】（既有玩家口径 2026-10-28） */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const W = d.id_of('西欧')

const g = R.setup(7)
g.opening = null
I.refresh(g)

/* 英国暗置 15330 */
R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
R.action(g, 'Allies', 'debug_add_card', { face: '15330', nation: '英国', dest: 'hand' })
I.refresh(g)
{
	const c = (g.hands['英国'] || []).find(x => faceOf(x) === '15330')
	R.action(g, 'Allies', 'play_card', { card: c })
}
/* 布阵（不放云雾） */
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_def', nation: '英国', type: 'army', space: W })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_air', nation: '英国', type: 'air', space: W })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_navy', nation: '英国', type: 'navy', space: d.id_of('北海') })
R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)

const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15201')
const atk = Object.keys(g.location).find(p =>
	g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === d.id_of('德国'))
R.action(g, 'Axis', 'play_card', { card, space: W, piece: 'uk_def', from: atk })
const pb = g.pending_battle || {}
console.log('无云雾：retreats=' + JSON.stringify((pb.retreats || []).map(r => r && r.name)) +
	' airs=' + JSON.stringify(pb.airs))
R.action(g, 'Allies', 'resolve_battle', { declined: true })
console.log('decline 后 空军=' + String(g.location['uk_air']) + '（应仍在<北海>，不是被删）')
R.action(g, 'Allies', 'trigger_response', {})
console.log('触发 15330 后 => 陆军=' + String(g.location['uk_def']) + ' 空军=' + String(g.location['uk_air']))
