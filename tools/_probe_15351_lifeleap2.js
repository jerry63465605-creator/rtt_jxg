/* 补充调查：15351 为什么在窗口里出现两次；以及响应救回后再打 15351 会怎样 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const WE = d.id_of('西欧')

const g = new_board(20261108, { nation: '英国', phase: 'play' })
console.log('=== 英国初始手牌 ===')
console.log('  ' + JSON.stringify((g.hands['英国'] || []).map(x => x + ':' + faceOf(x))))
console.log('  其中 15351 = ' + JSON.stringify((g.hands['英国'] || []).filter(x => faceOf(x) === '15351')))

give(g, '15337', '英国')
give(g, '15351', '英国')
give(g, '15311', '英国')
give(g, '15225', '德国')
I.refresh(g)
console.log('\n=== 加牌后 ===')
console.log('  15351 实例 = ' + JSON.stringify((g.hands['英国'] || []).filter(x => faceOf(x) === '15351')))
console.log('  15311 实例 = ' + JSON.stringify((g.hands['英国'] || []).filter(x => faceOf(x) === '15311')))

/* 暗置 15337 */
R.action(g, 'Allies', 'play_card', { card: (g.hands['英国'] || []).find(x => faceOf(x) === '15337') })
I.refresh(g)

/* 德国阿登 + 陆战 */
const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
I.grant_supply(g, fr, g.turn); I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15225') })
I.refresh(g)
R.action(g, 'Axis', 'event_battle', { target: WE })
I.refresh(g)

const v = R.view(g, 'Allies')
console.log('\n=== 陆战后 ===')
console.log('  窗口卡片 = ' + JSON.stringify((v.armed_offer && v.armed_offer.cards || []).map(c => c.card + ':' + c.name)))
console.log('  桌面响应 = ' + JSON.stringify(v.pending_trigger && (v.pending_trigger.candidates || []).map(c => c.card_face || c.id)))

/* 触发 15337（救回） */
const pt = v.pending_trigger
if (pt && (pt.candidates || []).length) {
	R.action(g, 'Allies', 'trigger_response', { card: pt.candidates[0].card_face || pt.candidates[0].id })
	I.refresh(g)
}
const v2 = R.view(g, 'Allies')
console.log('\n=== 15337 救回后 ===')
console.log('  西欧 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
console.log('  窗口仍在 = ' + JSON.stringify((v2.armed_offer && v2.armed_offer.cards || []).map(c => c.card + ':' + c.name)))
console.log('  英国手牌 15351 = ' + JSON.stringify((g.hands['英国'] || []).filter(x => faceOf(x) === '15351')))

/* 试着打 15351（弃 2 张 → 选北海/不列颠） */
const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '15351'))
if (w) {
	const cid = (w.cards || []).find(c => faceOf(c.card_id) === '15351').card_id
	const drops = (g.hands['英国'] || []).filter(x => x !== cid).slice(0, 2)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cid, drop: drops })
	I.refresh(g)
	console.log('\n=== 打 15351（弃 2 张）===')
	console.log('  log = ' + logSince(g, n0).slice(0, 220))
	const pend = (g.armed_offers[0] || {}).pending
	console.log('  pending = ' + JSON.stringify(pend && { need: pend.need, opts: (pend.options || pend.candidates || []).map(o => o.name || o) }))
	if (pend && pend.need === 'choice') {
		const opt = (pend.options || [])[0]
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid, choice: opt.id || opt })
		I.refresh(g)
		console.log('  选 ' + (opt.name || opt.id) + ' → ' + logSince(g, n1).slice(0, 200))
		console.log('  北海/不列颠 = ' + JSON.stringify(
			['北海', '不列颠'].map(n => n + ':' + I.pieces_on(g, d.id_of(n)).map(p => g.piece_nation[p] + '/' + g.piece_type[p]).join(','))))
	}
}
