/*
 * 只读探针：17900《八月风暴》实现 + 组合场景
 *   桌上 17842《喀秋莎》(after_land 状态卡)
 *   + <中国东部> 日本陆军 + 同地区日本空军
 *   + 友方(英国)攻击<中国东北> 触发 17900 让权苏联
 *   + 17900 第二步选<中国东部>发起陆战
 *
 * 不改任何产品代码。new_board() 建真实盘面，全程 R.action 驱动。
 * 用法：node tools/_probe_17900_katyusha_air.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const NE = d.id_of('中国东北')     // 21
const CE = d.id_of('中国东部')     // 22
const W = d.id_of('中国西部')

const instOf = (g, nation, face) =>
	(g.hands[nation] || []).find(x => faceOf(x) === String(face)) || null
const pieces = (g, sp) => I.pieces_on(g, sp).map(p =>
	p + ':' + g.piece_nation[p] + '/' + g.piece_type[p])

function dump(g, tag) {
	console.log('\n--- ' + tag + ' ---')
	console.log('  active=' + g.active + ' current_nation=' + g.current_nation +
		' phase=' + g.turn_phase)
	console.log('  中国东北 = ' + J(pieces(g, NE)))
	console.log('  中国东部 = ' + J(pieces(g, CE)))
	console.log('  armed_offers = ' + J((g.armed_offers || []).map(w => ({
		when: w.when, kind: w.kind, faces: (w.cards || []).map(c => faceOf(c.card_id)),
		arg: w.arg && { space: w.arg.space, newPiece: w.arg.newPiece },
		pending: w.pending && { need: w.pending.need, cands: w.pending.candidates },
	}))))
	console.log('  pending_armed_delegate = ' + J(g.pending_armed_delegate && {
		card: g.pending_armed_delegate.card_id, space: g.pending_armed_delegate.space,
	}))
	console.log('  pending_battle = ' + J(g.pending_battle && {
		stage: g.pending_battle.stage, space: g.pending_battle.space,
		victim: g.pending_battle.victim, attacker: g.pending_battle.attacker,
		defender: g.pending_battle.defender_nation, airs: g.pending_battle.airs,
	}))
	console.log('  status_instant = ' + J((g.status_instant || []).map(e =>
		faceOf(e.card_id) + '@' + e.window)))
	const ts = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
	console.log('  table_status[17842] = ' + J(ts && { ready: ts.ready, why: ts.ready_reason, space: ts.ready_space }))
	console.log('  view(Allies).actions = ' + J(Object.keys(R.view(g, 'Allies').actions || {}).slice(0, 22)))
	console.log('  view(Axis).actions  = ' + J(Object.keys(R.view(g, 'Axis').actions || {}).slice(0, 22)))
	console.log('  waiting_for = ' + J(R.view(g, 'Allies').waiting_for) + ' / ' +
		J(R.view(g, 'Axis').waiting_for))
}

/* ================= 建盘 ================= */
const g = new_board(20261111, { nation: '苏联', phase: 'play' })
clear_pending(g)
/* 先在苏联回合真实打出 17842 喀秋莎（状态卡留桌、占名额） */
give(g, '17842', '苏联')
I.refresh(g)
const c17842 = instOf(g, '苏联', '17842')
R.action(g, 'Allies', 'play_card', { card: c17842 })
I.refresh(g)
console.log('喀秋莎打出 log = ' + logSince(g, Math.max(0, (g.log || []).length - 3)))
console.log('苏联桌面 = ' + J(g.table['苏联'] || []))

/* 切到英国出牌阶段 */
R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
I.refresh(g)

/* 布阵：日军守<中国东北>；英军在<中国西部> */
place(g, 'jp_ne', '日本', 'army', '中国东北')
place(g, 'uk_w', '英国', 'army', '中国西部')
/* 苏联真实补给链：西伯利亚→海参崴→中国东北 */
place(g, 'su_sib', '苏联', 'army', '西伯利亚')
place(g, 'su_vl', '苏联', 'army', '海参崴')
I.refresh(g)
/*
 * <中国东部> 开局有中国陆军 p8（与日本敌对，debug_place 会静默拒绝），
 * 按 rtt-atomic-operations「摆初始局面手写三字段」：先真实移除 p8，
 * 再手写放日本陆军 + 同地区日本空军（复现玩家报的「陆军+飞机」）。
 */
R.action(g, 'Axis', 'debug_remove', { piece: 'p8' })
I.refresh(g)
g.location['jp_ce'] = CE
g.piece_nation['jp_ce'] = '日本'
g.piece_type['jp_ce'] = 'army'
g.location['jp_air'] = CE
g.piece_nation['jp_air'] = '日本'
g.piece_type['jp_air'] = 'air'
I.refresh(g)
I.grant_supply(g, 'uk_w', g.turn || 1)
I.refresh(g)
I.compute_supply(g)
console.log('  [布阵复查] 中国东部 = ' + J(I.pieces_on(g, CE).map(p =>
	p + ':' + g.piece_nation[p] + '/' + g.piece_type[p])))

/* 手牌：英国《发起陆战》15301；苏联 17900 + 建设陆军 17800（代价） */
give(g, '15301', '英国')
give(g, '17900', '苏联')
give(g, '17800', '苏联')
I.refresh(g)

console.log('\n=== 初始布阵 ===')
console.log('  中国东北 neighbors(allies) = ' + J(I.get_connections(g, NE, 'allies')))
console.log('  英国可发起对<中国东北> = ' + J(I.battle_initiators(g, '英国', NE)))
console.log('  苏联手牌 = ' + J(g.hands['苏联']))
dump(g, 'S0 布阵完成')

/* ================= S1 英国攻击<中国东北> -> 17900 窗口 ================= */
const n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', { card: instOf(g, '英国', '15301'), space: NE, piece: 'jp_ne' })
I.refresh(g)
console.log('\n=== S1 英国打<中国东北> log ===\n  ' + logSince(g, n0).slice(0, 400))
dump(g, 'S1 友方攻击后')

/* ================= S2 发动 17900 第一步 ================= */
const c17900 = instOf(g, '苏联', '17900')
const c17800 = instOf(g, '苏联', '17800')
const n1 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: c17900, drop: [c17800] })
I.refresh(g)
console.log('\n=== S2 发动 17900 第一步 log ===\n  ' + logSince(g, n1).slice(0, 400))
dump(g, 'S2 征召苏军后（need:space）')

/* ================= S3 第二步选<中国东部> ================= */
const n2 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: c17900, space: CE })
I.refresh(g)
console.log('\n=== S3 第二步打<中国东部> log ===\n  ' + logSince(g, n2).slice(0, 500))
dump(g, 'S3 第二步陆战后（★ 关键检查点）')

/* ================= S4 若挂起，防守方日本表态 ================= */
if (g.pending_battle) {
	const n3 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { declined: true, retreat: null })
	I.refresh(g)
	console.log('\n=== S4 日本「不代受」后 log ===\n  ' + logSince(g, n3).slice(0, 500))
	dump(g, 'S4 空军挂起结算后')
}

/* ================= S5 喀秋莎能否发动 ================= */
{
	const cid = (g.table['苏联'] || []).find(x => faceOf(x) === '17842')
	if (cid) {
		/* 喀秋莎 cost.discard=1，需玩家自选 1 张手牌；arg.from 用新征召苏军 */
		const drop = (g.hands['苏联'] || []).slice(0, 1)
		const newP = I.pieces_on(g, NE).find(p =>
			g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army')
		const n4 = (g.log || []).length
		R.action(g, 'Allies', 'activate_status', {
			card: cid, discard: drop, space: CE, from: newP, victim: 0,
		})
		I.refresh(g)
		console.log('\n=== S5 尝试发动喀秋莎 log ===\n  ' + logSince(g, n4).slice(0, 400))
		dump(g, 'S5 喀秋莎发动后')
	}
}

console.log('\n=== 结论观察点 ===')
console.log('  ① S2 候选是否含<中国东部>(22)')
console.log('  ② S3 是否残留 pending_battle（空军代受挂起）而 armed 窗口/让权已清空')
console.log('  ③ S3 是否把 17900 卡提前结算（进弃牌堆）但战斗未落地')
console.log('  ④ 喀秋莎 after_land 窗口是否在 S3 出现、S4/S5 是否可发动')
