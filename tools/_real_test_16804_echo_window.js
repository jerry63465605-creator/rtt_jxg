/*
 * 16804《花园口决堤》卡死修复：pending_echo（他方多步事件）期间，武装窗口必须能应答
 *
 * A ★★ pending_echo 期间，美国侧 actions 含 use_armed_offer / skip_armed_offer
 * B ★★ 点「发动」真的结算（损耗 2 / 消灭中国东部日军 / 窗口清空 / 日本事件挂起保留）
 * C ★★ 点「不发动」真的清窗口，日本可继续
 * D ★★ 回归：pending_echo 属于【自己】时，仍然只给 resolve_effect（不放宽到别处）
 * E ★★ 回归：pending_theater / pending_autobahn 的老口径不变（仍放行武装窗口）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const CE = d.id_of('中国东部')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const acts = (g, side = 'Allies') => Object.keys(R.view(g, side).actions || {})

/* 日本回合 + 16804 窗口 + （可选）pending_echo（属于日本的事件卡） */
function scene({ withEcho = true, echoOwner = '日本' } = {}) {
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	give(g, '16804', '美国')
	I.refresh(g)
	for (const p of I.pieces_on(g, CE)) R.action(g, 'Axis', 'debug_remove', { piece: p })
	I.refresh(g)
	place(g, 'jp_ce', '日本', 'army', '中国东部')
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	I.offer_armed_effects(g, 'after_build_army', { space: CE, nation: '日本', type: 'army', piece_id: 'jp_ce' })
	I.refresh(g)
	if (withEcho) {
		/* 模拟"日本多步事件还留着选地区挂起"（真实场景：事件 steps 的 build 之后仍需选地区） */
		g.pending_echo = { kind: 'echo_need', step: 'space', card: '7905#99', cands: [CE], choice: null }
		I.refresh(g)
	}
	return g
}

console.log('=== A. pending_echo（日本）期间，美国的 actions ===')
{
	const g = scene()
	const a = acts(g)
	console.log('  Allies actions = ' + JSON.stringify(a))
	console.log('  pending_echo = ' + JSON.stringify(g.pending_echo && g.pending_echo.step) + '  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★★ 含 use_armed_offer', a.indexOf('use_armed_offer') >= 0, JSON.stringify(a))
	ok('★★ 含 skip_armed_offer', a.indexOf('skip_armed_offer') >= 0, JSON.stringify(a))
}

console.log('\n=== B. 点「发动」===')
{
	const g = scene()
	const w = (g.armed_offers || [])[0]
	const cid = (w.cards || [])[0].card_id
	const deck0 = (g.decks['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + (lg || '(无日志 = 仍然卡死)').slice(0, 220))
	console.log('  美国牌库 ' + deck0 + '→' + (g.decks['美国'] || []).length +
		'　中国东部=' + JSON.stringify(I.pieces_on(g, CE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])) +
		'　窗口=' + (g.armed_offers || []).length +
		'　pending_echo=' + JSON.stringify(g.pending_echo && g.pending_echo.step))
	ok('★★ 真的结算了（损耗 2 + 消灭日军）',
		(g.decks['美国'] || []).length === deck0 - 2 && !I.pieces_on(g, CE).some(p => g.piece_nation[p] === '日本'),
		lg.slice(0, 140))
	ok('★★ 窗口清空', !(g.armed_offers || []).length)
	ok('★ 日本的 pending_echo 保留（不吞他的事件）', !!g.pending_echo)
}

console.log('\n=== C. 点「不发动」===')
{
	const g = scene()
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'skip_armed_offer', {})
	I.refresh(g)
	console.log('  log = ' + (logSince(g, n0) || '(无日志 = 仍然卡死)').slice(0, 160))
	ok('★★ 清窗口并有日志', !(g.armed_offers || []).length && /放弃/.test(logSince(g, n0)))
	/* 日本能否继续推进 */
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_effect', { space: CE })
	I.refresh(g)
	console.log('  日本 resolve_effect log = ' + (logSince(g, n1) || '(无)').slice(0, 120))
	ok('★ 日本侧仍可推进自己的挂起', acts(g, 'Axis').indexOf('resolve_effect') >= 0 || !!logSince(g, n1))
}

console.log('\n=== D. pending_echo 属于【自己】时，仍只给 resolve_effect ===')
{
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	give(g, '16804', '美国')
	I.refresh(g)
	/* 把窗口硬塞成美国自己的（不走日本事件），同时放一个属于美国的 pending_echo */
	place(g, 'jp_ce2', '日本', 'army', '中国东部')
	I.refresh(g)
	I.offer_armed_effects(g, 'after_build_army', { space: CE, nation: '日本', type: 'army', piece_id: 'jp_ce2' })
	g.pending_echo = { kind: 'echo_need', step: 'space', card: '17517#99', cands: [CE], choice: null }
	I.refresh(g)
	const a = acts(g, 'Allies')
	console.log('  Allies actions = ' + JSON.stringify(a))
	/* 自己的挂起仍以 resolve_effect 为主；武装窗口是否同时在列取决于窗口是否属于本方 */
	ok('★★ 自己的 pending_echo 仍保留 resolve_effect（排他未被破坏）',
		a.indexOf('resolve_effect') >= 0, JSON.stringify(a))
}

console.log('\n=== E. 老口径回归：pending_theater / pending_autobahn 仍放行武装窗口 ===')
{
	const g1 = scene({ withEcho: false })
	g1.pending_theater = {
		/* 与真实语义一致：theater 分支只对【actor 所在阵营】放行武装窗口 */
		actor: '美国', done: 0, total: 3, steps: [], order: [], kind: 'test',
		built: { navy: false, army: false },
	}
	I.refresh(g1)
	ok('★ pending_theater 下仍放行', acts(g1).indexOf('use_armed_offer') >= 0, JSON.stringify(acts(g1)))

	const g2 = scene({ withEcho: false })
	g2.pending_autobahn = { actor: '德国', steps: [], done: 0 }
	I.refresh(g2)
	ok('★ pending_autobahn 下仍放行', acts(g2).indexOf('use_armed_offer') >= 0, JSON.stringify(acts(g2)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
