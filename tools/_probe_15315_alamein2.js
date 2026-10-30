/*
 * 探查 15315《阿拉曼战役》第 2 步（征召）：
 *   点「下一步」后，服务端是【给出候选让玩家选】还是【自动选一个（中东）】？
 *
 * 用法：node tools/_probe_15315_alamein2.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const at = (g, name) => {
	const sid = d.id_of(name)
	return Object.keys(g.location).filter(p => g.location[p] === sid)
		.map(p => g.piece_nation[p] + '/' + g.piece_type[p])
}

const g = R.setup(7)
g.opening = null
I.refresh(g)
const NA = d.id_of('非洲北部'), ME = d.id_of('中东')
R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_na', nation: '德国', type: 'army', space: NA })
R.action(g, 'Allies', 'debug_add_card', { face: '15315', nation: '英国', dest: 'hand' })
I.refresh(g)
const card = (g.hands['英国'] || []).find(x => faceOf(x) === '15315')

let n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', { card })
console.log('第 1 步: ' + logSince(g, n0))
console.log('  非洲北部(消灭后)= ' + JSON.stringify(at(g, '非洲北部')) +
	'  中东= ' + JSON.stringify(at(g, '中东')))
console.log('  征召候选检查: 中东=' + JSON.stringify(I.can_recruit_at(g, '英国', ME, 'army')) +
	'  非洲北部=' + JSON.stringify(I.can_recruit_at(g, '英国', NA, 'army')))

n0 = (g.log || []).length
R.action(g, 'Allies', 'event_step_next', {})
console.log('\n点「下一步」后: ' + logSince(g, n0))
console.log('  pending_event_step= ' + JSON.stringify(g.pending_event_step && {
	step: g.pending_event_step.step, total: g.pending_event_step.total,
	desc: g.pending_event_step.desc, pick: g.pending_event_step.pick,
	cands: g.pending_event_step.candidates,
}))
console.log('  pending_echo= ' + JSON.stringify(g.pending_echo && {
	kind: g.pending_echo.kind, step: g.pending_echo.step, cands: g.pending_echo.cands,
	options: g.pending_echo.options && g.pending_echo.options.length,
}))
const v = R.view(g, 'Allies')
console.log('  view.pending_event_step= ' + JSON.stringify(v.pending_event_step && {
	step: v.pending_event_step.step, can_next: v.pending_event_step.can_next,
	offers: v.pending_event_step.offers && v.pending_event_step.offers.length,
	blockers: v.pending_event_step.blockers,
}))
console.log('  view.pending_echo= ' + JSON.stringify(v.pending_echo && {
	kind: v.pending_echo.kind, cands: v.pending_echo.cands,
}))
console.log('  ★ 征召落点: 中东=' + JSON.stringify(at(g, '中东')) +
	'  非洲北部=' + JSON.stringify(at(g, '非洲北部')))
console.log('  15315 弃牌堆= ' + ((g.discard['英国'] || []).indexOf(card) >= 0))
