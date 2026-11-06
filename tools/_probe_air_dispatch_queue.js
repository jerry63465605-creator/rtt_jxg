/* 只读排查：抵消时两国各掉 1 架 → pending_air_dispatch 是否被消费（B10 部分回退后） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
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

I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
console.log('① 代受待表态:', g.active, 'pb=', g.pending_battle && g.pending_battle.stage)
R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
console.log('② 抵消后 offers=', JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, cards: (w.cards || []).map(c => faceOf(c.card_id)) }))))
console.log('   pending_air_dispatch=', JSON.stringify((g.pending_air_dispatch || []).map(c => c.piece_nation + '/' + c.piece)))
console.log('   两架空军 location=', JSON.stringify({ su_air: g.location['su_air'], de_air: g.location['de_air'] }))

/* 处理掉当前窗口（skip），观察队列是否被续派 */
let round = 0
while ((g.armed_offers || []).some(w => (w.cards || []).length) && round++ < 4) {
	R.action(g, 'Allies', 'skip_armed_offer', {})
	R.action(g, 'Axis', 'skip_armed_offer', {})
	console.log('   处理窗口后第' + round + ' 轮: offers=' +
		JSON.stringify((g.armed_offers || []).map(w => (w.cards || []).length)) +
		'  queue=' + JSON.stringify((g.pending_air_dispatch || []).length))
}
console.log('③ 最终 queue=', JSON.stringify((g.pending_air_dispatch || []).map(c => c.piece_nation + '/' + c.piece)),
	' pending_battle=', JSON.stringify(g.pending_battle && g.pending_battle.stage))
