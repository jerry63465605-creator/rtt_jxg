/* 补充调查 2：15337 已还原后再打 15311/15351 会不会重复生成部队（白赚） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const WE = d.id_of('西欧')

function build() {
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	give(g, '15337', '英国')
	give(g, '15311', '英国')
	give(g, '15225', '德国')
	I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: (g.hands['英国'] || []).find(x => faceOf(x) === '15337') })
	I.refresh(g)
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15225') })
	I.refresh(g)
	R.action(g, 'Axis', 'event_battle', { target: WE })
	I.refresh(g)
	return g
}

function triggerLeap(g) {
	const v = R.view(g, 'Allies')
	const pt = v.pending_trigger
	if (pt && (pt.candidates || []).length) {
		R.action(g, 'Allies', 'trigger_response', { card: pt.candidates[0].card_face || pt.candidates[0].id })
		I.refresh(g)
	}
}

/* 路线 1：先 15337 救回，再打 15311（弃 4） */
console.log('=== 路线 1：15337 救回 → 再打 15311 ===')
{
	const g = build()
	triggerLeap(g)
	console.log('  救回后 西欧 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	const w = (g.armed_offers || []).find(x => (w2 => (w2.cards || []).some(c => faceOf(c.card_id) === '15311'))(x))
	if (!w) { console.log('  ✗ 没有 15311 窗口'); }
	else {
		const cid = (w.cards || []).find(c => faceOf(c.card_id) === '15311').card_id
		const drops = (g.hands['英国'] || []).filter(x => x !== cid).slice(0, 4)
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid, drop: drops })
		I.refresh(g)
		console.log('  打 15311 log = ' + logSince(g, n0).slice(0, 220))
		console.log('  西欧 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])) +
			'（⚠ 若出现 2 支法国陆军 = 重复生成）')
	}
}

/* 路线 2：不打 15337（放弃），法国陆军真被移除，再看 15311 */
console.log('\n=== 路线 2：放弃 15337 → 打 15311 ===')
{
	const g = build()
	const v = R.view(g, 'Allies')
	if (v.pending_trigger) {
		R.action(g, 'Allies', 'pass_response', {})
		I.refresh(g)
	}
	console.log('  放弃后 西欧 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '15311'))
	if (w) {
		const cid = (w.cards || []).find(c => faceOf(c.card_id) === '15311').card_id
		const drops = (g.hands['英国'] || []).filter(x => x !== cid).slice(0, 4)
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid, drop: drops })
		I.refresh(g)
		console.log('  打 15311 log = ' + logSince(g, n0).slice(0, 220))
		console.log('  西欧 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	}
}
