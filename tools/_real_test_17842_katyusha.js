/*
 * 2026-11-11 · 方案 A：17842《喀秋莎》after_land 窗口只认【发起国本人】
 *
 * 玩家口径：卡面「发起陆战后」的主语是卡主本人，不是"同阵营任一友方"。
 * 旧实现按同阵营武装 → 英国/美国发起陆战时把苏联喀秋莎塞进 status_instant，
 * 但 owner 判据 + status_instant_covers 都不放行 → 假窗口（亮起点不动）。
 *
 * 覆盖：
 *   A 苏联自己发起 → 窗口在、ready、可真实发动并移除日军、次数消耗
 *   B 英国发起 → 喀秋莎【不入窗口】（不再产生假窗口）
 *   C 美国发起 → 同 B
 *   D 17848《正面攻击》同款对照（同样是 after_land 卡）
 *   E 静态守卫：收紧条件存在、CROSS_NATION_STATUS_WINDOWS 不含 after_land
 *
 * 用法：node tools/_real_test_17842_katyusha.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const instOf = (g, nat, face) =>
	(g.hands[nat] || []).find(x => faceOf(x) === String(face)) || null
const winOf = (g, face) => (g.status_instant || [])
	.find(e => String(faceOf(e.card_id)) === String(face))
const piecesAt = (g, sp) => I.pieces_on(g, sp).map(p => p + ':' + g.piece_nation[p])

const NE = d.id_of('中国东北')
const W = d.id_of('中国西部')

/** 建盘：苏联先真实打出 statusFace，切到 attackNation 回合，<中国东北> 放 2 支 target 陆军 */
function scene(attackNation, statusFace, targetNation) {
	const tgt = targetNation || '日本'
	const g = new_board(20261111, { nation: '苏联', phase: 'play' })
	clear_pending(g)
	give(g, statusFace, '苏联'); I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', statusFace) })
	R.action(g, 'Allies', 'debug_set_phase', { nation: attackNation, phase: 'play' })
	I.refresh(g)
	place(g, 'atk_w', attackNation, 'army', '中国西部')
	place(g, 'su_w', '苏联', 'army', '中国西部')
	I.refresh(g)
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' }); I.refresh(g)
	g.location['jp1'] = NE; g.piece_nation['jp1'] = tgt; g.piece_type['jp1'] = 'army'
	g.location['jp2'] = NE; g.piece_nation['jp2'] = tgt; g.piece_type['jp2'] = 'army'
	I.refresh(g)
	I.grant_supply(g, 'atk_w', g.turn || 1)
	I.grant_supply(g, 'su_w', g.turn || 1)
	I.refresh(g); I.compute_supply(g)
	return g
}

/* ================= A. 苏联自己发起 → 真实生效 ================= */
console.log('\n=== A. 苏联自己发起陆战 → 喀秋莎真实生效 ===')
{
	const g = scene('苏联', '17842')
	give(g, '17801', '苏联'); I.refresh(g)
	ok('A0 喀秋莎在苏联桌面', (g.table['苏联'] || []).some(x => faceOf(x) === '17842'))
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '苏联', '17801'), space: NE, piece: 'jp1',
	})
	I.refresh(g)
	ok('A1 首战后<中国东北>剩 1 支日军', piecesAt(g, NE).length === 1, J(piecesAt(g, NE)))
	ok('★ A2 喀秋莎入窗口（after_land）', !!winOf(g, '17842'), J((g.status_instant || []).map(e => faceOf(e.card_id))))
	ok('★ A3 窗口 by = 发起国苏联', (winOf(g, '17842') || {}).by === '苏联',
		J(winOf(g, '17842') && winOf(g, '17842').by))
	const ts = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
	ok('A4 ready=true', !!(ts && ts.ready === true), J(ts && { ready: ts.ready, why: ts.ready_reason }))

	const cid = (g.table['苏联'] || []).find(x => faceOf(x) === '17842')
	const drop = (g.hands['苏联'] || []).slice(0, 1)
	const hand0 = (g.hands['苏联'] || []).length
	const remain = I.pieces_on(g, NE)[0]
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', {
		card: cid, discard: drop, space: NE, from: 'su_w', victim: remain,
	})
	I.refresh(g)
	const lg = logSince(g, n0)
	ok('★★ A5 发动后剩余日军被移除（真生效）', piecesAt(g, NE).length === 0, J(piecesAt(g, NE)))
	ok('A6 代价已扣（弃 1 张）', (g.hands['苏联'] || []).length === hand0 - 1,
		hand0 + '→' + (g.hands['苏联'] || []).length)
	ok('A7 日志写出发起陆战', /发起陆战/.test(lg), lg.slice(0, 160))
	const ts2 = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
	ok('A8 本回合次数已消耗', !!(ts2 && ts2.ready === false), J(ts2 && ts2.ready_reason))
}

/* ================= B. 英国发起 → 不再产生假窗口 ================= */
console.log('\n=== B. 英国发起陆战 → 喀秋莎不得入窗口 ===')
{
	const g = scene('英国', '17842')
	give(g, '15301', '英国'); I.refresh(g)
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp1',
	})
	I.refresh(g)
	ok('B1 英国陆战成功（移除 1 支日军）', piecesAt(g, NE).length === 1, J(piecesAt(g, NE)))
	ok('★★ B2 喀秋莎【不在】status_instant（旧实现会塞入假窗口）',
		!winOf(g, '17842'), J((g.status_instant || []).map(e => faceOf(e.card_id))))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', {
		card: (g.table['苏联'] || []).find(x => faceOf(x) === '17842'),
		discard: (g.hands['苏联'] || []).slice(0, 1), space: NE, from: 'su_w', victim: 'jp2',
	})
	const lg = logSince(g, n0)
	ok('B3 直发被明确拒绝（不是"白点"）', /不能触发非本方的状态卡|尚未满足发动条件|不在窗口/.test(lg),
		lg.slice(0, 160))
	ok('B4 日军未被移除（未生效即未扣代价）', piecesAt(g, NE).length === 1, J(piecesAt(g, NE)))
}

/* ================= C. 美国发起 → 同 B ================= */
console.log('\n=== C. 跨阵营（德国发起）→ 苏联喀秋莎不得入窗口 ===')
{
	/* 美国中立时不能主动打日本（neutal 规则），故用德国（轴心、非中立）打苏联陆军 */
	const g = scene('德国', '17842', '苏联')
	give(g, '15201', '德国'); I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', {
		card: instOf(g, '德国', '15201'), space: NE, piece: 'jp1',
	})
	I.refresh(g)
	ok('C1 德国陆战成功（移除 1 支苏联陆军）', piecesAt(g, NE).length === 1,
		J(piecesAt(g, NE)) + ' | ' + logSince(g, n0).slice(0, 140))
	ok('★★ C2 苏联喀秋莎【不在】status_instant（跨阵营也不武装）', !winOf(g, '17842'),
		J((g.status_instant || []).map(e => faceOf(e.card_id))))
}

/* ================= D. 17848《正面攻击》同款 ================= */
console.log('\n=== D. 17848《正面攻击》同款对照 ===')
{
	const g = scene('苏联', '17848')
	give(g, '17801', '苏联'); I.refresh(g)
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '苏联', '17801'), space: NE, piece: 'jp1',
	})
	I.refresh(g)
	ok('D1 苏联发起 → 17848 入窗口', !!winOf(g, '17848'),
		J((g.status_instant || []).map(e => faceOf(e.card_id))))

	const g2 = scene('英国', '17848')
	give(g2, '15301', '英国'); I.refresh(g2)
	R.action(g2, 'Allies', 'play_card', {
		card: instOf(g2, '英国', '15301'), space: NE, piece: 'jp1',
	})
	I.refresh(g2)
	ok('★★ D2 英国发起 → 17848 不入窗口（同款收紧）', !winOf(g2, '17848'),
		J((g2.status_instant || []).map(e => faceOf(e.card_id))))
}

/* ================= E. 静态守卫 ================= */
console.log('\n=== E. 静态守卫（防回退成同阵营武装）===')
{
	const fs = require('fs')
	const path = require('path')
	const src = fs.readFileSync(path.join(L.MOD, 'rules.js'), 'utf8')
	const code = src.split('\n').filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l)).join('\n')
	ok('E1 arm_status_instant 含 after_land 只认发起国的收紧',
		/window === 'after_land' && own !== nation/.test(code))
	ok('E2 CROSS_NATION_STATUS_WINDOWS 仍不含 after_land（不放开代发）',
		!/CROSS_NATION_STATUS_WINDOWS\s*=\s*\{[^}]*after_land/.test(code))
	ok('E3 after_ally_battle 仍是同阵营窗口',
		/CROSS_NATION_STATUS_WINDOWS[\s\S]{0,120}after_ally_battle/.test(code))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
