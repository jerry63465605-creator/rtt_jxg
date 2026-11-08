/*
 * 调查 16804《花园口决堤》"打不出去"：
 *   ① 手牌点击（机会卡，应当被拒并给原因）
 *   ② 日本在<中国东部>真实建设/征召陆军 → 是否开出 armed 窗口
 *   ③ ready 的每个条件分别是什么结果（定位卡点）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const CE = d.id_of('中国东部')

const g = new_board(20261108, { nation: '美国', phase: 'play' })
give(g, '16804', '美国')
I.refresh(g)

console.log('=== ① 手牌里点它（机会卡） ===')
{
	const cid = (g.hands['美国'] || []).find(x => faceOf(x) === '16804')
	const v = R.view(g, 'Allies')
	console.log('  hand_ready = ' + JSON.stringify((v.hand_ready || {})[cid]))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: cid })
	I.refresh(g)
	console.log('  点它 log = ' + logSince(g, n0).slice(0, 200))
}

console.log('\n=== ② 中国东部现状 ===')
console.log('  部队 = ' + JSON.stringify(I.pieces_on(g, CE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
console.log('  eliminate_candidates(美国, army) = ' + JSON.stringify(
	(typeof I.eliminate_candidates === 'function' ? I.eliminate_candidates(g, '美国', CE, 'army') : '(未导出)')))
console.log('  space 相邻 = ' + JSON.stringify((d.spaces[CE].connections || []).map(s => d.name_of(s) + '(' + (d.spaces[s].terrain || '?') + ')')))

console.log('\n=== ③ 让日本在<中国东部>真实建设/征召 ===')
/* 先在日本本土或其相邻放 1 支日本陆军，保证能"建设到中国东部" */
const cands = I.build_candidates ? I.build_candidates(g, '日本', 'army') : null
console.log('  build_candidates(日本, army) = ' + JSON.stringify(cands && cands.slice(0, 8)))
if (cands && cands.indexOf(CE) >= 0) {
	const n0 = (g.log || []).length
	const r = I.build_piece ? I.build_piece(g, '日本', CE, 'army') : { ok: false, reason: 'build_piece 未导出' }
	I.refresh(g)
	console.log('  build_piece → ' + JSON.stringify(r && { ok: r.ok, id: r.id, reason: r.reason }))
	console.log('  log = ' + logSince(g, n0).slice(0, 200))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation + ':' + (w.cards || []).map(c => faceOf(c.card_id)).join('/'))))
} else {
	console.log('  （中国东部不在可建设候选里，改用 recruit 试）')
	const rc = I.recruit_candidates ? I.recruit_candidates(g, '日本', 'army') : null
	console.log('  recruit_candidates(日本, army) = ' + JSON.stringify(rc && rc.slice(0, 8)))
	if (rc && rc.indexOf(CE) >= 0) {
		const n0 = (g.log || []).length
		const r = I.recruit_piece ? I.recruit_piece(g, '日本', CE, 'army') : { ok: false, reason: 'recruit_piece 未导出' }
		I.refresh(g)
		console.log('  recruit_piece → ' + JSON.stringify(r && { ok: r.ok, id: r.id, reason: r.reason }))
		console.log('  log = ' + logSince(g, n0).slice(0, 200))
		console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation + ':' + (w.cards || []).map(c => faceOf(c.card_id)).join('/'))))
	}
}

console.log('\n=== ④ 若窗口已开，点它试试 ===')
{
	const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '16804'))
	if (!w) { console.log('  ✗ 没有 16804 窗口'); }
	else {
		const cid = (w.cards || []).find(c => faceOf(c.card_id) === '16804').card_id
		const deck0 = (g.decks['美国'] || []).length
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid })
		I.refresh(g)
		console.log('  点它 log = ' + logSince(g, n0).slice(0, 260))
		console.log('  美国牌库 ' + deck0 + '→' + (g.decks['美国'] || []).length +
			'　中国东部 = ' + JSON.stringify(I.pieces_on(g, CE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	}
}
