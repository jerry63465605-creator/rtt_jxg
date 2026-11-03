/* 15209 伞兵：直接派发 play_start 机会窗口（诊断用），看下发哪些 UI 字段 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
R.action(g, 'Axis', 'debug_add_card', { face: '15209', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: d.id_of('德国') })
I.refresh(g)

const api = Object.keys(I).filter(k => /offer_armed|armed_effects|request_responses|suspend/.test(k))
console.log('可用内部函数: ' + JSON.stringify(api))

const n0 = (g.log || []).length
if (typeof I.offer_armed_effects === 'function') {
	const r = I.offer_armed_effects(g, 'play_start', '德国')
	console.log('offer_armed_effects -> ' + JSON.stringify(r) + '  log: ' + logSince(g, n0))
} else {
	console.log('❌ 未导出 offer_armed_effects')
}
I.refresh(g)

console.log('\narmed_offers = ' + JSON.stringify((g.armed_offers || []).map(w => ({
	when: w.when, nation: w.nation,
	cards: (w.cards || []).map(x => faceOf(x.card_id || x)),
	pending: w.pending && { need: w.pending.need, cands: (w.pending.candidates || []).length },
}))))

const v = R.view(g, 'Axis')
const keys = Object.keys(v).filter(k => /armed|pending|budget|ask|choice|step|echo/i.test(k))
console.log('\nview(Axis) 窗口类字段:')
for (const k of keys) {
	const val = v[k]
	if (val == null || (Array.isArray(val) && !val.length)) continue
	console.log('  ' + k + ' = ' + JSON.stringify(val).slice(0, 300))
}
