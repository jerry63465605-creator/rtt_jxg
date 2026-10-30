/* B3 细节：view.armed_offer 的真实字段结构（单国 / 多国窗口各一例） */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal

function base() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '意大利'; g.active = 'Axis'; g.turn_phase = 'play'
	g.hands = g.hands || {}
	g.armed_offers = []; g.echo_intercept_queue = []
	g.table_responses = []
	I.refresh && I.refresh(g)
	return g
}

console.log('=== 例 1：单国窗口（enemy_echo_played，只有英国 15352）===')
{
	const g = base()
	g.hands['意大利'] = ['16701#1', '16700#2']
	g.hands['英国'] = ['15352#1', '15341#7']
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '意大利', card: '16701#1' })
	const v = R.view(g, 'Allies')
	console.log(JSON.stringify(v.armed_offer, null, 1))
}

console.log('\n=== 例 2：多国同阵营窗口（piece_removed：美国 16804 + 苏联 17854）===')
{
	const g = base()
	g.hands['美国'] = ['16804#1', '15341#30']
	g.hands['苏联'] = ['17854#2', '15341#31']
	const ctx = { nation: '德国', piece: 'px', piece_nation: '德国', piece_type: 'army', space: 1 }
	I.offer_armed_effects(g, 'piece_removed', ctx)
	const v = R.view(g, 'Allies')
	const ao = v.armed_offer
	console.log('窗口 nation=' + (ao && ao.nation))
	console.log('cards = ' + JSON.stringify((ao && ao.cards || []).map(c => ({
		card: c.card, name: c.name, nation: c.nation, cost: c.cost,
	})), null, 1))
}
