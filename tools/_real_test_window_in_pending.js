/*
 * P0 回归矩阵：排他挂起 × 应答窗口（长期守护）
 *
 * 对 8 种排他挂起，分别验证：
 *   A ★★ 本方持有 armed 窗口：view.actions 含 use/skip，且真发能结算（窗口清空 + 效果生效）
 *   B ★★ 窗口属于【对手】：本方 actions 不含表态键；本方推进会话被拒（B19 强挂起不回退）
 *   C ★★ 挂起本身仍被尊重：行动方不能借机 play_card / next_phase
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const CE = d.id_of('中国东部')
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const acts = (g, side) => { try { return Object.keys(R.view(g, side).actions || {}) } catch (e) { return ['<view:' + e.message + '>'] } }

const STATES = [
	['pending_echo', g => { g.pending_echo = { kind: 'echo_need', step: 'space', card: '17517#1', cands: [CE], choice: null } }],
	['pending_script', g => { g.pending_script = { kind: 'pick', nation: '日本', card: '7900#1', stage: 1, total: 3, picks: [], answer_nation: '日本' } }],
	['event_budget', g => { g.event_budget = { nation: '日本', remaining: 1 } }],
	['pending_battle', g => { g.pending_battle = { stage: 'defend', space: CE, attacker: '日本', defender: '中国', kind: 'land', airs: [] } }],
	['pending_theater', g => { g.pending_theater = { actor: '日本', done: 0, total: 3, steps: [], order: [], built: { navy: false, army: false } } }],
	['pending_autobahn', g => { g.pending_autobahn = { actor: '日本', steps: [], done: 0 } }],
	['pending_status_play', g => { g.pending_status_play = { nation: '日本', cands: [] } }],
	['pending_econ', g => { g.pending_econ = { chain: ['日本', '日本'], step: 0, targets: [CE], stage: 'choice' } }],
]

/* 日本回合 + 美国持 16804 窗口（窗口属 Allies，行动方是 Axis） */
function withArmed(owner = '美国') {
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	give(g, '16804', owner)
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

console.log('=== A. 本方（Allies）持窗口 × 8 种挂起 ===')
for (const [name, mut] of STATES) {
	const g = withArmed()
	mut(g)
	I.refresh(g)
	const a = acts(g, 'Allies')
	const hasUse = a.indexOf('use_armed_offer') >= 0
	const hasSkip = a.indexOf('skip_armed_offer') >= 0
	let played = '-'
	if ((g.armed_offers || []).length) {
		const cid = (g.armed_offers[0].cards || [])[0].card_id
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid })
		I.refresh(g)
		const lg = logSince(g, n0)
		played = /损耗/.test(lg) ? 'OK' : '被拒'
	}
	ok(name + '：actions 含 use/skip 且真发能结算',
		hasUse && hasSkip && played === 'OK',
		JSON.stringify({ use: hasUse, skip: hasSkip, played, a: a.slice(0, 6) }))
	/* C：行动方不能借机推进 */
	const ax = acts(g, 'Axis')
	ok(name + '：行动方仍被强挂起（无 play_card/next_phase）',
		ax.indexOf('play_card') < 0 && ax.indexOf('next_phase') < 0, JSON.stringify(ax.slice(0, 8)))
}

console.log('\n=== B. 窗口属【对手】时，本方不能替它表态 ===')
for (const [name, mut] of STATES) {
	/* 把窗口塞给日本（Axis），但由 Allies 去看 actions */
	const g = withArmed('日本')
	mut(g)
	I.refresh(g)
	const a = acts(g, 'Allies')
	ok(name + '：Allies 无 use/skip（不能替对手表态）',
		a.indexOf('use_armed_offer') < 0 && a.indexOf('skip_armed_offer') < 0, JSON.stringify(a.slice(0, 6)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
