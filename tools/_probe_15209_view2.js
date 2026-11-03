/* 15209 伞兵：先发牌再进 play 阶段，看 play_start 机会窗口 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

console.log('PH 常量 = ' + JSON.stringify(I.PH || '未导出'))

function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15209', nation: '德国', dest: 'hand' })
	/* 德国空军@德国（卡面前提：相邻德国空军的地区） */
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: d.id_of('德国') })
	I.refresh(g)
	return g
}

const g = setup()
console.log('手牌里有 15209 = ' + ((g.hands['德国'] || []).some(x => faceOf(x) === '15209')))

const n0 = (g.log || []).length
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
console.log('进 play 阶段 log: ' + logSince(g, n0))

const show = (g, tag) => {
	console.log('\n--- ' + tag + ' ---')
	console.log('  armed_offers = ' + JSON.stringify((g.armed_offers || []).map(w => ({
		when: w.when, nation: w.nation, cards: (w.cards || []).map(x => faceOf(x.card_id || x)),
		pending: w.pending && { need: w.pending.need, cands: (w.pending.candidates || []).length },
	}))))
	const v = R.view(g, 'Axis')
	console.log('  view.armed_offer = ' + JSON.stringify(v.armed_offer && {
		when: v.armed_offer.when, nation: v.armed_offer.nation,
		cards: (v.armed_offer.cards || []).map(x => x.name || faceOf(x.card_id || x)),
		pending: v.armed_offer.pending && { need: v.armed_offer.pending.need, cands: v.armed_offer.pending.candidates },
	}))
	console.log('  view.pending_event_step = ' + JSON.stringify(v.pending_event_step && v.pending_event_step.step))
	console.log('  view.event_budget = ' + JSON.stringify(v.event_budget && { remaining: v.event_budget.remaining, nation: v.event_budget.nation }))
	console.log('  view.pending_echo = ' + JSON.stringify(v.pending_echo && { kind: v.pending_echo.kind }))
	console.log('  view.pending_battle = ' + (v.pending_battle ? '有(' + v.pending_battle.stage + ')' : 'null'))
	console.log('  view.budget_hud = ' + JSON.stringify(v.budget_hud || null))
}
show(g, '进 play 阶段后')

/* 打出 15209（武装卡：先 run，run 会建战斗预算或要求选地区） */
const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15209')
const offers = g.armed_offers || []
if (offers.length && offers[0].cards && offers[0].cards.length) {
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card })
	I.refresh(g)
	console.log('\n发动 15209 log: ' + logSince(g, n1))
	show(g, '发动后')
}
