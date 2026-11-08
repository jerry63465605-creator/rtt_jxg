/*
 * 真实场景复现：**日本回合**里，日本在中国东部建设陆军 → 美国拿到 16804 窗口
 * 检查：让权（handoff）/ build_actions / 点发动 / 点不发动 是否都能推进
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const CE = d.id_of('中国东部')

function sceneJP() {
	/* 英国回合先给美国塞卡，再切到日本回合（避免 debug_set_phase 把他国手牌清掉） */
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	give(g, '16804', '美国')
	I.refresh(g)
	for (const p of I.pieces_on(g, CE)) R.action(g, 'Axis', 'debug_remove', { piece: p })
	I.refresh(g)
	place(g, 'jp_ce', '日本', 'army', '中国东部')
	I.refresh(g)
	/* 切到日本回合，然后按真实派发点建窗口 */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	const n0 = (g.log || []).length
	I.offer_armed_effects(g, 'after_build_army', { space: CE, nation: '日本', type: 'army', piece_id: 'jp_ce' })
	I.refresh(g)
	console.log('  派发 log = ' + (logSince(g, n0) || '(无)').slice(0, 140))
	return g
}

console.log('=== 场景：日本回合中途给美国开窗 ===')
const g = sceneJP()
console.log('  current_nation = ' + g.current_nation + '　phase=' + g.turn_phase)
console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation)))
console.log('  pending_armed_use = ' + JSON.stringify(g.pending_armed_use))
console.log('  delegate = ' + JSON.stringify(g.delegate || null))

const va = R.view(g, 'Allies')
const vx = R.view(g, 'Axis')
console.log('  Allies actions 含 armed/skip = ' + JSON.stringify(Object.keys(va.actions || {}).filter(k => /armed|skip/.test(k))))
console.log('  Axis   actions 含 armed/skip = ' + JSON.stringify(Object.keys(vx.actions || {}).filter(k => /armed|skip/.test(k))))
console.log('  Allies.armed_offer = ' + JSON.stringify(va.armed_offer && { nation: va.armed_offer.nation, when: va.armed_offer.when }))

console.log('\n=== 点「发动」（美国，当前是日本回合）===')
{
	const w = (g.armed_offers || [])[0]
	const cid = w && (w.cards || [])[0] && w.cards[0].card_id
	const deck0 = (g.decks['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })
	I.refresh(g)
	console.log('  log = ' + (logSince(g, n0) || '(无日志 = 卡死)').slice(0, 260))
	console.log('  美国牌库 ' + deck0 + '→' + (g.decks['美国'] || []).length +
		'　中国东部=' + JSON.stringify(I.pieces_on(g, CE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])) +
		'　窗口剩余=' + (g.armed_offers || []).length)
}

console.log('\n=== 点「不发动」（美国，当前是日本回合）===')
{
	const g2 = sceneJP()
	const n0 = (g2.log || []).length
	R.action(g2, 'Allies', 'skip_armed_offer', {})
	I.refresh(g2)
	console.log('  log = ' + (logSince(g2, n0) || '(无日志 = 卡死)').slice(0, 220))
	console.log('  窗口剩余 = ' + (g2.armed_offers || []).length + '　current_nation=' + g2.current_nation)
	/* 日本继续动作是否被挡 */
	const n1 = (g2.log || []).length
	R.action(g2, 'Axis', 'debug_add_card', { face: '15400', nation: '日本', dest: 'hand' })
	I.refresh(g2)
	console.log('  日本后续 log = ' + (logSince(g2, n1) || '(无)').slice(0, 120))
}
