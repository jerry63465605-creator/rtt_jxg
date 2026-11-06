/* 隔离排查：seize_air 后 17811 为何不开窗 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const EAST = () => d.id_of('东欧')
const BALKAN = () => d.id_of('巴尔干')

console.log('导出的函数:offer_armed_effects=', typeof I.offer_armed_effects,
	' remove_air_with_piece_removed=', typeof I.remove_air_with_piece_removed,
	' su_air_deploy_spaces=', typeof I.su_air_deploy_spaces)

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
I.refresh(g)
R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
R.action(g, 'Allies', 'debug_place', { piece: 'su_a', nation: '苏联', type: 'army', space: EAST() })
R.action(g, 'Allies', 'debug_place', { piece: 'su_f', nation: '苏联', type: 'air', space: EAST() })
R.action(g, 'Axis', 'debug_place', { piece: 'jp_a', nation: '日本', type: 'army', space: BALKAN() })
R.action(g, 'Axis', 'debug_place', { piece: 'jp_k', nation: '日本', type: 'air', space: BALKAN() })
R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
I.refresh(g)
for (const p of ['su_a', 'su_f', 'jp_a', 'jp_k']) I.grant_supply(g, p, g.turn)
I.refresh(g)

const sup = I.compute_supply(g)
console.log('补给：su_a=', !!sup.in_supply['su_a'], ' su_f=', !!sup.in_supply['su_f'], ' jp_k=', !!sup.in_supply['jp_k'])
if (I.su_air_deploy_spaces) console.log('su_air_deploy_spaces(东欧)=', JSON.stringify(I.su_air_deploy_spaces(g, EAST()).map(x => d.name_of(x))))

/* ① 手工删除 + 手工派发，看 ready 是否成立 */
{
	const g2 = g
	const ctx = { nation: '日本', piece: 'su_f', piece_id: 'su_f', piece_nation: '苏联', piece_type: 'air', space: EAST(), reason: 'piece_removed', was_supplied: true }
	if (I.remove_air_with_piece_removed) {
		I.remove_air_with_piece_removed(g2, 'su_f', EAST(), '日本')
		I.refresh(g2)
	} else { delete g2.location['su_f']; I.refresh(g2) }
	console.log('① 助手派发后 offers=', JSON.stringify((g2.armed_offers || []).map(w => ({ when: w.when, n: (w.cards || []).length }))))
	if (I.offer_armed_effects) {
		I.offer_armed_effects(g2, 'piece_removed', ctx)
		I.refresh(g2)
		console.log('② 手工 offer 后 offers=', JSON.stringify((g2.armed_offers || []).map(w => ({ when: w.when, cards: (w.cards || []).map(c => String(c.card_id).split('#')[0]) }))))
	}
}

/* ③ 走真实 seize_air */
{
	const g3 = R.setup(7)
	g3.opening = null
	g3.neutral = { '苏联': false, '美国': false }
	I.refresh(g3)
	R.action(g3, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	R.action(g3, 'Allies', 'debug_place', { piece: 'su_a', nation: '苏联', type: 'army', space: EAST() })
	R.action(g3, 'Allies', 'debug_place', { piece: 'su_f', nation: '苏联', type: 'air', space: EAST() })
	R.action(g3, 'Axis', 'debug_place', { piece: 'jp_a', nation: '日本', type: 'army', space: BALKAN() })
	R.action(g3, 'Axis', 'debug_place', { piece: 'jp_k', nation: '日本', type: 'air', space: BALKAN() })
	R.action(g3, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g3)
	for (const p of ['su_a', 'su_f', 'jp_a', 'jp_k']) I.grant_supply(g3, p, g3.turn)
	I.refresh(g3)
	const r = I.seize_air(g3, '日本', EAST(), 'jp_k', { by: 'card' })
	console.log('③ seize=', JSON.stringify(r && { ok: r.ok, removed: r.removed }),
		' offers=', JSON.stringify((g3.armed_offers || []).map(w => ({ when: w.when, n: (w.cards || []).length }))),
		' queue=', JSON.stringify((g3.pending_air_dispatch || []).length))
}
