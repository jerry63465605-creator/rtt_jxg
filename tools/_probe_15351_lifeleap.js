/*
 * 调查：15351《敦刻尔克》在手 + 15337《生命的飞跃》暗置桌面，
 *       德国《阿登闪击战》(15225) 打<西欧>法国陆军 —— 结算顺序与客户端询问
 *
 * 逐步打印：日志 / pending_trigger 候选 / armed 窗口 / 桌面响应 / 西欧部队 / protect
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const WE = d.id_of('西欧')

function dump(tag, g) {
	const v = R.view(g, 'Allies')
	const vx = R.view(g, 'Axis')
	console.log('  --- ' + tag + ' ---')
	console.log('    turn=' + g.current_nation + '·' + g.turn_phase +
		'  西欧=' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	console.log('    pending_trigger(Allies) = ' + JSON.stringify(v.pending_trigger && {
		nation: v.pending_trigger.nation,
		cands: (v.pending_trigger.candidates || []).map(c => (c.card_face || c.id || c.card_id) + ':' + (c.name || '')),
	}))
	console.log('    pending_response_choice = ' + JSON.stringify(v.pending_response_choice && {
		need: v.pending_response_choice.need, n: (v.pending_response_choice.candidates || []).length,
	}))
	console.log('    armed_offer(Allies) = ' + JSON.stringify(v.armed_offer && {
		when: v.armed_offer.when, nation: v.armed_offer.nation,
		cards: (v.armed_offer.cards || []).map(c => faceOf(c.card) + ':' + c.name),
		pending: v.armed_offer.pending && { need: v.armed_offer.pending.need, n: (v.armed_offer.pending.candidates || []).length },
	}))
	console.log('    armed_offers(server) = ' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation + ':' + (w.cards || []).map(c => faceOf(c.card_id)).join('/'))))
	console.log('    table_responses(英) = ' + JSON.stringify((g.table_responses && g.table_responses['英国'] || []).map(faceOf)))
	console.log('    pending_echo = ' + JSON.stringify(g.pending_echo && { kind: g.pending_echo.kind, step: g.pending_echo.step }))
	console.log('    Axis 是否也看到窗口 = ' + JSON.stringify(!!vx.armed_offer || !!vx.pending_trigger))
}

/* 建场：英国暗置 15337，手里 15351(+15311)；德国手里 15225；西欧有法国陆军（已补给） */
const g = new_board(20261108, { nation: '英国', phase: 'play' })
give(g, '15337', '英国')
give(g, '15351', '英国')
give(g, '15311', '英国')
give(g, '15225', '德国')
I.refresh(g)

console.log('=== 0. 起始 ===')
const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
console.log('  西欧初始 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])) + '  法国陆军=' + fr)
I.grant_supply(g, fr, g.turn); I.refresh(g)

/* 英国把手里的 15337 暗置到桌面 */
{
	const cid = (g.hands['英国'] || []).find(x => faceOf(x) === '15337')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: cid })
	I.refresh(g)
	console.log('\n=== 1. 英国暗置《生命的飞跃》 ===')
	console.log('  log = ' + (logSince(g, n0) || '(无)').slice(0, 160))
	dump('暗置后', g)
}

/* 切到德国，打阿登闪击战 */
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
{
	const cid = (g.hands['德国'] || []).find(x => faceOf(x) === '15225')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cid })
	I.refresh(g)
	console.log('\n=== 2. 德国打《阿登闪击战》 ===')
	console.log('  log = ' + (logSince(g, n0) || '(无)').slice(0, 240))
	console.log('  event_budget = ' + JSON.stringify(g.event_budget && { nation: g.event_budget.nation, remaining: g.event_budget.remaining }))
	dump('阿登打出后', g)
}

/* 用战斗预算对西欧发起陆战 */
{
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_battle', { target: WE })
	I.refresh(g)
	console.log('\n=== 3. event_battle 打<西欧> ===')
	console.log('  log = ' + (logSince(g, n0) || '(无)').slice(0, 300))
	dump('陆战结算后', g)
}

/* 英国若响应《生命的飞跃》 */
const pend = (() => { const v = R.view(g, 'Allies'); return v.pending_trigger || null })()
if (pend && (pend.candidates || []).length) {
	const cand = pend.candidates[0]
	const cid = cand.card_face || cand.id || cand.card_id
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'trigger_response', { card: cid })
	I.refresh(g)
	console.log('\n=== 4. 英国触发《生命的飞跃》 ===')
	console.log('  log = ' + (logSince(g, n0) || '(无)').slice(0, 300))
	dump('响应后', g)
} else {
	console.log('\n=== 4. 没有给英国的响应窗口（pending_trigger = null）===')
}
