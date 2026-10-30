/* 找一个真实存在的"同阵营多国"窗口，验证 cards[] 缺 nation 的影响 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal
const EE = I.ECHO_EFFECTS || {}

for (const f of ['16804', '17854', '17711', '15311', '15351']) {
	const ar = (EE[f] || {}).armed
	if (!ar) continue
	console.log(f + ' when=' + (Array.isArray(ar.when) ? ar.when.join('/') : ar.when) +
		'  ready=' + String(ar.ready || '').replace(/\s+/g, ' ').slice(0, 150))
}

/* 逐个候选用最宽松 ctx 试：after_build_army / piece_removed */
const g = R.setup(1)
g.opening = null
g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'
g.hands['美国'] = ['16804#1', '15341#30']
g.hands['苏联'] = ['17854#2', '15341#31']
g.hands['意大利'] = ['17711#3', '15341#32']
I.refresh && I.refresh(g)

const tries = [
	['after_build_army', { nation: '德国', space: 1, type: 'army', piece_id: 'p1' }],
	['after_build_army', { nation: '日本', space: 1, type: 'army', piece_id: 'p1' }],
	['after_recruit', { nation: '日本', space: 1, type: 'army', piece_id: 'p1' }],
	['piece_removed', { nation: '德国', space: 1, piece: 'p1', piece_nation: '德国', piece_type: 'army' }],
	['piece_removed', { nation: '英国', space: 1, piece: 'p1', piece_nation: '英国', piece_type: 'army' }],
]
for (const [when, ctx] of tries) {
	g.armed_offers = []
	I.offer_armed_effects(g, when, ctx)
	const w = (g.armed_offers || [])[0]
	if (w && (w.cards || []).length) {
		console.log('\n命中窗口 when=' + when + ' ctx.nation=' + ctx.nation +
			'  窗口 nation=' + w.nation)
		for (const c of w.cards) console.log('   card=' + c.card_id + ' nation=' + c.nation + ' name=' + c.name)
	}
}
