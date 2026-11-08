/* 16804 深层排查：eliminate_candidates 的前置条件 + 手工派发 after_build_army 看 ready */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const CE = d.id_of('中国东部')

const g = new_board(20261108, { nation: '美国', phase: 'play' })
give(g, '16804', '美国')
I.refresh(g)

/* 清掉中国陆军，让日本陆军能占位（模拟日本打穿中国东部） */
for (const p of I.pieces_on(g, CE)) R.action(g, 'Axis', 'debug_remove', { piece: p })
I.refresh(g)

/* 日本在中国东部放一支陆军（等价于"建设/征召产生的那一支"） */
place(g, 'jp_ce', '日本', 'army', '中国东部')
I.refresh(g)
console.log('=== 放日本陆军后 ===')
console.log('  中国东部 = ' + JSON.stringify(I.pieces_on(g, CE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
console.log('  eliminate_candidates(美国,army) = ' + JSON.stringify(I.eliminate_candidates(g, '美国', CE, 'army')))
console.log('  美国是否与日本交战/敌对 = faction(日本)=' + I.faction_of_nation('日本') + ' faction(美国)=' + I.faction_of_nation('美国'))

/* 手工按真实派发点参数派发 */
console.log('\n=== 手工派发 after_build_army（piece_id=jp_ce） ===')
{
	const n0 = (g.log || []).length
	I.offer_armed_effects(g, 'after_build_army', { space: CE, nation: '日本', type: 'army', piece_id: 'jp_ce' })
	I.refresh(g)
	console.log('  log = ' + (logSince(g, n0) || '(无)').slice(0, 200))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation + ':' + (w.cards || []).map(c => faceOf(c.card_id)).join('/'))))
}

/* 直接问 ready */
console.log('\n=== 直接调 ready ===')
{
	const ar = (I.ECHO_EFFECTS['16804'] || {}).armed
	if (!ar) console.log('  ✗ 没有 armed 配置')
	else {
		const ctx = { space: CE, nation: '日本', type: 'army', piece_id: 'jp_ce' }
		console.log('  ready(game, ctx) = ' + ar.ready(g, ctx))
		console.log('  ready 各条件：faction≠美国=' + (I.faction_of_nation('日本') !== I.faction_of_nation('美国')) +
			'  space匹配=' + (Number(ctx.space) === d.id_of('中国东部')) +
			'  piece_id存在=' + (ctx.piece_id != null) +
			'  在候选内=' + (I.eliminate_candidates(g, '美国', CE, 'army').indexOf(String(ctx.piece_id)) >= 0))
	}
}
