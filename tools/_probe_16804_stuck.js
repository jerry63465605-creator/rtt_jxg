/*
 * 16804 窗口卡死排查：
 *   A 建出窗口后，美国侧 view.actions 是否放行 use_armed_offer / skip_armed_offer
 *   B 点「发动」→ 服务端是否真的推进（日志/牌库/部队）
 *   C 点「不发动」→ 是否清窗口、日本是否能继续
 *   D 逐字段看窗口结构与 handoff 状态
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const CE = d.id_of('中国东部')

function scene() {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	give(g, '16804', '美国')
	I.refresh(g)
	/* 清掉中国陆军，日本陆军进中国东部 */
	for (const p of I.pieces_on(g, CE)) R.action(g, 'Axis', 'debug_remove', { piece: p })
	I.refresh(g)
	place(g, 'jp_ce', '日本', 'army', '中国东部')
	I.refresh(g)
	/* 真实派发（模拟日本在自己回合建设陆军后的窗口） */
	I.offer_armed_effects(g, 'after_build_army', { space: CE, nation: '日本', type: 'army', piece_id: 'jp_ce' })
	I.refresh(g)
	return g
}

/* ---------- A. build_actions 是否放行 ---------- */
console.log('=== A. 美国侧 view.actions ===')
{
	const g = scene()
	const v = R.view(g, 'Allies')
	const vx = R.view(g, 'Axis')
	console.log('  armed_offer = ' + JSON.stringify(v.armed_offer && {
		when: v.armed_offer.when, nation: v.armed_offer.nation,
		cards: (v.armed_offer.cards || []).map(c => ({ card: c.card, name: c.name, cost: c.cost })),
	}))
	console.log('  Allies actions 含 = ' + JSON.stringify(Object.keys(v.actions || {}).filter(k => /armed|skip|use/.test(k))))
	console.log('  Axis   actions 含 = ' + JSON.stringify(Object.keys(vx.actions || {}).filter(k => /armed|skip|use/.test(k))))
	console.log('  game.current_nation = ' + g.current_nation + '　turn_phase=' + g.turn_phase)
	console.log('  armed_offers(server) = ' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation + ':' + (w.cards || []).map(c => faceOf(c.card_id)).join('/'))))
}

/* ---------- B. 点发动 ---------- */
console.log('\n=== B. 点「发动」（use_armed_offer） ===')
{
	const g = scene()
	const w = (g.armed_offers || [])[0]
	const cid = (w.cards || [])[0].card_id
	const deck0 = (g.decks['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })
	I.refresh(g)
	console.log('  log = ' + (logSince(g, n0) || '(无日志)').slice(0, 260))
	console.log('  美国牌库 ' + deck0 + '→' + (g.decks['美国'] || []).length)
	console.log('  中国东部 = ' + JSON.stringify(I.pieces_on(g, CE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	console.log('  窗口剩余 = ' + JSON.stringify((g.armed_offers || []).map(w2 => w2.when)))
	console.log('  pending_armed_use = ' + JSON.stringify(g.pending_armed_use))
}

/* ---------- C. 点不发动 ---------- */
console.log('\n=== C. 点「不发动」（skip_armed_offer） ===')
{
	const g = scene()
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'skip_armed_offer', {})
	I.refresh(g)
	console.log('  log = ' + (logSince(g, n0) || '(无日志)').slice(0, 200))
	console.log('  窗口剩余 = ' + JSON.stringify((g.armed_offers || []).map(w2 => w2.when + '@' + w2.nation)))
	/* 日本能否继续（模拟日本再做一个动作） */
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'debug_add_card', { face: '15400', nation: '日本', dest: 'hand' })
	I.refresh(g)
	console.log('  日本后续动作 log = ' + (logSince(g, n1) || '(无)').slice(0, 120))
}

/* ---------- D. 窗口结构细节 ---------- */
console.log('\n=== D. 窗口结构 ===')
{
	const g = scene()
	console.log('  ' + JSON.stringify((g.armed_offers || []).map(w => ({
		when: w.when, nation: w.nation, watch: w.watch,
		cards: (w.cards || []).map(c => ({ id: c.card_id, name: c.name, cost: c.cost, actor: c.actor })),
		pending: w.pending,
	})), null, 1).slice(0, 900))
}
