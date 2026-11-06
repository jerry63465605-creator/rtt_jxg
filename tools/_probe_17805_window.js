/* 17805 的 armed 窗口结构 & use_armed_offer 为何返回"当前没有可打出的增强卡" */
const path = require('path')
const ROOT = require('path').join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(20261107)
g.pending_battle = null; g.pending_econ = null
g.armed_offers = []; g.response_queue = []; g.response_stack = []
g.pending_status_react = null; g.pending_red = null
I.refresh(g)
R.action(g, 'Axis', 'debug_add_card', { face: '15254', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
const de = (g.hands['德国'] || []).find(x => faceOf(x) === '15254')
R.action(g, 'Axis', 'play_card', { card: de })
I.refresh(g)
R.action(g, 'Allies', 'debug_add_card', { face: '17805', nation: '苏联', dest: 'hand' })
I.refresh(g)

I.offer_armed_effects(g, 'nation_turn_start', { nation: '德国', window: 'nation_turn_start' })
I.refresh(g)
console.log('current=' + g.current_nation + ' active=' + g.active + ' turn_phase=' + g.turn_phase)
console.log('armed_offers = ' + JSON.stringify((g.armed_offers || []).map(w => ({
	when: w.when, nation: w.nation, actor: w.actor,
	cards: (w.cards || []).map(c => ({ id: c.card_id, face: faceOf(c.card_id), nation: c.nation, name: c.name })),
	ctx: w.ctx,
}))))
console.log('view(Allies).armed_offer = ' + JSON.stringify((R.view(g, 'Allies').armed_offer || {}).cards))
console.log('actions(Allies) 含 use_armed_offer = ' + !!(R.view(g, 'Allies').actions || {}).use_armed_offer)

const w = (g.armed_offers || [])[0]
const cid = w && w.cards && w.cards[0] && (w.cards[0].card_id || w.cards[0].id)
console.log('尝试 use_armed_offer card=' + cid)
const n0 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: cid })
I.refresh(g)
console.log('  log = ' + logSince(g, n0))
console.log('  pending_echo=' + JSON.stringify(g.pending_echo && g.pending_echo.kind) +
	'  pending_red=' + JSON.stringify(!!g.pending_red) +
	'  armed_offers=' + JSON.stringify((g.armed_offers || []).map(x => x.when)))
