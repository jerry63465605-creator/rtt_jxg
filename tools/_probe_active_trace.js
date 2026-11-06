/* 追踪 抵消 之后 active / battle_return_active / pending 的变化 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const EAST = () => d.id_of('东欧'), GER = () => d.id_of('德国')

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

const st = tag => console.log(tag.padEnd(16), 'active=' + g.active, 'ret=' + g.battle_return_active,
	'pb=' + JSON.stringify(g.pending_battle && g.pending_battle.stage),
	'offers=' + JSON.stringify((g.armed_offers || []).map(w => (w.cards || []).length)),
	'queue=' + JSON.stringify((g.pending_air_dispatch || []).length))

st('发起前')
I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
st('defend')
R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
st('counter(抵消)')
let n = 0
while ((g.armed_offers || []).some(w => (w.cards || []).length) && n++ < 4) {
	R.action(g, 'Allies', 'skip_armed_offer', {})
	st('skip#' + n)
}
st('结束后')
