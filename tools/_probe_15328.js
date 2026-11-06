/* 只读：计分阶段 15353 压制 + 15328 上报链路 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
I.refresh(g)
R.action(g, 'Axis', 'debug_add_card', { face: '15241', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
const st = (g.hands['德国'] || []).find(x => faceOf(x) === '15241')
R.action(g, 'Axis', 'play_card', { card: st })
R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15328', nation: '英国', dest: 'hand' })
I.refresh(g)
/* 用真实 play_card 把响应卡暗置（手写的 table_responses 缺 owner_side 等字段会被拒） */
{
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	const uk28 = (g.hands['英国'] || []).find(x => faceOf(x) === '15328')
	if (uk28) R.action(g, 'Allies', 'play_card', { card: uk28 })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	console.log('table_responses =', JSON.stringify((g.table_responses || []).map(x => ({ card: faceOf(x.card_id), nation: x.nation, owner_side: x.owner_side }))))
}
R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
I.refresh(g)
const stId = (g.table['德国'] || []).find(x => faceOf(x) === '15241')
console.log('桌面实例 =', stId, ' 英国手牌 =', (g.hands['英国'] || []).map(faceOf).join(','))

const n0 = (g.log || []).length
I.phase_scoring(g, '德国', {})
I.refresh(g)
console.log('\n[scoring 后] offers =', JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, cards: (w.cards || []).map(c => faceOf(c.card_id)) }))))
console.log('  log =', logSince(g, n0).slice(0, 220))

const w = (g.armed_offers || [])[0]
if (w && (w.cards || []).length) {
	const c = w.cards[0]
	const fodder = (g.hands['英国'] || []).find(x => faceOf(x) !== '15353')
	console.log('\n用 15353：card=', c.card_id, ' discard=', fodder)
	const n1 = (g.log || []).length
	const r = R.action(g, 'Allies', 'use_armed_offer', { card: c.card_id, drop: [fodder] })
	I.refresh(g)
	console.log('  返回 =', JSON.stringify(r && { ok: r.ok, pending: r.pending }))
	console.log('  log =', logSince(g, n1))
	console.log('  suppressed =', JSON.stringify(g.status_suppressed_this_turn))
	console.log('  pending_status_react =', JSON.stringify(g.pending_status_react && {
		mode: g.pending_status_react.mode,
		items: (g.pending_status_react.items || []).map(i => faceOf(i.cid)),
		fired: (g.pending_status_react.fired || []).map(faceOf),
	}))
	console.log('  response_queue =', JSON.stringify((g.response_queue || []).map(f => ({ on: f.on, card: faceOf(f.card_id || '') }))))
	console.log('  response_stack =', JSON.stringify((g.response_stack || []).map(f => ({ on: (f.frame || f).on, card: faceOf((f.frame || f).card_id || '') }))))
	console.log('  pending_trigger =', JSON.stringify(g.pending_trigger || null))
	console.log('  view(Allies).pending_trigger =', JSON.stringify((R.view(g, 'Allies') || {}).pending_trigger))
	console.log('  view(Allies).response_choice =', JSON.stringify((R.view(g, 'Allies') || {}).response_choice).slice(0, 300))
	const top = (g.response_stack || [])[(g.response_stack || []).length - 1]
	console.log('  栈顶 frame =', JSON.stringify(top && (top.frame || top)).slice(0, 400))
	if (top) {
		const fr = top.frame || top
		const n2 = (g.log || []).length
		const r2 = R.action(g, 'Allies', 'trigger_response', { card: fr.card_id || fr.card })
		I.refresh(g)
		console.log('  trigger 返回 =', JSON.stringify(r2 && { ok: r2.ok, pending: r2.pending, kind: r2.kind }))
		console.log('  trigger log =', logSince(g, n2).slice(0, 200))
		console.log('  view.response_choice =', JSON.stringify((R.view(g, 'Allies') || {}).response_choice).slice(0, 300))
	}
	console.log('  log tail =', logSince(g, n1).slice(-260))
}
