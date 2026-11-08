/* 三个可疑挂起状态下，"我方 armed 窗口"是否真的点不动（服务端拒绝） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const CE = d.id_of('中国东部')
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function withArmed() {
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
	return g
}

const CASES = [
	['pending_script（脚本卡，日本正在选牌）', g => { g.pending_script = { kind: 'pick', nation: '日本', card: '7900#1', step: 0, picks: [] } }],
	['pending_theater（战区移动，actor=日本）', g => { g.pending_theater = { actor: '日本', done: 0, total: 3, steps: [], order: [], built: { navy: false, army: false } } }],
	['pending_status_play（状态卡选择，日本）', g => { g.pending_status_play = { nation: '日本', cands: [] } }],
]

for (const [name, mut] of CASES) {
	const g = withArmed()
	mut(g)
	I.refresh(g)
	const v = R.view(g, 'Allies')
	const keys = Object.keys(v.actions || {})
	const cid = (g.armed_offers[0] ? (g.armed_offers[0].cards || [])[0].card_id : null)
	console.log('=== ' + name + ' ===')
	console.log('  窗口仍存在 = ' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation)))
	console.log('  Allies actions = ' + JSON.stringify(keys))
	console.log('  view.armed_offer = ' + JSON.stringify(v.armed_offer && { when: v.armed_offer.when, nation: v.armed_offer.nation }))
	/* 强行发一次（模拟玩家点了） */
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  强行 use_armed_offer → ' + (lg || '(无日志)').slice(0, 90))
	console.log('  结果：中国东部 = ' + JSON.stringify(I.pieces_on(g, CE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])) +
		'  窗口剩余=' + (g.armed_offers || []).length)
	console.log('')
}
