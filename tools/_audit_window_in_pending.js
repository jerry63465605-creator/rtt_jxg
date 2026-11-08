/*
 * 经验矩阵：各类"排他挂起（多在对手回合的多步事件中途）" × 应答窗口
 *
 * 对被挂起方（ Allies，持有 armed 窗口 / 桌面响应卡）逐状态检查：
 *   ① view.actions 是否含 use_armed_offer / skip_armed_offer
 *   ② view.actions 是否含 trigger_response / pass_response
 *   ③ 真发 use_armed_offer 是否被拒
 * 同时检查行动方（Axis）是否被正确"强挂起"（不能继续推进）。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const CE = d.id_of('中国东部')
const WE = d.id_of('西欧')

/* 建一个"美国持 16804 窗口"的日本回合盘面（armed 归属 Allies） */
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

/* 建一个"英国桌面有响应卡（15337）"的日本回合盘面 */
function withResponse() {
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	give(g, '15337', '英国')
	I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: (g.hands['英国'] || []).find(x => faceOf(x) === '15337') })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	return g
}

const STATES = [
	['pending_echo（事件多步：选地区）', g => { g.pending_echo = { kind: 'echo_need', step: 'space', card: '17517#1', cands: [CE], choice: null } }],
	['pending_script（多步脚本卡）', g => { g.pending_script = { kind: 'pick', nation: '日本', card: '7900#1', step: 0, picks: [] } }],
	['event_budget（战斗/建设预算）', g => { g.event_budget = { nation: '日本', remaining: 1 } }],
	['pending_battle（战斗待应答）', g => { g.pending_battle = { stage: 'defend', space: CE, attacker: '日本', defender: '中国', kind: 'land' } }],
	['pending_theater（战区移动）', g => { g.pending_theater = { actor: '日本', done: 0, total: 3, steps: [], order: [], built: { navy: false, army: false } } }],
	['pending_autobahn（高速公路）', g => { g.pending_autobahn = { actor: '日本', steps: [], done: 0 } }],
	['pending_status_play（选状态卡）', g => { g.pending_status_play = { nation: '日本', cands: [] } }],
	['pending_econ（经济战让权）', g => { g.pending_econ = { wait: '日本', targets: [], kind: 'econ' } }],
]

const actsOf = (g, side) => {
	try { return Object.keys(R.view(g, side).actions || {}) } catch (e) { return ['<view 抛错: ' + e.message + '>'] }
}

console.log('=== 矩阵 A：对手回合的排他挂起 × 我方 armed 窗口 ===')
for (const [name, mut] of STATES) {
	const g = withArmed()
	try { mut(g) } catch (e) { console.log('  ' + name + ' → 构造失败'); continue }
	I.refresh(g)
	const a = actsOf(g, 'Allies')
	const hasUse = a.indexOf('use_armed_offer') >= 0
	const hasSkip = a.indexOf('skip_armed_offer') >= 0
	/* 真发一次 */
	let played = '-'
	if (hasUse) {
		const cid = (g.armed_offers[0].cards || [])[0].card_id
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid })
		I.refresh(g)
		const lg = (g.log || []).slice(n0).join(' | ')
		played = /损耗/.test(lg) ? 'OK' : '被拒: ' + lg.slice(0, 40)
	}
	console.log('  ' + name.padEnd(30, ' ') +
		' use=' + (hasUse ? 'Y' : '✗') + ' skip=' + (hasSkip ? 'Y' : '✗') +
		' 实发=' + played + '   Axis 可见动作=' + JSON.stringify(actsOf(g, 'Axis').slice(0, 6)))
}

console.log('\n=== 矩阵 B：对手回合的排他挂起 × 我方桌面响应卡 ===')
for (const [name, mut] of STATES) {
	const g = withResponse()
	try { mut(g) } catch (e) { continue }
	I.refresh(g)
	/* 主动造一个响应询问（真实入口：request_responses 需要事件；这里用 piece_removed 派发） */
	place(g, 'jp_ce2', '日本', 'army', '中国东部')
	I.refresh(g)
	/* 触发 piece_removed 响应窗口（真实动作：陆战移除） */
	try {
		for (const p of I.pieces_on(g, WE)) { if (g.piece_nation[p] === '法国') R.action(g, 'Axis', 'debug_remove', { piece: p }) }
	} catch (e) { }
	I.refresh(g)
	const a = actsOf(g, 'Allies')
	console.log('  ' + name.padEnd(30, ' ') +
		' trigger_response=' + (a.indexOf('trigger_response') >= 0 ? 'Y' : '-') +
		' pass_response=' + (a.indexOf('pass_response') >= 0 ? 'Y' : '-') +
		' armed=' + (a.indexOf('use_armed_offer') >= 0 ? 'Y' : '-'))
}
