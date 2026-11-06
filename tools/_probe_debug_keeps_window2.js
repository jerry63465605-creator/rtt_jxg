/* 逐步定位：debug_attrition 里哪一步清掉了 armed_offers */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const ao = g => JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, n: (w.cards || []).length })))

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

/* 1) 直接调原子 + refresh（不经 action） */
{
	const g = setup()
	console.log('1 初始        = ' + ao(g))
	I.init_nation_deck(g, '美国')
	console.log('2 init_deck   = ' + ao(g))
	const lost = I.attrition_cards(g, '美国', 1)
	console.log('3 attrition   = ' + ao(g) + '  lost=' + lost.length)
	I.refresh(g)
	console.log('4 refresh     = ' + ao(g))
}

/* 2) 走 action，但把每一步拆开看 */
{
	const g = setup()
	console.log('\nA 初始        = ' + ao(g))
	R.action(g, 'Allies', 'debug_attrition', { n: 1 })
	console.log('B 经 action   = ' + ao(g))
	console.log('   log 末两条 = ' + JSON.stringify((g.log || []).slice(-2)))
}

/* 3) 只做 score（不碰牌） */
{
	const g = setup()
	console.log('\nS 初始        = ' + ao(g))
	R.action(g, 'Allies', 'debug_score', { faction: 'allies', delta: 1 })
	console.log('S score 后    = ' + ao(g))
}

/* 4) 只做 restore（弃牌堆空 → 提前 return，不 refresh） */
{
	const g = setup()
	g.discard['美国'] = []
	console.log('\nT 初始        = ' + ao(g))
	R.action(g, 'Allies', 'debug_restore', { n: 1 })
	console.log('T restore 后  = ' + ao(g) + '  log=' + JSON.stringify((g.log || []).slice(-1)))
}
