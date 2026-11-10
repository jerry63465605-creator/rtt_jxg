/*
 * 只读探针：17842《喀秋莎》是否「实际生效」
 *
 * 玩家报障：「噶秋沙疑似未能实际生效，排查是哪里有问题」
 *
 * 卡面：一回合一次，发起陆战后，可弃置 1 张手牌：对战斗地区发起 1 次陆战。
 *
 * 本探针构造【目标地区仍有敌军】的场景（若只剩空打，就无法判断"是否生效"）：
 *   1. 苏联真实打出喀秋莎（留桌面）
 *   2. 英国回合：英国陆军在<中国西部>，<中国东北>放 2 支日本陆军
 *   3. 英国发起陆战打<中国东北> -> 移除 1 支，剩 1 支；同阵营武装苏联喀秋莎
 *   4. 苏联陆军放<中国西部>（与目标相邻 + 补给）
 *   5. 发动喀秋莎打<中国东北>，观察剩余日军是否被移除
 *
 * 用法：node tools/_probe_17842_katyusha.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const NE = d.id_of('中国东北')
const W = d.id_of('中国西部')
const instOf = (g, nat, face) => (g.hands[nat] || []).find(x => faceOf(x) === String(face)) || null
const piecesAt = (g, sp) => I.pieces_on(g, sp).map(p =>
	p + ':' + g.piece_nation[p] + '/' + g.piece_type[p])

const g = new_board(20261111, { nation: '苏联', phase: 'play' })
clear_pending(g)
/* 1. 苏联真实打出喀秋莎（状态卡留桌面） */
give(g, '17842', '苏联'); I.refresh(g)
R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', '17842') })
console.log('喀秋莎上桌 = ' + J((g.table['苏联'] || []).map(faceOf)))
/* 先按【苏联自己回合】发起陆战，确认核心功能本身是否生效 */
R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
I.refresh(g)

/* 2. 布阵：英国陆军<中国西部>；<中国东北>两支日本陆军；苏联陆军<中国西部> */
place(g, 'uk_w', '英国', 'army', '中国西部')
place(g, 'su_w', '苏联', 'army', '中国西部')
I.refresh(g)
R.action(g, 'Axis', 'debug_remove', { piece: 'p8' }); I.refresh(g)
g.location['jp1'] = NE; g.piece_nation['jp1'] = '日本'; g.piece_type['jp1'] = 'army'
g.location['jp2'] = NE; g.piece_nation['jp2'] = '日本'; g.piece_type['jp2'] = 'army'
I.refresh(g)
I.grant_supply(g, 'uk_w', g.turn || 1)
I.grant_supply(g, 'su_w', g.turn || 1)
I.refresh(g); I.compute_supply(g)

console.log('\n=== 初始 ===')
console.log('  中国东北 = ' + J(piecesAt(g, NE)))
console.log('  英国可发起 = ' + J(I.battle_initiators(g, '英国', NE).map(x => x.id)))
console.log('  苏联可发起 = ' + J(I.battle_initiators(g, '苏联', NE).map(x => x.id)))

/* 3. 苏联自己发起陆战（移除 1 支日军） */
give(g, '17801', '苏联'); I.refresh(g)
const n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', {
	card: instOf(g, '苏联', '17801'), space: NE, piece: 'jp1',
})
I.refresh(g)
console.log('\n=== 英国陆战后 ===')
console.log('  log = ' + logSince(g, n0).slice(0, 220))
console.log('  中国东北 = ' + J(piecesAt(g, NE)))
console.log('  status_instant = ' + J((g.status_instant || []).map(e => faceOf(e.card_id) + '@' + e.window)))
const ts = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
console.log('  喀秋莎 ready = ' + J(ts && { ready: ts.ready, space: ts.ready_space, why: ts.ready_reason }))
const ev = (g.status_instant || []).find(e => String(faceOf(e.card_id)) === '17842')
console.log('  窗口条目 ctx = ' + J(ev && ev.ctx && { space: ev.ctx.space, attacker: ev.ctx.attacker }))

/* 4. 发动喀秋莎打剩余日军 */
const cid = (g.table['苏联'] || []).find(x => faceOf(x) === '17842')
const hand0 = (g.hands['苏联'] || []).length
const drop = (g.hands['苏联'] || []).slice(0, 1)
const remain = I.pieces_on(g, NE).find(p => g.piece_nation[p] === '日本')
const n1 = (g.log || []).length
R.action(g, 'Allies', 'activate_status', {
	card: cid, discard: drop, space: NE, from: 'su_w', victim: remain,
})
I.refresh(g)
console.log('\n=== 喀秋莎发动后 ===')
console.log('  log = ' + logSince(g, n1).slice(0, 320))
console.log('  中国东北 = ' + J(piecesAt(g, NE)))
console.log('  手牌 苏联 ' + hand0 + '→' + (g.hands['苏联'] || []).length)
const ts2 = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
console.log('  喀秋莎 ready = ' + J(ts2 && { ready: ts2.ready, why: ts2.ready_reason }))
console.log('  pending_battle = ' + J(g.pending_battle && { stage: g.pending_battle.stage, space: g.pending_battle.space }))

/* 5. 若挂起代受，让日本表态后复查 */
if (g.pending_battle) {
	const n2 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { declined: true, retreat: null })
	I.refresh(g)
	console.log('\n=== 日本不代受后 ===')
	console.log('  log = ' + logSince(g, n2).slice(0, 260))
	console.log('  中国东北 = ' + J(piecesAt(g, NE)))
}

console.log('\n=== 结论观察点 ===')
console.log('  ① 喀秋莎 ready / 窗口 ctx.space 是否指向<中国东北>')
console.log('  ② 发动后剩余日军是否被移除（未移除 = 未实际生效）')
console.log('  ③ 代价（弃 1 张）是否扣、日志是否写"发起陆战"')
console.log('  ④ 若挂起代受，日本表态后是否真的结算')
