/* 对照：refresh 本身会不会剪掉窗口（区分"调试动作的锅" vs "refresh 剪枝"） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

function setup() {
	const g = R.setup(20261107)
	g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	I.refresh(g)
	I.offer_armed_effects(g, 'enemy_echo_played', {
		nation: '德国', card: '15205#999', space: null, via: 'play', window: 'enemy_echo_played',
	})
	I.refresh(g)
	return g
}
const ao = g => (g.armed_offers || []).filter(w => (w.cards || []).length).length

{
	const g = setup()
	console.log('A 造好后 = ' + ao(g))
	I.refresh(g)
	console.log('B 再 refresh 一次 = ' + ao(g) + '   ← 若变 0，说明 refresh 剪枝，不是调试动作')
}
{
	const g = setup()
	console.log('C 造好后 = ' + ao(g))
	R.action(g, 'Allies', 'debug_attrition', { n: 1 })
	console.log('D 损耗 1 张后 = ' + ao(g))
	R.action(g, 'Allies', 'log', {})
	console.log('E 普通 log 动作后 = ' + ao(g))
}
